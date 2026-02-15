import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useSessionStore } from "../../stores/sessionStore";
import { SessionItem } from "./SessionItem";
import { SortableSessionItem } from "./SortableSessionItem";
import { SessionContextMenu } from "./SessionContextMenu";
import type { Session } from "../../lib/types";
import type { DragEndEvent } from "@dnd-kit/core";

interface SessionListProps {
  onSelectSession: (sessionId: string) => void;
}

interface ContextMenuState {
  session: Session;
  position: { x: number; y: number };
}

export function SessionList({ onSelectSession }: SessionListProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const updateSession = useSessionStore((s) => s.updateSession);
  const archiveSession = useSessionStore((s) => s.archiveSession);
  const unarchiveSession = useSessionStore((s) => s.unarchiveSession);
  const sessionOrder = useSessionStore((s) => s.sessionOrder);
  const setSessionOrder = useSessionStore((s) => s.setSessionOrder);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, session: Session) => {
      e.preventDefault();
      setContextMenu({
        session,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [],
  );

  const handleRename = useCallback(
    (sessionId: string, newName: string) => {
      updateSession(sessionId, { name: newName });
    },
    [updateSession],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Find which group both items belong to
      const activeSession = sessions.find((s) => s.id === active.id);
      const overSession = sessions.find((s) => s.id === over.id);
      if (!activeSession || !overSession) return;
      if (activeSession.projectPath !== overSession.projectPath) return;

      // Get current group sessions in order
      const groupSessions = sortByOrder(
        sessions.filter(
          (s) =>
            !s.archived &&
            !s.pinned &&
            s.projectPath === activeSession.projectPath,
        ),
        sessionOrder,
      );

      const oldIndex = groupSessions.findIndex((s) => s.id === active.id);
      const newIndex = groupSessions.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(groupSessions, oldIndex, newIndex);
      const newOrder = reordered.map((s) => s.id);

      // Merge into existing order: replace this group's order, keep others
      const otherIds = sessionOrder.filter(
        (id) => !newOrder.includes(id),
      );
      setSessionOrder([...otherIds, ...newOrder]);
    },
    [sessions, sessionOrder, setSessionOrder],
  );

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-border/60 text-text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-xs text-text-muted">
          No sessions yet.
          <br />
          Create one to get started.
        </p>
      </div>
    );
  }

  // Split into active and archived
  const activeSessions = sessions.filter((s) => !s.archived);
  const archivedSessions = sessions.filter((s) => s.archived);

  // Separate pinned and unpinned from active sessions
  const pinned = activeSessions.filter((s) => s.pinned);
  const unpinned = activeSessions.filter((s) => !s.pinned);

  // Group unpinned sessions by project path
  const grouped = unpinned.reduce<Record<string, typeof sessions>>(
    (acc, session) => {
      const project = session.projectPath;
      if (!acc[project]) acc[project] = [];
      acc[project].push(session);
      return acc;
    },
    {},
  );

  // Sort each group by stored order
  for (const key of Object.keys(grouped)) {
    grouped[key] = sortByOrder(grouped[key], sessionOrder);
  }

  let itemIndex = 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="px-2 py-2">
        {/* Pinned section */}
        {pinned.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-warning">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
                Pinned
              </span>
            </div>
            {pinned.map((session) => {
              const idx = itemIndex++;
              return (
                <div
                  key={session.id}
                  className="animate-stagger-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <SessionItem
                    session={session}
                    isActive={session.id === activeSessionId}
                    isPinned
                    onTogglePin={() => useSessionStore.getState().unpinSession(session.id)}
                    onRename={(name) => handleRename(session.id, name)}
                    onContextMenu={(e) => handleContextMenu(e, session)}
                    onClick={() => onSelectSession(session.id)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Threads section */}
        {unpinned.length > 0 && pinned.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span className="h-px w-3 bg-border/40" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
              Threads
            </span>
          </div>
        )}

        {Object.entries(grouped).map(([projectPath, projectSessions]) => (
          <div key={projectPath} className="mb-4">
            {/* Project group header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="h-px w-3 bg-accent/40" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
                {projectPath.split("/").pop() || projectPath}
              </span>
            </div>

            {/* Sortable sessions in this project */}
            <SortableContext
              items={projectSessions.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {projectSessions.map((session) => {
                const idx = itemIndex++;
                return (
                  <div
                    key={session.id}
                    className="animate-stagger-in"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <SortableSessionItem
                      session={session}
                      isActive={session.id === activeSessionId}
                      onTogglePin={() => useSessionStore.getState().pinSession(session.id)}
                      onRename={(name) => handleRename(session.id, name)}
                      onContextMenu={(e) => handleContextMenu(e, session)}
                      onClick={() => onSelectSession(session.id)}
                    />
                  </div>
                );
              })}
            </SortableContext>
          </div>
        ))}

        {/* Archived section */}
        {archivedSessions.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-text-muted transition-transform duration-200 ${showArchived ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
                Archived ({archivedSessions.length})
              </span>
            </button>

            {showArchived && (
              <div className="animate-fade-in">
                {archivedSessions.map((session) => (
                  <div key={session.id} className="opacity-60">
                    <SessionItem
                      session={session}
                      isActive={session.id === activeSessionId}
                      onRename={(name) => handleRename(session.id, name)}
                      onContextMenu={(e) => handleContextMenu(e, session)}
                      onClick={() => onSelectSession(session.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <SessionContextMenu
            session={contextMenu.session}
            position={contextMenu.position}
            onClose={() => setContextMenu(null)}
            onRename={() => {
              const newName = window.prompt(
                "Rename session:",
                contextMenu.session.name || `Session ${contextMenu.session.id.slice(0, 8)}`,
              );
              if (newName?.trim()) {
                handleRename(contextMenu.session.id, newName.trim());
              }
            }}
            onTogglePin={() => {
              const store = useSessionStore.getState();
              if (contextMenu.session.pinned) {
                store.unpinSession(contextMenu.session.id);
              } else {
                store.pinSession(contextMenu.session.id);
              }
            }}
            onToggleArchive={() => {
              if (contextMenu.session.archived) {
                unarchiveSession(contextMenu.session.id);
              } else {
                archiveSession(contextMenu.session.id);
              }
            }}
          />
        )}
      </div>
    </DndContext>
  );
}

function sortByOrder(sessions: Session[], order: string[]): Session[] {
  if (order.length === 0) return sessions;

  const orderMap = new Map(order.map((id, i) => [id, i]));
  return [...sessions].sort((a, b) => {
    const aIdx = orderMap.get(a.id) ?? Infinity;
    const bIdx = orderMap.get(b.id) ?? Infinity;
    return aIdx - bIdx;
  });
}
