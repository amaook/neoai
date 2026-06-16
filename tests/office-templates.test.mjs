// tests/office-templates.test.mjs — 办公模板库 get_template（1.5 办公补缺）

import { describe, it, expect } from "vitest";
import { handleToolCall, isToolAllowedByConsent } from "../server/tools.mjs";

describe("get_template 办公模板库", () => {
  it("不传 name 时列出可用模板", async () => {
    const r = await handleToolCall("get_template", {}, { fileRead: true });
    expect(r.ok).toBe(true);
    const ids = r.available.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["weekly-report", "meeting-notes", "resume", "project-plan", "work-summary"]));
  });

  it("按 id 取骨架", async () => {
    const r = await handleToolCall("get_template", { name: "weekly-report" }, { fileRead: true });
    expect(r.ok).toBe(true);
    expect(r.format).toBe("markdown");
    expect(r.skeleton).toContain("# 周报");
    expect(r.skeleton).toContain("## 下周计划");
  });

  it("按中文名取骨架", async () => {
    const r = await handleToolCall("get_template", { name: "会议纪要" }, { fileRead: true });
    expect(r.ok).toBe(true);
    expect(r.id).toBe("meeting-notes");
    expect(r.skeleton).toContain("## 待办");
  });

  it("未知模板返回错误并附可用清单", async () => {
    const r = await handleToolCall("get_template", { name: "不存在的模板" }, { fileRead: true });
    expect(r.ok).toBe(false);
    expect(Array.isArray(r.available)).toBe(true);
  });

  it("需要 fileRead 权限（默认开启）", () => {
    expect(isToolAllowedByConsent("get_template", { fileRead: true })).toBe(true);
    expect(isToolAllowedByConsent("get_template", { fileRead: false })).toBe(false);
  });
});
