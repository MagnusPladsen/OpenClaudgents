export interface ThemeDefinition {
  id: string;
  name: string;
  isDark: boolean;
}

export const BUILT_IN_THEMES: ThemeDefinition[] = [
  { id: "tokyo-night", name: "Tokyo Night", isDark: true },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", isDark: true },
  { id: "dracula", name: "Dracula", isDark: true },
  { id: "gruvbox-dark", name: "Gruvbox Dark", isDark: true },
  { id: "kanagawa", name: "Kanagawa", isDark: true },
  { id: "monokai-pro", name: "Monokai Pro", isDark: true },
  { id: "nord", name: "Nord", isDark: true },
  { id: "one-dark", name: "One Dark", isDark: true },
  { id: "rose-pine", name: "Rose Pine", isDark: true },
  { id: "solarized-dark", name: "Solarized Dark", isDark: true },
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
