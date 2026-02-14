import { useState, useEffect } from "react";
import { listWorktrees, removeWorktree, cleanupWorktrees } from "../../lib/tauri";
import { useSessionStore } from "../../stores/sessionStore";

export function WorktreeManager() {
  const [worktrees, setWorktrees] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });

  const projectPath = activeSession?.projectPath;

  useEffect(() => {
    if (!projectPath) return;
    listWorktrees(projectPath)
      .then(setWorktrees)
      .catch((err) => console.error("Failed to list worktrees:", err));
  }, [projectPath]);

  const handleRemove = async (wtPath: string) => {
    if (!projectPath) return;
    setIsLoading(true);
    try {
      await removeWorktree(projectPath, wtPath, true);
      setWorktrees((prev) => prev.filter((p) => p !== wtPath));
    } catch (err) {
      console.error("Failed to remove worktree:", err);
    }
    setIsLoading(false);
  };

  const handleCleanup = async () => {
    if (!projectPath) return;
    setIsLoading(true);
    try {
      const removed = await cleanupWorktrees(projectPath);
      setWorktrees((prev) => prev.filter((p) => !removed.includes(p)));
    } catch (err) {
      console.error("Failed to cleanup worktrees:", err);
    }
    setIsLoading(false);
  };

  // Filter out the main worktree (the project itself)
  const managedWorktrees = worktrees.filter((wt) =>
    wt.includes(".openclaudgents/worktrees"),
  );

  if (!projectPath) {
    return (
      <div className="p-4 text-xs text-text-muted">
        Select a session to manage worktrees.
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text">Worktrees</h3>
        <button
          onClick={handleCleanup}
          disabled={isLoading || managedWorktrees.length === 0}
          className="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-tertiary disabled:opacity-50"
        >
          Cleanup old
        </button>
      </div>

      {managedWorktrees.length === 0 ? (
        <p className="text-xs text-text-muted">
          No active worktrees for this project.
        </p>
      ) : (
        <ul className="space-y-2">
          {managedWorktrees.map((wt) => {
            const name = wt.split("/").slice(-2).join("/");
            return (
              <li
                key={wt}
                className="flex items-center justify-between rounded border border-border bg-bg-tertiary px-3 py-2"
              >
                <div>
                  <div className="text-xs font-medium text-text">{name}</div>
                  <div className="text-xs text-text-muted">{wt}</div>
                </div>
                <button
                  onClick={() => handleRemove(wt)}
                  disabled={isLoading}
                  className="rounded px-2 py-1 text-xs text-error transition-colors hover:bg-bg-secondary disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
