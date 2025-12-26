import { Model, Message } from "@/types/chat";

interface ResponseDecision {
  shouldRespond: boolean;
  delay: number;
  priority: number;
}

export class ConversationEngine {
  private cooldowns: Map<string, number> = new Map();
  private responseQueue: Array<{ modelId: string; priority: number }> = [];
  private pendingModels: Set<string> = new Set(); // Track models waiting to respond
  private maxConcurrent = 1;
  private currentlyResponding = 0;
  private onTriggerResponse?: (modelId: string) => void;
  private consecutiveAIResponses: number = 0;
  private respondersThisMessage: Set<string> = new Set();
  private maxRespondersPerMessage: number = 2;
  private maxConsecutiveAI: number = 3;

  setResponseHandler(handler: (modelId: string) => void) {
    this.onTriggerResponse = handler;
  }

  analyzeForResponse(
    model: Model,
    messages: Message[],
    latestMessage: Message,
    activeModels: Model[]
  ): ResponseDecision {
    // Don't respond to own messages
    if (latestMessage.modelId === model.id) {
      return { shouldRespond: false, delay: 0, priority: 0 };
    }

    let priority = 0;
    let shouldRespond = false;

    // Highest priority: @mentioned - BYPASSES COOLDOWN
    const mentionPattern = new RegExp(`@${model.shortName.toLowerCase()}\\b`, "i");
    const isMentioned = mentionPattern.test(latestMessage.content);

    if (isMentioned) {
      shouldRespond = true;
      priority = 100;
    }

    // Don't respond if we already responded to this exact message
    const lastUserOrMentionMsg = messages.filter(m =>
      m.role === "user" ||
      (m.content && new RegExp(`@${model.shortName}\\b`, "i").test(m.content))
    ).pop();

    if (lastUserOrMentionMsg) {
      const myResponseAfter = messages.some(m =>
        m.modelId === model.id &&
        m.timestamp > lastUserOrMentionMsg.timestamp
      );
      if (myResponseAfter && !isMentioned) {
        return { shouldRespond: false, delay: 0, priority: 0 };
      }
    }

    // Check cooldown (10 seconds) - but @mentions bypass this
    const lastResponse = this.cooldowns.get(model.id) || 0;
    const isOnCooldown = Date.now() - lastResponse < 10000;

    if (isOnCooldown && !isMentioned) {
      return { shouldRespond: false, delay: 0, priority: 0 };
    }

    // High priority: User message
    if (!shouldRespond && latestMessage.role === "user") {
      shouldRespond = true;
      priority = 80;
    }

    // Medium priority: Question asked (and not already responding to mention)
    if (!shouldRespond && latestMessage.content.includes("?")) {
      shouldRespond = true;
      priority = 60;
    }

    // Calculate delay based on message length (simulate reading)
    const readingTime = Math.min(latestMessage.content.length * 15, 2000);
    const baseDelay = 1500 + Math.random() * 2000;
    const delay = baseDelay + readingTime;

    return { shouldRespond, delay, priority };
  }

  queueResponse(modelId: string, delay: number, priority: number): void {
    // Don't queue if already queued or currently responding
    if (this.pendingModels.has(modelId)) {
      return;
    }
    this.pendingModels.add(modelId);

    setTimeout(() => {
      // Double-check still pending (might have been cleared by stop)
      if (!this.pendingModels.has(modelId)) {
        return;
      }

      // Rate limiting checks at execution time
      if (this.respondersThisMessage.size >= this.maxRespondersPerMessage) {
        this.pendingModels.delete(modelId);
        return;
      }
      if (this.consecutiveAIResponses >= this.maxConsecutiveAI) {
        this.pendingModels.delete(modelId);
        return;
      }

      if (this.currentlyResponding < this.maxConcurrent) {
        this.triggerResponse(modelId);
      } else {
        // Insert in priority order
        const insertIndex = this.responseQueue.findIndex(
          (item) => item.priority < priority
        );
        if (insertIndex === -1) {
          this.responseQueue.push({ modelId, priority });
        } else {
          this.responseQueue.splice(insertIndex, 0, { modelId, priority });
        }
      }
    }, delay);
  }

  completeResponse(modelId: string): void {
    this.cooldowns.set(modelId, Date.now());
    this.currentlyResponding--;
    this.pendingModels.delete(modelId);
    this.consecutiveAIResponses++;
    this.respondersThisMessage.add(modelId);

    if (this.responseQueue.length > 0) {
      const next = this.responseQueue.shift()!;
      this.triggerResponse(next.modelId);
    }
  }

  private triggerResponse(modelId: string): void {
    this.currentlyResponding++;
    this.onTriggerResponse?.(modelId);
  }

  isOnCooldown(modelId: string): boolean {
    const lastResponse = this.cooldowns.get(modelId) || 0;
    return Date.now() - lastResponse < 10000;
  }

  reset(): void {
    this.cooldowns.clear();
    this.responseQueue = [];
    this.pendingModels.clear();
    this.currentlyResponding = 0;
    this.consecutiveAIResponses = 0;
    this.respondersThisMessage.clear();
  }

  onUserMessage(): void {
    this.consecutiveAIResponses = 0;
    this.respondersThisMessage.clear();
  }
}

export function buildSystemPrompt(
  model: Model,
  activeModels: Model[],
  messages: Message[] = []
): string {
  const otherModels = activeModels
    .filter((m) => m.id !== model.id)
    .map((m) => m.shortName);

  const othersText =
    otherModels.length > 0
      ? `The other AI participants are: ${otherModels.join(", ")}.`
      : "You are the only AI in this chat.";

  // Determine last speaker
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const lastSpeaker = lastAssistantMsg?.modelName || "None yet";

  // Count messages since last user input
  let msgsSinceUser = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") break;
    msgsSinceUser++;
  }

  return `You are ${model.name}, participating in a group chat with a human user${otherModels.length > 0 ? " and other AI models" : ""}.

${othersText}

CRITICAL OUTPUT RULES:
- NEVER start your response with brackets, labels, or names like "[${model.shortName}]:" or "[${model.name}]:"
- The chat system automatically labels your messages - you just write your words
- NEVER write other models' names with brackets like "[Kimi]:" or "[Claude]:" in your response
- Keep all reasoning and thinking internal - only output your final response
- If you catch yourself writing meta-commentary about what you're about to say, stop and just say it

Current conversation state:
- Last speaker: ${lastSpeaker}
- Messages since last user input: ${msgsSinceUser}

Behavioral rules:
- Be conversational and natural, like a group chat
- Keep responses concise (2-4 sentences usually, unless asked for more detail)
- Use @mentions to address others (e.g., @${otherModels[0] || "User"})
- Don't repeat what others have said
- If directly addressed with @${model.shortName}, you must respond
- If ${msgsSinceUser} >= 3 and you weren't directly mentioned, let the human speak next
- Show personality and engage naturally`;
}

export function buildContextWindow(
  messages: Message[],
  windowSize: number,
  model: Model
): { role: "user" | "assistant" | "system"; content: string }[] {
  const recentMessages = messages.slice(-windowSize);

  return recentMessages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content:
      msg.modelId && msg.modelId !== model.id
        ? `[${msg.modelName}]: ${msg.content}`
        : msg.content,
  }));
}

export const conversationEngine = new ConversationEngine();
