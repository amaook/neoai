"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const plistBuddy = "/usr/libexec/PlistBuddy";

const helperDisplayNames = [
  [/ Helper \(GPU\)\.app$/i, "Background Service (GPU)"],
  [/ Helper \(Plugin\)\.app$/i, "Background Service (Plugin)"],
  [/ Helper \(Renderer\)\.app$/i, "Background Service (Renderer)"],
  [/ Helper EH\.app$/i, "Background Service (EH)"],
  [/ Helper NP\.app$/i, "Background Service (NP)"],
  [/ Helper\.app$/i, "Background Service"]
];

function plistString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function setPlistValue(plistPath, key, value) {
  execFileSync(plistBuddy, ["-c", `Set :${key} ${plistString(value)}`, plistPath], { stdio: "pipe" });
}

function helperDisplayName(helperAppName) {
  const match = helperDisplayNames.find(([pattern]) => pattern.test(helperAppName));
  return match ? match[1] : "Background Service";
}

function findMacApps(appOutDir) {
  if (!appOutDir || !fs.existsSync(appOutDir)) return [];
  return fs.readdirSync(appOutDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
    .map((entry) => path.join(appOutDir, entry.name));
}

function tuneMacHelpers(context = {}) {
  if (context.electronPlatformName && context.electronPlatformName !== "darwin") return;

  const appPaths = findMacApps(context.appOutDir);
  for (const appPath of appPaths) {
    const frameworksPath = path.join(appPath, "Contents", "Frameworks");
    if (!fs.existsSync(frameworksPath)) continue;

    const helperApps = fs.readdirSync(frameworksPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && / Helper(?: .*)?\.app$/i.test(entry.name));

    for (const helperApp of helperApps) {
      const plistPath = path.join(frameworksPath, helperApp.name, "Contents", "Info.plist");
      if (!fs.existsSync(plistPath)) continue;
      setPlistValue(plistPath, "CFBundleDisplayName", helperDisplayName(helperApp.name));
    }
  }
}

module.exports = tuneMacHelpers;
module.exports.default = tuneMacHelpers;
