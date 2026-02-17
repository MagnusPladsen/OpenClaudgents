# Terminal Drawer — Real Interactive Shell

**Issue:** #6
**Date:** 2026-02-17
**Status:** Approved

## Problem

The Terminal Drawer (`TerminalDrawer.tsx`) currently shows a fake log of chat messages from the Zustand store. It does not provide actual terminal I/O. Users need a real interactive shell for running commands in the project directory.

## Decision

Replace the fake log with a real interactive terminal using `tauri-plugin-pty` (Rust) + `xterm.js` (frontend).

## Architecture

```
TerminalDrawer.tsx
  └── xterm.js Terminal instance (mounted in div ref)
        ├── term.onData(data) → pty.write(data)  (keystrokes → shell)
        └── pty.onData(data) → term.write(data)   (shell output → display)

Rust side:
  lib.rs: .plugin(tauri_plugin_pty::init())

No custom Rust commands needed — the plugin handles PTY lifecycle and IPC.
```

## Dependencies

### Rust
- `tauri-plugin-pty` — Tauri 2 plugin wrapping `portable-pty`

### npm
- `tauri-pty` — JS bindings for the Tauri PTY plugin
- `@xterm/xterm` — Terminal emulator UI
- `@xterm/addon-fit` — Auto-resize terminal to container
- `@xterm/addon-web-links` — Clickable URLs in terminal output

## Component Design

### TerminalDrawer.tsx

- Header: grab handle + "Terminal" label + close button (unchanged)
- Body: `<div ref={termRef}>` where xterm.js mounts
- On mount: create `Terminal`, attach `FitAddon`, open in ref, spawn shell via `tauri-pty`
- Shell cwd: active session's `projectPath` (or `worktreePath` if in worktree)
- Bidirectional wiring: `pty.onData → term.write`, `term.onData → pty.write`
- On unmount: kill PTY process, dispose terminal
- Resize: `FitAddon.fit()` on container resize via `ResizeObserver`, notify PTY of new cols/rows

### Theme Integration

Map CSS custom properties to xterm.js `ITheme`:
- `--theme-bg` → `background`
- `--theme-text` → `foreground`
- `--theme-accent` → `cursor`
- ANSI color palette from theme where available, otherwise use xterm defaults

Re-apply theme when `data-theme` attribute changes (listen via `MutationObserver` on `<html>`).

### Lifecycle

- Shell spawns when drawer opens, kills when drawer closes
- No persistence across open/close (simplest approach)
- Default shell: `$SHELL` env var or `/bin/zsh` fallback

## Scope Boundaries (YAGNI)

- No split panes or multiple terminal tabs
- No shell selector UI
- No persistent shell sessions
- No integration with Claude CLI output (stays in chat pane)

## Capabilities

The `tauri-plugin-pty` requires the `shell:allow-execute` permission or its own permission set. We'll update `capabilities/default.json` as needed.
