import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { afterEach, expect, test, vi } from "vitest";

import { createTestPaseoDaemon, type TestPaseoDaemon } from "./test-utils/paseo-daemon.js";

// Its own file: the host name is read once per process, so PUBLIC_URL must be set before any
// other daemon in this module asks for it.
let daemon: TestPaseoDaemon | null = null;
let workspace: string | null = null;

afterEach(async () => {
  await daemon?.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

test("a Kumo computer is named by its handle and opens with ~/workspace as a project", async () => {
  vi.stubEnv("PUBLIC_URL", "https://6868--kumox-sg-rustic-jackal.staging.mykumo.xyz");
  workspace = await mkdtemp(path.join(os.tmpdir(), "kumo-workspace-"));
  daemon = await createTestPaseoDaemon({ mcpEnabled: false, kumoWorkspace: workspace });

  const status = await fetch(`http://127.0.0.1:${daemon.port}/api/status`);
  expect(await status.json()).toMatchObject({ hostname: "kumox-sg-rustic-jackal" });

  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    clientId: "kumo-computer-test",
    clientType: "mobile",
  });
  try {
    await client.connect();
    expect(client.getLastServerInfoMessage()?.hostname).toBe("kumox-sg-rustic-jackal");
    const { projects } = await client.listProjects();
    expect(projects).toEqual([
      expect.objectContaining({ projectRootPath: workspace, projectKind: "non_git" }),
    ]);
  } finally {
    await client.close();
  }
});
