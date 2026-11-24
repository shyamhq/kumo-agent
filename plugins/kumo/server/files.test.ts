import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readKumoInstructions, readKumoKeys } from "./files.js";

let home: string;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "kumo-files-"));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

async function writeKeys(text: string): Promise<void> {
  await mkdir(join(home, ".kumo"), { recursive: true });
  await writeFile(join(home, ".kumo", "ai-credentials.json"), text);
}

describe("readKumoKeys", () => {
  it("reads the saved keys", async () => {
    await writeKeys(JSON.stringify({ ANTHROPIC_API_KEY: "sk-1", OPENAI_API_KEY: "sk-2" }));

    expect(await readKumoKeys(home)).toEqual({ ANTHROPIC_API_KEY: "sk-1", OPENAI_API_KEY: "sk-2" });
  });

  it("returns no keys off a Kumo computer", async () => {
    expect(await readKumoKeys(home)).toEqual({});
  });

  it("returns no keys for a file that does not parse", async () => {
    await writeKeys("{not json");

    expect(await readKumoKeys(home)).toEqual({});
  });
});

describe("readKumoInstructions", () => {
  it("reads the computer's instructions", async () => {
    await mkdir(join(home, ".kumo"), { recursive: true });
    await writeFile(join(home, ".kumo", "computer.md"), "<preview>links</preview>\n");

    expect(await readKumoInstructions(home)).toBe("<preview>links</preview>");
  });

  it("returns null off a Kumo computer", async () => {
    expect(await readKumoInstructions(home)).toBeNull();
  });

  // The worker writes an empty file on a computer with neither a browser nor a public address.
  it("returns null for an empty file", async () => {
    await mkdir(join(home, ".kumo"), { recursive: true });
    await writeFile(join(home, ".kumo", "computer.md"), "\n");

    expect(await readKumoInstructions(home)).toBeNull();
  });

  it("returns null for a file it cannot read", async () => {
    await mkdir(join(home, ".kumo", "computer.md"), { recursive: true });

    expect(await readKumoInstructions(home)).toBeNull();
  });
});
