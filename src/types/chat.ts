// Core Chat Types for llm-grpchat 2.0

import { ThrottleSettings, DEFAULT_THROTTLE_SETTINGS, WaveState, INITIAL_WAVE_STATE } from './throttle';
import { SpeakerState, INITIAL_SPEAKER_STATE, SpeakerCommand } from './speaker';
import { SessionListItem } from './session';

export interface Model {
  id: string;
  name: string;
  shortName: string;
  provider: string;
  color: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
  modelName?: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: boolean;                 // Indicates message had an error
}

export interface TypingState {
  modelId: string;
  modelName: string;
}

export interface PromptMode {
  id: string;
  label: string;
  description: string;
  promptAddition: string;
  enabled: boolean;
}

export interface ModelConfig {
  modelId: string;
  personality: string;
  customRole: string | null;
  customInstructions: string;
}

// Session snapshot for save/restore
export interface ChatSessionSnapshot {
  messages: Message[];
  modelConfigs: Record<string, ModelConfig>;
  activeModelIds: string[];
  settingPrompt: string;
  throttleSettings: ThrottleSettings;
  contextWindowSize: number;
  speakerState: SpeakerState;
}

export interface ChatState {
  // === EXISTING FIELDS ===
  messages: Message[];
  activeModels: Model[];
  availableModels: Model[];
  typingModels: TypingState[];
  contextWindowSize: number;
  promptModes: PromptMode[];
  modelConfigs: Record<string, ModelConfig>;

  // === NEW FIELDS ===

  // Setting prompt (global context for all models)
  settingPrompt: string;

  // Response wave throttling
  throttleSettings: ThrottleSettings;
  waveState: WaveState;

  // Speaker/reporter
  speakerState: SpeakerState;

  // Session management
  sessions: SessionListItem[];
  currentSessionId: string | null;
  autoSaveEnabled: boolean;

  // === EXISTING ACTIONS ===
  addMessage: (message: Omit<Message, "id" | "timestamp">) => string;
  updateMessage: (id: string, content: string) => void;
  completeMessage: (id: string) => void;
  setTyping: (modelId: string, modelName: string, isTyping: boolean) => void;
  toggleModel: (modelId: string) => void;
  setContextWindowSize: (size: number) => void;
  clearChat: () => void;
  initializeModels: (models: Model[]) => void;
  togglePromptMode: (modeId: string) => void;
  setModelRole: (modelId: string, roleId: string | null) => void;
  setModelCustomInstructions: (modelId: string, instructions: string) => void;

  // === NEW ACTIONS ===

  // Setting prompt
  setSettingPrompt: (prompt: string) => void;

  // Throttle settings
  setThrottleSettings: (settings: Partial<ThrottleSettings>) => void;
  setThrottleEnabled: (enabled: boolean) => void;
  setMaxPerWave: (max: number) => void;
  updateWaveState: (state: Partial<WaveState>) => void;
  resetWaveState: () => void;

  // Speaker
  setSpeaker: (modelId: string | null) => void;
  triggerSpeakerCommand: (command: SpeakerCommand) => void;
  clearSpeakerMode: () => void;

  // Session management
  createSession: (name?: string) => string;
  loadSession: (sessionId: string) => void;
  saveCurrentSession: () => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, name: string) => void;
  getSessionList: () => SessionListItem[];
  setAutoSave: (enabled: boolean) => void;

  // Snapshot helpers
  createSnapshot: () => ChatSessionSnapshot;
  loadSnapshot: (snapshot: ChatSessionSnapshot) => void;
}

// Re-export defaults for convenience
export { DEFAULT_THROTTLE_SETTINGS, INITIAL_WAVE_STATE } from './throttle';
export { INITIAL_SPEAKER_STATE } from './speaker';
