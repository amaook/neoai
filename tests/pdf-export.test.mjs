// tests/pdf-export.test.mjs — PDF 导出 create_pdf_file（1.5 办公补缺）

import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { markdownToPdfHtml, handleToolCall, isToolAllowedByConsent } from "../server/tools.mjs";

describe("markdownToPdfHtml 转换", () => {
  it("标题/列表/加粗/行内代码转换正确", () => {
    const html = markdownToPdfHtml("# 标题\n\n正文 **粗** 和 `code`\n\n- 一\n- 二", "报告");
    expect(html).toContain("<h1 class=\"doc-title\">报告</h1>");
    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<strong>粗</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>一</li>");
  });

  it("转义 HTML 特殊字符，防止注入/破坏排版", () => {
    const html = markdownToPdfHtml("正文 <script>alert(1)</script> & <b>", "");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });
});

describe("create_pdf_file 工具", () => {
  let originalCtx;
  let workspaceRoot;
  beforeEach(async () => {
    originalCtx = { ...ctx };
    workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-pdf-"));
    Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false, renderPdfFile: null });
  });
  afterEach(async () => {
    Object.assign(ctx, originalCtx);
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("需要 fileWrite 权限", () => {
    expect(isToolAllowedByConsent("create_pdf_file", { fileWrite: true })).toBe(true);
    expect(isToolAllowedByConsent("create_pdf_file", { fileWrite: false })).toBe(false);
  });

  it("非 .pdf 路径被拒", async () => {
    ctx.renderPdfFile = async () => ({ ok: true });
    const r = await handleToolCall("create_pdf_file", { path: "out/report.txt", markdown: "x" }, { fileWrite: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain(".pdf");
  });

  it("无 Electron 渲染能力时返回桌面端提示", async () => {
    const r = await handleToolCall("create_pdf_file", { path: "out/report.pdf", markdown: "x" }, { fileWrite: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("桌面端");
  });

  it("有渲染能力时把 HTML 交给 renderPdfFile 并落盘", async () => {
    let seenHtml = "";
    ctx.renderPdfFile = async ({ html, outputPath }) => { seenHtml = html; await writeFile(outputPath, Buffer.from("%PDF-1.4\n% fake for test\n")); return { ok: true }; };
    const r = await handleToolCall("create_pdf_file", { path: "outputs/report.pdf", title: "周报", markdown: "# 周报\n\n- 完成 A" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.path).toBe("outputs/report.pdf");
    expect(seenHtml).toContain("周报");
    expect((await stat(path.join(workspaceRoot, "outputs/report.pdf"))).size).toBeGreaterThan(0);
  });

  it("缺少内容时报错", async () => {
    ctx.renderPdfFile = async () => ({ ok: true });
    const r = await handleToolCall("create_pdf_file", { path: "out/report.pdf" }, { fileWrite: true });
    expect(r.ok).toBe(false);
  });
});
