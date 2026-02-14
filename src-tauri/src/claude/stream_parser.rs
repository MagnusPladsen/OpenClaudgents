use serde_json::Value;
use tauri::Emitter;

use crate::events;

/// Parses NDJSON lines from Claude CLI's `--output-format stream-json` output
/// and emits corresponding Tauri events for the frontend.
pub struct StreamParser {
    // Stateless parser — each line is self-contained NDJSON
}

impl StreamParser {
    pub fn new() -> Self {
        Self {}
    }

    /// Parse a single NDJSON line and emit appropriate Tauri events
    pub async fn parse_line(&self, session_id: &str, line: &str, app: &tauri::AppHandle) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return;
        }

        // Parse the JSON line
        let event: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(e) => {
                log::warn!(
                    "[stream-parser:{}] Failed to parse NDJSON line: {} — line: {}",
                    session_id,
                    e,
                    &trimmed[..trimmed.len().min(200)]
                );
                return;
            }
        };

        // Always emit the raw event for the terminal drawer / debugging
        let _ = app.emit(
            events::CLAUDE_STREAM_EVENT,
            serde_json::json!({
                "sessionId": session_id,
                "event": &event,
            }),
        );

        // Dispatch based on event type
        let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match event_type {
            "message_start" => {
                self.handle_message_start(session_id, &event, app);
            }

            "content_block_start" => {
                self.handle_content_block_start(session_id, &event, app);
            }

            "content_block_delta" => {
                self.handle_content_block_delta(session_id, &event, app);
            }

            "content_block_stop" => {
                // Content block finished — no specific action needed,
                // the frontend tracks completion via content_block_start/delta
            }

            "message_delta" => {
                self.handle_message_delta(session_id, &event, app);
            }

            "message_stop" => {
                self.handle_message_stop(session_id, &event, app);
            }

            _ => {
                // Unknown event type — log but don't fail
                log::debug!(
                    "[stream-parser:{}] Unknown event type: {}",
                    session_id,
                    event_type
                );
            }
        }
    }

    /// Handle message_start: beginning of a new assistant message
    fn handle_message_start(&self, session_id: &str, event: &Value, _app: &tauri::AppHandle) {
        // Extract the session ID from the message if available
        // The message_start event contains the initial message object
        if let Some(message) = event.get("message") {
            let model = message.get("model").and_then(|m| m.as_str());
            let role = message.get("role").and_then(|r| r.as_str());

            log::debug!(
                "[stream-parser:{}] message_start: role={:?}, model={:?}",
                session_id,
                role,
                model
            );
        }
    }

    /// Handle content_block_start: beginning of a text or tool_use block
    fn handle_content_block_start(
        &self,
        session_id: &str,
        event: &Value,
        app: &tauri::AppHandle,
    ) {
        let content_block = event.get("content_block");
        let block_type = content_block
            .and_then(|cb| cb.get("type"))
            .and_then(|t| t.as_str())
            .unwrap_or("");

        if block_type == "tool_use" {
            let tool_name = content_block
                .and_then(|cb| cb.get("name"))
                .and_then(|n| n.as_str())
                .unwrap_or("unknown");
            let tool_id = content_block
                .and_then(|cb| cb.get("id"))
                .and_then(|id| id.as_str())
                .unwrap_or("");

            let _ = app.emit(
                events::CLAUDE_TOOL_START,
                serde_json::json!({
                    "sessionId": session_id,
                    "toolName": tool_name,
                    "toolId": tool_id,
                }),
            );
        }
    }

    /// Handle content_block_delta: streaming text or tool input chunks
    fn handle_content_block_delta(
        &self,
        session_id: &str,
        event: &Value,
        app: &tauri::AppHandle,
    ) {
        if let Some(delta) = event.get("delta") {
            let delta_type = delta.get("type").and_then(|t| t.as_str()).unwrap_or("");

            match delta_type {
                "text_delta" => {
                    // Streaming text from the assistant
                    if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                        let _ = app.emit(
                            "claude:text_delta",
                            serde_json::json!({
                                "sessionId": session_id,
                                "text": text,
                            }),
                        );
                    }
                }
                "input_json_delta" => {
                    // Streaming tool input JSON
                    if let Some(partial_json) =
                        delta.get("partial_json").and_then(|j| j.as_str())
                    {
                        let _ = app.emit(
                            "claude:tool_input_delta",
                            serde_json::json!({
                                "sessionId": session_id,
                                "partialJson": partial_json,
                            }),
                        );
                    }
                }
                _ => {}
            }
        }
    }

    /// Handle message_delta: final usage stats and stop reason
    fn handle_message_delta(&self, session_id: &str, event: &Value, app: &tauri::AppHandle) {
        // Extract usage statistics
        if let Some(usage) = event.get("usage") {
            let input_tokens = usage
                .get("input_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let output_tokens = usage
                .get("output_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let cache_creation = usage
                .get("cache_creation_input_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let cache_read = usage
                .get("cache_read_input_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);

            let _ = app.emit(
                events::CLAUDE_USAGE_UPDATE,
                serde_json::json!({
                    "sessionId": session_id,
                    "usage": {
                        "inputTokens": input_tokens,
                        "outputTokens": output_tokens,
                        "cacheCreationInputTokens": cache_creation,
                        "cacheReadInputTokens": cache_read,
                    }
                }),
            );
        }

        // Extract stop reason
        if let Some(delta) = event.get("delta") {
            if let Some(stop_reason) = delta.get("stop_reason").and_then(|s| s.as_str()) {
                log::debug!(
                    "[stream-parser:{}] message_delta stop_reason={}",
                    session_id,
                    stop_reason
                );
            }
        }
    }

    /// Handle message_stop: assistant message is complete
    fn handle_message_stop(&self, session_id: &str, _event: &Value, app: &tauri::AppHandle) {
        let _ = app.emit(
            events::CLAUDE_MESSAGE_COMPLETE,
            serde_json::json!({
                "sessionId": session_id,
            }),
        );
    }
}
