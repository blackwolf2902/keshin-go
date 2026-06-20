"""Base translation provider protocol."""

from typing import Protocol


class TranslationProvider(Protocol):
    """Protocol for text translation providers."""

    async def translate(
        self,
        text: str,
        source_lang: str = "ja",
        target_lang: str = "en",
    ) -> str:
        """Translate text from source language to target language."""
        ...
