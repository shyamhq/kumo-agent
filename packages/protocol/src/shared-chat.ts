/**
 * Providers read a command from the raw start of a prompt: a slash and a name with no second
 * slash in it. A path such as `/tmp/build.log` is plain text. A command travels alone and
 * unwrapped, so in a shared chat it is never a person's envelope.
 */
export function isSlashCommand(text: string): boolean {
  return /^\/[^\s/]+(\s|$)/.test(text.trim());
}
