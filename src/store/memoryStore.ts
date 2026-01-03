import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import {
  Memory,
  MemoryCategory,
  MemoryState,
  DEFAULT_MEMORY_CONFIG,
} from '@/types/memory';

/**
 * Score a memory for ranking (higher = more relevant)
 * Formula: importance × 0.5 + recency × 0.35 + accessFrequency × 0.15
 */
function scoreMemory(memory: Memory): number {
  const now = Date.now();
  const ageMs = now - memory.lastAccessedAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Recency: exponential decay with ~7 day half-life
  const recencyScore = Math.exp(-ageDays / 7);

  // Access frequency: logarithmic scaling with diminishing returns
  const accessScore = Math.log(1 + memory.accessCount) / 5;

  // Combined score
  return memory.importance * 0.5 + recencyScore * 0.35 + accessScore * 0.15;
}

/**
 * Sort memories by score (highest first)
 */
function sortByScore(memories: Memory[]): Memory[] {
  return [...memories].sort((a, b) => scoreMemory(b) - scoreMemory(a));
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      // === Initial State ===
      memories: [],
      extractionEnabled: DEFAULT_MEMORY_CONFIG.extractionEnabled,
      extractionFrequency: DEFAULT_MEMORY_CONFIG.extractionFrequency,
      extractionModel: 'deepseek/deepseek-chat',  // DeepSeek - cheaper than GPT-4o-mini, excellent at structured JSON
      maxMemories: DEFAULT_MEMORY_CONFIG.maxMemories,
      pendingExtractionMessageIds: [],
      lastExtractionTurn: 0,
      isExtracting: false,

      // === Memory CRUD ===

      addMemory: (memoryInput) => {
        const id = uuidv4();
        const now = Date.now();

        const newMemory: Memory = {
          ...memoryInput,
          id,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 0,
          isActive: true,
        };

        set((state) => ({
          memories: [...state.memories, newMemory],
        }));

        // Auto-prune if over limit
        get().pruneExcessMemories();

        return id;
      },

      updateMemory: (id, updates) => {
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },

      removeMemory: (id) => {
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, isActive: false } : m
          ),
        }));
      },

      // === Memory Retrieval ===

      getActiveMemories: () => {
        const state = get();
        return sortByScore(state.memories.filter((m) => m.isActive));
      },

      getMemoriesByCategory: (category: MemoryCategory) => {
        const state = get();
        return sortByScore(
          state.memories.filter((m) => m.isActive && m.category === category)
        );
      },

      getMemoriesForModel: (modelId: string) => {
        const state = get();
        return sortByScore(
          state.memories.filter(
            (m) => m.isActive && (m.scope === 'global' || m.modelId === modelId)
          )
        );
      },

      // === Memory Access Tracking ===

      markMemoryAccessed: (id) => {
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id
              ? {
                  ...m,
                  lastAccessedAt: Date.now(),
                  accessCount: m.accessCount + 1,
                }
              : m
          ),
        }));
      },

      supersede: (oldId, newId) => {
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === oldId
              ? { ...m, isActive: false, supersededBy: newId }
              : m
          ),
        }));
      },

      // === Extraction Queue Management ===

      queueForExtraction: (messageIds) => {
        set((state) => ({
          pendingExtractionMessageIds: [
            ...new Set([...state.pendingExtractionMessageIds, ...messageIds]),
          ],
        }));
      },

      clearExtractionQueue: () => {
        set({ pendingExtractionMessageIds: [] });
      },

      setIsExtracting: (value) => {
        set({ isExtracting: value });
      },

      setLastExtractionTurn: (turn) => {
        set({ lastExtractionTurn: turn });
      },

      // === Configuration ===

      setExtractionEnabled: (enabled) => {
        set({ extractionEnabled: enabled });
      },

      setExtractionFrequency: (frequency) => {
        set({ extractionFrequency: Math.max(1, frequency) });
      },

      setExtractionModel: (model) => {
        set({ extractionModel: model });
      },

      setMaxMemories: (max) => {
        set({ maxMemories: Math.max(10, max) });
        get().pruneExcessMemories();
      },

      // === Bulk Operations ===

      importMemories: (memories) => {
        set((state) => ({
          memories: [...state.memories, ...memories],
        }));
        get().pruneExcessMemories();
      },

      exportMemories: () => {
        return get().memories;
      },

      clearAllMemories: () => {
        set({
          memories: [],
          lastExtractionTurn: 0,
          pendingExtractionMessageIds: [],
        });
      },

      pruneExcessMemories: () => {
        const state = get();
        const activeMemories = state.memories.filter((m) => m.isActive);

        if (activeMemories.length <= state.maxMemories) {
          return; // No pruning needed
        }

        // Score all active memories
        const scored = activeMemories.map((m) => ({
          id: m.id,
          score: scoreMemory(m),
        }));

        // Sort by score descending, keep top N
        const keepIds = new Set(
          scored
            .sort((a, b) => b.score - a.score)
            .slice(0, state.maxMemories)
            .map((s) => s.id)
        );

        // Mark excess memories as inactive
        set({
          memories: state.memories.map((m) => {
            if (!m.isActive) return m;
            if (keepIds.has(m.id)) return m;
            return { ...m, isActive: false };
          }),
        });
      },
    }),
    {
      name: 'llm-grpchat-memory',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        memories: state.memories,
        extractionEnabled: state.extractionEnabled,
        extractionFrequency: state.extractionFrequency,
        extractionModel: state.extractionModel,
        maxMemories: state.maxMemories,
        lastExtractionTurn: state.lastExtractionTurn,
      }),
    }
  )
);

// === Utility Functions (exported for use elsewhere) ===

/**
 * Get the score of a memory (useful for UI display)
 */
export function getMemoryScore(memory: Memory): number {
  return scoreMemory(memory);
}

/**
 * Get memories grouped by category
 */
export function groupMemoriesByCategory(
  memories: Memory[]
): Record<MemoryCategory, Memory[]> {
  const grouped: Record<MemoryCategory, Memory[]> = {
    fact: [],
    position: [],
    agreement: [],
    disagreement: [],
    evidence: [],
    conclusion: [],
    question: [],
    context: [],
  };

  for (const memory of memories) {
    if (memory.isActive) {
      grouped[memory.category].push(memory);
    }
  }

  // Sort each group by score
  for (const category of Object.keys(grouped) as MemoryCategory[]) {
    grouped[category] = sortByScore(grouped[category]);
  }

  return grouped;
}

/**
 * Get memory statistics
 */
export function getMemoryStats(memories: Memory[]): {
  total: number;
  active: number;
  byCategory: Record<MemoryCategory, number>;
  avgScore: number;
  avgAge: number;
} {
  const active = memories.filter((m) => m.isActive);
  const now = Date.now();

  const byCategory: Record<MemoryCategory, number> = {
    fact: 0,
    position: 0,
    agreement: 0,
    disagreement: 0,
    evidence: 0,
    conclusion: 0,
    question: 0,
    context: 0,
  };

  let totalScore = 0;
  let totalAge = 0;

  for (const memory of active) {
    byCategory[memory.category]++;
    totalScore += scoreMemory(memory);
    totalAge += now - memory.createdAt;
  }

  return {
    total: memories.length,
    active: active.length,
    byCategory,
    avgScore: active.length > 0 ? totalScore / active.length : 0,
    avgAge: active.length > 0 ? totalAge / active.length : 0,
  };
}

/**
 * Check if extraction should run based on turn count and frequency
 */
export function shouldExtract(
  currentTurn: number,
  lastExtractionTurn: number,
  frequency: number,
  enabled: boolean
): boolean {
  if (!enabled) return false;
  return currentTurn - lastExtractionTurn >= frequency;
}

/**
 * Format memories for prompt injection (simple version)
 * More sophisticated formatting in memory/formatter.ts (Phase 2)
 */
export function formatMemoriesSimple(memories: Memory[], limit: number = 10): string {
  const sorted = sortByScore(memories.filter((m) => m.isActive)).slice(0, limit);

  if (sorted.length === 0) {
    return '';
  }

  const lines = sorted.map((m) => {
    const categoryLabel = m.category.charAt(0).toUpperCase() + m.category.slice(1);
    return `[${categoryLabel}] ${m.content}`;
  });

  return `## Discussion Memory\n${lines.join('\n')}`;
}
