// tests/screen-capture.test.mjs — 看屏幕 screen_capture + 视觉注入（1.4 第一批）

import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { normalizeToolConsent, isToolAllowedByConsent, handleToolCall, toolsForSkillIds, serverSkillDefs } from "../server/tools.mjs";
import {
  extractScreenshotFromResult,
  dropInjectedScreenshots,
  screenshotUserMessage,
  anthropicScreenshotBlocks
} from "../server/api.mjs";

const visionProvider = { protocol: "anthropic" };
const textProvider = { protocol: "openai", baseUrl: "https://api.deepseek.com" };
const fakeShot = { ok: true, dataUrl: "data:image/png;base64,QUJD", width: 120, height: 80 }; // QUJD = "ABC"

describe("screenView 权限门控", () => {
  it("normalizeToolConsent 含 screenView，默认 false", () => {
    expect(normalizeToolConsent({}).screenView).toBe(false);
    expect(normalizeToolConsent({ screenView: true }).screenView).toBe(true);
  });
  it("screen_capture 需要 screenView", () => {
    expect(isToolAllowedByConsent("screen_capture", { screenView: true })).toBe(true);
    expect(isToolAllowedByConsent("screen_capture", { screenView: false })).toBe(false);
  });

  it("screen-view 技能注册并按权限暴露工具", () => {
    expect(serverSkillDefs["screen-view"]).toBeTruthy();
    const granted = toolsForSkillIds(["screen-view"], { screenView: true }).map((t) => t.function.name);
    expect(granted).toContain("screen_capture");
    const denied = toolsForSkillIds(["screen-view"], { screenView: false }).map((t) => t.function.name);
    expect(denied).not.toContain("screen_capture");
  });
});

describe("screen_capture 工具", () => {
  let originalCtx;
  let workspaceRoot;
  beforeEach(async () => {
    originalCtx = { ...ctx };
    workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-screen-"));
    Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false, captureScreen: null });
  });
  afterEach(async () => {
    Object.assign(ctx, originalCtx);
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("无 Electron 截屏能力时返回桌面端提示", async () => {
    const r = await handleToolCall("screen_capture", {}, { screenView: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("桌面端");
  });

  it("有截屏能力时落盘并返回 dataUrl", async () => {
    ctx.captureScreen = async () => fakeShot;
    const r = await handleToolCall("screen_capture", {}, { screenView: true });
    expect(r.ok).toBe(true);
    expect(r.path).toMatch(/^Screenshots\//);
    expect(r.dataUrl).toBe(fakeShot.dataUrl);
    expect((await stat(path.join(workspaceRoot, r.path))).size).toBeGreaterThan(0);
  });

  it("未授权 screenView 时被拒", async () => {
    const r = await handleToolCall("screen_capture", {}, {});
    expect(r.ok).toBe(false);
    expect(r.error).toContain("需要先授权");
  });
});

describe("视觉注入助手", () => {
  it("extractScreenshotFromResult 从结果剥离 dataUrl", () => {
    const out = extractScreenshotFromResult("screen_capture", { ok: true, path: "Screenshots/a.png", dataUrl: "data:image/png;base64,QUJD" });
    expect(out.screenshotDataUrl).toBe("data:image/png;base64,QUJD");
    expect(out.resultForModel.dataUrl).toBeUndefined();
    expect(out.resultForModel.imageInjected).toBe(true);
  });

  it("非 screen_capture 结果原样返回", () => {
    const out = extractScreenshotFromResult("read_file", { ok: true, content: "x" });
    expect(out.screenshotDataUrl).toBeNull();
    expect(out.resultForModel).toEqual({ ok: true, content: "x" });
  });

  it("视觉模型注入 image_url，文本模型退回文字说明", () => {
    const vis = screenshotUserMessage("data:image/png;base64,QUJD", "Screenshots/a.png", visionProvider, "claude");
    expect(Array.isArray(vis.content)).toBe(true);
    expect(vis.content.some((p) => p.type === "image_url")).toBe(true);
    expect(vis._screenshot).toBe(true);

    const txt = screenshotUserMessage("data:image/png;base64,QUJD", "Screenshots/a.png", textProvider, "deepseek-chat");
    expect(typeof txt.content).toBe("string");
    expect(txt.content).toContain("不支持识别图片");
  });

  it("dropInjectedScreenshots 移除旧截图消息", () => {
    const msgs = [{ role: "user", content: "hi" }, { role: "user", _screenshot: true, content: [] }, { role: "assistant", content: "ok" }];
    dropInjectedScreenshots(msgs);
    expect(msgs.some((m) => m._screenshot)).toBe(false);
    expect(msgs).toHaveLength(2);
  });

  it("anthropicScreenshotBlocks 视觉模型给 image 块", () => {
    const blocks = anthropicScreenshotBlocks("data:image/png;base64,QUJD", "Screenshots/a.png", visionProvider, "claude");
    expect(blocks.some((b) => b.type === "image" && b.source?.type === "base64")).toBe(true);
  });
});
