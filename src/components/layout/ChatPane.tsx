import { useState, useCallback } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { createSession, sendMessage, createWorktree } from "../../lib/tauri";
import { MessageList } from "../chat/MessageList";
import { Composer } from "../chat/Composer";
import { WelcomeScreen } from "../chat/WelcomeScreen";
import { WorktreeDialog } from "../common/WorktreeDialog";

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
  const updateSession = useSessionStore((s) => s.updateSession);
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const planMode = useChatStore((s) => s.planMode);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [pendingProjectPath, setPendingProjectPath] = useState<string | null>(null);
  const [conflictSessionName, setConflictSessionName] = useState("");
  const [showWorktreeDialog, setShowWorktreeDialog] = useState(false);

  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });

  const handleCreateSession = useCallback(
    async (projectPath: string) => {
      setWelcomeError(null);

      // Check for an existing active/waiting session on the same project
      const sessions = useSessionStore.getState().sessions;
      const conflict = sessions.find(
        (s) =>
          s.projectPath === projectPath &&
          (s.status === "active" || s.status === "paused" || s.status === "waiting_input"),
      );

      if (conflict) {
        setPendingProjectPath(projectPath);
        setConflictSessionName(conflict.name || `Session ${conflict.id.slice(0, 8)}`);
        setShowWorktreeDialog(true);
        return;
      }

      // No conflict — create session normally
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

  const handleWorktreeChoice = useCallback(
    async (choice: "local" | "worktree") => {
      setShowWorktreeDialog(false);
      if (!pendingProjectPath) return;

      const originalPath = pendingProjectPath;
      setPendingProjectPath(null);
      setWelcomeError(null);

      try {
        if (choice === "worktree") {
          // Create worktree first, then spawn session in worktree dir
          const tempId = crypto.randomUUID();
          const worktreeInfo = await createWorktree(tempId, originalPath);

          // Create the CLI session pointing at the worktree path
          const session = await createSession(worktreeInfo.path);
          addSession(session);
          setActiveSession(session.id);

          // Fix up session: keep original projectPath for grouping, set worktreePath
          updateSession(session.id, {
            worktreePath: worktreeInfo.path,
            projectPath: originalPath,
          });
        } else {
          // Share folder — create normally
          const session = await createSession(originalPath);
          addSession(session);
          setActiveSession(session.id);
        }
      } catch (err) {
        console.error("Failed to create session:", err);
        setWelcomeError(String(err));
      }
    },
    [pendingProjectPath, addSession, setActiveSession, updateSession],
  );

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!activeSessionId) return;

      // Check for slash commands
      if (message.startsWith("/") && onSlashCommand) {
        const handled = onSlashCommand(message);
        if (handled) return;
      }

      // Look up the active session — prefer worktreePath over projectPath
      const session = useSessionStore
        .getState()
        .sessions.find((s) => s.id === activeSessionId);
      const effectivePath = session?.worktreePath ?? session?.projectPath ?? "";

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
        await sendMessage(activeSessionId, message, effectivePath);
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
        <WorktreeDialog
          isOpen={showWorktreeDialog}
          onClose={() => {
            setShowWorktreeDialog(false);
            setPendingProjectPath(null);
          }}
          projectPath={pendingProjectPath ?? ""}
          existingSessionName={conflictSessionName}
          onChoose={handleWorktreeChoice}
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
          {planMode && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
              Plan Mode
            </span>
          )}
          {activeSession?.worktreePath && (
            <span
              className="flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info"
              title={activeSession.worktreePath}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" x2="6" y1="3" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              Worktree
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
