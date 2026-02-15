import { useState, useCallback } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { createSession, sendMessage, createWorktree } from "../../lib/tauri";
import { useToastStore } from "../../stores/toastStore";
import { MessageList } from "../chat/MessageList";
import { Composer } from "../chat/Composer";
import { WelcomeScreen } from "../chat/WelcomeScreen";
import { WorktreeDialog } from "../common/WorktreeDialog";

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
