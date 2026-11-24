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

  // A post stays in the record until the provider has it, so a refused turn or a crash keeps it
  // for the next prompt. ponytail: two prompts in flight together both carry it, and a crash right
  // after the provider took it carries it once more; both mean the agent reads it twice.
  const posts = (await storage.get(agentId))?.thread?.posts ?? [];
  const result = await sendPromptToAgent({
    ...params,
    source: { kind: "person-message", author: person },
    ahead: posts.map(envelopeOf),
  });
  if (posts.length) {
    const carried = new Set(posts.map((post) => post.clientMessageId));
    const forget = () =>
      storage.updateThread(agentId, (thread) => ({
        ...thread,
        posts: thread.posts.filter((post) => !carried.has(post.clientMessageId)),
      }));
    // The provider has the prompt once its turn starts, or at once for a steer. A refused turn
    // rejects `started`, and the posts stay.
    const delivered = result.disposition === "turn_started" ? result.started : Promise.resolve();
    void delivered
      .then(forget, () => undefined)
      .catch((error: unknown) => {
        params.logger.error({ err: error, agentId }, "Could not drop the posts a turn delivered");
      });
  }
  return result;
}

/** Counts a person as a writer in an agent's chat. */
export async function joinThread(
  storage: Pick<AgentStorage, "updateThread">,
  agentId: string,
  person: MessageAuthor,
): Promise<void> {
  await storage.updateThread(agentId, (thread) => withWriter(thread, person.id));
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
