# Interactive Slash Commands — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make /model, /restore, /plugins, and /mcp slash commands fully interactive with real backend operations.

**Architecture:** Extend existing command system (commands.ts → commandHandlers.ts → CommandContext). New Rust commands in git.rs and settings.rs for backend operations. Three new dialog components for /restore, /plugins, and /mcp. /model is pure frontend.

**Tech Stack:** React 19, Zustand, Tauri v2 (Rust), Claude CLI (`claude plugin`, `claude mcp` subcommands)

---

### Task 1: /model — Make model switching functional

**Files:**
- Modify: `src/lib/commandHandlers.ts` (lines 129-141, model case)
- Modify: `src/components/layout/AppShell.tsx` (CommandContext builder)

**Step 1: Update CommandContext interface**

In `src/lib/commandHandlers.ts`, add to the `CommandContext` interface:

```typescript
switchModel: (model: string) => Promise<void>;
```

**Step 2: Rewrite the /model handler**

Replace the `case "model":` block in `executeCommand()`:

```typescript
case "model": {
  const session = ctx.getActiveSession();
  const MODELS: Record<string, string> = {
    sonnet: "claude-sonnet-4-5-20250929",
    opus: "claude-opus-4-6",
    haiku: "claude-haiku-4-5-20251001",
  };
  if (!args) {
    const current = session?.model ? getModelDisplayName(session.model) : "none";
    ctx.addSystemMessage(
      `**Current model:** ${current}\n\n` +
      "**Available models:**\n" +
      "- `sonnet` — Claude Sonnet 4.5 (fast, balanced)\n" +
      "- `opus` — Claude Opus 4.6 (most capable)\n" +
      "- `haiku` — Claude Haiku 4.5 (fastest, cheapest)\n\n" +
      "Usage: **/model <name>**",
    );
    return true;
  }
  const modelId = MODELS[args.toLowerCase()];
  if (!modelId) {
    ctx.addSystemMessage(
      `Unknown model "${args}". Available: sonnet, opus, haiku`,
    );
    return true;
  }
  if (!session) {
    ctx.addSystemMessage("No active session. The model will be used for the next session.");
    return true;
  }
  try {
    await ctx.switchModel(modelId);
    ctx.addSystemMessage(`Model switched to **${getModelDisplayName(modelId)}**.`);
  } catch (err) {
    ctx.addSystemMessage(`Failed to switch model: ${err}`);
  }
  return true;
}
```

**Step 3: Implement switchModel in AppShell**

In `AppShell.tsx`, add `switchModel` to the `buildContext()` return object:

```typescript
switchModel: async (model: string) => {
  const session = useSessionStore.getState().getActiveSession();
  if (!session) return;
  const projectPath = session.worktreePath || session.projectPath;
  try {
    await killSession(session.id);
  } catch { /* may already be dead */ }
  const newSession = await createSession(projectPath, model);
  addSession(newSession);
  setActiveSession(newSession.id);
  clearMessages();
},
```

Add `killSession` to the existing imports from `../../lib/tauri` in AppShell.tsx (it's already imported via the `createSession` import line — check if `killSession` is there; if not, add it).

**Step 4: Verify**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm exec vite build`

**Step 5: Commit**

```
feat: make /model command actually switch session model
```

---

### Task 2: /restore — Rust backend (git_restore_to_commit + git_log_commits)

**Files:**
- Modify: `src-tauri/src/commands/git.rs`
- Modify: `src-tauri/src/lib.rs` (register new commands)

**Step 1: Add git_log_commits command**

Append to `src-tauri/src/commands/git.rs`:

```rust
/// A single commit entry for the restore dialog
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

/// Get recent git commits for restore dialog
#[tauri::command]
pub async fn git_log_commits(path: String, count: Option<usize>) -> Result<Vec<GitCommitInfo>, String> {
    let n = count.unwrap_or(20);
    let output = std::process::Command::new("git")
        .args(["log", &format!("-{}", n), "--format=%H%n%h%n%s%n%an%n%aI", "--"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("git log failed: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().collect();
    let mut commits = vec![];

    for chunk in lines.chunks(5) {
        if chunk.len() < 5 { break; }
        commits.push(GitCommitInfo {
            hash: chunk[0].to_string(),
            short_hash: chunk[1].to_string(),
            message: chunk[2].to_string(),
            author: chunk[3].to_string(),
            date: chunk[4].to_string(),
        });
    }

    Ok(commits)
}
```

**Step 2: Add git_restore_to_commit command**

Append to `src-tauri/src/commands/git.rs`:

```rust
/// Restore working directory to a specific commit's state.
/// Stashes current changes if dirty, then checks out files from the target commit.
#[tauri::command]
pub async fn git_restore_to_commit(path: String, commit_hash: String) -> Result<String, String> {
    // Check if working directory is dirty
    let status_output = std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("git status failed: {}", e))?;

    let is_dirty = !String::from_utf8_lossy(&status_output.stdout).trim().is_empty();
    let mut result = String::new();

    // Stash if dirty
    if is_dirty {
        let stash_output = std::process::Command::new("git")
            .args(["stash", "push", "-m", &format!("openclaudgents-restore-{}", &commit_hash[..8.min(commit_hash.len())])])
            .current_dir(&path)
            .output()
            .map_err(|e| format!("git stash failed: {}", e))?;

        if !stash_output.status.success() {
            return Err(format!("Failed to stash changes: {}", String::from_utf8_lossy(&stash_output.stderr)));
        }
        result.push_str("Stashed current changes. ");
    }

    // Restore files from the target commit
    let restore_output = std::process::Command::new("git")
        .args(["checkout", &commit_hash, "--", "."])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("git checkout failed: {}", e))?;

    if !restore_output.status.success() {
        return Err(format!("Failed to restore: {}", String::from_utf8_lossy(&restore_output.stderr)));
    }

    result.push_str(&format!("Restored files to commit {}.", &commit_hash[..8.min(commit_hash.len())]));
    Ok(result)
}
```

**Step 3: Register in lib.rs**

Add to the `generate_handler![]` macro in `src-tauri/src/lib.rs`:

```rust
commands::git::git_log_commits,
commands::git::git_restore_to_commit,
```

**Step 4: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

**Step 5: Commit**

```
feat: add git_log_commits and git_restore_to_commit Rust commands
```

---

### Task 3: /restore — Frontend (tauri wrapper + dialog + wiring)

**Files:**
- Modify: `src/lib/tauri.ts` — Add wrappers
- Create: `src/components/common/RestoreDialog.tsx`
- Modify: `src/lib/commands.ts` — Add /restore command
- Modify: `src/lib/commandHandlers.ts` — Add handler + context
- Modify: `src/components/layout/AppShell.tsx` — Mount dialog + wire context

**Step 1: Add TypeScript types and tauri wrappers**

In `src/lib/tauri.ts`, add the interface and wrappers:

```typescript
export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export async function gitLogCommits(
  path: string,
  count?: number,
): Promise<GitCommitInfo[]> {
  return invoke("git_log_commits", { path, count: count ?? null });
}

export async function gitRestoreToCommit(
  path: string,
  commitHash: string,
): Promise<string> {
  return invoke("git_restore_to_commit", { path, commitHash });
}
```

**Step 2: Create RestoreDialog component**

Create `src/components/common/RestoreDialog.tsx`:

- Props: `isOpen`, `onClose`, `onRestore: (commitHash: string) => void`
- On open, calls `gitLogCommits(projectPath)` to get commit list
- Displays as a modal overlay (same pattern as RewindDialog/SettingsDialog)
- Each commit row shows: short hash (monospace), message, author, relative date
- Click a commit → calls `onRestore(hash)` → dialog closes
- Loading/error states handled

**Step 3: Add /restore command definition**

In `src/lib/commands.ts`, add to the SLASH_COMMANDS array (session section):

```typescript
{ name: "restore", description: "Restore code to a previous commit", category: "session" },
```

**Step 4: Add handler and context**

In `src/lib/commandHandlers.ts`:
- Add `showRestoreDialog: () => void` to CommandContext interface
- Add case for "restore":
```typescript
case "restore": {
  const session = ctx.getActiveSession();
  if (!session) {
    ctx.addSystemMessage("No active session.");
    return true;
  }
  ctx.showRestoreDialog();
  return true;
}
```

**Step 5: Mount in AppShell**

In `AppShell.tsx`:
- Add state: `const [showRestoreDialog, setShowRestoreDialog] = useState(false);`
- Add `showRestoreDialog: () => setShowRestoreDialog(true)` to buildContext()
- Mount `<RestoreDialog>` with `isOpen={showRestoreDialog}` and wire `onRestore` to call `gitRestoreToCommit` then show success message

**Step 6: Verify**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm exec vite build`

**Step 7: Commit**

```
feat: add /restore command with git commit picker dialog
```

---

### Task 4: /plugins — Rust backend (claude plugin CLI commands)

**Files:**
- Modify: `src-tauri/src/commands/settings.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add plugin management commands**

Append to `src-tauri/src/commands/settings.rs`:

```rust
/// A plugin entry from `claude plugin list`
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub name: String,
    pub version: String,
    pub enabled: bool,
}

/// List installed Claude Code plugins by running `claude plugin list`
#[tauri::command]
pub async fn list_plugins() -> Result<Vec<PluginInfo>, String> {
    let cli = find_claude_cli()?;
    let output = std::process::Command::new(&cli)
        .args(["plugin", "list", "--json"])
        .output()
        .map_err(|e| format!("Failed to run claude plugin list: {}", e))?;

    if !output.status.success() {
        // If --json not supported, try plain text
        let plain_output = std::process::Command::new(&cli)
            .args(["plugin", "list"])
            .output()
            .map_err(|e| format!("Failed to run claude plugin list: {}", e))?;

        let stdout = String::from_utf8_lossy(&plain_output.stdout);
        let plugins: Vec<PluginInfo> = stdout
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|line| {
                let parts: Vec<&str> = line.splitn(2, ' ').collect();
                PluginInfo {
                    name: parts.first().unwrap_or(&"").to_string(),
                    version: parts.get(1).unwrap_or(&"").trim().to_string(),
                    enabled: true,
                }
            })
            .collect();
        return Ok(plugins);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse plugin list: {}", e))
}

/// Install a Claude Code plugin
#[tauri::command]
pub async fn install_plugin(name: String) -> Result<String, String> {
    let cli = find_claude_cli()?;
    let output = std::process::Command::new(&cli)
        .args(["plugin", "add", &name])
        .output()
        .map_err(|e| format!("Failed to install plugin: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Remove a Claude Code plugin
#[tauri::command]
pub async fn remove_plugin(name: String) -> Result<String, String> {
    let cli = find_claude_cli()?;
    let output = std::process::Command::new(&cli)
        .args(["plugin", "remove", &name])
        .output()
        .map_err(|e| format!("Failed to remove plugin: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Find the claude CLI binary path
fn find_claude_cli() -> Result<String, String> {
    // Check common paths
    let candidates = [
        "/opt/homebrew/bin/claude",
        "/usr/local/bin/claude",
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }
    // Try PATH
    let output = std::process::Command::new("which")
        .arg("claude")
        .output()
        .map_err(|e| format!("which failed: {}", e))?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }
    Err("Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code".to_string())
}
```

**Step 2: Register in lib.rs**

Add to generate_handler![]:
```rust
commands::settings::list_plugins,
commands::settings::install_plugin,
commands::settings::remove_plugin,
```

**Step 3: Verify**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

**Step 4: Commit**

```
feat: add plugin management Rust commands (list, install, remove)
```

---

### Task 5: /plugins — Frontend (dialog + wiring)

**Files:**
- Modify: `src/lib/tauri.ts`
- Create: `src/components/common/PluginManagerDialog.tsx`
- Modify: `src/lib/commandHandlers.ts`
- Modify: `src/components/layout/AppShell.tsx`

**Step 1: Add tauri wrappers**

In `src/lib/tauri.ts`:

```typescript
export interface PluginInfo {
  name: string;
  version: string;
  enabled: boolean;
}

export async function listPlugins(): Promise<PluginInfo[]> {
  return invoke("list_plugins");
}

export async function installPlugin(name: string): Promise<string> {
  return invoke("install_plugin", { name });
}

export async function removePlugin(name: string): Promise<string> {
  return invoke("remove_plugin", { name });
}
```

**Step 2: Create PluginManagerDialog**

Create `src/components/common/PluginManagerDialog.tsx`:
- Props: `isOpen`, `onClose`
- On open, calls `listPlugins()` to fetch installed plugins
- Displays list of plugins with name, version, remove button
- "Install" section at bottom: text input + install button
- Loading, empty, and error states
- Same modal overlay pattern as other dialogs

**Step 3: Wire into commandHandlers + AppShell**

- Add `showPluginManager: () => void` to CommandContext
- Replace `/plugins` handler to call `ctx.showPluginManager()`
- In AppShell: add state, mount dialog, wire context

**Step 4: Verify**

Run: `pnpm exec tsc --noEmit && pnpm exec vite build`

**Step 5: Commit**

```
feat: add /plugins command with plugin management dialog
```

---

### Task 6: /mcp — Rust backend (MCP server management)

**Files:**
- Modify: `src-tauri/src/commands/settings.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add MCP management commands**

Append to `src-tauri/src/commands/settings.rs`:

```rust
/// Add an MCP server to ~/.claude/settings.json
#[tauri::command]
pub async fn add_mcp_server(
    name: String,
    command: String,
    args: Vec<String>,
) -> Result<(), String> {
    modify_mcp_settings(|mcp| {
        let mut server = serde_json::Map::new();
        server.insert("command".to_string(), serde_json::Value::String(command));
        server.insert(
            "args".to_string(),
            serde_json::Value::Array(args.into_iter().map(serde_json::Value::String).collect()),
        );
        mcp.insert(name, serde_json::Value::Object(server));
    })
}

/// Remove an MCP server from ~/.claude/settings.json
#[tauri::command]
pub async fn remove_mcp_server(name: String) -> Result<(), String> {
    modify_mcp_settings(|mcp| {
        mcp.remove(&name);
    })
}

/// Toggle an MCP server's enabled/disabled state
#[tauri::command]
pub async fn toggle_mcp_server(name: String) -> Result<bool, String> {
    let mut new_enabled = true;
    modify_mcp_settings(|mcp| {
        if let Some(server) = mcp.get_mut(&name).and_then(|v| v.as_object_mut()) {
            let currently_disabled = server
                .get("disabled")
                .and_then(|d| d.as_bool())
                .unwrap_or(false);
            new_enabled = currently_disabled; // flip
            if new_enabled {
                server.remove("disabled");
            } else {
                server.insert("disabled".to_string(), serde_json::Value::Bool(true));
            }
        }
    })?;
    Ok(new_enabled)
}

/// Helper: read settings.json, modify the mcpServers section, write back
fn modify_mcp_settings(modify: impl FnOnce(&mut serde_json::Map<String, serde_json::Value>)) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let settings_path = home.join(".claude").join("settings.json");

    let mut config: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings.json: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings.json: {}", e))?
    } else {
        serde_json::json!({})
    };

    let obj = config.as_object_mut().ok_or("settings.json is not an object")?;

    if !obj.contains_key("mcpServers") {
        obj.insert("mcpServers".to_string(), serde_json::json!({}));
    }

    let mcp = obj
        .get_mut("mcpServers")
        .and_then(|v| v.as_object_mut())
        .ok_or("mcpServers is not an object")?;

    modify(mcp);

    // Ensure parent dir exists
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .claude dir: {}", e))?;
    }

    let formatted = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    std::fs::write(&settings_path, formatted)
        .map_err(|e| format!("Failed to write settings.json: {}", e))?;

    Ok(())
}
```

**Step 2: Register in lib.rs**

Add to generate_handler![]:
```rust
commands::settings::add_mcp_server,
commands::settings::remove_mcp_server,
commands::settings::toggle_mcp_server,
```

**Step 3: Verify**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

**Step 4: Commit**

```
feat: add MCP server management Rust commands (add, remove, toggle)
```

---

### Task 7: /mcp — Frontend (dialog + wiring)

**Files:**
- Modify: `src/lib/tauri.ts`
- Create: `src/components/common/McpManagerDialog.tsx`
- Modify: `src/lib/commandHandlers.ts`
- Modify: `src/components/layout/AppShell.tsx`

**Step 1: Add tauri wrappers**

In `src/lib/tauri.ts`:

```typescript
export async function addMcpServer(
  name: string,
  command: string,
  args: string[],
): Promise<void> {
  return invoke("add_mcp_server", { name, command, args });
}

export async function removeMcpServer(name: string): Promise<void> {
  return invoke("remove_mcp_server", { name });
}

export async function toggleMcpServer(name: string): Promise<boolean> {
  return invoke("toggle_mcp_server", { name });
}
```

**Step 2: Create McpManagerDialog**

Create `src/components/common/McpManagerDialog.tsx`:
- Props: `isOpen`, `onClose`
- On open, calls `getMcpServers()` (already exists) to fetch server list
- Displays list with: name, command, enabled toggle, remove button
- "Add Server" form at bottom: name + command + args (comma-separated) + add button
- Calls addMcpServer, removeMcpServer, toggleMcpServer and refreshes list
- Same modal pattern as other dialogs

**Step 3: Wire into commandHandlers + AppShell**

- Add `showMcpManager: () => void` to CommandContext
- Change `/mcp` handler: instead of `ctx.openPreviewTab("mcp")`, call `ctx.showMcpManager()`
- In AppShell: add state, mount dialog, wire context

**Step 4: Verify**

Run: `pnpm exec tsc --noEmit && pnpm exec vite build`

**Step 5: Commit**

```
feat: add /mcp command with MCP server management dialog
```

---

### Task 8: Final verification + cleanup

**Step 1: Full type check + build**

Run: `pnpm exec tsc --noEmit`
Run: `pnpm exec vite build`
Run: `cargo check --manifest-path src-tauri/Cargo.toml`

**Step 2: Verify all 4 commands are in commands.ts**

Confirm /restore is added, /model /plugins /mcp are updated.

**Step 3: Commit any cleanup**

```
chore: final cleanup for interactive slash commands
```
