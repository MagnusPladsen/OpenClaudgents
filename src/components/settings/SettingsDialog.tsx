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
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl"
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
        className="animate-scale-in-spring mx-4 w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-bg-secondary shadow-2xl shadow-black/30 backdrop-blur-xl focus:outline-none"
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5">
          <h2 className="text-base font-semibold tracking-tight text-text">Settings</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-all hover:bg-bg-tertiary hover:text-text"
            aria-label="Close settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="pointer-events-none absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        {/* Content */}
        <div className="max-h-[60vh] space-y-8 overflow-y-auto px-6 py-5">
          {/* Theme */}
          <SettingsSection title="Theme">
            <ThemePicker />
          </SettingsSection>

          {/* Font Size */}
          <SettingsSection title="Font Size">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={10}
                max={20}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-bg-tertiary accent-accent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-accent/20"
                aria-label="Font size"
              />
              <span className="w-10 text-right font-mono text-xs text-text-muted">
                {fontSize}px
              </span>
            </div>
          </SettingsSection>

          {/* Notifications */}
          <SettingsSection title="Notifications">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              <span className="text-sm text-text">
                Enable desktop notifications
              </span>
            </label>
            <p className="mt-1.5 text-xs text-text-muted">
              Get notified when tasks complete or agents need input.
            </p>
          </SettingsSection>

          {/* Keyboard Shortcuts Reference */}
          <SettingsSection title="Keyboard Shortcuts">
            <div className="space-y-2">
              {[
                { keys: "⌘K", action: "Command palette" },
                { keys: "⌘J", action: "Toggle terminal" },
                { keys: "⌘,", action: "Settings" },
                { keys: "Esc Esc", action: "Rewind" },
                { keys: "Enter", action: "Send message" },
                { keys: "Shift+Enter", action: "New line" },
              ].map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-text-muted">{shortcut.action}</span>
                  <kbd className="rounded-md bg-bg-tertiary px-2 py-0.5 font-mono text-[10px] text-text-secondary">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </SettingsSection>

          {/* About */}
          <SettingsSection title="About">
            <p className="text-sm text-text-muted">
              OpenClaudgents v0.1.0 — Open-source multi-agent Claude Code
              orchestrator.
            </p>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="relative mb-3">
        <h4 className="text-sm font-semibold text-text">{title}</h4>
        <div className="pointer-events-none absolute -bottom-1.5 left-0 h-px w-8 bg-accent/40" />
      </div>
      {children}
    </div>
  );
}
