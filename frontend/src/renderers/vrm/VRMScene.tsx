import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { VRMSceneConfig } from './types';

const DEFAULT_CONFIG: VRMSceneConfig = {
  backgroundColor: '#1a1a2e',
  cameraPosition: [0, 1.3, 2.0],
  cameraTarget: [0, 1.0, 0],
  ambientLightIntensity: 0.6,
  directionalLightIntensity: Math.PI,
};

interface VRMSceneProps {
  config?: Partial<VRMSceneConfig>;
  className?: string;
  onSceneReady?: (context: VRMSceneContext) => void;
}

export interface VRMSceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  clock: THREE.Clock;
}

export function VRMScene({ config: configOverride, className, onSceneReady }: VRMSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error] = useState<string | null>(null);

  const config = { ...DEFAULT_CONFIG, ...configOverride };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      30.0,
      container.clientWidth / container.clientHeight,
      0.1,
      20.0,
    );
    camera.position.set(...config.cameraPosition);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.screenSpacePanning = true;
    controls.target.set(...config.cameraTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.0;
    controls.maxDistance = 5.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.3; // Allow slight look-up
    controls.update();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, config.ambientLightIntensity);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, config.directionalLightIntensity);
    directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(directionalLight);

    // Subtle fill light from below
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(0.0, -1.0, 0.5);
    scene.add(fillLight);

    // Clock for animation
    const clock = new THREE.Clock();
    clock.start();

    // Animation loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Update controls
      controls.update();

      // VRM update is handled by VRMRenderer component via the context
      // Render
      renderer.render(scene, camera);
    };

    animate();

    // Expose context for VRMRenderer to use
    const ctx: VRMSceneContext = { scene, camera, renderer, controls, clock };
    onSceneReady?.(ctx);

    // Handle resize
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      controls.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-red-400 ${className ?? ''}`}>
        <p>3D Error: {error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className ?? 'w-full h-full'}
      style={{ touchAction: 'none' }}
    />
  );
}
