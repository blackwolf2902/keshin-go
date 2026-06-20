"""Pipeline orchestrator — runs steps in sequence with streaming support."""

import logging
from typing import AsyncIterator

from .context import PipelineContext
from .steps import (
    EmotionParseStep,
    LLMStep,
    PipelineStep,
    TranslationStep,
)

logger = logging.getLogger(__name__)


class PipelineOrchestrator:
    """Runs pipeline steps in sequence.

    Supports both synchronous (run) and streaming (run_stream) execution.
    For streaming, it yields progress events after each step.
    """

    def __init__(self, steps: list[PipelineStep]):
        self.steps = steps

    async def run(self, ctx: PipelineContext) -> PipelineContext:
        """Execute all pipeline steps sequentially and return the final context."""
        for step in self.steps:
            if ctx.error:
                break
            ctx = await step.execute(ctx)
        return ctx

    async def run_stream(self, ctx: PipelineContext) -> AsyncIterator[dict]:
        """Execute pipeline and yield intermediate results as SSE events.

        Yields dicts with keys: event (str), data (dict).
        Events: text, emotion, subtitle, done, error
        """
        for step in self.steps:
            if ctx.error:
                yield {"event": "error", "data": {"error": ctx.error}}
                return

            ctx = await step.execute(ctx)

            if isinstance(step, LLMStep):
                if ctx.llm_response:
                    yield {
                        "event": "text",
                        "data": {"text": ctx.llm_response, "model": ctx.llm_model},
                    }
            elif isinstance(step, EmotionParseStep):
                if ctx.japanese_text:
                    yield {"event": "text", "data": {"text": ctx.japanese_text}}
                yield {
                    "event": "emotion",
                    "data": {
                        "emotion": ctx.emotion,
                        "intensity": ctx.emotion_intensity,
                    },
                }
            elif isinstance(step, TranslationStep):
                if ctx.english_subtitle:
                    yield {
                        "event": "subtitle",
                        "data": {"subtitle": ctx.english_subtitle},
                    }

        yield {
            "event": "done",
            "data": {
                "emotion": ctx.emotion,
                "japanese_text": ctx.japanese_text,
                "english_subtitle": ctx.english_subtitle,
            },
        }
