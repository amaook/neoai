// tests/web-search.test.mjs — 搜索引擎兜底与缓存重试（1.1.3 / 1.1.4）

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchWeb, bingRedirectUrl, resetSearchCache } from "../server/tools.mjs";

// 一条 Bing b_algo 结果，足以让 parseBingHtml 命中
const bingHtml = `
<ol id="b_results">
  <li class="b_algo"><h2><a href="https://example.com/page">示例标题</a></h2><p>这是一段摘要内容</p></li>
</ol>`;

function htmlResponse(html, url = "https://cn.bing.com/search") {
  const bytes = new TextEncoder().encode(html);
  return {
    ok: true,
    url,
    headers: {
      get(name) {
        const key = String(name).toLowerCase();
        if (key === "content-type") return "text/html; charset=utf-8";
        if (key === "content-length") return String(bytes.length);
        return null;
      }
    },
    arrayBuffer: async () => bytes.buffer
  };
}

beforeEach(() => { resetSearchCache(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("bingRedirectUrl 还原 ck/a 跳转", () => {
  it("解码 u=a1<base64url> 得到真实地址", () => {
    const real = "https://example.com/article?id=9";
    const u = "a1" + Buffer.from(real, "utf8").toString("base64url");
    expect(bingRedirectUrl(`https://www.bing.com/ck/a?ptn=1&u=${u}`)).toBe(real);
  });

  it("非跳转链接原样返回", () => {
    expect(bingRedirectUrl("https://example.com/x")).toBe("https://example.com/x");
  });
});

describe("searchWeb 引擎顺序", () => {
  it("中文查询优先请求 Bing（cn.bing.com）", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url) => { calls.push(String(url)); return htmlResponse(bingHtml); }));

    const r = await searchWeb({ query: "北京今天天气" });
    expect(r.ok).toBe(true);
    expect(r.engine).toBe("Bing");
    expect(new URL(calls[0]).hostname).toBe("cn.bing.com");
    expect(calls).toHaveLength(1); // Bing 出结果后即停止
    expect(r.results[0]).toMatchObject({ title: "示例标题", url: "https://example.com/page" });
  });

  it("英文查询优先请求 DuckDuckGo", async () => {
    const calls = [];
    // 返回空页，让其逐个回退，只验证首个被请求的引擎
    vi.stubGlobal("fetch", vi.fn(async (url) => { calls.push(String(url)); return htmlResponse("<html></html>"); }));

    await searchWeb({ query: "weather in tokyo" });
    expect(new URL(calls[0]).hostname).toBe("duckduckgo.com");
  });
});

describe("searchWeb site / 时效参数", () => {
  it("site 参数被拼进查询语法", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url) => { calls.push(String(url)); return htmlResponse(bingHtml); }));

    await searchWeb({ query: "疫苗 接种", site: "gov.cn" });
    expect(new URL(calls[0]).searchParams.get("q")).toContain("site:gov.cn");
  });

  it("freshness=week 映射到 DuckDuckGo 的 df 参数", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url) => { calls.push(String(url)); return htmlResponse("<html></html>"); }));

    await searchWeb({ query: "open source llm", freshness: "week" });
    expect(new URL(calls[0]).searchParams.get("df")).toBe("w");
  });
});

describe("searchWeb 缓存与重试", () => {
  it("相同查询在 TTL 内命中缓存，不再发起请求", async () => {
    const fetchMock = vi.fn(async () => htmlResponse(bingHtml));
    vi.stubGlobal("fetch", fetchMock);

    const first = await searchWeb({ query: "缓存测试关键词" });
    const second = await searchWeb({ query: "缓存测试关键词" });

    expect(first.ok).toBe(true);
    expect(first.cached).toBeUndefined();
    expect(second.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("瞬时错误（503）退避后重试一次即成功", async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error("HTTP 503"), { status: 503 });
      return htmlResponse(bingHtml);
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await searchWeb({ query: "重试测试关键词" });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
