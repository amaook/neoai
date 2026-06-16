// tests/web-fetch.test.mjs — 网页抓取编码探测（1.1.1）
// 验证国内常见 GBK/GB2312 编码网页不再被当成 utf-8 解码导致乱码。

import { describe, it, expect } from "vitest";
import { detectCharset, decodeHtmlBuffer } from "../server/tools.mjs";

// “中文” 的 GBK 编码字节：中=D6D0，文=CEC4
const GBK_ZHONGWEN = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);

describe("detectCharset 网页编码探测", () => {
  it("优先采用 HTTP 头里的 charset", () => {
    expect(detectCharset(Buffer.from("<html></html>"), "text/html; charset=gbk")).toBe("gbk");
  });

  it("无 HTTP 头时回退到 <meta charset> 声明", () => {
    expect(detectCharset(Buffer.from('<meta charset="GB2312">'), "")).toBe("gb2312");
  });

  it("识别 <meta http-equiv> 形式的 charset", () => {
    const buf = Buffer.from('<meta http-equiv="Content-Type" content="text/html; charset=big5">');
    expect(detectCharset(buf, "")).toBe("big5");
  });

  it("识别 UTF-8 BOM", () => {
    expect(detectCharset(Buffer.from([0xef, 0xbb, 0xbf, 0x41]), "")).toBe("utf-8");
  });

  it("都没有时默认 utf-8", () => {
    expect(detectCharset(Buffer.from("plain text"), "")).toBe("utf-8");
  });
});

describe("decodeHtmlBuffer 按探测编码解码", () => {
  it("依据 HTTP 头把 GBK 字节正确解码成中文", () => {
    expect(decodeHtmlBuffer(GBK_ZHONGWEN, "text/html; charset=gbk")).toBe("中文");
  });

  it("依据 <meta> 声明解码 GBK 正文", () => {
    const buf = Buffer.concat([Buffer.from('<meta charset="gbk"><body>'), GBK_ZHONGWEN]);
    expect(decodeHtmlBuffer(buf, "")).toContain("中文");
  });

  it("把 GBK 字节当 utf-8 解码会乱码（回归对照）", () => {
    // 这是修复前的行为，确认确实会出问题，从而证明探测的必要性
    expect(GBK_ZHONGWEN.toString("utf8")).not.toBe("中文");
  });

  it("不支持的编码标签回退 utf-8 而不抛错", () => {
    const utf8 = Buffer.from("正常内容", "utf8");
    expect(decodeHtmlBuffer(utf8, "text/html; charset=x-unknown-foo")).toBe("正常内容");
  });
});
