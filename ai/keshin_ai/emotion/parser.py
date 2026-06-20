"""Parse emotion tags from LLM output."""

import re
from dataclasses import dataclass

# Regex to match [emotion:<name>[:<intensity>]] tags
EMOTION_TAG_RE = re.compile(r"\[emotion:(\w+)(?::(\d+))?\]", re.IGNORECASE)


@dataclass
class EmotionResult:
    """Parsed emotion data."""

    clean_text: str
    emotion: str  # e.g., "happy", "sad"
    intensity: float = 0.5  # 0.0 to 1.0


def parse_emotion(text: str) -> EmotionResult:
    """Parse emotion tags from LLM output text.

    Removes all [emotion:...] tags from the text and returns the
    clean text along with the last detected emotion and intensity.

    Args:
        text: Raw LLM output possibly containing emotion tags.

    Returns:
        EmotionResult with clean text, emotion name, and intensity.
    """
    matches = list(EMOTION_TAG_RE.finditer(text))
    clean_text = EMOTION_TAG_RE.sub("", text).strip()

    if not matches:
        return EmotionResult(
            clean_text=clean_text,
            emotion="neutral",
            intensity=0.0,
        )

    # Use the last emotion tag (most recent)
    last_match = matches[-1]
    emotion = last_match.group(1).lower()
    intensity_str = last_match.group(2)
    intensity = min(float(intensity_str) / 100.0, 1.0) if intensity_str else 0.5

    return EmotionResult(
        clean_text=clean_text,
        emotion=emotion,
        intensity=intensity,
    )
