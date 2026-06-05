// server/openai-responses.mjs — OpenAI Responses API adapter (non-streaming)
import { ctx } from "./context.mjs";
import { recoveryInputItemForFailedSteps } from "./agent-recovery.mjs";
import {
  endpointFromBase,
  messageTextContent,
  postJson,
  requireKey
} from "./api.mjs";
import {
  handleToolCall,
  parseArguments,
  safeJson,
  toolsForSkillIds
} from "./tools.mjs";
import { blockPseudoToolOutput } from "./pseudo-tools.mjs";
import {
  blockUnverifiedCompletion,
  repeatedToolArgumentFailure,
  runToolWithReceipt,
  toolArgumentFuseContent
} from "./tool-integrity.mjs";

export function isOpenAIResponsesMode(provider = {}) {
  return provider?.apiMode === "responses" || provider?.protocol === "openai-responses";
}

export function openAIResponsesEndpoint(provider = {}) {
  return endpointFromBase(provider.baseUrl || "https://api.openai.com/v1", "/responses");
}

function responseInputForMessage(message = {}) {
  const role = message.role === "assistant" ? "assistant" : "user";
  const content = messageTextContent(message);
  return { role, content };
}

function initialResponseInput(messages = []) {
  return messages
    .filter((message) => message.role !== "system")
    .map(responseInputForMessage)
    .filter((message) => String(message.content || "").trim());
}

function responseInstructions(messages = []) {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => messageTextContent(message))
    .filter(Boolean)
    .join("\n\n");
}

function strictObjectSchema(schema = {}) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;
  const next = { ...schema };
  if (next.properties && typeof next.properties === "object") {
    next.type = next.type || "object";
    next.additionalProperties = false;
    next.required = Object.keys(next.properties);
    next.properties = Object.fromEntries(
      Object.entries(next.properties).map(([key, value]) => [key, strictObjectSchema(value)])
    );
  }
  if (next.type === "object" && !next.properties) {
    next.properties = {};
    next.required = [];
    next.additionalProperties = false;
  }
  if (next.type === "array" && next.items) next.items = strictObjectSchema(next.items);
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    if (Array.isArray(next[key])) next[key] = next[key].map(strictObjectSchema);
  }
  return next;
}

export function responsesToolFromChatTool(tool = {}) {
  const fn = tool.function || {};
  const parameters = strictObjectSchema(fn.parameters || { type: "object", properties: {} });
  return {
    type: "function",
    name: fn.name,
    description: fn.description || "",
    parameters,
    strict: true
  };
}

export function responsesToolsForSkillIds(enabledSkills, toolConsent = {}) {
  return toolsForSkillIds(enabledSkills, toolConsent)
    .filter((tool) => tool.function?.name)
    .map(responsesToolFromChatTool);
}

function responseTextContent(data = {}) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  for (const item of data.output || []) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (typeof part?.text === "string") chunks.push(part.text);
        else if (typeof part?.content === "string") chunks.push(part.content);
      }
    } else if (typeof item?.text === "string") {
      chunks.push(item.text);
    }
  }
  return chunks.join("").trim();
}

function responseFunctionCalls(data = {}) {
  return (data.output || []).filter((item) => item?.type === "function_call" && item.name);
}

function usageFromResponses(data = {}) {
  return data.usage || null;
}

function responseRequestBody({ model, input, instructions, tools, temperature, maxTokens }) {
  const body = { model, input };
  if (instructions) body.instructions = instructions;
  if (tools?.length) body.tools = tools;
  if (Number.isFinite(Number(temperature))) body.temperature = Number(temperature);
  if (maxTokens) body.max_output_tokens = maxTokens;
  return body;
}

async function postResponse({ provider, body, signal }) {
  requireKey(provider);
  const endpoint = openAIResponsesEndpoint(provider);
  if (!endpoint) throw Object.assign(new Error("请填写 Base URL"), { status: 400 });
  return postJson(endpoint, { Authorization: `Bearer ${provider.apiKey}` }, body, { signal });
}

export async function callOpenAIResponses({
  provider,
  model,
  messages,
  temperature,
  maxTokens,
  enableTools,
  enabledSkills,
  toolConsent,
  signal
}) {
  const instructions = responseInstructions(messages);
  const input = initialResponseInput(messages);
  const tools = enableTools ? responsesToolsForSkillIds(enabledSkills, toolConsent) : [];
  const steps = [];
  const maxToolRounds = ctx.maxToolRounds;

  for (let round = 0; round < (tools.length ? maxToolRounds : 1); round++) {
    const data = await postResponse({
      provider,
      signal,
      body: responseRequestBody({ model, input, instructions, tools, temperature, maxTokens })
    });
    const toolCalls = responseFunctionCalls(data);
    if (!toolCalls.length) {
      const content = responseTextContent(data);
      const blocked = blockPseudoToolOutput(content, { enableTools });
      if (blocked) return { ...blocked, usage: usageFromResponses(data), raw: data, steps };
      const unverified = blockUnverifiedCompletion(content, { steps });
      if (unverified) return { ...unverified, usage: usageFromResponses(data), raw: data, steps };
      return { content, usage: usageFromResponses(data), raw: data, steps };
    }

    input.push(...(data.output || []));
    const roundSteps = [];
    const availableToolNames = new Set(tools.map((tool) => tool.name).filter(Boolean));
    for (const call of toolCalls) {
      const args = parseArguments(call.arguments);
      const step = await runToolWithReceipt({
        name: call.name,
        args,
        toolConsent,
        availableToolNames,
        runner: handleToolCall
      });
      steps.push(step);
      roundSteps.push(step);
      input.push({
        type: "function_call_output",
        call_id: call.call_id || call.id,
        output: safeJson(step.result)
      });
      const fuse = repeatedToolArgumentFailure(steps);
      if (fuse) return { content: toolArgumentFuseContent(fuse), usage: usageFromResponses(data), raw: data, steps, toolArgFuse: fuse };
    }
    const recoveryItem = recoveryInputItemForFailedSteps(roundSteps, tools);
    if (recoveryItem) input.push(recoveryItem);
  }

  const limitPrompt = [
    `[系统提示] 已达到工具调用上限（${maxToolRounds} 轮），无法继续调用工具。`,
    "请根据上面已执行的工具结果，向用户如实汇报已完成的步骤、尚未完成的部分，建议用户如何继续。",
    "不要说任务已全部完成，除非所有步骤都成功执行。"
  ].join("\n");
  input.push({ role: "user", content: limitPrompt });
  try {
    const data = await postResponse({
      provider,
      signal,
      body: responseRequestBody({ model, input, instructions, tools, temperature, maxTokens })
    });
    const content = responseTextContent(data);
    const unverified = blockUnverifiedCompletion(content, { steps });
    if (unverified) return { ...unverified, usage: usageFromResponses(data), raw: data, steps, hitToolLimit: true };
    return { content, usage: usageFromResponses(data), raw: data, steps, hitToolLimit: true };
  } catch {
    return { content: "", usage: null, raw: null, steps, hitToolLimit: true };
  }
}
