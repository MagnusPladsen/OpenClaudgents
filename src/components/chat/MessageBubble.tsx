import { ToolCallBlock } from "./ToolCallBlock";
import type { ChatMessage, ContentBlock } from "../../lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-user-bubble text-text"
            : "bg-assistant-bubble text-text"
        } ${message.isStreaming ? "border border-accent/30" : ""}`}
      >
        {/* Role label */}
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`text-xs font-medium ${
              isUser ? "text-accent" : "text-info"
            }`}
          >
            {isUser ? "You" : "Claude"}
          </span>
          {message.isStreaming && (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          )}
        </div>

        {/* Message content */}
        <div className="text-sm leading-relaxed">
          <MessageContent content={message.content} />
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.toolCalls.map((tool) => (
              <ToolCallBlock key={tool.id} toolCall={tool} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        {!message.isStreaming && (
          <div className="mt-2 text-xs text-text-muted">
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string | ContentBlock[] }) {
  if (typeof content === "string") {
    return <FormattedText text={content} />;
  }

  return (
    <>
      {content.map((block, i) => {
        if (block.type === "text" && block.text) {
          return <FormattedText key={i} text={block.text} />;
        }
        if (block.type === "tool_use") {
          return (
            <div key={i} className="my-2 rounded bg-tool-call-bg p-2 text-xs">
              <span className="text-warning">Tool: {block.name}</span>
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

function FormattedText({ text }: { text: string }) {
  // Simple markdown-like formatting for code blocks
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const code = part.slice(3, -3).replace(/^\w+\n/, ""); // strip language hint
          return (
            <pre
              key={i}
              className="my-2 overflow-x-auto rounded bg-code-bg p-3 text-xs"
            >
              <code>{code}</code>
            </pre>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-code-bg px-1.5 py-0.5 text-xs text-accent"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        // Preserve newlines in regular text
        return (
          <span key={i}>
            {part.split("\n").map((line, j, arr) => (
              <span key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
