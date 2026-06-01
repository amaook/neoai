import { app, BrowserWindow, dialog, shell, Notification, Tray, Menu, nativeImage, screen } from "electron";
import electronUpdater from "electron-updater";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startServer } from "../server.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverHandle;
let workspaceConfigPath;
let tray;
let isQuitting = false;
let currentWorkspaceRoot = "";
let updateCheckInFlight = false;
let updateStatusLabel = "检查更新";
let updateReadyInfo = null;
let updateState = {
  ok: true,
  supported: false,
  status: "idle",
  checking: false,
  readyToInstall: false,
  version: "",
  currentVersion: "",
  progress: 0,
  downloadPercent: 0,
  message: "检查更新",
  detail: "等待检查更新",
  updatedAt: ""
};
let autoUpdater;

const appIconPath = path.join(__dirname, "../build/icon.png");

const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance) {
  app.quit();
}

function createWindow(url) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return;
  }

  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";
  const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const workArea = cursorDisplay.workArea;
  const width = Math.min(1280, workArea.width - 40);
  const height = Math.min(860, workArea.height - 40);

  mainWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    minWidth: 980,
    minHeight: 680,
    title: "neo",
    icon: appIconPath,
    backgroundColor: isMac ? "#00000000" : "#f7f4ee",
    transparent: isMac,
    ...(isMac ? {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 14, y: 18 },
      vibrancy: "under-window",
      visualEffectState: "active"
    } : {}),
    ...(isWindows ? {
      backgroundMaterial: "acrylic"
    } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isMac) {
    mainWindow.setBackgroundColor("#00000000");
    mainWindow.setVibrancy("under-window");
  }

  mainWindow.loadURL(url);

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    if (process.platform === "darwin") app.dock?.hide();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });
}

function showMainWindow() {
  if (process.platform === "darwin") app.dock?.show();
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (serverHandle?.url) createWindow(serverHandle.url);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  const image = nativeImage.createFromPath(appIconPath).resize({
    width: process.platform === "darwin" ? 18 : 20,
    height: process.platform === "darwin" ? 18 : 20
  });
  if (process.platform === "darwin") image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip("neo");
  updateTrayMenu();
  tray.on("click", showMainWindow);
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示 neo", click: showMainWindow },
    {
      label: "打开工作区文件夹",
      click: () => {
        if (currentWorkspaceRoot) shell.openPath(currentWorkspaceRoot);
      }
    },
    {
      label: updateStatusLabel,
      enabled: !updateCheckInFlight,
      click: () => checkForUpdates(true, { background: true, interactive: true })
    },
    { type: "separator" },
    {
      label: "退出 neo",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
}

function setUpdateStatus(label, patch = {}) {
  updateStatusLabel = label;
  updateState = {
    ...updateState,
    message: label,
    updatedAt: new Date().toISOString(),
    ...patch
  };
  updateTrayMenu();
}

function getUpdateState() {
  return {
    ...updateState,
    supported: app.isPackaged,
    currentVersion: app.getVersion(),
    checking: updateCheckInFlight || updateState.checking
  };
}

function notifyUser(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

function showInstallFallback(error) {
  isQuitting = false;
  const detail = [
    error?.message || "更新安装器没有在预期时间内启动。",
    "这通常和 macOS 签名/权限有关。可以先打开下载页，手动安装最新版本。"
  ].join("\n\n");

  setUpdateStatus("自动安装未完成，请手动安装最新版", {
    ok: false,
    supported: true,
    status: "error",
    checking: false,
    readyToInstall: true,
    progress: 100,
    error: detail
  });

  dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "neo 自动安装未完成",
    message: "更新已下载，但自动重启安装没有成功启动",
    detail,
    buttons: ["打开下载页", "稍后"],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      shell.openExternal("https://github.com/amaook/neo-ai-releases/releases/latest");
    }
  }).catch((dialogError) => {
    console.error("neo install fallback dialog failed:", dialogError);
  });
}

function startUpdateInstall() {
  setUpdateStatus("正在重启安装更新...", {
    status: "installing",
    checking: false,
    readyToInstall: true,
    progress: 100,
    detail: "正在退出 neo 并交给安装器"
  });

  setTimeout(() => {
    try {
      isQuitting = true;
      getAutoUpdater().quitAndInstall(false, true);
      setTimeout(() => {
        showInstallFallback(new Error("neo 没有在 5 秒内退出安装。"));
      }, 5000);
    } catch (error) {
      showInstallFallback(error);
    }
  }, 300);
}

async function showUpdateReadyDialog(info) {
  updateReadyInfo = info || updateReadyInfo;
  const version = info?.version ? ` ${info.version}` : "";
  showMainWindow();
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "neo 更新已就绪",
    message: `neo 新版本${version} 已下载完成`,
    detail: "现在重启会自动安装更新。也可以稍后退出软件时再安装。",
    buttons: ["立即重启安装", "稍后"],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 0) {
    startUpdateInstall();
  }
}

function getAutoUpdater() {
  if (!autoUpdater) autoUpdater = electronUpdater.autoUpdater;
  return autoUpdater;
}

async function installDownloadedUpdate() {
  if (!app.isPackaged) {
    return {
      ok: false,
      supported: false,
      status: "unsupported",
      progress: 0,
      message: "自动更新会在安装包版本里生效"
    };
  }

  if (!updateReadyInfo && !updateState.readyToInstall) {
    return {
      ok: false,
      supported: true,
      status: updateState.status,
      progress: updateState.progress,
      message: "还没有下载完成的更新，请先检查更新"
    };
  }

  startUpdateInstall();

  return {
    ok: true,
    supported: true,
    status: "installing",
    readyToInstall: true,
    progress: 100,
    message: "正在重启安装更新"
  };
}

async function checkForUpdates(manual = false, options = {}) {
  const background = Boolean(options.background);
  const interactive = Boolean(options.interactive ?? manual);

  if (!app.isPackaged) {
    const result = {
      ok: false,
      supported: false,
      status: "unsupported",
      progress: 0,
      message: "自动更新会在安装包版本里生效"
    };
    if (manual && interactive) {
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "开发模式",
        message: result.message,
        detail: "本地开发运行时不会连接更新源，打包安装后的 neo 会自动检查 GitHub Release。"
      });
    }
    return result;
  }

  if (updateReadyInfo || updateState.readyToInstall) {
    const ready = {
      ok: true,
      supported: true,
      status: "downloaded",
      checking: false,
      readyToInstall: true,
      version: updateReadyInfo?.version || updateState.version || "",
      progress: 100,
      downloadPercent: 100,
      message: "新版已下载，点击重启安装",
      detail: "更新包已准备好"
    };
    setUpdateStatus(ready.message, ready);
    if (interactive) {
      showUpdateReadyDialog(updateReadyInfo).catch((error) => console.error("neo update dialog failed:", error));
    }
    return ready;
  }

  if (updateCheckInFlight) {
    return {
      ok: true,
      supported: true,
      status: "checking",
      checking: true,
      progress: Math.max(updateState.progress || 0, 8),
      message: "正在检查更新"
    };
  }

  const runCheck = async () => {
    updateCheckInFlight = true;
    setUpdateStatus("正在检查更新...", {
      ok: true,
      supported: true,
      status: "checking",
      checking: true,
      readyToInstall: false,
      progress: 8,
      downloadPercent: 0,
      detail: "正在连接更新源"
    });

    try {
      const result = await getAutoUpdater().checkForUpdates();
      const version = result?.updateInfo?.version || "";
      if (version && updateState.status === "checking") {
        setUpdateStatus(`发现新版本 ${version}，正在准备下载...`, {
          ok: true,
          supported: true,
          status: "downloading",
          checking: false,
          version,
          progress: 25,
          detail: "已发现新版本，正在准备下载"
        });
      }
      return {
        ...getUpdateState(),
        ok: true,
        supported: true,
        version,
        progress: getUpdateState().progress,
        message: version ? `发现新版本 ${version}，正在准备下载` : getUpdateState().message
      };
    } catch (error) {
      console.error("neo update check failed:", error);
      const failed = {
        ok: false,
        supported: true,
        status: "error",
        checking: false,
        readyToInstall: false,
        progress: 100,
        message: "检查更新失败",
        error: error?.message || "请稍后再试。"
      };
      setUpdateStatus(failed.message, failed);
      if (manual && interactive) {
        await dialog.showMessageBox(mainWindow, {
          type: "warning",
          title: "检查更新失败",
          message: "暂时无法连接更新源",
          detail: failed.error
        });
      }
      return failed;
    } finally {
      updateCheckInFlight = false;
      updateState = {
        ...updateState,
        checking: false,
        updatedAt: new Date().toISOString()
      };
      updateTrayMenu();
    }
  };

  if (background) {
    runCheck().catch((error) => console.error("neo background update check failed:", error));
    return {
      ...getUpdateState(),
      ok: true,
      supported: true,
      status: "checking",
      checking: true,
      progress: 8,
      message: "正在后台检查更新"
    };
  }

  return runCheck();
}

function configureAutoUpdates() {
  if (!app.isPackaged) return;

  const updater = getAutoUpdater();
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  updater.on("checking-for-update", () => {
    setUpdateStatus("正在检查更新...", {
      ok: true,
      supported: true,
      status: "checking",
      checking: true,
      readyToInstall: false,
      progress: 8,
      downloadPercent: 0,
      detail: "正在连接更新源"
    });
  });

  updater.on("update-available", (info) => {
    const version = info?.version ? ` ${info.version}` : "";
    setUpdateStatus(`正在下载更新${version}...`, {
      ok: true,
      supported: true,
      status: "downloading",
      checking: false,
      readyToInstall: false,
      version: info?.version || "",
      progress: 25,
      detail: "已发现新版本，正在开始下载"
    });
    notifyUser("neo 有新版本", `正在下载新版本${version}。`);
  });

  updater.on("update-not-available", () => {
    setUpdateStatus("已是最新版本", {
      ok: true,
      supported: true,
      status: "not-available",
      checking: false,
      readyToInstall: false,
      version: app.getVersion(),
      progress: 100,
      detail: "当前版本已经是最新"
    });
    setTimeout(() => setUpdateStatus("检查更新", {
      status: "idle",
      checking: false,
      readyToInstall: false,
      progress: 0,
      downloadPercent: 0,
      detail: "等待下次检查",
      error: ""
    }), 30_000);
  });

  updater.on("download-progress", (progress) => {
    const percent = Number.isFinite(progress?.percent) ? Math.round(progress.percent) : 0;
    const totalProgress = Math.min(95, Math.max(30, Math.round(30 + percent * 0.65)));
    setUpdateStatus(`正在下载更新 ${percent}%`, {
      ok: true,
      supported: true,
      status: "downloading",
      checking: false,
      readyToInstall: false,
      progress: totalProgress,
      downloadPercent: percent,
      detail: progress?.bytesPerSecond
        ? `下载中 ${percent}% · ${Math.round(progress.bytesPerSecond / 1024)} KB/s`
        : `下载中 ${percent}%`
    });
  });

  updater.on("update-downloaded", (info) => {
    const version = info?.version ? ` ${info.version}` : "";
    updateReadyInfo = info || updateReadyInfo;
    setUpdateStatus(`新版${version} 已就绪，点击重启安装`, {
      ok: true,
      supported: true,
      status: "downloaded",
      checking: false,
      readyToInstall: true,
      version: info?.version || "",
      progress: 100,
      downloadPercent: 100,
      detail: "更新包已下载完成"
    });
    notifyUser("neo 更新已就绪", "重启后即可安装新版本。");
    showUpdateReadyDialog(info).catch((error) => console.error("neo update dialog failed:", error));
  });

  updater.on("error", (error) => {
    console.error("neo updater error:", error);
    setUpdateStatus("检查更新失败", {
      ok: false,
      supported: true,
      status: "error",
      checking: false,
      readyToInstall: false,
      progress: 100,
      error: error?.message || "请稍后再试。"
    });
    setTimeout(() => setUpdateStatus("检查更新", {
      status: "idle",
      checking: false,
      readyToInstall: false,
      progress: 0,
      downloadPercent: 0,
      detail: "等待下次检查",
      error: ""
    }), 30_000);
  });

  setTimeout(() => checkForUpdates(false, { background: true }), 8_000);
  setInterval(() => checkForUpdates(false, { background: true }), 6 * 60 * 60 * 1000);
}

async function readSavedWorkspace(defaultWorkspace) {
  workspaceConfigPath = path.join(app.getPath("userData"), "workspace.json");
  try {
    const saved = JSON.parse(await readFile(workspaceConfigPath, "utf8"));
    return saved.workspaceRoot || defaultWorkspace;
  } catch {
    return defaultWorkspace;
  }
}

async function saveWorkspace(workspaceRoot) {
  if (!workspaceConfigPath) return;
  await mkdir(path.dirname(workspaceConfigPath), { recursive: true });
  await writeFile(workspaceConfigPath, JSON.stringify({ workspaceRoot }, null, 2), "utf8");
}

async function renderImageFile({ html, sourcePath, outputPath, width, height, format, quality, transparent }) {
  const renderWindow = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: Boolean(transparent && format !== "jpg"),
    backgroundColor: transparent && format !== "jpg" ? "#00000000" : "#ffffff",
    paintWhenInitiallyHidden: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false
    }
  });

  try {
    if (sourcePath) {
      await renderWindow.loadURL(pathToFileURL(sourcePath).toString());
    } else {
      await renderWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html || "")}`);
    }

    await renderWindow.webContents.executeJavaScript(`
      Promise.all([
        document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      ]).then(() => true)
    `);

    const image = await renderWindow.webContents.capturePage({
      x: 0,
      y: 0,
      width,
      height
    });
    const buffer = format === "jpg" ? image.toJPEG(Math.round((quality || 0.92) * 100)) : image.toPNG();
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buffer);
    return { ok: true, width, height, format };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    if (!renderWindow.isDestroyed()) renderWindow.destroy();
  }
}

async function boot() {
  const defaultWorkspaceRoot = path.join(app.getPath("documents"), "neo Workspace");
  const workspaceRoot = await readSavedWorkspace(defaultWorkspaceRoot);
  currentWorkspaceRoot = workspaceRoot;
  await mkdir(workspaceRoot, { recursive: true });

  serverHandle = await startServer({
    port: 0,
    workspaceRoot,
    desktopMode: true,
    appStatePath: path.join(app.getPath("userData"), "state.json"),
    openWorkspacePath: async (targetPath) => shell.openPath(targetPath),
    showWorkspacePath: async (targetPath) => shell.showItemInFolder(targetPath),
    openExternalUrl: async (targetUrl) => shell.openExternal(targetUrl),
    notifyDesktop: async (title, body) => {
      if (Notification.isSupported()) new Notification({ title, body }).show();
    },
    renderImageFile,
    checkDesktopUpdates: async (manual) => checkForUpdates(manual, { background: true, interactive: false }),
    getDesktopUpdateStatus: async () => getUpdateState(),
    installDesktopUpdate: async () => installDownloadedUpdate(),
    selectWorkspaceRoot: async (currentWorkspace) => {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "选择 neo 工作文件夹",
        defaultPath: currentWorkspace,
        properties: ["openDirectory", "createDirectory"]
      });
      if (result.canceled || !result.filePaths.length) return null;
      const selected = result.filePaths[0];
      currentWorkspaceRoot = selected;
      await saveWorkspace(selected);
      return selected;
    }
  });

  createWindow(serverHandle.url);
  createTray();
  configureAutoUpdates();
}

app.on("second-instance", () => {
  showMainWindow();
});

app.whenReady().then(boot);

app.on("activate", () => {
  showMainWindow();
});

app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  isQuitting = true;
  serverHandle?.server?.close();
});
