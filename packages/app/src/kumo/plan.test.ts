import { describe, expect, it } from "vitest";
import { defaultHostAppearance } from "@/hosts/appearance";
import {
  defaultLifecycle,
  type DirectTcpHostConnection,
  type HostProfile,
} from "@/types/host-connection";
import { type Computer, computersNeedingRows, kumoEndpoint, kumoHandleOf, planSync } from "./plan";

function direct(endpoint: string, { useTls = true } = {}): DirectTcpHostConnection {
  return { id: `direct:${endpoint}`, type: "directTcp", endpoint, useTls };
}

function host(serverId: string, endpoint: string): HostProfile {
  return {
    serverId,
    label: serverId,
    appearance: defaultHostAppearance(),
    lifecycle: defaultLifecycle(),
    connections: [direct(endpoint)],
    preferredConnectionId: null,
    createdAt: "2026-11-25T00:00:00.000Z",
    updatedAt: "2026-11-25T00:00:00.000Z",
  };
}

function computer(handle: string, status: Computer["status"]): Computer {
  return { id: `id-${handle}`, handle, status };
}

describe("kumoHandleOf", () => {
  it("reads the computer from a TLS connection to a Kumo endpoint and nothing else", () => {
    expect(kumoHandleOf(direct(kumoEndpoint("noble-heron")))).toBe("noble-heron");
    expect(kumoHandleOf(direct("localhost:6767"))).toBeNull();
    expect(kumoHandleOf(direct("6868--a.b.staging.mykumo.xyz:443"))).toBeNull();
    expect(kumoHandleOf(direct("6868--noble-heron.mykumo.xyz:443"))).toBeNull();
  });

  // The grant rides on this answer: it must never go over plain ws://.
  it("refuses a Kumo endpoint without TLS", () => {
    expect(kumoHandleOf(direct(kumoEndpoint("noble-heron"), { useTls: false }))).toBeNull();
  });
});

describe("planSync", () => {
  const laptop = host("srv_laptop", "192.168.1.5:6767");
  const heron = host("srv_heron", kumoEndpoint("noble-heron"));
  const ibex = host("srv_ibex", kumoEndpoint("wild-ibex"));
  const lark = host("srv_lark", kumoEndpoint("swift-lark"));

  it("adds ready computers, keeps starting ones, and removes the rest", () => {
    const plan = planSync(
      [
        computer("noble-heron", "provisioning"),
        computer("wild-ibex", "stopped"),
        computer("calm-otter", "ready"),
        computer("bold-crane", "failed"),
      ],
      [laptop, heron, ibex, lark],
    );

    expect(plan).toEqual({ add: ["calm-otter"], remove: ["srv_ibex", "srv_lark"] });
  });

  it("removes every Kumo host when signed out, and only those", () => {
    expect(planSync([], [laptop, heron])).toEqual({ add: [], remove: ["srv_heron"] });
  });
});

describe("computersNeedingRows", () => {
  it("lists computers that aren't ready, and ready ones whose host failed to connect", () => {
    const computers = [
      computer("calm-otter", "stopped"),
      computer("bold-crane", "failed"),
      computer("noble-heron", "provisioning"),
      computer("wild-ibex", "ready"),
      computer("swift-lark", "ready"),
      computer("quiet-wren", "ready"),
      computer("brave-kite", "ready"),
    ];
    const hosts = [
      host("srv_ibex", kumoEndpoint("wild-ibex")),
      host("srv_lark", kumoEndpoint("swift-lark")),
      host("srv_wren", kumoEndpoint("quiet-wren")),
    ];
    const statuses = new Map([
      ["srv_ibex", "online" as const],
      ["srv_lark", "connecting" as const],
      ["srv_wren", "offline" as const],
    ]);

    const rows = computersNeedingRows(computers, hosts, statuses).map((row) => row.handle);

    // brave-kite has no host yet: the next sync adds one, and it shows in the host list.
    expect(rows).toEqual(["calm-otter", "bold-crane", "noble-heron", "quiet-wren"]);
  });
});
