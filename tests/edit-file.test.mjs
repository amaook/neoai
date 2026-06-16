import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { handleToolCall } from "../server/tools.mjs";

let originalCtx;
let workspaceRoot;

const writeConsent = { fileRead: true, fileWrite: true };

beforeEach(async () => {
  originalCtx = { ...ctx };
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-edit-file-"));
  Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false });
});

afterEach(async () => {
  Object.assign(ctx, originalCtx);
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

async function writeText(relPath, content) {
  const target = path.join(workspaceRoot, relPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return target;
}

describe("edit_file", () => {
  it("applies a unique single replacement", async () => {
    await writeText("notes/config.txt", "host=localhost\nport=4321\nmode=dev\n");
    const result = await handleToolCall("edit_file", {
      path: "notes/config.txt",
      edits: [{ old_text: "port=4321", new_text: "port=8080" }]
    }, writeConsent);
    expect(result).toMatchObject({ ok: true, edits: 1 });
    const content = await readFile(path.join(workspaceRoot, "notes/config.txt"), "utf8");
    expect(content).toBe("host=localhost\nport=8080\nmode=dev\n");
  });

  it("applies multiple sequential edits", async () => {
    await writeText("a.txt", "one two three");
    const result = await handleToolCall("edit_file", {
      path: "a.txt",
      edits: [
        { old_text: "one", new_text: "1" },
        { old_text: "three", new_text: "3" }
      ]
    }, writeConsent);
    expect(result.ok).toBe(true);
    expect(await readFile(path.join(workspaceRoot, "a.txt"), "utf8")).toBe("1 two 3");
  });

  it("rejects when old_text is not found and leaves the file unchanged", async () => {
    await writeText("a.txt", "hello world");
    const result = await handleToolCall("edit_file", {
      path: "a.txt",
      edits: [{ old_text: "missing", new_text: "x" }]
    }, writeConsent);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("未找到");
    expect(await readFile(path.join(workspaceRoot, "a.txt"), "utf8")).toBe("hello world");
  });

  it("rejects ambiguous old_text that appears more than once", async () => {
    await writeText("a.txt", "dup\ndup\n");
    const result = await handleToolCall("edit_file", {
      path: "a.txt",
      edits: [{ old_text: "dup", new_text: "x" }]
    }, writeConsent);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("出现多次");
    expect(await readFile(path.join(workspaceRoot, "a.txt"), "utf8")).toBe("dup\ndup\n");
  });

  it("does not write anything when a later edit fails", async () => {
    await writeText("a.txt", "alpha beta");
    const result = await handleToolCall("edit_file", {
      path: "a.txt",
      edits: [
        { old_text: "alpha", new_text: "A" },
        { old_text: "missing", new_text: "x" }
      ]
    }, writeConsent);
    expect(result.ok).toBe(false);
    expect(await readFile(path.join(workspaceRoot, "a.txt"), "utf8")).toBe("alpha beta");
  });

  it("rejects paths outside the workspace", async () => {
    await expect(handleToolCall("edit_file", {
      path: "../outside.txt",
      edits: [{ old_text: "a", new_text: "b" }]
    }, writeConsent)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects missing files with a recovery hint", async () => {
    const result = await handleToolCall("edit_file", {
      path: "nope.txt",
      edits: [{ old_text: "a", new_text: "b" }]
    }, writeConsent);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("不存在");
  });

  it("is denied without fileWrite consent", async () => {
    await writeText("a.txt", "hello");
    const result = await handleToolCall("edit_file", {
      path: "a.txt",
      edits: [{ old_text: "hello", new_text: "hi" }]
    }, { fileRead: true, fileWrite: false });
    expect(result.ok).toBe(false);
  });

  it("rejects binary office files", async () => {
    await writeText("a.xlsx", "fake");
    const result = await handleToolCall("edit_file", {
      path: "a.xlsx",
      edits: [{ old_text: "fake", new_text: "x" }]
    }, writeConsent);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("文本文件");
  });
});
