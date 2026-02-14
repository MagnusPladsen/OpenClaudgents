import { useState } from "react";

interface WelcomeScreenProps {
  onCreateSession?: (projectPath: string) => void;
}

export function WelcomeScreen({ onCreateSession }: WelcomeScreenProps) {
  const [projectPath, setProjectPath] = useState("");

  return (
    <div className="flex flex-1 items-center justify-center bg-bg">
      <div className="w-full max-w-lg px-8 text-center">
        {/* Logo / title */}
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold text-text">OpenClaudgents</h1>
          <p className="text-sm text-text-secondary">
            Multi-agent Claude Code orchestrator
          </p>
        </div>

        {/* Quick start */}
        <div className="mb-6 text-left">
          <label className="mb-2 block text-xs font-medium text-text-secondary">
            Project folder
          </label>
          <input
            type="text"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="~/git/my-project"
            className="w-full rounded-lg border border-border bg-bg-secondary px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none"
          />
        </div>

        <button
          onClick={() => onCreateSession?.(projectPath)}
          disabled={!projectPath.trim()}
          className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-bg transition-colors hover:bg-accent-hover disabled:opacity-30"
        >
          Start New Session
        </button>

        {/* Keyboard hint */}
        <p className="mt-6 text-xs text-text-muted">
          Cmd+K command palette | Cmd+J terminal | Cmd+, settings
        </p>
      </div>
    </div>
  );
}
