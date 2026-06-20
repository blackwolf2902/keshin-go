"""OpenRouter LLM provider using litellm."""

import logging
from typing import AsyncIterator

from litellm import acompletion

from .base import LLMResponse, Message

logger = logging.getLogger(__name__)


class OpenRouterProvider:
    """LLM provider for OpenRouter API (OpenAI-compatible)."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "meta-llama/llama-3.2-3b-instruct:free",
        base_url: str = "https://openrouter.ai/api/v1",
        timeout: float = 60.0,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.timeout = timeout

    async def generate(self, messages: list[Message], **kwargs) -> LLMResponse:
        """Generate a complete response from OpenRouter."""
        try:
            response = await acompletion(
                model=f"openrouter/{self.model}",
                messages=[{"role": m.role, "content": m.content} for m in messages],
                api_key=self.api_key or None,
                timeout=self.timeout,
                **kwargs,
            )
            return LLMResponse(
                text=response.choices[0].message.content,  # type: ignore[union-attr]
                model=self.model,
                usage=dict(response.usage or {}),  # type: ignore[union-attr]
            )
        except Exception as e:
            logger.error("OpenRouter API error: %s", e)
            raise

    async def stream(self, messages: list[Message], **kwargs) -> AsyncIterator[str]:
        """Stream response from OpenRouter."""
        try:
            response = await acompletion(
                model=f"openrouter/{self.model}",
                messages=[{"role": m.role, "content": m.content} for m in messages],
                api_key=self.api_key or None,
                timeout=self.timeout,
                stream=True,
                **kwargs,
            )
            async for chunk in response:  # type: ignore[union-attr]
                if chunk.choices and len(chunk.choices) > 0:  # type: ignore[union-attr]
                    delta = chunk.choices[0].delta  # type: ignore[union-attr]
                    if delta and delta.content:
                        yield delta.content
        except Exception as e:
            logger.error("OpenRouter stream error: %s", e)
            raise
