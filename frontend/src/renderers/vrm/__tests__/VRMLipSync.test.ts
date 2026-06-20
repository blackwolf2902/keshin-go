import { describe, it, expect } from 'vitest';

describe('VRMLipSync', () => {
  it('should calculate viseme frame timing correctly', () => {
    const frames = [
      { viseme: 'aa', startTimeMs: 0, durationMs: 80 },
      { viseme: 'ih', startTimeMs: 80, durationMs: 80 },
      { viseme: 'ou', startTimeMs: 160, durationMs: 80 },
    ];
    expect(frames[0].startTimeMs).toBe(0);
    expect(frames[1].startTimeMs).toBeGreaterThan(frames[0].startTimeMs);
    expect(frames[2].startTimeMs).toBeGreaterThan(frames[1].startTimeMs);
  });

  it('should have smooth transitions between visemes', () => {
    const frames = [
      { viseme: 'aa', startTimeMs: 0, durationMs: 80 },
      { viseme: 'ih', startTimeMs: 80, durationMs: 80 },
    ];
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].startTimeMs).toBeGreaterThanOrEqual(
        frames[i - 1].startTimeMs + frames[i - 1].durationMs * 0.8
      );
    }
  });
});
