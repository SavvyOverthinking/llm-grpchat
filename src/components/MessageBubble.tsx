"use client";

import { Message, Model } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
import { useMemo } from "react";

interface Props {
  message: Message;
  onStopModel?: (modelId: string, messageId: string) => void;
}

export function MessageBubble({ message, onStopModel }: Props) {
  const activeModels = useChatStore((state) => state.activeModels);
  const availableModels = useChatStore((state) => state.availableModels);
  const isUser = message.role === "user";
  const model = [...activeModels, ...availableModels].find(
    (m) => m.id === message.modelId
  );

  // Parse and highlight @mentions
  const formattedContent = useMemo(() => {
    const allModels = [...activeModels, ...availableModels];
    const parts: (string | { text: string; color: string })[] = [];
    let remaining = message.content;

    const mentionRegex = /@(\w+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(message.content)) !== null) {
      const currentMatch = match;
      // Add text before the mention
      if (currentMatch.index > lastIndex) {
        parts.push(message.content.slice(lastIndex, currentMatch.index));
      }

      // Check if this mention corresponds to a model
      const mentionedModel = allModels.find(
        (m) => m.shortName.toLowerCase() === currentMatch[1].toLowerCase()
      );

      if (mentionedModel) {
        parts.push({ text: currentMatch[0], color: mentionedModel.color });
      } else if (currentMatch[1].toLowerCase() === "user") {
        parts.push({ text: currentMatch[0], color: "#dc2626" });
      } else {
        parts.push(currentMatch[0]);
      }

      lastIndex = currentMatch.index + currentMatch[0].length;
    }

    // Add remaining text
    if (lastIndex < message.content.length) {
      parts.push(message.content.slice(lastIndex));
    }

    return parts;
  }, [message.content, activeModels, availableModels]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
          isUser
            ? "bg-primary text-white"
            : "bg-surface border-l-4"
        }`}
        style={!isUser ? { borderLeftColor: model?.color || "#666" } : {}}
      >
        {!isUser && (
          <div
            className="text-xs font-semibold mb-1"
            style={{ color: model?.color || "#666" }}
          >
            {message.modelName}
          </div>
        )}
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {formattedContent.map((part, i) =>
            typeof part === "string" ? (
              <span key={i}>{part}</span>
            ) : (
              <span key={i} style={{ color: part.color }} className="font-semibold">
                {part.text}
              </span>
            )
          )}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-foreground/70 animate-blink ml-0.5" />
          )}
        </div>
        {message.isStreaming && message.modelId && onStopModel && (
          <button
            onClick={() => onStopModel(message.modelId!, message.id)}
            className="mt-2 flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="Stop this response"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
