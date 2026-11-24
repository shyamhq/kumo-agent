import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const keysSchema = z.record(z.string(), z.string());

// The Kumo worker rewrites both files in ~/.kumo, so they are read on every agent open, never
// cached: a key the owner just changed reaches the next agent.

/** The AI keys the owner saved in Kumo's Settings › AI, as env name → value. */
export async function readKumoKeys(home: string): Promise<Record<string, string>> {
  const text = await readIfExists(join(home, ".kumo", "ai-credentials.json"));
  if (text === null) {
    return {};
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

/** Kumo's instructions about this computer (its browsers and links), or null if there are none. */
export async function readKumoInstructions(home: string): Promise<string | null> {
  try {
    const text = await readIfExists(join(home, ".kumo", "computer.md"));
    return text?.trim() || null;
  } catch (error) {
    // Advice, not access: an unreadable file must not stop the agent from opening.
    console.warn(`kumo: computer.md is unreadable (${String(error)})`);
    return null;
  }
}

// Missing off a Kumo computer, or before the worker writes it.
async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
