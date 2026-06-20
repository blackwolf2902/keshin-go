# Keshin Architecture

## Overview

Keshin is a modular anime character companion that runs locally. It uses a three-tier architecture:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Go Core    │────▶│  Python AI   │
│  (React/TS)  │◀────│  (Chi/Cobra) │◀────│  (FastAPI)   │
└──────────────┘     └──────────────┘     └──────────────┘
                             │
                     ┌───────┴───────┐
                     │  Config/Viper │
                     │  Pack Loader  │
                     └───────────────┘
```

## Components

### 1. Go Core (`cmd/keshin`, `internal/`)

The Go binary serves as:
- **CLI interface** using Cobra (`keshin run`, `keshin version`, `keshin config`)
- **HTTP server** using Chi, proxying API requests to the Python AI service
- **Configuration manager** using Viper, with layered merge priority
- **Pack loader** for character packs (TOML-based)

**Key packages:**
- `internal/config/` — Configuration loading and defaults (Viper-based)
- `internal/server/` — HTTP server, handlers, and routing (Chi-based)
- `internal/bridge/` — HTTP client for Python AI service
- `internal/pack/` — Character pack loading and validation

### 2. Python AI Service (`ai/`)

The Python service handles all AI/ML workloads:

- **FastAPI** server exposing REST endpoints
- **LLM Providers** via litellm (Groq, Gemini, Ollama, OpenRouter)
- **TTS Providers** (Edge TTS, Kokoro, VOICEVOX)
- **Step-based Pipeline** orchestrating LLM → Emotion Parse → Translation → TTS

**Key modules:**
- `keshin_ai/main.py` — FastAPI app entry point with routes
- `keshin_ai/llm/` — LLM provider implementations and router with failover
- `keshin_ai/tts/` — TTS provider implementations and router
- `keshin_ai/emotion/` — Emotion tag parser and VRM blend shape mapper
- `keshin_ai/translation/` — Translation provider (LLM-based JA→EN)
- `keshin_ai/pipeline/` — Step-based pipeline context, steps, and orchestrator

### 3. Frontend (`frontend/`)

React + TypeScript + Tailwind frontend:

- **Chat Panel** — Message history and input
- **Subtitle Overlay** — Floating English subtitle display
- **Character Select** — Dropdown for available characters
- **Status Bar** — Connection status and provider info
- **SSE Streaming** — Real-time response streaming

## Data Flow

### Synchronous Chat Flow

```
User Types Message
       │
       ▼
  Frontend POST /api/chat
       │
       ▼
  Go Server (proxy)
       │
       ▼
  Python FastAPI /api/chat
       │
       ▼
  PipelineOrchestrator.run()
       │
       ├── ContextStep (load personality)
       ├── LLMStep (call LLM → Japanese response)
       ├── EmotionParseStep (parse [emotion:*] tags)
       ├── TranslationStep (JA→EN translation)
       └── TTSStep (synthesize audio)
       │
       ▼
  Response returned to frontend
```

### Streaming Chat Flow (SSE)

```
Frontend GET /api/chat/stream
       │
       ▼
  PipelineOrchestrator.run_stream()
       │
       ├── event: text (Japanese characters)
       ├── event: emotion (detected emotion)
       ├── event: subtitle (English translation)
       ├── event: audio (TTS file path)
       └── event: done (final state)
```

## Provider Architecture

### LLM Providers

```
LLMRouter
  ├── GroqProvider (default, free tier)
  ├── GeminiProvider (free tier fallback)
  ├── OllamaProvider (local fallback)
  └── OpenRouterProvider (paid fallback)
```

On failure, the router tries the next provider with exponential backoff.

### TTS Providers

```
TTSRouter
  ├── EdgeTTSProvider (default, zero-setup)
  ├── KokoroProvider (Docker, provides visemes)
  └── VoiceVoxProvider (Docker, provides phonemes)
```

### Translation Provider

```
LLMTranslationProvider
  └── Uses same LLM router for JA→EN translation
```

## Character Packs

Character packs are stored in `packs/` directory. Each pack is a directory with:

```
packs/hinata/
├── character.toml      # Metadata, voice config
├── personality/
│   └── system.md       # LLM system prompt
└── expressions/
    ├── happy.toml      # Expression → blend shape mapping
    └── thinking.toml
```

## Configuration Merge Priority

```
Environment Variables  ← highest
CLI Flags
character.toml
keshin.toml
Hardcoded Defaults    ← lowest
```

See [CONFIG-MERGE.md](CONFIG-MERGE.md) for detailed examples.
