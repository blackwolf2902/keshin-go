"""Kokoro TTS provider — talks to Kokoro-FastAPI."""

import logging
import os
import tempfile
import uuid

import httpx

from .base import TTSResponse, VisemeTiming

logger = logging.getLogger(__name__)


class KokoroProvider:
    """Text-to-speech provider using Kokoro-FastAPI.

    Requires a running Kokoro-FastAPI container:
      docker compose up -d kokoro

    Kokoro provides viseme timing data for lip-sync.
    """

    def __init__(self, base_url: str = "http://localhost:8880", voice: str = "default"):
        self.base_url = base_url.rstrip("/")
        self.voice = voice

    async def synthesize(
        self,
        text: str,
        speaker_id: int | None = None,
        speed: float = 1.0,
    ) -> TTSResponse:
        """Synthesize speech using Kokoro-FastAPI."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/v1/audio/speech",
                json={
                    "model": "kokoro",
                    "input": text,
                    "voice": self.voice,
                    "response_format": "wav",
                    "speed": speed,
                },
            )
            response.raise_for_status()

        # Save audio to temp file
        temp_dir = tempfile.gettempdir()
        filename = f"keshin_tts_{uuid.uuid4().hex[:8]}.wav"
        output_path = os.path.join(temp_dir, filename)

        with open(output_path, "wb") as f:
            f.write(response.content)

        # Kokoro may return viseme data in headers or response
        visemes: list[VisemeTiming] = []
        # TODO: Parse viseme data from Kokoro when available

        duration_ms = (len(text) / 15.0) * 1000.0  # Rough estimate

        logger.info(
            "Kokoro TTS synthesized: text_len=%s path=%s",
            len(text),
            output_path,
        )

        return TTSResponse(
            audio_path=output_path,
            duration_ms=duration_ms,
            visemes=visemes,
        )

    async def list_voices(self) -> list[str]:
        """List available Kokoro voices."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/v1/models")
                response.raise_for_status()
                data = response.json()
                return [m["id"] for m in data.get("data", [])]
        except Exception as e:
            logger.warning("Failed to list Kokoro voices: %s", e)
            return ["default"]
