use serde::{Deserialize, Serialize};

/// A single event from Claude Code's stream-json output
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeStreamEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    #[serde(flatten)]
    pub data: serde_json::Value,
}

/// An entry from a Claude Code session JSONL file
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeSessionEntry {
    #[serde(rename = "type")]
    pub entry_type: String,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub uuid: Option<String>,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "gitBranch")]
    pub git_branch: Option<String>,
    pub cwd: Option<String>,
    #[serde(rename = "isSidechain")]
    pub is_sidechain: Option<bool>,
    pub message: Option<ClaudeMessage>,
}

/// A Claude message (user or assistant)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeMessage {
    pub role: String,
    pub content: serde_json::Value,
    pub model: Option<String>,
    pub usage: Option<TokenUsage>,
    pub stop_reason: Option<String>,
}

/// Token usage statistics from the API
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenUsage {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_creation_input_tokens: Option<u64>,
    pub cache_read_input_tokens: Option<u64>,
}
