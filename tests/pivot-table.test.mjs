// tests/pivot-table.test.mjs — pivot_table 透视/分组汇总（1.7 数据表格智能）

import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { handleToolCall, isToolAllowedByConsent, readExcelWorkbook } from "../server/tools.mjs";

let originalCtx;
let workspaceRoot;

beforeEach(async () => {
  originalCtx = { ...ctx };
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-pivot-"));
  Object.assign(ctx, { ...originalCtx, workspaceRoot, appStatePath: "", desktopMode: false });
});
afterEach(async () => {
  Object.assign(ctx, originalCtx);
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

async function writeCsv(rel, content) {
  const target = path.join(workspaceRoot, rel);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}
const readWs = (rel) => readFile(path.join(workspaceRoot, rel), "utf8");

const SALES = "部门,月份,金额\n销售,1月,100\n销售,2月,200\n市场,1月,50\n市场,2月,80\n销售,1月,30\n";

describe("pivot_table 透视/分组汇总", () => {
  it("需要 fileWrite 权限", () => {
    expect(isToolAllowedByConsent("pivot_table", { fileWrite: true })).toBe(true);
    expect(isToolAllowedByConsent("pivot_table", { fileWrite: false })).toBe(false);
  });

  it("缺少 path 报缺参", async () => {
    const r = await handleToolCall("pivot_table", {}, { fileWrite: true });
    expect(r.ok).toBe(false);
  });

  it("非法 agg 报错", async () => {
    await writeCsv("s.csv", SALES);
    const r = await handleToolCall("pivot_table", { path: "s.csv", agg: "median" }, { fileWrite: true });
    expect(r.ok).toBe(false);
  });

  it("按部门求和金额（输出 csv）", async () => {
    await writeCsv("s.csv", SALES);
    const r = await handleToolCall("pivot_table", { path: "s.csv", group_by: "部门", values: "金额", agg: "sum", output_path: "out/by-dept.csv" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.format).toBe("csv");
    expect(r.header).toEqual(["部门", "求和(金额)"]);
    // 销售 100+200+30=330，市场 50+80=130；默认按度量降序
    const sales = r.preview.find((row) => row[0] === "销售");
    const market = r.preview.find((row) => row[0] === "市场");
    expect(sales[1]).toBe(330);
    expect(market[1]).toBe(130);
    expect(r.preview[0][0]).toBe("销售"); // 降序，销售在前
    const csv = await readWs(r.path);
    expect(csv).toContain("求和(金额)");
  });

  it("count 计数（不需要数值列）", async () => {
    await writeCsv("s.csv", SALES);
    const r = await handleToolCall("pivot_table", { path: "s.csv", group_by: "部门", agg: "count", output_path: "out/cnt.csv" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.header).toEqual(["部门", "计数"]);
    expect(r.preview.find((row) => row[0] === "销售")[1]).toBe(3);
    expect(r.preview.find((row) => row[0] === "市场")[1]).toBe(2);
  });

  it("交叉透视：部门 × 月份 求和金额", async () => {
    await writeCsv("s.csv", SALES);
    const r = await handleToolCall("pivot_table", { path: "s.csv", group_by: "部门", pivot_column: "月份", values: "金额", agg: "sum", output_path: "out/cross.csv" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("crosstab");
    expect(r.header).toEqual(["部门", "1月", "2月"]);
    const sales = r.preview.find((row) => row[0] === "销售");
    // 销售 1月 100+30=130，2月 200
    expect(sales[1]).toBe(130);
    expect(sales[2]).toBe(200);
  });

  it("平均值聚合", async () => {
    await writeCsv("s.csv", SALES);
    const r = await handleToolCall("pivot_table", { path: "s.csv", group_by: "部门", values: "金额", agg: "avg", output_path: "out/avg.csv" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    // 市场 (50+80)/2 = 65
    expect(r.preview.find((row) => row[0] === "市场")[1]).toBe(65);
  });

  it("不指定 group_by 出总计", async () => {
    await writeCsv("s.csv", SALES);
    const r = await handleToolCall("pivot_table", { path: "s.csv", values: "金额", agg: "sum", output_path: "out/total.csv" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.header).toEqual(["汇总", "求和(金额)"]);
    expect(r.preview[0]).toEqual(["总计", 460]); // 100+200+50+80+30
  });

  it("默认输出 xlsx 到 pivots/ 且可回读", async () => {
    await writeCsv("s.csv", SALES);
    const r = await handleToolCall("pivot_table", { path: "s.csv", group_by: "部门", values: "金额" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.path).toContain("pivots/");
    expect(r.path.endsWith(".xlsx")).toBe(true);
    const wb = await readExcelWorkbook({ path: r.path }, { fileRead: true });
    expect(wb.ok).toBe(true);
    expect(wb.sheets[0].rowCount).toBeGreaterThanOrEqual(3); // 表头 + 两个部门
  });

  it("能透视真实 xlsx", async () => {
    await handleToolCall("create_excel_file", {
      path: "src.xlsx",
      sheet_name: "订单",
      columns: ["地区", "金额"],
      rows: [["华东", 100], ["华北", 200], ["华东", 150]]
    }, { fileWrite: true, fileRead: true });
    const r = await handleToolCall("pivot_table", { path: "src.xlsx", group_by: "地区", values: "金额", agg: "sum", output_path: "out/x.csv" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.preview.find((row) => row[0] === "华东")[1]).toBe(250);
  });
});
