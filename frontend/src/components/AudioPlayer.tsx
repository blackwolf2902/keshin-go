import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAudio } from '../hooks/useAudio';
import { useCharacterStore } from '../stores/characterStore';

/**
 * Audio player component. Renders nothing visible.
 * Watches the chat store for new audio URLs and plays them.
 */
export function AudioPlayer() {
  const currentAudioUrl = useChatStore((s) => s.currentAudioUrl);
  const lipSync = useCharacterStore((s) => s.lipSync);
  const visemeFrames = useCharacterStore((s) => s.visemeFrames);

  const { play } = useAudio({
    onPlayStart: () => {
      console.log('[AudioPlayer] Playing TTS audio');
      if (lipSync && visemeFrames && visemeFrames.length > 0) {
        lipSync.startLipSync(visemeFrames);
      }
    },
    onPlayEnd: () => {
      console.log('[AudioPlayer] Audio playback complete');
      lipSync?.stopLipSync();
    },
    onError: (error) => {
      console.error('[AudioPlayer] Audio error:', error);
      lipSync?.stopLipSync();
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
