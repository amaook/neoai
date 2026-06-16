// tests/read-image.test.mjs — OCR / 看图 read_image_file（1.5 办公补缺）

import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { handleToolCall, isToolAllowedByConsent } from "../server/tools.mjs";
import { extractScreenshotFromResult } from "../server/api.mjs";

// 1x1 PNG
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/1eTAAAAAElFTkSuQmCC", "base64");

describe("read_image_file 权限与守卫", () => {
  let originalCtx;
  let workspaceRoot;
  beforeEach(async () => {
    originalCtx = { ...ctx };
    workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-img-"));
    Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false });
  });
  afterEach(async () => {
    Object.assign(ctx, originalCtx);
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("需要 fileRead 权限", () => {
    expect(isToolAllowedByConsent("read_image_file", { fileRead: true })).toBe(true);
    expect(isToolAllowedByConsent("read_image_file", { fileRead: false })).toBe(false);
  });

  it("读取工作区图片并返回 dataUrl 与 mime", async () => {
    await mkdir(path.join(workspaceRoot, "img"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "img/a.png"), PNG_1PX);
    const r = await handleToolCall("read_image_file", { path: "img/a.png" }, { fileRead: true });
    expect(r.ok).toBe(true);
    expect(r.mime).toBe("image/png");
    expect(r.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("非图片类型被拒", async () => {
    await writeFile(path.join(workspaceRoot, "note.txt"), "hi");
    const r = await handleToolCall("read_image_file", { path: "note.txt" }, { fileRead: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("不支持的图片类型");
  });

  it("文件不存在被拒", async () => {
    const r = await handleToolCall("read_image_file", { path: "img/missing.png" }, { fileRead: true });
    expect(r.ok).toBe(false);
  });
});

describe("视觉注入对 read_image_file 生效", () => {
  it("read_image_file 结果会被识别为可注入图片并剥离 dataUrl", () => {
    const out = extractScreenshotFromResult("read_image_file", { ok: true, path: "img/a.png", dataUrl: "data:image/png;base64,QUJD" });
    expect(out.screenshotDataUrl).toBe("data:image/png;base64,QUJD");
    expect(out.resultForModel.dataUrl).toBeUndefined();
    expect(out.resultForModel.imageInjected).toBe(true);
  });
});
