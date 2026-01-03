// Speaker/Reporter Types for llm-grpchat 2.0
// Designated model for summaries and consolidated reports

export type SpeakerCommand =
  | 'summarize'     // Quick summary of debate
  | 'report'        // Formal report with structure
  | 'consensus'     // Areas of agreement only
  | 'conflicts'     // Areas of disagreement only
  | 'questions';    // Open questions raised

export interface SpeakerState {
  speakerId: string | null;        // Currently designated speaker model ID
  speakerMode: SpeakerCommand | null;  // Active command (null if not in speaker mode)
  lastSpeakerOutput?: string;      // Cache last output for reference
}

export const INITIAL_SPEAKER_STATE: SpeakerState = {
  speakerId: null,
  speakerMode: null,
  lastSpeakerOutput: undefined,
};

export interface SpeakerCommandConfig {
  command: SpeakerCommand;
  label: string;
  description: string;
  icon: string;
  format: 'prose' | 'structured' | 'bullets';
}

export const SPEAKER_COMMANDS: Record<SpeakerCommand, SpeakerCommandConfig> = {
  summarize: {
    command: 'summarize',
    label: 'Summarize',
    description: 'Provide a concise summary of the discussion',
    icon: '📝',
    format: 'prose',
  },
  report: {
    command: 'report',
    label: 'Full Report',
    description: 'Structured report with overview, arguments, consensus, conflicts',
    icon: '📊',
    format: 'structured',
  },
  consensus: {
    command: 'consensus',
    label: 'Consensus',
    description: 'List only points where all participants agree',
    icon: '✅',
    format: 'bullets',
  },
  conflicts: {
    command: 'conflicts',
    label: 'Conflicts',
    description: 'List disagreements and each model\'s position',
    icon: '⚔️',
    format: 'bullets',
  },
  questions: {
    command: 'questions',
    label: 'Open Questions',
    description: 'List unresolved questions from the discussion',
    icon: '❓',
    format: 'bullets',
  },
};

// Speaker actions (to be added to ChatState)
export interface SpeakerActions {
  setSpeaker: (modelId: string | null) => void;
  triggerSpeakerCommand: (command: SpeakerCommand) => void;
  clearSpeakerMode: () => void;
}

// Regex patterns for detecting speaker commands in messages
export const SPEAKER_COMMAND_PATTERNS: Record<SpeakerCommand, RegExp[]> = {
  summarize: [
    /\bsummarize\b/i,
    /\bsummary\b/i,
    /\bsum up\b/i,
    /\bwrap up\b/i,
  ],
  report: [
    /\breport\b/i,
    /\bfull report\b/i,
    /\bdetailed report\b/i,
  ],
  consensus: [
    /\bconsensus\b/i,
    /\bagreements?\b/i,
    /\bwhere .* agree\b/i,
  ],
  conflicts: [
    /\bconflicts?\b/i,
    /\bdisagreements?\b/i,
    /\bwhere .* disagree\b/i,
  ],
  questions: [
    /\bopen questions?\b/i,
    /\bunresolved\b/i,
    /\bquestions? remain\b/i,
  ],
};
