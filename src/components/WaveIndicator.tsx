'use client';

import { useChatStore } from '@/store/chatStore';

export function WaveIndicator() {
  const { waveState, throttleSettings, activeModels } = useChatStore();

  // Don't show if throttling is disabled or only 1 wave
  if (!throttleSettings.enabled || waveState.totalWaves <= 1) {
    return null;
  }

  // Don't show if no waves are in progress
  if (waveState.currentWave === 0) {
    return null;
  }

  // Get model names for display
  const getModelName = (modelId: string) => {
    const model = activeModels.find(m => m.id === modelId);
    return model?.shortName || model?.name || modelId;
  };

  const respondingNames = waveState.respondingModels.map(getModelName);
  const completedCount = waveState.completedModels.length + waveState.passedModels.length;

  // Calculate overall progress
  const totalModels = activeModels.length;
  const allCompleted = waveState.completedModels.length + waveState.passedModels.length;
  const progressPercent = totalModels > 0 ? (allCompleted / totalModels) * 100 : 0;

  return (
    <div className="flex items-center justify-center gap-4 py-2 px-4 bg-surface/80 backdrop-blur-sm border-t border-border">
      {/* Wave Counter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Wave</span>
        <span className="text-sm font-mono font-bold text-primary-light">
          {waveState.currentWave}/{waveState.totalWaves}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="flex-1 max-w-xs">
        <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Currently Responding */}
      {respondingNames.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>
          <span className="text-xs text-foreground">
            {respondingNames.join(', ')}
          </span>
        </div>
      )}

      {/* Wave Dots */}
      <div className="flex items-center gap-1">
        {Array.from({ length: waveState.totalWaves }).map((_, idx) => {
          const waveNum = idx + 1;
          const isComplete = waveNum < waveState.currentWave;
          const isCurrent = waveNum === waveState.currentWave;

          return (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-colors ${
                isComplete
                  ? 'bg-green-500'
                  : isCurrent
                    ? 'bg-primary animate-pulse'
                    : 'bg-surface-light'
              }`}
              title={`Wave ${waveNum}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact version for tight spaces
 */
export function WaveIndicatorCompact() {
  const { waveState, throttleSettings } = useChatStore();

  if (!throttleSettings.enabled || waveState.totalWaves <= 1 || waveState.currentWave === 0) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-surface-light rounded text-xs">
      <span className="text-muted">Wave</span>
      <span className="font-mono text-primary-light">{waveState.currentWave}/{waveState.totalWaves}</span>
      <div className="flex gap-0.5 ml-1">
        {Array.from({ length: waveState.totalWaves }).map((_, idx) => (
          <div
            key={idx}
            className={`w-1.5 h-1.5 rounded-full ${
              idx + 1 < waveState.currentWave
                ? 'bg-green-500'
                : idx + 1 === waveState.currentWave
                  ? 'bg-primary'
                  : 'bg-surface'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
