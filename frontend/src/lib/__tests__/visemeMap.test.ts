import { describe, it, expect } from 'vitest';
import { estimateVisemesFromText, isValidViseme } from '../visemeMap';

describe('estimateVisemesFromText', () => {
  it('should map basic hiragana to visemes', () => {
    const visemes = estimateVisemesFromText('あいうえお');
    expect(visemes).toHaveLength(5);
    expect(visemes[0].viseme).toBe('aa');
    expect(visemes[1].viseme).toBe('ih');
    expect(visemes[2].viseme).toBe('ou');
    expect(visemes[3].viseme).toBe('ee');
    expect(visemes[4].viseme).toBe('oh');
  });

  it('should map katakana to visemes', () => {
    const visemes = estimateVisemesFromText('アイウエオ');
    expect(visemes).toHaveLength(5);
    expect(visemes[0].viseme).toBe('aa');
  });

  it('should skip emotion tags', () => {
    const visemes = estimateVisemesFromText('[emotion:happy]こんにちは');
    expect(visemes.length).toBeGreaterThan(0);
  });

  it('should handle punctuation as brief mouth close', () => {
    const visemes = estimateVisemesFromText('はい。');
    expect(visemes.length).toBeGreaterThanOrEqual(2);
    const lastFrame = visemes[visemes.length - 1];
    expect(lastFrame.viseme).toBe('ou');
  });

  it('should return empty for empty text', () => {
    const visemes = estimateVisemesFromText('');
    expect(visemes).toHaveLength(0);
  });
});

describe('isValidViseme', () => {
  it('should accept valid VRM viseme names', () => {
    expect(isValidViseme('aa')).toBe(true);
    expect(isValidViseme('ih')).toBe(true);
    expect(isValidViseme('ou')).toBe(true);
    expect(isValidViseme('ee')).toBe(true);
    expect(isValidViseme('oh')).toBe(true);
  });

  it('should reject invalid viseme names', () => {
    expect(isValidViseme('happy')).toBe(false);
    expect(isValidViseme('xx')).toBe(false);
  });
});
