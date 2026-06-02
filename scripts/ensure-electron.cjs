"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const extract = require("extract-zip");

const rootDir = path.resolve(__dirname, "..");
const electronDir = path.join(rootDir, "node_modules", "electron");
const electronPkgPath = path.join(electronDir, "package.json");

function fail(message) {
  console.error(`[neo] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(electronPkgPath)) {
  fail("Electron dependency is missing. Run npm install first.");
}

const { version } = require(electronPkgPath);
const installScript = path.join(electronDir, "install.js");
const distDir = path.join(electronDir, "dist");
const pathFile = path.join(electronDir, "path.txt");

function installPlatform() {
  return process.env.ELECTRON_INSTALL_PLATFORM || process.env.npm_config_platform || os.platform();
}

function installArch() {
  return process.env.ELECTRON_INSTALL_ARCH || process.env.npm_config_arch || os.arch();
}

function platformPath(platform = installPlatform()) {
  if (platform === "mas" || platform === "darwin") return "Electron.app/Contents/MacOS/Electron";
  if (platform === "freebsd" || platform === "openbsd" || platform === "linux") return "electron";
  if (platform === "win32") return "electron.exe";
  fail(`Unsupported Electron platform: ${platform}`);
}

function hasCompleteElectron() {
  const executablePath = path.join(distDir, platformPath());
  if (!fs.existsSync(executablePath)) return false;
  if (!fs.existsSync(pathFile) || fs.readFileSync(pathFile, "utf8") !== platformPath()) return false;
  if (!fs.existsSync(path.join(distDir, "version"))) return false;
  if (installPlatform() === "darwin" || installPlatform() === "mas") {
    const frameworkPath = path.join(distDir, "Electron.app", "Contents", "Frameworks", "Electron Framework.framework");
    if (!fs.existsSync(frameworkPath)) return false;
  }
  return true;
}

function runElectronInstall() {
  const result = spawnSync(process.execPath, [installScript], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_INSTALL_PLATFORM: installPlatform(),
      ELECTRON_INSTALL_ARCH: installArch()
    }
  });
  return result.status === 0;
}

function walkFiles(dir, matcher, matches = []) {
  if (!fs.existsSync(dir)) return matches;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(target, matcher, matches);
    else if (matcher(target)) matches.push(target);
  }
  return matches;
}

function cacheRoots() {
  const roots = [];
  if (process.env.electron_config_cache) roots.push(process.env.electron_config_cache);
  if (process.env.npm_config_electron_config_cache) roots.push(process.env.npm_config_electron_config_cache);
  if (process.platform === "darwin") roots.push(path.join(os.homedir(), "Library", "Caches", "electron"));
  roots.push(path.join(os.homedir(), ".cache", "electron"));
  return [...new Set(roots.filter(Boolean))];
}

function findCachedZip() {
  const zipName = `electron-v${version}-${installPlatform()}-${installArch()}.zip`;
  for (const root of cacheRoots()) {
    const matches = walkFiles(root, (file) => path.basename(file) === zipName);
    if (matches.length) {
      matches.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
      return matches[0];
    }
  }
  return "";
}

async function extractCachedZip(zipPath) {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const unzipResult = spawnSync("unzip", ["-q", "-o", zipPath, "-d", distDir], { stdio: "inherit" });
  if (unzipResult.status !== 0) {
    await extract(zipPath, { dir: distDir });
  }

  const typeDefPath = path.join(distDir, "electron.d.ts");
  if (fs.existsSync(typeDefPath)) {
    fs.renameSync(typeDefPath, path.join(electronDir, "electron.d.ts"));
  }

  fs.writeFileSync(pathFile, platformPath());
  fs.writeFileSync(path.join(distDir, "version"), version);
}

(async () => {
  if (hasCompleteElectron()) {
    console.log("[neo] Electron dependency is ready.");
    return;
  }

  console.log("[neo] Repairing Electron dependency...");
  runElectronInstall();

  if (!hasCompleteElectron()) {
    const zipPath = findCachedZip();
    if (!zipPath) fail("Electron binary is incomplete and no cached archive was found.");
    console.log(`[neo] Restoring Electron from cache: ${zipPath}`);
    await extractCachedZip(zipPath);
  }

  if (!hasCompleteElectron()) {
    fail("Electron dependency is still incomplete after repair.");
  }

  console.log("[neo] Electron dependency repaired.");
})().catch((error) => fail(error.message || String(error)));
