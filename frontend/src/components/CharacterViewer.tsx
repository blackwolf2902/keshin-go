import { useRef, useCallback, useEffect, Component, type ReactNode, useMemo } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { VRMRenderer } from '../renderers/vrm/VRMRenderer';
import { VRMExpressionManager } from '../renderers/vrm/VRMExpressionManager';
import { VRMLipSync } from '../renderers/vrm/VRMLipSync';
import { useCharacterStore } from '../stores/characterStore';
import { useExpression } from '../hooks/useExpression';

interface CharacterViewerProps {
  modelUrl?: string;
  className?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class CharacterErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400 p-8">
          <div className="text-center">
            <p className="text-xl mb-2">3D Character Error</p>
            <p className="text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function CharacterViewer({ modelUrl, className }: CharacterViewerProps) {
  const expressionManager = useMemo(() => new VRMExpressionManager(), []);
  const lipSync = useMemo(() => new VRMLipSync(), []);
  const vrmRef = useRef<VRM | null>(null);

  const isSpeaking = useCharacterStore((s) => s.isSpeaking);
  const setLipSync = useCharacterStore((s) => s.setLipSync);

  // Bind lipSync instance to characterStore so audio player can trigger it
  useEffect(() => {
    setLipSync(lipSync);
    return () => {
      setLipSync(null);
    };
  }, [setLipSync, lipSync]);

  // Activate expression manager hook
  useExpression(expressionManager);

  // React to speaking state — enable/disable lip-sync
  useEffect(() => {
    if (!isSpeaking) {
      lipSync.stopLipSync();
    }
  }, [isSpeaking, lipSync]);

  const handleModelLoaded = useCallback((vrm: VRM) => {
    vrmRef.current = vrm;
    expressionManager.setVRM(vrm);
    lipSync.setVRM(vrm);
  }, [expressionManager, lipSync]);

  const handleError = useCallback((error: Error) => {
    console.error('[CharacterViewer] VRM load error:', error);
  }, []);

  // Use the first available model URL
  const resolvedUrl = modelUrl ?? '/packs/hinata/model.vrm';

  return (
    <div className={`relative ${className ?? ''}`}>
      <VRMRenderer
        modelUrl={resolvedUrl}
        onModelLoaded={handleModelLoaded}
        onModelError={handleError}
        expressionManager={expressionManager}
        lipSync={lipSync}
        className="w-full h-full"
      />
    </div>
  );
}
