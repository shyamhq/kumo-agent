import { describe, expect, it } from "vitest";
import { defaultHostAppearance } from "@/hosts/appearance";
import { defaultLifecycle, type HostProfile } from "@/types/host-connection";
import { type Computer, kumoEndpoint, kumoHandleOf, planSync } from "./plan";

function host(serverId: string, endpoint: string): HostProfile {
  return {
    serverId,
    label: serverId,
    appearance: defaultHostAppearance(),
    lifecycle: defaultLifecycle(),
    connections: [{ id: `direct:${endpoint}`, type: "directTcp", endpoint, useTls: true }],
    preferredConnectionId: null,
    createdAt: "2026-11-25T00:00:00.000Z",
    updatedAt: "2026-11-25T00:00:00.000Z",
  };
}

function computer(handle: string, status: Computer["status"]): Computer {
  return { id: `id-${handle}`, handle, status };
}

describe("kumoHandleOf", () => {
  it("reads the computer from a Kumo endpoint and nothing else", () => {
    expect(kumoHandleOf(kumoEndpoint("noble-heron"))).toBe("noble-heron");
    expect(kumoHandleOf("localhost:6767")).toBeNull();
    expect(kumoHandleOf("6868--a.b.staging.mykumo.xyz:443")).toBeNull();
    expect(kumoHandleOf("6868--noble-heron.mykumo.xyz:443")).toBeNull();
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
