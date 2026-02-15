import { create } from "zustand";
import type { Session } from "../lib/types";

const PINNED_STORAGE_KEY = "openclaudgents-pinned";

function loadPinnedIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePinnedIds(sessions: Session[]) {
  const ids = sessions.filter((s) => s.pinned).map((s) => s.id);
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  getActiveSession: () => Session | undefined;
  pinSession: (id: string) => void;
  unpinSession: (id: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) => {
    // Apply persisted pin state
    const pinnedIds = loadPinnedIds();
    const withPin = pinnedIds.includes(session.id)
      ? { ...session, pinned: true }
      : session;
    set((state) => ({ sessions: [...state.sessions, withPin] }));
  },

  updateSession: (id, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      ),
    })),

  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId:
        state.activeSessionId === id ? null : state.activeSessionId,
    })),

  setActiveSession: (id) => set({ activeSessionId: id }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId);
  },

  pinSession: (id) => {
    set((state) => {
      const updated = state.sessions.map((s) =>
        s.id === id ? { ...s, pinned: true } : s,
      );
      savePinnedIds(updated);
      return { sessions: updated };
    });
  },

  unpinSession: (id) => {
    set((state) => {
      const updated = state.sessions.map((s) =>
        s.id === id ? { ...s, pinned: false } : s,
      );
      savePinnedIds(updated);
      return { sessions: updated };
    });
  },
}));
