import { useState, useCallback } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { createSession, sendMessage } from "../../lib/tauri";
import { MessageList } from "../chat/MessageList";
import { Composer } from "../chat/Composer";
import { WelcomeScreen } from "../chat/WelcomeScreen";

interface ChatPaneProps {
  onTogglePreview: () => void;
  showPreview: boolean;
  welcomeKey?: number;
  onSlashCommand?: (command: string) => boolean;
}

export function ChatPane({ onTogglePreview, showPreview, welcomeKey, onSlashCommand }: ChatPaneProps) {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);

  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });

  const handleCreateSession = useCallback(
    async (projectPath: string) => {
      setWelcomeError(null);
      try {
        const session = await createSession(projectPath);
        addSession(session);
        setActiveSession(session.id);
      } catch (err) {
        console.error("Failed to create session:", err);
        setWelcomeError(String(err));
      }
    },
    [addSession, setActiveSession],
  );

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!activeSessionId) return;

      // Check for slash commands
      if (message.startsWith("/") && onSlashCommand) {
        const handled = onSlashCommand(message);
        if (handled) return;
      }

      // Look up the active session's project path
      const session = useSessionStore
        .getState()
        .sessions.find((s) => s.id === activeSessionId);
      const projectPath = session?.projectPath ?? "";

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
        await sendMessage(activeSessionId, message, projectPath);
      } catch (err) {
        console.error("Failed to send message:", err);
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
    [activeSessionId, addMessage, onSlashCommand],
  );

  if (!activeSessionId) {
    return (
      <div className="flex flex-1 flex-col">
        <WelcomeScreen
          key={welcomeKey}
          onCreateSession={handleCreateSession}
          error={welcomeError}
        />
      </div>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-bg" aria-label="Chat">
      {/* Chat header */}
      <div className="relative flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-text">Chat</span>
          {activeSession?.model && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
              {activeSession.model.includes("sonnet") ? "Sonnet" : activeSession.model.includes("opus") ? "Opus" : "Haiku"}
            </span>
          )}
          <span className="text-xs text-text-muted">
            {messages.length} messages
          </span>
        </div>
        <button
          onClick={onTogglePreview}
          aria-label={showPreview ? "Hide preview pane" : "Show preview pane"}
          className="rounded-lg px-2.5 py-1 text-xs text-text-secondary transition-all duration-200 hover:bg-bg-tertiary hover:text-text"
        >
          {showPreview ? "Hide Preview" : "Show Preview"}
        </button>
        {/* Bottom gradient border */}
        <div className="pointer-events-none absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
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
