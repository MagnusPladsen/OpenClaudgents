import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { useGitStatus } from "../../hooks/useGitStatus";
import { estimateCost, formatCost } from "../../lib/cost";

interface StatusBarProps {
  showTerminal: boolean;
  onToggleTerminal: () => void;
}

// Approximate context window sizes by model
const CONTEXT_WINDOWS: Record<string, number> = {
  "claude-sonnet-4-5-20250929": 200000,
  "claude-opus-4-6": 200000,
  "claude-haiku-4-5-20251001": 200000,
};
const DEFAULT_CONTEXT_WINDOW = 200000;

export function StatusBar({ showTerminal, onToggleTerminal }: StatusBarProps) {
  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });
  const isStreaming = useChatStore((s) => s.isStreaming);
  const messageCount = useChatStore((s) => s.messages.length);

  const projectPath = activeSession?.worktreePath || activeSession?.projectPath;
  const gitStatus = useGitStatus(projectPath);

  const inputTokens = activeSession?.totalInputTokens ?? 0;
  const outputTokens = activeSession?.totalOutputTokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  // Context budget calculation
  const contextWindow = activeSession?.model
    ? (CONTEXT_WINDOWS[activeSession.model] || DEFAULT_CONTEXT_WINDOW)
    : DEFAULT_CONTEXT_WINDOW;
  const contextPercent = Math.min(
    100,
    Math.round((totalTokens / contextWindow) * 100),
  );
  const contextColor =
    contextPercent > 95
      ? "bg-error"
      : contextPercent > 85
        ? "bg-warning"
        : contextPercent > 70
          ? "bg-warning"
          : "bg-success";

  // Cost estimate
  const cost = estimateCost(activeSession?.model, inputTokens, outputTokens);

  return (
    <footer className="flex h-7 items-center justify-between border-t border-border bg-bg-secondary px-3 text-xs text-text-muted" aria-label="Status bar">
      <div className="flex items-center gap-4">
        {/* Session status */}
        {activeSession && (
          <>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isStreaming
                    ? "animate-pulse bg-success"
                    : activeSession.status === "active"
                      ? "bg-success"
                      : activeSession.status === "error"
                        ? "bg-error"
                        : activeSession.status === "waiting_input"
                          ? "bg-warning"
                          : "bg-text-muted"
                }`}
              />
              <span>{activeSession.status}</span>
            </div>

            {/* Model */}
            {activeSession.model && (
              <span>{formatModelName(activeSession.model)}</span>
            )}

            {/* Message count */}
            <span>{messageCount} msgs</span>

            {/* Git branch */}
            {gitStatus && (
              <div className="flex items-center gap-1">
                <span>{gitStatus.branch}</span>
                {gitStatus.isDirty && (
                  <span className="text-warning">
                    ({gitStatus.dirtyFileCount})
                  </span>
                )}
                {gitStatus.isWorktree && (
                  <span className="rounded bg-accent/20 px-1 text-accent">
                    wt
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {!activeSession && <span>No active session</span>}
      </div>

      <div className="flex items-center gap-4">
        {/* Context budget bar + tokens + cost */}
        {activeSession && totalTokens > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className={`h-full rounded-full transition-all ${contextColor}`}
                style={{ width: `${contextPercent}%` }}
              />
            </div>
            <span>
              {contextPercent}% | {formatTokenCount(totalTokens)} tokens | {formatCost(cost)}
            </span>
          </div>
        )}

        {/* Terminal toggle */}
        <button
          onClick={onToggleTerminal}
          aria-label="Toggle terminal"
          aria-pressed={showTerminal}
          className={`rounded px-1.5 py-0.5 transition-colors hover:bg-bg-tertiary ${
            showTerminal ? "text-accent" : "text-text-muted"
          }`}
          title="Toggle Terminal (Cmd+J)"
        >
          Terminal
        </button>
      </div>
    </footer>
  );
}

function formatModelName(model: string): string {
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  if (model.includes("haiku")) return "Haiku";
  return model.split("-").pop() || model;
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
