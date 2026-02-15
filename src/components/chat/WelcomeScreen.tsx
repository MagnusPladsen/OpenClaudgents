import { useState, useMemo, useRef, useEffect } from "react";
import { useSessionStore } from "../../stores/sessionStore";

interface WelcomeScreenProps {
  onCreateSession?: (projectPath: string) => void;
  error?: string | null;
}

const SUGGESTIONS = [
  {
    label: "Home",
    description: "Your home directory",
    path: "~",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Current Dir",
    description: "Where you launched from",
    path: ".",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
    ),
  },
  {
    label: "Desktop",
    description: "Quick access to desktop",
    path: "~/Desktop",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sessions = useSessionStore((s) => s.sessions);

  // Derive recent project paths from sessions
  const recentProjects = useMemo(() => {
    const seen = new Map<string, string>(); // path -> most recent updatedAt
    for (const s of sessions) {
      if (!seen.has(s.projectPath) || s.updatedAt > seen.get(s.projectPath)!) {
        seen.set(s.projectPath, s.updatedAt);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([path]) => path)
      .slice(0, 8);
  }, [sessions]);

  // Filter recent projects based on input
  const filteredProjects = useMemo(() => {
    if (!projectPath.trim()) return recentProjects;
    const lower = projectPath.toLowerCase();
    return recentProjects.filter((p) => p.toLowerCase().includes(lower));
  }, [projectPath, recentProjects]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-welcome-combobox]")) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const handleSubmit = async () => {
    if (!projectPath.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setShowDropdown(false);
    try {
      await onCreateSession?.(projectPath);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectProject = (path: string) => {
    setProjectPath(path);
    setShowDropdown(false);
    inputRef.current?.focus();
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
        {/* Logo / title */}
        <div className="animate-stagger-in mb-12" style={{ animationDelay: "0ms" }}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-info/20 shadow-lg shadow-accent/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <h1 className="mb-2 text-3xl font-light tracking-tight text-text">
            Let&apos;s build
          </h1>
          <p className="text-sm text-text-muted">
            Multi-agent Claude Code orchestrator
          </p>
        </div>

        {/* Project path combobox */}
        <div className="animate-stagger-in mb-6 text-left" style={{ animationDelay: "100ms" }} data-welcome-combobox>
          <label className="mb-2 block text-xs font-medium text-text-secondary">
            Project folder
          </label>
          <div className={`relative rounded-2xl p-px ${isFocused ? "bg-gradient-to-r from-accent via-info to-accent animate-gradient-shift" : "bg-border/50"}`}>
            <div className="relative flex items-center rounded-[15px] bg-bg-secondary">
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
                ref={inputRef}
                type="text"
                value={projectPath}
                onChange={(e) => {
                  setProjectPath(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => {
                  setIsFocused(true);
                  if (recentProjects.length > 0) setShowDropdown(true);
                }}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && projectPath.trim()) {
                    handleSubmit();
                  }
                  if (e.key === "Escape") {
                    setShowDropdown(false);
                  }
                }}
                placeholder="~/git/my-project"
                className="w-full rounded-[15px] bg-transparent py-3.5 pl-11 pr-4 text-base text-text placeholder:text-text-muted focus:outline-none"
              />
            </div>
          </div>

          {/* Dropdown for recent projects */}
          {showDropdown && filteredProjects.length > 0 && (
            <div className="animate-scale-in absolute z-20 mt-1 w-[calc(100%-4rem)] max-h-56 overflow-y-auto rounded-2xl border border-border/30 bg-bg-secondary shadow-xl shadow-black/20">
              <div className="px-3 py-2">
                <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
                  Recent projects
                </span>
              </div>
              {filteredProjects.map((path) => (
                <button
                  key={path}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectProject(path);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-bg-tertiary/50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="flex-shrink-0 text-text-muted">
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">
                      {path.split("/").pop()}
                    </div>
                    <div className="truncate text-xs text-text-muted">
                      {path}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Suggestion cards */}
        <div className="animate-stagger-in mb-6 flex items-stretch gap-3" style={{ animationDelay: "200ms" }}>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s.path}
              onClick={() => setProjectPath(s.path)}
              className="animate-stagger-in flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border/30 bg-bg-secondary/50 p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-accent/5 hover:shadow-lg hover:shadow-accent/5"
              style={{ animationDelay: `${200 + i * 80}ms` }}
            >
              <span className="text-text-muted">{s.icon}</span>
              <span className="text-sm font-medium text-text">{s.label}</span>
              <span className="text-[11px] text-text-muted">{s.description}</span>
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
        <div className="animate-stagger-in" style={{ animationDelay: "300ms" }}>
          <button
            onClick={handleSubmit}
            disabled={!projectPath.trim() || isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-3.5 text-base font-semibold text-bg shadow-lg shadow-accent/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/30 disabled:opacity-30 disabled:shadow-none disabled:hover:scale-100"
          >
            {isSubmitting ? "Creating..." : "Start New Session"}
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="animate-blur-in mt-10 flex items-center justify-center gap-3" style={{ animationDelay: "400ms" }}>
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
