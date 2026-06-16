import { describe, expect, it } from "vitest";

import { openAICompatibleChatBody, providerSupportsImageInput } from "../server/api.mjs";

describe("model image routing", () => {
  it("keeps Kimi text models on text-only attachment fallback", () => {
    expect(providerSupportsImageInput({
      id: "kimi",
      name: "Kimi",
      protocol: "openai",
      baseUrl: "https://api.moonshot.ai/v1"
    }, "kimi-k2.6")).toBe(false);
  });

  it("only treats explicit Qwen VL/omni models as image-capable", () => {
    const provider = {
      id: "qwen",
      name: "阿里云百炼",
      protocol: "openai",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    };
    expect(providerSupportsImageInput(provider, "qwen3.7-plus")).toBe(false);
    expect(providerSupportsImageInput(provider, "qwen3-vl-plus")).toBe(true);
    expect(providerSupportsImageInput(provider, "qwen3-omni-flash")).toBe(true);
  });

  it("omits temperature for Kimi fixed-parameter K2.6 requests", () => {
    const body = openAICompatibleChatBody({
      provider: {
        id: "kimi",
        name: "Kimi",
        protocol: "openai",
        baseUrl: "https://api.moonshot.cn/v1"
      },
      model: "kimi-k2.6",
      messages: [{ role: "user", content: "你好" }],
      temperature: 0,
      maxTokens: 128,
      stream: false
    });
    expect(body).not.toHaveProperty("temperature");
    expect(body.max_tokens).toBe(128);
  });

  it("keeps temperature for regular OpenAI-compatible providers", () => {
    const body = openAICompatibleChatBody({
      provider: {
        id: "deepseek",
        name: "DeepSeek",
        protocol: "openai",
        baseUrl: "https://api.deepseek.com"
      },
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "你好" }],
      temperature: 0,
      maxTokens: 128,
      stream: false
    });
    expect(body.temperature).toBe(0);
    expect(body.thinking).toEqual({ type: "disabled" });
  });

  it("disables DeepSeek V4 thinking for fast and balanced chat modes", () => {
    const provider = {
      id: "deepseek",
      name: "DeepSeek",
      protocol: "openai",
      baseUrl: "https://api.deepseek.com"
    };
    expect(openAICompatibleChatBody({
      provider,
      model: "deepseek-v4-pro",
      messages: [{ role: "user", content: "你好" }],
      temperature: 0.7,
      maxTokens: 128,
      stream: true,
      thinking: "balanced"
    })).toMatchObject({ thinking: { type: "disabled" } });
    expect(openAICompatibleChatBody({
      provider,
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "你好" }],
      temperature: 0.7,
      maxTokens: 128,
      stream: true,
      thinking: "fast"
    })).toMatchObject({ thinking: { type: "disabled" } });
  });

  it("enables max DeepSeek V4 reasoning only for deep mode", () => {
    const body = openAICompatibleChatBody({
      provider: {
        id: "deepseek",
        name: "DeepSeek",
        protocol: "openai",
        baseUrl: "https://api.deepseek.com"
      },
      model: "deepseek-v4-pro",
      messages: [{ role: "user", content: "仔细分析" }],
      temperature: 0.7,
      maxTokens: 4096,
      stream: true,
      thinking: "deep"
    });
    expect(body.thinking).toEqual({ type: "enabled" });
    expect(body.reasoning_effort).toBe("max");
  });
});
