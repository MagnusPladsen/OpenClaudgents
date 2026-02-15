import { useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { useStreamingChat } from "./hooks/useStreamingChat";
import { useSettingsStore } from "./stores/settingsStore";
import { detectClaudeCli } from "./lib/tauri";

function App() {
  const [cliMissing, setCliMissing] = useState(false);

  // Subscribe to all Claude streaming events at app level
  useStreamingChat();

  // Load persisted settings (theme, font size, notifications) on mount
  useEffect(() => {
    useSettingsStore.getState().loadSettings();
  }, []);

  // Check for Claude CLI on startup
  useEffect(() => {
    detectClaudeCli()
      .then((path) => {
        if (!path) setCliMissing(true);
      })
      .catch(() => setCliMissing(true));
  }, []);

  return (
    <>
      {cliMissing && (
        <div className="flex items-center justify-between bg-warning/20 px-4 py-2 text-xs text-warning">
          <span>
            Claude CLI not found. Install via{" "}
            <code className="rounded bg-black/20 px-1">brew install claude-code</code>
            {" "}or{" "}
            <code className="rounded bg-black/20 px-1">npm install -g @anthropic-ai/claude-code</code>
            {" "}then restart.
          </span>
          <button
            onClick={() => setCliMissing(false)}
            className="ml-4 rounded px-2 py-0.5 hover:bg-warning/20"
            aria-label="Dismiss warning"
          >
            Dismiss
          </button>
        </div>
      )}
      <AppShell />
    </>
  );
}

export default App;
