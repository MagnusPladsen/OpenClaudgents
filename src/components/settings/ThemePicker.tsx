import { BUILT_IN_THEMES } from "../../lib/theme";
import { useSettingsStore } from "../../stores/settingsStore";

export function ThemePicker() {
  const currentTheme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-text">Theme</h4>
      <div className="grid grid-cols-3 gap-2">
        {BUILT_IN_THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className={`flex items-center gap-2 rounded border px-3 py-2 text-left text-xs transition-colors ${
              currentTheme === theme.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-bg-tertiary text-text hover:border-accent/50"
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full ${
                theme.isDark ? "bg-gray-800" : "bg-gray-200"
              }`}
            />
            <span>{theme.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
