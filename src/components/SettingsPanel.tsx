'use client';

import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { SelectionMode } from '@/types/throttle';

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [localSettingPrompt, setLocalSettingPrompt] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    settingPrompt,
    setSettingPrompt,
    throttleSettings,
    setThrottleEnabled,
    setMaxPerWave,
    setThrottleSettings,
  } = useChatStore();

  // Close panel when clicking outside
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

  // Sync local state when panel opens
  const handleOpen = () => {
    setLocalSettingPrompt(settingPrompt);
    setIsOpen(true);
  };

  // Save setting prompt
  const handleSaveSettingPrompt = () => {
    setSettingPrompt(localSettingPrompt);
  };

  // Clear setting prompt
  const handleClearSettingPrompt = () => {
    setLocalSettingPrompt('');
    setSettingPrompt('');
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Toggle Button */}
      <button
        onClick={() => isOpen ? setIsOpen(false) : handleOpen()}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-light hover:bg-surface-light/80 rounded-lg transition-colors"
        title="Configure discussion settings and wave throttling"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Settings</span>
        {(settingPrompt || throttleSettings.enabled) && (
          <span className="w-2 h-2 bg-yellow-500 rounded-full" title="Settings active" />
        )}
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-surface border border-border rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold">Discussion Settings</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Setting Prompt Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Setting / Scenario</label>
                {settingPrompt && (
                  <span className="text-xs text-green-500">Active</span>
                )}
              </div>
              <p className="text-xs text-muted mb-2">
                Global context that applies to all models. Use this to set up debate topics, scenarios, or constraints.
              </p>
              <textarea
                value={localSettingPrompt}
                onChange={(e) => setLocalSettingPrompt(e.target.value)}
                placeholder="e.g., 'You are debating the ethics of AI regulation. Take strong positions and challenge each other.'"
                className="w-full h-24 px-3 py-2 text-sm bg-surface-light border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveSettingPrompt}
                  disabled={localSettingPrompt === settingPrompt}
                  className="px-3 py-1 text-sm bg-primary hover:bg-primary-hover disabled:bg-surface-light disabled:text-muted rounded transition-colors"
                >
                  Apply
                </button>
                {settingPrompt && (
                  <button
                    onClick={handleClearSettingPrompt}
                    className="px-3 py-1 text-sm bg-surface-light hover:bg-surface-light/80 rounded transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Wave Throttling Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Wave Throttling</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={throttleSettings.enabled}
                    onChange={(e) => setThrottleEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-surface-light peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
                </label>
              </div>
              <p className="text-xs text-muted mb-3">
                When enabled, models respond in waves. Later waves can see and react to earlier responses.
              </p>

              {throttleSettings.enabled && (
                <div className="space-y-4 p-3 bg-surface-light rounded-lg">
                  {/* Max Per Wave */}
                  <div>
                    <label className="text-xs text-muted block mb-1">
                      Models per wave: <span className="text-foreground font-medium">{throttleSettings.maxPerWave}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={throttleSettings.maxPerWave}
                      onChange={(e) => setMaxPerWave(parseInt(e.target.value))}
                      className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted mt-1">
                      <span>1</span>
                      <span>5</span>
                    </div>
                  </div>

                  {/* Selection Mode */}
                  <div>
                    <label className="text-xs text-muted block mb-2">
                      Wave assignment
                    </label>
                    <div className="flex gap-2">
                      {(['random', 'roundrobin', 'priority'] as SelectionMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setThrottleSettings({ selectionMode: mode })}
                          className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                            throttleSettings.selectionMode === mode
                              ? 'bg-primary text-white'
                              : 'bg-surface text-muted hover:bg-surface/80'
                          }`}
                        >
                          {mode === 'roundrobin' ? 'Round Robin' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted mt-2">
                      {throttleSettings.selectionMode === 'random' && 'Models are randomly assigned to waves each round.'}
                      {throttleSettings.selectionMode === 'roundrobin' && 'Models rotate through waves in order.'}
                      {throttleSettings.selectionMode === 'priority' && 'Models respond in their sidebar order.'}
                    </p>
                  </div>

                  {/* Delay Between Waves */}
                  <div>
                    <label className="text-xs text-muted block mb-1">
                      Delay between waves: <span className="text-foreground font-medium">{throttleSettings.delayBetweenWaves}ms</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2000"
                      step="100"
                      value={throttleSettings.delayBetweenWaves}
                      onChange={(e) => setThrottleSettings({ delayBetweenWaves: parseInt(e.target.value) })}
                      className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted mt-1">
                      <span>0ms</span>
                      <span>2s</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border text-xs text-muted">
            Settings are saved automatically
          </div>
        </div>
      )}
    </div>
  );
}
