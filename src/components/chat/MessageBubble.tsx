import { useState } from "react";
import { ToolCallBlock } from "./ToolCallBlock";
import type { ChatMessage, ContentBlock } from "../../lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const [copied, setCopied] = useState(false);

  return (
    <div
      className={`group flex animate-slide-up ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 transition-all duration-200 hover:shadow-md ${
          isSystem
            ? "border border-error/30 bg-error/10 text-text"
            : isUser
              ? "bg-user-bubble text-text"
              : "border border-white/5 bg-assistant-bubble text-text"
        } ${message.isStreaming ? "border border-accent/30" : ""}`}
      >
        {/* Role label */}
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`text-xs font-medium ${
              isSystem ? "text-error" : isUser ? "text-accent" : "text-info"
            }`}
          >
            {isSystem ? "Error" : isUser ? "You" : "Claude"}
          </span>
          {message.isStreaming && (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          )}
        </div>

        {/* Message content */}
        <div className="text-sm leading-relaxed">
          <MessageContent content={message.content} copied={copied} onCopy={setCopied} />
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.toolCalls.map((tool) => (
              <ToolCallBlock key={tool.id} toolCall={tool} />
            ))}
          </div>
        )}

        {/* Timestamp — hidden by default, visible on hover */}
        {!message.isStreaming && (
          <div className="mt-2 text-xs text-text-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({
  content,
  copied,
  onCopy,
}: {
  content: string | ContentBlock[];
  copied: boolean;
  onCopy: (v: boolean) => void;
}) {
  if (typeof content === "string") {
    return <FormattedText text={content} copied={copied} onCopy={onCopy} />;
  }

  return (
    <>
      {content.map((block, i) => {
        if (block.type === "text" && block.text) {
          return <FormattedText key={i} text={block.text} copied={copied} onCopy={onCopy} />;
        }
        if (block.type === "tool_use") {
          return (
            <div key={i} className="my-2 rounded-lg bg-tool-call-bg p-2 text-xs">
              <span className="text-warning">Tool: {block.name}</span>
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

function FormattedText({
  text,
  copied,
  onCopy,
}: {
  text: string;
  copied: boolean;
  onCopy: (v: boolean) => void;
}) {
  // Simple markdown-like formatting for code blocks
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      onCopy(true);
      setTimeout(() => onCopy(false), 2000);
    });
  };

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const code = part.slice(3, -3).replace(/^\w+\n/, ""); // strip language hint
          return (
            <div key={i} className="group/code relative my-2">
              <pre className="overflow-x-auto rounded-lg border-l-2 border-accent bg-code-bg p-3 text-xs">
                <code>{code}</code>
              </pre>
              <button
                onClick={() => handleCopy(code)}
                className="absolute right-2 top-2 rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-muted opacity-0 transition-opacity group-hover/code:opacity-100"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
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
