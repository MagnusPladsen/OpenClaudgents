export function StreamingIndicator() {
  return (
    <div className="flex animate-fade-in justify-start">
      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-assistant-bubble px-4 py-3">
        <span className="text-xs font-medium text-info">Claude</span>
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-wave rounded-full bg-accent [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-wave rounded-full bg-accent [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-wave rounded-full bg-accent [animation-delay:300ms]" />
        </div>
        <span className="animate-shimmer text-xs text-text-muted">
          thinking...
        </span>
      </div>
    </div>
  );
}
