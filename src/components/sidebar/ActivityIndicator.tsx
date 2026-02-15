import type { Session } from "../../lib/types";

interface ActivityIndicatorProps {
  activityState: Session["activityState"];
}

export function ActivityIndicator({ activityState }: ActivityIndicatorProps) {
  if (activityState === "idle") {
    return null;
  }

  if (activityState === "awaiting_input") {
    return (
      <span className="flex-shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold text-warning">
        Needs input
      </span>
    );
  }

  // thinking, streaming, tool_running — all show the same shimmer bar
  return (
    <span className="animate-shimmer-slide block h-1 w-8 flex-shrink-0 rounded-full" />
  );
}
