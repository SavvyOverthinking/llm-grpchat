// Memory Scoring Utilities
// Extracted for reuse and testing

import { Memory } from '@/types/memory';

/**
 * Calculate memory score
 * Formula: importance × 0.5 + recency × 0.35 + accessFrequency × 0.15
 */
export function calculateScore(memory: Memory): number {
  const now = Date.now();
  const ageMs = now - memory.lastAccessedAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  const recencyScore = Math.exp(-ageDays / 7);
  const accessScore = Math.log(1 + memory.accessCount) / 5;

  return memory.importance * 0.5 + recencyScore * 0.35 + accessScore * 0.15;
}

/**
 * Calculate recency component only (for debugging/display)
 */
export function calculateRecency(lastAccessedAt: number): number {
  const now = Date.now();
  const ageMs = now - lastAccessedAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays / 7);
}

/**
 * Calculate access frequency component only
 */
export function calculateAccessFrequency(accessCount: number): number {
  return Math.log(1 + accessCount) / 5;
}

/**
 * Get score breakdown for UI display
 */
export function getScoreBreakdown(memory: Memory): {
  total: number;
  importance: number;
  recency: number;
  access: number;
  importanceContribution: number;
  recencyContribution: number;
  accessContribution: number;
} {
  const recency = calculateRecency(memory.lastAccessedAt);
  const access = calculateAccessFrequency(memory.accessCount);

  return {
    total: calculateScore(memory),
    importance: memory.importance,
    recency,
    access,
    importanceContribution: memory.importance * 0.5,
    recencyContribution: recency * 0.35,
    accessContribution: access * 0.15,
  };
}

/**
 * Sort memories by score descending
 */
export function sortByScore(memories: Memory[]): Memory[] {
  return [...memories].sort((a, b) => calculateScore(b) - calculateScore(a));
}

/**
 * Get top N memories by score
 */
export function getTopMemories(memories: Memory[], n: number): Memory[] {
  return sortByScore(memories.filter((m) => m.isActive)).slice(0, n);
}
