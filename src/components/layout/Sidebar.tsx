import { useEffect, useState, useCallback } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { discoverSessions, getSessionMessages, createSession } from "../../lib/tauri";
import { SessionList } from "../sidebar/SessionList";
import { NewSessionButton } from "../sidebar/NewSessionButton";
import { SettingsDialog } from "../settings/SettingsDialog";
import type { ChatMessage, ContentBlock } from "../../lib/types";
import type { ParsedMessage } from "../../lib/tauri";

interface SidebarProps {
  onNewSession?: () => void;
}

export function Sidebar({ onNewSession }: SidebarProps) {
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
          // Check if already loaded — match by claudeSessionId or by ID
          const currentSessions = useSessionStore.getState().sessions;
          const exists = currentSessions.some(
            (s) =>
              s.claudeSessionId === d.claudeSessionId ||
              s.id === d.claudeSessionId,
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
            pinned: false,
            activityState: "idle",
            archived: false,
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

  // Create a new session scoped to a specific project path
  const handleNewSessionForProject = useCallback(async (projectPath: string) => {
    try {
      const session = await createSession(projectPath);
      addSession(session);
      setActiveSession(session.id);
      setMessages([]);
    } catch (err) {
      console.error("Failed to create session for project:", err);
    }
  }, [addSession, setActiveSession, setMessages]);

  return (
    <nav className="relative z-10 flex w-72 flex-col bg-bg-secondary shadow-[4px_0_24px_-4px_rgba(0,0,0,0.3)]" aria-label="Sessions sidebar">
      {/* Header */}
      <div className="relative flex items-center justify-between px-5 py-5">
        <h1 className="text-base font-semibold tracking-tight text-text">
          OpenClaudgents
        </h1>
        {sessions.length > 0 && (
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-medium text-accent shadow-sm shadow-accent/20">
            {sessions.length}
          </span>
        )}
        {/* Animated gradient underline */}
        <div className="pointer-events-none absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      </div>

      {/* New Session button — top placement (Codex-style) */}
      <div className="px-5 pb-3">
        <NewSessionButton onClick={() => onNewSession?.()} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SessionList
          onSelectSession={handleSelectSession}
          onNewSessionForProject={handleNewSessionForProject}
        />
      </div>

      {/* Bottom section — settings only */}
      <div className="relative px-5 pb-5 pt-5">
        <div className="pointer-events-none absolute left-5 right-5 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <button
          onClick={() => setShowSettings(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-muted transition-all duration-200 hover:bg-bg-tertiary/60 hover:text-text"
          aria-label="Open settings"
          title="Settings (⌘,)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
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
          Settings
        </button>
      </div>

      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </nav>
  );
}
