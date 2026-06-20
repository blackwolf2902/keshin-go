"""FastAPI application entry point for the Keshin AI service."""

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import Settings
from .llm.gemini import GeminiProvider
from .llm.groq import GroqProvider
from .llm.ollama import OllamaProvider
from .llm.router import LLMRouter
from .pipeline.context import PipelineContext
from .pipeline.orchestrator import PipelineOrchestrator
from .pipeline.steps import ContextStep, EmotionParseStep, LLMStep, TranslationStep, TTSStep
from .translation.llm_translate import LLMTranslationProvider
from .tts.base import TTSResponse
from .tts.edge_tts import EdgeTTSProvider
from .tts.router import TTSRouter

logger = logging.getLogger(__name__)

# Global state (set during lifespan)
settings: Settings = None  # type: ignore
orchestrator: PipelineOrchestrator = None  # type: ignore
tts_router: TTSRouter = None  # type: ignore


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, clean up on shutdown."""
    global settings, orchestrator, tts_router
    settings = Settings()

    # Initialize LLM providers
    groq = GroqProvider(
        api_key=settings.groq_api_key,
        model=settings.llm_model,
        base_url=settings.groq_base_url,
    )
    gemini = GeminiProvider(
        api_key=settings.gemini_api_key,
        model="gemini-2.0-flash-lite",
        base_url=settings.gemini_base_url,
    )
    ollama = OllamaProvider(
        base_url=settings.ollama_base_url,
        model=settings.ollama_model,
    )

    llm_router = LLMRouter(
        [
            ("groq", groq),
            ("gemini", gemini),
            ("ollama", ollama),
        ]
    )

    translator = LLMTranslationProvider(llm_router)

    # Initialize TTS providers
    edge_tts_provider = EdgeTTSProvider(
        voice=settings.edge_tts_voice,
        rate=settings.edge_tts_rate,
        pitch=settings.edge_tts_pitch,
    )
    tts_router = TTSRouter([("edge-tts", edge_tts_provider)])

    # Build pipeline
    orchestrator = PipelineOrchestrator(
        [
            ContextStep(),
            LLMStep(llm_router),
            EmotionParseStep(),
            TranslationStep(translator),
            TTSStep(tts_router),
        ]
    )

    logger.info("AI service initialized", provider=settings.llm_provider)
    yield
    logger.info("AI service shutting down")


app = FastAPI(
    title="Keshin AI Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "providers": {
            "llm": settings.llm_provider if settings else "unknown",
            "tts": settings.tts_provider if settings else "unknown",
        },
    }


@app.get("/api/chat/stream")
async def chat_stream(request: Request):
    """SSE streaming chat endpoint."""
    character_id = request.query_params.get("character_id", "default")
    message = request.query_params.get("message", "")
    session_id = request.query_params.get("session_id", "default")
    personality_prompt = request.query_params.get("personality_prompt", "")
    character_name = request.query_params.get("character_name", "")
    character_lang = request.query_params.get("character_lang", "ja")

    if not message:
        return {"error": "message is required"}, 400

    ctx = PipelineContext(
        user_message=message,
        character_id=character_id,
        session_id=session_id,
        personality_prompt=personality_prompt,
        character_name=character_name,
        character_lang=character_lang,
    )

    async def event_stream():
        async for event in orchestrator.run_stream(ctx):
            if await request.is_disconnected():
                break
            event_type = event.get("event", "")
            event_data = event.get("data", {})
            yield f"event: {event_type}\ndata: {json.dumps(event_data, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/chat")
async def chat(body: dict):
    """Chat endpoint — sends message to LLM and returns response."""
    ctx = PipelineContext(
        user_message=body.get("message", ""),
        character_id=body.get("character_id", "default"),
        session_id=body.get("session_id", "default"),
        personality_prompt=body.get("personality_prompt", ""),
        character_name=body.get("character_name", ""),
        character_lang=body.get("character_lang", "ja"),
        history=body.get("history", []),
    )

    result = await orchestrator.run(ctx)

    if result.error:
        return {"error": result.error}, 500

    return {
        "japanese_text": result.japanese_text,
        "english_subtitle": result.english_subtitle,
        "emotion": result.emotion,
        "emotion_intensity": result.emotion_intensity,
        "model": result.llm_model,
        "audio_path": result.audio_path,
        "audio_duration_ms": result.audio_duration_ms,
    }


@app.post("/api/tts")
async def synthesize_tts(body: dict):
    """TTS endpoint — synthesize audio for text."""
    text = body.get("text", "")
    if not text:
        return {"error": "text is required"}, 400

    try:
        result = await tts_router.synthesize(text=text)
        return {
            "audio_path": result.audio_path,
            "duration_ms": result.duration_ms,
            "visemes": [
                {"index": v.index, "offset_ms": v.offset_ms, "duration_ms": v.duration_ms}
                for v in result.visemes
            ],
        }
    except Exception as e:
        logger.error("TTS synthesis failed", error=str(e))
        return {"error": f"TTS synthesis failed: {e}"}, 500


@app.get("/api/characters/{character_id}/voices")
async def list_voices(character_id: str):
    """List available voices for a character."""
    return {
        "character_id": character_id,
        "provider": settings.tts_provider if settings else "unknown",
        "voices": [settings.edge_tts_voice] if settings else [],
    }
