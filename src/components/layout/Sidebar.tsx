import { useEffect, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import {
  discoverSessions,
  getSessionMessages,
} from "../../lib/tauri";
import { SessionList } from "../sidebar/SessionList";
import { NewSessionButton } from "../sidebar/NewSessionButton";
import { SettingsDialog } from "../settings/SettingsDialog";
import type { ChatMessage, ContentBlock } from "../../lib/types";
import type { ParsedMessage } from "../../lib/tauri";

export function Sidebar() {
  const [showSettings, setShowSettings] = useState(false);
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const sessions = useSessionStore((s) => s.sessions);
  const setMessages = useChatStore((s) => s.setMessages);

  // Discover existing sessions on mount
  useEffect(() => {
    discoverSessions()
      .then((discovered) => {
        // Only load recent sessions (last 20)
        const recent = discovered.slice(0, 20);
        for (const d of recent) {
          // Check if already loaded
          const exists = useSessionStore
            .getState()
            .sessions.some(
              (s) => s.claudeSessionId === d.claudeSessionId,
            );
          if (exists) continue;

          addSession({
            id: d.claudeSessionId, // Use claude session ID as our ID for discovered sessions
            claudeSessionId: d.claudeSessionId,
            name: d.name,
            projectPath: d.projectPath,
            worktreePath: null,
            status: "paused",
            model: d.model,
            createdAt: d.lastMessageAt || new Date().toISOString(),
            updatedAt: d.lastMessageAt || new Date().toISOString(),
            totalInputTokens: 0,
            totalOutputTokens: 0,
            isAgentTeam: false,
            teamRole: null,
            parentSessionId: null,
          });
        }
      })
      .catch((err) => console.error("Failed to discover sessions:", err));
  }, [addSession]);

  // Handle session selection — lazy-load messages
  const handleSelectSession = async (sessionId: string) => {
    setActiveSession(sessionId);

    // Load messages from JSONL
    const session = useSessionStore
      .getState()
      .sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const claudeId = session.claudeSessionId || sessionId;
    try {
      const parsed = await getSessionMessages(claudeId);
      const messages: ChatMessage[] = parsed.map((p: ParsedMessage) => ({
        uuid: p.uuid,
        parentUuid: p.parentUuid,
        role: p.role as "user" | "assistant" | "system",
        content:
          typeof p.content === "string"
            ? p.content
            : (p.content as ContentBlock[]),
        timestamp: p.timestamp,
        isSidechain: p.isSidechain,
      }));
      setMessages(messages);
    } catch (err) {
      console.error("Failed to load session messages:", err);
      setMessages([]);
    }
  };

  return (
    <nav className="flex w-64 flex-col border-r border-border bg-bg-secondary" aria-label="Sessions sidebar">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold text-text">OpenClaudgents</h1>
        <span className="text-xs text-text-muted">
          {sessions.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SessionList onSelectSession={handleSelectSession} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <NewSessionButton />
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text"
            aria-label="Open settings"
            title="Settings (⌘,)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </nav>
  );
}
