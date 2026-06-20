"""Groq LLM provider using litellm."""

import logging
from typing import AsyncIterator

from litellm import acompletion

from .base import LLMResponse, Message

logger = logging.getLogger(__name__)


class GroqProvider:
    """LLM provider for Groq's API (OpenAI-compatible)."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "llama-3.3-70b-versatile",
        base_url: str = "https://api.groq.com/openai/v1",
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def generate(self, messages: list[Message], **kwargs) -> LLMResponse:
        """Generate a complete response from Groq."""
        try:
            response = await acompletion(
                model=f"groq/{self.model}",
                messages=[{"role": m.role, "content": m.content} for m in messages],
                api_key=self.api_key or None,
                **kwargs,
            )
            return LLMResponse(
                text=response.choices[0].message.content,  # type: ignore[union-attr]
                model=self.model,
                usage=dict(response.usage or {}),  # type: ignore[union-attr]
            )
        except Exception as e:
            logger.error("Groq API error: %s", e)
            raise

    async def stream(self, messages: list[Message], **kwargs) -> AsyncIterator[str]:
        """Stream response from Groq."""
        try:
            response = await acompletion(
                model=f"groq/{self.model}",
                messages=[{"role": m.role, "content": m.content} for m in messages],
                api_key=self.api_key or None,
                stream=True,
                **kwargs,
            )
            async for chunk in response:  # type: ignore[union-attr]
                if chunk.choices and len(chunk.choices) > 0:  # type: ignore[union-attr]
                    delta = chunk.choices[0].delta  # type: ignore[union-attr]
                    if delta and delta.content:
                        yield delta.content
        except Exception as e:
            logger.error("Groq stream error: %s", e)
            raise
