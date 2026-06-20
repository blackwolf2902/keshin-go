"""Gemini LLM provider using litellm."""

import logging
from typing import AsyncIterator

from litellm import acompletion

from .base import LLMResponse, Message

logger = logging.getLogger(__name__)


class GeminiProvider:
    """LLM provider for Google Gemini (OpenAI-compatible endpoint)."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "gemini-2.0-flash-lite",
        base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai",
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def generate(self, messages: list[Message], **kwargs) -> LLMResponse:
        """Generate a complete response from Gemini."""
        try:
            response = await acompletion(
                model=f"gemini/{self.model}",
                messages=[{"role": m.role, "content": m.content} for m in messages],
                api_key=self.api_key or None,
                **kwargs,
            )
            return LLMResponse(
                text=response.choices[0].message.content,  # type: ignore
                model=self.model,
                usage=dict(response.usage or {}),  # type: ignore
            )
        except Exception as e:
            logger.error("Gemini API error: %s", e)
            raise

    async def stream(self, messages: list[Message], **kwargs) -> AsyncIterator[str]:
        """Stream response from Gemini."""
        try:
            response = await acompletion(
                model=f"gemini/{self.model}",
                messages=[{"role": m.role, "content": m.content} for m in messages],
                api_key=self.api_key or None,
                stream=True,
                **kwargs,
            )
            async for chunk in response:  # type: ignore
                if chunk.choices and len(chunk.choices) > 0:  # type: ignore
                    delta = chunk.choices[0].delta  # type: ignore
                    if delta and delta.content:
                        yield delta.content
        except Exception as e:
            logger.error("Gemini stream error: %s", e)
            raise
