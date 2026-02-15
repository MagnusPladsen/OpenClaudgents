import { useState, useEffect } from "react";
import { getGitDiff } from "../../lib/tauri";
import { useSessionStore } from "../../stores/sessionStore";
import { useGitStatus } from "../../hooks/useGitStatus";
import { GitStatusBar } from "../git/GitStatusBar";
import { MonacoDiffViewer } from "../git/MonacoDiffViewer";
import { WorktreeManager } from "../git/WorktreeManager";
import { ContextBudgetBar } from "../context/ContextBudgetBar";
import { InstructionsPanel } from "../context/InstructionsPanel";
import { TaskListPanel } from "../agents/TaskListPanel";
import { TeamPanel } from "../agents/TeamPanel";
import { McpStatusPanel } from "../agents/McpStatusPanel";
import type { DiffSummary } from "../../lib/types";

export type Tab = "diff" | "context" | "instructions" | "tasks" | "agents" | "mcp" | "worktrees";

interface PreviewPaneProps {
  onClose: () => void;
  initialTab?: Tab;
}

export function PreviewPane({ onClose, initialTab }: PreviewPaneProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "diff");
  const [diffData, setDiffData] = useState<DiffSummary | null>(null);
  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });

  // Switch tab when initialTab prop changes externally (e.g., from /context command)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const projectPath = activeSession?.worktreePath || activeSession?.projectPath;
  const gitStatus = useGitStatus(projectPath);

  // Fetch diff when tab is active and git status is dirty
  useEffect(() => {
    if (activeTab !== "diff" || !projectPath || !gitStatus?.isDirty) {
      if (!gitStatus?.isDirty) setDiffData(null);
      return;
    }

    getGitDiff(projectPath)
      .then(setDiffData)
      .catch(() => setDiffData(null));
  }, [activeTab, projectPath, gitStatus?.isDirty, gitStatus?.dirtyFileCount]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "diff", label: "Diff" },
    { id: "context", label: "Context" },
    { id: "instructions", label: "CLAUDE.md" },
    { id: "tasks", label: "Tasks" },
    { id: "agents", label: "Agents" },
    { id: "mcp", label: "MCP" },
    { id: "worktrees", label: "Worktrees" },
  ];

  return (
    <aside className="flex w-[400px] flex-col bg-bg-secondary shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.2)]" aria-label="Preview pane">
      {/* Header with pill tabs */}
      <div className="relative flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Preview tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-accent/15 text-accent shadow-sm shadow-accent/10"
                  : "text-text-muted hover:bg-bg-tertiary/50 hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          aria-label="Close preview pane"
          className="ml-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-text-muted transition-all hover:bg-bg-tertiary hover:text-text"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {/* Gradient separator */}
        <div className="pointer-events-none absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Git status bar (shown on diff tab) */}
      {activeTab === "diff" && gitStatus && (
        <div className="relative px-4 py-2">
          <GitStatusBar status={gitStatus} projectPath={projectPath} showActions />
          <div className="pointer-events-none absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "diff" && (
          <MonacoDiffViewer diff={diffData} repoPath={projectPath} />
        )}
        {activeTab === "context" && (
          <div className="p-4">
            <ContextBudgetBar />
          </div>
        )}
        {activeTab === "instructions" && <InstructionsPanel />}
        {activeTab === "tasks" && <TaskListPanel />}
        {activeTab === "agents" && <TeamPanel />}
        {activeTab === "mcp" && <McpStatusPanel />}
        {activeTab === "worktrees" && <WorktreeManager />}
      </div>
    </aside>
  );
}
