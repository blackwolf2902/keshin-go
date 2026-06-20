/**
 * Japanese phoneme to VRM viseme mapping.
 *
 * VRM viseme presets (from three-vrm VRMExpressionPresetName):
 *   aa, ih, ou, ee, oh
 *
 * These correspond to the Oculus viseme standard:
 *   aa = open mouth (あ, か, さ, た, な, etc.)
 *   ih = wide mouth (い, き, し, ち, に, etc.)
 *   ou = rounded mouth (う, く, す, つ, ぬ, etc.)
 *   ee = wide smile (え, け, せ, て, ね, etc.)
 *   oh = round open (お, こ, そ, と, の, etc.)
 *
 * When TTS providers return viseme timing (VOICEVOX/Kokoro),
 * we use those directly. When they don't (Edge TTS), we estimate
 * from the Japanese text.
 */

// Japanese character → VRM viseme mapping
const KANA_VISEME_MAP: Record<string, string> = {
  // あ行 — "aa" (open)
  'あ': 'aa', 'ア': 'aa',
  'い': 'ih', 'イ': 'ih',
  'う': 'ou', 'ウ': 'ou',
  'え': 'ee', 'エ': 'ee',
  'お': 'oh', 'オ': 'oh',

  // か行
  'か': 'aa', 'カ': 'aa',
  'き': 'ih', 'キ': 'ih',
  'く': 'ou', 'ク': 'ou',
  'け': 'ee', 'ケ': 'ee',
  'こ': 'oh', 'コ': 'oh',

  // さ行
  'さ': 'aa', 'サ': 'aa',
  'し': 'ih', 'シ': 'ih',
  'す': 'ou', 'ス': 'ou',
  'せ': 'ee', 'セ': 'ee',
  'そ': 'oh', 'ソ': 'oh',

  // た行
  'た': 'aa', 'タ': 'aa',
  'ち': 'ih', 'チ': 'ih',
  'つ': 'ou', 'ツ': 'ou',
  'て': 'ee', 'テ': 'ee',
  'と': 'oh', 'ト': 'oh',

  // な行
  'な': 'aa', 'ナ': 'aa',
  'に': 'ih', 'ニ': 'ih',
  'ぬ': 'ou', 'ヌ': 'ou',
  'ね': 'ee', 'ネ': 'ee',
  'の': 'oh', 'ノ': 'oh',

  // は行
  'は': 'aa', 'ハ': 'aa',
  'ひ': 'ih', 'ヒ': 'ih',
  'ふ': 'ou', 'フ': 'ou',
  'へ': 'ee', 'ヘ': 'ee',
  'ほ': 'oh', 'ホ': 'oh',

  // ま行
  'ま': 'aa', 'マ': 'aa',
  'み': 'ih', 'ミ': 'ih',
  'む': 'ou', 'ム': 'ou',
  'め': 'ee', 'メ': 'ee',
  'も': 'oh', 'モ': 'oh',

  // や行
  'や': 'aa', 'ヤ': 'aa',
  'ゆ': 'ou', 'ユ': 'ou',
  'よ': 'oh', 'ヨ': 'oh',

  // ら行
  'ら': 'aa', 'ラ': 'aa',
  'り': 'ih', 'リ': 'ih',
  'る': 'ou', 'ル': 'ou',
  'れ': 'ee', 'レ': 'ee',
  'ろ': 'oh', 'ロ': 'oh',

  // わ行
  'わ': 'aa', 'ワ': 'aa',
  'を': 'oh', 'ヲ': 'oh',
  'ん': 'aa', 'ン': 'aa',

  // 拗音 (small kana) — same as parent vowel
  'ゃ': 'aa', 'ャ': 'aa',
  'ゅ': 'ou', 'ュ': 'ou',
  'ょ': 'oh', 'ョ': 'oh',

  // Special: っ (double consonant) — brief closed mouth
  'っ': 'ou', 'ッ': 'ou',
};

// Duration per character in milliseconds for estimated visemes
const CHAR_DURATION_MS = 80;
// Inter-viseme blend time
const VISEME_BLEND_MS = 40;

export interface VisemeFrame {
  viseme: string;
  startTimeMs: number;
  durationMs: number;
}

/**
 * Estimate viseme timing from Japanese text.
 * Used when TTS provider doesn't provide viseme data (e.g., Edge TTS).
 */
export function estimateVisemesFromText(text: string): VisemeFrame[] {
  const frames: VisemeFrame[] = [];
  let timeMs = 0;

  // Strip emotion tags and non-speaking characters
  const cleanText = text.replace(/\[emotion:\w+\]/g, '').trim();

  for (const char of cleanText) {
    const viseme = KANA_VISEME_MAP[char];

    if (viseme) {
      frames.push({
        viseme,
        startTimeMs: timeMs,
        durationMs: CHAR_DURATION_MS,
      });
      timeMs += CHAR_DURATION_MS;
    } else if (char === '。' || char === '、' || char === '！' || char === '？') {
      // Punctuation — close mouth briefly
      frames.push({
        viseme: 'ou', // Closed position
        startTimeMs: timeMs,
        durationMs: 60,
      });
      timeMs += 60;
    }
    // Skip non-Japanese, non-punctuation characters (ROMAJI, spaces, etc.)
  }

  return frames;
}

/**
 * Validate viseme names against VRM presets.
 */
export function isValidViseme(viseme: string): boolean {
  return ['aa', 'ih', 'ou', 'ee', 'oh'].includes(viseme);
}

export { KANA_VISEME_MAP, CHAR_DURATION_MS, VISEME_BLEND_MS };
