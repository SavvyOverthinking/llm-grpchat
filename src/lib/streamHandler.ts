import { Model } from '@/types/chat';
import { Memory } from '@/types/memory';
import { WaveContext } from '@/types/throttle';
import { SpeakerCommand } from '@/types/speaker';

interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

// Extended options for 2.0 features
interface StreamOptions {
  settingPrompt?: string;
  memories?: Memory[];
  waveContext?: WaveContext[];
  speakerMode?: SpeakerCommand | null;
  activeModels?: Model[];
  contextWindowSize?: number;
  promptModes?: unknown[];
  modelConfigs?: Record<string, unknown>;
}

// Track active abort controllers for cancellation
const activeControllers = new Map<string, AbortController>();

export function stopAllStreams(): void {
  activeControllers.forEach((controller) => {
    controller.abort();
  });
  activeControllers.clear();
}

export function stopStream(modelId: string): void {
  const controller = activeControllers.get(modelId);
  if (controller) {
    controller.abort();
    activeControllers.delete(modelId);
  }
}

export function hasActiveStreams(): boolean {
  return activeControllers.size > 0;
}

/**
 * Clean identity confusion patterns from model responses
 * Removes "ModelName said:" patterns and self-identification prefixes
 */
export function cleanIdentityConfusion(
  response: string,
  modelName: string,
  otherModelNames: string[]
): string {
  let cleaned = response;

  // Remove "ModelName said:" or "ModelName says:" patterns for other models
  for (const other of otherModelNames) {
    // Match various forms: "ModelName said:", "ModelName says:", "ModelName:"
    const patterns = [
      new RegExp(`\\b${other}\\s+(said|says)\\s*:?\\s*`, 'gi'),
      new RegExp(`^\\s*${other}\\s*:\\s*`, 'gim'),
      new RegExp(`\\[${other}\\]\\s*:?\\s*`, 'gi'),
    ];
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '');
    }
  }

  // Remove self-identification prefixes
  const selfPatterns = [
    new RegExp(`^\\s*\\[?${modelName}\\]?\\s*:?\\s*`, 'i'),
    new RegExp(`^\\s*As ${modelName},?\\s*`, 'i'),
    new RegExp(`^\\s*Speaking as ${modelName},?\\s*`, 'i'),
  ];
  for (const pattern of selfPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove XML message tags if model accidentally outputs them
  cleaned = cleaned.replace(/<message from="[^"]*">\s*/gi, '');
  cleaned = cleaned.replace(/\s*<\/message>/gi, '');

  return cleaned.trim();
}

export async function streamModelResponse(
  model: Model | string,
  messages: { role: string; content: string }[],
  callbacks: StreamCallbacks,
  options: StreamOptions = {}
): Promise<void> {
  const { onToken, onComplete, onError } = callbacks;
  const modelId = typeof model === 'string' ? model : model.id;

  // Create abort controller for this request
  const controller = new AbortController();
  activeControllers.set(modelId, controller);

  try {
    // Build request body with 2.0 features
    const requestBody: Record<string, unknown> = {
      model: model,
      messages,
      activeModels: options.activeModels || [],
      contextWindowSize: options.contextWindowSize || 20,
      promptModes: options.promptModes || [],
      modelConfigs: options.modelConfigs || {},
    };

    // Add 2.0 optional params if provided
    if (options.settingPrompt) {
      requestBody.settingPrompt = options.settingPrompt;
    }
    if (options.memories && options.memories.length > 0) {
      requestBody.memories = options.memories;
    }
    if (options.waveContext && options.waveContext.length > 0) {
      requestBody.waveContext = options.waveContext;
    }
    if (options.speakerMode) {
      requestBody.speakerMode = options.speakerMode;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Try to get error details from response body
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody.error) {
          errorMessage = `${errorBody.error} (${response.status})`;
        }
      } catch {
        // Ignore JSON parse errors
      }
      onError(new Error(errorMessage));
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response body");
    }

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Check if aborted
      if (controller.signal.aborted) {
        reader.cancel();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            activeControllers.delete(modelId);
            onComplete();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              onToken(parsed.content);
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    activeControllers.delete(modelId);
    onComplete();
  } catch (error) {
    activeControllers.delete(modelId);
    if ((error as Error).name === "AbortError") {
      onComplete(); // Treat abort as completion (message stays as-is)
      return;
    }
    onError(error as Error);
  }
}
