import { useState, useRef, useCallback, useEffect } from "react";
import { useChatStore } from "../../stores/chatStore";
import { matchCommands } from "../../lib/commands";
import type { SlashCommand } from "../../lib/commands";

interface ComposerProps {
  sessionId: string;
  onSend?: (message: string) => void;
  disabled?: boolean;
}

export function Composer({ onSend, disabled }: ComposerProps) {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);

  // Update suggestions when text changes
  useEffect(() => {
    const trimmed = text.trim();
    // Only show suggestions when text is just a slash command (no spaces = still typing command name)
    if (trimmed.startsWith("/") && !trimmed.includes(" ")) {
      const matches = matchCommands(trimmed);
      setSuggestions(matches);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
    }
  }, [text]);

  const acceptSuggestion = useCallback((command: SlashCommand) => {
    setText(`/${command.name}${command.args ? " " : ""}`);
    setSuggestions([]);
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSend?.(trimmed);
    setText("");
    setSuggestions([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle suggestion navigation
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        acceptSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestions([]);
        return;
      }
    }

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
    <div className="relative bg-bg/80 px-5 pb-5 pt-3 backdrop-blur-sm">
      {/* Streaming status pill */}
      {isStreaming && (
        <div className="mb-2 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1">
            <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
            <span className="text-xs font-medium text-accent">Claude is responding...</span>
          </div>
        </div>
      )}

      {/* Slash command autocomplete dropdown */}
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-5 right-5 mb-1 overflow-hidden rounded-xl border border-border/50 bg-bg-secondary shadow-xl shadow-black/20">
          {suggestions.map((cmd, i) => (
            <button
              key={cmd.name}
              onMouseDown={(e) => {
                e.preventDefault();
                acceptSuggestion(cmd);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                i === selectedIndex
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:bg-bg-tertiary/50"
              }`}
            >
              <span className="font-mono font-medium">/{cmd.name}</span>
              {cmd.args && (
                <span className="text-xs text-text-muted">{cmd.args}</span>
              )}
              <span className="ml-auto text-xs text-text-muted">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Animated gradient border wrapper */}
      <div className={`rounded-2xl p-px transition-all duration-300 ${
        isFocused
          ? "bg-gradient-to-r from-accent via-info to-accent animate-gradient-shift shadow-lg shadow-accent/10"
          : "bg-border/40"
      }`}>
        <div className="flex items-end gap-2 rounded-[15px] bg-bg px-4 py-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              // Delay clearing suggestions to allow click handler to fire
              setTimeout(() => setSuggestions([]), 150);
            }}
            placeholder="Type a message... (/ for commands, Enter to send)"
            disabled={disabled}
            rows={1}
            aria-label="Message input"
            className="max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent text-base text-text placeholder:text-text-muted focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
              canSend
                ? "bg-gradient-to-r from-accent to-accent-hover text-bg shadow-md shadow-accent/20 hover:scale-110 hover:shadow-lg hover:shadow-accent/30"
                : "bg-bg-tertiary text-text-muted"
            }`}
          >
            {/* Arrow up icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
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
          </button>
        </div>
      </div>
    </div>
  );
}
