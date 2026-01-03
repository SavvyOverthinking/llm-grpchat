// Memory Formatting Utilities for llm-grpchat 2.0
// Prepares memories for injection into model prompts

import { Memory, MemoryCategory, MEMORY_CATEGORY_CONFIG } from '@/types/memory';
import { calculateScore, sortByScore, getTopMemories } from './scoring';

/**
 * Format memories for injection into a model's system prompt
 * Used during normal conversation to give models context
 */
export function formatMemoriesForPrompt(
  memories: Memory[],
  options: {
    maxMemories?: number;
    maxTokensEstimate?: number;
    includeScores?: boolean;
    groupByCategory?: boolean;
  } = {}
): string {
  const {
    maxMemories = 15,
    maxTokensEstimate = 500,
    includeScores = false,
    groupByCategory = false,
  } = options;

  const activeMemories = memories.filter(m => m.isActive);

  if (activeMemories.length === 0) {
    return '';
  }

  // Get top memories by score
  const topMemories = getTopMemories(activeMemories, maxMemories);

  if (groupByCategory) {
    return formatGroupedMemories(topMemories, includeScores);
  } else {
    return formatFlatMemories(topMemories, includeScores);
  }
}

/**
 * Format memories as a flat list (default)
 */
function formatFlatMemories(memories: Memory[], includeScores: boolean): string {
  const lines = memories.map(m => {
    const categoryLabel = MEMORY_CATEGORY_CONFIG[m.category].label;
    const scoreStr = includeScores ? ` (${(calculateScore(m) * 100).toFixed(0)}%)` : '';
    return `- [${categoryLabel}]${scoreStr} ${m.content}`;
  });

  return `## Discussion Context (from earlier in this conversation)

${lines.join('\n')}
`;
}

/**
 * Format memories grouped by category
 */
function formatGroupedMemories(memories: Memory[], includeScores: boolean): string {
  // Group by category
  const groups: Partial<Record<MemoryCategory, Memory[]>> = {};

  for (const memory of memories) {
    if (!groups[memory.category]) {
      groups[memory.category] = [];
    }
    groups[memory.category]!.push(memory);
  }

  // Build output with category headers
  const sections: string[] = [];

  // Order categories by importance for readability
  const categoryOrder: MemoryCategory[] = [
    'conclusion',
    'agreement',
    'disagreement',
    'position',
    'evidence',
    'fact',
    'question',
    'context',
  ];

  for (const category of categoryOrder) {
    const categoryMemories = groups[category];
    if (!categoryMemories || categoryMemories.length === 0) continue;

    const config = MEMORY_CATEGORY_CONFIG[category];
    const lines = categoryMemories.map(m => {
      const scoreStr = includeScores ? ` (${(calculateScore(m) * 100).toFixed(0)}%)` : '';
      return `  - ${m.content}${scoreStr}`;
    });

    sections.push(`**${config.label}s**:\n${lines.join('\n')}`);
  }

  return `## Discussion Context (from earlier in this conversation)

${sections.join('\n\n')}
`;
}

/**
 * Format memories for a speaker/reporter model
 * More detailed and structured for summary generation
 */
export function formatMemoriesForSpeaker(
  memories: Memory[],
  activeModelNames: string[],
  options: {
    includeAllActive?: boolean;
    maxMemories?: number;
  } = {}
): string {
  const {
    includeAllActive = true,
    maxMemories = 30,
  } = options;

  const activeMemories = memories.filter(m => m.isActive);

  if (activeMemories.length === 0) {
    return `## Discussion Summary Data

No memories have been recorded from this discussion yet.

**Active Participants**: ${activeModelNames.join(', ')}
`;
  }

  // Get memories, potentially all of them for speaker
  const relevantMemories = includeAllActive
    ? sortByScore(activeMemories).slice(0, maxMemories)
    : getTopMemories(activeMemories, maxMemories);

  // Group by category for structured output
  const groups: Partial<Record<MemoryCategory, Memory[]>> = {};

  for (const memory of relevantMemories) {
    if (!groups[memory.category]) {
      groups[memory.category] = [];
    }
    groups[memory.category]!.push(memory);
  }

  // Build structured summary data
  const sections: string[] = [];

  // Positions (by model if available)
  const positions = groups['position'] || [];
  if (positions.length > 0) {
    const positionLines = positions.map(m => {
      const modelNote = m.modelId ? ` [${m.modelId}]` : '';
      return `  - ${m.content}${modelNote}`;
    });
    sections.push(`**Model Positions**:\n${positionLines.join('\n')}`);
  }

  // Agreements
  const agreements = groups['agreement'] || [];
  if (agreements.length > 0) {
    const lines = agreements.map(m => `  - ${m.content}`);
    sections.push(`**Points of Agreement**:\n${lines.join('\n')}`);
  }

  // Disagreements
  const disagreements = groups['disagreement'] || [];
  if (disagreements.length > 0) {
    const lines = disagreements.map(m => `  - ${m.content}`);
    sections.push(`**Points of Disagreement**:\n${lines.join('\n')}`);
  }

  // Evidence
  const evidence = groups['evidence'] || [];
  if (evidence.length > 0) {
    const lines = evidence.map(m => `  - ${m.content}`);
    sections.push(`**Evidence & Data Cited**:\n${lines.join('\n')}`);
  }

  // Conclusions
  const conclusions = groups['conclusion'] || [];
  if (conclusions.length > 0) {
    const lines = conclusions.map(m => `  - ${m.content}`);
    sections.push(`**Conclusions Reached**:\n${lines.join('\n')}`);
  }

  // Open Questions
  const questions = groups['question'] || [];
  if (questions.length > 0) {
    const lines = questions.map(m => `  - ${m.content}`);
    sections.push(`**Open Questions**:\n${lines.join('\n')}`);
  }

  // Facts and Context (combined, less prominent)
  const facts = groups['fact'] || [];
  const context = groups['context'] || [];
  const background = [...facts, ...context];
  if (background.length > 0) {
    const lines = background.slice(0, 5).map(m => `  - ${m.content}`);
    sections.push(`**Background Context**:\n${lines.join('\n')}`);
  }

  return `## Discussion Summary Data

**Active Participants**: ${activeModelNames.join(', ')}
**Total Memories**: ${activeMemories.length}

${sections.join('\n\n')}
`;
}

/**
 * Format memories for a specific model (includes global + model-specific)
 */
export function formatMemoriesForModel(
  memories: Memory[],
  modelId: string,
  modelName: string,
  options: {
    maxMemories?: number;
    includeScores?: boolean;
  } = {}
): string {
  const { maxMemories = 15, includeScores = false } = options;

  // Filter to global memories + this model's specific memories
  const relevantMemories = memories.filter(m =>
    m.isActive && (m.scope === 'global' || m.modelId === modelId)
  );

  if (relevantMemories.length === 0) {
    return '';
  }

  const topMemories = getTopMemories(relevantMemories, maxMemories);

  // Separate model-specific from global for clarity
  const globalMemories = topMemories.filter(m => m.scope === 'global');
  const modelMemories = topMemories.filter(m => m.scope === 'model-specific');

  const sections: string[] = [];

  if (globalMemories.length > 0) {
    const lines = globalMemories.map(m => {
      const categoryLabel = MEMORY_CATEGORY_CONFIG[m.category].label;
      const scoreStr = includeScores ? ` (${(calculateScore(m) * 100).toFixed(0)}%)` : '';
      return `  - [${categoryLabel}]${scoreStr} ${m.content}`;
    });
    sections.push(`**Discussion Context**:\n${lines.join('\n')}`);
  }

  if (modelMemories.length > 0) {
    const lines = modelMemories.map(m => {
      const categoryLabel = MEMORY_CATEGORY_CONFIG[m.category].label;
      const scoreStr = includeScores ? ` (${(calculateScore(m) * 100).toFixed(0)}%)` : '';
      return `  - [${categoryLabel}]${scoreStr} ${m.content}`;
    });
    sections.push(`**Your Previous Points** (${modelName}):\n${lines.join('\n')}`);
  }

  return `## Memory Context

${sections.join('\n\n')}
`;
}

/**
 * Estimate token count for a formatted memory string
 * Rough estimate: ~4 chars per token for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate memories to fit within a token budget
 */
export function truncateMemoriesToTokenBudget(
  memories: Memory[],
  maxTokens: number,
  formatter: (memories: Memory[]) => string = (m) => formatMemoriesForPrompt(m)
): Memory[] {
  const sorted = sortByScore(memories.filter(m => m.isActive));

  // Binary search for the right number of memories
  let low = 0;
  let high = sorted.length;
  let result = sorted;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const subset = sorted.slice(0, mid);
    const formatted = formatter(subset);

    if (estimateTokens(formatted) <= maxTokens) {
      low = mid;
      result = subset;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

/**
 * Get a brief summary of memory state for debugging/display
 */
export function getMemorySummary(memories: Memory[]): string {
  const active = memories.filter(m => m.isActive);
  const byCategory: Record<string, number> = {};

  for (const m of active) {
    byCategory[m.category] = (byCategory[m.category] || 0) + 1;
  }

  const parts = Object.entries(byCategory)
    .map(([cat, count]) => `${count} ${cat}`)
    .join(', ');

  return `${active.length} memories (${parts})`;
}
