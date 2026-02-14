import { useState, useEffect } from "react";
import { getAgentTeams } from "../../lib/tauri";
import { useAgentTeamStore } from "../../stores/agentTeamStore";
import { AgentGraph } from "./AgentGraph";
import type { AgentTeam } from "../../lib/types";

export function TeamPanel() {
  const [teams, setTeamsLocal] = useState<AgentTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const setTeams = useAgentTeamStore((s) => s.setTeams);
  const activeTeamName = useAgentTeamStore((s) => s.activeTeamName);
  const setActiveTeam = useAgentTeamStore((s) => s.setActiveTeam);

  useEffect(() => {
    const load = () => {
      getAgentTeams()
        .then((t) => {
          setTeamsLocal(t);
          setTeams(t);
          // Auto-select first team if none selected
          if (!activeTeamName && t.length > 0) {
            setActiveTeam(t[0].name);
          }
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    };

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [setTeams, activeTeamName, setActiveTeam]);

  const activeTeam = teams.find((t) => t.name === activeTeamName) || null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        Loading teams...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Team selector */}
      {teams.length > 0 && (
        <div className="border-b border-border px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Team:</span>
            <select
              value={activeTeamName || ""}
              onChange={(e) => setActiveTeam(e.target.value || null)}
              className="rounded border border-border bg-bg-tertiary px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
            >
              {teams.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.members.length} members)
                </option>
              ))}
            </select>
          </div>

          {/* Member summary */}
          {activeTeam && (
            <div className="mt-2 flex flex-wrap gap-2">
              {activeTeam.members.map((m) => (
                <div
                  key={m.agentId || m.name}
                  className="flex items-center gap-1 rounded bg-bg-tertiary px-2 py-1"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      m.role === "lead" ? "bg-accent" : "bg-text-muted"
                    }`}
                  />
                  <span className="text-xs text-text">{m.name}</span>
                  <span className="text-xs text-text-muted">{m.agentType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Graph area */}
      <div className="min-h-[250px] flex-1">
        <AgentGraph team={activeTeam} />
      </div>
    </div>
  );
}
