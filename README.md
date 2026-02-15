# OpenClaudgents

[![Build & Check](https://github.com/magnuspladsen/OpenClaudgents/actions/workflows/build.yml/badge.svg)](https://github.com/magnuspladsen/OpenClaudgents/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: macOS | Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey.svg)]()

Open-source desktop app for visualizing and orchestrating Claude Code agent teams in real-time. Tree/graph view of running agents, live output streaming, session management, and diff previews. Built with Tauri + React for macOS and Linux.

![OpenClaudgents v0.1.0](https://github.com/user-attachments/assets/6b08adf9-7414-4556-a9d5-bcf43abe02d5)

> **v0.1.0 Pre-release** — MVP is live! Sessions pane, terminal, real-time chat, themes, slash commands, command palette, and context/agent/task status. [Download the release](https://github.com/MagnusPladsen/OpenClaudgents/releases/tag/v0.1.0)

## Features

- **Multi-session chat** -- Run and switch between multiple Claude Code sessions from a single window. Messages stream in real-time via Claude CLI's `stream-json` output.
- **Git worktree isolation** -- Each agent gets its own git worktree (detached HEAD, no branch pollution). Auto-cleanup after 4 days or when >10 worktrees exist. Snapshots saved before deletion.
- **Agent team visualization** -- See your Claude Code agent teams as an interactive graph (react-flow). Lead agent at top, teammates below, with live status indicators.
- **Context budget tracking** -- Progress bar showing how much of Claude's 200k context window is used. Color thresholds at 70/85/95%. Detects context compaction events.
- **Monaco diff viewer** -- VS Code-quality side-by-side or inline diffs with syntax highlighting. File selector, language detection for 30+ file types.
- **CLAUDE.md editor** -- View and edit your project instructions in-app. Auto-refreshes on external changes.
- **Task/TODO tracker** -- Reads Claude's todo files from `~/.claude/todos/` and `~/.claude/tasks/`. Progress bar, status filters.
- **MCP server status** -- Lists configured MCP servers from `~/.claude/settings.json` with connection status.
- **Command palette** -- `Cmd+K` fuzzy-search command palette with keyboard navigation.
- **11 built-in themes** -- Tokyo Night, Catppuccin Mocha/Latte, Dracula, Gruvbox Dark, Kanagawa, Monokai Pro, Nord, One Dark, Rose Pine, Solarized Dark.
- **Terminal drawer** -- `Cmd+J` to toggle raw terminal output as a fallback view.
- **CLI prerequisite check** -- Warning banner if `claude` CLI is not detected on startup.

## Layout

```
+-------------+----------------------------+--------------+
|  Sessions   |         Chat               |   Preview    |
|  sidebar    |   (streaming messages,     |   (7 tabs:   |
|  (grouped   |    tool call blocks,       |    Diff,     |
|   by        |    markdown rendering)     |    Context,  |
|   project)  |                            |    CLAUDE.md,|
|             |   +---------------------+  |    Tasks,    |
|             |   | Composer (Enter/    |  |    Agents,   |
|             |   | Shift+Enter)        |  |    MCP,      |
|  [+ New]    |   +---------------------+  |    Worktrees)|
|  [Settings] |                            |              |
+-------------+----------------------------+--------------+
|  > Terminal drawer (Cmd+J)                              |
+---------------------------------------------------------+
|  Status: branch | tokens | cost | context bar           |
+---------------------------------------------------------+
```

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Claude Code](https://claude.ai/code) CLI (`npm install -g @anthropic-ai/claude-code`)

**Linux only:**
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## Getting Started

```bash
# Clone the repo
git clone https://github.com/magnuspladsen/OpenClaudgents.git
cd OpenClaudgents

# Install frontend dependencies
pnpm install

# Run in development mode (hot-reload frontend + Rust rebuild)
pnpm tauri dev
```

The app will open automatically. Make sure `claude` CLI is installed and available in your PATH.

## Development

```bash
pnpm tauri dev              # Full dev mode (frontend + Rust backend)
pnpm dev                    # Frontend only (Vite dev server on :1420)
pnpm exec tsc --noEmit      # TypeScript type check
pnpm exec vite build        # Frontend build only
cargo check --manifest-path src-tauri/Cargo.toml  # Rust type check
```

## Production Build

```bash
# Build the full Tauri app (macOS .dmg / Linux .AppImage + .deb)
pnpm tauri build
```

Outputs are in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 (Rust backend + native webview) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 (CSS variable themes) |
| State management | Zustand 5 (separate stores per concern) |
| Diff viewer | Monaco Editor (@monaco-editor/react) |
| Agent graph | @xyflow/react (react-flow) |
| Database | SQLite (tauri-plugin-sql) |
| Build tool | Vite 6 |

## Project Structure

```
src/                    # React frontend
  components/
    layout/             # AppShell, Sidebar, ChatPane, PreviewPane, StatusBar, TerminalDrawer
    chat/               # MessageBubble, Composer, ToolCallBlock, WelcomeScreen
    sidebar/            # SessionList, SessionItem, NewSessionButton
    git/                # GitStatusBar, MonacoDiffViewer, WorktreeManager, DiffViewer
    agents/             # AgentGraph, AgentNode, TeamPanel, TaskListPanel, McpStatusPanel
    context/            # ContextBudgetBar, TokenCounter, InstructionsPanel
    settings/           # SettingsDialog, ThemePicker
    common/             # CommandPalette
  stores/               # Zustand stores (session, chat, agentTeam, settings)
  hooks/                # useTauriEvent, useGitStatus, useStreamingChat
  lib/                  # tauri.ts (IPC wrappers), types.ts, theme.ts, cost.ts
  styles/               # globals.css, themes.css (11 themes)

src-tauri/              # Rust backend
  src/
    commands/           # Tauri command handlers (session, git, settings, agent_team)
    claude/             # CLI process manager, stream parser, session store, agent teams
    git/                # Worktree manager, status, diff
    db/                 # SQLite setup + migrations
    events.rs           # Event name constants
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Command palette |
| `Cmd+J` | Toggle terminal drawer |
| `Cmd+,` | Settings |
| `Enter` | Send message |
| `Shift+Enter` | New line in composer |
| `/` | Slash command autocomplete |

## Contributing

1. Read [`CLAUDE.md`](CLAUDE.md) for project conventions and coding rules
2. Fork the repo and create a feature branch
3. Make sure `pnpm exec tsc --noEmit` and `cargo check` pass before submitting a PR
4. CI will run TypeScript checks, Vite build, and Cargo check on macOS + Linux

## License

[MIT](LICENSE)
