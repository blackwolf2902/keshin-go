"""Tests for the emotion parser."""

import pytest

from keshin_ai.emotion.parser import parse_emotion


class TestEmotionParser:
    """Test suite for emotion tag parsing."""

    def test_no_emotion_tag(self):
        """Text without emotion tags defaults to neutral."""
        result = parse_emotion("こんにちは！")
        assert result.emotion == "neutral"
        assert result.intensity == 0.0
        assert result.clean_text == "こんにちは！"

    def test_happy_emotion(self):
        """[emotion:happy] tag should be parsed correctly."""
        result = parse_emotion("今日はいい天気ですね[emotion:happy]")
        assert result.emotion == "happy"
        assert result.intensity == 0.5  # default
        assert result.clean_text == "今日はいい天気ですね"

    def test_happy_with_intensity(self):
        """[emotion:happy:80] tag with intensity."""
        result = parse_emotion("嬉しいです[emotion:happy:80]")
        assert result.emotion == "happy"
        assert result.intensity == 0.8
        assert result.clean_text == "嬉しいです"

    def test_sad_emotion(self):
        """[emotion:sad] tag should be parsed."""
        result = parse_emotion("ちょっと疲れた[emotion:sad]")
        assert result.emotion == "sad"
        assert result.intensity == 0.5
        assert result.clean_text == "ちょっと疲れた"

    def test_sad_with_intensity(self):
        """[emotion:sad:30] tag with low intensity."""
        result = parse_emotion("悲しいですね[emotion:sad:30]")
        assert result.emotion == "sad"
        assert result.intensity == 0.3
        assert result.clean_text == "悲しいですね"

    def test_emotion_at_start(self):
        """Emotion tag at the start of text."""
        result = parse_emotion("[emotion:surprised]本当ですか？！")
        assert result.emotion == "surprised"
        assert result.clean_text == "本当ですか？！"

    def test_multiple_emotions(self):
        """Multiple emotion tags — last one wins."""
        result = parse_emotion("最初は驚いた[emotion:surprised]でも今は嬉しい[emotion:happy]")
        assert result.emotion == "happy"
        assert result.clean_text == "最初は驚いたでも今は嬉しい"

    def test_emotion_with_extra_whitespace(self):
        """Emotion tag surrounded by whitespace."""
        result = parse_emotion("  大丈夫です  [emotion:calm]  ")
        assert result.emotion == "calm"
        assert result.clean_text == "大丈夫です"

    def test_case_insensitive_emotion(self):
        """Emotion tag should be case-insensitive."""
        result = parse_emotion("元気です[EMOTION:HAPPY]")
        assert result.emotion == "happy"
        assert result.clean_text == "元気です"

    def test_intensity_clamped_to_100(self):
        """Intensity values > 100 should be clamped to 1.0."""
        result = parse_emotion("最高[emotion:happy:200]")
        assert result.intensity == 1.0

    def test_unknown_emotion_preserved(self):
        """Unknown emotion names should be preserved as-is."""
        result = parse_emotion("テスト[emotion:custom_emotion]")
        assert result.emotion == "custom_emotion"
        assert result.clean_text == "テスト"

    def test_text_with_tags_only(self):
        """Only emotion tags with no actual text."""
        result = parse_emotion("[emotion:happy]")
        assert result.emotion == "happy"
        assert result.clean_text == ""

    def test_emotion_in_middle_of_text(self):
        """Emotion tag embedded in the middle of text."""
        result = parse_emotion("これが[emotion:happy]楽しいです")
        assert result.emotion == "happy"
        assert result.clean_text == "これが楽しいです"
