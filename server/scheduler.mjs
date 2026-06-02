// server/scheduler.mjs — 定时自动化调度引擎
//
// 支持的调度表达式：
//   daily HH:MM         — 每天指定时刻（本地时间）
//   weekly N HH:MM      — 每周指定星期（0=周日...6=周六）指定时刻
//   hourly              — 每小时整点
//   interval Nm         — 每 N 分钟（N >= 5）
//   interval Nh         — 每 N 小时
//
// 任务在服务端用非流式 API 执行，结果写入工作区文件并推送桌面通知。

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { ctx } from "./context.mjs";
import { callOpenAICompatible } from "./api.mjs";
import { resolveWorkspacePath } from "./tools.mjs";

let schedules = [];
let schedulerInterval = null;
let running = new Set(); // 正在执行的任务 id，防止重叠

// ── 文件路径 ──────────────────────────────────────────────────────────────────

function schedulesFilePath() {
  if (ctx.appStatePath) return path.join(path.dirname(ctx.appStatePath), "schedules.json");
  return path.join(ctx.workspaceRoot, ".neo-schedules.json");
}

// ── 持久化 ────────────────────────────────────────────────────────────────────

export async function loadSchedules() {
  try {
    const fp = schedulesFilePath();
    if (!existsSync(fp)) { schedules = []; return; }
    schedules = JSON.parse(await readFile(fp, "utf8")) || [];
  } catch { schedules = []; }
}

async function saveSchedules() {
  try {
    const fp = schedulesFilePath();
    await mkdir(path.dirname(fp), { recursive: true });
    await writeFile(fp, JSON.stringify(schedules, null, 2), "utf8");
  } catch (err) {
    console.error("[neo scheduler] 保存定时任务失败:", err.message);
  }
}

// ── 调度表达式解析 ────────────────────────────────────────────────────────────

export function parseScheduleExpr(expr = "") {
  const s = String(expr).trim().toLowerCase();

  // hourly
  if (s === "hourly") return { type: "hourly" };

  // interval Nm / interval Nh
  const intervalMatch = s.match(/^interval\s+(\d+)\s*([mh])$/);
  if (intervalMatch) {
    const n = parseInt(intervalMatch[1], 10);
    const unit = intervalMatch[2];
    if (unit === "m" && n >= 5) return { type: "interval", minutes: n };
    if (unit === "h" && n >= 1) return { type: "interval", minutes: n * 60 };
  }

  // daily HH:MM
  const dailyMatch = s.match(/^daily\s+(\d{1,2}):(\d{2})$/);
  if (dailyMatch) {
    const h = parseInt(dailyMatch[1], 10);
    const m = parseInt(dailyMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { type: "daily", hour: h, minute: m };
  }

  // weekly N HH:MM
  const weeklyMatch = s.match(/^weekly\s+([0-6])\s+(\d{1,2}):(\d{2})$/);
  if (weeklyMatch) {
    const day = parseInt(weeklyMatch[1], 10);
    const h = parseInt(weeklyMatch[2], 10);
    const m = parseInt(weeklyMatch[3], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { type: "weekly", weekday: day, hour: h, minute: m };
  }

  return null; // 不合法
}

export function scheduleExprLabel(expr = "") {
  const p = parseScheduleExpr(expr);
  if (!p) return expr;
  const pad = (n) => String(n).padStart(2, "0");
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  if (p.type === "hourly") return "每小时整点";
  if (p.type === "interval") return p.minutes >= 60 ? `每 ${p.minutes / 60} 小时` : `每 ${p.minutes} 分钟`;
  if (p.type === "daily") return `每天 ${pad(p.hour)}:${pad(p.minute)}`;
  if (p.type === "weekly") return `每${weekdays[p.weekday]} ${pad(p.hour)}:${pad(p.minute)}`;
  return expr;
}

export function computeNextRun(expr = "", from = new Date()) {
  const p = parseScheduleExpr(expr);
  if (!p) return null;

  const now = new Date(from);

  if (p.type === "interval") {
    const next = new Date(now.getTime() + p.minutes * 60_000);
    next.setSeconds(0, 0);
    return next.toISOString();
  }

  if (p.type === "hourly") {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next.toISOString();
  }

  if (p.type === "daily") {
    const next = new Date(now);
    next.setHours(p.hour, p.minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  if (p.type === "weekly") {
    const next = new Date(now);
    next.setHours(p.hour, p.minute, 0, 0);
    const diff = (p.weekday - next.getDay() + 7) % 7;
    if (diff === 0 && next <= now) {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + diff);
    }
    return next.toISOString();
  }

  return null;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function listSchedules() {
  return schedules.map((s) => ({ ...s }));
}

export async function createSchedule(data) {
  if (!parseScheduleExpr(data.schedule)) {
    const err = new Error("无效的调度表达式");
    err.status = 400;
    throw err;
  }
  const schedule = {
    id: randomUUID(),
    name: String(data.name || "定时任务").trim().slice(0, 60),
    prompt: String(data.prompt || "").trim().slice(0, 4000),
    schedule: String(data.schedule || "daily 09:00"),
    providerId: String(data.providerId || ""),
    model: String(data.model || ""),
    enableTools: Boolean(data.enableTools),
    enabledSkills: Array.isArray(data.enabledSkills) ? data.enabledSkills : [],
    outputFile: String(data.outputFile || "schedules/{date}-{name}.md"),
    notify: Boolean(data.notify !== false), // 默认开启桌面通知
    enabled: true,
    createdAt: new Date().toISOString(),
    lastRun: null,
    nextRun: computeNextRun(String(data.schedule || "daily 09:00")),
    lastResult: null
  };
  schedules.push(schedule);
  await saveSchedules();
  return schedule;
}

export async function updateSchedule(id, patch) {
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  if (patch.schedule !== undefined && !parseScheduleExpr(patch.schedule)) {
    const err = new Error("无效的调度表达式");
    err.status = 400;
    throw err;
  }
  schedules[idx] = { ...schedules[idx], ...patch };
  if (patch.schedule) schedules[idx].nextRun = computeNextRun(patch.schedule);
  await saveSchedules();
  return schedules[idx];
}

export async function deleteSchedule(id) {
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx < 0) return false;
  schedules.splice(idx, 1);
  await saveSchedules();
  return true;
}

// ── 执行 ─────────────────────────────────────────────────────────────────────

function sanitizeFileName(name = "") {
  return String(name).replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 40);
}

function renderOutputPath(template = "", scheduleName = "", now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return template
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
    .replace(/\{datetime\}/g, `${date}T${time}`)
    .replace(/\{name\}/g, sanitizeFileName(scheduleName));
}

async function getProviderFromState(providerId) {
  if (!ctx.appStatePath || !existsSync(ctx.appStatePath)) return null;
  try {
    const state = JSON.parse(await readFile(ctx.appStatePath, "utf8"));
    const providers = Array.isArray(state.providers) ? state.providers : [];
    return providers.find((p) => p.id === providerId) || null;
  } catch { return null; }
}

export async function runScheduleNow(id) {
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) { const e = new Error("未找到定时任务"); e.status = 404; throw e; }
  return _executeSchedule(schedule);
}

async function _executeSchedule(schedule) {
  if (running.has(schedule.id)) {
    return { ok: false, message: "任务正在运行中，请稍后再试" };
  }
  running.add(schedule.id);

  const now = new Date();
  console.log(`[neo scheduler] 开始执行: ${schedule.name}`);

  try {
    const provider = await getProviderFromState(schedule.providerId);
    if (!provider || !provider.apiKey) {
      throw new Error(`未找到供应商 "${schedule.providerId}" 的配置或 API Key，请检查设置`);
    }

    // 运行 AI 任务
    const result = await callOpenAICompatible({
      provider,
      model: schedule.model || provider.models?.[0] || "",
      messages: [{ role: "user", content: schedule.prompt }],
      temperature: 0.7,
      enableTools: schedule.enableTools,
      enabledSkills: schedule.enabledSkills
    });

    const content = result.content || "(无输出)";

    // 写入结果文件
    const outputRelPath = renderOutputPath(schedule.outputFile, schedule.name, now);
    let savedPath = "";
    try {
      const outputAbsPath = resolveWorkspacePath(outputRelPath);
      await mkdir(path.dirname(outputAbsPath), { recursive: true });
      const header = `# ${schedule.name}\n\n执行时间：${now.toLocaleString("zh-CN")}\n\n---\n\n`;
      await writeFile(outputAbsPath, header + content, "utf8");
      savedPath = outputRelPath;
    } catch (writeErr) {
      console.warn(`[neo scheduler] 写入结果文件失败: ${writeErr.message}`);
    }

    // 桌面通知
    if (schedule.notify && typeof ctx.notifyDesktop === "function") {
      await ctx.notifyDesktop(`定时任务完成: ${schedule.name}`, savedPath ? `结果已保存到 ${savedPath}` : content.slice(0, 80)).catch(() => {});
    }

    const lastResult = { ok: true, savedPath, preview: content.slice(0, 300), runAt: now.toISOString() };
    await updateSchedule(schedule.id, { lastRun: now.toISOString(), nextRun: computeNextRun(schedule.schedule, now), lastResult });

    console.log(`[neo scheduler] 完成: ${schedule.name}${savedPath ? ` → ${savedPath}` : ""}`);
    return { ok: true, content, savedPath };

  } catch (err) {
    console.error(`[neo scheduler] 任务失败: ${schedule.name} —`, err.message);
    const lastResult = { ok: false, error: err.message, runAt: now.toISOString() };
    await updateSchedule(schedule.id, { lastRun: now.toISOString(), nextRun: computeNextRun(schedule.schedule, now), lastResult });

    if (schedule.notify && typeof ctx.notifyDesktop === "function") {
      await ctx.notifyDesktop(`定时任务失败: ${schedule.name}`, err.message.slice(0, 100)).catch(() => {});
    }
    return { ok: false, error: err.message };
  } finally {
    running.delete(schedule.id);
  }
}

// ── 调度主循环 ────────────────────────────────────────────────────────────────

export async function startScheduler() {
  await loadSchedules();

  schedulerInterval = setInterval(() => {
    const now = new Date();
    for (const schedule of schedules) {
      if (!schedule.enabled || !schedule.nextRun) continue;
      if (new Date(schedule.nextRun) <= now) {
        _executeSchedule(schedule).catch((err) =>
          console.error(`[neo scheduler] 未捕获错误: ${schedule.name} —`, err.message)
        );
      }
    }
  }, 60_000); // 每分钟检查一次

  console.log(`[neo scheduler] 已启动，共 ${schedules.length} 个定时任务`);
}

export function stopScheduler() {
  if (schedulerInterval) { clearInterval(schedulerInterval); schedulerInterval = null; }
}
