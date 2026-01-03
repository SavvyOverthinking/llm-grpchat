// Session Management Types for llm-grpchat 2.0
// Enables save/restore of complete conversation state

import { Message, ModelConfig } from './chat';
import { Memory } from './memory';
import { ThrottleSettings } from './throttle';
import { SpeakerState } from './speaker';

export interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  lastAccessedAt: number;

  // Core state snapshot
  messages: Message[];
  modelConfigs: Record<string, ModelConfig>;
  activeModelIds: string[];

  // Settings
  settingPrompt: string;
  throttleSettings: ThrottleSettings;
  contextWindowSize: number;

  // Memory snapshot
  memories: Memory[];

  // Speaker state
  speakerState: SpeakerState;

  // Metadata
  messageCount: number;
  participantCount: number;
  tags?: string[];
  description?: string;
}

export interface SessionListItem {
  id: string;
  name: string;
  createdAt: number;
  lastAccessedAt: number;
  messageCount: number;
  participantCount: number;
  tags?: string[];
}

// Session management actions (to be added to ChatState)
export interface SessionActions {
  // Session CRUD
  createSession: (name?: string) => string;
  loadSession: (sessionId: string) => void;
  saveCurrentSession: () => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, name: string) => void;

  // Session metadata
  getSessionList: () => SessionListItem[];
  getCurrentSessionId: () => string | null;
  getCurrentSessionName: () => string;

  // Import/Export
  exportSession: (sessionId: string) => ChatSession;
  importSession: (session: ChatSession) => string;

  // Auto-save
  setAutoSave: (enabled: boolean) => void;
}

export const DEFAULT_SESSION_NAME = 'Untitled Discussion';
