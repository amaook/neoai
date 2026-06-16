// server/operation-log.mjs — 工具操作审计日志（本地、可审计、永不外发）
// 只记录工具调用的元数据（工具名、安全参数摘要、结果状态、耗时、产出路径），
// 绝不记录正文内容（content/html/svg/markdown/rows 等），保护隐私。
import { appendFile, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import { ctx } from "./context.mjs";

const MAX_LOG_BYTES = 2 * 1024 * 1024; // 超过则裁剪
const TRIM_KEEP = 1000; // 裁剪后保留最近条数

// 安全字段白名单：只记元数据，绝不记录正文
const AUDIT_ARG_KEYS = [
  "path", "input_path", "output_path", "url", "command", "script", "language", "purpose",
  "query", "type", "agg", "sheet", "group_by", "pivot_column", "label_column", "value_columns",
  "values", "name", "paths", "max_rows", "max_points"
];

export function operationLogPath() {
  // 桌面端写到 userData（与 appStatePath 同目录）；web/测试写到工作区隐藏目录（被检索/列目录跳过）
  const base = ctx.appStatePath ? path.dirname(ctx.appStatePath) : path.join(ctx.workspaceRoot || ".", ".neo");
  return path.join(base, "operation-log.jsonl");
}

function truncate(value, n = 200) {
  const s = String(value);
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function auditArgsSummary(name, args = {}) {
  if (!args || typeof args !== "object") return {};
  const out = {};
  for (const key of AUDIT_ARG_KEYS) {
    const v = args[key];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) out[key] = truncate(v.map((x) => String(x)).join(","), 200);
    else if (typeof v === "object") continue; // 跳过复杂对象（可能含正文）
    else out[key] = truncate(v, 200);
  }
  return out;
}

async function trimIfNeeded(file) {
  try {
    const st = await stat(file);
    if (st.size <= MAX_LOG_BYTES) return;
    const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
    await writeFile(file, `${lines.slice(-TRIM_KEEP).join("\n")}\n`, "utf8");
  } catch { /* 裁剪失败不影响主流程 */ }
}

// 追加一条审计记录。任何失败都不得阻断工具执行。
export async function appendOperationLog(entry) {
  try {
    const file = operationLogPath();
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
    await trimIfNeeded(file);
  } catch { /* 审计日志失败绝不阻断工具执行 */ }
}

// 读取最近 N 条（按时间倒序返回，最新在前）
export async function readOperationLog({ limit = 200 } = {}) {
  try {
    const lines = (await readFile(operationLogPath(), "utf8")).split("\n").filter(Boolean);
    const recent = lines.slice(-Math.max(1, Math.min(2000, Number(limit) || 200)));
    return recent
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean)
      .reverse();
  } catch { return []; }
}

export async function clearOperationLog() {
  try { await writeFile(operationLogPath(), "", "utf8"); return true; } catch { return false; }
}
