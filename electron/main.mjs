import { app, BrowserWindow, dialog, shell, Notification, Tray, Menu, nativeImage, screen, ipcMain } from "electron";
import electronUpdater from "electron-updater";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startServer } from "../server.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

let mainWindow;
let petWindow = null;
let serverHandle;
let workspaceConfigPath;
let tray;
let isQuitting = false;
let currentWorkspaceRoot = "";
let updateCheckInFlight = false;
let updateStatusLabel = "检查更新";
let updateReadyInfo = null;
let updateInstallFallbackTimer = null;
let macSignatureStatusPromise = null;
let petQuietMode = false;
let petAnchor = null;
let petSettingsPath = "";
let petSettingsSaveTimer = null;
let petChatSize = { width: 350, height: 450 };
let petLayoutState = { open: false, placement: "above", petW: 72, petH: 72, chatW: 350, chatH: 450, margin: 8, gap: 10 };
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
const latestReleaseUrl = "https://github.com/amaook/neoai/releases/latest";
const desktopTestMode = process.env.NEO_DESKTOP_TEST === "1" || /neo[ -]test/i.test(`${app.getName()} ${app.getPath("exe")}`);

if (desktopTestMode) {
  app.setName("neo Test");
}

const desktopTestRoot = process.env.NEO_DESKTOP_TEST_ROOT
  ? path.resolve(process.env.NEO_DESKTOP_TEST_ROOT)
  : app.isPackaged
    ? path.join(app.getPath("userData"), "isolated-test")
    : path.resolve(path.join(__dirname, "../outputs/desktop-test"));

if (desktopTestMode) {
  app.setPath("userData", path.join(desktopTestRoot, "user-data"));
}

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
    title: desktopTestMode ? "neo 测试版" : "neo",
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
      backgroundMaterial: "none"
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
  tray.setToolTip(desktopTestMode ? "neo 测试版" : "neo");
  updateTrayMenu();
  tray.on("click", showMainWindow);
}

function updateTrayMenu() {
  if (!tray) return;
  const petVisible = petWindow && !petWindow.isDestroyed() && petWindow.isVisible();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: desktopTestMode ? "显示 neo 测试版" : "显示 neo", click: showMainWindow },
    {
      label: "打开工作区文件夹",
      click: () => {
        if (currentWorkspaceRoot) shell.openPath(currentWorkspaceRoot);
      }
    },
    {
      label: petVisible ? "隐藏桌宠" : "显示桌宠",
      click: () => {
        if (!petWindow || petWindow.isDestroyed()) {
          createPetWindow();
          updateTrayMenu();
          return;
        }
        if (petWindow.isVisible()) petWindow.hide();
        else petWindow.show();
        updateTrayMenu();
      }
    },
    {
      label: desktopTestMode ? "测试模式不检查更新" : updateStatusLabel,
      enabled: !desktopTestMode && !updateCheckInFlight,
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

function configureApplicationMenu() {
  const appName = desktopTestMode ? "neo 测试版" : "neo";
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{
      label: appName,
      submenu: [
        { label: `关于 ${appName}`, role: "about" },
        { type: "separator" },
        { label: "服务", role: "services" },
        { type: "separator" },
        { label: `隐藏 ${appName}`, role: "hide" },
        { label: "隐藏其他应用", role: "hideOthers" },
        { label: "显示全部", role: "unhide" },
        { type: "separator" },
        { label: `退出 ${appName}`, role: "quit" }
      ]
    }] : []),
    {
      label: "文件",
      submenu: [
        { label: "显示主窗口", click: showMainWindow },
        {
          label: "打开工作区文件夹",
          enabled: Boolean(currentWorkspaceRoot),
          click: () => { if (currentWorkspaceRoot) shell.openPath(currentWorkspaceRoot); }
        },
        { type: "separator" },
        isMac ? { label: "关闭窗口", role: "close" } : { label: "退出", role: "quit" }
      ]
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" }
      ]
    },
    {
      label: "显示",
      submenu: [
        { label: "重新载入", role: "reload" },
        { label: "切换开发者工具", role: "toggleDevTools" },
        { type: "separator" },
        { label: "放大", role: "zoomIn" },
        { label: "缩小", role: "zoomOut" },
        { label: "实际大小", role: "resetZoom" },
        { type: "separator" },
        { label: "全屏", role: "togglefullscreen" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { label: "最小化", role: "minimize" },
        { label: "缩放", role: "zoom" },
        ...(isMac ? [{ type: "separator" }, { label: "置于前方", role: "front" }] : [])
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "检查更新",
          enabled: !desktopTestMode,
          click: () => checkForUpdates(true, { background: true, interactive: true })
        },
        {
          label: "打开发布页面",
          click: () => shell.openExternal(latestReleaseUrl)
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function loadPetSettings() {
  petSettingsPath = path.join(app.getPath("userData"), "pet-settings.json");
  try {
    const settings = JSON.parse(await readFile(petSettingsPath, "utf8"));
    petQuietMode = Boolean(settings.quietMode);
    if (Number.isFinite(settings.anchor?.x) && Number.isFinite(settings.anchor?.y)) {
      petAnchor = { x: settings.anchor.x, y: settings.anchor.y };
    }
    if (Number.isFinite(settings.chatSize?.width) && Number.isFinite(settings.chatSize?.height)) {
      petChatSize = {
        width: clamp(Number(settings.chatSize.width), 280, 720),
        height: clamp(Number(settings.chatSize.height), 320, 900)
      };
      petLayoutState.chatW = petChatSize.width;
      petLayoutState.chatH = petChatSize.height;
    }
  } catch {
    petQuietMode = false;
    petAnchor = null;
    petChatSize = { width: 350, height: 450 };
  }
}

async function savePetSettings() {
  if (!petSettingsPath) return;
  try {
    await writeFile(petSettingsPath, JSON.stringify({
      quietMode: petQuietMode,
      anchor: petAnchor,
      chatSize: petChatSize
    }, null, 2));
  } catch {
    // 桌宠设置失败不影响主应用。
  }
}

function queueSavePetSettings() {
  clearTimeout(petSettingsSaveTimer);
  petSettingsSaveTimer = setTimeout(savePetSettings, 250);
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

function getAppBundlePath() {
  const marker = ".app/Contents/";
  const fromExecPath = process.execPath.includes(marker)
    ? `${process.execPath.slice(0, process.execPath.indexOf(marker))}.app`
    : "";
  const appPath = app.getAppPath();
  const fromAppPath = appPath.includes(marker)
    ? `${appPath.slice(0, appPath.indexOf(marker))}.app`
    : "";
  return fromExecPath || fromAppPath || path.dirname(process.execPath);
}

async function getMacSignatureStatus() {
  if (process.platform !== "darwin" || !app.isPackaged) {
    return { autoInstallSupported: true, reason: "" };
  }

  if (!macSignatureStatusPromise) {
    macSignatureStatusPromise = (async () => {
      const appBundlePath = getAppBundlePath();
      try {
        const { stdout, stderr } = await execFileAsync("/usr/bin/codesign", ["-dv", "--verbose=4", appBundlePath]);
        const output = `${stdout}\n${stderr}`;
        const teamIdentifier = output.match(/TeamIdentifier=(.+)/)?.[1]?.trim() || "";
        const adHocSigned = /Signature=adhoc/.test(output) || teamIdentifier === "not set";
        if (!adHocSigned && teamIdentifier) return { autoInstallSupported: true, reason: "" };
        return {
          autoInstallSupported: false,
          reason: "当前 neo 是本地临时签名版本，没有 Apple Developer ID 签名。macOS 不允许这种包自动替换安装，需要手动下载并覆盖安装。"
        };
      } catch {
        return {
          autoInstallSupported: false,
          reason: "无法确认当前 neo 的 macOS 签名状态。为避免自动替换失败，请手动下载并覆盖安装。"
        };
      }
    })();
  }

  return macSignatureStatusPromise;
}

function closeDesktopServer() {
  const server = serverHandle?.server;
  if (!server) return;
  try { server.closeIdleConnections?.(); } catch {}
  try { server.closeAllConnections?.(); } catch {}
  try { server.close(); } catch {}
}

function prepareForQuit() {
  isQuitting = true;
  closeDesktopServer();
}

function openLatestRelease() {
  shell.openExternal(latestReleaseUrl);
}

function showInstallFallback(error, options = {}) {
  isQuitting = false;
  if (updateInstallFallbackTimer) {
    clearTimeout(updateInstallFallbackTimer);
    updateInstallFallbackTimer = null;
  }
  const detail = [
    error?.message || "更新安装器没有在预期时间内启动。",
    options.detail || "这通常和 macOS 签名/权限有关。可以先打开下载页，手动安装最新版本。"
  ].join("\n\n");

  setUpdateStatus(options.manualOnly ? "新版已下载，请手动安装最新版" : "自动安装未完成，请手动安装最新版", {
    ok: !options.manualOnly,
    supported: true,
    status: options.manualOnly ? "manual-install" : "error",
    checking: false,
    readyToInstall: true,
    manualInstallRequired: true,
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
      openLatestRelease();
    }
  }).catch((dialogError) => {
    console.error("neo install fallback dialog failed:", dialogError);
  });
}

async function startUpdateInstall() {
  const signatureStatus = await getMacSignatureStatus();
  if (!signatureStatus.autoInstallSupported) {
    showInstallFallback(new Error(signatureStatus.reason), {
      manualOnly: true,
      detail: "打开下载页后下载最新版 dmg，退出 neo，再拖到 Applications 覆盖安装。"
    });
    openLatestRelease();
    return {
      ok: true,
      supported: true,
      status: "manual-install",
      readyToInstall: true,
      manualInstallRequired: true,
      progress: 100,
      message: "新版已下载，请手动安装最新版",
      detail: signatureStatus.reason
    };
  }

  setUpdateStatus("正在重启安装更新...", {
    status: "installing",
    checking: false,
    readyToInstall: true,
    progress: 100,
    detail: "正在退出 neo 并交给安装器"
  });

  setTimeout(() => {
    try {
      prepareForQuit();
      getAutoUpdater().quitAndInstall(false, true);
      updateInstallFallbackTimer = setTimeout(() => {
        showInstallFallback(new Error("自动安装器仍未接手安装。"));
      }, process.platform === "darwin" ? 120_000 : 30_000);
    } catch (error) {
      showInstallFallback(error);
    }
  }, 300);

  return {
    ok: true,
    supported: true,
    status: "installing",
    readyToInstall: true,
    progress: 100,
    message: "正在重启安装更新"
  };
}

async function showUpdateReadyDialog(info) {
  updateReadyInfo = info || updateReadyInfo;
  const version = info?.version ? ` ${info.version}` : "";
  const signatureStatus = await getMacSignatureStatus();
  const autoInstallSupported = signatureStatus.autoInstallSupported;
  showMainWindow();
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "neo 更新已就绪",
    message: `neo 新版本${version} 已下载完成`,
    detail: autoInstallSupported
      ? "现在重启会自动安装更新。也可以稍后退出软件时再安装。"
      : `${signatureStatus.reason}\n\n请打开下载页，下载最新版 dmg 后手动覆盖安装。`,
    buttons: [autoInstallSupported ? "立即重启安装" : "打开下载页", "稍后"],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 0) {
    if (autoInstallSupported) startUpdateInstall();
    else openLatestRelease();
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

  return startUpdateInstall();
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
    const signatureStatus = await getMacSignatureStatus();
    const ready = {
      ok: true,
      supported: true,
      status: signatureStatus.autoInstallSupported ? "downloaded" : "manual-install",
      checking: false,
      readyToInstall: true,
      manualInstallRequired: !signatureStatus.autoInstallSupported,
      version: updateReadyInfo?.version || updateState.version || "",
      progress: 100,
      downloadPercent: 100,
      message: signatureStatus.autoInstallSupported ? "新版已下载，点击重启安装" : "新版已下载，请手动安装最新版",
      detail: signatureStatus.autoInstallSupported ? "更新包已准备好" : signatureStatus.reason
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
    (async () => {
      const version = info?.version ? ` ${info.version}` : "";
      const signatureStatus = await getMacSignatureStatus();
      updateReadyInfo = info || updateReadyInfo;
      setUpdateStatus(
        signatureStatus.autoInstallSupported ? `新版${version} 已就绪，点击重启安装` : `新版${version} 已下载，请手动安装`,
        {
          ok: true,
          supported: true,
          status: signatureStatus.autoInstallSupported ? "downloaded" : "manual-install",
          checking: false,
          readyToInstall: true,
          manualInstallRequired: !signatureStatus.autoInstallSupported,
          version: info?.version || "",
          progress: 100,
          downloadPercent: 100,
          detail: signatureStatus.autoInstallSupported ? "更新包已下载完成" : signatureStatus.reason
        }
      );
      notifyUser("neo 更新已就绪", signatureStatus.autoInstallSupported ? "重启后即可安装新版本。" : "请打开下载页手动安装最新版。");
      showUpdateReadyDialog(info).catch((error) => console.error("neo update dialog failed:", error));
    })().catch((error) => console.error("neo update downloaded handler failed:", error));
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
  if (desktopTestMode) {
    await mkdir(path.join(desktopTestRoot, "workspace"), { recursive: true });
    await mkdir(app.getPath("userData"), { recursive: true });
  }

  const defaultWorkspaceRoot = desktopTestMode
    ? path.join(desktopTestRoot, "workspace")
    : path.join(app.getPath("documents"), "neo Workspace");
  const workspaceRoot = await readSavedWorkspace(defaultWorkspaceRoot);
  currentWorkspaceRoot = workspaceRoot;
  await mkdir(workspaceRoot, { recursive: true });
  await loadPetSettings();

  serverHandle = await startServer({
    port: 0,
    workspaceRoot,
    desktopMode: true,
    appStatePath: path.join(app.getPath("userData"), "state.json"),
    openWorkspacePath: async (targetPath) => shell.openPath(targetPath),
    showWorkspacePath: async (targetPath) => shell.showItemInFolder(targetPath),
    openExternalUrl: async (targetUrl) => shell.openExternal(targetUrl),
    notifyDesktop: async (title, body) => {
      if (desktopTestMode) return;
      if (Notification.isSupported()) new Notification({ title, body }).show();
    },
    renderImageFile,
    checkDesktopUpdates: async (manual) => desktopTestMode
      ? { ok: false, supported: false, status: "test-mode", message: "桌面测试模式不检查更新" }
      : checkForUpdates(manual, { background: true, interactive: false }),
    getDesktopUpdateStatus: async () => getUpdateState(),
    installDesktopUpdate: async () => desktopTestMode
      ? { ok: false, supported: false, status: "test-mode", message: "桌面测试模式不安装更新" }
      : installDownloadedUpdate(),
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
    },
    selectExternalPaths: async (currentWorkspace) => {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "授权 neo 读取工作区外文件或文件夹",
        defaultPath: currentWorkspace || currentWorkspaceRoot,
        properties: ["openFile", "openDirectory", "multiSelections"]
      });
      if (result.canceled || !result.filePaths.length) return [];
      return result.filePaths;
    }
  });

  createWindow(serverHandle.url);
  configureApplicationMenu();
  createTray();
  if (desktopTestMode) {
    setUpdateStatus("测试模式", {
      supported: false,
      status: "test-mode",
      message: "桌面测试模式",
      detail: "已隔离用户数据、工作区和更新检查"
    });
  } else {
    configureAutoUpdates();
  }
  createPetWindow();
  setupPetIpc();
}

// ── 桌宠窗口 ──────────────────────────────────────────────────────

const PET_SIZE = 72;
const PET_MARGIN = 24;
const PET_SNIFF_RADIUS = 92;
const PET_DESKTOP_CACHE_MS = 5000;
let desktopIconCache = { at: 0, icons: [] };

const desktopSensitiveNamePatterns = [
  /薪资|工资|合同|协议|密码|私密|保密|身份证|银行卡|证件|社保|税务|个税/,
  /(^|[^a-z0-9])(passwd|password|secret|credential|private|token|salary|payroll|contract|tax|ssn|credit|bank)([^a-z0-9]|$)/i,
  /(^|[\\/])\.env($|\.|[\\/])/i
];

const desktopFileQuoteRules = [
  { exts: new Set(["png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "svg"]), quotes: ["这张图有故事", "像是视觉线索", "我闻到图片味"] },
  { exts: new Set(["xlsx", "xls", "csv", "tsv", "numbers"]), quotes: ["表格味很浓", "这里能算一算", "数据在里面"] },
  { exts: new Set(["doc", "docx", "pdf", "pages", "md", "txt"]), quotes: ["像是正经资料", "这里有内容", "文字味很足"] },
  { exts: new Set(["js", "ts", "tsx", "jsx", "py", "mjs", "cjs", "json", "css", "html", "m", "swift"]), quotes: ["闻到代码味", "这里像有逻辑", "小心有 bug"] }
];

function randomItem(items = []) {
  return items[Math.floor(Math.random() * items.length)] || "";
}

function isSensitiveDesktopName(name = "") {
  return desktopSensitiveNamePatterns.some((pattern) => pattern.test(String(name || "")));
}

function quoteForDesktopIcon(icon = {}) {
  if (icon.isFolder) return randomItem(["里面藏着什么", "这个文件夹有点鼓", "像个小仓库"]);
  const ext = path.extname(icon.name || "").slice(1).toLowerCase();
  const rule = desktopFileQuoteRules.find((item) => item.exts.has(ext));
  return randomItem(rule?.quotes || ["这名字有意思", "我记住它了", "像是有用的东西"]);
}

function parseFinderDesktopIcons(raw = "") {
  return String(raw || "").split(/\r?\n/).map((line) => {
    const parts = line.split("\t");
    if (parts.length < 4) return null;
    const name = String(parts[0] || "").trim();
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    if (!name || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null;
    const kind = String(parts[3] || "").toLowerCase();
    return { name, x, y, isFolder: kind.includes("folder") };
  }).filter(Boolean);
}

async function readDesktopIcons() {
  if (process.platform !== "darwin") return [];
  const now = Date.now();
  if (now - desktopIconCache.at < PET_DESKTOP_CACHE_MS) return desktopIconCache.icons;

  const script = `
tell application "Finder"
  set out to ""
  try
    set itemList to items of desktop
    repeat with itm in itemList
      try
        set nm to name of itm
        set pos to position of itm
        set kindStr to class of itm as text
        set out to out & nm & tab & (item 1 of pos) & tab & (item 2 of pos) & tab & kindStr & linefeed
      end try
    end repeat
  end try
  return out
end tell
`;

  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", script], {
      timeout: 3000,
      maxBuffer: 512 * 1024
    });
    const icons = parseFinderDesktopIcons(stdout);
    desktopIconCache = { at: now, icons };
    return icons;
  } catch {
    desktopIconCache = { at: now, icons: [] };
    return [];
  }
}

function nearestDesktopIconAt(point = {}, icons = []) {
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const icon of icons) {
    const centerX = icon.x + 32;
    const centerY = icon.y + 32;
    const distance = Math.hypot(centerX - x, centerY - y);
    if (distance < bestDistance) {
      best = icon;
      bestDistance = distance;
    }
  }
  return best && bestDistance <= PET_SNIFF_RADIUS ? best : null;
}

async function sniffDesktopAt(point = {}) {
  const icons = await readDesktopIcons();
  const icon = nearestDesktopIconAt(point, icons);
  if (!icon) return { ok: true, found: false, quote: "这里没闻到文件" };
  if (isSensitiveDesktopName(icon.name)) {
    return { ok: true, found: true, sensitive: true, quote: "这个先保密" };
  }
  return {
    ok: true,
    found: true,
    sensitive: false,
    kind: icon.isFolder ? "folder" : "file",
    quote: quoteForDesktopIcon(icon)
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampPetBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.bounds || display.workArea;
  const width = clamp(Math.round(bounds.width || PET_SIZE), PET_SIZE, area.width);
  const height = clamp(Math.round(bounds.height || PET_SIZE), PET_SIZE, area.height);
  return {
    width,
    height,
    x: clamp(Math.round(bounds.x), area.x, area.x + area.width - width),
    y: clamp(Math.round(bounds.y), area.y, area.y + area.height - height)
  };
}

function normalizedPetLayout(payload = {}) {
  const open = Boolean(payload.open);
  const petW = clamp(Number(payload.petW || petLayoutState.petW || PET_SIZE), PET_SIZE, 180);
  const petH = clamp(Number(payload.petH || petLayoutState.petH || PET_SIZE), PET_SIZE, 220);
  const bubbleW = clamp(Number(payload.bubbleW || 0), 0, 420);
  const bubbleH = clamp(Number(payload.bubbleH || 0), 0, 140);
  const bubbleGap = clamp(Number(payload.bubbleGap || 6), 0, 24);
  const chatW = clamp(Number(payload.chatW || petChatSize.width || 350), 280, 720);
  const chatH = clamp(Number(payload.chatH || petChatSize.height || 450), 320, 900);
  return {
    open,
    petW,
    petH,
    bubbleW,
    bubbleH,
    bubbleGap,
    chatW,
    chatH,
    margin: clamp(Number(payload.margin || 8), 0, 32),
    gap: clamp(Number(payload.gap || 10), 0, 28),
    placement: String(payload.placement || "auto")
  };
}

function petBottomRightFromBounds(bounds = petWindow?.getBounds()) {
  const layout = petLayoutState || {};
  const margin = Number(layout.margin || 8);
  if (!bounds) return petAnchor;
  if (layout.open && layout.placement === "right") {
    return { x: bounds.x + margin + Number(layout.petW || PET_SIZE), y: bounds.y + bounds.height - margin };
  }
  return { x: bounds.x + bounds.width - margin, y: bounds.y + bounds.height - margin };
}

function choosePetPlacement(layout, anchor, workArea) {
  if (!layout.open) return "closed";
  if (layout.placement && layout.placement !== "auto") return layout.placement;
  const margin = layout.margin;
  const gap = layout.gap;
  const aboveH = layout.chatH + gap + layout.petH + margin * 2;
  const sideW = layout.chatW + gap + layout.petW + margin * 2;
  const sideH = Math.max(layout.chatH, layout.petH) + margin * 2;
  const enoughAbove = anchor.y - (aboveH - margin) >= workArea.y;
  const enoughLeft = anchor.x - (sideW - margin) >= workArea.x;
  const enoughRight = anchor.x - (margin + layout.petW) + sideW <= workArea.x + workArea.width;
  if (enoughAbove) return "above";
  if (enoughLeft) return "left";
  if (enoughRight) return "right";
  return "above";
}

function boundsForPetLayout(layout) {
  const current = petWindow && !petWindow.isDestroyed() ? petWindow.getBounds() : null;
  const anchor = petAnchor || petBottomRightFromBounds(current) || { x: 0, y: 0 };
  const display = screen.getDisplayNearestPoint(anchor);
  const workArea = display.bounds || display.workArea;
  const placement = choosePetPlacement(layout, anchor, workArea);
  const margin = layout.margin;
  const gap = layout.gap;
  const hasClosedBubble = !layout.open && layout.bubbleW > 0 && layout.bubbleH > 0;
  let width = Math.max(layout.petW, hasClosedBubble ? layout.bubbleW + 4 : 0) + margin * 2;
  let height = layout.petH + margin * 2 + (hasClosedBubble ? layout.bubbleH + layout.bubbleGap : 0);
  let petLocalRight = width - margin;
  let petLocalBottom = height - margin;

  if (layout.open && placement === "above") {
    width = Math.max(layout.chatW, layout.petW) + margin * 2;
    height = layout.chatH + gap + layout.petH + margin * 2;
    petLocalRight = width - margin;
    petLocalBottom = height - margin;
  } else if (layout.open && placement === "left") {
    width = layout.chatW + gap + layout.petW + margin * 2;
    height = Math.max(layout.chatH, layout.petH) + margin * 2;
    petLocalRight = width - margin;
    petLocalBottom = height - margin;
  } else if (layout.open && placement === "right") {
    width = layout.petW + gap + layout.chatW + margin * 2;
    height = Math.max(layout.chatH, layout.petH) + margin * 2;
    petLocalRight = margin + layout.petW;
    petLocalBottom = height - margin;
  }

  const unclamped = {
    width,
    height,
    x: anchor.x - petLocalRight,
    y: anchor.y - petLocalBottom
  };
  return {
    bounds: clampPetBounds(unclamped),
    placement
  };
}

function defaultPetBounds() {
  const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const workArea = cursorDisplay.workArea;
  const anchor = petAnchor || {
    x: workArea.x + workArea.width - PET_MARGIN,
    y: workArea.y + workArea.height - PET_MARGIN
  };
  return clampPetBounds({
    width: PET_SIZE,
    height: PET_SIZE,
    x: anchor.x - PET_SIZE,
    y: anchor.y - PET_SIZE
  });
}

function rememberPetAnchor() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  petAnchor = petBottomRightFromBounds(bounds);
  queueSavePetSettings();
}

function createPetWindow() {
  if (petWindow && !petWindow.isDestroyed()) return petWindow;

  const bounds = defaultPetBounds();

  petWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    roundedCorners: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // 需要关闭以让 preload CJS require electron
      preload: path.join(__dirname, "pet-preload.cjs")
    }
  });

  petWindow.setAlwaysOnTop(true, "floating");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  petWindow.loadURL(`${serverHandle.url}/pet.html`);
  petWindow.webContents.once("did-finish-load", () => {
    if (!petWindow || petWindow.isDestroyed()) return;
    petWindow.webContents.send("pet:quiet-mode", petQuietMode);
  });

  petWindow.on("closed", () => {
    petWindow = null;
    updateTrayMenu();
  });
  petWindow.on("move", rememberPetAnchor);
  petWindow.on("resize", rememberPetAnchor);

  return petWindow;
}

function setupPetIpc() {
  // 提供服务器 URL 给桌宠（同步 IPC）
  ipcMain.removeAllListeners("pet:get-server-url");
  ipcMain.on("pet:get-server-url", (event) => {
    event.returnValue = serverHandle?.url || "";
  });

  try { ipcMain.removeHandler("pet:sniff-at"); } catch {}
  ipcMain.handle("pet:sniff-at", async (_, point = {}) => sniffDesktopAt(point));

  ipcMain.removeAllListeners("pet:get-settings");
  ipcMain.on("pet:get-settings", (event) => {
    event.returnValue = {
      quietMode: petQuietMode,
      chatSize: petChatSize,
      anchor: petAnchor
    };
  });

  ipcMain.removeAllListeners("pet:save-chat-size");
  ipcMain.on("pet:save-chat-size", (_, size = {}) => {
    if (Number.isFinite(Number(size.width)) && Number.isFinite(Number(size.height))) {
      petChatSize = {
        width: clamp(Number(size.width), 280, 720),
        height: clamp(Number(size.height), 320, 900)
      };
      petLayoutState.chatW = petChatSize.width;
      petLayoutState.chatH = petChatSize.height;
      queueSavePetSettings();
    }
  });

  // 调整窗口大小（展开/收起聊天框）
  ipcMain.removeAllListeners("pet:set-size");
  ipcMain.on("pet:set-size", (event, { w, h }) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const current = petWindow.getBounds();
    const anchor = { x: current.x + current.width, y: current.y + current.height };
    const next = clampPetBounds({
      width: Number(w) || PET_SIZE,
      height: Number(h) || PET_SIZE,
      x: anchor.x - (Number(w) || PET_SIZE),
      y: anchor.y - (Number(h) || PET_SIZE)
    });
    petWindow.setBounds(next);
    rememberPetAnchor();
  });

  ipcMain.removeAllListeners("pet:set-layout");
  ipcMain.on("pet:set-layout", (_, payload = {}) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    petAnchor = petBottomRightFromBounds(petWindow.getBounds()) || petAnchor;
    const layout = normalizedPetLayout(payload);
    if (layout.open && payload.saveChatSize !== false) {
      petChatSize = { width: layout.chatW, height: layout.chatH };
    }
    const { bounds, placement } = boundsForPetLayout(layout);
    petLayoutState = { ...layout, placement };
    petWindow.setBounds(bounds);
    petWindow.webContents.send("pet:layout", {
      placement,
      bounds,
      chatSize: { width: layout.chatW, height: layout.chatH }
    });
    rememberPetAnchor();
  });

  // 右键菜单
  ipcMain.removeAllListeners("pet:context-menu");
  ipcMain.on("pet:context-menu", (event) => {
    const menu = Menu.buildFromTemplate([
      {
        label: "打开主窗口",
        click: () => showMainWindow()
      },
      {
        label: "安静模式",
        type: "checkbox",
        checked: petQuietMode,
        click: (item) => {
          petQuietMode = item.checked;
          queueSavePetSettings();
          if (petWindow && !petWindow.isDestroyed()) {
            petWindow.webContents.send("pet:quiet-mode", petQuietMode);
          }
        }
      },
      { type: "separator" },
      {
        label: "隐藏桌宠",
        click: () => {
          if (petWindow && !petWindow.isDestroyed()) petWindow.hide();
          updateTrayMenu();
        }
      },
      {
        label: "退出 neo",
        click: () => { isQuitting = true; app.quit(); }
      }
    ]);
    menu.popup({ window: petWindow });
  });

  // 打开主窗口
  ipcMain.removeAllListeners("pet:open-main");
  ipcMain.on("pet:open-main", () => showMainWindow());

  // 隐藏桌宠
  ipcMain.removeAllListeners("pet:hide");
  ipcMain.on("pet:hide", () => {
    if (petWindow && !petWindow.isDestroyed()) petWindow.hide();
    updateTrayMenu();
  });

  // JS 拖动：增量移动窗口
  ipcMain.removeAllListeners("pet:move-by");
  ipcMain.on("pet:move-by", (_, { dx, dy }) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const b = petWindow.getBounds();
    const next = clampPetBounds({ ...b, x: b.x + Math.round(dx), y: b.y + Math.round(dy) });
    petWindow.setPosition(next.x, next.y);
    rememberPetAnchor();
  });
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
  prepareForQuit();
});

app.on("before-quit-for-update", () => {
  prepareForQuit();
});
