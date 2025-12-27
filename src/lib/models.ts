import { Model } from "@/types/chat";

const modelColors = [
  "#ef4444", // red (Kimi)
  "#22c55e", // green (Gemini)
  "#f97316", // orange (Haiku)
  "#3b82f6", // blue (Grok)
  "#a855f7", // purple (Opus)
  "#76b900", // NVIDIA green (Nemotron)
  "#ec4899", // pink (GLM)
  "#14b8a6", // teal (GPT)
  "#6366f1", // indigo (DeepSeek)
];

export const availableModels: Model[] = [
  {
    id: "moonshotai/kimi-k2-0905",
    name: "Kimi K2",
    shortName: "Kimi",
    provider: "moonshotai",
    color: modelColors[0],
    isActive: false,
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    shortName: "Gemini",
    provider: "google",
    color: modelColors[1],
    isActive: false,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    shortName: "Haiku",
    provider: "anthropic",
    color: modelColors[2],
    isActive: false,
  },
  {
    id: "x-ai/grok-4.1-fast",
    name: "Grok 4.1 Fast",
    shortName: "Grok",
    provider: "x-ai",
    color: modelColors[3],
    isActive: false,
  },
  {
    id: "anthropic/claude-opus-4.5",
    name: "Claude Opus 4.5",
    shortName: "Opus",
    provider: "anthropic",
    color: modelColors[4],
    isActive: false,
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "Nemotron 70B",
    shortName: "Nemotron",
    provider: "nvidia",
    color: modelColors[5],
    isActive: false,
  },
  {
    id: "z-ai/glm-4.7",
    name: "GLM 4.7",
    shortName: "GLM",
    provider: "z-ai",
    color: modelColors[6],
    isActive: false,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    shortName: "GPT",
    provider: "openai",
    color: modelColors[7],
    isActive: false,
  },
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek Chat",
    shortName: "DeepSeek",
    provider: "deepseek",
    color: modelColors[8],
    isActive: false,
  },
];
