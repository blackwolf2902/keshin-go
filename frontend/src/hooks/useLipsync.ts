import { useCallback } from 'react';
import { VRMLipSync } from '../renderers/vrm/VRMLipSync';
import { estimateVisemesFromText, type VisemeFrame } from '../lib/visemeMap';

/**
 * Hook that manages lip-sync animation lifecycle.
 * Connects audio playback events to VRM mouth animation.
 */
export function useLipsync(lipSyncRef: React.RefObject<VRMLipSync | null>) {
  /**
   * Start lip-sync when audio begins playing.
   * If viseme data is available from TTS (VOICEVOX/Kokoro), use it.
   * Otherwise, estimate from the Japanese text.
   */
  const startLipSync = useCallback((
    visemes: VisemeFrame[] | null,
    fallbackText?: string,
  ) => {
    const lipSync = lipSyncRef.current;
    if (!lipSync) return;

    if (visemes && visemes.length > 0) {
      // Use provider-supplied viseme timing (VOICEVOX/Kokoro)
      lipSync.startLipSync(visemes);
    } else if (fallbackText) {
      // Estimate from Japanese text (Edge TTS fallback)
      const estimatedVisemes = estimateVisemesFromText(fallbackText);
      lipSync.startLipSync(estimatedVisemes);
    }
  }, [lipSyncRef]);

  /**
   * Stop lip-sync when audio ends.
   */
  const stopLipSync = useCallback(() => {
    lipSyncRef.current?.stopLipSync();
  }, [lipSyncRef]);

  return { startLipSync, stopLipSync };
}
