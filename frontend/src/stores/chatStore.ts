import { create } from 'zustand';
import type { ChatMessage, Character, HealthResponse } from '../types';

interface ChatStore {
  // State
  messages: ChatMessage[];
  characters: Character[];
  currentCharacter: Character | null;
  health: HealthResponse | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;

  // Actions
  setCharacters: (characters: Character[]) => void;
  setCurrentCharacter: (character: Character) => void;
  setHealth: (health: HealthResponse) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (updates: Partial<ChatMessage>) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  characters: [],
  currentCharacter: null,
  health: null,
  isLoading: false,
  isStreaming: false,
  error: null,

  setCharacters: (characters) => set({ characters }),

  setCurrentCharacter: (character) => set({ currentCharacter: character }),

  setHealth: (health) => set({ health }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastMessage: (updates) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = { ...messages[messages.length - 1], ...updates };
      }
      return { messages };
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [] }),
}));
