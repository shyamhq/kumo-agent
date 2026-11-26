import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/**
 * Claude's user-scope MCP servers (`mcpServers` in `.claude.json`) as text, to tell when they
 * change: a running Claude reads them once, at start. Null when the file can't be read or parsed,
 * which says nothing about a change (Claude rewrites the file all the time).
 */
export async function readUserMcpServers(env: NodeJS.ProcessEnv): Promise<string | null> {
  const dir = env.CLAUDE_CONFIG_DIR;
  const file = dir ? path.join(dir, ".claude.json") : path.join(homedir(), ".claude.json");
  try {
    const config = JSON.parse(await readFile(file, "utf8")) as { mcpServers?: unknown };
    return JSON.stringify(config.mcpServers ?? null);
  } catch {
    return null;
  }
}
