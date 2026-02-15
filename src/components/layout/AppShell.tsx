import { useState, useCallback, useEffect, useMemo } from "react";
import { Sidebar } from "./Sidebar";
import { ChatPane } from "./ChatPane";
import { PreviewPane } from "./PreviewPane";
import { TopToolbar } from "./TopToolbar";
import { StatusBar } from "./StatusBar";
import { TerminalDrawer } from "./TerminalDrawer";
import { CommandPalette, type PaletteAction } from "../common/CommandPalette";
import { SessionPickerDialog } from "../common/SessionPickerDialog";
import { RewindDialog } from "../common/RewindDialog";
import { SettingsDialog } from "../settings/SettingsDialog";
import { ToastContainer } from "../common/Toast";
import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import { parseSlashCommand, SLASH_COMMANDS } from "../../lib/commands";
import { executeCommand } from "../../lib/commandHandlers";
import type { CommandContext } from "../../lib/commandHandlers";
import type { Tab } from "./PreviewPane";

export function AppShell() {
  const [showPreview, setShowPreview] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [showRewindDialog, setShowRewindDialog] = useState(false);
  const [previewInitialTab, setPreviewInitialTab] = useState<Tab | null>(null);
  const [welcomeKey, setWelcomeKey] = useState(0);

  const sessions = useSessionStore((s) => s.sessions);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const toggleTerminal = useCallback(
    () => setShowTerminal((t) => !t),
    [],
  );

  const togglePreview = useCallback(
    () => setShowPreview((p) => !p),
    [],
  );

  const openPreviewTab = useCallback((tab: Tab) => {
    setPreviewInitialTab(tab);
    setShowPreview(true);
  }, []);

  const handleNewSession = useCallback(() => {
    setActiveSession(null);
    clearMessages();
    setWelcomeKey((k) => k + 1);
  }, [setActiveSession, clearMessages]);

  // Build CommandContext for the handler system
  const buildContext = useCallback((): CommandContext => ({
    addSystemMessage: (content: string) => {
      addMessage({
        uuid: crypto.randomUUID(),
        parentUuid: null,
        role: "system",
        content,
        timestamp: new Date().toISOString(),
        isSidechain: false,
      });
    },
    clearMessages,
    openPreviewTab: (tab: Tab) => {
      setPreviewInitialTab(tab);
      setShowPreview(true);
    },
    openSettings: () => setShowSettings(true),
    newSession: handleNewSession,
    exitSession: () => {
      setActiveSession(null);
      clearMessages();
      setWelcomeKey((k) => k + 1);
    },
    getActiveSession: () => useSessionStore.getState().getActiveSession(),
    getAllSessions: () => useSessionStore.getState().sessions,
    setActiveSession,
    updateSession,
    getMessages: () => useChatStore.getState().messages,
    removeLastMessages: (count: number) => useChatStore.getState().removeLastMessages(count),
    showSessionPicker: () => setShowSessionPicker(true),
    showRewindDialog: () => setShowRewindDialog(true),
    setTheme,
    setPlanMode: (enabled: boolean) => useChatStore.getState().setPlanMode(enabled),
    getPlanMode: () => useChatStore.getState().planMode,
  }), [addMessage, clearMessages, handleNewSession, setActiveSession, updateSession, setTheme]);

  // Handle slash commands from ChatPane — returns true if handled
  const handleSlashCommand = useCallback((input: string): boolean => {
    const parsed = parseSlashCommand(input);
    if (!parsed) return false;

    // Check if this is a passthrough command (like /compact) before executing
    const def = SLASH_COMMANDS.find((c) => c.name === parsed.command);
    if (def?.passthrough) return false;

    // Fire and forget the async handler
    const ctx = buildContext();
    executeCommand(ctx, parsed);

    return true;
  }, [buildContext]);

  // Handle rewind action from RewindDialog
  const handleRewind = useCallback((messageIndex: number, action: string) => {
    const messages = useChatStore.getState().messages;
    const session = useSessionStore.getState().getActiveSession();

    if (action === "restore_conversation" || action === "restore_all") {
      // Remove all messages after the selected checkpoint
      const toRemove = messages.length - messageIndex;
      if (toRemove > 0) {
        useChatStore.getState().removeLastMessages(toRemove);
      }
    }

    if (action === "restore_code" || action === "restore_all") {
      // Attempt to restore code via git — best-effort
      if (session) {
        const path = session.worktreePath || session.projectPath;
        // Git restore is best-effort: stash current changes, then checkout
        invoke("git_restore_checkpoint", { path, messageIndex }).catch((err: unknown) => {
          addMessage({
            uuid: crypto.randomUUID(),
            parentUuid: null,
            role: "system",
            content: `Code restore not available: ${err}`,
            timestamp: new Date().toISOString(),
            isSidechain: false,
          });
        });
      }
    }

    if (action === "summarize") {
      // Summarize: collect messages from checkpoint onwards into a single system message
      const toSummarize = messages.slice(messageIndex);
      const summary = toSummarize
        .map((m) => {
          const role = m.role === "user" ? "User" : m.role === "assistant" ? "Claude" : "System";
          const text = typeof m.content === "string"
            ? m.content
            : m.content
                .filter((b) => b.type === "text")
                .map((b) => b.text ?? "")
                .join(" ");
          return `**${role}:** ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`;
        })
        .join("\n\n");

      const toRemove = messages.length - messageIndex;
      useChatStore.getState().removeLastMessages(toRemove);
      addMessage({
        uuid: crypto.randomUUID(),
        parentUuid: null,
        role: "system",
        content: `**Conversation summary** (${toSummarize.length} messages compressed):\n\n${summary}`,
        timestamp: new Date().toISOString(),
        isSidechain: false,
      });
    } else {
      addMessage({
        uuid: crypto.randomUUID(),
        parentUuid: null,
        role: "system",
        content: `Rewound to checkpoint ${messageIndex + 1} (${action.replace(/_/g, " ")}).`,
        timestamp: new Date().toISOString(),
        isSidechain: false,
      });
    }
  }, [addMessage]);

  // Keyboard shortcuts: Cmd+J (terminal), Cmd+K (palette), Esc+Esc (rewind)
  useEffect(() => {
    let lastEscTime = 0;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "j") {
          e.preventDefault();
          toggleTerminal();
        } else if (e.key === "k") {
          e.preventDefault();
          setShowPalette((p) => !p);
        } else if (e.key === ",") {
          e.preventDefault();
          setShowSettings((s) => !s);
        }
      }
      // Double-Esc opens rewind dialog (like vanilla Claude Code)
      if (e.key === "Escape" && !showPalette && !showSettings && !showSessionPicker && !showRewindDialog) {
        const now = Date.now();
        if (now - lastEscTime < 500) {
          e.preventDefault();
          setShowRewindDialog(true);
          lastEscTime = 0;
        } else {
          lastEscTime = now;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleTerminal, showPalette, showSettings, showSessionPicker, showRewindDialog]);

  // Build command palette actions
  const paletteActions = useMemo<PaletteAction[]>(() => {
    const actions: PaletteAction[] = [
      {
        id: "toggle-terminal",
        label: "Toggle Terminal",
        shortcut: "⌘J",
        section: "View",
        onSelect: toggleTerminal,
      },
      {
        id: "toggle-preview",
        label: "Toggle Preview Pane",
        section: "View",
        onSelect: togglePreview,
      },
      {
        id: "open-settings",
        label: "Open Settings",
        shortcut: "⌘,",
        section: "View",
        onSelect: () => setShowSettings(true),
      },
      {
        id: "new-session",
        label: "New Session",
        description: "Create a new Claude Code session",
        section: "Session",
        onSelect: handleNewSession,
      },
    ];

    // Add session switching actions
    for (const session of sessions) {
      const name = session.name || session.projectPath.split("/").pop() || session.id;
      actions.push({
        id: `switch-${session.id}`,
        label: `Switch to: ${name}`,
        description: session.projectPath,
        section: "Sessions",
        onSelect: () => setActiveSession(session.id),
      });
    }

    return actions;
  }, [sessions, setActiveSession, toggleTerminal, togglePreview, handleNewSession]);

  return (
    <div className="grain relative flex h-screen flex-col bg-bg text-text">
      {/* Dot-grid background texture */}
      <div className="dot-grid pointer-events-none absolute inset-0 z-0" />

      {/* Main content area */}
      <div className="relative z-[1] flex min-h-0 flex-1">
        {/* Left sidebar */}
        <Sidebar onNewSession={handleNewSession} />

        {/* Right side: toolbar + chat + preview */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top toolbar (Codex-style) */}
          <TopToolbar
            onTogglePreview={togglePreview}
            onOpenPreviewTab={openPreviewTab}
            showPreview={showPreview}
          />

          {/* Chat + Preview row */}
          <div className="flex min-h-0 flex-1">
            {/* Center chat pane */}
            <ChatPane
              welcomeKey={welcomeKey}
              onSlashCommand={handleSlashCommand}
            />

            {/* Right preview pane (collapsible) */}
            {showPreview && (
              <div className="animate-panel-open">
                <PreviewPane
                  onClose={() => {
                    setShowPreview(false);
                    setPreviewInitialTab(null);
                  }}
                  initialTab={previewInitialTab ?? undefined}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Terminal drawer (Cmd+J) */}
      {showTerminal && (
        <div className="relative z-[1] animate-slide-up-drawer">
          <TerminalDrawer onClose={() => setShowTerminal(false)} />
        </div>
      )}

      {/* Status bar */}
      <div className="relative z-[1]">
        <StatusBar
          showTerminal={showTerminal}
          onToggleTerminal={toggleTerminal}
        />
      </div>

      {/* Command palette (Cmd+K) */}
      <CommandPalette
        actions={paletteActions}
        isOpen={showPalette}
        onClose={() => setShowPalette(false)}
      />

      {/* Settings dialog (Cmd+,) */}
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Session picker dialog (/resume) */}
      <SessionPickerDialog
        isOpen={showSessionPicker}
        onClose={() => setShowSessionPicker(false)}
      />

      {/* Rewind dialog (/rewind) */}
      <RewindDialog
        isOpen={showRewindDialog}
        onClose={() => setShowRewindDialog(false)}
        onRewind={handleRewind}
      />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
