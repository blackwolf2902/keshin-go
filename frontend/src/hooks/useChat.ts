import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { getCharacters, getHealth, sendChat, streamChat } from '../lib/api';

let messageIdCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function useChat() {
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);

  // Load characters and health on mount
  useEffect(() => {
    (async () => {
      try {
        const [characters, health] = await Promise.all([
          getCharacters(),
          getHealth(),
        ]);
        store.setCharacters(characters);
        store.setHealth(health);

        // Set default character
        if (characters.length > 0 && !store.currentCharacter) {
          const preferred = characters.find((c) => c.id !== '_example') ?? characters[0];
          store.setCurrentCharacter(preferred);
        }
      } catch (err) {
        store.setError(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    })();
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !store.currentCharacter) return;

      const userMsg = {
        id: nextId(),
        role: 'user' as const,
        content: message.trim(),
        timestamp: Date.now(),
      };
      store.addMessage(userMsg);
      store.setLoading(true);
      store.setError(null);

      // Placeholder character message
      const charMsg = {
        id: nextId(),
        role: 'character' as const,
        content: '',
        timestamp: Date.now(),
      };
      store.addMessage(charMsg);

      try {
        abortRef.current = new AbortController();
        const response = await sendChat(
          store.currentCharacter.id,
          message.trim(),
        );

        store.updateLastMessage({
          content: response.japanese_text,
          english_subtitle: response.english_subtitle,
          emotion: response.emotion,
          emotion_intensity: response.emotion_intensity,
        });
      } catch (err) {
        store.updateLastMessage({
          content: `Error: ${err instanceof Error ? err.message : 'Request failed'}`,
        });
        store.setError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        store.setLoading(false);
        abortRef.current = null;
      }
    },
    [store.currentCharacter?.id],
  );

  const sendMessageStream = useCallback(
    async (message: string) => {
      if (!message.trim() || !store.currentCharacter) return;

      const userMsg = {
        id: nextId(),
        role: 'user' as const,
        content: message.trim(),
        timestamp: Date.now(),
      };
      store.addMessage(userMsg);
      store.setStreaming(true);
      store.setError(null);

      const charMsg = {
        id: nextId(),
        role: 'character' as const,
        content: '',
        emotion: 'neutral' as const,
        timestamp: Date.now(),
      };
      store.addMessage(charMsg);

      try {
        const stream = streamChat(
          store.currentCharacter.id,
          message.trim(),
        );

        for await (const chunk of stream) {
          if (chunk.event === 'text') {
            store.updateLastMessage({
              content: (chunk.data as { text: string }).text,
            });
          } else if (chunk.event === 'emotion') {
            store.updateLastMessage({
              emotion: (chunk.data as { emotion: string }).emotion,
              emotion_intensity: (chunk.data as { intensity?: number }).intensity,
            });
          } else if (chunk.event === 'subtitle') {
            store.updateLastMessage({
              english_subtitle: (chunk.data as { subtitle: string }).subtitle,
            });
          }
        }
      } catch (err) {
        store.updateLastMessage({
          content: `Error: ${err instanceof Error ? err.message : 'Stream failed'}`,
        });
        store.setError(err instanceof Error ? err.message : 'Stream failed');
      } finally {
        store.setStreaming(false);
      }
    },
    [store.currentCharacter?.id],
  );

  return {
    ...store,
    sendMessage,
    sendMessageStream,
    isDisabled: store.isLoading || store.isStreaming,
  };
}
