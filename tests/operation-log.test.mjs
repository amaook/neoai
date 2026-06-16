// tests/operation-log.test.mjs — 工具操作审计日志（1.8 护栏）

import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { handleToolCall } from "../server/tools.mjs";
import { runToolWithReceipt } from "../server/tool-integrity.mjs";
import { readOperationLog, clearOperationLog, operationLogPath } from "../server/operation-log.mjs";

let originalCtx;
let workspaceRoot;

beforeEach(async () => {
  originalCtx = { ...ctx };
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-oplog-"));
  Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false });
});
afterEach(async () => {
  Object.assign(ctx, originalCtx);
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

const run = (name, args, consent) => runToolWithReceipt({ name, args, toolConsent: consent, runner: handleToolCall });

describe("operation-log 操作审计日志", () => {
  it("日志写到工作区 .neo 隐藏目录（无 appStatePath 时）", () => {
    expect(operationLogPath()).toBe(path.join(workspaceRoot, ".neo", "operation-log.jsonl"));
  });

  it("每次工具调用都被记录（含工具名/状态/耗时）", async () => {
    await run("list_files", { path: "." }, { fileRead: true });
    const entries = await readOperationLog();
    expect(entries.length).toBe(1);
    expect(entries[0].tool).toBe("list_files");
    expect(entries[0].ok).toBe(true);
    expect(entries[0].status).toBe("succeeded");
    expect(typeof entries[0].durationMs).toBe("number");
  });

  it("失败/被拒绝的尝试也记录", async () => {
    await run("read_file", { path: "不存在的文件.txt" }, { fileRead: true });
    const entries = await readOperationLog();
    expect(entries[0].tool).toBe("read_file");
    expect(entries[0].ok).toBe(false);
    expect(entries[0].error).toBeTruthy();
  });

  it("只记元数据，绝不记录正文内容", async () => {
    await run("write_file", { path: "secret.txt", content: "TOP-SECRET-XYZ" }, { fileWrite: true });
    const entries = await readOperationLog();
    const entry = entries.find((x) => x.tool === "write_file");
    expect(entry.args.path).toBe("secret.txt");
    expect(entry.args.content).toBeUndefined();
    const raw = await readFile(operationLogPath(), "utf8");
    expect(raw).not.toContain("TOP-SECRET-XYZ");
  });

  it("最新在前，clear 后清空", async () => {
    await run("list_files", { path: "." }, { fileRead: true });
    await run("read_file", { path: "x.txt" }, { fileRead: true });
    const entries = await readOperationLog();
    expect(entries[0].tool).toBe("read_file");
    expect(await clearOperationLog()).toBe(true);
    expect((await readOperationLog()).length).toBe(0);
  });

  it("记录工具产出的文件路径", async () => {
    await run("write_file", { path: "out.txt", content: "hi" }, { fileWrite: true });
    const entry = (await readOperationLog()).find((x) => x.tool === "write_file");
    expect(entry.paths).toContain("out.txt");
  });
});
