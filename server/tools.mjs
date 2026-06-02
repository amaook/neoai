// server/tools.mjs — 工具定义、实现与 handleToolCall
import { readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import readExcelFile from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";
import mammoth from "mammoth";

import { ctx, rootDir } from "./context.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const tableCleanerPackages = ["openpyxl", "charset_normalizer"];
let PDFParseClass = null;

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

// ── 工具映射 ────────────────────────────────────────────────────────────────

export const skillToolMap = {
  "local-files": ["list_files", "read_file", "write_file", "export_image", "search_files"],
  "spreadsheet-pro": ["read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files"],
  "document-reader": ["read_file"],
  "finance-tables": ["read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files"],
  "code-review": ["list_files", "read_file", "search_files"],
  "web-browser": ["search_web", "read_web_page", "download_url", "open_url"],
  "desktop-control": ["open_url", "open_desktop_app", "open_workspace_item", "show_desktop_notification"],
  "local-command": ["run_command"]
};

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
      description: "Read a text file from the local workspace. For .xlsx files, returns a workbook preview.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Workspace-relative file path." } },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_excel_file",
      description: "Read a real .xlsx workbook from the local workspace and return sheet rows.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative .xlsx file path." },
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
      description: "Create a real .xlsx file in the local workspace from columns and rows.",
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
    tools: ["list_files", "read_file", "write_file", "export_image", "search_files"],
    prompt: "你是本地文件助手子智能体。优先使用工作区相对路径；写入文件前确认路径清晰；用户要海报、封面、卡片、图片版结果时，先生成 HTML/SVG，再调用 export_image 导出真实 PNG/JPG；不要删除或覆盖用户未明确要求修改的文件。"
  },
  "spreadsheet-pro": {
    name: "表格处理",
    tools: ["read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files"],
    prompt: "你是表格处理子智能体。遇到 Excel/CSV 时先读取结构和字段，再处理；清洗表格默认另存新文件；批量任务优先使用 clean_table_files。"
  },
  "document-reader": {
    name: "文档阅读",
    tools: ["read_file"],
    prompt: "你是文档阅读子智能体。先给关键信息和待办，再补充证据位置；内容过长时分段总结。"
  },
  "finance-tables": {
    name: "财务表格",
    tools: ["read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files"],
    prompt: "你是财务表格子智能体。处理金额、税费、合计和对账时必须严谨，主动说明口径、异常值和复核建议。"
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

export function toolsForSkillIds(enabledSkills) {
  if (!Array.isArray(enabledSkills)) return agentTools;
  const names = new Set();
  for (const skillId of enabledSkills) {
    for (const name of skillToolMap[skillId] || []) names.add(name);
  }
  const filtered = agentTools.filter((tool) => names.has(tool.function?.name));
  // 有启用技能时，向主智能体暴露 invoke_skill，让它可以委托子任务
  if (enabledSkills.length > 0) {
    const invokeSkillDef = agentTools.find((t) => t.function?.name === "invoke_skill");
    if (invokeSkillDef && !filtered.includes(invokeSkillDef)) filtered.push(invokeSkillDef);
  }
  return filtered;
}

// ── 路径与工作区 ─────────────────────────────────────────────────────────────

export function resolveWorkspacePath(inputPath = ".") {
  const clean = String(inputPath || ".").replace(/^\/+/, "");
  const target = path.resolve(ctx.workspaceRoot, clean);
  if (target !== ctx.workspaceRoot && !target.startsWith(`${ctx.workspaceRoot}${path.sep}`)) {
    const error = new Error("路径超出工作区");
    error.status = 403;
    throw error;
  }
  return target;
}

export function isExcelPath(filePath) {
  return [".xlsx", ".xlsm"].includes(path.extname(String(filePath || "")).toLowerCase());
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

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function cmdQuote(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
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
  const filePath = ensureExcelPath(args.path || args.filename);
  const target = resolveWorkspacePath(filePath);
  await mkdir(path.dirname(target), { recursive: true });
  const sheets = normalizeSheetSpec(args).map(sheetDataForSpec);
  const globalOptions = { fontFamily: "Arial", fontSize: 11 };
  if (sheets.length === 1) {
    const [sheet] = sheets;
    await writeExcelFile(sheet.data, { sheet: sheet.sheet, columns: sheet.columns, stickyRowsCount: sheet.stickyRowsCount }, globalOptions).toFile(target);
  } else {
    await writeExcelFile(sheets, globalOptions).toFile(target);
  }
  const stats = await stat(target);
  return {
    ok: true,
    path: path.relative(ctx.workspaceRoot, target),
    size: stats.size,
    sheets: sheets.map((sheet) => ({ name: sheet.sheet, rows: sheet.data.length, columns: Math.max(0, ...sheet.data.map((row) => row.length)) }))
  };
}

export async function readExcelWorkbook(args = {}) {
  const filePath = String(args.path || "").trim();
  if (!filePath) { const e = new Error("请提供 Excel 文件路径"); e.status = 400; throw e; }
  if (path.extname(filePath).toLowerCase() === ".xls") return { ok: false, error: "暂不支持旧版 .xls，请先另存为 .xlsx" };
  if (!isExcelPath(filePath)) return { ok: false, error: "请提供 .xlsx 或 .xlsm 文件" };
  const target = resolveWorkspacePath(filePath);
  const stats = await stat(target);
  if (stats.size > 25 * 1024 * 1024) return { ok: false, error: "Excel 文件超过 25MB，已拒绝读取" };
  const rowLimit = Math.max(1, Math.min(1000, Number(args.row_limit || args.rowLimit || 120)));
  const workbook = await readExcelFile(target);
  const sheetsData = workbook.map((sheet) => {
    const allRows = Array.isArray(sheet.data) ? sheet.data : [];
    const rows = allRows.slice(0, rowLimit).map((row) => row.map(previewValue));
    return { name: sheet.sheet, rowCount: allRows.length, columnCount: Math.max(0, ...allRows.map((row) => row.length)), returnedRows: rows.length, rows };
  });
  return { ok: true, path: path.relative(ctx.workspaceRoot, target), size: stats.size, sheets: sheetsData };
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

export async function exportImage(args = {}) {
  const width = clamp(Number(args.width || 1200), 128, 4096);
  const height = clamp(Number(args.height || 1600), 128, 4096);
  const quality = clamp(Number(args.quality ?? 0.92), 0.1, 1);
  const transparent = args.transparent !== false;
  const inputPath = String(args.input_path || args.path || "").trim();
  const hasInlineSvg = String(args.svg || "").trim();
  const hasInlineHtml = String(args.html || args.content || "").trim();
  if (!inputPath && !hasInlineSvg && !hasInlineHtml) return { ok: false, error: "请提供 input_path、html 或 svg" };

  let sourcePath = "";
  let source = hasInlineSvg || hasInlineHtml;
  let sourceType = hasInlineSvg ? "svg" : "html";

  if (!source && inputPath) {
    sourcePath = resolveWorkspacePath(inputPath);
    const ext = path.extname(sourcePath).toLowerCase();
    if (![".html", ".htm", ".svg"].includes(ext)) return { ok: false, error: "export_image 只支持渲染 .html 或 .svg 源文件" };
    source = await readFile(sourcePath, "utf8");
    sourceType = ext === ".svg" ? "svg" : "html";
  }

  const format = imageFormatFromPath(args.output_path || args.outputPath, args.format);
  const relOutput = ensureImageOutputPath(args.output_path || args.outputPath || (inputPath ? inputPath.replace(/\.(html?|svg)$/i, `.${format}`) : ""), format);
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

async function tableCleanerScriptPath() {
  const source = path.join(rootDir, "tools", "table_cleaner.py");
  if (!source.includes(".asar")) return source;
  const target = path.join(os.tmpdir(), "neo-ai-table-cleaner.py");
  await writeFile(target, await readFile(source, "utf8"), "utf8");
  return target;
}

export async function detectPythonRuntime() {
  const candidates = process.platform === "win32"
    ? [{ file: "py", argsPrefix: ["-3"], command: "py -3" }, { file: "python", argsPrefix: [], command: "python" }, { file: "python3", argsPrefix: [], command: "python3" }]
    : [{ file: "python3", argsPrefix: [], command: "python3" }, { file: "python", argsPrefix: [], command: "python" }];
  for (const candidate of candidates) {
    const result = await execFileResult(candidate.file, [...candidate.argsPrefix, "--version"], { timeout: 5000 });
    const version = `${result.stdout || result.stderr}`.trim().split("\n")[0];
    if (result.ok && /Python\s+3\./i.test(version)) return { found: true, version, path: candidate.file, ...candidate };
  }
  return { found: false, version: "", path: "", file: "", argsPrefix: [], command: process.platform === "win32" ? "python" : "python3" };
}

export async function pythonPackageInfo(runtime, packageName) {
  if (!runtime?.found) return { found: false, version: "" };
  const result = await execFileResult(runtime.file, [...runtime.argsPrefix, "-c", ["import importlib", `m=importlib.import_module(${JSON.stringify(packageName)})`, "print(getattr(m, '__version__', 'ok'))"].join(";")], { timeout: 8000 });
  return { found: result.ok, version: result.ok ? (result.stdout.trim().split("\n")[0] || "ok") : "" };
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

  const inputTarget = resolveWorkspacePath(inputPath);
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
  return { ...data, path: path.relative(ctx.workspaceRoot, outputTarget), input_path: path.relative(ctx.workspaceRoot, inputTarget), size: stats.size };
}

async function cleanTableFiles(args = {}) {
  const paths = Array.isArray(args.paths) ? args.paths.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (!paths.length) return { ok: false, error: "请提供要批量清洗的表格路径" };
  if (paths.length > 30) return { ok: false, error: "一次最多批量清洗 30 个表格" };
  const outputDir = String(args.output_dir || args.outputDir || "").trim();
  const results = [];
  for (const inputPath of paths) {
    const defaultOutput = defaultCleanOutputPath(inputPath);
    const outputPath = outputDir ? uniqueWorkspaceOutputPath(workspaceRelJoin(outputDir, path.basename(defaultOutput))) : uniqueWorkspaceOutputPath(defaultOutput);
    const result = await cleanTableFile({ path: inputPath, output_path: outputPath, operations: Array.isArray(args.operations) ? args.operations : [], options: args.options && typeof args.options === "object" ? args.options : {} });
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
  const command = process.platform === "darwin" ? `open ${shellQuote(url)}` : process.platform === "win32" ? `start "" ${cmdQuote(url)}` : `xdg-open ${shellQuote(url)}`;
  const result = await runCommand(command, 8000);
  return result.ok ? { ok: true, url } : { ok: false, error: result.stderr || result.message || "无法打开链接" };
}

async function openPathFallback(target, reveal = false) {
  if (process.platform === "darwin") return runCommand(`${reveal ? "open -R" : "open"} ${shellQuote(target)}`, 8000);
  if (process.platform === "win32") return runCommand(reveal ? `explorer.exe /select,${cmdQuote(target)}` : `start "" ${cmdQuote(target)}`, 8000);
  return runCommand(`xdg-open ${shellQuote(reveal ? path.dirname(target) : target)}`, 8000);
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
  const command = process.platform === "darwin" ? `open -a ${shellQuote(appName)}` : process.platform === "win32" ? `start "" ${cmdQuote(appName)}` : `${shellQuote(appName)} >/dev/null 2>&1 &`;
  const result = await runCommand(command, 8000);
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

async function readPdfText(target) {
  let PDFParse;
  try { PDFParse = await loadPdfParser(); } catch (error) { return `[PDF 解析库加载失败：${error.message}]`; }
  const parser = new PDFParse({ data: await readFile(target) });
  try { const result = await parser.getText({ first: 40 }); return result.text || ""; }
  catch (error) { return `[PDF 解析失败：${error.message}]`; }
  finally { try { await parser.destroy(); } catch {} }
}

async function readDocxText(target) {
  const result = await mammoth.extractRawText({ path: target });
  return result.value || "";
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

export function attachmentSummary({ kind, relPath, size, content, workbook }) {
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
  const target = resolveWorkspacePath(relPath);
  try {
    if (isExcelPath(relPath)) {
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
  return { content: content.length > limit ? `${content.slice(0, limit)}\n...[内容过长已截断]` : content, contentChars: content.length, truncated: content.length > limit, workbook };
}

// ── handleToolCall ───────────────────────────────────────────────────────────

export async function handleToolCall(name, args) {
  if (name === "list_files") {
    const target = resolveWorkspacePath(args.path || ".");
    const entries = await readdir(target, { withFileTypes: true });
    return entries.filter((e) => e.name !== "node_modules" && e.name !== ".git").slice(0, 200).map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" }));
  }
  if (name === "read_file") {
    const target = resolveWorkspacePath(args.path);
    if (isExcelPath(target) || path.extname(target).toLowerCase() === ".xls") return readExcelWorkbook(args);
    const ext = path.extname(target).toLowerCase();
    if (ext === ".pdf") return { ok: true, path: path.relative(ctx.workspaceRoot, target), content: await readPdfText(target) };
    if (ext === ".docx") return { ok: true, path: path.relative(ctx.workspaceRoot, target), content: await readDocxText(target) };
    if (ext === ".doc") return { ok: false, error: "旧版 .doc 暂不支持直接读取，请另存为 .docx 后再试" };
    const stats = await stat(target);
    if (stats.size > 250_000) return { ok: false, error: "文件过大，已拒绝读取" };
    return { ok: true, content: await readFile(target, "utf8") };
  }
  if (name === "read_excel_file") return readExcelWorkbook(args);
  if (name === "write_file") {
    const target = resolveWorkspacePath(args.path);
    if (isExcelPath(target)) return { ok: false, error: "请使用 create_excel_file 工具生成真实 .xlsx 文件" };
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, String(args.content ?? ""), "utf8");
    return { ok: true, path: path.relative(ctx.workspaceRoot, target) };
  }
  if (name === "export_image") return exportImage(args);
  if (name === "create_excel_file") return createExcelWorkbook(args);
  if (name === "clean_table_file") return cleanTableFile(args);
  if (name === "clean_table_files") return cleanTableFiles(args);
  if (name === "search_files") {
    const query = String(args.query || "");
    if (!query.trim()) return { ok: false, error: "缺少搜索内容" };
    const glob = args.glob ? ` -g ${JSON.stringify(String(args.glob))}` : "";
    return runCommand(`rg --line-number --hidden -g '!node_modules' -g '!.git'${glob} ${JSON.stringify(query)} .`, 15000);
  }
  if (name === "search_web") return searchWeb(args);
  if (name === "read_web_page") return readWebPage(args);
  if (name === "download_url") return downloadUrl(args);
  if (name === "open_url") return openUrl(args);
  if (name === "open_workspace_item") return openWorkspaceItem(args);
  if (name === "open_desktop_app") return openDesktopApp(args);
  if (name === "show_desktop_notification") return showDesktopNotification(args);
  if (name === "run_command") return runCommand(String(args.command || ""), 30000);
  return { ok: false, error: `未知工具：${name}` };
}
