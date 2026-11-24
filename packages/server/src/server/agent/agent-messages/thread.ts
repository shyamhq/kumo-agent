import { randomUUID } from "node:crypto";
import type { MessageAuthor } from "@getpaseo/protocol/agent-types";
import { isForPeople, isSlashCommand } from "@getpaseo/protocol/shared-chat";
import {
  sendPromptToAgent,
  type PromptDispatchResult,
  type SendDirectPromptParams,
} from "../agent-prompt.js";
import type { AgentStorage, AgentThread, StoredPost } from "../agent-storage.js";
import { formatAgentMessage } from "./envelope.js";

/** A message a person sent through Kumo's gate (`readKumoPerson`). */
export interface PersonSend extends SendDirectPromptParams {
  person: MessageAuthor;
  /** What the person typed, before attachments were folded into `prompt`. */
  text: string;
  hasAttachments: boolean;
}

/** A post carries no files: there is nowhere to keep them until the agent sees them. */
export class PostAttachmentsError extends Error {
  constructor() {
    super("Add @kumo to send files to the agent.");
    this.name = "PostAttachmentsError";
  }
}

/**
 * A person's message to an agent; null when it became a post.
 *
 * Until a second person writes in the chat it goes as it always has, so someone alone pays
 * nothing. From then on the chat is shared (docs/glossary.md): a message that doesn't mention
 * `@kumo` is a post, shown to everyone and kept for the agent, and the next prompt carries every
 * post ahead of itself. Each reaches the provider in an envelope naming its author, which the
 * provider keeps in its own history and replays with the author attached.
 */
export async function sendFromPerson(send: PersonSend): Promise<PromptDispatchResult | null> {
  const { person, text, hasAttachments, ...params } = send;
  const { agentStorage: storage, agentId } = params;
  const before = await storage.updateThread(agentId, (thread) => withWriter(thread, person.id));
  if (!isShared(withWriter(before, person.id)) || isSlashCommand(text)) {
    return sendPromptToAgent(params);
  }
  // A new writer's first message is never a post: it is how they join.
  if (isShared(before) && isForPeople(text)) {
    if (hasAttachments) throw new PostAttachmentsError();
    const post: StoredPost = {
      type: "user_message",
      text,
      clientMessageId: params.messageId ?? randomUUID(),
      author: person,
    };
    // Kept before it is shown, so nothing on screen is missing from the record.
    await storage.updateThread(agentId, (thread) => ({
      ...thread,
      posts: [...thread.posts, post],
    }));
    params.agentManager.recordPost(agentId, post);
    return null;
  }

  // Taken inside the agent's write queue, so two prompts never carry the same post.
  const { posts } = await storage.updateThread(agentId, (thread) => ({ ...thread, posts: [] }));
  try {
    return await sendPromptToAgent({
      ...params,
      source: { kind: "person-message", author: person },
      ahead: posts.map(envelopeOf),
    });
  } catch (error) {
    // ponytail: a crash between taking and the provider's acceptance loses them (milliseconds: a
    // person's prompt dispatches at once). Mark posts with their carrier instead if that bites.
    await storage.updateThread(agentId, (thread) => ({
      ...thread,
      posts: [...posts, ...thread.posts],
    }));
    throw error;
  }
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

function envelopeOf(post: StoredPost): string {
  return formatAgentMessage({
    id: post.clientMessageId,
    source: { kind: "person-post", author: post.author },
    text: post.text,
  });
}
