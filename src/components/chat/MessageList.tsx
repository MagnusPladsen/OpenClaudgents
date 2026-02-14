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
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        Send a message to start the conversation
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.uuid} message={msg} />
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
