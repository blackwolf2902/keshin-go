import type { VRM } from '@pixiv/three-vrm';
import type { EmotionName, ExpressionConfig } from './types';

// Default expression mapping when no pack expression file is loaded.
// These map directly to VRM expression preset names from three-vrm.
const DEFAULT_EXPRESSION_MAP: Record<EmotionName, Record<string, number>> = {
  neutral: {
    neutral: 0.5,
  },
  happy: {
    happy: 0.9,
    ee: 0.3,
  },
  sad: {
    sad: 0.8,
    lookDown: 0.3,
  },
  angry: {
    angry: 0.9,
    lookDown: 0.1,
  },
  surprised: {
    surprised: 0.9,
    aa: 0.3,
  },
  thinking: {
    lookUp: 0.4,
    neutral: 0.3,
  },
};

export class VRMExpressionManager {
  private vrm: VRM | null = null;
  private expressionMap: Record<EmotionName, Record<string, number>>;
  private currentExpression: EmotionName = 'neutral';
  private previousExpression: EmotionName = 'neutral';
  private transitionTime: number = 0;
  private transitionDuration: number = 0.3; // seconds
  private isTransitioning: boolean = false;

  constructor(
    customExpressions?: Record<string, ExpressionConfig>,
  ) {
    // Start with defaults, override with pack expressions if provided
    this.expressionMap = { ...DEFAULT_EXPRESSION_MAP };

    if (customExpressions) {
      for (const [name, config] of Object.entries(customExpressions)) {
        if (this.isValidEmotionName(name)) {
          this.expressionMap[name as EmotionName] = config.blend_shapes;
        }
      }
    }
  }

  private isValidEmotionName(name: string): name is EmotionName {
    return name in DEFAULT_EXPRESSION_MAP;
  }

  /**
   * Bind to a VRM instance. Called when model is loaded.
   */
  setVRM(vrm: VRM): void {
    this.vrm = vrm;
    // Reset to neutral expression
    this.setExpression('neutral');
  }

  /**
   * Set the character expression with smooth transition.
   * Call this when an emotion event arrives from the pipeline.
   */
  setExpression(emotion: EmotionName): void {
    if (emotion === this.currentExpression) return;

    this.previousExpression = this.currentExpression;
    this.currentExpression = emotion;
    this.isTransitioning = true;
    this.transitionTime = 0;
  }

  /**
   * Update expression blend shapes. Call every frame.
   * Handles smooth transition between expressions.
   */
  update(delta: number): void {
    if (!this.vrm) return;

    const manager = this.vrm.expressionManager;
    if (!manager) return;

    if (this.isTransitioning) {
      this.transitionTime += delta;
      const t = Math.min(this.transitionTime / this.transitionDuration, 1.0);

      // Ease-out cubic for smooth feel
      const easedT = 1 - Math.pow(1 - t, 3);

      // Clear all expressions
      this.clearAllExpressions(manager);

      // Blend from previous to current
      const prevWeights = this.expressionMap[this.previousExpression] ?? {};
      const currWeights = this.expressionMap[this.currentExpression] ?? {};

      // Apply all blend shapes from both expressions
      const allKeys = new Set([...Object.keys(prevWeights), ...Object.keys(currWeights)]);
      for (const key of allKeys) {
        const prevWeight = prevWeights[key] ?? 0;
        const currWeight = currWeights[key] ?? 0;
        const blendedWeight = prevWeight * (1 - easedT) + currWeight * easedT;
        if (blendedWeight > 0.001) {
          manager.setValue(key, blendedWeight);
        }
      }

      if (t >= 1.0) {
        this.isTransitioning = false;
      }
    } else {
      // Steady state — apply current expression weights
      this.clearAllExpressions(manager);
      const weights = this.expressionMap[this.currentExpression] ?? {};
      for (const [key, weight] of Object.entries(weights)) {
        manager.setValue(key, weight);
      }
    }
  }

  /**
   * Reset all expression weights to zero (except blink which AutoBlinker controls).
   */
  private clearAllExpressions(manager: NonNullable<VRM['expressionManager']>): void {
    // Reset all preset expressions EXCEPT blink (controlled by AutoBlinker)
    const presets = ['aa', 'ih', 'ou', 'ee', 'oh',
      'happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'lookUp', 'lookDown',
      'lookLeft', 'lookRight'];

    for (const preset of presets) {
      manager.setValue(preset, 0);
    }
  }

  /**
   * Get the current expression name.
   */
  getCurrentExpression(): EmotionName {
    return this.currentExpression;
  }
}
