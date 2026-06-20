# Keshin HTTP API

Base URL: `http://localhost:8080` (Go proxy) or `http://localhost:9090` (Python direct)

---

## Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "providers": {
    "llm": "groq",
    "tts": "edge-tts"
  }
}
```

---

## Chat

```
POST /api/chat
Content-Type: application/json
```

**Request:**
```json
{
  "character_id": "hinata",
  "message": "Hello!",
  "session_id": "default",
  "personality_prompt": "",
  "character_name": "",
  "character_lang": "ja",
  "history": []
}
```

**Response:**
```json
{
  "japanese_text": "へへっ、こんにちは！",
  "english_subtitle": "Hehe, hello!",
  "emotion": "happy",
  "emotion_intensity": 0.5,
  "model": "llama-3.3-70b-versatile"
}
```

**Error Response:**
```json
{
  "error": "LLM generation failed: ..."
}
```

---

## Chat Stream (SSE)

```
GET /api/chat/stream?character_id=hinata&message=Hello
```

Streams Server-Sent Events:

```
event: text
data: {"text": "へへっ、こんに"}

event: text
data: {"text": "ちは！"}

event: emotion
data: {"emotion": "happy", "intensity": 0.5}

event: subtitle
data: {"subtitle": "Hehe, hello!"}

event: done
data: {"emotion": "happy", "japanese_text": "...", "english_subtitle": "..."}
```

---

## List Characters

```
GET /api/characters
```

**Response:**
```json
[
  {
    "id": "hinata",
    "name": "Hinata",
    "lang": "ja",
    "description": "A cheerful and energetic Japanese high school girl",
    "author": "Keshin Dev",
    "version": "0.1.0",
    "voice": "edge-tts"
  }
]
```

---

## TTS

```
POST /api/tts
Content-Type: application/json
```

**Request:**
```json
{
  "text": "こんにちは！",
  "character_id": "hinata"
}
```

**Response:**
```json
{
  "audio_path": "/tmp/keshin_tts_abc123.wav",
  "duration_ms": 1500.0,
  "visemes": []
}
```

---

## Character Voices

```
GET /api/characters/{id}/voices
```

**Response:**
```json
{
  "character_id": "hinata",
  "provider": "edge-tts",
  "voices": ["ja-JP-NanamiNeural"]
}
```
