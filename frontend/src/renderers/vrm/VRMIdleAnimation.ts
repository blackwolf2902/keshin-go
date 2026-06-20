import type { VRM } from '@pixiv/three-vrm';

const BREATH_RATE = 0.3; // Breaths per second
const BREATH_SCALE = 0.008; // Subtle vertical movement
const SWAY_RATE = 0.15; // Sway cycles per second
const SWAY_AMOUNT = 0.003; // Subtle horizontal sway

/**
 * Apply idle animation to a VRM model (breathing + gentle sway).
 * Call this every frame with the delta time.
 */
export function applyIdleAnimation(vrm: VRM, _delta: number, elapsed: number): void {
  // Subtle breathing — scale the spine slightly on Y axis
  const breathOffset = Math.sin(elapsed * BREATH_RATE * Math.PI * 2) * BREATH_SCALE;

  // Gentle body sway
  const swayOffset = Math.sin(elapsed * SWAY_RATE * Math.PI * 2) * SWAY_AMOUNT;

  // Apply to spine bones if available
  const spine = vrm.humanoid.getNormalizedBoneNode('spine');
  if (spine) {
    spine.position.y = breathOffset;
  }

  const hips = vrm.humanoid.getNormalizedBoneNode('hips');
  if (hips) {
    hips.position.y = breathOffset;
    hips.position.x = swayOffset;
  }
}

/**
 * Auto-blink controller using exponential distribution for natural timing.
 */
export class AutoBlinker {
  private nextBlinkTime: number = 2;
  private blinkDuration: number = 0.15; // seconds
  private isBlinking: boolean = false;
  private blinkStartTime: number = 0;

  update(elapsed: number, vrm: VRM): void {
    if (this.isBlinking) {
      const blinkElapsed = elapsed - this.blinkStartTime;
      if (blinkElapsed > this.blinkDuration) {
        this.isBlinking = false;
        vrm.expressionManager?.setValue('blink', 0);
        // Schedule next blink: 2–6 seconds from now
        this.nextBlinkTime = elapsed + 2 + Math.random() * 4;
      } else {
        // Smooth blink curve: close → open
        const t = blinkElapsed / this.blinkDuration;
        const blinkValue = t < 0.5 ? t * 2 : (1 - t) * 2;
        vrm.expressionManager?.setValue('blink', Math.max(0.8, blinkValue));
      }
    } else if (elapsed >= this.nextBlinkTime) {
      this.isBlinking = true;
      this.blinkStartTime = elapsed;
    }
  }
}
