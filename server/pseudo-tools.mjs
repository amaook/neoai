// server/pseudo-tools.mjs — detect model-emitted fake tool-call markup

const dsmlTagRe = /<\s*\/?\s*\|\s*\|\s*DSML\s*\|\s*\|\s*(?:tool_calls|invoke|parameter)\b[^>]*>/i;
const xmlToolCallRe = /<\s*tool_calls\s*>[\s\S]*?<\s*invoke\s+name\s*=\s*["'][^"']+["']/i;
const bareInvokeTagRe = /<\s*invoke\b[^>]*\bname\s*=\s*["'][^"']+["'][^>]*>/i;
const invokeNameRe = /\binvoke\s+name\s*=\s*["']([^"']+)["']/gi;

export function detectPseudoToolOutput(content = "") {
  const text = String(content || "");
  if (!text.trim()) return { found: false, names: [] };

  const hasDsml = dsmlTagRe.test(text);
  const hasToolCallShape = /\btool_calls\b/i.test(text) && /\binvoke\s+name\s*=/i.test(text);
  const hasLocalCommandAlias = /\brun_local_command\b/i.test(text);
  const hasXmlToolCall = xmlToolCallRe.test(text);
  const hasBareInvokeTag = bareInvokeTagRe.test(text);

  if (!((hasDsml && (hasToolCallShape || hasLocalCommandAlias)) || hasXmlToolCall || hasBareInvokeTag)) {
    return { found: false, names: [] };
  }

  const names = new Set();
  for (const match of text.matchAll(invokeNameRe)) {
    if (match[1]) names.add(match[1]);
  }
  if (hasLocalCommandAlias) names.add("run_local_command");
  return { found: true, names: [...names] };
}

export function pseudoToolBlockedContent({ enableTools = false, names = [] } = {}) {
  const nameText = names.length ? `（${names.join("、")}）` : "";
  const reason = enableTools
    ? "这次模型没有通过标准工具协议返回 tool_calls，neo 没有拿到可执行的工具事件。"
    : "当前本地工具没有开启，模型只能输出文字，不能真的操作文件或运行命令。";

  return [
    `neo 拦截到模型把工具调用${nameText}当成普通文字输出。`,
    "这段内容没有被执行，所以本次没有创建文件、保存文档或运行命令。",
    "",
    reason,
    "请重试一次；如果仍发生，换用支持标准工具调用的模型，或开启对应本地工具权限后再试。"
  ].join("\n");
}

export function blockPseudoToolOutput(content, options = {}) {
  const detection = detectPseudoToolOutput(content);
  if (!detection.found) return null;
  return {
    content: pseudoToolBlockedContent({ ...options, names: detection.names }),
    pseudoToolBlocked: true,
    pseudoToolNames: detection.names
  };
}
