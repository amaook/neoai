// server/agent-recovery.mjs — failed tool recovery prompts for agent loops

export const RECOVERY_PROMPT_MARKER = "自恢复执行";

function toolName(tool = {}) {
  return tool.function?.name || tool.name || "";
}

function compactJson(value) {
  try {
    const text = JSON.stringify(value ?? {});
    return text.length > 280 ? `${text.slice(0, 277)}...` : text;
  } catch {
    return "{}";
  }
}

function failedSteps(roundSteps = []) {
  return roundSteps.filter((step) => step?.result && step.result.ok === false);
}

export function recoveryPromptForFailedSteps(roundSteps = [], availableTools = []) {
  const failed = failedSteps(roundSteps);
  if (!failed.length) return "";
  const toolNames = availableTools.map(toolName).filter(Boolean);
  const failureText = failed.map((step, index) => {
    const name = step.name || "未知工具";
    const error = step.result?.error || step.result?.message || "工具返回失败";
    return `${index + 1}. ${name} 参数 ${compactJson(step.args)} 失败：${error}`;
  }).join("\n");

  return [
    `[系统提示｜${RECOVERY_PROMPT_MARKER}]`,
    "刚刚有工具步骤失败。请不要直接放弃，也不要假装已经完成。",
    "请先根据失败原因重新规划下一步：",
    "1. 如果有可行替代路径、参数或工具，请继续调用工具尝试。",
    "2. 避免重复同一个失败调用；优先换路径、换搜索方式、先列目录或先读取相关文件。",
    "3. 如果失败原因是权限缺失、用户未授权、工作区边界或安全限制，不能绕过限制；请向用户说明需要什么授权或输入。",
    "",
    "失败步骤：",
    failureText,
    toolNames.length ? `可用工具：${toolNames.join(", ")}` : ""
  ].filter(Boolean).join("\n");
}

export function appendRecoveryUserMessage(loopMessages, roundSteps, availableTools) {
  const prompt = recoveryPromptForFailedSteps(roundSteps, availableTools);
  if (!prompt) return false;
  loopMessages.push({ role: "user", content: prompt });
  return true;
}

export function recoveryInputItemForFailedSteps(roundSteps, availableTools) {
  const prompt = recoveryPromptForFailedSteps(roundSteps, availableTools);
  return prompt ? { role: "user", content: prompt } : null;
}
