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

/// Write/update the CLAUDE.md file in a project directory
#[tauri::command]
pub async fn update_claude_md(project_path: String, content: String) -> Result<(), String> {
    let path = Path::new(&project_path).join("CLAUDE.md");
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))
}
