# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Build for production (catches TypeScript errors)
npm run lint     # Run ESLint
```

## Environment

Requires `OPENROUTER_API_KEY` in `.env` file. Get one from https://openrouter.ai/keys

## Architecture

This is a multi-LLM group chat app where AI models can converse with users and each other.

### Data Flow

1. **User sends message** → `ChatContainer.handleSendMessage()` adds to store
2. **ConversationEngine** evaluates which models should respond via `analyzeForResponse()`
3. Models are queued with priority and delay via `queueResponse()`
4. **streamHandler** makes SSE request to `/api/chat` → OpenRouter API
5. Tokens stream back, updating message content in real-time via Zustand store

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/conversationEngine.ts` | Response logic: who responds, when, priority queuing, cooldowns, system prompts |
| `src/lib/streamHandler.ts` | SSE streaming to/from API, abort controller management |
| `src/store/chatStore.ts` | Zustand state: messages, active models, typing indicators |
| `src/components/ChatContainer.tsx` | Orchestrates everything: wires engine to store to UI |
| `src/app/api/chat/route.ts` | Next.js API route that proxies to OpenRouter |

### Response Priority System

The conversation engine uses priority levels:
- **100**: @mentioned by name (bypasses cooldown)
- **80**: User message
- **60**: Question asked (contains `?`)

Models have a 10-second cooldown between responses. Only one model responds concurrently (`maxConcurrent = 1`).

### Model Configuration

Models defined in `src/lib/models.ts` with `id` (OpenRouter model ID), `name`, `shortName` (for @mentions), `provider`, `color`.

### State Shape (Zustand)

```typescript
messages: Message[]        // Chat history with modelId, timestamp, isStreaming
activeModels: Model[]      // Currently participating models
typingModels: TypingState[] // Models currently "thinking"
```
