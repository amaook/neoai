import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ctx } from "../server/context.mjs";
import { createExcelWorkbook, handleToolCall } from "../server/tools.mjs";

const keepWorkspace = process.argv.includes("--keep");
const workspace = process.env.NEO_OFFICE_SMOKE_WORKSPACE
  ? path.resolve(process.env.NEO_OFFICE_SMOKE_WORKSPACE)
  : await mkdtemp(path.join(tmpdir(), "neo-office-smoke-"));

ctx.workspaceRoot = workspace;
await mkdir(workspace, { recursive: true });

const results = [];

async function main() {
  await makeTableSamples();
  await makeWordSamples();
  await makePdfSamples();
  await makePptSamples();
  await makeAnomalySamples();

  await inspectSamples([
    "samples/tables/clean.csv",
    "samples/tables/dirty.csv",
    "samples/tables/items.tsv",
    "samples/tables/report.xlsx",
    "samples/tables/macro.xlsm",
    "samples/word/summary.docx",
    "samples/word/todo.docx",
    "samples/word/table-hints.docx",
    "samples/pdf/one.pdf",
    "samples/pdf/two.pdf",
    "samples/pdf/three.pdf",
    "samples/ppt/cover.pptx",
    "samples/ppt/report.pptx",
    "samples/ppt/actions.pptx"
  ]);

  await expectOk("clean dirty csv", handleToolCall("clean_table_file", {
    path: "samples/tables/dirty.csv",
    output_path: "outputs/dirty-cleaned.xlsx"
  }, { fileRead: true, fileWrite: true }));

  await expectFail("legacy xls rejected", handleToolCall("inspect_office_file", { path: "samples/anomalies/old.xls" }, { fileRead: true }), "另存为 .xlsx");
  await expectFail("legacy ppt rejected", handleToolCall("inspect_office_file", { path: "samples/anomalies/old.ppt" }, { fileRead: true }), "另存为 .pptx");

  const failed = results.filter((item) => !item.ok);
  const summary = { ok: failed.length === 0, workspace, total: results.length, failed: failed.length, results };
  console.log(JSON.stringify(summary, null, 2));
  if (!keepWorkspace && !process.env.NEO_OFFICE_SMOKE_WORKSPACE) await rm(workspace, { recursive: true, force: true });
  if (failed.length) process.exit(1);
}

async function makeTableSamples() {
  await writeText("samples/tables/clean.csv", "日期,金额,备注\n2026-06-01,100,正常\n2026-06-02,200,正常\n");
  await writeText("samples/tables/dirty.csv", " 日期 ,金额,备注\n2026/06/01,\"￥1,200.50\", A \n2026/06/01,\"￥1,200.50\", A \n,,\n");
  await writeText("samples/tables/items.tsv", "名称\t数量\t单价\n苹果\t2\t3.5\n梨\t3\t4\n");
  await createExcelWorkbook({
    path: "samples/tables/report.xlsx",
    sheet_name: "明细",
    columns: ["日期", "金额", "备注"],
    rows: [{ 日期: "2026-06-01", 金额: 100, 备注: "样例" }]
  });
  await createExcelWorkbook({
    path: "samples/tables/macro.xlsm",
    sheet_name: "数据",
    columns: ["月份", "利润"],
    rows: [{ 月份: "2026-06", 利润: 88 }]
  });
}

async function makeWordSamples() {
  await expectOk("create word summary", handleToolCall("create_word_file", {
    path: "samples/word/summary.docx",
    title: "经营摘要",
    paragraphs: ["收入稳定，费用需要复核。"]
  }, writeConsent()));
  await expectOk("create word todo", handleToolCall("create_word_file", {
    path: "samples/word/todo.docx",
    title: "待办清单",
    sections: [{ title: "本周待办", bullets: ["复核金额", "导出报告", "确认 PPT"] }]
  }, writeConsent()));
  await expectOk("create word table hints", handleToolCall("create_word_file", {
    path: "samples/word/table-hints.docx",
    title: "表格线索",
    tables: [{ headers: ["字段", "说明"], rows: [["金额", "收入金额"], ["日期", "交易日期"]] }]
  }, writeConsent()));
}

async function makePdfSamples() {
  await writeBinary("samples/pdf/one.pdf", minimalPdf("PDF 样例一"));
  await writeBinary("samples/pdf/two.pdf", minimalPdf("PDF 样例二"));
  await writeBinary("samples/pdf/three.pdf", minimalPdf("PDF 样例三"));
}

async function makePptSamples() {
  await expectOk("create ppt cover", handleToolCall("create_ppt_file", {
    path: "samples/ppt/cover.pptx",
    title: "封面样例",
    subtitle: "neo 0.9.5"
  }, writeConsent()));
  await expectOk("create ppt report", handleToolCall("create_ppt_file", {
    path: "samples/ppt/report.pptx",
    title: "月度报告",
    sections: [{ title: "收入", bullets: ["收入增长", "异常复核"] }, { title: "费用", bullets: ["费用下降"] }]
  }, writeConsent()));
  await expectOk("create ppt actions", handleToolCall("create_ppt_file", {
    path: "samples/ppt/actions.pptx",
    title: "行动计划",
    slides: [{ title: "行动", bullets: ["清洗表格", "生成 Word", "生成 PPT"] }]
  }, writeConsent()));
}

async function makeAnomalySamples() {
  await writeText("samples/anomalies/old.xls", "legacy excel placeholder");
  await writeText("samples/anomalies/old.ppt", "legacy ppt placeholder");
}

async function inspectSamples(paths) {
  for (const filePath of paths) {
    await expectOk(`inspect ${filePath}`, handleToolCall("inspect_office_file", { path: filePath, row_limit: 10 }, { fileRead: true }));
    await expectOk(`verify ${filePath}`, handleToolCall("verify_office_file", { path: filePath }, { fileRead: true }));
  }
}

async function expectOk(name, promise) {
  const result = await promise;
  const ok = Boolean(result?.ok);
  results.push({ name, ok, path: result?.path || "", error: ok ? "" : result?.error || "failed" });
  return result;
}

async function expectFail(name, promise, expectedText = "") {
  const result = await promise;
  const ok = !result?.ok && (!expectedText || String(result?.error || "").includes(expectedText));
  results.push({ name, ok, path: result?.path || "", error: ok ? "" : result?.error || "unexpected success" });
  return result;
}

function writeConsent() {
  return { fileRead: true, fileWrite: true };
}

async function writeText(relPath, content) {
  await writeBinary(relPath, Buffer.from(content, "utf8"));
}

async function writeBinary(relPath, buffer) {
  const target = path.join(workspace, relPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  const info = await stat(target);
  if (!info.size) throw new Error(`样例文件写入失败：${relPath}`);
}

function minimalPdf(text) {
  const safe = String(text).replace(/[()\\]/g, "\\$&");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  ];
  const stream = `BT /F1 18 Tf 72 720 Td (${safe}) Tj ET`;
  objects.push(`5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`);
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(output));
    output += object;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, "utf8");
}

main().catch(async (error) => {
  console.error(error);
  if (!keepWorkspace && !process.env.NEO_OFFICE_SMOKE_WORKSPACE) await rm(workspace, { recursive: true, force: true });
  process.exit(1);
});
