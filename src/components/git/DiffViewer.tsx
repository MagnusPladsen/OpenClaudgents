import { useState } from "react";
import type { DiffSummary } from "../../lib/types";

interface DiffViewerProps {
  diff: DiffSummary | null;
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  if (!diff) {
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
    <div className="p-3">
      {/* Summary */}
      <div className="mb-3 flex items-center gap-3 text-xs">
        <span className="text-text-muted">
          {diff.files.length} file{diff.files.length !== 1 ? "s" : ""}
        </span>
        <span className="text-success">+{diff.totalAdditions}</span>
        <span className="text-error">-{diff.totalDeletions}</span>
      </div>

      {/* File list */}
      <div className="space-y-1">
        {diff.files.map((file) => (
          <div key={file.path} className="rounded border border-border">
            <button
              onClick={() =>
                setExpandedFile(expandedFile === file.path ? null : file.path)
              }
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-bg-tertiary"
            >
              <div className="flex items-center gap-2">
                <StatusBadge status={file.status} />
                <span className="font-mono text-text">
                  {file.path.split("/").pop()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                {file.additions > 0 && (
                  <span className="text-success">+{file.additions}</span>
                )}
                {file.deletions > 0 && (
                  <span className="text-error">-{file.deletions}</span>
                )}
              </div>
            </button>

            {/* Full path shown below filename */}
            {expandedFile === file.path && (
              <div className="border-t border-border px-3 py-1 text-xs text-text-muted">
                {file.path}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Raw diff (collapsed by default) */}
      {diff.rawDiff && (
        <RawDiffBlock rawDiff={diff.rawDiff} />
      )}
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

function RawDiffBlock({ rawDiff }: { rawDiff: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-2 text-xs text-text-muted hover:text-text"
      >
        {isExpanded ? "Hide" : "Show"} raw diff
      </button>

      {isExpanded && (
        <pre className="max-h-96 overflow-auto rounded border border-border bg-bg-tertiary p-3 text-xs leading-relaxed">
          {rawDiff.split("\n").map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith("+")
                  ? "text-success"
                  : line.startsWith("-")
                    ? "text-error"
                    : line.startsWith("@@")
                      ? "text-accent"
                      : line.startsWith("diff ")
                        ? "font-bold text-text"
                        : "text-text-muted"
              }
            >
              {line}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}
