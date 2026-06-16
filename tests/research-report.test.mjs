// tests/research-report.test.mjs — 带来源简报结构化产出（1.2.5）

import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ctx } from "../server/context.mjs";
import { buildResearchReport, handleToolCall, toolsForSkillIds } from "../server/tools.mjs";

describe("buildResearchReport 结构化与去重", () => {
  it("生成标题 / 摘要 / 分节 / 去重来源", () => {
    const { markdown, sourceCount } = buildResearchReport({
      title: "测试主题",
      summary: "概述内容",
      sections: [{ heading: "要点", content: "内容A" }, { heading: "细节", content: "内容B" }],
      sources: [
        { title: "源1", url: "https://a.com/1" },
        { title: "源1重复", url: "https://a.com/1" },
        { title: "源2", url: "https://b.com/2" }
      ]
    });
    expect(sourceCount).toBe(2);
    expect(markdown).toContain("# 测试主题");
    expect(markdown).toContain("## 摘要");
    expect(markdown).toContain("## 要点");
    expect(markdown).toContain("## 来源");
    expect(markdown).toContain("[源1](https://a.com/1)");
    expect((markdown.match(/a\.com\/1/g) || []).length).toBe(1); // URL 去重
  });
});

describe("save_research_report 落地工作区", () => {
  let original;
  let workspace;
  beforeEach(async () => {
    original = ctx.workspaceRoot;
    workspace = await mkdtemp(path.join(tmpdir(), "neo-research-"));
    ctx.workspaceRoot = workspace;
  });
  afterEach(async () => {
    ctx.workspaceRoot = original;
    if (workspace) await rm(workspace, { recursive: true, force: true });
  });

  it("默认写到 Research/ 并回读校验内容", async () => {
    const r = await handleToolCall("save_research_report", {
      title: "周度 AI 动态",
      summary: "本周要点",
      sections: [{ heading: "模型", content: "X 发布新版本" }],
      sources: [{ title: "来源A", url: "https://x.com/a" }, { title: "重复", url: "https://x.com/a" }]
    }, { fileWrite: true });

    expect(r.ok).toBe(true);
    expect(r.path).toMatch(/^Research\//);
    expect(r.sourceCount).toBe(1);
    const md = await readFile(path.join(workspace, r.path), "utf8");
    expect(md).toContain("周度 AI 动态");
    expect(md).toContain("## 来源");
  });

  it("未授权写入时被权限闸门拒绝", async () => {
    const r = await handleToolCall("save_research_report", { title: "x" }, { fileWrite: false });
    expect(r.ok).toBe(false);
  });

  it("research 技能暴露 save_research_report", () => {
    const names = toolsForSkillIds(["research"], { web: true, fileWrite: true }).map((t) => t.function.name);
    expect(names).toContain("save_research_report");
  });
});
