import { useState, useCallback, useEffect, useMemo } from "react";
import { Sidebar } from "./Sidebar";
import { ChatPane } from "./ChatPane";
import { PreviewPane } from "./PreviewPane";
import { StatusBar } from "./StatusBar";
import { TerminalDrawer } from "./TerminalDrawer";
import { CommandPalette, type PaletteAction } from "../common/CommandPalette";
import { SettingsDialog } from "../settings/SettingsDialog";
import { useSessionStore } from "../../stores/sessionStore";

export function AppShell() {
  const [showPreview, setShowPreview] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const sessions = useSessionStore((s) => s.sessions);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  const toggleTerminal = useCallback(
    () => setShowTerminal((t) => !t),
    [],
  );

  const togglePreview = useCallback(
    () => setShowPreview((p) => !p),
    [],
  );

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
        onSelect: () => {
          setActiveSession(null as unknown as string);
        },
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
  }, [sessions, setActiveSession, toggleTerminal, togglePreview]);

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      {/* Main content area */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar */}
        <Sidebar />

        {/* Center chat pane */}
        <ChatPane
          onTogglePreview={togglePreview}
          showPreview={showPreview}
        />

        {/* Right preview pane (collapsible) */}
        {showPreview && <PreviewPane onClose={() => setShowPreview(false)} />}
      </div>

      {/* Terminal drawer (Cmd+J) */}
      {showTerminal && (
        <TerminalDrawer onClose={() => setShowTerminal(false)} />
      )}

      {/* Status bar */}
      <StatusBar
        showTerminal={showTerminal}
        onToggleTerminal={toggleTerminal}
      />

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
