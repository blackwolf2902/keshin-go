# Configuration Merge Priority

Keshin's configuration is loaded with the following priority (highest to lowest):

```
Environment Variables  ← highest priority
CLI Flags
character.toml (pack-level overrides)
keshin.toml (global defaults)
Hardcoded Defaults     ← lowest priority
```

## Priority Levels

### 1. Environment Variables (Highest)

All config keys can be overridden via environment variables with the `KESHIN_` prefix. Nested keys use double underscores (`__`) as separators.

**Examples:**

```bash
# Set LLM provider
export KESHIN_LLM__PROVIDER=gemini
export KESHIN_LLM__GEMINI__API_KEY=your-key-here

# Set server port
export KESHIN_SERVER__PORT=9090

# Set TTS provider
export KESHIN_TTS__PROVIDER=kokoro

# Set log level
export KESHIN_LOG__LEVEL=debug
```

### 2. CLI Flags

CLI flags override both config files and environment variables.

**Examples:**

```bash
# Start with specific character and port
keshin run --character hinata --port 8080

# Start in desktop mode (future)
keshin run --mode desktop
```

### 3. character.toml (Pack-Level)

Each character pack's `character.toml` can override global settings. These overrides apply only when that character is active.

**Example (`packs/hinata/character.toml`):**
```toml
[character]
name = "Hinata"
lang = "ja"

[voice]
provider = "edge-tts"
speaker = "ja-JP-NanamiNeural"
rate = "+10%"
pitch = "+10Hz"
```

### 4. keshin.toml (Global Defaults)

The project-wide configuration file. Created automatically by `scripts/setup.sh` or manually.

**Example:**
```toml
[mode]
default = "web"

[server]
host = "0.0.0.0"
port = 8080

[llm]
provider = "groq"
model = "llama-3.3-70b-versatile"
```

### 5. Hardcoded Defaults (Lowest)

Built into the Go binary. Used when no other configuration source provides a value. Defined in `internal/config/defaults.go`.

## Merge Scenarios

### Scenario 1: Development Setup

User wants to use a local Ollama model instead of cloud LLM:

```bash
# Option A: Environment variable
export KESHIN_LLM__PROVIDER=ollama
keshin run

# Option B: Edit keshin.toml
# [llm]
# provider = "ollama"
```

### Scenario 2: Multiple Characters

User creates a character pack that uses a different TTS voice:

```toml
# packs/tsundere/character.toml
[voice]
provider = "voicevox"
speaker_id = 1
pitch = "+20Hz"
```

This overrides the global TTS settings only when using the "tsundere" character.

### Scenario 3: Production Deployment

Full override chain:

```bash
# 1. Hardcoded default: mode = "web", port = 8080
# 2. keshin.toml overrides: mode = "web", port = 8080 (same)
# 3. Environment overrides port:
export KESHIN_SERVER__PORT=443
# 4. CLI flag overrides character:
keshin run --port 443 --character hinata
# Result: port=443, character=hinata, mode=web
```

## Configuration Reference

See `keshin.toml` for the complete list of configuration options with documentation.
