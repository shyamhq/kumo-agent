import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginSessionOpenRequest } from "@getpaseo/plugin/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withKumo } from "./open.js";
import { THREAD_INSTRUCTIONS } from "./thread.js";

let home: string;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "kumo-open-"));
  await mkdir(join(home, ".kumo"));
  await writeFile(join(home, ".kumo", "computer.md"), "COMPUTER");
  await writeFile(
    join(home, ".kumo", "ai-credentials.json"),
    JSON.stringify({ ANTHROPIC_API_KEY: "kumo-key", OPENAI_API_KEY: "kumo-openai" }),
  );
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

function request(
  provider: string,
  overrides: Partial<PluginSessionOpenRequest> = {},
): PluginSessionOpenRequest {
  return {
    agentId: "agent-1",
    workspaceId: null,
    provider,
    cwd: "/work",
    reason: "create",
    purpose: "interactive",
    title: null,
    background: false,
    labels: {},
    metadata: {},
    tools: [],
    env: {},
    mcpServers: {},
    ...overrides,
  };
}

describe("withKumo", () => {
  it.each(["claude", "codex"])("gives stock %s the instructions and the keys", async (provider) => {
    expect(await withKumo(request(provider), home)).toEqual(
      request(provider, {
        appendSystemPrompt: ["COMPUTER", THREAD_INSTRUCTIONS],
        env: { ANTHROPIC_API_KEY: "kumo-key", OPENAI_API_KEY: "kumo-openai" },
      }),
    );
  });

  it("gives stock OpenCode the instructions but no keys", async () => {
    expect(await withKumo(request("opencode"), home)).toEqual(
      request("opencode", { appendSystemPrompt: ["COMPUTER", THREAD_INSTRUCTIONS] }),
    );
  });

  it.each(["pi", "claude-work"])("leaves %s alone", async (provider) => {
    expect(await withKumo(request(provider), home)).toBeUndefined();
  });

  it("keeps an earlier prompt and lets the agent's own env win", async () => {
    const opened = request("claude", {
      appendSystemPrompt: ["EARLIER"],
      env: { ANTHROPIC_API_KEY: "mine" },
    });

    expect(await withKumo(opened, home)).toEqual(
      request("claude", {
        appendSystemPrompt: ["EARLIER", "COMPUTER", THREAD_INSTRUCTIONS],
        env: { ANTHROPIC_API_KEY: "mine", OPENAI_API_KEY: "kumo-openai" },
      }),
    );
  });

  it("fails the open when the keys file is there but cannot be read", async () => {
    await rm(join(home, ".kumo", "ai-credentials.json"));
    await mkdir(join(home, ".kumo", "ai-credentials.json"));

    await expect(withKumo(request("claude"), home)).rejects.toThrow("EISDIR");
  });
});
