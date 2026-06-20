"""LLM-based translation provider."""

import logging
from typing import AsyncIterator

from ..llm.base import LLMProvider, Message
from .base import TranslationProvider

logger = logging.getLogger(__name__)

TRANSLATION_SYSTEM_PROMPT = (
    "You are a translator. Translate the given text from {source_lang} to {target_lang}. "
    "Preserve the meaning, tone, and style naturally. "
    "Output ONLY the translated text, no explanations."
)


class LLMTranslationProvider:
    """Translates text using an LLM provider."""

    def __init__(self, llm_provider: LLMProvider, model: str = ""):
        self.llm_provider = llm_provider
        self.model = model

    async def translate(
        self,
        text: str,
        source_lang: str = "ja",
        target_lang: str = "en",
    ) -> str:
        """Translate text using the LLM provider."""
        system_prompt = TRANSLATION_SYSTEM_PROMPT.format(
            source_lang=source_lang,
            target_lang=target_lang,
        )
        messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=text),
        ]
        kwargs = {}
        if self.model:
            kwargs["model"] = self.model

        response = await self.llm_provider.generate(messages, **kwargs)
        return response.text.strip()
