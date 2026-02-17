import { useState, useRef, useCallback, useEffect } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { matchCommandsGrouped } from "../../lib/commands";
import { discoverCustomSkills } from "../../lib/tauri";
import { useSessionStore } from "../../stores/sessionStore";
import type { SlashCommand, GroupedCommands } from "../../lib/commands";

interface ComposerProps {
  sessionId: string;
  onSend?: (message: string) => void;
  disabled?: boolean;
}

const MODELS = [
  { id: "sonnet", label: "Sonnet 4.5" },
  { id: "opus", label: "Opus 4.6" },
  { id: "haiku", label: "Haiku 4.5" },
];

export function Composer({ onSend, disabled }: ComposerProps) {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [groups, setGroups] = useState<GroupedCommands[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customSkills, setCustomSkills] = useState<SlashCommand[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const planMode = useChatStore((s) => s.planMode);
  const setPlanMode = useChatStore((s) => s.setPlanMode);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const setDefaultModel = useSettingsStore((s) => s.setDefaultModel);

  // Discover custom skills on mount and when session changes
  useEffect(() => {
    const session = useSessionStore.getState().getActiveSession();
    discoverCustomSkills(session?.projectPath)
      .then((skills) => {
        const mapped: SlashCommand[] = skills.map((s) => ({
          name: s.name,
          description: s.description,
          category: "custom" as const,
        }));
        setCustomSkills(mapped);
      })
      .catch(() => setCustomSkills([]));
  }, [activeSessionId]);

  // Close model picker when clicking outside
  useEffect(() => {
    if (!showModelPicker) return;
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModelPicker]);

  // Compute flat list of all commands for keyboard navigation
  const flatCommands = groups.flatMap((g) => g.commands);

  // Update suggestions when text changes
  useEffect(() => {
    const trimmed = text.trim();
    // Only show suggestions when text is just a slash command (no spaces = still typing command name)
    if (trimmed.startsWith("/") && !trimmed.includes(" ")) {
      const matched = matchCommandsGrouped(trimmed, customSkills.length > 0 ? customSkills : undefined);
      setGroups(matched);
      setSelectedIndex(0);
    } else {
      setGroups([]);
    }
  }, [text, customSkills]);

  const acceptSuggestion = useCallback((command: SlashCommand) => {
    setText(`/${command.name}${command.args ? " " : ""}`);
    setGroups([]);
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSend?.(trimmed);
    setText("");
    setGroups([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle suggestion navigation
    if (flatCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % flatCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + flatCommands.length) % flatCommands.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        acceptSuggestion(flatCommands[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setGroups([]);
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
  const currentModel = MODELS.find((m) => m.id === defaultModel) || MODELS[0];

  // Build flat index counter for tracking selected across groups
  let flatIndex = 0;

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

      {/* Grouped slash command autocomplete dropdown */}
      {groups.length > 0 && (
        <div className="absolute bottom-full left-5 right-5 mb-1 max-h-72 overflow-y-auto rounded-xl border border-border/50 bg-bg-secondary shadow-xl shadow-black/20">
          {groups.map((group) => (
            <div key={group.category}>
              {/* Section header */}
              <div className="flex items-center gap-2 px-4 py-1.5">
                <span className="h-1 w-1 rounded-full bg-accent/60" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
                  {group.label}
                </span>
              </div>
              {group.commands.map((cmd) => {
                const idx = flatIndex++;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.name}
                    data-index={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      acceptSuggestion(cmd);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                      isSelected
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
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Animated gradient border wrapper */}
      <div className={`rounded-2xl p-px transition-all duration-300 ${
        isFocused
          ? "bg-gradient-to-r from-accent via-info to-accent animate-gradient-shift shadow-lg shadow-accent/10"
          : "bg-border/40"
      }`}>
        <div className="overflow-hidden rounded-[15px] bg-bg">
          {/* Textarea area */}
          <div className="flex items-end gap-2 px-4 py-3">
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
                setTimeout(() => setGroups([]), 150);
              }}
              placeholder="Type a message... (/ for commands, Enter to send)"
              disabled={disabled}
              rows={1}
              aria-label="Message input"
              className="max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent text-base text-text placeholder:text-text-muted focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Bottom bar: model selector, plan toggle, send button */}
          <div className="flex items-center gap-2 border-t border-border/10 px-4 py-2">
            {/* Model selector */}
            <div className="relative" ref={modelPickerRef}>
              <button
                onClick={() => setShowModelPicker((p) => !p)}
                className="rounded-lg bg-bg-tertiary/40 px-3 py-1.5 text-xs font-medium text-text-muted transition-all hover:bg-bg-tertiary/60 hover:text-text"
              >
                {currentModel.label} <span className="text-text-muted/60">&#x25BE;</span>
              </button>

              {showModelPicker && (
                <div className="animate-scale-in absolute bottom-full left-0 mb-1 rounded-xl border border-border/50 bg-bg-secondary shadow-xl shadow-black/20">
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDefaultModel(model.id);
                        setShowModelPicker(false);
                      }}
                      className={`flex w-full items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors ${
                        model.id === defaultModel
                          ? "bg-accent/10 text-accent"
                          : "text-text-secondary hover:bg-bg-tertiary/50"
                      }`}
                    >
                      {model.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Plan mode toggle */}
            <button
              onClick={() => setPlanMode(!planMode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                planMode
                  ? "bg-warning/15 text-warning"
                  : "bg-bg-tertiary/40 text-text-muted hover:bg-bg-tertiary/60 hover:text-text"
              }`}
            >
              Plan
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send message"
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
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
    </div>
  );
}
