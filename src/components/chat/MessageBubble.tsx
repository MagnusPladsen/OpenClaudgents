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

  // Asymmetric bubble shapes
  const bubbleShape = isSystem
    ? "rounded-xl border-l-3 border-error"
    : isUser
      ? "rounded-2xl rounded-br-md"
      : "rounded-2xl";

  return (
    <div
      className={`group flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Avatar dot — assistant only */}
      {!isUser && !isSystem && (
        <div className="mr-3 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-info/15 text-[11px] font-semibold text-info">
          C
        </div>
      )}

      <div
        className={`max-w-[75%] px-5 py-4 transition-all duration-200 ${bubbleShape} ${
          isSystem
            ? "bg-error/10 text-text"
            : isUser
              ? "bg-user-bubble text-text"
              : "border border-white/5 bg-assistant-bubble text-text"
        } ${message.isStreaming ? "border border-accent/30" : ""}`}
      >
        {/* Streaming pulse indicator */}
        {message.isStreaming && (
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse-soft rounded-full bg-accent" />
            <span className="text-[10px] font-medium text-accent">Streaming</span>
          </div>
        )}

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

      {/* Avatar dot — user only */}
      {isUser && (
        <div className="ml-3 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
          Y
        </div>
      )}
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
            <div key={i} className="my-2 rounded-lg bg-tool-call-bg p-2 font-mono text-xs">
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
          const firstNewline = part.indexOf("\n");
          const lang = firstNewline > 3 ? part.slice(3, firstNewline).trim() : "";
          const code = firstNewline > 0 ? part.slice(firstNewline + 1, -3) : part.slice(3, -3);
          return (
            <div key={i} className="group/code relative my-3 overflow-hidden rounded-xl border border-white/5">
              {/* Code header bar */}
              <div className="flex items-center justify-between border-b border-white/5 bg-code-bg px-3 py-1.5">
                <span className="font-mono text-[10px] font-medium text-text-muted">
                  {lang || "code"}
                </span>
                <button
                  onClick={() => handleCopy(code)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-text-muted opacity-0 transition-all hover:bg-bg-tertiary hover:text-text group-hover/code:opacity-100"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto bg-code-bg p-3 font-mono text-xs leading-relaxed">
                <code>{code}</code>
              </pre>
            </div>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-code-bg px-1.5 py-0.5 font-mono text-xs text-accent"
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
