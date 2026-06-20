"""FastAPI application entry point for the Keshin AI service."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .llm.gemini import GeminiProvider
from .llm.groq import GroqProvider
from .llm.ollama import OllamaProvider
from .llm.router import LLMRouter
from .pipeline.context import PipelineContext
from .pipeline.orchestrator import PipelineOrchestrator
from .pipeline.steps import ContextStep, EmotionParseStep, LLMStep, TranslationStep
from .translation.llm_translate import LLMTranslationProvider

logger = logging.getLogger(__name__)

# Global state (set during lifespan)
settings: Settings = None  # type: ignore
orchestrator: PipelineOrchestrator = None  # type: ignore


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, clean up on shutdown."""
    global settings, orchestrator
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

    # Build pipeline
    orchestrator = PipelineOrchestrator(
        [
            ContextStep(),
            LLMStep(llm_router),
            EmotionParseStep(),
            TranslationStep(translator),
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
    }
