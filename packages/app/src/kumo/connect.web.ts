import type { DaemonClientConfig } from "@getpaseo/client/internal/daemon-client";

/** The web UI a Kumo computer serves reaches its own kumo-agent through the page's cookie. */
export function kumoConnectOptions(_endpoint: string): Pick<DaemonClientConfig, "connectHeaders"> {
  return {};
}
