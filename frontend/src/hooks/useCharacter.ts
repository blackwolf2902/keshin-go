import { useCallback, useEffect, useRef } from 'react';
import { useCharacterStore } from '../stores/characterStore';
import { loadVRM } from '../renderers/vrm/VRMLoader';
import { VRMExpressionManager } from '../renderers/vrm/VRMExpressionManager';
import { VRMLipSync } from '../renderers/vrm/VRMLipSync';
import type { ExpressionConfig } from '../renderers/vrm/types';

interface UseCharacterOptions {
  /** Map of expression name → config loaded from pack */
  expressions?: Record<string, ExpressionConfig>;
}

/**
 * Hook that manages VRM model loading and provides expression/lipsync managers.
 */
export function useCharacter(options?: UseCharacterOptions) {
  const expressionManagerRef = useRef(new VRMExpressionManager(options?.expressions));
  const lipSyncRef = useRef(new VRMLipSync());

  const {
    setVRM, setLoading, setLoadProgress, setLoadError, modelUrl,
  } = useCharacterStore();

  const loadModel = useCallback(async (url: string) => {
    setLoading(true);
    setLoadProgress(0);
    setLoadError(null);

    try {
      const { vrm } = await loadVRM(url, (progress) => {
        setLoadProgress(progress.percentage);
      });

      // Bind managers to the loaded VRM
      expressionManagerRef.current.setVRM(vrm);
      lipSyncRef.current.setVRM(vrm);

      setVRM(vrm);
      setLoading(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load model';
      setLoadError(message);
      setLoading(false);
    }
  }, [setVRM, setLoading, setLoadProgress, setLoadError]);

  // Load model when URL changes
  useEffect(() => {
    if (modelUrl) {
      loadModel(modelUrl);
    }
  }, [modelUrl, loadModel]);

  return {
    expressionManagerRef,
    lipSyncRef,
  };
}
