import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, expect, test, vi } from "vitest";
import { createTestLogger } from "../../../../test-utils/test-logger.js";
import { ClaudeAgentClient } from "./agent.js";
import type { ClaudeQueryInput } from "./query.js";

// Answers every prompt at once, so each turn ends without a real Claude.
function answeringQuery(input: ClaudeQueryInput): Query {
  async function* events(): AsyncGenerator<SDKMessage> {
    if (typeof input.prompt === "string") throw new Error("Expected streaming input");
    for await (const _prompt of input.prompt) {
      yield { type: "system", subtype: "init", session_id: "mcp-session" } as SDKMessage;
      yield { type: "assistant", message: { content: "ok" } } as SDKMessage;
      yield {
        type: "result",
        subtype: "success",
        usage: { input_tokens: 1, cache_read_input_tokens: 0, output_tokens: 1 },
        total_cost_usd: 0,
      } as SDKMessage;
    }
  }
  const output = events();
  return Object.assign(output, {
    close: () => void output.return(undefined),
    interrupt: async () => {},
    setPermissionMode: async () => {},
    setModel: async () => {},
    applyFlagSettings: async () => {},
    supportedCommands: async () => [],
  }) as unknown as Query;
}

afterEach(() => vi.unstubAllEnvs());

test("a changed user MCP server restarts Claude on the next turn, resuming the session", async () => {
  const configDir = mkdtempSync(path.join(tmpdir(), "claude-config-"));
  const writeServers = (url: string) =>
    writeFileSync(
      path.join(configDir, ".claude.json"),
      JSON.stringify({ numStartups: 3, mcpServers: { kumo: { type: "http", url } } }),
    );
  writeServers("http://127.0.0.1:41000/mcp");
  vi.stubEnv("CLAUDE_CONFIG_DIR", configDir);

  const resumes: (string | undefined)[] = [];
  const client = new ClaudeAgentClient({
    logger: createTestLogger(),
    resolveBinary: async () => "/test/claude",
    queryFactory: (input) => {
      resumes.push(input.options.resume);
      return answeringQuery(input);
    },
  });
  const session = await client.createSession({ provider: "claude", cwd: process.cwd() });
  const turn = async (text: string) => {
    const done = new Promise<void>((resolve) =>
      session.subscribe((event) => {
        if (event.type === "turn_completed") resolve();
      }),
    );
    await session.startTurn(text);
    await done;
  };

  try {
    await turn("first");
    // Claude rewrites the rest of the file constantly; only mcpServers counts.
    writeFileSync(
      path.join(configDir, ".claude.json"),
      JSON.stringify({
        numStartups: 4,
        mcpServers: { kumo: { type: "http", url: "http://127.0.0.1:41000/mcp" } },
      }),
    );
    await turn("same servers");
    expect(resumes).toHaveLength(1);

    writeServers("http://127.0.0.1:42000/mcp");
    await turn("after the worker restarted");
    expect(resumes).toHaveLength(2);
    expect(resumes[1]).toBe("mcp-session");
  } finally {
    await session.close();
  }
});
