import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const keysSchema = z.record(z.string(), z.string());

/**
 * The AI keys the owner saved in Kumo's Settings › AI, as env name → value. The Kumo worker
 * rewrites the file, so it is read on every agent open, never cached: a key the owner just
 * changed reaches the next agent.
 */
export async function readKumoKeys(home: string): Promise<Record<string, string>> {
  let text: string;
  try {
    text = await readFile(join(home, ".kumo", "ai-credentials.json"), "utf8");
  } catch (error) {
    // Off a Kumo computer, or before the owner saves a key.
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
  try {
    return keysSchema.parse(JSON.parse(text));
  } catch (error) {
    // The error's type only: a JSON error message quotes the text, and the text is secrets.
    const kind = error instanceof Error ? error.name : "unknown";
    console.warn(`kumo: ai-credentials.json is unreadable (${kind})`);
    return {};
  }
}
