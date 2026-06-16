// tests/utils.test.mjs — neo 核心工具函数单元测试
// 运行: npm test   （需先 npm install 安装 vitest）
// 这些测试只覆盖纯函数，不依赖外部 npm 包，可在无 node_modules 环境下验证逻辑。

import { describe, it, expect } from "vitest";

// ── 内联被测函数（避免 import 时触发 npm 包加载）─────────────────────────────
// 下面直接复制自 server/tools.mjs 的纯函数，方便独立测试。
// 当项目安装好依赖后，可改为 import { htmlToText, clamp, ... } from "../server/tools.mjs"

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function compactWhitespace(text = "") {
  return String(text).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function decodeHtmlEntities(text = "") {
  const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return String(text).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase();
    if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(parseInt(key.slice(1), 10));
    return named[key] ?? match;
  });
}

function htmlToText(html = "") {
  if (html == null) return "";
  return compactWhitespace(decodeHtmlEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|section|article|header|footer|main|aside|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  ));
}

function trimOutput(text, limit = 12000) {
  const value = String(text ?? "");
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n\n[output trimmed: ${value.length - limit} chars]`;
}

function cleanSheetName(name, index) {
  const fallback = `Sheet${index + 1}`;
  const cleaned = String(name || fallback).replace(/[\\/?*\[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
  return cleaned || fallback;
}

function safeJson(value) { return JSON.stringify(value, null, 2); }

function parseArguments(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch {
    return { __parseError: true, __raw: String(value).slice(0, 2000) };
  }
}

function endpointFromBase(baseUrl, suffix) {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!clean) return "";
  if (clean.endsWith(suffix)) return clean;
  return `${clean}${suffix}`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("値が範囲内に収まる", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-5, 1, 10)).toBe(1);
    expect(clamp(15, 1, 10)).toBe(10);
    expect(clamp(NaN, 1, 10)).toBe(1);
  });
});

describe("htmlToText", () => {
  it("タグを除去する", () => {
    expect(htmlToText("<p>Hello <b>World</b></p>")).toBe("Hello World");
  });
  it("script/style ブロックを除去する", () => {
    expect(htmlToText("<style>.a{color:red}</style><p>text</p>")).toBe("text");
    expect(htmlToText("<script>alert(1)</script><p>safe</p>")).toBe("safe");
  });
  it("HTML エンティティをデコードする", () => {
    expect(htmlToText("&lt;b&gt;&amp;hello&lt;/b&gt;")).toBe("<b>&hello</b>");
  });
  it("br タグを改行に変換する", () => {
    const result = htmlToText("line1<br>line2");
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });
  it("コメントを除去する", () => {
    expect(htmlToText("<!-- comment -->visible")).toBe("visible");
  });
  it("空文字列を処理する", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText(null)).toBe("");
  });
});

describe("decodeHtmlEntities", () => {
  it("名前付きエンティティ", () => {
    expect(decodeHtmlEntities("&amp;&lt;&gt;&quot;&apos;&nbsp;")).toBe("&<>\"' ");
  });
  it("数値エンティティ（10進）", () => {
    expect(decodeHtmlEntities("&#65;")).toBe("A");
  });
  it("数値エンティティ（16進）", () => {
    expect(decodeHtmlEntities("&#x41;")).toBe("A");
  });
  it("不明なエンティティはそのまま", () => {
    expect(decodeHtmlEntities("&unknown;")).toBe("&unknown;");
  });
});

describe("trimOutput", () => {
  it("制限以下の場合はそのまま", () => {
    expect(trimOutput("hello", 100)).toBe("hello");
  });
  it("制限超過の場合はカット", () => {
    const result = trimOutput("a".repeat(50), 10);
    expect(result.startsWith("aaaaaaaaaa")).toBe(true);
    expect(result).toContain("[output trimmed:");
  });
  it("null/undefined を処理する", () => {
    expect(trimOutput(null)).toBe("");
    expect(trimOutput(undefined)).toBe("");
  });
});

describe("cleanSheetName", () => {
  it("無効文字を置換する", () => {
    expect(cleanSheetName("My/Sheet:Name", 0)).toBe("My Sheet Name");
  });
  it("31文字に切り詰める", () => {
    expect(cleanSheetName("a".repeat(40), 0).length).toBeLessThanOrEqual(31);
  });
  it("空名にはフォールバック名を使う", () => {
    expect(cleanSheetName("", 2)).toBe("Sheet3");
    expect(cleanSheetName(null, 0)).toBe("Sheet1");
  });
});

describe("safeJson", () => {
  it("オブジェクトを JSON 文字列に変換する", () => {
    expect(safeJson({ ok: true })).toBe('{\n  "ok": true\n}');
  });
  it("null を処理する", () => {
    expect(safeJson(null)).toBe("null");
  });
});

describe("parseArguments", () => {
  it("JSON 文字列をパースする", () => {
    expect(parseArguments('{"key":"val"}')).toEqual({ key: "val" });
  });
  it("オブジェクトをそのまま返す", () => {
    expect(parseArguments({ a: 1 })).toEqual({ a: 1 });
  });
  it("空/null は空オブジェクト", () => {
    expect(parseArguments(null)).toEqual({});
    expect(parseArguments("")).toEqual({});
  });
  it("不正な JSON はパースエラー標記を返す", () => {
    expect(parseArguments("not json")).toMatchObject({ __parseError: true, __raw: "not json" });
    expect(parseArguments('{"path":"a.md","content":"trunc')).toMatchObject({ __parseError: true });
  });
});

describe("endpointFromBase", () => {
  it("suffix を追加する", () => {
    expect(endpointFromBase("https://api.example.com/v1", "/chat/completions")).toBe("https://api.example.com/v1/chat/completions");
  });
  it("末尾スラッシュを除去する", () => {
    expect(endpointFromBase("https://api.example.com/v1/", "/chat/completions")).toBe("https://api.example.com/v1/chat/completions");
  });
  it("既に suffix で終わる場合はそのまま", () => {
    expect(endpointFromBase("https://api.example.com/v1/chat/completions", "/chat/completions")).toBe("https://api.example.com/v1/chat/completions");
  });
  it("空の baseUrl は空文字列を返す", () => {
    expect(endpointFromBase("", "/messages")).toBe("");
    expect(endpointFromBase(null, "/messages")).toBe("");
  });
});

describe("compactWhitespace", () => {
  it("余分な空白を圧縮する", () => {
    expect(compactWhitespace("hello   world")).toBe("hello world");
  });
  it("3 行以上の空行を 2 行に圧縮する", () => {
    expect(compactWhitespace("a\n\n\n\nb")).toBe("a\n\nb");
  });
  it("前後の空白をトリムする", () => {
    expect(compactWhitespace("  hello  ")).toBe("hello");
  });
});
