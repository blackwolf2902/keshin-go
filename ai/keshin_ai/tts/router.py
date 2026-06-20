"""TTS router — selects and falls back between TTS providers."""

import structlog

from .base import TTSProvider, TTSResponse
from .edge_tts import EdgeTTSProvider
from .kokoro import KokoroProvider
from .voicevox import VoiceVoxProvider

logger = structlog.get_logger(__name__)


class TTSRouter:
    """Routes TTS requests across providers with fallback.

    Tries providers in configured order: edge-tts → kokoro → voicevox.
    Falls through on failure.
    """

    def __init__(self, providers: list[tuple[str, TTSProvider]]):
        self.providers = providers

    async def synthesize(
        self,
        text: str,
        speaker_id: int | None = None,
        speed: float = 1.0,
    ) -> TTSResponse:
        """Synthesize speech, trying providers in order on failure."""
        last_error = None
        for provider_name, provider in self.providers:
            try:
                logger.info("tts.synthesize_attempt", provider=provider_name)
                return await provider.synthesize(
                    text=text,
                    speaker_id=speaker_id,
                    speed=speed,
                )
            except Exception as e:
                last_error = e
                logger.warning(
                    "tts.synthesize_failed",
                    provider=provider_name,
                    error=str(e),
                )

        logger.error("tts.all_providers_failed", error=str(last_error))
        raise RuntimeError(f"All TTS providers failed. Last error: {last_error}")

    @classmethod
    def create_default(cls, config: dict | None = None) -> "TTSRouter":
        """Create a TTS router with default providers."""
        cfg = config or {}

        providers: list[tuple[str, TTSProvider]] = [
            (
                "edge-tts",
                EdgeTTSProvider(
                    voice=cfg.get("edge_tts", {}).get("voice", "ja-JP-NanamiNeural"),
                    rate=cfg.get("edge_tts", {}).get("rate", "+0%"),
                    pitch=cfg.get("edge_tts", {}).get("pitch", "+0Hz"),
                ),
            ),
        ]

        # Add Kokoro if configured
        kokoro_url = cfg.get("kokoro", {}).get("base_url", "")
        if kokoro_url:
            providers.append(
                (
                    "kokoro",
                    KokoroProvider(
                        base_url=kokoro_url,
                        voice=cfg.get("kokoro", {}).get("voice", "default"),
                    ),
                )
            )

        # Add VOICEVOX if configured
        voicevox_url = cfg.get("voicevox", {}).get("base_url", "")
        if voicevox_url:
            providers.append(
                (
                    "voicevox",
                    VoiceVoxProvider(
                        base_url=voicevox_url,
                        speaker_id=cfg.get("voicevox", {}).get("speaker_id", 0),
                    ),
                )
            )

        return cls(providers)
