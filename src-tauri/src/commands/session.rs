use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::claude::process::{ProcessManager, SpawnOptions};
use crate::claude::session_store;

/// Resolve shell-style paths: expand `~` to home dir, `.` to current dir
fn resolve_project_path(path: &str) -> Result<String, String> {
    let expanded = if path == "~" {
        dirs::home_dir()
            .ok_or("Could not determine home directory")?
            .to_string_lossy()
            .to_string()
    } else if path.starts_with("~/") {
        let home = dirs::home_dir()
            .ok_or("Could not determine home directory")?;
        home.join(&path[2..]).to_string_lossy().to_string()
    } else if path == "." {
        std::env::current_dir()
            .map_err(|e| format!("Could not resolve '.': {}", e))?
            .to_string_lossy()
            .to_string()
    } else if path.starts_with("./") {
        let cwd = std::env::current_dir()
            .map_err(|e| format!("Could not resolve '.': {}", e))?;
        cwd.join(&path[2..]).to_string_lossy().to_string()
    } else {
        path.to_string()
    };

    if !std::path::Path::new(&expanded).exists() {
        return Err(format!("Project path does not exist: {}", expanded));
    }

    Ok(expanded)
}

/// Session info returned to the frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
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
    pub is_agent_team: bool,
    pub team_role: Option<String>,
    pub parent_session_id: Option<String>,
}

/// Managed state wrapping the ProcessManager
pub struct AppState {
    pub process_manager: Arc<ProcessManager>,
}

/// Create a new Claude Code session
#[tauri::command]
pub async fn create_session(
    project_path: String,
    model: Option<String>,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<SessionInfo, String> {
    let project_path = resolve_project_path(&project_path)?;
    let session_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let opts = SpawnOptions {
        session_id: session_id.clone(),
        project_path: project_path.clone(),
        claude_cli_path: None,
        resume_session_id: None,
        model: model.clone(),
    };

    state.process_manager.spawn(opts, app).await?;

    Ok(SessionInfo {
        id: session_id,
        claude_session_id: None,
        name: None,
        project_path,
        worktree_path: None,
        status: "active".to_string(),
        model,
        created_at: now.clone(),
        updated_at: now,
        total_input_tokens: 0,
        total_output_tokens: 0,
        is_agent_team: false,
        team_role: None,
        parent_session_id: None,
    })
}

/// Send a message to an active session (handles multi-turn via --resume)
#[tauri::command]
pub async fn send_message(
    session_id: String,
    message: String,
    project_path: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let project_path = resolve_project_path(&project_path)?;
    state
        .process_manager
        .send_message(&session_id, &message, &project_path, app)
        .await
}

/// Kill a session's process
#[tauri::command]
pub async fn kill_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.process_manager.kill(&session_id).await
}

/// Detect the Claude CLI binary path
#[tauri::command]
pub async fn detect_claude_cli() -> Result<Option<String>, String> {
    Ok(ProcessManager::detect_cli_path().await)
}

/// Discover existing Claude Code sessions from ~/.claude/projects/
#[tauri::command]
pub async fn discover_sessions() -> Result<Vec<session_store::DiscoveredSession>, String> {
    Ok(session_store::discover_sessions())
}

/// Get messages from an existing Claude Code session (parsed from JSONL)
#[tauri::command]
pub async fn get_session_messages(
    claude_session_id: String,
) -> Result<Vec<session_store::ParsedMessage>, String> {
    Ok(session_store::parse_session_messages(&claude_session_id))
}

/// Resume an existing Claude Code session (discovered from ~/.claude/)
#[tauri::command]
pub async fn resume_session(
    claude_session_id: String,
    project_path: String,
    state: State<'_, AppState>,
    _app: tauri::AppHandle,
) -> Result<SessionInfo, String> {
    let project_path = resolve_project_path(&project_path)?;
    let session_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Register the Claude session ID mapping
    state
        .process_manager
        .register_claude_session_id(&session_id, claude_session_id.clone())
        .await;

    Ok(SessionInfo {
        id: session_id,
        claude_session_id: Some(claude_session_id),
        name: None,
        project_path,
        worktree_path: None,
        status: "paused".to_string(),
        model: None,
        created_at: now.clone(),
        updated_at: now,
        total_input_tokens: 0,
        total_output_tokens: 0,
        is_agent_team: false,
        team_role: None,
        parent_session_id: None,
    })
}
