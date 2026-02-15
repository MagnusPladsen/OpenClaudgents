import { useState, useEffect, useCallback } from "react";

interface WorktreeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  existingSessionName: string;
  onChoose: (choice: "local" | "worktree") => void;
}

export function WorktreeDialog({
  isOpen,
  onClose,
  projectPath,
  existingSessionName,
  onChoose,
}: WorktreeDialogProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<"local" | "worktree" | null>(null);

  const projectName = projectPath.split("/").pop() || projectPath;

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setShowDetails(false);
      setHoveredCard(null);
    }
  }, [isOpen]);

  // Keyboard shortcuts: Enter = worktree (recommended), Escape = close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onChoose("worktree");
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, onChoose, onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Session isolation"
        className="animate-scale-in-spring relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-bg-secondary shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          {/* Git branch icon */}
          <svg
            className="h-4 w-4 flex-shrink-0 text-info"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="6" x2="6" y1="3" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <span className="flex-1 text-sm font-medium text-text">Session Isolation</span>
          <kbd className="rounded-md bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
            Enter for worktree
          </kbd>
        </div>

        {/* Info card */}
        <div className="mx-5 mt-4 rounded-xl border border-white/5 bg-bg/50 px-4 py-3">
          <p className="text-xs text-text-muted">
            <strong className="text-text">{projectName}</strong> already has an active session
            {existingSessionName && (
              <> (<strong className="text-text">{existingSessionName}</strong>)</>
            )}. How should the new session access the codebase?
          </p>
        </div>

        {/* Choice cards */}
        <div className="flex gap-3 px-5 py-4">
          {/* Share Folder */}
          <button
            onClick={() => onChoose("local")}
            onMouseEnter={() => setHoveredCard("local")}
            onMouseLeave={() => setHoveredCard(null)}
            className={`flex flex-1 flex-col items-center gap-2 rounded-xl border px-4 py-5 text-center transition-all duration-200 ${
              hoveredCard === "local"
                ? "border-border bg-bg-tertiary/50 shadow-md"
                : "border-border/40 bg-bg/30 hover:border-border"
            }`}
          >
            {/* Folder icon */}
            <svg
              className="h-6 w-6 text-text-muted"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm font-medium text-text">Share Folder</span>
            <span className="text-[11px] leading-snug text-text-muted">
              Both sessions edit the same files. Risk of conflicts if both are active.
            </span>
          </button>

          {/* Create Worktree */}
          <button
            onClick={() => onChoose("worktree")}
            onMouseEnter={() => setHoveredCard("worktree")}
            onMouseLeave={() => setHoveredCard(null)}
            className={`relative flex flex-1 flex-col items-center gap-2 rounded-xl border px-4 py-5 text-center transition-all duration-200 ${
              hoveredCard === "worktree"
                ? "border-accent bg-accent/5 shadow-md shadow-accent/10"
                : "border-accent/40 bg-accent/[0.02] hover:border-accent/60"
            }`}
          >
            {/* Recommended pill */}
            <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              Recommended
            </span>

            {/* Git branch icon */}
            <svg
              className="h-6 w-6 text-accent"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" x2="6" y1="3" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <span className="text-sm font-medium text-accent">Create Worktree</span>
            <span className="text-[11px] leading-snug text-text-muted">
              Isolated copy of the codebase. No conflicts, auto-cleaned after 4 days.
            </span>
          </button>
        </div>

        {/* Expandable details */}
        <div className="border-t border-white/5 px-5 py-3">
          <button
            onClick={() => setShowDetails((d) => !d)}
            className="flex w-full items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text"
          >
            <svg
              className={`h-3 w-3 transition-transform duration-200 ${showDetails ? "rotate-90" : ""}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            What&apos;s a worktree?
          </button>
          {showDetails && (
            <ul className="mt-2 space-y-1.5 pl-4 text-[11px] text-text-muted">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-text-muted" />
                A fresh checkout is created at <code className="rounded bg-bg-tertiary px-1 text-text">~/.openclaudgents/worktrees/</code>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-text-muted" />
                Current uncommitted changes are carried over
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-text-muted" />
                The agent works in isolation (detached HEAD)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-text-muted" />
                Automatically cleaned up after 4 days of inactivity
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
