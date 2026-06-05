// server.mjs — neo 服务入口（薄层）
//
// 全部业务逻辑已拆分到 server/ 子模块：
//   server/context.mjs     — 共享可变状态
//   server/tools.mjs       — 工具定义、实现、handleToolCall
//   server/api.mjs         — 非流式 API 调用
//   server/sse.mjs         — SSE 流式 API（含 Anthropic/Gemini 工具调用 + 心跳）
//   server/environment.mjs — 环境检测与安装脚本
//   server/routes.mjs      — HTTP 路由与 createNeoServer
//   server/scheduler.mjs   — 定时自动化调度引擎

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ctx } from "./server/context.mjs";
import { createNeoServer } from "./server/routes.mjs";
import { startScheduler, stopScheduler } from "./server/scheduler.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultPort = Number(process.env.PORT || 4321);

export function startServer(options = {}) {
  // 应用选项到共享上下文
  if (options.publicDir)            ctx.publicDir            = options.publicDir;
  if (options.workspaceRoot)        ctx.workspaceRoot        = path.resolve(options.workspaceRoot);
  if (options.desktopMode != null)  ctx.desktopMode          = Boolean(options.desktopMode);
  if (options.appStatePath)         ctx.appStatePath         = options.appStatePath;

  // Electron 桌面回调
  if (options.selectWorkspaceRoot)    ctx.selectWorkspaceRoot    = options.selectWorkspaceRoot;
  if (options.selectExternalPaths)    ctx.selectExternalPaths    = options.selectExternalPaths;
  if (options.openWorkspacePath)      ctx.openWorkspacePath      = options.openWorkspacePath;
  if (options.showWorkspacePath)      ctx.showWorkspacePath      = options.showWorkspacePath;
  if (options.openExternalUrl)        ctx.openExternalUrl        = options.openExternalUrl;
  if (options.notifyDesktop)          ctx.notifyDesktop          = options.notifyDesktop;
  if (options.renderImageFile)        ctx.renderImageFile        = options.renderImageFile;
  if (options.checkDesktopUpdates)    ctx.checkDesktopUpdates    = options.checkDesktopUpdates;
  if (options.getDesktopUpdateStatus) ctx.getDesktopUpdateStatus = options.getDesktopUpdateStatus;
  if (options.installDesktopUpdate)   ctx.installDesktopUpdate   = options.installDesktopUpdate;

  const listenPort = Number(options.port ?? defaultPort);
  const server = createNeoServer();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, "127.0.0.1", async () => {
      server.off("error", reject);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : listenPort;
      // 启动定时调度器（异步，不阻塞服务器启动）
      startScheduler().catch((err) => console.error("[neo scheduler] 启动失败:", err.message));
      resolve({ server, port: actualPort, url: `http://127.0.0.1:${actualPort}` });
    });
  });
}

// 直接运行时自动启动
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  startServer().then(({ url }) => {
    console.log(`neo is running at ${url}`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
