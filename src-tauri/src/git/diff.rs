use std::process::Command;

use serde::{Deserialize, Serialize};

/// A single file's diff information
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffFile {
    pub path: String,
    pub status: String, // "added", "modified", "deleted", "renamed"
    pub additions: usize,
    pub deletions: usize,
}

/// Summary of changes in a directory
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffSummary {
    pub files: Vec<DiffFile>,
    pub total_additions: usize,
    pub total_deletions: usize,
    pub raw_diff: String,
}

/// Get a diff between the working tree and a base reference (default: HEAD).
pub fn get_diff(path: &str, base: Option<&str>) -> Result<DiffSummary, String> {
    let base_ref = base.unwrap_or("HEAD");

    // Get the raw unified diff
    let raw = Command::new("git")
        .args(["diff", base_ref])
        .current_dir(path)
        .output()
        .map_err(|e| format!("git diff failed: {}", e))?;

    let raw_diff = String::from_utf8_lossy(&raw.stdout).to_string();

    // Get per-file stats
    let stat = Command::new("git")
        .args(["diff", "--numstat", base_ref])
        .current_dir(path)
        .output()
        .map_err(|e| format!("git diff --numstat failed: {}", e))?;

    let stat_text = String::from_utf8_lossy(&stat.stdout);

    // Get file status (A/M/D/R)
    let name_status = Command::new("git")
        .args(["diff", "--name-status", base_ref])
        .current_dir(path)
        .output()
        .map_err(|e| format!("git diff --name-status failed: {}", e))?;

    let status_text = String::from_utf8_lossy(&name_status.stdout);

    // Build status map
    let mut status_map: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    for line in status_text.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 2 {
            let status = match parts[0].chars().next().unwrap_or('M') {
                'A' => "added",
                'D' => "deleted",
                'R' => "renamed",
                _ => "modified",
            };
            status_map.insert(parts[1].to_string(), status.to_string());
        }
    }

    let mut files = vec![];
    let mut total_additions = 0;
    let mut total_deletions = 0;

    for line in stat_text.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let additions = parts[0].parse::<usize>().unwrap_or(0);
            let deletions = parts[1].parse::<usize>().unwrap_or(0);
            let file_path = parts[2].to_string();
            let status = status_map
                .get(&file_path)
                .cloned()
                .unwrap_or_else(|| "modified".to_string());

            total_additions += additions;
            total_deletions += deletions;

            files.push(DiffFile {
                path: file_path,
                status,
                additions,
                deletions,
            });
        }
    }

    Ok(DiffSummary {
        files,
        total_additions,
        total_deletions,
        raw_diff,
    })
}

/// Get diff between a worktree and the base branch (for preview pane).
pub fn get_worktree_diff(worktree_path: &str) -> Result<DiffSummary, String> {
    // In a detached HEAD worktree, diff against HEAD shows all local changes
    get_diff(worktree_path, Some("HEAD"))
}

/// File content pair for Monaco diff view: original (HEAD) vs current (working tree)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileDiffContent {
    pub file_path: String,
    pub original: String,
    pub modified: String,
    pub language: String,
}

/// Get original and modified content of a specific file for diff viewing.
pub fn get_file_diff_content(
    repo_path: &str,
    file_path: &str,
    base: Option<&str>,
) -> Result<FileDiffContent, String> {
    let base_ref = base.unwrap_or("HEAD");

    // Get the original content from git
    let original_output = Command::new("git")
        .args(["show", &format!("{}:{}", base_ref, file_path)])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("git show failed: {}", e))?;

    let original = if original_output.status.success() {
        String::from_utf8_lossy(&original_output.stdout).to_string()
    } else {
        String::new() // New file — no original content
    };

    // Get the current (modified) content from the working tree
    let full_path = std::path::Path::new(repo_path).join(file_path);
    let modified = if full_path.exists() {
        std::fs::read_to_string(&full_path)
            .map_err(|e| format!("Failed to read file: {}", e))?
    } else {
        String::new() // Deleted file — no modified content
    };

    let language = detect_language(file_path);

    Ok(FileDiffContent {
        file_path: file_path.to_string(),
        original,
        modified,
        language,
    })
}

/// Detect Monaco language ID from file extension.
fn detect_language(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("");
    match ext {
        "rs" => "rust",
        "ts" | "tsx" => "typescript",
        "js" | "jsx" => "javascript",
        "py" => "python",
        "json" => "json",
        "toml" => "toml",
        "yaml" | "yml" => "yaml",
        "html" => "html",
        "css" => "css",
        "scss" => "scss",
        "md" => "markdown",
        "sql" => "sql",
        "sh" | "bash" | "zsh" => "shell",
        "go" => "go",
        "java" => "java",
        "c" | "h" => "c",
        "cpp" | "hpp" | "cc" => "cpp",
        "rb" => "ruby",
        "swift" => "swift",
        "kt" => "kotlin",
        _ => "plaintext",
    }
    .to_string()
}
