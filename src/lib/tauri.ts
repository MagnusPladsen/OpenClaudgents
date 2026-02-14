import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Session, ChatMessage, GitStatus, WorktreeInfo, DiffSummary, FileDiffContent, TodoItem, AgentTeam, McpServerInfo } from "./types";

// --- Discovered session type (from Rust session_store) ---

export interface DiscoveredSession {
  claudeSessionId: string;
  projectPath: string;
  name: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  model: string | null;
  gitBranch: string | null;
}

export interface ParsedMessage {
  uuid: string;
  parentUuid: string | null;
  role: string;
  content: string | object[];
  timestamp: string;
  isSidechain: boolean;
  model: string | null;
}

// --- Tauri Commands (Frontend → Rust) ---

export async function createSession(
  projectPath: string,
  model?: string,
): Promise<Session> {
  return invoke("create_session", { projectPath, model });
}

export async function sendMessage(
  sessionId: string,
  message: string,
): Promise<void> {
  return invoke("send_message", { sessionId, message });
}

export async function killSession(sessionId: string): Promise<void> {
  return invoke("kill_session", { sessionId });
}

export async function detectClaudeCli(): Promise<string | null> {
  return invoke("detect_claude_cli");
}

export async function discoverSessions(): Promise<DiscoveredSession[]> {
  return invoke("discover_sessions");
}

export async function getSessionMessages(
  claudeSessionId: string,
): Promise<ParsedMessage[]> {
  return invoke("get_session_messages", { claudeSessionId });
}

export async function resumeSession(
  claudeSessionId: string,
  projectPath: string,
): Promise<Session> {
  return invoke("resume_session", { claudeSessionId, projectPath });
}

// --- Git & Worktree Commands ---

export async function getGitStatus(path: string): Promise<GitStatus> {
  return invoke("get_git_status", { path });
}

export async function getGitDiff(
  path: string,
  base?: string,
): Promise<DiffSummary> {
  return invoke("get_git_diff", { path, base });
}

export async function createWorktree(
  sessionId: string,
  projectPath: string,
): Promise<WorktreeInfo> {
  return invoke("create_worktree", { sessionId, projectPath });
}

export async function removeWorktree(
  projectPath: string,
  worktreePath: string,
  saveSnapshot: boolean,
): Promise<string | null> {
  return invoke("remove_worktree", { projectPath, worktreePath, saveSnapshot });
}

export async function listWorktrees(projectPath: string): Promise<string[]> {
  return invoke("list_worktrees", { projectPath });
}

export async function getFileDiffContent(
  repoPath: string,
  filePath: string,
  base?: string,
): Promise<FileDiffContent> {
  return invoke("get_file_diff_content", { repoPath, filePath, base });
}

export async function gitStageAll(path: string): Promise<void> {
  return invoke("git_stage_all", { path });
}

export async function gitCommit(path: string, message: string): Promise<string> {
  return invoke("git_commit", { path, message });
}

export async function gitPush(path: string): Promise<string> {
  return invoke("git_push", { path });
}

export async function cleanupWorktrees(
  projectPath: string,
  maxAgeDays?: number,
  maxCount?: number,
): Promise<string[]> {
  return invoke("cleanup_worktrees", { projectPath, maxAgeDays, maxCount });
}

// --- Settings & CLAUDE.md Commands ---

export async function getClaudeMd(projectPath: string): Promise<string | null> {
  return invoke("get_claude_md", { projectPath });
}

export async function updateClaudeMd(
  projectPath: string,
  content: string,
): Promise<void> {
  return invoke("update_claude_md", { projectPath, content });
}

// --- Agent Team Commands ---

export async function getAgentTeams(): Promise<AgentTeam[]> {
  return invoke("get_agent_teams");
}

export async function getMcpServers(): Promise<McpServerInfo[]> {
  return invoke("get_mcp_servers");
}

export async function getTeamTasks(teamName: string): Promise<unknown[]> {
  return invoke("get_team_tasks", { teamName });
}

// --- Todo Commands ---

export async function getClaudeTodos(): Promise<TodoItem[]> {
  return invoke("get_claude_todos");
}

// --- Tauri Event Listeners (Rust → Frontend) ---

export function onClaudeStreamEvent(
  callback: (event: { sessionId: string; data: string }) => void,
): Promise<UnlistenFn> {
  return listen("claude:stream_event", (event) => {
    callback(event.payload as { sessionId: string; data: string });
  });
}

export function onClaudeMessageComplete(
  callback: (event: { sessionId: string; message: ChatMessage }) => void,
): Promise<UnlistenFn> {
  return listen("claude:message_complete", (event) => {
    callback(
      event.payload as { sessionId: string; message: ChatMessage },
    );
  });
}

export function onSessionStatusChanged(
  callback: (event: { sessionId: string; status: string }) => void,
): Promise<UnlistenFn> {
  return listen("claude:session_status", (event) => {
    callback(event.payload as { sessionId: string; status: string });
  });
}

export function onUsageUpdate(
  callback: (event: {
    sessionId: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
    };
  }) => void,
): Promise<UnlistenFn> {
  return listen("claude:usage_update", (event) => {
    callback(
      event.payload as {
        sessionId: string;
        usage: { inputTokens: number; outputTokens: number };
      },
    );
  });
}
