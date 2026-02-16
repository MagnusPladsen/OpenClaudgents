use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
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

/// A discoverable plugin from the local marketplace filesystem
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverablePlugin {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub marketplace: String,
    pub install_count: u64,
    pub installed: bool,
    pub enabled: bool,
}

// --- Helper deserialization structs ---

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketplaceEntry {
    install_location: String,
}

#[derive(Deserialize)]
struct InstallCountsCache {
    counts: Vec<InstallCount>,
}

#[derive(Deserialize)]
struct InstallCount {
    plugin: String,
    unique_installs: u64,
}

#[derive(Deserialize)]
struct InstalledPluginsFile {
    plugins: HashMap<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct PluginJson {
    name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    author: Option<PluginAuthor>,
}

#[derive(Deserialize)]
struct PluginAuthor {
    name: String,
}

// --- Helper functions ---

fn read_known_marketplaces(plugins_dir: &Path) -> HashMap<String, PathBuf> {
    let path = plugins_dir.join("known_marketplaces.json");
    let Ok(content) = std::fs::read_to_string(&path) else {
        return HashMap::new();
    };
    let Ok(map) = serde_json::from_str::<HashMap<String, MarketplaceEntry>>(&content) else {
        return HashMap::new();
    };
    map.into_iter()
        .map(|(name, entry)| (name, PathBuf::from(entry.install_location)))
        .collect()
}

fn scan_marketplace_dir(marketplace_path: &Path, marketplace_name: &str) -> Vec<(String, PluginJson)> {
    let plugins_dir = marketplace_path.join("plugins");
    let Ok(entries) = std::fs::read_dir(&plugins_dir) else {
        return vec![];
    };
    let mut results = vec![];
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let plugin_json_path = path.join(".claude-plugin").join("plugin.json");
        if !plugin_json_path.exists() {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&plugin_json_path) else {
            continue;
        };
        let Ok(pj) = serde_json::from_str::<PluginJson>(&content) else {
            continue;
        };
        let plugin_id = format!("{}@{}", pj.name, marketplace_name);
        results.push((plugin_id, pj));
    }
    results
}

fn read_install_counts(plugins_dir: &Path) -> HashMap<String, u64> {
    let path = plugins_dir.join("install-counts-cache.json");
    let Ok(content) = std::fs::read_to_string(&path) else {
        return HashMap::new();
    };
    let Ok(cache) = serde_json::from_str::<InstallCountsCache>(&content) else {
        return HashMap::new();
    };
    cache.counts.into_iter().map(|c| (c.plugin, c.unique_installs)).collect()
}

fn read_installed_plugins(plugins_dir: &Path) -> HashSet<String> {
    let path = plugins_dir.join("installed_plugins.json");
    let Ok(content) = std::fs::read_to_string(&path) else {
        return HashSet::new();
    };
    let Ok(file) = serde_json::from_str::<InstalledPluginsFile>(&content) else {
        return HashSet::new();
    };
    file.plugins.keys().cloned().collect()
}

fn read_enabled_plugins(home: &Path) -> HashSet<String> {
    let path = home.join(".claude").join("settings.json");
    let Ok(content) = std::fs::read_to_string(&path) else {
        return HashSet::new();
    };
    let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) else {
        return HashSet::new();
    };
    let Some(obj) = val.get("enabledPlugins").and_then(|v| v.as_object()) else {
        return HashSet::new();
    };
    obj.iter()
        .filter(|(_, v)| v.as_bool().unwrap_or(false))
        .map(|(k, _)| k.clone())
        .collect()
}

/// Discover all plugins from local marketplace filesystems
#[tauri::command]
pub async fn discover_plugins() -> Result<Vec<DiscoverablePlugin>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let plugins_dir = home.join(".claude").join("plugins");

    if !plugins_dir.exists() {
        return Ok(vec![]);
    }

    // Read all data sources
    let marketplaces = read_known_marketplaces(&plugins_dir);
    let install_counts = read_install_counts(&plugins_dir);
    let installed = read_installed_plugins(&plugins_dir);
    let enabled = read_enabled_plugins(&home);

    let mut plugins: Vec<DiscoverablePlugin> = Vec::new();

    for (marketplace_name, marketplace_path) in &marketplaces {
        for (plugin_id, pj) in scan_marketplace_dir(marketplace_path, marketplace_name) {
            let count = install_counts.get(&plugin_id).copied().unwrap_or(0);
            let is_installed = installed.contains(&plugin_id);
            let is_enabled = enabled.contains(&plugin_id);

            plugins.push(DiscoverablePlugin {
                id: plugin_id,
                name: pj.name,
                description: pj.description.unwrap_or_default(),
                author: pj.author.map(|a| a.name).unwrap_or_default(),
                marketplace: marketplace_name.clone(),
                install_count: count,
                installed: is_installed,
                enabled: is_enabled,
            });
        }
    }

    // Sort by install count descending
    plugins.sort_by(|a, b| b.install_count.cmp(&a.install_count));

    Ok(plugins)
}

/// Toggle a plugin's enabled state in ~/.claude/settings.json
#[tauri::command]
pub async fn toggle_plugin_enabled(plugin_id: String) -> Result<bool, String> {
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

    if !obj.contains_key("enabledPlugins") {
        obj.insert("enabledPlugins".to_string(), serde_json::json!({}));
    }

    let enabled_plugins = obj
        .get_mut("enabledPlugins")
        .and_then(|v| v.as_object_mut())
        .ok_or("enabledPlugins is not an object")?;

    let currently_enabled = enabled_plugins
        .get(&plugin_id)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let new_enabled = !currently_enabled;
    enabled_plugins.insert(plugin_id, serde_json::Value::Bool(new_enabled));

    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .claude dir: {}", e))?;
    }

    let formatted = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    std::fs::write(&settings_path, formatted)
        .map_err(|e| format!("Failed to write settings.json: {}", e))?;

    Ok(new_enabled)
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
