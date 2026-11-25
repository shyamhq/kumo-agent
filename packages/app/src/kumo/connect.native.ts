import type { DaemonClientConfig } from "@getpaseo/client/internal/daemon-client";
import { z } from "zod";
import { queryClient } from "@/data/query-client";
import { computersQuery, kumoFetch } from "./api";
import { kumo } from "./config";
import { kumoHandleOf } from "./plan";

const grantSchema = z.object({ url: z.string() });

export class KumoComputerGoneError extends Error {
  constructor(handle: string) {
    super(`${handle} is no longer one of your Kumo computers`);
  }
}

/**
 * The gate in front of a computer admits a WebSocket that carries a port grant as its cookie. A
 * grant lasts an hour and the gate checks it only at upgrade, so each attempt mints its own. The
 * hand-off URL is read, never loaded: loading it would put the grant in the shared cookie store
 * too, and the socket would then send it twice. `origin` is the daemon's `PUBLIC_URL`: Android's
 * own would add `:443`, which the daemon's exact comparison refuses.
 *
 * ponytail: one control-plane call per attempt, including an offline computer's backoff probes.
 * Cache the grant until it expires if that shows up in Kumo's load.
 */
async function grantHeaders(handle: string): Promise<Record<string, string>> {
  const computers = await queryClient.ensureQueryData(computersQuery);
  const computer = computers.find((candidate) => candidate.handle === handle);
  if (!computer) throw new KumoComputerGoneError(handle);
  const response = await kumoFetch(`/boxes/${computer.id}/ports/${kumo.port}/grant`, "POST");
  const { url } = grantSchema.parse(await response.json());
  const grant = /[?&]__kumo_grant=([^&#]+)/.exec(url)?.[1];
  if (!grant) throw new Error(`Kumo's grant for ${handle} carried no grant`);
  return {
    Cookie: `__Host-kumo_grant=${grant}`,
    origin: `https://${kumo.port}--${handle}.${kumo.zone}`,
  };
}

/** The connect options a host's endpoint needs: a fresh grant on every attempt for a Kumo computer. */
export function kumoConnectOptions(endpoint: string): Pick<DaemonClientConfig, "connectHeaders"> {
  const handle = kumoHandleOf(endpoint);
  return handle ? { connectHeaders: () => grantHeaders(handle) } : {};
}
