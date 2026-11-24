import type { MessageAuthor } from "@getpaseo/protocol/agent-types";
import { isSlashCommand } from "@getpaseo/protocol/shared-chat";
import {
  sendPromptToAgent,
  type PromptDispatchResult,
  type SendDirectPromptParams,
} from "../agent-prompt.js";
import type { AgentStorage, AgentThread } from "../agent-storage.js";

/** A message a person sent through Kumo's gate (`readKumoPerson`). */
export interface PersonSend extends SendDirectPromptParams {
  person: MessageAuthor;
  /** What the person typed, before attachments were folded into `prompt`. */
  text: string;
}

/**
 * A person's message to an agent. Until a second person writes in the chat it goes as it always
 * has, so someone alone pays nothing. From then on the chat is shared (docs/glossary.md) and each
 * message reaches the agent in a `person-message` envelope naming its author, which the provider
 * keeps in its own history and replays with the author attached.
 */
export async function sendFromPerson(send: PersonSend): Promise<PromptDispatchResult> {
  const { person, text, ...params } = send;
  const thread = await joinThread(params.agentStorage, params.agentId, person);
  if (!isShared(thread) || isSlashCommand(text)) return sendPromptToAgent(params);
  return sendPromptToAgent({ ...params, source: { kind: "person-message", author: person } });
}

/** Counts a person as a writer in an agent's chat; answers the thread after them. */
export async function joinThread(
  storage: Pick<AgentStorage, "updateThread">,
  agentId: string,
  person: MessageAuthor,
): Promise<AgentThread> {
  const before = await storage.updateThread(agentId, (thread) => withWriter(thread, person.id));
  return withWriter(before, person.id);
}

/** Two writers make a chat shared for good, so a third is never recorded. */
function withWriter(thread: AgentThread, personId: string): AgentThread {
  if (isShared(thread) || thread.writers.includes(personId)) return thread;
  return { ...thread, writers: [...thread.writers, personId] };
}

function isShared(thread: AgentThread): boolean {
  return thread.writers.length > 1;
}
