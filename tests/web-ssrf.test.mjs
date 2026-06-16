// tests/web-ssrf.test.mjs — web 工具的内网 / SSRF 守护（1.1.9）

import { describe, it, expect, afterEach, vi } from "vitest";
import { isPrivateIpAddress, handleToolCall } from "../server/tools.mjs";

describe("isPrivateIpAddress 内网地址判定", () => {
  it("环回 / 私有 / 链路本地判为私有", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateIpAddress(ip)).toBe(true);
    }
  });

  it("公网地址判为非私有", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "114.114.114.114", "2400:cb00::1"]) {
      expect(isPrivateIpAddress(ip)).toBe(false);
    }
  });

  it("空值按私有处理（保守）", () => {
    expect(isPrivateIpAddress("")).toBe(true);
  });
});

describe("read_web_page 拒绝本地 / 内网地址", () => {
  it("拒绝云元数据地址 169.254.169.254", async () => {
    await expect(handleToolCall("read_web_page", { url: "http://169.254.169.254/latest/meta-data/" }, { web: true }))
      .rejects.toThrow(/拒绝访问本地或内网/);
  });

  it("拒绝 localhost", async () => {
    await expect(handleToolCall("read_web_page", { url: "http://localhost:8080/admin" }, { web: true }))
      .rejects.toThrow(/拒绝访问本地或内网/);
  });

  it("拒绝私有网段 IP 字面量", async () => {
    await expect(handleToolCall("read_web_page", { url: "http://192.168.1.1/" }, { web: true }))
      .rejects.toThrow(/拒绝访问本地或内网/);
  });
});

describe("read_web_page 逐跳校验 30x 跳转（堵 SSRF 跳转绕过）", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("初始公网、302 跳转到内网元数据地址 → 拒绝", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } })
    ));
    await expect(handleToolCall("read_web_page", { url: "http://93.184.216.34/" }, { web: true }))
      .rejects.toThrow(/拒绝访问本地或内网/);
  });

  it("跳转到公网地址放行", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://1.1.1.1/page" } }))
      .mockResolvedValueOnce(new Response("<html><body>hello world content here</body></html>", { status: 200, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await handleToolCall("read_web_page", { url: "http://93.184.216.34/" }, { web: true });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("跳转次数过多 → 拒绝", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "http://1.1.1.1/loop" } })
    ));
    await expect(handleToolCall("read_web_page", { url: "http://93.184.216.34/" }, { web: true }))
      .rejects.toThrow(/跳转次数过多/);
  });
});
