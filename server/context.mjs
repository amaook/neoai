// server/context.mjs — 共享可变状态
// 所有子模块通过此文件读写全局配置，避免循环依赖。

import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// server/ 目录的父目录即项目根目录
export const rootDir = path.dirname(__dirname);

export const ctx = {
  // 运行时路径
  publicDir: path.join(rootDir, "public"),
  workspaceRoot: process.env.NEO_AI_WORKSPACE || rootDir,
  appStatePath: process.env.NEO_AI_STATE_PATH || "",

  // 运行模式
  desktopMode: process.env.NEO_AI_DESKTOP === "1",

  // 超时配置
  defaultApiTimeoutMs: Number(process.env.NEO_AI_API_TIMEOUT_MS || 60000),

  // Electron 注入的桌面端回调（web 模式下为 null）
  selectWorkspaceRoot: null,
  openWorkspacePath: null,
  showWorkspacePath: null,
  openExternalUrl: null,
  notifyDesktop: null,
  renderImageFile: null,
  checkDesktopUpdates: null,
  getDesktopUpdateStatus: null,
  installDesktopUpdate: null,
};
