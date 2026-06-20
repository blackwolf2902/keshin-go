# Phase 1A: Text Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Type English in browser → LLM responds in Japanese → English subtitle shown. No 3D, no audio — just proving the Go↔Python↔LLM pipeline works end-to-end.

**Architecture:** Go CLI serves frontend and proxies to Python FastAPI. Python handles LLM/TTS/translation pipeline. Frontend is React + Tailwind with chat panel and subtitle overlay.

**Tech Stack:** Go (Cobra, Chi, Viper), Python (FastAPI, litellm, uv), React (Vite, TypeScript, Tailwind, Zustand), Edge TTS (zero-setup fallback)

---

## File Structure

```
keshin-go/
├── cmd/
│   └── keshin/
│       └── main.go                    # CLI entry point
├── internal/
│   ├── config/
│   │   ├── config.go                  # Viper config loading
│   │   └── defaults.go               # Free-tier defaults
│   ├── bridge/
│   │   └── http_client.go             # Go HTTP client to Python
│   ├── pack/
│   │   ├── loader.go                  # Parse character.toml
│   │   └── validator.go              # Validate pack structure
│   └── server/
│       ├── server.go                  # Chi HTTP server
│       ├── handlers_chat.go           # Chat API handlers
│       └── handlers_characters.go     # Character list handlers
├── ai/
│   ├── pyproject.toml                 # uv project config
│   ├── keshin_ai/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app entry
│   │   ├── config.py                  # Settings from keshin.toml
│   │   ├── llm/
│   │   │   ├── base.py               # Protocol: LLMProvider
│   │   │   ├── groq.py               # Groq free tier
│   │   │   ├── gemini.py             # Gemini free tier
│   │   │   ├── ollama.py             # Local Ollama
│   │   │   └── router.py             # Provider selection + fallback
│   │   ├── tts/
│   │   │   ├── base.py               # Protocol: TTSProvider
│   │   │   ├── edge_tts.py           # Edge TTS (zero-setup)
│   │   │   └── router.py             # Provider selection + fallback
│   │   ├── emotion/
│   │   │   ├── parser.py             # Parse emotion tags from LLM output
│   │   │   └── mapper.py             # Map emotions to blend shape names
│   │   ├── translation/
│   │   │   ├── base.py               # Protocol: TranslationProvider
│   │   │   └── llm_translate.py       # LLM-based translation
│   │   └── pipeline/
│   │       ├── orchestrator.py        # Main chat pipeline
│   │       ├── context.py            # Pipeline context/dataclass
│   │       └── steps.py              # Individual pipeline steps
│   ├── tests/
│   │   ├── test_llm.py
│   │   ├── test_emotion.py
│   │   ├── test_translation.py
│   │   └── test_pipeline.py
│   └── Dockerfile
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx                   # App entry
│       ├── App.tsx                    # Root component
│       ├── components/
│       │   ├── ChatPanel.tsx          # Chat input/output
│       │   ├── SubtitleOverlay.tsx    # Japanese subtitles
│       │   ├── CharacterSelect.tsx    # Pack selector
│       │   └── StatusBar.tsx          # Connection status
│       ├── hooks/
│       │   └── useChat.ts             # Chat state + SSE streaming
│       ├── stores/
│       │   └── chatStore.ts           # Zustand chat state
│       ├── lib/
│       │   └── api.ts                 # API client
│       └── styles/
│           └── globals.css            # Tailwind + custom
├── packs/
│   ├── _example/
│   │   ├── character.toml
│   │   ├── personality/
│   │   │   └── system.md
│   │   └── expressions/
│   │       └── happy.toml
│   └── hinata/
│       ├── character.toml
│       ├── personality/
│       │   └── system.md
│       └── expressions/
│           ├── happy.toml
│           └── thinking.toml
├── proto/
│   └── keshin/                        # (Future: gRPC protos)
├── schemas/
│   └── character.schema.json          # JSON Schema for validation
├── scripts/
│   └── setup.sh                       # One-command dev setup
├── docs/
│   ├── API.md                         # HTTP contract
│   ├── CONFIG-MERGE.md                # Config merge priority
│   └── ARCHITECTURE.md                # Architecture guide
├── go.mod
├── go.work
├── Taskfile.yml
├── keshin.toml                        # Default config
└── docker-compose.yml                 # VOICEVOX (optional)
```

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `go.mod`
- Create: `go.work`
- Create: `ai/pyproject.toml`
- Create: `ai/keshin_ai/__init__.py`
- Create: `Taskfile.yml`
- Create: `.gitignore`
- Create: `keshin.toml` (defaults from roadmap Section 8)

- [ ] **Step 1: Initialize Go module**

```bash
cd keshin-go
go mod init github.com/keshin-dev/keshin
```

- [ ] **Step 2: Create go.work**

```
go 1.23

use .
```

- [ ] **Step 3: Create Python project with uv**

```bash
cd ai
uv init --package keshin-ai
```

- [ ] **Step 4: Create Taskfile.yml**

```yaml
version: '3'

tasks:
  dev:
    desc: Start all development services
    cmds:
      - task: dev:go
      - task: dev:ai

  dev:go:
    desc: Start Go server
    cmds:
      - go run ./cmd/keshin run --mode web --port 8080

  dev:ai:
    desc: Start Python AI service
    dir: ai
    cmds:
      - uv run uvicorn keshin_ai.main:app --reload --port 9090

  dev:frontend:
    desc: Start frontend dev server
    dir: frontend
    cmds:
      - npm run dev

  build:
    desc: Build all
    cmds:
      - task: build:go
      - task: build:frontend

  build:go:
    desc: Build Go binary
    cmds:
      - go build -o bin/keshin ./cmd/keshin

  build:frontend:
    desc: Build frontend
    dir: frontend
    cmds:
      - npm run build

  lint:
    desc: Lint all
    cmds:
      - golangci-lint run
      - task: lint:ai
      - task: lint:frontend

  lint:ai:
    desc: Lint Python
    dir: ai
    cmds:
      - uv run ruff check .

  lint:frontend:
    desc: Lint frontend
    dir: frontend
    cmds:
      - npx eslint src/

  test:
    desc: Run all tests
    cmds:
      - go test ./...
      - task: test:ai

  test:ai:
    desc: Run Python tests
    dir: ai
    cmds:
      - uv run pytest

  docker:voicevox:
    desc: Start VOICEVOX container (optional)
    cmds:
      - docker compose up -d voicevox

  docker:kokoro:
    desc: Start Kokoro container (optional)
    cmds:
      - docker compose up -d kokoro

  setup:
    desc: One-command dev setup
    cmds:
      - task: setup:go
      - task: setup:ai
      - task: setup:frontend

  setup:go:
    cmds:
      - go mod download

  setup:ai:
    dir: ai
    cmds:
      - uv sync

  setup:frontend:
    dir: frontend
    cmds:
      - npm install
```

- [ ] **Step 5: Create .gitignore**

```
# Go
/bin/
*.exe

# Python
__pycache__/
*.pyc
.venv/
*.egg-info/

# Node
node_modules/
dist/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Config
.env
*.local

# Build
/build/
```

- [ ] **Step 6: Create keshin.toml with defaults**

Copy the default config from roadmap Section 8.1 into `keshin.toml`.

- [ ] **Step 7: Create docker-compose.yml**

```yaml
services:
  voicevox:
    image: voicevox/voicevox_engine:latest
    ports:
      - "50021:50021"
    profiles:
      - tts

  kokoro:
    image: ghcr.io/remsky/kokoro-fastapi:latest
    ports:
      - "8880:8880"
    profiles:
      - tts
```

- [ ] **Step 8: Commit scaffold**

```bash
git add .
git commit -m "feat: monorepo scaffold with Go, Python, Taskfile"
```

---

## Task 2: Go CLI + Config

**Files:**
- Create: `cmd/keshin/main.go`
- Create: `internal/config/config.go`
- Create: `internal/config/defaults.go`

- [ ] **Step 1: Install Cobra and Viper**

```bash
cd keshin-go
go get github.com/spf13/cobra@latest
go get github.com/spf13/viper@latest
go get go.uber.org/zap@latest
```

- [ ] **Step 2: Write `internal/config/defaults.go`**

Hardcode the defaults matching `keshin.toml` Section 8.1: mode="web", log_level="info", LLM provider="groq", LLM model="llama-3.3-70b-versatile", TTS provider="edge-tts" (changed from voicevox per Improvement 2), etc.

- [ ] **Step 3: Write `internal/config/config.go`**

Viper-based config loading with the merge priority: `env > CLI flags > character.toml > keshin.toml > hardcoded defaults`. Structured config struct with mapstructure tags.

- [ ] **Step 4: Write `cmd/keshin/main.go`**

Cobra CLI with:
- `keshin version` — prints version
- `keshin run --character <name> --mode <web|desktop> --port <int>` — starts server
- `keshin config` — prints effective config

- [ ] **Step 5: Test that `keshin version` works**

```bash
go run ./cmd/keshin version
# Expected: keshin v0.1.0
```

- [ ] **Step 6: Test that `keshin config` prints merged config**

```bash
go run ./cmd/keshin config
# Expected: prints TOML config with defaults applied
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: Go CLI with Cobra + config with Viper"
```

---

## Task 3: Python FastAPI Shell + LLM Provider

**Files:**
- Create: `ai/keshin_ai/main.py`
- Create: `ai/keshin_ai/config.py`
- Create: `ai/keshin_ai/llm/base.py`
- Create: `ai/keshin_ai/llm/groq.py`
- Create: `ai/keshin_ai/llm/gemini.py`
- Create: `ai/keshin_ai/llm/ollama.py`
- Create: `ai/keshin_ai/llm/router.py`
- Create: `ai/keshin_ai/emotion/parser.py`
- Create: `ai/keshin_ai/emotion/mapper.py`
- Create: `ai/keshin_ai/translation/base.py`
- Create: `ai/keshin_ai/translation/llm_translate.py`
- Create: `ai/keshin_ai/pipeline/context.py`
- Create: `ai/keshin_ai/pipeline/steps.py`
- Create: `ai/keshin_ai/pipeline/orchestrator.py`
- Create: `ai/tests/test_emotion.py`

- [ ] **Step 1: Write `ai/keshin_ai/llm/base.py`**

Define the `LLMProvider` Protocol:

```python
from dataclasses import dataclass
from typing import Protocol, AsyncIterator

@dataclass
class Message:
    role: str  # "system", "user", "assistant"
    content: str

@dataclass
class LLMResponse:
    text: str
    model: str
    usage: dict  # tokens, etc.

class LLMProvider(Protocol):
    async def generate(self, messages: list[Message], **kwargs) -> LLMResponse: ...
    async def stream(self, messages: list[Message], **kwargs) -> AsyncIterator[str]: ...
```

- [ ] **Step 2: Write `ai/keshin_ai/llm/groq.py`**

Implement `GroqProvider` using `litellm` for the OpenAI-compatible API. Handle rate limits with simple retry.

- [ ] **Step 3: Write `ai/keshin_ai/llm/gemini.py`**

Implement `GeminiProvider` using `litellm`. Same interface, different config.

- [ ] **Step 4: Write `ai/keshin_ai/llm/ollama.py`**

Implement `OllamaProvider` using `litellm` with localhost base URL.

- [ ] **Step 5: Write `ai/keshin_ai/llm/router.py`**

`LLMRouter` that tries providers in order (Groq → Gemini → OpenRouter → Ollama) with retry/backoff. Log failures with `structlog`.

- [ ] **Step 6: Write `ai/keshin_ai/emotion/parser.py`**

Parse `[emotion:happy]`, `[emotion:sad]`, etc. tags from LLM output. Returns `(clean_text, emotion, intensity)`.

- [ ] **Step 7: Write `ai/keshin_ai/emotion/mapper.py`**

Map emotion names to VRM blend shape preset names. Simple dict lookup with fallback to "neutral".

- [ ] **Step 8: Write `ai/keshin_ai/translation/llm_translate.py`**

Uses the same LLM provider to translate Japanese → English. Sends a separate LLM call with: "Translate the following Japanese text to English naturally. Preserve the meaning and tone."

- [ ] **Step 9: Write `ai/keshin_ai/pipeline/context.py`**

`PipelineContext` dataclass with: user_message, character_id, session_id, personality_prompt, history, llm_response, emotion, japanese_text, english_subtitle, etc.

- [ ] **Step 10: Write `ai/keshin_ai/pipeline/steps.py`**

Implement each step as a class with `async def execute(self, ctx: PipelineContext) -> PipelineContext`:
- `ContextStep` — loads personality + history
- `LLMStep` — calls LLM router
- `EmotionParseStep` — extracts emotion tags
- `TranslationStep` — translates JA→EN for subtitle

- [ ] **Step 11: Write `ai/keshin_ai/pipeline/orchestrator.py`**

`PipelineOrchestrator` that runs steps in sequence. For streaming, yields intermediate results after each step.

- [ ] **Step 12: Write `ai/keshin_ai/main.py`**

FastAPI app with:
- `GET /health` — returns `{"status": "ok", "providers": {"llm": "groq"}}`
- `POST /api/chat` — takes `{character_id, message, session_id?}`, returns `{japanese_text, english_subtitle, emotion}`
- `GET /api/chat/stream` — SSE streaming endpoint

- [ ] **Step 13: Write `ai/tests/test_emotion.py`**

Test the emotion parser with sample LLM outputs containing `[emotion:happy]`, `[emotion:sad]` tags, and outputs with no tags (should default to "neutral").

- [ ] **Step 14: Run tests**

```bash
cd ai && uv run pytest tests/test_emotion.py -v
```

- [ ] **Step 15: Test `/health` endpoint manually**

```bash
cd ai && uv run uvicorn keshin_ai.main:app --port 9090 &
curl http://localhost:9090/health
# Expected: {"status": "ok", "providers": {"llm": "groq"}}
```

- [ ] **Step 16: Commit**

```bash
git add .
git commit -m "feat: Python AI service with LLM providers, emotion parser, pipeline"
```

---

## Task 4: Pack Loader + Character Packs

**Files:**
- Create: `internal/pack/loader.go`
- Create: `internal/pack/validator.go`
- Create: `schemas/character.schema.json`
- Create: `packs/_example/character.toml`
- Create: `packs/_example/personality/system.md`
- Create: `packs/_example/expressions/happy.toml`
- Create: `packs/hinata/character.toml`
- Create: `packs/hinata/personality/system.md`
- Create: `packs/hinata/expressions/happy.toml`
- Create: `packs/hinata/expressions/thinking.toml`

- [ ] **Step 1: Write `schemas/character.schema.json`**

JSON Schema validating the structure of `character.toml` fields (from roadmap Section 4.1). All required fields, types, and constraints.

- [ ] **Step 2: Write `internal/pack/loader.go`**

Parse `character.toml` using `github.com/pelletier/go-toml/v2`. Load personality from `system.md`. Load expressions from `expressions/*.toml`. Return a `CharacterPack` struct.

- [ ] **Step 3: Write `internal/pack/validator.go`**

Validate pack structure: required files exist, `character.toml` parses, `model.vrm` path is set (file existence check is optional for now), personality file exists, expressions are valid TOML.

- [ ] **Step 4: Create `packs/_example/` template**

Copy the character.toml from roadmap Section 4.1 (simplified — remove voice.clone, model for now). Add a basic `system.md` personality.

- [ ] **Step 5: Create `packs/hinata/` pack**

Use the Hinata character config from roadmap Section 4.1 and personality from Section 4.3. Set `voice.provider = "edge-tts"` for Phase 1A.

- [ ] **Step 6: Write test for pack loader**

```go
func TestLoadPack(t *testing.T) {
    pack, err := LoadPack("../../packs/hinata")
    require.NoError(t, err)
    assert.Equal(t, "Hinata", pack.Character.Name)
    assert.Equal(t, "ja", pack.Character.Lang)
}
```

- [ ] **Step 7: Run test**

```bash
go test ./internal/pack/... -v
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: pack loader, validator, hinata and example packs"
```

---

## Task 5: Go HTTP Bridge to Python

**Files:**
- Create: `internal/bridge/http_client.go`
- Create: `internal/server/server.go`
- Create: `internal/server/handlers_chat.go`
- Create: `internal/server/handlers_characters.go`
- Create: `docs/API.md`

- [ ] **Step 1: Write `docs/API.md`**

Document the HTTP contract (from Section 6 of the execution strategy):
- `POST /api/chat` — chat request/response
- `GET /api/chat/stream` — SSE streaming
- `GET /api/characters` — list available packs
- `GET /health` — health check

Include exact request/response JSON schemas.

- [ ] **Step 2: Write `internal/bridge/http_client.go`**

Go HTTP client that talks to the Python FastAPI service. Methods:
- `Chat(req ChatRequest) (ChatResponse, error)`
- `ChatStream(req ChatRequest) (<-chan StreamChunk, error)` — SSE client
- `Health() (HealthResponse, error)`

- [ ] **Step 3: Install Chi**

```bash
go get github.com/go-chi/chi/v5@latest
```

- [ ] **Step 4: Write `internal/server/server.go`**

Chi-based HTTP server that:
- Serves the frontend (embedded or static)
- Proxies `/api/*` to the Python bridge client
- Serves `/health` from Go (checks Python health too)

- [ ] **Step 5: Write `internal/server/handlers_chat.go`**

Handler that receives chat requests from the frontend, forwards to Python via bridge, and returns the response. Both sync and SSE streaming variants.

- [ ] **Step 6: Write `internal/server/handlers_characters.go`**

Handler that uses the pack loader to return available characters as JSON.

- [ ] **Step 7: Test end-to-end: Go CLI → Python → LLM**

```bash
# Terminal 1: Start Python
cd ai && uv run uvicorn keshin_ai.main:app --port 9090

# Terminal 2: Start Go
go run ./cmd/keshin run --character hinata --mode web --port 8080

# Terminal 3: Test
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"character_id":"hinata","message":"Hello!"}'
# Expected: {"japanese_text":"...", "english_subtitle":"...", "emotion":"happy"}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: Go HTTP bridge, Chi server, API handlers"
```

---

## Task 6: Frontend — Chat Panel + Subtitle Overlay

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/components/ChatPanel.tsx`
- Create: `frontend/src/components/SubtitleOverlay.tsx`
- Create: `frontend/src/components/CharacterSelect.tsx`
- Create: `frontend/src/components/StatusBar.tsx`
- Create: `frontend/src/hooks/useChat.ts`
- Create: `frontend/src/stores/chatStore.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/styles/globals.css`

- [ ] **Step 1: Scaffold React + Vite + TypeScript + Tailwind**

```bash
cd keshin-go/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install zustand
```

- [ ] **Step 2: Write `frontend/src/lib/api.ts`**

API client with:
- `sendChat(characterId: string, message: string): Promise<ChatResponse>`
- `streamChat(characterId: string, message: string): AsyncIterable<StreamChunk>` — SSE
- `getCharacters(): Promise<Character[]>`
- `getHealth(): Promise<HealthResponse>`

- [ ] **Step 3: Write `frontend/src/stores/chatStore.ts`**

Zustand store with: messages array, current character, loading state, error state, streaming state. Actions: sendMessage, addMessage, setCharacter, clearMessages.

- [ ] **Step 4: Write `frontend/src/hooks/useChat.ts`**

Custom hook that wraps the store and API client. Handles sending messages and receiving streaming responses. Updates store on each SSE event.

- [ ] **Step 5: Write `frontend/src/components/ChatPanel.tsx`**

Chat UI with:
- Message list (user messages on right, character on left)
- Text input at bottom
- Character avatar/name on response messages
- Emotion badge on character messages (e.g., "😊 happy")
- English subtitle below each Japanese message

- [ ] **Step 6: Write `frontend/src/components/SubtitleOverlay.tsx`**

Floating subtitle bar that shows the current English subtitle with fade-in/out animation. Positioned below the character (placeholder div for now — will be below 3D model in Phase 1B).

- [ ] **Step 7: Write `frontend/src/components/CharacterSelect.tsx`**

Dropdown to select available character packs. Calls `GET /api/characters`.

- [ ] **Step 8: Write `frontend/src/components/StatusBar.tsx`**

Shows: connection status (connected/disconnected), current LLM provider, current TTS provider, ping.

- [ ] **Step 9: Write `frontend/src/App.tsx`**

Layout: left side = chat panel, right side = placeholder for 3D character (will be filled in Phase 1B). Top bar = character select + status.

- [ ] **Step 10: Write `frontend/src/styles/globals.css`**

Tailwind imports + custom styles for chat bubbles, subtitle overlay, emotion badges.

- [ ] **Step 11: Test frontend with backend**

```bash
# Start Python and Go servers, then:
cd frontend && npm run dev
# Open http://localhost:5173
# Type a message → should see Japanese response + English subtitle + emotion badge
```

- [ ] **Step 12: Commit**

```bash
git add .
git commit -m "feat: React frontend with chat panel, subtitle overlay, SSE streaming"
```

---

## Task 7: SSE Streaming

**Files:**
- Modify: `ai/keshin_ai/main.py` — add SSE streaming endpoint
- Modify: `internal/server/handlers_chat.go` — SSE proxy
- Modify: `frontend/src/hooks/useChat.ts` — SSE consumption

- [ ] **Step 1: Add SSE streaming to Python FastAPI**

Add `GET /api/chat/stream` endpoint that yields SSE events:
- `event: text` — Japanese text chunk
- `event: emotion` — detected emotion
- `event: subtitle` — English subtitle

- [ ] **Step 2: Add SSE streaming proxy to Go server**

Add `GET /api/chat/stream` handler that proxies SSE from Python to frontend.

- [ ] **Step 3: Update frontend `useChat` hook**

Consume SSE stream and update store incrementally. Show text appearing character by character.

- [ ] **Step 4: Test streaming end-to-end**

```bash
# Start all services
# Send a message in browser → should see Japanese text streaming in
# Emotion badge should update when [emotion:...] is parsed
# Subtitle should appear after full response
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: SSE streaming for chat responses"
```

---

## Task 8: TTS Providers (Edge TTS Default)

**Files:**
- Create: `ai/keshin_ai/tts/base.py`
- Create: `ai/keshin_ai/tts/edge_tts.py`
- Create: `ai/keshin_ai/tts/kokoro.py`
- Create: `ai/keshin_ai/tts/voicevox.py`
- Create: `ai/keshin_ai/tts/router.py`
- Modify: `ai/keshin_ai/pipeline/steps.py` — add TTSStep
- Modify: `ai/keshin_ai/pipeline/orchestrator.py` — include TTS step
- Modify: `ai/keshin_ai/main.py` — add TTS endpoints

- [ ] **Step 1: Write `ai/keshin_ai/tts/base.py`**

```python
from typing import Protocol

class TTSProvider(Protocol):
    async def synthesize(self, text: str, speaker_id: int | None = None, speed: float = 1.0) -> TTSResponse: ...

@dataclass
class TTSResponse:
    audio_path: str  # Path to generated audio file
    duration_ms: float
    visemes: list[VisemeTiming]  # If available
```

- [ ] **Step 2: Write `ai/keshin_ai/tts/edge_tts.py`**

Implement Edge TTS using `edge-tts` Python package. Generate JA voice with `ja-JP-NanamiNeural`. Save audio to temp file, return path. Note: Edge TTS does not provide viseme timing, so return empty visemes.

- [ ] **Step 3: Write `ai/keshin_ai/tts/kokoro.py`**

Implement Kokoro provider that talks to Kokoro-FastAPI on `localhost:8880`. Return audio + visemes.

- [ ] **Step 4: Write `ai/keshin_ai/tts/voicevox.py`**

Implement VOICEVOX provider that talks to VOICEVOX on `localhost:50021`. Return audio + phoneme timing (VOICEVOX provides this).

- [ ] **Step 5: Write `ai/keshin_ai/tts/router.py`**

`TTSRouter` that tries providers in order (configurable, default: edge-tts → kokoro → voicevox). Log failures.

- [ ] **Step 6: Add TTS endpoints to FastAPI**

```
POST /api/tts — synthesize audio for text
GET /api/characters/{id}/voices — list available voices for character
```

- [ ] **Step 7: Update pipeline to include TTS**

Add `TTSStep` to the pipeline orchestrator. After LLM generation + emotion parsing, synthesize audio.

- [ ] **Step 8: Test TTS integration**

```bash
curl -X POST http://localhost:9090/api/tts \
  -d '{"text": "こんにちは！", "character_id": "hinata"}'
# Expected: audio file path returned
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: TTS providers (Edge TTS, Kokoro, VOICEVOX) with router"
```

---

## Task 9: Config Merge Documentation + Integration Test

**Files:**
- Create: `docs/CONFIG-MERGE.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `scripts/setup.sh`
- Add integration test files

- [ ] **Step 1: Write `docs/CONFIG-MERGE.md`**

Document the configuration merge priority:
1. Environment variables (highest)
2. CLI flags
3. character.toml (pack-level overrides)
4. keshin.toml (global defaults)
5. Hardcoded defaults (lowest)

With examples for each merge scenario.

- [ ] **Step 2: Write `docs/ARCHITECTURE.md`**

Describe the architecture: Go core → HTTP bridge → Python AI pipeline. Step-based pipeline. Streaming architecture. Provider interfaces.

- [ ] **Step 3: Write `scripts/setup.sh`**

One-command setup script that:
1. Checks for Go, Python (uv), Node.js
2. Installs Go dependencies
3. Installs Python dependencies
4. Installs frontend dependencies
5. Creates default `keshin.toml` if not present
6. Prints success message with next steps

- [ ] **Step 4: Write integration test for end-to-end chat**

Create a test that:
1. Starts the Python FastAPI server
2. Sends a chat request via the `POST /api/chat` endpoint
3. Verifies the response has `japanese_text`, `english_subtitle`, and `emotion`

Note: Requires a valid LLM API key. Skip in CI if not present.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "docs: config merge, architecture, setup script, integration tests"
```

---

## Phase 1A Deliverable

After completing all 9 tasks:

```bash
keshin run --character hinata --mode web --port 8080
# → Browser opens at http://localhost:8080
# → Hinata character shown (static placeholder for now, 3D in Phase 1B)
# → User types "Hello, how are you?"
# → Hinata responds in Japanese: "へへっ、元気だよ！"
# → English subtitle: "Hehe, I'm doing great!"
# → Emotion badge: 😊 happy
# → Type another message → conversation continues with context
# → LLM failover works: Groq → Gemini → Ollama
# → TTS audio generated (Edge TTS by default, no Docker needed)
```

**What's NOT in Phase 1A:**
- 3D VRM character rendering (Phase 1B)
- Lip-sync / viseme animation (Phase 1B)
- Expression changes on 3D model (Phase 1B)
- Voice input / STT (Phase 2)
- Desktop mode / Wails (Phase 2)
- Conversation memory / SQLite (Phase 3)
- gRPC (Phase 3)

**What IS in Phase 1A:**
- ✅ Text chat with LLM response
- ✅ Japanese output with English subtitles
- ✅ Emotion detection from LLM output
- ✅ Multi-provider LLM failover
- ✅ TTS audio generation (Edge TTS)
- ✅ Character pack loading + selection
- ✅ SSE streaming responses
- ✅ Chat UI in browser
- ✅ Step-based pipeline architecture
- ✅ Health checks + provider status