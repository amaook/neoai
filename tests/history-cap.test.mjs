// tests/history-cap.test.mjs — 服务端历史兜底截断（1.1.8）

import { describe, it, expect } from "vitest";
import { capMessageHistory } from "../server/api.mjs";

describe("capMessageHistory 服务端历史兜底", () => {
  it("未超预算时原样返回", () => {
    const msgs = [{ role: "system", content: "S" }, { role: "user", content: "hi" }];
    expect(capMessageHistory(msgs, 1000)).toBe(msgs);
  });

  it("超预算时保留 system 与最近消息，丢弃中间并插入提示", () => {
    const big = "x".repeat(100);
    const msgs = [
      { role: "system", content: "SYS" },
      { role: "user", content: "u1-" + big },
      { role: "assistant", content: "a1-" + big },
      { role: "user", content: "u2-" + big },
      { role: "assistant", content: "a2-" + big },
      { role: "user", content: "最新问题" }
    ];
    const capped = capMessageHistory(msgs, 200);
    expect(capped[0]).toEqual({ role: "system", content: "SYS" });
    expect(capped.some((m) => m.role === "system" && /已省略较早的/.test(m.content))).toBe(true);
    expect(capped[capped.length - 1]).toEqual({ role: "user", content: "最新问题" });
    expect(capped.length).toBeLessThan(msgs.length);
  });

  it("即使最近一条本身超预算，也至少保留它", () => {
    const huge = "y".repeat(500);
    const msgs = [{ role: "user", content: "old" }, { role: "user", content: huge }];
    const capped = capMessageHistory(msgs, 10);
    expect(capped[capped.length - 1].content).toBe(huge);
  });
});
