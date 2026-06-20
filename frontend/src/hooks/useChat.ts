import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { getCharacters, getHealth, sendChat, streamChat } from "../lib/api";

let messageIdCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function useChat() {
  // Use individual selectors so stable action references don't trigger re-renders
  const currentCharacter = useChatStore((s) => s.currentCharacter);
  const messages = useChatStore((s) => s.messages);
  const characters = useChatStore((s) => s.characters);
  const health = useChatStore((s) => s.health);
  const isLoading = useChatStore((s) => s.isLoading);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const setCharacters = useChatStore((s) => s.setCharacters);
  const setCurrentCharacter = useChatStore((s) => s.setCurrentCharacter);
  const setHealth = useChatStore((s) => s.setHealth);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateLastMessage = useChatStore((s) => s.updateLastMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setError = useChatStore((s) => s.setError);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const abortRef = useRef<AbortController | null>(null);

  // Load characters and health on mount
  useEffect(() => {
    (async () => {
      try {
        const [fetchedCharacters, fetchedHealth] = await Promise.all([
          getCharacters(),
          getHealth(),
        ]);
        setCharacters(fetchedCharacters);
        setHealth(fetchedHealth);

        // Set default character
        if (fetchedCharacters.length > 0 && !currentCharacter) {
          const preferred =
            fetchedCharacters.find((c) => c.id !== "_example") ??
            fetchedCharacters[0];
          setCurrentCharacter(preferred);
        }
      } catch (err) {
        setError(
          `Failed to connect: ${err instanceof Error ? err.message : "Unknown"}`,
        );
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !currentCharacter) return;

      const userMsg = {
        id: nextId(),
        role: "user" as const,
        content: message.trim(),
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setLoading(true);
      setError(null);

      const charMsg = {
        id: nextId(),
        role: "character" as const,
        content: "",
        timestamp: Date.now(),
      };
      addMessage(charMsg);

      try {
        abortRef.current = new AbortController();
        const response = await sendChat(currentCharacter.id, message.trim());

        updateLastMessage({
          content: response.japanese_text,
          english_subtitle: response.english_subtitle,
          emotion: response.emotion,
          emotion_intensity: response.emotion_intensity,
        });
        if (response.audio_url) {
          useChatStore.getState().setAudioUrl(response.audio_url);
          useChatStore.getState().setSpeaking(true);
        }
        if (response.emotion) {
          useChatStore.getState().setEmotion(response.emotion);
        }
        if (response.english_subtitle) {
          useChatStore.getState().setSubtitle(response.english_subtitle);
        }
      } catch (err) {
        updateLastMessage({
          content: `Error: ${err instanceof Error ? err.message : "Request failed"}`,
        });
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [currentCharacter?.id, addMessage, setLoading, setError, updateLastMessage],
  );

  const sendMessageStream = useCallback(
    async (message: string) => {
      if (!message.trim() || !currentCharacter) return;

      const userMsg = {
        id: nextId(),
        role: "user" as const,
        content: message.trim(),
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setStreaming(true);
      setError(null);

      const charMsg = {
        id: nextId(),
        role: "character" as const,
        content: "",
        emotion: "neutral" as const,
        timestamp: Date.now(),
      };
      addMessage(charMsg);

      try {
        const stream = streamChat(currentCharacter.id, message.trim());

        for await (const chunk of stream) {
          if (chunk.event === "text") {
            updateLastMessage({
              content: (chunk.data as { text: string }).text,
            });
          } else if (chunk.event === "emotion") {
            updateLastMessage({
              emotion: (chunk.data as { emotion: string }).emotion,
              emotion_intensity: (chunk.data as { intensity?: number })
                .intensity,
            });
          } else if (chunk.event === "subtitle") {
            updateLastMessage({
              english_subtitle: (chunk.data as { subtitle: string }).subtitle,
            });
          } else if (chunk.event === "audio") {
            const audioData = chunk.data as { path: string; duration_ms: number };
            if (audioData.path) {
              const filename = audioData.path.split('/').pop() || audioData.path;
              useChatStore.getState().setAudioUrl(`/api/tts/audio/${filename}`);
              useChatStore.getState().setSpeaking(true);
            }
          }
        }
      } catch (err) {
        updateLastMessage({
          content: `Error: ${err instanceof Error ? err.message : "Stream failed"}`,
        });
        setError(err instanceof Error ? err.message : "Stream failed");
      } finally {
        setStreaming(false);
      }
    },
    [
      currentCharacter?.id,
      addMessage,
      setStreaming,
      setError,
      updateLastMessage,
    ],
  );

  return {
    messages,
    characters,
    currentCharacter,
    health,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    sendMessageStream,
    setCurrentCharacter,
    clearMessages,
    isDisabled: isLoading || isStreaming,
  };
}
