import { NextRequest } from "next/server";
import OpenAI from "openai";
import { Model, Message, PromptMode, ModelConfig } from "@/types/chat";
import { Memory } from "@/types/memory";
import { WaveContext } from "@/types/throttle";
import { SpeakerCommand } from "@/types/speaker";
import { buildSystemPrompt, buildContextWindow } from "@/lib/conversationEngine";
import { getSpeakerReminder } from "@/lib/speakerPrompt";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "AI Group Chat",
  },
});

interface ChatRequestBody {
  model: string | Model;
  messages: Message[] | Array<{ role: string; content: string }>;
  activeModels?: Model[];
  contextWindowSize?: number;
  promptModes?: PromptMode[];
  modelConfigs?: Record<string, ModelConfig>;
  // NEW: 2.0 features
  settingPrompt?: string;
  memories?: Memory[];
  waveContext?: WaveContext[];
  speakerMode?: SpeakerCommand | null;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequestBody = await req.json();

    const {
      model,
      messages,
      activeModels = [],
      contextWindowSize = 20,
      promptModes = [],
      modelConfigs = {},
      // NEW: 2.0 features
      settingPrompt = '',
      memories = [],
      waveContext = [],
      speakerMode = null,
    } = body;

    // Determine if we're using full model object or just model ID string
    // This maintains backward compatibility with existing callers
    const modelId = typeof model === 'string' ? model : model.id;
    const modelObj: Model | null = typeof model === 'object' ? model : null;

    let apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

    // If we have a full Model object and activeModels, use the extended system prompt
    if (modelObj && activeModels.length >= 0) {
      // Cast messages to Message[] for type compatibility
      const chatMessages = messages as Message[];

      // Build system prompt with all 2.0 features
      const systemPrompt = buildSystemPrompt(
        modelObj,
        activeModels,
        chatMessages,
        promptModes,
        modelConfigs,
        {
          settingPrompt,
          memories,
          waveContext,
          speakerMode,
        }
      );

      // Build context window
      const contextMessages = buildContextWindow(chatMessages, contextWindowSize, modelObj);

      // Prepare messages for API call
      apiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...contextMessages,
      ];

      // If in speaker mode, append reminder to the last user message
      if (speakerMode && apiMessages.length > 0) {
        const lastIdx = apiMessages.length - 1;
        if (apiMessages[lastIdx].role === 'user') {
          apiMessages[lastIdx] = {
            ...apiMessages[lastIdx],
            content: apiMessages[lastIdx].content + getSpeakerReminder(speakerMode),
          };
        }
      }
    } else {
      // Backward compatibility: use messages as-is (original behavior)
      apiMessages = messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    }

    const stream = await openai.chat.completions.create({
      model: modelId,
      messages: apiMessages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process request";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
