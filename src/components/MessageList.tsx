"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "@/store/chatStore";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface Props {
  onStopModel?: (modelId: string, messageId: string) => void;
}

export function MessageList({ onStopModel }: Props) {
  const messages = useChatStore((state) => state.messages);
  const typingModels = useChatStore((state) => state.typingModels);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const lastMessageCountRef = useRef(messages.length);

  // Check if scrolled to bottom (within 100px threshold)
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const threshold = 100;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom < threshold;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);

    // Clear new messages indicator when user scrolls to bottom
    if (atBottom) {
      setHasNewMessages(false);
    }
  }, [checkIfAtBottom]);

  // Auto-scroll only when at bottom
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (messages.length > lastMessageCountRef.current) {
      // New message arrived while scrolled up
      setHasNewMessages(true);
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, typingModels, isAtBottom]);

  // Scroll to bottom when clicking the indicator
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
    setHasNewMessages(false);
  }, []);

  // Count new messages for the indicator
  const streamingCount = messages.filter(m => m.isStreaming).length;
  const typingCount = typingModels.length;

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted text-center">
            <div>
              <p className="text-lg mb-2">Welcome to AI Group Chat</p>
              <p className="text-sm">
                Select models from the sidebar and start chatting!
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onStopModel={onStopModel} />
            ))}
          </>
        )}
        <TypingIndicator />
        <div ref={bottomRef} />
      </div>

      {/* New messages indicator - shows when scrolled up */}
      {(hasNewMessages || (!isAtBottom && (streamingCount > 0 || typingCount > 0))) && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2 text-sm font-medium animate-bounce-subtle"
        >
          <span>
            {typingCount > 0
              ? `${typingCount} model${typingCount > 1 ? 's' : ''} typing...`
              : streamingCount > 0
              ? `${streamingCount} response${streamingCount > 1 ? 's' : ''} streaming...`
              : 'New messages'}
          </span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}
