import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { request as httpRequest } from "node:http";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ctx } from "../server/context.mjs";
import { createNeoServer } from "../server/routes.mjs";

const responsesProvider = {
  id: "openai",
  name: "OpenAI",
  protocol: "openai",
  apiMode: "responses",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "test-key"
};

let originalCtx;
let originalFetch;
let workspaceRoot;
let server;

beforeEach(async () => {
  originalCtx = { ...ctx };
  originalFetch = global.fetch;
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-responses-"));
  Object.assign(ctx, {
    ...originalCtx,
    workspaceRoot,
    appStatePath: "",
    desktopMode: false,
    defaultApiTimeoutMs: 3000,
    maxToolRounds: 3,
    selectWorkspaceRoot: null,
    openWorkspacePath: null,
    showWorkspacePath: null,
    openExternalUrl: null,
    notifyDesktop: null,
    renderImageFile: null,
    checkDesktopUpdates: null,
    getDesktopUpdateStatus: null,
    installDesktopUpdate: null
  });
  server = await startTestServer();
});

afterEach(async () => {
  if (server) {
    await closeServer(server);
    server = null;
  }
  global.fetch = originalFetch;
  Object.assign(ctx, originalCtx);
  if (workspaceRoot) {
    await rm(workspaceRoot, { recursive: true, force: true });
    workspaceRoot = "";
  }
  vi.restoreAllMocks();
});

describe("OpenAI Responses API mode", () => {
  it("parses a plain Responses text reply into neo content", async () => {
    const calls = mockModelFetch([
      responsesJson({
        output: [{ type: "message", content: [{ type: "output_text", text: "Responses hello." }] }],
        usage: { input_tokens: 3, output_tokens: 2 }
      })
    ]);

    const response = await postJson("/api/chat", {
      provider: responsesProvider,
      model: "gpt-test",
      stream: false,
      messages: [
        { role: "system", content: "Be concise." },
        { role: "user", content: "hello" }
      ]
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      content: "Responses hello.",
      steps: [],
      usage: { input_tokens: 3, output_tokens: 2 }
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.openai.com/v1/responses");
    expect(calls[0].body).toMatchObject({
      model: "gpt-test",
      instructions: "Be concise.",
      input: [{ role: "user", content: "hello" }]
    });
  });

  it("runs a Responses function_call through read_file and sends function_call_output back", async () => {
    await writeFile(path.join(workspaceRoot, "source.txt"), "local file text", "utf8");
    const calls = mockModelFetch([
      responsesJson({
        output: [responsesFunctionCall("read_file", { path: "source.txt" }, "call_read")]
      }),
      ({ body }) => {
        const output = body.input.find((item) => item.type === "function_call_output");
        expect(output).toMatchObject({ call_id: "call_read" });
        expect(output.output).toContain("local file text");
        expect(body.input.some((item) => item.type === "function_call" && item.name === "read_file")).toBe(true);
        return responsesJson({ output_text: "读到了 source.txt。" });
      }
    ]);

    const response = await postJson("/api/chat", {
      provider: responsesProvider,
      model: "gpt-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: false },
      messages: [{ role: "user", content: "读取 source.txt" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toBe("读到了 source.txt。");
    expect(response.body.steps).toHaveLength(1);
    expect(response.body.steps[0]).toMatchObject({
      name: "read_file",
      args: { path: "source.txt" },
      result: { ok: true, content: "local file text" }
    });
    expect(calls[0].body.tools.map((tool) => tool.name)).toContain("read_file");
    const readTool = calls[0].body.tools.find((tool) => tool.name === "read_file");
    expect(readTool).toMatchObject({
      type: "function",
      strict: true,
      parameters: { additionalProperties: false }
    });
    expect(readTool.parameters.required).toContain("path");
  });

  it("does not create files when Responses calls write_file without fileWrite consent", async () => {
    mockModelFetch([
      responsesJson({
        output: [responsesFunctionCall("write_file", { path: "blocked.md", content: "nope" }, "call_write")]
      }),
      ({ body }) => {
        const output = body.input.find((item) => item.type === "function_call_output");
        expect(output.output).toContain("工具未启用");
        return responsesJson({ output_text: "写入没有执行，因为缺少授权。" });
      }
    ]);

    const response = await postJson("/api/chat", {
      provider: responsesProvider,
      model: "gpt-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: false },
      messages: [{ role: "user", content: "写 blocked.md" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toContain("缺少授权");
    expect(response.body.steps[0]).toMatchObject({
      name: "write_file",
      result: { ok: false }
    });
    expect(response.body.steps[0].result.error).toContain("工具未启用");
    expect(await exists(path.join(workspaceRoot, "blocked.md"))).toBe(false);
  });

  it("adds a self-recovery prompt after a failed Responses tool result", async () => {
    const calls = mockModelFetch([
      responsesJson({
        output: [responsesFunctionCall("read_file", { path: "missing.txt" }, "call_missing")]
      }),
      ({ body }) => {
        const recoveryItem = body.input.find((item) => item.role === "user" && String(item.content || "").includes("自恢复执行"));
        expect(recoveryItem?.content).toContain("read_file");
        expect(recoveryItem?.content).toContain("避免重复");
        expect(recoveryItem?.content).toContain("可行替代路径");
        return responsesJson({ output_text: "读取失败后，我会换路径或请用户确认。" });
      }
    ]);

    const response = await postJson("/api/chat", {
      provider: responsesProvider,
      model: "gpt-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: false },
      messages: [{ role: "user", content: "读取 missing.txt" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toContain("换路径");
    expect(response.body.steps).toHaveLength(1);
    expect(response.body.steps[0]).toMatchObject({
      name: "read_file",
      result: { ok: false }
    });
    expect(calls).toHaveLength(2);
  });

  it("keeps default OpenAI-compatible providers on /chat/completions when apiMode is not responses", async () => {
    const calls = mockModelFetch([
      chatCompletionsJson({ content: "兼容层正常。" })
    ]);

    const response = await postJson("/api/chat", {
      provider: {
        id: "qwen",
        name: "阿里云百炼",
        protocol: "openai",
        apiMode: "chat_completions",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        apiKey: "test-key"
      },
      model: "qwen-test",
      stream: false,
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toBe("兼容层正常。");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
    expect(calls[0].body.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(calls[0].body.input).toBeUndefined();
  });
});

async function startTestServer() {
  const testServer = createNeoServer();
  await new Promise((resolve, reject) => {
    testServer.once("error", reject);
    testServer.listen(0, "127.0.0.1", () => {
      testServer.off("error", reject);
      resolve();
    });
  });
  return testServer;
}

function closeServer(testServer) {
  return new Promise((resolve, reject) => {
    testServer.close((error) => error ? reject(error) : resolve());
  });
}

function serverPort() {
  const address = server.address();
  if (!address || typeof address !== "object") throw new Error("test server is not listening");
  return address.port;
}

function postJson(pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = httpRequest({
      hostname: "127.0.0.1",
      port: serverPort(),
      path: pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(text) });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });
}

function mockModelFetch(responses) {
  const calls = [];
  global.fetch = vi.fn(async (url, options = {}) => {
    const body = JSON.parse(String(options.body || "{}"));
    calls.push({ url: String(url), body, headers: options.headers || {} });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected model fetch: ${url}`);
    return typeof next === "function" ? next({ url: String(url), options, body }) : next;
  });
  return calls;
}

function responsesJson(data) {
  return new Response(JSON.stringify({
    id: "resp_test",
    object: "response",
    output: [],
    usage: null,
    ...data
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function responsesFunctionCall(name, args, callId) {
  return {
    type: "function_call",
    id: `fc_${name}`,
    call_id: callId,
    name,
    arguments: JSON.stringify(args)
  };
}

function chatCompletionsJson({ content }) {
  return new Response(JSON.stringify({
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }]
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
