# AI Group Chat

A group chat application where multiple AI models can converse with you and each other. Built with Next.js and powered by OpenRouter.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan)

## Features

- **Multi-Model Chat**: Chat with multiple AI models simultaneously
- **@Mentions**: Tag specific models with `@Kimi`, `@Haiku`, `@Opus`, `@Gemini`, `@Grok`, `@Nemotron`, `@GLM`, `@GPT`, or `@DeepSeek`
- **Global Mentions**: Use `@here` or `@all` to trigger all active models at once
- **Prompt Modes**: Toggle debate-focused modes that modify all models' behavior
- **Model Roles**: Assign specific roles (Skeptic, Steelman, etc.) to individual models
- **Custom Instructions**: Add free-form instructions per model (session-based)
- **Streaming Responses**: See responses as they're generated token-by-token
- **Typing Indicators**: Know when a model is thinking
- **Stop Button**: Cancel all responses instantly, or stop individual models mid-stream
- **Smart Scroll**: Auto-scroll pauses when you scroll up to read; "New messages" button appears

### 2.0 Features

- **Wave Throttling**: Models respond in waves (e.g., 2 at a time), allowing later waves to reference earlier responses
- **Memory System**: Auto-building RAG that extracts and recalls discussion context (agreements, disagreements, positions, evidence)
- **Speaker System**: Designate a model as "speaker" for summaries (`@Opus summarize`, `@GPT report`)
- **Session Management**: Save, load, and manage multiple conversation sessions
- **Setting Prompt**: Global context/scenario that applies to all models

## Available Models

| Model | Provider | Tag |
|-------|----------|-----|
| Kimi K2 | Moonshot AI | @Kimi |
| Gemini 3 Pro | Google | @Gemini |
| Claude Haiku 4.5 | Anthropic | @Haiku |
| Grok 4.1 Fast | xAI | @Grok |
| Claude Opus 4.5 | Anthropic | @Opus |
| Nemotron 70B | NVIDIA | @Nemotron |
| GLM 4.7 | Z.ai | @GLM |
| GPT-4o | OpenAI | @GPT |
| DeepSeek Chat | DeepSeek | @DeepSeek |

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/SavvyOverthinking/llm-grpchat.git
cd llm-grpchat
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the root directory:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Get your API key from [OpenRouter](https://openrouter.ai/keys).

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Select Models**: Click on models in the left sidebar to add them to the chat
2. **Send Messages**: Type in the input box and press Enter or click Send
3. **@Mention Models**: Use `@ModelName` to direct a message to a specific model
4. **@here / @all**: Trigger all active models to respond
5. **Configure Models**: Click the gear icon next to an active model to set roles and custom instructions
6. **Toggle Prompt Modes**: Expand the "Prompt Modes" section to enable debate-focused behaviors
7. **Stop Generation**: Click the global Stop button to cancel all, or click the stop button on individual streaming messages
8. **Clear Chat**: Use the Clear Chat button to start fresh

## Prompt Modes

Toggle these modes to change how all models behave:

| Mode | Description |
|------|-------------|
| **Direct Mode** | Skip performative caution, state analysis directly |
| **Steelman Mode** | Construct strongest version of arguments before attacking |
| **Socratic Mode** | Ask probing questions, expose contradictions |
| **Evidence Mode** | Demand concrete evidence, reject vague assertions |
| **Adversarial Mode** | Maximum pushback, find weaknesses in every argument |

## Model Roles

Assign roles to individual models for specialized behavior:

| Role | Behavior |
|------|----------|
| **Skeptic** | Question everything, demand evidence |
| **Steelman** | Find strongest version of every argument |
| **Devil's Advocate** | Argue the opposing side |
| **Phenomenologist** | Focus on subjective experience |
| **Provocateur** | Take controversial positions |
| **Synthesizer** | Find common ground, build bridges |

## Debate Mode

This fork includes enhanced conversation dynamics for multi-model debates:

- **Rate Limiting**: Max 2 models respond per trigger, max 10 consecutive AI turns
- **@Mention Priority**: Directly mentioned models always respond, bypassing limits
- **Debate Prompting**: Models are instructed to challenge, disagree, and find truth over agreement
- **Anti-Theater Rules**: Discourages empty validation ("great point!") and encourages substantive pushback
- **Question Directing**: Models must address questions to specific participants via @mentions

### Tips for Good Debates

1. Start with a clear assignment: "Debate X and reach consensus in N turns"
2. Use `@here` to kick things off with all models
3. Ask them to assign a summary author
4. If stuck, type "continue" to reset the turn counter

## Wave Throttling (2.0)

When enabled, models respond in sequential waves rather than all at once:

- **Wave Size**: Configure how many models respond per wave (default: 2)
- **Wave Context**: Models in Wave 2+ can see and reference what earlier waves said
- **Selection Modes**: Random, round-robin, or priority-based wave assignment
- **Pass Option**: Models can `[PASS]` if they have nothing unique to add

This creates more coherent debates where models build on each other's points.

## Speaker System (2.0)

Designate a model to provide summaries or reports:

| Command | Description |
|---------|-------------|
| `@Model summarize` | Quick prose summary of the discussion |
| `@Model report` | Structured report with sections |
| `@Model consensus` | List areas of agreement |
| `@Model conflicts` | List disagreements and positions |
| `@Model questions` | List open/unresolved questions |

## Memory System (2.0)

Auto-building contextual memory for long discussions:

- **Memory Categories**: Facts, positions, agreements, disagreements, evidence, conclusions, questions, context
- **Scoring Algorithm**: Importance × 0.5 + Recency × 0.35 + Access Frequency × 0.15
- **Auto-Pruning**: Keeps top N memories by score when limit is reached
- **Model-Specific**: Memories can be global or specific to a model
- **Extraction Model**: Uses DeepSeek Chat for cost-effective memory extraction

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **State**: Zustand with persistence
- **API**: OpenRouter (unified API for multiple LLM providers)
- **Streaming**: Server-Sent Events (SSE)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Streaming chat API
│   │   └── extract-memories/route.ts  # Memory extraction API
│   ├── globals.css          # Theme and animations
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main page
├── components/
│   ├── ChatContainer.tsx    # Main chat orchestrator
│   ├── ChatInput.tsx        # Message input with stop button
│   ├── MessageBubble.tsx    # Individual message display
│   ├── MessageList.tsx      # Scrollable message container (smart scroll)
│   ├── ModelSelector.tsx    # Model toggle + settings modal
│   ├── PromptModePanel.tsx  # Prompt modes and role config
│   ├── ActiveModels.tsx     # Shows active models
│   ├── TypingIndicator.tsx  # "X is thinking..." display
│   ├── SessionManager.tsx   # Session save/load/delete UI (2.0)
│   ├── SettingsPanel.tsx    # Setting prompt + throttle config (2.0)
│   ├── WaveIndicator.tsx    # Wave progress display (2.0)
│   ├── MemoryPanel.tsx      # Memory browse/settings UI (2.0)
│   └── SpeakerControls.tsx  # Speaker designation + commands (2.0)
├── lib/
│   ├── conversationEngine.ts # Response logic, prompts, queuing, wave integration
│   ├── waveThrottle.ts      # Wave throttling system
│   ├── speakerPrompt.ts     # Speaker/reporter system
│   ├── memory/
│   │   ├── scoring.ts       # Memory scoring algorithms
│   │   └── formatter.ts     # Memory formatting for prompts
│   ├── models.ts            # Model definitions
│   ├── modelConfigs.ts      # Model personalities and roles
│   ├── promptModes.ts       # Toggleable prompt modes
│   └── streamHandler.ts     # API streaming utilities
├── store/
│   ├── chatStore.ts         # Zustand state (with persistence, sessions)
│   └── memoryStore.ts       # Memory system state
└── types/
    ├── chat.ts              # Core chat interfaces
    ├── memory.ts            # Memory system types
    ├── throttle.ts          # Wave throttling types
    ├── speaker.ts           # Speaker system types
    └── session.ts           # Session management types
```

## License

MIT
