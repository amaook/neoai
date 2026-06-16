// tests/search-workspace.test.mjs — 问我的文件 search_workspace（1.6 本地知识库）

import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { handleToolCall, isToolAllowedByConsent } from "../server/tools.mjs";

let originalCtx;
let workspaceRoot;

beforeEach(async () => {
  originalCtx = { ...ctx };
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-kb-"));
  Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false });
});
afterEach(async () => {
  Object.assign(ctx, originalCtx);
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

async function write(rel, content) {
  const target = path.join(workspaceRoot, rel);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

describe("search_workspace 跨文件检索", () => {
  it("需要 fileRead 权限", () => {
    expect(isToolAllowedByConsent("search_workspace", { fileRead: true })).toBe(true);
    expect(isToolAllowedByConsent("search_workspace", { fileRead: false })).toBe(false);
  });

  it("在文本文件里按关键词命中并给出片段", async () => {
    await write("notes/a.md", "项目预算是 120 万，由财务部审批。");
    await write("notes/b.txt", "这里讲的是排期，与预算无关。");
    const r = await handleToolCall("search_workspace", { query: "预算 审批" }, { fileRead: true });
    expect(r.ok).toBe(true);
    const top = r.results[0];
    expect(top.path).toContain("a.md");
    expect(top.snippet).toContain("预算");
  });

  it("能搜进 Office 文件内容（docx）", async () => {
    // 用 create_word_file 造一个含关键词的真实 docx
    await handleToolCall("create_word_file", {
      path: "docs/report.docx",
      title: "季度复盘",
      paragraphs: ["关键指标：客户留存率显著提升。"]
    }, { fileWrite: true, fileRead: true });
    const r = await handleToolCall("search_workspace", { query: "客户留存率" }, { fileRead: true });
    expect(r.ok).toBe(true);
    expect(r.results.some((x) => x.path.includes("report.docx"))).toBe(true);
  });

  it("无命中时返回空结果而非报错", async () => {
    await write("a.md", "无关内容");
    const r = await handleToolCall("search_workspace", { query: "不存在的关键词zzz" }, { fileRead: true });
    expect(r.ok).toBe(true);
    expect(r.count).toBe(0);
  });

  it("缺少 query 报缺参", async () => {
    const r = await handleToolCall("search_workspace", {}, { fileRead: true });
    expect(r.ok).toBe(false);
  });

  it("文件名命中应排在仅正文一次命中的文件之前", async () => {
    await write("2026预算表.md", "本文档与排期相关。");
    await write("notes/long.md", "预算 ".repeat(3) + "其他内容。");
    const r = await handleToolCall("search_workspace", { query: "预算" }, { fileRead: true });
    expect(r.ok).toBe(true);
    expect(r.results[0].path).toContain("2026预算表.md");
    expect(r.results[0].nameMatch).toBe(true);
  });

  it("相邻命中完整短语的文件分数高于两词分散的文件", async () => {
    await write("a.md", "季度财务报告：本季营收创新高。");
    await write("b.md", "财务部门负责审核，月度报告随后发布。");
    const r = await handleToolCall("search_workspace", { query: "财务 报告" }, { fileRead: true });
    const a = r.results.find((x) => x.path === "a.md");
    const b = r.results.find((x) => x.path === "b.md");
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("长文档不会仅靠堆词频霸榜（命中全部关键词的短文档更靠前）", async () => {
    await write("focused.md", "本文同时讨论 预算 与 审批 两件事。");
    await write("noisy.md", "预算 ".repeat(40) + "（通篇只反复提这一项）");
    const r = await handleToolCall("search_workspace", { query: "预算 审批" }, { fileRead: true });
    expect(r.results[0].path).toContain("focused.md");
  });

  it("片段对命中词加【】高亮", async () => {
    await write("doc.md", "这一段提到客户留存率非常关键。");
    const r = await handleToolCall("search_workspace", { query: "客户留存率" }, { fileRead: true });
    expect(r.results[0].snippet).toContain("【客户留存率】");
  });
});
