<p align="center">
  <img src="logo.png" alt="AI Group Chat Logo" width="180">
</p>

<h1 align="center">AI Group Chat</h1>

<p align="center">
  A multi-model group chat where AI models converse with you and each other.<br>
  Built with Next.js 16 and powered by <a href="https://openrouter.ai">OpenRouter</a>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-4-cyan" alt="Tailwind">
</p>

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
- [2.0 Features](#20-features)
- [Available Models](#available-models)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Acknowledgments](#acknowledgments)

---

## Features

### Core
| Feature | Description |
|---------|-------------|
| **Multi-Model Chat** | Chat with multiple AI models simultaneously |
| **@Mentions** | Tag models: `@Opus`, `@GPT`, `@Gemini`, `@Haiku`, `@Grok`, `@Kimi`, `@DeepSeek`, `@Nemotron`, `@GLM` |
| **Global Mentions** | Use `@here` or `@all` to trigger all active models |
| **Streaming** | See responses token-by-token as they generate |
| **Stop Control** | Cancel all responses or stop individual models mid-stream |
| **Smart Scroll** | Auto-scroll pauses when reading; shows "New messages" button |

### Debate Tools
| Feature | Description |
|---------|-------------|
| **Prompt Modes** | Toggle behaviors: Direct, Steelman, Socratic, Evidence, Adversarial |
| **Model Roles** | Assign roles: Skeptic, Devil's Advocate, Synthesizer, Provocateur |
| **Custom Instructions** | Add free-form instructions per model |
| **Rate Limiting** | Max 2 responders per trigger, max 10 consecutive AI turns |

### 2.0 Additions
| Feature | Description |
|---------|-------------|
| **Wave Throttling** | Models respond in waves; later waves reference earlier responses |
| **Memory System** | Auto-extract and recall discussion context (positions, agreements, evidence) |
| **Speaker System** | Designate a model for summaries: `@Opus summarize`, `@GPT report` |
| **Session Management** | Save, load, and manage multiple conversation sessions |
| **Setting Prompt** | Global context/scenario applied to all models |

---

## Quick Start

```bash
# Clone
git clone https://github.com/SavvyOverthinking/llm-grpchat.git
cd llm-grpchat

# Install
npm install

# Configure (get key from https://openrouter.ai/keys)
echo "OPENROUTER_API_KEY=your_key_here" > .env

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Usage Guide

### Basic Chat
1. **Select Models** - Click models in the sidebar to add them
2. **Send Messages** - Type and press Enter
3. **@Mention** - Use `@ModelName` to direct messages to specific models
4. **@here / @all** - Trigger all active models at once

### Configuring Models
- Click the **gear icon** next to an active model to set roles and custom instructions
- Expand **Prompt Modes** to enable debate-focused behaviors globally

### Running Debates
1. Start with a clear assignment: *"Debate X and reach consensus in N turns"*
2. Use `@here` to kick things off with all models
3. Ask them to assign a summary author
4. Type "continue" to reset the turn counter if stuck

---

## 2.0 Features

### Wave Throttling

Models respond in sequential waves rather than all at once:

- **Wave Size** - Configure how many models respond per wave (default: 2)
- **Wave Context** - Wave 2+ models can see and reference earlier responses
- **Selection Modes** - Random, round-robin, or priority-based assignment
- **Pass Option** - Models can `[PASS]` if they have nothing unique to add

### Speaker System

Designate a model to provide summaries or reports:

| Command | Output |
|---------|--------|
| `@Model summarize` | Quick prose summary |
| `@Model report` | Structured report with sections |
| `@Model consensus` | List of agreement points |
| `@Model conflicts` | List of disagreements and positions |
| `@Model questions` | List of open/unresolved questions |

### Memory System

Auto-building contextual memory for long discussions:

- **8 Categories** - Facts, positions, agreements, disagreements, evidence, conclusions, questions, context
- **Scoring** - Importance × 0.5 + Recency × 0.35 + Frequency × 0.15
- **Auto-Pruning** - Keeps top N memories when limit reached
- **Extraction** - Uses DeepSeek Chat for cost-effective memory extraction

### Session Management

- Create, load, rename, and delete conversation sessions
- Auto-save option with full state preservation
- Sessions include messages, settings, and memories

---

## Available Models

| Model | Provider | Tag |
|-------|----------|-----|
| Claude Opus 4.5 | Anthropic | `@Opus` |
| Claude Haiku 4.5 | Anthropic | `@Haiku` |
| GPT-4o | OpenAI | `@GPT` |
| Gemini 3 Pro | Google | `@Gemini` |
| Grok 4.1 Fast | xAI | `@Grok` |
| Kimi K2 | Moonshot AI | `@Kimi` |
| DeepSeek Chat | DeepSeek | `@DeepSeek` |
| Nemotron 70B | NVIDIA | `@Nemotron` |
| GLM 4.7 | Z.ai | `@GLM` |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| State | Zustand with persistence |
| API | OpenRouter |
| Streaming | Server-Sent Events (SSE) |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # Streaming chat API
│   │   └── extract-memories/route.ts  # Memory extraction API
│   ├── globals.css                    # Theme and animations
│   └── page.tsx                       # Main page
├── components/
│   ├── ChatContainer.tsx      # Main orchestrator
│   ├── ChatInput.tsx          # Message input
│   ├── MessageBubble.tsx      # Message display
│   ├── MessageList.tsx        # Smart scroll container
│   ├── ModelSelector.tsx      # Model toggle + settings
│   ├── PromptModePanel.tsx    # Prompt modes and roles
│   ├── SessionManager.tsx     # Session UI (2.0)
│   ├── SettingsPanel.tsx      # Settings + throttle (2.0)
│   ├── MemoryPanel.tsx        # Memory UI (2.0)
│   ├── SpeakerControls.tsx    # Speaker commands (2.0)
│   └── WaveIndicator.tsx      # Wave progress (2.0)
├── lib/
│   ├── conversationEngine.ts  # Response logic and queuing
│   ├── waveThrottle.ts        # Wave system (2.0)
│   ├── speakerPrompt.ts       # Speaker system (2.0)
│   ├── memory/                # Memory utilities (2.0)
│   ├── models.ts              # Model definitions
│   └── streamHandler.ts       # API streaming
├── store/
│   ├── chatStore.ts           # Main state (sessions, settings)
│   └── memoryStore.ts         # Memory state (2.0)
└── types/                     # TypeScript interfaces
```

---

## Acknowledgments

This project is a fork of [AllAboutAI-YT/llm-grpchat](https://github.com/AllAboutAI-YT/llm-grpchat) by [Kris](https://github.com/AllAboutAI-YT). The original provided the foundation for multi-model group chat with OpenRouter. Version 2.0 adds wave throttling, memory system, speaker commands, and session management.

## License

MIT
