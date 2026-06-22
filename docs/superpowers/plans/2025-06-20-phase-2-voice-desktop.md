# Phase 2: Voice + Desktop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement voice-to-voice interaction (Speech-to-Text) and transition the application from web-only to a fully featured desktop companion (desktop pet) using Wails, complete with a system tray icon, window transparency, always-on-top, click-through, and auto-management of the Python AI service.

**Architecture:** 
- **Voice Pipeline:** Browser/Wails Webview captures microphone input (via MediaRecorder API) → sends audio blob to Go Core → proxies to Python AI STT Service → transcribes to English text → feeds into existing chat pipeline.
- **Desktop Companion:** Wails v2 wraps the React frontend, exposing Go runtime bindings for desktop-specific window controls (transparency toggle, click-through, system tray integration, auto-starting and monitoring the Python AI service).

---

## File Structure

```
keshin-go/
├── wails.json                          # Wails project configuration
├── main.go                             # Modified entrypoint to support Wails vs Web
├── internal/
│   ├── config/
│   │   └── config.go                  # Config definitions updated for STT & Desktop settings
│   ├── server/
│   │   ├── server.go                  # Chi server (used in --mode web)
│   │   └── handlers_stt.go            # STT upload proxy handler
│   ├── bridge/
│   │   └── http_client.go             # Go HTTP client updated for STT uploads
│   ├── desktop/
│   │   ├── app.go                     # Wails App runtime controller
│   │   ├── tray.go                    # System tray setup & menu handlers
│   │   └── manager.py/manager.go      # Python service runner & health monitor
│   └── pack/
│       └── validator.go              # Character pack validation (check VRM model files)
├── ai/
│   ├── keshin_ai/
│   │   ├── main.py                    # FastAPI app adding /api/stt endpoint
│   │   ├── config.py                  # Settings updated for STT
│   │   ├── stt/
│   │   │   ├── base.py               # Protocol: STTProvider
│   │   │   ├── local_whisper.py      # local faster-whisper implementation
│   │   │   ├── groq_whisper.py       # Groq Whisper cloud fallback
│   │   │   └── router.py             # STT Router with retry/failover
│   │   └── pipeline/
│   │       └── steps.py              # Updates to support STT-driven pipelines
│   └── tests/
│       └── test_stt.py                # Unit tests for STT transcription
└── frontend/
    └── src/
        ├── components/
        │   ├── VoiceInput.tsx         # Push-to-Talk button & audio recorder
        │   └── TitleBar.tsx           # Custom frame for drag/drop in desktop mode
        ├── hooks/
        │   └── useVoice.ts            # Micro-recording hooks + audio submission
        └── stores/
            └── characterStore.ts      # Tracks voice activation states
```

---

## Task 1: Python STT Providers & Router

Implement the Speech-to-Text providers, router, and FastAPI endpoint.

- [ ] **Step 1: Install Python dependencies**
  Add `faster-whisper` and any required audio utilities to `ai/pyproject.toml` and sync using `uv`.
  ```bash
  cd ai
  uv add faster-whisper soundfile numpy
  uv sync
  ```

- [ ] **Step 2: Create `ai/keshin_ai/stt/base.py`**
  Define `STTProvider` Protocol:
  ```python
  from typing import Protocol
  from dataclasses import dataclass

  @dataclass
  class STTResponse:
      text: str
      language: str
      duration: float

  class STTProvider(Protocol):
      async def transcribe(self, audio_bytes: bytes) -> STTResponse: ...
  ```

- [ ] **Step 3: Create `ai/keshin_ai/stt/local_whisper.py`**
  Implement local transcription using `faster-whisper`. Lazily initialize the model to save startup memory.
  ```python
  # Use the configured model size (e.g. "base", "tiny")
  ```

- [ ] **Step 4: Create `ai/keshin_ai/stt/groq_whisper.py`**
  Implement Groq Whisper API client using `litellm` or direct requests as the cloud fallback option.

- [ ] **Step 5: Create `ai/keshin_ai/stt/router.py`**
  STT Router with failover: primary (`faster-whisper`) → fallback (`groq_whisper`).

- [ ] **Step 6: Update `ai/keshin_ai/main.py`**
  Add `POST /api/stt` endpoint accepting `multipart/form-data` uploads containing audio files (typically `.wav` or `.webm`). Return `{ text: string, language: string, duration: float }`.

- [ ] **Step 7: Create `ai/tests/test_stt.py`**
  Add mock-based unit tests for transcribing short audio chunks.

---

## Task 2: Push-to-Talk (PTT) Frontend & Audio Capture

Capture user microphone input and send it to the backend.

- [ ] **Step 1: Create `frontend/src/hooks/useVoice.ts`**
  Implement microphone capture using the browser's `MediaRecorder` API. 
  - Force audio conversion or capture at 16kHz mono (WAV format preferred).
  - Provide helper statuses: `isRecording`, `isTranscribing`, `audioData`.

- [ ] **Step 2: Create `frontend/src/components/VoiceInput.tsx`**
  Build a sleek Push-to-Talk UI:
  - User can press and hold **Spacebar** (or click-and-hold the mic button) to record.
  - Show soundwave micro-animations or volume indicator while recording.
  - Release to send the audio payload.

- [ ] **Step 3: Update `frontend/src/lib/api.ts`**
  Add endpoint binding to upload audio to Go server:
  `uploadAudio(blob: Blob): Promise<{ text: string }>`

- [ ] **Step 4: Update Go `http_client.go` & `handlers_stt.go`**
  Add proxy mechanism in Go so the frontend uploads audio to `/api/stt` on Go server (port `8080`), which then streams/proxies the multipart payload to Python AI `/api/stt` (port `9090`).

---

## Task 3: Wails Project Initialization & Configuration

Initialize and configure Wails v2 to build a native desktop binary.

- [ ] **Step 1: Install Wails CLI**
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

- [ ] **Step 2: Create Wails config `wails.json`**
  Define window constraints for a transparent, frameless desktop pet:
  ```json
  {
    "name": "keshin",
    "assetdir": "frontend/dist",
    "width": 300,
    "height": 400,
    "transparent": true,
    "frameless": true,
    "alwaysontop": true,
    "resizable": false,
    "windows": {
      "WebviewIsTransparent": true,
      "WindowBackgroundIsTranslucent": true
    }
  }
  ```

- [ ] **Step 3: Implement `internal/desktop/app.go`**
  Create the Wails App struct that binds to frontend context. Define bindings to allow JavaScript to:
  - Toggle Always-on-Top: `ToggleAlwaysOnTop(enabled bool)`
  - Minimize / Hide Window: `Minimize()` or `Hide()`
  - Drag Window: Bind mouse handlers to Wails `WindowDrag` so the user can reposition the desktop character.

- [ ] **Step 4: Adjust `main.go` to support Desktop Mode**
  Introduce a conditional boot logic:
  - If `--mode desktop` is selected, initialize the Wails runtime instead of starting the standalone Chi HTTP server.
  - If `--mode web` is selected, start the existing Chi server and open browser.

---

## Task 4: Transparent Window & Click-Through Setup

Ensure the desktop character looks premium without ugly window borders.

- [ ] **Step 1: Implement CSS modifications**
  Ensure the frontend layout adapts to the desktop frame:
  - Set `background-color: transparent` to body/html in Wails mode.
  - Create a custom draggable header (`TitleBar.tsx`) that triggers `WindowDrag` only on specific visual zones, letting the user grab Hinata to move her around.
  - Ensure the background of the VRM scene canvas is set to transparent (`alpha: true` in ThreeJS renderer config).

- [ ] **Step 2: Bind Platform-Specific Click-Through**
  (Optional/Advanced) Expose Wails window bindings to toggle click-through on transparent areas so clicks pass through to underneath desktop applications when not interacting with the character.

---

## Task 5: System Tray & Context Menu

- [ ] **Step 1: Create `internal/desktop/tray.go`**
  Initialize system tray menu icon when in desktop mode.
  Include menu items:
  - **Show / Hide** (Toggles main window visibility)
  - **Always on Top** (Checkbox toggling priority)
  - **Character Select** (Submenu listing active characters)
  - **Quit** (Terminates both Go CLI and Python processes)

---

## Task 6: Python Service Runner & Health Monitor

Go core must automatically spawn, monitor, and clean up the Python AI process.

- [ ] **Step 1: Implement process manager in `internal/desktop/manager.go`**
  - Spawn the python FastAPI subprocess on startup: `uv run uvicorn keshin_ai.main:app --port 9090`
  - Gracefully kill the subprocess when the Go application quits (capture SIGINT/SIGTERM and terminate the process group).
  - Implement a health checker loop (every 5s) pinging `http://localhost:9090/health`. If the Python service fails repeatedly, terminate and restart the subprocess.

---

## Verification Plan

### Automated Tests
- Run Python STT tests:
  ```bash
  cd ai && uv run pytest tests/test_stt.py -v
  ```
- Validate config integration:
  ```bash
  go test ./internal/config/... -v
  ```

### Manual Verification
1. **Web Voice Mode:**
   - Launch: `go run . run --mode web --character hinata`
   - Hold spacebar, speak in English, and release. Verify that speech is transcribed, translation occurs, and Hinata responds.
2. **Desktop Mode Boot:**
   - Run: `wails dev`
   - Verify the transparent desktop pet window shows Hinata without window borders.
   - Drag Hinata around the screen using mouse.
   - Right-click the system tray icon to verify menu functions (Show, Hide, Settings, Quit).
