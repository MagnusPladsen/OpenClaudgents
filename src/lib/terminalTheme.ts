import type { ITheme } from "@xterm/xterm";

/**
 * Reads the current CSS theme variables and returns an xterm.js ITheme.
 * Falls back to sensible defaults if variables are not set.
 */
export function getXtermTheme(): ITheme {
  const style = getComputedStyle(document.documentElement);
  const get = (varName: string, fallback: string): string =>
    style.getPropertyValue(varName).trim() || fallback;

  return {
    background: get("--theme-bg", "#1a1b26"),
    foreground: get("--theme-text", "#c0caf5"),
    cursor: get("--theme-accent", "#7aa2f7"),
    cursorAccent: get("--theme-bg", "#1a1b26"),
    selectionBackground: get("--theme-accent", "#7aa2f7") + "40",
    selectionForeground: get("--theme-text", "#c0caf5"),
    black: get("--theme-bg-tertiary", "#2f3549"),
    red: get("--theme-error", "#f7768e"),
    green: get("--theme-success", "#9ece6a"),
    yellow: get("--theme-warning", "#e0af68"),
    blue: get("--theme-accent", "#7aa2f7"),
    magenta: get("--theme-accent-hover", "#89b4fa"),
    cyan: get("--theme-info", "#7dcfff"),
    white: get("--theme-text", "#c0caf5"),
    brightBlack: get("--theme-text-muted", "#565f89"),
    brightRed: get("--theme-error", "#f7768e"),
    brightGreen: get("--theme-success", "#9ece6a"),
    brightYellow: get("--theme-warning", "#e0af68"),
    brightBlue: get("--theme-accent", "#7aa2f7"),
    brightMagenta: get("--theme-accent-hover", "#89b4fa"),
    brightCyan: get("--theme-info", "#7dcfff"),
    brightWhite: get("--theme-text-secondary", "#a9b1d6"),
  };
}

/**
 * Observes `data-theme` attribute changes on the document element.
 * Calls `onThemeChange` with the new xterm theme whenever it changes.
 * Returns a cleanup function to disconnect the observer.
 */
export function observeThemeChanges(onThemeChange: (theme: ITheme) => void): () => void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
        // Small delay to let CSS variables update
        requestAnimationFrame(() => {
          onThemeChange(getXtermTheme());
        });
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return () => observer.disconnect();
}
