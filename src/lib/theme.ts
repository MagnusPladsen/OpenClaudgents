export interface ThemeDefinition {
  id: string;
  name: string;
  isDark: boolean;
  colors: {
    bg: string;
    accent: string;
    text: string;
    error: string;
  };
}

export const BUILT_IN_THEMES: ThemeDefinition[] = [
  { id: "tokyo-night", name: "Tokyo Night", isDark: true, colors: { bg: "#1a1b26", accent: "#7aa2f7", text: "#c0caf5", error: "#f7768e" } },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", isDark: true, colors: { bg: "#1e1e2e", accent: "#cba6f7", text: "#cdd6f4", error: "#f38ba8" } },
  { id: "catppuccin-latte", name: "Catppuccin Latte", isDark: false, colors: { bg: "#eff1f5", accent: "#8839ef", text: "#4c4f69", error: "#d20f39" } },
  { id: "dracula", name: "Dracula", isDark: true, colors: { bg: "#282a36", accent: "#bd93f9", text: "#f8f8f2", error: "#ff5555" } },
  { id: "gruvbox-dark", name: "Gruvbox Dark", isDark: true, colors: { bg: "#282828", accent: "#fabd2f", text: "#ebdbb2", error: "#fb4934" } },
  { id: "kanagawa", name: "Kanagawa", isDark: true, colors: { bg: "#1f1f28", accent: "#7e9cd8", text: "#dcd7ba", error: "#ff5d62" } },
  { id: "monokai-pro", name: "Monokai Pro", isDark: true, colors: { bg: "#2d2a2e", accent: "#ffd866", text: "#fcfcfa", error: "#ff6188" } },
  { id: "nord", name: "Nord", isDark: true, colors: { bg: "#2e3440", accent: "#88c0d0", text: "#eceff4", error: "#bf616a" } },
  { id: "one-dark", name: "One Dark", isDark: true, colors: { bg: "#282c34", accent: "#61afef", text: "#abb2bf", error: "#e06c75" } },
  { id: "rose-pine", name: "Rose Pine", isDark: true, colors: { bg: "#191724", accent: "#c4a7e7", text: "#e0def4", error: "#eb6f92" } },
  { id: "solarized-dark", name: "Solarized Dark", isDark: true, colors: { bg: "#002b36", accent: "#268bd2", text: "#839496", error: "#dc322f" } },
];

/**
 * Apply a theme by setting the data-theme attribute on the root element.
 * The CSS in themes.css handles the actual variable overrides.
 * "tokyo-night" is the default (uses :root variables, no data-theme attribute).
 */
export function applyTheme(themeId: string): void {
  const root = document.documentElement;

  if (themeId === "tokyo-night") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", themeId);
  }

  // Store preference
  localStorage.setItem("openclaudgents-theme", themeId);
}

/**
 * Load the saved theme preference, or default to tokyo-night.
 */
export function loadSavedTheme(): string {
  const saved = localStorage.getItem("openclaudgents-theme");
  if (saved && BUILT_IN_THEMES.some((t) => t.id === saved)) {
    return saved;
  }
  return "tokyo-night";
}

/**
 * Initialize theme on app start.
 */
export function initTheme(): string {
  const themeId = loadSavedTheme();
  applyTheme(themeId);
  return themeId;
}
