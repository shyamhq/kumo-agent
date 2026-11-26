import type { DaemonClientConfig } from "@getpaseo/client/internal/daemon-client";
import type { DirectTcpHostConnection } from "@/types/host-connection";

/** The web UI a Kumo computer serves reaches its own kumo-agent through the page's cookie. */
export function kumoConnectOptions(
  _connection: DirectTcpHostConnection,
): Pick<DaemonClientConfig, "connectHeaders"> {
  return {};
}
