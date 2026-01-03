'use client';

import { useState, useEffect, useRef } from 'react';
import { useMemoryStore } from '@/store/memoryStore';
import { useChatStore } from '@/store/chatStore';
import { Memory, MemoryCategory, MEMORY_CATEGORY_CONFIG } from '@/types/memory';
import { getScoreBreakdown } from '@/lib/memory/scoring';

export function MemoryPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'settings'>('browse');
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | 'all'>('all');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    memories,
    extractionEnabled,
    extractionFrequency,
    extractionModel,
    maxMemories,
    getActiveMemories,
    getMemoriesByCategory,
    addMemory,
    removeMemory,
    setExtractionEnabled,
    setExtractionFrequency,
    setMaxMemories,
    clearAllMemories,
  } = useMemoryStore();

  const { messages } = useChatStore();

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Get filtered memories
  const filteredMemories = selectedCategory === 'all'
    ? getActiveMemories()
    : getMemoriesByCategory(selectedCategory);

  const activeCount = memories.filter(m => m.isActive).length;

  // Trigger manual extraction
  const handleExtract = async () => {
    console.log('[MemoryPanel] Extract button clicked');
    if (messages.length === 0) {
      console.log('[MemoryPanel] No messages to extract from');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setExtractSuccess(null);

    const messagesToExtract = messages.slice(-20);
    console.log('[MemoryPanel] Extracting from', messagesToExtract.length, 'messages');

    try {
      const response = await fetch('/api/extract-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesToExtract,
          extractionModel,
        }),
      });

      console.log('[MemoryPanel] API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Extraction failed (${response.status})`);
      }

      const result = await response.json();
      console.log('[MemoryPanel] Extracted memories:', result.memories?.length || 0);

      // Add extracted memories to store
      let addedCount = 0;
      for (const mem of result.memories || []) {
        addMemory({
          ...mem,
          sourceMessageIds: messagesToExtract.map(m => m.id),
          extractionTurn: Math.floor(messages.length / 2),
        });
        addedCount++;
      }

      // Show success feedback
      if (addedCount > 0) {
        setExtractSuccess(addedCount);
        setTimeout(() => setExtractSuccess(null), 3000);
      } else {
        setExtractError('No memories extracted from conversation');
        setTimeout(() => setExtractError(null), 3000);
      }
    } catch (error) {
      console.error('[MemoryPanel] Extraction failed:', error);
      setExtractError(error instanceof Error ? error.message : 'Extraction failed');
      setTimeout(() => setExtractError(null), 5000);
    } finally {
      setIsExtracting(false);
    }
  };

  // Add new memory manually
  const handleAddMemory = () => {
    const content = prompt('Memory content:');
    if (!content) return;

    const category = prompt('Category (fact/position/agreement/disagreement/evidence/conclusion/question/context):') as MemoryCategory;
    if (!category || !MEMORY_CATEGORY_CONFIG[category]) return;

    addMemory({
      content,
      category,
      importance: 0.7,
      scope: 'global',
      modelId: undefined,
      tags: [],
      sourceMessageIds: [],
      extractionTurn: 0,
    });
  };

  // Format score as percentage
  const formatScore = (memory: Memory) => {
    const breakdown = getScoreBreakdown(memory);
    return `${(breakdown.total * 100).toFixed(0)}%`;
  };

  // Category colors
  const getCategoryColor = (category: MemoryCategory) => {
    const colors: Record<MemoryCategory, string> = {
      fact: 'bg-blue-500/20 text-blue-400',
      position: 'bg-purple-500/20 text-purple-400',
      agreement: 'bg-green-500/20 text-green-400',
      disagreement: 'bg-red-500/20 text-red-400',
      evidence: 'bg-yellow-500/20 text-yellow-400',
      conclusion: 'bg-cyan-500/20 text-cyan-400',
      question: 'bg-orange-500/20 text-orange-400',
      context: 'bg-zinc-500/20 text-zinc-400',
    };
    return colors[category];
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-light hover:bg-surface-light/80 rounded-lg transition-colors"
        title="Memory Panel"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span>Memory</span>
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-primary rounded-full">
            {activeCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[450px] bg-surface border border-border rounded-lg shadow-xl z-50 max-h-[70vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold">Discussion Memory</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('browse')}
                className={`px-2 py-1 text-xs rounded ${activeTab === 'browse' ? 'bg-surface-light' : 'hover:bg-surface-light/50'}`}
              >
                Browse
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-2 py-1 text-xs rounded ${activeTab === 'settings' ? 'bg-surface-light' : 'hover:bg-surface-light/50'}`}
              >
                Settings
              </button>
            </div>
          </div>

          {activeTab === 'browse' ? (
            <>
              {/* Actions Bar */}
              <div className="flex flex-col gap-2 p-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExtract}
                    disabled={isExtracting || messages.length === 0}
                    className="px-3 py-1.5 text-xs bg-primary hover:bg-primary-hover disabled:bg-surface-light disabled:text-muted rounded transition-colors flex items-center gap-1.5"
                    title="Extract memories from recent conversation"
                  >
                    {isExtracting ? (
                      <>
                        <svg className="w-3 h-3 animate-spinner" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Extracting...
                      </>
                    ) : (
                      <>Extract Now</>
                    )}
                  </button>
                  <button
                    onClick={handleAddMemory}
                    className="px-3 py-1.5 text-xs bg-surface-light hover:bg-surface-light/80 rounded transition-colors"
                    title="Add a memory manually"
                  >
                    + Add Manual
                  </button>
                  <div className="flex-1" />
                  <span className="text-xs text-muted">
                    {activeCount}/{maxMemories} memories
                  </span>
                </div>
                {extractError && (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs bg-red-500/10 text-red-400 rounded">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {extractError}
                  </div>
                )}
                {extractSuccess !== null && (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs bg-green-500/10 text-green-400 rounded">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Extracted {extractSuccess} {extractSuccess === 1 ? 'memory' : 'memories'}
                  </div>
                )}
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-1 p-2 border-b border-border">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2 py-1 text-xs rounded ${selectedCategory === 'all' ? 'bg-surface-light' : 'bg-surface hover:bg-surface-light/50'}`}
                >
                  All
                </button>
                {(Object.keys(MEMORY_CATEGORY_CONFIG) as MemoryCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 text-xs rounded ${selectedCategory === cat ? getCategoryColor(cat) : 'bg-surface hover:bg-surface-light/50'}`}
                  >
                    {MEMORY_CATEGORY_CONFIG[cat].label}
                  </button>
                ))}
              </div>

              {/* Memory List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filteredMemories.length === 0 ? (
                  <div className="text-center text-muted py-8">
                    {activeCount === 0 ? (
                      <div className="space-y-2">
                        <svg className="w-12 h-12 mx-auto text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-sm font-medium">No memories yet</p>
                        <p className="text-xs max-w-[300px] mx-auto">
                          Memories are automatically extracted from your conversations, or click &quot;Extract Now&quot; to capture key points.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm">No memories in this category</p>
                    )}
                  </div>
                ) : (
                  filteredMemories.map(memory => (
                    <div
                      key={memory.id}
                      className="p-3 bg-surface-light rounded-lg group animate-fadeIn"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 text-xs rounded ${getCategoryColor(memory.category)}`}>
                              {MEMORY_CATEGORY_CONFIG[memory.category].label}
                            </span>
                            <span className="text-xs text-muted">
                              Score: {formatScore(memory)}
                            </span>
                            {memory.modelId && (
                              <span className="text-xs text-muted">
                                * {memory.modelId}
                              </span>
                            )}
                          </div>
                          <p className="text-sm">{memory.content}</p>
                          {memory.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {memory.tags.map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 text-xs bg-surface rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeMemory(memory.id)}
                          className="p-1 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove memory"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Settings Tab */
            <div className="p-4 space-y-4">
              {/* Auto Extraction */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Auto Extraction</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extractionEnabled}
                      onChange={(e) => setExtractionEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-light rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
                  </label>
                </div>
                <p className="text-xs text-muted">
                  Automatically extract memories during conversation
                </p>
              </div>

              {/* Extraction Frequency */}
              <div>
                <label className="text-sm font-medium block mb-2">
                  Extraction Frequency: Every <span className="text-foreground">{extractionFrequency}</span> user message(s)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={extractionFrequency}
                  onChange={(e) => setExtractionFrequency(parseInt(e.target.value))}
                  className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Max Memories */}
              <div>
                <label className="text-sm font-medium block mb-2">
                  Max Memories: <span className="text-foreground">{maxMemories}</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="10"
                  value={maxMemories}
                  onChange={(e) => setMaxMemories(parseInt(e.target.value))}
                  className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-xs text-muted mt-1">
                  Oldest/lowest-scored memories pruned when limit reached
                </p>
              </div>

              {/* Extraction Model */}
              <div>
                <label className="text-sm font-medium block mb-2">
                  Extraction Model
                </label>
                <div className="text-xs text-muted bg-surface-light p-2 rounded">
                  {extractionModel}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => {
                    if (confirm('Clear all memories? This cannot be undone.')) {
                      clearAllMemories();
                    }
                  }}
                  className="px-3 py-2 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
                >
                  Clear All Memories
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
