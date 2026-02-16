import { useState, useEffect, useCallback, useMemo } from "react";
import { discoverPlugins, installPlugin, removePlugin, togglePluginEnabled } from "../../lib/tauri";
import type { DiscoverablePlugin } from "../../lib/tauri";

interface PluginManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "discover" | "installed";

function formatInstallCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}

export function PluginManagerDialog({ isOpen, onClose }: PluginManagerDialogProps) {
  const [plugins, setPlugins] = useState<DiscoverablePlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverPlugins();
      setPlugins(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPlugins();
      setSearchQuery("");
      setActiveTab("discover");
    }
  }, [isOpen, fetchPlugins]);

  const handleInstall = useCallback(async (pluginId: string) => {
    setInstalling(pluginId);
    setError(null);
    try {
      await installPlugin(pluginId);
      await fetchPlugins();
    } catch (err) {
      setError(String(err));
    } finally {
      setInstalling(null);
    }
  }, [fetchPlugins]);

  const handleRemove = useCallback(async (pluginId: string) => {
    setRemoving(pluginId);
    setError(null);
    try {
      await removePlugin(pluginId);
      await fetchPlugins();
    } catch (err) {
      setError(String(err));
    } finally {
      setRemoving(null);
    }
  }, [fetchPlugins]);

  const handleToggle = useCallback(async (pluginId: string) => {
    setToggling(pluginId);
    setError(null);
    try {
      await togglePluginEnabled(pluginId);
      await fetchPlugins();
    } catch (err) {
      setError(String(err));
    } finally {
      setToggling(null);
    }
  }, [fetchPlugins]);

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

  const installedCount = useMemo(
    () => plugins.filter((p) => p.installed).length,
    [plugins],
  );

  const filteredPlugins = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    let list = activeTab === "installed"
      ? plugins.filter((p) => p.installed)
      : plugins;
    if (query) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.author.toLowerCase().includes(query),
      );
    }
    return list;
  }, [plugins, activeTab, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plugin Manager"
        className="animate-scale-in-spring relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-secondary shadow-2xl shadow-black/30 backdrop-blur-xl"
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

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/5 px-5 pt-2">
          <button
            onClick={() => setActiveTab("discover")}
            className={`rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "discover"
                ? "border-b-2 border-accent text-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            Discover
          </button>
          <button
            onClick={() => setActiveTab("installed")}
            className={`rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "installed"
                ? "border-b-2 border-accent text-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            Installed ({installedCount})
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plugins..."
            className="w-full rounded-lg border border-border/30 bg-bg px-3 py-2 text-sm text-text placeholder-text-muted/50 outline-none transition-colors focus:border-accent/50"
          />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 rounded-lg bg-error/10 px-3 py-2 text-xs text-error">
            {error}
          </div>
        )}

        {/* Plugin list */}
        <div className="max-h-96 overflow-y-auto py-1">
          {loading && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              Loading plugins...
            </div>
          )}

          {!loading && filteredPlugins.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              {searchQuery
                ? "No plugins match your search"
                : activeTab === "installed"
                  ? "No plugins installed"
                  : "No plugins found"}
            </div>
          )}

          {!loading && filteredPlugins.map((plugin) => (
            <div
              key={plugin.id}
              className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-bg-tertiary/30"
            >
              {/* Toggle (installed tab only) */}
              {activeTab === "installed" && (
                <button
                  onClick={() => handleToggle(plugin.id)}
                  disabled={toggling === plugin.id}
                  className={`mt-0.5 flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                    plugin.enabled ? "bg-success" : "bg-bg-tertiary"
                  }`}
                  aria-label={plugin.enabled ? "Disable plugin" : "Enable plugin"}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                      plugin.enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              )}

              {/* Plugin info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">
                    {plugin.name}
                  </span>
                  {plugin.installCount > 0 && (
                    <span className="flex-shrink-0 text-[10px] text-text-muted">
                      {formatInstallCount(plugin.installCount)} installs
                    </span>
                  )}
                </div>
                {plugin.description && (
                  <div className="mt-0.5 text-xs leading-relaxed text-text-secondary line-clamp-2">
                    {plugin.description}
                  </div>
                )}
                <div className="mt-1 text-[10px] text-text-muted">
                  {plugin.author && <span>{plugin.author}</span>}
                  {plugin.author && plugin.marketplace && <span> · </span>}
                  <span>{plugin.marketplace}</span>
                </div>
              </div>

              {/* Action button */}
              <div className="flex flex-shrink-0 items-center gap-2 pt-0.5">
                {activeTab === "installed" ? (
                  <button
                    onClick={() => handleRemove(plugin.id)}
                    disabled={removing === plugin.id}
                    className="rounded-lg px-2.5 py-1 text-xs text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                  >
                    {removing === plugin.id ? "Removing..." : "Remove"}
                  </button>
                ) : plugin.installed ? (
                  <span className="rounded-lg bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                    Installed
                  </span>
                ) : (
                  <button
                    onClick={() => handleInstall(plugin.id)}
                    disabled={installing === plugin.id}
                    className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {installing === plugin.id ? "Installing..." : "Install"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
