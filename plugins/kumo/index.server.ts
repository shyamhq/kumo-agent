import { homedir } from "node:os";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { readKumoInstructions, readKumoKeys } from "./server/files.js";

// The stock agents the worker writes Kumo's MCP servers for, so the instructions' `kumo-chrome`
// tools exist. Profiles that extend them have their own ids and are skipped.
const KUMO_MCP_PROVIDERS = new Set(["claude", "codex", "opencode"]);
// Keys only for stock Claude and Codex: a profile may carry keys for another endpoint, which this
// env would override, while env on the stock entry itself does lose to it. No OpenCode: any launch
// env gives each OpenCode agent its own server instead of the shared one.
const KEYED_PROVIDERS = new Set(["claude", "codex"]);

export default function contribute(server: PluginServerContext) {
  return server.addHook("agent.open.before", async ({ request }) => {
    if (!KUMO_MCP_PROVIDERS.has(request.provider)) {
      return;
    }
    const home = homedir();
    const instructions = await readKumoInstructions(home);
    const keys = KEYED_PROVIDERS.has(request.provider) ? await readKumoKeys(home) : {};
    const prompt = request.appendSystemPrompt ?? [];
    const appendSystemPrompt = instructions === null ? prompt : [...prompt, instructions];
    // Env set for this one agent (e.g. `paseo run --env`) wins over Kumo's keys.
    return { ...request, appendSystemPrompt, env: { ...keys, ...request.env } };
  });
}
