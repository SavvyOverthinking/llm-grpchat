// Speaker/Reporter System for llm-grpchat 2.0
// Enables designated model to summarize discussions

import {
  SpeakerCommand,
  SpeakerState,
  SPEAKER_COMMANDS,
  SPEAKER_COMMAND_PATTERNS,
} from '@/types/speaker';
import { Memory } from '@/types/memory';
import { Model } from '@/types/chat';
import { formatMemoriesForSpeaker } from './memory/formatter';

/**
 * Detect if a user message is triggering a speaker command via @mention
 * Returns the command if detected, null otherwise
 */
export function detectSpeakerCommand(
  message: string,
  speakerId: string | null,
  activeModels: Model[]
): { command: SpeakerCommand; mentionedModel: Model } | null {
  if (!message.includes('@')) {
    return null;
  }

  // Find @mentions in the message
  const mentionPattern = /@(\w+)/g;
  const mentions = [...message.matchAll(mentionPattern)];

  if (mentions.length === 0) {
    return null;
  }

  // Check each mention against active models
  for (const match of mentions) {
    const mentionName = match[1].toLowerCase();

    // Find matching model
    const model = activeModels.find(m =>
      m.name.toLowerCase().includes(mentionName) ||
      m.shortName.toLowerCase().includes(mentionName) ||
      m.id.toLowerCase().includes(mentionName)
    );

    if (!model) continue;

    // Check if the message contains a command for this model
    for (const [command, patterns] of Object.entries(SPEAKER_COMMAND_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return {
            command: command as SpeakerCommand,
            mentionedModel: model,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Build the system prompt addition for a speaker model
 */
export function buildSpeakerSystemPrompt(
  command: SpeakerCommand,
  memories: Memory[],
  activeModels: Model[]
): string {
  const modelNames = activeModels.map(m => m.shortName || m.name);
  const commandConfig = SPEAKER_COMMANDS[command];
  const memoryContext = formatMemoriesForSpeaker(memories, modelNames);

  const baseInstructions = `
## SPEAKER MODE ACTIVE

You have been designated as the SPEAKER for this discussion. Your role is to provide a ${commandConfig.label.toLowerCase()} of the conversation.

**Your Task**: ${commandConfig.description}

**Important Guidelines**:
- Be neutral and fair in representing all participants' views
- Attribute positions to specific models when relevant
- Do not add your own opinions - only synthesize what was discussed
- If information is unclear or incomplete, note that
`;

  const formatInstructions = getFormatInstructions(command);

  return `${baseInstructions}

${formatInstructions}

${memoryContext}
`;
}

/**
 * Get format-specific instructions for each command type
 */
function getFormatInstructions(command: SpeakerCommand): string {
  switch (command) {
    case 'summarize':
      return `
**Format**: Write a concise prose summary (2-4 paragraphs)
- Start with the main topic/question discussed
- Cover key points and how the discussion evolved
- End with where things stand now
- Keep it brief and readable
`;

    case 'report':
      return `
**Format**: Structured report with clear sections
Use this structure:
1. **Overview**: What was discussed and why
2. **Key Arguments**: Main positions taken (attribute to models)
3. **Points of Agreement**: Where participants converged
4. **Points of Disagreement**: Where participants differed
5. **Evidence Cited**: Data, studies, or examples mentioned
6. **Conclusions**: Any resolutions or outcomes
7. **Open Questions**: What remains unresolved
`;

    case 'consensus':
      return `
**Format**: Bullet list of agreement points
- List ONLY things where all participants agree
- Be specific about what exactly they agree on
- If there's no clear consensus on a topic, don't include it
- Attribute the agreement if it emerged from specific exchange
`;

    case 'conflicts':
      return `
**Format**: Structured disagreement summary
For each point of disagreement:
- State the topic/issue
- List each model's position
- Note the nature of the disagreement (factual, interpretive, values-based)
- Note if any progress was made toward resolution
`;

    case 'questions':
      return `
**Format**: Numbered list of open questions
- List questions that were raised but not resolved
- Include questions that naturally arise from the discussion
- Prioritize by importance/relevance
- Note which model raised each question if relevant
`;

    default:
      return '';
  }
}

/**
 * Build a user-facing message that triggers speaker mode
 * Used when speaker is triggered via UI button rather than @mention
 */
export function buildSpeakerTriggerMessage(
  command: SpeakerCommand,
  speakerModel: Model
): string {
  const commandConfig = SPEAKER_COMMANDS[command];
  return `@${speakerModel.shortName || speakerModel.name} Please ${commandConfig.description.toLowerCase()}`;
}

/**
 * Check if a model is currently in speaker mode
 */
export function isInSpeakerMode(
  modelId: string,
  speakerState: SpeakerState
): boolean {
  return speakerState.speakerId === modelId && speakerState.speakerMode !== null;
}

/**
 * Get speaker mode display info
 */
export function getSpeakerModeInfo(
  speakerState: SpeakerState,
  activeModels: Model[]
): { isActive: boolean; speakerName: string | null; command: string | null } {
  if (!speakerState.speakerId || !speakerState.speakerMode) {
    return { isActive: false, speakerName: null, command: null };
  }

  const speaker = activeModels.find(m => m.id === speakerState.speakerId);
  const commandConfig = speakerState.speakerMode
    ? SPEAKER_COMMANDS[speakerState.speakerMode]
    : null;

  return {
    isActive: true,
    speakerName: speaker?.shortName || speaker?.name || null,
    command: commandConfig?.label || null,
  };
}

/**
 * Validate that a model can be a speaker
 * (Must be in active models list)
 */
export function canBeSpeaker(modelId: string, activeModels: Model[]): boolean {
  return activeModels.some(m => m.id === modelId);
}

/**
 * Get available speaker commands with their configs
 */
export function getAvailableCommands(): Array<{
  command: SpeakerCommand;
  label: string;
  description: string;
  icon: string;
}> {
  return Object.values(SPEAKER_COMMANDS).map(config => ({
    command: config.command,
    label: config.label,
    description: config.description,
    icon: config.icon,
  }));
}

/**
 * Parse a speaker response to extract structured data (if applicable)
 * Useful for consensus/conflicts/questions which have bullet formats
 */
export function parseSpeakerResponse(
  response: string,
  command: SpeakerCommand
): { items: string[]; raw: string } {
  const items: string[] = [];

  if (['consensus', 'conflicts', 'questions'].includes(command)) {
    // Extract bullet points
    const bulletPattern = /^[\s]*[-*]\s*(.+)$/gm;
    const matches = [...response.matchAll(bulletPattern)];
    for (const match of matches) {
      items.push(match[1].trim());
    }

    // Also try numbered lists
    const numberedPattern = /^[\s]*\d+[.)]\s*(.+)$/gm;
    const numberedMatches = [...response.matchAll(numberedPattern)];
    for (const match of numberedMatches) {
      items.push(match[1].trim());
    }
  }

  return { items, raw: response };
}

/**
 * Generate a prompt suffix that reminds the speaker of their role
 * Used at the end of the message context
 */
export function getSpeakerReminder(command: SpeakerCommand): string {
  const config = SPEAKER_COMMANDS[command];
  return `

---
Remember: You are the designated speaker. Provide a ${config.label.toLowerCase()} as described above. Be neutral and comprehensive.`;
}
