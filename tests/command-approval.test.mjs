import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { requestCommandApproval, resolveCommandApproval } from "../server/command-approval.mjs";
import { runToolWithReceipt } from "../server/tool-integrity.mjs";
import { handleToolCall } from "../server/tools.mjs";

let originalCtx;
let workspaceRoot;

const commandConsent = { fileRead: true, fileWrite: true, command: true };

beforeEach(async () => {
  originalCtx = { ...ctx };
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-cmd-approval-"));
  Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false });
});

afterEach(async () => {
  Object.assign(ctx, originalCtx);
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

describe("command approval broker", () => {
  it("resolves approved decisions", async () => {
    const { id, decision } = requestCommandApproval("echo hi");
    expect(resolveCommandApproval(id, true)).toBe(true);
    await expect(decision).resolves.toMatchObject({ approved: true });
  });

  it("resolves denied decisions", async () => {
    const { id, decision } = requestCommandApproval("echo hi");
    expect(resolveCommandApproval(id, false)).toBe(true);
    await expect(decision).resolves.toMatchObject({ approved: false });
  });

  it("auto-denies on timeout", async () => {
    const { decision } = requestCommandApproval("echo hi", { timeoutMs: 30 });
    await expect(decision).resolves.toMatchObject({ approved: false, reason: "timeout" });
  });

  it("ignores unknown ids", () => {
    expect(resolveCommandApproval("missing-id", true)).toBe(false);
  });
});

describe("run_command approval gate", () => {
  it("denies run_command when no confirm channel exists", async () => {
    const step = await runToolWithReceipt({
      name: "run_command",
      args: { command: "echo hi" },
      toolConsent: commandConsent,
      runner: handleToolCall
    });
    expect(step.result.ok).toBe(false);
    expect(step.result.error).toContain("确认");
  });

  it("denies run_command when the user rejects", async () => {
    const step = await runToolWithReceipt({
      name: "run_command",
      args: { command: "echo hi" },
      toolConsent: commandConsent,
      runner: handleToolCall,
      confirmCommand: async () => ({ approved: false, reason: "denied" })
    });
    expect(step.result.ok).toBe(false);
    expect(step.result.error).toContain("拒绝");
  });

  it("runs the command after the user approves", async () => {
    let confirmedCommand = "";
    const step = await runToolWithReceipt({
      name: "run_command",
      args: { command: "echo approved-run" },
      toolConsent: commandConsent,
      runner: handleToolCall,
      confirmCommand: async (command) => {
        confirmedCommand = command;
        return { approved: true };
      }
    });
    expect(confirmedCommand).toBe("echo approved-run");
    expect(step.result.ok).toBe(true);
    expect(String(step.result.stdout || step.result.output || "")).toContain("approved-run");
  });

  it("does not gate other tools", async () => {
    const step = await runToolWithReceipt({
      name: "list_files",
      args: { path: "." },
      toolConsent: commandConsent,
      runner: handleToolCall
    });
    // list_files 返回条目数组；只要不是审批拦截的错误对象即可
    expect(Array.isArray(step.result)).toBe(true);
  });
});
