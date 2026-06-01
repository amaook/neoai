// server/environment.mjs — 环境检测与安装脚本生成
import { writeFile } from "node:fs/promises";
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

function homebrewShellEnvCommand() {
  return ['if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; fi', 'if [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi'].join("\n");
}

function buildUnixInstallMissingScript(env, includeRecommended = true) {
  const candidates = installCandidates(env, includeRecommended);
  if (!candidates.length) return "";
  const uniqueCommands = uniqueInstallCommands(candidates, ["homebrew"]);
  const needsHomebrew = candidates.some((i) => i.id === "homebrew" || /\bbrew\s+/.test(i.installCommand));
  const brewInstalled = env.items.find((i) => i.id === "homebrew")?.status === "ok";
  const lines = ["set -e", 'echo "[neo] 开始补齐运行环境..."', 'echo ""'];
  if (needsHomebrew && !brewInstalled) { lines.push('echo "[neo] 安装 Homebrew..."', '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', homebrewShellEnvCommand(), 'echo ""'); }
  else if (needsHomebrew) { lines.push(homebrewShellEnvCommand()); }
  for (const item of uniqueCommands) { lines.push(`echo "[neo] 安装/更新 ${item.label}..."`, item.installCommand, 'echo ""'); }
  lines.push('echo "[neo] 环境补齐完成。"', 'echo "[neo] 请回到 neo 点击重新检测。"', 'printf "按任意键关闭此窗口..."', "read -k 1");
  return lines.join("\n");
}

function windowsWingetBootstrapLines() {
  return ['$windowsApps = Join-Path $env:LOCALAPPDATA "Microsoft\\WindowsApps"', 'if ($env:PATH -notlike "*$windowsApps*") { $env:PATH = "$windowsApps;$env:PATH" }', "", "function Refresh-WinGetPath {", '  $paths = @($windowsApps, "$env:ProgramFiles\\WindowsApps")', "  foreach ($candidate in $paths) {", '    if ($candidate -and (Test-Path $candidate) -and $env:PATH -notlike "*$candidate*") {', '      $env:PATH = "$candidate;$env:PATH"', "    }", "  }", "}", "", "function Refresh-EnvPath {", '  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")', '  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")', '  $env:PATH = @($machinePath, $userPath, $windowsApps, $env:PATH) -join ";"', "  Refresh-WinGetPath", "}", "", "function Ensure-WinGet {", "  Refresh-WinGetPath", "  if (Get-Command winget -ErrorAction SilentlyContinue) {", '    Write-Host "[neo] winget 已可用。"', "    return", "  }", "", '  Write-Host "[neo] 正在注册 Microsoft App Installer / winget..."', "  try {", "    Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe -ErrorAction Stop", "  } catch {", '    Write-Host "[neo] 注册现有 App Installer 未完成，继续尝试修复安装..."', '    Write-Host $_.Exception.Message', "  }", "  Refresh-WinGetPath", "  if (Get-Command winget -ErrorAction SilentlyContinue) { Write-Host '[neo] winget 注册完成。'; return }", '  Write-Host "[neo] 仍未检测到 winget，将打开 Microsoft App Installer 官方下载页。"', '  Start-Process "https://aka.ms/getwinget"', '  throw "winget 未可用。请完成 Microsoft App Installer 安装后，回到 neo 重新点击一键补齐环境。"', "}", "", "Ensure-WinGet", "winget source update --disable-interactivity"];
}

function buildWindowsInstallScript(items) {
  const lines = ['$ErrorActionPreference = "Stop"', 'Write-Host "[neo] 开始补齐运行环境..."', 'Write-Host ""', ...windowsWingetBootstrapLines(), 'Write-Host ""'];
  for (const item of items) {
    if (item.id === "winget") continue;
    lines.push(`Write-Host "[neo] 安装/更新 ${item.label}..."`, item.installCommand, "Refresh-EnvPath", 'Write-Host ""');
  }
  lines.push('Write-Host "[neo] 环境补齐完成。"', 'Write-Host "[neo] 请回到 neo 点击重新检测。"', 'Read-Host "按回车关闭"');
  return lines.join("\n");
}

export function buildInstallMissingScript(env, includeRecommended = true) {
  if (process.platform === "win32") {
    const candidates = installCandidates(env, includeRecommended);
    if (!candidates.length) return "";
    return buildWindowsInstallScript(uniqueInstallCommands(candidates));
  }
  return buildUnixInstallMissingScript(env, includeRecommended);
}

export function buildSingleInstallScript(env, item) {
  return process.platform === "win32" ? buildWindowsInstallScript([item]) : item.installCommand;
}

// ── 终端打开 ─────────────────────────────────────────────────────────────────

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function powerShellQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function openTerminalCommand(command) {
  if (process.platform === "win32") {
    const scriptPath = path.join(os.tmpdir(), `neo-ai-install-${Date.now()}.ps1`);
    await writeFile(scriptPath, command, "utf8");
    const launchCommand = [`$arguments = @('-NoExit','-ExecutionPolicy','Bypass','-File',${powerShellQuote(scriptPath)})`, "Start-Process", "-FilePath powershell.exe", "-ArgumentList $arguments", "-Verb RunAs"].join(" ");
    return new Promise((resolve) => {
      execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", launchCommand], { timeout: 10000 }, (error, stdout, stderr) => { resolve({ ok: !error, stdout: trimOutput(stdout), stderr: trimOutput(stderr), message: error?.message || "已打开 PowerShell 安装窗口", command }); });
    });
  }

  if (process.platform !== "darwin") return { ok: false, message: "当前自动安装支持 macOS 和 Windows；这个系统请复制命令手动执行。", command };

  const wrapped = `${command}; echo ""; echo "[neo] 安装流程结束后，请回到 neo 点击重新检测。";`;
  return new Promise((resolve) => {
    execFile("osascript", ["-e", 'tell application "Terminal" to activate', "-e", `tell application "Terminal" to do script "${escapeAppleScriptString(wrapped)}"`], { timeout: 10000 }, (error, stdout, stderr) => { resolve({ ok: !error, stdout: trimOutput(stdout), stderr: trimOutput(stderr), message: error?.message || "已打开终端安装窗口", command }); });
  });
}
