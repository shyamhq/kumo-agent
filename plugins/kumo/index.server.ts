import { homedir } from "node:os";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { withKumo } from "./server/open.js";

export default function contribute(server: PluginServerContext) {
  return server.addHook("agent.open.before", ({ request }) => withKumo(request, homedir()));
}
