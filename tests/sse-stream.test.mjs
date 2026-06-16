import { describe, it, expect, vi, afterEach } from "vitest";
import { streamOpenAICompatible } from "../server/sse.mjs";
import { ctx } from "../server/context.mjs";

const provider = { id: "kimi", name: "Kimi", baseUrl: "https://api.moonshot.cn/v1", apiKey: "sk-test" };

function sseResponse(chunks) {
  const encoder = new TextEncoder();
  const payload = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n`).join("") + "data: [DONE]\n";
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(payload));
        controller.close();
      }
    })
  };
}

function makeRes() {
  const res = { written: [], writableEnded: false };
  res.write = (text) => res.written.push(text);
  res.end = () => { res.writableEnded = true; };
  return res;
}

function doneEvent(res) {
  const events = res.written
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
  return events.find((event) => event.type === "done");
}

const reasoningOnlyChunks = [
  { choices: [{ delta: { reasoning_content: "先规划打包步骤……" } }] },
  { choices: [{ delta: {}, finish_reason: "length" }] }
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamOpenAICompatible 思考额度耗尽", () => {
  it("正文为空且 finish_reason=length 时自动加大 max_tokens 重试一次", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sseResponse(reasoningOnlyChunks))
      .mockResolvedValueOnce(sseResponse([
        { choices: [{ delta: { content: "好的，我来打包。" } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] }
      ]));
    vi.stubGlobal("fetch", fetchMock);

    const res = makeRes();
    await streamOpenAICompatible({
      provider, model: "kimi-k2.6",
      messages: [{ role: "user", content: "帮我做成安装包" }],
      maxTokens: 2048, enableTools: false, res, requestInfo: {}
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(retryBody.max_tokens).toBeGreaterThanOrEqual(8192);
    const done = doneEvent(res);
    expect(done.content).toBe("好的，我来打包。");
    expect(done.emptyReason).toBeUndefined();
  });

  it("重试后仍为空时只重试一次，并在 done 事件里带 emptyReason 诊断", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sseResponse(reasoningOnlyChunks))
      .mockResolvedValueOnce(sseResponse(reasoningOnlyChunks));
    vi.stubGlobal("fetch", fetchMock);

    const res = makeRes();
    await streamOpenAICompatible({
      provider, model: "kimi-k2.6",
      messages: [{ role: "user", content: "帮我做成安装包" }],
      maxTokens: 2048, enableTools: false, res, requestInfo: {}
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const done = doneEvent(res);
    expect(done.content).toBe("");
    expect(done.emptyReason).toEqual({ finishReason: "length", hasToolCalls: false, hasReasoningContent: true });
  });

  it("未设置输出上限时不重试，直接返回 emptyReason", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResponse(reasoningOnlyChunks));
    vi.stubGlobal("fetch", fetchMock);

    const res = makeRes();
    await streamOpenAICompatible({
      provider, model: "kimi-k2.6",
      messages: [{ role: "user", content: "帮我做成安装包" }],
      maxTokens: 0, enableTools: false, res, requestInfo: {}
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const done = doneEvent(res);
    expect(done.emptyReason).toMatchObject({ finishReason: "length", hasReasoningContent: true });
  });
});

// 响应头已到达、但正文中途卡死，永不再产出数据
function stallingResponse() {
  return { ok: true, body: new ReadableStream({ start() { /* never enqueue, never close */ } }) };
}

describe("streamOpenAICompatible 流式健壮性", () => {
  it("流中途返回 error 数据行时抛出真实报错，而不是静默给空回复", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResponse([{ error: { message: "账户余额不足", code: 402 } }]));
    vi.stubGlobal("fetch", fetchMock);

    const res = makeRes();
    await expect(streamOpenAICompatible({
      provider, model: "kimi-k2.6",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 1024, enableTools: false, res, requestInfo: {}
    })).rejects.toThrow(/账户余额不足/);
  });

  it("响应头到达后正文长时间无数据时按空闲超时中断", async () => {
    const original = ctx.streamIdleTimeoutMs;
    ctx.streamIdleTimeoutMs = 50;
    const fetchMock = vi.fn().mockResolvedValueOnce(stallingResponse());
    vi.stubGlobal("fetch", fetchMock);

    const res = makeRes();
    try {
      await expect(streamOpenAICompatible({
        provider, model: "kimi-k2.6",
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 1024, enableTools: false, res, requestInfo: {}
      })).rejects.toThrow(/未收到新数据/);
    } finally {
      ctx.streamIdleTimeoutMs = original;
    }
  });
});
