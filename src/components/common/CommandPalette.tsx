import { useState, useEffect, useRef, useMemo } from "react";

export interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  section: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  actions: PaletteAction[];
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ actions, isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter actions by query
  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const lower = query.toLowerCase();
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(lower) ||
        a.description?.toLowerCase().includes(lower) ||
        a.section.toLowerCase().includes(lower),
    );
  }, [actions, query]);

  // Group by section
  const grouped = useMemo(() => {
    const groups: Record<string, PaletteAction[]> = {};
    for (const action of filtered) {
      if (!groups[action.section]) groups[action.section] = [];
      groups[action.section].push(action);
    }
    return groups;
  }, [filtered]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Clamp selectedIndex
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

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
            filtered[selectedIndex].onSelect();
            onClose();
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
  }, [isOpen, filtered, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-scale-in-spring relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-bg-secondary shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          {/* Search icon */}
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
            placeholder="Type a command..."
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-label="Search commands"
            className="w-full bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
          />
        </div>

        {/* Results */}
        <div ref={listRef} role="listbox" className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              No matching commands
            </div>
          )}

          {Object.entries(grouped).map(([section, sectionActions]) => (
            <div key={section}>
              {/* Section header — uppercase tracked with accent dot */}
              <div className="flex items-center gap-2 px-5 py-2">
                <span className="h-1 w-1 rounded-full bg-accent/60" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
                  {section}
                </span>
              </div>
              {sectionActions.map((action) => {
                const idx = flatIndex++;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={action.id}
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      action.onSelect();
                      onClose();
                    }}
                    className={`relative flex w-full items-center justify-between px-5 py-2.5 text-left text-sm transition-all duration-150 ${
                      isSelected
                        ? "bg-accent/15 text-accent"
                        : "text-text hover:bg-bg-tertiary/50"
                    }`}
                  >
                    {/* Left accent bar for selected */}
                    {isSelected && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
                    )}
                    <div>
                      <div className="font-medium">{action.label}</div>
                      {action.description && (
                        <div className="mt-0.5 text-xs text-text-muted">
                          {action.description}
                        </div>
                      )}
                    </div>
                    {action.shortcut && (
                      <kbd className="rounded-md bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-muted">
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
