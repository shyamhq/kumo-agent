import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";

import type { AgentPromptInput } from "../agent/agent-sdk-types.js";
import { parseAgentMessages } from "../agent/agent-messages/index.js";
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
  const clients: DaemonClient[] = [];
  const start = () =>
    createTestPaseoDaemon({
      agentClients: createTestAgentClients({
        onStartTurn: (prompt: AgentPromptInput) => {
          const text = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
          if (text.includes("refuse this")) throw new Error("provider refused the turn");
          prompts.push(text);
        },
      }),
      paseoHomeRoot: path.join(root, "daemon"),
      staticDir: path.join(root, "static"),
      cleanup: false,
    });
  let daemon = await start();
  async function connect(headers: Record<string, string> = {}, clientId?: string) {
    const client = new DaemonClient({ url: `ws://127.0.0.1:${daemon.port}/ws`, headers, clientId });
    clients.push(client);
    await client.connect();
    await client.fetchAgents({ subscribe: {} });
    return client;
  }
  /** Stops the daemon and starts another on the same home, as an update does. */
  async function restart() {
    await Promise.all(clients.splice(0).map((client) => client.close()));
    await daemon.close();
    daemon = await start();
  }
  async function close() {
    await Promise.all(clients.map((client) => client.close()));
    await daemon.close();
    await rm(root, { recursive: true, force: true });
  }
  return { root, prompts, connect, restart, close };
}

/** Alice and Bob have each written in a fresh chat, so it is shared. */
async function sharedAgent(daemon: Awaited<ReturnType<typeof sharedChatDaemon>>) {
  const alice = await daemon.connect(gate("u_alice", "Alice"));
  const bob = await daemon.connect(gate("u_bob", "Bob"));
  const agent = await alice.createAgent({ provider: "claude", cwd: daemon.root });
  await alice.sendMessage(agent.id, "hello");
  await alice.waitForFinish(agent.id, 10_000);
  await bob.sendMessage(agent.id, "hi");
  await bob.waitForFinish(agent.id, 10_000);
  return { alice, bob, agent };
}

async function peopleSaid(client: DaemonClient, agentId: string) {
  const timeline = await client.fetchAgentTimeline(agentId, { direction: "tail", limit: 50 });
  return timeline.entries.flatMap((entry) =>
    entry.item.type === "user_message" ? [`${entry.item.author?.name}: ${entry.item.text}`] : [],
  );
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
    await alice.sendMessage(agent.id, "@kumo both of us now");
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
      ["@kumo both of us now", { id: "u_alice", name: "Alice Ng" }],
    ]);
  } finally {
    await close();
  }
});

test("a command in a shared chat still reaches the provider as a command", async () => {
  const daemon = await sharedChatDaemon();
  try {
    const { bob, agent } = await sharedAgent(daemon);

    await bob.sendMessage(agent.id, "/help");
    await bob.waitForFinish(agent.id, 10_000);

    expect(daemon.prompts.at(-1)).toBe("/help");
  } finally {
    await daemon.close();
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

test("a post reaches everyone, starts no turn, and rides the next @kumo ahead of it", async () => {
  const daemon = await sharedChatDaemon();
  try {
    const { alice, bob, agent } = await sharedAgent(daemon);
    const turns = daemon.prompts.length;

    await alice.sendMessage(agent.id, "build fails on node 24");
    expect(await peopleSaid(bob, agent.id)).toContain("Alice: build fails on node 24");
    expect(daemon.prompts).toHaveLength(turns);

    await bob.sendMessage(agent.id, "@kumo why?");
    await bob.waitForFinish(agent.id, 10_000);
    const carried = parseAgentMessages(daemon.prompts.at(-1) ?? "");
    expect(carried?.map((message) => [message.source, message.text])).toEqual([
      [{ kind: "person-post", author: { id: "u_alice", name: "Alice" } }, "build fails on node 24"],
      [{ kind: "person-message", author: { id: "u_bob", name: "Bob" } }, "@kumo why?"],
    ]);
    expect(await peopleSaid(alice, agent.id)).toEqual([
      "undefined: hello",
      "Bob: hi",
      "Alice: build fails on node 24",
      "Bob: @kumo why?",
    ]);

    await bob.sendMessage(agent.id, "@kumo and now?");
    await bob.waitForFinish(agent.id, 10_000);
    expect(parseAgentMessages(daemon.prompts.at(-1) ?? "")).toHaveLength(1);
  } finally {
    await daemon.close();
  }
});

test("a post the agent has not seen survives a daemon restart", async () => {
  const daemon = await sharedChatDaemon();
  try {
    const { alice, agent } = await sharedAgent(daemon);
    await alice.sendMessage(agent.id, "remember the flaky test");
    await daemon.restart();

    const bob = await daemon.connect(gate("u_bob", "Bob"));
    expect(await peopleSaid(bob, agent.id)).toContain("Alice: remember the flaky test");
    await bob.sendMessage(agent.id, "@kumo fix it");
    await bob.waitForFinish(agent.id, 10_000);
    expect(daemon.prompts.at(-1)).toContain("remember the flaky test");
  } finally {
    await daemon.close();
  }
});

test("a post with a file is refused, since only the agent can take it", async () => {
  const daemon = await sharedChatDaemon();
  try {
    const { alice, agent } = await sharedAgent(daemon);
    const turns = daemon.prompts.length;

    await expect(
      alice.sendMessage(agent.id, "look at this", {
        images: [{ data: "aGk=", mimeType: "image/png" }],
      }),
    ).rejects.toThrow("Add @kumo to send files to the agent.");
    expect(daemon.prompts).toHaveLength(turns);
  } finally {
    await daemon.close();
  }
});

test("a post stays for the next @kumo when the provider refuses the turn that carried it", async () => {
  const daemon = await sharedChatDaemon();
  try {
    const { alice, bob, agent } = await sharedAgent(daemon);
    await alice.sendMessage(agent.id, "the deploy key expired");

    await expect(bob.sendMessage(agent.id, "@kumo refuse this")).rejects.toThrow(
      "provider refused the turn",
    );
    await bob.sendMessage(agent.id, "@kumo try again");
    await bob.waitForFinish(agent.id, 10_000);

    expect(parseAgentMessages(daemon.prompts.at(-1) ?? "")?.map((message) => message.text)).toEqual(
      ["the deploy key expired", "@kumo try again"],
    );
  } finally {
    await daemon.close();
  }
});

test("whoever creates a chat with a prompt is its first writer", async () => {
  const daemon = await sharedChatDaemon();
  try {
    const alice = await daemon.connect(gate("u_alice", "Alice"));
    const bob = await daemon.connect(gate("u_bob", "Bob"));
    const agent = await alice.createAgent({
      provider: "claude",
      cwd: daemon.root,
      initialPrompt: "set it up",
    });
    await alice.waitForFinish(agent.id, 10_000);

    await bob.sendMessage(agent.id, "hi");
    await bob.waitForFinish(agent.id, 10_000);

    expect(daemon.prompts.at(-1)).toContain('kind="person-message" author-id="u_bob"');
  } finally {
    await daemon.close();
  }
});

test("two people on one browser profile stay two people", async () => {
  const daemon = await sharedChatDaemon();
  try {
    const alice = await daemon.connect(gate("u_alice", "Alice"), "clid_shared_profile");
    const agent = await alice.createAgent({ provider: "claude", cwd: daemon.root });
    await alice.sendMessage(agent.id, "hello");
    await alice.waitForFinish(agent.id, 10_000);

    const bob = await daemon.connect(gate("u_bob", "Bob"), "clid_shared_profile");
    await bob.sendMessage(agent.id, "hi");
    await bob.waitForFinish(agent.id, 10_000);

    expect(daemon.prompts.at(-1)).toContain('author-id="u_bob" author-name="Bob"');
  } finally {
    await daemon.close();
  }
});
