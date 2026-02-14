interface TokenCounterProps {
  label: string;
  count: number;
  highlight?: boolean;
}

export function TokenCounter({ label, count, highlight = false }: TokenCounterProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-text-muted">{label}:</span>
      <span className={highlight ? "font-medium text-text" : "text-text-muted"}>
        {formatTokenCount(count)}
      </span>
    </div>
  );
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
