export interface Session {
  id: string;
  claudeSessionId: string;
  name: string | null;
  projectPath: string;
  worktreePath: string | null;
  status: "active" | "paused" | "completed" | "error" | "waiting_input";
  model: string | null;
  createdAt: string;
  updatedAt: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  isAgentTeam: boolean;
  teamRole: "lead" | "teammate" | null;
  parentSessionId: string | null;
  pinned: boolean;
}

export interface ChatMessage {
  uuid: string;
  parentUuid: string | null;
  role: "user" | "assistant" | "system";
  content: string | ContentBlock[];
  timestamp: string;
  isSidechain: boolean;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  isStreaming?: boolean;
}

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  status: "running" | "completed" | "error";
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface GitStatus {
  branch: string;
  isDirty: boolean;
  dirtyFileCount: number;
  lastCommitMessage: string;
  lastCommitHash: string;
  isWorktree: boolean;
}

export interface WorktreeInfo {
  id: string;
  sessionId: string;
  path: string;
  baseCommit: string;
  projectPath: string;
  createdAt: string;
  isDirty: boolean;
}

export interface DiffFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
}

export interface DiffSummary {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  rawDiff: string;
}

export interface AgentTeam {
  name: string;
  configPath: string;
  members: AgentTeamMember[];
}

export interface AgentTeamMember {
  name: string;
  agentId: string;
  agentType: string;
  role: "lead" | "teammate";
}

export interface McpServerInfo {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "done";
  sourceFile: string;
}

export interface FileDiffContent {
  filePath: string;
  original: string;
  modified: string;
  language: string;
}

export interface CustomSkill {
  name: string;
  description: string;
  source: "personal" | "project";
  filePath: string;
}

export interface AppSettings {
  theme: string;
  fontSize: number;
  showTerminalDrawer: boolean;
  worktreeBaseDir: string;
  worktreeAutoCleanupDays: number;
  maxWorktrees: number;
  notificationsEnabled: boolean;
  notifySounds: boolean;
  defaultModel: string | null;
  claudeCliPath: string;
  apiKey: string | null;
}
