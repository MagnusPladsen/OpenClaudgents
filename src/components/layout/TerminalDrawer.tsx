import { useChatStore } from "../../stores/chatStore";

interface TerminalDrawerProps {
  onClose: () => void;
}

export function TerminalDrawer({ onClose }: TerminalDrawerProps) {
  // For now, show raw stream events as a simple log
  // xterm.js integration will come later
  return (
    <div className="flex h-64 flex-col border-t border-border bg-code-bg">
      <div className="flex items-center justify-between border-b border-border px-4 py-1">
        <span className="text-xs font-medium text-text-secondary">
          Terminal
        </span>
        <button
          onClick={onClose}
          className="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-bg-tertiary hover:text-text"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-text-secondary">
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
          <span className="text-accent">[{msg.role}]</span>{" "}
          {typeof msg.content === "string"
            ? msg.content.slice(0, 200)
            : JSON.stringify(msg.content).slice(0, 200)}
        </div>
      ))}
      {streamingText && (
        <div className="text-success">
          <span className="text-accent">[streaming]</span>{" "}
          {streamingText.slice(-500)}
        </div>
      )}
    </div>
  );
}
