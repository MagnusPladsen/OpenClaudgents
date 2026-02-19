import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCallBlock } from "./ToolCallBlock";
import type { ChatMessage, ContentBlock } from "../../lib/types";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

interface MessageBubbleProps {
  message: ChatMessage;
  searchQuery?: string;
}

export function MessageBubble({ message, searchQuery }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopyMessage = useCallback(() => {
    const text = extractTextContent(message.content);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard write can fail if webview lacks focus or permissions
    });
  }, [message.content]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

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
        className={`relative max-w-[75%] px-5 py-4 transition-all duration-200 ${bubbleShape} ${
          isSystem
            ? "bg-error/10 text-text"
            : isUser
              ? "bg-user-bubble text-text"
              : "border border-white/5 bg-assistant-bubble text-text"
        } ${message.isStreaming ? "border border-accent/30" : ""}`}
      >
        {/* Copy button — hover only */}
        {!message.isStreaming && !isSystem && (
          <button
            onClick={handleCopyMessage}
            className="absolute -top-3 right-2 rounded-md bg-bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-muted opacity-0 shadow-sm transition-all hover:text-text group-hover:opacity-100"
            title="Copy message"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        )}

        {/* Streaming pulse indicator */}
        {message.isStreaming && (
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse-soft rounded-full bg-accent" />
            <span className="text-[10px] font-medium text-accent">Streaming</span>
          </div>
        )}

        {/* Message content */}
        <div className="text-sm leading-relaxed">
          <MessageContent content={message.content} searchQuery={searchQuery} />
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

function MessageContent({ content, searchQuery }: { content: string | ContentBlock[]; searchQuery?: string }) {
  if (typeof content === "string") {
    return <MarkdownRenderer text={content} highlight={searchQuery} />;
  }

  return (
    <>
      {content.map((block, i) => {
        if (block.type === "text" && block.text) {
          return <MarkdownRenderer key={i} text={block.text} highlight={searchQuery} />;
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

function MarkdownRenderer({ text, highlight }: { text: string; highlight?: string }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback((code: string, index: number) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  }, []);

  const wrapHighlight = useCallback(
    (children: ReactNode): ReactNode => {
      if (!highlight) return children;
      if (typeof children === "string") {
        return <HighlightedText text={children} query={highlight} />;
      }
      if (Array.isArray(children)) {
        return children.map((child, i) =>
          typeof child === "string" ? (
            <HighlightedText key={i} text={child} query={highlight} />
          ) : (
            child
          ),
        );
      }
      return children;
    },
    [highlight],
  );

  // Track code block index for copy button state
  let codeBlockCounter = 0;

  const components: Components = {
    // Code blocks and inline code
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");

      // Check if this is a block-level code (has language class or is inside pre)
      const isBlock = Boolean(match) || (typeof children === "string" && children.includes("\n"));
      if (isBlock || match) {
        const lang = match?.[1] || "code";
        const blockIndex = codeBlockCounter++;
        return (
          <div className="group/code relative my-3 overflow-hidden rounded-xl border border-white/5">
            <div className="flex items-center justify-between border-b border-white/5 bg-code-bg px-3 py-1.5">
              <span className="font-mono text-[10px] font-medium text-text-muted">
                {lang}
              </span>
              <button
                onClick={() => handleCopy(codeString, blockIndex)}
                className="rounded px-1.5 py-0.5 text-[10px] text-text-muted opacity-0 transition-all hover:bg-bg-tertiary hover:text-text group-hover/code:opacity-100"
              >
                {copiedIndex === blockIndex ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto bg-code-bg p-3 font-mono text-xs leading-relaxed">
              <code className={className} {...props}>{children}</code>
            </pre>
          </div>
        );
      }

      // Inline code
      return (
        <code className="rounded bg-code-bg px-1.5 py-0.5 font-mono text-xs text-accent" {...props}>
          {children}
        </code>
      );
    },

    // Prevent wrapping code blocks in an extra <pre>
    pre({ children }) {
      return <>{children}</>;
    },

    // Headings
    h1({ children }) {
      return <h1 className="mb-3 mt-4 text-lg font-bold text-text first:mt-0">{wrapHighlight(children)}</h1>;
    },
    h2({ children }) {
      return <h2 className="mb-2 mt-3 text-base font-semibold text-text first:mt-0">{wrapHighlight(children)}</h2>;
    },
    h3({ children }) {
      return <h3 className="mb-2 mt-3 text-sm font-semibold text-text first:mt-0">{wrapHighlight(children)}</h3>;
    },
    h4({ children }) {
      return <h4 className="mb-1 mt-2 text-sm font-medium text-text first:mt-0">{wrapHighlight(children)}</h4>;
    },

    // Paragraphs
    p({ children }) {
      return <p className="mb-2 last:mb-0">{wrapHighlight(children)}</p>;
    },

    // Lists
    ul({ children }) {
      return <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>;
    },
    li({ children }) {
      return <li className="text-text">{wrapHighlight(children)}</li>;
    },

    // Links
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent"
        >
          {children}
        </a>
      );
    },

    // Blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="my-2 border-l-2 border-accent/40 pl-3 text-text-secondary">
          {wrapHighlight(children)}
        </blockquote>
      );
    },

    // Horizontal rules
    hr() {
      return <hr className="my-3 border-border" />;
    },

    // Tables
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-xs">{children}</table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-code-bg text-text-muted">{children}</thead>;
    },
    tbody({ children }) {
      return <tbody className="divide-y divide-white/5">{children}</tbody>;
    },
    tr({ children }) {
      return <tr className="border-b border-white/5 last:border-0">{children}</tr>;
    },
    th({ children }) {
      return <th className="px-3 py-1.5 text-left font-medium">{wrapHighlight(children)}</th>;
    },
    td({ children }) {
      return <td className="px-3 py-1.5">{wrapHighlight(children)}</td>;
    },

    // Strong & emphasis
    strong({ children }) {
      return <strong className="font-semibold text-text">{wrapHighlight(children)}</strong>;
    },
    em({ children }) {
      return <em className="italic text-text-secondary">{wrapHighlight(children)}</em>;
    },

    // Strikethrough (from remark-gfm)
    del({ children }) {
      return <del className="text-text-muted line-through">{wrapHighlight(children)}</del>;
    },

    // Images
    img({ src, alt }) {
      return (
        <img
          src={src}
          alt={alt || ""}
          className="my-2 max-w-full rounded-lg"
          loading="lazy"
        />
      );
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}

function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!)
    .join("\n\n");
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-warning/30 text-text">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
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
