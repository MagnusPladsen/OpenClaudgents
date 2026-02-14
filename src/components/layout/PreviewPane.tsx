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

interface PreviewPaneProps {
  onClose: () => void;
}

type Tab = "diff" | "context" | "instructions" | "tasks" | "agents" | "mcp" | "worktrees";

export function PreviewPane({ onClose }: PreviewPaneProps) {
  const [activeTab, setActiveTab] = useState<Tab>("diff");
  const [diffData, setDiffData] = useState<DiffSummary | null>(null);
  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });

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
    <aside className="flex w-[400px] flex-col border-l border-border bg-bg-secondary" aria-label="Preview pane">
      {/* Header with tabs — scrollable for many tabs */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Preview tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded px-2 py-1 text-xs transition-colors ${
                activeTab === tab.id
                  ? "bg-bg-tertiary text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          aria-label="Close preview pane"
          className="ml-2 flex-shrink-0 rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-tertiary hover:text-text"
        >
          Close
        </button>
      </div>

      {/* Git status bar (shown on diff tab) */}
      {activeTab === "diff" && gitStatus && (
        <div className="border-b border-border px-4 py-2">
          <GitStatusBar status={gitStatus} projectPath={projectPath} showActions />
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
