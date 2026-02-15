import { useState } from "react";
import type { ToolCall } from "../../lib/types";

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-tool-call-bg transition-all duration-200">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={`${toolCall.name} tool call — ${toolCall.status}`}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs transition-colors hover:bg-bg-tertiary/30"
      >
        <div className="flex items-center gap-2">
          {/* Chevron — rotates when expanded */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-text-muted transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-mono font-medium text-accent">
            {toolCall.name}
          </span>
          {/* Status icon */}
          <StatusIcon status={toolCall.status} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="animate-fade-in border-t border-border/30 px-3 py-3">
          {/* Input */}
          <div className="mb-2">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Input
            </div>
            <pre className="overflow-x-auto rounded-lg bg-code-bg p-2.5 font-mono text-xs text-text-secondary">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {toolCall.result && (
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Result
              </div>
              <pre className="max-h-48 overflow-auto rounded-lg bg-code-bg p-2.5 font-mono text-xs text-text-secondary">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-error">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  // Running/pending
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin-slow text-warning">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
