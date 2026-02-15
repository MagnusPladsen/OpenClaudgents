export function StreamingIndicator() {
  return (
    <div className="flex animate-fade-in justify-start">
      <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-assistant-bubble px-4 py-3">
        {/* Avatar dot */}
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-info/15 text-[11px] font-semibold text-info">
          C
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="animate-shimmer text-xs font-medium text-text-muted">
            Claude is thinking...
          </span>
          {/* Animated gradient bar */}
          <div className="h-1 w-32 overflow-hidden rounded-full bg-bg-tertiary">
            <div className="animate-gradient-sweep h-full rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
