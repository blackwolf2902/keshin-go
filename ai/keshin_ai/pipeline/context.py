"""Pipeline context dataclass — carries state through pipeline steps."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PipelineContext:
    """Context object that flows through all pipeline steps.

    Each step reads from and writes to this context.
    """

    # Input
    user_message: str
    character_id: str
    session_id: str = "default"

    # Loaded from character pack
    personality_prompt: str = ""
    character_name: str = ""
    character_lang: str = "ja"

    # Conversation history
    history: list[dict] = field(default_factory=list)

    # LLM output
    llm_response: str = ""
    llm_model: str = ""
    llm_usage: dict = field(default_factory=dict)

    # Emotion
    emotion: str = "neutral"
    emotion_intensity: float = 0.0

    # Translation
    japanese_text: str = ""
    english_subtitle: str = ""

    # TTS (populated in Phase 1A, used in later phases)
    audio_path: str = ""
    audio_duration_ms: float = 0.0
    visemes: list = field(default_factory=list)

    # Errors
    error: Optional[str] = None
