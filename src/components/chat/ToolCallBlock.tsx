import { useState } from "react";
import type { ToolCall } from "../../lib/types";

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    toolCall.status === "completed"
      ? "text-success"
      : toolCall.status === "error"
        ? "text-error"
        : "text-warning";

  const statusIcon =
    toolCall.status === "completed"
      ? "done"
      : toolCall.status === "error"
        ? "error"
        : "running...";

  return (
    <div className="rounded border border-border bg-tool-call-bg">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={`${toolCall.name} tool call — ${statusIcon}`}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-bg-tertiary"
      >
        <div className="flex items-center gap-2">
          <span className="text-text-muted">{expanded ? "v" : ">"}</span>
          <span className="font-medium text-text-secondary">
            {toolCall.name}
          </span>
          <span className={statusColor}>[{statusIcon}]</span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 py-2">
          {/* Input */}
          <div className="mb-2">
            <div className="mb-1 text-xs font-medium text-text-muted">
              Input:
            </div>
            <pre className="overflow-x-auto rounded bg-code-bg p-2 text-xs text-text-secondary">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {toolCall.result && (
            <div>
              <div className="mb-1 text-xs font-medium text-text-muted">
                Result:
              </div>
              <pre className="max-h-48 overflow-auto rounded bg-code-bg p-2 text-xs text-text-secondary">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
