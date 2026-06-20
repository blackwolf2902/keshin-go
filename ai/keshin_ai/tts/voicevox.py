"""VOICEVOX TTS provider — talks to VOICEVOX Engine."""

import logging
import os
import tempfile
import uuid

import httpx

from .base import TTSResponse, VisemeTiming

logger = logging.getLogger(__name__)


class VoiceVoxProvider:
    """Text-to-speech provider using VOICEVOX Engine.

    Requires a running VOICEVOX container:
      docker compose up -d voicevox

    VOICEVOX provides phoneme timing for lip-sync.
    """

    def __init__(self, base_url: str = "http://localhost:50021", speaker_id: int = 0):
        self.base_url = base_url.rstrip("/")
        self.speaker_id = speaker_id

    async def synthesize(
        self,
        text: str,
        speaker_id: int | None = None,
        speed: float = 1.0,
    ) -> TTSResponse:
        """Synthesize speech using VOICEVOX Engine."""
        sid = speaker_id if speaker_id is not None else self.speaker_id

        async with httpx.AsyncClient(timeout=60.0) as client:
            # Step 1: Create audio query
            query_resp = await client.post(
                f"{self.base_url}/audio_query",
                params={"text": text, "speaker": sid},
            )
            query_resp.raise_for_status()
            query = query_resp.json()

            # Adjust speed
            if speed != 1.0:
                query["speedScale"] = speed

            # Step 2: Synthesize audio
            synthesis_resp = await client.post(
                f"{self.base_url}/synthesis",
                params={"speaker": sid},
                json=query,
            )
            synthesis_resp.raise_for_status()

        # Save audio to temp file
        temp_dir = tempfile.gettempdir()
        filename = f"keshin_tts_{uuid.uuid4().hex[:8]}.wav"
        output_path = os.path.join(temp_dir, filename)

        with open(output_path, "wb") as f:
            f.write(synthesis_resp.content)

        # Parse phoneme timing for visemes (if available)
        visemes: list[VisemeTiming] = []
        # TODO: Parse accent_phrases from query for phoneme timing

        duration_ms = (len(text) / 15.0) * 1000.0

        logger.info(
            "VOICEVOX TTS synthesized: text_len=%s path=%s speaker=%s",
            len(text),
            output_path,
            sid,
        )

        return TTSResponse(
            audio_path=output_path,
            duration_ms=duration_ms,
            visemes=visemes,
        )

    async def list_speakers(self) -> list[dict]:
        """List available VOICEVOX speakers."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/speakers")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.warning("Failed to list VOICEVOX speakers: %s", e)
            return []
