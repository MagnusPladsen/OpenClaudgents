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

interface ToolInputDeltaEvent {
  sessionId: string;
  partialJson: string;
}

interface SessionStatusEvent {
  sessionId: string;
  status: string;
}

interface StderrEvent {
  sessionId: string;
  text: string;
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

interface CompactionEvent {
  sessionId: string;
}

interface SessionIdResolvedEvent {
  sessionId: string;
  claudeSessionId: string;
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
  const incrementCompaction = useChatStore((s) => s.incrementCompaction);
  const startToolCall = useChatStore((s) => s.startToolCall);
  const appendToolInput = useChatStore((s) => s.appendToolInput);
  const flushPendingToolCalls = useChatStore((s) => s.flushPendingToolCalls);
  const updateSession = useSessionStore((s) => s.updateSession);
  const setActivityState = useSessionStore((s) => s.setActivityState);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  useEffect(() => {
    const unlisteners: Promise<UnlistenFn>[] = [];

    // Text streaming deltas
    unlisteners.push(
      listen<TextDeltaEvent>("claude:text_delta", (event) => {
        const { sessionId, text } = event.payload;
        // Update activity state for any session
        setActivityState(sessionId, "streaming");
        // Only process chat events for the active session
        if (sessionId === activeSessionId) {
          appendStreamingText(text);
          setStreaming(true);
        }
      }),
    );

    // Tool use started — track the tool call
    unlisteners.push(
      listen<ToolStartEvent>("claude:tool_start", (event) => {
        const { sessionId, toolName, toolId } = event.payload;
        setActivityState(sessionId, "tool_running");
        if (sessionId === activeSessionId) {
          startToolCall(toolId, toolName);
          setStreaming(true);
        }
      }),
    );

    // Tool input JSON deltas — accumulate partial JSON for the current tool
    unlisteners.push(
      listen<ToolInputDeltaEvent>("claude:tool_input_delta", (event) => {
        const { sessionId, partialJson } = event.payload;
        if (sessionId === activeSessionId) {
          appendToolInput(partialJson);
        }
      }),
    );

    // Message complete — finalize the streamed message with tool calls
    unlisteners.push(
      listen<MessageCompleteEvent>("claude:message_complete", (event) => {
        const { sessionId } = event.payload;
        setActivityState(sessionId, "idle");
        if (sessionId === activeSessionId) {
          const streamingText = useChatStore.getState().streamingText;
          const toolCalls = flushPendingToolCalls();

          if (streamingText || toolCalls.length > 0) {
            addMessage({
              uuid: crypto.randomUUID(),
              parentUuid: null,
              role: "assistant",
              content: streamingText,
              timestamp: new Date().toISOString(),
              isSidechain: false,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            });
          }
          resetStreamingText();
          setStreaming(false);
        }
      }),
    );

    // Stderr output — show as system error messages
    unlisteners.push(
      listen<StderrEvent>("claude:stderr", (event) => {
        const { sessionId, text } = event.payload;
        if (sessionId === activeSessionId) {
          addMessage({
            uuid: crypto.randomUUID(),
            parentUuid: null,
            role: "system",
            content: text,
            timestamp: new Date().toISOString(),
            isSidechain: false,
          });
        }
      }),
    );

    // Session status changes
    unlisteners.push(
      listen<SessionStatusEvent>("claude:session_status", (event) => {
        const { sessionId, status } = event.payload;
        updateSession(sessionId, {
          status: status as "active" | "paused" | "completed" | "error",
        });

        // Map session status to activity state
        if (status === "waiting_input") {
          setActivityState(sessionId, "awaiting_input");
        } else if (status === "active") {
          // "active" without a delta yet means thinking
          setActivityState(sessionId, "thinking");
        } else if (status === "completed" || status === "paused") {
          setActivityState(sessionId, "idle");
        }

        // On error, clean up streaming state
        if (status === "error") {
          setActivityState(sessionId, "idle");
          if (sessionId === activeSessionId) {
            resetStreamingText();
            setStreaming(false);
          }
        }
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

    // Session ID resolved — real Claude session ID discovered from stream
    unlisteners.push(
      listen<SessionIdResolvedEvent>("claude:session_id_resolved", (event) => {
        const { sessionId, claudeSessionId } = event.payload;
        updateSession(sessionId, { claudeSessionId });
      }),
    );

    // Compaction events — context was compressed
    unlisteners.push(
      listen<CompactionEvent>("claude:compaction", (event) => {
        const { sessionId } = event.payload;
        if (sessionId === activeSessionId) {
          incrementCompaction();
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
    incrementCompaction,
    startToolCall,
    appendToolInput,
    flushPendingToolCalls,
    updateSession,
    setActivityState,
  ]);
}
