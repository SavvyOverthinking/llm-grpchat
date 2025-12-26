"use client";

import { useChatStore } from "@/store/chatStore";
import { availableRoles } from "@/lib/modelConfigs";

export function ModelSelector() {
  const availableModels = useChatStore((state) => state.availableModels);
  const activeModels = useChatStore((state) => state.activeModels);
  const toggleModel = useChatStore((state) => state.toggleModel);
  const modelConfigs = useChatStore((state) => state.modelConfigs);
  const setModelRole = useChatStore((state) => state.setModelRole);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
        Available Models
      </h3>
      {availableModels.map((model) => {
        const isActive = activeModels.some((m) => m.id === model.id);
        const currentRole = modelConfigs[model.id]?.customRole || "";
        return (
          <div key={model.id} className="space-y-1">
            <button
              onClick={() => toggleModel(model.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
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
              <select
                value={currentRole}
                onChange={(e) => {
                  e.stopPropagation();
                  setModelRole(model.id, e.target.value || null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full ml-6 px-2 py-1 text-xs bg-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ width: "calc(100% - 1.5rem)" }}
              >
                <option value="">No role assigned</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}
