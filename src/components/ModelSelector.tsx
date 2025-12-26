"use client";

import { useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { availableRoles } from "@/lib/modelConfigs";
import { Model } from "@/types/chat";

interface ModelSettingsModalProps {
  model: Model;
  isOpen: boolean;
  onClose: () => void;
}

function ModelSettingsModal({ model, isOpen, onClose }: ModelSettingsModalProps) {
  const modelConfigs = useChatStore((state) => state.modelConfigs);
  const setModelRole = useChatStore((state) => state.setModelRole);
  const setModelCustomInstructions = useChatStore((state) => state.setModelCustomInstructions);

  const config = modelConfigs[model.id];
  const [instructions, setInstructions] = useState(config?.customInstructions || "");

  if (!isOpen) return null;

  const handleSave = () => {
    setModelCustomInstructions(model.id, instructions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-lg w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: model.color }}
            />
            <h2 className="text-lg font-semibold">{model.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Role</label>
            <select
              value={config?.customRole || ""}
              onChange={(e) => setModelRole(model.id, e.target.value || null)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">No role assigned</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Custom Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Add custom instructions for this model..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none h-32"
            />
            <p className="text-xs text-muted mt-1">Session only - cleared on refresh</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModelSelector() {
  const availableModels = useChatStore((state) => state.availableModels);
  const activeModels = useChatStore((state) => state.activeModels);
  const toggleModel = useChatStore((state) => state.toggleModel);
  const modelConfigs = useChatStore((state) => state.modelConfigs);

  const [settingsModel, setSettingsModel] = useState<Model | null>(null);

  return (
    <>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          Available Models
        </h3>
        {availableModels.map((model) => {
          const isActive = activeModels.some((m) => m.id === model.id);
          const hasCustomConfig = modelConfigs[model.id]?.customRole || modelConfigs[model.id]?.customInstructions;
          return (
            <div key={model.id} className="space-y-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleModel(model.id)}
                  className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    isActive
                      ? "bg-surface-light border border-border"
                      : "hover:bg-surface-light/50"
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full transition-all ${
                      isActive ? "ring-2 ring-offset-2 ring-offset-background" : ""
                    }`}
                    style={{
                      backgroundColor: model.color,
                      "--tw-ring-color": model.color,
                    } as React.CSSProperties}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{model.name}</div>
                    <div className="text-xs text-muted truncate">@{model.shortName}</div>
                  </div>
                  {isActive && (
                    <div className="text-xs text-primary font-medium">Active</div>
                  )}
                </button>
                {isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSettingsModel(model);
                    }}
                    className={`p-2 rounded-lg hover:bg-surface-light transition-colors ${
                      hasCustomConfig ? "text-primary" : "text-muted"
                    }`}
                    title="Model settings"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {settingsModel && (
        <ModelSettingsModal
          model={settingsModel}
          isOpen={true}
          onClose={() => setSettingsModel(null)}
        />
      )}
    </>
  );
}
