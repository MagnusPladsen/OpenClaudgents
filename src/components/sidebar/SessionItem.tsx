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

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
        isActive
          ? "bg-bg-tertiary text-text"
          : "text-text-secondary hover:bg-bg-tertiary/50"
      }`}
    >
      {/* Status dot */}
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusColor}`} />

      {/* Session name or fallback */}
      <span className="min-w-0 flex-1 truncate">
        {session.name || `Session ${session.id.slice(0, 8)}`}
      </span>

      {/* Time ago */}
      <span className="flex-shrink-0 text-xs text-text-muted">
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
