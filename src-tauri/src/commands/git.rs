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
        let short = &commit_hash[..8.min(commit_hash.len())];
        let stash_output = std::process::Command::new("git")
            .args(["stash", "push", "-m", &format!("openclaudgents-restore-{}", short)])
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

    let short = &commit_hash[..8.min(commit_hash.len())];
    result.push_str(&format!("Restored files to commit {}.", short));
    Ok(result)
}

/// Check whether a given path is inside a git repository
#[tauri::command]
pub async fn check_is_git_repo(path: String) -> Result<bool, String> {
    let output = std::process::Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(&path)
        .output();

    match output {
        Ok(o) => Ok(o.status.success()),
        Err(_) => Ok(false),
    }
}

/// List subdirectories of a path for tab-completion (non-recursive, dirs only)
#[tauri::command]
pub async fn list_directory_completions(partial_path: String) -> Result<Vec<String>, String> {
    let expanded = if partial_path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            partial_path.replacen('~', &home.to_string_lossy(), 1)
        } else {
            partial_path.clone()
        }
    } else {
        partial_path.clone()
    };

    // Determine the directory to list and the prefix to match
    let (dir_to_list, prefix) = if expanded.ends_with('/') || expanded.ends_with(std::path::MAIN_SEPARATOR) {
        (expanded.clone(), String::new())
    } else {
        let path = std::path::Path::new(&expanded);
        let parent = path.parent().unwrap_or(std::path::Path::new("/"));
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        (parent.to_string_lossy().to_string(), name)
    };

    let entries = std::fs::read_dir(&dir_to_list).map_err(|e| format!("read_dir failed: {}", e))?;

    let mut results: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        let meta = entry.metadata();
        if let Ok(m) = meta {
            if !m.is_dir() { continue; }
        } else {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip hidden dirs
        if name.starts_with('.') { continue; }
        if !prefix.is_empty() && !name.to_lowercase().starts_with(&prefix.to_lowercase()) {
            continue;
        }
        // Build the full path for display, replacing home dir with ~
        let full = entry.path().to_string_lossy().to_string();
        let display = if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy().to_string();
            if full.starts_with(&home_str) {
                full.replacen(&home_str, "~", 1)
            } else {
                full
            }
        } else {
            full
        };
        results.push(display);
    }

    results.sort();
    // Limit to 10 results
    results.truncate(10);
    Ok(results)
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
