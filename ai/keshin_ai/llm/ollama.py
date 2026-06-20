"""Ollama LLM provider using litellm."""

import logging
from typing import AsyncIterator

from litellm import acompletion

from .base import LLMResponse, Message

logger = logging.getLogger(__name__)


class OllamaProvider:
    """LLM provider for local Ollama instance."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.2:3b",
    ):
        self.base_url = base_url
        self.model = model

    async def generate(self, messages: list[Message], **kwargs) -> LLMResponse:
        """Generate a complete response from Ollama."""
        try:
            response = await acompletion(
                model=f"ollama/{self.model}",
                messages=[{"role": m.role, "content": m.content} for m in messages],
                api_base=self.base_url,
                **kwargs,
            )
            return LLMResponse(
                text=response.choices[0].message.content,
                model=self.model,
                usage=dict(response.usage or {}),
            )
        except Exception as e:
            logger.error("Ollama API error: %s", e)
            raise

    async def stream(self, messages: list[Message], **kwargs) -> AsyncIterator[str]:
        """Stream response from Ollama."""
        try:
            response = await acompletion(
                model=f"ollama/{self.model}",
                messages=[{"role": m.role, "content": m.content} for m in messages],
                api_base=self.base_url,
                stream=True,
                **kwargs,
            )
            async for chunk in response:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        yield delta.content
        except Exception as e:
            logger.error("Ollama stream error: %s", e)
            raise
