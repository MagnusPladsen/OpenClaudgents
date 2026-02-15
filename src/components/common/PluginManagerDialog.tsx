import { useState, useEffect, useCallback } from "react";
import { listPlugins, installPlugin, removePlugin } from "../../lib/tauri";
import type { PluginInfo } from "../../lib/tauri";

interface PluginManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PluginManagerDialog({ isOpen, onClose }: PluginManagerDialogProps) {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installName, setInstallName] = useState("");
  const [installing, setInstalling] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPlugins();
      setPlugins(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchPlugins();
      setInstallName("");
    }
  }, [isOpen, fetchPlugins]);

  const handleInstall = useCallback(async () => {
    if (!installName.trim()) return;
    setInstalling(true);
    setError(null);
    try {
      await installPlugin(installName.trim());
      setInstallName("");
      await fetchPlugins();
    } catch (err) {
      setError(String(err));
    } finally {
      setInstalling(false);
    }
  }, [installName, fetchPlugins]);

  const handleRemove = useCallback(async (name: string) => {
    setRemoving(name);
    setError(null);
    try {
      await removePlugin(name);
      await fetchPlugins();
    } catch (err) {
      setError(String(err));
    } finally {
      setRemoving(null);
    }
  }, [fetchPlugins]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plugin Manager"
        className="animate-scale-in-spring relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-bg-secondary shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <svg
            className="h-4 w-4 flex-shrink-0 text-accent"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="flex-1 text-sm font-medium text-text">
            Plugin Manager
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text"
          >
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error">
            {error}
          </div>
        )}

        {/* Plugin list */}
        <div className="max-h-72 overflow-y-auto py-2">
          {loading && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              Loading plugins...
            </div>
          )}

          {!loading && plugins.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              No plugins installed
            </div>
          )}

          {plugins.map((plugin) => (
            <div
              key={plugin.name}
              className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-bg-tertiary/30"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-text">{plugin.name}</div>
                {plugin.version && (
                  <div className="text-xs text-text-muted">{plugin.version}</div>
                )}
              </div>
              <button
                onClick={() => handleRemove(plugin.name)}
                disabled={removing === plugin.name}
                className="flex-shrink-0 rounded-lg px-2.5 py-1 text-xs text-error transition-colors hover:bg-error/10 disabled:opacity-50"
              >
                {removing === plugin.name ? "Removing..." : "Remove"}
              </button>
            </div>
          ))}
        </div>

        {/* Install section */}
        <div className="border-t border-white/5 px-5 py-4">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-text-muted">
            Install Plugin
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={installName}
              onChange={(e) => setInstallName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleInstall();
                }
              }}
              placeholder="Plugin name..."
              className="flex-1 rounded-lg border border-border/30 bg-bg px-3 py-2 text-sm text-text placeholder-text-muted/50 outline-none transition-colors focus:border-accent/50"
            />
            <button
              onClick={handleInstall}
              disabled={installing || !installName.trim()}
              className="flex-shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {installing ? "Installing..." : "Install"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
