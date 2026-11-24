import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { addKumoWorkspace, readKumoComputer } from "./kumo-computer.js";

describe("readKumoComputer", () => {
  test.each([
    ["https://6868--kumox-sg-rustic-jackal.staging.mykumo.xyz", "kumox-sg-rustic-jackal"],
    ["https://6868--deep-badger.mykumo.xyz/", "deep-badger"],
  ])("reads the computer from %s", (publicUrl, handle) => {
    expect(readKumoComputer(publicUrl)).toEqual({
      handle,
      host: publicUrl.replace(/^https:\/\/\d+--/, "").replace(/\/$/, ""),
    });
  });

  test.each([undefined, "", "http://6868--deep-badger.mykumo.xyz", "https://example.com"])(
    "is null off Kumo (%s)",
    (publicUrl) => {
      expect(readKumoComputer(publicUrl)).toBeNull();
    },
  );
});

describe("addKumoWorkspace", () => {
  let dir: string;
  afterEach(() => rm(dir, { recursive: true, force: true }));

  async function run(projects: unknown[], workspace = dir) {
    const added: string[] = [];
    await addKumoWorkspace({
      dir: workspace,
      projectRegistry: { list: async () => projects as never },
      workspaceProvisioning: {
        findOrCreateProjectForDirectory: async (cwd) => {
          added.push(cwd);
          return {} as never;
        },
      },
    });
    return added;
  }

  test("adds the workspace when there are no projects, and only then", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "kumo-workspace-"));
    expect(await run([])).toEqual([dir]);
    expect(await run([{ projectId: "p" }])).toEqual([]);
    expect(await run([], path.join(dir, "missing"))).toEqual([]);
  });
});
