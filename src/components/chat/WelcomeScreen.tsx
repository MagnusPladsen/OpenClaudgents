import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { pickFolder, listDirectoryCompletions, checkIsGitRepo } from "../../lib/tauri";

interface WelcomeScreenProps {
  onCreateSession?: (projectPath: string) => void;
  error?: string | null;
}

interface FolderEntry {
  path: string;
  name: string;
  isGit: boolean;
  lastUsed: string | null;
}

export function WelcomeScreen({ onCreateSession, error }: WelcomeScreenProps) {
  const [projectPath, setProjectPath] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [completions, setCompletions] = useState<string[]>([]);
  const [gitCache, setGitCache] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sessions = useSessionStore((s) => s.sessions);

  // Derive recent project paths from sessions, scored by recency
  const recentProjects = useMemo<FolderEntry[]>(() => {
    const seen = new Map<string, string>(); // path -> most recent updatedAt
    for (const s of sessions) {
      if (!seen.has(s.projectPath) || s.updatedAt > seen.get(s.projectPath)!) {
        seen.set(s.projectPath, s.updatedAt);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, 8)
      .map(([path, lastUsed]) => ({
        path,
        name: path.split("/").pop() || path,
        isGit: gitCache[path] ?? false,
        lastUsed,
      }));
  }, [sessions, gitCache]);

  // Check git status for all recent projects on mount
  useEffect(() => {
    const paths = recentProjects.map((p) => p.path);
    for (const path of paths) {
      if (gitCache[path] !== undefined) continue;
      checkIsGitRepo(path)
        .then((isGit) => {
          setGitCache((prev) => ({ ...prev, [path]: isGit }));
        })
        .catch(() => {
          setGitCache((prev) => ({ ...prev, [path]: false }));
        });
    }
  }, [recentProjects, gitCache]);

  // Filter recent projects based on input
  const filteredProjects = useMemo<FolderEntry[]>(() => {
    if (!projectPath.trim()) return recentProjects;
    const lower = projectPath.toLowerCase();
    return recentProjects.filter((p) => p.path.toLowerCase().includes(lower));
  }, [projectPath, recentProjects]);

  // Combine: show recent projects when no input, or tab completions when typing paths
  const dropdownItems = useMemo<FolderEntry[]>(() => {
    if (completions.length > 0) {
      return completions.map((path) => ({
        path,
        name: path.split("/").pop() || path,
        isGit: gitCache[path] ?? false,
        lastUsed: null,
      }));
    }
    return filteredProjects;
  }, [completions, filteredProjects, gitCache]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-welcome-combobox]")) {
        setShowDropdown(false);
        setCompletions([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  // Scroll active item into view
  useEffect(() => {
    if (highlightIndex < 0 || !dropdownRef.current) return;
    const items = dropdownRef.current.querySelectorAll("[data-dropdown-item]");
    items[highlightIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const handleSubmit = useCallback(async () => {
    if (!projectPath.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setShowDropdown(false);
    setCompletions([]);
    try {
      await onCreateSession?.(projectPath);
    } finally {
      setIsSubmitting(false);
    }
  }, [projectPath, isSubmitting, onCreateSession]);

  const handleSelectProject = useCallback((path: string) => {
    setProjectPath(path);
    setShowDropdown(false);
    setCompletions([]);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  }, []);

  const handleTabComplete = useCallback(async () => {
    if (!projectPath.trim()) return;
    try {
      const results = await listDirectoryCompletions(projectPath);
      if (results.length === 1) {
        // Single match — auto-complete it
        setProjectPath(results[0] + "/");
        setCompletions([]);
        setShowDropdown(false);
      } else if (results.length > 1) {
        // Multiple matches — show dropdown
        setCompletions(results);
        setShowDropdown(true);
        setHighlightIndex(0);
        // Check git status for completions
        for (const path of results) {
          if (gitCache[path] !== undefined) continue;
          checkIsGitRepo(path)
            .then((isGit) => setGitCache((prev) => ({ ...prev, [path]: isGit })))
            .catch(() => {});
        }
      }
    } catch {
      // Silently ignore errors (e.g., invalid path)
    }
  }, [projectPath, gitCache]);

  const handleBrowseFolder = useCallback(async () => {
    try {
      const folder = await pickFolder();
      if (folder) {
        setProjectPath(folder);
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Failed to open folder picker:", err);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        handleTabComplete();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!showDropdown && dropdownItems.length > 0) {
          setShowDropdown(true);
          setHighlightIndex(0);
        } else if (showDropdown) {
          setHighlightIndex((prev) =>
            prev < dropdownItems.length - 1 ? prev + 1 : 0,
          );
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (showDropdown) {
          setHighlightIndex((prev) =>
            prev > 0 ? prev - 1 : dropdownItems.length - 1,
          );
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (showDropdown && highlightIndex >= 0 && dropdownItems[highlightIndex]) {
          handleSelectProject(dropdownItems[highlightIndex].path);
        } else if (projectPath.trim()) {
          handleSubmit();
        }
        return;
      }

      if (e.key === "Escape") {
        setShowDropdown(false);
        setCompletions([]);
        setHighlightIndex(-1);
      }
    },
    [showDropdown, highlightIndex, dropdownItems, projectPath, handleTabComplete, handleSelectProject, handleSubmit],
  );

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
                  setCompletions([]);
                  setHighlightIndex(-1);
                  if (recentProjects.length > 0) setShowDropdown(true);
                }}
                onFocus={() => {
                  setIsFocused(true);
                  if (recentProjects.length > 0) setShowDropdown(true);
                }}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="~/git/my-project"
                className="w-full rounded-[15px] bg-transparent py-4 pl-11 pr-4 text-base text-text placeholder:text-text-muted focus:outline-none"
                role="combobox"
                aria-expanded={showDropdown}
                aria-activedescendant={highlightIndex >= 0 ? `folder-item-${highlightIndex}` : undefined}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Tab hint */}
          {isFocused && projectPath.trim() && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-muted">
              <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-secondary">Tab</kbd>
              autocomplete
              <span className="mx-1 text-border">|</span>
              <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-secondary">↑↓</kbd>
              navigate
              <span className="mx-1 text-border">|</span>
              <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-secondary">Enter</kbd>
              select
            </div>
          )}

          {/* Dropdown for recent projects / completions */}
          {showDropdown && dropdownItems.length > 0 && (
            <div
              ref={dropdownRef}
              className="animate-scale-in absolute z-20 mt-1 w-[calc(100%-4rem)] max-h-64 overflow-y-auto rounded-2xl border border-border/30 bg-bg-secondary shadow-xl shadow-black/20"
              role="listbox"
            >
              <div className="px-3 py-2">
                <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
                  {completions.length > 0 ? "Matching folders" : "Recent projects"}
                </span>
              </div>
              {dropdownItems.map((item, i) => (
                <button
                  key={item.path}
                  id={`folder-item-${i}`}
                  data-dropdown-item
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectProject(item.path);
                  }}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                    i === highlightIndex
                      ? "bg-accent/10 text-text"
                      : "hover:bg-bg-tertiary/50"
                  }`}
                  role="option"
                  aria-selected={i === highlightIndex}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="flex-shrink-0 text-text-muted">
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">
                      {item.name}
                    </div>
                    <div className="truncate text-xs text-text-muted">
                      {item.path}
                    </div>
                  </div>
                  {/* Git badge */}
                  {item.isGit && (
                    <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="18" r="3" />
                        <circle cx="6" cy="6" r="3" />
                        <path d="M6 21V9a9 9 0 0 0 9 9" />
                      </svg>
                      git
                    </span>
                  )}
                  {/* Recency indicator */}
                  {item.lastUsed && (
                    <span className="flex-shrink-0 text-[10px] text-text-muted">
                      {formatTimeAgo(item.lastUsed)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Browse folder button + suggestion cards */}
        <div className="animate-stagger-in mb-6 flex items-stretch gap-3" style={{ animationDelay: "200ms" }}>
          {/* Big browse button */}
          <button
            onClick={handleBrowseFolder}
            className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:bg-accent/10 hover:shadow-lg hover:shadow-accent/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              <line x1="12" x2="12" y1="10" y2="16" />
              <line x1="9" x2="15" y1="13" y2="13" />
            </svg>
            <span className="text-sm font-semibold text-accent">Browse Folder</span>
            <span className="text-[11px] text-text-muted">Open file picker</span>
          </button>

          {/* Home shortcut */}
          <button
            onClick={() => setProjectPath("~")}
            className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border/30 bg-bg-secondary/50 p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-accent/5 hover:shadow-lg hover:shadow-accent/5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="text-sm font-medium text-text">Home</span>
          </button>

          {/* Current Dir shortcut */}
          <button
            onClick={() => setProjectPath(".")}
            className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border/30 bg-bg-secondary/50 p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-accent/5 hover:shadow-lg hover:shadow-accent/5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            </svg>
            <span className="text-sm font-medium text-text">Current Dir</span>
          </button>
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
            className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-4 text-base font-semibold text-bg shadow-lg shadow-accent/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/30 disabled:opacity-30 disabled:shadow-none disabled:hover:scale-100"
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

function formatTimeAgo(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return "";
  }
}
