import { execFileSync } from "node:child_process";
import { hostname } from "node:os";
import { readKumoComputer } from "./kumo-computer.js";

let hostName: string | undefined;

// macOS's kernel hostname comes from DHCP/reverse DNS and can be "UNKNOWN";
// ComputerName is the name the user gave the Mac. A Kumo computer's hostname is its container's
// random id; people know it by its handle.
export function getHostName(): string {
  hostName ??=
    readKumoComputer(process.env.PUBLIC_URL)?.handle ??
    (process.platform === "darwin"
      ? execFileSync("/usr/sbin/scutil", ["--get", "ComputerName"], { encoding: "utf8" }).trim()
      : hostname());
  return hostName;
}
