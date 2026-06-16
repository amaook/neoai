// tests/chart-from-table.test.mjs — chart_from_table 表格出图（1.7 数据表格智能）

import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ctx } from "../server/context.mjs";
import { handleToolCall, isToolAllowedByConsent } from "../server/tools.mjs";

let originalCtx;
let workspaceRoot;

beforeEach(async () => {
  originalCtx = { ...ctx };
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-chart-"));
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

describe("chart_from_table 表格出图", () => {
  it("需要 fileWrite 权限", () => {
    expect(isToolAllowedByConsent("chart_from_table", { fileWrite: true })).toBe(true);
    expect(isToolAllowedByConsent("chart_from_table", { fileWrite: false })).toBe(false);
  });

  it("缺少 path 报缺参", async () => {
    const r = await handleToolCall("chart_from_table", {}, { fileWrite: true });
    expect(r.ok).toBe(false);
  });

  it("非法 type 报错", async () => {
    await writeCsv("a.csv", "月份,销量\n1月,10\n");
    const r = await handleToolCall("chart_from_table", { path: "a.csv", type: "radar" }, { fileWrite: true });
    expect(r.ok).toBe(false);
  });

  it("出柱状图 SVG 并写盘，含坐标和数据", async () => {
    await writeCsv("sales.csv", "月份,销量\n1月,120\n2月,200\n3月,90\n");
    const r = await handleToolCall("chart_from_table", { path: "sales.csv", type: "bar", title: "月度销量", output_path: "out/bar.svg" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.type).toBe("bar");
    expect(r.points).toBe(3);
    expect(r.path).toContain("bar.svg");
    const svg = await readWs(r.path);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<rect"); // 柱子
    expect(svg).toContain("月度销量"); // 标题
  });

  it("多数值列出折线图，每个系列一条 polyline", async () => {
    await writeCsv("trend.csv", "月份,收入,支出\n1月,100,60\n2月,150,80\n3月,130,70\n");
    const r = await handleToolCall("chart_from_table", { path: "trend.csv", type: "line", value_columns: "收入,支出", output_path: "out/line.svg" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.series).toEqual(["收入", "支出"]);
    const svg = await readWs(r.path);
    expect((svg.match(/<polyline/g) || []).length).toBe(2);
  });

  it("出饼图，按占比生成扇形/整圆", async () => {
    await writeCsv("share.csv", "渠道,占比\n直营,40\n分销,35\n线上,25\n");
    const r = await handleToolCall("chart_from_table", { path: "share.csv", type: "pie", output_path: "out/pie.svg" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    const svg = await readWs(r.path);
    expect(svg).toContain("<path"); // 扇形
    expect(svg).toContain("%"); // 图例百分比
  });

  it("自动识别数值列（不指定 value_columns）", async () => {
    await writeCsv("auto.csv", "城市,人口,备注\n北京,2189,首都\n上海,2487,直辖市\n");
    const r = await handleToolCall("chart_from_table", { path: "auto.csv", output_path: "out/auto.svg" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.series).toContain("人口");
    expect(r.series).not.toContain("城市");
    expect(r.series).not.toContain("备注");
  });

  it("找不到数值列时报错", async () => {
    await writeCsv("text.csv", "名称,描述\n甲,很好\n乙,一般\n");
    const r = await handleToolCall("chart_from_table", { path: "text.csv", output_path: "out/x.svg" }, { fileWrite: true });
    expect(r.ok).toBe(false);
  });

  it("默认输出到 charts/ 且后缀 svg（带文字、可缩放）", async () => {
    await writeCsv("d.csv", "月份,销量\n1月,10\n2月,20\n");
    const r = await handleToolCall("chart_from_table", { path: "d.csv", type: "bar" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.path).toContain("charts/");
    expect(r.path.endsWith(".svg")).toBe(true);
    expect(existsSync(path.join(workspaceRoot, r.path))).toBe(true);
    expect((await stat(path.join(workspaceRoot, r.path))).size).toBeGreaterThan(0);
  });

  it("显式 .png 走 canvas 栅格化也能出文件", async () => {
    await writeCsv("p.csv", "月份,销量\n1月,10\n2月,20\n");
    const r = await handleToolCall("chart_from_table", { path: "p.csv", type: "bar", output_path: "out/p.png" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.path.endsWith(".png")).toBe(true);
    expect((await stat(path.join(workspaceRoot, r.path))).size).toBeGreaterThan(0);
  });

  it("能给真实 xlsx 出图", async () => {
    await handleToolCall("create_excel_file", {
      path: "q.xlsx",
      sheet_name: "季度",
      columns: ["季度", "营收"],
      rows: [["Q1", 300], ["Q2", 420], ["Q3", 380], ["Q4", 510]]
    }, { fileWrite: true, fileRead: true });
    const r = await handleToolCall("chart_from_table", { path: "q.xlsx", type: "bar", output_path: "out/q.svg" }, { fileWrite: true });
    expect(r.ok).toBe(true);
    expect(r.points).toBe(4);
  });
});
