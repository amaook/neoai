// tests/data-quality.test.mjs — check_table 数据质量体检（1.7 数据表格智能）

import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { handleToolCall, isToolAllowedByConsent } from "../server/tools.mjs";

let originalCtx;
let workspaceRoot;

beforeEach(async () => {
  originalCtx = { ...ctx };
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-dq-"));
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

const col = (report, name) => report.columns.find((c) => c.name === name);

describe("check_table 数据质量体检", () => {
  it("需要 fileRead 权限", () => {
    expect(isToolAllowedByConsent("check_table", { fileRead: true })).toBe(true);
    expect(isToolAllowedByConsent("check_table", { fileRead: false })).toBe(false);
  });

  it("缺少 path 报缺参", async () => {
    const r = await handleToolCall("check_table", {}, { fileRead: true });
    expect(r.ok).toBe(false);
  });

  it("逐列统计缺失率", async () => {
    await writeCsv("a.csv", "姓名,年龄\n张三,20\n李四,\n王五,30\n,40\n");
    const r = await handleToolCall("check_table", { path: "a.csv" }, { fileRead: true });
    expect(r.ok).toBe(true);
    expect(r.rowCount).toBe(4);
    expect(col(r, "年龄").missingRate).toBe(25); // 4 行里 1 个空
    expect(col(r, "姓名").missingRate).toBe(25);
    expect(r.findings.some((f) => f.includes("年龄") && f.includes("缺失"))).toBe(true);
  });

  it("识别主类型并报类型不一致", async () => {
    await writeCsv("b.csv", "金额\n100\n200\n300\nabc\n");
    const r = await handleToolCall("check_table", { path: "b.csv" }, { fileRead: true });
    const amount = col(r, "金额");
    expect(amount.dominantType).toBe("number");
    expect(amount.typeConsistency).toBe(75); // 4 个里 3 个是数值
    expect(r.findings.some((f) => f.includes("金额") && f.includes("类型不一致"))).toBe(true);
  });

  it("用 IQR 找出数值异常值", async () => {
    const rows = ["分数", ...Array.from({ length: 20 }, () => "50"), "9999"].join("\n");
    await writeCsv("c.csv", rows + "\n");
    const r = await handleToolCall("check_table", { path: "c.csv" }, { fileRead: true });
    const score = col(r, "分数");
    expect(score.numeric.outlierCount).toBeGreaterThan(0);
    expect(score.numeric.outlierSample).toContain(9999);
  });

  it("发现完全重复行", async () => {
    await writeCsv("d.csv", "a,b\n1,2\n1,2\n3,4\n");
    const r = await handleToolCall("check_table", { path: "d.csv" }, { fileRead: true });
    expect(r.table.duplicateRows).toBe(1);
    expect(r.findings.some((f) => f.includes("重复"))).toBe(true);
  });

  it("识别日期列多种格式", async () => {
    await writeCsv("e.csv", "日期\n2024-01-01\n2024/02/02\n2024年3月3日\n");
    const r = await handleToolCall("check_table", { path: "e.csv" }, { fileRead: true });
    const dateCol = col(r, "日期");
    expect(dateCol.dominantType).toBe("date");
    expect(dateCol.dateFormats.length).toBeGreaterThan(1);
    expect(r.findings.some((f) => f.includes("日期格式"))).toBe(true);
  });

  it("解析带千分位/货币符/百分号的数字并识别首尾空格", async () => {
    await writeCsv("f.csv", "营收,占比\n\"1,200\",10%\n\"¥3,400\",25%\n\" 5600 \",65%\n");
    const r = await handleToolCall("check_table", { path: "f.csv" }, { fileRead: true });
    expect(col(r, "营收").dominantType).toBe("number");
    expect(col(r, "营收").numeric.max).toBe(5600);
    expect(col(r, "占比").dominantType).toBe("number");
    expect(col(r, "营收").whitespaceIssues).toBeGreaterThan(0);
  });

  it("返回可保存的 Markdown 报告", async () => {
    await writeCsv("g.csv", "姓名,年龄\n张三,20\n");
    const r = await handleToolCall("check_table", { path: "g.csv" }, { fileRead: true });
    expect(r.markdown).toContain("# 数据质量报告");
    expect(r.markdown).toContain("逐列概览");
    expect(r.markdown).toContain("姓名");
  });

  it("能体检真实 xlsx（用 create_excel_file 造）", async () => {
    await handleToolCall("create_excel_file", {
      path: "h.xlsx",
      sheet_name: "数据",
      columns: ["城市", "销量"],
      rows: [["北京", 100], ["上海", 200], ["广州", ""]]
    }, { fileWrite: true, fileRead: true });
    const r = await handleToolCall("check_table", { path: "h.xlsx" }, { fileRead: true });
    expect(r.ok).toBe(true);
    expect(r.columnCount).toBe(2);
    expect(col(r, "销量").dominantType).toBe("number");
  });
});
