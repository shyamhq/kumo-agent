import { describe, expect, it } from "vitest";
import { defaultHostAppearance } from "@/hosts/appearance";
import { defaultLifecycle, type HostProfile } from "@/types/host-connection";
import type { Computer } from "./plan";
import { type HostList, syncComputers } from "./sync";

/** The host list in memory. A new host appears a moment after it's asked for, as in the app. */
function memoryHostList(): HostList & { added: string[] } {
  let hosts: HostProfile[] = [];
  const added: string[] = [];
  return {
    added,
    getHosts: () => hosts,
    async removeHost(serverId) {
      hosts = hosts.filter((host) => host.serverId !== serverId);
    },
    async upsertDirectConnection(input) {
      added.push(input.serverId);
      await Promise.resolve();
      const host: HostProfile = {
        serverId: input.serverId,
        label: input.label ?? input.serverId,
        appearance: defaultHostAppearance(),
        lifecycle: defaultLifecycle(),
        connections: [
          {
            id: `direct:${input.endpoint}`,
            type: "directTcp",
            endpoint: input.endpoint,
            useTls: input.useTls ?? false,
          },
        ],
        preferredConnectionId: null,
        createdAt: "2026-11-25T00:00:00.000Z",
        updatedAt: "2026-11-25T00:00:00.000Z",
      };
      hosts = [...hosts, host];
      return host;
    },
  };
}

describe("syncComputers", () => {
  it("applies overlapping syncs one at a time, so a computer becomes one host", async () => {
    const list = memoryHostList();
    const computers: Computer[] = [{ id: "id-heron", handle: "noble-heron", status: "ready" }];

    await Promise.all([syncComputers(list, computers), syncComputers(list, computers)]);

    expect(list.added).toEqual(["kumo:noble-heron"]);
  });
});
