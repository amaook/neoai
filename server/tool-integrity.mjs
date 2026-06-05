// server/tool-integrity.mjs — receipts, artifact verification, and completion guards
import { stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { resolveWorkspacePath, verifyOfficeFilePath } from "./tools.mjs";

const fileProducingTools = new Set([
  "write_file",
  "export_image",
  "create_excel_file",
  "create_word_file",
  "create_ppt_file",
  "clean_table_file",
  "clean_table_files",
  "download_url",
  "read_web_page"
]);

const negativeClaimRe = /(没有|未|未能|未检测|未执行|无法|不能|失败|拦截|没有真实|没有被执行|并没有)/;
const fileCompletionRe = /(已|已经|成功|完成|我已|我已经).{0,12}(创建|保存|导出|写入|生成|另存).{0,40}(文件|文档|Word|Excel|PPT|PDF|表格|图片|PNG|JPG|JPEG|DOCX|PPTX|XLSX|CSV|TSV|MD|TXT|路径|到\s*[^，。,\n]+)|(?:创建|保存|导出|写入|生成|另存).{0,16}(好了|完成|成功)/i;
const commandCompletionRe = /(已|已经|成功|完成|我已|我已经).{0,12}(运行|执行|安装|检测|检查).{0,24}(命令|脚本|依赖|环境|测试|构建|安装)?/i;

function isoNow() {
  return new Date().toISOString();
}

function durationMs(startedAt, endedAt) {
  return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function resultPathsForTool(name, result = {}) {
  if (!result || typeof result !== "object") return [];
  const paths = [];
  if (typeof result.path === "string") paths.push(result.path);
  if (Array.isArray(result.paths)) paths.push(...result.paths);
  if (Array.isArray(result.results)) {
    for (const item of result.results) {
      if (item?.ok && typeof item.path === "string") paths.push(item.path);
      if (Array.isArray(item?.paths)) paths.push(...item.paths);
    }
  }
  if (name === "read_web_page" && !result.path) return [];
  return uniqueStrings(paths);
}

async function verifyArtifactPath(relPath) {
  try {
    const target = resolveWorkspacePath(relPath);
    const stats = await stat(target);
    const office = await verifyOfficeFilePath(relPath);
    if (office.supported) {
      return {
        path: relPath,
        exists: office.exists,
        size: office.size,
        ok: office.ok,
        reason: office.reason || "",
        office
      };
    }
    return {
      path: relPath,
      exists: true,
      size: stats.size,
      ok: stats.isFile() && stats.size > 0,
      reason: stats.isFile() && stats.size > 0 ? "" : "文件为空或不是普通文件"
    };
  } catch (error) {
    return {
      path: relPath,
      exists: false,
      size: 0,
      ok: false,
      reason: error.message || "文件不存在"
    };
  }
}

export async function verifyToolResult(name, result = {}) {
  const paths = result?.ok && fileProducingTools.has(name) ? resultPathsForTool(name, result) : [];
  if (!paths.length) return { required: false, ok: true, artifacts: [] };
  const artifacts = [];
  for (const relPath of paths) artifacts.push(await verifyArtifactPath(relPath));
  return {
    required: true,
    ok: artifacts.length > 0 && artifacts.every((item) => item.ok),
    artifacts
  };
}

function mergeVerificationIntoResult(result, verification) {
  if (!verification?.required) return result;
  if (verification.ok) return { ...result, verified: true, verification };
  const reason = verification.artifacts.map((item) => `${item.path}: ${item.reason || "验证失败"}`).join("；");
  return {
    ...result,
    ok: false,
    verified: false,
    verification,
    error: `文件验证失败：${reason || "没有检测到有效输出文件"}`
  };
}

export async function stepFromToolResult({ name, args, result, startedAt = isoNow() }) {
  const verification = await verifyToolResult(name, result);
  const finalResult = mergeVerificationIntoResult(result, verification);
  const endedAt = isoNow();
  const receipt = {
    id: randomUUID(),
    tool: name || "未知工具",
    status: finalResult?.ok ? "succeeded" : "failed",
    ok: Boolean(finalResult?.ok),
    startedAt,
    endedAt,
    durationMs: durationMs(startedAt, endedAt),
    verified: verification.required ? verification.ok : undefined,
    verification: verification.required ? verification : undefined,
    error: finalResult?.ok ? "" : String(finalResult?.error || "工具执行失败")
  };
  return {
    name,
    args,
    result: finalResult,
    receipt,
    startedAt,
    endedAt,
    durationMs: receipt.durationMs,
    verification: verification.required ? verification : undefined
  };
}

export async function runToolWithReceipt({ name, args, toolConsent, availableToolNames, runner }) {
  const startedAt = isoNow();
  let result;
  try {
    if (availableToolNames && !availableToolNames.has(name)) {
      result = { ok: false, error: `工具未启用：${name || "未知工具"}` };
    } else {
      result = await runner(name, args, toolConsent);
    }
  } catch (error) {
    result = { ok: false, error: error.message };
  }
  return stepFromToolResult({ name, args, result, startedAt });
}

export function isToolArgumentFailureStep(step = {}) {
  return Boolean(step?.result && !step.result.ok && step.result.toolArgError);
}

export function repeatedToolArgumentFailure(steps = [], threshold = 2) {
  const last = steps[steps.length - 1];
  if (!isToolArgumentFailureStep(last)) return null;
  const toolName = last.name || "未知工具";
  let count = 0;
  const missing = new Set();
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step?.name !== toolName || !isToolArgumentFailureStep(step)) break;
    count += 1;
    for (const arg of step.result.missingArgs || []) missing.add(arg);
  }
  if (count < threshold) return null;
  return {
    toolName,
    count,
    missingArgs: [...missing],
    lastError: last.result.error || "模型没有传入必要工具参数"
  };
}

export function toolArgumentFuseContent(fuse) {
  const missing = fuse?.missingArgs?.length ? `缺少参数：${fuse.missingArgs.join("、")}。` : "";
  return [
    `模型连续 ${fuse?.count || 2} 次调用 ${fuse?.toolName || "工具"} 时没有传入必要工具参数，neo 已停止本轮工具循环。`,
    missing || fuse?.lastError || "",
    "这次任务未完成，避免继续消耗工具轮次。请重新发送任务，或换用更稳定的模型后继续。"
  ].filter(Boolean).join("\n");
}

function hasSuccessfulReceipt(steps = []) {
  return steps.some((step) => step?.receipt?.ok === true || step?.result?.ok === true);
}

export function verifiedArtifactsFromSteps(steps = []) {
  const artifacts = [];
  for (const step of steps || []) {
    const verification = step?.verification || step?.receipt?.verification || step?.result?.verification;
    if (Array.isArray(verification?.artifacts)) artifacts.push(...verification.artifacts);
  }
  return artifacts;
}

function hasVerifiedFileArtifact(steps = []) {
  return verifiedArtifactsFromSteps(steps).some((item) => item?.ok && item.exists && Number(item.size || 0) > 0);
}

export function detectUnverifiedCompletionClaim(content = "") {
  const text = String(content || "");
  if (!text.trim() || negativeClaimRe.test(text)) return null;
  if (fileCompletionRe.test(text)) return { kind: "file", label: "文件保存/导出/创建" };
  if (commandCompletionRe.test(text)) return { kind: "command", label: "命令执行" };
  return null;
}

export function unverifiedCompletionBlockedContent(claim) {
  const label = claim?.label || "任务完成";
  return [
    `neo 没有检测到本轮真实${label}回执。`,
    "为了避免模型假装完成，neo 已拦截这次完成声明。",
    "",
    "请重试一次，或开启对应本地工具权限；只有工具返回成功并通过验证后，neo 才会显示已完成。"
  ].join("\n");
}

export function blockUnverifiedCompletion(content, { steps = [] } = {}) {
  const claim = detectUnverifiedCompletionClaim(content);
  if (!claim) return null;
  const hasEvidence = claim.kind === "file" ? hasVerifiedFileArtifact(steps) : hasSuccessfulReceipt(steps);
  if (hasEvidence) return null;
  return {
    content: unverifiedCompletionBlockedContent(claim),
    unverifiedCompletionBlocked: true,
    completionClaim: claim
  };
}
