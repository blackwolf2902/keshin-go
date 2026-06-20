import type { VRM } from '@pixiv/three-vrm';
import type { VisemeFrame } from '../../lib/visemeMap';

// The 5 VRM mouth viseme presets
const MOUTH_VISEMES = ['aa', 'ih', 'ou', 'ee', 'oh'] as const;

export class VRMLipSync {
  private vrm: VRM | null = null;
  private visemeFrames: VisemeFrame[] = [];
  private isAnimating: boolean = false;
  private startTimeMs: number = 0;
  private currentVisemeValue: number = 0;

  // Viseme transition smoothing
  private readonly BLEND_SPEED = 12.0; // Higher = faster mouth transitions
  private readonly MAX_VISEME_VALUE = 0.8; // Don't open mouth 100% — looks unnatural

  /**
   * Bind to a VRM instance.
   */
  setVRM(vrm: VRM): void {
    this.vrm = vrm;
  }

  /**
   * Start lip-sync animation with the given viseme frames.
   * Call this when TTS audio begins playing.
   */
  startLipSync(visemeFrames: VisemeFrame[]): void {
    this.visemeFrames = visemeFrames;
    this.isAnimating = true;
    this.startTimeMs = performance.now();
  }

  /**
   * Stop lip-sync animation and close the mouth.
   */
  stopLipSync(): void {
    this.isAnimating = false;
    this.visemeFrames = [];
    this.resetMouth();
  }

  /**
   * Update mouth blend shapes. Call every frame.
   */
  update(delta: number): void {
    if (!this.vrm || !this.vrm.expressionManager) return;

    const manager = this.vrm.expressionManager;

    if (!this.isAnimating) {
      // Smoothly close mouth when not speaking
      this.currentVisemeValue = Math.max(0, this.currentVisemeValue - delta * this.BLEND_SPEED);
      if (this.currentVisemeValue < 0.01) {
        this.resetMouth();
        return;
      }
      // Closing — reduce aa proportionally
      const aaValue = manager.getValue('aa');
      manager.setValue('aa', Math.max(0, (typeof aaValue === 'number' ? aaValue : 0) - delta * this.BLEND_SPEED));
      return;
    }

    const elapsedMs = performance.now() - this.startTimeMs;

    // Find currently active viseme frames
    let activeViseme: string | null = null;
    let activeWeight = 0;

    for (const frame of this.visemeFrames) {
      const frameEnd = frame.startTimeMs + frame.durationMs;
      if (elapsedMs >= frame.startTimeMs && elapsedMs < frameEnd) {
        // Calculate weight within the frame (fade in/out)
        const frameProgress = (elapsedMs - frame.startTimeMs) / frame.durationMs;
        // Smooth step: fade in during first 20%, full during middle, fade out last 20%
        if (frameProgress < 0.2) {
          activeWeight = frameProgress / 0.2;
        } else if (frameProgress > 0.8) {
          activeWeight = (1 - frameProgress) / 0.2;
        } else {
          activeWeight = 1.0;
        }
        activeViseme = frame.viseme;
        break;
      }
    }

    // Reset all mouth visemes
    this.resetMouth();

    // Apply active viseme
    if (activeViseme && activeWeight > 0) {
      const weight = Math.min(activeWeight * this.MAX_VISEME_VALUE, this.MAX_VISEME_VALUE);
      manager.setValue(activeViseme, weight);
      this.currentVisemeValue = weight;
    }

    // Check if animation is complete
    if (this.visemeFrames.length > 0) {
      const lastFrame = this.visemeFrames[this.visemeFrames.length - 1];
      if (elapsedMs > lastFrame.startTimeMs + lastFrame.durationMs + 200) {
        // 200ms grace period after last viseme
        this.isAnimating = false;
      }
    }
  }

  /**
   * Reset all mouth viseme blend shapes to 0.
   */
  private resetMouth(): void {
    if (!this.vrm?.expressionManager) return;
    for (const viseme of MOUTH_VISEMES) {
      this.vrm.expressionManager.setValue(viseme, 0);
    }
  }

  /**
   * Check if lip-sync is currently animating.
   */
  getIsAnimating(): boolean {
    return this.isAnimating;
  }
}
