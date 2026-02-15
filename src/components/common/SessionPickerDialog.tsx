import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { discoverSessions, resumeSession } from "../../lib/tauri";
import { useChatStore } from "../../stores/chatStore";
import type { DiscoveredSession } from "../../lib/tauri";

interface SessionPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionPickerDialog({ isOpen, onClose }: SessionPickerDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [discovered, setDiscovered] = useState<DiscoveredSession[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sessions = useSessionStore((s) => s.sessions);
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const clearMessages = useChatStore((s) => s.clearMessages);

  // Load discovered sessions when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);
    setLoading(true);

    discoverSessions()
      .then(setDiscovered)
      .catch(() => setDiscovered([]))
      .finally(() => setLoading(false));

    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // Build combined list: active sessions first, then discovered
  const allItems = useMemo(() => {
    const items: Array<{
      type: "active" | "discovered";
      id: string;
      name: string;
      projectPath: string;
      model: string | null;
      lastActive: string;
      claudeSessionId: string;
    }> = [];

    // Active sessions in store
    for (const s of sessions) {
      items.push({
        type: "active",
        id: s.id,
        name: s.name || s.projectPath.split("/").pop() || s.id,
        projectPath: s.projectPath,
        model: s.model,
        lastActive: s.updatedAt,
        claudeSessionId: s.claudeSessionId,
      });
    }

    // Discovered sessions not already in active list
    const activeIds = new Set(sessions.map((s) => s.claudeSessionId));
    for (const d of discovered) {
      if (activeIds.has(d.claudeSessionId)) continue;
      items.push({
        type: "discovered",
        id: d.claudeSessionId,
        name: d.name || d.projectPath.split("/").pop() || d.claudeSessionId,
        projectPath: d.projectPath,
        model: d.model,
        lastActive: d.lastMessageAt || "",
        claudeSessionId: d.claudeSessionId,
      });
    }

    return items;
  }, [sessions, discovered]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const lower = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.projectPath.toLowerCase().includes(lower) ||
        item.claudeSessionId.toLowerCase().includes(lower),
    );
  }, [allItems, query]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  const handleSelect = useCallback(async (item: typeof filtered[number]) => {
    if (item.type === "active") {
      setActiveSession(item.id);
    } else {
      // Resume discovered session
      try {
        const session = await resumeSession(item.claudeSessionId, item.projectPath);
        addSession(session);
        setActiveSession(session.id);
        clearMessages();
      } catch (err) {
        console.error("Failed to resume session:", err);
      }
    }
    onClose();
  }, [setActiveSession, addSession, clearMessages, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, filtered, selectedIndex, onClose, handleSelect]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resume session"
        className="animate-scale-in-spring relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-bg-secondary shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <svg
            className="h-4 w-4 flex-shrink-0 text-text-muted"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search sessions..."
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-label="Search sessions"
            className="w-full bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
          />
        </div>

        {/* Results */}
        <div ref={listRef} role="listbox" className="max-h-80 overflow-y-auto py-2">
          {loading && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              Loading sessions...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              No sessions found
            </div>
          )}

          {!loading && filtered.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const timeAgo = item.lastActive ? formatTimeAgo(item.lastActive) : "";
            return (
              <button
                key={item.id}
                data-index={idx}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(item)}
                className={`relative flex w-full items-center justify-between px-5 py-2.5 text-left text-sm transition-all duration-150 ${
                  isSelected
                    ? "bg-accent/15 text-accent"
                    : "text-text hover:bg-bg-tertiary/50"
                }`}
              >
                {isSelected && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    {item.model && (
                      <span className="flex-shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        {item.model.includes("sonnet") ? "Sonnet" : item.model.includes("opus") ? "Opus" : "Haiku"}
                      </span>
                    )}
                    {item.type === "active" && (
                      <span className="flex-shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        active
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-text-muted">
                    {item.projectPath}
                  </div>
                </div>
                {timeAgo && (
                  <span className="ml-3 flex-shrink-0 text-xs text-text-muted">
                    {timeAgo}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
