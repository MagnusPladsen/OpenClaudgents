import { useState, useRef, useCallback } from "react";

interface ComposerProps {
  sessionId: string;
  onSend?: (message: string) => void;
  disabled?: boolean;
}

export function Composer({ onSend, disabled }: ComposerProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSend?.(trimmed);
    setText("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const canSend = !disabled && text.trim().length > 0;

  return (
    <div className="border-t border-border bg-bg-secondary/80 p-4 backdrop-blur-sm">
      <div className="flex items-end gap-2 rounded-xl border border-border bg-bg px-3 py-2 transition-all duration-200 focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/20 focus-within:shadow-lg focus-within:shadow-accent/5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          disabled={disabled}
          rows={1}
          aria-label="Message input"
          className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
            canSend
              ? "bg-accent text-bg shadow-sm shadow-accent/20 hover:scale-105 hover:bg-accent-hover hover:shadow-md hover:shadow-accent/30"
              : "bg-bg-tertiary text-text-muted"
          }`}
        >
          {/* Arrow up icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
          Send
        </button>
      </div>
    </div>
  );
}
