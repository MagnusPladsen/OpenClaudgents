use std::path::Path;
use serde::{Deserialize, Serialize};

/// Read the CLAUDE.md file from a project directory
#[tauri::command]
pub async fn get_claude_md(project_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&project_path).join("CLAUDE.md");
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("Failed to read CLAUDE.md: {}", e))
}

/// A todo item from Claude's todo files
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
    pub id: String,
    pub content: String,
    pub status: String, // "pending", "in_progress", "done"
    pub source_file: String,
}

/// Read Claude's todo/task files from ~/.claude/todos/ and ~/.claude/tasks/
#[tauri::command]
pub async fn get_claude_todos() -> Result<Vec<TodoItem>, String> {
    let mut todos = vec![];
    let home = dirs::home_dir().unwrap_or_default();

    // Read from ~/.claude/todos/
    let todos_dir = home.join(".claude").join("todos");
    if todos_dir.exists() {
        read_todo_files(&todos_dir, &mut todos);
    }

    // Read from ~/.claude/tasks/
    let tasks_dir = home.join(".claude").join("tasks");
    if tasks_dir.exists() {
        read_todo_files(&tasks_dir, &mut todos);
    }

    Ok(todos)
}

fn read_todo_files(dir: &Path, todos: &mut Vec<TodoItem>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                // Try JSON parse first
                if let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(&content) {
                    for (i, item) in items.iter().enumerate() {
                        let status = item
                            .get("status")
                            .and_then(|s| s.as_str())
                            .unwrap_or("pending")
                            .to_string();
                        let text = item
                            .get("content")
                            .or_else(|| item.get("subject"))
                            .or_else(|| item.get("description"))
                            .or_else(|| item.get("text"))
                            .and_then(|s| s.as_str())
                            .unwrap_or("")
                            .to_string();

                        if !text.is_empty() {
                            todos.push(TodoItem {
                                id: format!(
                                    "{}:{}",
                                    path.file_name().unwrap_or_default().to_string_lossy(),
                                    i
                                ),
                                content: text,
                                status,
                                source_file: path.to_string_lossy().to_string(),
                            });
                        }
                    }
                } else {
                    // Plain text: treat each non-empty line as a todo
                    for (i, line) in content.lines().enumerate() {
                        let line = line.trim();
                        if line.is_empty() || line.starts_with('#') {
                            continue;
                        }
                        let (status, text) = if line.starts_with("- [x]") || line.starts_with("- [X]")
                        {
                            ("done".to_string(), line[5..].trim().to_string())
                        } else if line.starts_with("- [ ]") {
                            ("pending".to_string(), line[5..].trim().to_string())
                        } else if line.starts_with("- ") {
                            ("pending".to_string(), line[2..].to_string())
                        } else {
                            ("pending".to_string(), line.to_string())
                        };

                        todos.push(TodoItem {
                            id: format!(
                                "{}:{}",
                                path.file_name().unwrap_or_default().to_string_lossy(),
                                i
                            ),
                            content: text,
                            status,
                            source_file: path.to_string_lossy().to_string(),
                        });
                    }
                }
            }
        } else if path.is_dir() {
            // Recurse into subdirectories (e.g., ~/.claude/tasks/{team-name}/)
            read_todo_files(&path, todos);
        }
    }
}

/// A custom skill/command discovered from the filesystem
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CustomSkill {
    pub name: String,
    pub description: String,
    pub source: String, // "personal" or "project"
    pub file_path: String,
}

/// Discover custom skills from ~/.claude/skills/, ~/.claude/commands/,
/// <project>/.claude/skills/, and <project>/.claude/commands/
#[tauri::command]
pub async fn discover_custom_skills(project_path: Option<String>) -> Result<Vec<CustomSkill>, String> {
    let mut skills = vec![];
    let home = dirs::home_dir().unwrap_or_default();

    // Personal skills: ~/.claude/skills/*/SKILL.md
    let personal_skills_dir = home.join(".claude").join("skills");
    if personal_skills_dir.exists() {
        discover_skills_in_dir(&personal_skills_dir, "personal", &mut skills);
    }

    // Personal commands (legacy): ~/.claude/commands/*.md
    let personal_commands_dir = home.join(".claude").join("commands");
    if personal_commands_dir.exists() {
        discover_commands_in_dir(&personal_commands_dir, "personal", &mut skills);
    }

    // Project skills
    if let Some(ref project) = project_path {
        let project_skills_dir = Path::new(project).join(".claude").join("skills");
        if project_skills_dir.exists() {
            discover_skills_in_dir(&project_skills_dir, "project", &mut skills);
        }

        let project_commands_dir = Path::new(project).join(".claude").join("commands");
        if project_commands_dir.exists() {
            discover_commands_in_dir(&project_commands_dir, "project", &mut skills);
        }
    }

    Ok(skills)
}

/// Scan a skills directory for */SKILL.md files
fn discover_skills_in_dir(dir: &Path, source: &str, skills: &mut Vec<CustomSkill>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let skill_file = path.join("SKILL.md");
        if !skill_file.exists() {
            continue;
        }

        let Ok(content) = std::fs::read_to_string(&skill_file) else {
            continue;
        };

        let dir_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let (name, description) = parse_frontmatter(&content, &dir_name);

        skills.push(CustomSkill {
            name,
            description,
            source: source.to_string(),
            file_path: skill_file.to_string_lossy().to_string(),
        });
    }
}

/// Scan a commands directory for *.md files
fn discover_commands_in_dir(dir: &Path, source: &str, skills: &mut Vec<CustomSkill>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase();
        if ext != "md" {
            continue;
        }

        let Ok(content) = std::fs::read_to_string(&path) else {
            continue;
        };

        let file_stem = path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let (name, description) = parse_frontmatter(&content, &file_stem);

        skills.push(CustomSkill {
            name,
            description,
            source: source.to_string(),
            file_path: path.to_string_lossy().to_string(),
        });
    }
}

/// Parse YAML frontmatter for name and description.
/// Falls back to default_name for name and first content line for description.
fn parse_frontmatter(content: &str, default_name: &str) -> (String, String) {
    let mut name = default_name.to_string();
    let mut description = String::new();

    if content.starts_with("---") {
        // Find the closing ---
        if let Some(end) = content[3..].find("---") {
            let frontmatter = &content[3..3 + end];
            for line in frontmatter.lines() {
                let line = line.trim();
                if let Some(val) = line.strip_prefix("name:") {
                    let val = val.trim().trim_matches('"').trim_matches('\'');
                    if !val.is_empty() {
                        name = val.to_string();
                    }
                } else if let Some(val) = line.strip_prefix("description:") {
                    let val = val.trim().trim_matches('"').trim_matches('\'');
                    if !val.is_empty() {
                        description = val.to_string();
                    }
                }
            }

            // If no description from frontmatter, use first content line
            if description.is_empty() {
                let after_frontmatter = &content[3 + end + 3..];
                for line in after_frontmatter.lines() {
                    let line = line.trim();
                    if !line.is_empty() && !line.starts_with('#') {
                        description = line.to_string();
                        break;
                    }
                }
            }
        }
    } else {
        // No frontmatter: first non-empty, non-heading line is description
        for line in content.lines() {
            let line = line.trim();
            if !line.is_empty() && !line.starts_with('#') {
                description = line.to_string();
                break;
            }
        }
    }

    if description.is_empty() {
        description = format!("Custom skill: {}", name);
    }

    (name, description)
}

// --- Plugin Management ---

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

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(plugins) = serde_json::from_str::<Vec<PluginInfo>>(&stdout) {
            return Ok(plugins);
        }
    }

    // Fallback: try plain text output
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
    Ok(plugins)
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

/// Find the claude CLI binary path (sync version)
fn find_claude_cli() -> Result<String, String> {
    // Check common install locations first (works for GUI-launched apps)
    let mut candidates: Vec<String> = vec![
        "/opt/homebrew/bin/claude".to_string(),
        "/usr/local/bin/claude".to_string(),
        "/usr/bin/claude".to_string(),
    ];

    if let Some(home) = dirs::home_dir() {
        let home = home.to_string_lossy();
        candidates.push(format!("{}/.npm/bin/claude", home));
        candidates.push(format!("{}/.local/bin/claude", home));
    }

    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }

    // Try PATH via `which`
    if let Ok(output) = std::process::Command::new("which").arg("claude").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(path);
            }
        }
    }

    Err("Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code".to_string())
}

// --- MCP Server Management ---

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

/// Toggle an MCP server's enabled/disabled state. Returns new enabled state.
#[tauri::command]
pub async fn toggle_mcp_server(name: String) -> Result<bool, String> {
    let mut new_enabled = true;
    modify_mcp_settings(|mcp| {
        if let Some(server) = mcp.get_mut(&name).and_then(|v| v.as_object_mut()) {
            let currently_disabled = server
                .get("disabled")
                .and_then(|d| d.as_bool())
                .unwrap_or(false);
            new_enabled = currently_disabled; // flip: was disabled → now enabled
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

/// Write/update the CLAUDE.md file in a project directory
#[tauri::command]
pub async fn update_claude_md(project_path: String, content: String) -> Result<(), String> {
    let path = Path::new(&project_path).join("CLAUDE.md");
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))
}
