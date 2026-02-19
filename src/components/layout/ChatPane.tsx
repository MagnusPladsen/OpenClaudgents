import { useState, useCallback, useEffect } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { createSession, sendMessage, createWorktree } from "../../lib/tauri";
import { useToastStore } from "../../stores/toastStore";
import { MessageList } from "../chat/MessageList";
import { Composer } from "../chat/Composer";
import { WelcomeScreen } from "../chat/WelcomeScreen";
import { WorktreeDialog } from "../common/WorktreeDialog";
import { ChatSearchBar } from "../chat/ChatSearchBar";

interface ChatPaneProps {
  welcomeKey?: number;
  onSlashCommand?: (command: string) => boolean;
}

export function ChatPane({ welcomeKey, onSlashCommand }: ChatPaneProps) {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const autoWorktree = useSettingsStore((s) => s.autoWorktree);
  const addToast = useToastStore((s) => s.addToast);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const searchMatchIds = useChatStore((s) => s.searchMatchIds);
  const searchCurrentIndex = useChatStore((s) => s.searchCurrentIndex);
  const clearSearch = useChatStore((s) => s.clearSearch);
  const [showSearch, setShowSearch] = useState(false);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [pendingProjectPath, setPendingProjectPath] = useState<string | null>(null);
  const [conflictSessionName, setConflictSessionName] = useState("");
  const [showWorktreeDialog, setShowWorktreeDialog] = useState(false);

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
        if (autoWorktree) {
          // Auto-create worktree without dialog
          try {
            const tempId = crypto.randomUUID();
            const worktreeInfo = await createWorktree(tempId, projectPath);
            const session = await createSession(worktreeInfo.path);
            addSession(session);
            setActiveSession(session.id);
            updateSession(session.id, {
              worktreePath: worktreeInfo.path,
              projectPath,
            });
            const projectName = projectPath.split("/").pop() || projectPath;
            addToast(`Created isolated worktree for ${projectName}`, "success");
          } catch (err) {
            console.error("Failed to create worktree session:", err);
            setWelcomeError(String(err));
          }
          return;
        }

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
    [addSession, setActiveSession, updateSession, autoWorktree, addToast],
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

  // Cmd+F to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Scroll to current match
  useEffect(() => {
    if (searchCurrentIndex < 0 || searchMatchIds.length === 0) return;
    const targetId = searchMatchIds[searchCurrentIndex];
    const el = document.querySelector(`[data-message-id="${targetId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchCurrentIndex, searchMatchIds]);

  // Clear search when switching sessions
  useEffect(() => {
    setShowSearch(false);
    clearSearch();
  }, [activeSessionId, clearSearch]);

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

  const activeSession = useSessionStore((s) =>
    s.sessions.find((sess) => sess.id === s.activeSessionId),
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-bg" aria-label="Chat">
      {/* Session header bar */}
      {activeSession && (
        <div className="relative flex items-center gap-3 border-b border-border/40 px-6 py-3.5">
          <span className="truncate text-sm font-semibold text-text">
            {activeSession.name || `Session ${activeSession.id.slice(0, 8)}`}
          </span>
          <span className="truncate text-xs text-text-muted">
            {activeSession.projectPath.split("/").pop()}
          </span>
          {activeSession.worktreePath && (
            <span className="flex items-center gap-1.5 rounded-full bg-info/15 px-2.5 py-1 text-[11px] font-semibold text-info">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" x2="6" y1="3" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              Worktree
            </span>
          )}
          {activeSession.model && (
            <span className="ml-auto rounded-full bg-bg-tertiary/60 px-2 py-0.5 text-[10px] font-medium text-text-muted">
              {activeSession.model}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {showSearch && (
          <ChatSearchBar onClose={() => setShowSearch(false)} />
        )}
        <MessageList messages={messages} searchQuery={searchQuery} />
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
