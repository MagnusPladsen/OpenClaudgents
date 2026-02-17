use serde_json::Value;
use tauri::Emitter;

use crate::events;

/// Parses NDJSON lines from Claude CLI's `--output-format stream-json` output
/// and emits corresponding Tauri events for the frontend.
///
/// The CLI wraps API streaming events inside `{"type":"stream_event","event":{...}}`.
/// It also emits `{"type":"system",...}`, `{"type":"assistant",...}`, and
/// `{"type":"result",...}` at the top level.
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

        // Dispatch based on the top-level CLI event type
        let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match event_type {
            // Wrapped API streaming events — unwrap and dispatch inner event
            "stream_event" => {
                if let Some(inner) = event.get("event") {
                    self.handle_stream_event(session_id, inner, app);
                }
            }

            // System events (init, hooks, etc.)
            "system" => {
                self.handle_system_event(session_id, &event, app);
            }

            // Complete assistant message (emitted after streaming finishes)
            "assistant" => {
                self.handle_assistant_event(session_id, &event, app);
            }

            // Final result — session turn complete
            "result" => {
                self.handle_result_event(session_id, &event, app);
            }

            _ => {
                log::debug!(
                    "[stream-parser:{}] Unknown top-level event type: {}",
                    session_id,
                    event_type
                );
            }
        }
    }

    /// Handle system events (init with session_id, hooks, etc.)
    fn handle_system_event(&self, session_id: &str, event: &Value, app: &tauri::AppHandle) {
        let subtype = event.get("subtype").and_then(|s| s.as_str()).unwrap_or("");

        match subtype {
            "init" => {
                // The init event contains session_id, model, tools, etc.
                let claude_session_id = event.get("session_id").and_then(|s| s.as_str());
                let model = event.get("model").and_then(|m| m.as_str());

                log::info!(
                    "[stream-parser:{}] init: claude_session_id={:?}, model={:?}",
                    session_id,
                    claude_session_id,
                    model
                );
            }
            "compaction" => {
                log::info!("[stream-parser:{}] context compaction occurred", session_id);
                let _ = app.emit(
                    events::CLAUDE_COMPACTION,
                    serde_json::json!({
                        "sessionId": session_id,
                    }),
                );
            }
            // hook_started, hook_response, etc. are ignored (internal to CLI)
            _ => {}
        }
    }

    /// Handle unwrapped API streaming events (message_start, content_block_delta, etc.)
    fn handle_stream_event(&self, session_id: &str, inner: &Value, app: &tauri::AppHandle) {
        let inner_type = inner.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match inner_type {
            "message_start" => {
                if let Some(message) = inner.get("message") {
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

            "content_block_start" => {
                let content_block = inner.get("content_block");
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

            "content_block_delta" => {
                if let Some(delta) = inner.get("delta") {
                    let delta_type = delta.get("type").and_then(|t| t.as_str()).unwrap_or("");

                    match delta_type {
                        "text_delta" => {
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

            "content_block_stop" => {
                // Content block finished — no specific action needed
            }

            "message_delta" => {
                // Extract usage statistics
                if let Some(usage) = inner.get("usage") {
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
                if let Some(delta) = inner.get("delta") {
                    if let Some(stop_reason) =
                        delta.get("stop_reason").and_then(|s| s.as_str())
                    {
                        log::debug!(
                            "[stream-parser:{}] message_delta stop_reason={}",
                            session_id,
                            stop_reason
                        );
                    }
                }
            }

            "message_stop" => {
                let _ = app.emit(
                    events::CLAUDE_MESSAGE_COMPLETE,
                    serde_json::json!({
                        "sessionId": session_id,
                    }),
                );
            }

            _ => {
                log::debug!(
                    "[stream-parser:{}] Unknown stream event type: {}",
                    session_id,
                    inner_type
                );
            }
        }
    }

    /// Handle complete assistant message (emitted after stream finishes)
    fn handle_assistant_event(&self, session_id: &str, event: &Value, _app: &tauri::AppHandle) {
        if let Some(message) = event.get("message") {
            let model = message.get("model").and_then(|m| m.as_str());
            log::debug!(
                "[stream-parser:{}] assistant message complete, model={:?}",
                session_id,
                model
            );
        }
    }

    /// Handle result event — the session turn is complete
    fn handle_result_event(&self, session_id: &str, event: &Value, app: &tauri::AppHandle) {
        let is_error = event.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
        let subtype = event.get("subtype").and_then(|s| s.as_str()).unwrap_or("");

        if is_error {
            log::warn!(
                "[stream-parser:{}] result error: subtype={}",
                session_id,
                subtype
            );
        }

        // Extract total usage from result
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

        // Emit message complete for the result (in case message_stop was missed)
        let _ = app.emit(
            events::CLAUDE_MESSAGE_COMPLETE,
            serde_json::json!({
                "sessionId": session_id,
            }),
        );
    }
}
