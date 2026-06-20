import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAudio } from '../hooks/useAudio';

/**
 * Audio player component. Renders nothing visible.
 * Watches the chat store for new audio URLs and plays them.
 */
export function AudioPlayer() {
  const currentAudioUrl = useChatStore((s) => s.currentAudioUrl);
  const { play } = useAudio({
    onPlayStart: () => {
      console.log('[AudioPlayer] Playing TTS audio');
    },
    onPlayEnd: () => {
      console.log('[AudioPlayer] Audio playback complete');
    },
    onError: (error) => {
      console.error('[AudioPlayer] Audio error:', error);
    },
  });

  const prevAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentAudioUrl && currentAudioUrl !== prevAudioUrlRef.current) {
      prevAudioUrlRef.current = currentAudioUrl;
      play(currentAudioUrl);
    }
  }, [currentAudioUrl, play]);

  // This component renders nothing — it's a side-effect handler
  return null;
}
