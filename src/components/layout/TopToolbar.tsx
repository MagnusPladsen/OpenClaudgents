import { useSessionStore } from "../../stores/sessionStore";
import { useChatStore } from "../../stores/chatStore";
import { useGitStatus } from "../../hooks/useGitStatus";
import type { Tab } from "./PreviewPane";

interface TopToolbarProps {
  onTogglePreview: () => void;
  onOpenPreviewTab: (tab: Tab) => void;
  showPreview: boolean;
}

export function TopToolbar({ onTogglePreview, onOpenPreviewTab, showPreview }: TopToolbarProps) {
  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });
  const planMode = useChatStore((s) => s.planMode);

  const projectPath = activeSession?.worktreePath || activeSession?.projectPath;
  const gitStatus = useGitStatus(projectPath ?? null);

  const sessionName = activeSession?.name
    || activeSession?.projectPath.split("/").pop()
    || "New Session";

  return (
    <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border/20 bg-bg/50 px-5 backdrop-blur-sm">
      {/* Left: Session info */}
      <div className="flex min-w-0 flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-tight text-text">
            {sessionName}
          </span>
          {activeSession?.worktreePath && (
            <span className="flex items-center gap-1 rounded-md bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info" title={activeSession.worktreePath}>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" x2="6" y1="3" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              Worktree
            </span>
          )}
          {planMode && (
            <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              Plan
            </span>
          )}
          {activeSession?.model && (
            <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {activeSession.model.includes("sonnet") ? "Sonnet" : activeSession.model.includes("opus") ? "Opus" : "Haiku"}
            </span>
          )}
        </div>
        {activeSession?.projectPath && (
          <span className="truncate text-[11px] text-text-muted">
            {activeSession.projectPath}
          </span>
        )}
      </div>

      {/* Center: Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onOpenPreviewTab("diff")}
          className="rounded-lg border border-border/30 bg-bg-tertiary/40 px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-tertiary/60 hover:text-text"
        >
          Open
        </button>
        <button
          onClick={() => onOpenPreviewTab("diff")}
          className="rounded-lg border border-border/30 bg-bg-tertiary/40 px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-tertiary/60 hover:text-text"
        >
          Commit
        </button>
      </div>

      {/* Right: Diff stats + preview toggle */}
      <div className="flex items-center gap-3">
        {/* Diff stats */}
        {gitStatus && gitStatus.isDirty && (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-success">+{gitStatus.dirtyFileCount}</span>
            <span className="text-text-muted">/</span>
            <span className="text-error">-{gitStatus.dirtyFileCount}</span>
          </div>
        )}

        {/* Preview toggle */}
        <button
          onClick={onTogglePreview}
          aria-label={showPreview ? "Hide preview" : "Show preview"}
          className={`rounded-lg p-1.5 transition-all ${
            showPreview
              ? "bg-accent/10 text-accent"
              : "text-text-muted hover:bg-bg-tertiary hover:text-text"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <line x1="15" x2="15" y1="3" y2="21" />
          </svg>
        </button>
      </div>
    </header>
  );
}
