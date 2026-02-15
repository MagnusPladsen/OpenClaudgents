import { useState, useEffect, useRef, useCallback } from "react";
import { gitLogCommits } from "../../lib/tauri";
import { useSessionStore } from "../../stores/sessionStore";
import type { GitCommitInfo } from "../../lib/tauri";

interface RestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (commitHash: string) => void;
}

export function RestoreDialog({ isOpen, onClose, onRestore }: RestoreDialogProps) {
  const [commits, setCommits] = useState<GitCommitInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });

  // Fetch commits on open
  useEffect(() => {
    if (!isOpen || !activeSession) return;
    const path = activeSession.worktreePath || activeSession.projectPath;
    setLoading(true);
    setError(null);
    setSelectedIndex(0);
    gitLogCommits(path, 20)
      .then(setCommits)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [isOpen, activeSession]);

  const handleSelect = useCallback(() => {
    const commit = commits[selectedIndex];
    if (!commit) return;
    onRestore(commit.hash);
    onClose();
  }, [commits, selectedIndex, onRestore, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, commits.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          handleSelect();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, commits.length, handleSelect, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Restore to commit"
        className="animate-scale-in-spring relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-bg-secondary shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <svg
            className="h-4 w-4 flex-shrink-0 text-accent"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span className="flex-1 text-sm font-medium text-text">
            Restore — Select a commit
          </span>
          <kbd className="rounded-md bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
            Enter to restore
          </kbd>
        </div>

        {/* Commit list */}
        <div ref={listRef} role="listbox" className="max-h-96 overflow-y-auto py-2">
          {loading && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              Loading commits...
            </div>
          )}

          {error && (
            <div className="px-5 py-8 text-center text-xs text-error">
              {error}
            </div>
          )}

          {!loading && !error && commits.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              No commits found
            </div>
          )}

          {commits.map((commit, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={commit.hash}
                data-index={idx}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setSelectedIndex(idx);
                  handleSelect();
                }}
                className={`relative flex w-full items-start gap-3 px-5 py-3 text-left text-sm transition-all duration-150 ${
                  isSelected
                    ? "bg-accent/10 text-text"
                    : "text-text-secondary hover:bg-bg-tertiary/50"
                }`}
              >
                {/* Selected accent bar */}
                {isSelected && (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
                )}

                {/* Short hash */}
                <span className={`flex-shrink-0 font-mono text-xs ${
                  isSelected ? "text-accent" : "text-text-muted"
                }`}>
                  {commit.shortHash}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{commit.message}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                    <span>{commit.author}</span>
                    <span className="text-text-muted/50">|</span>
                    <span>{formatRelativeDate(commit.date)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-5 py-3">
          <div className="text-[10px] text-text-muted">
            Current changes will be stashed before restoring.
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRelativeDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return isoDate;
  }
}
