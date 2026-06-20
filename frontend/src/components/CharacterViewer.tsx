import { useRef, useCallback, useEffect, Component, type ReactNode } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { VRMRenderer } from '../renderers/vrm/VRMRenderer';
import { VRMExpressionManager } from '../renderers/vrm/VRMExpressionManager';
import { VRMLipSync } from '../renderers/vrm/VRMLipSync';
import { useCharacterStore } from '../stores/characterStore';

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
  const expressionManagerRef = useRef<VRMExpressionManager | null>(null);
  const lipSyncRef = useRef<VRMLipSync | null>(null);
  const vrmRef = useRef<VRM | null>(null);

  const isSpeaking = useCharacterStore((s) => s.isSpeaking);

  // Initialize managers
  useEffect(() => {
    expressionManagerRef.current = new VRMExpressionManager();
    lipSyncRef.current = new VRMLipSync();
  }, []);

  // React to speaking state — enable/disable lip-sync
  useEffect(() => {
    if (!isSpeaking) {
      lipSyncRef.current?.stopLipSync();
    }
  }, [isSpeaking]);

  const handleModelLoaded = useCallback((vrm: VRM) => {
    vrmRef.current = vrm;
    expressionManagerRef.current?.setVRM(vrm);
    lipSyncRef.current?.setVRM(vrm);
  }, []);

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
        className="w-full h-full"
      />
    </div>
  );
}
