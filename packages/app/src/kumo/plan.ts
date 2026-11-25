import { z } from "zod";
import type { HostRuntimeConnectionStatus } from "@/runtime/host-runtime";
import type { DirectTcpHostConnection, HostProfile } from "@/types/host-connection";
import { kumo } from "./config";

export const computerSchema = z.object({
  id: z.string(),
  handle: z.string(),
  status: z.enum(["provisioning", "ready", "stopped", "failed"]),
});

export type Computer = z.infer<typeof computerSchema>;

/**
 * The server id a Kumo computer's host carries until its kumo-agent first answers; the host
 * runtime treats it as a placeholder and moves the host to the daemon's real id.
 */
export const KUMO_PLACEHOLDER_PREFIX = "kumo:";

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

/**
 * The computer a host connection reaches, or null when it isn't one of Kumo's. TLS is part of the
 * rule: a Kumo connection carries a port grant, which must never go over plain ws://.
 */
export function kumoHandleOf(connection: DirectTcpHostConnection): string | null {
  const prefix = `${kumo.port}--`;
  const suffix = `.${kumo.zone}:443`;
  const { endpoint } = connection;
  if (connection.useTls !== true || !endpoint.startsWith(prefix) || !endpoint.endsWith(suffix)) {
    return null;
  }
  const handle = endpoint.slice(prefix.length, -suffix.length);
  return /^[a-z0-9-]+$/.test(handle) ? handle : null;
}

/** The server id of each Kumo computer's host, by the computer's handle. */
export function kumoHostsByHandle(hosts: readonly HostProfile[]): Map<string, string> {
  const serverIdByHandle = new Map<string, string>();
  for (const host of hosts) {
    for (const connection of host.connections) {
      const handle = connection.type === "directTcp" ? kumoHandleOf(connection) : null;
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

/**
 * The computers the Kumo section lists: any that isn't ready (Start, Starting), and a ready one
 * whose host failed to connect (kumo-agent isn't answering). A ready computer whose host is
 * connected or still trying is in the host list instead.
 */
export function computersNeedingRows(
  computers: readonly Computer[],
  hosts: readonly HostProfile[],
  statuses: ReadonlyMap<string, HostRuntimeConnectionStatus>,
): Computer[] {
  const serverIdByHandle = kumoHostsByHandle(hosts);
  return computers.filter((computer) => {
    if (computer.status !== "ready") return true;
    const serverId = serverIdByHandle.get(computer.handle);
    const status = serverId ? statuses.get(serverId) : undefined;
    return status === "offline" || status === "error";
  });
}
