// server/sse.mjs — SSE 流式 API（OpenAI / Anthropic / Gemini / Mock）
// 改进：
//   • Anthropic 和 Gemini 均支持工具调用 agentic loop
//   • 长时间工具执行期间每 15s 发送 SSE 心跳注释，防止代理/浏览器断流
//   • 错误时推送结构化 { type: "error" } 事件后再关闭，而非直接断开

import { ctx } from "./context.mjs";
import { toolsForSkillIds, handleToolCall, parseArguments, safeJson } from "./tools.mjs";
import { requireKey, endpointFromBase, toAnthropicContent, toGeminiParts, messageTextContent } from "./api.mjs";
import { callMock } from "./api.mjs";

// ── SSE 辅助 ─────────────────────────────────────────────────────────────────

export function sseWrite(res, event) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function sseError(res, message) {
  sseWrite(res, { type: "error", error: message });
  if (!res.writableEnded) res.end();
}

/** 心跳：每隔 intervalMs 向客户端发一条 SSE 注释行，返回停止函数 */
function startHeartbeat(res, intervalMs = 15000) {
  const timer = setInterval(() => {
    if (res.writableEnded) { clearInterval(timer); return; }
    res.write(": keepalive\n\n");
  }, intervalMs);
  return () => clearInterval(timer);
}

// ── SSE 流解析器 ─────────────────────────────────────────────────────────────

async function* parseOpenAIStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (raw === "[DONE]") return;
        try { yield JSON.parse(raw); } catch { /* 忽略非 JSON */ }
      }
    }
  } finally { reader.releaseLock(); }
}

async function* parseAnthropicStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        try { yield JSON.parse(raw); } catch { /* 忽略 */ }
      }
    }
  } finally { reader.releaseLock(); }
}

// ── 网络请求帮助 ─────────────────────────────────────────────────────────────

async function streamFetch(endpoint, headers, body, signal) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), ctx.defaultApiTimeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
  let fetchRes;
  try {
    fetchRes = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: controller.signal });
  } finally { clearTimeout(tid); }
  if (!fetchRes.ok) {
    const errText = await fetchRes.text();
    let errMsg;
    try { errMsg = JSON.parse(errText)?.error?.message || errText; } catch { errMsg = errText; }
    throw new Error(errMsg || `HTTP ${fetchRes.status}`);
  }
  return fetchRes;
}

// ── OpenAI 兼容流 ─────────────────────────────────────────────────────────────

export async function streamOpenAICompatible({ provider, model, messages, temperature, maxTokens, enableTools, enabledSkills, signal, res, requestInfo }) {
  requireKey(provider);
  const endpoint = endpointFromBase(provider.baseUrl, "/chat/completions");
  if (!endpoint) throw Object.assign(new Error("请填写 Base URL"), { status: 400 });

  const headers = { Authorization: `Bearer ${provider.apiKey}` };
  const availableTools = enableTools ? toolsForSkillIds(enabledSkills) : [];
  const useTools = enableTools && availableTools.length > 0;
  const baseBody = { model, messages, temperature, stream: true };
  if (maxTokens) baseBody.max_tokens = maxTokens;

  const loopMessages = [...messages];
  const steps = [];
  const maxToolRounds = 10;

  for (let round = 0; round < (useTools ? maxToolRounds : 1); round++) {
    const reqBody = useTools ? { ...baseBody, messages: loopMessages, tools: availableTools, tool_choice: "auto" } : { ...baseBody, messages: loopMessages };
    const fetchRes = await streamFetch(endpoint, headers, reqBody, signal);

    let fullContent = "";
    const toolCallMap = {};
    let finishReason = "";

    for await (const chunk of parseOpenAIStream(fetchRes)) {
      const choice = chunk?.choices?.[0] || {};
      const delta = choice.delta || {};
      finishReason = choice.finish_reason || finishReason;
      if (delta.content) { fullContent += delta.content; sseWrite(res, { type: "delta", text: delta.content }); }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallMap[idx]) toolCallMap[idx] = { id: tc.id || `call_${idx}`, name: "", argsBuf: "" };
          if (tc.function?.name) toolCallMap[idx].name += tc.function.name;
          if (tc.function?.arguments) toolCallMap[idx].argsBuf += tc.function.arguments;
          if (tc.id) toolCallMap[idx].id = tc.id;
        }
      }
    }

    const toolCalls = Object.values(toolCallMap).filter((tc) => tc.name);
    if (!toolCalls.length) {
      sseWrite(res, { type: "done", content: fullContent, steps, request: requestInfo });
      res.end();
      return;
    }

    loopMessages.push({ role: "assistant", content: fullContent || null, tool_calls: toolCalls.map((tc) => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: tc.argsBuf } })) });

    const stopHb = startHeartbeat(res);
    for (const tc of toolCalls) {
      const args = parseArguments(tc.argsBuf);
      sseWrite(res, { type: "tool_start", name: tc.name, args });
      let result;
      try { result = await handleToolCall(tc.name, args); } catch (err) { result = { ok: false, error: err.message }; }
      steps.push({ name: tc.name, args, result });
      sseWrite(res, { type: "tool_end", name: tc.name, result });
      loopMessages.push({ role: "tool", tool_call_id: tc.id, name: tc.name, content: safeJson(result) });
    }
    stopHb();
  }

  // 超出轮次
  const limitPrompt = `[系统提示] 已达到工具调用上限（${maxToolRounds} 轮），无法继续调用工具。\n请根据上面已执行的工具结果，向用户如实汇报已完成的步骤、尚未完成的部分，建议用户如何继续。\n不要说任务已全部完成，除非所有步骤都成功执行。`;
  try {
    const limitRes = await streamFetch(endpoint, headers, { ...baseBody, stream: true, messages: [...loopMessages, { role: "user", content: limitPrompt }] }, signal);
    let limitContent = "";
    for await (const chunk of parseOpenAIStream(limitRes)) {
      const delta = chunk?.choices?.[0]?.delta || {};
      if (delta.content) { limitContent += delta.content; sseWrite(res, { type: "delta", text: delta.content }); }
    }
    sseWrite(res, { type: "done", content: limitContent, steps, hitToolLimit: true, request: requestInfo });
  } catch {
    sseWrite(res, { type: "done", content: "", steps, hitToolLimit: true, request: requestInfo });
  }
  res.end();
}

// ── Anthropic 流（含工具调用 loop）─────────────────────────────────────────

export async function streamAnthropic({ provider, model, messages, temperature, maxTokens, enableTools, enabledSkills, signal, res, requestInfo }) {
  requireKey(provider);
  const endpoint = endpointFromBase(provider.baseUrl || "https://api.anthropic.com/v1", "/messages");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");

  const availableTools = enableTools ? toolsForSkillIds(enabledSkills) : [];
  const useTools = enableTools && availableTools.length > 0;

  // Anthropic tools 格式转换
  const anthropicTools = availableTools.map((t) => ({
    name: t.function.name,
    description: t.function.description || "",
    input_schema: t.function.parameters || { type: "object", properties: {} }
  }));

  const buildConversational = (msgs) =>
    msgs.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: toAnthropicContent(m.content) }));

  const loopMessages = [...messages];
  const steps = [];
  const maxToolRounds = 10;

  for (let round = 0; round < (useTools ? maxToolRounds : 1); round++) {
    const body = {
      model,
      max_tokens: maxTokens || 2048,
      temperature,
      ...(system ? { system } : {}),
      messages: buildConversational(loopMessages),
      stream: true,
      ...(useTools ? { tools: anthropicTools } : {})
    };

    const fetchRes = await streamFetch(endpoint, { "x-api-key": provider.apiKey, "anthropic-version": provider.anthropicVersion || "2023-06-01" }, body, signal);

    let fullContent = "";
    let usage = null;
    // 收集工具调用块
    const toolUseBlocks = {}; // index -> { id, name, inputBuf }

    for await (const event of parseAnthropicStream(fetchRes)) {
      // 文本增量
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        fullContent += event.delta.text;
        sseWrite(res, { type: "delta", text: event.delta.text });
      }
      // 工具输入增量
      if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
        const idx = event.index ?? 0;
        if (toolUseBlocks[idx]) toolUseBlocks[idx].inputBuf += event.delta.partial_json || "";
      }
      // 新内容块开始（tool_use 类型）
      if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
        const idx = event.index ?? 0;
        toolUseBlocks[idx] = { id: event.content_block.id, name: event.content_block.name, inputBuf: "" };
      }
      if (event.type === "message_delta" && event.usage) usage = event.usage;
    }

    const toolCalls = Object.values(toolUseBlocks).filter((t) => t.name);

    if (!toolCalls.length) {
      sseWrite(res, { type: "done", content: fullContent, usage, steps, request: requestInfo });
      res.end();
      return;
    }

    // 拼装 Anthropic assistant 消息（含 tool_use 内容块）
    const assistantContent = [];
    if (fullContent) assistantContent.push({ type: "text", text: fullContent });
    for (const tc of toolCalls) {
      let input = {};
      try { input = JSON.parse(tc.inputBuf || "{}"); } catch {}
      assistantContent.push({ type: "tool_use", id: tc.id, name: tc.name, input });
    }
    loopMessages.push({ role: "assistant", content: assistantContent });

    // 执行工具并构造 tool_result
    const stopHb = startHeartbeat(res);
    const toolResults = [];
    for (const tc of toolCalls) {
      let input = {};
      try { input = JSON.parse(tc.inputBuf || "{}"); } catch {}
      sseWrite(res, { type: "tool_start", name: tc.name, args: input });
      let result;
      try { result = await handleToolCall(tc.name, input); } catch (err) { result = { ok: false, error: err.message }; }
      steps.push({ name: tc.name, args: input, result });
      sseWrite(res, { type: "tool_end", name: tc.name, result });
      toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: safeJson(result) });
    }
    stopHb();
    loopMessages.push({ role: "user", content: toolResults });
  }

  // 超出轮次
  const limitMsg = `[系统提示] 已达到工具调用上限（${maxToolRounds} 轮），无法继续调用工具。\n请根据上面已执行的工具结果，向用户如实汇报已完成的步骤、尚未完成的部分，建议用户如何继续。`;
  loopMessages.push({ role: "user", content: limitMsg });
  try {
    const limitRes = await streamFetch(endpoint, { "x-api-key": provider.apiKey, "anthropic-version": provider.anthropicVersion || "2023-06-01" }, { model, max_tokens: maxTokens || 2048, temperature, ...(system ? { system } : {}), messages: buildConversational(loopMessages), stream: true }, signal);
    let limitContent = "";
    for await (const event of parseAnthropicStream(limitRes)) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") { limitContent += event.delta.text; sseWrite(res, { type: "delta", text: event.delta.text }); }
    }
    sseWrite(res, { type: "done", content: limitContent, steps, hitToolLimit: true, request: requestInfo });
  } catch {
    sseWrite(res, { type: "done", content: "", steps, hitToolLimit: true, request: requestInfo });
  }
  res.end();
}

// ── Gemini 流（含工具调用 loop）──────────────────────────────────────────────

export async function streamGemini({ provider, model, messages, temperature, maxTokens, enableTools, enabledSkills, signal, res, requestInfo }) {
  requireKey(provider);
  const base = String(provider.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const endpoint = `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");

  const availableTools = enableTools ? toolsForSkillIds(enabledSkills) : [];
  const useTools = enableTools && availableTools.length > 0;

  // Gemini function declarations 格式
  const geminiTools = useTools ? [{
    functionDeclarations: availableTools.map((t) => ({
      name: t.function.name,
      description: t.function.description || "",
      parameters: t.function.parameters || { type: "object", properties: {} }
    }))
  }] : undefined;

  const buildContents = (msgs) =>
    msgs.filter((m) => m.role !== "system").map((m) => {
      if (m.role === "tool") {
        // Gemini function response
        return { role: "user", parts: [{ functionResponse: { name: m.name, response: { content: m.content } } }] };
      }
      if (m.role === "assistant" && m._geminiFunctionCalls) {
        return { role: "model", parts: m._geminiFunctionCalls };
      }
      return { role: m.role === "assistant" ? "model" : "user", parts: toGeminiParts(m.content) };
    });

  const loopMessages = [...messages];
  const steps = [];
  const maxToolRounds = 10;

  for (let round = 0; round < (useTools ? maxToolRounds : 1); round++) {
    const body = {
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents: buildContents(loopMessages),
      generationConfig: { temperature, ...(maxTokens ? { maxOutputTokens: maxTokens } : {}) },
      ...(geminiTools ? { tools: geminiTools } : {})
    };

    const fetchRes = await streamFetch(endpoint, { "x-goog-api-key": provider.apiKey }, body, signal);

    let fullContent = "";
    const functionCalls = []; // { name, args }

    for await (const chunk of parseOpenAIStream(fetchRes)) {
      const candidate = chunk?.candidates?.[0] || {};
      const parts = candidate?.content?.parts || [];
      for (const part of parts) {
        if (part.text) { fullContent += part.text; sseWrite(res, { type: "delta", text: part.text }); }
        if (part.functionCall) functionCalls.push({ id: `call_${Math.random().toString(36).slice(2, 9)}`, name: part.functionCall.name, args: part.functionCall.args || {} });
      }
    }

    if (!functionCalls.length) {
      sseWrite(res, { type: "done", content: fullContent, steps, request: requestInfo });
      res.end();
      return;
    }

    // 记录 assistant 消息（带 functionCall parts，供 buildContents 使用）
    loopMessages.push({ role: "assistant", content: fullContent || null, _geminiFunctionCalls: functionCalls.map((fc) => ({ functionCall: { name: fc.name, args: fc.args } })) });

    const stopHb = startHeartbeat(res);
    for (const fc of functionCalls) {
      sseWrite(res, { type: "tool_start", name: fc.name, args: fc.args });
      let result;
      try { result = await handleToolCall(fc.name, fc.args); } catch (err) { result = { ok: false, error: err.message }; }
      steps.push({ name: fc.name, args: fc.args, result });
      sseWrite(res, { type: "tool_end", name: fc.name, result });
      // Gemini tool 结果通过 functionResponse 格式返回
      loopMessages.push({ role: "tool", name: fc.name, content: safeJson(result) });
    }
    stopHb();
  }

  // 超出轮次 — 不支持工具的普通文本轮
  const limitMsg = `[系统提示] 已达到工具调用上限（${maxToolRounds} 轮），无法继续调用工具。请根据上面已执行的工具结果，向用户如实汇报已完成的步骤、尚未完成的部分，建议用户如何继续。`;
  loopMessages.push({ role: "user", content: limitMsg });
  try {
    const limitRes = await streamFetch(endpoint, { "x-goog-api-key": provider.apiKey }, { ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}), contents: buildContents(loopMessages), generationConfig: { temperature, ...(maxTokens ? { maxOutputTokens: maxTokens } : {}) } }, signal);
    let limitContent = "";
    for await (const chunk of parseOpenAIStream(limitRes)) {
      const parts = chunk?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) { if (part.text) { limitContent += part.text; sseWrite(res, { type: "delta", text: part.text }); } }
    }
    sseWrite(res, { type: "done", content: limitContent, steps, hitToolLimit: true, request: requestInfo });
  } catch {
    sseWrite(res, { type: "done", content: "", steps, hitToolLimit: true, request: requestInfo });
  }
  res.end();
}

// ── Mock 流 ────────────────────────────────────────────────────────────────

export async function streamMock({ model, messages, res, requestInfo, signal }) {
  const result = await callMock({ model, messages });
  const text = result.content || "";
  const chunks = text.match(/[\s\S]{1,8}/g) || [""];
  for (const chunk of chunks) {
    if (signal?.aborted || res.writableEnded) return;
    sseWrite(res, { type: "delta", text: chunk });
    await new Promise((resolve) => setTimeout(resolve, 42));
  }
  if (!res.writableEnded) { sseWrite(res, { type: "done", request: requestInfo, ...result }); res.end(); }
}
