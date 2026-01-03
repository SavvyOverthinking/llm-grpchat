'use client';

import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { SpeakerCommand, SPEAKER_COMMANDS } from '@/types/speaker';
import { buildSpeakerTriggerMessage } from '@/lib/speakerPrompt';

interface SpeakerControlsProps {
  onTriggerMessage?: (message: string) => void;
}

export function SpeakerControls({ onTriggerMessage }: SpeakerControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    activeModels,
    speakerState,
    setSpeaker,
    triggerSpeakerCommand,
    clearSpeakerMode,
  } = useChatStore();

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

  // Get current speaker model
  const speakerModel = activeModels.find(m => m.id === speakerState.speakerId);

  // Handle selecting a speaker
  const handleSelectSpeaker = (modelId: string) => {
    setSpeaker(modelId);
  };

  // Handle triggering a command
  const handleCommand = (command: SpeakerCommand) => {
    if (!speakerModel) {
      alert('Please select a speaker first');
      return;
    }

    // Set the command in state
    triggerSpeakerCommand(command);

    // Generate the trigger message
    const message = buildSpeakerTriggerMessage(command, speakerModel);

    // If callback provided, send the message
    if (onTriggerMessage) {
      onTriggerMessage(message);
    }

    setIsOpen(false);
  };

  // Command icons
  const commandIcons: Record<SpeakerCommand, string> = {
    summarize: 'M',
    report: 'R',
    consensus: 'C',
    conflicts: 'X',
    questions: '?',
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-light hover:bg-surface-light/80 rounded-lg transition-colors"
        title="Designate a model to summarize or report on the discussion"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <span>Speaker</span>
        {speakerModel && (
          <span
            className="px-1.5 py-0.5 text-xs rounded"
            style={{ backgroundColor: speakerModel.color + '30', color: speakerModel.color }}
          >
            {speakerModel.shortName}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-surface border border-border rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="p-3 border-b border-border">
            <h3 className="font-semibold">Speaker / Reporter</h3>
            <p className="text-xs text-muted mt-1">
              Designate a model to summarize or report on the discussion
            </p>
          </div>

          {/* Speaker Selection */}
          <div className="p-3 border-b border-border">
            <label className="text-xs text-muted block mb-2">Designated Speaker</label>
            {activeModels.length === 0 ? (
              <div className="text-sm text-muted">No active models</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeModels.map(model => (
                  <button
                    key={model.id}
                    onClick={() => handleSelectSpeaker(model.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      speakerState.speakerId === model.id
                        ? 'ring-2 ring-primary'
                        : 'hover:bg-surface-light'
                    }`}
                    style={{
                      backgroundColor: speakerState.speakerId === model.id
                        ? model.color + '30'
                        : 'transparent',
                      borderColor: model.color,
                      border: '1px solid'
                    }}
                  >
                    <span style={{ color: model.color }}>{model.shortName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Commands */}
          <div className="p-3">
            <label className="text-xs text-muted block mb-2">Quick Commands</label>
            <div className="space-y-2">
              {(Object.entries(SPEAKER_COMMANDS) as [SpeakerCommand, typeof SPEAKER_COMMANDS[SpeakerCommand]][]).map(([command, config]) => (
                <button
                  key={command}
                  onClick={() => handleCommand(command)}
                  disabled={!speakerModel}
                  className="w-full flex items-center gap-3 p-2 text-left bg-surface-light hover:bg-surface-light/80 disabled:bg-surface-light/50 disabled:text-muted rounded-lg transition-colors"
                >
                  <span className="w-6 h-6 flex items-center justify-center text-sm bg-surface rounded">
                    {commandIcons[command]}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{config.label}</div>
                    <div className="text-xs text-muted">{config.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Current Status */}
          {speakerState.speakerMode && speakerModel && (
            <div className="p-3 border-t border-border bg-primary/10">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span style={{ color: speakerModel.color }}>{speakerModel.shortName}</span>
                  <span className="text-muted"> is preparing: </span>
                  <span className="text-foreground">{SPEAKER_COMMANDS[speakerState.speakerMode].label}</span>
                </div>
                <button
                  onClick={() => clearSpeakerMode()}
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Footer Tip */}
          <div className="p-2 border-t border-border text-xs text-muted text-center">
            Tip: You can also type <code className="bg-surface-light px-1 rounded">@Model summarize</code> in chat
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Inline speaker badge for showing current speaker in chat area
 */
export function SpeakerBadge() {
  const { activeModels, speakerState } = useChatStore();

  if (!speakerState.speakerId) return null;

  const speaker = activeModels.find(m => m.id === speakerState.speakerId);
  if (!speaker) return null;

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full"
      style={{ backgroundColor: speaker.color + '20', color: speaker.color }}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      <span>Speaker: {speaker.shortName}</span>
      {speakerState.speakerMode && (
        <span className="opacity-70">({SPEAKER_COMMANDS[speakerState.speakerMode].label})</span>
      )}
    </div>
  );
}
