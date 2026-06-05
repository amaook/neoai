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
  listSchedules, createSchedule, updateSchedule, deleteSchedule,
  runScheduleNow, scheduleExprLabel, computeNextRun
} from "./scheduler.mjs";
import {
  resolveWorkspacePath, isExcelPath, attachmentRelativePath, parseDataUrl,
  attachmentSummary, attachmentContentForPath, createExcelWorkbook, exportImage, safeJson,
  openPathFallback
} from "./tools.mjs";
import {
  normalizeMessages, providerSupportsImageInput, stripImagePartsForTextOnly,
  providerRequestInfo, callOpenAICompatible, callAnthropic, callGemini, callMock
} from "./api.mjs";
import {
  streamOpenAICompatible, streamAnthropic, streamGemini, streamMock, sseWrite, sseError
} from "./sse.mjs";
import {
  callOpenAIResponses, isOpenAIResponsesMode, openAIResponsesEndpoint
} from "./openai-responses.mjs";
import {
  detectEnvironment, invalidateEnvCache, buildInstallMissingScript, buildSingleInstallScript, openTerminalCommand
} from "./environment.mjs";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const { version: appVersion = "0.0.0" } = require("../package.json");
const defaultAttachmentMaxBytes = 8 * 1024 * 1024;
const officeAttachmentMaxBytes = 25 * 1024 * 1024;
const officeAttachmentExts = new Set([".xlsx", ".xlsm", ".csv", ".tsv", ".docx", ".pdf", ".pptx", ".xls", ".doc", ".ppt"]);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
  [".csv", "text/csv; charset=utf-8"],
  [".tsv", "text/tab-separated-values; charset=utf-8"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".pdf", "application/pdf"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
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

const PETDEX_MANIFEST_URL = "https://petdex.crafter.run/api/manifest";
const PETDEX_CACHE_MS = 10 * 60 * 1000;
let petdexManifestCache = null;

function normalizePetdexPet(item, index) {
  const slug = String(item?.slug || "").trim();
  const spritesheetUrl = String(item?.spritesheetUrl || "").trim();
  if (!slug || !spritesheetUrl) return null;
  return {
    slug,
    displayName: String(item.displayName || slug).trim(),
    kind: String(item.kind || "").trim(),
    submittedBy: String(item.submittedBy || "").trim(),
    spritesheetUrl,
    petJsonUrl: String(item.petJsonUrl || "").trim(),
    zipUrl: item.zipUrl ? String(item.zipUrl).trim() : "",
    sourceIndex: index
  };
}

async function fetchPetdexManifest({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && petdexManifestCache && now - petdexManifestCache.fetchedAt < PETDEX_CACHE_MS) {
    return { ...petdexManifestCache.payload, cached: true, stale: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(PETDEX_MANIFEST_URL, {
      headers: { Accept: "application/json", "User-Agent": `neo/${appVersion}` },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Petdex ${response.status}`);
    const data = await response.json();
    const pets = Array.isArray(data.pets)
      ? data.pets.map(normalizePetdexPet).filter(Boolean)
      : [];
    if (!pets.length) throw new Error("Petdex 源没有返回宠物列表");
    const payload = {
      ok: true,
      source: PETDEX_MANIFEST_URL,
      generatedAt: data.generatedAt || "",
      total: Number(data.total || pets.length),
      fetchedAt: new Date().toISOString(),
      pets
    };
    petdexManifestCache = { fetchedAt: now, payload };
    return { ...payload, cached: false, stale: false };
  } catch (error) {
    if (petdexManifestCache) {
      return { ...petdexManifestCache.payload, cached: true, stale: true, warning: error.message || "Petdex 源暂时不可用" };
    }
    throw Object.assign(new Error(error.message || "Petdex 源暂时不可用"), { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export async function handlePetdexPets(req, res, url) {
  const refresh = url.searchParams.get("refresh") === "1";
  sendJson(res, 200, await fetchPetdexManifest({ refresh }));
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
  const toolConsent = body.toolConsent && typeof body.toolConsent === "object" ? body.toolConsent : {};
  const thinking = String(body.thinking || "");
  const stream = body.stream !== false;

  const clientAbort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) clientAbort.abort(); });

  if (!model) throw Object.assign(new Error("请选择或填写模型名"), { status: 400 });
  if (!messages.length) throw Object.assign(new Error("缺少消息内容"), { status: 400 });

  const responsesMode = isOpenAIResponsesMode(provider);
  const protocol = responsesMode ? "openai-responses" : provider.protocol || "openai";
  const requestMessages = providerSupportsImageInput(provider, model) ? messages : stripImagePartsForTextOnly(messages);
  const requestInfo = responsesMode
    ? { ...providerRequestInfo(provider, protocol, model, thinking), endpoint: openAIResponsesEndpoint(provider) }
    : providerRequestInfo(provider, protocol, model, thinking);

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
      if (responsesMode) {
        const result = await callOpenAIResponses({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, toolConsent, signal: clientAbort.signal });
        sseWrite(res, { type: "done", request: requestInfo, ...result });
        res.end();
      } else if (protocol === "anthropic") {
        await streamAnthropic({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, toolConsent, signal: clientAbort.signal, res, requestInfo });
      } else if (protocol === "gemini") {
        await streamGemini({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, toolConsent, signal: clientAbort.signal, res, requestInfo });
      } else {
        await streamOpenAICompatible({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, toolConsent, signal: clientAbort.signal, res, requestInfo });
      }
    } catch (err) {
      sseError(res, err.message || "流式请求失败");
    }
    return;
  }

  let result;
  if (responsesMode) result = await callOpenAIResponses({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, toolConsent, signal: clientAbort.signal });
  else if (protocol === "anthropic") result = await callAnthropic({ provider, model, messages: requestMessages, temperature, maxTokens, signal: clientAbort.signal });
  else if (protocol === "gemini") result = await callGemini({ provider, model, messages: requestMessages, temperature, maxTokens, signal: clientAbort.signal });
  else result = await callOpenAICompatible({ provider, model, messages: requestMessages, temperature, maxTokens, enableTools, enabledSkills, toolConsent, signal: clientAbort.signal });
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

export async function handleSelectExternalPaths(req, res) {
  if (!ctx.desktopMode || typeof ctx.selectExternalPaths !== "function") {
    throw Object.assign(new Error("当前运行方式不支持申请外部文件权限，请使用桌面端启动"), { status: 400 });
  }
  const selected = await ctx.selectExternalPaths(ctx.workspaceRoot);
  sendJson(res, 200, { ok: true, canceled: !selected?.length, paths: Array.isArray(selected) ? selected.map((item) => path.resolve(item)) : [] });
}

export async function handleReadFile(req, res, url) {
  const relPath = url.searchParams.get("path") || "";
  const target = resolveWorkspacePath(relPath);
  const stats = await stat(target);
  const ext = path.extname(target).toLowerCase();
  if (isExcelPath(target) || [".xls", ".csv", ".tsv"].includes(ext)) {
    const { readExcelWorkbook } = await import("./tools.mjs");
    const workbook = await readExcelWorkbook({ path: relPath, row_limit: 80 });
    sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target), readonly: true, content: JSON.stringify(workbook, null, 2) });
    return;
  }
  if ([".docx", ".pdf", ".pptx", ".doc", ".ppt"].includes(ext)) {
    const { handleToolCall } = await import("./tools.mjs");
    const result = await handleToolCall("inspect_office_file", { path: relPath, row_limit: 80 }, { fileRead: true });
    sendJson(res, 200, { ok: true, path: path.relative(ctx.workspaceRoot, target), readonly: true, content: JSON.stringify(result, null, 2) });
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
  const maxBytes = officeAttachmentExts.has(path.extname(name).toLowerCase()) ? officeAttachmentMaxBytes : defaultAttachmentMaxBytes;
  const relPath = attachmentRelativePath(name);
  const target = resolveWorkspacePath(relPath);
  await mkdir(path.dirname(target), { recursive: true });

  let size = Number(body.size || 0);
  let mediaType = String(body.mediaType || data?.mediaType || "");

  if (data) {
    if (data.buffer.length > maxBytes) throw Object.assign(new Error(`附件超过 ${Math.round(maxBytes / 1024 / 1024)}MB，已拒绝保存`), { status: 413 });
    await writeFile(target, data.buffer);
    size = data.buffer.length;
    mediaType = mediaType || data.mediaType;
  } else {
    const content = String(body.content ?? "");
    if (Buffer.byteLength(content) > maxBytes) throw Object.assign(new Error(`附件超过 ${Math.round(maxBytes / 1024 / 1024)}MB，已拒绝保存`), { status: 413 });
    await writeFile(target, content, "utf8");
    size = Buffer.byteLength(content);
    mediaType = mediaType || "text/plain";
  }

  const parsed = await attachmentContentForPath(relPath, body.content);
  const summary = attachmentSummary({ kind, relPath, size, content: parsed.content, workbook: parsed.workbook, office: parsed.office });
  const officeImport = parsed.office?.officeTask ? {
    originalFileName: name,
    savedPath: path.relative(ctx.workspaceRoot, target),
    size,
    fileType: parsed.office.fileType || path.extname(name).replace(/^\./, ""),
    parseStatus: parsed.office.parseStatus || (parsed.office.ok ? "parsed" : "failed"),
    truncated: Boolean(parsed.truncated || parsed.office.truncated),
    supported: parsed.office.supported !== false,
    summary: parsed.office.summary || ""
  } : null;
  sendJson(res, 200, { ok: true, attachment: { id: randomUUID(), name, kind, path: path.relative(ctx.workspaceRoot, target), size, mediaType, summary, content: kind === "image" ? "" : parsed.content, contentChars: parsed.contentChars, truncated: parsed.truncated, officeImport, officeTask: parsed.office?.officeTask || null, savedAt: new Date().toISOString() } });
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
  if (body.confirmed !== true) throw Object.assign(new Error("运行本地命令前需要用户确认"), { status: 403 });
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

// ── 定时任务路由 ──────────────────────────────────────────────────────────────

export async function handleScheduleList(req, res) {
  const items = listSchedules().map((s) => ({ ...s, scheduleLabel: scheduleExprLabel(s.schedule) }));
  sendJson(res, 200, { ok: true, schedules: items });
}

export async function handleScheduleCreate(req, res) {
  const body = await readBody(req);
  const schedule = await createSchedule(body);
  sendJson(res, 200, { ok: true, schedule: { ...schedule, scheduleLabel: scheduleExprLabel(schedule.schedule) } });
}

export async function handleScheduleUpdate(req, res, id) {
  const body = await readBody(req);
  const schedule = await updateSchedule(id, body);
  if (!schedule) throw Object.assign(new Error("未找到定时任务"), { status: 404 });
  sendJson(res, 200, { ok: true, schedule: { ...schedule, scheduleLabel: scheduleExprLabel(schedule.schedule) } });
}

export async function handleScheduleDelete(req, res, id) {
  const ok = await deleteSchedule(id);
  if (!ok) throw Object.assign(new Error("未找到定时任务"), { status: 404 });
  sendJson(res, 200, { ok: true });
}

export async function handleScheduleRun(req, res, id) {
  const result = await runScheduleNow(id);
  sendJson(res, result.ok ? 200 : 500, { ok: result.ok, ...result });
}

// ── 桌宠状态广播 ──────────────────────────────────────────────────────────────

const petStateListeners = new Set();
let currentPetState = "idle";

export function broadcastPetState(state) {
  currentPetState = String(state || "idle");
  const data = `data: ${JSON.stringify({ state: currentPetState })}\n\n`;
  for (const r of petStateListeners) {
    if (!r.writableEnded) r.write(data);
    else petStateListeners.delete(r);
  }
}

export async function handlePetStatePost(req, res) {
  const body = await readBody(req);
  broadcastPetState(body.state || "idle");
  sendJson(res, 200, { ok: true, state: currentPetState });
}

export function handlePetStateStream(req, res) {
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
  // 立即发送当前状态
  res.write(`data: ${JSON.stringify({ state: currentPetState })}\n\n`);
  petStateListeners.add(res);
  req.on("close", () => petStateListeners.delete(res));
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
      if (req.method === "GET" && url.pathname === "/api/health") { sendJson(res, 200, { ok: true, name: "neo", version: appVersion, platform: process.platform, workspace: ctx.workspaceRoot, workspaceName: path.basename(ctx.workspaceRoot) || ctx.workspaceRoot, desktopMode: ctx.desktopMode, statePersistence: Boolean(ctx.appStatePath) }); return; }
      if (req.method === "GET" && url.pathname === "/api/app-state") { await handleReadAppState(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/app-state") { await handleWriteAppState(req, res); return; }
      if (req.method === "GET" && url.pathname === "/api/environment/check") { await handleEnvironmentCheck(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/environment/install") { await handleEnvironmentInstall(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/environment/install-missing") { await handleEnvironmentInstallMissing(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/desktop/check-update") { await handleDesktopCheckUpdate(req, res); return; }
      if (req.method === "GET" && url.pathname === "/api/desktop/update-status") { await handleDesktopUpdateStatus(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/desktop/install-update") { await handleDesktopInstallUpdate(req, res); return; }
      // 定时任务
      if (req.method === "GET" && url.pathname === "/api/schedules") { await handleScheduleList(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/schedules") { await handleScheduleCreate(req, res); return; }
      if (req.method === "PATCH" && url.pathname.startsWith("/api/schedules/")) { await handleScheduleUpdate(req, res, url.pathname.slice("/api/schedules/".length)); return; }
      if (req.method === "DELETE" && url.pathname.startsWith("/api/schedules/")) { await handleScheduleDelete(req, res, url.pathname.slice("/api/schedules/".length)); return; }
      if (req.method === "POST" && url.pathname.startsWith("/api/schedules/") && url.pathname.endsWith("/run")) { await handleScheduleRun(req, res, url.pathname.slice("/api/schedules/".length, -4)); return; }
      if (req.method === "GET" && url.pathname === "/api/petdex/pets") { await handlePetdexPets(req, res, url); return; }
      // 桌宠状态
      if (req.method === "POST" && url.pathname === "/api/pet/state") { await handlePetStatePost(req, res); return; }
      if (req.method === "GET" && url.pathname === "/api/pet/stream") { handlePetStateStream(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/chat") { await handleChat(req, res); return; }
      if (req.method === "GET" && url.pathname === "/api/workspace/tree") { await handleTree(req, res, url); return; }
      if (req.method === "POST" && url.pathname === "/api/workspace/select-folder") { await handleSelectWorkspace(req, res); return; }
      if (req.method === "POST" && url.pathname === "/api/workspace/select-external-paths") { await handleSelectExternalPaths(req, res); return; }
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
