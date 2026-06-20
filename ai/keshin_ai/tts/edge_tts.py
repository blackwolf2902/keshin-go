"""Edge TTS provider — uses edge-tts for zero-setup TTS."""

import logging
import os
import tempfile
import uuid

import edge_tts

from .base import TTSResponse

logger = logging.getLogger(__name__)


class EdgeTTSProvider:
    """Text-to-speech provider using Microsoft Edge TTS.

    Edge TTS is free, requires no API key, and works offline after first use.
    Uses ja-JP-NanamiNeural for Japanese voice by default.

    Note: Edge TTS does not provide viseme timing data.
    """

    def __init__(
        self,
        voice: str = "ja-JP-NanamiNeural",
        rate: str = "+0%",
        pitch: str = "+0Hz",
    ):
        self.voice = voice
        self.rate = rate
        self.pitch = pitch

    async def synthesize(
        self,
        text: str,
        speaker_id: int | None = None,
        speed: float = 1.0,
    ) -> TTSResponse:
        """Synthesize speech using Edge TTS."""
        # Create temp file for audio
        temp_dir = tempfile.gettempdir()
        filename = f"keshin_tts_{uuid.uuid4().hex[:8]}.mp3"
        output_path = os.path.join(temp_dir, filename)

        # Configure rate
        rate_str = self.rate
        if speed != 1.0:
            # Adjust rate percentage by speed multiplier
            rate_val = int(self.rate.strip("+%")) if self.rate else 0
            adjusted = int(rate_val * speed)
            sign = "+" if adjusted >= 0 else ""
            rate_str = f"{sign}{adjusted}%"

        communicate = edge_tts.Communicate(
            text=text,
            voice=self.voice or "ja-JP-NanamiNeural",
            rate=rate_str,
            pitch=self.pitch,
        )

        await communicate.save(output_path)

        # Estimate duration (rough: ~15 chars/sec for Japanese)
        duration_ms = (len(text) / 15.0) * 1000.0

        logger.info(
            "Edge TTS synthesized: text_len=%s path=%s duration_ms=%s",
            len(text),
            output_path,
            duration_ms,
        )

        return TTSResponse(
            audio_path=output_path,
            duration_ms=duration_ms,
            visemes=[],  # Edge TTS doesn't provide visemes
        )
