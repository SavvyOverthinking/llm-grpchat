// Memory System Types for llm-grpchat 2.0
// Debate-focused memory categories for multi-LLM discussions

export type MemoryCategory =
  | 'fact'           // Concrete information established in discussion
  | 'position'       // A specific model's stance on a topic
  | 'agreement'      // Points where models converged
  | 'disagreement'   // Points of conflict between models
  | 'evidence'       // Data, citations, examples provided
  | 'conclusion'     // Synthesized outcomes from discussion
  | 'question'       // Open questions that remain unresolved
  | 'context';       // Background/setup information

export interface Memory {
  id: string;
  content: string;                 // The memory itself (1-3 sentences)
  category: MemoryCategory;
  importance: number;              // 0.0-1.0 score

  // Scope
  scope: 'global' | 'model-specific';
  modelId?: string;                // If model-specific, which model

  // Temporal
  createdAt: number;               // Timestamp
  lastAccessedAt: number;          // For recency scoring
  accessCount: number;             // How often retrieved

  // Source
  sourceMessageIds: string[];      // Which messages this was extracted from
  extractionTurn: number;          // Conversation turn when extracted

  // Semantic
  tags: string[];                  // ["AI safety", "regulation", "consensus"]

  // Validity
  supersededBy?: string;           // If this memory was updated/replaced
  isActive: boolean;               // False if superseded or manually removed
}

export interface MemoryExtractionInput {
  content: string;
  category: MemoryCategory;
  importance: number;
  scope: 'global' | 'model-specific';
  modelId?: string | null;
  tags: string[];
  supersedes?: string | null;      // ID of memory this replaces
}

export interface MemoryExtractionResult {
  memories: MemoryExtractionInput[];
  processingTime: number;
  modelUsed: string;
  tokensUsed?: number;
  error?: string;
}

export interface MemoryState {
  // Storage
  memories: Memory[];

  // Configuration
  extractionEnabled: boolean;
  extractionFrequency: number;     // Every N user messages
  extractionModel: string;         // Which model to use for extraction
  maxMemories: number;             // Total cap before pruning

  // Queue management
  pendingExtractionMessageIds: string[];
  lastExtractionTurn: number;
  isExtracting: boolean;

  // Actions
  addMemory: (memory: Omit<Memory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount' | 'isActive'>) => string;
  updateMemory: (id: string, updates: Partial<Memory>) => void;
  removeMemory: (id: string) => void;

  getActiveMemories: () => Memory[];
  getMemoriesByCategory: (category: MemoryCategory) => Memory[];
  getMemoriesForModel: (modelId: string) => Memory[];

  markMemoryAccessed: (id: string) => void;
  supersede: (oldId: string, newId: string) => void;

  queueForExtraction: (messageIds: string[]) => void;
  clearExtractionQueue: () => void;
  setIsExtracting: (value: boolean) => void;
  setLastExtractionTurn: (turn: number) => void;

  // Configuration setters
  setExtractionEnabled: (enabled: boolean) => void;
  setExtractionFrequency: (frequency: number) => void;
  setExtractionModel: (model: string) => void;
  setMaxMemories: (max: number) => void;

  // Bulk operations
  importMemories: (memories: Memory[]) => void;
  exportMemories: () => Memory[];
  clearAllMemories: () => void;
  replaceAllMemories: (memories: Memory[]) => void;
  pruneExcessMemories: () => void;
}

// Category display configuration
export const MEMORY_CATEGORY_CONFIG: Record<MemoryCategory, {
  label: string;
  color: string;
  icon: string;
  description: string;
}> = {
  fact: {
    label: 'Fact',
    color: 'bg-blue-500',
    icon: '📋',
    description: 'Established information'
  },
  position: {
    label: 'Position',
    color: 'bg-purple-500',
    icon: '🎯',
    description: 'Model stance on topic'
  },
  agreement: {
    label: 'Agreement',
    color: 'bg-green-500',
    icon: '✓',
    description: 'Points of convergence'
  },
  disagreement: {
    label: 'Disagreement',
    color: 'bg-red-500',
    icon: '⚡',
    description: 'Points of conflict'
  },
  evidence: {
    label: 'Evidence',
    color: 'bg-yellow-500',
    icon: '📊',
    description: 'Data and citations'
  },
  conclusion: {
    label: 'Conclusion',
    color: 'bg-teal-500',
    icon: '🏁',
    description: 'Synthesized outcomes'
  },
  question: {
    label: 'Question',
    color: 'bg-orange-500',
    icon: '❓',
    description: 'Open questions'
  },
  context: {
    label: 'Context',
    color: 'bg-gray-500',
    icon: '📝',
    description: 'Background info'
  },
};

// Default configuration values
export const DEFAULT_MEMORY_CONFIG = {
  extractionEnabled: true,
  extractionFrequency: 2,          // Every 2 user messages
  extractionModel: 'openai/gpt-4o-mini',
  maxMemories: 100,
};
