import { BUILT_IN_THEMES } from "../../lib/theme";
import { useSettingsStore } from "../../stores/settingsStore";

export function ThemePicker() {
  const currentTheme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {BUILT_IN_THEMES.map((theme) => {
        const isActive = currentTheme === theme.id;
        return (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className={`group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-200 ${
              isActive
                ? "border-accent/60 bg-accent/10 shadow-md shadow-accent/10"
                : "border-border/50 bg-bg-tertiary/30 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
            }`}
          >
            {/* Color swatch preview */}
            <div className="flex items-center gap-1.5">
              <span
                className="h-3.5 w-3.5 rounded-full ring-1 ring-white/10"
                style={{ backgroundColor: theme.colors.bg }}
              />
              <span
                className="h-3.5 w-3.5 rounded-full ring-1 ring-white/10"
                style={{ backgroundColor: theme.colors.accent }}
              />
              <span
                className="h-3.5 w-3.5 rounded-full ring-1 ring-white/10"
                style={{ backgroundColor: theme.colors.text }}
              />
              <span
                className="h-3.5 w-3.5 rounded-full ring-1 ring-white/10"
                style={{ backgroundColor: theme.colors.error }}
              />
            </div>
            {/* Theme name */}
            <span className={`text-xs font-medium ${isActive ? "text-accent" : "text-text-secondary"}`}>
              {theme.name}
            </span>
            {/* Active indicator */}
            {isActive && (
              <span className="absolute right-2 top-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
