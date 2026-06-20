/** Shared types for the Keshin frontend */

export interface Character {
  id: string;
  name: string;
  lang: string;
  description?: string;
  author?: string;
  version?: string;
  voice?: string;
}

export interface ChatResponse {
  japanese_text: string;
  english_subtitle: string;
  emotion: string;
  emotion_intensity: number;
  model: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'character';
  content: string;
  english_subtitle?: string;
  emotion?: string;
  emotion_intensity?: number;
  timestamp: number;
}

export interface HealthResponse {
  status: string;
  go: string;
  python: string;
  providers: {
    llm: string;
    tts: string;
  };
}

export interface StreamChunk {
  event: string;
  data: Record<string, unknown>;
}
