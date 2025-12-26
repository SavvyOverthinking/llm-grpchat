import { Model, Message, PromptMode, ModelConfig } from "@/types/chat";
import { availableRoles } from "@/lib/modelConfigs";

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

    // Check for @here or @all global mentions - triggers ALL models
    const globalMentionPattern = /@(here|all)\b/i;
    const isGlobalMention = globalMentionPattern.test(latestMessage.content);

    // Highest priority: @mentioned - BYPASSES COOLDOWN
    const mentionPattern = new RegExp(`@${model.shortName.toLowerCase()}\\b`, "i");
    const isMentioned = mentionPattern.test(latestMessage.content) || isGlobalMention;

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

    // Detect if recent ASSISTANT messages contain summary/conclusion language - reduce post-summary chatter
    // Only check AI responses, not user posts (user might paste text containing "conclusion" etc.)
    const recentAssistantMessages = messages.slice(-5).filter(m => m.role === "assistant");
    const summaryKeywords = ['final report', 'summary:', 'consensus:', 'conclusion:', 'we are done', 'analysis stands'];
    const hasSummary = recentAssistantMessages.some(m =>
      summaryKeywords.some(kw => m.content.toLowerCase().includes(kw))
    );

    // After a summary, only respond if directly @mentioned
    if (hasSummary && !isMentioned) {
      return { shouldRespond: false, delay: 0, priority: 0 };
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
  messages: Message[] = [],
  promptModes: PromptMode[] = [],
  modelConfigs: Record<string, ModelConfig> = {}
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

  // Build enabled prompt modes text
  const enabledModes = promptModes.filter(m => m.enabled);
  const modesText = enabledModes.length > 0
    ? '\n\n' + enabledModes.map(m => m.promptAddition).join('\n\n')
    : '';

  // Build model-specific personality text
  const modelConfig = modelConfigs[model.id];
  const personalityText = modelConfig?.personality
    ? `\n\nYOUR PERSONALITY:\n${modelConfig.personality}`
    : '';

  // Build custom role text if assigned
  const roleText = modelConfig?.customRole
    ? `\n\nASSIGNED ROLE:\n${availableRoles.find(r => r.id === modelConfig.customRole)?.prompt || ''}`
    : '';

  // Build custom instructions text if present
  const customInstructionsText = modelConfig?.customInstructions
    ? `\n\nCUSTOM INSTRUCTIONS:\n${modelConfig.customInstructions}`
    : '';

  const basePrompt = `You are ${model.name}, participating in a group discussion with a human and other AI models.

${othersText}

CRITICAL OUTPUT RULES:
- NEVER start your response with brackets, labels, or names like "[${model.shortName}]:"
- The system labels messages automatically - just write your words
- Keep reasoning internal - only output your final response

IDENTITY RULES:
- You are ${model.name} and ONLY ${model.name}
- NEVER write corrections like "I am not X" or "I am actually Y"
- NEVER reference being "confused" about your identity
- NEVER break the fourth wall by mentioning "simulation," "bot instructions," or "system"
- If you're unsure, just respond as yourself - don't narrate the confusion
- Other models' names should only appear after @ symbols when addressing them

CRITICAL - DO NOT VENTRILOQUIZE:
- NEVER speak for other models. You are ONE participant, not the narrator.
- NEVER write "@OtherModel: [what you think they'd say]" - that's their job, not yours
- NEVER roleplay multiple participants in one response
- If the user asks for opinions from multiple models, give YOUR opinion only
- Let Kimi speak for Kimi, let Grok speak for Grok, etc.
- You respond as yourself. Period. Other models will respond for themselves.

BANNED OUTPUT PATTERNS - NEVER WRITE THESE:
- Turn counts: "Turn X/50", "Turn count check", "X messages since user"
- Stage directions: "(Waiting for user)", "(silence implies assent)", "*Self-correction*"
- Procedural closers: "Discussion closed", "Over to you, human", "Your call, Human"
- Fourth wall: "the system", "bot instructions", "this simulation", "I am assigned"
- Asterisk actions: "*I am stopping*", "*waiting*", "*correction*"
- Yielding loops: "I'm done", "Nothing to add", "Shutting up now"
- Ventriloquism: "@Gemini: [opinion]", "@Grok: [opinion]" - never voice other models
- Multi-voice responses: Don't give opinions "from" multiple models in one message

If the debate has reached a natural conclusion, simply stop responding. Don't announce that you're stopping.

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

ENDING A DEBATE:
- When consensus is reached and summarized, the debate is OVER
- Don't add "waiting for user" or "your turn human" - just stop
- Don't pile on with "I agree the summary is complete" - silence is fine
- If you have nothing substantive to add, don't speak at all
- The last word should be the summary or a final substantive point, not meta-commentary

Current state:
- Last speaker: ${lastSpeaker}
- Messages since user input: ${msgsSinceUser}

Response rules:
- Keep responses concise (2-4 sentences unless making a complex argument)
- Use @mentions to address others directly
- If @${model.shortName} is mentioned, you MUST respond
- Don't repeat points already made
- If ${msgsSinceUser} >= 10 and you weren't mentioned, let the human speak`;

  return basePrompt + modesText + personalityText + roleText + customInstructionsText;
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
