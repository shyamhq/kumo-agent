import type { MessageAuthor } from "@getpaseo/protocol/agent-types";

/** The control plane's cap on a display name, enforced again by the process that shows it. */
const MAX_NAME_LENGTH = 80;
const MAX_ID_LENGTH = 128;
/** Kumo's rule (kumo-computer apps/worker/src/access/caller.ts): a newline ends a line early, and
 *  a right-to-left override reorders every name drawn after it. */
// eslint-disable-next-line no-control-regex -- these are the characters it strips
const UNSAFE_IN_NAME = /[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;

/**
 * The person Kumo's gate names on a request, or null off the gate (the CLI on the computer, a
 * schedule, an agent). The gate sets `X-Kumo-User` and the percent-encoded `X-Kumo-Name` from the
 * visitor's grant and overwrites whatever the browser sent. Nothing but the gate reaches a box
 * port (kumo-computer `agents/risky-areas/box-host.md`), and whatever could set these headers on
 * the computer could drive this password-less daemon outright, so there is no peer check.
 */
export function readKumoPerson(headers: Readonly<Record<string, unknown>>): MessageAuthor | null {
  const id = headers["x-kumo-user"];
  if (typeof id !== "string" || id === "" || id.length > MAX_ID_LENGTH) return null;
  const name = headers["x-kumo-name"];
  return { id, name: displayName(typeof name === "string" ? name : "") };
}

/** A grant minted before names carries none: "Someone" for that grant's hour. */
function displayName(encoded: string): string {
  const clean = decoded(encoded).replace(UNSAFE_IN_NAME, "").trim().slice(0, MAX_NAME_LENGTH);
  return clean === "" ? "Someone" : clean;
}

function decoded(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch (error) {
    // Not Kumo's encoding, so not a name Kumo gave.
    if (error instanceof URIError) return "";
    throw error;
  }
}
