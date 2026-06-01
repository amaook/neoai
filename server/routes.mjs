// server/routes.mjs — HTTP 路由处理函数
import { createServer } from "node:http";
import { readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { ctx, rootDir } from "./context.mjs";
import {
  resolveWorkspacePath, isExcelPath, attachmentRelativePath, parseDataUrl,
  attachmentSummary, attachmentContentForPath, createExcelWorkbook, exportImage, safeJson
} from "./tools.mjs";
import {
  normalizeMessages, providerSupportsImageInput, stripImagePartsForTextOnly,
  providerRequestInfo, callOpenAICompatible, callAnthropic, callGemini, callMock
} from "./api.mjs";
import {
  streamOpenAICompatible, streamAnthropic, streamGemini, streamMock, sseWrite, sseError
} from "./sse.mjs";
import {
  detectEnvironment, invalidateEnvCache, buildInstallMissingScript, buildSingleInstallScript, openTerminalCommand
} from "./environment.mjs";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const { version: appVersion = "0.0.0" } = require("../package.json");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
]);

// ── 通用响应 ─────────────────────────────────────────────────────────────────

export function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(text);
}

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { const e = new Error("请求体不是合法 JSON"); e.status = 400; throw e; }
}

// ── 应用状态持久化 ────────────────────────────────────────────────────────────

async function readPersistedAppState() {
  if (!ctx.appStatePath) return {};
  try { return JSON.parse(await readFile(ctx.appStatePath, "utf8")); } catch { return {}; }
}

async function writePersistedAppState(state) {
  if (!ctx.appStatePath) return false;
  await mkdir(path.dirname(ctx.appStatePath), { recursive: true });
  await writeFile(ctx.appStatePath, JSON.stringify(state || {}, null, 2), "utf8");
  return true;
}

// ── 路由处理函数 ─────────────────────────────────────────────────────────────

export async function handleChat(req, res) {
  const body = await readBody(req);
  const provider = body.provider || {};
  const model = String(body.model || provider.model || "").trim();
  const messages = normalizeMessages(body.messages);
  const temperature = Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.7;
  const maxTokens = Number.isFinite(Number(body.maxTokens)) ? Number(body.maxTokens) : undefined;
  const enableTools = Boolean(body.enableTools);
  const enabledSkills = Array.isArray(body.enabledSkills) ? body.enabledSkills : undefined;
  const thinking = String(body.thinking || "");
  const stream = body.stream !== false;

  const clientAbort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) clientAbort.abort(); });

  if (!model) throw Object.assign(new Error("请选择或填写模型名"), { status: 400 });
  if (!messages.length) throw Object.assign(new Error("缺少消息内容"), { status: 400 });

  const protocol = provider.protocol || "openai";
  const requestMessages = providerSupportsImageInput(provider, model) ? messages : stripImagePartsForTextOnly(messages);
  const requestInfo = providerRequestInfo(provider, protocol, model, thinking);

  if (protocol === "mock") {
    if (stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
      await streamMock({ model, messages: requestMessages, signal: clientAbort.signal, res, requestInfo });
      return;
    }
    const result = await callMock({ model, messages: requestMessages });
    sendJson(res, 200, { ok: true, request: requestInfo, ...result });
    return;
  }

  if (stream) {
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
    try {
      if (protocol === "anthropic") {
        await streamAnthropic({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, signal: clientAbort.signal, res, requestInfo });
      } else if (protocol === "gemini") {
        await streamGemini({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, signal: clientAbort.signal, res, requestInfo });
      } else {
        await streamOpenAICompatible({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, signal: clientAbort.signal, res, requestInfo });
      }
    } catch (err) {
      sseError(res, err.message || "流式请求失败");
    }
    return;
  }

  let result;
  if (protocol === "anthropic") result = await callAnthropic({ provider, model, messages: requestMessages, temperature, maxTokens, signal: clientAbort.signal });
  else if (protocol === "gemini") result = await callGemini({ provider, model, messages: requestMessages, temperature, maxTokens, signal: clientAbort.signal });
  else result = await callOpenAICompatible({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, signal: clientAbort.signal });
  sendJson(res, 200, { ok: true, request: requestInfo, ...result });
}

export async function handleTree(req, res, url) {
  const relPath = url.searchParams.get("path") || ".";
  const target = resolveWorkspacePath(relPath);
  const entries = await readdir(target, { withFileTypes: true });
  const data = entries.filter((e) => e.name !== "node_modules" && e.name !== ".git").map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file", path: path.relative(ctx.workspaceRoot, path.join(target, e.name)) || "." })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
  sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target) || ".", entries: data });
}

export async function handleSelectWorkspace(req, res) {
  if (!ctx.desktopMode || typeof ctx.selectWorkspaceRoot !== "function") {
    throw Object.assign(new Error("当前运行方式不支持选择本地文件夹，请使用桌面端启动"), { status: 400 });
  }
  const selected = await ctx.selectWorkspaceRoot(ctx.workspaceRoot);
  if (!selected) { sendJson(res, 200, { ok: true, canceled: true, workspace: ctx.workspaceRoot }); return; }
  ctx.workspaceRoot = path.resolve(selected);
  await mkdir(ctx.workspaceRoot, { recursive: true });
  sendJson(res, 200, { ok: true, workspace: ctx.workspaceRoot, workspaceName: path.basename(ctx.workspaceRoot) || ctx.workspaceRoot });
}

export async function handleReadFile(req, res, url) {
  const relPath = url.searchParams.get("path") || "";
  const target = resolveWorkspacePath(relPath);
  const stats = await stat(target);
  if (isExcelPath(target) || path.extname(target).toLowerCase() === ".xls") {
    const { readExcelWorkbook } = await import("./tools.mjs");
    const workbook = await readExcelWorkbook({ path: relPath, row_limit: 80 });
    sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target), readonly: true, content: JSON.stringify(workbook, null, 2) });
    return;
  }
  if (stats.size > 500_000) throw Object.assign(new Error("文件过大，无法在界面打开"), { status: 413 });
  sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target), content: await readFile(target, "utf8") });
}

export async function handleImportAttachment(req, res) {
  const body = await readBody(req);
  const name = path.basename(String(body.name || "attachment")).replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "attachment";
  const kind = String(body.kind || "file");
  const data = parseDataUrl(body.dataUrl);
  const relPath = attachmentRelativePath(name);
  const target = resolveWorkspacePath(relPath);
  await mkdir(path.dirname(target), { recursive: true });

  let size = Number(body.size || 0);
  let mediaType = String(body.mediaType || data?.mediaType || "");

  if (data) {
    if (data.buffer.length > 10 * 1024 * 1024) throw Object.assign(new Error("附件超过 10MB，已拒绝保存"), { status: 413 });
    await writeFile(target, data.buffer);
    size = data.buffer.length;
    mediaType = mediaType || data.mediaType;
  } else {
    const content = String(body.content ?? "");
    await writeFile(target, content, "utf8");
    size = Buffer.byteLength(content);
    mediaType = mediaType || "text/plain";
  }

  const parsed = await attachmentContentForPath(relPath, body.content);
  const summary = attachmentSummary({ kind, relPath, size, content: parsed.content, workbook: parsed.workbook });
  sendJson(res, 200, { ok: true, attachment: { id: randomUUID(), name, kind, path: path.relative(ctx.workspaceRoot, target), size, mediaType, summary, content: kind === "image" ? "" : parsed.content, contentChars: parsed.contentChars, truncated: parsed.truncated, savedAt: new Date().toISOString() } });
}

export async function handleWriteFile(req, res) {
  const body = await readBody(req);
  const target = resolveWorkspacePath(body.path);
  if (isExcelPath(target)) throw Object.assign(new Error("请使用 Excel 生成工具创建 .xlsx 文件，不能按文本保存"), { status: 400 });
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, String(body.content ?? ""), "utf8");
  sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target) });
}

export async function handleGenerateFile(req, res) {
  const body = await readBody(req);
  const filePath = String(body.path || "").trim();
  if (!filePath) throw Object.assign(new Error("请提供文件路径"), { status: 400 });
  const target = resolveWorkspacePath(filePath);
  if (isExcelPath(target)) throw Object.assign(new Error("请使用 create_excel_file 工具生成真实 .xlsx 文件"), { status: 400 });
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, String(body.content ?? ""), "utf8");
  sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target) });
}

async function openPathFallback(target, reveal = false) {
  const { runCommand } = await import("./tools.mjs");
  if (process.platform === "darwin") return runCommand(`${reveal ? "open -R" : "open"} '${target}'`, 8000);
  if (process.platform === "win32") return runCommand(reveal ? `explorer.exe /select,"${target}"` : `start "" "${target}"`, 8000);
  return runCommand(`xdg-open '${reveal ? path.dirname(target) : target}'`, 8000);
}

export async function handleOpenWorkspacePath(req, res, reveal = false) {
  const body = await readBody(req);
  const filePath = String(body.path || "").trim();
  if (!filePath) throw Object.assign(new Error("请提供文件路径"), { status: 400 });
  const target = resolveWorkspacePath(filePath);
  if (!existsSync(target)) throw Object.assign(new Error("文件不存在"), { status: 404 });

  if (reveal && typeof ctx.showWorkspacePath === "function") { await ctx.showWorkspacePath(target); sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target) }); return; }
  if (!reveal && typeof ctx.openWorkspacePath === "function") { const r = await ctx.openWorkspacePath(target); if (r) throw Object.assign(new Error(String(r)), { status: 500 }); sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target) }); return; }

  const result = await openPathFallback(target, reveal);
  if (!result.ok) throw Object.assign(new Error(result.stderr || result.error || "无法打开文件"), { status: 500 });
  sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target) });
}

export async function handleCreateExcel(req, res) {
  sendJson(res, 200, await createExcelWorkbook(await readBody(req)));
}

export async function handleExportImage(req, res) {
  sendJson(res, 200, await exportImage(await readBody(req)));
}

export async function handleShell(req, res) {
  const body = await readBody(req);
  const command = String(body.command || "").trim();
  if (!command) throw Object.assign(new Error("请输入命令"), { status: 400 });
  const { runCommand } = await import("./tools.mjs");
  sendJson(res, 200, { ok: true, result: await runCommand(command) });
}

export async function handleReadAppState(req, res) {
  sendJson(res, 200, { ok: true, persisted: Boolean(ctx.appStatePath), state: await readPersistedAppState() });
}

export async function handleWriteAppState(req, res) {
  const body = await readBody(req);
  const state = body.state && typeof body.state === "object" ? body.state : body;
  sendJson(res, 200, { ok: true, persisted: await writePersistedAppState(state) });
}

export async function handleEnvironmentCheck(req, res) {
  sendJson(res, 200, await detectEnvironment());
}

export async function handleEnvironmentInstall(req, res) {
  const body = await readBody(req);
  const id = String(body.id || "");
  const env = await detectEnvironment();
  const item = env.items.find((i) => i.id === id);
  if (!item) throw Object.assign(new Error("未知环境项"), { status: 404 });
  if (!item.installable || !item.installCommand) throw Object.assign(new Error("这个环境项不支持自动安装，或已经安装完成"), { status: 400 });
  if (process.platform === "darwin" && id !== "homebrew" && id !== "desktop-deps" && !env.items.find((i) => i.id === "homebrew")?.path) throw Object.assign(new Error("请先安装 Homebrew，再补充这个环境"), { status: 400 });
  const command = buildSingleInstallScript(env, item);
  const result = await openTerminalCommand(command);
  if (result.ok) invalidateEnvCache();
  sendJson(res, result.ok ? 200 : 500, { ok: result.ok, message: result.message, command: result.command, stdout: result.stdout || "", stderr: result.stderr || "" });
}

export async function handleEnvironmentInstallMissing(req, res) {
  const body = await readBody(req);
  const includeRecommended = body.includeRecommended !== false;
  const env = await detectEnvironment();
  const script = buildInstallMissingScript(env, includeRecommended);
  if (!script) { sendJson(res, 200, { ok: true, message: "当前没有需要自动补齐的环境项", command: "" }); return; }
  const result = await openTerminalCommand(script);
  if (result.ok) invalidateEnvCache();
  sendJson(res, result.ok ? 200 : 500, { ok: result.ok, message: result.message, command: script, stdout: result.stdout || "", stderr: result.stderr || "" });
}

export async function handleDesktopCheckUpdate(req, res) {
  if (!ctx.desktopMode || typeof ctx.checkDesktopUpdates !== "function") { sendJson(res, 200, { ok: false, supported: false, message: "检查更新只在安装后的桌面版生效" }); return; }
  const result = await ctx.checkDesktopUpdates(true);
  sendJson(res, 200, { ok: true, supported: true, ...(result || {}) });
}

export async function handleDesktopUpdateStatus(req, res) {
  if (!ctx.desktopMode || typeof ctx.getDesktopUpdateStatus !== "function") { sendJson(res, 200, { ok: false, supported: false, status: "unsupported", message: "检查更新只在安装后的桌面版生效" }); return; }
  const result = await ctx.getDesktopUpdateStatus();
  sendJson(res, 200, { ok: true, supported: true, ...(result || {}) });
}

export async function handleDesktopInstallUpdate(req, res) {
  if (!ctx.desktopMode || typeof ctx.installDesktopUpdate !== "function") { sendJson(res, 200, { ok: false, supported: false, status: "unsupported", message: "重启安装只在安装后的桌面版生效" }); return; }
  const result = await ctx.installDesktopUpdate();
  sendJson(res, 200, { ok: true, supported: true, ...(result || {}) });
}

async function serveStatic(req, res, url) {
  const requestPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const target = path.resolve(ctx.publicDir, requestPath.replace(/^\/+/, ""));
  if (target !== ctx.publicDir && !target.startsWith(`${ctx.publicDir}${path.sep}`)) { sendText(res, 403, "Forbidden"); return; }
  if (!existsSync(target)) { sendText(res, 404, "Not found"); return; }
  const ext = path.extname(target).toLowerCase();
  const content = await readFile(target);
  res.writeHead(200, { "Content-Type": mimeTypes.get(ext) || "application/octet-stream" });
  res.end(content);
}

// ── HTTP 服务器 ───────────────────────────────────────────────────────────────

export function createNeoServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    try {
      if (req.method === "GET" && url.pathname === "/api/health") { sendJson(res, 200, { ok: true, name: "neo", version: appVersion, workspace: ctx.workspaceRoot, workspaceName: path.basename(ctx.workspaceRoot) || ctx.workspaceRoot, desktopMode: ctx.desktopMode, statePersistence: Boolean(ctx.appStatePath) }); return; }
      if (req.method === "GET" && url.pathname === "/api/app-state") { await handleReadAppState(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/app-state") { await handleWriteAppState(req, res); return; }
      if (req.method === "GET" && url.pathname === "/api/environment/check") { await handleEnvironmentCheck(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/environment/install") { await handleEnvironmentInstall(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/environment/install-missing") { await handleEnvironmentInstallMissing(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/desktop/check-update") { await handleDesktopCheckUpdate(req, res); return; }
      if (req.method === "GET" && url.pathname === "/api/desktop/update-status") { await handleDesktopUpdateStatus(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/desktop/install-update") { await handleDesktopInstallUpdate(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/chat") { await handleChat(req, res); return; }
      if (req.method === "GET" && url.pathname === "/api/workspace/tree") { await handleTree(req, res, url); return; }
      if (req.method === "POST" && url.pathname === "/api/workspace/select-folder") { await handleSelectWorkspace(req, res); return; }
      if (req.method === "GET" && url.pathname === "/api/workspace/file") { await handleReadFile(req, res, url); return; }
      if (req.method === "POST" && url.pathname === "/api/attachments/import") { await handleImportAttachment(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/workspace/file") { await handleWriteFile(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/workspace/excel") { await handleCreateExcel(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/workspace/export-image") { await handleExportImage(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/shell") { await handleShell(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/workspace/generate-file") { await handleGenerateFile(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/workspace/open") { await handleOpenWorkspacePath(req, res, false); return; }
      if (req.method === "POST" && url.pathname === "/api/workspace/reveal") { await handleOpenWorkspacePath(req, res, true); return; }
      if (req.method === "GET") { await serveStatic(req, res, url); return; }
      sendText(res, 405, "Method not allowed");
    } catch (error) {
      if (res.writableEnded || res.destroyed) return;
      sendJson(res, error.status || 500, { ok: false, error: error.message, details: error.data || null });
    }
  });
}

