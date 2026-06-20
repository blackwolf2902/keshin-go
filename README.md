# Keshin (化身) — Anime Character Engine SDK

> **An open-source Go + Python + Web SDK for building anime character companions.**
>
> Users chat in English. Characters respond in Japanese with subtitles and voice.
> Characters are delivered as drop-in packs — VRM model + voice + personality.
> Run on desktop or web.

## What Is Keshin?

Keshin is an **engine**, not an app. Developers and makers use it to build:

- Desktop anime companions (system tray pet)
- Web-based character chat platforms
- Custom character-driven applications
- Character packs for others to use

The current codebase is Phase 1A — a **text pipeline** that proves the Go↔Python↔LLM
pipeline works end-to-end. The frontend chat panel is a reference implementation.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Keshin Engine                          │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   Go Core   │──│ HTTP Bridge  │──│   Python AI        │  │
│  │  (Cobra,    │  │  (Chi,       │  │  (FastAPI,         │  │
│  │   Chi,      │  │   httpx)     │  │   litellm,         │  │
│  │   Viper)    │  │              │  │   edge-tts)        │  │
│  └──────┬──────┘  └──────────────┘  └────────────────────┘  │
│         │                                                    │
│  ┌──────┴──────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Config     │  │  Pack Loader │  │  Web Frontend      │  │
│  │  (Viper)    │  │  (go-toml)   │  │  (React/TS Demo)   │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

| Layer | Tech | Role |
|-------|------|------|
| Go Core | Cobra + Chi + Viper | CLI, HTTP server, config merge, pack loader, API proxy |
| Python AI | FastAPI + litellm + edge-tts | LLM routing, emotion parsing, JA→EN translation, TTS |
| Web Demo | React + TypeScript + Tailwind | Reference UI — chat panel, subtitle overlay |

## Quick Start (Dev Mode)

```bash
# Prerequisites
go version     # ≥1.23
python3 --version  # ≥3.11
uv version     # recommended for Python
bun version    # recommended for frontend

# Clone & setup
git clone https://github.com/blackwolf2902/keshin-go.git
cd keshin-go
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Set LLM API key (free: https://console.groq.com/keys)
export KESHIN_GROQ__API_KEY=gsk_your_key_here

# Start all services (three terminals)
cd ai && uv run uvicorn keshin_ai.main:app --reload --port 9090       # Python AI
go run ./cmd/keshin run --character hinata --port 8080                # Go server
cd frontend && bun run dev                                            # Web demo
```

Open **http://localhost:5173** to see the reference chat UI.

## CLI

```bash
# Print version
keshin version

# Print effective config (merged from all sources)
keshin config

# Start engine server
keshin run --character hinata --mode web --port 8080
```

## Configuration Merge Priority

```
Environment Variables  ← highest
CLI Flags
character.toml (pack-level)
keshin.toml (global)
Hardcoded Defaults    ← lowest
```

## Project Layout

```
keshin-go/
├── cmd/keshin/           # CLI entry point
├── internal/
│   ├── config/           # Config loading & defaults
│   ├── bridge/           # HTTP client to Python AI
│   ├── pack/             # Character pack loader & validator
│   └── server/           # Chi HTTP server & handlers
├── ai/
│   ├── keshin_ai/
│   │   ├── main.py       # FastAPI app entry
│   │   ├── config.py     # Python settings
│   │   ├── llm/          # LLM providers (Groq, Gemini, Ollama)
│   │   ├── tts/          # TTS providers (Edge TTS, Kokoro, VOICEVOX)
│   │   ├── emotion/      # Emotion tag parser + VRM mapper
│   │   ├── translation/  # JA→EN translation
│   │   └── pipeline/     # Step-based pipeline orchestrator
│   └── tests/
├── frontend/src/         # Reference web UI (React/TS)
├── packs/                # Character packs (drop-in directories)
├── docs/                 # API, architecture, config docs
├── scripts/              # Dev setup & integration tests
├── keshin.toml           # Default config
└── Taskfile.yml          # Dev task runner
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (Go + Python) |
| POST | `/api/chat` | Send message → get Japanese + subtitle + emotion |
| GET | `/api/chat/stream` | SSE streaming chat |
| GET | `/api/characters` | List installed character packs |
| POST | `/api/tts` | Synthesize speech from text |

## Character Packs

Characters are drop-in folders in `packs/<name>/`:

```
packs/hinata/
├── character.toml      # Metadata, voice config
├── personality/
│   └── system.md       # LLM system prompt
└── expressions/
    ├── happy.toml      # Emotion → blend shape mapping
    └── thinking.toml
```

## Data Flow

```
User types "Hello!"
  → POST /api/chat
  → PipelineOrchestrator:
      1. ContextStep — validate personality
      2. LLMStep — call Groq/Gemini/Ollama (Japanese response)
      3. EmotionParseStep — parse [emotion:happy] tag
      4. TranslationStep — JA→EN (via LLM)
      5. TTSStep — synthesize audio (Edge TTS)
  → Response: {japanese_text, english_subtitle, emotion, audio_path}
```

## What's in Phase 1A

- ✅ Text chat with LLM responses in Japanese
- ✅ English subtitles via LLM translation
- ✅ Emotion detection from `[emotion:name]` tags
- ✅ Multi-provider LLM failover (Groq → Gemini → Ollama)
- ✅ TTS audio generation (Edge TTS, zero-setup)
- ✅ Character pack loading + selection
- ✅ SSE streaming responses
- ✅ Reference chat UI

## What's Next

- **Phase 1B:** 3D VRM rendering, lip-sync, expression animation
- **Phase 2:** Voice input (STT), desktop mode (Wails), gRPC
- **Phase 3:** Memory (SQLite), conversation summarization, multi-provider polish

## License

MIT
