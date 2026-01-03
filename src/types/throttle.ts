// Response Wave Throttling Types for llm-grpchat 2.0
// Coordinates multi-model responses to enable contextual awareness

export type SelectionMode = 'random' | 'roundrobin' | 'priority';

export interface WaveContext {
  modelId: string;
  modelName: string;
  responseSnippet: string;    // First ~200 chars or key excerpt
  tone: string;               // "analytical", "skeptical", "agreeable", etc.
}

export interface ResponseWave {
  waveNumber: number;
  respondingModels: string[];  // Model IDs in this wave
  maxPerWave: number;
  contextFromPreviousWaves: WaveContext[];
}

export interface ThrottleSettings {
  enabled: boolean;
  maxPerWave: number;           // How many models respond per wave
  delayBetweenWaves: number;    // Milliseconds between waves
  selectionMode: SelectionMode;
  showWaveIndicator: boolean;   // Show wave progress in UI
  allowPassing: boolean;        // Allow models to pass if nothing to add
}

export const DEFAULT_THROTTLE_SETTINGS: ThrottleSettings = {
  enabled: true,
  maxPerWave: 2,
  delayBetweenWaves: 500,
  selectionMode: 'random',
  showWaveIndicator: true,
  allowPassing: true,
};

// Wave state for tracking progress
export interface WaveState {
  currentWave: number;
  totalWaves: number;
  respondingModels: string[];
  completedModels: string[];
  passedModels: string[];
  waveContexts: WaveContext[];
}

export const INITIAL_WAVE_STATE: WaveState = {
  currentWave: 0,
  totalWaves: 0,
  respondingModels: [],
  completedModels: [],
  passedModels: [],
  waveContexts: [],
};
