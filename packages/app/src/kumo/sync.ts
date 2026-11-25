import type { HostRuntimeStore } from "@/runtime/host-runtime";
import { type Computer, KUMO_PLACEHOLDER_PREFIX, kumoEndpoint, planSync } from "./plan";

/** The part of the host store a sync reads and writes. */
export type HostList = Pick<HostRuntimeStore, "getHosts" | "removeHost" | "upsertDirectConnection">;

let applying: Promise<void> = Promise.resolve();

/**
 * Makes the host list match these computers. A ready computer is saved at once under a
 * placeholder id, so the host runtime probes it with its own backoff while kumo-agent boots and
 * takes the daemon's real id on its first answer.
 *
 * Syncs run one at a time, each planning from the list as the last one left it: two in flight
 * would add the same computer twice, and the late one would rename a host that had already
 * connected back to its placeholder.
 */
export function syncComputers(list: HostList, computers: readonly Computer[]): Promise<void> {
  const run = applying.then(() => apply(list, computers));
  // A failed sync still reaches its caller; the next one runs regardless.
  applying = run.catch(() => undefined);
  return run;
}

async function apply(list: HostList, computers: readonly Computer[]): Promise<void> {
  const { add, remove } = planSync(computers, list.getHosts());
  for (const serverId of remove) await list.removeHost(serverId);
  for (const handle of add) {
    await list.upsertDirectConnection({
      serverId: `${KUMO_PLACEHOLDER_PREFIX}${handle}`,
      endpoint: kumoEndpoint(handle),
      useTls: true,
      label: handle,
    });
  }
}
