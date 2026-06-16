// tests/web-read-pages.test.mjs — 批量读网页 / 主正文提取 / 信息搜集技能（1.2 第一批）

import { describe, it, expect, vi, afterEach } from "vitest";
import { extractMainContent, handleToolCall, toolsForSkillIds, serverSkillDefs } from "../server/tools.mjs";

function htmlResponse(html, reqUrl) {
  const bytes = new TextEncoder().encode(html);
  return {
    ok: true,
    url: String(reqUrl),
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

afterEach(() => { vi.unstubAllGlobals(); });

describe("extractMainContent 主正文提取", () => {
  it("提取 <article> 正文并剥离导航 / 页脚", () => {
    const body = "正文段落".repeat(80);
    const html = `<html><body><nav>首页 关于 登录</nav><article>${body}</article><footer>版权所有 备案号</footer></body></html>`;
    const text = extractMainContent(html);
    expect(text).toContain("正文段落");
    expect(text).not.toContain("版权所有");
    expect(text).not.toContain("登录");
  });

  it("没有 article 时回退去噪后的全文", () => {
    const html = "<html><body><div>" + "纯文字".repeat(80) + "</div></body></html>";
    expect(extractMainContent(html)).toContain("纯文字");
  });
});

describe("read_web_pages 批量读取", () => {
  it("并行读取多个公网页面并返回各页正文", async () => {
    const html = "<article>" + "正文内容".repeat(60) + "</article>";
    vi.stubGlobal("fetch", vi.fn(async (u) => htmlResponse(html, u)));

    const r = await handleToolCall("read_web_pages", {
      urls: ["https://203.0.113.10/a", "https://203.0.113.11/b"]
    }, { web: true });

    expect(r.ok).toBe(true);
    expect(r.count).toBe(2);
    expect(r.okCount).toBe(2);
    expect(r.pages[0].text).toContain("正文内容");
  });

  it("跳过指向内网的页面但不影响其它页面", async () => {
    const html = "<article>" + "公开正文".repeat(60) + "</article>";
    vi.stubGlobal("fetch", vi.fn(async (u) => htmlResponse(html, u)));

    const r = await handleToolCall("read_web_pages", {
      urls: ["http://127.0.0.1/secret", "https://203.0.113.10/ok"]
    }, { web: true });

    expect(r.pages.find((p) => p.url.includes("127.0.0.1")).ok).toBe(false);
    expect(r.pages.find((p) => p.url.includes("203.0.113.10")).ok).toBe(true);
    expect(r.okCount).toBe(1);
  });

  it("缺少 urls 时返回错误", async () => {
    const r = await handleToolCall("read_web_pages", { urls: [] }, { web: true });
    expect(r.ok).toBe(false);
  });
});

describe("research 信息搜集技能", () => {
  it("已注册并暴露搜集所需工具", () => {
    expect(serverSkillDefs.research).toBeTruthy();
    const names = toolsForSkillIds(["research"], { web: true, fileWrite: true }).map((t) => t.function.name);
    expect(names).toEqual(expect.arrayContaining(["search_web", "read_web_pages", "write_file"]));
  });

  it("未授权写入时不暴露 write_file（权限门控生效）", () => {
    const names = toolsForSkillIds(["research"], { web: true, fileWrite: false }).map((t) => t.function.name);
    expect(names).toContain("search_web");
    expect(names).not.toContain("write_file");
  });
});
