"""LLM router with provider selection and fallback."""

import asyncio
import logging
from typing import AsyncIterator

import structlog

from .base import LLMProvider, LLMResponse, Message

logger = structlog.get_logger(__name__)


class LLMRouter:
    """Routes LLM requests across providers with fallback/retry.

    Tries providers in configured order: Groq → Gemini → OpenRouter → Ollama.
    Falls through on failure with exponential backoff.
    """

    def __init__(self, providers: list[tuple[str, LLMProvider]], max_retries: int = 2):
        self.providers = providers
        self.max_retries = max_retries

    async def generate(self, messages: list[Message], **kwargs) -> LLMResponse:
        """Generate a response, trying providers in order on failure."""
        last_error = None
        for provider_name, provider in self.providers:
            for attempt in range(self.max_retries + 1):
                try:
                    logger.info("llm.generate_attempt", provider=provider_name, attempt=attempt + 1)
                    return await provider.generate(messages, **kwargs)
                except Exception as e:
                    last_error = e
                    logger.warning(
                        "llm.generate_failed",
                        provider=provider_name,
                        attempt=attempt + 1,
                        error=str(e),
                    )
                    if attempt < self.max_retries:
                        wait = 2**attempt  # exponential backoff
                        await asyncio.sleep(wait)
                    else:
                        logger.info("llm.fallback", failed_provider=provider_name)

        # All providers exhausted
        logger.error("llm.all_providers_failed", error=str(last_error))
        raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")

    async def stream(self, messages: list[Message], **kwargs) -> AsyncIterator[str]:
        """Stream a response, trying providers in order on failure."""
        last_error = None
        for provider_name, provider in self.providers:
            for attempt in range(self.max_retries + 1):
                try:
                    logger.info("llm.stream_attempt", provider=provider_name, attempt=attempt + 1)
                    async for chunk in provider.stream(messages, **kwargs):
                        yield chunk
                    return  # Successfully streamed all chunks
                except Exception as e:
                    last_error = e
                    logger.warning(
                        "llm.stream_failed",
                        provider=provider_name,
                        attempt=attempt + 1,
                        error=str(e),
                    )
                    if attempt < self.max_retries:
                        wait = 2**attempt
                        await asyncio.sleep(wait)
                    else:
                        logger.info("llm.stream_fallback", failed_provider=provider_name)

        logger.error("llm.all_streams_failed", error=str(last_error))
        raise RuntimeError(f"All LLM stream providers failed. Last error: {last_error}")
