import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";

import type { AgentPromptInput } from "../agent/agent-sdk-types.js";
import { createTestAgentClients } from "../test-utils/fake-agent-client.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";
import { DaemonClient } from "../test-utils/daemon-client.js";

/** What Kumo's gate sets for a signed-in person. */
const gate = (id: string, name: string) => ({ "x-kumo-user": id, "x-kumo-name": name });

async function sharedChatDaemon() {
  const artifacts = path.resolve(".artifacts");
  await mkdir(artifacts, { recursive: true });
  const root = await mkdtemp(path.join(artifacts, "shared-chat-"));
  const prompts: string[] = [];
  const daemon = await createTestPaseoDaemon({
    agentClients: createTestAgentClients({
      onStartTurn: (prompt: AgentPromptInput) =>
        prompts.push(typeof prompt === "string" ? prompt : JSON.stringify(prompt)),
    }),
    paseoHomeRoot: path.join(root, "daemon"),
    staticDir: path.join(root, "static"),
    cleanup: false,
  });
  const url = `ws://127.0.0.1:${daemon.port}/ws`;
  const clients: DaemonClient[] = [];
  async function connect(headers: Record<string, string> = {}) {
    const client = new DaemonClient({ url, headers });
    clients.push(client);
    await client.connect();
    await client.fetchAgents({ subscribe: {} });
    return client;
  }
  async function close() {
    await Promise.all(clients.map((client) => client.close()));
    await daemon.close();
    await rm(root, { recursive: true, force: true });
  }
  return { root, prompts, connect, close };
}

test("a chat turns shared at its second writer, and then names every writer to the agent", async () => {
  const { root, prompts, connect, close } = await sharedChatDaemon();
  try {
    const alice = await connect(gate("u_alice", "Alice%20Ng"));
    const bob = await connect(gate("u_bob", "Bob"));
    const agent = await alice.createAgent({ provider: "claude", cwd: root });

    await alice.sendMessage(agent.id, "Alone, so as always");
    await alice.waitForFinish(agent.id, 10_000);
    await bob.sendMessage(agent.id, "I join");
    await bob.waitForFinish(agent.id, 10_000);
    await alice.sendMessage(agent.id, "Both of us now");
    await alice.waitForFinish(agent.id, 10_000);

    expect(prompts[0]).toBe("Alone, so as always");
    expect(prompts[1]).toMatch(
      /^<paseo-system version="1" kind="person-message" author-id="u_bob" author-name="Bob" message-id="[^"]+">\nI join\n<\/paseo-system>$/,
    );
    expect(prompts[2]).toContain('author-id="u_alice" author-name="Alice Ng"');

    const timeline = await bob.fetchAgentTimeline(agent.id, { direction: "tail", limit: 50 });
    const said = timeline.entries.flatMap((entry) =>
      entry.item.type === "user_message" ? [[entry.item.text, entry.item.author] as const] : [],
    );
    expect(said).toEqual([
      ["Alone, so as always", undefined],
      ["I join", { id: "u_bob", name: "Bob" }],
      ["Both of us now", { id: "u_alice", name: "Alice Ng" }],
    ]);
  } finally {
    await close();
  }
});

test("a command in a shared chat still reaches the provider as a command", async () => {
  const { root, prompts, connect, close } = await sharedChatDaemon();
  try {
    const alice = await connect(gate("u_alice", "Alice"));
    const bob = await connect(gate("u_bob", "Bob"));
    const agent = await alice.createAgent({ provider: "claude", cwd: root });
    await alice.sendMessage(agent.id, "hello");
    await alice.waitForFinish(agent.id, 10_000);
    await bob.sendMessage(agent.id, "hi");
    await bob.waitForFinish(agent.id, 10_000);

    await bob.sendMessage(agent.id, "/help");
    await bob.waitForFinish(agent.id, 10_000);

    expect(prompts.at(-1)).toBe("/help");
  } finally {
    await close();
  }
});

test("a connection the gate names no one behaves as today", async () => {
  const { root, prompts, connect, close } = await sharedChatDaemon();
  try {
    const cli = await connect();
    const other = await connect();
    const agent = await cli.createAgent({ provider: "claude", cwd: root });
    await cli.sendMessage(agent.id, "one");
    await cli.waitForFinish(agent.id, 10_000);
    await other.sendMessage(agent.id, "two");
    await other.waitForFinish(agent.id, 10_000);

    expect(prompts).toEqual(["one", "two"]);
  } finally {
    await close();
  }
});
