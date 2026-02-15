import { useState, useEffect, useCallback } from "react";
import { getMcpServers, addMcpServer, removeMcpServer, toggleMcpServer } from "../../lib/tauri";
import type { McpServerInfo } from "../../lib/types";

interface McpManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function McpManagerDialog({ isOpen, onClose }: McpManagerDialogProps) {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Add server form
  const [addName, setAddName] = useState("");
  const [addCommand, setAddCommand] = useState("");
  const [addArgs, setAddArgs] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMcpServers();
      setServers(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchServers();
      setAddName("");
      setAddCommand("");
      setAddArgs("");
    }
  }, [isOpen, fetchServers]);

  const handleAdd = useCallback(async () => {
    if (!addName.trim() || !addCommand.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const args = addArgs.trim()
        ? addArgs.split(",").map((a) => a.trim()).filter(Boolean)
        : [];
      await addMcpServer(addName.trim(), addCommand.trim(), args);
      setAddName("");
      setAddCommand("");
      setAddArgs("");
      await fetchServers();
    } catch (err) {
      setError(String(err));
    } finally {
      setAdding(false);
    }
  }, [addName, addCommand, addArgs, fetchServers]);

  const handleRemove = useCallback(async (name: string) => {
    setRemoving(name);
    setError(null);
    try {
      await removeMcpServer(name);
      await fetchServers();
    } catch (err) {
      setError(String(err));
    } finally {
      setRemoving(null);
    }
  }, [fetchServers]);

  const handleToggle = useCallback(async (name: string) => {
    setToggling(name);
    setError(null);
    try {
      await toggleMcpServer(name);
      await fetchServers();
    } catch (err) {
      setError(String(err));
    } finally {
      setToggling(null);
    }
  }, [fetchServers]);

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
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="MCP Server Manager"
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
            <rect x="2" y="2" width="20" height="8" rx="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
          <span className="flex-1 text-sm font-medium text-text">
            MCP Server Manager
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

        {/* Server list */}
        <div className="max-h-72 overflow-y-auto py-2">
          {loading && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              Loading servers...
            </div>
          )}

          {!loading && servers.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-text-muted">
              No MCP servers configured
            </div>
          )}

          {servers.map((server) => (
            <div
              key={server.name}
              className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-bg-tertiary/30"
            >
              {/* Enable/disable toggle */}
              <button
                onClick={() => handleToggle(server.name)}
                disabled={toggling === server.name}
                className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                  server.enabled ? "bg-success" : "bg-bg-tertiary"
                }`}
                aria-label={server.enabled ? "Disable server" : "Enable server"}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                    server.enabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>

              {/* Server info */}
              <div className="min-w-0 flex-1">
                <div className={`truncate font-medium ${server.enabled ? "text-text" : "text-text-muted"}`}>
                  {server.name}
                </div>
                <div className="truncate text-xs text-text-muted">
                  {server.command} {server.args.join(" ")}
                </div>
              </div>

              {/* Remove button */}
              <button
                onClick={() => handleRemove(server.name)}
                disabled={removing === server.name}
                className="flex-shrink-0 rounded-lg px-2.5 py-1 text-xs text-error transition-colors hover:bg-error/10 disabled:opacity-50"
              >
                {removing === server.name ? "Removing..." : "Remove"}
              </button>
            </div>
          ))}
        </div>

        {/* Add server section */}
        <div className="border-t border-white/5 px-5 py-4">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-text-muted">
            Add Server
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Name"
                className="w-1/3 rounded-lg border border-border/30 bg-bg px-3 py-2 text-sm text-text placeholder-text-muted/50 outline-none transition-colors focus:border-accent/50"
              />
              <input
                type="text"
                value={addCommand}
                onChange={(e) => setAddCommand(e.target.value)}
                placeholder="Command (e.g., npx)"
                className="flex-1 rounded-lg border border-border/30 bg-bg px-3 py-2 text-sm text-text placeholder-text-muted/50 outline-none transition-colors focus:border-accent/50"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={addArgs}
                onChange={(e) => setAddArgs(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Args (comma-separated)"
                className="flex-1 rounded-lg border border-border/30 bg-bg px-3 py-2 text-sm text-text placeholder-text-muted/50 outline-none transition-colors focus:border-accent/50"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !addName.trim() || !addCommand.trim()}
                className="flex-shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
