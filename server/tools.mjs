// server/tools.mjs — 工具定义、实现与 handleToolCall
import { readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import readExcelFile from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";
import mammoth from "mammoth";

import { ctx, rootDir } from "./context.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const tableCleanerPackages = ["openpyxl", "charset_normalizer"];
let PDFParseClass = null;
let PdfJsModule = null;

// ── PDF 解析 ────────────────────────────────────────────────────────────────

async function ensurePdfDomGlobals() {
  if (globalThis.DOMMatrix && globalThis.DOMPoint && globalThis.DOMRect) return;
  try {
    const geometryModule = await import("@napi-rs/canvas/geometry.js");
    const geometry = geometryModule.default || geometryModule;
    if (!globalThis.DOMMatrix && geometry.DOMMatrix) globalThis.DOMMatrix = geometry.DOMMatrix;
    if (!globalThis.DOMPoint && geometry.DOMPoint) globalThis.DOMPoint = geometry.DOMPoint;
    if (!globalThis.DOMRect && geometry.DOMRect) globalThis.DOMRect = geometry.DOMRect;
  } catch { /* 忽略 */ }
}

async function loadPdfParser() {
  if (PDFParseClass) return PDFParseClass;
  await ensurePdfDomGlobals();
  const module = await import("pdf-parse");
  PDFParseClass = module.PDFParse;
  return PDFParseClass;
}

async function loadPdfJs() {
  if (PdfJsModule) return PdfJsModule;
  PdfJsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
  PdfJsModule.GlobalWorkerOptions.workerSrc = "";
  return PdfJsModule;
}

// ── 工具映射 ────────────────────────────────────────────────────────────────

export const skillToolMap = {
  "local-files": ["list_files", "read_file", "write_file", "export_image", "search_files", "verify_office_file"],
  "spreadsheet-pro": ["inspect_office_file", "read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
  "document-reader": ["inspect_office_file", "read_file", "create_word_file", "create_ppt_file", "verify_office_file"],
  "finance-tables": ["inspect_office_file", "read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
  "code-review": ["list_files", "read_file", "search_files"],
  "web-browser": ["search_web", "read_web_page", "download_url", "open_url"],
  "desktop-control": ["open_url", "open_desktop_app", "open_workspace_item", "show_desktop_notification"],
  "local-command": ["run_command"]
};

const defaultToolConsent = Object.freeze({
  fileRead: true,
  fileWrite: false,
  externalRead: false,
  externalWrite: false,
  externalPaths: [],
  web: false,
  desktop: false,
  command: false
});

const toolPermissionRules = {
  list_files: ["fileRead"],
  read_file: ["fileRead"],
  inspect_office_file: ["fileRead"],
  read_excel_file: ["fileRead"],
  verify_office_file: ["fileRead"],
  search_files: ["fileRead"],
  write_file: ["fileWrite"],
  export_image: ["fileWrite"],
  create_excel_file: ["fileWrite"],
  create_word_file: ["fileWrite"],
  create_ppt_file: ["fileWrite"],
  clean_table_file: ["fileWrite"],
  clean_table_files: ["fileWrite"],
  search_web: ["web"],
  read_web_page: ["web"],
  download_url: ["web", "fileWrite"],
  open_url: ["desktop"],
  open_workspace_item: ["desktop"],
  open_desktop_app: ["desktop"],
  show_desktop_notification: ["desktop"],
  run_command: ["command"]
};

const toolPermissionLabels = {
  fileRead: "读取工作区文件",
  fileWrite: "写入或生成工作区文件",
  externalRead: "读取已授权的工作区外路径",
  externalWrite: "写入已授权的工作区外路径",
  web: "访问网页",
  desktop: "打开本地应用、网页或文件",
  command: "运行本地命令"
};

export function normalizeToolConsent(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const externalPaths = Array.isArray(input.externalPaths)
    ? [...new Set(input.externalPaths.map((item) => String(item || "").trim()).filter(Boolean))]
      .slice(0, 80)
    : [];
  return {
    fileRead: input.fileRead !== false,
    fileWrite: input.fileWrite === true,
    externalRead: input.externalRead === true,
    externalWrite: input.externalWrite === true,
    externalPaths,
    web: input.web === true,
    desktop: input.desktop === true,
    command: input.command === true
  };
}

function permissionKeysForTool(name) {
  return toolPermissionRules[name] || [];
}

function permissionLabelForTool(name) {
  const keys = permissionKeysForTool(name);
  return keys.map((key) => toolPermissionLabels[key] || key).join("、") || "本地工具";
}

export function isToolAllowedByConsent(name, toolConsent = {}) {
  if (name === "invoke_skill") return true;
  const keys = permissionKeysForTool(name);
  if (!keys.length) return false;
  const consent = normalizeToolConsent(toolConsent);
  return keys.every((key) => consent[key] === true);
}

export function isSkillAllowedByConsent(skillId, toolConsent = {}) {
  return (skillToolMap[skillId] || []).some((name) => isToolAllowedByConsent(name, toolConsent));
}

export const agentTools = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and directories inside the local workspace.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Workspace-relative directory path." } },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file from the local workspace or an explicitly authorized external path. For .xlsx files, returns a workbook preview.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Workspace-relative file path or authorized absolute external path." } },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "inspect_office_file",
      description: "Inspect a supported office file (.xlsx, .xlsm, .csv, .tsv, .docx, .pdf, .pptx), return parsed metadata, preview, quality checks, and an office task record.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative file path or authorized absolute external path." },
          row_limit: { type: "number", description: "Maximum table rows per sheet to return. Defaults to 80." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_excel_file",
      description: "Read a real .xlsx/.xlsm workbook or .csv/.tsv table from the local workspace or an authorized external path and return sheet rows, headers, and quality checks.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative .xlsx/.xlsm/.csv/.tsv file path or authorized absolute external path." },
          row_limit: { type: "number", description: "Maximum rows per sheet to return. Defaults to 120." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write a text file inside the local workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative file path." },
          content: { type: "string", description: "Complete new file content." }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_image",
      description: "Render HTML or SVG into a real PNG/JPG image file in the local workspace.",
      parameters: {
        type: "object",
        properties: {
          input_path: { type: "string" },
          html: { type: "string" },
          svg: { type: "string" },
          output_path: { type: "string" },
          width: { type: "number" },
          height: { type: "number" },
          format: { type: "string" },
          quality: { type: "number" },
          transparent: { type: "boolean" },
          overwrite: { type: "boolean" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_excel_file",
      description: "Create a real .xlsx file in the local workspace from columns and rows, then re-read it for verification.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          sheet_name: { type: "string" },
          columns: { type: "array", items: {} },
          rows: { type: "array", items: {} },
          sheets: { type: "array", items: { type: "object" } }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_word_file",
      description: "Create a basic real .docx Word file in the local workspace, then re-read it for verification.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          title: { type: "string" },
          subtitle: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
          sections: { type: "array", items: { type: "object" } },
          tables: { type: "array", items: { type: "object" } },
          overwrite: { type: "boolean" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_ppt_file",
      description: "Create a basic real .pptx PowerPoint file with cover, agenda/content/summary style slides, then re-read it for verification.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          title: { type: "string" },
          subtitle: { type: "string" },
          slides: { type: "array", items: { type: "object" } },
          sections: { type: "array", items: { type: "object" } },
          overwrite: { type: "boolean" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "clean_table_file",
      description: "Clean a .xlsx/.xlsm/.csv/.tsv table file with Python and save a new cleaned file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          output_path: { type: "string" },
          sheet: { type: "string" },
          operations: { type: "array", items: { type: "object" } },
          options: { type: "object" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "clean_table_files",
      description: "Batch clean multiple .xlsx/.xlsm/.csv/.tsv table files with Python.",
      parameters: {
        type: "object",
        properties: {
          paths: { type: "array", items: { type: "string" } },
          output_dir: { type: "string" },
          operations: { type: "array", items: { type: "object" } },
          options: { type: "object" }
        },
        required: ["paths"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "verify_office_file",
      description: "Verify a generated or imported office file by checking workspace path, existence, size, and type-specific re-read results.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative file path or authorized absolute external path." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search text in workspace files using ripgrep.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          glob: { type: "string" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web and return a small list of result titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_web_page",
      description: "Fetch a http/https web page, extract readable text and links, and optionally save it in the workspace.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
          output_path: { type: "string" },
          max_chars: { type: "number" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "download_url",
      description: "Download a HTTP/HTTPS file into the local workspace.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
          output_path: { type: "string" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "open_url",
      description: "Open a HTTP/HTTPS URL in the user's default browser.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "open_workspace_item",
      description: "Open a file or folder from the current workspace with the system default app.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          reveal: { type: "boolean" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "open_desktop_app",
      description: "Open a local desktop application by app name or absolute path.",
      parameters: {
        type: "object",
        properties: { app: { type: "string" } },
        required: ["app"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_desktop_notification",
      description: "Show a local desktop notification to the user.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          message: { type: "string" }
        },
        required: ["title", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command in the local workspace.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "invoke_skill",
      description: "Delegate a complex sub-task to a specialized skill sub-agent that runs with its own focused system prompt and dedicated tool set, then returns the result. Use this when the task clearly maps to a skill domain and would benefit from a dedicated agent loop. Available skills: local-files (file read/write/search/export), spreadsheet-pro (Excel/CSV read/create/clean), document-reader (PDF/Word extraction), finance-tables (financial data processing), code-review (code analysis), web-browser (search/fetch/download), desktop-control (open apps/files/notify), local-command (shell commands).",
      parameters: {
        type: "object",
        properties: {
          skill: {
            type: "string",
            description: "Skill ID. One of: local-files, spreadsheet-pro, document-reader, finance-tables, code-review, web-browser, desktop-control, local-command"
          },
          task: {
            type: "string",
            description: "Detailed description of the task for the skill sub-agent to execute."
          }
        },
        required: ["skill", "task"]
      }
    }
  }
];

// ── 服务端技能定义（供 runSkillAgent 使用）────────────────────────────────────

export const serverSkillDefs = {
  "local-files": {
    name: "本地文件助手",
    tools: ["list_files", "read_file", "write_file", "export_image", "search_files", "verify_office_file"],
    prompt: "你是本地文件助手子智能体。优先使用工作区相对路径；写入文件前确认路径清晰；用户要海报、封面、卡片、图片版结果时，先生成 HTML/SVG，再调用 export_image 导出真实 PNG/JPG；不要删除或覆盖用户未明确要求修改的文件。"
  },
  "spreadsheet-pro": {
    name: "表格处理",
    tools: ["inspect_office_file", "read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
    prompt: "你是表格处理子智能体。遇到 Excel/CSV 时先读取结构和字段，再处理；清洗表格默认另存新文件；批量任务优先使用 clean_table_files；完成后必须以工具校验结果为准。"
  },
  "document-reader": {
    name: "文档阅读",
    tools: ["inspect_office_file", "read_file", "create_word_file", "create_ppt_file", "verify_office_file"],
    prompt: "你是文档阅读与基础 Office 子智能体。读取 Word/PDF/PPT 时先调用 inspect_office_file；生成 Word 用 create_word_file，生成 PPT 用 create_ppt_file；完成后必须以回读校验结果为准。"
  },
  "finance-tables": {
    name: "财务表格",
    tools: ["inspect_office_file", "read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
    prompt: "你是财务表格子智能体。处理金额、税费、合计和对账时必须严谨，主动说明口径、异常值和复核建议；生成或清洗后必须确认文件校验通过。"
  },
  "code-review": {
    name: "代码审查",
    tools: ["list_files", "read_file", "search_files"],
    prompt: "你是代码审查子智能体。先列问题和风险，再给改法；重点关注 bug、安全、回归和测试缺口。"
  },
  "web-browser": {
    name: "网页助手",
    tools: ["search_web", "read_web_page", "download_url", "open_url"],
    prompt: "你是网页助手子智能体。需要最新信息时先搜索或读取网页；引用网页内容时说明来源 URL；下载文件默认保存到工作区 Downloads。"
  },
  "desktop-control": {
    name: "电脑操作",
    tools: ["open_url", "open_desktop_app", "open_workspace_item", "show_desktop_notification"],
    prompt: "你是电脑操作子智能体。可以打开应用、网页和本地文件，但不能声称已经点击或操作软件内部界面；涉及高风险动作必须先让用户确认。"
  },
  "local-command": {
    name: "本地命令",
    tools: ["run_command"],
    prompt: "你是本地命令子智能体。执行命令前确认工作目录和影响范围；涉及删除、覆盖、权限修改等不可逆操作必须先向用户确认。"
  }
};

export function toolsForSkillIds(enabledSkills, toolConsent = {}, options = {}) {
  const includeInvokeSkill = options.includeInvokeSkill !== false;
  const consent = normalizeToolConsent(toolConsent);
  if (!Array.isArray(enabledSkills)) {
    return agentTools.filter((tool) => isToolAllowedByConsent(tool.function?.name, consent));
  }
  const names = new Set();
  for (const skillId of enabledSkills) {
    for (const name of skillToolMap[skillId] || []) names.add(name);
  }
  const filtered = agentTools.filter((tool) => names.has(tool.function?.name) && isToolAllowedByConsent(tool.function?.name, consent));
  // 有启用技能时，向主智能体暴露 invoke_skill，让它可以委托子任务
  if (includeInvokeSkill && enabledSkills.some((skillId) => isSkillAllowedByConsent(skillId, consent))) {
    const invokeSkillDef = agentTools.find((t) => t.function?.name === "invoke_skill");
    if (invokeSkillDef && !filtered.includes(invokeSkillDef)) filtered.push(invokeSkillDef);
  }
  return filtered;
}

// ── 路径与工作区 ─────────────────────────────────────────────────────────────

export function resolveWorkspacePath(inputPath = ".") {
  const raw = String(inputPath || ".").trim() || ".";
  const target = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(ctx.workspaceRoot, raw);
  if (!isPathInside(target, ctx.workspaceRoot)) {
    const error = new Error("路径超出工作区");
    error.status = 403;
    throw error;
  }
  return target;
}

export function isPathInside(targetPath, rootPath) {
  const target = path.resolve(String(targetPath || "."));
  const root = path.resolve(String(rootPath || "."));
  if (target === root) return true;
  const relative = path.relative(root, target);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizedExternalRoots(toolConsent = {}) {
  return normalizeToolConsent(toolConsent).externalPaths
    .map((item) => String(item || "").trim())
    .filter((item) => path.isAbsolute(item))
    .map((item) => path.resolve(item));
}

function isExternalTargetAllowed(target, toolConsent = {}, mode = "read") {
  const consent = normalizeToolConsent(toolConsent);
  if (mode === "write" && !consent.externalWrite) return false;
  if (mode !== "write" && !consent.externalRead) return false;
  for (const root of normalizedExternalRoots(consent)) {
    if (target === root) return true;
    try {
      const rootStats = statSync(root);
      if (rootStats.isDirectory() && isPathInside(target, root)) return true;
    } catch {
      // 手动输入但尚不存在的授权路径仅允许精确匹配，避免误放大范围。
    }
  }
  return false;
}

export function resolveToolPath(inputPath = ".", toolConsent = {}, mode = "read") {
  const raw = String(inputPath || ".").trim() || ".";
  if (!path.isAbsolute(raw)) return resolveWorkspacePath(raw);
  const target = path.resolve(raw);
  if (isPathInside(target, ctx.workspaceRoot)) return target;
  if (isExternalTargetAllowed(target, toolConsent, mode)) return target;
  const error = new Error(mode === "write"
    ? "路径超出工作区，且未授权写入该外部路径"
    : "路径超出工作区，且未授权读取该外部路径");
  error.status = 403;
  throw error;
}

export function toolPathLabel(targetPath) {
  const target = path.resolve(String(targetPath || "."));
  return isPathInside(target, ctx.workspaceRoot) ? path.relative(ctx.workspaceRoot, target) || "." : target;
}

export function isExcelPath(filePath) {
  return [".xlsx", ".xlsm"].includes(path.extname(String(filePath || "")).toLowerCase());
}

function isOfficeBinaryPath(filePath) {
  return [".xlsx", ".xlsm", ".docx", ".pptx", ".pdf"].includes(path.extname(String(filePath || "")).toLowerCase());
}

export function isTextLikePath(filePath) {
  return new Set([
    ".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".xml", ".html", ".css", ".js", ".ts",
    ".jsx", ".tsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".sh", ".bash",
    ".sql", ".toml", ".env", ".ini", ".log", ".diff"
  ]).has(path.extname(String(filePath || "")).toLowerCase());
}

// ── 通用工具函数 ─────────────────────────────────────────────────────────────

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function trimOutput(text, limit = 12000) {
  const value = String(text ?? "");
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n\n[output trimmed: ${value.length - limit} chars]`;
}

export function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

export function parseArguments(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function missingRequiredToolArgs(toolName, fields = []) {
  return {
    ok: false,
    error: `${toolName} 缺少必要参数：${fields.join("、")}`,
    toolArgError: true,
    missingArgs: fields
  };
}

function safeTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isWorkspaceRootPath(targetPath) {
  return path.resolve(targetPath) === path.resolve(ctx.workspaceRoot);
}

async function isDirectoryPath(targetPath) {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

async function validateWriteFileArgs(args = {}) {
  const filePath = safeTrimmedString(args.path);
  const hasContent = args.content !== undefined && args.content !== null && String(args.content).length > 0;
  const missing = [];
  if (!filePath) missing.push("path");
  if (!hasContent) missing.push("content");
  if (missing.length) return missingRequiredToolArgs("write_file", missing);
  if (filePath === ".") return { ok: false, error: "write_file 的 path 不能是工作区根目录", toolArgError: true };
  const target = resolveWorkspacePath(filePath);
  if (isWorkspaceRootPath(target)) return { ok: false, error: "write_file 不允许写入工作区根目录", toolArgError: true };
  if (await isDirectoryPath(target)) return { ok: false, error: `write_file 的 path 指向目录：${path.relative(ctx.workspaceRoot, target) || "."}`, toolArgError: true };
  return { ok: true, target, filePath };
}

function validateRunCommandArgs(args = {}) {
  if (!safeTrimmedString(args.command)) return missingRequiredToolArgs("run_command", ["command"]);
  return { ok: true, command: safeTrimmedString(args.command) };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

// ── Office 任务与基础 OOXML 工具 ─────────────────────────────────────────────

const officeStepNames = ["保存文件", "识别类型", "解析内容", "执行处理", "生成结果", "校验文件", "返回用户"];

function isoNow() {
  return new Date().toISOString();
}

function createOfficeTask(action, file = {}) {
  return {
    id: randomUUID(),
    kind: "office-task",
    action,
    status: "running",
    startedAt: isoNow(),
    endedAt: "",
    file: {
      originalName: file.originalName || file.name || "",
      path: file.path || "",
      size: Number(file.size || 0),
      fileType: file.fileType || "",
      parseStatus: "pending",
      truncated: false,
      supported: false
    },
    steps: officeStepNames.map((name) => ({ name, status: "pending", detail: "", error: "", result: null, at: "" }))
  };
}

function officeStep(task, name, status, detail = "", result = null) {
  const step = task.steps.find((item) => item.name === name);
  if (!step) return task;
  step.status = status;
  step.detail = detail || "";
  step.error = status === "failed" ? detail || "失败" : "";
  step.result = result;
  step.at = isoNow();
  if (status === "failed") {
    task.status = "failed";
    task.endedAt = isoNow();
  }
  return task;
}

function finishOfficeTask(task, status = "complete", detail = "") {
  task.status = status;
  task.endedAt = isoNow();
  if (detail) task.detail = detail;
  return task;
}

function updateOfficeTaskFile(task, file = {}) {
  task.file = { ...task.file, ...file };
  return task;
}

function extensionOf(filePath = "") {
  return path.extname(String(filePath || "")).toLowerCase();
}

function officeFileType(filePath = "") {
  const ext = extensionOf(filePath);
  if (ext === ".xlsx") return { extension: ext, fileType: "xlsx", kind: "sheet", supported: true, label: "Excel 工作簿" };
  if (ext === ".xlsm") return { extension: ext, fileType: "xlsm", kind: "sheet", supported: true, label: "Excel 宏工作簿" };
  if (ext === ".csv") return { extension: ext, fileType: "csv", kind: "sheet", supported: true, label: "CSV 表格" };
  if (ext === ".tsv") return { extension: ext, fileType: "tsv", kind: "sheet", supported: true, label: "TSV 表格" };
  if (ext === ".docx") return { extension: ext, fileType: "docx", kind: "doc", supported: true, label: "Word 文档" };
  if (ext === ".pdf") return { extension: ext, fileType: "pdf", kind: "pdf", supported: true, label: "PDF 文档" };
  if (ext === ".pptx") return { extension: ext, fileType: "pptx", kind: "ppt", supported: true, label: "PowerPoint 演示文稿" };
  if (ext === ".xls") return { extension: ext, fileType: "xls", kind: "sheet", supported: false, legacy: true, label: "旧版 Excel", error: "旧版 .xls 暂不直接处理，请先另存为 .xlsx" };
  if (ext === ".doc") return { extension: ext, fileType: "doc", kind: "doc", supported: false, legacy: true, label: "旧版 Word", error: "旧版 .doc 暂不直接处理，请先另存为 .docx" };
  if (ext === ".ppt") return { extension: ext, fileType: "ppt", kind: "ppt", supported: false, legacy: true, label: "旧版 PPT", error: "旧版 .ppt 暂不直接处理，请先另存为 .pptx" };
  return { extension: ext, fileType: ext.replace(/^\./, "") || "unknown", kind: "file", supported: false, label: "未知文件", error: "当前 Office 内核暂不支持这个文件类型" };
}

function xmlEscape(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlDecode(value = "") {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function compactTextLines(lines = []) {
  return lines.map((line) => String(line || "").replace(/\s+/g, " ").trim()).filter(Boolean);
}

function textStats(text = "") {
  const value = String(text || "");
  const paragraphs = compactTextLines(value.split(/\r?\n+/));
  const latinWords = value.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || [];
  const cjkChars = value.match(/[\u3400-\u9FFF]/g) || [];
  const todoItems = paragraphs.filter((line) => /(待办|TODO|todo|\[[ xX]\]|需要|请|下一步|跟进)/.test(line)).slice(0, 20);
  const titleHints = paragraphs.filter((line) => line.length <= 80).slice(0, 8);
  const tableHints = paragraphs.filter((line) => /\t|\|/.test(line)).slice(0, 12);
  return {
    textChars: value.length,
    wordCount: latinWords.length + cjkChars.length,
    paragraphCount: paragraphs.length,
    titleHints,
    todoItems,
    tableHints
  };
}

function isEmptyCell(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function normalizeTableCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return typeof value === "object" ? JSON.stringify(value) : value;
}

function rowIsEmpty(row = []) {
  return !row.some((cell) => !isEmptyCell(cell));
}

function firstHeaderRow(rows = []) {
  const index = rows.findIndex((row) => !rowIsEmpty(row));
  return index >= 0 ? index : 0;
}

function tableQuality(rows = []) {
  const width = Math.max(0, ...rows.map((row) => Array.isArray(row) ? row.length : 1));
  const emptyRows = rows.filter((row) => rowIsEmpty(Array.isArray(row) ? row : [row])).length;
  let emptyColumns = 0;
  for (let column = 0; column < width; column += 1) {
    if (rows.every((row) => isEmptyCell((Array.isArray(row) ? row : [row])[column]))) emptyColumns += 1;
  }
  const seen = new Set();
  let duplicateRows = 0;
  for (const row of rows) {
    if (rowIsEmpty(row)) continue;
    const key = (Array.isArray(row) ? row : [row]).map((cell) => String(cell ?? "").trim()).join("\u0001");
    if (seen.has(key)) duplicateRows += 1;
    else seen.add(key);
  }
  return { emptyRows, emptyColumns, duplicateRows };
}

function analyzeTableRows(rows = [], rowLimit = 120) {
  const normalized = rows.map((row) => Array.isArray(row) ? row.map(normalizeTableCell) : [normalizeTableCell(row)]);
  const headerIndex = firstHeaderRow(normalized);
  const headerRow = normalized[headerIndex] || [];
  const columnCount = Math.max(0, ...normalized.map((row) => row.length));
  const headers = Array.from({ length: columnCount }, (_, index) => {
    const value = String(headerRow[index] ?? "").trim();
    return value || `列${index + 1}`;
  });
  const amountColumns = headers.filter((name) => /(金额|收入|支出|费用|成本|利润|价格|单价|总价|余额|amount|price|revenue|cost|profit|fee|money)/i.test(name));
  const dateColumns = headers.filter((name) => /(日期|时间|年月|月份|date|time|day|month)/i.test(name));
  const rowsPreview = normalized.slice(0, rowLimit).map((row) => row.map((cell) => cell === null || cell === undefined ? "" : cell));
  return {
    rowCount: normalized.length,
    columnCount,
    headers,
    returnedRows: rowsPreview.length,
    rows: rowsPreview,
    quality: tableQuality(normalized),
    suggestedNormalization: { amountColumns, dateColumns }
  };
}

function parseDelimitedRows(text = "", delimiter = ",") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (ch === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (ch === "\"") {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === "\"") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== "" || input.endsWith(delimiter)) rows.push(row);
  return rows;
}

async function readDelimitedTable(target, stats, rowLimit, kind = "csv") {
  const text = await readFile(target, "utf8");
  const delimiter = kind === "tsv" ? "\t" : ",";
  const rows = parseDelimitedRows(text, delimiter);
  const analysis = analyzeTableRows(rows, rowLimit);
  return {
    ok: true,
    path: toolPathLabel(target),
    size: stats.size,
    sheets: [{ name: kind.toUpperCase(), ...analysis }],
    reader: `${kind}-parser`,
    fileType: kind
  };
}

let crc32Table = null;

function crc32(buffer) {
  if (!crc32Table) {
    crc32Table = Array.from({ length: 256 }, (_, index) => {
      let c = index;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimeDate(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function writeZipArchive(entries = []) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = dosTimeDate();
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ""), "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralOffset = offset;
  const centralBody = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBody.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralBody, end]);
}

function readZipEntries(buffer) {
  const entries = new Map();
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 66000); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error("不是有效的 ZIP/OOXML 文件");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("ZIP 中央目录损坏");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP 本地目录损坏");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = inflateRawSync(compressed);
    else throw new Error(`ZIP 压缩方式暂不支持：${method}`);
    entries.set(name, data);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function ooxmlTextRuns(text = "", options = {}) {
  const attrs = [
    options.bold ? ' b="1"' : "",
    options.size ? ` sz="${Math.round(Number(options.size) * 100)}"` : "",
    ' lang="zh-CN"'
  ].join("");
  return `<w:r><w:rPr>${attrs ? `<w:sz w:val="${Math.round(Number(options.size || 11) * 2)}"/>${options.bold ? "<w:b/>" : ""}` : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function docxParagraph(text = "", options = {}) {
  const jc = options.align ? `<w:jc w:val="${options.align}"/>` : "";
  const spacing = options.heading ? '<w:spacing w:before="240" w:after="120"/>' : '<w:spacing w:after="120"/>';
  const pPr = `<w:pPr>${spacing}${jc}</w:pPr>`;
  return `<w:p>${pPr}${ooxmlTextRuns(text, options)}</w:p>`;
}

function docxTable(table = {}) {
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const headers = Array.isArray(table.headers) ? table.headers : [];
  const allRows = headers.length ? [headers, ...rows] : rows;
  if (!allRows.length) return "";
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${allRows.map((row, rowIndex) => `<w:tr>${(Array.isArray(row) ? row : [row]).map((cell) => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${docxParagraph(cell, { bold: rowIndex === 0 && headers.length })}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
}

function docxDocumentXml(args = {}) {
  const blocks = [];
  const title = String(args.title || "neo 文档").trim();
  if (title) blocks.push(docxParagraph(title, { bold: true, size: 22, align: "center", heading: true }));
  if (args.subtitle) blocks.push(docxParagraph(args.subtitle, { size: 13, align: "center" }));
  for (const paragraph of Array.isArray(args.paragraphs) ? args.paragraphs : []) blocks.push(docxParagraph(paragraph));
  for (const section of Array.isArray(args.sections) ? args.sections : []) {
    if (section?.title) blocks.push(docxParagraph(section.title, { bold: true, size: 16, heading: true }));
    for (const paragraph of Array.isArray(section?.paragraphs) ? section.paragraphs : []) blocks.push(docxParagraph(paragraph));
    for (const item of Array.isArray(section?.bullets) ? section.bullets : []) blocks.push(docxParagraph(`• ${item}`));
  }
  for (const table of Array.isArray(args.tables) ? args.tables : []) blocks.push(docxTable(table));
  if (!blocks.length) blocks.push(docxParagraph("空白文档"));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" mc:Ignorable="w14 wp14"><w:body>${blocks.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
}

function docxPackage(args = {}) {
  return writeZipArchive([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(args.title || "neo 文档")}</dc:title><dc:creator>neo</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${isoNow()}</dcterms:created></cp:coreProperties>` },
    { name: "docProps/app.xml", data: `<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>neo</Application></Properties>` },
    { name: "word/document.xml", data: docxDocumentXml(args) }
  ]);
}

function pptTextBox(id, name, text, x, y, w, h, options = {}) {
  const runs = String(text || "").split(/\r?\n/).filter(Boolean).map((line) => `<a:p><a:r><a:rPr lang="zh-CN" sz="${options.size || 2200}"${options.bold ? ' b="1"' : ""}/><a:t>${xmlEscape(line)}</a:t></a:r></a:p>`).join("") || "<a:p/>";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xmlEscape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${runs}</p:txBody></p:sp>`;
}

function normalizePptSlides(args = {}) {
  const slides = Array.isArray(args.slides) && args.slides.length ? args.slides : [];
  if (slides.length) return slides.slice(0, 80);
  const title = String(args.title || "neo 演示文稿").trim() || "neo 演示文稿";
  const sections = Array.isArray(args.sections) ? args.sections : [];
  const generated = [{ title, subtitle: args.subtitle || "由 neo 生成" }];
  if (sections.length) generated.push({ title: "目录", bullets: sections.map((section, index) => section?.title || `第 ${index + 1} 部分`) });
  for (const section of sections.slice(0, 20)) generated.push({ title: section?.title || "内容", bullets: section?.bullets || section?.points || section?.paragraphs || [] });
  generated.push({ title: "总结", bullets: ["核心内容已整理完成", "可继续补充数据、图片或模板精修"] });
  return generated;
}

function slideText(slide = {}) {
  const body = [];
  if (slide.subtitle) body.push(slide.subtitle);
  if (slide.body) body.push(slide.body);
  for (const item of Array.isArray(slide.bullets) ? slide.bullets : []) body.push(`• ${item}`);
  for (const paragraph of Array.isArray(slide.paragraphs) ? slide.paragraphs : []) body.push(paragraph);
  return body.join("\n");
}

function pptSlideXml(slide = {}, index = 0) {
  const title = String(slide.title || `第 ${index + 1} 页`).trim();
  const body = slideText(slide);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${pptTextBox(2, "Title", title, 685800, 540000, 10900000, 900000, { size: index === 0 ? 4000 : 3200, bold: true })}${pptTextBox(3, "Content", body, 900000, 1600000, 10500000, 4700000, { size: 2200 })}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function pptxPackage(args = {}) {
  const slides = normalizePptSlides(args);
  const entries = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(args.title || "neo 演示文稿")}</dc:title><dc:creator>neo</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${isoNow()}</dcterms:created></cp:coreProperties>` },
    { name: "docProps/app.xml", data: `<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>neo</Application><Slides>${slides.length}</Slides></Properties>` },
    { name: "ppt/presentation.xml", data: `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("")}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
    { name: "ppt/_rels/presentation.xml.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("")}</Relationships>` },
    { name: "ppt/slideMasters/slideMaster1.xml", data: `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>` },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>` },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>` },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>` },
    { name: "ppt/theme/theme1.xml", data: `<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="neo"><a:themeElements><a:clrScheme name="neo"><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="16A34A"/></a:accent2><a:accent3><a:srgbClr val="DC2626"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="7C3AED"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="neo"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/></a:minorFont></a:fontScheme><a:fmtScheme name="neo"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>` }
  ];
  slides.forEach((slide, index) => {
    entries.push({ name: `ppt/slides/slide${index + 1}.xml`, data: pptSlideXml(slide, index) });
    entries.push({ name: `ppt/slides/_rels/slide${index + 1}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>` });
  });
  return { buffer: writeZipArchive(entries), slides };
}

// ── Shell 命令 ───────────────────────────────────────────────────────────────

export function runCommand(command, timeout = 30000) {
  const shell = process.platform === "win32"
    ? { file: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", command] }
    : { file: "/bin/zsh", args: ["-lc", command] };

  return new Promise((resolve) => {
    execFile(shell.file, shell.args, { cwd: ctx.workspaceRoot, timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        exitCode: error?.code ?? 0,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
        message: error?.message || ""
      });
    });
  });
}

export function execFileResult(file, args = [], options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { cwd: options.cwd || ctx.workspaceRoot, timeout: options.timeout || 15000, maxBuffer: options.maxBuffer || 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        exitCode: error?.code ?? 0,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
        message: error?.message || ""
      });
    });
  });
}

function windowsPowerShellArgs(command, ...scriptArgs) {
  return ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command, ...scriptArgs];
}

async function openUrlFallback(url) {
  if (process.platform === "darwin") return execFileResult("open", [url], { timeout: 8000 });
  if (process.platform === "win32") {
    return execFileResult("powershell.exe", windowsPowerShellArgs("Start-Process -FilePath $args[0]", url), { timeout: 8000 });
  }
  return execFileResult("xdg-open", [url], { timeout: 8000 });
}

export async function openPathFallback(target, reveal = false) {
  if (process.platform === "darwin") return execFileResult("open", reveal ? ["-R", target] : [target], { timeout: 8000 });
  if (process.platform === "win32") {
    if (reveal) return execFileResult("explorer.exe", [`/select,${target}`], { timeout: 8000 });
    const result = await execFileResult("powershell.exe", windowsPowerShellArgs("Invoke-Item -LiteralPath $args[0]", target), { timeout: 8000 });
    return result.ok ? result : execFileResult("explorer.exe", [target], { timeout: 8000 });
  }
  return execFileResult("xdg-open", [reveal ? path.dirname(target) : target], { timeout: 8000 });
}

async function openDesktopAppFallback(appName) {
  if (process.platform === "darwin") return execFileResult("open", ["-a", appName], { timeout: 8000 });
  if (process.platform === "win32") {
    return execFileResult("powershell.exe", windowsPowerShellArgs("Start-Process -FilePath $args[0]", appName), { timeout: 8000 });
  }
  return runCommand(`${shellQuote(appName)} >/dev/null 2>&1 &`, 8000);
}

// ── Excel ────────────────────────────────────────────────────────────────────

function ensureExcelPath(filePath) {
  const raw = String(filePath || "output.xlsx").trim() || "output.xlsx";
  const ext = path.extname(raw).toLowerCase();
  if (!ext) return `${raw}.xlsx`;
  if (!isExcelPath(raw)) {
    const error = new Error("Excel 工具只支持生成 .xlsx 或 .xlsm 文件");
    error.status = 400;
    throw error;
  }
  return raw;
}

function cleanSheetName(name, index) {
  const fallback = `Sheet${index + 1}`;
  const cleaned = String(name || fallback).replace(/[\\/?*\[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
  return cleaned || fallback;
}

function cellValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
  return JSON.stringify(value);
}

function previewValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  return JSON.stringify(value);
}

function headerCell(value) {
  return { value: String(value ?? ""), fontWeight: "bold" };
}

function displayCellValue(cell) {
  if (cell && typeof cell === "object" && "value" in cell) return cell.value;
  return cell;
}

function normalizeSheetSpec(args) {
  const sheets = Array.isArray(args.sheets) && args.sheets.length
    ? args.sheets
    : [{ name: args.sheet_name || args.sheetName || "Sheet1", columns: args.columns, rows: args.rows }];
  return sheets.slice(0, 20);
}

function columnsForRows(columnsInput, rows) {
  const columns = Array.isArray(columnsInput) ? columnsInput : [];
  const firstObject = rows.find((row) => row && typeof row === "object" && !Array.isArray(row));
  if (columns.length) {
    return columns.map((column) => {
      if (typeof column === "string") return { header: column, key: column };
      const key = String(column?.key || column?.field || column?.name || column?.header || "").trim();
      const header = String(column?.header || column?.label || key || "").trim();
      return { header: header || key || "列", key: key || header || "column" };
    });
  }
  if (!firstObject) return [];
  const keys = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    for (const key of Object.keys(row)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys.map((key) => ({ header: key, key }));
}

function sheetDataForSpec(spec, index) {
  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  const columns = columnsForRows(spec.columns, rows);
  const hasObjectRows = rows.some((row) => row && typeof row === "object" && !Array.isArray(row));
  const data = [];
  if (columns.length) data.push(columns.map((column) => headerCell(column.header)));
  if (hasObjectRows) {
    for (const row of rows) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        data.push(columns.map((column) => cellValue(row[column.key])));
      } else if (Array.isArray(row)) {
        data.push(row.map(cellValue));
      }
    }
  } else {
    for (const row of rows) {
      data.push(Array.isArray(row) ? row.map(cellValue) : [cellValue(row)]);
    }
  }
  const columnCount = Math.max(1, ...data.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, (_, columnIndex) => {
    let maxLength = 10;
    for (const row of data) {
      const text = String(previewValue(displayCellValue(row[columnIndex])) ?? "");
      maxLength = Math.max(maxLength, Math.min(40, text.length + 2));
    }
    return { width: maxLength };
  });
  return {
    data,
    sheet: cleanSheetName(spec.name || spec.sheet_name, index),
    columns: widths,
    stickyRowsCount: columns.length ? 1 : 0
  };
}

export async function createExcelWorkbook(args = {}) {
  const requestedPath = ensureExcelPath(args.path || args.filename);
  const filePath = args.overwrite ? requestedPath : uniqueWorkspaceOutputPath(requestedPath);
  const target = resolveWorkspacePath(filePath);
  const task = createOfficeTask("create-excel", { path: filePath, originalName: path.basename(filePath), fileType: path.extname(filePath).slice(1) });
  await mkdir(path.dirname(target), { recursive: true });
  officeStep(task, "保存文件", "complete", `准备输出：${filePath}`);
  officeStep(task, "识别类型", "complete", "Excel .xlsx/.xlsm");
  officeStep(task, "解析内容", "complete", "已整理工作表、表头和行数据");
  const sheets = normalizeSheetSpec(args).map(sheetDataForSpec);
  officeStep(task, "执行处理", "complete", `已生成 ${sheets.length} 个工作表数据`);
  const globalOptions = { fontFamily: "Arial", fontSize: 11 };
  if (sheets.length === 1) {
    const [sheet] = sheets;
    await writeExcelFile(sheet.data, { sheet: sheet.sheet, columns: sheet.columns, stickyRowsCount: sheet.stickyRowsCount }, globalOptions).toFile(target);
  } else {
    await writeExcelFile(sheets, globalOptions).toFile(target);
  }
  const stats = await stat(target);
  updateOfficeTaskFile(task, { path: path.relative(ctx.workspaceRoot, target), size: stats.size, supported: true, parseStatus: "generated" });
  officeStep(task, "生成结果", "complete", `已写入 ${stats.size} 字节`, { path: path.relative(ctx.workspaceRoot, target), size: stats.size });
  const verification = await verifyOfficeFilePath(path.relative(ctx.workspaceRoot, target));
  officeStep(task, "校验文件", verification.ok ? "complete" : "failed", verification.ok ? "Excel 文件可回读" : verification.reason, verification);
  if (!verification.ok) return { ok: false, path: path.relative(ctx.workspaceRoot, target), size: stats.size, error: verification.reason, verification, officeTask: finishOfficeTask(task, "failed") };
  officeStep(task, "返回用户", "complete", "Excel 文件已生成并通过校验");
  return {
    ok: true,
    path: path.relative(ctx.workspaceRoot, target),
    size: stats.size,
    sheets: sheets.map((sheet) => ({ name: sheet.sheet, rows: sheet.data.length, columns: Math.max(0, ...sheet.data.map((row) => row.length)) })),
    verification,
    verified: true,
    officeTask: finishOfficeTask(task)
  };
}

export async function readExcelWorkbook(args = {}, toolConsent = {}) {
  const filePath = String(args.path || "").trim();
  if (!filePath) { const e = new Error("请提供 Excel 文件路径"); e.status = 400; throw e; }
  if (path.extname(filePath).toLowerCase() === ".xls") return { ok: false, error: "暂不支持旧版 .xls，请先另存为 .xlsx" };
  const ext = path.extname(filePath).toLowerCase();
  if (!isExcelPath(filePath) && ![".csv", ".tsv"].includes(ext)) return { ok: false, error: "请提供 .xlsx、.xlsm、.csv 或 .tsv 文件" };
  const target = resolveToolPath(filePath, toolConsent, "read");
  const stats = await stat(target);
  if (stats.size > 25 * 1024 * 1024) return { ok: false, error: "Excel 文件超过 25MB，已拒绝读取" };
  const rowLimit = Math.max(1, Math.min(1000, Number(args.row_limit || args.rowLimit || 120)));
  if ([".csv", ".tsv"].includes(ext)) return readDelimitedTable(target, stats, rowLimit, ext === ".tsv" ? "tsv" : "csv");
  try {
    const workbook = await readExcelFile(target);
    const sheetItems = Array.isArray(workbook) && workbook.every((sheet) => sheet && typeof sheet === "object" && Array.isArray(sheet.data))
      ? workbook
      : [{ sheet: "Sheet1", data: Array.isArray(workbook) ? workbook : [] }];
    const sheetsData = sheetItems.map((sheet, index) => {
      const allRows = Array.isArray(sheet.data) ? sheet.data : [];
      const analysis = analyzeTableRows(allRows.map((row) => Array.isArray(row) ? row.map(previewValue) : [previewValue(row)]), rowLimit);
      return {
        name: String(sheet.sheet || sheet.name || `Sheet${index + 1}`),
        ...analysis
      };
    });
    return { ok: true, path: toolPathLabel(target), size: stats.size, sheets: sheetsData, reader: "read-excel-file", fileType: ext.slice(1) };
  } catch (error) {
    const fallback = await readExcelWorkbookWithOpenpyxl(target, stats, rowLimit);
    if (fallback.ok) return { ...fallback, fallbackFrom: "read-excel-file", fallbackError: error.message };
    return {
      ok: false,
      path: toolPathLabel(target),
      size: stats.size,
      error: `Excel 读取失败：${error.message}；openpyxl fallback 也失败：${fallback.error || "未知错误"}`
    };
  }
}

// ── 图片导出 ─────────────────────────────────────────────────────────────────

function imageFormatFromPath(filePath = "", requested = "") {
  const value = String(requested || "").trim().toLowerCase();
  if (["jpg", "jpeg"].includes(value)) return "jpg";
  if (value === "png") return "png";
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if ([".jpg", ".jpeg"].includes(ext)) return "jpg";
  return "png";
}

async function validateExportImageArgs(args = {}) {
  const inputPath = safeTrimmedString(args.input_path || args.path);
  const hasInlineSvg = safeTrimmedString(args.svg);
  const hasInlineHtml = safeTrimmedString(args.html || args.content);
  const outputPath = safeTrimmedString(args.output_path || args.outputPath);
  const missing = [];
  if (!inputPath && !hasInlineSvg && !hasInlineHtml) missing.push("input_path/html/svg");
  if (!outputPath) missing.push("output_path");
  if (missing.length) return missingRequiredToolArgs("export_image", missing);
  if (outputPath === "." || /[/\\]$/.test(outputPath)) {
    return { ok: false, error: "export_image 的 output_path 必须是 PNG/JPG 文件路径，不能是目录", toolArgError: true };
  }
  const ext = path.extname(outputPath).toLowerCase();
  if (ext && ![".png", ".jpg", ".jpeg"].includes(ext)) {
    return { ok: false, error: "export_image 的 output_path 必须使用 .png、.jpg 或 .jpeg 后缀", toolArgError: true };
  }
  const format = imageFormatFromPath(outputPath, args.format);
  const relOutput = ensureImageOutputPath(outputPath, format);
  const outputTarget = resolveWorkspacePath(relOutput);
  if (isWorkspaceRootPath(outputTarget)) return { ok: false, error: "export_image 不允许输出到工作区根目录", toolArgError: true };
  if (await isDirectoryPath(outputTarget)) return { ok: false, error: `export_image 的 output_path 指向目录：${path.relative(ctx.workspaceRoot, outputTarget) || "."}`, toolArgError: true };
  return { ok: true, inputPath, hasInlineSvg, hasInlineHtml, format, relOutput };
}

function ensureImageOutputPath(filePath = "", format = "png") {
  const clean = String(filePath || "").trim() || `exports/image-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;
  const parsed = path.parse(clean);
  const ext = [".png", ".jpg", ".jpeg"].includes(parsed.ext.toLowerCase()) ? parsed.ext : `.${format}`;
  return `${parsed.dir ? `${parsed.dir}/` : ""}${parsed.name || "image"}${ext}`;
}

function isFullHtml(source = "") {
  return /<!doctype html|<html[\s>]/i.test(String(source || ""));
}

function htmlDocumentFromBody(body = "", options = {}) {
  const background = options.transparent ? "transparent" : "#ffffff";
  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=${options.width}, initial-scale=1" />\n<style>\n  html, body { margin: 0; width: ${options.width}px; min-height: ${options.height}px; background: ${background}; }\n  * { box-sizing: border-box; }\n</style>\n</head>\n<body>${body}</body>\n</html>`;
}

function htmlDocumentFromSvg(svg = "", options = {}) {
  return htmlDocumentFromBody(`<div style="width:${options.width}px;height:${options.height}px;display:flex;align-items:stretch;justify-content:stretch;">${svg}</div>`, options);
}

function uniqueWorkspaceOutputPath(relPath) {
  const parsed = path.parse(String(relPath || "cleaned.xlsx"));
  let candidate = relPath;
  let counter = 2;
  while (existsSync(resolveWorkspacePath(candidate))) {
    candidate = `${parsed.dir ? `${parsed.dir}/` : ""}${parsed.name}-${counter}${parsed.ext || ".xlsx"}`;
    counter += 1;
  }
  return candidate;
}

async function renderSvgWithCanvas({ svg, outputPath, width, height, format, quality, transparent }) {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const canvas = createCanvas(width, height);
  const canvasCtx = canvas.getContext("2d");
  if (!transparent || format === "jpg") { canvasCtx.fillStyle = "#ffffff"; canvasCtx.fillRect(0, 0, width, height); }
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const image = await loadImage(dataUrl);
  canvasCtx.drawImage(image, 0, 0, width, height);
  const buffer = format === "jpg" ? canvas.toBuffer("image/jpeg", Math.round(quality * 100)) : canvas.toBuffer("image/png");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  return { ok: true, width, height, format };
}

export async function exportImage(args = {}, toolConsent = {}) {
  const validation = await validateExportImageArgs(args);
  if (!validation.ok) return validation;
  const width = clamp(Number(args.width || 1200), 128, 4096);
  const height = clamp(Number(args.height || 1600), 128, 4096);
  const quality = clamp(Number(args.quality ?? 0.92), 0.1, 1);
  const transparent = args.transparent !== false;
  const { inputPath, hasInlineSvg, hasInlineHtml, format, relOutput } = validation;

  let sourcePath = "";
  let source = hasInlineSvg || hasInlineHtml;
  let sourceType = hasInlineSvg ? "svg" : "html";

  if (!source && inputPath) {
    sourcePath = resolveToolPath(inputPath, toolConsent, "read");
    const ext = path.extname(sourcePath).toLowerCase();
    if (![".html", ".htm", ".svg"].includes(ext)) return { ok: false, error: "export_image 只支持渲染 .html 或 .svg 源文件" };
    source = await readFile(sourcePath, "utf8");
    sourceType = ext === ".svg" ? "svg" : "html";
  }

  const finalRelOutput = args.overwrite ? relOutput : uniqueWorkspaceOutputPath(relOutput);
  const outputPath = resolveWorkspacePath(finalRelOutput);
  const html = sourceType === "svg"
    ? htmlDocumentFromSvg(source, { width, height, transparent })
    : isFullHtml(source) ? source : htmlDocumentFromBody(source, { width, height, transparent });

  if (ctx.desktopMode && typeof ctx.renderImageFile === "function") {
    const result = await ctx.renderImageFile({ html, sourcePath: sourceType === "html" && sourcePath ? sourcePath : "", outputPath, width, height, format, quality, transparent });
    if (!result?.ok) return { ok: false, error: result?.error || "图片导出失败" };
  } else if (sourceType === "svg") {
    await renderSvgWithCanvas({ svg: source, outputPath, width, height, format, quality, transparent });
  } else {
    return { ok: false, error: "当前运行环境不支持 HTML 导出图片；桌面版 neo 可用" };
  }

  const stats = await stat(outputPath);
  return { ok: true, path: path.relative(ctx.workspaceRoot, outputPath), size: stats.size, width, height, format };
}

// ── 表格清洗 ─────────────────────────────────────────────────────────────────

function isTablePath(filePath) {
  return [".xlsx", ".xlsm", ".csv", ".tsv"].includes(path.extname(String(filePath || "")).toLowerCase());
}

function defaultCleanOutputPath(inputPath) {
  const parsed = path.parse(String(inputPath || "table.xlsx"));
  const baseDir = parsed.dir ? `${parsed.dir}/` : "";
  return `${baseDir}${parsed.name}-cleaned.xlsx`;
}

function workspaceRelJoin(...parts) {
  return parts.map((part) => String(part || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
}

export function ripgrepSearchArgs(query, glob = "") {
  const args = ["--line-number", "--hidden", "-g", "!node_modules", "-g", "!.git"];
  const globText = String(glob || "").trim();
  if (globText) args.push("-g", globText);
  args.push(String(query || ""), ".");
  return args;
}

async function tableCleanerScriptPath() {
  const source = path.join(rootDir, "tools", "table_cleaner.py");
  if (!source.includes(".asar")) return source;
  const content = await readFile(source, "utf8");
  const fileName = `neo-ai-table-cleaner-${process.pid}-${Date.now()}-${randomUUID().slice(0, 8)}.py`;
  const candidates = [
    ctx.appStatePath ? path.join(path.dirname(ctx.appStatePath), "tmp") : "",
    path.join(os.tmpdir(), "neo-ai"),
    path.join(ctx.workspaceRoot, ".neo-tmp")
  ].filter(Boolean);
  let lastError = null;
  for (const dir of candidates) {
    try {
      await mkdir(dir, { recursive: true });
      const target = path.join(dir, fileName);
      await writeFile(target, content, "utf8");
      return target;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("无法写入表格清洗临时脚本");
}

export async function detectPythonRuntime() {
  const candidates = process.platform === "win32"
    ? [{ file: "py", argsPrefix: ["-3"], command: "py -3" }, { file: "python", argsPrefix: [], command: "python" }, { file: "python3", argsPrefix: [], command: "python3" }]
    : [{ file: "python3", argsPrefix: [], command: "python3" }, { file: "python", argsPrefix: [], command: "python" }];
  const probe = ["import sys", "assert sys.version_info.major == 3", "print('Python ' + sys.version.split()[0])", "print(sys.executable)"].join(";");
  for (const candidate of candidates) {
    const result = await execFileResult(candidate.file, [...candidate.argsPrefix, "-c", probe], { timeout: 5000 });
    const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
    const version = lines[0] || "";
    const executablePath = lines[1] || candidate.file;
    if (result.ok && /Python\s+3\./i.test(version)) return { found: true, version, path: executablePath, ...candidate };
  }
  return { found: false, version: "", path: "", file: "", argsPrefix: [], command: process.platform === "win32" ? "python" : "python3" };
}

export async function pythonPackageInfo(runtime, packageName) {
  if (!runtime?.found) return { found: false, version: "" };
  const result = await execFileResult(runtime.file, [...runtime.argsPrefix, "-c", ["import importlib", `m=importlib.import_module(${JSON.stringify(packageName)})`, "print(getattr(m, '__version__', 'ok'))"].join(";")], { timeout: 8000 });
  return { found: result.ok, version: result.ok ? (result.stdout.trim().split("\n")[0] || "ok") : "" };
}

async function readExcelWorkbookWithOpenpyxl(target, stats, rowLimit) {
  const runtime = await detectPythonRuntime();
  if (!runtime.found) return { ok: false, error: "Excel 读取失败，且未检测到 Python 3，无法启用 openpyxl fallback" };
  const openpyxl = await pythonPackageInfo(runtime, "openpyxl");
  if (!openpyxl.found) return { ok: false, error: "Excel 读取失败，且未检测到 openpyxl，无法启用 fallback" };

  const script = String.raw`
import datetime
import json
import sys

from openpyxl import load_workbook

file_path = sys.argv[1]
row_limit = max(1, min(1000, int(sys.argv[2])))

def preview_value(value):
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)

def is_empty(value):
    return value is None or str(value).strip() == ""

def analyze(rows, preview_rows):
    column_count = max([len(row) for row in rows] + [0])
    header_row = next((row for row in rows if any(not is_empty(cell) for cell in row)), [])
    headers = []
    for idx in range(column_count):
        text = str(header_row[idx]).strip() if idx < len(header_row) and header_row[idx] is not None else ""
        headers.append(text or f"列{idx + 1}")
    empty_rows = sum(1 for row in rows if not any(not is_empty(cell) for cell in row))
    empty_columns = 0
    for idx in range(column_count):
        if all(idx >= len(row) or is_empty(row[idx]) for row in rows):
            empty_columns += 1
    seen = set()
    duplicate_rows = 0
    for row in rows:
        if not any(not is_empty(cell) for cell in row):
            continue
        key = tuple(str(cell).strip() if cell is not None else "" for cell in row)
        if key in seen:
            duplicate_rows += 1
        else:
            seen.add(key)
    amount_columns = [name for name in headers if any(token in name.lower() for token in ["金额", "收入", "支出", "费用", "成本", "利润", "价格", "单价", "总价", "余额", "amount", "price", "revenue", "cost", "profit", "fee", "money"])]
    date_columns = [name for name in headers if any(token in name.lower() for token in ["日期", "时间", "年月", "月份", "date", "time", "day", "month"])]
    return {
        "columnCount": column_count,
        "headers": headers,
        "returnedRows": len(preview_rows),
        "quality": {"emptyRows": empty_rows, "emptyColumns": empty_columns, "duplicateRows": duplicate_rows},
        "suggestedNormalization": {"amountColumns": amount_columns, "dateColumns": date_columns}
    }

workbook = load_workbook(file_path, read_only=True, data_only=True)
sheets = []
try:
    for ws in workbook.worksheets:
        rows = []
        all_rows = []
        row_count = 0
        column_count = 0
        for row in ws.iter_rows(values_only=True):
            row_count += 1
            values = [preview_value(cell) for cell in row]
            while values and values[-1] is None:
                values.pop()
            column_count = max(column_count, len(values))
            all_rows.append(["" if cell is None else cell for cell in values])
            if len(rows) < row_limit:
                rows.append(["" if cell is None else cell for cell in values])
        info = analyze(all_rows, rows)
        sheets.append({
            "name": ws.title,
            "rowCount": row_count,
            "columnCount": info["columnCount"] or column_count,
            "headers": info["headers"],
            "returnedRows": info["returnedRows"],
            "rows": rows,
            "quality": info["quality"],
            "suggestedNormalization": info["suggestedNormalization"]
        })
finally:
    workbook.close()

print(json.dumps({"ok": True, "sheets": sheets}, ensure_ascii=False))
`;

  const result = await execFileResult(runtime.file, [...runtime.argsPrefix, "-c", script, target, String(rowLimit)], { timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  if (!result.ok) return { ok: false, error: result.stderr || result.stdout || result.message || "openpyxl fallback 读取失败" };
  let data;
  try { data = JSON.parse(result.stdout); } catch {
    return { ok: false, error: "openpyxl fallback 返回内容不是有效 JSON" };
  }
  if (!data.ok) return data;
  return { ok: true, path: toolPathLabel(target), size: stats.size, sheets: Array.isArray(data.sheets) ? data.sheets : [], reader: "openpyxl-fallback" };
}

export function pythonPipCommand(runtime, packages = tableCleanerPackages) {
  const installNames = packages.map((p) => p === "charset_normalizer" ? "charset-normalizer" : p);
  if (process.platform === "win32" && !runtime?.found) {
    return ["if (Get-Command py -ErrorAction SilentlyContinue) {", `  py -3 -m pip install --upgrade ${installNames.join(" ")}`, "} elseif (Get-Command python -ErrorAction SilentlyContinue) {", `  python -m pip install --upgrade ${installNames.join(" ")}`, "} else {", '  throw "未检测到 Python，请先完成 Python 安装后重新运行补齐环境"', "}"].join("\n");
  }
  return `${runtime?.found ? runtime.command : "python3"} -m pip install --upgrade ${installNames.join(" ")}`;
}

export { tableCleanerPackages };

async function cleanTableFile(args = {}) {
  const inputPath = String(args.path || args.input_path || "").trim();
  if (!inputPath) return { ok: false, error: "请提供要清洗的表格路径" };
  if (path.extname(inputPath).toLowerCase() === ".xls") return { ok: false, error: "暂不支持旧版 .xls，请先另存为 .xlsx" };
  if (!isTablePath(inputPath)) return { ok: false, error: "表格清洗工具支持 .xlsx、.xlsm、.csv、.tsv" };

  const inputTarget = resolveToolPath(inputPath, args.toolConsent || {}, "read");
  if (!existsSync(inputTarget)) return { ok: false, error: "输入文件不存在" };

  const requestedOutput = String(args.output_path || args.outputPath || "").trim();
  const outputPath = requestedOutput || uniqueWorkspaceOutputPath(defaultCleanOutputPath(inputPath));
  if (![".xlsx", ".csv", ".tsv"].includes(path.extname(outputPath).toLowerCase())) return { ok: false, error: "输出文件请使用 .xlsx、.csv 或 .tsv 后缀" };
  const outputTarget = resolveWorkspacePath(outputPath);
  if (path.resolve(inputTarget) === path.resolve(outputTarget)) return { ok: false, error: "为避免误覆盖原始表格，请选择一个新的输出文件路径" };
  await mkdir(path.dirname(outputTarget), { recursive: true });

  const runtime = await detectPythonRuntime();
  if (!runtime.found) return { ok: false, error: "未检测到 Python 3，请先在设置里的环境检测中补齐 Python 环境" };
  const openpyxl = await pythonPackageInfo(runtime, "openpyxl");
  if (!openpyxl.found) return { ok: false, error: "未检测到 Python 表格库 openpyxl，请先在设置里的环境检测中补齐 Python 表格库" };

  const scriptPath = await tableCleanerScriptPath();
  const payload = { input_path: inputTarget, output_path: outputTarget, sheet: args.sheet || "", operations: Array.isArray(args.operations) ? args.operations : [], options: args.options && typeof args.options === "object" ? args.options : {} };
  const result = await execFileResult(runtime.file, [...runtime.argsPrefix, scriptPath, JSON.stringify(payload)], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });

  if (!result.ok) return { ok: false, error: result.stderr || result.stdout || result.message || "表格清洗失败", command: runtime.command };

  let data;
  try { data = JSON.parse(result.stdout); } catch { data = { ok: false, error: result.stdout || "表格清洗输出不是有效 JSON" }; }
  if (!data.ok) return data;

  const stats = await stat(outputTarget);
  const outputRel = path.relative(ctx.workspaceRoot, outputTarget);
  const verification = await verifyOfficeFilePath(outputRel);
  if (!verification.ok) return { ...data, ok: false, path: outputRel, input_path: toolPathLabel(inputTarget), size: stats.size, verified: false, verification, error: `清洗结果校验失败：${verification.reason}` };
  const task = createOfficeTask("clean-table", { path: outputRel, originalName: path.basename(inputPath), fileType: path.extname(outputRel).replace(/^\./, "") });
  officeStep(task, "保存文件", "complete", `源文件：${toolPathLabel(inputTarget)}`);
  officeStep(task, "识别类型", "complete", "表格文件");
  officeStep(task, "解析内容", "complete", "已读取表格行列");
  officeStep(task, "执行处理", "complete", `已执行：${JSON.stringify(data.summary || {})}`);
  officeStep(task, "生成结果", "complete", `另存为：${outputRel}`, { path: outputRel, size: stats.size });
  officeStep(task, "校验文件", "complete", "清洗结果可回读", verification);
  officeStep(task, "返回用户", "complete", "清洗结果已返回");
  updateOfficeTaskFile(task, { path: outputRel, size: stats.size, supported: true, parseStatus: "generated" });
  return { ...data, path: outputRel, input_path: toolPathLabel(inputTarget), size: stats.size, verified: true, verification, officeTask: finishOfficeTask(task) };
}

async function cleanTableFiles(args = {}, toolConsent = {}) {
  const paths = Array.isArray(args.paths) ? args.paths.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!paths.length) return { ok: false, error: "请提供要批量清洗的表格路径" };
  if (paths.length > 30) return { ok: false, error: "一次最多批量清洗 30 个表格" };
  const outputDir = String(args.output_dir || args.outputDir || "").trim();
  const results = [];
  for (const inputPath of paths) {
    const defaultOutput = defaultCleanOutputPath(inputPath);
    const outputPath = outputDir ? uniqueWorkspaceOutputPath(workspaceRelJoin(outputDir, path.basename(defaultOutput))) : uniqueWorkspaceOutputPath(defaultOutput);
    const result = await cleanTableFile({ path: inputPath, output_path: outputPath, operations: Array.isArray(args.operations) ? args.operations : [], options: args.options && typeof args.options === "object" ? args.options : {}, toolConsent });
    results.push({ input_path: inputPath, ...result });
  }
  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  return { ok: succeeded.length > 0, partial: succeeded.length > 0 && failed.length > 0, count: results.length, successCount: succeeded.length, failureCount: failed.length, paths: succeeded.map((r) => r.path), results };
}

// ── 网页工具 ─────────────────────────────────────────────────────────────────

function requireHttpUrl(value) {
  let parsed;
  try { parsed = new URL(String(value || "").trim()); } catch {
    const error = new Error("请提供有效的 http/https 地址"); error.status = 400; throw error;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    const error = new Error("只支持 http/https 地址"); error.status = 400; throw error;
  }
  return parsed;
}

async function fetchUrlBuffer(url, options = {}) {
  const maxBytes = options.maxBytes || 20 * 1024 * 1024;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 25000);
  try {
    const response = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "neo/0.8 (+https://local.neo-ai)", "Accept": options.accept || "text/html,application/xhtml+xml,text/plain,*/*;q=0.8" }
    });
    if (!response.ok) { const error = new Error(`网页请求失败：HTTP ${response.status}`); error.status = response.status; throw error; }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxBytes) { const error = new Error(`下载内容超过限制：${Math.round(maxBytes / 1024 / 1024)}MB`); error.status = 413; throw error; }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > maxBytes) { const error = new Error(`下载内容超过限制：${Math.round(maxBytes / 1024 / 1024)}MB`); error.status = 413; throw error; }
    return { response, buffer, contentType: response.headers.get("content-type") || "application/octet-stream" };
  } catch (error) {
    if (error.name === "AbortError") { const te = new Error("网页请求超时"); te.status = 408; throw te; }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntities(text = "") {
  const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return String(text).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase();
    if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(parseInt(key.slice(1), 10));
    return named[key] ?? match;
  });
}

function compactWhitespace(text = "") {
  return String(text).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

export function htmlToText(html = "") {
  if (html == null) return "";
  return compactWhitespace(decodeHtmlEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|section|article|header|footer|main|aside|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  ));
}

function htmlTitle(html = "") {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? compactWhitespace(decodeHtmlEntities(match[1])) : "";
}

function htmlMetaDescription(html = "") {
  const match = String(html).match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    || String(html).match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  return match ? compactWhitespace(decodeHtmlEntities(match[1])) : "";
}

function extractLinks(html = "", baseUrl = "", limit = 30) {
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(String(html))) && links.length < limit) {
    const rawHref = decodeHtmlEntities(match[1]).trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:")) continue;
    let href;
    try { href = new URL(rawHref, baseUrl).toString(); } catch { continue; }
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({ text: htmlToText(match[2]).slice(0, 180) || href, url: href });
  }
  return links;
}

function inferDownloadName(url, contentType = "") {
  const safeBase = safeAttachmentFileName(path.basename(decodeURIComponent(url.pathname || "")) || "download");
  if (path.extname(safeBase)) return safeBase;
  if (/html/i.test(contentType)) return `${safeBase}.html`;
  if (/json/i.test(contentType)) return `${safeBase}.json`;
  if (/pdf/i.test(contentType)) return `${safeBase}.pdf`;
  if (/csv/i.test(contentType)) return `${safeBase}.csv`;
  if (/text/i.test(contentType)) return `${safeBase}.txt`;
  return safeBase;
}

function markdownForWebPage({ url, title, description, text, links }) {
  return [`# ${title || url}`, "", `来源：${url}`, description ? `摘要：${description}` : "", "", "## 正文", text || "", links?.length ? "\n## 链接" : "", ...(links || []).slice(0, 30).map((link) => `- [${link.text || link.url}](${link.url})`)].filter(Boolean).join("\n");
}

async function readWebPage(args = {}) {
  const url = requireHttpUrl(args.url);
  const maxChars = clamp(Number(args.max_chars || args.maxChars || 12000), 1000, 60000);
  const { response, buffer, contentType } = await fetchUrlBuffer(url, { maxBytes: 12 * 1024 * 1024 });
  const raw = buffer.toString("utf8");
  const isHtml = /html|xml/i.test(contentType) || /<\/?[a-z][\s\S]*>/i.test(raw.slice(0, 2000));
  const title = isHtml ? htmlTitle(raw) : "";
  const description = isHtml ? htmlMetaDescription(raw) : "";
  const fullText = isHtml ? htmlToText(raw) : compactWhitespace(raw);
  const links = isHtml ? extractLinks(raw, response.url || url.toString(), 30) : [];
  const text = fullText.length > maxChars ? `${fullText.slice(0, maxChars)}\n...[内容过长已截断]` : fullText;
  const outputPath = String(args.output_path || args.outputPath || "").trim();
  let savedPath = "";
  if (outputPath) {
    const target = resolveWorkspacePath(outputPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, markdownForWebPage({ url: response.url || url.toString(), title, description, text: fullText, links }), "utf8");
    savedPath = path.relative(ctx.workspaceRoot, target);
  }
  return { ok: true, url: response.url || url.toString(), status: response.status, contentType, title, description, text, textChars: fullText.length, truncated: fullText.length > maxChars, links, path: savedPath };
}

// ── 搜索引擎（多引擎兜底 + Brave Search）──────────────────────────────────────

function duckDuckGoRedirectUrl(value) {
  try { const parsed = new URL(value); const uddg = parsed.searchParams.get("uddg"); return uddg ? decodeURIComponent(uddg) : value; } catch { return value; }
}

function parseDuckDuckGoHtml(html, baseUrl, limit) {
  const results = [];
  const seen = new Set();
  const blockRe = /<div[^>]+class="[^"]*result__body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  const titleRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
  const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i;
  let block;
  while ((block = blockRe.exec(html)) && results.length < limit) {
    const body = block[1];
    const titleMatch = titleRe.exec(body);
    const snippetMatch = snippetRe.exec(body);
    if (!titleMatch) continue;
    const rawHref = decodeHtmlEntities(titleMatch[1]).trim();
    const resolvedUrl = duckDuckGoRedirectUrl(rawHref);
    if (!/^https?:\/\//.test(resolvedUrl) || /duckduckgo\.com/i.test(resolvedUrl)) continue;
    const key = resolvedUrl.replace(/#.*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ title: htmlToText(titleMatch[2]).trim(), url: resolvedUrl, snippet: snippetMatch ? htmlToText(snippetMatch[1]).trim() : "" });
  }
  if (!results.length) {
    const links = extractLinks(html, baseUrl, 80).map((link) => ({ ...link, url: duckDuckGoRedirectUrl(link.url) })).filter((link) => /^https?:\/\//.test(link.url) && !/duckduckgo\.com/i.test(link.url));
    for (const link of links) {
      const key = link.url.replace(/#.*$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ title: link.text, url: link.url, snippet: "" });
      if (results.length >= limit) break;
    }
  }
  return results;
}

function parseBraveHtml(html, baseUrl, limit) {
  const results = [];
  const seen = new Set();
  // Brave 搜索结果链接通常在 <a class="result-header"> 或 <a class="h"> 内
  const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = re.exec(html)) && results.length < limit) {
    const url = match[1];
    if (/brave\.com/i.test(url)) continue;
    const key = url.replace(/#.*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ title: htmlToText(match[2]).trim() || url, url, snippet: "" });
  }
  // 如没找到，退回通用链接提取
  if (!results.length) {
    for (const link of extractLinks(html, baseUrl, 80)) {
      if (/brave\.com/i.test(link.url)) continue;
      const key = link.url.replace(/#.*$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ title: link.text, url: link.url, snippet: "" });
      if (results.length >= limit) break;
    }
  }
  return results;
}

async function searchWeb(args = {}) {
  const query = String(args.query || "").trim();
  if (!query) return { ok: false, error: "缺少搜索关键词" };
  const limit = clamp(Number(args.limit || 8), 1, 12);

  const engines = [
    { name: "DuckDuckGo", url: "https://duckduckgo.com/html/", params: { q: query, kl: "cn-zh" }, parse: parseDuckDuckGoHtml },
    { name: "DuckDuckGo Lite", url: "https://lite.duckduckgo.com/lite/", params: { q: query }, parse: parseDuckDuckGoHtml },
    { name: "Brave", url: "https://search.brave.com/search", params: { q: query, source: "web" }, parse: parseBraveHtml },
  ];

  const errors = [];
  for (const engine of engines) {
    try {
      const reqUrl = new URL(engine.url);
      for (const [k, v] of Object.entries(engine.params)) reqUrl.searchParams.set(k, v);
      const { response, buffer } = await fetchUrlBuffer(reqUrl, { maxBytes: 5 * 1024 * 1024, timeoutMs: 20000 });
      const html = buffer.toString("utf8");
      const results = engine.parse(html, response.url || reqUrl.toString(), limit);
      if (results.length) return { ok: true, query, results, engine: engine.name };
    } catch (err) {
      errors.push(`${engine.name}: ${err.message}`);
    }
  }
  return { ok: false, error: `所有搜索引擎均不可用：${errors.join("；")}`, query };
}

async function downloadUrl(args = {}) {
  const url = requireHttpUrl(args.url);
  const { response, buffer, contentType } = await fetchUrlBuffer(url, { maxBytes: 60 * 1024 * 1024, accept: "*/*" });
  const outputPath = String(args.output_path || args.outputPath || "").trim()
    || path.join("Downloads", inferDownloadName(new URL(response.url || url.toString()), contentType));
  const target = resolveWorkspacePath(outputPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  return { ok: true, url: response.url || url.toString(), path: path.relative(ctx.workspaceRoot, target), size: buffer.length, contentType };
}

async function openUrl(args = {}) {
  const url = requireHttpUrl(args.url).toString();
  if (typeof ctx.openExternalUrl === "function") { await ctx.openExternalUrl(url); return { ok: true, url }; }
  const result = await openUrlFallback(url);
  return result.ok ? { ok: true, url } : { ok: false, error: result.stderr || result.message || "无法打开链接" };
}

async function openWorkspaceItem(args = {}) {
  const relPath = String(args.path || "").trim();
  if (!relPath) return { ok: false, error: "请提供工作区路径" };
  const target = resolveWorkspacePath(relPath);
  if (!existsSync(target)) return { ok: false, error: "文件或文件夹不存在" };
  const reveal = Boolean(args.reveal);
  if (reveal && typeof ctx.showWorkspacePath === "function") { await ctx.showWorkspacePath(target); return { ok: true, path: path.relative(ctx.workspaceRoot, target), reveal }; }
  if (!reveal && typeof ctx.openWorkspacePath === "function") { const r = await ctx.openWorkspacePath(target); if (r) return { ok: false, error: String(r) }; return { ok: true, path: path.relative(ctx.workspaceRoot, target), reveal }; }
  const result = await openPathFallback(target, reveal);
  return result.ok ? { ok: true, path: path.relative(ctx.workspaceRoot, target), reveal } : { ok: false, error: result.stderr || result.message || "无法打开" };
}

async function openDesktopApp(args = {}) {
  const appName = String(args.app || "").trim();
  if (!appName) return { ok: false, error: "请提供应用名称或路径" };
  if (path.isAbsolute(appName) && existsSync(appName)) {
    const result = await openPathFallback(appName, false);
    return result.ok ? { ok: true, app: appName } : { ok: false, error: result.stderr || result.message || "无法打开应用" };
  }
  const result = await openDesktopAppFallback(appName);
  return result.ok ? { ok: true, app: appName } : { ok: false, error: result.stderr || result.message || "无法打开应用" };
}

async function showDesktopNotification(args = {}) {
  const title = String(args.title || "neo").trim().slice(0, 120) || "neo";
  const message = String(args.message || "").trim().slice(0, 500);
  if (typeof ctx.notifyDesktop === "function") { await ctx.notifyDesktop(title, message); return { ok: true, title, message }; }
  if (process.platform === "darwin") {
    const result = await runCommand(`osascript -e ${shellQuote(`display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`)}`, 8000);
    return result.ok ? { ok: true, title, message } : { ok: false, error: result.stderr || result.message || "无法显示通知" };
  }
  return { ok: false, error: "当前运行方式暂不支持系统通知，请使用桌面端启动" };
}

// ── PDF / DOCX 读取 ────────────────────────────────────────────────────────

async function readPdfTextWithPdfJs(target) {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await readFile(target)),
    disableWorker: true,
    useSystemFonts: true
  });
  const pdf = await loadingTask.promise;
  try {
    const pages = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) pages.push(pageText);
    }
    return pages.join("\n\n");
  } finally {
    try { await pdf.destroy(); } catch {}
    try { await loadingTask.destroy(); } catch {}
  }
}

function estimatePdfPageCount(buffer) {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g) || [];
  return Math.max(0, matches.length);
}

async function readPdfDocument(target, maxPages = 40) {
  const buffer = await readFile(target);
  const estimatedPages = estimatePdfPageCount(buffer);
  let parser = null;
  try {
    const PDFParse = await loadPdfParser();
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText({ first: maxPages });
    const text = result.text || "";
    const pageCount = Number(result.total || result.numpages || result.numPages || estimatedPages || 0);
    const pages = compactTextLines(text.split(/\f|\n{3,}/)).map((pageText, index) => ({ page: index + 1, text: pageText }));
    return {
      ok: true,
      pageCount: pageCount || pages.length || estimatedPages,
      returnedPages: pages.length || Math.min(pageCount || estimatedPages || 0, maxPages),
      pages: pages.slice(0, maxPages),
      text,
      ...textStats(text),
      truncated: Boolean((pageCount || estimatedPages) > maxPages)
    };
  } catch (error) {
    try {
      const text = await readPdfTextWithPdfJs(target);
      const pages = compactTextLines(text.split(/\n{2,}/)).map((pageText, index) => ({ page: index + 1, text: pageText }));
      return {
        ok: true,
        pageCount: estimatedPages || pages.length,
        returnedPages: pages.length,
        pages,
        text,
        ...textStats(text),
        truncated: Boolean(estimatedPages > maxPages)
      };
    } catch (fallbackError) {
      throw new Error(`PDF 解析失败：${error.message}；回退失败：${fallbackError.message}`);
    }
  } finally {
    try { await parser?.destroy?.(); } catch {}
  }
}

async function readPdfText(target) {
  let PDFParse;
  try { PDFParse = await loadPdfParser(); }
  catch (error) {
    try { return await readPdfTextWithPdfJs(target); }
    catch (fallbackError) { return `[PDF 解析库加载失败：${error.message}；回退失败：${fallbackError.message}]`; }
  }

  const parser = new PDFParse({ data: await readFile(target) });
  try { const result = await parser.getText({ first: 40 }); return result.text || ""; }
  catch (error) {
    try { return await readPdfTextWithPdfJs(target); }
    catch (fallbackError) { return `[PDF 解析失败：${error.message}；回退失败：${fallbackError.message}]`; }
  }
  finally { try { await parser.destroy(); } catch {} }
}

async function readDocxText(target) {
  const result = await mammoth.extractRawText({ path: target });
  return result.value || "";
}

async function readDocxDocument(target) {
  const text = await readDocxText(target);
  let tableCount = 0;
  try {
    const entries = readZipEntries(await readFile(target));
    const documentXml = entries.get("word/document.xml")?.toString("utf8") || "";
    tableCount = (documentXml.match(/<w:tbl[\s>]/g) || []).length;
  } catch {
    tableCount = 0;
  }
  return {
    ok: true,
    text,
    tableCount,
    ...textStats(text),
    tableHints: tableCount ? [`检测到 ${tableCount} 个 Word 表格`] : textStats(text).tableHints
  };
}

function extractAtext(xml = "") {
  const values = [];
  const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  let match;
  while ((match = re.exec(xml))) values.push(xmlDecode(match[1]));
  return values;
}

async function readPptxPresentation(target) {
  const entries = readZipEntries(await readFile(target));
  const slideNames = [...entries.keys()]
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/)?.[1] || 0));
  const slides = slideNames.map((name, index) => {
    const texts = extractAtext(entries.get(name)?.toString("utf8") || "");
    const title = texts[0] || `第 ${index + 1} 页`;
    const body = texts.slice(1).join("\n");
    return { index: index + 1, title, body, text: texts.join("\n") };
  });
  const text = slides.map((slide) => [slide.title, slide.body].filter(Boolean).join("\n")).join("\n\n");
  return {
    ok: true,
    slideCount: slides.length,
    slides,
    text,
    ...textStats(text)
  };
}

function ensureDocxPath(filePath = "") {
  const raw = String(filePath || "document.docx").trim() || "document.docx";
  const ext = path.extname(raw).toLowerCase();
  if (!ext) return `${raw}.docx`;
  if (ext !== ".docx") {
    const error = new Error("Word 工具只支持生成 .docx 文件");
    error.status = 400;
    throw error;
  }
  return raw;
}

function ensurePptxPath(filePath = "") {
  const raw = String(filePath || "presentation.pptx").trim() || "presentation.pptx";
  const ext = path.extname(raw).toLowerCase();
  if (!ext) return `${raw}.pptx`;
  if (ext !== ".pptx") {
    const error = new Error("PPT 工具只支持生成 .pptx 文件");
    error.status = 400;
    throw error;
  }
  return raw;
}

async function createWordDocument(args = {}) {
  const relPath = args.overwrite ? ensureDocxPath(args.path || args.filename) : uniqueWorkspaceOutputPath(ensureDocxPath(args.path || args.filename));
  const target = resolveWorkspacePath(relPath);
  const task = createOfficeTask("create-word", { path: relPath, originalName: path.basename(relPath) });
  try {
    officeStep(task, "保存文件", "complete", `准备输出：${relPath}`);
    updateOfficeTaskFile(task, { path: path.relative(ctx.workspaceRoot, target), fileType: "docx", supported: true });
    officeStep(task, "识别类型", "complete", "Word .docx");
    officeStep(task, "解析内容", "complete", "已整理标题、段落、章节和表格输入");
    officeStep(task, "执行处理", "complete", "已生成 Word OOXML 内容");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, docxPackage(args));
    const stats = await stat(target);
    updateOfficeTaskFile(task, { size: stats.size, parseStatus: "generated" });
    officeStep(task, "生成结果", "complete", `已写入 ${stats.size} 字节`, { path: path.relative(ctx.workspaceRoot, target), size: stats.size });
    const verification = await verifyOfficeFilePath(path.relative(ctx.workspaceRoot, target));
    officeStep(task, "校验文件", verification.ok ? "complete" : "failed", verification.ok ? "Word 文件可回读" : verification.reason, verification);
    if (!verification.ok) return { ok: false, path: path.relative(ctx.workspaceRoot, target), size: stats.size, error: verification.reason, verification, officeTask: finishOfficeTask(task, "failed") };
    officeStep(task, "返回用户", "complete", "Word 文件已生成并通过校验");
    return { ok: true, path: path.relative(ctx.workspaceRoot, target), size: stats.size, verification, verified: true, officeTask: finishOfficeTask(task) };
  } catch (error) {
    officeStep(task, task.steps.find((step) => step.status === "pending")?.name || "执行处理", "failed", error.message);
    return { ok: false, error: error.message, officeTask: finishOfficeTask(task, "failed") };
  }
}

async function createPptPresentation(args = {}) {
  const relPath = args.overwrite ? ensurePptxPath(args.path || args.filename) : uniqueWorkspaceOutputPath(ensurePptxPath(args.path || args.filename));
  const target = resolveWorkspacePath(relPath);
  const task = createOfficeTask("create-ppt", { path: relPath, originalName: path.basename(relPath) });
  try {
    officeStep(task, "保存文件", "complete", `准备输出：${relPath}`);
    updateOfficeTaskFile(task, { path: path.relative(ctx.workspaceRoot, target), fileType: "pptx", supported: true });
    officeStep(task, "识别类型", "complete", "PowerPoint .pptx");
    officeStep(task, "解析内容", "complete", "已整理封面、目录、内容页和总结页输入");
    const { buffer, slides } = pptxPackage(args);
    officeStep(task, "执行处理", "complete", `已生成 ${slides.length} 页 PPT OOXML 内容`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    const stats = await stat(target);
    updateOfficeTaskFile(task, { size: stats.size, parseStatus: "generated" });
    officeStep(task, "生成结果", "complete", `已写入 ${stats.size} 字节`, { path: path.relative(ctx.workspaceRoot, target), size: stats.size, slideCount: slides.length });
    const verification = await verifyOfficeFilePath(path.relative(ctx.workspaceRoot, target));
    officeStep(task, "校验文件", verification.ok ? "complete" : "failed", verification.ok ? "PPT 文件可回读" : verification.reason, verification);
    if (!verification.ok) return { ok: false, path: path.relative(ctx.workspaceRoot, target), size: stats.size, error: verification.reason, verification, officeTask: finishOfficeTask(task, "failed") };
    officeStep(task, "返回用户", "complete", "PPT 文件已生成并通过校验");
    return { ok: true, path: path.relative(ctx.workspaceRoot, target), size: stats.size, slideCount: slides.length, verification, verified: true, officeTask: finishOfficeTask(task) };
  } catch (error) {
    officeStep(task, task.steps.find((step) => step.status === "pending")?.name || "执行处理", "failed", error.message);
    return { ok: false, error: error.message, officeTask: finishOfficeTask(task, "failed") };
  }
}

export async function verifyOfficeFilePath(filePath, toolConsent = {}) {
  const target = resolveToolPath(filePath, toolConsent, "read");
  const relPath = toolPathLabel(target);
  const type = officeFileType(target);
  try {
    const stats = await stat(target);
    const base = { path: relPath, exists: true, size: stats.size, fileType: type.fileType, kind: type.kind, supported: type.supported };
    if (!stats.isFile()) return { ...base, ok: false, reason: "不是普通文件" };
    if (stats.size <= 0) return { ...base, ok: false, reason: "文件为空" };
    if (!type.supported) return { ...base, ok: false, reason: type.error || "不支持的文件类型" };
    if (["xlsx", "xlsm", "csv", "tsv"].includes(type.fileType)) {
      const workbook = await readExcelWorkbook({ path: relPath, row_limit: 5 }, toolConsent);
      const rows = (workbook.sheets || []).reduce((sum, sheet) => sum + Number(sheet.rowCount || 0), 0);
      return { ...base, ok: Boolean(workbook.ok && workbook.sheets?.length && rows >= 0), details: { sheets: workbook.sheets?.length || 0, rows, workbook }, reason: workbook.ok ? "" : workbook.error || "表格无法回读" };
    }
    if (type.fileType === "docx") {
      const doc = await readDocxDocument(target);
      return { ...base, ok: doc.ok && doc.textChars > 0, details: doc, reason: doc.textChars > 0 ? "" : "Word 文档无可回读文字" };
    }
    if (type.fileType === "pdf") {
      const pdf = await readPdfDocument(target);
      return { ...base, ok: pdf.ok && pdf.pageCount > 0, details: pdf, reason: pdf.pageCount > 0 ? "" : "PDF 无可回读页数" };
    }
    if (type.fileType === "pptx") {
      const ppt = await readPptxPresentation(target);
      return { ...base, ok: ppt.ok && ppt.slideCount > 0, details: ppt, reason: ppt.slideCount > 0 ? "" : "PPT 无可回读页数" };
    }
    return { ...base, ok: true, reason: "" };
  } catch (error) {
    return { path: relPath, exists: existsSync(target), size: 0, fileType: type.fileType, kind: type.kind, supported: type.supported, ok: false, reason: error.message || "文件校验失败" };
  }
}

async function verifyOfficeFile(args = {}, toolConsent = {}) {
  const filePath = String(args.path || "").trim();
  if (!filePath) return missingRequiredToolArgs("verify_office_file", ["path"]);
  const task = createOfficeTask("verify", { path: filePath, originalName: path.basename(filePath) });
  officeStep(task, "保存文件", "complete", "校验已有文件");
  const type = officeFileType(filePath);
  updateOfficeTaskFile(task, { fileType: type.fileType, supported: type.supported });
  officeStep(task, "识别类型", type.supported ? "complete" : "failed", type.supported ? type.label : type.error, type);
  if (!type.supported) return { ok: false, error: type.error, officeTask: finishOfficeTask(task, "failed") };
  officeStep(task, "解析内容", "complete", "准备按文件类型回读");
  const verification = await verifyOfficeFilePath(filePath, toolConsent);
  officeStep(task, "校验文件", verification.ok ? "complete" : "failed", verification.ok ? "校验通过" : verification.reason, verification);
  if (!verification.ok) return { ok: false, error: verification.reason, verification, officeTask: finishOfficeTask(task, "failed") };
  officeStep(task, "返回用户", "complete", "文件校验通过");
  return { ok: true, ...verification, verification, officeTask: finishOfficeTask(task) };
}

async function inspectOfficeFile(args = {}, toolConsent = {}) {
  const filePath = String(args.path || "").trim();
  if (!filePath) return missingRequiredToolArgs("inspect_office_file", ["path"]);
  const target = resolveToolPath(filePath, toolConsent, "read");
  const relPath = toolPathLabel(target);
  const stats = await stat(target);
  const type = officeFileType(target);
  const task = createOfficeTask("inspect", { path: relPath, originalName: args.originalName || path.basename(relPath), size: stats.size, fileType: type.fileType });
  officeStep(task, "保存文件", "complete", "文件已保存或已定位", { path: relPath, size: stats.size });
  updateOfficeTaskFile(task, { path: relPath, size: stats.size, fileType: type.fileType, supported: type.supported });
  officeStep(task, "识别类型", type.supported ? "complete" : "failed", type.supported ? type.label : type.error, type);
  if (!type.supported) {
    updateOfficeTaskFile(task, { parseStatus: "unsupported" });
    return { ok: false, path: relPath, size: stats.size, fileType: type.fileType, supported: false, error: type.error, officeTask: finishOfficeTask(task, "failed") };
  }
  const rowLimit = Math.max(1, Math.min(1000, Number(args.row_limit || args.rowLimit || 80)));
  try {
    let payload;
    if (["xlsx", "xlsm", "csv", "tsv"].includes(type.fileType)) {
      payload = await readExcelWorkbook({ path: relPath, row_limit: rowLimit }, toolConsent);
      if (!payload.ok) throw new Error(payload.error || "表格解析失败");
      officeStep(task, "解析内容", "complete", `已解析 ${payload.sheets?.length || 0} 个工作表`, payload.sheets);
    } else if (type.fileType === "docx") {
      payload = await readDocxDocument(target);
      officeStep(task, "解析内容", "complete", `已解析 ${payload.paragraphCount || 0} 个段落`, payload);
    } else if (type.fileType === "pdf") {
      payload = await readPdfDocument(target);
      officeStep(task, "解析内容", "complete", `已解析 ${payload.pageCount || 0} 页 PDF`, payload);
    } else if (type.fileType === "pptx") {
      payload = await readPptxPresentation(target);
      officeStep(task, "解析内容", "complete", `已解析 ${payload.slideCount || 0} 页 PPT`, payload);
    }
    updateOfficeTaskFile(task, { parseStatus: "parsed", truncated: Boolean(payload?.truncated) });
    officeStep(task, "执行处理", "complete", "本轮为读取/检查任务，无需修改源文件");
    officeStep(task, "生成结果", "complete", "已生成结构化检查结果");
    const verification = await verifyOfficeFilePath(relPath, toolConsent);
    officeStep(task, "校验文件", verification.ok ? "complete" : "failed", verification.ok ? "源文件可回读" : verification.reason, verification);
    if (!verification.ok) return { ok: false, path: relPath, size: stats.size, fileType: type.fileType, error: verification.reason, verification, officeTask: finishOfficeTask(task, "failed") };
    officeStep(task, "返回用户", "complete", "检查结果已返回");
    return {
      ok: true,
      path: relPath,
      size: stats.size,
      fileType: type.fileType,
      kind: type.kind,
      supported: true,
      parseStatus: "parsed",
      truncated: Boolean(payload?.truncated),
      summary: officeSummaryForPayload(type, payload),
      ...payload,
      verification,
      officeTask: finishOfficeTask(task)
    };
  } catch (error) {
    updateOfficeTaskFile(task, { parseStatus: "failed" });
    officeStep(task, "解析内容", "failed", error.message);
    return { ok: false, path: relPath, size: stats.size, fileType: type.fileType, supported: true, parseStatus: "failed", error: error.message, officeTask: finishOfficeTask(task, "failed") };
  }
}

function officeSummaryForPayload(type, payload = {}) {
  if (["xlsx", "xlsm", "csv", "tsv"].includes(type.fileType)) {
    const sheets = (payload.sheets || []).map((sheet) => `${sheet.name}: ${sheet.rowCount || 0} 行 x ${sheet.columnCount || 0} 列`).join("；");
    return `${type.label}，${payload.sheets?.length || 0} 个工作表/表：${sheets}`;
  }
  if (type.fileType === "docx") return `Word 文档，${payload.paragraphCount || 0} 段，约 ${payload.wordCount || 0} 字/词，表格线索 ${payload.tableCount || 0} 个`;
  if (type.fileType === "pdf") return `PDF 文档，${payload.pageCount || 0} 页，已返回 ${payload.returnedPages || 0} 页文字`;
  if (type.fileType === "pptx") return `PPT 文档，${payload.slideCount || 0} 页，已提取每页标题和正文`;
  return type.label;
}

// ── 附件工具 ─────────────────────────────────────────────────────────────────

function safeAttachmentFileName(name) {
  const base = path.basename(String(name || "attachment"));
  return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "attachment";
}

export function attachmentRelativePath(name) {
  const date = new Date().toISOString().slice(0, 10);
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = randomUUID().slice(0, 8);
  return path.join("neo Attachments", date, `${stamp}-${suffix}-${safeAttachmentFileName(name)}`);
}

export function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const mediaType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  return { mediaType, buffer: isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8") };
}

export function attachmentSummary({ kind, relPath, size, content, workbook, office }) {
  if (office?.ok && office.summary) return `${office.summary}；原文件已保存到工作区`;
  if (workbook?.ok && Array.isArray(workbook.sheets)) {
    const sheets = workbook.sheets.map((s) => `${s.name || "Sheet"} ${s.rowCount || 0} 行 x ${s.columnCount || 0} 列`).join("；");
    return `Excel 已保存到工作区，${workbook.sheets.length} 个工作表：${sheets}`;
  }
  if (kind === "image") return `图片已保存到工作区，大小 ${size || 0} 字节`;
  if (content) return `已解析 ${String(content).length} 个字符，原文件已保存到工作区`;
  return `原文件已保存到工作区：${relPath}`;
}

export async function attachmentContentForPath(relPath, providedContent = "") {
  const ext = path.extname(relPath).toLowerCase();
  let content = String(providedContent || "");
  let workbook = null;
  let office = null;
  const target = resolveWorkspacePath(relPath);
  try {
    const type = officeFileType(relPath);
    if (type.supported && type.kind !== "file" && type.kind !== "image") {
      office = await inspectOfficeFile({ path: relPath, row_limit: 80 });
    }
    if (isExcelPath(relPath) || [".csv", ".tsv"].includes(ext)) {
      workbook = await readExcelWorkbook({ path: relPath, row_limit: 80 });
      if (workbook?.ok) content = JSON.stringify(workbook, null, 2);
    } else if (ext === ".pdf" && (!content || content.startsWith("[PDF 解析库未加载]"))) {
      content = await readPdfText(target);
    } else if (ext === ".docx" && (!content || content.startsWith("[DOCX 解析库未加载]"))) {
      content = await readDocxText(target);
    } else if (!content && isTextLikePath(relPath)) {
      content = await readFile(target, "utf8");
    } else if (ext === ".xls" && !content) {
      content = "旧版 .xls 已保存，但当前内置解析器不能直接读取，请先另存为 .xlsx。";
    }
  } catch (error) {
    if (!content) content = `文件已保存，但解析失败：${error.message}`;
  }
  const limit = 60000;
  return { content: content.length > limit ? `${content.slice(0, limit)}\n...[内容过长已截断]` : content, contentChars: content.length, truncated: content.length > limit, workbook, office };
}

// ── handleToolCall ───────────────────────────────────────────────────────────

export async function handleToolCall(name, args, toolConsent = {}) {
  if (permissionKeysForTool(name).length && !isToolAllowedByConsent(name, toolConsent)) {
    return { ok: false, error: `需要先授权：${permissionLabelForTool(name)}` };
  }
  if (name === "list_files") {
    const target = resolveWorkspacePath(args.path || ".");
    const entries = await readdir(target, { withFileTypes: true });
    return entries.filter((e) => e.name !== "node_modules" && e.name !== ".git").slice(0, 200).map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" }));
  }
  if (name === "read_file") {
    const target = resolveToolPath(args.path, toolConsent, "read");
    if (isExcelPath(target) || [".xls", ".csv", ".tsv"].includes(path.extname(target).toLowerCase())) return readExcelWorkbook(args, toolConsent);
    const ext = path.extname(target).toLowerCase();
    if (ext === ".pdf") { const pdf = await readPdfDocument(target); return { ok: true, path: toolPathLabel(target), content: pdf.text, ...pdf }; }
    if (ext === ".docx") { const doc = await readDocxDocument(target); return { ok: true, path: toolPathLabel(target), content: doc.text, ...doc }; }
    if (ext === ".pptx") { const ppt = await readPptxPresentation(target); return { ok: true, path: toolPathLabel(target), content: ppt.text, ...ppt }; }
    if (ext === ".doc") return { ok: false, error: "旧版 .doc 暂不支持直接读取，请另存为 .docx 后再试" };
    if (ext === ".ppt") return { ok: false, error: "旧版 .ppt 暂不支持直接读取，请另存为 .pptx 后再试" };
    const stats = await stat(target);
    if (stats.size > 250_000) return { ok: false, error: "文件过大，已拒绝读取" };
    return { ok: true, path: toolPathLabel(target), content: await readFile(target, "utf8") };
  }
  if (name === "inspect_office_file") return inspectOfficeFile(args, toolConsent);
  if (name === "read_excel_file") return readExcelWorkbook(args, toolConsent);
  if (name === "write_file") {
    const validation = await validateWriteFileArgs(args);
    if (!validation.ok) return validation;
    const target = validation.target;
    if (isExcelPath(target)) return { ok: false, error: "请使用 create_excel_file 工具生成真实 .xlsx 文件" };
    if ([".docx", ".pptx", ".pdf"].includes(path.extname(target).toLowerCase())) return { ok: false, error: "Office/PDF 二进制文件不能用 write_file 写入；请使用 create_word_file、create_ppt_file 或专用导出工具" };
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, String(args.content ?? ""), "utf8");
    return { ok: true, path: path.relative(ctx.workspaceRoot, target) };
  }
  if (name === "export_image") return exportImage(args, toolConsent);
  if (name === "create_excel_file") return createExcelWorkbook(args);
  if (name === "create_word_file") return createWordDocument(args);
  if (name === "create_ppt_file") return createPptPresentation(args);
  if (name === "clean_table_file") return cleanTableFile({ ...args, toolConsent });
  if (name === "clean_table_files") return cleanTableFiles(args, toolConsent);
  if (name === "verify_office_file") return verifyOfficeFile(args, toolConsent);
  if (name === "search_files") {
    const query = String(args.query || "");
    if (!query.trim()) return { ok: false, error: "缺少搜索内容" };
    return execFileResult("rg", ripgrepSearchArgs(query, args.glob), { timeout: 15000 });
  }
  if (name === "search_web") return searchWeb(args);
  if (name === "read_web_page") return readWebPage(args);
  if (name === "download_url") return downloadUrl(args);
  if (name === "open_url") return openUrl(args);
  if (name === "open_workspace_item") return openWorkspaceItem(args);
  if (name === "open_desktop_app") return openDesktopApp(args);
  if (name === "show_desktop_notification") return showDesktopNotification(args);
  if (name === "run_command") {
    const validation = validateRunCommandArgs(args);
    if (!validation.ok) return validation;
    return runCommand(validation.command, 30000);
  }
  return { ok: false, error: `未知工具：${name}` };
}
