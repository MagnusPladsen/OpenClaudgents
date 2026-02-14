import { useState } from "react";
import type { GitStatus } from "../../lib/types";
import { gitStageAll, gitCommit, gitPush } from "../../lib/tauri";

interface GitStatusBarProps {
  status: GitStatus | null;
  projectPath?: string | null;
  showActions?: boolean;
}

export function GitStatusBar({ status, projectPath, showActions = false }: GitStatusBarProps) {
  const [commitMsg, setCommitMsg] = useState("");
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  if (!status) return null;

  const handleStageAll = async () => {
    if (!projectPath) return;
    setIsWorking(true);
    try {
      await gitStageAll(projectPath);
      setActionResult("Staged all changes");
    } catch (err) {
      setActionResult(`Stage failed: ${err}`);
    }
    setIsWorking(false);
    setTimeout(() => setActionResult(null), 3000);
  };

  const handleCommit = async () => {
    if (!projectPath || !commitMsg.trim()) return;
    setIsWorking(true);
    try {
      await gitStageAll(projectPath);
      await gitCommit(projectPath, commitMsg.trim());
      setCommitMsg("");
      setShowCommitInput(false);
      setActionResult("Committed successfully");
    } catch (err) {
      setActionResult(`Commit failed: ${err}`);
    }
    setIsWorking(false);
    setTimeout(() => setActionResult(null), 3000);
  };

  const handlePush = async () => {
    if (!projectPath) return;
    setIsWorking(true);
    try {
      await gitPush(projectPath);
      setActionResult("Pushed successfully");
    } catch (err) {
      setActionResult(`Push failed: ${err}`);
    }
    setIsWorking(false);
    setTimeout(() => setActionResult(null), 3000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {/* Branch name */}
          <div className="flex items-center gap-1">
            <BranchIcon />
            <span className="font-medium text-text">{status.branch}</span>
          </div>

          {/* Worktree badge */}
          {status.isWorktree && (
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-accent">
              worktree
            </span>
          )}

          {/* Dirty count */}
          {status.isDirty && (
            <span className="text-warning">
              {status.dirtyFileCount} changed
            </span>
          )}
        </div>

        {/* Quick actions */}
        {showActions && projectPath && (
          <div className="flex items-center gap-1">
            {status.isDirty && (
              <>
                <button
                  onClick={handleStageAll}
                  disabled={isWorking}
                  className="rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text disabled:opacity-50"
                  title="Stage all changes"
                >
                  Stage
                </button>
                <button
                  onClick={() => setShowCommitInput(!showCommitInput)}
                  disabled={isWorking}
                  className="rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text disabled:opacity-50"
                  title="Commit changes"
                >
                  Commit
                </button>
              </>
            )}
            <button
              onClick={handlePush}
              disabled={isWorking}
              className="rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text disabled:opacity-50"
              title="Push to remote"
            >
              Push
            </button>
          </div>
        )}
      </div>

      {/* Last commit */}
      <div className="truncate text-xs text-text-muted" title={status.lastCommitMessage}>
        {status.lastCommitHash.slice(0, 7)} {status.lastCommitMessage}
      </div>

      {/* Commit input */}
      {showCommitInput && (
        <div className="flex gap-1">
          <input
            type="text"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCommit()}
            placeholder="Commit message..."
            className="flex-1 rounded border border-border bg-bg-tertiary px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleCommit}
            disabled={isWorking || !commitMsg.trim()}
            className="rounded bg-accent px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            OK
          </button>
        </div>
      )}

      {/* Action result */}
      {actionResult && (
        <div className="text-xs text-text-muted">{actionResult}</div>
      )}
    </div>
  );
}

function BranchIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
      <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </svg>
  );
}
