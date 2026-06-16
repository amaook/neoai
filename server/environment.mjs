// server/environment.mjs — 环境检测与安装脚本生成
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { ctx, rootDir } from "./context.mjs";
import { runCommand, detectPythonRuntime, pythonPackageInfo, pythonPipCommand, tableCleanerPackages, trimOutput } from "./tools.mjs";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);

let _envCache = null;
let _envCacheAt = 0;
const ENV_CACHE_TTL = 30_000;

export function invalidateEnvCache() { _envCache = null; _envCacheAt = 0; }

export async function detectEnvironment() {
  const now = Date.now();
  if (_envCache && now - _envCacheAt < ENV_CACHE_TTL) return _envCache;
  const result = process.platform === "win32" ? await detectWindowsEnvironment() : await detectUnixEnvironment();
  _envCache = result;
  _envCacheAt = now;
  return result;
}

// ── 共用工具 ─────────────────────────────────────────────────────────────────

// 安装器把新路径写进注册表/磁盘后，neo 进程继承的还是启动时的旧 PATH，
// 不刷新的话刚装好的 Node/Git 检测不到、智能体工具也用不了，必须重启应用。
// 这里在每轮检测前把进程 PATH 和系统最新值合并（顺带让轮询能看到安装结果）。
async function refreshWindowsProcessPath() {
  const fresh = await new Promise((resolve) => {
    execFile("powershell.exe", [
      "-NoProfile", "-Command",
      '[Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")'
    ], { timeout: 8000 }, (error, stdout) => resolve(error ? "" : String(stdout || "").trim()));
  });
  if (!fresh) return;
  const windowsApps = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Microsoft", "WindowsApps") : "";
  const merged = [];
  const seen = new Set();
  for (const entry of [...fresh.split(";"), windowsApps, ...(process.env.PATH || "").split(";")]) {
    const trimmed = String(entry || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }
  process.env.PATH = merged.join(";");
}

// macOS：从 GUI 启动的 Electron 进程往往没有 brew 的 PATH，刚装的工具会检测不到
function ensureUnixBrewPath() {
  const brewDirs = ["/opt/homebrew/bin", "/usr/local/bin"].filter((dir) => existsSync(dir));
  if (!brewDirs.length) return;
  const entries = (process.env.PATH || "").split(":").filter(Boolean);
  const missing = brewDirs.filter((dir) => !entries.includes(dir));
  if (missing.length) process.env.PATH = [...missing, ...entries].join(":");
}

async function commandInfo(command, versionCommand = `${command} --version`) {
  const pathCmd = process.platform === "win32" ? `where ${command}` : `command -v '${command}'`;
  const pathResult = await runCommand(pathCmd, 5000);
  if (!pathResult.ok || !pathResult.stdout.trim()) return { found: false, path: "", version: "" };
  const versionResult = await runCommand(versionCommand, 5000);
  return { found: true, path: pathResult.stdout.trim().split("\n")[0], version: versionResult.ok ? versionResult.stdout.trim().split("\n")[0] : "" };
}

function nodeMajor(version) {
  const match = String(version || "").match(/v?(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function packageInfo(packageName) {
  const packagePath = path.join(rootDir, "node_modules", packageName, "package.json");
  if (!existsSync(packagePath)) return { found: false, version: "" };
  try {
    const { readFile } = await import("node:fs/promises");
    const data = JSON.parse(await readFile(packagePath, "utf8"));
    return { found: true, version: data.version || "" };
  } catch { return { found: true, version: "" }; }
}

function statusItem({ id, label, found, version, path: itemPath, required = false, recommended = true, description, installable = true, installCommand }) {
  return { id, label, status: found ? "ok" : required ? "missing" : "recommended", required, recommended, version: version || "", path: itemPath || "", description, installable: !found && installable, installCommand: !found && installable ? installCommand : "" };
}

function environmentResult(items) {
  const missingRequired = items.filter((i) => i.required && i.status !== "ok");
  const recommendedMissing = items.filter((i) => !i.required && i.status !== "ok");
  return { ok: missingRequired.length === 0, desktopMode: ctx.desktopMode, platform: process.platform, workspace: ctx.workspaceRoot, checkedAt: new Date().toISOString(), summary: { missingRequired: missingRequired.length, recommendedMissing: recommendedMissing.length, total: items.length }, items };
}

// ── macOS/Linux ───────────────────────────────────────────────────────────────

async function detectUnixEnvironment() {
  ensureUnixBrewPath();
  const [zsh, curl, brew, node, npm, git, rg] = await Promise.all([
    commandInfo("zsh", "zsh --version"),
    commandInfo("curl", "curl --version | head -1"),
    commandInfo("brew", "brew --version | head -1"),
    commandInfo("node", "node -v"),
    commandInfo("npm", "npm -v"),
    commandInfo("git", "git --version"),
    commandInfo("rg", "rg --version | head -1")
  ]);
  const python = await detectPythonRuntime();
  const pythonPackages = python.found ? await Promise.all(tableCleanerPackages.map((p) => pythonPackageInfo(python, p))) : tableCleanerPackages.map(() => ({ found: false, version: "" }));
  const pythonInstallCommand = "brew install python";

  const items = [
    statusItem({ id: "zsh", label: "Shell 环境", found: zsh.found, version: zsh.version, path: zsh.path, required: true, description: "用于运行本地命令和智能体工具。", installable: false }),
    statusItem({ id: "curl", label: "curl 网络工具", found: curl.found, version: curl.version, path: curl.path, required: true, description: "用于下载安装脚本和检查网络能力。", installCommand: "brew install curl" }),
    statusItem({ id: "homebrew", label: "Homebrew", found: brew.found, version: brew.version, path: brew.path, required: false, description: "macOS 上补充 Node、Git、ripgrep 等环境的推荐安装器。", installCommand: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"' }),
    { ...statusItem({ id: "node", label: "Node.js 18+", found: node.found && nodeMajor(node.version) >= 18, version: node.version, path: node.path, required: !ctx.desktopMode, description: ctx.desktopMode ? "桌面版已内置运行时；源码开发和二次打包需要 Node.js。" : "源码运行、安装依赖和桌面打包需要 Node.js。", installCommand: "brew install node" }), status: node.found && nodeMajor(node.version) < 18 ? "outdated" : node.found ? "ok" : !ctx.desktopMode ? "missing" : "recommended", installable: !node.found || nodeMajor(node.version) < 18, installCommand: !node.found || nodeMajor(node.version) < 18 ? "brew install node" : "" },
    statusItem({ id: "npm", label: "npm", found: npm.found, version: npm.version, path: npm.path, required: !ctx.desktopMode, description: "用于安装桌面打包依赖。", installCommand: "brew install node" }),
    statusItem({ id: "git", label: "Git", found: git.found, version: git.version, path: git.path, required: false, description: "用于项目版本管理、拉取代码和协作。", installCommand: "brew install git" }),
    statusItem({ id: "ripgrep", label: "ripgrep", found: rg.found, version: rg.version, path: rg.path, required: false, description: "用于快速搜索文件内容，智能体工具会优先使用它。", installCommand: "brew install ripgrep" }),
    statusItem({ id: "python", label: "Python 3", found: python.found, version: python.version, path: python.path, required: false, description: "用于运行表格清洗工具。", installCommand: pythonInstallCommand }),
    statusItem({ id: "python-openpyxl", label: "Python 表格库 openpyxl", found: pythonPackages[0].found, version: pythonPackages[0].version, path: python.found ? python.command : "", required: false, description: "用于读取和写入 .xlsx 表格。", installCommand: `${python.found ? "" : `${pythonInstallCommand}\n`}${pythonPipCommand(python, tableCleanerPackages)}` }),
    statusItem({ id: "python-charset", label: "CSV 编码识别库", found: pythonPackages[1].found, version: pythonPackages[1].version, path: python.found ? python.command : "", required: false, description: "用于自动识别 CSV 中文编码。", installCommand: `${python.found ? "" : `${pythonInstallCommand}\n`}${pythonPipCommand(python, tableCleanerPackages)}` })
  ];

  if (!ctx.desktopMode) {
    const [electron, builder] = await Promise.all([packageInfo("electron"), packageInfo("electron-builder")]);
    const depsFound = electron.found && builder.found;
    items.push({ id: "desktop-deps", label: "桌面打包依赖", status: depsFound ? "ok" : "recommended", required: false, recommended: true, version: depsFound ? `Electron ${electron.version}, Builder ${builder.version}` : "", path: path.join(rootDir, "node_modules"), description: "用于启动和封装 neo 桌面端。", installable: !depsFound, installCommand: !depsFound ? `cd '${rootDir}' && npm install` : "" });
  }

  return environmentResult(items);
}

// ── Windows ────────────────────────────────────────────────────────────────

async function detectWindowsEnvironment() {
  await refreshWindowsProcessPath();
  const [powershell, winget, curl, node, npm, git, rg] = await Promise.all([
    commandInfo("powershell", 'powershell -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"'),
    commandInfo("winget", "winget --version"),
    commandInfo("curl", "curl --version"),
    commandInfo("node", "node -v"),
    commandInfo("npm", "npm -v"),
    commandInfo("git", "git --version"),
    commandInfo("rg", "rg --version")
  ]);
  const python = await detectPythonRuntime();
  const pythonPackages = python.found ? await Promise.all(tableCleanerPackages.map((p) => pythonPackageInfo(python, p))) : tableCleanerPackages.map(() => ({ found: false, version: "" }));
  const ws = "--accept-package-agreements --accept-source-agreements";
  const pythonInstallCommand = `winget install --id Python.Python.3.12 -e --source winget ${ws}`;

  const items = [
    statusItem({ id: "powershell", label: "PowerShell", found: powershell.found, version: powershell.version, path: powershell.path, required: true, description: "用于打开 Windows 环境安装窗口。", installable: false }),
    statusItem({ id: "winget", label: "winget 安装器", found: winget.found, version: winget.version, path: winget.path, required: false, description: "Windows 上补充 Node、Git、ripgrep 等环境的推荐安装器。", installCommand: "自动注册/修复 Microsoft App Installer 和 winget" }),
    statusItem({ id: "curl", label: "curl 网络工具", found: curl.found, version: curl.version, path: curl.path, required: true, description: "用于下载安装脚本和检查网络能力。", installCommand: `winget install --id cURL.cURL -e --source winget ${ws}` }),
    { ...statusItem({ id: "node", label: "Node.js 18+", found: node.found && nodeMajor(node.version) >= 18, version: node.version, path: node.path, required: !ctx.desktopMode, description: ctx.desktopMode ? "桌面版已内置运行时；源码开发和二次打包需要 Node.js。" : "源码运行、安装依赖和桌面打包需要 Node.js。", installCommand: `winget install --id OpenJS.NodeJS.LTS -e --source winget ${ws}` }), status: node.found && nodeMajor(node.version) < 18 ? "outdated" : node.found ? "ok" : !ctx.desktopMode ? "missing" : "recommended", installable: !node.found || nodeMajor(node.version) < 18, installCommand: !node.found || nodeMajor(node.version) < 18 ? `winget install --id OpenJS.NodeJS.LTS -e --source winget ${ws}` : "" },
    statusItem({ id: "npm", label: "npm", found: npm.found, version: npm.version, path: npm.path, required: !ctx.desktopMode, description: "用于安装桌面打包依赖。", installCommand: `winget install --id OpenJS.NodeJS.LTS -e --source winget ${ws}` }),
    statusItem({ id: "git", label: "Git", found: git.found, version: git.version, path: git.path, required: false, description: "用于项目版本管理、拉取代码和协作。", installCommand: `winget install --id Git.Git -e --source winget ${ws}` }),
    statusItem({ id: "ripgrep", label: "ripgrep", found: rg.found, version: rg.version, path: rg.path, required: false, description: "用于快速搜索文件内容，智能体工具会优先使用它。", installCommand: `winget install --id BurntSushi.ripgrep.MSVC -e --source winget ${ws}` }),
    statusItem({ id: "python", label: "Python 3", found: python.found, version: python.version, path: python.path, required: false, description: "用于运行表格清洗工具。", installCommand: pythonInstallCommand }),
    statusItem({ id: "python-openpyxl", label: "Python 表格库 openpyxl", found: pythonPackages[0].found, version: pythonPackages[0].version, path: python.found ? python.command : "", required: false, description: "用于读取和写入 .xlsx 表格。", installCommand: `${python.found ? "" : `${pythonInstallCommand}\nRefresh-EnvPath\n`}${pythonPipCommand(python, tableCleanerPackages)}` }),
    statusItem({ id: "python-charset", label: "CSV 编码识别库", found: pythonPackages[1].found, version: pythonPackages[1].version, path: python.found ? python.command : "", required: false, description: "用于自动识别 CSV 中文编码。", installCommand: `${python.found ? "" : `${pythonInstallCommand}\nRefresh-EnvPath\n`}${pythonPipCommand(python, tableCleanerPackages)}` })
  ];

  if (!ctx.desktopMode) {
    const [electron, builder] = await Promise.all([packageInfo("electron"), packageInfo("electron-builder")]);
    const depsFound = electron.found && builder.found;
    items.push({ id: "desktop-deps", label: "桌面打包依赖", status: depsFound ? "ok" : "recommended", required: false, recommended: true, version: depsFound ? `Electron ${electron.version}, Builder ${builder.version}` : "", path: path.join(rootDir, "node_modules"), description: "用于启动和封装 neo 桌面端。", installable: !depsFound, installCommand: !depsFound ? `cd /d "${rootDir}" && npm install` : "" });
  }

  return environmentResult(items);
}

// ── 安装脚本 ─────────────────────────────────────────────────────────────────

function installCandidates(env, includeRecommended = true) {
  return env.items.filter((i) => { if (!i.installable || !i.installCommand) return false; return i.required || includeRecommended; });
}

function uniqueInstallCommands(candidates, skipIds = []) {
  const seen = new Set();
  const skip = new Set(skipIds);
  return candidates.filter((item) => { if (skip.has(item.id) || seen.has(item.installCommand)) return false; seen.add(item.installCommand); return true; });
}

// ── 国内镜像加速（大陆网络下 GitHub/PyPI/npm 源经常拉不动） ───────────────────
const PIP_MIRROR_INDEX = "https://pypi.tuna.tsinghua.edu.cn/simple";
const NPM_MIRROR_REGISTRY = "https://registry.npmmirror.com";

function unixBrewMirrorExports() {
  return [
    'export HOMEBREW_INSTALL_FROM_API=1',
    'export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"',
    'export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"',
    'export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"',
    'export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git"'
  ];
}

function homebrewBootstrapCommand(useMirror = false) {
  if (!useMirror) return '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
  // TUNA 镜像官方推荐方式：从镜像 clone 安装脚本后执行
  return [
    'neo_brew_install_dir="$(mktemp -d)/brew-install"',
    'git clone --depth=1 https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.git "$neo_brew_install_dir"',
    '/bin/bash "$neo_brew_install_dir/install.sh"',
    'rm -rf "$neo_brew_install_dir"'
  ].join("\n");
}

/** 给 pip / npm 安装行追加镜像源参数（不改动 brew/winget 行） */
function applyMirrorToCommand(command) {
  return String(command).split("\n").map((line) => {
    if (line.includes("-m pip install") && !line.includes(PIP_MIRROR_INDEX)) {
      return line.split("||").map((part) => part.includes("-m pip install") ? `${part.trim()} -i ${PIP_MIRROR_INDEX}` : part.trim()).join(" || ");
    }
    if (/\bnpm install\b/.test(line) && !line.includes("--registry")) {
      return `${line} --registry=${NPM_MIRROR_REGISTRY}`;
    }
    return line;
  }).join("\n");
}

/** 去掉跨条目重复的 brew/winget 安装行（如 python 与 openpyxl 都带 brew install python） */
function dedupeInstallLines(command, seenLines) {
  const kept = String(command).split("\n").filter((line) => {
    const normalized = line.trim();
    if (!/^(brew|winget) install /.test(normalized)) return true;
    if (seenLines.has(normalized)) return false;
    seenLines.add(normalized);
    return true;
  });
  const result = kept.join("\n").trim();
  return result;
}

function homebrewShellEnvCommand() {
  return ['if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; fi', 'if [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi'].join("\n");
}

function buildUnixInstallMissingScript(env, includeRecommended = true, useMirror = false) {
  const candidates = installCandidates(env, includeRecommended);
  if (!candidates.length) return "";
  const uniqueCommands = uniqueInstallCommands(candidates, ["homebrew"]);
  const needsHomebrew = candidates.some((i) => i.id === "homebrew" || /\bbrew\s+/.test(i.installCommand));
  const brewInstalled = env.items.find((i) => i.id === "homebrew")?.status === "ok";
  // 不再 set -e：单项失败继续装后面的，最后统一汇总
  const lines = ["neo_failed=''", 'echo "[neo] 开始补齐运行环境..."', 'echo ""'];
  if (useMirror && needsHomebrew) lines.push(...unixBrewMirrorExports());
  if (needsHomebrew && !brewInstalled) {
    lines.push(
      'echo "[neo] 安装 Homebrew..."',
      homebrewBootstrapCommand(useMirror),
      homebrewShellEnvCommand(),
      'command -v brew >/dev/null 2>&1 || { echo "[neo] Homebrew 安装失败，后续依赖它的项无法继续。"; neo_failed="$neo_failed Homebrew"; }',
      'echo ""'
    );
  } else if (needsHomebrew) {
    lines.push(homebrewShellEnvCommand());
  }
  const seenInstallLines = new Set();
  for (const item of uniqueCommands) {
    let command = useMirror ? applyMirrorToCommand(item.installCommand) : item.installCommand;
    command = dedupeInstallLines(command, seenInstallLines);
    if (!command) continue;
    lines.push(
      `echo "[neo] 安装/更新 ${item.label}..."`,
      `if (\n${command}\n); then echo "[neo] ✓ ${item.label} 完成"; else neo_failed="$neo_failed ${item.label}"; echo "[neo] ✗ ${item.label} 安装失败，继续后续项"; fi`,
      'echo ""'
    );
  }
  lines.push(
    'if [ -z "$neo_failed" ]; then echo "[neo] 环境补齐完成，neo 会自动刷新检测结果。"; else echo "[neo] 以下环境项安装失败：$neo_failed"; echo "[neo] 可以把上方报错复制给 neo，让它帮你处理。"; fi',
    'printf "按任意键关闭此窗口..."',
    "read -k 1 2>/dev/null || read -n 1"
  );
  return lines.join("\n");
}

function windowsWingetBootstrapLines() {
  return [
    '$windowsApps = Join-Path $env:LOCALAPPDATA "Microsoft\\WindowsApps"',
    'if ($env:PATH -notlike "*$windowsApps*") { $env:PATH = "$windowsApps;$env:PATH" }',
    // 老系统 PowerShell 5 默认 TLS 配置可能下载不了 https
    "try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 } catch {}",
    "",
    "function Refresh-WinGetPath {",
    '  $paths = @($windowsApps, "$env:ProgramFiles\\WindowsApps")',
    "  foreach ($candidate in $paths) {",
    '    if ($candidate -and (Test-Path $candidate) -and $env:PATH -notlike "*$candidate*") {',
    '      $env:PATH = "$candidate;$env:PATH"',
    "    }",
    "  }",
    "}",
    "",
    "function Refresh-EnvPath {",
    '  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")',
    '  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")',
    '  $env:PATH = @($machinePath, $userPath, $windowsApps, $env:PATH) -join ";"',
    "  Refresh-WinGetPath",
    "}",
    "",
    "function Install-WinGetPackageFile {",
    // 直接下载官方 msixbundle 静默安装；缺 VCLibs 依赖时补装后重试
    '  $wingetTmp = Join-Path $env:TEMP "neo-winget"',
    "  New-Item -ItemType Directory -Force -Path $wingetTmp | Out-Null",
    '  $bundle = Join-Path $wingetTmp "winget.msixbundle"',
    '  Write-Host "[neo] 正在下载 winget 安装包（视网络可能需要几分钟）..."',
    '  Invoke-WebRequest -Uri "https://aka.ms/getwinget" -OutFile $bundle -UseBasicParsing',
    "  try {",
    "    Add-AppxPackage -Path $bundle -ErrorAction Stop",
    "  } catch {",
    '    Write-Host "[neo] 直接安装未成功，补充 VCLibs 运行库后重试..."',
    '    $vclibs = Join-Path $wingetTmp "vclibs.appx"',
    '    Invoke-WebRequest -Uri "https://aka.ms/Microsoft.VCLibs.x64.14.00.Desktop.appx" -OutFile $vclibs -UseBasicParsing',
    "    Add-AppxPackage -Path $vclibs -ErrorAction SilentlyContinue",
    "    Add-AppxPackage -Path $bundle -ErrorAction Stop",
    "  }",
    "}",
    "",
    "function Ensure-WinGet {",
    "  Refresh-WinGetPath",
    "  if (Get-Command winget -ErrorAction SilentlyContinue) {",
    '    Write-Host "[neo] winget 已可用。"',
    "    return",
    "  }",
    "",
    '  Write-Host "[neo] 正在注册 Microsoft App Installer / winget..."',
    "  try {",
    "    Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe -ErrorAction Stop",
    "  } catch {",
    '    Write-Host "[neo] 注册现有 App Installer 未完成，尝试自动下载安装..."',
    "  }",
    "  Refresh-WinGetPath",
    "  if (Get-Command winget -ErrorAction SilentlyContinue) { Write-Host '[neo] winget 注册完成。'; return }",
    "",
    "  try {",
    "    Install-WinGetPackageFile",
    "  } catch {",
    '    Write-Host "[neo] 自动安装 winget 未成功：$($_.Exception.Message)"',
    "  }",
    "  Refresh-WinGetPath",
    "  if (Get-Command winget -ErrorAction SilentlyContinue) { Write-Host '[neo] winget 安装完成。'; return }",
    "",
    '  Write-Host "[neo] 仍未检测到 winget，将打开 Microsoft App Installer 官方下载页。"',
    '  Start-Process "https://aka.ms/getwinget"',
    '  throw "winget 未可用。请完成 Microsoft App Installer 安装后，回到 neo 重新点击一键补齐环境。"',
    "}",
    "",
    "Ensure-WinGet",
    "winget source update --disable-interactivity"
  ];
}

export function buildWindowsInstallScript(items, useMirror = false) {
  const lines = ['$ErrorActionPreference = "Stop"', "$neoFailed = @()", 'Write-Host "[neo] 开始补齐运行环境..."', 'Write-Host ""', ...windowsWingetBootstrapLines(), 'Write-Host ""'];
  const seenInstallLines = new Set();
  for (const item of items) {
    if (item.id === "winget") continue;
    let command = useMirror ? applyMirrorToCommand(item.installCommand) : item.installCommand;
    command = dedupeInstallLines(command, seenInstallLines);
    if (!command) continue;
    // 单项失败计入汇总并继续后续项
    lines.push(
      `Write-Host "[neo] 安装/更新 ${item.label}..."`,
      "try {",
      command,
      `  Write-Host "[neo] √ ${item.label} 完成"`,
      "} catch {",
      `  $neoFailed += ${powerShellQuote(item.label)}`,
      `  Write-Host "[neo] × ${item.label} 安装失败：$($_.Exception.Message)，继续后续项"`,
      "}",
      "Refresh-EnvPath",
      'Write-Host ""'
    );
  }
  lines.push(
    "if ($neoFailed.Count -eq 0) {",
    '  Write-Host "[neo] 环境补齐完成，neo 会自动刷新检测结果。"',
    "} else {",
    '  Write-Host "[neo] 以下环境项安装失败：$($neoFailed -join \'、\')"',
    '  Write-Host "[neo] 可以把上方报错复制给 neo，让它帮你处理。"',
    "}",
    'Read-Host "按回车关闭"'
  );
  return lines.join("\n");
}

export function buildInstallMissingScript(env, includeRecommended = true, useMirror = false) {
  if (process.platform === "win32") {
    const candidates = installCandidates(env, includeRecommended);
    if (!candidates.length) return "";
    return buildWindowsInstallScript(uniqueInstallCommands(candidates), useMirror);
  }
  return buildUnixInstallMissingScript(env, includeRecommended, useMirror);
}

export function buildSingleInstallScript(env, item, useMirror = false) {
  if (process.platform === "win32") return buildWindowsInstallScript([item], useMirror);
  if (item.id === "homebrew") {
    const lines = useMirror ? [...unixBrewMirrorExports(), homebrewBootstrapCommand(true)] : [homebrewBootstrapCommand(false)];
    return lines.join("\n");
  }
  let command = useMirror ? applyMirrorToCommand(item.installCommand) : item.installCommand;
  // brew 安装的单项在镜像模式下也走 bottle 镜像
  if (useMirror && /\bbrew\s+/.test(command)) {
    command = [...unixBrewMirrorExports(), homebrewShellEnvCommand(), command].join("\n");
  }
  return command;
}

// ── 终端打开 ─────────────────────────────────────────────────────────────────

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function powerShellQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function writeTempInstallScript(command) {
  const fileName = `neo-ai-install-${process.pid}-${Date.now()}.ps1`;
  const candidates = [
    ctx.appStatePath ? path.join(path.dirname(ctx.appStatePath), "tmp") : "",
    path.join(os.tmpdir(), "neo-ai")
  ].filter(Boolean);
  let lastError = null;
  for (const dir of candidates) {
    try {
      await mkdir(dir, { recursive: true });
      const scriptPath = path.join(dir, fileName);
      // 必须带 UTF-8 BOM：Windows PowerShell 5.1 读无 BOM 的 .ps1 会按
      // 系统 ANSI（中文系统 GBK）解码，中文字符串变乱码并直接破坏语法。
      await writeFile(scriptPath, "\uFEFF" + command, "utf8");
      return scriptPath;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("无法写入临时安装脚本");
}

export async function openTerminalCommand(command) {
  if (process.platform === "win32") {
    const scriptPath = await writeTempInstallScript(command);
    // 先尝试管理员窗口（一次 UAC 装完所有项）；用户在 UAC 点“否”时
    // 自动降级为普通窗口，需要提权的包由 winget 逐个弹 UAC，不再整体失败。
    const launchCommand = [
      `$arguments = @('-NoExit','-ExecutionPolicy','Bypass','-File',${powerShellQuote(scriptPath)})`,
      "try {",
      "  Start-Process -FilePath powershell.exe -ArgumentList $arguments -Verb RunAs -ErrorAction Stop",
      "} catch {",
      "  Start-Process -FilePath powershell.exe -ArgumentList $arguments",
      "}"
    ].join("\n");
    return new Promise((resolve) => {
      execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", launchCommand], { timeout: 10000 }, (error, stdout, stderr) => { resolve({ ok: !error, stdout: trimOutput(stdout), stderr: trimOutput(stderr), message: error?.message || "已打开 PowerShell 安装窗口。若弹出系统权限提示，选“是”可一次装完；选“否”也会继续，由安装器按需提权。", command }); });
    });
  }

  if (process.platform !== "darwin") return { ok: false, message: "当前自动安装支持 macOS 和 Windows；这个系统请复制命令手动执行。", command };

  const wrapped = `${command}; echo ""; echo "[neo] 安装流程结束后，请回到 neo 点击重新检测。";`;
  return new Promise((resolve) => {
    execFile("osascript", ["-e", 'tell application "Terminal" to activate', "-e", `tell application "Terminal" to do script "${escapeAppleScriptString(wrapped)}"`], { timeout: 10000 }, (error, stdout, stderr) => { resolve({ ok: !error, stdout: trimOutput(stdout), stderr: trimOutput(stderr), message: error?.message || "已打开终端安装窗口", command }); });
  });
}
