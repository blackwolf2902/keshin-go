import { useEffect, useRef, useState, useCallback } from 'react';
import type { VRM } from '@pixiv/three-vrm';
import { VRMScene, type VRMSceneContext } from './VRMScene';
import { loadVRM } from './VRMLoader';
import { applyIdleAnimation, AutoBlinker } from './VRMIdleAnimation';
import type { EmotionName } from './types';
import { VRMExpressionManager } from './VRMExpressionManager';
import { VRMLipSync } from './VRMLipSync';

interface VRMRendererProps {
  modelUrl: string;
  onModelLoaded?: (vrm: VRM) => void;
  onModelError?: (error: Error) => void;
  currentExpression?: EmotionName;
  isSpeaking?: boolean;
  className?: string;
  expressionManager?: VRMExpressionManager;
  lipSync?: VRMLipSync;
}

export function VRMRenderer({
  modelUrl,
  onModelLoaded,
  onModelError,
  className,
  expressionManager,
  lipSync,
}: VRMRendererProps) {
  const sceneContextRef = useRef<VRMSceneContext | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const blinkerRef = useRef(new AutoBlinker());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);

  // Load VRM model when URL changes
  useEffect(() => {
    if (!modelUrl || !sceneContextRef.current) return;

    let cancelled = false;
    const scene = sceneContextRef.current.scene;

    // Remove previous model if any
    if (vrmRef.current) {
      scene.remove(vrmRef.current.scene);
      vrmRef.current = null;
    }

    setLoaded(false);
    setLoadError(null);
    setLoadingProgress(0);

    loadVRM(modelUrl, (progress) => {
      if (!cancelled) {
        setLoadingProgress(progress.percentage);
      }
    })
      .then(({ vrm }) => {
        if (cancelled) return;

        // Add model to scene
        scene.add(vrm.scene);
        vrmRef.current = vrm;

        // Bind VRM to managers
        expressionManager?.setVRM(vrm);
        lipSync?.setVRM(vrm);

        setLoaded(true);
        onModelLoaded?.(vrm);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message || 'Failed to load model');
          onModelError?.(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [modelUrl, sceneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop for VRM updates
  useEffect(() => {
    if (!sceneContextRef.current) return;

    const ctx = sceneContextRef.current;
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = ctx.clock.getDelta();
      const elapsed = ctx.clock.getElapsedTime();

      const vrm = vrmRef.current;
      if (vrm) {
        // Apply idle animation (breathing + sway)
        applyIdleAnimation(vrm, delta, elapsed);

        // Update expression manager (handles emotion blend shapes)
        expressionManager?.update(delta);

        // Update lip sync (mouth visemes)
        lipSync?.update(delta);

        // Auto-blink (more natural than constant blink in idle)
        blinkerRef.current.update(elapsed, vrm);

        // CRITICAL: Update VRM every frame
        vrm.update(delta);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [loaded, expressionManager, lipSync]);

  const handleSceneReady = useCallback((ctx: VRMSceneContext) => {
    sceneContextRef.current = ctx;
    setSceneReady(true);
  }, []);

  return (
    <div className={`relative ${className ?? ''}`}>
      <VRMScene onSceneReady={handleSceneReady} />
      {!loaded && modelUrl && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-center">
            <div className="text-white text-lg mb-2">Loading character...</div>
            <div className="w-48 bg-gray-700 rounded-full h-2">
              <div
                className="bg-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="text-gray-400 text-sm mt-1">{loadingProgress}%</div>
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-center px-4">
            <div className="text-red-400 text-lg mb-2">Failed to load character</div>
            <div className="text-gray-400 text-sm">{loadError}</div>
          </div>
        </div>
      )}
    </div>
  );
}
