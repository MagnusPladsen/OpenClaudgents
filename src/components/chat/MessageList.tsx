import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { StreamingIndicator } from "./StreamingIndicator";
import { useChatStore } from "../../stores/chatStore";
import type { ChatMessage } from "../../lib/types";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingText = useChatStore((s) => s.streamingText);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingText]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse-soft opacity-40">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-sm">Send a message to begin</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-8 py-8">
      {messages.map((msg, i) => (
        <div
          key={msg.uuid}
          className="animate-stagger-in"
          style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
        >
          <MessageBubble message={msg} />
        </div>
      ))}

      {isStreaming && streamingText && (
        <MessageBubble
          message={{
            uuid: "__streaming__",
            parentUuid: null,
            role: "assistant",
            content: streamingText,
            timestamp: new Date().toISOString(),
            isSidechain: false,
            isStreaming: true,
          }}
        />
      )}

      {isStreaming && !streamingText && <StreamingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}
