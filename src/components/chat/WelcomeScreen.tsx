import { useState } from "react";

interface WelcomeScreenProps {
  onCreateSession?: (projectPath: string) => void;
}

const SUGGESTIONS = [
  { label: "Home", path: "~" },
  { label: "Current Dir", path: "." },
  { label: "Desktop", path: "~/Desktop" },
];

export function WelcomeScreen({ onCreateSession }: WelcomeScreenProps) {
  const [projectPath, setProjectPath] = useState("");

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg">
      {/* Subtle radial gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-accent)_0%,transparent_70%)] opacity-[0.04]" />

      <div className="animate-fade-in relative w-full max-w-lg px-8 text-center">
        {/* Logo / title */}
        <div className="mb-10">
          <h1 className="mb-3 bg-gradient-to-r from-accent to-info bg-clip-text text-3xl font-bold text-transparent">
            OpenClaudgents
          </h1>
          <p className="text-sm text-text-secondary">
            Multi-agent Claude Code orchestrator
          </p>
        </div>

        {/* Quick start input */}
        <div className="mb-4 text-left">
          <label className="mb-2 block text-xs font-medium text-text-secondary">
            Project folder
          </label>
          <div className="relative">
            {/* Folder icon */}
            <svg
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            </svg>
            <input
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && projectPath.trim()) {
                  onCreateSession?.(projectPath);
                }
              }}
              placeholder="~/git/my-project"
              className="w-full rounded-xl border border-border bg-bg-secondary py-3 pl-10 pr-4 text-sm text-text placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:shadow-lg focus:shadow-accent/5"
            />
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="mb-5 flex items-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.path}
              onClick={() => setProjectPath(s.path)}
              className="rounded-lg border border-border/50 bg-bg-secondary/50 px-3 py-1.5 text-xs text-text-muted hover:border-accent/30 hover:text-text"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={() => onCreateSession?.(projectPath)}
          disabled={!projectPath.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-3 text-sm font-semibold text-bg shadow-lg shadow-accent/20 hover:scale-[1.01] hover:shadow-xl hover:shadow-accent/25 disabled:opacity-30 disabled:shadow-none disabled:hover:scale-100"
        >
          Start New Session
        </button>

        {/* Keyboard hint */}
        <div className="mt-8 flex items-center justify-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px]">
              Cmd+K
            </kbd>
            Commands
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px]">
              Cmd+J
            </kbd>
            Terminal
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px]">
              Cmd+,
            </kbd>
            Settings
          </span>
        </div>
      </div>
    </div>
  );
}
