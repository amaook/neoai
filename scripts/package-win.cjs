"use strict";

// 在 Apple Silicon mac（无 Rosetta/wine）上构建 Windows 安装包的入口。
//
// electron-builder 自带的 makensis 是 x86 的，跑不起来。需要一次性准备
// 原生 arm64 的 NSIS 目录（已在本机完成，如需重建照以下步骤）：
//   brew install makensis
//   mkdir -p ~/.cache/neo-nsis/mac
//   ln -sf "$(brew --prefix)/bin/makensis" ~/.cache/neo-nsis/mac/makensis
//   for d in "$(brew --prefix)"/share/nsis/*; do ln -sfn "$d" ~/.cache/neo-nsis/"$(basename "$d")"; done
//   ln -sf ~/Library/Caches/electron-builder/nsis/nsis-3.0.4.1-*/elevate.exe ~/.cache/neo-nsis/elevate.exe
//
// exe 的图标/版本信息由 scripts/win-exe-resources.cjs（纯 JS）写入，
// 对应 package.json 里 win.signAndEditExecutable=false。
// 在 Windows/Linux 上运行本脚本时不做任何特殊处理，行为同直接调 electron-builder。

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const env = { ...process.env };

if (process.platform === "darwin" && !env.ELECTRON_BUILDER_NSIS_DIR) {
  const customNsisDir = path.join(os.homedir(), ".cache", "neo-nsis");
  if (fs.existsSync(path.join(customNsisDir, "mac", "makensis"))) {
    env.ELECTRON_BUILDER_NSIS_DIR = customNsisDir;
    console.log(`[package-win] 使用本机原生 NSIS：${customNsisDir}`);
  } else {
    console.warn("[package-win] 未找到 ~/.cache/neo-nsis，将使用 electron-builder 自带 NSIS（无 Rosetta 的 mac 上会失败，见本文件头部说明）");
  }
}

const result = spawnSync("npx", ["electron-builder", ...process.argv.slice(2)], { stdio: "inherit", env });
process.exit(result.status ?? 1);
