use std::process::Command;

use serde::{Deserialize, Serialize};

/// Git status for a project or worktree directory
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: String,
    pub is_dirty: bool,
    pub dirty_file_count: usize,
    pub last_commit_message: String,
    pub last_commit_hash: String,
    pub is_worktree: bool,
}

/// Get the git status for a given directory.
pub fn get_status(path: &str) -> Result<GitStatus, String> {
    let branch = get_branch(path)?;
    let (dirty_count, is_dirty) = get_dirty_status(path)?;
    let (hash, message) = get_last_commit(path)?;
    let is_worktree = check_is_worktree(path);

    Ok(GitStatus {
        branch,
        is_dirty,
        dirty_file_count: dirty_count,
        last_commit_message: message,
        last_commit_hash: hash,
        is_worktree,
    })
}

fn get_branch(path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("git rev-parse failed: {}", e))?;

    let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
    // Detached HEAD returns "HEAD"
    if branch == "HEAD" {
        // Try to get a more descriptive name
        let desc = Command::new("git")
            .args(["describe", "--tags", "--always"])
            .current_dir(path)
            .output()
            .ok();
        if let Some(d) = desc {
            let tag = String::from_utf8_lossy(&d.stdout).trim().to_string();
            if !tag.is_empty() {
                return Ok(format!("detached:{}", tag));
            }
        }
        return Ok("HEAD (detached)".to_string());
    }
    Ok(branch)
}

fn get_dirty_status(path: &str) -> Result<(usize, bool), String> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("git status failed: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let count = text.lines().filter(|l| !l.is_empty()).count();
    Ok((count, count > 0))
}

fn get_last_commit(path: &str) -> Result<(String, String), String> {
    let output = Command::new("git")
        .args(["log", "-1", "--format=%H%n%s"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("git log failed: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut lines = text.lines();
    let hash = lines.next().unwrap_or("").to_string();
    let message = lines.next().unwrap_or("").to_string();
    Ok((hash, message))
}

fn check_is_worktree(path: &str) -> bool {
    let output = Command::new("git")
        .args(["rev-parse", "--git-common-dir"])
        .current_dir(path)
        .output()
        .ok();

    let Some(output) = output else {
        return false;
    };

    let common_dir = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let git_dir = Command::new("git")
        .args(["rev-parse", "--git-dir"])
        .current_dir(path)
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    // In a worktree, git-dir differs from git-common-dir
    common_dir != git_dir && git_dir != ".git"
}
