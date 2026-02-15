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
      className={`group relative flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-all duration-200 ${
        isActive
          ? "bg-accent/10 text-text shadow-sm shadow-accent/10"
          : "text-text-secondary hover:-translate-y-px hover:bg-bg-tertiary/50 hover:text-text hover:shadow-md hover:shadow-black/10"
      }`}
    >
      {/* Active accent bar — thicker */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent shadow-sm shadow-accent/30" />
      )}

      {/* Status dot with ring cutout effect */}
      <span className="relative flex-shrink-0">
        <span className={`block h-2.5 w-2.5 rounded-full ring-2 ring-bg-secondary ${statusColor}`} />
        {isLive && (
          <span className={`absolute inset-0 animate-ping rounded-full ${statusColor} opacity-40`} />
        )}
      </span>

      {/* Session name or fallback */}
      <span className="min-w-0 flex-1 truncate font-medium">
        {session.name || `Session ${session.id.slice(0, 8)}`}
      </span>

      {/* Model pill — visible on hover */}
      {session.model && (
        <span className="flex-shrink-0 rounded-full bg-bg-tertiary/60 px-1.5 py-0.5 text-[9px] font-medium text-text-muted opacity-0 transition-opacity group-hover:opacity-100">
          {abbreviateModel(session.model)}
        </span>
      )}

      {/* Time ago */}
      <span className="flex-shrink-0 text-xs text-text-muted opacity-60 transition-opacity group-hover:opacity-100">
        {formatTimeAgo(session.createdAt)}
      </span>
    </button>
  );
}

function abbreviateModel(model: string): string {
  if (model.includes("sonnet")) return "Son";
  if (model.includes("opus")) return "Opus";
  if (model.includes("haiku")) return "Hai";
  return model.slice(0, 3);
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
