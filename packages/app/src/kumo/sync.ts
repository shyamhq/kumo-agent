import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { type Computer, kumoEndpoint, planSync } from "./plan";

/**
 * Makes the host list match these computers. A ready computer is saved at once under a
 * placeholder id, so the host runtime probes it with its own backoff while kumo-agent boots and
 * takes the daemon's real id on its first answer.
 */
export async function syncComputers(computers: readonly Computer[]): Promise<void> {
  const store = getHostRuntimeStore();
  const { add, remove } = planSync(computers, store.getHosts());
  for (const serverId of remove) await store.removeHost(serverId);
  for (const handle of add) {
    await store.upsertDirectConnection({
      serverId: `kumo:${handle}`,
      endpoint: kumoEndpoint(handle),
      useTls: true,
      label: handle,
    });
  }
}
