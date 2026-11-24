import { WebSocket } from "ws";
import {
  DaemonClient as SharedDaemonClient,
  type DaemonClientConfig as SharedDaemonClientConfig,
  type CreateAgentRequestOptions,
  type DaemonEvent,
  type DaemonEventHandler,
  type SendMessageOptions,
  type WebSocketLike,
} from "@getpaseo/client/internal/daemon-client";

export type DaemonClientConfig = Omit<
  SharedDaemonClientConfig,
  "webSocketFactory" | "transportFactory" | "clientId"
> & {
  clientId?: string;
  /** Sent on the upgrade, e.g. the headers Kumo's gate sets to name a person. */
  headers?: Record<string, string>;
};
export type CreateAgentOptions = CreateAgentRequestOptions;
export { type SendMessageOptions, type DaemonEvent, type DaemonEventHandler };

let testClientCounter = 0;

function nextTestClientId(): string {
  testClientCounter += 1;
  return `clid_test_client_${testClientCounter}`;
}

export class DaemonClient extends SharedDaemonClient {
  constructor(config: DaemonClientConfig) {
    const clientId = config.clientId ?? nextTestClientId();
    super({
      ...config,
      clientId,
      webSocketFactory: (url, options) =>
        new WebSocket(url, options?.protocols, {
          headers: { ...options?.headers, ...config.headers },
        }) as unknown as WebSocketLike,
    });
  }
}
