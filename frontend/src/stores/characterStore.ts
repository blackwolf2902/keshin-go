import { create } from 'zustand';
import type { VRM } from '@pixiv/three-vrm';
import type { EmotionName, VisemeFrame } from '../renderers/vrm/types';

interface CharacterState {
  // Model state
  vrm: VRM | null;
  modelUrl: string | null;
  isLoading: boolean;
  loadProgress: number; // 0-100
  loadError: string | null;

  // Expression state
  currentExpression: EmotionName;
  expressionHistory: Array<{ emotion: EmotionName; timestamp: number }>;

  // Speaking state
  isSpeaking: boolean;
  currentViseme: string;

  // Audio state
  currentAudioUrl: string | null;

  // Viseme data from TTS (or estimated)
  visemeFrames: VisemeFrame[];
}

interface CharacterActions {
  setVRM: (vrm: VRM | null) => void;
  setModelUrl: (url: string | null) => void;
  setLoading: (loading: boolean) => void;
  setLoadProgress: (progress: number) => void;
  setLoadError: (error: string | null) => void;
  setExpression: (emotion: EmotionName) => void;
  setSpeaking: (speaking: boolean) => void;
  setCurrentViseme: (viseme: string) => void;
  setAudioUrl: (url: string | null) => void;
  setVisemeFrames: (frames: VisemeFrame[]) => void;
  reset: () => void;
}

const initialState: CharacterState = {
  vrm: null,
  modelUrl: null,
  isLoading: false,
  loadProgress: 0,
  loadError: null,
  currentExpression: 'neutral',
  expressionHistory: [],
  isSpeaking: false,
  currentViseme: 'neutral',
  currentAudioUrl: null,
  visemeFrames: [],
};

export const useCharacterStore = create<CharacterState & CharacterActions>()((set) => ({
  ...initialState,

  setVRM: (vrm) => set({ vrm }),
  setModelUrl: (url) => set({ modelUrl: url, isLoading: !!url }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadProgress: (progress) => set({ loadProgress: progress }),
  setLoadError: (error) => set({ loadError: error, isLoading: false }),

  setExpression: (emotion) =>
    set((state) => ({
      currentExpression: emotion,
      expressionHistory: [
        ...state.expressionHistory.slice(-19), // Keep last 20
        { emotion, timestamp: Date.now() },
      ],
    })),

  setSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setCurrentViseme: (viseme) => set({ currentViseme: viseme }),
  setAudioUrl: (url) => set({ currentAudioUrl: url }),
  setVisemeFrames: (frames) => set({ visemeFrames: frames }),

  reset: () => set(initialState),
}));
