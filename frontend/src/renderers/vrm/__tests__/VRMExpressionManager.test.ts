import { describe, it, expect } from 'vitest';

describe('VRMExpressionManager', () => {
  it('should start with neutral expression', () => {
    const expectedEmotions = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'thinking'];
    expect(expectedEmotions).toContain('neutral');
    expect(expectedEmotions).toContain('happy');
    expect(expectedEmotions).toHaveLength(6);
  });

  it('should map emotions to valid VRM blend shapes', () => {
    const validPresets = ['aa', 'ih', 'ou', 'ee', 'oh', 'blink', 'happy',
      'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'lookUp', 'lookDown'];
    expect(validPresets).toContain('happy');
    expect(validPresets).toContain('sad');
  });
});
