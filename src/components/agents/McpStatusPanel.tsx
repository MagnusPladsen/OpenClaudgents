import { useState, useEffect, useCallback } from "react";
import { getMcpServers } from "../../lib/tauri";
import type { McpServerInfo } from "../../lib/types";

export function McpStatusPanel() {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    getMcpServers()
      .then((s) => {
        setServers(s);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (isLoading) {
    return (
      <div className="p-4 text-xs text-text-muted">Loading MCP servers...</div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="p-4 text-xs text-text-muted">
        <p>No MCP servers configured.</p>
        <p className="mt-1">
          Configure servers in ~/.claude/settings.json under "mcpServers".
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text">MCP Servers</h3>
        <button
          onClick={refresh}
          className="rounded px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text"
        >
          Refresh
        </button>
      </div>
      <ul className="space-y-2">
        {servers.map((server) => (
          <li
            key={server.name}
            className="rounded border border-border bg-bg-tertiary p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    server.enabled ? "bg-success" : "bg-text-muted"
                  }`}
                />
                <span className="text-xs font-medium text-text">
                  {server.name}
                </span>
              </div>
              <span
                className={`text-xs ${
                  server.enabled ? "text-success" : "text-text-muted"
                }`}
              >
                {server.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="mt-1 font-mono text-xs text-text-muted">
              {server.command} {server.args.join(" ")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
