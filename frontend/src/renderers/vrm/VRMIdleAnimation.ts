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

  // Apply rotation to spine bones if available for breathing
  const spine = vrm.humanoid.getNormalizedBoneNode('spine');
  if (spine) {
    spine.rotation.x = breathOffset * 2.0;
  }

  const chest = vrm.humanoid.getNormalizedBoneNode('chest');
  if (chest) {
    chest.rotation.x = breathOffset * 1.0;
  }

  // Apply sway as rotation to hips
  const hips = vrm.humanoid.getNormalizedBoneNode('hips');
  if (hips) {
    hips.rotation.z = swayOffset * 4.0;
  }

  // Natural hanging arm pose (out of T-pose)
  // In VRM normalized bone space: left arm Y-axis points toward hand
  // Z rotation lowers the arm: positive = lower for left, negative = lower for right
  const leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
  if (leftUpperArm) {
    leftUpperArm.rotation.z = -1.3;  // lower left arm toward body
    leftUpperArm.rotation.x = 0.0;
    leftUpperArm.rotation.y = 0.1;   // slight inward angle
  }
  const rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
  if (rightUpperArm) {
    rightUpperArm.rotation.z = 1.3;  // lower right arm toward body
    rightUpperArm.rotation.x = 0.0;
    rightUpperArm.rotation.y = -0.1; // slight inward angle
  }
  const leftLowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
  if (leftLowerArm) {
    leftLowerArm.rotation.y = 0.3;   // slight elbow bend inward
    leftLowerArm.rotation.z = 0.0;
  }
  const rightLowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
  if (rightLowerArm) {
    rightLowerArm.rotation.y = -0.3; // slight elbow bend inward
    rightLowerArm.rotation.z = 0.0;
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
