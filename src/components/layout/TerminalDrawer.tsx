import { useChatStore } from "../../stores/chatStore";

interface TerminalDrawerProps {
  onClose: () => void;
}

export function TerminalDrawer({ onClose }: TerminalDrawerProps) {
  // For now, show raw stream events as a simple log
  // xterm.js integration will come later
  return (
    <div className="flex h-64 flex-col bg-code-bg shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.3)]">
      {/* Header with grab handle */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Grab handle bar */}
          <div className="h-1 w-8 rounded-full bg-border/60" />
          <span className="font-mono text-xs font-medium text-text-secondary">
            Terminal
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-all hover:bg-bg-tertiary hover:text-text"
          aria-label="Close terminal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed text-text-secondary">
        <RawStreamLog />
      </div>
    </div>
  );
}

function RawStreamLog() {
  const messages = useChatStore((s) => s.messages);
  const streamingText = useChatStore((s) => s.streamingText);

  if (messages.length === 0 && !streamingText) {
    return (
      <span className="text-text-muted">
        Raw Claude CLI output will appear here...
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {messages.map((msg) => (
        <div key={msg.uuid} className="text-text-muted">
          <span className={`mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            msg.role === "user"
              ? "bg-accent/15 text-accent"
              : msg.role === "assistant"
                ? "bg-info/15 text-info"
                : "bg-error/15 text-error"
          }`}>
            {msg.role}
          </span>
          {typeof msg.content === "string"
            ? msg.content.slice(0, 200)
            : JSON.stringify(msg.content).slice(0, 200)}
        </div>
      ))}
      {streamingText && (
        <div className="text-success/90">
          <span className="mr-1.5 inline-block rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
            streaming
          </span>
          {streamingText.slice(-500)}
        </div>
      )}
    </div>
  );
}
