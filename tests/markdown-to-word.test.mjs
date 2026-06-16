// tests/markdown-to-word.test.mjs — Markdown → Word（1.5 办公补缺收尾）

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { markdownToDocxArgs, handleToolCall } from "../server/tools.mjs";

describe("markdownToDocxArgs 解析", () => {
  it("首个标题作为文档标题，## 作为章节", () => {
    const out = markdownToDocxArgs("# 月度报告\n\n## 概览\n\n正文一段\n\n## 明细\n- 项 A\n- 项 B");
    expect(out.title).toBe("月度报告");
    expect(out.sections.map((s) => s.title)).toEqual(["概览", "明细"]);
    expect(out.sections[0].paragraphs).toContain("正文一段");
    expect(out.sections[1].bullets).toEqual(["项 A", "项 B"]);
  });

  it("显式 title 优先，标题不被首个 # 覆盖", () => {
    const out = markdownToDocxArgs("# 不该当标题\n\n正文", "指定标题");
    expect(out.title).toBe("指定标题");
    expect(out.sections.map((s) => s.title)).toContain("不该当标题");
  });

  it("解析 Markdown 表格为 headers/rows", () => {
    const md = "## 待办\n\n| 事项 | 负责人 |\n| --- | --- |\n| 写周报 | 张三 |\n| 对账 | 李四 |";
    const out = markdownToDocxArgs(md);
    expect(out.tables).toHaveLength(1);
    expect(out.tables[0].headers).toEqual(["事项", "负责人"]);
    expect(out.tables[0].rows).toEqual([["写周报", "张三"], ["对账", "李四"]]);
  });

  it("去除行内 markdown 标记", () => {
    const out = markdownToDocxArgs("# T\n\n这是 **粗体** 和 `代码` 与 [链接](http://x)");
    expect(out.paragraphs.join("")).toContain("粗体");
    expect(out.paragraphs.join("")).not.toContain("**");
    expect(out.paragraphs.join("")).not.toContain("`");
  });
});

describe("create_word_file 支持 markdown", () => {
  let originalCtx;
  let workspaceRoot;
  beforeEach(async () => {
    originalCtx = { ...ctx };
    workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-md2word-"));
    Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false });
  });
  afterEach(async () => {
    Object.assign(ctx, originalCtx);
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("传 markdown 能生成并回读校验通过的 Word", async () => {
    const r = await handleToolCall("create_word_file", {
      path: "outputs/from-md.docx",
      markdown: "# 周报\n\n## 本周完成\n- 完成 A\n- 完成 B\n\n## 下周计划\n- 计划 C"
    }, { fileWrite: true, fileRead: true });
    expect(r).toMatchObject({ ok: true, verified: true });
    expect(r.verification.details.text).toContain("周报");
    expect(r.verification.details.text).toContain("完成 A");
  });
});
