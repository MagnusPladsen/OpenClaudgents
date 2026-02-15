import { create } from "zustand";
import type { Session } from "../lib/types";

const PINNED_STORAGE_KEY = "openclaudgents-pinned";
const ARCHIVED_STORAGE_KEY = "openclaudgents-archived";
const SESSION_ORDER_STORAGE_KEY = "openclaudgents-session-order";

function loadStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePinnedIds(sessions: Session[]) {
  const ids = sessions.filter((s) => s.pinned).map((s) => s.id);
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
}

function saveArchivedIds(sessions: Session[]) {
  const ids = sessions.filter((s) => s.archived).map((s) => s.id);
  localStorage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(ids));
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  sessionOrder: string[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  getActiveSession: () => Session | undefined;
  pinSession: (id: string) => void;
  unpinSession: (id: string) => void;
  setActivityState: (sessionId: string, state: Session["activityState"]) => void;
  archiveSession: (id: string) => void;
  unarchiveSession: (id: string) => void;
  setSessionOrder: (order: string[]) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  sessionOrder: loadStringArray(SESSION_ORDER_STORAGE_KEY),

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) => {
    // Apply persisted pin and archived state
    const pinnedIds = loadStringArray(PINNED_STORAGE_KEY);
    const archivedIds = loadStringArray(ARCHIVED_STORAGE_KEY);
    const withState = {
      ...session,
      pinned: pinnedIds.includes(session.id) ? true : session.pinned,
      archived: archivedIds.includes(session.id) ? true : session.archived,
    };
    set((state) => ({ sessions: [...state.sessions, withState] }));
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

  setActivityState: (sessionId, activityState) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, activityState } : s,
      ),
    }));
  },

  archiveSession: (id) => {
    set((state) => {
      const updated = state.sessions.map((s) =>
        s.id === id ? { ...s, archived: true } : s,
      );
      saveArchivedIds(updated);
      return { sessions: updated };
    });
  },

  unarchiveSession: (id) => {
    set((state) => {
      const updated = state.sessions.map((s) =>
        s.id === id ? { ...s, archived: false } : s,
      );
      saveArchivedIds(updated);
      return { sessions: updated };
    });
  },

  setSessionOrder: (order) => {
    localStorage.setItem(SESSION_ORDER_STORAGE_KEY, JSON.stringify(order));
    set({ sessionOrder: order });
  },
}));
