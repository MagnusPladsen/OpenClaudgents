import { useState, useEffect, useRef, useCallback } from "react";
import { useChatStore } from "../../stores/chatStore";

interface ChatSearchBarProps {
  onClose: () => void;
}

export function ChatSearchBar({ onClose }: ChatSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState("");
  const messages = useChatStore((s) => s.messages);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const clearSearch = useChatStore((s) => s.clearSearch);
  const nextMatch = useChatStore((s) => s.nextMatch);
  const prevMatch = useChatStore((s) => s.prevMatch);
  const searchMatchIds = useChatStore((s) => s.searchMatchIds);
  const searchCurrentIndex = useChatStore((s) => s.searchCurrentIndex);

  // Derived values
  const matchLabel =
    searchMatchIds.length > 0
      ? `${searchCurrentIndex + 1} of ${searchMatchIds.length}`
      : localQuery
        ? "No results"
        : "";

  // Sync local query to store
  const handleChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      setSearchQuery(value, messages);
    },
    [messages, setSearchQuery],
  );

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSearch();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          prevMatch();
        } else {
          nextMatch();
        }
      }
    },
    [clearSearch, onClose, nextMatch, prevMatch],
  );

  const handleClose = useCallback(() => {
    clearSearch();
    onClose();
  }, [clearSearch, onClose]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-bg-secondary px-4 py-2 shadow-sm">
      {/* Search icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0 text-text-muted"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search messages..."
        className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
      />

      {matchLabel && (
        <span className="flex-shrink-0 text-xs text-text-muted">{matchLabel}</span>
      )}

      {/* Up arrow */}
      <button
        onClick={prevMatch}
        disabled={searchMatchIds.length === 0}
        className="rounded p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text disabled:opacity-30"
        title="Previous match (Shift+Enter)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>

      {/* Down arrow */}
      <button
        onClick={nextMatch}
        disabled={searchMatchIds.length === 0}
        className="rounded p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text disabled:opacity-30"
        title="Next match (Enter)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Close */}
      <button
        onClick={handleClose}
        className="rounded p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text"
        title="Close (Escape)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
