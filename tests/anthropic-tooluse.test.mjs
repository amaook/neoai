// tests/anthropic-tooluse.test.mjs — 修复：Anthropic 多轮工具调用时 tool_use/tool_result 被转成文本

import { describe, it, expect } from "vitest";
import { toAnthropicContent } from "../server/api.mjs";

describe("toAnthropicContent 保留 Anthropic 原生块", () => {
  it("tool_use / tool_result 原样保留，不被降级成文本", () => {
    const toolUse = { type: "tool_use", id: "t1", name: "read_file", input: { path: "a.txt" } };
    const toolResult = { type: "tool_result", tool_use_id: "t1", content: "{\"ok\":true}" };
    const out = toAnthropicContent([{ type: "text", text: "hi" }, toolUse, toolResult]);
    expect(out[0]).toEqual({ type: "text", text: "hi" });
    expect(out[1]).toEqual(toolUse);
    expect(out[2]).toEqual(toolResult);
  });

  it("仍正确把 image_url 转成 Anthropic image 块", () => {
    const out = toAnthropicContent([{ type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } }]);
    expect(out[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } });
  });

  it("未知块仍回退为文本（保持原有兜底）", () => {
    const out = toAnthropicContent([{ type: "weird", foo: 1 }]);
    expect(out[0].type).toBe("text");
    expect(out[0].text).toContain("weird");
  });
});
