interface WorktreePromptProps {
  projectPath: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function WorktreePrompt({
  projectPath,
  onConfirm,
  onDismiss,
}: WorktreePromptProps) {
  const projectName = projectPath.split("/").pop() || projectPath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-bg-secondary p-6 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-text">
          Create Isolated Worktree?
        </h3>
        <p className="mb-4 text-xs text-text-muted">
          The project <strong className="text-text">{projectName}</strong>{" "}
          already has an active session. Creating a worktree gives this new
          session its own isolated copy of the codebase so agents don't
          interfere with each other.
        </p>

        <div className="mb-4 rounded border border-border bg-bg-tertiary p-3 text-xs text-text-muted">
          <div className="mb-1 font-medium text-text">What happens:</div>
          <ul className="list-inside list-disc space-y-1">
            <li>A fresh checkout is created at ~/.openclaudgents/worktrees/</li>
            <li>Current uncommitted changes are copied over</li>
            <li>The agent works in isolation (detached HEAD)</li>
            <li>Auto-cleaned after 4 days of inactivity</li>
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onDismiss}
            className="rounded px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-bg-tertiary"
          >
            No, share folder
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-accent px-3 py-1.5 text-xs text-white transition-colors hover:bg-accent-hover"
          >
            Yes, isolate
          </button>
        </div>
      </div>
    </div>
  );
}
