import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useChatStore } from "../../stores/chatStore";
import type { ChatMessage } from "../../lib/types";

type RewindAction = "restore_all" | "restore_conversation" | "restore_code" | "summarize";

interface RewindDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRewind: (messageIndex: number, action: RewindAction) => void;
}

export function RewindDialog({ isOpen, onClose, onRewind }: RewindDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [phase, setPhase] = useState<"pick" | "action">("pick");
  const [actionIndex, setActionIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const messages = useChatStore((s) => s.messages);

  // Show only user messages as checkpoints (like vanilla Claude Code)
  const checkpoints = useMemo(() => {
    const result: Array<{ message: ChatMessage; originalIndex: number }> = [];
    messages.forEach((msg, idx) => {
      if (msg.role === "user") {
        result.push({ message: msg, originalIndex: idx });
      }
    });
    return result;
  }, [messages]);

  const ACTIONS: Array<{ id: RewindAction; label: string; description: string; icon: string }> = [
    {
      id: "restore_all",
      label: "Restore code and conversation",
      description: "Revert both file changes and conversation to this point",
      icon: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
    },
    {
      id: "restore_conversation",
      label: "Restore conversation only",
      description: "Rewind conversation but keep current code",
      icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    },
    {
      id: "restore_code",
      label: "Restore code only",
      description: "Revert file changes but keep the conversation",
      icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    },
    {
      id: "summarize",
      label: "Summarize from here",
      description: "Compress messages from this point into a summary",
      icon: "M4 6h16M4 12h10M4 18h14",
    },
  ];

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(checkpoints.length - 1);
      setPhase("pick");
      setActionIndex(0);
    }
  }, [isOpen, checkpoints.length]);

  const handleSelectCheckpoint = useCallback(() => {
    if (checkpoints.length === 0) return;
    setPhase("action");
    setActionIndex(0);
  }, [checkpoints.length]);

  const handleSelectAction = useCallback((action: RewindAction) => {
    const checkpoint = checkpoints[selectedIndex];
    if (!checkpoint) return;
    onRewind(checkpoint.originalIndex, action);
    onClose();
  }, [checkpoints, selectedIndex, onRewind, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (phase === "pick") {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedIndex((i) => Math.min(i + 1, checkpoints.length - 1));
            break;
          case "ArrowUp":
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
            break;
          case "Enter":
            e.preventDefault();
            handleSelectCheckpoint();
            break;
          case "Escape":
            e.preventDefault();
            onClose();
            break;
        }
      } else {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setActionIndex((i) => Math.min(i + 1, ACTIONS.length - 1));
            break;
          case "ArrowUp":
            e.preventDefault();
            setActionIndex((i) => Math.max(i - 1, 0));
            break;
          case "Enter":
            e.preventDefault();
            handleSelectAction(ACTIONS[actionIndex].id);
            break;
          case "Escape":
            e.preventDefault();
            setPhase("pick");
            break;
          case "Backspace":
            if (phase === "action") {
              e.preventDefault();
              setPhase("pick");
            }
            break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, phase, checkpoints.length, selectedIndex, actionIndex, handleSelectCheckpoint, handleSelectAction, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rewind conversation"
        className="animate-scale-in-spring relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-bg-secondary shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          {/* Rewind icon */}
          <svg
            className="h-4 w-4 flex-shrink-0 text-warning"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <div className="flex-1">
            <span className="text-sm font-medium text-text">
              {phase === "pick" ? "Rewind — Select checkpoint" : "Choose action"}
            </span>
            {phase === "action" && (
              <button
                onClick={() => setPhase("pick")}
                className="ml-2 text-xs text-text-muted hover:text-text"
              >
                (back)
              </button>
            )}
          </div>
          <kbd className="rounded-md bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
            {phase === "pick" ? "Enter to select" : "Esc to go back"}
          </kbd>
        </div>

        {phase === "pick" ? (
          /* Checkpoint list */
          <div ref={listRef} role="listbox" className="max-h-96 overflow-y-auto py-2">
            {checkpoints.length === 0 && (
              <div className="px-5 py-8 text-center text-xs text-text-muted">
                No user messages to rewind to
              </div>
            )}

            {checkpoints.map((cp, idx) => {
              const isSelected = idx === selectedIndex;
              const contentPreview = typeof cp.message.content === "string"
                ? cp.message.content
                : cp.message.content
                    .filter((b) => b.type === "text")
                    .map((b) => b.text ?? "")
                    .join(" ");
              const truncated = contentPreview.length > 120
                ? contentPreview.slice(0, 120) + "..."
                : contentPreview;
              const msgCount = messages.length - cp.originalIndex;

              return (
                <button
                  key={cp.message.uuid}
                  data-index={idx}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelectedIndex(idx);
                    handleSelectCheckpoint();
                  }}
                  className={`relative flex w-full items-start gap-3 px-5 py-3 text-left text-sm transition-all duration-150 ${
                    isSelected
                      ? "bg-warning/10 text-text"
                      : "text-text-secondary hover:bg-bg-tertiary/50"
                  }`}
                >
                  {/* Selected accent bar */}
                  {isSelected && (
                    <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-warning" />
                  )}

                  {/* Checkpoint number */}
                  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isSelected ? "bg-warning/20 text-warning" : "bg-bg-tertiary text-text-muted"
                  }`}>
                    {idx + 1}
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{truncated}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                      <span>{formatTime(cp.message.timestamp)}</span>
                      <span className="text-text-muted/50">|</span>
                      <span>{msgCount} msg{msgCount !== 1 ? "s" : ""} after</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Action picker */
          <div className="py-2">
            {/* Selected checkpoint preview */}
            {checkpoints[selectedIndex] && (
              <div className="mx-5 mb-3 rounded-xl border border-white/5 bg-bg/50 px-4 py-2.5">
                <div className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
                  Rewind to
                </div>
                <div className="mt-1 truncate text-sm text-text">
                  {getContentPreview(checkpoints[selectedIndex].message)}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {ACTIONS.map((action, idx) => {
              const isSelected = idx === actionIndex;
              return (
                <button
                  key={action.id}
                  onClick={() => handleSelectAction(action.id)}
                  onMouseEnter={() => setActionIndex(idx)}
                  className={`relative flex w-full items-center gap-3 px-5 py-3 text-left transition-all duration-150 ${
                    isSelected
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:bg-bg-tertiary/50"
                  }`}
                >
                  {isSelected && (
                    <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
                  )}
                  <svg
                    className="h-4 w-4 flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={action.icon} />
                  </svg>
                  <div>
                    <div className="text-sm font-medium">{action.label}</div>
                    <div className="text-xs text-text-muted">{action.description}</div>
                  </div>
                </button>
              );
            })}

            {/* Cancel */}
            <button
              onClick={onClose}
              className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm text-text-muted transition-all duration-150 hover:bg-bg-tertiary/50"
            >
              <svg
                className="h-4 w-4 flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Never mind</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getContentPreview(message: ChatMessage): string {
  const content = typeof message.content === "string"
    ? message.content
    : message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join(" ");
  return content.length > 80 ? content.slice(0, 80) + "..." : content;
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
