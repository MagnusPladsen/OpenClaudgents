# OpenClaudgents — Project Rules

> Desktop GUI (Tauri v2 + React) wrapping Claude Code for multi-agent orchestration.
> Think "Codex App for Claude Code."

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri v2 (Rust backend + native webview) |
| Frontend | React 19 + TypeScript (strict mode) |
| Styling | Tailwind CSS v4 with CSS variable themes |
| State | Zustand 5 (one store per concern) |
| Graph | @xyflow/react (agent visualization) |
| Diff viewer | Monaco Editor (@monaco-editor/react) |
| Database | SQLite via tauri-plugin-sql |
| Build | Vite 6 + pnpm |
| Platforms | macOS + Linux |

## Commands

```bash
pnpm tauri dev              # Full dev mode (frontend + Rust backend, hot-reload)
pnpm tauri build            # Production build (outputs .dmg / .AppImage / .deb)
pnpm dev                    # Frontend only (Vite dev server on :1420)
pnpm build                  # Frontend build only (tsc + vite build)
pnpm exec tsc --noEmit      # TypeScript type check (no output)
pnpm exec vite build        # Vite bundle only
cargo check --manifest-path src-tauri/Cargo.toml  # Rust type check
```

CI runs: TypeScript check, Vite build, Cargo check (macOS + Linux), release build on main.

## Architecture

### Layout: 3-Panel + Terminal Drawer
```
+------------+---------------------------+---------------+
|  Sidebar   |       Chat Pane           |  Preview Pane |
|  (sessions |  (MessageList, Composer,  |  (7 tabs:     |
|   grouped  |   ToolCallBlock,          |   Diff,       |
|   by       |   WelcomeScreen)          |   Context,    |
|   project) |                           |   CLAUDE.md,  |
|            |                           |   Tasks,      |
|  [+ New]   |                           |   Agents,     |
|  [Settings]|                           |   MCP,        |
+------------+---------------------------+   Worktrees)  |
|  > Terminal drawer (Cmd+J)             |               |
+----------------------------------------+---------------+
|  StatusBar: branch | tokens | cost | context bar      |
+-------------------------------------------------------+
```

### Key Decisions
- **CLI-first**: Spawns `claude` CLI processes, inherits user's Max/Pro auth (zero config)
- **Events-first IPC**: Tauri events (`app.emit()`) for streaming data, commands (`invoke()`) for user actions
- **Worktree isolation**: Detached HEAD worktrees in `~/.openclaudgents/worktrees/` (no branch pollution, auto-cleanup)
- **Session data**: Reads Claude Code's JSONL at `~/.claude/projects/{path-encoded}/`
- **Store-per-concern**: Each Zustand store owns one domain (sessions, chat, settings, agent teams)

## Project Structure

```
src/                              # React frontend
  main.tsx                        # Entry point (renders App)
  App.tsx                         # Root component (only default export in codebase)
  components/
    layout/                       # AppShell, Sidebar, ChatPane, PreviewPane, StatusBar, TerminalDrawer
    chat/                         # MessageBubble, Composer, ToolCallBlock, WelcomeScreen, StreamingIndicator, MessageList
    sidebar/                      # SessionList, SessionItem, NewSessionButton
    git/                          # GitStatusBar, MonacoDiffViewer, DiffViewer, WorktreeManager, WorktreePrompt
    agents/                       # AgentGraph, AgentNode, AgentStatusBadge, TeamPanel, TaskListPanel, McpStatusPanel
    context/                      # ContextBudgetBar, TokenCounter, InstructionsPanel
    settings/                     # SettingsDialog, ThemePicker
    common/                       # CommandPalette
  stores/                         # Zustand stores
    sessionStore.ts               # Sessions + active session
    chatStore.ts                  # Messages for active chat
    settingsStore.ts              # User preferences + theme
    agentTeamStore.ts             # Agent team state
  hooks/
    useTauriEvent.ts              # Generic Tauri event listener hook
    useStreamingChat.ts           # Real-time chat updates from CLI stream
    useGitStatus.ts               # Git status polling
    useKeyboardShortcuts.ts       # Global shortcut handler
  lib/
    tauri.ts                      # All Tauri invoke/listen wrappers (single source of truth for IPC)
    types.ts                      # All shared TypeScript interfaces
    cost.ts                       # Token cost estimation
    theme.ts                      # Theme CSS variable loader

src-tauri/                        # Rust backend
  src/
    main.rs                       # Tauri entry point
    lib.rs                        # Module declarations + command registration
    events.rs                     # Event name constants
    commands/
      mod.rs                      # Command module exports
      session.rs                  # Session CRUD + Claude CLI process spawning
      git.rs                      # Git ops, worktree management, diff, stage/commit/push
      settings.rs                 # CLAUDE.md read/write, todo list, settings
      agent_team.rs               # Agent team + MCP server queries
    claude/
      mod.rs                      # Claude module exports
      process.rs                  # Spawn/manage claude CLI child processes
      stream_parser.rs            # Parse NDJSON stream events
      session_store.rs            # Read/watch .jsonl session files
      types.rs                    # Rust types for Claude messages
      agent_teams.rs              # Agent team config parsing
    git/
      mod.rs                      # Git module exports
      worktree.rs                 # Worktree create/remove/cleanup
      status.rs                   # Branch, dirty files, last commit
      diff.rs                     # Generate diffs for UI
    db/
      mod.rs                      # SQLite setup + migrations
  migrations/
    001_initial.sql               # Initial schema

src/styles/
  globals.css                     # Tailwind import + base styles
  themes.css                      # 11 theme definitions via CSS variables
```

## TypeScript Conventions

### Code Style (enforced across all .ts/.tsx files)
- **Semicolons**: Required at end of statements
- **Quotes**: Double quotes (`"`) everywhere (strings, imports, JSX attributes)
- **Indentation**: 2 spaces
- **Trailing commas**: Yes, in multiline arrays/objects/parameters
- **Arrow functions**: For all callbacks and function expressions
- **Named function declarations**: For React components (`export function ComponentName()`)
- **Optional chaining**: Use `?.` and `??` freely
- **No `any`**: TypeScript strict mode is on (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)

### Imports — Order (top to bottom)
1. External libraries (`react`, `@tauri-apps/*`, `zustand`, `@xyflow/react`)
2. Internal modules (relative imports — stores, components, lib)
3. Type-only imports (`import type { ... } from "..."`)

```typescript
import { useState, useRef, useCallback } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import type { ChatMessage } from "../../lib/types";
```

### Interfaces
- **No `I` prefix** — use `SessionState`, not `ISessionState`
- **Interfaces** for object shapes (props, state, data models)
- **Types** for unions and aliases
- **Props interfaces** named `{ComponentName}Props`

```typescript
interface ComposerProps {
  sessionId: string;
  onSend?: (message: string) => void;
  disabled?: boolean;
}
```

### Exports
- **Named exports** for everything: `export function`, `export const`, `export interface`
- **One exception**: `App.tsx` uses `export default App` (only default export in codebase)

## React Patterns

### Component Structure (strict order)
```typescript
// 1. Imports (external → internal → types)
// 2. Props interface
// 3. Component function (exported, named function declaration)
export function MyComponent({ prop1, prop2 }: MyComponentProps) {
  // 4. State hooks (useState, useRef)
  // 5. Store selectors (useXxxStore)
  // 6. Derived values / computations
  // 7. Callbacks (useCallback)
  // 8. Effects (useEffect)
  // 9. Return JSX
}
// 10. Helper functions (not exported, at bottom of file)
```

### Zustand Selectors
```typescript
// Inline arrow selector — always use (s) => pattern
const messages = useChatStore((s) => s.messages);
const isStreaming = useChatStore((s) => s.isStreaming);

// Computed selector
const activeSession = useSessionStore((s) => {
  return s.sessions.find((sess) => sess.id === s.activeSessionId);
});
```

### Zustand Store Shape
```typescript
interface XxxState {
  // Data properties first
  items: Item[];
  activeId: string | null;

  // Actions (verb-prefixed)
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  removeItem: (id: string) => void;

  // Getters (get-prefixed, use `get()` internally)
  getActiveItem: () => Item | undefined;
}

export const useXxxStore = create<XxxState>((set, get) => ({
  // ...
}));
```

### Memo
Only use `React.memo()` for performance-critical components (e.g., `AgentNode` rendered in react-flow graph). Do not memo by default.

### Conditional Rendering
```tsx
{condition && <Component />}       // Short-circuit for presence
{condition ? <A /> : <B />}        // Ternary for either/or
```

## Rust Conventions

### Tauri Command Signatures
```rust
#[tauri::command]
pub async fn command_name(
    arg1: String,
    arg2: Option<String>,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<ReturnType, String> {
    // Always return Result<T, String>
    // Use .map_err(|e| format!("description: {}", e))? for error conversion
}
```

### Serde — Always `rename_all = "camelCase"` for Frontend Structs
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub claude_session_id: Option<String>,  // → claudeSessionId in JSON
    pub project_path: String,               // → projectPath in JSON
}
```

For Claude API types that use their own field names, use explicit `#[serde(rename = "fieldName")]` instead.

### Module Organization
- `mod.rs` in each directory re-exports public items
- `lib.rs` declares all top-level modules and registers commands in `generate_handler![]`
- Group by domain: `commands/`, `claude/`, `git/`, `db/`

### Error Handling
```rust
// Convert errors to String for Tauri command boundary
.map_err(|e| format!("git add failed: {}", e))?;

// For command output errors
if !output.status.success() {
    return Err(String::from_utf8_lossy(&output.stderr).to_string());
}
```

### Event Emission
```rust
// Constants in events.rs
pub const CLAUDE_STREAM_EVENT: &str = "claude:stream_event";

// Emit with app handle
app.emit("claude:stream_event", payload).map_err(|e| e.to_string())?;
```

## CSS & Theming

### Theme System (11 themes)
Themes are defined in `src/styles/themes.css` using CSS variables. Tailwind v4's `@theme` directive maps them to utility classes.

**Two-layer variable system:**
```css
/* Layer 1: @theme block (Tailwind reads these) */
@theme {
  --color-bg: var(--theme-bg, #1a1b26);
}

/* Layer 2: [data-theme="xxx"] selectors (swap values) */
[data-theme="dracula"] {
  --theme-bg: #282a36;
}
```

**Available themes:** Tokyo Night (default), Dracula, Catppuccin Mocha, Catppuccin Latte (light), Nord, One Dark, Gruvbox Dark, Kanagawa, Monokai Pro, Rose Pine, Solarized Dark

### Semantic Color Classes (use these, not raw hex)
| Purpose | Background | Text | Border |
|---------|-----------|------|--------|
| Primary | `bg-bg` | `text-text` | `border-border` |
| Secondary | `bg-bg-secondary` | `text-text-secondary` | `border-border-focus` |
| Tertiary | `bg-bg-tertiary` | `text-text-muted` | |
| Accent | `bg-accent` / `bg-accent-hover` | `text-accent` | |
| Status | `bg-success` / `bg-warning` / `bg-error` / `bg-info` | `text-success` etc. | |
| Chat | `bg-user-bubble` / `bg-assistant-bubble` / `bg-tool-call-bg` / `bg-code-bg` | | |

### Rules
- Use Tailwind utility classes exclusively (no custom CSS class names)
- No inline `style=` except for truly dynamic values (e.g., calculated widths)
- Import order in globals.css: `@import "tailwindcss"` then `@import "./themes.css"`

## Tauri IPC Contract

### Command Naming
| Rust (snake_case) | TypeScript wrapper (camelCase) | invoke string |
|---|---|---|
| `pub async fn create_session()` | `export async function createSession()` | `"create_session"` |
| `pub async fn get_git_status()` | `export async function getGitStatus()` | `"get_git_status"` |

All TypeScript wrappers live in `src/lib/tauri.ts`. This is the **single source of truth** for IPC. Components never call `invoke()` directly.

### Event Naming (`namespace:event_name`)
| Rust constant | Event string | TypeScript listener |
|---|---|---|
| `CLAUDE_STREAM_EVENT` | `"claude:stream_event"` | `onClaudeStreamEvent()` |
| `CLAUDE_MESSAGE_COMPLETE` | `"claude:message_complete"` | `onClaudeMessageComplete()` |
| `CLAUDE_SESSION_STATUS` | `"claude:session_status"` | `onSessionStatusChanged()` |
| `CLAUDE_USAGE_UPDATE` | `"claude:usage_update"` | `onUsageUpdate()` |
| `CLAUDE_COMPACTION` | `"claude:compaction"` | — |
| `GIT_STATUS_CHANGED` | `"git:status_changed"` | — |
| `SESSION_DISCOVERED` | `"session:discovered"` | — |

Event listeners in `tauri.ts` follow pattern: `on{EventName}(callback): Promise<UnlistenFn>`

### Type Serialization
Rust structs with `#[serde(rename_all = "camelCase")]` auto-convert to TypeScript-compatible JSON. The TypeScript interfaces in `src/lib/types.ts` mirror the Rust structs exactly.

## File Naming

| Category | Convention | Example |
|----------|-----------|---------|
| React components | PascalCase `.tsx` | `MessageBubble.tsx`, `AppShell.tsx` |
| Hooks | camelCase with `use` prefix `.ts` | `useStreamingChat.ts` |
| Stores | camelCase with `Store` suffix `.ts` | `sessionStore.ts` |
| Utilities | camelCase `.ts` | `cost.ts`, `theme.ts`, `tauri.ts` |
| Types | camelCase `.ts` | `types.ts` |
| Rust modules | snake_case `.rs` | `stream_parser.rs`, `session_store.rs` |
| CSS | kebab-case `.css` | `globals.css`, `themes.css` |
| SQL migrations | `NNN_description.sql` | `001_initial.sql` |

## Key File Paths

| What | Path |
|------|------|
| React entry | `src/main.tsx` |
| App root component | `src/App.tsx` |
| All TypeScript interfaces | `src/lib/types.ts` |
| All Tauri IPC wrappers | `src/lib/tauri.ts` |
| Token cost estimation | `src/lib/cost.ts` |
| Theme variable definitions | `src/styles/themes.css` |
| Base styles + Tailwind import | `src/styles/globals.css` |
| Rust entry point | `src-tauri/src/main.rs` |
| Rust module + command registration | `src-tauri/src/lib.rs` |
| Event name constants | `src-tauri/src/events.rs` |
| SQLite migrations | `src-tauri/migrations/001_initial.sql` |
| Tauri config | `src-tauri/tauri.conf.json` |
| Tauri capabilities | `src-tauri/capabilities/default.json` |
| CI workflow | `.github/workflows/build.yml` |

## Don'ts

- **No `any` types** — use `unknown` + type narrowing, or `Record<string, unknown>`
- **No default exports** — except `App.tsx`
- **No custom CSS classes** — Tailwind utilities only
- **No raw hex colors** — use semantic theme variables (`bg-bg`, `text-accent`, etc.)
- **No direct `invoke()` calls in components** — go through `src/lib/tauri.ts` wrappers
- **No `I` prefix on interfaces** — just `SessionState`, not `ISessionState`
- **No inline styles** — except for dynamic computed values
- **No `function` keyword for callbacks** — use arrow functions
- **No single quotes in TypeScript** — double quotes only
