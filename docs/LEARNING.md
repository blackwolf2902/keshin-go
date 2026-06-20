# Keshin — Learning Documentation

> A personal reference for all libraries, modules, and patterns used in this project. Written for developers learning the stack.

---

## Table of Contents

1. [Go Libraries](#go-libraries)
2. [Python Libraries](#python-libraries)
3. [Frontend Libraries](#frontend-libraries)
4. [Architecture Patterns](#architecture-patterns)
5. [Key Concepts](#key-concepts)

---

## Go Libraries

### Cobra (`github.com/spf13/cobra`)

**What it is:** A library for building CLI apps with commands, flags, and help text.

**Why we use it:** Powers our `keshin version`, `keshin config`, and `keshin run` commands. Each command is a `&cobra.Command{}` struct with `Use`, `Short`, and `Run` fields.

**Key patterns used:**
```go
var rootCmd = &cobra.Command{Use: "keshin", Short: "..."}
rootCmd.AddCommand(versionCmd, configCmd, runCmd)
runCmd.Flags().StringVarP(&port, "port", "p", 0, "Server port")
```

### Viper (`github.com/spf13/viper`)

**What it is:** A configuration library that reads from files, environment variables, and CLI flags.

**Why we use it:** Implements our 5-layer config merge priority (env > CLI > character.toml > keshin.toml > defaults).

**Key patterns used:**
```go
v := viper.New()
v.SetConfigName("keshin")
v.SetConfigType("toml")
v.SetEnvPrefix("keshin")    // KESHIN_* env vars
v.AutomaticEnv()
v.SetDefault("server.port", 8080)
```

### Chi (`github.com/go-chi/chi/v5`)

**What it is:** A lightweight, idiomatic HTTP router for Go.

**Why we use it:** Powers our HTTP server with middleware (logging, CORS, timeout) and clean route grouping.

**Key patterns used:**
```go
r := chi.NewRouter()
r.Use(chimw.Logger, chimw.Recoverer, chimw.Timeout(120*time.Second))
r.Get("/health", s.handleHealth)
r.Route("/api", func(r chi.Router) {
    r.Post("/chat", s.handleChat)
})
```

### Zap (`go.uber.org/zap`)

**What it is:** A high-performance structured logger.

**Why we use it:** Fast logging with structured fields (JSON format in production).

**Key patterns used:**
```go
logger.Info("Server starting", zap.String("addr", addr), zap.Int("port", port))
logger.Fatal("Failed to start", zap.Error(err))
```

### go-toml (`github.com/pelletier/go-toml/v2`)

**What it is:** A TOML parser for Go.

**Why we use it:** Parses character pack `character.toml` files and expression files.

### Testify (`github.com/stretchr/testify`)

**What it is:** An assertion library for Go tests.

**Why we use it:** Provides `assert.Equal()`, `require.NoError()`, etc. for clean test assertions.

---

## Python Libraries

### FastAPI

**What it is:** A modern, fast web framework for building APIs with Python 3.11+.

**Why we use it:** Our AI service runs as a FastAPI app. Key features used:
- Automatic OpenAPI docs at `/docs`
- `async`/`await` support throughout
- `StreamingResponse` for SSE
- Dependency injection via `lifespan`

**Install:** `uv add fastapi uvicorn`

### Uvicorn

**What it is:** An ASGI server for Python (needed to run FastAPI).

**Why we use it:** Runs our FastAPI app with hot-reload during development.

```bash
uv run uvicorn keshin_ai.main:app --reload --port 9090
```

### litellm (`litellm`)

**What it is:** A unified API wrapper for 100+ LLM providers (OpenAI, Groq, Gemini, Ollama, etc.).

**Why we use it:** Instead of writing separate API clients for each LLM provider, litellm provides one consistent interface. We just change the model string:
- `"groq/llama-3.3-70b-versatile"` → Groq
- `"gemini/gemini-2.0-flash-lite"` → Google Gemini
- `"ollama/llama3.2:3b"` → Local Ollama

**Key patterns used:**
```python
response = await acompletion(
    model=f"groq/{self.model}",
    messages=[{"role": "user", "content": text}],
    api_key=self.api_key,
)
text = response.choices[0].message.content
```

### edge-tts (`edge-tts`)

**What it is:** A Python library that uses Microsoft Edge's free text-to-speech API.

**Why we use it:** Zero-setup TTS with natural Japanese voice (`ja-JP-NanamiNeural`). No API key needed, no Docker required.

**Key patterns used:**
```python
communicate = edge_tts.Communicate(text=text, voice="ja-JP-NanamiNeural")
await communicate.save(output_path)
```

### structlog

**What it is:** A structured logging library for Python.

**Why we use it:** For the LLM/TTS routers, we use structlog's keyword-argument logging:
```python
logger.info("llm.generate_attempt", provider="groq", attempt=1)
# Output: {"event": "llm.generate_attempt", "provider": "groq", "attempt": 1}
```

This is different from the standard `logging` module which uses `%s` formatting:
```python
logger.info("Provider: %s, attempt: %d", provider, 1)
```

### pydantic-settings (`pydantic-settings`)

**What it is:** Settings management using Pydantic models, with automatic `.env` file loading.

**Why we use it:** The `Settings` class in `config.py` automatically reads environment variables with the `KESHIN_` prefix:
```python
class Settings(BaseSettings):
    groq_api_key: str = ""
    model_config = {"env_prefix": "keshin_"}
# Reads from KESHIN_GROQ_API_KEY env var
```

### httpx

**What it is:** A modern HTTP client for Python with async support.

**Why we use it:** The Kokoro and VOICEVOX TTS providers make HTTP requests to their respective services.

**Key patterns used:**
```python
async with httpx.AsyncClient(timeout=60.0) as client:
    response = await client.post(url, json={...})
    response.raise_for_status()
```

### pytest + pytest-asyncio

**What it is:** Testing framework with async test support.

**Why we use it:** Testing our async functions.

```python
@pytest.mark.asyncio
async def test_emotion_parser():
    result = parse_emotion("hello[emotion:happy]")
    assert result.emotion == "happy"
```

---

## Frontend Libraries

### React 19

**What it is:** UI component library.

**Why we use it:** Builds the chat interface with components, hooks, and state management.

### TypeScript

**What it is:** Type-safe JavaScript.

**Why we use it:** All frontend code is typed — `ChatMessage`, `Character`, `HealthResponse` interfaces.

### Tailwind CSS v4

**What it is:** Utility-first CSS framework. v4 uses a new `@import "tailwindcss"` syntax and `@tailwindcss/vite` plugin instead of the old `tailwind.config.js`.

**Why we use it:** Rapid UI development without writing custom CSS.

**Config (`vite.config.ts`):**
```ts
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**Usage (`globals.css`):**
```css
@import "tailwindcss";
```

### Zustand

**What it is:** A minimal state management library for React.

**Why we use it instead of Redux or Context:** Minimal boilerplate — just `create()` a store with state + actions.

**Key patterns used:**
```ts
const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
}))
// Usage in components:
const messages = useChatStore((s) => s.messages)
```

### Vite

**What it is:** A fast build tool for frontend projects.

**Why we use it:** Instant HMR (hot module replacement), fast builds, and proxy support:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:8080',  // Forward API calls to Go
  },
}
```

### lucide-react

**What it is:** A library of open-source SVG icons as React components.

**Why we use it:** For clean, consistent icons (Wifi, Cpu, Volume2, Send, Sparkles, etc.) instead of emoji.

---

## Architecture Patterns

### 1. Protocol-Based Provider Pattern

Instead of abstract base classes, Python uses `Protocol` (PEP 544) for structural subtyping — "duck typing at the type-checker level":

```python
class LLMProvider(Protocol):
    async def generate(self, messages: list[Message], **kwargs) -> LLMResponse: ...
```

Any class with a matching `generate` method satisfies the protocol. No inheritance needed.

### 2. Pipeline Pattern

The pipeline uses a **chain of responsibility** pattern — each step takes the context, transforms it, and passes it to the next step:

```
PipelineContext
  → ContextStep (validate inputs)
  → LLMStep (call LLM)
  → EmotionParseStep (extract emotion tags)
  → TranslationStep (JA→EN)
  → TTSStep (synthesize audio)
  → Final response
```

Each step extends `PipelineStep(ABC)` and implements `async def execute(ctx) -> PipelineContext`.

### 3. Router + Fallback Pattern

Both LLM and TTS use a router that tries providers in order with fallback:

```python
router = LLMRouter([
    ("groq", GroqProvider()),
    ("gemini", GeminiProvider()),
    ("ollama", OllamaProvider()),
])
# On failure, tries next provider with 2^attempt backoff
```

### 4. SSE Streaming

Server-Sent Events flow:

```
Frontend ←── event: text ──── Python FastAPI
         ←── event: emotion ── StreamingResponse
         ←── event: subtitle ─
         ←── event: done ─────
```

The Go proxy simply forwards SSE events without buffering.

---

## Key Concepts

### Config Merge Priority

Configuration is loaded with 5 levels of override:

```
1. Environment Variables  e.g., KESHIN_SERVER__PORT=9090
2. CLI Flags             e.g., --port 9090
3. character.toml         Pack-level overrides
4. keshin.toml            Global config file
5. Hardcoded Defaults     Built into Go binary
```

Higher levels override lower levels. The Go Viper config handles this automatically.

### Character Packs

Characters are defined as directories in `packs/` with:

- `character.toml` — Metadata (name, lang) + voice config
- `personality/system.md` — LLM system prompt describing character personality
- `expressions/*.toml` — Emotion → VRM blend shape mappings

The Go `pack.LoadPack()` function parses these into a `CharacterPack` struct.

### Emotion Tags

The LLM can include emotion hints in its response using `[emotion:name:intensity]` tags:

```
へへっ、今日はいい天気だね！[emotion:happy:80]
```

The emotion parser strips the tags and extracts:
- `clean_text`: "へへっ、今日はいい天気だね！"
- `emotion`: "happy"
- `intensity`: 0.8

### SSE Events

The streaming endpoint yields these event types:

| Event | Data | When |
|-------|------|------|
| `text` | `{text, model}` | After LLM response |
| `emotion` | `{emotion, intensity}` | After emotion parse |
| `subtitle` | `{subtitle}` | After translation |
| `audio` | `{path, duration_ms}` | After TTS |
| `done` | Full result | Pipeline complete |
| `error` | `{error}` | On failure |
