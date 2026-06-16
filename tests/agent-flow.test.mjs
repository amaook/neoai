import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { request as httpRequest } from "node:http";
import { execFileSync } from "node:child_process";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ctx } from "../server/context.mjs";
import { createNeoServer } from "../server/routes.mjs";
import { handleToolCall, ripgrepSearchArgs, toolsForSkillIds } from "../server/tools.mjs";

const provider = {
  id: "test-openai",
  name: "Test OpenAI Compatible",
  protocol: "openai",
  baseUrl: "https://model.test/v1",
  apiKey: "test-key"
};

let originalCtx;
let originalFetch;
let workspaceRoot;
let server;

const hasRipgrep = (() => {
  try {
    execFileSync("rg", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

beforeEach(async () => {
  originalCtx = { ...ctx };
  originalFetch = global.fetch;
  workspaceRoot = await mkdtemp(path.join(tmpdir(), "neo-agent-flow-"));
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

describe("agent flow", () => {
  it("builds ripgrep search arguments without shell quoting", () => {
    expect(ripgrepSearchArgs('needle "quoted"', "*.txt")).toEqual([
      "--line-number",
      "--hidden",
      "-g",
      "!node_modules",
      "-g",
      "!.git",
      "-g",
      "*.txt",
      'needle "quoted"',
      "."
    ]);
  });

  it("rejects write_file with missing path or content before resolving workspace root", async () => {
    const result = await handleToolCall("write_file", {}, { fileWrite: true });

    expect(result).toMatchObject({ ok: false, toolArgError: true });
    expect(result.error).toContain("path");
    expect(result.error).toContain("content");
    expect(await exists(path.join(workspaceRoot, "undefined"))).toBe(false);
  });

  it("rejects export_image with missing input and output parameters", async () => {
    const result = await handleToolCall("export_image", {}, { fileRead: true, fileWrite: true });

    expect(result).toMatchObject({ ok: false, toolArgError: true });
    expect(result.error).toContain("input_path/html/svg");
    expect(result.error).toContain("output_path");
  });

  it("rejects run_command with a missing command", async () => {
    const result = await handleToolCall("run_command", {}, { command: true });

    expect(result).toMatchObject({ ok: false, toolArgError: true });
    expect(result.error).toContain("command");
  });

  it("does not expose invoke_skill inside a delegated skill agent tool set", () => {
    const names = toolsForSkillIds(["local-files"], { fileRead: true, fileWrite: true }, { includeInvokeSkill: false })
      .map((tool) => tool.function.name);

    expect(names).toContain("write_file");
    expect(names).not.toContain("invoke_skill");
  });

  (hasRipgrep ? it : it.skip)("searches workspace text containing quotes", async () => {
    await writeFile(path.join(workspaceRoot, "quoted file.txt"), 'needle "quoted" value', "utf8");
    const result = await handleToolCall("search_files", { query: 'needle "quoted"', glob: "*.txt" }, { fileRead: true });
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain("quoted file.txt");
    expect(result.stdout).toContain('needle "quoted" value');
  });

  it("requires explicit authorization before reading absolute external paths", async () => {
    const externalRoot = await mkdtemp(path.join(tmpdir(), "neo-external-read-"));
    const externalFile = path.join(externalRoot, "outside.txt");
    await writeFile(externalFile, "outside content", "utf8");
    try {
      await expect(handleToolCall("read_file", { path: externalFile }, { fileRead: true }))
        .rejects.toThrow("未授权读取该外部路径");

      const allowed = await handleToolCall("read_file", { path: externalFile }, {
        fileRead: true,
        externalRead: true,
        externalPaths: [externalRoot]
      });
      expect(allowed).toMatchObject({ ok: true, path: externalFile, content: "outside content" });

      await expect(handleToolCall("write_file", { path: path.join(externalRoot, "created.txt"), content: "nope" }, {
        fileRead: true,
        fileWrite: true,
        externalRead: true,
        externalPaths: [externalRoot]
      })).rejects.toThrow("路径超出工作区");
      expect(await exists(path.join(externalRoot, "created.txt"))).toBe(false);
    } finally {
      await rm(externalRoot, { recursive: true, force: true });
    }
  });

  it("keeps write tools unavailable without fileWrite consent and returns the tool failure to the model", async () => {
    server = await startTestServer();
    const modelCalls = mockModelFetch([
      jsonModelResponse({
        message: {
          role: "assistant",
          content: null,
          tool_calls: [toolCall("write_file", { path: "notes/denied.md", content: "should not be written" })]
        },
        finish_reason: "tool_calls"
      }),
      ({ body }) => {
        const toolMessage = body.messages.find((message) => message.role === "tool");
        expect(toolMessage?.content).toContain("工具未启用：write_file");
        return jsonModelResponse({
          message: { role: "assistant", content: "我没有写入文件，因为写入工具没有授权。" },
          finish_reason: "stop"
        });
      }
    ]);

    const response = await postJson("/api/chat", {
      provider,
      model: "agent-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: false },
      messages: [{ role: "user", content: "写一个文件" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.content).toContain("没有写入文件");
    expect(response.body.steps).toHaveLength(1);
    expect(response.body.steps[0]).toMatchObject({
      name: "write_file",
      result: { ok: false, error: "工具未启用：write_file" }
    });
    expect(await exists(path.join(workspaceRoot, "notes", "denied.md"))).toBe(false);

    expect(modelCalls).toHaveLength(2);
    const exposedToolNames = modelCalls[0].body.tools.map((tool) => tool.function.name);
    expect(exposedToolNames).not.toContain("write_file");
    expect(exposedToolNames).toContain("read_file");
  });

  it("runs a non-streaming tool loop and feeds the real tool result into the final model turn", async () => {
    server = await startTestServer();
    const modelCalls = mockModelFetch([
      jsonModelResponse({
        message: {
          role: "assistant",
          content: null,
          tool_calls: [toolCall("write_file", { path: "notes/todo.md", content: "hello from tool" })]
        },
        finish_reason: "tool_calls"
      }),
      ({ body }) => {
        const toolMessage = body.messages.find((message) => message.role === "tool");
        expect(toolMessage?.name).toBe("write_file");
        expect(toolMessage?.content).toContain('"ok": true');
        expect(toolMessage?.content).toContain('"path": "notes/todo.md"');
        return jsonModelResponse({
          message: { role: "assistant", content: "已写入 notes/todo.md。" },
          finish_reason: "stop"
        });
      }
    ]);

    const response = await postJson("/api/chat", {
      provider,
      model: "agent-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: true },
      messages: [{ role: "user", content: "写入 notes/todo.md" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.content).toBe("已写入 notes/todo.md。");
    expect(response.body.steps[0]).toMatchObject({
      name: "write_file",
      args: { path: "notes/todo.md", content: "hello from tool" },
      result: { ok: true, path: "notes/todo.md", verified: true },
      receipt: { ok: true, status: "succeeded", verified: true },
      verification: { required: true, ok: true }
    });
    expect(response.body.steps[0].verification.artifacts[0]).toMatchObject({
      path: "notes/todo.md",
      exists: true,
      ok: true,
      size: 15
    });
    expect(await readFile(path.join(workspaceRoot, "notes", "todo.md"), "utf8")).toBe("hello from tool");

    expect(modelCalls).toHaveLength(2);
    expect(modelCalls[0].body.tools.map((tool) => tool.function.name)).toContain("write_file");
    expect(modelCalls[1].body.messages.some((message) => message.role === "tool")).toBe(true);
  });

  it("adds a self-recovery prompt after a failed tool so the model can try another route", async () => {
    server = await startTestServer();
    const modelCalls = mockModelFetch([
      jsonModelResponse({
        message: {
          role: "assistant",
          content: null,
          tool_calls: [toolCall("read_file", { path: "missing.txt" }, "call_missing")]
        },
        finish_reason: "tool_calls"
      }),
      ({ body }) => {
        const recoveryMessage = body.messages.find((message) => message.role === "user" && String(message.content || "").includes("自恢复执行"));
        expect(recoveryMessage?.content).toContain("read_file");
        expect(recoveryMessage?.content).toContain("避免重复");
        expect(recoveryMessage?.content).toContain("可行替代路径");
        return jsonModelResponse({
          message: {
            role: "assistant",
            content: null,
            tool_calls: [toolCall("write_file", { path: "notes/recovered.md", content: "recovered through another route" }, "call_recover")]
          },
          finish_reason: "tool_calls"
        });
      },
      ({ body }) => {
        const toolMessages = body.messages.filter((message) => message.role === "tool");
        expect(toolMessages[0]?.content).toContain('"ok": false');
        expect(toolMessages[1]?.content).toContain('"ok": true');
        return jsonModelResponse({
          message: { role: "assistant", content: "第一次读取失败后，我换成写入方案完成了。" },
          finish_reason: "stop"
        });
      }
    ]);

    const response = await postJson("/api/chat", {
      provider,
      model: "agent-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: true },
      messages: [{ role: "user", content: "如果文件不存在就换个办法完成" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.content).toContain("换成写入方案");
    expect(response.body.steps).toHaveLength(2);
    expect(response.body.steps[0]).toMatchObject({
      name: "read_file",
      result: { ok: false }
    });
    expect(response.body.steps[1]).toMatchObject({
      name: "write_file",
      result: { ok: true, path: "notes/recovered.md", verified: true },
      receipt: { ok: true, verified: true }
    });
    expect(await readFile(path.join(workspaceRoot, "notes", "recovered.md"), "utf8")).toBe("recovered through another route");
    expect(modelCalls).toHaveLength(3);
  });

  it("streams tool start, tool end, delta, and done events across the full agent loop", async () => {
    server = await startTestServer();
    const modelCalls = mockModelFetch([
      sseModelResponse([
        openAIChunk({ delta: { tool_calls: [{ index: 0, id: "call_sse", type: "function", function: { name: "write_file", arguments: "{\"path\":\"notes/sse.md\"," } }] } }),
        openAIChunk({ delta: { tool_calls: [{ index: 0, function: { arguments: "\"content\":\"hello from sse\"}" } }] } }),
        openAIChunk({ delta: {}, finish_reason: "tool_calls" }),
        "data: [DONE]\n\n"
      ]),
      ({ body }) => {
        const toolMessage = body.messages.find((message) => message.role === "tool");
        expect(toolMessage?.content).toContain('"path": "notes/sse.md"');
        return sseModelResponse([
          openAIChunk({ delta: { content: "写好了 " } }),
          openAIChunk({ delta: { content: "notes/sse.md" } }),
          openAIChunk({ delta: {}, finish_reason: "stop" }),
          "data: [DONE]\n\n"
        ]);
      }
    ]);

    const response = await postText("/api/chat", {
      provider,
      model: "agent-test",
      stream: true,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: true },
      messages: [{ role: "user", content: "流式写文件" }]
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    const events = parseSseEvents(response.body);
    expect(events.map((event) => event.type)).toEqual(["tool_start", "tool_end", "delta", "delta", "done"]);
    expect(events[0]).toMatchObject({ type: "tool_start", name: "write_file", args: { path: "notes/sse.md" } });
    expect(events[1]).toMatchObject({ type: "tool_end", name: "write_file", result: { ok: true, path: "notes/sse.md" } });
    expect(events[2]).toMatchObject({ type: "delta", text: "写好了 " });
    expect(events[4]).toMatchObject({
      type: "done",
      content: "写好了 notes/sse.md",
      steps: [{ name: "write_file", result: { ok: true, path: "notes/sse.md" } }]
    });
    expect(await readFile(path.join(workspaceRoot, "notes", "sse.md"), "utf8")).toBe("hello from sse");

    expect(modelCalls).toHaveLength(2);
    expect(modelCalls.every((call) => call.url === "https://model.test/v1/chat/completions")).toBe(true);
  });

  it("stops the streamed tool loop after repeated missing tool arguments", async () => {
    server = await startTestServer();
    const modelCalls = mockModelFetch([
      sseModelResponse([
        openAIChunk({ delta: { tool_calls: [{ index: 0, id: "call_empty_1", type: "function", function: { name: "write_file", arguments: "{}" } }] } }),
        openAIChunk({ delta: {}, finish_reason: "tool_calls" }),
        "data: [DONE]\n\n"
      ]),
      sseModelResponse([
        openAIChunk({ delta: { tool_calls: [{ index: 0, id: "call_empty_2", type: "function", function: { name: "write_file", arguments: "{}" } }] } }),
        openAIChunk({ delta: {}, finish_reason: "tool_calls" }),
        "data: [DONE]\n\n"
      ])
    ]);

    const response = await postText("/api/chat", {
      provider,
      model: "agent-test",
      stream: true,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: true },
      messages: [{ role: "user", content: "写一个文件" }]
    });

    expect(response.status).toBe(200);
    expect(modelCalls).toHaveLength(2);
    const events = parseSseEvents(response.body);
    expect(events.map((event) => event.type)).toContain("tool_arg_fuse");
    const done = events.find((event) => event.type === "done");
    expect(done.toolArgFuse).toMatchObject({ toolName: "write_file", count: 2 });
    expect(done.content).toContain("没有传入必要工具参数");
  });

  it("reports max_tokens truncation instead of executing an incomplete streamed tool call", async () => {
    server = await startTestServer();
    const modelCalls = mockModelFetch([
      sseModelResponse([
        openAIChunk({ delta: { tool_calls: [{ index: 0, id: "call_trunc", type: "function", function: { name: "write_file", arguments: "{\"path\":\"notes/trunc.md\",\"content\":\"hel" } }] } }),
        openAIChunk({ delta: {}, finish_reason: "length" }),
        "data: [DONE]\n\n"
      ])
    ]);

    const response = await postText("/api/chat", {
      provider,
      model: "agent-test",
      stream: true,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: true },
      messages: [{ role: "user", content: "写一个很长的文件" }]
    });

    expect(response.status).toBe(200);
    expect(modelCalls).toHaveLength(1);
    const events = parseSseEvents(response.body);
    expect(events.map((event) => event.type)).toEqual(["max_tokens_truncated", "done"]);
    expect(events[0]).toMatchObject({ type: "max_tokens_truncated", finishReason: "length", toolNames: ["write_file"] });
    const done = events.find((event) => event.type === "done");
    expect(done.maxTokensTruncated).toBe(true);
    expect(done.content).toContain("max_tokens 截断");
    expect(done.content).toContain("调大 maxTokens");
    expect(done.content).not.toContain("没有传入必要工具参数");
    expect(done.steps).toEqual([]);
    expect(await exists(path.join(workspaceRoot, "notes", "trunc.md"))).toBe(false);
  });

  it("reports max_tokens truncation for non-streaming tool calls without executing them", async () => {
    server = await startTestServer();
    const modelCalls = mockModelFetch([
      jsonModelResponse({
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call_cut", type: "function", function: { name: "write_file", arguments: "{\"path\":\"notes/cut.md\",\"content\":\"hel" } }]
        },
        finish_reason: "length"
      })
    ]);

    const response = await postJson("/api/chat", {
      provider,
      model: "agent-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: true },
      messages: [{ role: "user", content: "写一个很长的文件" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.maxTokensTruncated).toBe(true);
    expect(response.body.content).toContain("max_tokens 截断");
    expect(response.body.content).toContain("调大 maxTokens");
    expect(response.body.steps).toEqual([]);
    expect(modelCalls).toHaveLength(1);
    expect(await exists(path.join(workspaceRoot, "notes", "cut.md"))).toBe(false);
  });

  it("distinguishes repeated argument JSON parse failures from missing arguments in the fuse message", async () => {
    server = await startTestServer();
    const truncatedArgs = "{\"path\":\"notes/bad.md\",\"content\":\"hel";
    const brokenToolCallRound = (id) => sseModelResponse([
      openAIChunk({ delta: { tool_calls: [{ index: 0, id, type: "function", function: { name: "write_file", arguments: truncatedArgs } }] } }),
      openAIChunk({ delta: {}, finish_reason: "tool_calls" }),
      "data: [DONE]\n\n"
    ]);
    const modelCalls = mockModelFetch([
      brokenToolCallRound("call_bad_1"),
      brokenToolCallRound("call_bad_2")
    ]);

    const response = await postText("/api/chat", {
      provider,
      model: "agent-test",
      stream: true,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: true },
      messages: [{ role: "user", content: "写一个文件" }]
    });

    expect(response.status).toBe(200);
    expect(modelCalls).toHaveLength(2);
    const events = parseSseEvents(response.body);
    expect(events.map((event) => event.type)).toContain("tool_arg_fuse");
    const done = events.find((event) => event.type === "done");
    expect(done.toolArgFuse).toMatchObject({ toolName: "write_file", count: 2, parseError: true });
    expect(done.content).toContain("参数 JSON 解析失败");
    expect(done.content).toContain("max_tokens");
    expect(done.content).not.toContain("没有传入必要工具参数");
    expect(done.steps[0]).toMatchObject({
      name: "write_file",
      result: { ok: false, toolArgError: true, argParseError: true }
    });
    expect(await exists(path.join(workspaceRoot, "notes", "bad.md"))).toBe(false);
  });

  it("blocks model-emitted DSML pseudo tool calls instead of reporting fake completion", async () => {
    server = await startTestServer();
    const modelCalls = mockModelFetch([
      jsonModelResponse({
        message: {
          role: "assistant",
          content: [
            "我现在直接完成：",
            "< | | DSML | | tool_calls>",
            "< | | DSML | | invoke name=\"run_local_command\">",
            "< | | DSML | | parameter name=\"command\" string=\"true\">touch fake-created.txt</ | | DSML | | parameter>",
            "</ | | DSML | | invoke>",
            "</ | | DSML | | tool_calls>",
            "已创建 fake-created.txt。"
          ].join("\n")
        },
        finish_reason: "stop"
      })
    ]);

    const response = await postJson("/api/chat", {
      provider,
      model: "agent-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-command"],
      toolConsent: { command: true },
      messages: [{ role: "user", content: "创建一个文件" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.pseudoToolBlocked).toBe(true);
    expect(response.body.pseudoToolNames).toContain("run_local_command");
    expect(response.body.content).toContain("拦截到模型把工具调用");
    expect(response.body.content).toContain("没有创建文件");
    expect(response.body.content).not.toContain("DSML");
    expect(response.body.steps).toEqual([]);
    expect(await exists(path.join(workspaceRoot, "fake-created.txt"))).toBe(false);
    expect(modelCalls).toHaveLength(1);
  });

  it("blocks bare invoke pseudo tool text without standard tool_calls", async () => {
    server = await startTestServer();
    mockModelFetch([
      jsonModelResponse({
        message: {
          role: "assistant",
          content: [
            "好的，我先看看当前工作区里有什么。",
            "",
            "<invoke name=\"list_files\">",
            "",
            "我已经读取了目录。"
          ].join("\n")
        },
        finish_reason: "stop"
      })
    ]);

    const response = await postJson("/api/chat", {
      provider,
      model: "agent-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true },
      messages: [{ role: "user", content: "看看工作区" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.pseudoToolBlocked).toBe(true);
    expect(response.body.pseudoToolNames).toContain("list_files");
    expect(response.body.content).toContain("拦截到模型把工具调用");
    expect(response.body.content).not.toContain("<invoke");
    expect(response.body.steps).toEqual([]);
  });

  it("blocks a file completion claim when the model never called a real tool", async () => {
    server = await startTestServer();
    mockModelFetch([
      jsonModelResponse({
        message: { role: "assistant", content: "已导出 Word 文档：exports/today.docx。" },
        finish_reason: "stop"
      })
    ]);

    const response = await postJson("/api/chat", {
      provider,
      model: "agent-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: true },
      messages: [{ role: "user", content: "导出今天的对话" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.unverifiedCompletionBlocked).toBe(true);
    expect(response.body.completionClaim).toMatchObject({ kind: "file" });
    expect(response.body.content).toContain("没有检测到本轮真实文件保存/导出/创建回执");
    expect(response.body.content).not.toContain("exports/today.docx");
    expect(response.body.steps).toEqual([]);
    expect(await exists(path.join(workspaceRoot, "exports", "today.docx"))).toBe(false);
  });

  it("blocks a fake success summary after a real tool failure", async () => {
    server = await startTestServer();
    mockModelFetch([
      jsonModelResponse({
        message: {
          role: "assistant",
          content: null,
          tool_calls: [toolCall("write_file", { path: "notes/denied.md", content: "no permission" })]
        },
        finish_reason: "tool_calls"
      }),
      ({ body }) => {
        const toolMessage = body.messages.find((message) => message.role === "tool");
        expect(toolMessage?.content).toContain("工具未启用");
        return jsonModelResponse({
          message: { role: "assistant", content: "已保存文件：notes/denied.md。" },
          finish_reason: "stop"
        });
      }
    ]);

    const response = await postJson("/api/chat", {
      provider,
      model: "agent-test",
      stream: false,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: false },
      messages: [{ role: "user", content: "保存文件" }]
    });

    expect(response.status).toBe(200);
    expect(response.body.unverifiedCompletionBlocked).toBe(true);
    expect(response.body.steps).toHaveLength(1);
    expect(response.body.steps[0]).toMatchObject({
      name: "write_file",
      result: { ok: false },
      receipt: { ok: false, status: "failed" }
    });
    expect(await exists(path.join(workspaceRoot, "notes", "denied.md"))).toBe(false);
  });

  it("marks streamed DSML pseudo tool calls as blocked in the final event", async () => {
    server = await startTestServer();
    mockModelFetch([
      sseModelResponse([
        openAIChunk({ delta: { content: "好的，我来处理。\n< | | DSML | | tool_calls>\n" } }),
        openAIChunk({ delta: { content: "< | | DSML | | invoke name=\"run_local_command\">" } }),
        openAIChunk({ delta: { content: "< | | DSML | | parameter name=\"command\" string=\"true\">touch fake-stream.txt</ | | DSML | | parameter>" } }),
        openAIChunk({ delta: { content: "</ | | DSML | | invoke>\n</ | | DSML | | tool_calls>\n已创建 fake-stream.txt。" } }),
        openAIChunk({ delta: {}, finish_reason: "stop" }),
        "data: [DONE]\n\n"
      ])
    ]);

    const response = await postText("/api/chat", {
      provider,
      model: "agent-test",
      stream: true,
      enableTools: true,
      enabledSkills: ["local-command"],
      toolConsent: { command: true },
      messages: [{ role: "user", content: "创建一个文件" }]
    });

    expect(response.status).toBe(200);
    const events = parseSseEvents(response.body);
    expect(events.map((event) => event.type)).toContain("pseudo_tool_blocked");
    const done = events.find((event) => event.type === "done");
    expect(done).toMatchObject({ pseudoToolBlocked: true });
    expect(done.content).toContain("没有创建文件");
    expect(done.content).not.toContain("DSML");
    expect(done.pseudoToolNames).toContain("run_local_command");
    expect(await exists(path.join(workspaceRoot, "fake-stream.txt"))).toBe(false);
  });

  it("marks streamed bare invoke pseudo tool text as blocked", async () => {
    server = await startTestServer();
    mockModelFetch([
      sseModelResponse([
        openAIChunk({ delta: { content: "先看表格结构：\n" } }),
        openAIChunk({ delta: { content: "<invoke name=\"read_excel_file\">" } }),
        openAIChunk({ delta: { content: "\n我已经读取了表格。" } }),
        openAIChunk({ delta: {}, finish_reason: "stop" }),
        "data: [DONE]\n\n"
      ])
    ]);

    const response = await postText("/api/chat", {
      provider,
      model: "agent-test",
      stream: true,
      enableTools: true,
      enabledSkills: ["spreadsheet-pro"],
      toolConsent: { fileRead: true },
      messages: [{ role: "user", content: "读取表格" }]
    });

    expect(response.status).toBe(200);
    const events = parseSseEvents(response.body);
    expect(events.map((event) => event.type)).toContain("pseudo_tool_blocked");
    const done = events.find((event) => event.type === "done");
    expect(done).toMatchObject({ pseudoToolBlocked: true });
    expect(done.content).toContain("没有创建文件");
    expect(done.content).not.toContain("<invoke");
    expect(done.pseudoToolNames).toContain("read_excel_file");
  });

  it("marks streamed file completion claims without tool receipts as unverified", async () => {
    server = await startTestServer();
    mockModelFetch([
      sseModelResponse([
        openAIChunk({ delta: { content: "已导出 Word 文档：" } }),
        openAIChunk({ delta: { content: "exports/stream.docx。" } }),
        openAIChunk({ delta: {}, finish_reason: "stop" }),
        "data: [DONE]\n\n"
      ])
    ]);

    const response = await postText("/api/chat", {
      provider,
      model: "agent-test",
      stream: true,
      enableTools: true,
      enabledSkills: ["local-files"],
      toolConsent: { fileRead: true, fileWrite: true },
      messages: [{ role: "user", content: "导出 Word" }]
    });

    expect(response.status).toBe(200);
    const events = parseSseEvents(response.body);
    expect(events.map((event) => event.type)).toContain("unverified_completion_blocked");
    const done = events.find((event) => event.type === "done");
    expect(done).toMatchObject({ unverifiedCompletionBlocked: true });
    expect(done.content).toContain("没有检测到本轮真实文件保存/导出/创建回执");
    expect(done.content).not.toContain("exports/stream.docx");
    expect(await exists(path.join(workspaceRoot, "exports", "stream.docx"))).toBe(false);
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
  return requestLocal("POST", pathname, body, true);
}

function postText(pathname, body) {
  return requestLocal("POST", pathname, body, false);
}

function requestLocal(method, pathname, body, parseJson) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = httpRequest({
      hostname: "127.0.0.1",
      port: serverPort(),
      path: pathname,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parseJson && text ? JSON.parse(text) : text
        });
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

function jsonModelResponse({ message, finish_reason = "stop", usage = { prompt_tokens: 1, completion_tokens: 1 } }) {
  return new Response(JSON.stringify({
    choices: [{ index: 0, finish_reason, message }],
    usage
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function sseModelResponse(chunks) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  }), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
}

function openAIChunk(choice) {
  return `data: ${JSON.stringify({ choices: [{ index: 0, ...choice }] })}\n\n`;
}

function toolCall(name, args, id = `call_${name}`) {
  return {
    id,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(args)
    }
  };
}

function parseSseEvents(text) {
  return String(text)
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => block.startsWith("data:"))
    .map((block) => JSON.parse(block.slice(5).trim()));
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
