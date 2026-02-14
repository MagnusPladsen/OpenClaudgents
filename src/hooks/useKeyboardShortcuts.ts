import { useEffect } from "react";

interface ShortcutHandlers {
  onToggleTerminal: () => void;
}

/**
 * Global keyboard shortcut handler.
 * Cmd+J: Toggle terminal drawer
 */
export function useKeyboardShortcuts({ onToggleTerminal }: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+J: Toggle terminal
      if (isMod && e.key === "j") {
        e.preventDefault();
        onToggleTerminal();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onToggleTerminal]);
}
