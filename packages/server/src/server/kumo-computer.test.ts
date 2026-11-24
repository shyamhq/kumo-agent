import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createTestLogger } from "../test-utils/test-logger.js";
import { addKumoWorkspace, readKumoComputer } from "./kumo-computer.js";
import {
  createWorkspaceProvisioningService,
  type WorkspaceProvisioningService,
} from "./session/workspace-provisioning/workspace-provisioning-service.js";
import { createNoopWorkspaceGitService } from "./test-utils/workspace-git-service-stub.js";
import { FileBackedProjectRegistry, FileBackedWorkspaceRegistry } from "./workspace-registry.js";

describe("readKumoComputer", () => {
  test.each([
    [
      "https://6868--kumox-sg-rustic-jackal.staging.mykumo.xyz",
      { handle: "kumox-sg-rustic-jackal", host: "kumox-sg-rustic-jackal.staging.mykumo.xyz" },
    ],
    [
      "https://6868--deep-badger.mykumo.xyz/",
      { handle: "deep-badger", host: "deep-badger.mykumo.xyz" },
    ],
  ])("reads the computer from %s", (publicUrl, computer) => {
    expect(readKumoComputer(publicUrl)).toEqual(computer);
  });

  test.each([undefined, "", "http://6868--deep-badger.mykumo.xyz", "https://example.com"])(
    "is null off Kumo (%s)",
    (publicUrl) => {
      expect(readKumoComputer(publicUrl)).toBeNull();
    },
  );
});

// Adding ~/workspace to an empty daemon is covered end to end in bootstrap-kumo.test.ts.
describe("addKumoWorkspace", () => {
  let home: string;
  let projectRegistry: FileBackedProjectRegistry;
  let workspaceProvisioning: WorkspaceProvisioningService;

  beforeEach(async () => {
    home = await mkdtemp(path.join(os.tmpdir(), "kumo-workspace-"));
    await mkdir(path.join(home, "workspace"));
    const logger = createTestLogger();
    projectRegistry = new FileBackedProjectRegistry(path.join(home, "projects.json"), logger);
    const workspaceRegistry = new FileBackedWorkspaceRegistry(
      path.join(home, "workspaces.json"),
      logger,
    );
    await projectRegistry.initialize();
    await workspaceRegistry.initialize();
    workspaceProvisioning = createWorkspaceProvisioningService({
      unarchiveWorkspaceAgents: async () => {},
      projectRegistry,
      workspaceRegistry,
      workspaceGitService: createNoopWorkspaceGitService(),
      isDirectory: async () => true,
      logger,
    });
  });
  afterEach(() => rm(home, { recursive: true, force: true }));

  async function rootPathsAfterAdding(dir: string): Promise<string[]> {
    await addKumoWorkspace({ dir, projectRegistry, workspaceProvisioning });
    return (await projectRegistry.list()).map((project) => project.rootPath);
  }

  test("leaves the projects alone when there are any", async () => {
    await workspaceProvisioning.findOrCreateProjectForDirectory(home);
    expect(await rootPathsAfterAdding(path.join(home, "workspace"))).toEqual([home]);
  });

  test("adds nothing when ~/workspace is missing", async () => {
    expect(await rootPathsAfterAdding(path.join(home, "missing"))).toEqual([]);
  });
});
