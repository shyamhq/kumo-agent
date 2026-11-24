import { stat } from "node:fs/promises";
import type { WorkspaceProvisioningService } from "./session/workspace-provisioning/workspace-provisioning-service.js";
import type { ProjectRegistry } from "./workspace-registry.js";

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
  projectRegistry: Pick<ProjectRegistry, "list">;
  workspaceProvisioning: Pick<WorkspaceProvisioningService, "findOrCreateProjectForDirectory">;
}): Promise<void> {
  if ((await input.projectRegistry.list()).length > 0) return;
  if (!(await stat(input.dir).catch(() => null))?.isDirectory()) return;
  await input.workspaceProvisioning.findOrCreateProjectForDirectory(input.dir);
}
