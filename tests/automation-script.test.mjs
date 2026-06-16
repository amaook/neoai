// tests/automation-script.test.mjs — 脚本操控 run_automation_script（1.3 第一批）

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { runToolWithReceipt } from "../server/tool-integrity.mjs";
import {
  validateAutomationArgs,
  isDangerousScript,
  normalizeToolConsent,
  isToolAllowedByConsent,
  toolsForSkillIds,
  serverSkillDefs,
  handleToolCall
} from "../server/tools.mjs";

describe("validateAutomationArgs 参数与平台校验", () => {
  it("缺少必填项报缺参", () => {
    expect(validateAutomationArgs({ language: "shell", script: "echo x" }).ok).toBe(false); // 缺 purpose
    expect(validateAutomationArgs({ language: "shell", purpose: "p" }).ok).toBe(false); // 缺 script
  });

  it("非法 language 被拒", () => {
    const r = validateAutomationArgs({ language: "python", script: "print(1)", purpose: "p" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("applescript");
  });

  it("shell 始终可用", () => {
    expect(validateAutomationArgs({ language: "shell", script: "echo x", purpose: "p" }).ok).toBe(true);
  });

  it("平台不匹配的脚本语言被拒", () => {
    const wrong = process.platform === "win32" ? "applescript" : "powershell";
    expect(validateAutomationArgs({ language: wrong, script: "x", purpose: "p" }).ok).toBe(false);
  });
});

describe("isDangerousScript 高危脚本兜底拦截", () => {
  it("拦截不可逆/破坏性脚本", () => {
    for (const s of ["rm -rf /", "rm -rf ~", "diskutil eraseDisk JHFS+ X disk2", "shutdown -h now", "Remove-Item C:\\ -Recurse -Force"]) {
      expect(isDangerousScript("shell", s).blocked).toBe(true);
    }
  });

  it("放行正常设置脚本", () => {
    for (const s of ["defaults write -g AppleInterfaceStyle Dark", "osascript -e 'tell app \"Finder\" to quit'", "Set-ItemProperty -Path HKCU:\\Foo -Name Bar -Value 1"]) {
      expect(isDangerousScript("shell", s).blocked).toBe(false);
    }
  });
});

describe("systemControl 权限门控", () => {
  it("normalizeToolConsent 含 systemControl，默认 false", () => {
    expect(normalizeToolConsent({}).systemControl).toBe(false);
    expect(normalizeToolConsent({ systemControl: true }).systemControl).toBe(true);
  });

  it("run_automation_script 需要 systemControl", () => {
    expect(isToolAllowedByConsent("run_automation_script", { systemControl: true })).toBe(true);
    expect(isToolAllowedByConsent("run_automation_script", { systemControl: false })).toBe(false);
    expect(isToolAllowedByConsent("run_automation_script", { command: true })).toBe(false);
  });

  it("未授权时 handleToolCall 直接拒绝", async () => {
    const r = await handleToolCall("run_automation_script", { language: "shell", script: "echo x", purpose: "p" }, {});
    expect(r.ok).toBe(false);
    expect(r.error).toContain("需要先授权");
  });

  it("system-control 技能注册并按权限暴露工具", () => {
    expect(serverSkillDefs["system-control"]).toBeTruthy();
    const granted = toolsForSkillIds(["system-control"], { systemControl: true }).map((t) => t.function.name);
    expect(granted).toContain("run_automation_script");
    const denied = toolsForSkillIds(["system-control"], { systemControl: false }).map((t) => t.function.name);
    expect(denied).not.toContain("run_automation_script");
  });
});

describe("run_automation_script 单次审批接入", () => {
  let originalCtx;
  let workspaceRoot;
  beforeEach(async () => {
    originalCtx = { ...ctx };
    workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-automation-"));
    Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false });
  });
  afterEach(async () => {
    Object.assign(ctx, originalCtx);
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("无确认通道时拒绝执行", async () => {
    const step = await runToolWithReceipt({
      name: "run_automation_script",
      args: { language: "shell", script: "echo hi", purpose: "测试" },
      toolConsent: { systemControl: true },
      runner: handleToolCall
    });
    expect(step.result.ok).toBe(false);
    expect(step.result.error).toContain("确认");
  });

  it("确认器收到 automation 元信息，批准后执行", async () => {
    let seenMeta = null;
    const step = await runToolWithReceipt({
      name: "run_automation_script",
      args: { language: "shell", script: "echo automation-ok", purpose: "测试目的" },
      toolConsent: { systemControl: true },
      runner: handleToolCall,
      confirmCommand: async (command, meta) => { seenMeta = { command, meta }; return { approved: true }; }
    });
    expect(seenMeta.meta).toMatchObject({ kind: "automation", language: "shell", purpose: "测试目的" });
    expect(seenMeta.command).toBe("echo automation-ok");
    expect(step.result.ok).toBe(true);
    expect(String(step.result.stdout || "")).toContain("automation-ok");
  });

  it("用户拒绝时不执行", async () => {
    const step = await runToolWithReceipt({
      name: "run_automation_script",
      args: { language: "shell", script: "echo nope", purpose: "测试" },
      toolConsent: { systemControl: true },
      runner: handleToolCall,
      confirmCommand: async () => ({ approved: false, reason: "denied" })
    });
    expect(step.result.ok).toBe(false);
    expect(step.result.error).toContain("拒绝");
  });
});
