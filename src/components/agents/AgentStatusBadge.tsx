interface AgentStatusBadgeProps {
  status: "working" | "idle" | "waiting" | "error" | "shutdown";
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  working: { color: "bg-success", label: "Working" },
  idle: { color: "bg-text-muted", label: "Idle" },
  waiting: { color: "bg-warning", label: "Waiting" },
  error: { color: "bg-error", label: "Error" },
  shutdown: { color: "bg-text-muted", label: "Shutdown" },
};

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${config.color} ${
          status === "working" ? "animate-pulse" : ""
        }`}
      />
      <span className="text-xs text-text-muted">{config.label}</span>
    </div>
  );
}
