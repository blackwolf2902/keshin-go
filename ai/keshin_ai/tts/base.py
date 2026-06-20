"""Base TTS provider protocol and data types."""

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class VisemeTiming:
    """Timing data for a single viseme (mouth shape)."""

    index: int  # Viseme index
    offset_ms: float  # Start time in milliseconds
    duration_ms: float  # Duration in milliseconds


@dataclass
class TTSResponse:
    """Response from a TTS provider."""

    audio_path: str  # Path to generated audio file
    duration_ms: float  # Duration of audio in milliseconds
    visemes: list[VisemeTiming] = field(default_factory=list)  # If available


class TTSProvider(Protocol):
    """Protocol for text-to-speech providers."""

    async def synthesize(
        self,
        text: str,
        speaker_id: int | None = None,
        speed: float = 1.0,
    ) -> TTSResponse:
        """Synthesize speech from text.

        Args:
            text: Text to synthesize.
            speaker_id: Speaker/voice identifier (provider-specific).
            speed: Speech speed multiplier.

        Returns:
            TTSResponse with audio path and timing data.
        """
        ...
