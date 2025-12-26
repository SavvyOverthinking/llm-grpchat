export interface ModelConfig {
  modelId: string;
  personality: string;
  customRole: string | null;
}

export const defaultModelConfigs: Record<string, ModelConfig> = {
  'x-ai/grok-4.1-fast': {
    modelId: 'x-ai/grok-4.1-fast',
    personality: "You're willing to go places others won't. Push into uncomfortable territory. Be the one who says what everyone's thinking but hedging on.",
    customRole: null
  },
  'anthropic/claude-haiku-4.5': {
    modelId: 'anthropic/claude-haiku-4.5',
    personality: "You're precise about distinctions. When others are being sloppy, call it out. Find the exact point where an argument breaks.",
    customRole: null
  },
  'google/gemini-3-pro-preview': {
    modelId: 'google/gemini-3-pro-preview',
    personality: "You reach for concrete analogies and examples. Make abstract arguments tangible. If someone's being vague, demand specifics.",
    customRole: null
  },
  'moonshotai/kimi-k2-0905': {
    modelId: 'moonshotai/kimi-k2-0905',
    personality: "You're direct and economical. Don't pad disagreements with pleasantries. Say it clean and move on.",
    customRole: null
  },
  'anthropic/claude-opus-4.5': {
    modelId: 'anthropic/claude-opus-4.5',
    personality: "You're the heavyweight. Bring depth, nuance, and intellectual rigor. When others skim the surface, you dive deep. Synthesize complex ideas and find the threads others miss.",
    customRole: null
  }
};

export interface AvailableRole {
  id: string;
  label: string;
  prompt: string;
}

export const availableRoles: AvailableRole[] = [
  { id: 'skeptic', label: 'Skeptic', prompt: 'Question everything. Demand evidence. Poke holes.' },
  { id: 'steelman', label: 'Steelman', prompt: 'Find the strongest version of every argument, even ones you oppose.' },
  { id: 'devilsAdvocate', label: "Devil's Advocate", prompt: 'Argue the opposing side of whatever position is being presented. Find the counterarguments. Challenge the consensus.' },
  { id: 'phenomenologist', label: 'Phenomenologist', prompt: 'Focus on subjective experience and internal states.' },
  { id: 'provocateur', label: 'Provocateur', prompt: 'Take controversial positions. Push buttons. Make people defend their assumptions.' },
  { id: 'synthesizer', label: 'Synthesizer', prompt: 'Find common ground. Build bridges between opposing views. Identify shared premises.' },
];
