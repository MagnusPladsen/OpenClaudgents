# Terminal Drawer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fake message log in TerminalDrawer with a real interactive shell using xterm.js + tauri-plugin-pty.

**Architecture:** The Tauri PTY plugin handles shell spawning and IPC on the Rust side. The frontend mounts an xterm.js Terminal in a div ref, wires bidirectional data between the PTY and the terminal UI, and maps theme CSS variables to xterm's ITheme.

**Tech Stack:** tauri-plugin-pty (Rust), tauri-pty + @xterm/xterm + @xterm/addon-fit + @xterm/addon-web-links (npm)

---

### Task 1: Install dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`

**Step 1: Add Rust dependency**

Run:
```bash
cd src-tauri && cargo add tauri-plugin-pty && cd ..
```

**Step 2: Add npm dependencies**

Run:
```bash
pnpm add tauri-pty @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
```

**Step 3: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compiles with no new errors (pre-existing warnings OK)

**Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock package.json pnpm-lock.yaml
git commit -m "chore: add tauri-plugin-pty and xterm.js dependencies"
```

---

### Task 2: Register PTY plugin in Tauri backend

**Files:**
- Modify: `src-tauri/src/lib.rs:16-18`
- Modify: `src-tauri/capabilities/default.json`

**Step 1: Add plugin registration**

In `src-tauri/src/lib.rs`, add the PTY plugin to the builder chain. Place it after the existing `.plugin()` calls:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_pty::init())   // <-- ADD THIS LINE
    .plugin(
        tauri_plugin_sql::Builder::default()
```

**Step 2: Add PTY permissions to capabilities**

In `src-tauri/capabilities/default.json`, add `"pty:default"` to the permissions array:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "pty:default"
  ]
}
```

The `pty:default` permission bundle includes: allow-spawn, allow-read, allow-write, allow-resize, allow-kill, allow-exitstatus.

**Step 3: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compiles clean

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: register tauri-plugin-pty and add PTY permissions"
```

---

### Task 3: Create xterm theme helper

**Files:**
- Create: `src/lib/terminalTheme.ts`

**Step 1: Create the theme mapping utility**

This file reads CSS custom properties from the document and returns an xterm.js ITheme object. It also provides a function to observe theme changes.

```typescript
import type { ITheme } from "@xterm/xterm";

/**
 * Reads the current CSS theme variables and returns an xterm.js ITheme.
 * Falls back to sensible defaults if variables are not set.
 */
export function getXtermTheme(): ITheme {
  const style = getComputedStyle(document.documentElement);
  const get = (varName: string, fallback: string): string =>
    style.getPropertyValue(varName).trim() || fallback;

  return {
    background: get("--theme-bg", "#1a1b26"),
    foreground: get("--theme-text", "#c0caf5"),
    cursor: get("--theme-accent", "#7aa2f7"),
    cursorAccent: get("--theme-bg", "#1a1b26"),
    selectionBackground: get("--theme-accent", "#7aa2f7") + "40",
    selectionForeground: get("--theme-text", "#c0caf5"),
    black: get("--theme-bg-tertiary", "#2f3549"),
    red: get("--theme-error", "#f7768e"),
    green: get("--theme-success", "#9ece6a"),
    yellow: get("--theme-warning", "#e0af68"),
    blue: get("--theme-accent", "#7aa2f7"),
    magenta: get("--theme-accent-hover", "#89b4fa"),
    cyan: get("--theme-info", "#7dcfff"),
    white: get("--theme-text", "#c0caf5"),
    brightBlack: get("--theme-text-muted", "#565f89"),
    brightRed: get("--theme-error", "#f7768e"),
    brightGreen: get("--theme-success", "#9ece6a"),
    brightYellow: get("--theme-warning", "#e0af68"),
    brightBlue: get("--theme-accent", "#7aa2f7"),
    brightMagenta: get("--theme-accent-hover", "#89b4fa"),
    brightCyan: get("--theme-info", "#7dcfff"),
    brightWhite: get("--theme-text-secondary", "#a9b1d6"),
  };
}

/**
 * Observes `data-theme` attribute changes on the document element.
 * Calls `onThemeChange` with the new xterm theme whenever it changes.
 * Returns a cleanup function to disconnect the observer.
 */
export function observeThemeChanges(onThemeChange: (theme: ITheme) => void): () => void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
        // Small delay to let CSS variables update
        requestAnimationFrame(() => {
          onThemeChange(getXtermTheme());
        });
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return () => observer.disconnect();
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/terminalTheme.ts
git commit -m "feat: add xterm.js theme mapping from CSS variables"
```

---

### Task 4: Rewrite TerminalDrawer with xterm.js

**Files:**
- Modify: `src/components/layout/TerminalDrawer.tsx` (full rewrite)

**Step 1: Rewrite the component**

Replace the entire file content. The component:
- Mounts xterm.js Terminal in a div ref
- Spawns a PTY shell via `tauri-pty`'s `spawn()`
- Wires bidirectional I/O (pty.onData → term.write, term.onData → pty.write)
- Uses FitAddon for auto-resize with ResizeObserver
- Applies theme from CSS variables, re-applies on theme change
- Cleans up PTY + terminal on unmount

```typescript
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
      allowProposedApi: true,
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

    // Determine shell
    // Note: In Tauri/webview context, process.env is not available.
    // We pass the shell path from the Rust side or use a default.
    const shell = "/bin/zsh";

    // Spawn PTY
    const pty = spawn(shell, [], {
      cols: terminal.cols,
      rows: terminal.rows,
      cwd: cwd,
    });

    // Bidirectional wiring
    const ptyDataDisposable = pty.onData((data: string) => {
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
    const exitDisposable = pty.onExit((_exitData: { exitCode: number }) => {
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 3: Verify Vite build**

Run: `pnpm exec vite build`
Expected: Builds successfully

**Step 4: Commit**

```bash
git add src/components/layout/TerminalDrawer.tsx
git commit -m "feat: rewrite terminal drawer with real xterm.js + PTY shell"
```

---

### Task 5: Verify full build

**Files:** None (verification only)

**Step 1: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 2: Vite build**

Run: `pnpm exec vite build`
Expected: Builds successfully

**Step 3: Rust check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compiles (pre-existing warnings OK)

**Step 4: Full Tauri dev check (optional)**

Run: `pnpm tauri dev`
Expected: App launches, Cmd+J opens terminal drawer with working shell

**Step 5: Final commit if any adjustments needed**

Squash-fix anything found during verification.
