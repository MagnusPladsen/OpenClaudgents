import type { Session } from "../../lib/types";

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
}

export function SessionItem({ session, isActive, onClick }: SessionItemProps) {
  const statusColor =
    session.status === "active"
      ? "bg-success"
      : session.status === "waiting_input"
        ? "bg-warning"
        : session.status === "error"
          ? "bg-error"
          : "bg-text-muted";

  const isLive = session.status === "active";

  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-all duration-150 ${
        isActive
          ? "bg-bg-tertiary text-text"
          : "text-text-secondary hover:bg-bg-tertiary/50 hover:text-text"
      }`}
    >
      {/* Active accent bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
      )}

      {/* Status dot with pulse */}
      <span className="relative flex-shrink-0">
        <span className={`block h-2.5 w-2.5 rounded-full ${statusColor}`} />
        {isLive && (
          <span className={`absolute inset-0 animate-ping rounded-full ${statusColor} opacity-40`} />
        )}
      </span>

      {/* Session name or fallback */}
      <span className="min-w-0 flex-1 truncate">
        {session.name || `Session ${session.id.slice(0, 8)}`}
      </span>

      {/* Time ago */}
      <span className="flex-shrink-0 text-xs text-text-muted opacity-60 transition-opacity group-hover:opacity-100">
        {formatTimeAgo(session.createdAt)}
      </span>
    </button>
  );
}

function formatTimeAgo(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d`;
  } catch {
    return "";
  }
}
