use std::path::{Path, PathBuf};
use std::process::Command;

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

/// Info about a managed worktree
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub id: String,
    pub session_id: String,
    pub path: String,
    pub base_commit: String,
    pub project_path: String,
    pub created_at: String,
    pub is_dirty: bool,
}

/// Base directory for all worktrees: ~/.openclaudgents/worktrees/
fn worktree_base_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join(".openclaudgents")
        .join("worktrees")
}

/// Create an isolated worktree for a session.
///
/// Uses detached HEAD from the current branch HEAD to avoid branch pollution.
/// Worktree is placed at ~/.openclaudgents/worktrees/{project-name}/{session-id}/
pub fn create_worktree(
    session_id: &str,
    project_path: &str,
) -> Result<WorktreeInfo, String> {
    let project = Path::new(project_path);
    if !project.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }

    // Derive project name from path
    let project_name = project
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");

    let worktree_path = worktree_base_dir()
        .join(project_name)
        .join(session_id);

    // Ensure parent dir exists
    std::fs::create_dir_all(worktree_path.parent().unwrap())
        .map_err(|e| format!("Failed to create worktree directory: {}", e))?;

    // Get current HEAD commit
    let head_output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;

    if !head_output.status.success() {
        return Err(format!(
            "git rev-parse HEAD failed: {}",
            String::from_utf8_lossy(&head_output.stderr)
        ));
    }

    let base_commit = String::from_utf8_lossy(&head_output.stdout)
        .trim()
        .to_string();

    // Create worktree with detached HEAD
    let wt_output = Command::new("git")
        .args([
            "worktree",
            "add",
            "--detach",
            worktree_path.to_str().unwrap(),
            &base_commit,
        ])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to create worktree: {}", e))?;

    if !wt_output.status.success() {
        return Err(format!(
            "git worktree add failed: {}",
            String::from_utf8_lossy(&wt_output.stderr)
        ));
    }

    // Copy uncommitted changes (staged + unstaged) to the worktree
    copy_uncommitted_changes(project_path, worktree_path.to_str().unwrap())?;

    let now = Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();

    Ok(WorktreeInfo {
        id,
        session_id: session_id.to_string(),
        path: worktree_path.to_string_lossy().to_string(),
        base_commit,
        project_path: project_path.to_string(),
        created_at: now,
        is_dirty: false,
    })
}

/// Copy uncommitted changes from the source project to the new worktree.
/// Uses git diff to create a patch and applies it.
fn copy_uncommitted_changes(source: &str, target: &str) -> Result<(), String> {
    // Check if there are any uncommitted changes
    let status = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(source)
        .output()
        .map_err(|e| format!("git status failed: {}", e))?;

    let status_text = String::from_utf8_lossy(&status.stdout);
    if status_text.trim().is_empty() {
        return Ok(()); // No changes to copy
    }

    // Generate a combined diff (staged + unstaged)
    let diff = Command::new("git")
        .args(["diff", "HEAD"])
        .current_dir(source)
        .output()
        .map_err(|e| format!("git diff failed: {}", e))?;

    if diff.stdout.is_empty() {
        // Might have untracked files only — skip patch for those
        return Ok(());
    }

    // Apply the patch to the worktree
    let mut apply = Command::new("git")
        .args(["apply", "--allow-empty", "-"])
        .current_dir(target)
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("git apply failed to start: {}", e))?;

    if let Some(ref mut stdin) = apply.stdin {
        use std::io::Write;
        stdin
            .write_all(&diff.stdout)
            .map_err(|e| format!("Failed to pipe diff: {}", e))?;
    }

    let result = apply
        .wait()
        .map_err(|e| format!("git apply failed: {}", e))?;

    if !result.success() {
        // Non-fatal: the worktree still works, just without the uncommitted changes
        log::warn!("Could not copy uncommitted changes to worktree (patch apply failed)");
    }

    Ok(())
}

/// Remove a worktree by path, optionally saving a snapshot first.
pub fn remove_worktree(
    project_path: &str,
    worktree_path: &str,
    save_snapshot: bool,
) -> Result<Option<String>, String> {
    let mut snapshot_path = None;

    if save_snapshot {
        snapshot_path = save_worktree_snapshot(worktree_path).ok();
    }

    // Force-remove the worktree
    let output = Command::new("git")
        .args(["worktree", "remove", "--force", worktree_path])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to remove worktree: {}", e))?;

    if !output.status.success() {
        // Fallback: manually remove the directory and prune
        std::fs::remove_dir_all(worktree_path).ok();
        Command::new("git")
            .args(["worktree", "prune"])
            .current_dir(project_path)
            .output()
            .ok();
    }

    Ok(snapshot_path)
}

/// Save a snapshot of the worktree as a git patch before deletion.
/// Stored at ~/.openclaudgents/snapshots/{timestamp}.patch
fn save_worktree_snapshot(worktree_path: &str) -> Result<String, String> {
    let snapshot_dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join(".openclaudgents")
        .join("snapshots");

    std::fs::create_dir_all(&snapshot_dir)
        .map_err(|e| format!("Failed to create snapshots dir: {}", e))?;

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let patch_path = snapshot_dir.join(format!("{}.patch", timestamp));

    // Generate diff of all changes in the worktree
    let diff = Command::new("git")
        .args(["diff", "HEAD"])
        .current_dir(worktree_path)
        .output()
        .map_err(|e| format!("git diff failed: {}", e))?;

    if !diff.stdout.is_empty() {
        std::fs::write(&patch_path, &diff.stdout)
            .map_err(|e| format!("Failed to write snapshot: {}", e))?;
    }

    Ok(patch_path.to_string_lossy().to_string())
}

/// Clean up old worktrees based on age and count limits.
/// Returns the list of removed worktree paths.
pub fn cleanup_worktrees(
    project_path: &str,
    max_age_days: i64,
    max_count: usize,
) -> Vec<String> {
    let base = worktree_base_dir();
    if !base.exists() {
        return vec![];
    }

    let mut removed = vec![];

    // List all worktree directories with their creation times
    let mut worktrees: Vec<(PathBuf, DateTime<Utc>)> = vec![];

    if let Ok(projects) = std::fs::read_dir(&base) {
        for project_entry in projects.flatten() {
            if !project_entry.path().is_dir() {
                continue;
            }
            if let Ok(sessions) = std::fs::read_dir(project_entry.path()) {
                for session_entry in sessions.flatten() {
                    let path = session_entry.path();
                    if !path.is_dir() {
                        continue;
                    }
                    let created = session_entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.created().ok())
                        .map(|t| DateTime::<Utc>::from(t))
                        .unwrap_or_else(Utc::now);
                    worktrees.push((path, created));
                }
            }
        }
    }

    // Sort by creation time (oldest first)
    worktrees.sort_by_key(|(_, created)| *created);

    let now = Utc::now();
    let age_threshold = now - Duration::days(max_age_days);

    // Remove worktrees older than max_age_days
    for (path, created) in &worktrees {
        if *created < age_threshold {
            let path_str = path.to_string_lossy().to_string();
            if remove_worktree(project_path, &path_str, true).is_ok() {
                removed.push(path_str);
            }
        }
    }

    // If still over max_count, remove oldest
    let remaining = worktrees.len() - removed.len();
    if remaining > max_count {
        let to_remove = remaining - max_count;
        for (path, _) in worktrees.iter().take(to_remove) {
            let path_str = path.to_string_lossy().to_string();
            if !removed.contains(&path_str) {
                if remove_worktree(project_path, &path_str, true).is_ok() {
                    removed.push(path_str);
                }
            }
        }
    }

    removed
}

/// List all worktrees git knows about for a project.
pub fn list_worktrees(project_path: &str) -> Vec<String> {
    let output = Command::new("git")
        .args(["worktree", "list", "--porcelain"])
        .current_dir(project_path)
        .output()
        .ok();

    let Some(output) = output else {
        return vec![];
    };

    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .filter_map(|line| line.strip_prefix("worktree "))
        .map(|s| s.to_string())
        .collect()
}
