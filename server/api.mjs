// server/api.mjs — 非流式 API 调用（OpenAI / Anthropic / Gemini / Mock）
import { ctx } from "./context.mjs";
import { appendRecoveryUserMessage } from "./agent-recovery.mjs";
import { agentTools, skillToolMap, toolsForSkillIds, handleToolCall, parseArguments, safeJson } from "./tools.mjs";
import { blockPseudoToolOutput } from "./pseudo-tools.mjs";
import {
  blockUnverifiedCompletion,
  maxTokensTruncationContent,
  repeatedToolArgumentFailure,
  runToolWithReceipt,
  toolArgumentFuseContent
} from "./tool-integrity.mjs";

// ── 共用工具 ─────────────────────────────────────────────────────────────────

export function requireKey(provider) {
  if (!provider.apiKey || !String(provider.apiKey).trim()) {
    const error = new Error("请先填写当前供应商的 API Key");
    error.status = 400;
    throw error;
  }
}

export function endpointFromBase(baseUrl, suffix) {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!clean) return "";
  if (clean.endsWith(suffix)) return clean;
  return `${clean}${suffix}`;
}

export async function postJson(url, headers, body, options = {}) {
  const timeoutMs = Number(options.timeoutMs || ctx.defaultApiTimeoutMs);
  const controller = new AbortController();
  let timedOut = false;
  let detachAbort = () => {};
  const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

  if (options.signal) {
    const abortFromParent = () => controller.abort();
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", abortFromParent, { once: true });
      detachAbort = () => options.signal.removeEventListener("abort", abortFromParent);
    }
  }

  let response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      const message = timedOut
        ? `API 请求超过 ${Math.round(timeoutMs / 1000)} 秒未响应，已自动停止。请检查 Base URL、网络、模型名或 API Key。`
        : "请求已停止";
      const abortError = new Error(message);
      abortError.status = timedOut ? 504 : 499;
      throw abortError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    detachAbort();
  }

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || data?.raw || `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ── 内容格式转换 ─────────────────────────────────────────────────────────────

export function toAnthropicContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return JSON.stringify(content);
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text || "" };
    if (part.type === "image_url") {
      const url = part.image_url?.url || "";
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
    }
    if (part.type === "image") return part;
    // tool_use / tool_result 是 Anthropic 原生块，多轮工具调用时需原样保留，不能转成文本
    if (part.type === "tool_use" || part.type === "tool_result") return part;
    return { type: "text", text: JSON.stringify(part) };
  });
}

function dataUrlToGeminiInlineData(url = "") {
  const match = String(url).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

export function toGeminiParts(content) {
  if (typeof content === "string") return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: JSON.stringify(content) }];
  const parts = [];
  for (const part of content) {
    if (typeof part === "string") { if (part.trim()) parts.push({ text: part }); continue; }
    if (part?.type === "text" && part.text) { parts.push({ text: part.text }); continue; }
    if (part?.type === "image_url") { const inline = dataUrlToGeminiInlineData(part.image_url?.url || ""); if (inline) parts.push(inline); continue; }
    if (part?.type === "image" && part.source?.type === "base64") { parts.push({ inlineData: { mimeType: part.source.media_type || "image/png", data: part.source.data || "" } }); }
  }
  return parts.length ? parts : [{ text: messageTextContent({ content }) }];
}

export function messageTextContent(message = {}) {
  const content = message.content;
  if (Array.isArray(content)) return content.map((part) => { if (typeof part === "string") return part; return part?.text || part?.content || ""; }).filter(Boolean).join("\n").trim();
  return String(content || "").trim();
}

export function emptyResponseReason(choice = {}, message = {}) {
  return { finishReason: choice.finish_reason || choice.finishReason || "", hasToolCalls: Array.isArray(message.tool_calls) && message.tool_calls.length > 0, hasReasoningContent: Boolean(message.reasoning_content), contentType: Array.isArray(message.content) ? "array" : typeof message.content, messageKeys: Object.keys(message) };
}

export function normalizeMessages(messages) {
  const allowedRoles = new Set(["system", "user", "assistant", "tool"]);
  return Array.isArray(messages)
    ? messages.filter((m) => m && allowedRoles.has(m.role) && m.content !== undefined).map((m) => ({ role: m.role, content: Array.isArray(m.content) ? m.content : typeof m.content === "string" ? m.content : JSON.stringify(m.content) }))
    : [];
}

function messageCharLength(message = {}) {
  const content = message.content;
  if (typeof content === "string") return content.length;
  try { return JSON.stringify(content ?? "").length; } catch { return 0; }
}

// 服务端最后一道保险：历史字符量超过预算时，保留全部 system 消息 + 最近若干轮，
// 丢弃中间较早的消息，避免超长对话（前端压缩失败或定时/子智能体路径）直接打到上游报错。
export function capMessageHistory(messages, maxChars = ctx.maxHistoryChars) {
  if (!Array.isArray(messages) || !maxChars || maxChars <= 0) return messages;
  const total = messages.reduce((sum, m) => sum + messageCharLength(m), 0);
  if (total <= maxChars) return messages;

  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  let budget = maxChars - system.reduce((sum, m) => sum + messageCharLength(m), 0);

  const kept = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const len = messageCharLength(rest[i]);
    if (kept.length && budget - len < 0) break; // 至少保留最近一条
    budget -= len;
    kept.unshift(rest[i]);
  }

  const dropped = rest.length - kept.length;
  if (dropped <= 0) return messages;
  const notice = { role: "system", content: `[系统提示] 为避免超出模型上下文，已省略较早的 ${dropped} 条历史消息，仅保留最近对话。如需更早内容请重新提供。` };
  return [...system, notice, ...kept];
}

function openAICompatibleSupportsImageInput(provider = {}, model = "") {
  const normalizedModel = String(model || "").trim().toLowerCase();
  const providerText = [provider.id, provider.name, provider.baseUrl, model].filter(Boolean).join(" ").toLowerCase();
  if (provider.supportsImages === true || provider.vision === true) return true;
  if (provider.supportsImages === false || provider.vision === false) return false;
  if (providerText.includes("deepseek")) return false;
  if (providerText.includes("api.openai.com")) return /gpt-4o|gpt-4\.1|gpt-5|o3|o4/.test(String(model).toLowerCase());
  if (providerText.includes("dashscope") || providerText.includes("qwen") || providerText.includes("百炼")) {
    if (/^qwen3-coder|^qwen-coder|coder/.test(normalizedModel)) return false;
    if (/^qwen3-vl-(plus|flash)(-|$)/.test(normalizedModel)) return true;
    if (/^qwen-vl|^qvq|omni/.test(normalizedModel)) return true;
  }
  if (providerText.includes("moonshot") || providerText.includes("kimi")) {
    if (/^moonshot-v1-(8k|32k|128k)-vision-preview$/.test(normalizedModel)) return true;
  }
  if (providerText.includes("api.x.ai") || providerText.includes("xai") || providerText.includes("grok")) {
    return /vision|image|vl|omni/.test(normalizedModel);
  }
  if (providerText.includes("mistral")) {
    return /vision|pixtral|vl|omni/.test(normalizedModel);
  }
  return /vision|vl|omni|multimodal|llava|pixtral/.test(providerText);
}

export function providerSupportsImageInput(provider = {}, model = "") {
  const protocol = provider?.protocol || "openai";
  if (protocol === "anthropic" || protocol === "gemini") return true;
  if (protocol === "openai") return openAICompatibleSupportsImageInput(provider, model);
  return false;
}

// ── 屏幕截图注入（看屏幕）─────────────────────────────────────────────────────
// screen_capture 的结果里带 dataUrl（大），不能作为文本进历史，需单独转成图片内容块喂给视觉模型。

const IMAGE_INJECT_TOOLS = new Set(["screen_capture", "read_image_file"]);
export function extractScreenshotFromResult(name, result) {
  if (IMAGE_INJECT_TOOLS.has(name) && result && result.ok && typeof result.dataUrl === "string") {
    const { dataUrl, ...rest } = result;
    return { resultForModel: { ...rest, imageInjected: true }, screenshotDataUrl: dataUrl, screenshotPath: result.path || "" };
  }
  return { resultForModel: result, screenshotDataUrl: null, screenshotPath: "" };
}

// 移除历史里已注入的旧截图，避免每轮重复发送大图
export function dropInjectedScreenshots(loopMessages = []) {
  for (let i = loopMessages.length - 1; i >= 0; i -= 1) {
    if (loopMessages[i] && loopMessages[i]._screenshot) loopMessages.splice(i, 1);
  }
}

const SCREENSHOT_HINT = "[图片内容（屏幕截图或本地图片），供你查看以读取其中文字、定位元素或理解内容；这是只读画面，不要声称已经点击或操作了软件]";

function screenshotUnavailableText(path) {
  return `（屏幕截图已保存到 ${path || "工作区 Screenshots"}，但当前模型不支持识别图片，请切换到支持图片输入的模型后再看屏幕。）`;
}

// OpenAI 兼容 / Gemini：作为独立 user 消息（image_url 内容块）
export function screenshotUserMessage(dataUrl, path, provider, model) {
  if (providerSupportsImageInput(provider, model)) {
    return { role: "user", _screenshot: true, content: [
      { type: "text", text: SCREENSHOT_HINT },
      { type: "image_url", image_url: { url: dataUrl } }
    ] };
  }
  return { role: "user", _screenshot: true, content: screenshotUnavailableText(path) };
}

// Anthropic：作为 image 块并入同一条 tool_result user 消息，避免出现连续 user 消息
export function anthropicScreenshotBlocks(dataUrl, path, provider, model) {
  const match = String(dataUrl || "").match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (providerSupportsImageInput(provider, model) && match) {
    return [
      { type: "text", text: SCREENSHOT_HINT },
      { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } }
    ];
  }
  return [{ type: "text", text: screenshotUnavailableText(path) }];
}

export function stripImagePartsForTextOnly(messages = []) {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) return message;
    const text = messageTextContent(message).trim();
    return { ...message, content: text || "用户发送了图片附件，但当前模型不支持直接识别图片。请根据附件文件名、路径或用户文字说明继续；需要看图时提示用户切换到支持视觉的模型。" };
  }).filter((message) => String(message.content || "").trim());
}

export function providerRequestInfo(provider, protocol, model, thinking) {
  let endpoint = "";
  if (protocol === "anthropic") endpoint = endpointFromBase(provider.baseUrl || "https://api.anthropic.com/v1", "/messages");
  else if (protocol === "gemini") { const base = String(provider.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, ""); endpoint = `${base}/models/${encodeURIComponent(model)}:generateContent`; }
  else if (protocol === "mock") endpoint = "local://mock";
  else endpoint = endpointFromBase(provider.baseUrl, "/chat/completions");
  return { provider: provider.name || provider.id || "未命名供应商", protocol, model, thinking: thinking || "", endpoint, calledAt: new Date().toISOString() };
}

function isOpenAIHostedModel(provider = {}, model = "") {
  const providerText = [provider.id, provider.name, provider.baseUrl].filter(Boolean).join(" ").toLowerCase();
  return providerText.includes("api.openai.com") && /^gpt-5|^o[134]/.test(String(model || "").trim().toLowerCase());
}

function isKimiFixedParameterModel(provider = {}, model = "") {
  const providerText = [provider.id, provider.name, provider.baseUrl].filter(Boolean).join(" ").toLowerCase();
  const modelId = String(model || "").trim().toLowerCase();
  return (providerText.includes("moonshot") || providerText.includes("kimi"))
    && /^kimi-k2\.(5|6)(?:$|[-_])/.test(modelId);
}

function isDeepSeekV4Model(provider = {}, model = "") {
  const providerText = [provider.id, provider.name, provider.baseUrl].filter(Boolean).join(" ").toLowerCase();
  const modelId = String(model || "").trim().toLowerCase();
  return (providerText.includes("deepseek") || providerText.includes("api.deepseek.com"))
    && /^deepseek-v4-(flash|pro)(?:$|[-_])/.test(modelId);
}

function deepSeekThinkingOptions(thinking = "") {
  if (String(thinking || "").toLowerCase() === "deep") {
    return { thinking: { type: "enabled" }, reasoning_effort: "max" };
  }
  return { thinking: { type: "disabled" } };
}

export function openAICompatibleChatBody({ provider, model, messages, temperature, maxTokens, stream, thinking }) {
  const body = { model, messages, stream };
  const openAIHosted = isOpenAIHostedModel(provider, model);
  if (!openAIHosted && !isKimiFixedParameterModel(provider, model) && Number.isFinite(Number(temperature))) body.temperature = Number(temperature);
  if (isDeepSeekV4Model(provider, model)) Object.assign(body, deepSeekThinkingOptions(thinking));
  if (maxTokens) {
    if (openAIHosted) body.max_completion_tokens = maxTokens;
    else body.max_tokens = maxTokens;
  }
  return body;
}

// ── 非流式 API ───────────────────────────────────────────────────────────────

export async function callOpenAICompatible({ provider, model, messages, temperature, maxTokens, thinking, enableTools, enabledSkills, toolConsent, signal, onStep, confirmCommand, allowSkillDelegation = true }) {
  requireKey(provider);
  const endpoint = endpointFromBase(provider.baseUrl, "/chat/completions");
  if (!endpoint) { const e = new Error("请填写 Base URL"); e.status = 400; throw e; }

  const headers = { Authorization: `Bearer ${provider.apiKey}` };
  const baseBody = openAICompatibleChatBody({ provider, model, messages, temperature, maxTokens, stream: false, thinking });

  const availableTools = enableTools ? toolsForSkillIds(enabledSkills, toolConsent, { includeInvokeSkill: allowSkillDelegation }) : [];
  if (!enableTools || !availableTools.length) {
    const data = await postJson(endpoint, headers, baseBody, { signal });
    const choice = data?.choices?.[0] || {};
    const message = choice.message || {};
    const content = messageTextContent(message);
    const blocked = blockPseudoToolOutput(content, { enableTools });
    if (blocked) return { ...blocked, usage: data?.usage || null, raw: data, steps: [] };
    const unverified = blockUnverifiedCompletion(content, { steps: [] });
    if (unverified) return { ...unverified, usage: data?.usage || null, raw: data, steps: [] };
    return { content, usage: data?.usage || null, raw: data, emptyReason: content ? null : emptyResponseReason(choice, message) };
  }

  const loopMessages = [...messages];
  const steps = [];
  const availableToolNames = new Set(availableTools.map((t) => t.function?.name).filter(Boolean));
  const maxToolRounds = ctx.maxToolRounds;

  for (let i = 0; i < maxToolRounds; i++) {
    const data = await postJson(endpoint, headers, { ...baseBody, messages: loopMessages, tools: availableTools, tool_choice: "auto" }, { signal });
    const choice = data?.choices?.[0] || {};
    const message = choice.message || {};
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    // 输出在工具调用参数生成中途被 max_tokens 截断，参数不完整，不能执行
    if (calls.length && choice.finish_reason === "length") {
      const toolNames = calls.map((call) => call?.function?.name).filter(Boolean);
      return { content: maxTokensTruncationContent(toolNames), usage: data?.usage || null, raw: data, steps, maxTokensTruncated: true };
    }
    if (!calls.length) {
      const content = messageTextContent(message);
      const blocked = blockPseudoToolOutput(content, { enableTools });
      if (blocked) return { ...blocked, usage: data?.usage || null, raw: data, steps };
      const unverified = blockUnverifiedCompletion(content, { steps });
      if (unverified) return { ...unverified, usage: data?.usage || null, raw: data, steps };
      return { content, usage: data?.usage || null, raw: data, steps, emptyReason: content ? null : emptyResponseReason(choice, message) };
    }
    loopMessages.push(message);
    const roundSteps = [];
    let roundShot = null;
    for (const call of calls) {
      const name = call?.function?.name;
      const args = parseArguments(call?.function?.arguments);
      onStep?.({ phase: "start", name, args });
      const step = await runToolWithReceipt({
        name,
        args,
        toolConsent,
        availableToolNames,
        runner: handleToolCall,
        confirmCommand
      });
      const shot = extractScreenshotFromResult(name, step.result);
      onStep?.({ phase: "end", name, args, result: shot.resultForModel, receipt: step.receipt });
      steps.push(step);
      roundSteps.push(step);
      loopMessages.push({ role: "tool", tool_call_id: call.id, name, content: safeJson(shot.resultForModel) });
      if (shot.screenshotDataUrl) roundShot = { dataUrl: shot.screenshotDataUrl, path: shot.screenshotPath };
      const fuse = repeatedToolArgumentFailure(steps);
      if (fuse) {
        return { content: toolArgumentFuseContent(fuse), usage: null, raw: data, steps, toolArgFuse: fuse };
      }
    }
    appendRecoveryUserMessage(loopMessages, roundSteps, availableTools);
    if (roundShot) { dropInjectedScreenshots(loopMessages); loopMessages.push(screenshotUserMessage(roundShot.dataUrl, roundShot.path, provider, model)); }
  }

  const limitPrompt = [`[系统提示] 已达到工具调用上限（${maxToolRounds} 轮），无法继续调用工具。`, "请根据上面已执行的工具结果，向用户如实汇报：", "1. 已完成的步骤和结果（包括文件路径）", "2. 尚未完成的步骤（如有），并说明原因是达到了调用轮次上限", "3. 建议用户如何继续（例如：再次发送任务以继续剩余步骤）", "不要说任务已全部完成，除非所有步骤都成功执行。"].join("\n");
  try {
    const data = await postJson(endpoint, headers, { ...baseBody, messages: [...loopMessages, { role: "user", content: limitPrompt }] }, { signal });
    const choice = data?.choices?.[0] || {};
    const content = messageTextContent(choice.message || {});
    if (content) {
      const unverified = blockUnverifiedCompletion(content, { steps });
      if (unverified) return { ...unverified, usage: data?.usage || null, raw: data, steps, hitToolLimit: true };
      return { content, usage: data?.usage || null, raw: data, steps, hitToolLimit: true };
    }
  } catch {}

  const succeeded = steps.filter((s) => s?.receipt?.ok);
  const failed = steps.filter((s) => s?.receipt && !s.receipt.ok);
  const savedPath = [...succeeded].reverse().find((s) => s.result.path)?.result.path;
  return { content: [`已达到工具调用上限（${maxToolRounds} 轮），任务未必全部完成。`, succeeded.length ? `成功执行 ${succeeded.length} 个工具步骤。` : "", failed.length ? `${failed.length} 个步骤失败。` : "", savedPath ? `最近保存的文件：${savedPath}` : "", "如需继续，请重新发送任务指令。"].filter(Boolean).join("\n"), usage: null, raw: null, steps, hitToolLimit: true };
}

export async function callAnthropic({ provider, model, messages, temperature, maxTokens, signal }) {
  requireKey(provider);
  const endpoint = endpointFromBase(provider.baseUrl || "https://api.anthropic.com/v1", "/messages");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const conversational = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: toAnthropicContent(m.content) }));
  const data = await postJson(endpoint, { "x-api-key": provider.apiKey, "anthropic-version": provider.anthropicVersion || "2023-06-01" }, { model, max_tokens: maxTokens || 2048, temperature, ...(system ? { system } : {}), messages: conversational }, { signal });
  const content = (data?.content || []).map((part) => part.text || "").join("").trim();
  const blocked = blockPseudoToolOutput(content, { enableTools: false });
  if (blocked) return { ...blocked, usage: data?.usage || null, raw: data, steps: [] };
  const unverified = blockUnverifiedCompletion(content, { steps: [] });
  if (unverified) return { ...unverified, usage: data?.usage || null, raw: data, steps: [] };
  return { content, usage: data?.usage || null, raw: data, emptyReason: content ? null : { finishReason: data?.stop_reason || "", contentType: typeof data?.content, messageKeys: Object.keys(data || {}) } };
}

export async function callGemini({ provider, model, messages, temperature, maxTokens, signal }) {
  requireKey(provider);
  const base = String(provider.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const endpoint = `${base}/models/${encodeURIComponent(model)}:generateContent`;
  const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: toGeminiParts(m.content) }));
  const data = await postJson(endpoint, { "x-goog-api-key": provider.apiKey }, { ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}), contents, generationConfig: { temperature, ...(maxTokens ? { maxOutputTokens: maxTokens } : {}) } }, { signal });
  const candidate = data?.candidates?.[0] || {};
  const content = (candidate?.content?.parts || []).map((p) => p.text || "").join("").trim();
  const blocked = blockPseudoToolOutput(content, { enableTools: false });
  if (blocked) return { ...blocked, usage: data?.usageMetadata || null, raw: data, steps: [] };
  const unverified = blockUnverifiedCompletion(content, { steps: [] });
  if (unverified) return { ...unverified, usage: data?.usageMetadata || null, raw: data, steps: [] };
  return { content, usage: data?.usageMetadata || null, raw: data, emptyReason: content ? null : { finishReason: candidate.finishReason || "", contentType: typeof candidate?.content, messageKeys: Object.keys(candidate || {}) } };
}

export async function callMock({ model, messages }) {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  return { content: `neo 本地演示已收到：\n\n${last}\n\n当前模型：${model}\n\n切换到真实供应商并填写 API Key 后，就会走实际模型接口。`, usage: { input_tokens: 0, output_tokens: 0 }, raw: null };
}
