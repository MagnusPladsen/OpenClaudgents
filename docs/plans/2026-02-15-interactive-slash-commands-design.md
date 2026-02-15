# Interactive Slash Commands — Issue #1

## Problem
Most slash commands are read-only text dumps. Key commands (/plugins, /mcp) just show info without management capabilities. /restore doesn't exist. /model doesn't actually switch models.

## Scope
Make 4 commands fully interactive:
1. `/restore` — Git-based code restore to previous commit
2. `/plugins` — Install, remove, enable/disable Claude Code plugins
3. `/mcp` — Add, remove, enable/disable MCP servers
4. `/model` — Actually switch the session's model

## Design

### /restore — Git Code Restore
- New command added to commands.ts
- Opens RestoreDialog: lists recent git commits (git log --oneline -20)
- User picks commit, Rust does: git stash (if dirty) then git checkout <hash> -- .
- New Rust command: `git_restore_to_commit(path, commit_hash)` in commands/git.rs
- New tauri.ts wrapper: `gitRestoreToCommit(path, commitHash)`
- New dialog: `src/components/common/RestoreDialog.tsx`
- CommandContext gets `showRestoreDialog: () => void`

### /plugins — Plugin Management
- Opens PluginManagerDialog listing installed plugins
- Actions: install (by name), remove, enable/disable toggle
- Rust commands shell out to: `claude plugin list`, `claude plugin install <name>`, `claude plugin remove <name>`
- New Rust commands in commands/settings.rs: `list_plugins`, `install_plugin`, `remove_plugin`
- New tauri.ts wrappers: `listPlugins()`, `installPlugin(name)`, `removePlugin(name)`
- New dialog: `src/components/common/PluginManagerDialog.tsx`
- CommandContext gets `showPluginManager: () => void`

### /mcp — MCP Server Management
- Opens McpManagerDialog listing configured servers
- Actions: add (name + command + args), remove, toggle enable/disable
- Rust reads/writes ~/.claude/settings.json mcpServers section
- New Rust commands in commands/settings.rs: `add_mcp_server`, `remove_mcp_server`, `toggle_mcp_server`
- New tauri.ts wrappers: `addMcpServer(...)`, `removeMcpServer(name)`, `toggleMcpServer(name)`
- New dialog: `src/components/common/McpManagerDialog.tsx`
- CommandContext gets `showMcpManager: () => void`

### /model — Model Switching
- Shows model picker, sets model on active session
- If session is running: kill session, restart with new model
- Pure frontend: uses existing killSession + createSession(projectPath, newModel)
- Update commandHandlers.ts handler
- CommandContext gets `switchModel: (model: string) => Promise<void>`

## Files to Create
- `src/components/common/RestoreDialog.tsx`
- `src/components/common/PluginManagerDialog.tsx`
- `src/components/common/McpManagerDialog.tsx`

## Files to Modify
- `src/lib/commands.ts` — Add /restore command
- `src/lib/commandHandlers.ts` — Update handlers for all 4 commands
- `src/lib/tauri.ts` — Add new Rust command wrappers
- `src/components/layout/AppShell.tsx` — Mount new dialogs, extend CommandContext
- `src-tauri/src/commands/git.rs` — Add git_restore_to_commit
- `src-tauri/src/commands/settings.rs` — Add plugin + MCP management commands
- `src-tauri/src/lib.rs` — Register new commands

## Implementation Order
1. /model (simplest, pure frontend)
2. /restore (new Rust command + dialog)
3. /plugins (new Rust commands + dialog)
4. /mcp (new Rust commands + dialog)
