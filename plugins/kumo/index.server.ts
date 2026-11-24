import { homedir } from "node:os";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { readKumoKeys } from "./server/keys.js";

// Stock Claude and Codex only. A profile that extends one has its own id and may carry keys for
// another endpoint, which this env would override; env on the stock entry itself does lose to it.
// No OpenCode: any launch env gives each OpenCode agent its own server instead of the shared one.
const KUMO_PROVIDERS = new Set(["claude", "codex"]);

export default function contribute(server: PluginServerContext) {
  return server.addHook("agent.open.before", async ({ request }) => {
    if (!KUMO_PROVIDERS.has(request.provider)) {
      return;
    }
    const keys = await readKumoKeys(homedir());
    // Env set for this one agent (e.g. `paseo run --env`) wins over Kumo's keys.
    return { ...request, env: { ...keys, ...request.env } };
  });
}
