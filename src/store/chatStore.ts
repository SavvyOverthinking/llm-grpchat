import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { ChatState, Model, Message, ChatSessionSnapshot } from "@/types/chat";
import { useMemoryStore } from "./memoryStore";
import {
  ThrottleSettings,
  DEFAULT_THROTTLE_SETTINGS,
  WaveState,
  INITIAL_WAVE_STATE
} from "@/types/throttle";
import {
  SpeakerState,
  INITIAL_SPEAKER_STATE,
  SpeakerCommand
} from "@/types/speaker";
import { SessionListItem, DEFAULT_SESSION_NAME } from "@/types/session";
import { availableModels as defaultModels } from "@/lib/models";
import { defaultPromptModes } from "@/lib/promptModes";
import { defaultModelConfigs } from "@/lib/modelConfigs";

// Session storage key prefix
const SESSION_STORAGE_PREFIX = 'llm-grpchat-session-';

// Helper to save session to localStorage
function saveSessionToStorage(sessionId: string, snapshot: ChatSessionSnapshot & {
  id: string;
  name: string;
  createdAt: number;
  lastAccessedAt: number;
  messageCount: number;
  participantCount: number;
}): void {
  localStorage.setItem(
    `${SESSION_STORAGE_PREFIX}${sessionId}`,
    JSON.stringify(snapshot)
  );
}

// Helper to load session from localStorage
function loadSessionFromStorage(sessionId: string): (ChatSessionSnapshot & {
  id: string;
  name: string;
  createdAt: number;
  lastAccessedAt: number;
  messageCount: number;
  participantCount: number;
}) | null {
  const stored = localStorage.getItem(`${SESSION_STORAGE_PREFIX}${sessionId}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// Helper to delete session from localStorage
function deleteSessionFromStorage(sessionId: string): void {
  localStorage.removeItem(`${SESSION_STORAGE_PREFIX}${sessionId}`);
}

// Helper to get session list from localStorage
function getSessionListFromStorage(): SessionListItem[] {
  const sessions: SessionListItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SESSION_STORAGE_PREFIX)) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const session = JSON.parse(stored);
          sessions.push({
            id: session.id,
            name: session.name,
            createdAt: session.createdAt,
            lastAccessedAt: session.lastAccessedAt,
            messageCount: session.messageCount || session.messages?.length || 0,
            participantCount: session.participantCount || session.activeModelIds?.length || 0,
            tags: session.tags,
          });
        } catch {
          // Skip invalid sessions
        }
      }
    }
  }
  // Sort by last accessed, most recent first
  return sessions.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // === EXISTING STATE (preserved) ===
      messages: [],
      activeModels: [],
      availableModels: defaultModels,
      typingModels: [],
      contextWindowSize: 20,
      promptModes: defaultPromptModes,
      modelConfigs: defaultModelConfigs,

      // === NEW STATE ===

      // Setting prompt (global context for all models)
      settingPrompt: '',

      // Response wave throttling
      throttleSettings: { ...DEFAULT_THROTTLE_SETTINGS },
      waveState: { ...INITIAL_WAVE_STATE },

      // Speaker/reporter
      speakerState: { ...INITIAL_SPEAKER_STATE },

      // Session management
      sessions: [],
      currentSessionId: null,
      autoSaveEnabled: true,

      // === EXISTING ACTIONS (preserved) ===

      addMessage: (message) => {
        const id = uuidv4();
        set((state) => ({
          messages: [
            ...state.messages,
            { ...message, id, timestamp: Date.now() },
          ],
        }));

        // Auto-save if enabled
        const state = get();
        if (state.autoSaveEnabled && state.currentSessionId) {
          // Debounce auto-save (save after 2 seconds of no new messages)
          // For now, just mark that we need to save
        }

        return id;
      },

      updateMessage: (id, content) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        })),

      completeMessage: (id) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, isStreaming: false } : m
          ),
        })),

      setTyping: (modelId, modelName, isTyping) =>
        set((state) => ({
          typingModels: isTyping
            ? [...state.typingModels.filter((t) => t.modelId !== modelId), { modelId, modelName }]
            : state.typingModels.filter((t) => t.modelId !== modelId),
        })),

      toggleModel: (modelId) =>
        set((state) => {
          const model = state.availableModels.find((m) => m.id === modelId);
          if (!model) return state;

          const isCurrentlyActive = state.activeModels.some(
            (m) => m.id === modelId
          );
          return {
            activeModels: isCurrentlyActive
              ? state.activeModels.filter((m) => m.id !== modelId)
              : [...state.activeModels, { ...model, isActive: true }],
          };
        }),

      setContextWindowSize: (size) => set({ contextWindowSize: size }),

      clearChat: () => {
        set({
          messages: [],
          typingModels: [],
          waveState: { ...INITIAL_WAVE_STATE },
          speakerState: { ...INITIAL_SPEAKER_STATE },
        });
        // Also clear memories for a fresh start
        useMemoryStore.getState().clearAllMemories();
      },

      initializeModels: (models) => set({ availableModels: models }),

      togglePromptMode: (modeId) =>
        set((state) => ({
          promptModes: state.promptModes.map((m) =>
            m.id === modeId ? { ...m, enabled: !m.enabled } : m
          ),
        })),

      setModelRole: (modelId, roleId) =>
        set((state) => ({
          modelConfigs: {
            ...state.modelConfigs,
            [modelId]: {
              ...(state.modelConfigs[modelId] || { modelId, personality: '', customInstructions: '' }),
              customRole: roleId,
            },
          },
        })),

      setModelCustomInstructions: (modelId, instructions) =>
        set((state) => ({
          modelConfigs: {
            ...state.modelConfigs,
            [modelId]: {
              ...(state.modelConfigs[modelId] || { modelId, personality: '', customRole: null }),
              customInstructions: instructions,
            },
          },
        })),

      // === NEW ACTIONS ===

      // Setting Prompt
      setSettingPrompt: (prompt) => set({ settingPrompt: prompt }),

      // Throttle Settings
      setThrottleSettings: (settings) =>
        set((state) => ({
          throttleSettings: { ...state.throttleSettings, ...settings },
        })),

      setThrottleEnabled: (enabled) =>
        set((state) => ({
          throttleSettings: { ...state.throttleSettings, enabled },
        })),

      setMaxPerWave: (max) =>
        set((state) => ({
          throttleSettings: {
            ...state.throttleSettings,
            maxPerWave: Math.max(1, Math.min(10, max))
          },
        })),

      updateWaveState: (updates) =>
        set((state) => ({
          waveState: { ...state.waveState, ...updates },
        })),

      resetWaveState: () => set({ waveState: { ...INITIAL_WAVE_STATE } }),

      // Speaker
      setSpeaker: (modelId) =>
        set((state) => ({
          speakerState: {
            ...state.speakerState,
            speakerId: modelId,
            speakerMode: null,  // Reset mode when changing speaker
          },
        })),

      triggerSpeakerCommand: (command) =>
        set((state) => ({
          speakerState: { ...state.speakerState, speakerMode: command },
        })),

      clearSpeakerMode: () =>
        set((state) => ({
          speakerState: { ...state.speakerState, speakerMode: null },
        })),

      // Session Management
      createSession: (name) => {
        const id = uuidv4();
        const now = Date.now();
        const sessionName = name || `${DEFAULT_SESSION_NAME} ${new Date(now).toLocaleDateString()}`;

        // Create snapshot of current state
        const state = get();
        const snapshot = state.createSnapshot();

        // Save to localStorage
        saveSessionToStorage(id, {
          ...snapshot,
          id,
          name: sessionName,
          createdAt: now,
          lastAccessedAt: now,
          messageCount: snapshot.messages.length,
          participantCount: snapshot.activeModelIds.length,
        });

        // Update sessions list
        set({
          currentSessionId: id,
          sessions: getSessionListFromStorage(),
        });

        return id;
      },

      loadSession: (sessionId) => {
        const session = loadSessionFromStorage(sessionId);
        if (!session) {
          console.error(`Session ${sessionId} not found`);
          return;
        }

        // Load snapshot into state
        get().loadSnapshot({
          messages: session.messages,
          modelConfigs: session.modelConfigs,
          activeModelIds: session.activeModelIds,
          settingPrompt: session.settingPrompt,
          throttleSettings: session.throttleSettings,
          contextWindowSize: session.contextWindowSize,
          speakerState: session.speakerState,
        });

        // Update current session and last accessed time
        const now = Date.now();
        saveSessionToStorage(sessionId, {
          ...session,
          lastAccessedAt: now,
        });

        set({
          currentSessionId: sessionId,
          sessions: getSessionListFromStorage(),
        });
      },

      saveCurrentSession: () => {
        const state = get();
        if (!state.currentSessionId) {
          // Create new session if none exists
          state.createSession();
          return;
        }

        const existingSession = loadSessionFromStorage(state.currentSessionId);
        if (!existingSession) {
          console.error(`Cannot save: session ${state.currentSessionId} not found`);
          return;
        }

        const snapshot = state.createSnapshot();
        const now = Date.now();

        saveSessionToStorage(state.currentSessionId, {
          ...snapshot,
          id: state.currentSessionId,
          name: existingSession.name,
          createdAt: existingSession.createdAt,
          lastAccessedAt: now,
          messageCount: snapshot.messages.length,
          participantCount: snapshot.activeModelIds.length,
        });

        set({ sessions: getSessionListFromStorage() });
      },

      deleteSession: (sessionId) => {
        deleteSessionFromStorage(sessionId);

        const state = get();
        if (state.currentSessionId === sessionId) {
          set({ currentSessionId: null });
        }

        set({ sessions: getSessionListFromStorage() });
      },

      renameSession: (sessionId, name) => {
        const session = loadSessionFromStorage(sessionId);
        if (!session) return;

        saveSessionToStorage(sessionId, {
          ...session,
          name,
        });

        set({ sessions: getSessionListFromStorage() });
      },

      getSessionList: () => {
        return getSessionListFromStorage();
      },

      setAutoSave: (enabled) => set({ autoSaveEnabled: enabled }),

      // Snapshot Helpers
      createSnapshot: (): ChatSessionSnapshot => {
        const state = get();
        const memoryState = useMemoryStore.getState();
        return {
          messages: state.messages,
          modelConfigs: state.modelConfigs,
          activeModelIds: state.activeModels.map(m => m.id),
          settingPrompt: state.settingPrompt,
          throttleSettings: state.throttleSettings,
          contextWindowSize: state.contextWindowSize,
          speakerState: state.speakerState,
          memories: memoryState.memories,  // Include session memories
        };
      },

      loadSnapshot: (snapshot) => {
        const state = get();

        // Reconstruct activeModels from IDs
        const activeModels = snapshot.activeModelIds
          .map(id => state.availableModels.find(m => m.id === id))
          .filter((m): m is Model => m !== undefined)
          .map(m => ({ ...m, isActive: true }));

        set({
          messages: snapshot.messages,
          modelConfigs: snapshot.modelConfigs,
          activeModels,
          settingPrompt: snapshot.settingPrompt,
          throttleSettings: snapshot.throttleSettings,
          contextWindowSize: snapshot.contextWindowSize,
          speakerState: snapshot.speakerState,
          waveState: { ...INITIAL_WAVE_STATE },  // Reset wave state on load
          typingModels: [],  // Clear typing indicators
        });

        // Restore session memories
        const memoryStore = useMemoryStore.getState();
        memoryStore.replaceAllMemories(snapshot.memories || []);
      },
    }),
    {
      name: 'llm-grpchat-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields to main store
        // Sessions are stored separately
        contextWindowSize: state.contextWindowSize,
        promptModes: state.promptModes,
        modelConfigs: state.modelConfigs,
        settingPrompt: state.settingPrompt,
        throttleSettings: state.throttleSettings,
        autoSaveEnabled: state.autoSaveEnabled,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);

// Initialize sessions list on store creation
// This runs once when the store is first accessed
if (typeof window !== 'undefined') {
  const initialSessions = getSessionListFromStorage();
  useChatStore.setState({ sessions: initialSessions });
}
