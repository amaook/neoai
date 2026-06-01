// server/api.mjs — 非流式 API 调用（OpenAI / Anthropic / Gemini / Mock）
import { ctx } from "./context.mjs";
import { agentTools, skillToolMap, toolsForSkillIds, handleToolCall, parseArguments, safeJson } from "./tools.mjs";

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

function openAICompatibleSupportsImageInput(provider = {}, model = "") {
  const normalizedModel = String(model || "").trim().toLowerCase();
  const providerText = [provider.id, provider.name, provider.baseUrl, model].filter(Boolean).join(" ").toLowerCase();
  if (provider.supportsImages === true || provider.vision === true) return true;
  if (provider.supportsImages === false || provider.vision === false) return false;
  if (providerText.includes("deepseek")) return false;
  if (providerText.includes("api.openai.com")) return /gpt-4o|gpt-4\.1|gpt-5|o3|o4/.test(String(model).toLowerCase());
  if (providerText.includes("dashscope") || providerText.includes("qwen") || providerText.includes("百炼")) {
    if (/^qwen3-coder|^qwen-coder|coder/.test(normalizedModel)) return false;
    if (/^qwen3\.(6|5)-(plus|flash)(-|$)/.test(normalizedModel)) return true;
    if (/^qwen3-vl-(plus|flash)(-|$)/.test(normalizedModel)) return true;
    if (/^qwen-vl|^qvq|omni/.test(normalizedModel)) return true;
  }
  if (providerText.includes("moonshot") || providerText.includes("kimi")) {
    if (/^kimi-k2\.(6|5)(-|$)/.test(normalizedModel)) return true;
    if (/^moonshot-v1-(8k|32k|128k)-vision-preview$/.test(normalizedModel)) return true;
  }
  return /vision|vl|omni|multimodal|llava/.test(providerText);
}

export function providerSupportsImageInput(provider = {}, model = "") {
  const protocol = provider?.protocol || "openai";
  if (protocol === "anthropic" || protocol === "gemini") return true;
  if (protocol === "openai") return openAICompatibleSupportsImageInput(provider, model);
  return false;
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

// ── 非流式 API ───────────────────────────────────────────────────────────────

export async function callOpenAICompatible({ provider, model, messages, temperature, maxTokens, enableTools, enabledSkills, signal }) {
  requireKey(provider);
  const endpoint = endpointFromBase(provider.baseUrl, "/chat/completions");
  if (!endpoint) { const e = new Error("请填写 Base URL"); e.status = 400; throw e; }

  const headers = { Authorization: `Bearer ${provider.apiKey}` };
  const baseBody = { model, messages, temperature, stream: false };
  if (maxTokens) baseBody.max_tokens = maxTokens;

  const availableTools = enableTools ? toolsForSkillIds(enabledSkills) : [];
  if (!enableTools || !availableTools.length) {
    const data = await postJson(endpoint, headers, baseBody, { signal });
    const choice = data?.choices?.[0] || {};
    const message = choice.message || {};
    const content = messageTextContent(message);
    return { content, usage: data?.usage || null, raw: data, emptyReason: content ? null : emptyResponseReason(choice, message) };
  }

  const loopMessages = [...messages];
  const steps = [];
  const availableToolNames = new Set(availableTools.map((t) => t.function?.name).filter(Boolean));
  const maxToolRounds = 10;

  for (let i = 0; i < maxToolRounds; i++) {
    const data = await postJson(endpoint, headers, { ...baseBody, messages: loopMessages, tools: availableTools, tool_choice: "auto" }, { signal });
    const choice = data?.choices?.[0] || {};
    const message = choice.message || {};
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) {
      const content = messageTextContent(message);
      return { content, usage: data?.usage || null, raw: data, steps, emptyReason: content ? null : emptyResponseReason(choice, message) };
    }
    loopMessages.push(message);
    for (const call of calls) {
      const name = call?.function?.name;
      const args = parseArguments(call?.function?.arguments);
      let result;
      try { result = availableToolNames.has(name) ? await handleToolCall(name, args) : { ok: false, error: `工具未启用：${name || "未知工具"}` }; }
      catch (error) { result = { ok: false, error: error.message }; }
      steps.push({ name, args, result });
      loopMessages.push({ role: "tool", tool_call_id: call.id, name, content: safeJson(result) });
    }
  }

  const limitPrompt = [`[系统提示] 已达到工具调用上限（${maxToolRounds} 轮），无法继续调用工具。`, "请根据上面已执行的工具结果，向用户如实汇报：", "1. 已完成的步骤和结果（包括文件路径）", "2. 尚未完成的步骤（如有），并说明原因是达到了调用轮次上限", "3. 建议用户如何继续（例如：再次发送任务以继续剩余步骤）", "不要说任务已全部完成，除非所有步骤都成功执行。"].join("\n");
  try {
    const data = await postJson(endpoint, headers, { ...baseBody, messages: [...loopMessages, { role: "user", content: limitPrompt }] }, { signal });
    const choice = data?.choices?.[0] || {};
    const content = messageTextContent(choice.message || {});
    if (content) return { content, usage: data?.usage || null, raw: data, steps, hitToolLimit: true };
  } catch {}

  const succeeded = steps.filter((s) => s?.result?.ok);
  const failed = steps.filter((s) => s?.result && !s.result.ok);
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
  return { content, usage: data?.usageMetadata || null, raw: data, emptyReason: content ? null : { finishReason: candidate.finishReason || "", contentType: typeof candidate?.content, messageKeys: Object.keys(candidate || {}) } };
}

export async function callMock({ model, messages }) {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  return { content: `neo 本地演示已收到：\n\n${last}\n\n当前模型：${model}\n\n切换到真实供应商并填写 API Key 后，就会走实际模型接口。`, usage: { input_tokens: 0, output_tokens: 0 }, raw: null };
}
