"use client";

import { useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { availableRoles } from "@/lib/modelConfigs";

export function PromptModePanel() {
  const [isModesExpanded, setIsModesExpanded] = useState(false);
  const [isRolesExpanded, setIsRolesExpanded] = useState(false);

  const promptModes = useChatStore((state) => state.promptModes);
  const togglePromptMode = useChatStore((state) => state.togglePromptMode);
  const activeModels = useChatStore((state) => state.activeModels);
  const modelConfigs = useChatStore((state) => state.modelConfigs);
  const setModelRole = useChatStore((state) => state.setModelRole);

  const enabledCount = promptModes.filter((m) => m.enabled).length;

  return (
    <div className="space-y-2">
      {/* Prompt Modes Section */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setIsModesExpanded(!isModesExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-surface-light hover:bg-surface-light/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Prompt Modes
            </span>
            {enabledCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded">
                {enabledCount}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-muted transition-transform ${
              isModesExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isModesExpanded && (
          <div className="p-2 space-y-1 bg-background">
            {promptModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => togglePromptMode(mode.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                  mode.enabled
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-surface-light/50"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    mode.enabled
                      ? "bg-primary border-primary"
                      : "border-muted"
                  }`}
                >
                  {mode.enabled && (
                    <svg
                      className="w-3 h-3 text-background"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{mode.label}</div>
                  <div className="text-xs text-muted truncate">
                    {mode.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Per-Model Roles Section */}
      {activeModels.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setIsRolesExpanded(!isRolesExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 bg-surface-light hover:bg-surface-light/80 transition-colors"
          >
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Model Roles
            </span>
            <svg
              className={`w-4 h-4 text-muted transition-transform ${
                isRolesExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isRolesExpanded && (
            <div className="p-2 space-y-2 bg-background">
              {activeModels.map((model) => {
                const currentRole = modelConfigs[model.id]?.customRole || "";
                return (
                  <div key={model.id} className="space-y-1">
                    <div className="flex items-center gap-2 px-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: model.color }}
                      />
                      <span className="text-xs font-medium text-muted">
                        {model.shortName}
                      </span>
                    </div>
                    <select
                      value={currentRole}
                      onChange={(e) =>
                        setModelRole(model.id, e.target.value || null)
                      }
                      className="w-full px-2 py-1.5 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Default</option>
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
