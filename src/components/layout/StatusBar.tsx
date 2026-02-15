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

  // Cost estimate
  const cost = estimateCost(activeSession?.model, inputTokens, outputTokens);

  return (
    <footer className="flex h-8 items-center justify-between border-t border-border bg-bg-secondary px-3 text-xs text-text-muted" aria-label="Status bar">
      <div className="flex items-center gap-3">
        {/* Session status */}
        {activeSession && (
          <>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isStreaming
                    ? "animate-pulse bg-success shadow-sm shadow-success/50"
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

            {/* Divider */}
            <span className="h-3 w-px bg-border" />

            {/* Model badge */}
            {activeSession.model && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                {formatModelName(activeSession.model)}
              </span>
            )}

            {/* Message count */}
            <span>{messageCount} msgs</span>

            {/* Git branch */}
            {gitStatus && (
              <>
                <span className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1">
                  {/* Branch icon */}
                  <svg
                    className="h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="6" y1="3" x2="6" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                  </svg>
                  <span>{gitStatus.branch}</span>
                  {gitStatus.isDirty && (
                    <span className="text-warning">
                      ({gitStatus.dirtyFileCount})
                    </span>
                  )}
                  {gitStatus.isWorktree && (
                    <span className="rounded bg-accent/20 px-1 text-[10px] text-accent">
                      wt
                    </span>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {!activeSession && <span>No active session</span>}
      </div>

      <div className="flex items-center gap-3">
        {/* Context budget bar + tokens + cost */}
        {activeSession && totalTokens > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative h-2 w-24 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${contextPercent}%`,
                  background: contextPercent > 95
                    ? "var(--color-error)"
                    : contextPercent > 70
                      ? `linear-gradient(90deg, var(--color-success), var(--color-warning))`
                      : "var(--color-success)",
                }}
              />
              {/* Percentage overlay */}
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-text mix-blend-difference">
                {contextPercent}%
              </span>
            </div>
            <span>
              {formatTokenCount(totalTokens)} tokens | {formatCost(cost)}
            </span>
          </div>
        )}

        {/* Divider */}
        <span className="h-3 w-px bg-border" />

        {/* Terminal toggle */}
        <button
          onClick={onToggleTerminal}
          aria-label="Toggle terminal"
          aria-pressed={showTerminal}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-all duration-150 hover:bg-bg-tertiary ${
            showTerminal ? "text-accent" : "text-text-muted"
          }`}
          title="Toggle Terminal (Cmd+J)"
        >
          {/* Terminal icon */}
          <svg
            className="h-3.5 w-3.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
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
