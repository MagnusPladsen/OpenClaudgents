import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { MessageList } from "../chat/MessageList";
import { Composer } from "../chat/Composer";
import { WelcomeScreen } from "../chat/WelcomeScreen";
import type { Session } from "../../lib/types";

interface ChatPaneProps {
  onTogglePreview: () => void;
  showPreview: boolean;
}

export function ChatPane({ onTogglePreview, showPreview }: ChatPaneProps) {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const handleCreateSession = useCallback(
    async (projectPath: string) => {
      try {
        const session = await invoke<Session>("create_session", {
          projectPath,
        });
        addSession(session);
        setActiveSession(session.id);
      } catch (err) {
        console.error("Failed to create session:", err);
        // Show error in chat so user can see what went wrong
        addMessage({
          uuid: crypto.randomUUID(),
          parentUuid: null,
          role: "system",
          content: `Failed to create session: ${err}`,
          timestamp: new Date().toISOString(),
          isSidechain: false,
        });
      }
    },
    [addSession, setActiveSession, addMessage],
  );

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!activeSessionId) return;

      // Add user message to chat immediately
      addMessage({
        uuid: crypto.randomUUID(),
        parentUuid: null,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
        isSidechain: false,
      });

      try {
        await invoke("send_message", {
          sessionId: activeSessionId,
          message,
        });
      } catch (err) {
        console.error("Failed to send message:", err);
        // Show error as a system message so the user knows it failed
        addMessage({
          uuid: crypto.randomUUID(),
          parentUuid: null,
          role: "system",
          content: `Failed to send message: ${err}`,
          timestamp: new Date().toISOString(),
          isSidechain: false,
        });
      }
    },
    [activeSessionId, addMessage],
  );

  if (!activeSessionId) {
    return (
      <div className="flex flex-1 flex-col">
        <WelcomeScreen onCreateSession={handleCreateSession} />
      </div>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-bg" aria-label="Chat">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Chat</span>
          <span className="text-xs text-text-muted">
            {messages.length} messages
          </span>
        </div>
        <button
          onClick={onTogglePreview}
          aria-label={showPreview ? "Hide preview pane" : "Show preview pane"}
          className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-bg-tertiary"
        >
          {showPreview ? "Hide Preview" : "Show Preview"}
        </button>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList messages={messages} />
      </div>

      {/* Message input */}
      <Composer
        sessionId={activeSessionId}
        onSend={handleSendMessage}
        disabled={isStreaming}
      />
    </main>
  );
}
