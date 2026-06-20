"""Tests for viseme estimation from Japanese text."""

from keshin_ai.tts.edge_tts import estimate_visemes_from_text


class TestVisemeEstimation:
    def test_basic_hiragana(self):
        visemes = estimate_visemes_from_text("あいうえお", 400.0)
        assert len(visemes) == 5
        assert visemes[0]["viseme"] == "aa"
        assert visemes[1]["viseme"] == "ih"
        assert visemes[2]["viseme"] == "ou"
        assert visemes[3]["viseme"] == "ee"
        assert visemes[4]["viseme"] == "oh"

    def test_strips_emotion_tags(self):
        visemes = estimate_visemes_from_text("[emotion:happy]こんにちは", 500.0)
        assert all(v["viseme"] in ("aa", "ih", "ou", "ee", "oh") for v in visemes)

    def test_punctuation_handling(self):
        visemes = estimate_visemes_from_text("はい。", 200.0)
        assert visemes[-1]["viseme"] == "ou"

    def test_empty_text(self):
        visemes = estimate_visemes_from_text("", 100.0)
        assert len(visemes) == 0

    def test_katakana(self):
        visemes = estimate_visemes_from_text("コンニチハ", 400.0)
        assert visemes[0]["viseme"] == "oh"
