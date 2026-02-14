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

/// Write/update the CLAUDE.md file in a project directory
#[tauri::command]
pub async fn update_claude_md(project_path: String, content: String) -> Result<(), String> {
    let path = Path::new(&project_path).join("CLAUDE.md");
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))
}
