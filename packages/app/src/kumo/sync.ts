import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { type Computer, kumoEndpoint, planSync } from "./plan";

/**
 * Makes the host list match these computers. A computer is added only once its kumo-agent
 * answers the probe; one that doesn't stays a row in the Kumo section until it does, so a failed
 * probe needs no handling here.
 */
export async function syncComputers(computers: readonly Computer[]): Promise<void> {
  const store = getHostRuntimeStore();
  const { add, remove } = planSync(computers, store.getHosts());
  for (const serverId of remove) await store.removeHost(serverId);
  await Promise.allSettled(
    add.map((handle) =>
      store.probeAndUpsertDirectConnection({
        endpoint: kumoEndpoint(handle),
        useTls: true,
        label: handle,
      }),
    ),
  );
}
