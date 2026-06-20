"""Map emotion names to VRM blend shape preset names."""

# Mapping from emotion names to VRM blend shape preset names.
# VRM blend shape presets: neutral, happy, angry, sad, relaxed,
# surprised, aa, ih, ou, ee, oh, blink
EMOTION_TO_BLEND_SHAPE: dict[str, str] = {
    "neutral": "neutral",
    "happy": "happy",
    "joy": "happy",
    "angry": "angry",
    "anger": "angry",
    "sad": "sad",
    "sadness": "sad",
    "relaxed": "relaxed",
    "calm": "relaxed",
    "surprised": "surprised",
    "surprise": "surprised",
    "shock": "surprised",
    "aa": "aa",
    "ih": "ih",
    "ou": "ou",
    "ee": "ee",
    "oh": "oh",
    "blink": "blink",
    "thinking": "neutral",
    "confused": "surprised",
    "excited": "happy",
    "embarrassed": "relaxed",
    "shy": "relaxed",
    "crying": "sad",
    "laughing": "happy",
    "smile": "happy",
}


def map_emotion(emotion: str) -> str:
    """Map an emotion name to a VRM blend shape preset name.

    Args:
        emotion: The emotion name (e.g., "happy", "sad").

    Returns:
        VRM blend shape preset name. Falls back to "neutral" if unknown.
    """
    return EMOTION_TO_BLEND_SHAPE.get(emotion.lower(), "neutral")
