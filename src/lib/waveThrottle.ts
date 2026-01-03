// Wave Throttling System for llm-grpchat 2.0
// Coordinates multi-model responses to enable contextual awareness

import { Model } from '@/types/chat';
import {
  ThrottleSettings,
  WaveContext,
  ResponseWave,
  WaveState,
  SelectionMode,
  DEFAULT_THROTTLE_SETTINGS,
  INITIAL_WAVE_STATE,
} from '@/types/throttle';

/**
 * Build response waves from active models based on throttle settings
 * Splits models into groups that will respond sequentially
 */
export function buildResponseWaves(
  activeModels: Model[],
  settings: ThrottleSettings,
  roundRobinIndex: number = 0
): ResponseWave[] {
  // If throttling disabled or no models, return single wave with all
  if (!settings.enabled || activeModels.length === 0) {
    return [{
      waveNumber: 1,
      respondingModels: activeModels.map(m => m.id),
      maxPerWave: activeModels.length,
      contextFromPreviousWaves: [],
    }];
  }

  // Sort models based on selection mode
  let sortedModels: Model[];

  switch (settings.selectionMode) {
    case 'random':
      sortedModels = shuffleArray([...activeModels]);
      break;

    case 'roundrobin':
      // Rotate starting position based on index
      const idx = roundRobinIndex % activeModels.length;
      sortedModels = [
        ...activeModels.slice(idx),
        ...activeModels.slice(0, idx),
      ];
      break;

    case 'priority':
      // For now, same as order in activeModels
      // Future: could use a priority field on models
      sortedModels = [...activeModels];
      break;

    default:
      sortedModels = [...activeModels];
  }

  // Split into waves of maxPerWave size
  const waves: ResponseWave[] = [];
  for (let i = 0; i < sortedModels.length; i += settings.maxPerWave) {
    const waveModels = sortedModels.slice(i, i + settings.maxPerWave);
    waves.push({
      waveNumber: waves.length + 1,
      respondingModels: waveModels.map(m => m.id),
      maxPerWave: settings.maxPerWave,
      contextFromPreviousWaves: [], // Will be filled as waves complete
    });
  }

  return waves;
}

/**
 * Fisher-Yates shuffle for random selection mode
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Infer emotional/analytical tone from response content
 * Used to give Wave 2+ models context about how earlier models responded
 */
export function inferTone(response: string): string {
  const lower = response.toLowerCase();

  // Check for disagreement signals
  if (
    lower.includes('disagree') ||
    lower.includes('however') ||
    lower.includes('but ') ||
    lower.includes('on the contrary') ||
    lower.includes('i would argue')
  ) {
    return 'skeptical';
  }

  // Check for agreement signals
  if (
    lower.includes('agree') ||
    lower.includes('exactly') ||
    lower.includes('correct') ||
    lower.includes('well said') ||
    lower.includes('good point')
  ) {
    return 'agreeable';
  }

  // Check for analytical signals
  if (
    lower.includes('evidence') ||
    lower.includes('data') ||
    lower.includes('study') ||
    lower.includes('research') ||
    lower.includes('statistic')
  ) {
    return 'analytical';
  }

  // Check for questioning
  if (lower.includes('?') && lower.split('?').length > 2) {
    return 'questioning';
  }

  // Check for cautious/hedging
  if (
    lower.includes('might') ||
    lower.includes('perhaps') ||
    lower.includes('possibly') ||
    lower.includes('it depends')
  ) {
    return 'cautious';
  }

  // Check for confident/assertive
  if (
    lower.includes('clearly') ||
    lower.includes('obviously') ||
    lower.includes('certainly') ||
    lower.includes('without doubt')
  ) {
    return 'confident';
  }

  return 'neutral';
}

/**
 * Extract context from a completed response for use by later waves
 */
export function extractWaveContext(
  response: string,
  model: Model
): WaveContext {
  // Get first ~200 chars or first complete sentence
  let snippet = response.substring(0, 200);
  const sentenceEnd = response.search(/[.!?]\s/);
  if (sentenceEnd > 0 && sentenceEnd < 200) {
    snippet = response.substring(0, sentenceEnd + 1);
  }

  // Clean up - remove asterisk actions for cleaner context
  snippet = snippet.replace(/\*[^*]+\*/g, '').trim();
  if (snippet.length > 180) {
    snippet = snippet.substring(0, 180) + '...';
  }

  return {
    modelId: model.id,
    modelName: model.shortName || model.name,
    responseSnippet: snippet,
    tone: inferTone(response),
  };
}

/**
 * Build prompt section for Wave 2+ models
 * Gives them context about what earlier models said
 */
export function buildWaveContextPrompt(previousWaves: WaveContext[]): string {
  if (previousWaves.length === 0) {
    return '';
  }

  const lines = previousWaves.map(w =>
    `[${w.modelName} responded (${w.tone}): "${w.responseSnippet}"]`
  );

  return `
## OTHER MODELS HAVE ALREADY RESPONDED

${lines.join('\n')}

You can reference, react to, or build on what they said. You're responding AFTER them, not simultaneously.
- You can agree, disagree, or add to their points
- You can reference their tone or approach
- If you have nothing unique to add, you may respond with: [PASS]
`;
}

/**
 * Check if a response is a pass/skip response
 */
export function isPassResponse(response: string): boolean {
  const normalized = response.trim().toLowerCase();
  return (
    normalized.startsWith('[pass') ||
    normalized.startsWith('pass -') ||
    normalized === '[pass]' ||
    normalized === 'pass' ||
    normalized.includes('[pass - nothing to add]')
  );
}

/**
 * Get wave info for display in UI
 */
export function getWaveDisplayInfo(
  waves: ResponseWave[],
  activeModels: Model[]
): { totalWaves: number; waveDescriptions: string[] } {
  const waveDescriptions = waves.map((wave, idx) => {
    const modelNames = wave.respondingModels
      .map(id => activeModels.find(m => m.id === id)?.shortName || id)
      .join(', ');
    return `Wave ${idx + 1}: ${modelNames}`;
  });

  return {
    totalWaves: waves.length,
    waveDescriptions,
  };
}

/**
 * Calculate which wave a model is in
 */
export function getModelWave(modelId: string, waves: ResponseWave[]): number {
  for (const wave of waves) {
    if (wave.respondingModels.includes(modelId)) {
      return wave.waveNumber;
    }
  }
  return 0; // Not found
}

/**
 * Check if all models in a wave have completed
 */
export function isWaveComplete(
  wave: ResponseWave,
  completedModels: string[],
  passedModels: string[]
): boolean {
  return wave.respondingModels.every(
    modelId => completedModels.includes(modelId) || passedModels.includes(modelId)
  );
}

/**
 * Get the next wave that should respond
 * Returns null if all waves are complete
 */
export function getNextWave(
  waves: ResponseWave[],
  completedModels: string[],
  passedModels: string[]
): ResponseWave | null {
  for (const wave of waves) {
    if (!isWaveComplete(wave, completedModels, passedModels)) {
      return wave;
    }
  }
  return null;
}

/**
 * Update wave state after a model completes its response
 */
export function updateWaveStateAfterResponse(
  currentState: WaveState,
  modelId: string,
  response: string,
  model: Model,
  passed: boolean = false
): WaveState {
  const newState = { ...currentState };

  if (passed || isPassResponse(response)) {
    newState.passedModels = [...currentState.passedModels, modelId];
  } else {
    newState.completedModels = [...currentState.completedModels, modelId];
    // Add context for future waves
    newState.waveContexts = [
      ...currentState.waveContexts,
      extractWaveContext(response, model),
    ];
  }

  // Remove from responding
  newState.respondingModels = currentState.respondingModels.filter(id => id !== modelId);

  return newState;
}

/**
 * Initialize wave state for a new round of responses
 */
export function initializeWaveState(waves: ResponseWave[]): WaveState {
  if (waves.length === 0) {
    return { ...INITIAL_WAVE_STATE };
  }

  return {
    currentWave: 1,
    totalWaves: waves.length,
    respondingModels: waves[0].respondingModels,
    completedModels: [],
    passedModels: [],
    waveContexts: [],
  };
}

/**
 * Advance to the next wave
 * Returns updated state, or null if all waves complete
 */
export function advanceToNextWave(
  currentState: WaveState,
  waves: ResponseWave[]
): WaveState | null {
  const nextWaveNumber = currentState.currentWave + 1;

  if (nextWaveNumber > waves.length) {
    return null; // All waves complete
  }

  const nextWave = waves[nextWaveNumber - 1];

  // Pass accumulated context to the next wave
  nextWave.contextFromPreviousWaves = [...currentState.waveContexts];

  return {
    ...currentState,
    currentWave: nextWaveNumber,
    respondingModels: nextWave.respondingModels,
  };
}

/**
 * Get models that should respond in the current wave
 */
export function getCurrentWaveModels(
  state: WaveState,
  activeModels: Model[]
): Model[] {
  return state.respondingModels
    .map(id => activeModels.find(m => m.id === id))
    .filter((m): m is Model => m !== undefined);
}

/**
 * Check if throttling will create multiple waves
 */
export function willHaveMultipleWaves(
  activeModelsCount: number,
  settings: ThrottleSettings
): boolean {
  if (!settings.enabled) return false;
  return activeModelsCount > settings.maxPerWave;
}
