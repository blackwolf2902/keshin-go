"""Edge TTS provider — uses edge-tts for zero-setup TTS."""

import logging
import os
import re
import tempfile
import uuid

import edge_tts

from .base import TTSResponse

logger = logging.getLogger(__name__)

_VISEME_MAP = {
    "\u3042": "aa",
    "\u30a2": "aa",
    "\u3044": "ih",
    "\u30a4": "ih",
    "\u3046": "ou",
    "\u30a6": "ou",
    "\u3048": "ee",
    "\u30a8": "ee",
    "\u304a": "oh",
    "\u30aa": "oh",
    "\u304b": "aa",
    "\u30ab": "aa",
    "\u304d": "ih",
    "\u30ad": "ih",
    "\u304f": "ou",
    "\u30af": "ou",
    "\u3051": "ee",
    "\u30b1": "ee",
    "\u3053": "oh",
    "\u30b3": "oh",
    "\u3055": "aa",
    "\u30b5": "aa",
    "\u3057": "ih",
    "\u30b7": "ih",
    "\u3059": "ou",
    "\u30b9": "ou",
    "\u305b": "ee",
    "\u30bb": "ee",
    "\u305d": "oh",
    "\u30bd": "oh",
    "\u305f": "aa",
    "\u30bf": "aa",
    "\u3061": "ih",
    "\u30c1": "ih",
    "\u3064": "ou",
    "\u30c4": "ou",
    "\u3066": "ee",
    "\u30c6": "ee",
    "\u3068": "oh",
    "\u30c8": "oh",
    "\u306a": "aa",
    "\u30ca": "aa",
    "\u306b": "ih",
    "\u30cb": "ih",
    "\u306c": "ou",
    "\u30cc": "ou",
    "\u306d": "ee",
    "\u30cd": "ee",
    "\u306e": "oh",
    "\u30ce": "oh",
    "\u306f": "aa",
    "\u30cf": "aa",
    "\u3072": "ih",
    "\u30d2": "ih",
    "\u3075": "ou",
    "\u30d5": "ou",
    "\u3078": "ee",
    "\u30d8": "ee",
    "\u307b": "oh",
    "\u30db": "oh",
    "\u307e": "aa",
    "\u30de": "aa",
    "\u307f": "ih",
    "\u30df": "ih",
    "\u3080": "ou",
    "\u30e0": "ou",
    "\u3081": "ee",
    "\u30e1": "ee",
    "\u3082": "oh",
    "\u30e2": "oh",
    "\u3084": "aa",
    "\u30e4": "aa",
    "\u3086": "ou",
    "\u30e6": "ou",
    "\u3088": "oh",
    "\u30e8": "oh",
    "\u3089": "aa",
    "\u30e9": "aa",
    "\u308a": "ih",
    "\u30ea": "ih",
    "\u308b": "ou",
    "\u30eb": "ou",
    "\u308c": "ee",
    "\u30ec": "ee",
    "\u308d": "oh",
    "\u30ed": "oh",
    "\u308f": "aa",
    "\u30ef": "aa",
    "\u3092": "oh",
    "\u30f2": "oh",
    "\u3093": "aa",
    "\u30f3": "aa",
    "\u3083": "aa",
    "\u30e3": "aa",
    "\u3085": "ou",
    "\u30e5": "ou",
    "\u3087": "oh",
    "\u30e7": "oh",
    "\u3063": "ou",
    "\u30c3": "ou",
}


def _kana_to_viseme(char: str) -> str | None:
    """Map a Japanese kana character to a VRM viseme name."""
    return _VISEME_MAP.get(char)


def estimate_visemes_from_text(text: str, duration_ms: float) -> list[dict]:
    """Estimate viseme timing from Japanese text.

    Used when TTS provider doesn't supply viseme data.
    """
    clean = re.sub(r"\[emotion:\w+\]", "", text).strip()
    chars = [c for c in clean if _kana_to_viseme(c) or c in "\u3002\u3001\uff01\uff1f"]

    if not chars:
        return []

    char_duration = duration_ms / max(len(chars), 1)
    visemes = []
    time_ms = 0.0

    for char in chars:
        viseme = _kana_to_viseme(char)
        if viseme:
            visemes.append(
                {
                    "viseme": viseme,
                    "time_ms": time_ms,
                    "duration_ms": char_duration,
                }
            )
            time_ms += char_duration
        elif char in "\u3002\u3001\uff01\uff1f":
            visemes.append(
                {
                    "viseme": "ou",
                    "time_ms": time_ms,
                    "duration_ms": 60.0,
                }
            )
            time_ms += 60.0

    return visemes


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
        temp_dir = os.path.join(tempfile.gettempdir(), "keshin_tts")
        os.makedirs(temp_dir, exist_ok=True)
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
            visemes=estimate_visemes_from_text(text, duration_ms=duration_ms),
        )
