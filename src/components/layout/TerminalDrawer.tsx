import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { spawn } from "tauri-pty";
import { useSessionStore } from "../../stores/sessionStore";
import { getXtermTheme, observeThemeChanges } from "../../lib/terminalTheme";
import "@xterm/xterm/css/xterm.css";

interface TerminalDrawerProps {
  onClose: () => void;
}

export function TerminalDrawer({ onClose }: TerminalDrawerProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });
  const cwd = activeSession?.worktreePath || activeSession?.projectPath || undefined;

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const container = termRef.current;
    if (!container) return;

    // Create terminal
    const terminal = new Terminal({
      theme: getXtermTheme(),
      fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
    });
    terminalRef.current = terminal;

    // Addons
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    // Mount
    terminal.open(container);

    // Initial fit (defer to next frame so container has dimensions)
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Spawn PTY with default shell
    const shell = "/bin/zsh";
    const pty = spawn(shell, [], {
      cols: terminal.cols,
      rows: terminal.rows,
      cwd: cwd,
    });

    // Bidirectional wiring
    // pty.onData sends Uint8Array — xterm.js Terminal.write() accepts Uint8Array directly
    const ptyDataDisposable = pty.onData((data: Uint8Array) => {
      terminal.write(data);
    });
    const termDataDisposable = terminal.onData((data: string) => {
      pty.write(data);
    });

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
        pty.resize(terminal.cols, terminal.rows);
      });
    });
    resizeObserver.observe(container);

    // Theme changes
    const disconnectThemeObserver = observeThemeChanges((theme) => {
      terminal.options.theme = theme;
    });

    // PTY exit
    const exitDisposable = pty.onExit(() => {
      terminal.writeln("\r\n\x1b[90m[Process exited]\x1b[0m");
    });

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      disconnectThemeObserver();
      ptyDataDisposable.dispose();
      termDataDisposable.dispose();
      exitDisposable.dispose();
      pty.kill();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [cwd]);

  return (
    <div className="flex h-64 flex-col bg-code-bg shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.3)]">
      {/* Header with grab handle */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Grab handle bar */}
          <div className="h-1 w-8 rounded-full bg-border/60" />
          <span className="font-mono text-xs font-medium text-text-secondary">
            Terminal
          </span>
          {cwd && (
            <span className="font-mono text-[10px] text-text-muted">
              {cwd.split("/").slice(-2).join("/")}
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-all hover:bg-bg-tertiary hover:text-text"
          aria-label="Close terminal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Terminal container */}
      <div ref={termRef} className="min-h-0 flex-1 px-1" />
    </div>
  );
}
