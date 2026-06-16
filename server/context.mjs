// server/context.mjs — 共享可变状态
// 所有子模块通过此文件读写全局配置，避免循环依赖。

import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// server/ 目录的父目录即项目根目录
export const rootDir = path.dirname(__dirname);

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export const ctx = {
  // 运行时路径
  publicDir: path.join(rootDir, "public"),
  workspaceRoot: process.env.NEO_AI_WORKSPACE || rootDir,
  appStatePath: process.env.NEO_AI_STATE_PATH || "",

  // 运行模式
  desktopMode: process.env.NEO_AI_DESKTOP === "1",

  // 超时配置
  defaultApiTimeoutMs: Number(process.env.NEO_AI_API_TIMEOUT_MS || 60000),
  // 流式响应体的空闲超时：响应头到达后，若连续这么久没有新数据则中断（防止上游中途卡死）
  streamIdleTimeoutMs: Number(process.env.NEO_AI_STREAM_IDLE_MS || 45000),
  maxToolRounds: boundedNumber(process.env.NEO_AI_MAX_TOOL_ROUNDS || process.env.NEO_MAX_TOOL_ROUNDS, 25, 1, 60),
  // 服务端历史字符上限：超出时丢弃中间较早消息（防止超长对话直接打到上游报错的最后一道保险）
  maxHistoryChars: Number(process.env.NEO_AI_MAX_HISTORY_CHARS || 200000),

  // Electron 注入的桌面端回调（web 模式下为 null）
  selectWorkspaceRoot: null,
  selectExternalPaths: null,
  openWorkspacePath: null,
  showWorkspacePath: null,
  openExternalUrl: null,
  notifyDesktop: null,
  renderImageFile: null,
  renderPdfFile: null,
  captureScreen: null,
  checkDesktopUpdates: null,
  getDesktopUpdateStatus: null,
  installDesktopUpdate: null,
};
