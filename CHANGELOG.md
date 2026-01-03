# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-02

### Added

- **Wave Throttling**: Models respond in sequential waves, allowing later models to reference earlier responses
  - Configurable models per wave (1-5)
  - Selection modes: random, round-robin, priority
  - Configurable delay between waves
  - [PASS] option for models with nothing to add

- **Memory System**: Auto-building RAG from conversation
  - 8 memory categories: fact, position, agreement, disagreement, evidence, conclusion, question, context
  - Automatic extraction via DeepSeek Chat
  - Manual extraction and editing
  - Score-based pruning (importance x 0.5 + recency x 0.35 + frequency x 0.15)
  - Configurable extraction frequency and memory limit

- **Speaker System**: Designated model for summaries and reports
  - 5 commands: summarize, report, consensus, conflicts, questions
  - Trigger via @mention or UI buttons
  - Structured output formats per command type

- **Session Management**: Save and restore conversations
  - Create, load, rename, delete sessions
  - Auto-save option
  - Full state preservation (messages, settings, memories)

- **Setting Prompt**: Global context for all models
  - Set scenario or debate topic
  - Applies to all model system prompts

- **Control Bar**: New UI panel with quick access to all 2.0 features
  - SessionManager, SettingsPanel, MemoryPanel, SpeakerControls
  - WaveIndicator for wave progress

### Changed

- ChatContainer updated for wave orchestration
- Chat API extended with new parameters (backward compatible)
- Added UX polish: loading states, error handling, tooltips, animations

### Technical

- New stores: memoryStore (Zustand with persistence)
- Extended chatStore with sessions, settings, speaker state
- New types: memory.ts, throttle.ts, speaker.ts, session.ts
- New lib utilities: waveThrottle.ts, speakerPrompt.ts, memory/formatter.ts, memory/scoring.ts
- New API route: /api/extract-memories

---

## [1.0.0] - 2025-12-15

### Added

- Initial release
- Multi-model group chat with OpenRouter
- @mention support for individual models
- @here/@all for triggering all models
- Prompt modes (Direct, Steelman, Socratic, Evidence, Adversarial)
- Model roles (Skeptic, Devil's Advocate, etc.)
- Streaming responses with SSE
- Stop button for individual and all responses
- Smart scroll with pause detection
- Markdown export
- Dark theme
