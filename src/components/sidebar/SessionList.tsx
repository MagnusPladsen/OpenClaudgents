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
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
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

  let itemIndex = 0;

  return (
    <div className="py-2">
      {Object.entries(grouped).map(([projectPath, projectSessions]) => (
        <div key={projectPath} className="mb-3">
          {/* Project group header — uppercase tracked with accent line */}
          <div className="flex items-center gap-2 px-4 py-1.5">
            <span className="h-px w-3 bg-accent/40" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
              {projectPath.split("/").pop() || projectPath}
            </span>
          </div>

          {/* Sessions in this project — staggered entrance */}
          {projectSessions.map((session) => {
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
                  onClick={() => onSelectSession(session.id)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
