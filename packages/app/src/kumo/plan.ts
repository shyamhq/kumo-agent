import { z } from "zod";
import type { HostProfile } from "@/types/host-connection";
import { kumo } from "./config";

export const computerSchema = z.object({
  id: z.string(),
  handle: z.string(),
  status: z.enum(["provisioning", "ready", "stopped", "failed"]),
});

export type Computer = z.infer<typeof computerSchema>;

export interface SyncPlan {
  /** Handles of computers to probe and add as hosts. */
  add: string[];
  /** Server ids of Kumo hosts to remove. */
  remove: string[];
}

/** Where a computer's kumo-agent is reached, through Kumo's gate. */
export function kumoEndpoint(handle: string): string {
  return `${kumo.port}--${handle}.${kumo.zone}:443`;
}

/** The computer a stored endpoint belongs to, or null when the host isn't one of Kumo's. */
export function kumoHandleOf(endpoint: string): string | null {
  const prefix = `${kumo.port}--`;
  const suffix = `.${kumo.zone}:443`;
  if (!endpoint.startsWith(prefix) || !endpoint.endsWith(suffix)) return null;
  const handle = endpoint.slice(prefix.length, -suffix.length);
  return /^[a-z0-9-]+$/.test(handle) ? handle : null;
}

/** The server id of each Kumo computer's host, by the computer's handle. */
export function kumoHostsByHandle(hosts: readonly HostProfile[]): Map<string, string> {
  const serverIdByHandle = new Map<string, string>();
  for (const host of hosts) {
    for (const connection of host.connections) {
      const handle = connection.type === "directTcp" ? kumoHandleOf(connection.endpoint) : null;
      if (handle) serverIdByHandle.set(handle, host.serverId);
    }
  }
  return serverIdByHandle;
}

/**
 * Which computers become hosts and which Kumo hosts go. A ready computer gets one. A starting
 * computer keeps the one it has, so a restart doesn't drop its open workspace. A stopped, failed
 * or unlisted one loses it. Signed out, pass no computers. Other hosts are never touched.
 */
export function planSync(computers: readonly Computer[], hosts: readonly HostProfile[]): SyncPlan {
  const hostByHandle = kumoHostsByHandle(hosts);
  const statusByHandle = new Map(computers.map((computer) => [computer.handle, computer.status]));
  const add = computers
    .filter((computer) => computer.status === "ready" && !hostByHandle.has(computer.handle))
    .map((computer) => computer.handle);
  const remove = [...hostByHandle]
    .filter(([handle]) => {
      const status = statusByHandle.get(handle);
      return status !== "ready" && status !== "provisioning";
    })
    .map(([, serverId]) => serverId);
  return { add, remove };
}
