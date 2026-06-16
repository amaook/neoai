"use strict";

// 在没有 wine/Rosetta 的 Apple Silicon mac 上，electron-builder 自带的
// rcedit（x86 wine）跑不起来，win.signAndEditExecutable 已设为 false。
// 这里用纯 JS 的 resedit 完成同样的事：给 neo.exe 写入图标和版本信息。

const fs = require("node:fs");
const path = require("node:path");
const ResEdit = require("resedit");

const LANG_NEUTRAL = 1033;

function setWindowsExeResources(context) {
  if (context.electronPlatformName !== "win32") return;
  const { appInfo } = context.packager;
  const exeName = `${appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  if (!fs.existsSync(exePath)) return;

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
  const res = ResEdit.NtExecutableResource.from(exe);

  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");
  if (fs.existsSync(iconPath)) {
    const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
    // Electron 主程序的图标组资源 ID 固定是 1
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      1,
      LANG_NEUTRAL,
      iconFile.icons.map((icon) => icon.data)
    );
  }

  const version = appInfo.version;
  const parts = version.split(".").map((piece) => parseInt(piece, 10) || 0);
  while (parts.length < 4) parts.push(0);
  const versionInfo = ResEdit.Resource.VersionInfo.createEmpty();
  versionInfo.setFileVersion(parts[0], parts[1], parts[2], parts[3], LANG_NEUTRAL);
  versionInfo.setProductVersion(parts[0], parts[1], parts[2], parts[3], LANG_NEUTRAL);
  versionInfo.setStringValues({ lang: LANG_NEUTRAL, codepage: 1200 }, {
    FileDescription: appInfo.productName,
    ProductName: appInfo.productName,
    ProductVersion: version,
    FileVersion: version,
    CompanyName: appInfo.companyName || appInfo.productName,
    LegalCopyright: appInfo.copyright,
    InternalName: appInfo.productName,
    OriginalFilename: exeName
  });
  versionInfo.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • win-exe-resources 已写入图标与版本信息 file=${exePath}`);
}

module.exports = setWindowsExeResources;
module.exports.default = setWindowsExeResources;
