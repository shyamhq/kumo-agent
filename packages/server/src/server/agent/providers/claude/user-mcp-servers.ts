import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/**
 * Claude's user-scope MCP servers (`mcpServers` in `.claude.json`) as text, to tell when they
 * change: a running Claude reads them once, at start. Null when the file is missing or caught
 * mid-write, which says nothing about a change (Claude rewrites the file all the time).
 */
export async function readUserMcpServers(env: NodeJS.ProcessEnv): Promise<string | null> {
  const dir = env.CLAUDE_CONFIG_DIR || homedir();
  let config: unknown;
  try {
    config = JSON.parse(await readFile(path.join(dir, ".claude.json"), "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
  const servers =
    typeof config === "object" && config !== null && "mcpServers" in config
      ? config.mcpServers
      : null;
  return JSON.stringify(servers ?? null);
}
