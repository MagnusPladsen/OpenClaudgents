use serde::{Deserialize, Serialize};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Session record stored in SQLite
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionRecord {
    pub id: String,
    pub claude_session_id: Option<String>,
    pub name: Option<String>,
    pub project_path: String,
    pub worktree_path: Option<String>,
    pub status: String,
    pub model: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub total_cache_read_tokens: i64,
    pub total_cache_creation_tokens: i64,
    pub is_agent_team: bool,
    pub team_role: Option<String>,
    pub parent_session_id: Option<String>,
}

/// Returns the SQLite migrations for the app database
pub fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "Initial schema: sessions, worktrees, usage_log, settings",
        sql: include_str!("../../migrations/001_initial.sql"),
        kind: MigrationKind::Up,
    }]
}
