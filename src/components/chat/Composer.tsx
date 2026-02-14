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

  return (
    <div className="border-t border-border bg-bg-secondary p-4">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-bg px-3 py-2 focus-within:border-border-focus">
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
          disabled={disabled || !text.trim()}
          aria-label="Send message"
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg transition-colors hover:bg-accent-hover disabled:opacity-30"
        >
          Send
        </button>
      </div>
    </div>
  );
}
