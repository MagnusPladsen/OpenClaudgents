use crate::git::{diff, status, worktree};

/// Get git status for a directory
#[tauri::command]
pub async fn get_git_status(path: String) -> Result<status::GitStatus, String> {
    status::get_status(&path)
}

/// Get diff for a directory against a base ref
#[tauri::command]
pub async fn get_git_diff(
    path: String,
    base: Option<String>,
) -> Result<diff::DiffSummary, String> {
    diff::get_diff(&path, base.as_deref())
}

/// Create an isolated worktree for a session
#[tauri::command]
pub async fn create_worktree(
    session_id: String,
    project_path: String,
) -> Result<worktree::WorktreeInfo, String> {
    worktree::create_worktree(&session_id, &project_path)
}

/// Remove a worktree, optionally saving a snapshot
#[tauri::command]
pub async fn remove_worktree(
    project_path: String,
    worktree_path: String,
    save_snapshot: bool,
) -> Result<Option<String>, String> {
    worktree::remove_worktree(&project_path, &worktree_path, save_snapshot)
}

/// List all worktrees for a project
#[tauri::command]
pub async fn list_worktrees(project_path: String) -> Result<Vec<String>, String> {
    Ok(worktree::list_worktrees(&project_path))
}

/// Get original and modified file content for Monaco diff view
#[tauri::command]
pub async fn get_file_diff_content(
    repo_path: String,
    file_path: String,
    base: Option<String>,
) -> Result<diff::FileDiffContent, String> {
    diff::get_file_diff_content(&repo_path, &file_path, base.as_deref())
}

/// Stage all changes
#[tauri::command]
pub async fn git_stage_all(path: String) -> Result<(), String> {
    let output = std::process::Command::new("git")
        .args(["add", "-A"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("git add failed: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// Create a git commit
#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("git commit failed: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Push to remote
#[tauri::command]
pub async fn git_push(path: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(["push"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("git push failed: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stderr).to_string()) // git push outputs to stderr
}

/// Clean up old worktrees
#[tauri::command]
pub async fn cleanup_worktrees(
    project_path: String,
    max_age_days: Option<i64>,
    max_count: Option<usize>,
) -> Result<Vec<String>, String> {
    Ok(worktree::cleanup_worktrees(
        &project_path,
        max_age_days.unwrap_or(4),
        max_count.unwrap_or(10),
    ))
}
