import { useState, useEffect, lazy, Suspense } from "react";
import { getFileDiffContent } from "../../lib/tauri";
import type { DiffSummary, FileDiffContent } from "../../lib/types";

// Lazy-load Monaco to avoid bloating the initial bundle
const DiffEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.DiffEditor })),
);

interface MonacoDiffViewerProps {
  diff: DiffSummary | null;
  repoPath: string | null | undefined;
}

export function MonacoDiffViewer({ diff, repoPath }: MonacoDiffViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileDiffContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"side" | "inline">("side");

  // Auto-select first file when diff changes
  useEffect(() => {
    if (diff?.files.length && !selectedFile) {
      setSelectedFile(diff.files[0].path);
    }
  }, [diff, selectedFile]);

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedFile || !repoPath) {
      setFileContent(null);
      return;
    }

    setIsLoading(true);
    getFileDiffContent(repoPath, selectedFile)
      .then(setFileContent)
      .catch(() => setFileContent(null))
      .finally(() => setIsLoading(false));
  }, [selectedFile, repoPath]);

  if (!diff || diff.files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-xs text-text-muted">
        <div className="text-center">
          <p>No changes detected</p>
          <p className="mt-1">Diffs will appear here when files are modified</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* File list + summary */}
      <div className="border-b border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {diff.files.length} file{diff.files.length !== 1 ? "s" : ""}{" "}
            <span className="text-success">+{diff.totalAdditions}</span>{" "}
            <span className="text-error">-{diff.totalDeletions}</span>
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode("side")}
              className={`rounded px-2 py-0.5 text-xs ${
                viewMode === "side" ? "bg-bg-tertiary text-text" : "text-text-muted"
              }`}
            >
              Side
            </button>
            <button
              onClick={() => setViewMode("inline")}
              className={`rounded px-2 py-0.5 text-xs ${
                viewMode === "inline" ? "bg-bg-tertiary text-text" : "text-text-muted"
              }`}
            >
              Inline
            </button>
          </div>
        </div>

        {/* File selector */}
        <div className="space-y-0.5">
          {diff.files.map((file) => (
            <button
              key={file.path}
              onClick={() => setSelectedFile(file.path)}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${
                selectedFile === file.path
                  ? "bg-accent/10 text-accent"
                  : "text-text-muted hover:bg-bg-tertiary hover:text-text"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <StatusBadge status={file.status} />
                <span className="font-mono">{file.path.split("/").pop()}</span>
              </div>
              <span>
                {file.additions > 0 && (
                  <span className="text-success">+{file.additions} </span>
                )}
                {file.deletions > 0 && (
                  <span className="text-error">-{file.deletions}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Monaco diff editor */}
      <div className="min-h-[300px] flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            Loading diff...
          </div>
        ) : fileContent ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-xs text-text-muted">
                Loading editor...
              </div>
            }
          >
            <DiffEditor
              original={fileContent.original}
              modified={fileContent.modified}
              language={fileContent.language}
              theme="vs-dark"
              options={{
                readOnly: true,
                renderSideBySide: viewMode === "side",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                lineNumbers: "on",
                wordWrap: "on",
              }}
            />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            Select a file to view diff
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    added: "bg-success text-white",
    modified: "bg-warning text-white",
    deleted: "bg-error text-white",
    renamed: "bg-info text-white",
  };
  const labels: Record<string, string> = {
    added: "A",
    modified: "M",
    deleted: "D",
    renamed: "R",
  };

  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${
        colors[status] || "bg-text-muted text-white"
      }`}
    >
      {labels[status] || "?"}
    </span>
  );
}
