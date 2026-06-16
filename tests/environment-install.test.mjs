// tests/environment-install.test.mjs — 环境补齐脚本生成
import { readFile, rm } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { buildInstallMissingScript, buildSingleInstallScript, buildWindowsInstallScript, writeTempInstallScript } from "../server/environment.mjs";
import { pythonPipCommand } from "../server/tools.mjs";

const onUnix = process.platform !== "win32";

const pipCommand = "python3 -m pip install --upgrade openpyxl charset-normalizer";

function makeEnv(extraItems = []) {
  return {
    items: [
      { id: "homebrew", label: "Homebrew", status: "missing", required: false, installable: true, installCommand: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"' },
      { id: "git", label: "Git", status: "recommended", required: false, installable: true, installCommand: "brew install git" },
      { id: "python", label: "Python 3", status: "recommended", required: false, installable: true, installCommand: "brew install python" },
      { id: "python-openpyxl", label: "Python 表格库 openpyxl", status: "recommended", required: false, installable: true, installCommand: `brew install python\n${pipCommand}` },
      ...extraItems
    ]
  };
}

describe.skipIf(!onUnix)("buildInstallMissingScript (unix)", () => {
  it("单项失败不中断：不再 set -e，失败进入汇总", () => {
    const script = buildInstallMissingScript(makeEnv(), true, false);
    expect(script).not.toContain("set -e");
    expect(script).toContain("neo_failed");
    expect(script).toContain("安装失败，继续后续项");
    expect(script).toContain("以下环境项安装失败");
  });

  it("跨条目重复的 brew install 行只保留一次", () => {
    const script = buildInstallMissingScript(makeEnv(), true, false);
    const matches = script.match(/^brew install python$/gm) || [];
    expect(matches.length).toBe(1);
  });

  it("默认不带镜像参数", () => {
    const script = buildInstallMissingScript(makeEnv(), true, false);
    expect(script).not.toContain("tuna.tsinghua.edu.cn");
    expect(script).toContain("raw.githubusercontent.com/Homebrew/install");
  });

  it("镜像模式：Homebrew 走 TUNA 安装源并导出 bottle 镜像", () => {
    const script = buildInstallMissingScript(makeEnv(), true, true);
    expect(script).toContain("mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.git");
    expect(script).toContain("HOMEBREW_BOTTLE_DOMAIN");
    expect(script).not.toContain("raw.githubusercontent.com/Homebrew/install");
  });

  it("镜像模式：pip 安装行追加国内 index", () => {
    const script = buildInstallMissingScript(makeEnv(), true, true);
    expect(script).toContain(`${pipCommand} -i https://pypi.tuna.tsinghua.edu.cn/simple`);
  });

  it("镜像模式：npm install 追加国内 registry", () => {
    const env = makeEnv([{ id: "desktop-deps", label: "桌面打包依赖", status: "recommended", required: false, installable: true, installCommand: "cd '/tmp/neo' && npm install" }]);
    const script = buildInstallMissingScript(env, true, true);
    expect(script).toContain("npm install --registry=https://registry.npmmirror.com");
  });
});

describe.skipIf(!onUnix)("buildSingleInstallScript (unix)", () => {
  it("单装 Homebrew：镜像模式换 TUNA 源", () => {
    const env = makeEnv();
    const brew = env.items[0];
    expect(buildSingleInstallScript(env, brew, false)).toContain("raw.githubusercontent.com");
    expect(buildSingleInstallScript(env, brew, true)).toContain("mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.git");
  });

  it("单装 brew 包：镜像模式带 bottle 镜像导出", () => {
    const env = makeEnv();
    const git = env.items[1];
    const script = buildSingleInstallScript(env, git, true);
    expect(script).toContain("HOMEBREW_BOTTLE_DOMAIN");
    expect(script).toContain("brew install git");
  });
});

describe.skipIf(!onUnix)("pythonPipCommand", () => {
  it("带 PEP 668 回退：直装失败时加 --break-system-packages 重试", () => {
    const command = pythonPipCommand({ found: true, command: "python3" });
    expect(command).toContain("|| python3 -m pip install --upgrade");
    expect(command).toContain("--break-system-packages");
  });
});

// 纯字符串拼接，任何平台都能验证 Windows 脚本内容
describe("buildWindowsInstallScript", () => {
  const wingetItems = [
    { id: "git", label: "Git", installable: true, installCommand: "winget install --id Git.Git -e --source winget" },
    { id: "node", label: "Node.js 18+", installable: true, installCommand: "winget install --id OpenJS.NodeJS.LTS -e --source winget" },
    { id: "python-openpyxl", label: "Python 表格库 openpyxl", installable: true, installCommand: "winget install --id Git.Git -e --source winget\npython -m pip install --upgrade openpyxl charset-normalizer" }
  ];

  it("winget 缺失时自动下载安装，不再只开浏览器", () => {
    const script = buildWindowsInstallScript(wingetItems, false);
    expect(script).toContain("Install-WinGetPackageFile");
    expect(script).toContain("https://aka.ms/getwinget");
    expect(script).toContain("Microsoft.VCLibs");
    // 浏览器只是最后兜底，且在自动安装尝试之后
    expect(script.indexOf("Install-WinGetPackageFile")).toBeLessThan(script.indexOf('Start-Process "https://aka.ms/getwinget"'));
  });

  it("单项失败不中断：逐项 try/catch 并汇总失败项", () => {
    const script = buildWindowsInstallScript(wingetItems, false);
    expect(script).toContain("$neoFailed = @()");
    expect(script).toContain("安装失败");
    expect(script).toContain("以下环境项安装失败");
    const tryCount = (script.match(/^try \{$/gm) || []).length;
    expect(tryCount).toBe(wingetItems.length);
  });

  it("跨条目重复的 winget install 行只保留一次", () => {
    const script = buildWindowsInstallScript(wingetItems, false);
    const matches = script.match(/winget install --id Git\.Git/g) || [];
    expect(matches.length).toBe(1);
  });

  it("镜像模式：pip 行追加国内 index，winget 行不动", () => {
    const script = buildWindowsInstallScript(wingetItems, true);
    expect(script).toContain("pip install --upgrade openpyxl charset-normalizer -i https://pypi.tuna.tsinghua.edu.cn/simple");
    expect(script).not.toContain("winget install --id OpenJS.NodeJS.LTS -e --source winget -i");
  });

  it("生成的 PowerShell 花括号/圆括号配平", () => {
    const script = buildWindowsInstallScript(wingetItems, true);
    // 粗粒度语法体检：脚本里的字符串不含花括号，直接计数即可
    expect((script.match(/\{/g) || []).length).toBe((script.match(/\}/g) || []).length);
    expect((script.match(/\(/g) || []).length).toBe((script.match(/\)/g) || []).length);
  });

  it("临时 .ps1 带 UTF-8 BOM（PowerShell 5.1 无 BOM 会按 GBK 解码导致乱码和语法错误）", async () => {
    const scriptPath = await writeTempInstallScript('Write-Host "[neo] 中文编码探针"');
    try {
      const bytes = await readFile(scriptPath);
      expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
      expect(bytes.toString("utf8")).toContain("中文编码探针");
    } finally {
      await rm(scriptPath, { force: true });
    }
  });
});
