import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { request as httpRequest } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { createNeoServer } from "../server/routes.mjs";
import { createExcelWorkbook, handleToolCall, readExcelWorkbook } from "../server/tools.mjs";

let originalCtx;
let workspaceRoot;
let server;

beforeEach(async () => {
  originalCtx = { ...ctx };
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-office-runtime-"));
  Object.assign(ctx, {
    ...originalCtx,
    workspaceRoot,
    appStatePath: "",
    desktopMode: false
  });
});

afterEach(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server = null;
  }
  Object.assign(ctx, originalCtx);
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

describe("office runtime", () => {
  it("reads CSV and TSV with headers and quality checks through the table reader", async () => {
    await writeText("samples/dirty.csv", " 日期 ,金额,备注\n2026/06/01,\"￥1,200.50\", A \n2026/06/01,\"￥1,200.50\", A \n,,\n");
    await writeText("samples/items.tsv", "名称\t数量\n苹果\t2\n梨\t3\n");

    const csv = await readExcelWorkbook({ path: "samples/dirty.csv", row_limit: 10 });
    const tsv = await readExcelWorkbook({ path: "samples/items.tsv", row_limit: 10 });

    expect(csv).toMatchObject({ ok: true, fileType: "csv" });
    expect(csv.sheets[0].headers).toEqual(["日期", "金额", "备注"]);
    expect(csv.sheets[0].quality).toMatchObject({ emptyRows: 1, duplicateRows: 1 });
    expect(csv.sheets[0].suggestedNormalization.amountColumns).toContain("金额");
    expect(tsv).toMatchObject({ ok: true, fileType: "tsv" });
    expect(tsv.sheets[0].rowCount).toBe(3);
  });

  it("creates and verifies a real Excel workbook with an office task", async () => {
    const result = await createExcelWorkbook({
      path: "outputs/report.xlsx",
      sheet_name: "明细",
      columns: ["日期", "金额"],
      rows: [{ 日期: "2026-06-01", 金额: 100 }]
    });

    expect(result).toMatchObject({ ok: true, verified: true, path: "outputs/report.xlsx" });
    expect(result.officeTask.steps.find((step) => step.name === "校验文件")).toMatchObject({ status: "complete" });
    expect((await stat(path.join(workspaceRoot, result.path))).size).toBeGreaterThan(1000);
  });

  it("creates and verifies a real Word docx", async () => {
    const result = await handleToolCall("create_word_file", {
      path: "outputs/summary.docx",
      title: "6月经营摘要",
      paragraphs: ["收入稳定增长，费用需要继续复核。"],
      sections: [{ title: "待办", bullets: ["复核平台手续费", "补充明细表"] }]
    }, { fileWrite: true, fileRead: true });

    expect(result).toMatchObject({ ok: true, verified: true, path: "outputs/summary.docx" });
    expect(result.verification.details.text).toContain("6月经营摘要");
    expect(result.verification.details.paragraphCount).toBeGreaterThan(0);
  });

  it("creates and verifies a real PPTX deck", async () => {
    const result = await handleToolCall("create_ppt_file", {
      path: "outputs/deck.pptx",
      title: "月度复盘",
      subtitle: "0.9.5 办公内核",
      sections: [
        { title: "收入", bullets: ["平台收入增长", "异常店铺需复核"] },
        { title: "行动", bullets: ["清洗表格", "导出报告"] }
      ]
    }, { fileWrite: true, fileRead: true });

    expect(result).toMatchObject({ ok: true, verified: true, path: "outputs/deck.pptx" });
    expect(result.verification.details.slideCount).toBeGreaterThanOrEqual(4);
    expect(result.verification.details.text).toContain("月度复盘");
  });

  it("inspects supported office files and rejects legacy formats clearly", async () => {
    await writeText("legacy.xls", "not a modern workbook");
    const oldExcel = await handleToolCall("inspect_office_file", { path: "legacy.xls" }, { fileRead: true });
    expect(oldExcel).toMatchObject({ ok: false, supported: false });
    expect(oldExcel.error).toContain("另存为 .xlsx");
  });

  it("returns import metadata and office task for uploaded CSV attachments", async () => {
    server = createNeoServer();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });

    const dataUrl = `data:text/csv;base64,${Buffer.from("日期,金额\n2026-06-01,100\n").toString("base64")}`;
    const response = await postJson("/api/attachments/import", {
      name: "sample.csv",
      kind: "sheet",
      size: 0,
      mediaType: "text/csv",
      dataUrl
    });

    expect(response.status).toBe(200);
    expect(response.body.attachment.officeImport).toMatchObject({
      originalFileName: "sample.csv",
      fileType: "csv",
      parseStatus: "parsed",
      supported: true
    });
    expect(response.body.attachment.officeTask.steps.map((step) => step.name)).toContain("校验文件");
  });
});

async function writeText(relPath, content) {
  const target = path.join(workspaceRoot, relPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

function serverPort() {
  const address = server.address();
  if (!address || typeof address !== "object") throw new Error("test server is not listening");
  return address.port;
}

function postJson(pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = httpRequest({
      hostname: "127.0.0.1",
      port: serverPort(),
      path: pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, body: text ? JSON.parse(text) : {} });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });
}
