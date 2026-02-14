use std::path::Path;

use serde::{Deserialize, Serialize};

use super::types::ClaudeSessionEntry;

/// Discovered session metadata from ~/.claude/projects/
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredSession {
    pub claude_session_id: String,
    pub project_path: String,
    pub name: Option<String>,
    pub last_message_at: Option<String>,
    pub message_count: usize,
    pub model: Option<String>,
    pub git_branch: Option<String>,
}

/// Scan ~/.claude/projects/ for existing Claude Code sessions
pub fn discover_sessions() -> Vec<DiscoveredSession> {
    let claude_dir = dirs::home_dir()
        .map(|h| h.join(".claude").join("projects"))
        .unwrap_or_default();

    if !claude_dir.exists() {
        return Vec::new();
    }

    let mut sessions = Vec::new();

    // Each subdirectory in projects/ is a path-encoded project
    if let Ok(entries) = std::fs::read_dir(&claude_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            // Decode project path from directory name (e.g., "-Users-foo-git-bar")
            let dir_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            let project_path = decode_project_path(dir_name);

            // Find JSONL session files in this project directory
            if let Ok(files) = std::fs::read_dir(&path) {
                for file in files.flatten() {
                    let file_path = file.path();
                    if file_path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                        if let Some(session) =
                            parse_session_file(&file_path, &project_path)
                        {
                            sessions.push(session);
                        }
                    }
                }
            }
        }
    }

    // Sort by last message time, newest first
    sessions.sort_by(|a, b| {
        b.last_message_at
            .as_deref()
            .unwrap_or("")
            .cmp(a.last_message_at.as_deref().unwrap_or(""))
    });

    sessions
}

/// Parse a single JSONL session file to extract metadata
fn parse_session_file(
    file_path: &Path,
    project_path: &str,
) -> Option<DiscoveredSession> {
    let content = std::fs::read_to_string(file_path).ok()?;
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() {
        return None;
    }

    // Extract session ID from filename (e.g., "abc-def-123.jsonl" -> "abc-def-123")
    let session_id = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    let mut name: Option<String> = None;
    let mut last_timestamp: Option<String> = None;
    let mut model: Option<String> = None;
    let mut git_branch: Option<String> = None;
    let mut message_count: usize = 0;

    for line in &lines {
        let entry: ClaudeSessionEntry = match serde_json::from_str(line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        // Track timestamps
        if let Some(ref ts) = entry.timestamp {
            last_timestamp = Some(ts.clone());
        }

        // Track git branch
        if entry.git_branch.is_some() {
            git_branch = entry.git_branch.clone();
        }

        // Extract name from first user message
        if entry.entry_type == "user" && name.is_none() {
            if let Some(ref msg) = entry.message {
                if let Some(text) = extract_text_content(&msg.content) {
                    // Use first 50 chars of the first user message as the session name
                    let truncated = text.chars().take(50).collect::<String>();
                    name = Some(if text.len() > 50 {
                        format!("{}...", truncated)
                    } else {
                        truncated
                    });
                }
            }
        }

        // Track model
        if let Some(ref msg) = entry.message {
            if msg.model.is_some() {
                model = msg.model.clone();
            }
        }

        if entry.entry_type == "user" || entry.entry_type == "assistant" {
            message_count += 1;
        }
    }

    Some(DiscoveredSession {
        claude_session_id: session_id,
        project_path: project_path.to_string(),
        name,
        last_message_at: last_timestamp,
        message_count,
        model,
        git_branch,
    })
}

/// Parse messages from a JSONL session file for display in the chat UI
pub fn parse_session_messages(claude_session_id: &str) -> Vec<ParsedMessage> {
    let claude_dir = dirs::home_dir()
        .map(|h| h.join(".claude").join("projects"))
        .unwrap_or_default();

    // Search all project directories for this session ID
    if let Ok(projects) = std::fs::read_dir(&claude_dir) {
        for project in projects.flatten() {
            let jsonl_path = project
                .path()
                .join(format!("{}.jsonl", claude_session_id));
            if jsonl_path.exists() {
                return parse_messages_from_file(&jsonl_path);
            }
        }
    }

    Vec::new()
}

/// A parsed chat message suitable for the frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedMessage {
    pub uuid: String,
    pub parent_uuid: Option<String>,
    pub role: String,
    pub content: serde_json::Value,
    pub timestamp: String,
    pub is_sidechain: bool,
    pub model: Option<String>,
}

fn parse_messages_from_file(file_path: &Path) -> Vec<ParsedMessage> {
    let content = match std::fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut messages = Vec::new();

    for line in content.lines() {
        let entry: ClaudeSessionEntry = match serde_json::from_str(line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        // Only include user and assistant messages (skip progress, file-history-snapshot, etc.)
        if entry.entry_type != "user" && entry.entry_type != "assistant" {
            continue;
        }

        // Skip sidechain messages (subagent internal messages)
        if entry.is_sidechain.unwrap_or(false) {
            continue;
        }

        let msg = match entry.message {
            Some(m) => m,
            None => continue,
        };

        messages.push(ParsedMessage {
            uuid: entry.uuid.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            parent_uuid: entry.parent_uuid,
            role: msg.role,
            content: msg.content,
            timestamp: entry.timestamp.unwrap_or_default(),
            is_sidechain: false,
            model: msg.model,
        });
    }

    messages
}

/// Extract text content from a Claude message content field
fn extract_text_content(content: &serde_json::Value) -> Option<String> {
    // Content can be a string or an array of content blocks
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }
    if let Some(blocks) = content.as_array() {
        for block in blocks {
            if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                    return Some(text.to_string());
                }
            }
        }
    }
    None
}

/// Decode a path-encoded directory name back to an absolute path
/// e.g., "-Users-magnuspladsen-git-OpenClaudgents" -> "/Users/magnuspladsen/git/OpenClaudgents"
fn decode_project_path(encoded: &str) -> String {
    if encoded.starts_with('-') {
        format!("/{}", encoded[1..].replace('-', "/"))
    } else {
        encoded.replace('-', "/")
    }
}
