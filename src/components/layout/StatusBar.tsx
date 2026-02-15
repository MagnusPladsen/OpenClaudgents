import { useSessionStore } from "../../stores/sessionStore";
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

  const cost = estimateCost(activeSession?.model, inputTokens, outputTokens);

  const barColor =
    contextPercent > 85
      ? "bg-error"
      : contextPercent > 60
        ? "bg-warning"
        : "bg-success";

  return (
    <footer
      className="flex h-10 items-center justify-between border-t border-border/20 bg-bg-secondary/80 text-xs text-text-muted backdrop-blur-sm"
      aria-label="Status bar"
    >
      {/* Left segment: git + model */}
      <div className="flex h-full items-center">
        {activeSession && gitStatus && (
          <div
            className={`flex h-full items-center gap-1.5 border-r border-border/10 px-3 ${
              gitStatus.isDirty ? "text-warning" : ""
            }`}
          >
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
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <span className="font-medium">{gitStatus.branch}</span>
            {gitStatus.isDirty && (
              <span className="opacity-80">({gitStatus.dirtyFileCount})</span>
            )}
            {gitStatus.isWorktree && (
              <span className="rounded bg-accent/20 px-1 text-[9px] font-medium text-accent">
                wt
              </span>
            )}
          </div>
        )}

        {activeSession?.model && (
          <div className="flex h-full items-center border-r border-border/10 px-3">
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
              {formatModelName(activeSession.model)}
            </span>
          </div>
        )}

        {!activeSession && (
          <span className="px-3">No active session</span>
        )}
      </div>

      {/* Right segment: context bar + terminal */}
      <div className="flex h-full items-center">
        {/* Context budget bar with hover tooltip */}
        {activeSession && totalTokens > 0 && (
          <div className="group/budget relative flex h-full items-center gap-2 border-l border-border/10 px-3 transition-colors hover:bg-bg-tertiary/40">
            <div className="relative h-2 w-[120px] overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${contextPercent}%` }}
              />
            </div>
            <span className="tabular-nums">{contextPercent}%</span>

            {/* Tooltip — appears above on hover */}
            <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-52 rounded-lg border border-border/50 bg-bg-secondary p-3 opacity-0 shadow-xl shadow-black/20 transition-opacity duration-200 group-hover/budget:opacity-100">
              <div className="mb-2 text-[11px] font-semibold text-text">
                Context: {contextPercent}% used
              </div>
              <div className="mb-2 h-px bg-border/30" />
              <div className="flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-text-muted">Input</span>
                  <span className="font-medium text-text">{formatTokenCount(inputTokens)} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Output</span>
                  <span className="font-medium text-text">{formatTokenCount(outputTokens)} tokens</span>
                </div>
                <div className="my-0.5 h-px bg-border/20" />
                <div className="flex justify-between">
                  <span className="text-text-muted">Total</span>
                  <span className="font-medium text-text">
                    {formatTokenCount(totalTokens)} / {formatTokenCount(contextWindow)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Cost</span>
                  <span className="font-medium text-text">{formatCost(cost)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Terminal toggle */}
        <button
          onClick={onToggleTerminal}
          aria-label="Toggle terminal"
          aria-pressed={showTerminal}
          className={`flex h-full items-center gap-1 border-l border-border/10 px-3 transition-colors hover:bg-bg-tertiary/40 active:scale-95 ${
            showTerminal ? "text-accent" : ""
          }`}
          title="Toggle Terminal (Cmd+J)"
        >
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
