import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DaemonConfigStore, type MutableDaemonConfigPatch } from "../../daemon-config-store";
import { loadPersistedConfig } from "../../persisted-config";
import { createSkillSelectionStore } from "./selection-store";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createStore() {
  const root = await mkdtemp(path.join(os.tmpdir(), "paseo-agent-skills-config-"));
  roots.push(root);
  const config = new DaemonConfigStore(root, {
    mcp: { injectIntoAgents: false },
    browserTools: { enabled: false },
    providers: {},
    metadataGeneration: { providers: [] },
    autoArchiveAfterMerge: false,
    enableTerminalAgentHooks: false,
    appendSystemPrompt: "",
  });
  return { config, root, store: createSkillSelectionStore(config) };
}

describe("daemon agent skill selection", () => {
  it("defaults missing selection to all without persisting it", async () => {
    const { root, store } = await createStore();
    expect(await store.get()).toEqual({ mode: "all" });
    expect(await store.isSet()).toBe(false);
    expect(loadPersistedConfig(root).agents?.skills).toBeUndefined();
  });

  it("persists a normalized custom selection under agents.skills.selection", async () => {
    const { root, store } = await createStore();
    await store.set({ mode: "custom", skills: ["paseo-loop", "paseo-alpha", "paseo-alpha"] });
    expect(loadPersistedConfig(root).agents?.skills?.selection).toEqual({
      mode: "custom",
      skills: ["paseo-alpha", "paseo-loop"],
    });
  });

  it("reads a selection saved with the old paseo skill names as the renamed kumo-agent ones", async () => {
    const { store } = await createStore();
    await store.set({ mode: "custom", skills: ["paseo", "paseo-advisor", "kumo-agent"] });
    expect(await store.get()).toEqual({
      mode: "custom",
      skills: ["kumo-agent", "kumo-agent-advisor"],
    });
  });

  it("replaces a custom selection with all without retaining custom skill names", async () => {
    const { config, root, store } = await createStore();
    await store.set({ mode: "custom", skills: ["paseo-alpha"] });

    await store.set({ mode: "all" });

    expect(config.get().skills?.selection).toEqual({ mode: "all" });
    expect(loadPersistedConfig(root).agents?.skills?.selection).toEqual({ mode: "all" });
  });

  it("does not expose selection through the generic config patch path", async () => {
    const { config, root, store } = await createStore();

    await config.patch({
      skills: { selection: { mode: "custom", skills: ["paseo-alpha"] } },
    } as MutableDaemonConfigPatch);

    expect(await store.isSet()).toBe(false);
    expect(loadPersistedConfig(root).agents?.skills).toBeUndefined();
  });
});
