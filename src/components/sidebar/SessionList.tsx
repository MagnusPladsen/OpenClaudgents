import { useSessionStore } from "../../stores/sessionStore";
import { SessionItem } from "./SessionItem";

interface SessionListProps {
  onSelectSession: (sessionId: string) => void;
}

export function SessionList({ onSelectSession }: SessionListProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  if (sessions.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-text-muted">
        No sessions yet. Create one to get started.
      </div>
    );
  }

  // Group sessions by project path
  const grouped = sessions.reduce<Record<string, typeof sessions>>(
    (acc, session) => {
      const project = session.projectPath;
      if (!acc[project]) acc[project] = [];
      acc[project].push(session);
      return acc;
    },
    {},
  );

  return (
    <div className="py-2">
      {Object.entries(grouped).map(([projectPath, projectSessions]) => (
        <div key={projectPath} className="mb-2">
          {/* Project group header */}
          <div className="px-4 py-1 text-xs font-medium text-text-muted">
            {projectPath.split("/").pop() || projectPath}
          </div>

          {/* Sessions in this project */}
          {projectSessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => onSelectSession(session.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
