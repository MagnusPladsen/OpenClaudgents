import { create } from "zustand";
import type { AgentTeam } from "../lib/types";

interface AgentTeamState {
  teams: AgentTeam[];
  activeTeamName: string | null;
  setTeams: (teams: AgentTeam[]) => void;
  setActiveTeam: (name: string | null) => void;
  getActiveTeam: () => AgentTeam | undefined;
}

export const useAgentTeamStore = create<AgentTeamState>((set, get) => ({
  teams: [],
  activeTeamName: null,

  setTeams: (teams) => set({ teams }),

  setActiveTeam: (name) => set({ activeTeamName: name }),

  getActiveTeam: () => {
    const { teams, activeTeamName } = get();
    return teams.find((t) => t.name === activeTeamName);
  },
}));
