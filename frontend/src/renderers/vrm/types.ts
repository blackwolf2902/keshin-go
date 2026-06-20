import type { VRM } from '@pixiv/three-vrm';

// Emotion names matching LLM emotion tags and expression file names
export type EmotionName =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'thinking';

// VRM expression preset names (from three-vrm VRMExpressionPresetName)
export type VRMExpressionPreset =
  | 'aa'
  | 'ih'
  | 'ou'
  | 'ee'
  | 'oh'
  | 'blink'
  | 'blinkLeft'
  | 'blinkRight'
  | 'happy'
  | 'angry'
  | 'sad'
  | 'relaxed'
  | 'surprised'
  | 'neutral'
  | 'lookUp'
  | 'lookDown'
  | 'lookLeft'
  | 'lookRight';

// Expression definition loaded from pack expressions/*.toml
export interface ExpressionConfig {
  name: string;
  description: string;
  blend_shapes: Record<string, number>;
  motion?: {
    clip: string;
    duration: number;
  };
}

// Viseme timing from TTS
export interface VisemeFrame {
  viseme: string; // e.g., 'aa', 'ee', 'ih', 'oh', 'ou'
  startTimeMs: number;
  durationMs: number;
}

// Character state managed by Zustand
export interface CharacterState {
  vrm: VRM | null;
  isLoading: boolean;
  loadError: string | null;
  currentExpression: EmotionName;
  isSpeaking: boolean;
  currentViseme: string;
}

// Scene configuration
export interface VRMSceneConfig {
  backgroundColor: string;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  ambientLightIntensity: number;
  directionalLightIntensity: number;
}
