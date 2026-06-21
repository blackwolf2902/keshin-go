import { useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';

interface AudioEvents {
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for playing TTS audio via Web Audio API.
 * Manages audio lifecycle: download, decode, play, cleanup.
 */
export function useAudio(events?: AudioEvents) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const isPlayingRef = useRef(false);
  const eventsRef = useRef(events);

  // Update eventsRef safely inside an effect
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const setSpeaking = useChatStore((s) => s.setSpeaking);

  // Initialize AudioContext lazily (browsers require user gesture)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Fetch audio from URL and decode into AudioBuffer.
   */
  const loadAudio = useCallback(async (url: string): Promise<AudioBuffer> => {
    const ctx = getAudioContext();

    // Resume context if suspended (autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferRef.current = audioBuffer;
    return audioBuffer;
  }, [getAudioContext]);

  /**
   * Stop currently playing audio.
   */
  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // Source may already be stopped
      }
      sourceRef.current = null;
    }
    isPlayingRef.current = false;
    setSpeaking(false);
  }, [setSpeaking]);

  /**
   * Play audio from URL. Stops any currently playing audio first.
   */
  const play = useCallback(async (url: string) => {
    // Stop currently playing audio
    stop();

    try {
      const buffer = await loadAudio(url);
      const ctx = getAudioContext();

      // Resume if suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      source.onended = () => {
        isPlayingRef.current = false;
        setSpeaking(false);
        eventsRef.current?.onPlayEnd?.();
        sourceRef.current = null;
      };

      source.start(0);
      sourceRef.current = source;
      isPlayingRef.current = true;
      setSpeaking(true);
      eventsRef.current?.onPlayStart?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Audio playback error:', error);
      setSpeaking(false);
      eventsRef.current?.onError?.(error);
    }
  }, [loadAudio, getAudioContext, setSpeaking, stop]);

  /**
   * Check if audio is currently playing.
   */
  const isPlaying = useCallback(() => isPlayingRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stop]);

  return { play, stop, isPlaying, loadAudio };
}
