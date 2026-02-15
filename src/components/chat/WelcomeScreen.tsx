import { useState } from "react";

interface WelcomeScreenProps {
  onCreateSession?: (projectPath: string) => void;
  error?: string | null;
}

const SUGGESTIONS = [
  {
    label: "Home",
    path: "~",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Current Dir",
    path: ".",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
  },
  {
    label: "Desktop",
    path: "~/Desktop",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <line x1="8" x2="16" y1="21" y2="21" />
        <line x1="12" x2="12" y1="17" y2="21" />
      </svg>
    ),
  },
];

export function WelcomeScreen({ onCreateSession, error }: WelcomeScreenProps) {
  const [projectPath, setProjectPath] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!projectPath.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreateSession?.(projectPath);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg">
      {/* Animated mesh gradient background */}
      <div
        className="animate-gradient-shift pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          background: "radial-gradient(ellipse at 20% 50%, var(--color-accent), transparent 60%), radial-gradient(ellipse at 80% 20%, var(--color-info), transparent 60%), radial-gradient(ellipse at 50% 80%, var(--color-success), transparent 60%)",
          backgroundSize: "200% 200%",
        }}
      />

      <div className="relative w-full max-w-lg px-8 text-center">
        {/* Logo / title — staggered entrance */}
        <div className="animate-stagger-in mb-10" style={{ animationDelay: "0ms" }}>
          <h1 className="mb-3 bg-gradient-to-r from-accent via-info to-accent bg-clip-text text-4xl font-light tracking-tight text-transparent">
            OpenClaudgents
          </h1>
          <p className="text-sm tracking-wide text-text-muted">
            Multi-agent Claude Code orchestrator
          </p>
        </div>

        {/* Quick start input — animated gradient border on focus */}
        <div className="animate-stagger-in mb-5 text-left" style={{ animationDelay: "100ms" }}>
          <label className="mb-2 block text-xs font-medium text-text-secondary">
            Project folder
          </label>
          {/* Animated gradient border wrapper */}
          <div className={`relative rounded-2xl p-px ${isFocused ? "bg-gradient-to-r from-accent via-info to-accent animate-gradient-shift" : "bg-border/50"}`}>
            <div className="relative flex items-center rounded-[15px] bg-bg-secondary">
              {/* Folder icon */}
              <svg
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
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
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && projectPath.trim()) {
                    handleSubmit();
                  }
                }}
                placeholder="~/git/my-project"
                className="w-full rounded-[15px] bg-transparent py-3.5 pl-11 pr-4 text-base text-text placeholder:text-text-muted focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Quick suggestions — card style with icons */}
        <div className="animate-stagger-in mb-6 flex items-center gap-2" style={{ animationDelay: "200ms" }}>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s.path}
              onClick={() => setProjectPath(s.path)}
              className="animate-stagger-in flex items-center gap-1.5 rounded-xl border border-border/40 bg-bg-secondary/50 px-3 py-2 text-xs text-text-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:text-text hover:shadow-md hover:shadow-accent/5"
              style={{ animationDelay: `${200 + i * 80}ms` }}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="animate-stagger-in mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-left text-sm text-error" style={{ animationDelay: "0ms" }}>
            <div className="flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* CTA button */}
        <div className="animate-stagger-in" style={{ animationDelay: "400ms" }}>
          <button
            onClick={handleSubmit}
            disabled={!projectPath.trim() || isSubmitting}
            className="w-full rounded-2xl bg-gradient-to-r from-accent to-accent-hover px-4 py-3.5 text-base font-semibold text-bg shadow-lg shadow-accent/20 transition-all duration-200 hover:scale-[1.01] hover:shadow-xl hover:shadow-accent/30 disabled:opacity-30 disabled:shadow-none disabled:hover:scale-100"
          >
            {isSubmitting ? "Creating..." : "Start New Session"}
          </button>
        </div>

        {/* Keyboard hints — floating mini-cards */}
        <div className="animate-stagger-in mt-10 flex items-center justify-center gap-3" style={{ animationDelay: "500ms" }}>
          {[
            { keys: "⌘K", action: "Commands" },
            { keys: "⌘J", action: "Terminal" },
            { keys: "⌘,", action: "Settings" },
          ].map((hint) => (
            <div
              key={hint.keys}
              className="flex items-center gap-2 rounded-lg border border-border/30 bg-bg-secondary/50 px-3 py-1.5 text-xs text-text-muted"
            >
              <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-secondary">
                {hint.keys}
              </kbd>
              <span>{hint.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
