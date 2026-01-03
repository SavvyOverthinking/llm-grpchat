"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useChatStore } from "@/store/chatStore";
import { useMemoryStore } from "@/store/memoryStore";
import {
  conversationEngine,
  buildSystemPrompt,
  buildContextWindow,
} from "@/lib/conversationEngine";
import { streamModelResponse, stopAllStreams, stopStream, cleanIdentityConfusion } from "@/lib/streamHandler";
import {
  buildResponseWaves,
  initializeWaveState,
  advanceToNextWave,
  updateWaveStateAfterResponse,
  isPassResponse,
  extractWaveContext,
} from "@/lib/waveThrottle";
import { detectSpeakerCommand } from "@/lib/speakerPrompt";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./ModelSelector";
import { ActiveModels } from "./ActiveModels";
import { PromptModePanel } from "./PromptModePanel";
import { SessionManager } from "./SessionManager";
import { SettingsPanel } from "./SettingsPanel";
import { MemoryPanel } from "./MemoryPanel";
import { SpeakerControls } from "./SpeakerControls";
import { WaveIndicator } from "./WaveIndicator";
import { Message, Model } from "@/types/chat";
import { WaveContext, INITIAL_WAVE_STATE } from "@/types/throttle";

// Format messages as Markdown for export with colored borders
function formatChatAsMarkdown(messages: Message[], activeModels: Model[], availableModels: Model[]): string {
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

  const allModels = [...activeModels, ...availableModels];
  const modelNames = activeModels.map(m => m.name).join(', ');

  // User message color (matches the primary/blue color in UI)
  const userColor = '#3b82f6';

  let md = `# AI Group Chat Export\n\n`;
  md += `*Exported: ${dateStr} at ${timeStr}*\n\n`;

  if (activeModels.length > 0) {
    md += `**Participants:** ${modelNames}\n\n`;
  }

  md += `---\n\n`;

  for (const msg of messages) {
    const isUser = msg.role === 'user';
    const speaker = isUser ? 'User' : (msg.modelName || 'Assistant');
    const timestamp = new Date(msg.timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    // Get color for this message
    let color = userColor;
    if (!isUser && msg.modelId) {
      const model = allModels.find(m => m.id === msg.modelId);
      if (model) {
        color = model.color;
      }
    }

    // Use HTML for colored left border (works in GitHub, VS Code, Obsidian, etc.)
    md += `<div style="border-left: 4px solid ${color}; padding-left: 16px; margin: 16px 0;">\n\n`;
    md += `**<span style="color: ${color}">${speaker}</span>** · *${timestamp}*\n\n`;
    md += `${msg.content}\n\n`;
    md += `</div>\n\n`;
  }

  return md.trim();
}

export function ChatContainer() {
  // === Existing state from chatStore ===
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const completeMessage = useChatStore((state) => state.completeMessage);
  const setTyping = useChatStore((state) => state.setTyping);
  const activeModels = useChatStore((state) => state.activeModels);
  const availableModels = useChatStore((state) => state.availableModels);
  const typingModels = useChatStore((state) => state.typingModels);
  const contextWindowSize = useChatStore((state) => state.contextWindowSize);
  const clearChat = useChatStore((state) => state.clearChat);
  const messages = useChatStore((state) => state.messages);
  const promptModes = useChatStore((state) => state.promptModes);
  const modelConfigs = useChatStore((state) => state.modelConfigs);

  // === NEW 2.0 state from chatStore ===
  const settingPrompt = useChatStore((state) => state.settingPrompt);
  const throttleSettings = useChatStore((state) => state.throttleSettings);
  const waveState = useChatStore((state) => state.waveState);
  const updateWaveState = useChatStore((state) => state.updateWaveState);
  const resetWaveState = useChatStore((state) => state.resetWaveState);
  const speakerState = useChatStore((state) => state.speakerState);
  const setSpeaker = useChatStore((state) => state.setSpeaker);
  const triggerSpeakerCommand = useChatStore((state) => state.triggerSpeakerCommand);
  const clearSpeakerMode = useChatStore((state) => state.clearSpeakerMode);

  // === Memory store access ===
  const getActiveMemories = useMemoryStore((state) => state.getActiveMemories);
  const addMemory = useMemoryStore((state) => state.addMemory);
  const extractionEnabled = useMemoryStore((state) => state.extractionEnabled);
  const extractionFrequency = useMemoryStore((state) => state.extractionFrequency);
  const extractionModel = useMemoryStore((state) => state.extractionModel);

  // === Local state ===
  const isGenerating = typingModels.length > 0 || messages.some((m) => m.isStreaming);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const userMessageCountRef = useRef(0);
  const waveContextRef = useRef<WaveContext[]>([]);

  // Copy chat as Markdown
  const handleCopyAsMarkdown = useCallback(async () => {
    if (messages.length === 0) return;

    const markdown = formatChatAsMarkdown(messages, activeModels, availableModels);

    try {
      await navigator.clipboard.writeText(markdown);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  }, [messages, activeModels, availableModels]);

  // Stop all generation
  const handleStop = useCallback(() => {
    stopAllStreams();
    conversationEngine.abort(); // Use abort to stop all pending + queued responses
    // Clear all typing indicators
    typingModels.forEach((t) => setTyping(t.modelId, t.modelName, false));
    // Mark all streaming messages as complete
    messages.forEach((m) => {
      if (m.isStreaming) {
        completeMessage(m.id);
      }
    });
    // Resume after a short delay so new messages can trigger responses
    setTimeout(() => {
      conversationEngine.resume();
    }, 100);
  }, [typingModels, messages, setTyping, completeMessage]);

  // Stop a single model's response
  const handleStopModel = useCallback((modelId: string, messageId: string) => {
    stopStream(modelId);
    conversationEngine.completeResponse(modelId);
    completeMessage(messageId);
    setTyping(modelId, '', false);
  }, [completeMessage, setTyping]);

  // Memory extraction integration
  const triggerMemoryExtraction = useCallback(async () => {
    const memoryState = useMemoryStore.getState();
    if (!memoryState.extractionEnabled) return;

    const state = useChatStore.getState();
    const recentMessages = state.messages.slice(-20);

    if (recentMessages.length < 4) return; // Need at least a few exchanges

    try {
      const response = await fetch('/api/extract-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: recentMessages,
          model: memoryState.extractionModel,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        for (const mem of result.memories || []) {
          addMemory({
            ...mem,
            sourceMessageIds: recentMessages.map(m => m.id),
            extractionTurn: Math.floor(state.messages.length / 2),
          });
        }
      }
    } catch (error) {
      console.error('Memory extraction failed:', error);
    }
  }, [addMemory]);

  // Handle model response with 2.0 features
  const triggerModelResponse = useCallback(
    async (modelId: string) => {
      const state = useChatStore.getState();
      const memoryState = useMemoryStore.getState();
      const model = state.activeModels.find((m) => m.id === modelId);
      if (!model) {
        conversationEngine.completeResponse(modelId);
        return;
      }

      setTyping(modelId, model.name, true);

      // Build messages for API (using the new 2.0 approach - API handles system prompt)
      const contextMessages = buildContextWindow(
        state.messages,
        contextWindowSize,
        model
      );

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

      // Determine if this model is the speaker
      const isSpeaker = state.speakerState.speakerId === modelId;
      const speakerMode = isSpeaker ? state.speakerState.speakerMode : null;

      // Get memories for context
      const memories = memoryState.getActiveMemories();

      // Get other model names for identity confusion cleaning
      const otherModelNames = state.activeModels
        .filter(m => m.id !== modelId)
        .flatMap(m => [m.name, m.shortName]);

      await streamModelResponse(
        model,  // Pass full model object for 2.0 API
        contextMessages,
        {
          onToken: (token) => {
            content += token;
            // Clean identity confusion patterns from the response
            const cleanedContent = cleanIdentityConfusion(content, model.name, otherModelNames);
            updateMessage(messageId, cleanedContent);
          },
          onComplete: () => {
            completeMessage(messageId);
            conversationEngine.completeResponse(modelId);

            // Update wave state if wave throttling is active
            if (state.throttleSettings.enabled && state.waveState.currentWave > 0) {
              const updatedWaveState = updateWaveStateAfterResponse(
                state.waveState,
                modelId,
                content,
                model
              );
              updateWaveState(updatedWaveState);

              // Add to wave context for later waves
              if (!isPassResponse(content)) {
                waveContextRef.current = [
                  ...waveContextRef.current,
                  extractWaveContext(content, model),
                ];
              }
            }

            // Clear speaker mode after speaker responds
            if (isSpeaker && speakerMode) {
              clearSpeakerMode();
            }

            // After response, check if other models should respond
            // BUT NOT if this was a speaker response - speaker responses are solo
            if (!isSpeaker) {
              const latestState = useChatStore.getState();
              const latestMessage = latestState.messages.find(
                (m) => m.id === messageId
              );
              if (latestMessage) {
                processModelResponses(latestMessage);
              }
            }
          },
          onError: (error) => {
            console.error("Stream error:", error);
            updateMessage(messageId, content || "[Error: Failed to get response]");
            completeMessage(messageId);
            conversationEngine.completeResponse(modelId);
          },
        },
        {
          // 2.0 options
          settingPrompt: state.settingPrompt,
          memories: memories,
          waveContext: waveContextRef.current,
          speakerMode: speakerMode,
          activeModels: state.activeModels,
          contextWindowSize: contextWindowSize,
          promptModes: state.promptModes,
          modelConfigs: state.modelConfigs,
        }
      );
    },
    [addMessage, updateMessage, completeMessage, setTyping, contextWindowSize, updateWaveState, clearSpeakerMode]
  );

  // Set up conversation engine handler
  useEffect(() => {
    conversationEngine.setResponseHandler(triggerModelResponse);
  }, [triggerModelResponse]);

  // Sync maxTotalTurns from throttleSettings to conversation engine
  useEffect(() => {
    conversationEngine.setMaxTotalTurns(throttleSettings.maxTotalTurns ?? 20);
  }, [throttleSettings.maxTotalTurns]);

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

      // Check for speaker command via @mention
      const speakerCmd = detectSpeakerCommand(content, speakerState.speakerId, activeModels);

      const messageId = addMessage({
        role: "user",
        content,
      });

      // If speaker command detected, ONLY trigger the speaker model
      if (speakerCmd) {
        setSpeaker(speakerCmd.mentionedModel.id);
        triggerSpeakerCommand(speakerCmd.command);

        // Directly trigger ONLY the speaker model after a short delay
        setTimeout(() => {
          triggerModelResponse(speakerCmd.mentionedModel.id);
        }, 500);

        return; // Don't process other models
      }

      // Regular flow for non-speaker messages
      // Track user message count for memory extraction
      userMessageCountRef.current += 1;

      // Trigger memory extraction if enabled and at frequency
      if (extractionEnabled && userMessageCountRef.current % extractionFrequency === 0) {
        triggerMemoryExtraction();
      }

      // Get the message we just added
      setTimeout(() => {
        const state = useChatStore.getState();
        const userMessage = state.messages.find((m) => m.id === messageId);
        if (userMessage) {
          processModelResponses(userMessage);
        }
      }, 0);
    },
    [addMessage, activeModels, processModelResponses, speakerState.speakerId, setSpeaker, triggerSpeakerCommand, extractionEnabled, extractionFrequency, triggerMemoryExtraction, triggerModelResponse]
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
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        {/* Control Bar */}
        <div className="flex items-center gap-2 p-2 border-b border-border bg-surface">
          <SessionManager />
          <SettingsPanel />
          <MemoryPanel />
          <SpeakerControls onTriggerMessage={handleSendMessage} />
        </div>

        <MessageList onStopModel={handleStopModel} />
        <WaveIndicator />
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
