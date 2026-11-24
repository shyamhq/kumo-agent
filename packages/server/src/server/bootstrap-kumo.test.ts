import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { afterEach, expect, test, vi } from "vitest";

import { createTestPaseoDaemon, type TestPaseoDaemon } from "./test-utils/paseo-daemon.js";

// Its own file: the host name is read once per process, so PUBLIC_URL must be set before any
// other daemon in this module asks for it.
let daemon: TestPaseoDaemon | null = null;
let client: DaemonClient | null = null;
let home: string | null = null;

afterEach(async () => {
  await client?.close();
  await daemon?.close();
  if (home) await rm(home, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

async function connect(): Promise<DaemonClient> {
  // Real path: on macOS the temp dir is a symlink, and the daemon answers with resolved paths.
  home = await realpath(await mkdtemp(path.join(os.tmpdir(), "kumo-home-")));
  await mkdir(path.join(home, "workspace", "wework"), { recursive: true });
  vi.stubEnv("HOME", home);
  daemon = await createTestPaseoDaemon({ mcpEnabled: false });
  client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    clientId: "kumo-computer-test",
    clientType: "mobile",
  });
  await client.connect();
  return client;
}

async function blankDirectorySearch(connected: DaemonClient): Promise<string[]> {
  const { entries } = await connected.getDirectorySuggestions({
    query: "",
    includeDirectories: true,
    includeFiles: false,
  });
  return (entries ?? []).map((entry) => entry.path);
}

test("a Kumo computer is named by its handle and a blank directory search lists ~/workspace", async () => {
  vi.stubEnv("PUBLIC_URL", "https://6868--kumox-sg-rustic-jackal.staging.mykumo.xyz");
  const connected = await connect();

  const status = await fetch(`http://127.0.0.1:${daemon?.port}/api/status`);
  expect(await status.json()).toMatchObject({ hostname: "kumox-sg-rustic-jackal" });
  expect(connected.getLastServerInfoMessage()?.hostname).toBe("kumox-sg-rustic-jackal");
  expect(await blankDirectorySearch(connected)).toContain(
    path.join(home ?? "", "workspace", "wework"),
  );
});

test("off Kumo a blank directory search lists nothing", async () => {
  vi.stubEnv("PUBLIC_URL", "");
  expect(await blankDirectorySearch(await connect())).toEqual([]);
});
