import { NextRequest, NextResponse } from 'next/server';
import {
  MemoryCategory,
  MemoryExtractionInput,
  MemoryExtractionResult,
  MEMORY_CATEGORY_CONFIG
} from '@/types/memory';
import { Message } from '@/types/chat';

// Default extraction model - DeepSeek is cheap and good at structured output
const DEFAULT_EXTRACTION_MODEL = 'deepseek/deepseek-chat';

// System prompt for memory extraction
const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction assistant for a multi-model AI debate platform. Your job is to analyze conversation messages and extract key information as structured memories.

## Memory Categories
${Object.entries(MEMORY_CATEGORY_CONFIG).map(([key, config]) =>
  `- **${key}**: ${config.description}`
).join('\n')}

## Extraction Rules
1. Extract 3-8 memories per batch of messages (don't over-extract)
2. Each memory should be 1-2 sentences, standalone and clear
3. Assign importance (0.0-1.0) based on:
   - Central to discussion topic: 0.8-1.0
   - Supporting point: 0.5-0.7
   - Minor detail or tangent: 0.2-0.4
4. Use "global" scope for discussion-wide points
5. Use "model-specific" scope + modelId for a specific model's position
6. Include relevant tags (2-4 keywords per memory)
7. If a new memory contradicts/updates an old one, include "supersedes" with the old memory's content description

## Output Format
Respond with ONLY a JSON object, no markdown, no explanation:
{
  "memories": [
    {
      "content": "string - the memory itself",
      "category": "fact|position|agreement|disagreement|evidence|conclusion|question|context",
      "importance": 0.0-1.0,
      "scope": "global|model-specific",
      "modelId": "string or null - only if model-specific",
      "tags": ["tag1", "tag2"],
      "supersedes": "string or null - description of memory this replaces"
    }
  ]
}`;

// Build user prompt from messages
function buildExtractionPrompt(messages: Message[]): string {
  const formattedMessages = messages.map(m => {
    if (m.role === 'user') {
      return `[User]: ${m.content}`;
    } else {
      return `[${m.modelName || 'Assistant'}]: ${m.content}`;
    }
  }).join('\n\n');

  return `Analyze these conversation messages and extract key memories:

---
${formattedMessages}
---

Extract the most important facts, positions, agreements, disagreements, evidence, conclusions, and open questions. Output ONLY valid JSON.`;
}

// Parse and validate extraction response
function parseExtractionResponse(response: string): MemoryExtractionInput[] {
  // Clean up response - remove markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);

    if (!parsed.memories || !Array.isArray(parsed.memories)) {
      console.error('Invalid extraction response: missing memories array');
      return [];
    }

    // Validate and clean each memory
    const validMemories: MemoryExtractionInput[] = [];
    const validCategories: MemoryCategory[] = [
      'fact', 'position', 'agreement', 'disagreement',
      'evidence', 'conclusion', 'question', 'context'
    ];

    for (const mem of parsed.memories) {
      // Validate required fields
      if (!mem.content || typeof mem.content !== 'string') continue;
      if (!mem.category || !validCategories.includes(mem.category)) continue;

      validMemories.push({
        content: mem.content.trim(),
        category: mem.category as MemoryCategory,
        importance: typeof mem.importance === 'number'
          ? Math.max(0, Math.min(1, mem.importance))
          : 0.5,
        scope: mem.scope === 'model-specific' ? 'model-specific' : 'global',
        modelId: mem.scope === 'model-specific' && mem.modelId ? mem.modelId : null,
        tags: Array.isArray(mem.tags)
          ? mem.tags.filter((t: unknown) => typeof t === 'string').slice(0, 5)
          : [],
        supersedes: typeof mem.supersedes === 'string' ? mem.supersedes : null,
      });
    }

    return validMemories;
  } catch (error) {
    console.error('Failed to parse extraction response:', error);
    console.error('Raw response:', response);
    return [];
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      messages,
      extractionModel = DEFAULT_EXTRACTION_MODEL
    }: {
      messages: Message[];
      extractionModel?: string;
    } = body;

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Build prompts
    const userPrompt = buildExtractionPrompt(messages);

    // Call extraction model via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'llm-grpchat Memory Extraction',
      },
      body: JSON.stringify({
        model: extractionModel,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent structured output
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return NextResponse.json(
        { error: 'Failed to call extraction model', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const extractedContent = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens;

    // Parse the response
    const memories = parseExtractionResponse(extractedContent);

    const result: MemoryExtractionResult = {
      memories,
      processingTime: Date.now() - startTime,
      modelUsed: extractionModel,
      tokensUsed,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Memory extraction error:', error);
    return NextResponse.json(
      {
        error: 'Memory extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    defaultModel: DEFAULT_EXTRACTION_MODEL,
    categories: Object.keys(MEMORY_CATEGORY_CONFIG),
  });
}
