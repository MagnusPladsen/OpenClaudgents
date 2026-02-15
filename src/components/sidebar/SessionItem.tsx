import type { Session } from "../../lib/types";

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onClick: () => void;
}

export function SessionItem({ session, isActive, isPinned, onTogglePin, onClick }: SessionItemProps) {
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
      className={`group relative mx-1 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 ${
        isActive
          ? "bg-accent/10 text-text shadow-sm shadow-accent/10"
          : "text-text-secondary hover:bg-bg-tertiary/50 hover:text-text"
      }`}
    >
      {/* Active accent bar */}
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

      {/* Worktree badge */}
      {session.worktreePath && (
        <span className="flex-shrink-0 text-info" title={`Worktree: ${session.worktreePath}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" x2="6" y1="3" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
        </span>
      )}

      {/* Session name or fallback */}
      <span className="min-w-0 flex-1 truncate font-medium">
        {session.name || `Session ${session.id.slice(0, 8)}`}
      </span>

      {/* Pin icon */}
      {onTogglePin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={`flex-shrink-0 transition-all duration-200 ${
            isPinned
              ? "text-warning"
              : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
          }`}
          aria-label={isPinned ? "Unpin session" : "Pin session"}
          title={isPinned ? "Unpin" : "Pin"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
            fill={isPinned ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      )}

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
