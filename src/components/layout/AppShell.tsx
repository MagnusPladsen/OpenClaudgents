import { useState, useCallback, useEffect, useMemo } from "react";
import { Sidebar } from "./Sidebar";
import { ChatPane } from "./ChatPane";
import { PreviewPane } from "./PreviewPane";
import { StatusBar } from "./StatusBar";
import { TerminalDrawer } from "./TerminalDrawer";
import { CommandPalette, type PaletteAction } from "../common/CommandPalette";
import { SettingsDialog } from "../settings/SettingsDialog";
import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { parseSlashCommand, SLASH_COMMANDS } from "../../lib/commands";

export function AppShell() {
  const [showPreview, setShowPreview] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [welcomeKey, setWelcomeKey] = useState(0);

  const sessions = useSessionStore((s) => s.sessions);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const addMessage = useChatStore((s) => s.addMessage);

  const toggleTerminal = useCallback(
    () => setShowTerminal((t) => !t),
    [],
  );

  const togglePreview = useCallback(
    () => setShowPreview((p) => !p),
    [],
  );

  const handleNewSession = useCallback(() => {
    setActiveSession(null);
    clearMessages();
    setWelcomeKey((k) => k + 1);
  }, [setActiveSession, clearMessages]);

  // Handle slash commands from ChatPane — returns true if handled
  const handleSlashCommand = useCallback((input: string): boolean => {
    const parsed = parseSlashCommand(input);
    if (!parsed) return false;

    switch (parsed.command) {
      case "clear":
        clearMessages();
        return true;
      case "settings":
        setShowSettings(true);
        return true;
      case "mcp":
        setShowPreview(true);
        return true;
      case "new":
        handleNewSession();
        return true;
      case "help": {
        const helpText = SLASH_COMMANDS
          .map((c) => `**/${c.name}**${c.args ? ` ${c.args}` : ""} — ${c.description}`)
          .join("\n");
        addMessage({
          uuid: crypto.randomUUID(),
          parentUuid: null,
          role: "system",
          content: `Available commands:\n${helpText}`,
          timestamp: new Date().toISOString(),
          isSidechain: false,
        });
        return true;
      }
      case "compact":
        // Send as regular message — CLI handles compaction internally
        return false;
      case "model":
        if (parsed.args) {
          addMessage({
            uuid: crypto.randomUUID(),
            parentUuid: null,
            role: "system",
            content: `Model preference set to "${parsed.args}". Will be used for the next session.`,
            timestamp: new Date().toISOString(),
            isSidechain: false,
          });
        } else {
          addMessage({
            uuid: crypto.randomUUID(),
            parentUuid: null,
            role: "system",
            content: "Usage: /model <model-name> (e.g., /model sonnet, /model opus)",
            timestamp: new Date().toISOString(),
            isSidechain: false,
          });
        }
        return true;
      default:
        addMessage({
          uuid: crypto.randomUUID(),
          parentUuid: null,
          role: "system",
          content: `Unknown command "/${parsed.command}". Type /help to see available commands.`,
          timestamp: new Date().toISOString(),
          isSidechain: false,
        });
        return true;
    }
  }, [clearMessages, addMessage, handleNewSession]);

  // Keyboard shortcuts: Cmd+J (terminal), Cmd+K (palette)
  useEffect(() => {
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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleTerminal]);

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

        {/* Center chat pane */}
        <ChatPane
          onTogglePreview={togglePreview}
          showPreview={showPreview}
          welcomeKey={welcomeKey}
          onSlashCommand={handleSlashCommand}
        />

        {/* Right preview pane (collapsible) */}
        {showPreview && (
          <div className="animate-fade-in">
            <PreviewPane onClose={() => setShowPreview(false)} />
          </div>
        )}
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
    </div>
  );
}
