"""Pipeline steps — each step is a self-contained transformation on PipelineContext."""

import logging
from abc import ABC, abstractmethod

from ..emotion.parser import parse_emotion
from ..llm.base import Message as LLMMessage
from ..llm.router import LLMRouter
from ..translation.base import TranslationProvider
from ..tts.base import TTSProvider
from .context import PipelineContext

logger = logging.getLogger(__name__)


class PipelineStep(ABC):
    """Base class for a single pipeline step."""

    @abstractmethod
    async def execute(self, ctx: PipelineContext) -> PipelineContext:
        """Execute this step, mutating and returning the context."""
        ...


class ContextStep(PipelineStep):
    """Loads personality and history into the context."""

    def __init__(self):
        pass

    async def execute(self, ctx: PipelineContext) -> PipelineContext:
        """Build the system prompt and load history."""
        logger.info("step.context: character=%s session=%s", ctx.character_id, ctx.session_id)
        # Personality and history are already loaded by the caller;
        # this step validates their presence or falls back to a default.
        if not ctx.personality_prompt:
            ctx.personality_prompt = "You are a helpful anime assistant."
        return ctx


class LLMStep(PipelineStep):
    """Calls the LLM router to generate a response."""

    def __init__(self, llm_router: LLMRouter, system_prompt_builder=None):
        self.llm_router = llm_router
        self.system_prompt_builder = system_prompt_builder or self._default_system_prompt

    def _default_system_prompt(self, ctx: PipelineContext) -> str:
        return (
            f"You are {ctx.character_name}, a Japanese anime character. "
            f"{ctx.personality_prompt}\n\n"
            "IMPORTANT: Always respond in Japanese. "
            "You may optionally include an emotion tag at the end: [emotion:<name>]. "
            "Example: [emotion:happy] or [emotion:sad:80] for 80% intensity."
        )

    async def execute(self, ctx: PipelineContext) -> PipelineContext:
        """Send messages to LLM and store response."""
        if ctx.error:
            return ctx

        system_prompt = self.system_prompt_builder(ctx)
        messages = [LLMMessage(role="system", content=system_prompt)]

        # Add history
        for msg in ctx.history:
            messages.append(
                LLMMessage(role=msg.get("role", "user"), content=msg.get("content", ""))
            )

        # Add current user message
        messages.append(LLMMessage(role="user", content=ctx.user_message))

        try:
            response = await self.llm_router.generate(messages)
            ctx.llm_response = response.text
            ctx.llm_model = response.model
            ctx.llm_usage = response.usage
            logger.info("step.llm.complete: model=%s tokens=%s", response.model, response.usage)
        except Exception as e:
            ctx.error = f"LLM generation failed: {e}"
            logger.error("step.llm.failed: %s", e)

        return ctx


class EmotionParseStep(PipelineStep):
    """Extracts emotion tags from LLM response."""

    async def execute(self, ctx: PipelineContext) -> PipelineContext:
        """Parse emotion from LLM response text."""
        if ctx.error or not ctx.llm_response:
            return ctx

        result = parse_emotion(ctx.llm_response)
        ctx.japanese_text = result.clean_text
        ctx.emotion = result.emotion
        ctx.emotion_intensity = result.intensity
        logger.info("step.emotion: emotion=%s intensity=%s", ctx.emotion, ctx.emotion_intensity)

        return ctx


class TranslationStep(PipelineStep):
    """Translates Japanese text to English for subtitle display."""

    def __init__(self, translator: TranslationProvider):
        self.translator = translator

    async def execute(self, ctx: PipelineContext) -> PipelineContext:
        """Translate Japanese text to English."""
        if ctx.error or not ctx.japanese_text:
            return ctx

        try:
            ctx.english_subtitle = await self.translator.translate(
                text=ctx.japanese_text,
                source_lang=ctx.character_lang or "ja",
                target_lang="en",
            )
            logger.info("step.translation.complete: subtitle=%s", ctx.english_subtitle[:50])
        except Exception as e:
            logger.warning("step.translation.failed: %s", e)
            # Translation failure is non-fatal — show original text as subtitle
            ctx.english_subtitle = ctx.japanese_text

        return ctx


class TTSStep(PipelineStep):
    """Synthesizes audio from Japanese text using TTS provider."""

    def __init__(self, tts_provider: TTSProvider):
        self.tts_provider = tts_provider

    async def execute(self, ctx: PipelineContext) -> PipelineContext:
        """Synthesize audio for the Japanese text."""
        if ctx.error or not ctx.japanese_text:
            return ctx

        try:
            result = await self.tts_provider.synthesize(
                text=ctx.japanese_text,
            )
            ctx.audio_path = result.audio_path
            ctx.audio_duration_ms = result.duration_ms
            ctx.visemes = result.visemes
            logger.info(
                "step.tts.complete: path=%s duration=%s", result.audio_path, result.duration_ms
            )
        except Exception as e:
            logger.warning("step.tts.failed: %s", e)
            # TTS failure is non-fatal for text pipeline

        return ctx
