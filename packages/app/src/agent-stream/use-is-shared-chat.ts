import { useSessionStore } from "@/stores/session-store";
import { isSharedChat } from "@/types/stream";

/** Whether an agent's chat is shared, as a boolean the caller re-renders on only when it flips. */
export function useIsSharedChat(serverId: string, agentId: string): boolean {
  return useSessionStore((state) =>
    isSharedChat(state.sessions[serverId]?.agentStreamTail.get(agentId)),
  );
}
