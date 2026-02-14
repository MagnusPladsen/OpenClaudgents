import { useEffect, useRef } from "react";
import { ThemePicker } from "./ThemePicker";
import { useSettingsStore } from "../../stores/settingsStore";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="mx-4 w-full max-w-lg rounded-lg border border-border bg-bg-secondary shadow-xl focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-text">Settings</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-tertiary hover:text-text"
            aria-label="Close settings"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] space-y-6 overflow-y-auto px-6 py-4">
          {/* Theme */}
          <ThemePicker />

          {/* Font Size */}
          <div>
            <h4 className="mb-2 text-xs font-semibold text-text">Font Size</h4>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={20}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1"
                aria-label="Font size"
              />
              <span className="w-8 text-right text-xs text-text-muted">
                {fontSize}px
              </span>
            </div>
          </div>

          {/* Notifications */}
          <div>
            <h4 className="mb-2 text-xs font-semibold text-text">Notifications</h4>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs text-text">
                Enable desktop notifications
              </span>
            </label>
            <p className="mt-1 text-xs text-text-muted">
              Get notified when tasks complete or agents need input.
            </p>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div>
            <h4 className="mb-2 text-xs font-semibold text-text">
              Keyboard Shortcuts
            </h4>
            <div className="space-y-1">
              {[
                { keys: "⌘K", action: "Command palette" },
                { keys: "⌘J", action: "Toggle terminal" },
                { keys: "⌘,", action: "Settings" },
                { keys: "Enter", action: "Send message" },
                { keys: "Shift+Enter", action: "New line" },
              ].map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-text-muted">{shortcut.action}</span>
                  <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 text-text-muted">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* About */}
          <div>
            <h4 className="mb-2 text-xs font-semibold text-text">About</h4>
            <p className="text-xs text-text-muted">
              OpenClaudgents v0.1.0 — Open-source multi-agent Claude Code
              orchestrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
