// A leaf: host-name.ts brings this file into the supervisor's build (tsconfig.scripts.json, ES2022),
// so it imports nothing from the daemon, not even types.
import { stat } from "node:fs/promises";

export interface KumoComputer {
  /** What people call the computer, e.g. `kumox-sg-rustic-jackal`. */
  handle: string;
  /** `<handle>.<zone>`; each of its addresses is `<prefix>--` on it. */
  host: string;
}

/**
 * The Kumo computer this daemon runs on, read from the address Kumo gives every app it runs:
 * `PUBLIC_URL=https://<port>--<handle>.<zone>`. Null anywhere else.
 */
export function readKumoComputer(publicUrl: string | undefined): KumoComputer | null {
  const match = /^https:\/\/\d+--(([^./]+)\.[^/]+)\/?$/.exec(publicUrl ?? "");
  return match ? { host: match[1], handle: match[2] } : null;
}

/**
 * Kumo keeps a computer's projects in `~/workspace`, so a daemon with no projects adds it, as the
 * user would. Removing it lasts while another project exists: with none, the next start adds it.
 */
export async function addKumoWorkspace(input: {
  dir: string;
  projectRegistry: { list(): Promise<readonly unknown[]> };
  workspaceProvisioning: { findOrCreateProjectForDirectory(dir: string): Promise<unknown> };
}): Promise<void> {
  if ((await input.projectRegistry.list()).length > 0) return;
  if (!(await stat(input.dir).catch(() => null))?.isDirectory()) return;
  await input.workspaceProvisioning.findOrCreateProjectForDirectory(input.dir);
}
