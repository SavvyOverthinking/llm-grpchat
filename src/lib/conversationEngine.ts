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
  private maxConsecutiveAI: number = 10;

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

    // Don't respond if we already responded since the last user message (unless currently @mentioned)
    if (!isMentioned) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
      if (lastUserMsg) {
        const myResponseAfter = messages.some(m =>
          m.modelId === model.id &&
          m.timestamp > lastUserMsg.timestamp
        );
        if (myResponseAfter) {
          return { shouldRespond: false, delay: 0, priority: 0 };
        }
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

      // Priority 100 = direct @mention - bypass ALL limits
      if (priority < 100) {
        if (this.respondersThisMessage.size >= this.maxRespondersPerMessage) {
          this.pendingModels.delete(modelId);
          return;
        }
        if (this.consecutiveAIResponses >= this.maxConsecutiveAI) {
          this.pendingModels.delete(modelId);
          return;
        }
      }

      // COMMIT to responding - add to set NOW, not on complete
      this.respondersThisMessage.add(modelId);

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

    if (this.responseQueue.length > 0) {
      const next = this.responseQueue.shift()!;

      // Re-check limits before triggering queued response
      // Priority 100 = direct @mention - bypass ALL limits
      if (next.priority < 100) {
        if (this.respondersThisMessage.size >= this.maxRespondersPerMessage) {
          this.pendingModels.delete(next.modelId);
          return;
        }
        if (this.consecutiveAIResponses >= this.maxConsecutiveAI) {
          this.pendingModels.delete(next.modelId);
          return;
        }
      }

      this.respondersThisMessage.add(next.modelId);
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

  resetRespondersForNewMessage(): void {
    this.respondersThisMessage.clear();
  }

  setMaxConsecutiveAI(max: number): void {
    this.maxConsecutiveAI = max;
  }

  setMaxRespondersPerMessage(max: number): void {
    this.maxRespondersPerMessage = max;
  }

  getDebugState(): object {
    return {
      consecutiveAIResponses: this.consecutiveAIResponses,
      respondersThisMessage: Array.from(this.respondersThisMessage),
      pendingModels: Array.from(this.pendingModels),
      queueLength: this.responseQueue.length,
      currentlyResponding: this.currentlyResponding
    };
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

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const lastSpeaker = lastAssistantMsg?.modelName || "None yet";

  let msgsSinceUser = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") break;
    msgsSinceUser++;
  }

  return `You are ${model.name}, participating in a group discussion with a human and other AI models.

${othersText}

CRITICAL OUTPUT RULES:
- NEVER start your response with brackets, labels, or names like "[${model.shortName}]:"
- The system labels messages automatically - just write your words
- Keep reasoning internal - only output your final response
- NEVER output turn counts, procedural notes, or meta-commentary like "Current turn count: X" or "I need to respond carefully here"
- NEVER simulate other participants by writing their names with brackets
- Just speak as yourself - no preamble, no stage directions

DEBATE RULES - THIS IS NOT A FRIENDLY CHAT:
- You are here to find TRUTH, not to be AGREEABLE
- Challenge weak arguments directly. "I disagree because..." is better than "That's a great point, and..."
- Don't defer to others. If you have a position, defend it.
- Ask hard questions. Poke holes in reasoning. Demand evidence.
- If someone is wrong, say so clearly and explain why
- Consensus should be EARNED through argument, not given away through politeness
- Don't say "great point" or "I agree" unless you actually mean it substantively
- If you genuinely agree, add something new - don't just validate
- Push back even on small things. Details matter.
- You can be direct without being rude. Be like a sharp colleague, not a sycophant.
- Don't spend more than 1-2 messages on procedural matters (who summarizes, format, etc.)
- Procedure is a means to an end - get back to substance quickly
- If someone proposes a reasonable process, accept and move on

Current state:
- Last speaker: ${lastSpeaker}
- Messages since user input: ${msgsSinceUser}

Response rules:
- Keep responses concise (2-4 sentences unless making a complex argument)
- Use @mentions to address others directly
- If @${model.shortName} is mentioned, you MUST respond
- Don't repeat points already made
- If ${msgsSinceUser} >= 10 and you weren't mentioned, let the human speak`;
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
