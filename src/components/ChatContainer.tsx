"use client";

import { useEffect, useCallback, useState } from "react";
import { useChatStore } from "@/store/chatStore";
import {
  conversationEngine,
  buildSystemPrompt,
  buildContextWindow,
} from "@/lib/conversationEngine";
import { streamModelResponse, stopAllStreams, stopStream } from "@/lib/streamHandler";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./ModelSelector";
import { ActiveModels } from "./ActiveModels";
import { PromptModePanel } from "./PromptModePanel";
import { Message, Model } from "@/types/chat";

// Format messages as Markdown for export
function formatChatAsMarkdown(messages: Message[], activeModels: Model[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const modelNames = activeModels.map(m => m.name).join(', ');

  let md = `# AI Group Chat Export\n\n`;
  md += `*Exported: ${dateStr} at ${timeStr}*\n\n`;

  if (activeModels.length > 0) {
    md += `**Participants:** ${modelNames}\n\n`;
  }

  md += `---\n\n`;

  for (const msg of messages) {
    const speaker = msg.role === 'user' ? 'User' : (msg.modelName || 'Assistant');
    const timestamp = new Date(msg.timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    md += `### ${speaker}\n`;
    md += `*${timestamp}*\n\n`;
    md += `${msg.content}\n\n`;
    md += `---\n\n`;
  }

  return md.trim();
}

export function ChatContainer() {
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const completeMessage = useChatStore((state) => state.completeMessage);
  const setTyping = useChatStore((state) => state.setTyping);
  const activeModels = useChatStore((state) => state.activeModels);
  const typingModels = useChatStore((state) => state.typingModels);
  const contextWindowSize = useChatStore((state) => state.contextWindowSize);
  const clearChat = useChatStore((state) => state.clearChat);
  const messages = useChatStore((state) => state.messages);
  const promptModes = useChatStore((state) => state.promptModes);
  const modelConfigs = useChatStore((state) => state.modelConfigs);

  const isGenerating = typingModels.length > 0 || messages.some((m) => m.isStreaming);

  // Copy feedback state
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  // Copy chat as Markdown
  const handleCopyAsMarkdown = useCallback(async () => {
    if (messages.length === 0) return;

    const markdown = formatChatAsMarkdown(messages, activeModels);

    try {
      await navigator.clipboard.writeText(markdown);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  }, [messages, activeModels]);

  // Stop all generation
  const handleStop = useCallback(() => {
    stopAllStreams();
    conversationEngine.reset();
    // Clear all typing indicators
    typingModels.forEach((t) => setTyping(t.modelId, t.modelName, false));
    // Mark all streaming messages as complete
    messages.forEach((m) => {
      if (m.isStreaming) {
        completeMessage(m.id);
      }
    });
  }, [typingModels, messages, setTyping, completeMessage]);

  // Stop a single model's response
  const handleStopModel = useCallback((modelId: string, messageId: string) => {
    stopStream(modelId);
    conversationEngine.completeResponse(modelId);
    completeMessage(messageId);
    setTyping(modelId, '', false);
  }, [completeMessage, setTyping]);

  // Handle model response
  const triggerModelResponse = useCallback(
    async (modelId: string) => {
      const state = useChatStore.getState();
      const model = state.activeModels.find((m) => m.id === modelId);
      if (!model) {
        conversationEngine.completeResponse(modelId);
        return;
      }

      setTyping(modelId, model.name, true);

      // Build messages for API
      const systemPrompt = buildSystemPrompt(
        model,
        state.activeModels,
        state.messages,
        state.promptModes,
        state.modelConfigs
      );
      const contextMessages = buildContextWindow(
        state.messages,
        contextWindowSize,
        model
      );

      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...contextMessages,
      ];

      // Create streaming message
      const messageId = addMessage({
        role: "assistant",
        content: "",
        modelId: model.id,
        modelName: model.name,
        isStreaming: true,
      });

      setTyping(modelId, model.name, false);

      let content = "";
      await streamModelResponse(modelId, apiMessages, {
        onToken: (token) => {
          content += token;
          updateMessage(messageId, content);
        },
        onComplete: () => {
          completeMessage(messageId);
          conversationEngine.completeResponse(modelId);
          console.log('Engine state after response:', conversationEngine.getDebugState());

          // After response, check if other models should respond
          const latestState = useChatStore.getState();
          const latestMessage = latestState.messages.find(
            (m) => m.id === messageId
          );
          if (latestMessage) {
            processModelResponses(latestMessage);
          }
        },
        onError: (error) => {
          console.error("Stream error:", error);
          updateMessage(messageId, content || "[Error: Failed to get response]");
          completeMessage(messageId);
          conversationEngine.completeResponse(modelId);
        },
      });
    },
    [addMessage, updateMessage, completeMessage, setTyping, contextWindowSize]
  );

  // Set up conversation engine handler
  useEffect(() => {
    conversationEngine.setResponseHandler(triggerModelResponse);
  }, [triggerModelResponse]);

  // Process which models should respond
  const processModelResponses = useCallback(
    (latestMessage: Message) => {
      const state = useChatStore.getState();

      // Reset responder tracking for this new trigger message
      // This allows models to respond to AI messages, not just user messages
      conversationEngine.resetRespondersForNewMessage();

      for (const model of state.activeModels) {
        const decision = conversationEngine.analyzeForResponse(
          model,
          state.messages,
          latestMessage,
          state.activeModels
        );

        if (decision.shouldRespond) {
          conversationEngine.queueResponse(model.id, decision.delay, decision.priority);
        }
      }
    },
    []
  );

  // Handle user message
  const handleSendMessage = useCallback(
    (content: string) => {
      if (activeModels.length === 0) {
        return;
      }

      conversationEngine.onUserMessage();

      const messageId = addMessage({
        role: "user",
        content,
      });

      // Get the message we just added
      setTimeout(() => {
        const state = useChatStore.getState();
        const userMessage = state.messages.find((m) => m.id === messageId);
        if (userMessage) {
          processModelResponses(userMessage);
        }
      }, 0);
    },
    [addMessage, activeModels, processModelResponses]
  );

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-72 bg-surface border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-primary">AI Group Chat</h1>
        </div>

        <div className="p-4 border-b border-border">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            In This Chat
          </h2>
          <ActiveModels />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <ModelSelector />
          <PromptModePanel />
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={handleCopyAsMarkdown}
            disabled={messages.length === 0}
            className={`w-full px-4 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${
              messages.length === 0
                ? 'text-muted/50 cursor-not-allowed'
                : copyStatus === 'copied'
                ? 'text-green-500 bg-green-500/10'
                : copyStatus === 'error'
                ? 'text-red-500 bg-red-500/10'
                : 'text-muted hover:text-foreground hover:bg-surface-light'
            }`}
          >
            {copyStatus === 'copied' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : copyStatus === 'error' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Error
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy as Markdown
              </>
            )}
          </button>
          <button
            onClick={() => {
              clearChat();
              conversationEngine.reset();
            }}
            className="w-full px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-surface-light rounded-lg transition-colors"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        <MessageList onStopModel={handleStopModel} />
        <ChatInput
          onSend={handleSendMessage}
          onStop={handleStop}
          disabled={activeModels.length === 0}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
