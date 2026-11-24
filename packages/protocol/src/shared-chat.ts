/**
 * Providers read a command from the raw start of a prompt: a slash and a name with no second
 * slash in it. A path such as `/tmp/build.log` is plain text. A command travels alone and
 * unwrapped, so in a shared chat it is never a person's envelope.
 */
export function isSlashCommand(text: string): boolean {
  return /^\/[^\s/]+(\s|$)/.test(text.trim());
}

/** Kumo's rule (kumo-computer agent-mention.ts): `@kumo`, not `@kumo-bot` or `@kumo.computer`. */
export function mentionsAgent(text: string): boolean {
  return /(?:^|\s)@kumo(?![\w-]|\.\w)/i.test(text);
}

/**
 * In a shared chat, a message for the people in it rather than the agent: it doesn't mention
 * `@kumo` and isn't a command. The daemon keeps it as a post; the composer sends it at once.
 */
export function isForPeople(text: string): boolean {
  return !mentionsAgent(text) && !isSlashCommand(text);
}
