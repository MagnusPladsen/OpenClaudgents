import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useChatStore } from "../stores/chatStore";
import { useSessionStore } from "../stores/sessionStore";

interface TextDeltaEvent {
  sessionId: string;
  text: string;
}

interface MessageCompleteEvent {
  sessionId: string;
}

interface ToolStartEvent {
  sessionId: string;
  toolName: string;
  toolId: string;
}

interface SessionStatusEvent {
  sessionId: string;
  status: string;
}

interface UsageUpdateEvent {
  sessionId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
}

/**
 * Hook that subscribes to all Claude streaming events and updates stores.
 * Should be mounted once at the app level.
 */
export function useStreamingChat() {
  const appendStreamingText = useChatStore((s) => s.appendStreamingText);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const resetStreamingText = useChatStore((s) => s.resetStreamingText);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateSession = useSessionStore((s) => s.updateSession);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  useEffect(() => {
    const unlisteners: Promise<UnlistenFn>[] = [];

    // Text streaming deltas
    unlisteners.push(
      listen<TextDeltaEvent>("claude:text_delta", (event) => {
        const { sessionId, text } = event.payload;
        // Only process events for the active session
        if (sessionId === activeSessionId) {
          appendStreamingText(text);
          setStreaming(true);
        }
      }),
    );

    // Message complete — finalize the streamed message
    unlisteners.push(
      listen<MessageCompleteEvent>("claude:message_complete", (event) => {
        const { sessionId } = event.payload;
        if (sessionId === activeSessionId) {
          // Move streaming text into a proper message
          const streamingText = useChatStore.getState().streamingText;
          if (streamingText) {
            addMessage({
              uuid: crypto.randomUUID(),
              parentUuid: null,
              role: "assistant",
              content: streamingText,
              timestamp: new Date().toISOString(),
              isSidechain: false,
            });
          }
          resetStreamingText();
          setStreaming(false);
        }
      }),
    );

    // Tool starts
    unlisteners.push(
      listen<ToolStartEvent>("claude:tool_start", (event) => {
        // Tool call tracking — will be enhanced later
        console.debug("[tool_start]", event.payload);
      }),
    );

    // Session status changes
    unlisteners.push(
      listen<SessionStatusEvent>("claude:session_status", (event) => {
        const { sessionId, status } = event.payload;
        updateSession(sessionId, {
          status: status as "active" | "paused" | "completed" | "error",
        });
      }),
    );

    // Usage updates
    unlisteners.push(
      listen<UsageUpdateEvent>("claude:usage_update", (event) => {
        const { sessionId, usage } = event.payload;
        const session = useSessionStore
          .getState()
          .sessions.find((s) => s.id === sessionId);
        if (session) {
          updateSession(sessionId, {
            totalInputTokens:
              session.totalInputTokens + usage.inputTokens,
            totalOutputTokens:
              session.totalOutputTokens + usage.outputTokens,
          });
        }
      }),
    );

    return () => {
      unlisteners.forEach((p) => p.then((unlisten) => unlisten()));
    };
  }, [
    activeSessionId,
    appendStreamingText,
    setStreaming,
    resetStreamingText,
    addMessage,
    updateSession,
  ]);
}
