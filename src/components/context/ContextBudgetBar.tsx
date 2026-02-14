import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { TokenCounter } from "./TokenCounter";

// Approximate context window sizes by model
const CONTEXT_WINDOWS: Record<string, number> = {
  "claude-sonnet-4-5-20250929": 200000,
  "claude-opus-4-6": 200000,
  "claude-haiku-4-5-20251001": 200000,
};
const DEFAULT_CONTEXT_WINDOW = 200000;

interface ContextBudgetBarProps {
  compact?: boolean;
}

export function ContextBudgetBar({ compact = false }: ContextBudgetBarProps) {
  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });
  const compactionCount = useChatStore((s) => s.compactionCount);

  const inputTokens = activeSession?.totalInputTokens ?? 0;
  const outputTokens = activeSession?.totalOutputTokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  const contextWindow = activeSession?.model
    ? (CONTEXT_WINDOWS[activeSession.model] || DEFAULT_CONTEXT_WINDOW)
    : DEFAULT_CONTEXT_WINDOW;

  const percent = Math.min(100, Math.round((totalTokens / contextWindow) * 100));

  const { color, label } = getThreshold(percent);

  if (totalTokens === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-tertiary">
          <div
            className={`h-full rounded-full transition-all duration-300 ${color}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-text-muted">
          {percent}%
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text">Context Budget</h3>
        <span className={`text-xs font-medium ${labelColor(percent)}`}>
          {label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Token breakdown */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <div className="flex gap-4">
          <TokenCounter label="Input" count={inputTokens} />
          <TokenCounter label="Output" count={outputTokens} />
          <TokenCounter label="Total" count={totalTokens} highlight />
        </div>
        <span>
          {formatCount(totalTokens)} / {formatCount(contextWindow)}
        </span>
      </div>

      {/* Compaction indicator */}
      {compactionCount > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
          <CompactionIcon />
          <span>
            Context compacted {compactionCount} time{compactionCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function getThreshold(percent: number): { color: string; label: string } {
  if (percent > 95) return { color: "bg-error", label: "Critical" };
  if (percent > 85) return { color: "bg-warning", label: "High" };
  if (percent > 70) return { color: "bg-warning", label: "Moderate" };
  return { color: "bg-success", label: "Healthy" };
}

function labelColor(percent: number): string {
  if (percent > 95) return "text-error";
  if (percent > 85) return "text-warning";
  if (percent > 70) return "text-warning";
  return "text-success";
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function CompactionIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 1Z" />
      <path d="M2.5 13.25a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75Z" />
    </svg>
  );
}
