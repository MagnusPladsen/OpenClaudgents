use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use super::stream_parser::StreamParser;

/// Manages multiple Claude CLI child processes.
///
/// Claude CLI in `-p` mode is single-turn: it reads one prompt from stdin,
/// responds, then exits. For multi-turn conversations, we spawn a new process
/// per message using `--resume <claude-session-id>` to continue the session.
pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, ClaudeProcess>>>,
    /// Maps our session IDs to Claude's internal session IDs (discovered from JSONL)
    claude_session_map: Arc<Mutex<HashMap<String, String>>>,
}

struct ClaudeProcess {
    child: Child,
    stdin: Option<tokio::process::ChildStdin>,
    project_path: String,
    status: ProcessStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProcessStatus {
    Starting,
    Running,
    WaitingInput,
    Paused,
    Completed,
    Error,
}

impl std::fmt::Display for ProcessStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProcessStatus::Starting => write!(f, "starting"),
            ProcessStatus::Running => write!(f, "active"),
            ProcessStatus::WaitingInput => write!(f, "waiting_input"),
            ProcessStatus::Paused => write!(f, "paused"),
            ProcessStatus::Completed => write!(f, "completed"),
            ProcessStatus::Error => write!(f, "error"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnOptions {
    pub session_id: String,
    pub project_path: String,
    pub claude_cli_path: Option<String>,
    pub resume_session_id: Option<String>,
    pub model: Option<String>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
            claude_session_map: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Find the claude CLI binary path
    pub async fn detect_cli_path() -> Option<String> {
        let output = Command::new("which")
            .arg("claude")
            .output()
            .await
            .ok()?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
        None
    }

    fn resolve_cli_path(provided: Option<String>) -> Result<String, String> {
        if let Some(path) = provided {
            return Ok(path);
        }
        for path in &["/usr/local/bin/claude", "/opt/homebrew/bin/claude"] {
            if std::path::Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
        Err("Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code"
            .to_string())
    }

    /// Spawn a new Claude CLI process for a session
    pub async fn spawn(
        &self,
        opts: SpawnOptions,
        app_handle: tauri::AppHandle,
    ) -> Result<(), String> {
        let cli_path = Self::resolve_cli_path(opts.claude_cli_path.clone())?;

        let mut cmd = Command::new(&cli_path);
        cmd.arg("-p")
            .arg("--output-format")
            .arg("stream-json")
            .arg("--verbose")
            .arg("--include-partial-messages")
            .current_dir(&opts.project_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(ref resume_id) = opts.resume_session_id {
            cmd.arg("--resume").arg(resume_id);
        }

        if let Some(ref model) = opts.model {
            cmd.arg("--model").arg(model);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn claude CLI: {}", e))?;

        let stdin = child.stdin.take();
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        let session_id = opts.session_id.clone();

        // Store the resume session ID mapping if provided
        if let Some(ref claude_sid) = opts.resume_session_id {
            let mut map = self.claude_session_map.lock().await;
            map.insert(session_id.clone(), claude_sid.clone());
        }

        let process = ClaudeProcess {
            child,
            stdin,
            project_path: opts.project_path.clone(),
            status: ProcessStatus::Starting,
        };

        {
            let mut procs = self.processes.lock().await;
            procs.insert(session_id.clone(), process);
        }

        // Spawn stdout reader
        let processes = self.processes.clone();
        let session_map = self.claude_session_map.clone();
        let app = app_handle.clone();
        let sid = session_id.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            let parser = StreamParser::new();

            while let Ok(Some(line)) = lines.next_line().await {
                // Try to extract Claude's session ID from the stream
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
                    // The session_id appears in the initial system message
                    if let Some(sid_val) = val
                        .get("message")
                        .and_then(|m| m.get("session_id"))
                        .and_then(|s| s.as_str())
                    {
                        let mut map = session_map.lock().await;
                        map.insert(sid.clone(), sid_val.to_string());
                    }
                }

                parser.parse_line(&sid, &line, &app).await;
            }

            // Process exited
            let mut procs = processes.lock().await;
            if let Some(proc) = procs.get_mut(&sid) {
                proc.status = ProcessStatus::Completed;
            }

            let _ = app.emit(
                crate::events::CLAUDE_SESSION_STATUS,
                serde_json::json!({
                    "sessionId": sid,
                    "status": "completed"
                }),
            );
        });

        // Spawn stderr reader
        let sid_err = session_id.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::warn!("[claude-stderr:{}] {}", sid_err, line);
            }
        });

        // Update status
        {
            let mut procs = self.processes.lock().await;
            if let Some(proc) = procs.get_mut(&session_id) {
                proc.status = ProcessStatus::Running;
            }
        }

        let _ = app_handle.emit(
            crate::events::CLAUDE_SESSION_STATUS,
            serde_json::json!({
                "sessionId": session_id,
                "status": "active"
            }),
        );

        Ok(())
    }

    /// Send a message to a session. For the first message, writes to stdin.
    /// For subsequent messages, spawns a new process with --resume.
    pub async fn send_message(
        &self,
        session_id: &str,
        message: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), String> {
        let needs_respawn = {
            let procs = self.processes.lock().await;
            match procs.get(session_id) {
                Some(proc) => {
                    proc.stdin.is_none()
                        || proc.status == ProcessStatus::Completed
                }
                None => true,
            }
        };

        if needs_respawn {
            // Need to spawn a new process with --resume
            let (project_path, claude_session_id) = {
                let procs = self.processes.lock().await;
                let project_path = procs
                    .get(session_id)
                    .map(|p| p.project_path.clone())
                    .ok_or_else(|| format!("Session {} not found", session_id))?;

                let map = self.claude_session_map.lock().await;
                let claude_sid = map.get(session_id).cloned();
                (project_path, claude_sid)
            };

            let claude_sid = claude_session_id
                .ok_or("No Claude session ID found — cannot resume session")?;

            // Remove old process
            {
                let mut procs = self.processes.lock().await;
                if let Some(mut old) = procs.remove(session_id) {
                    let _ = old.child.kill().await;
                }
            }

            // Spawn new process with --resume and the message piped to stdin
            self.spawn(
                SpawnOptions {
                    session_id: session_id.to_string(),
                    project_path,
                    claude_cli_path: None,
                    resume_session_id: Some(claude_sid),
                    model: None,
                },
                app_handle,
            )
            .await?;

            // Now write the message to the new process's stdin
            let mut procs = self.processes.lock().await;
            if let Some(proc) = procs.get_mut(session_id) {
                if let Some(stdin) = proc.stdin.as_mut() {
                    stdin
                        .write_all(message.as_bytes())
                        .await
                        .map_err(|e| format!("Failed to write: {}", e))?;
                    stdin
                        .shutdown()
                        .await
                        .map_err(|e| format!("Failed to close stdin: {}", e))?;
                    proc.stdin = None;
                }
            }
        } else {
            // First message — write to existing stdin
            let mut procs = self.processes.lock().await;
            let proc = procs
                .get_mut(session_id)
                .ok_or_else(|| format!("Session {} not found", session_id))?;

            if let Some(stdin) = proc.stdin.as_mut() {
                stdin
                    .write_all(message.as_bytes())
                    .await
                    .map_err(|e| format!("Failed to write: {}", e))?;
                stdin
                    .shutdown()
                    .await
                    .map_err(|e| format!("Failed to close stdin: {}", e))?;
                proc.stdin = None;
            }
        }

        Ok(())
    }

    /// Kill a running process
    pub async fn kill(&self, session_id: &str) -> Result<(), String> {
        let mut procs = self.processes.lock().await;
        if let Some(mut process) = procs.remove(session_id) {
            process
                .child
                .kill()
                .await
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }
        Ok(())
    }

    /// Get the status of a session
    pub async fn get_status(&self, session_id: &str) -> Option<ProcessStatus> {
        let procs = self.processes.lock().await;
        procs.get(session_id).map(|p| p.status.clone())
    }

    /// Get Claude's session ID for our session ID
    pub async fn get_claude_session_id(&self, session_id: &str) -> Option<String> {
        let map = self.claude_session_map.lock().await;
        map.get(session_id).cloned()
    }

    /// Register a Claude session ID mapping (used when loading existing sessions)
    pub async fn register_claude_session_id(
        &self,
        session_id: &str,
        claude_session_id: String,
    ) {
        let mut map = self.claude_session_map.lock().await;
        map.insert(session_id.to_string(), claude_session_id);
    }

    /// Check if a session has an active process
    pub async fn is_active(&self, session_id: &str) -> bool {
        let procs = self.processes.lock().await;
        procs.get(session_id).map_or(false, |p| {
            matches!(
                p.status,
                ProcessStatus::Running | ProcessStatus::Starting | ProcessStatus::WaitingInput
            )
        })
    }

    /// Get all tracked session IDs
    pub async fn active_sessions(&self) -> Vec<String> {
        let procs = self.processes.lock().await;
        procs.keys().cloned().collect()
    }
}
