// server/tools.mjs — 工具定义、实现与 handleToolCall
import { readFile, readdir, stat, mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";
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
  "local-files": ["list_files", "read_file", "search_workspace", "write_file", "edit_file", "export_image", "search_files", "verify_office_file"],
  "spreadsheet-pro": ["inspect_office_file", "read_excel_file", "check_table", "chart_from_table", "pivot_table", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
  "document-reader": ["inspect_office_file", "read_file", "read_image_file", "get_template", "create_word_file", "create_ppt_file", "create_pdf_file", "verify_office_file"],
  "finance-tables": ["inspect_office_file", "read_excel_file", "check_table", "chart_from_table", "pivot_table", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
  "code-review": ["list_files", "read_file", "search_files"],
  "web-browser": ["search_web", "read_web_page", "read_web_pages", "download_url", "open_url"],
  "research": ["search_web", "read_web_pages", "read_web_page", "save_research_report", "write_file", "download_url"],
  "desktop-control": ["open_url", "open_desktop_app", "open_workspace_item", "show_desktop_notification"],
  "local-command": ["run_command"],
  "system-control": ["run_automation_script", "open_desktop_app"],
  "screen-view": ["screen_capture", "open_desktop_app"]
};

const defaultToolConsent = Object.freeze({
  fileRead: true,
  fileWrite: false,
  externalRead: false,
  externalWrite: false,
  externalPaths: [],
  web: false,
  desktop: false,
  command: false,
  systemControl: false,
  screenView: false
});

const toolPermissionRules = {
  list_files: ["fileRead"],
  read_file: ["fileRead"],
  inspect_office_file: ["fileRead"],
  read_excel_file: ["fileRead"],
  check_table: ["fileRead"],
  chart_from_table: ["fileWrite"],
  pivot_table: ["fileWrite"],
  verify_office_file: ["fileRead"],
  get_template: ["fileRead"],
  read_image_file: ["fileRead"],
  search_workspace: ["fileRead"],
  search_files: ["fileRead"],
  write_file: ["fileWrite"],
  edit_file: ["fileWrite"],
  export_image: ["fileWrite"],
  create_excel_file: ["fileWrite"],
  create_word_file: ["fileWrite"],
  create_ppt_file: ["fileWrite"],
  create_pdf_file: ["fileWrite"],
  clean_table_file: ["fileWrite"],
  clean_table_files: ["fileWrite"],
  search_web: ["web"],
  read_web_page: ["web"],
  read_web_pages: ["web"],
  save_research_report: ["fileWrite"],
  download_url: ["web", "fileWrite"],
  open_url: ["desktop"],
  open_workspace_item: ["desktop"],
  open_desktop_app: ["desktop"],
  show_desktop_notification: ["desktop"],
  run_command: ["command"],
  run_automation_script: ["systemControl"],
  screen_capture: ["screenView"]
};

const toolPermissionLabels = {
  fileRead: "读取工作区文件",
  fileWrite: "写入或生成工作区文件",
  externalRead: "读取已授权的工作区外路径",
  externalWrite: "写入已授权的工作区外路径",
  web: "访问网页",
  desktop: "打开本地应用、网页或文件",
  command: "运行本地命令",
  systemControl: "运行系统/软件设置脚本",
  screenView: "截取屏幕画面"
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
    command: input.command === true,
    systemControl: input.systemControl === true,
    screenView: input.screenView === true
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
  if (name === "update_plan") return true;
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
      name: "check_table",
      description: "Run a data-quality check on a .xlsx/.xlsm/.csv/.tsv table: per-column missing rate, dominant type and type-consistency, duplicate rows, numeric outliers (IQR), mixed date formats, leading/trailing whitespace, and top values. Returns a structured report plus a ready-to-save Markdown summary. Use this BEFORE cleaning or analyzing a messy table so you know what to fix.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative .xlsx/.xlsm/.csv/.tsv file path or authorized absolute external path." },
          sheet: { type: "string", description: "Sheet name or 0-based index for workbooks. Defaults to the first sheet." },
          max_rows: { type: "number", description: "Maximum data rows to scan. Defaults to 20000, max 100000." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "chart_from_table",
      description: "Render a chart image (PNG/JPG/SVG) from a .xlsx/.xlsm/.csv/.tsv table. Pick a label column (x/categories) and one or more numeric value columns (series); supports line, bar (vertical, grouped for multiple series) and pie charts. Saves a real image file in the workspace. Use this when the user wants to visualize table data (trends, comparisons, share/proportion).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative .xlsx/.xlsm/.csv/.tsv file path or authorized absolute external path." },
          type: { type: "string", description: "Chart type: line | bar | pie. Defaults to bar." },
          sheet: { type: "string", description: "Sheet name or 0-based index. Defaults to the first sheet." },
          label_column: { type: "string", description: "Column used as x-axis/category labels (header name or 0-based index). Defaults to the first column." },
          value_columns: { description: "Numeric value column(s) to plot: an array of names/indices, or a comma-separated string. Defaults to auto-detected numeric columns. Pie uses only the first." },
          title: { type: "string", description: "Optional chart title." },
          output_path: { type: "string", description: "Output image path (.svg, .png or .jpg). Defaults to charts/<name>-<type>.svg (SVG keeps text/labels and is scalable). Use .png/.jpg for a raster image (text renders fully on the desktop app)." },
          width: { type: "number", description: "Image width in px (default 900)." },
          height: { type: "number", description: "Image height in px (default 540)." },
          max_points: { type: "number", description: "Max categories to plot (default 50, max 200)." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pivot_table",
      description: "Aggregate / pivot a .xlsx/.xlsm/.csv/.tsv table and save the result as a new .xlsx (or .csv). Group by one or more dimension columns and aggregate value column(s) with sum/avg/count/min/max. Optionally set a pivot_column to build a cross-tab (rows × that column's distinct values). Use this for summaries like 'total revenue by department by month' or 'count of orders per region'.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative .xlsx/.xlsm/.csv/.tsv file path or authorized absolute external path." },
          sheet: { type: "string", description: "Sheet name or 0-based index. Defaults to the first sheet." },
          group_by: { description: "Row dimension column(s): array of header names/indices or a comma-separated string. Omit for a grand total." },
          pivot_column: { type: "string", description: "Optional single column whose distinct values become output columns (cross-tab). Uses the first value column as the measure." },
          values: { description: "Value column(s) to aggregate: array or comma-separated string. Auto-detected numeric columns if omitted (not needed for count)." },
          agg: { type: "string", description: "Aggregation: sum | avg | count | min | max. Defaults to sum." },
          output_path: { type: "string", description: "Output path (.xlsx or .csv). Defaults to pivots/<name>-pivot.xlsx." }
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
      name: "edit_file",
      description: "Edit an existing text file by exact text replacement. Preferred over write_file when modifying existing files: only the changed part needs to be provided. Each old_text must match the file content exactly (including whitespace) and appear exactly once.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative file path of an existing text file." },
          edits: {
            type: "array",
            description: "Edits applied in order. All edits must succeed or the file is left unchanged.",
            items: {
              type: "object",
              properties: {
                old_text: { type: "string", description: "Exact text to find; must appear exactly once in the file." },
                new_text: { type: "string", description: "Replacement text." }
              },
              required: ["old_text", "new_text"]
            }
          }
        },
        required: ["path", "edits"]
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
      description: "Create a basic real .docx Word file in the local workspace, then re-read it for verification. Pass 'markdown' to convert a Markdown document into Word automatically (headings → sections, lists → bullets, tables → tables), or pass the structured fields directly.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          title: { type: "string" },
          subtitle: { type: "string" },
          markdown: { type: "string", description: "Markdown content to convert into the Word document; takes priority over the structured fields below." },
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
      name: "create_pdf_file",
      description: "Create a real .pdf file from Markdown or HTML content, then re-read it for verification. Desktop app only. Pass 'markdown' for a quick formatted document, or 'html' for full control of layout.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace path ending in .pdf" },
          title: { type: "string", description: "Optional document title (used when rendering from markdown)." },
          markdown: { type: "string", description: "Markdown content (headings, lists, bold, inline code, paragraphs)." },
          html: { type: "string", description: "Raw HTML content; takes priority over markdown when both are given." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_image_file",
      description: "Read a local image file (png/jpg/jpeg/webp/gif/bmp) from the workspace and show it to you, so you can read its text (OCR), describe it, or extract info. Needs a vision-capable model; the image is shown to you automatically on the next step.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Workspace-relative image path or authorized absolute path." } },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_template",
      description: "Get a ready-to-fill Markdown skeleton for a common office document (周报/会议纪要/简历/项目计划/工作总结). Call with no name to list available templates. Fill the skeleton with the user's content, then save it via create_pdf_file / create_word_file / write_file.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Template id or Chinese name, e.g. weekly-report / 周报. Omit to list all." } }
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
      name: "search_workspace",
      description: "Search across ALL workspace files by keyword — including INSIDE Office files (Excel/Word/PDF/PPT), not just plain text. Returns the most relevant files with snippets. Use this to answer questions about the user's local files when you don't know which file holds the answer; then read the top matches to answer with sources.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keywords to search for across the workspace." },
          max_results: { type: "number", description: "Max files to return (default 8)." }
        },
        required: ["query"]
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
      description: "Search the web and return a small list of result titles, URLs, and snippets. Supports restricting to one site and a best-effort time filter.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
          site: { type: "string", description: "Restrict results to a single site/domain, e.g. gov.cn or example.com." },
          freshness: { type: "string", enum: ["day", "week", "month", "year"], description: "Best-effort time filter for recent results (ignored by engines that don't support it)." }
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
      name: "read_web_pages",
      description: "Fetch multiple http/https web pages in one call (in parallel) and return each page's main readable text. Use this when gathering information from several sources at once.",
      parameters: {
        type: "object",
        properties: {
          urls: { type: "array", items: { type: "string" }, description: "List of page URLs to read (up to 8)." },
          max_chars_each: { type: "number", description: "Max characters of body text to keep per page (default 6000)." }
        },
        required: ["urls"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_research_report",
      description: "Write a structured research report (with a deduplicated, dated source list) as a Markdown file in the workspace. Prefer this over write_file for research summaries so the report format and citations stay consistent.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Report title / topic." },
          summary: { type: "string", description: "Short overview of the findings." },
          sections: {
            type: "array",
            description: "Body sections, each with a heading and content.",
            items: { type: "object", properties: { heading: { type: "string" }, content: { type: "string" } } }
          },
          sources: {
            type: "array",
            description: "Cited sources; duplicates by URL are removed automatically.",
            items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" } } }
          },
          output_path: { type: "string", description: "Optional workspace path; defaults to Research/<date>-<title>.md" }
        },
        required: ["title"]
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
      name: "run_automation_script",
      description: "Run a short script to change system or application settings. On macOS use 'applescript' (e.g. `defaults`, System Events); on Windows use 'powershell'; use 'shell' for a plain shell command. Every script needs the user's one-time confirmation before running, so always provide a clear human-readable 'purpose'. Prefer reversible changes and never run destructive/irreversible operations.",
      parameters: {
        type: "object",
        properties: {
          language: { type: "string", enum: ["applescript", "powershell", "shell"], description: "applescript (macOS only), powershell (Windows only), or shell (cross-platform)." },
          script: { type: "string", description: "The script body to execute." },
          purpose: { type: "string", description: "Short, human-readable explanation of what this changes and why (shown to the user on the confirmation bar)." },
          mutating: { type: "boolean", description: "true if it changes settings/state, false if read-only. Default true." }
        },
        required: ["language", "script", "purpose"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "screen_capture",
      description: "Capture the current screen as an image so you can see what is on screen (read UI text, locate elements, or guide the user). Read-only — this does NOT click or control anything. Desktop app only, and needs a vision-capable model; the captured image is shown to you automatically on the next step.",
      parameters: {
        type: "object",
        properties: { max_width: { type: "number", description: "Optional max width in px to downscale the screenshot (default 1280)." } }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "invoke_skill",
      description: "Delegate a complex sub-task to a specialized skill sub-agent that runs with its own focused system prompt and dedicated tool set, then returns the result. Use this when the task clearly maps to a skill domain and would benefit from a dedicated agent loop. Available skills: local-files (file read/write/search/export), spreadsheet-pro (Excel/CSV read/create/clean), document-reader (PDF/Word extraction), finance-tables (financial data processing), code-review (code analysis), web-browser (search/fetch/download), research (multi-source gathering into a cited report), desktop-control (open apps/files/notify), local-command (shell commands), system-control (change system/app settings via scripts), screen-view (capture and read the screen, read-only).",
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
  },
  {
    type: "function",
    function: {
      name: "update_plan",
      description: "Maintain a visible step-by-step plan for the current task. For any task that needs more than 2 steps, call this first with the full plan, then call it again each time a step's status changes. Always send the complete plan. Keep at most one step in_progress.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            description: "The complete current plan, in execution order.",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Short step description in the user's language." },
                status: { type: "string", enum: ["pending", "in_progress", "done"] }
              },
              required: ["title", "status"]
            }
          }
        },
        required: ["steps"]
      }
    }
  }
];

// ── 服务端技能定义（供 runSkillAgent 使用）────────────────────────────────────

export const serverSkillDefs = {
  "local-files": {
    name: "本地文件助手",
    tools: ["list_files", "read_file", "search_workspace", "write_file", "edit_file", "export_image", "search_files", "verify_office_file"],
    prompt: "你是本地文件助手子智能体。回答关于本地文件的问题、但不确定答案在哪个文件时，先用 search_workspace 跨文件检索（能搜进 Excel/Word/PDF/PPT 内容），再用 read_file 读最相关的文件，回答时务必给出处文件路径。优先使用工作区相对路径；写入文件前确认路径清晰；修改已有文件优先用 edit_file 做局部替换，只有新建文件或全量重写才用 write_file；用户要海报、封面、卡片、图片版结果时，先生成 HTML/SVG，再调用 export_image 导出真实 PNG/JPG；不要删除或覆盖用户未明确要求修改的文件。"
  },
  "spreadsheet-pro": {
    name: "表格处理",
    tools: ["inspect_office_file", "read_excel_file", "check_table", "chart_from_table", "pivot_table", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
    prompt: "你是表格处理子智能体。遇到 Excel/CSV 时先读取结构和字段，再处理；拿到可能脏的表格时先用 check_table 做数据质量体检（缺失率、类型/格式一致性、重复行、异常值），据此决定怎么清洗；要把表格数据可视化（趋势、对比、占比）时用 chart_from_table 出折线/柱/饼图；要按维度汇总/透视（如按部门按月求和、按地区计数）时用 pivot_table 分组聚合或交叉透视；清洗表格默认另存新文件；批量任务优先使用 clean_table_files；完成后必须以工具校验结果为准。"
  },
  "document-reader": {
    name: "文档阅读",
    tools: ["inspect_office_file", "read_file", "read_image_file", "get_template", "create_word_file", "create_ppt_file", "create_pdf_file", "verify_office_file"],
    prompt: "你是文档阅读与基础 Office 子智能体。读取 Word/PDF/PPT 时先调用 inspect_office_file；读取图片/扫描件里的文字（OCR）或理解图片内容时用 read_image_file（需视觉模型）；做周报/会议纪要/简历/项目计划/工作总结等常见文档时先用 get_template 取骨架再填充；生成 Word 用 create_word_file（把 Markdown 转 Word 直接给它传 markdown 参数），生成 PPT 用 create_ppt_file，生成 PDF 用 create_pdf_file（传 markdown 或 html）；完成后必须以回读校验结果为准。"
  },
  "finance-tables": {
    name: "财务表格",
    tools: ["inspect_office_file", "read_excel_file", "check_table", "chart_from_table", "pivot_table", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
    prompt: "你是财务表格子智能体。处理金额、税费、合计和对账时必须严谨；先用 check_table 体检（缺失、重复行、金额列异常值、口径不一致），主动说明口径、异常值和复核建议；需要展示金额趋势或占比时用 chart_from_table 出图；要按维度汇总（按部门/月份/项目求和或计数）或做透视表时用 pivot_table；生成或清洗后必须确认文件校验通过。"
  },
  "code-review": {
    name: "代码审查",
    tools: ["list_files", "read_file", "search_files"],
    prompt: "你是代码审查子智能体。先列问题和风险，再给改法；重点关注 bug、安全、回归和测试缺口。"
  },
  "web-browser": {
    name: "网页助手",
    tools: ["search_web", "read_web_page", "read_web_pages", "download_url", "open_url"],
    prompt: "你是网页助手子智能体。需要最新信息时先搜索或读取网页；一次要看多个来源时用 read_web_pages 批量读取；引用网页内容时说明来源 URL；下载文件默认保存到工作区 Downloads。"
  },
  "research": {
    name: "信息搜集",
    tools: ["search_web", "read_web_pages", "read_web_page", "save_research_report", "write_file", "download_url"],
    prompt: "你是信息搜集子智能体，负责把一个主题搜集成一份带来源、可落地的简报。步骤：1) 用 search_web 做 2-3 轮检索（必要时换关键词、用 site 限定站点或 freshness 限定时效），收集候选来源；2) 用 read_web_pages 批量读取最相关的若干来源正文，去掉重复和明显低质量的页面；3) 按主题归纳要点，区分已确认结论与存疑信息，标注口径和时效；4) 用 save_research_report 把结果写成结构化简报（传入 title、summary、sections、sources），它会自动落到工作区 Research/<日期>-<主题>.md 并生成去重、带取用日期的来源列表；5) 最后向用户说明覆盖了哪些来源、有哪些未决或需进一步核实的点。不要编造未在来源中出现的事实，引用务必给出处。"
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
  },
  "system-control": {
    name: "系统与软件设置",
    tools: ["run_automation_script", "open_desktop_app"],
    prompt: "你是系统与软件设置子智能体，用脚本帮用户调整系统或软件设置。按平台用正确写法：macOS 用 run_automation_script 的 applescript（如 `defaults write`、System Events），Windows 用 powershell（如 `Set-ItemProperty`、`reg`）。每次都要：1) 在 purpose 里用一句人话说清这条脚本改什么；2) 优先选可逆、影响最小的做法，并主动告诉用户如何撤销；3) 绝不执行不可逆或破坏性操作（删盘、格式化、关机等），即使用户要求也要先明确警示。需要先打开目标软件时用 open_desktop_app。每条脚本都会由用户在确认条上单独放行。"
  },
  "screen-view": {
    name: "看屏幕",
    tools: ["screen_capture", "open_desktop_app"],
    prompt: "你是看屏幕子智能体。用 screen_capture 截取当前屏幕来读取界面文字、定位元素、判断状态或一步步指导用户。这是只读能力：你只能看，不能点击或操作软件，绝不要声称自己已经点击/操作了界面。截图会自动作为图片提供给你；看不清时可再截一次。需要先打开某个软件时用 open_desktop_app。注意：屏幕画面会发送给模型供应商，遇到明显的敏感信息（密码、隐私）要提醒用户。"
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
  // 主智能体有任何可用工具时，暴露 update_plan 让它维护可见的任务计划（子智能体不需要）
  if (includeInvokeSkill && filtered.length) {
    const updatePlanDef = agentTools.find((t) => t.function?.name === "update_plan");
    if (updatePlanDef && !filtered.includes(updatePlanDef)) filtered.push(updatePlanDef);
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
  try { return JSON.parse(value); } catch {
    // 非法 JSON（常见原因：模型输出被 max_tokens 截断导致参数不完整）。
    // 返回可识别的标记而不是静默 {}，让调用方能区分"解析失败"和"模型漏传参数"。
    return { __parseError: true, __raw: String(value).slice(0, 2000) };
  }
}

export function isArgumentParseError(args) {
  return Boolean(args && typeof args === "object" && args.__parseError === true);
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

const editFileBinaryExts = new Set([".xlsx", ".xlsm", ".xls", ".docx", ".pptx", ".ppt", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".zip"]);

async function editTextFile(args = {}) {
  const filePath = safeTrimmedString(args.path);
  const edits = Array.isArray(args.edits) ? args.edits : [];
  const missing = [];
  if (!filePath) missing.push("path");
  if (!edits.length) missing.push("edits");
  if (missing.length) return missingRequiredToolArgs("edit_file", missing);
  const target = resolveWorkspacePath(filePath);
  if (isWorkspaceRootPath(target)) return { ok: false, error: "edit_file 的 path 不能是工作区根目录", toolArgError: true };
  if (await isDirectoryPath(target)) return { ok: false, error: `edit_file 的 path 指向目录：${path.relative(ctx.workspaceRoot, target) || "."}`, toolArgError: true };
  if (editFileBinaryExts.has(path.extname(target).toLowerCase())) return { ok: false, error: "edit_file 只能编辑文本文件；Excel/Word/PPT/PDF 请使用对应的专用工具" };
  let content;
  try {
    const stats = await stat(target);
    if (stats.size > 250_000) return { ok: false, error: "文件过大，edit_file 已拒绝编辑" };
    content = await readFile(target, "utf8");
  } catch {
    return { ok: false, error: `文件不存在或无法读取：${filePath}。edit_file 只能修改已有文件，新建文件请用 write_file；请先用 list_files 或 read_file 确认路径` };
  }
  // 全部编辑先在内存中按顺序应用，任何一处失败则不写盘
  for (let i = 0; i < edits.length; i++) {
    const oldText = String(edits[i]?.old_text ?? "");
    const newText = String(edits[i]?.new_text ?? "");
    if (!oldText) return { ok: false, error: `第 ${i + 1} 处编辑缺少 old_text`, toolArgError: true };
    const first = content.indexOf(oldText);
    if (first === -1) return { ok: false, error: `第 ${i + 1} 处编辑的 old_text 在文件中未找到。old_text 必须与文件当前内容完全一致（包括缩进、空格和换行）；请先 read_file 查看最新内容后重试` };
    if (content.indexOf(oldText, first + 1) !== -1) return { ok: false, error: `第 ${i + 1} 处编辑的 old_text 在文件中出现多次，无法确定要改哪一处；请在 old_text 中包含更多上下文使其唯一` };
    content = content.slice(0, first) + newText + content.slice(first + oldText.length);
  }
  await writeFile(target, content, "utf8");
  return { ok: true, path: path.relative(ctx.workspaceRoot, target), edits: edits.length };
}

function validateRunCommandArgs(args = {}) {
  if (!safeTrimmedString(args.command)) return missingRequiredToolArgs("run_command", ["command"]);
  return { ok: true, command: safeTrimmedString(args.command) };
}

const AUTOMATION_LANGUAGES = new Set(["applescript", "powershell", "shell"]);

export function validateAutomationArgs(args = {}) {
  const language = String(args.language || "").trim().toLowerCase();
  const script = safeTrimmedString(args.script);
  const purpose = safeTrimmedString(args.purpose);
  const missing = [];
  if (!language) missing.push("language");
  if (!script) missing.push("script");
  if (!purpose) missing.push("purpose");
  if (missing.length) return missingRequiredToolArgs("run_automation_script", missing);
  if (!AUTOMATION_LANGUAGES.has(language)) return { ok: false, error: `language 只支持 applescript / powershell / shell，收到：${language}` };
  if (language === "applescript" && process.platform !== "darwin") return { ok: false, error: "AppleScript 仅在 macOS 上可用，请改用 shell 或在 Windows 上用 powershell" };
  if (language === "powershell" && process.platform !== "win32") return { ok: false, error: "PowerShell 脚本仅在 Windows 上可用，请改用 shell 或在 macOS 上用 applescript" };
  return { ok: true, language, script, purpose };
}

// 即使用户授权，也兜底拦截不可逆/破坏性脚本
const DANGEROUS_SCRIPT_PATTERNS = [
  { re: /\brm\s+-[a-z]*[rf][a-z]*\s+(\/(?:\s|$)|~|\$HOME|\/\*|\*)/i, reason: "递归/强制删除根目录或家目录" },
  { re: /\bmkfs\b|\bdiskutil\s+(erase|reformat)|\bFormat-Volume\b/i, reason: "磁盘格式化" },
  { re: /\bdd\s+if=.*\bof=\/dev\//i, reason: "向裸磁盘设备写入" },
  { re: />\s*\/dev\/(sd|disk|nvme)/i, reason: "覆盖裸磁盘设备" },
  { re: /\b(shutdown|reboot|halt|poweroff|Restart-Computer|Stop-Computer)\b/i, reason: "关机/重启" },
  { re: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: "fork 炸弹" },
  { re: /\bRemove-Item\b[\s\S]*-Recurse[\s\S]*-Force/i, reason: "PowerShell 递归强制删除" },
  { re: /\breg\s+delete\s+["']?HK(LM|EY_LOCAL_MACHINE)/i, reason: "删除 HKLM 关键注册表" },
  { re: /\b(chmod|chown)\s+-R\s+\S+\s+\/(?:\s|$)/i, reason: "对根目录递归改权限/属主" }
];

export function isDangerousScript(language, script) {
  const text = String(script || "");
  for (const { re, reason } of DANGEROUS_SCRIPT_PATTERNS) {
    if (re.test(text)) return { blocked: true, reason };
  }
  return { blocked: false };
}

async function runAutomationScript(args = {}) {
  const validation = validateAutomationArgs(args);
  if (!validation.ok) return validation;
  const { language, script, purpose } = validation;
  const danger = isDangerousScript(language, script);
  if (danger.blocked) {
    return { ok: false, error: `已拒绝执行高危脚本（${danger.reason}）。这类不可逆或破坏性操作不会运行，请改用更安全、可逆的方式。` };
  }

  const timeout = 30000;
  if (language === "shell") {
    const result = await runCommand(script, timeout);
    return { ...result, language, purpose };
  }

  // applescript / powershell：写临时脚本文件再执行，避免引号转义问题
  const dir = await mkdtemp(path.join(os.tmpdir(), "neo-automation-"));
  const file = path.join(dir, language === "applescript" ? "script.applescript" : "script.ps1");
  try {
    await writeFile(file, script, "utf8");
    const result = language === "applescript"
      ? await execFileResult("osascript", [file], { timeout, cwd: ctx.workspaceRoot })
      : await execFileResult("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file], { timeout, cwd: ctx.workspaceRoot });
    return { ...result, language, purpose };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function screenCapture(args = {}) {
  if (typeof ctx.captureScreen !== "function") {
    return { ok: false, error: "截屏仅在桌面端可用：请在 neo 桌面应用里使用「看屏幕」，浏览器预览模式无法截屏。" };
  }
  const maxWidth = clamp(Number(args.max_width || args.maxWidth || 1280), 320, 2560);
  const shot = await ctx.captureScreen({ maxWidth });
  if (!shot || !shot.ok) return { ok: false, error: shot?.error || "截屏失败", needsPermission: shot?.needsPermission };
  const match = String(shot.dataUrl || "").match(/^data:image\/png;base64,(.+)$/);
  if (!match) return { ok: false, error: "截屏返回的数据无效" };
  const rel = path.join("Screenshots", `screen-${Date.now()}.png`);
  const target = resolveWorkspacePath(rel);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(match[1], "base64"));
  return { ok: true, path: path.relative(ctx.workspaceRoot, target), width: shot.width, height: shot.height, dataUrl: shot.dataUrl };
}

// ── PDF 导出（Markdown / HTML → PDF）─────────────────────────────────────────

function escapeHtmlText(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInlinePdfMarkdown(text = "") {
  // 先整体转义，再恢复 **加粗** 与 `行内代码`，避免 HTML 注入或破坏排版
  let s = escapeHtmlText(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  return s;
}

function pdfHtmlShell(inner = "") {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:#1a1a1a;line-height:1.7;font-size:14px;padding:6px 4px;}
    h1{font-size:24px;margin:0 0 16px;} h2{font-size:19px;margin:22px 0 10px;border-bottom:1px solid #eee;padding-bottom:4px;}
    h3{font-size:16px;margin:18px 0 8px;} h4{font-size:14px;margin:14px 0 6px;}
    p{margin:0 0 10px;} ul,ol{margin:0 0 10px;padding-left:22px;} li{margin:4px 0;}
    code{background:#f3f3f3;padding:1px 5px;border-radius:4px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;}
    strong{font-weight:700;} .doc-title{border-bottom:2px solid #333;padding-bottom:8px;}
  </style></head><body>${inner}</body></html>`;
}

export function markdownToPdfHtml(markdown = "", title = "") {
  const lines = String(markdown).replace(/\r/g, "").split("\n");
  const html = [];
  let para = [];
  let listType = "";
  const closePara = () => { if (para.length) { html.push(`<p>${para.map(renderInlinePdfMarkdown).join("<br/>")}</p>`); para = []; } };
  const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = ""; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (heading) { closePara(); closeList(); const lvl = heading[1].length; html.push(`<h${lvl}>${renderInlinePdfMarkdown(heading[2])}</h${lvl}>`); continue; }
    if (bullet) { closePara(); if (listType !== "ul") { closeList(); listType = "ul"; html.push("<ul>"); } html.push(`<li>${renderInlinePdfMarkdown(bullet[1])}</li>`); continue; }
    if (ordered) { closePara(); if (listType !== "ol") { closeList(); listType = "ol"; html.push("<ol>"); } html.push(`<li>${renderInlinePdfMarkdown(ordered[1])}</li>`); continue; }
    if (!line.trim()) { closePara(); closeList(); continue; }
    para.push(line);
  }
  closePara(); closeList();
  const titleHtml = title ? `<h1 class="doc-title">${escapeHtmlText(title)}</h1>` : "";
  return pdfHtmlShell(titleHtml + html.join("\n"));
}

// ── 读取本地图片（OCR / 看图，喂视觉模型）────────────────────────────────────
const IMAGE_FILE_MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" };

async function readImageFile(args = {}, toolConsent = {}) {
  const rel = String(args.path || "").trim();
  if (!rel) return missingRequiredToolArgs("read_image_file", ["path"]);
  const target = resolveToolPath(rel, toolConsent, "read");
  const ext = path.extname(target).toLowerCase();
  const mime = IMAGE_FILE_MIME[ext];
  if (!mime) return { ok: false, error: `不支持的图片类型：${ext || "无扩展名"}（支持 png/jpg/jpeg/webp/gif/bmp）` };
  if (!existsSync(target)) return { ok: false, error: "图片文件不存在" };
  const stats = await stat(target);
  if (!stats.isFile()) return { ok: false, error: "不是普通文件" };
  if (stats.size > 12 * 1024 * 1024) return { ok: false, error: "图片过大（超过 12MB），已拒绝读取" };
  const buffer = await readFile(target);
  return { ok: true, path: toolPathLabel(target), mime, size: stats.size, dataUrl: `data:${mime};base64,${buffer.toString("base64")}` };
}

// ── 工作区知识检索（问我的文件）──────────────────────────────────────────────
const SEARCH_TEXT_EXTS = new Set([".md", ".txt", ".csv", ".tsv", ".json", ".js", ".mjs", ".cjs", ".ts", ".html", ".css", ".xml", ".yaml", ".yml", ".log", ".py", ".java", ".go", ".rb", ".sql"]);
const SEARCH_OFFICE_EXTS = new Set([".xlsx", ".xlsm", ".docx", ".pdf", ".pptx"]);

async function collectSearchFiles(dir, acc, depth) {
  if (acc.length >= 500 || depth > 6) return;
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (acc.length >= 500) break;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { await collectSearchFiles(full, acc, depth + 1); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    if (SEARCH_TEXT_EXTS.has(ext) || SEARCH_OFFICE_EXTS.has(ext)) acc.push(full);
  }
}

async function getFileTextForSearch(target, rel, ext, toolConsent) {
  try {
    if (ext === ".docx") return (await readDocxDocument(target)).text || "";
    if (ext === ".pdf") return (await readPdfDocument(target)).text || "";
    if (ext === ".pptx") return (await readPptxPresentation(target)).text || "";
    if (SEARCH_OFFICE_EXTS.has(ext)) {
      const wb = await readExcelWorkbook({ path: rel, row_limit: 200 }, toolConsent);
      if (!wb.ok) return "";
      return (wb.sheets || [])
        .map((sheet) => [sheet.name, ...(sheet.rows || []).map((row) => (Array.isArray(row) ? row : []).map((cell) => String(cell ?? "")).join(" "))].join("\n"))
        .join("\n\n");
    }
    const stats = await stat(target);
    if (stats.size > 2 * 1024 * 1024) return "";
    return await readFile(target, "utf8");
  } catch { return ""; }
}

// ── 跨文件检索打分：log 阻尼词频 + 词覆盖 + 文件名/标题/短语加权，片段围绕最佳命中并高亮 ──
const SEARCH_HEAD_REGION = 240; // 视为"标题/首段"的前缀长度
const SEARCH_TERM_CAP = 30; // 单词在单文件内计数上限，防长文档刷分

function searchTermStats(lower, term) {
  if (!term) return { count: 0, firstIdx: -1 };
  let idx = lower.indexOf(term);
  if (idx === -1) return { count: 0, firstIdx: -1 };
  const firstIdx = idx;
  let count = 0;
  while (idx !== -1 && count < SEARCH_TERM_CAP) { count += 1; idx = lower.indexOf(term, idx + term.length); }
  return { count, firstIdx };
}

// 在片段文本里给命中词加【】高亮（合并重叠区间，避免嵌套标记）
function highlightSearchTerms(text, terms) {
  const lower = text.toLowerCase();
  const ranges = [];
  for (const term of terms) {
    if (!term) continue;
    let idx = lower.indexOf(term);
    let guard = 0;
    while (idx !== -1 && guard < 60) { ranges.push([idx, idx + term.length]); idx = lower.indexOf(term, idx + term.length); guard += 1; }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  let out = "";
  let cursor = 0;
  for (const [s, e] of merged) { out += text.slice(cursor, s) + "【" + text.slice(s, e) + "】"; cursor = e; }
  return out + text.slice(cursor);
}

function searchSnippet(text, center, terms) {
  const start = Math.max(0, center - 60);
  const end = Math.min(text.length, center + 160);
  let s = text.slice(start, end).replace(/\s+/g, " ").trim();
  s = highlightSearchTerms(s, terms);
  if (start > 0) s = "…" + s;
  if (end < text.length) s += "…";
  return s;
}

async function searchWorkspace(args = {}, toolConsent = {}) {
  const query = String(args.query || "").trim();
  if (!query) return missingRequiredToolArgs("search_workspace", ["query"]);
  const limit = clamp(Number(args.max_results || args.maxResults || 8), 1, 20);
  const phrase = query.toLowerCase();
  const terms = [...new Set(phrase.split(/\s+/).filter(Boolean))];
  const multiTerm = terms.length > 1;
  const files = [];
  await collectSearchFiles(ctx.workspaceRoot, files, 0);
  const results = [];
  for (const full of files) {
    const rel = path.relative(ctx.workspaceRoot, full);
    const ext = path.extname(full).toLowerCase();
    const text = await getFileTextForSearch(full, rel, ext, toolConsent);
    if (!text) continue;
    const lower = text.toLowerCase();
    const relLower = rel.toLowerCase();

    let tf = 0; // log 阻尼词频之和
    let matched = 0; // 命中的关键词种类数
    let titleHits = 0; // 在首段命中的关键词数
    let nameHits = 0; // 命中文件名/路径的关键词数
    let bestIdx = -1; // 最早命中位置
    const matchedIdx = [];
    for (const term of terms) {
      const { count, firstIdx } = searchTermStats(lower, term);
      if (count > 0) {
        matched += 1;
        tf += 1 + Math.log(count);
        matchedIdx.push(firstIdx);
        if (bestIdx === -1 || firstIdx < bestIdx) bestIdx = firstIdx;
        if (firstIdx < SEARCH_HEAD_REGION) titleHits += 1;
      }
      if (relLower.includes(term)) nameHits += 1;
    }
    if (!matched && !nameHits) continue;

    // 中文无空格，短语既按原始查询也按去空格相邻判定
    const compact = terms.join("");
    const phraseInBody = multiTerm && (lower.includes(phrase) || lower.includes(compact));
    const phraseInName = multiTerm && (relLower.includes(phrase) || relLower.includes(compact));

    // 正文得分按"覆盖了多少种关键词"打折，避免长文档靠堆单个词刷分
    let bodyScore = tf * 4 + titleHits * 5; // 词频（log 阻尼）+ 标题/首段命中
    if (phraseInBody) bodyScore += 8; // 正文出现完整短语（含无空格相邻）
    const coverage = multiTerm ? 0.5 + 0.5 * (matched / terms.length) : 1;
    let score = bodyScore * coverage;
    score += nameHits * 18; // 命中文件名/路径（强相关信号，独立于正文覆盖）
    if (phraseInName) score += 10; // 文件名出现完整短语
    if (score <= 0) continue;

    let center = phraseInBody ? lower.indexOf(phrase) : bestIdx;
    if (center < 0) center = 0;
    const snippets = [searchSnippet(text, center, terms)];
    const second = matchedIdx
      .filter((i) => Math.abs(i - center) > 200)
      .sort((a, b) => Math.abs(b - center) - Math.abs(a - center))[0];
    if (second != null) snippets.push(searchSnippet(text, second, terms));

    results.push({
      path: rel,
      fileType: ext.slice(1),
      score: Math.round(score * 10) / 10,
      matchedTerms: matched,
      nameMatch: nameHits > 0,
      snippet: snippets[0],
      snippets
    });
  }
  results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return { ok: true, query, scanned: files.length, count: results.length, results: results.slice(0, limit) };
}

// ── 办公模板库 ───────────────────────────────────────────────────────────────
const DOCUMENT_TEMPLATES = {
  "weekly-report": { name: "周报", skeleton: "# 周报（{{起止日期}}）\n\n## 本周完成\n- \n\n## 进行中\n- \n\n## 下周计划\n- \n\n## 风险与需要支持\n- " },
  "meeting-notes": { name: "会议纪要", skeleton: "# 会议纪要：{{主题}}\n\n- 时间：\n- 地点 / 会议方式：\n- 主持：\n- 参会：\n\n## 议题与讨论\n1. \n\n## 决议\n- \n\n## 待办\n| 事项 | 负责人 | 截止时间 |\n| --- | --- | --- |\n|  |  |  |" },
  "resume": { name: "简历", skeleton: "# {{姓名}}\n\n- 求职意向：\n- 电话 / 邮箱：\n\n## 个人优势\n- \n\n## 工作经历\n### {{公司}} ｜ {{职位}} ｜ {{起止时间}}\n- \n\n## 项目经历\n### {{项目名}}\n- 角色：\n- 内容与成果：\n\n## 教育背景\n- {{学校}} ｜ {{专业}} ｜ {{起止时间}}\n\n## 技能\n- " },
  "project-plan": { name: "项目计划", skeleton: "# 项目计划：{{项目名}}\n\n## 目标\n- \n\n## 范围\n- 包含：\n- 不包含：\n\n## 里程碑与排期\n| 里程碑 | 交付物 | 计划时间 | 负责人 |\n| --- | --- | --- | --- |\n|  |  |  |  |\n\n## 风险与应对\n- " },
  "work-summary": { name: "工作总结", skeleton: "# 工作总结（{{周期}}）\n\n## 主要成果\n- \n\n## 数据与亮点\n- \n\n## 不足与改进\n- \n\n## 下阶段重点\n- " }
};

function getTemplate(args = {}) {
  const available = Object.entries(DOCUMENT_TEMPLATES).map(([id, t]) => ({ id, name: t.name }));
  const query = String(args.name || args.template || "").trim();
  if (!query) return { ok: true, available };
  const lower = query.toLowerCase();
  const id = Object.keys(DOCUMENT_TEMPLATES).find((k) => k === lower || DOCUMENT_TEMPLATES[k].name === query);
  if (!id) return { ok: false, error: `未找到模板「${query}」`, available };
  return { ok: true, id, name: DOCUMENT_TEMPLATES[id].name, format: "markdown", skeleton: DOCUMENT_TEMPLATES[id].skeleton, available };
}

async function createPdfFile(args = {}) {
  const relPath = String(args.path || "").trim();
  if (!relPath) return missingRequiredToolArgs("create_pdf_file", ["path"]);
  if (path.extname(relPath).toLowerCase() !== ".pdf") return { ok: false, error: "create_pdf_file 只能生成 .pdf 文件" };
  if (typeof ctx.renderPdfFile !== "function") return { ok: false, error: "PDF 导出仅在桌面端可用：请在 neo 桌面应用里使用，浏览器预览模式暂不支持。" };
  const html = String(args.html || "").trim();
  const markdown = String(args.markdown || args.content || "").trim();
  if (!html && !markdown) return { ok: false, error: "请提供 markdown 或 html 内容" };
  const docHtml = html ? (/<html[\s>]/i.test(html) ? html : pdfHtmlShell(html)) : markdownToPdfHtml(markdown, String(args.title || ""));
  const target = resolveWorkspacePath(relPath);
  await mkdir(path.dirname(target), { recursive: true });
  const result = await ctx.renderPdfFile({ html: docHtml, outputPath: target });
  if (!result || !result.ok) return { ok: false, error: result?.error || "PDF 生成失败" };
  const verification = await verifyOfficeFilePath(path.relative(ctx.workspaceRoot, target));
  return {
    ok: true,
    path: path.relative(ctx.workspaceRoot, target),
    verified: verification.ok,
    verification,
    ...(verification.ok ? {} : { warning: "PDF 已生成，但回读校验未通过（可能内容为空或页数为 0）" })
  };
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

// ── 数据质量体检（check_table）：逐列缺失率/类型一致性/异常值/分布，纯 JS、无 Python/联网 ──
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

function toHalfWidth(value) {
  return String(value)
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, " ")
    .replace(/￥/g, "¥");
}

// 解析"像数字"的值：支持千分位、货币符、百分号、全角数字
function parseNumberLike(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  let s = toHalfWidth(String(value)).trim();
  if (!s) return null;
  let percent = false;
  if (s.endsWith("%")) { percent = true; s = s.slice(0, -1).trim(); }
  s = s.replace(/[¥$€£\s]/g, "").replace(/,/g, "");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return percent ? n / 100 : n;
}

const DATE_PATTERNS = [
  { re: /^\d{4}-\d{1,2}-\d{1,2}([ T][\d:.]+Z?)?$/, label: "YYYY-MM-DD" },
  { re: /^\d{4}\/\d{1,2}\/\d{1,2}$/, label: "YYYY/MM/DD" },
  { re: /^\d{4}\.\d{1,2}\.\d{1,2}$/, label: "YYYY.MM.DD" },
  { re: /^\d{4}年\d{1,2}月\d{1,2}日$/, label: "YYYY年MM月DD日" },
  { re: /^\d{1,2}\/\d{1,2}\/\d{4}$/, label: "MM/DD/YYYY" },
  { re: /^\d{4}-\d{1,2}$/, label: "YYYY-MM" },
  { re: /^\d{4}年\d{1,2}月$/, label: "YYYY年MM月" }
];

function matchDatePattern(value) {
  const s = String(value).trim();
  for (const p of DATE_PATTERNS) if (p.re.test(s)) return p.label;
  return null;
}

function inferCellType(value) {
  if (isEmptyCell(value)) return "empty";
  if (value instanceof Date) return "date";
  if (typeof value === "number") return Number.isFinite(value) ? "number" : "empty";
  if (typeof value === "boolean") return "boolean";
  const s = String(value).trim();
  if (/^(true|false|是|否|yes|no)$/i.test(s)) return "boolean";
  if (matchDatePattern(s)) return "date";
  if (parseNumberLike(s) !== null) return "number";
  return "text";
}

function numericStats(nums) {
  const n = nums.length;
  const sorted = [...nums].sort((a, b) => a - b);
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return { min: sorted[0], max: sorted[n - 1], mean, median, stdev: Math.sqrt(variance) };
}

// IQR 法找异常值（四分位距外 1.5 倍）
function numericOutliersIQR(nums) {
  if (nums.length < 4) return { outliers: [] };
  const sorted = [...nums].sort((a, b) => a - b);
  const q = (p) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const q1 = q(0.25);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  if (iqr > 0) {
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return { outliers: nums.filter((n) => n < lower || n > upper) };
  }
  // ≥75% 数值相同（IQR=0）：用相对中位数的大偏离兜底，能抓住"20 个 50 里混进一个 9999"，
  // 又不会把 0/1 这类少数取值误判为异常
  const median = q(0.5);
  const scale = Math.max(Math.abs(median), 1);
  return { outliers: nums.filter((n) => Math.abs(n - median) > 3 * scale) };
}

function typeLabel(type) {
  return { number: "数值", date: "日期", boolean: "布尔", text: "文本", empty: "空" }[type] || type;
}

function columnProfile(header, values) {
  const total = values.length;
  let empty = 0;
  let whitespace = 0;
  const typeCounts = { number: 0, date: 0, boolean: 0, text: 0 };
  const valueCounts = new Map();
  const nums = [];
  const dateFormats = new Set();
  for (const v of values) {
    if (isEmptyCell(v)) { empty += 1; continue; }
    const t = inferCellType(v);
    if (typeCounts[t] !== undefined) typeCounts[t] += 1;
    if (typeof v === "string" && v.trim() && v !== v.trim()) whitespace += 1;
    const key = normalizeTableCell(v).toString().trim();
    valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
    if (t === "number") { const n = parseNumberLike(v); if (n !== null) nums.push(n); }
    if (t === "date") dateFormats.add(v instanceof Date ? "Excel日期" : (matchDatePattern(String(v).trim()) || "其他"));
  }
  const filled = total - empty;
  const dominantType = filled ? Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0] : "empty";
  const dominantCount = filled ? typeCounts[dominantType] : 0;
  const profile = {
    name: header,
    total,
    filled,
    empty,
    missingRate: total ? round1((empty / total) * 100) : 0,
    distinct: valueCounts.size,
    dominantType,
    typeConsistency: filled ? round1((dominantCount / filled) * 100) : 0
  };
  if (dominantType === "number" && nums.length) {
    const s = numericStats(nums);
    const o = numericOutliersIQR(nums);
    profile.numeric = {
      min: round2(s.min), max: round2(s.max), mean: round2(s.mean), median: round2(s.median), stdev: round2(s.stdev),
      outlierCount: o.outliers.length,
      outlierSample: [...new Set(o.outliers)].slice(0, 5).map(round2)
    };
  }
  if (dominantType === "date" && dateFormats.size) profile.dateFormats = [...dateFormats];
  if (dominantType === "text" || dominantType === "boolean") {
    profile.topValues = [...valueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([value, count]) => ({ value: value.slice(0, 40), count }));
  }
  if (whitespace) profile.whitespaceIssues = whitespace;
  return profile;
}

function buildQualityFindings(columns, table) {
  const findings = [];
  if (table.duplicateRows > 0) findings.push({ severity: 0, text: `发现 ${table.duplicateRows} 行完全重复` });
  if (table.emptyColumns > 0) findings.push({ severity: 1, text: `有 ${table.emptyColumns} 个完全空白的列` });
  for (const col of columns) {
    if (col.total && col.missingRate >= 5) {
      findings.push({ severity: col.missingRate >= 30 ? 0 : 1, text: `列「${col.name}」缺失 ${col.missingRate}%（${col.empty}/${col.total}）` });
    }
    if (col.filled && col.dominantType !== "text" && col.dominantType !== "empty" && col.typeConsistency < 90) {
      findings.push({ severity: 1, text: `列「${col.name}」类型不一致：仅 ${col.typeConsistency}% 为${typeLabel(col.dominantType)}` });
    }
    if (col.dateFormats && col.dateFormats.length > 1) {
      findings.push({ severity: 1, text: `列「${col.name}」存在 ${col.dateFormats.length} 种日期格式（${col.dateFormats.join("、")}），建议统一` });
    }
    if (col.numeric && col.numeric.outlierCount > 0) {
      findings.push({ severity: 2, text: `列「${col.name}」有 ${col.numeric.outlierCount} 个疑似异常值，例如 ${col.numeric.outlierSample.join("、")}` });
    }
    if (col.whitespaceIssues) {
      findings.push({ severity: 2, text: `列「${col.name}」有 ${col.whitespaceIssues} 个单元格含首尾空格` });
    }
  }
  findings.sort((a, b) => a.severity - b.severity);
  return findings.map((f) => f.text);
}

function mdCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function qualityReportMarkdown(fileName, sheet, rowCount, columns, table, findings) {
  const lines = [];
  lines.push(`# 数据质量报告：${fileName}`);
  lines.push("");
  lines.push(`- 工作表：${sheet}`);
  lines.push(`- 数据行数：${rowCount}　列数：${columns.length}`);
  lines.push(`- 完全重复行：${table.duplicateRows}　全空行：${table.emptyRows}　全空列：${table.emptyColumns}`);
  lines.push("");
  lines.push("## 主要问题");
  if (findings.length) for (const f of findings) lines.push(`- ${f}`);
  else lines.push("- 未发现明显问题");
  lines.push("");
  lines.push("## 逐列概览");
  lines.push("");
  lines.push("| 列 | 类型 | 缺失率 | 不同值 | 类型一致率 | 备注 |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const col of columns) {
    const note = [];
    if (col.numeric) note.push(`范围 ${col.numeric.min}~${col.numeric.max}，均值 ${col.numeric.mean}`);
    if (col.dateFormats) note.push(`日期格式：${col.dateFormats.join("/")}`);
    if (col.topValues) note.push(`高频：${col.topValues.slice(0, 3).map((t) => `${t.value}(${t.count})`).join("、")}`);
    lines.push(`| ${mdCell(col.name)} | ${typeLabel(col.dominantType)} | ${col.missingRate}% | ${col.distinct} | ${col.typeConsistency}% | ${mdCell(note.join("；"))} |`);
  }
  return lines.join("\n");
}

// 把 .xlsx/.xlsm/.csv/.tsv 读成原始行数组（check_table、chart_from_table 共用）
async function loadTableRows(filePath, args = {}, toolConsent = {}) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".xls") return { ok: false, error: "暂不支持旧版 .xls，请先另存为 .xlsx" };
  if (!isExcelPath(filePath) && ![".csv", ".tsv"].includes(ext)) return { ok: false, error: "仅支持 .xlsx、.xlsm、.csv 或 .tsv 文件" };
  const target = resolveToolPath(filePath, toolConsent, "read");
  const stats = await stat(target);
  if (stats.size > 25 * 1024 * 1024) return { ok: false, error: "表格超过 25MB，已拒绝读取" };
  let sheetName = "";
  let rows = [];
  if ([".csv", ".tsv"].includes(ext)) {
    const text = await readFile(target, "utf8");
    rows = parseDelimitedRows(text, ext === ".tsv" ? "\t" : ",");
    sheetName = ext.slice(1).toUpperCase();
  } else {
    const workbook = await readExcelFile(target);
    const sheetItems = Array.isArray(workbook) && workbook.every((s) => s && typeof s === "object" && Array.isArray(s.data))
      ? workbook
      : [{ sheet: "Sheet1", data: Array.isArray(workbook) ? workbook : [] }];
    const wanted = String(args.sheet ?? "").trim();
    let picked = sheetItems[0];
    if (wanted) {
      const byName = sheetItems.find((s) => String(s.sheet || s.name) === wanted);
      const byIndex = /^\d+$/.test(wanted) ? sheetItems[Number(wanted)] : null;
      picked = byName || byIndex || sheetItems[0];
    }
    sheetName = String(picked.sheet || picked.name || "Sheet1");
    rows = (picked.data || []).map((row) => (Array.isArray(row) ? row : [row]));
  }
  return { ok: true, target, sheetName, rows };
}

function tableHeaders(rows) {
  const headerIndex = firstHeaderRow(rows);
  const headerRow = rows[headerIndex] || [];
  const columnCount = Math.max(0, ...rows.map((r) => (Array.isArray(r) ? r.length : 1)));
  const headers = Array.from({ length: columnCount }, (_, i) => String(headerRow[i] ?? "").trim() || `列${i + 1}`);
  return { headerIndex, headers, columnCount };
}

async function checkTable(args = {}, toolConsent = {}) {
  const filePath = String(args.path || "").trim();
  if (!filePath) return missingRequiredToolArgs("check_table", ["path"]);
  const loaded = await loadTableRows(filePath, args, toolConsent);
  if (!loaded.ok) return loaded;
  const { target, sheetName, rows } = loaded;
  const maxRows = Math.max(1, Math.min(100000, Number(args.max_rows || args.maxRows || 20000)));

  if (!rows.length) {
    return { ok: true, path: toolPathLabel(target), sheet: sheetName, rowCount: 0, columnCount: 0, columns: [], table: { duplicateRows: 0, emptyRows: 0, emptyColumns: 0 }, findings: ["表格为空"], markdown: `# 数据质量报告：${path.basename(filePath)}\n\n表格为空。` };
  }

  const { headerIndex, headers, columnCount } = tableHeaders(rows);
  const dataRows = rows.slice(headerIndex + 1, headerIndex + 1 + maxRows);

  const columns = headers.map((header, i) => columnProfile(header, dataRows.map((r) => r[i])));
  const table = tableQuality(dataRows);
  const findings = buildQualityFindings(columns, table);
  const markdown = qualityReportMarkdown(path.basename(filePath), sheetName, dataRows.length, columns, table, findings);

  return {
    ok: true,
    path: toolPathLabel(target),
    sheet: sheetName,
    rowCount: dataRows.length,
    columnCount,
    columns,
    table,
    findings,
    markdown
  };
}

// ── 表格出图（chart_from_table）：纯 JS 生成 SVG，.svg 直接写盘、.png/.jpg 复用 exportImage ──
const CHART_COLORS = ["#4f7cff", "#ff8a4f", "#2bb673", "#b67cff", "#ff5c8a", "#3bc6d4", "#f4b400", "#8c8c8c"];

function escXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function chartTruncate(value, n) {
  const s = String(value);
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function chartFormatNum(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return `${round2(v / 1e9)}B`;
  if (a >= 1e6) return `${round2(v / 1e6)}M`;
  if (a >= 1e3) return `${round2(v / 1e3)}k`;
  return String(round2(v));
}
function chartNiceCeil(value) {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const f = value / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * base;
}
function svgWrap(width, height, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system, BlinkMacSystemFont, system-ui, sans-serif">${inner}</svg>`;
}

function resolveColumnIndex(headers, spec, fallback) {
  if (spec === undefined || spec === null || String(spec).trim() === "") return fallback;
  const s = String(spec).trim();
  const byName = headers.findIndex((h) => h === s);
  if (byName >= 0) return byName;
  if (/^\d+$/.test(s)) { const i = Number(s); if (i >= 0 && i < headers.length) return i; }
  return -1;
}

function buildCartesianSvg({ type, title, labels, series, width, height }) {
  const m = { top: title ? 48 : 24, right: 24, bottom: 64, left: 64 };
  const legendH = series.length > 1 ? 22 : 0;
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom - legendH;
  const allVals = series.flatMap((s) => s.values);
  let yMax = chartNiceCeil(Math.max(0, ...allVals) || 1);
  let yMin = Math.min(0, ...allVals);
  if (yMin < 0) yMin = -chartNiceCeil(-yMin);
  const yRange = yMax - yMin || 1;
  const yToPx = (v) => m.top + plotH - ((v - yMin) / yRange) * plotH;
  const n = labels.length;
  const band = plotW / Math.max(1, n);
  const parts = [`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`];
  if (title) parts.push(`<text x="${width / 2}" y="28" text-anchor="middle" font-size="18" font-weight="600" fill="#1f2328">${escXml(title)}</text>`);
  const ticks = 5;
  for (let t = 0; t <= ticks; t += 1) {
    const v = yMin + (yRange * t) / ticks;
    const y = round2(yToPx(v));
    parts.push(`<line x1="${m.left}" y1="${y}" x2="${m.left + plotW}" y2="${y}" stroke="#eceef1"/>`);
    parts.push(`<text x="${m.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#8a9099">${escXml(chartFormatNum(v))}</text>`);
  }
  parts.push(`<line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top + plotH}" stroke="#cdd2d8"/>`);
  parts.push(`<line x1="${m.left}" y1="${round2(yToPx(0))}" x2="${m.left + plotW}" y2="${round2(yToPx(0))}" stroke="#cdd2d8"/>`);
  const rotate = n > 8;
  for (let i = 0; i < n; i += 1) {
    const cx = round2(m.left + band * i + band / 2);
    const ly = m.top + plotH + 16;
    const label = escXml(chartTruncate(labels[i], 14));
    parts.push(rotate
      ? `<text x="${cx}" y="${ly}" transform="rotate(-40 ${cx} ${ly})" text-anchor="end" font-size="11" fill="#5a6169">${label}</text>`
      : `<text x="${cx}" y="${ly}" text-anchor="middle" font-size="11" fill="#5a6169">${label}</text>`);
  }
  if (type === "bar") {
    const groupW = band * 0.7;
    const barW = groupW / series.length;
    series.forEach((s, si) => s.values.forEach((v, i) => {
      const x = m.left + band * i + (band - groupW) / 2 + barW * si;
      const y0 = yToPx(0);
      const y = yToPx(v);
      parts.push(`<rect x="${round2(x)}" y="${round2(Math.min(y, y0))}" width="${round2(barW)}" height="${round2(Math.abs(y - y0))}" fill="${s.color}"><title>${escXml(s.name)}: ${escXml(chartFormatNum(v))}</title></rect>`);
    }));
  } else {
    series.forEach((s) => {
      const pts = s.values.map((v, i) => `${round2(m.left + band * i + band / 2)},${round2(yToPx(v))}`).join(" ");
      parts.push(`<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2"/>`);
      s.values.forEach((v, i) => parts.push(`<circle cx="${round2(m.left + band * i + band / 2)}" cy="${round2(yToPx(v))}" r="3" fill="${s.color}"><title>${escXml(s.name)}: ${escXml(chartFormatNum(v))}</title></circle>`));
    });
  }
  if (series.length > 1) {
    const ly = height - 6;
    let lx = m.left;
    series.forEach((s) => {
      parts.push(`<rect x="${round2(lx)}" y="${ly - 11}" width="12" height="12" fill="${s.color}"/>`);
      parts.push(`<text x="${round2(lx + 16)}" y="${ly}" font-size="12" fill="#3a4047">${escXml(chartTruncate(s.name, 18))}</text>`);
      lx += 28 + Math.min(18, chartTruncate(s.name, 18).length) * 9;
    });
  }
  return svgWrap(width, height, parts.join(""));
}

function buildPieSvg({ title, labels, series, width, height }) {
  const s = series[0];
  const data = labels.map((l, i) => ({ label: l, value: Math.max(0, s.values[i]) })).filter((d) => d.value > 0);
  const total = data.reduce((a, d) => a + d.value, 0);
  const parts = [`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`];
  if (title) parts.push(`<text x="${width / 2}" y="28" text-anchor="middle" font-size="18" font-weight="600" fill="#1f2328">${escXml(title)}</text>`);
  if (!total) {
    parts.push(`<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="14" fill="#8a9099">无正数值可出饼图</text>`);
    return svgWrap(width, height, parts.join(""));
  }
  const topPad = title ? 44 : 16;
  const cx = width * 0.36;
  const cy = topPad + (height - topPad) / 2;
  const radius = Math.max(20, Math.min(cx - 16, (height - topPad - 24) / 2));
  if (data.length === 1) {
    parts.push(`<circle cx="${round2(cx)}" cy="${round2(cy)}" r="${round2(radius)}" fill="${CHART_COLORS[0]}"><title>${escXml(data[0].label)}: 100%</title></circle>`);
  } else {
    let angle = -Math.PI / 2;
    data.forEach((d, i) => {
      const frac = d.value / total;
      const a2 = angle + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const x1 = cx + radius * Math.cos(angle);
      const y1 = cy + radius * Math.sin(angle);
      const x2 = cx + radius * Math.cos(a2);
      const y2 = cy + radius * Math.sin(a2);
      parts.push(`<path d="M ${round2(cx)} ${round2(cy)} L ${round2(x1)} ${round2(y1)} A ${round2(radius)} ${round2(radius)} 0 ${large} 1 ${round2(x2)} ${round2(y2)} Z" fill="${CHART_COLORS[i % CHART_COLORS.length]}" stroke="#ffffff" stroke-width="1"><title>${escXml(d.label)}: ${escXml(chartFormatNum(d.value))} (${Math.round(frac * 100)}%)</title></path>`);
      angle = a2;
    });
  }
  let ly = topPad + 12;
  const lx = width * 0.7;
  data.slice(0, 12).forEach((d, i) => {
    parts.push(`<rect x="${round2(lx)}" y="${ly - 10}" width="12" height="12" fill="${CHART_COLORS[i % CHART_COLORS.length]}"/>`);
    parts.push(`<text x="${round2(lx + 16)}" y="${ly}" font-size="12" fill="#3a4047">${escXml(chartTruncate(d.label, 16))} ${Math.round((d.value / total) * 100)}%</text>`);
    ly += 20;
  });
  return svgWrap(width, height, parts.join(""));
}

function buildChartSvg(spec) {
  return spec.type === "pie" ? buildPieSvg(spec) : buildCartesianSvg(spec);
}

function defaultChartOutputPath(inputPath, type) {
  const base = path.basename(inputPath, path.extname(inputPath));
  // 默认 SVG：文字一定在、可缩放、浏览器/Office 都能打开；PNG/JPG 在桌面端渲染文字完整
  return `charts/${base}-${type}.svg`;
}

async function chartFromTable(args = {}, toolConsent = {}) {
  const filePath = String(args.path || "").trim();
  if (!filePath) return missingRequiredToolArgs("chart_from_table", ["path"]);
  let type = String(args.type || args.chart_type || "bar").toLowerCase();
  if (!["line", "bar", "column", "pie"].includes(type)) return { ok: false, error: "chart_from_table 的 type 仅支持 line、bar、pie" };
  if (type === "column") type = "bar";

  const loaded = await loadTableRows(filePath, args, toolConsent);
  if (!loaded.ok) return loaded;
  const { rows } = loaded;
  if (!rows.length) return { ok: false, error: "表格为空，无法出图" };

  const { headerIndex, headers } = tableHeaders(rows);
  const maxPoints = Math.max(1, Math.min(200, Number(args.max_points || args.maxPoints || 50)));
  const dataRows = rows.slice(headerIndex + 1).filter((r) => r.some((c) => !isEmptyCell(c))).slice(0, maxPoints);
  if (!dataRows.length) return { ok: false, error: "没有可用于出图的数据行" };

  const labelIdx = resolveColumnIndex(headers, args.label_column ?? args.x, 0);
  if (labelIdx < 0) return { ok: false, error: `找不到标签列：${args.label_column ?? args.x}` };

  let valueIdx = [];
  const rawValueSpec = args.value_columns ?? args.values ?? args.y;
  if (rawValueSpec !== undefined && rawValueSpec !== null && String(rawValueSpec).trim() !== "") {
    const specs = Array.isArray(rawValueSpec) ? rawValueSpec : String(rawValueSpec).split(/[,，]/);
    for (const sp of specs) {
      const i = resolveColumnIndex(headers, sp, -1);
      if (i >= 0 && i !== labelIdx && !valueIdx.includes(i)) valueIdx.push(i);
    }
    if (!valueIdx.length) return { ok: false, error: "指定的数值列无效" };
  } else {
    for (let i = 0; i < headers.length; i += 1) {
      if (i === labelIdx) continue;
      const sample = dataRows.map((r) => r[i]).filter((c) => !isEmptyCell(c));
      const numeric = sample.filter((c) => parseNumberLike(c) !== null).length;
      if (sample.length && numeric / sample.length >= 0.6) valueIdx.push(i);
    }
    if (!valueIdx.length) return { ok: false, error: "未找到可出图的数值列，请用 value_columns 指定" };
  }
  if (type === "pie") valueIdx = valueIdx.slice(0, 1);

  const labels = dataRows.map((r) => String(normalizeTableCell(r[labelIdx]) ?? "").trim() || "-");
  const series = valueIdx.map((idx, k) => ({
    name: headers[idx],
    color: CHART_COLORS[k % CHART_COLORS.length],
    values: dataRows.map((r) => { const num = parseNumberLike(r[idx]); return num === null ? 0 : num; })
  }));

  const width = clamp(Number(args.width || 900), 320, 4096);
  const height = clamp(Number(args.height || 540), 240, 4096);
  const title = String(args.title || "").trim();
  const svg = buildChartSvg({ type, title, labels, series, width, height });

  let outRel = String(args.output_path || args.outputPath || "").trim();
  if (!outRel) outRel = defaultChartOutputPath(filePath, type);
  const outExt = path.extname(outRel).toLowerCase();
  if (![".svg", ".png", ".jpg", ".jpeg"].includes(outExt)) return { ok: false, error: "output_path 需用 .svg、.png 或 .jpg 后缀" };

  if (outExt === ".svg") {
    const finalRel = args.overwrite ? outRel : uniqueWorkspaceOutputPath(outRel);
    const target = resolveWorkspacePath(finalRel);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, svg, "utf8");
    const stats = await stat(target);
    return { ok: true, path: path.relative(ctx.workspaceRoot, target), type, format: "svg", size: stats.size, series: series.map((s) => s.name), points: labels.length };
  }

  const result = await exportImage({ svg, output_path: outRel, width, height, transparent: args.transparent !== false, overwrite: args.overwrite }, toolConsent);
  if (!result.ok) return result;
  return { ...result, type, series: series.map((s) => s.name), points: labels.length };
}

// ── 透视/分组汇总（pivot_table）：分组聚合 + 可选交叉透视，结果落成 xlsx/csv ──
const PIVOT_AGGS = {
  sum: "求和",
  avg: "平均",
  count: "计数",
  min: "最小",
  max: "最大"
};

function aggregateNums(agg, nums, count) {
  if (agg === "count") return count;
  if (!nums.length) return 0;
  if (agg === "sum") return round2(nums.reduce((a, b) => a + b, 0));
  if (agg === "avg") return round2(nums.reduce((a, b) => a + b, 0) / nums.length);
  if (agg === "min") return round2(Math.min(...nums));
  if (agg === "max") return round2(Math.max(...nums));
  return 0;
}

function resolveColumnList(headers, spec) {
  if (spec === undefined || spec === null || String(spec).trim() === "") return [];
  const specs = Array.isArray(spec) ? spec : String(spec).split(/[,，]/);
  const out = [];
  for (const sp of specs) { const i = resolveColumnIndex(headers, sp, -1); if (i >= 0 && !out.includes(i)) out.push(i); }
  return out;
}

function autoNumericColumns(headers, dataRows, exclude) {
  const out = [];
  for (let i = 0; i < headers.length; i += 1) {
    if (exclude.has(i)) continue;
    const sample = dataRows.map((r) => r[i]).filter((c) => !isEmptyCell(c));
    const numeric = sample.filter((c) => parseNumberLike(c) !== null).length;
    if (sample.length && numeric / sample.length >= 0.6) out.push(i);
  }
  return out;
}

function pivotKeyLabel(value) {
  if (isEmptyCell(value)) return "(空)";
  return String(normalizeTableCell(value)).trim() || "(空)";
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function defaultPivotOutputPath(inputPath) {
  return `pivots/${path.basename(inputPath, path.extname(inputPath))}-pivot.xlsx`;
}

async function pivotTable(args = {}, toolConsent = {}) {
  const filePath = String(args.path || "").trim();
  if (!filePath) return missingRequiredToolArgs("pivot_table", ["path"]);
  const agg = String(args.agg || args.aggfunc || args.aggregate || "sum").toLowerCase();
  if (!PIVOT_AGGS[agg]) return { ok: false, error: `pivot_table 的 agg 仅支持 ${Object.keys(PIVOT_AGGS).join("、")}` };

  const loaded = await loadTableRows(filePath, args, toolConsent);
  if (!loaded.ok) return loaded;
  const { rows } = loaded;
  if (!rows.length) return { ok: false, error: "表格为空，无法透视" };
  const { headerIndex, headers } = tableHeaders(rows);
  const maxRows = Math.max(1, Math.min(200000, Number(args.max_rows || args.maxRows || 100000)));
  const dataRows = rows.slice(headerIndex + 1, headerIndex + 1 + maxRows).filter((r) => r.some((c) => !isEmptyCell(c)));
  if (!dataRows.length) return { ok: false, error: "没有可透视的数据行" };

  const groupIdx = resolveColumnList(headers, args.group_by ?? args.rows ?? args.index);
  const pivotIdx = resolveColumnIndex(headers, args.pivot_column ?? args.columns, -1);
  if ((args.pivot_column ?? args.columns) && pivotIdx < 0) return { ok: false, error: `找不到透视列：${args.pivot_column ?? args.columns}` };

  // 度量列：count 不需要；其它没指定就自动找数值列
  let valueIdx = resolveColumnList(headers, args.values ?? args.value_columns ?? args.measures);
  if (agg !== "count" && !valueIdx.length) {
    const exclude = new Set([...groupIdx, pivotIdx].filter((i) => i >= 0));
    valueIdx = autoNumericColumns(headers, dataRows, exclude);
    if (!valueIdx.length) return { ok: false, error: "未找到要汇总的数值列，请用 values 指定" };
  }

  let header = [];
  let body = [];

  if (pivotIdx >= 0) {
    // 交叉透视：行维度 × 一个透视列 → 单一度量
    const measureIdx = agg === "count" ? -1 : valueIdx[0];
    const colVals = [];
    const colSeen = new Set();
    const groups = new Map();
    for (const r of dataRows) {
      const keyVals = groupIdx.map((i) => pivotKeyLabel(r[i]));
      const gkey = keyVals.join("") || "总计";
      const cval = pivotKeyLabel(r[pivotIdx]);
      if (!colSeen.has(cval) && colVals.length < 60) { colSeen.add(cval); colVals.push(cval); }
      else if (!colSeen.has(cval)) continue; // 超过 60 个透视值就丢弃多余的
      let g = groups.get(gkey);
      if (!g) { g = { keyVals, cells: new Map() }; groups.set(gkey, g); }
      let cell = g.cells.get(cval);
      if (!cell) { cell = { nums: [], count: 0 }; g.cells.set(cval, cell); }
      cell.count += 1;
      if (measureIdx >= 0) { const n = parseNumberLike(r[measureIdx]); if (n !== null) cell.nums.push(n); }
    }
    const measureLabel = agg === "count" ? "计数" : `${PIVOT_AGGS[agg]}(${headers[measureIdx]})`;
    header = [...groupIdx.map((i) => headers[i]), ...colVals];
    if (!groupIdx.length) header = ["汇总", ...colVals];
    for (const g of groups.values()) {
      const left = groupIdx.length ? g.keyVals : ["总计"];
      const cells = colVals.map((cv) => { const c = g.cells.get(cv); return c ? aggregateNums(agg, c.nums, c.count) : 0; });
      body.push([...left, ...cells]);
    }
    body.sort((a, b) => (Number(b[b.length - 1]) || 0) - (Number(a[a.length - 1]) || 0));
    return finalizePivot(args, filePath, header, body, { mode: "crosstab", agg, measure: measureLabel, rows: body.length, columns: header.length });
  }

  // 分组聚合：行维度 → 一到多个度量
  const groups = new Map();
  for (const r of dataRows) {
    const keyVals = groupIdx.map((i) => pivotKeyLabel(r[i]));
    const gkey = keyVals.join("") || "总计";
    let g = groups.get(gkey);
    if (!g) { g = { keyVals, count: 0, nums: valueIdx.map(() => []) }; groups.set(gkey, g); }
    g.count += 1;
    if (agg !== "count") valueIdx.forEach((ci, mi) => { const n = parseNumberLike(r[ci]); if (n !== null) g.nums[mi].push(n); });
  }
  if (agg === "count") {
    header = [...(groupIdx.length ? groupIdx.map((i) => headers[i]) : ["汇总"]), "计数"];
    for (const g of groups.values()) body.push([...(groupIdx.length ? g.keyVals : ["总计"]), g.count]);
  } else {
    header = [...(groupIdx.length ? groupIdx.map((i) => headers[i]) : ["汇总"]), ...valueIdx.map((i) => `${PIVOT_AGGS[agg]}(${headers[i]})`)];
    for (const g of groups.values()) {
      body.push([...(groupIdx.length ? g.keyVals : ["总计"]), ...valueIdx.map((_, mi) => aggregateNums(agg, g.nums[mi], g.count))]);
    }
  }
  body.sort((a, b) => (Number(b[b.length - 1]) || 0) - (Number(a[a.length - 1]) || 0));
  return finalizePivot(args, filePath, header, body, { mode: "groupby", agg, groups: body.length, rows: body.length, columns: header.length });
}

async function finalizePivot(args, filePath, header, body, meta) {
  let outRel = String(args.output_path || args.outputPath || "").trim();
  if (!outRel) outRel = defaultPivotOutputPath(filePath);
  const outExt = path.extname(outRel).toLowerCase();
  if (![".xlsx", ".csv"].includes(outExt)) return { ok: false, error: "pivot_table 的 output_path 需用 .xlsx 或 .csv 后缀" };
  const preview = body.slice(0, 20);

  if (outExt === ".csv") {
    const finalRel = args.overwrite ? outRel : uniqueWorkspaceOutputPath(outRel);
    const target = resolveWorkspacePath(finalRel);
    await mkdir(path.dirname(target), { recursive: true });
    const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
    await writeFile(target, `﻿${csv}`, "utf8");
    const stats = await stat(target);
    return { ok: true, path: path.relative(ctx.workspaceRoot, target), format: "csv", size: stats.size, header, preview, ...meta };
  }

  const result = await createExcelWorkbook({ path: outRel, sheet_name: "透视", columns: header, rows: body, overwrite: args.overwrite });
  if (!result.ok) return result;
  return { ...result, format: "xlsx", header, preview, ...meta };
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
  // Homebrew/系统 Python 受 PEP 668 保护（externally-managed-environment），
  // 直装失败时回退加 --break-system-packages
  const base = `${runtime?.found ? runtime.command : "python3"} -m pip install --upgrade ${installNames.join(" ")}`;
  if (process.platform === "win32") return base;
  return `${base} || ${base} --break-system-packages`;
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

// 判断 IP 是否属于环回 / 私有 / 链路本地（含云元数据 169.254.169.254）等不应被服务端访问的地址
export function isPrivateIpAddress(ip) {
  if (!ip) return true;
  let addr = String(ip).toLowerCase().trim();
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/); // IPv6 映射的 IPv4
  if (mapped) addr = mapped[1];
  if (addr.includes(":")) {
    if (addr === "::1" || addr === "::") return true;          // 环回 / 未指定
    if (/^fe80:/.test(addr)) return true;                      // 链路本地
    if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true;          // 唯一本地 fc00::/7
    return false;
  }
  const parts = addr.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 127) return true;                       // 0.0.0.0/8、环回
  if (a === 10) return true;                                   // 私有
  if (a === 172 && b >= 16 && b <= 31) return true;            // 私有
  if (a === 192 && b === 168) return true;                     // 私有
  if (a === 169 && b === 254) return true;                     // 链路本地 + 云元数据
  if (a >= 224) return true;                                   // 组播 / 保留
  return false;
}

// 服务端抓取前的 SSRF 守护：拒绝指向本地 / 内网 / 云元数据的地址。
// 注意：仅校验初始地址；fetch 跟随的跳转目标不在此覆盖范围内。
async function assertFetchAllowed(url) {
  const host = String(url.hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  const blocked = () => Object.assign(new Error("出于安全考虑，已拒绝访问本地或内网地址"), { status: 400 });
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw blocked();
  if (isIP(host)) { if (isPrivateIpAddress(host)) throw blocked(); return; }
  let records = [];
  try { records = await dnsLookup(host, { all: true }); } catch { return; /* 解析失败交给后续 fetch 自行报错 */ }
  if (records.some((r) => isPrivateIpAddress(r.address))) throw blocked();
}

// 抓取网页/搜索引擎时使用真实浏览器 UA，避免被识别为爬虫直接返回空页或验证页
const BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchUrlBuffer(url, options = {}) {
  const maxBytes = options.maxBytes || 20 * 1024 * 1024;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 25000);
  const headers = { "User-Agent": BROWSER_USER_AGENT, "Accept": options.accept || "text/html,application/xhtml+xml,text/plain,*/*;q=0.8" };
  try {
    // 手动跟随跳转：每一跳的目标都重新做 SSRF 校验，堵住"初始公网→302 跳内网"的绕过
    let current = new URL(url.toString());
    let response;
    const maxRedirects = 5;
    for (let hop = 0; ; hop += 1) {
      response = await fetch(current.toString(), { redirect: "manual", signal: controller.signal, headers });
      const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : "";
      if (!location) break;
      if (hop >= maxRedirects) { const e = new Error("网页跳转次数过多"); e.status = 310; throw e; }
      const next = new URL(location, current);
      if (next.protocol !== "http:" && next.protocol !== "https:") { const e = new Error("出于安全考虑，已拒绝非 http(s) 跳转"); e.status = 400; throw e; }
      await assertFetchAllowed(next);
      current = next;
    }
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

// 按 HTTP 头 charset、BOM 和 HTML <meta> 声明探测网页编码。
// 国内站点常用 GBK / GB2312 / GB18030，统一按 utf-8 解码会乱码。
export function detectCharset(buffer, contentType = "") {
  const headerMatch = String(contentType || "").match(/charset\s*=\s*["']?([\w-]+)/i);
  if (headerMatch) return headerMatch[1].toLowerCase();
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return "utf-8";
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return "utf-16le";
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return "utf-16be";
  // 用 latin1 粗解头部 4KB 找 meta 声明（此时还不知道编码，但 ASCII 部分不受影响）
  const head = buffer.slice(0, 4096).toString("latin1");
  const metaCharset = head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
  if (metaCharset) return metaCharset[1].toLowerCase();
  const metaHttp = head.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i);
  if (metaHttp) return metaHttp[1].toLowerCase();
  return "utf-8";
}

// 根据探测到的编码解码网页字节；Node 18+ 自带 full-ICU，原生支持 gbk/gb18030/big5。
export function decodeHtmlBuffer(buffer, contentType = "") {
  const charset = detectCharset(buffer, contentType);
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buffer);
  } catch {
    try { return new TextDecoder("utf-8", { fatal: false }).decode(buffer); } catch { return buffer.toString("utf8"); }
  }
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

// 优先提取网页主正文，剥离导航/页眉/页脚/侧栏/表单等模板噪音；提取不到实质内容时回退去噪后的全文。
export function extractMainContent(html = "") {
  if (!html) return "";
  const stripped = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, "")
    .replace(/<header\b[\s\S]*?<\/header>/gi, "")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, "")
    .replace(/<form\b[\s\S]*?<\/form>/gi, "");
  let best = "";
  const tagRe = /<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = tagRe.exec(stripped))) {
    const text = htmlToText(m[2]);
    if (text.length > best.length) best = text;
  }
  if (best.length >= 200) return best;
  return htmlToText(stripped);
}

async function readWebPage(args = {}) {
  const url = requireHttpUrl(args.url);
  await assertFetchAllowed(url);
  const maxChars = clamp(Number(args.max_chars || args.maxChars || 12000), 1000, 60000);
  const { response, buffer, contentType } = await fetchUrlBuffer(url, { maxBytes: 12 * 1024 * 1024 });
  const raw = decodeHtmlBuffer(buffer, contentType);
  const isHtml = /html|xml/i.test(contentType) || /<\/?[a-z][\s\S]*>/i.test(raw.slice(0, 2000));
  const title = isHtml ? htmlTitle(raw) : "";
  const description = isHtml ? htmlMetaDescription(raw) : "";
  const fullText = isHtml ? extractMainContent(raw) : compactWhitespace(raw);
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

// 批量读取多个网页正文：复用单页的编码探测、SSRF 守护与主正文提取，限并发并行抓取。
async function readOneWebPageForBatch(rawUrl, maxChars) {
  try {
    const url = requireHttpUrl(rawUrl);
    await assertFetchAllowed(url);
    const { response, buffer, contentType } = await fetchUrlBuffer(url, { maxBytes: 8 * 1024 * 1024, timeoutMs: 20000 });
    const raw = decodeHtmlBuffer(buffer, contentType);
    const isHtml = /html|xml/i.test(contentType) || /<\/?[a-z][\s\S]*>/i.test(raw.slice(0, 2000));
    const title = isHtml ? htmlTitle(raw) : "";
    const fullText = isHtml ? extractMainContent(raw) : compactWhitespace(raw);
    const truncated = fullText.length > maxChars;
    const text = truncated ? `${fullText.slice(0, maxChars)}\n...[内容过长已截断]` : fullText;
    return { url: response.url || url.toString(), ok: true, title, text, chars: fullText.length, truncated };
  } catch (err) {
    return { url: String(rawUrl || ""), ok: false, error: err.message || "读取失败" };
  }
}

async function readWebPages(args = {}) {
  const urls = Array.isArray(args.urls) ? args.urls.map((u) => String(u || "").trim()).filter(Boolean) : [];
  if (!urls.length) return { ok: false, error: "请提供至少一个网页地址（urls）" };
  const limited = [...new Set(urls)].slice(0, 8);
  const maxChars = clamp(Number(args.max_chars_each || args.maxCharsEach || 6000), 500, 20000);
  const pages = [];
  const concurrency = 4;
  for (let i = 0; i < limited.length; i += concurrency) {
    const batch = limited.slice(i, i + concurrency);
    pages.push(...await Promise.all(batch.map((u) => readOneWebPageForBatch(u, maxChars))));
  }
  const okCount = pages.filter((p) => p.ok).length;
  return { ok: okCount > 0, count: pages.length, okCount, pages, ...(okCount ? {} : { error: "所有网页均读取失败" }) };
}

// 把结构化搜集结果渲染成统一格式的 Markdown 简报：标题 / 日期 / 摘要 / 分主题正文 / 去重来源
export function buildResearchReport({ title, summary, sections, sources } = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`# ${String(title || "搜集简报").trim()}`, "", `> 整理日期：${date}`, ""];
  if (summary && String(summary).trim()) lines.push("## 摘要", "", String(summary).trim(), "");
  for (const sec of Array.isArray(sections) ? sections : []) {
    const heading = String(sec?.heading || "").trim();
    const content = String(sec?.content || "").trim();
    if (!heading && !content) continue;
    if (heading) lines.push(`## ${heading}`, "");
    if (content) lines.push(content, "");
  }
  const seen = new Set();
  const uniqueSources = [];
  for (const s of Array.isArray(sources) ? sources : []) {
    const url = String(s?.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    uniqueSources.push({ title: String(s?.title || "").trim() || url, url });
  }
  if (uniqueSources.length) {
    lines.push("## 来源", "");
    for (const s of uniqueSources) lines.push(`- [${s.title}](${s.url})（取用于 ${date}）`);
    lines.push("");
  }
  return { markdown: `${lines.join("\n").trim()}\n`, sourceCount: uniqueSources.length, date };
}

async function saveResearchReport(args = {}) {
  const title = String(args.title || "").trim();
  if (!title) return missingRequiredToolArgs("save_research_report", ["title"]);
  const { markdown, sourceCount, date } = buildResearchReport(args);
  const safeTitle = title.replace(/[\\/:*?"<>|\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "report";
  const rel = String(args.output_path || args.outputPath || "").trim() || path.join("Research", `${date}-${safeTitle}.md`);
  const target = resolveWorkspacePath(rel);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, markdown, "utf8");
  return { ok: true, path: path.relative(ctx.workspaceRoot, target), sourceCount, chars: markdown.length };
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

// Bing 常把结果链接包成跳转 https://www.bing.com/ck/a?...&u=a1<base64url>，需还原真实地址
export function bingRedirectUrl(value) {
  try {
    const parsed = new URL(value);
    if (/(^|\.)bing\.com$/i.test(parsed.hostname) && parsed.pathname.startsWith("/ck/")) {
      const u = parsed.searchParams.get("u");
      if (u) {
        const decoded = Buffer.from(u.replace(/^a1/, ""), "base64url").toString("utf8");
        if (/^https?:\/\//.test(decoded)) return decoded;
      }
    }
  } catch { /* 非法 URL，原样返回 */ }
  return value;
}

function hostOf(value) {
  try { return new URL(value).hostname; } catch { return ""; }
}

function isBingInternalHost(host) {
  return /(^|\.)(bing|microsoft|msn|microsofttranslator)\.com$/i.test(host);
}

function parseBingHtml(html, baseUrl, limit) {
  const results = [];
  const seen = new Set();
  // Bing 每条结果在 <li class="b_algo"> 内，标题在 <h2><a href>，摘要在 <p>
  const blockRe = /<li[^>]+class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const titleRe = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
  const snippetRe = /<p[^>]*>([\s\S]*?)<\/p>/i;
  let block;
  while ((block = blockRe.exec(html)) && results.length < limit) {
    const body = block[1];
    const titleMatch = titleRe.exec(body);
    if (!titleMatch) continue;
    const url = bingRedirectUrl(decodeHtmlEntities(titleMatch[1]).trim());
    if (!/^https?:\/\//.test(url) || isBingInternalHost(hostOf(url))) continue;
    const key = url.replace(/#.*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const snippetMatch = snippetRe.exec(body);
    results.push({ title: htmlToText(titleMatch[2]).trim() || url, url, snippet: snippetMatch ? htmlToText(snippetMatch[1]).trim() : "" });
  }
  // 结构没匹配到时退回通用链接提取，并过滤掉 Bing 自身导航链接
  if (!results.length) {
    for (const link of extractLinks(html, baseUrl, 80)) {
      const resolved = bingRedirectUrl(link.url);
      if (!/^https?:\/\//.test(resolved) || isBingInternalHost(hostOf(resolved))) continue;
      const key = resolved.replace(/#.*$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ title: link.text, url: resolved, snippet: "" });
      if (results.length >= limit) break;
    }
  }
  return results;
}

// ── 搜索结果短 TTL 缓存（减少重复检索的实时请求与限流命中）─────────────────
const SEARCH_CACHE_TTL_MS = Number(process.env.NEO_AI_SEARCH_CACHE_MS || 5 * 60 * 1000);
const SEARCH_CACHE_MAX = 50;
const SEARCH_RETRY_DELAY_MS = Number(process.env.NEO_AI_SEARCH_RETRY_MS || 350);
const searchCache = new Map();

function searchCacheKey(query, limit, freshness = "") {
  return `${String(query).toLowerCase().replace(/\s+/g, " ").trim()}::${limit}::${String(freshness || "").toLowerCase()}`;
}

// 时效过滤：best-effort 映射到各引擎原生参数，不支持的引擎忽略
function freshnessParamsForEngine(engineName, freshness) {
  const f = String(freshness || "").toLowerCase();
  if (!f) return {};
  if (/duckduckgo/i.test(engineName)) {
    const df = { day: "d", week: "w", month: "m", year: "y" }[f];
    return df ? { df } : {};
  }
  if (/bing/i.test(engineName)) {
    const filters = { day: 'ex1:"ez1"', week: 'ex1:"ez2"', month: 'ex1:"ez3"' }[f];
    return filters ? { filters } : {};
  }
  return {};
}

function readSearchCache(key) {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SEARCH_CACHE_TTL_MS) { searchCache.delete(key); return null; }
  searchCache.delete(key); searchCache.set(key, hit); // 触达即刷新为最近使用
  return hit.value;
}

function writeSearchCache(key, value) {
  searchCache.set(key, { at: Date.now(), value });
  while (searchCache.size > SEARCH_CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
}

export function resetSearchCache() { searchCache.clear(); }

async function fetchSearchEngine(engine, limit) {
  const reqUrl = new URL(engine.url);
  for (const [k, v] of Object.entries(engine.params)) reqUrl.searchParams.set(k, v);
  const { response, buffer, contentType } = await fetchUrlBuffer(reqUrl, { maxBytes: 5 * 1024 * 1024, timeoutMs: 20000 });
  const html = decodeHtmlBuffer(buffer, contentType);
  return engine.parse(html, response.url || reqUrl.toString(), limit);
}

export async function searchWeb(args = {}) {
  const rawQuery = String(args.query || "").trim();
  if (!rawQuery) return { ok: false, error: "缺少搜索关键词" };
  const limit = clamp(Number(args.limit || 8), 1, 12);
  const site = String(args.site || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const freshness = String(args.freshness || "").trim().toLowerCase();
  // site 限定通过查询语法实现，对所有引擎通用；已含 site: 时不重复追加
  const query = site && !/\bsite:/i.test(rawQuery) ? `${rawQuery} site:${site}` : rawQuery;

  const cacheKey = searchCacheKey(query, limit, freshness);
  const cached = readSearchCache(cacheKey);
  if (cached) return { ...cached, cached: true };

  const ddg = { name: "DuckDuckGo", url: "https://duckduckgo.com/html/", params: { q: query, kl: "cn-zh" }, parse: parseDuckDuckGoHtml };
  const ddgLite = { name: "DuckDuckGo Lite", url: "https://lite.duckduckgo.com/lite/", params: { q: query }, parse: parseDuckDuckGoHtml };
  const brave = { name: "Brave", url: "https://search.brave.com/search", params: { q: query, source: "web" }, parse: parseBraveHtml };
  const bing = { name: "Bing", url: "https://cn.bing.com/search", params: { q: query, ensearch: "0" }, parse: parseBingHtml };

  // 中文查询优先国内可直连、中文命中更好的 Bing；英文查询保持 DuckDuckGo 优先
  const hasCJK = /[一-鿿]/.test(query);
  let engines = hasCJK ? [bing, ddg, ddgLite, brave] : [ddg, ddgLite, brave, bing];
  // 合并 best-effort 时效参数（不支持的引擎自动忽略）
  if (freshness) engines = engines.map((e) => ({ ...e, params: { ...e.params, ...freshnessParamsForEngine(e.name, freshness) } }));

  const errors = [];
  for (const engine of engines) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const results = await fetchSearchEngine(engine, limit);
        if (results.length) {
          const value = { ok: true, query, results, engine: engine.name };
          writeSearchCache(cacheKey, value);
          return value;
        }
        break; // 引擎可达但无结果：直接换下一个引擎，不重试
      } catch (err) {
        errors.push(`${engine.name}${attempt ? "（重试）" : ""}: ${err.message}`);
        // 超时/中断不重试（否则要再等一个完整超时），其余瞬时错误退避后重试一次
        if (attempt === 0 && err.status !== 408 && err.name !== "AbortError") {
          await new Promise((r) => setTimeout(r, SEARCH_RETRY_DELAY_MS + Math.floor(Math.random() * 250)));
          continue;
        }
        break;
      }
    }
  }
  return { ok: false, error: `所有搜索引擎均不可用：${errors.join("；")}`, query };
}

async function downloadUrl(args = {}) {
  const url = requireHttpUrl(args.url);
  await assertFetchAllowed(url);
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

// ── Markdown → Word 结构 ─────────────────────────────────────────────────────
function stripInlineMd(value = "") {
  return String(value)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1（$2）");
}

function splitMarkdownTableRow(line = "") {
  return String(line).trim().replace(/^\||\|$/g, "").split("|").map((cell) => stripInlineMd(cell.trim()));
}

function parseMarkdownTable(lines, start) {
  const headers = splitMarkdownTableRow(lines[start]);
  const rows = [];
  let i = start + 2; // 跳过分隔行
  for (; i < lines.length; i += 1) {
    if (!/^\s*\|.*\|\s*$/.test(lines[i])) break;
    rows.push(splitMarkdownTableRow(lines[i]));
  }
  return { table: { headers, rows }, nextIndex: i };
}

// 把 Markdown 解析成 docx 生成所需的 { title, paragraphs, sections, tables } 结构
export function markdownToDocxArgs(markdown = "", title = "") {
  const lines = String(markdown).replace(/\r/g, "").split("\n");
  const result = { title: String(title || "").trim(), paragraphs: [], sections: [], tables: [] };
  let current = null;
  let para = [];
  const ensureSection = () => { if (!current) { current = { title: "", paragraphs: [], bullets: [] }; result.sections.push(current); } return current; };
  const flushPara = () => {
    if (!para.length) return;
    const text = stripInlineMd(para.join(" ").trim());
    para = [];
    if (text) (current ? current.paragraphs : result.paragraphs).push(text);
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\s+$/, "");
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);
    if (isTableRow && i + 1 < lines.length && lines[i + 1].includes("-") && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      flushPara();
      const parsed = parseMarkdownTable(lines, i);
      if (parsed.table.headers.length || parsed.table.rows.length) result.tables.push(parsed.table);
      i = parsed.nextIndex - 1;
      continue;
    }
    if (heading) {
      flushPara();
      const text = stripInlineMd(heading[2].trim());
      if (!result.title) { result.title = text; continue; }
      current = { title: text, paragraphs: [], bullets: [] };
      result.sections.push(current);
      continue;
    }
    if (bullet) { flushPara(); ensureSection().bullets.push(stripInlineMd(bullet[1])); continue; }
    if (ordered) { flushPara(); ensureSection().bullets.push(stripInlineMd(ordered[1])); continue; }
    if (!line.trim()) { flushPara(); continue; }
    para.push(line);
  }
  flushPara();
  if (!result.title) result.title = "neo 文档";
  return result;
}

async function createWordDocument(args = {}) {
  if (args && typeof args.markdown === "string" && args.markdown.trim()) {
    const parsed = markdownToDocxArgs(args.markdown, args.title);
    args = { path: args.path, filename: args.filename, overwrite: args.overwrite, subtitle: args.subtitle, ...parsed };
  }
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
      const ok = Boolean(workbook.ok) && Boolean(workbook.sheets?.length) && rows > 0;
      return { ...base, ok, details: { sheets: workbook.sheets?.length || 0, rows, workbook }, reason: ok ? "" : (!workbook.ok ? (workbook.error || "表格无法回读") : "表格为空或无可回读数据") };
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
  if (name === "check_table") return checkTable(args, toolConsent);
  if (name === "chart_from_table") return chartFromTable(args, toolConsent);
  if (name === "pivot_table") return pivotTable(args, toolConsent);
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
  if (name === "update_plan") {
    const rawSteps = Array.isArray(args.steps) ? args.steps : [];
    const steps = rawSteps
      .map((step) => ({
        title: safeTrimmedString(step?.title),
        status: ["pending", "in_progress", "done"].includes(step?.status) ? step.status : "pending"
      }))
      .filter((step) => step.title)
      .slice(0, 20);
    if (!steps.length) return missingRequiredToolArgs("update_plan", ["steps"]);
    return { ok: true, steps, message: "计划已更新并展示给用户，请继续执行下一步" };
  }
  if (name === "edit_file") return editTextFile(args);
  if (name === "export_image") return exportImage(args, toolConsent);
  if (name === "create_excel_file") return createExcelWorkbook(args);
  if (name === "create_word_file") return createWordDocument(args);
  if (name === "create_ppt_file") return createPptPresentation(args);
  if (name === "create_pdf_file") return createPdfFile(args);
  if (name === "get_template") return getTemplate(args);
  if (name === "read_image_file") return readImageFile(args, toolConsent);
  if (name === "clean_table_file") return cleanTableFile({ ...args, toolConsent });
  if (name === "clean_table_files") return cleanTableFiles(args, toolConsent);
  if (name === "verify_office_file") return verifyOfficeFile(args, toolConsent);
  if (name === "search_workspace") return searchWorkspace(args, toolConsent);
  if (name === "search_files") {
    const query = String(args.query || "");
    if (!query.trim()) return { ok: false, error: "缺少搜索内容" };
    return execFileResult("rg", ripgrepSearchArgs(query, args.glob), { timeout: 15000 });
  }
  if (name === "search_web") return searchWeb(args);
  if (name === "read_web_page") return readWebPage(args);
  if (name === "read_web_pages") return readWebPages(args);
  if (name === "save_research_report") return saveResearchReport(args);
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
  if (name === "run_automation_script") return runAutomationScript(args);
  if (name === "screen_capture") return screenCapture(args);
  return { ok: false, error: `未知工具：${name}` };
}
