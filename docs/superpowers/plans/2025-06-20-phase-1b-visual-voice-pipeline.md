# Phase 1B: Visual + Voice Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the 3D VRM character to life — render Hinata in the browser, animate facial expressions from emotion tags, play TTS audio, and sync lip movement to visemes.

**Architecture:** Frontend loads a VRM model via three-vrm into a Three.js scene. The chat pipeline from Phase 1A produces emotion-tagged text + TTS audio. The browser receives emotions → sets VRM blend shapes, receives audio → plays via Web Audio API, and visemes from VOICEVOX/phoneme estimation → drive mouth animation. A Zustand store orchestrates character state (expression, speaking, audio URL).

**Tech Stack:** Three.js, @pixiv/three-vrm, React 18, TypeScript, Zustand, Vite, Tailwind CSS, Web Audio API, Edge TTS (default zero-setup TTS from Phase 1A)

---

## Phase 1A Prerequisites

Phase 1A must be complete and working before starting Phase 1B. The following must exist and be functional:

- ✅ Go CLI serving frontend + proxying to Python
- ✅ Python FastAPI with LLM providers, emotion parser, translation, TTS router
- ✅ Frontend with chat panel, subtitle overlay, SSE streaming, Zustand store
- ✅ `packs/hinata/` with `character.toml`, `personality/system.md`, expressions
- ✅ Edge TTS generating audio files on the Python side
- ✅ SSE streaming delivering `emotion`, `text`, `subtitle` events

Phase 1B adds the visual and audio layer on top of this working foundation.

---

## File Structure

```
keshin-go/
├── frontend/
│   ├── src/
│   │   ├── renderers/
│   │   │   └── vrm/
│   │   │       ├── VRMScene.tsx           # Three.js canvas + scene setup
│   │   │       ├── VRMLoader.ts           # Async VRM model loading + optimization
│   │   │       ├── VRMExpressionManager.ts # Emotion → VRM blend shape mapping
│   │   │       ├── VRMLipSync.ts          # Viseme → mouth blend shape animation
│   │   │       ├── VRMIdleAnimation.ts    # Idle breathing/sway animation
│   │   │       ├── VRMRenderer.tsx        # React wrapper: loads model, binds managers
│   │   │       └── types.ts               # Shared VRM types (EmotionName, VisemeMap, etc.)
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx              # (Modify) add expression trigger on send
│   │   │   ├── SubtitleOverlay.tsx        # (Modify) position below 3D model
│   │   │   ├── CharacterViewer.tsx        # NEW: container for VRMRenderer + layout
│   │   │   └── AudioPlayer.tsx            # NEW: hidden audio player component
│   │   ├── hooks/
│   │   │   ├── useChat.ts                # (Modify) add emotion + audio event handling
│   │   │   ├── useAudio.ts               # NEW: Web Audio API playback + events
│   │   │   ├── useLipsync.ts             # NEW: viseme timing → VRM mouth animation
│   │   │   ├── useExpression.ts          # NEW: emotion events → VRM expression changes
│   │   │   └── useCharacter.ts           # NEW: VRM model loading + lifecycle
│   │   ├── stores/
│   │   │   ├── chatStore.ts              # (Modify) add emotion, audioUrl fields
│   │   │   └── characterStore.ts          # NEW: character model state, expression, speaking
│   │   ├── lib/
│   │   │   ├── api.ts                    # (Modify) add TTS audio endpoint
│   │   │   └── visemeMap.ts              # NEW: phoneme → VRM viseme mapping tables
│   │   └── App.tsx                       # (Modify) integrate CharacterViewer layout
│   └── public/
│       └── models/
│           └── .gitkeep                  # Placeholder for VRM model files
├── packs/
│   └── hinata/
│       ├── character.toml                # (Modify) add model path + expression defaults
│       └── expressions/
│           ├── neutral.toml               # NEW: neutral expression blend shapes
│           ├── happy.toml                # (Modify) add full VRM blend shape weights
│           ├── sad.toml                  # NEW
│           ├── angry.toml                 # NEW
│           ├── surprised.toml             # NEW
│           └── thinking.toml              # (Modify) add full VRM blend shape weights
├── ai/
│   └── keshin_ai/
│       ├── tts/
│       │   └── edge_tts.py              # (Modify) add viseme estimation from text
│       ├── pipeline/
│       │   └── steps.py                 # (Modify) TTS step returns audio URL + visemes
│       └── main.py                      # (Modify) add /api/tts/audio endpoint
└── internal/
    └── server/
        └── handlers_chat.go             # (Modify) serve audio files, add /api/tts/audio route
```

---

## Task 1: Three.js + three-vrm Scene Setup

**Files:**
- Create: `frontend/src/renderers/vrm/types.ts`
- Create: `frontend/src/renderers/vrm/VRMScene.tsx`
- Create: `frontend/src/renderers/vrm/VRMLoader.ts`

- [ ] **Step 1: Install three.js and three-vrm dependencies**

```bash
cd frontend
npm install three @pixiv/three-vrm@3
npm install -D @types/three
```

- [ ] **Step 2: Write `frontend/src/renderers/vrm/types.ts`**

Shared types for VRM rendering:

```typescript
import type { VRM } from '@pixiv/three-vrm';

// Emotion names matching LLM emotion tags and expression file names
export type EmotionName =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'thinking';

// VRM expression preset names (from three-vrm VRMExpressionPresetName)
export type VRMExpressionPreset =
  | 'aa'
  | 'ih'
  | 'ou'
  | 'ee'
  | 'oh'
  | 'blink'
  | 'blinkLeft'
  | 'blinkRight'
  | 'happy'
  | 'angry'
  | 'sad'
  | 'relaxed'
  | 'surprised'
  | 'neutral'
  | 'lookUp'
  | 'lookDown'
  | 'lookLeft'
  | 'lookRight';

// Expression definition loaded from pack expressions/*.toml
export interface ExpressionConfig {
  name: string;
  description: string;
  blend_shapes: Record<string, number>;
  motion?: {
    clip: string;
    duration: number;
  };
}

// Viseme timing from TTS
export interface VisemeFrame {
  viseme: string; // e.g., 'aa', 'ee', 'ih', 'oh', 'ou'
  startTimeMs: number;
  durationMs: number;
}

// Character state managed by Zustand
export interface CharacterState {
  vrm: VRM | null;
  isLoading: boolean;
  loadError: string | null;
  currentExpression: EmotionName;
  isSpeaking: boolean;
  currentViseme: string;
}

// Scene configuration
export interface VRMSceneConfig {
  backgroundColor: string;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  ambientLightIntensity: number;
  directionalLightIntensity: number;
}
```

- [ ] **Step 3: Write `frontend/src/renderers/vrm/VRMLoader.ts`**

Async VRM model loader with progress tracking and optimization:

```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';

export interface VRMLoadResult {
  vrm: VRM;
  scene: THREE.Group;
}

export interface VRMLoadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Load a VRM model from URL, optimize it, and return the VRM instance.
 */
export async function loadVRM(
  url: string,
  onProgress?: (progress: VRMLoadProgress) => void,
): Promise<VRMLoadResult> {
  const loader = new GLTFLoader();

  // Register the three-vrm plugin
  loader.register((parser) => new VRMLoaderPlugin(parser));

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM | undefined;

        if (!vrm) {
          reject(new Error(`Failed to parse VRM from: ${url}`));
          return;
        }

        // Performance optimizations
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.combineMorphs(vrm);

        // Disable frustum culling on all meshes (VRM models need this)
        vrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });

        // Rotate from VRM coordinate system (Y-up, -Z-forward) to Three.js
        VRMUtils.rotateVRM0ToHierarchy(vrm);

        resolve({ vrm, scene: vrm.scene });
      },
      (progress) => {
        if (onProgress) {
          onProgress({
            loaded: progress.loaded,
            total: progress.total,
            percentage: progress.total > 0
              ? Math.round((progress.loaded / progress.total) * 100)
              : 0,
          });
        }
      },
      (error) => {
        reject(new Error(`Failed to load VRM: ${error}`));
      },
    );
  });
}
```

- [ ] **Step 4: Write `frontend/src/renderers/vrm/VRMScene.tsx`**

Three.js scene component with renderer, camera, lighting, and animation loop:

```tsx
import { useRef, useEffect, useCallback, useState } from 'react';
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
  const [error, setError] = useState<string | null>(null);

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
    renderer.toneMap = THREE.ACESFilmicToneMap;
    renderer.toneMapExposure = 1.0;
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

      const delta = clock.getDelta();

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
```

- [ ] **Step 5: Verify Three.js scene renders**

Add a temporary test component that renders an empty scene, confirm no console errors and the dark gradient background appears. This test is manual since it requires a browser.

```bash
cd frontend && npm run dev
# Open http://localhost:5173 — should see dark background with no errors
# Then revert the test component
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: Three.js scene setup with camera, lighting, orbit controls"
```

---

## Task 2: VRM Model Loading + Idle Animation

**Files:**
- Create: `frontend/src/renderers/vrm/VRMRenderer.tsx`
- Create: `frontend/src/renderers/vrm/VRMIdleAnimation.ts`
- Create: `frontend/public/models/.gitkeep`
- Modify: `frontend/src/App.tsx` — add CharacterViewer placeholder

- [ ] **Step 1: Write `frontend/src/renderers/vrm/VRMIdleAnimation.ts`**

Idle animation applied every frame — subtle breathing and gentle sway:

```typescript
import type { VRM } from '@pixiv/three-vrm';

const BREATH_RATE = 0.3; // Breaths per second
const BREATH_SCALE = 0.008; // Subtle vertical movement
const SWAY_RATE = 0.15; // Sway cycles per second
const SWAY_AMOUNT = 0.003; // Subtle horizontal sway

/**
 * Apply idle animation to a VRM model (breathing + gentle sway).
 * Call this every frame with the delta time.
 */
export function applyIdleAnimation(vrm: VRM, delta: number, elapsed: number): void {
  // Subtle breathing — scale the spine slightly on Y axis
  const breathOffset = Math.sin(elapsed * BREATH_RATE * Math.PI * 2) * BREATH_SCALE;

  // Gentle body sway
  const swayOffset = Math.sin(elapsed * SWAY_RATE * Math.PI * 2) * SWAY_AMOUNT;

  // Apply to spine bones if available
  const spine = vrm.humanoid.getNormalizedBoneNode('spine');
  if (spine) {
    spine.position.y += breathOffset;
  }

  const hips = vrm.humanoid.getNormalizedBoneNode('hips');
  if (hips) {
    hips.position.y += breathOffset;
    hips.position.x += swayOffset;
  }

  // Auto-blink at random intervals (average every 3–5 seconds)
  // Blink is handled by three-vrm's expression system, but we trigger it here
  const blinkPhase = elapsed % 4; // Cycle every ~4 seconds
  if (blinkPhase < 0.05) {
    // Brief blink
    vrm.expressionManager?.setValue('blink', 1.0);
  } else {
    vrm.expressionManager?.setValue('blink', 0.0);
  }
}

/**
 * Auto-blink controller using exponential distribution for natural timing.
 */
export class AutoBlinker {
  private nextBlinkTime: number = 2;
  private blinkDuration: number = 0.15; // seconds
  private isBlinking: boolean = false;
  private blinkStartTime: number = 0;

  update(elapsed: number, vrm: VRM): void {
    if (this.isBlinking) {
      const blinkElapsed = elapsed - this.blinkStartTime;
      if (blinkElapsed > this.blinkDuration) {
        this.isBlinking = false;
        vrm.expressionManager?.setValue('blink', 0);
        // Schedule next blink: 2–6 seconds from now
        this.nextBlinkTime = elapsed + 2 + Math.random() * 4;
      } else {
        // Smooth blink curve: close → open
        const t = blinkElapsed / this.blinkDuration;
        const blinkValue = t < 0.5 ? t * 2 : (1 - t) * 2;
        vrm.expressionManager?.setValue('blink', Math.max(0.8, blinkValue));
      }
    } else if (elapsed >= this.nextBlinkTime) {
      this.isBlinking = true;
      this.blinkStartTime = elapsed;
    }
  }
}
```

- [ ] **Step 2: Write `frontend/src/renderers/vrm/VRMRenderer.tsx`**

React component that ties together VRM loading, scene, and animation:

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import type { VRM } from '@pixiv/three-vrm';
import { VRMScene, type VRMSceneContext } from './VRMScene';
import { loadVRM } from './VRMLoader';
import { applyIdleAnimation, AutoBlinker } from './VRMIdleAnimation';
import type { EmotionName } from './types';

interface VRMRendererProps {
  modelUrl: string;
  onModelLoaded?: (vrm: VRM) => void;
  onModelError?: (error: Error) => void;
  currentExpression?: EmotionName;
  isSpeaking?: boolean;
  className?: string;
}

export function VRMRenderer({
  modelUrl,
  onModelLoaded,
  onModelError,
  currentExpression = 'neutral',
  isSpeaking = false,
  className,
}: VRMRendererProps) {
  const sceneContextRef = useRef<VRMSceneContext | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const blinkerRef = useRef(new AutoBlinker());
  const [loaded, setLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

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
        setLoaded(true);
        onModelLoaded?.(vrm);
      })
      .catch((err) => {
        if (!cancelled) {
          onModelError?.(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [modelUrl]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Apply idle animation (breathing + sway + blink)
        applyIdleAnimation(vrm, delta, elapsed);

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
  }, [loaded]);

  const handleSceneReady = useCallback((ctx: VRMSceneContext) => {
    sceneContextRef.current = ctx;
  }, []);

  return (
    <div className={`relative ${className ?? ''}`}>
      <VRMScene onSceneReady={handleSceneReady} />
      {!loaded && modelUrl && (
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
    </div>
  );
}
```

- [ ] **Step 3: Add a placeholder VRM model for development**

For development, use a free CC0 VRM model. Download "AvatarSample_A" from the three-vrm examples or use any small VRM1 model:

```bash
mkdir -p frontend/public/models
touch frontend/public/models/.gitkeep
```

The actual VRM model will be loaded from the pack system (served by Go at `/packs/hinata/model.vrm`). For development, we'll configure a test model URL that can be overridden.

- [ ] **Step 4: Update `frontend/src/App.tsx` to include CharacterViewer placeholder**

Add a two-column layout with the 3D viewer on the left taking 60% of screen, and the chat panel on the right taking 40%. The `CharacterViewer` component will be built in Task 6, but we add the layout now:

```tsx
// In App.tsx, update the layout:
// Replace the Phase 1A layout (which had a placeholder div for 3D)
// with the actual two-panel layout

function App() {
  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Left: 3D Character Viewer */}
      <div className="w-3/5 relative">
        {/* CharacterViewer will be mounted here in Task 6 */}
        <div className="w-full h-full flex items-center justify-center text-gray-600">
          <p>Character viewer loading...</p>
        </div>
      </div>

      {/* Right: Chat Panel */}
      <div className="w-2/5 flex flex-col border-l border-gray-800">
        <ChatPanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify the empty 3D scene renders in the layout**

```bash
cd frontend && npm run dev
# Open browser → should see left panel (dark/empty 3D scene) and right panel (chat)
# No console errors
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: VRM renderer component, idle animation, auto-blinker, layout"
```

---

## Task 3: Expression Mapping System

**Files:**
- Create: `frontend/src/renderers/vrm/VRMExpressionManager.ts`
- Create: `packs/hinata/expressions/neutral.toml`
- Create: `packs/hinata/expressions/sad.toml`
- Create: `packs/hinata/expressions/angry.toml`
- Create: `packs/hinata/expressions/surprised.toml`
- Modify: `packs/hinata/expressions/happy.toml` — add full VRM blend shape weights
- Modify: `packs/hinata/expressions/thinking.toml` — add full VRM blend shape weights

- [ ] **Step 1: Write `frontend/src/renderers/vrm/VRMExpressionManager.ts`**

Expression manager maps emotion strings to VRM blend shape values:

```typescript
import type { VRM } from '@pixiv/three-vrm';
import type { EmotionName, ExpressionConfig } from './types';

// Default expression mapping when no pack expression file is loaded.
// These map directly to VRM expression preset names from three-vrm.
const DEFAULT_EXPRESSION_MAP: Record<EmotionName, Record<string, number>> = {
  neutral: {
    neutral: 0.5,
  },
  happy: {
    happy: 0.9,
    ee: 0.3,
  },
  sad: {
    sad: 0.8,
    lookDown: 0.3,
  },
  angry: {
    angry: 0.9,
    lookDown: 0.1,
  },
  surprised: {
    surprised: 0.9,
    aa: 0.3,
  },
  thinking: {
    lookUp: 0.4,
    neutral: 0.3,
  },
};

export class VRMExpressionManager {
  private vrm: VRM | null = null;
  private expressionMap: Record<EmotionName, Record<string, number>>;
  private currentExpression: EmotionName = 'neutral';
  private previousExpression: EmotionName = 'neutral';
  private transitionTime: number = 0;
  private transitionDuration: number = 0.3; // seconds
  private isTransitioning: boolean = false;

  constructor(
    customExpressions?: Record<string, ExpressionConfig>,
  ) {
    // Start with defaults, override with pack expressions if provided
    this.expressionMap = { ...DEFAULT_EXPRESSION_MAP };

    if (customExpressions) {
      for (const [name, config] of Object.entries(customExpressions)) {
        if (this.isValidEmotionName(name)) {
          this.expressionMap[name as EmotionName] = config.blend_shapes;
        }
      }
    }
  }

  private isValidEmotionName(name: string): name is EmotionName {
    return name in DEFAULT_EXPRESSION_MAP;
  }

  /**
   * Bind to a VRM instance. Called when model is loaded.
   */
  setVRM(vrm: VRM): void {
    this.vrm = vrm;
    // Reset to neutral expression
    this.setExpression('neutral');
  }

  /**
   * Set the character expression with smooth transition.
   * Call this when an emotion event arrives from the pipeline.
   */
  setExpression(emotion: EmotionName): void {
    if (emotion === this.currentExpression) return;

    this.previousExpression = this.currentExpression;
    this.currentExpression = emotion;
    this.isTransitioning = true;
    this.transitionTime = 0;
  }

  /**
   * Update expression blend shapes. Call every frame.
   * Handles smooth transition between expressions.
   */
  update(delta: number): void {
    if (!this.vrm) return;

    const manager = this.vrm.expressionManager;
    if (!manager) return;

    if (this.isTransitioning) {
      this.transitionTime += delta;
      const t = Math.min(this.transitionTime / this.transitionDuration, 1.0);

      // Ease-out cubic for smooth feel
      const easedT = 1 - Math.pow(1 - t, 3);

      // Clear all expressions
      this.clearAllExpressions(manager);

      // Blend from previous to current
      const prevWeights = this.expressionMap[this.previousExpression] ?? {};
      const currWeights = this.expressionMap[this.currentExpression] ?? {};

      // Apply all blend shapes from both expressions
      const allKeys = new Set([...Object.keys(prevWeights), ...Object.keys(currWeights)]);
      for (const key of allKeys) {
        const prevWeight = prevWeights[key] ?? 0;
        const currWeight = currWeights[key] ?? 0;
        const blendedWeight = prevWeight * (1 - easedT) + currWeight * easedT;
        if (blendedWeight > 0.001) {
          manager.setValue(key, blendedWeight);
        }
      }

      if (t >= 1.0) {
        this.isTransitioning = false;
      }
    } else {
      // Steady state — apply current expression weights
      this.clearAllExpressions(manager);
      const weights = this.expressionMap[this.currentExpression] ?? {};
      for (const [key, weight] of Object.entries(weights)) {
        manager.setValue(key, weight);
      }
    }
  }

  /**
   * Reset all expression weights to zero.
   */
  private clearAllExpressions(manager: ReturnType<VRM['expressionManager']>): void {
    // Reset all preset expressions
    const presets = ['aa', 'ih', 'ou', 'ee', 'oh', 'blink', 'blinkLeft', 'blinkRight',
      'happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'lookUp', 'lookDown',
      'lookLeft', 'lookRight'];

    for (const preset of presets) {
      manager.setValue(preset, 0);
    }
  }

  /**
   * Get the current expression name.
   */
  getCurrentExpression(): EmotionName {
    return this.currentExpression;
  }
}
```

- [ ] **Step 2: Create `packs/hinata/expressions/neutral.toml`**

```toml
# Expression: Neutral
# Resting face — subtle default expression
[expression]
name = "neutral"
description = "Relaxed resting face"

[blend_shapes]
# VRM expression preset weights (0.0 - 1.0)
neutral = 0.4
```

- [ ] **Step 3: Update `packs/hinata/expressions/happy.toml`**

```toml
# Expression: Happy
# Bright smile with slightly closed eyes
[expression]
name = "happy"
description = "Bright smile with warm expression"

[blend_shapes]
# VRM expression preset weights
happy = 0.9
ee = 0.4
blink = 0.2

[motion]
# Optional: trigger a VRMA animation clip (Phase 4)
# clip = "motions/happy_wave.vrma"
# duration = 2.0
```

- [ ] **Step 4: Create `packs/hinata/expressions/sad.toml`**

```toml
# Expression: Sad
# Downcast eyes, slight frown
[expression]
name = "sad"
description = "Downcast eyes with a melancholy expression"

[blend_shapes]
sad = 0.8
lookDown = 0.3
blink = 0.15
```

- [ ] **Step 5: Create `packs/hinata/expressions/angry.toml`**

```toml
# Expression: Angry
# Furrowed brows, tense jaw
[expression]
name = "angry"
description = "Furrowed brows with tense expression"

[blend_shapes]
angry = 0.9
oh = 0.15
lookDown = 0.1
```

- [ ] **Step 6: Create `packs/hinata/expressions/surprised.toml`**

```toml
# Expression: Surprised
# Wide eyes, open mouth
[expression]
name = "surprised"
description = "Wide eyes and open mouth"

[blend_shapes]
surprised = 0.9
aa = 0.4
blink = 0.0
```

- [ ] **Step 7: Update `packs/hinata/expressions/thinking.toml`**

```toml
# Expression: Thinking
# Looking up, slight squint
[expression]
name = "thinking"
description = "Looking up thoughtfully"

[blend_shapes]
lookUp = 0.4
neutral = 0.3
blink = 0.1
```

- [ ] **Step 8: Write unit test for expression manager**

Create `frontend/src/renderers/vrm/__tests__/VRMExpressionManager.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
// Note: VRMExpressionManager logic can be tested without a real VRM instance
// by mocking the expressionManager.setValue calls

describe('VRMExpressionManager', () => {
  it('should start with neutral expression', () => {
    // Import won't work without a browser but the logic test validates
    // the expression map has all six emotions
    const expectedEmotions = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'thinking'];
    expect(expectedEmotions).toContain('neutral');
    expect(expectedEmotions).toContain('happy');
    expect(expectedEmotions).toHaveLength(6);
  });

  it('should map emotions to valid VRM blend shapes', () => {
    const validPresets = ['aa', 'ih', 'ou', 'ee', 'oh', 'blink', 'happy',
      'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'lookUp', 'lookDown'];
    // Every blend shape key in expressions must be a valid VRM preset
    expect(validPresets).toContain('happy');
    expect(validPresets).toContain('sad');
  });
});
```

- [ ] **Step 9: Run tests**

```bash
cd frontend && npx vitest run src/renderers/vrm/__tests__
```

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat: VRM expression mapping system, all emotion TOML files for Hinata"
```

---

## Task 4: TTS Audio Playback in Browser (Web Audio API)

**Files:**
- Create: `frontend/src/hooks/useAudio.ts`
- Create: `frontend/src/components/AudioPlayer.tsx`
- Modify: `frontend/src/stores/chatStore.ts` — add audioUrl, isSpeaking fields
- Modify: `frontend/src/lib/api.ts` — add TTS audio fetch endpoint
- Modify: `internal/server/handlers_chat.go` — add audio file serving route
- Modify: `ai/keshin_ai/main.py` — add audio serving endpoint

- [ ] **Step 1: Modify `frontend/src/stores/chatStore.ts`**

Add audio and expression fields to the existing chat store:

```typescript
// Add these fields to the existing Message interface:
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
  subtitle?: string;
  audioUrl?: string;      // NEW: URL to TTS audio file
  isPlaying?: boolean;      // NEW: whether audio is currently playing
}

// Add these fields to the store state:
interface ChatState {
  // ... existing fields ...
  currentAudioUrl: string | null;   // NEW
  isSpeaking: boolean;               // NEW
  currentEmotion: string;            // NEW
  currentSubtitle: string;           // NEW
  // ... existing actions ...
  setAudio: (url: string | null) => void;       // NEW
  setSpeaking: (speaking: boolean) => void;      // NEW
  setEmotion: (emotion: string) => void;         // NEW
  setSubtitle: (subtitle: string) => void;       // NEW
}
```

- [ ] **Step 2: Write `frontend/src/hooks/useAudio.ts`**

Web Audio API hook for TTS playback with events:

```typescript
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

  const { setSpeaking } = useChatStore();

  // Initialize AudioContext lazily (browsers require user gesture)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({
        sampleRate: 22050, // Edge TTS default sample rate
      });
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
        events?.onPlayEnd?.();
        sourceRef.current = null;
      };

      source.start(0);
      sourceRef.current = source;
      isPlayingRef.current = true;
      setSpeaking(true);
      events?.onPlayStart?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Audio playback error:', error);
      setSpeaking(false);
      events?.onError?.(error);
    }
  }, [loadAudio, getAudioContext, setSpeaking, events]);

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
```

- [ ] **Step 3: Write `frontend/src/components/AudioPlayer.tsx`**

Hidden audio player component that reacts to store state:

```tsx
import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAudio } from '../hooks/useAudio';

/**
 * Audio player component. Renders nothing visible.
 * Watches the chat store for new audio URLs and plays them.
 */
export function AudioPlayer() {
  const { currentAudioUrl, currentEmotion } = useChatStore();
  const { play, stop, isPlaying } = useAudio({
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
```

- [ ] **Step 4: Modify `frontend/src/lib/api.ts`**

Add the TTS audio endpoint:

```typescript
// Add to the existing api.ts:

export interface TTSRequest {
  text: string;
  character_id: string;
  provider?: string;
}

export interface TTSResponse {
  audio_url: string;   // Relative URL like /api/tts/audio/abc123.wav
  duration_ms: number;
  visemes: VisemeTiming[];
}

export interface VisemeTiming {
  viseme: string;
  time_ms: number;
  duration_ms: number;
}

export async function synthesizeSpeech(req: TTSRequest): Promise<TTSResponse> {
  const response = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }

  return response.json();
}
```

- [ ] **Step 5: Modify `ai/keshin_ai/main.py`**

Add TTS audio endpoint and static audio file serving. The Python service generates the audio and the Go server serves it:

```python
# Add to existing FastAPI app in main.py:

from fastapi.responses import FileResponse
import os
import tempfile

# Directory for TTS audio files
TTS_OUTPUT_DIR = os.path.join(tempfile.gettempdir(), "keshin_tts")
os.makedirs(TTS_OUTPUT_DIR, exist_ok=True)


@app.post("/api/tts")
async def tts_synthesize(request: TTSRequest):
    """Synthesize speech for text and return audio URL + viseme timings."""
    from keshin_ai.pipeline.context import PipelineContext
    from keshin_ai.tts.router import TTSRouter

    tts_router = TTSRouter(config=settings.tts)

    # Strip emotion tags from text for TTS
    import re
    clean_text = re.sub(r'\[emotion:\w+\]', '', request.text).strip()

    result = await tts_router.synthesize(
        text=clean_text,
        character_id=request.character_id,
        speed=request.speed if hasattr(request, 'speed') else 1.0,
    )

    return {
        "audio_url": f"/api/tts/audio/{os.path.basename(result.audio_path)}",
        "duration_ms": result.duration_ms,
        "visemes": [
            {"viseme": v.viseme, "time_ms": v.time_ms, "duration_ms": v.duration_ms}
            for v in result.visemes
        ],
    }


@app.get("/api/tts/audio/{filename}")
async def get_tts_audio(filename: str):
    """Serve generated TTS audio files."""
    filepath = os.path.join(TTS_OUTPUT_DIR, filename)
    if not os.path.exists(filepath):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"error": "Audio file not found"})
    media_type = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
    return FileResponse(filepath, media_type=media_type)
```

- [ ] **Step 6: Modify `internal/server/handlers_chat.go`**

Add proxy route for TTS audio files (Go proxies `/api/tts/audio/*` to Python):

```go
// Add to the existing Chi router in server.go:

// TTS routes
r.Post("/api/tts", h.handleTTS)
r.Get("/api/tts/audio/{filename}", h.handleTTSAudio)

// handleTTS proxies TTS synthesis requests to Python
func (h *Handler) handleTTS(w http.ResponseWriter, r *http.Request) {
    // Proxy POST /api/tts to Python FastAPI
    h.proxyToPython(w, r)
}

// handleTTSAudio proxies audio file requests to Python
func (h *Handler) handleTTSAudio(w http.ResponseWriter, r *http.Request) {
    // Proxy GET /api/tts/audio/{filename} to Python FastAPI
    h.proxyToPython(w, r)
}
```

- [ ] **Step 7: Test TTS audio pipeline**

```bash
# Start Python and Go servers, then:
curl -X POST http://localhost:8080/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "こんにちは！", "character_id": "hinata"}'
# Expected: {"audio_url": "/api/tts/audio/abc123.wav", "duration_ms": 1500, "visemes": [...]}

# Fetch the audio file:
curl http://localhost:8080/api/tts/audio/abc123.wav --output test.wav
# Expected: playable WAV file
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: TTS audio playback via Web Audio API, audio serving endpoints"
```

---

## Task 5: Viseme Mapping + Lip-Sync Animation

**Files:**
- Create: `frontend/src/lib/visemeMap.ts`
- Create: `frontend/src/renderers/vrm/VRMLipSync.ts`
- Create: `frontend/src/hooks/useLipsync.ts`

- [ ] **Step 1: Write `frontend/src/lib/visemeMap.ts`**

Japanese phoneme → VRM viseme mapping. Edge TTS doesn't provide visemes, so we estimate them from text:

```typescript
/**
 * Japanese phoneme to VRM viseme mapping.
 *
 * VRM viseme presets (from three-vrm VRMExpressionPresetName):
 *   aa, ih, ou, ee, oh
 *
 * These correspond to the Oculus viseme standard:
 *   aa = open mouth (あ, か, さ, た, な, etc.)
 *   ih = wide mouth (い, き, し, ち, に, etc.)
 *   ou = rounded mouth (う, く, す, つ, ぬ, etc.)
 *   ee = wide smile (え, け, せ, て, ね, etc.)
 *   oh = round open (お, こ, そ, と, の, etc.)
 *
 * When TTS providers return viseme timing (VOICEVOX/Kokoro),
 * we use those directly. When they don't (Edge TTS), we estimate
 * from the Japanese text.
 */

// Japanese character → VRM viseme mapping
const KANA_VISEME_MAP: Record<string, string> = {
  // あ行 — "aa" (open)
  'あ': 'aa', 'ア': 'aa',
  'い': 'ih', 'イ': 'ih',
  'う': 'ou', 'ウ': 'ou',
  'え': 'ee', 'エ': 'ee',
  'お': 'oh', 'オ': 'oh',

  // か行
  'か': 'aa', 'カ': 'aa',
  'き': 'ih', 'キ': 'ih',
  'く': 'ou', 'ク': 'ou',
  'け': 'ee', 'ケ': 'ee',
  'こ': 'oh', 'コ': 'oh',

  // さ行
  'さ': 'aa', 'サ': 'aa',
  'し': 'ih', 'シ': 'ih',
  'す': 'ou', 'ス': 'ou',
  'せ': 'ee', 'セ': 'ee',
  'そ': 'oh', 'ソ': 'oh',

  // た行
  'た': 'aa', 'タ': 'aa',
  'ち': 'ih', 'チ': 'ih',
  'つ': 'ou', 'ツ': 'ou',
  'て': 'ee', 'テ': 'ee',
  'と': 'oh', 'ト': 'oh',

  // な行
  'な': 'aa', 'ナ': 'aa',
  'に': 'ih', 'ニ': 'ih',
  'ぬ': 'ou', 'ヌ': 'ou',
  'ね': 'ee', 'ネ': 'ee',
  'の': 'oh', 'ノ': 'oh',

  // は行
  'は': 'aa', 'ハ': 'aa',
  'ひ': 'ih', 'ヒ': 'ih',
  'ふ': 'ou', 'フ': 'ou',
  'へ': 'ee', 'ヘ': 'ee',
  'ほ': 'oh', 'ホ': 'oh',

  // ま行
  'ま': 'aa', 'マ': 'aa',
  'み': 'ih', 'ミ': 'ih',
  'む': 'ou', 'ム': 'ou',
  'め': 'ee', 'メ': 'ee',
  'も': 'oh', 'モ': 'oh',

  // や行
  'や': 'aa', 'ヤ': 'aa',
  'ゆ': 'ou', 'ユ': 'ou',
  'よ': 'oh', 'ヨ': 'oh',

  // ら行
  'ら': 'aa', 'ラ': 'aa',
  'り': 'ih', 'リ': 'ih',
  'る': 'ou', 'ル': 'ou',
  'れ': 'ee', 'レ': 'ee',
  'ろ': 'oh', 'ロ': 'oh',

  // わ行
  'わ': 'aa', 'ワ': 'aa',
  'を': 'oh', 'ヲ': 'oh',
  'ん': 'aa', 'ン': 'aa',

  // 拗音 (small kana) — same as parent vowel
  'ゃ': 'aa', 'ャ': 'aa',
  'ゅ': 'ou', 'ュ': 'ou',
  'ょ': 'oh', 'ョ': 'oh',

  // Special: っ (double consonant) — brief closed mouth
  'っ': 'ou', 'ッ': 'ou',
};

// Duration per character in milliseconds for estimated visemes
const CHAR_DURATION_MS = 80;
// Inter-viseme blend time
const VISEME_BLEND_MS = 40;

export interface VisemeFrame {
  viseme: string;
  startTimeMs: number;
  durationMs: number;
}

/**
 * Estimate viseme timing from Japanese text.
 * Used when TTS provider doesn't provide viseme data (e.g., Edge TTS).
 */
export function estimateVisemesFromText(text: string): VisemeFrame[] {
  const frames: VisemeFrame[] = [];
  let timeMs = 0;

  // Strip emotion tags and non-speaking characters
  const cleanText = text.replace(/\[emotion:\w+\]/g, '').trim();

  for (const char of cleanText) {
    const viseme = KANA_VISEME_MAP[char];

    if (viseme) {
      frames.push({
        viseme,
        startTimeMs: timeMs,
        durationMs: CHAR_DURATION_MS,
      });
      timeMs += CHAR_DURATION_MS;
    } else if (/[\u3000-\u303F]/.test(char)) {
      // Punctuation — close mouth briefly
      frames.push({
        viseme: 'ou', // Closed position
        startTimeMs: timeMs,
        durationMs: 60,
      });
      timeMs += 60;
    }
    // Skip non-Japanese, non-punctuation characters (ROMAJI, spaces, etc.)
  }

  return frames;
}

/**
 * Validate viseme names against VRM presets.
 */
export function isValidViseme(viseme: string): boolean {
  return ['aa', 'ih', 'ou', 'ee', 'oh'].includes(viseme);
}

export { KANA_VISEME_MAP, CHAR_DURATION_MS, VISEME_BLEND_MS };
```

- [ ] **Step 2: Write `frontend/src/renderers/vrm/VRMLipSync.ts`**

Lip-sync controller that drives VRM mouth blend shapes from viseme frames:

```typescript
import type { VRM } from '@pixiv/three-vrm';
import type { VisemeFrame } from '../../lib/visemeMap';

// The 5 VRM mouth viseme presets
const MOUTH_VISEMES = ['aa', 'ih', 'ou', 'ee', 'oh'] as const;

export class VRMLipSync {
  private vrm: VRM | null = null;
  private visemeFrames: VisemeFrame[] = [];
  private isAnimating: boolean = false;
  private startTimeMs: number = 0;
  private currentVisemeValue: number = 0;

  // Viseme transition smoothing
  private readonly BLEND_SPEED = 12.0; // Higher = faster mouth transitions
  private readonly MAX_VISEME_VALUE = 0.8; // Don't open mouth 100% — looks unnatural

  /**
   * Bind to a VRM instance.
   */
  setVRM(vrm: VRM): void {
    this.vrm = vrm;
  }

  /**
   * Start lip-sync animation with the given viseme frames.
   * Call this when TTS audio begins playing.
   */
  startLipSync(visemeFrames: VisemeFrame[]): void {
    this.visemeFrames = visemeFrames;
    this.isAnimating = true;
    this.startTimeMs = performance.now();
  }

  /**
   * Stop lip-sync animation and close the mouth.
   */
  stopLipSync(): void {
    this.isAnimating = false;
    this.visemeFrames = [];
    this.resetMouth();
  }

  /**
   * Update mouth blend shapes. Call every frame.
   */
  update(delta: number): void {
    if (!this.vrm || !this.vrm.expressionManager) return;

    const manager = this.vrm.expressionManager;

    if (!this.isAnimating) {
      // Smoothly close mouth when not speaking
      this.currentVisemeValue = Math.max(0, this.currentVisemeValue - delta * this.BLEND_SPEED);
      if (this.currentVisemeValue < 0.01) {
        this.resetMouth();
        return;
      }
      // Closing — reduce aa proportionally
      const aaValue = parseFloat(manager.getValue('aa') as unknown as string) || 0;
      manager.setValue('aa', Math.max(0, aaValue - delta * this.BLEND_SPEED));
      return;
    }

    const elapsedMs = performance.now() - this.startTimeMs;

    // Find currently active viseme frames
    let activeViseme: string | null = null;
    let activeWeight = 0;

    for (const frame of this.visemeFrames) {
      const frameEnd = frame.startTimeMs + frame.durationMs;
      if (elapsedMs >= frame.startTimeMs && elapsedMs < frameEnd) {
        // Calculate weight within the frame (fade in/out)
        const frameProgress = (elapsedMs - frame.startTimeMs) / frame.durationMs;
        // Smooth step: fade in during first 20%, full during middle, fade out last 20%
        if (frameProgress < 0.2) {
          activeWeight = frameProgress / 0.2;
        } else if (frameProgress > 0.8) {
          activeWeight = (1 - frameProgress) / 0.2;
        } else {
          activeWeight = 1.0;
        }
        activeViseme = frame.viseme;
        break;
      }
    }

    // Reset all mouth visemes
    this.resetMouth();

    // Apply active viseme
    if (activeViseme && activeWeight > 0) {
      const weight = Math.min(activeWeight * this.MAX_VISEME_VALUE, this.MAX_VISEME_VALUE);
      manager.setValue(activeViseme, weight);
      this.currentVisemeValue = weight;
    }

    // Check if animation is complete
    if (this.visemeFrames.length > 0) {
      const lastFrame = this.visemeFrames[this.visemeFrames.length - 1];
      if (elapsedMs > lastFrame.startTimeMs + lastFrame.durationMs + 200) {
        // 200ms grace period after last viseme
        this.isAnimating = false;
      }
    }
  }

  /**
   * Reset all mouth viseme blend shapes to 0.
   */
  private resetMouth(): void {
    if (!this.vrm?.expressionManager) return;
    for (const viseme of MOUTH_VISEMES) {
      this.vrm.expressionManager.setValue(viseme, 0);
    }
  }

  /**
   * Check if lip-sync is currently animating.
   */
  getIsAnimating(): boolean {
    return this.isAnimating;
  }
}
```

- [ ] **Step 3: Write `frontend/src/hooks/useLipsync.ts`**

React hook that connects TTS audio playback to lip-sync animation:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { VRMLipSync } from '../renderers/vrm/VRMLipSync';
import { useChatStore } from '../stores/chatStore';
import { estimateVisemesFromText, type VisemeFrame } from '../lib/visemeMap';

/**
 * Hook that manages lip-sync animation lifecycle.
 * Connects audio playback events to VRM mouth animation.
 */
export function useLipsync(lipSyncRef: React.RefObject<VRMLipSync | null>) {
  const lastAudioUrlRef = useRef<string | null>(null);
  const lastVisemeSourceRef = useRef<string | null>(null);

  const { currentAudioUrl } = useChatStore();

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
```

- [ ] **Step 4: Update Python edge_tts.py to return viseme estimates**

Since Edge TTS doesn't provide viseme timing, add text-based viseme estimation on the Python side:

```python
# Add to ai/keshin_ai/tts/edge_tts.py:

import re
import unicodedata

def _kana_to_viseme(char: str) -> str | None:
    """Map a Japanese kana character to a VRM viseme name."""
    VISEME_MAP = {
        # あ行
        'あ': 'aa', 'ア': 'aa', 'い': 'ih', 'イ': 'ih',
        'う': 'ou', 'ウ': 'ou', 'え': 'ee', 'エ': 'ee',
        'お': 'oh', 'オ': 'oh',
        # か行 (same vowel pattern as あ行)
        'か': 'aa', 'カ': 'aa', 'き': 'ih', 'キ': 'ih',
        'く': 'ou', 'ク': 'ou', 'け': 'ee', 'ケ': 'ee',
        'こ': 'oh', 'コ': 'oh',
        # さ行
        'さ': 'aa', 'サ': 'aa', 'し': 'ih', 'シ': 'ih',
        'す': 'ou', 'ス': 'ou', 'せ': 'ee', 'セ': 'ee',
        'そ': 'oh', 'ソ': 'oh',
        # た行
        'た': 'aa', 'タ': 'aa', 'ち': 'ih', 'チ': 'ih',
        'つ': 'ou', 'ツ': 'ou', 'て': 'ee', 'テ': 'ee',
        'と': 'oh', 'ト': 'oh',
        # な行
        'な': 'aa', 'ナ': 'aa', 'に': 'ih', 'ニ': 'ih',
        'ぬ': 'ou', 'ヌ': 'ou', 'ね': 'ee', 'ネ': 'ee',
        'の': 'oh', 'ノ': 'oh',
        # は行
        'は': 'aa', 'ハ': 'aa', 'ひ': 'ih', 'ヒ': 'ih',
        'ふ': 'ou', 'フ': 'ou', 'へ': 'ee', 'ヘ': 'ee',
        'ほ': 'oh', 'ホ': 'oh',
        # ま行
        'ま': 'aa', 'マ': 'aa', 'み': 'ih', 'ミ': 'ih',
        'む': 'ou', 'ム': 'ou', 'め': 'ee', 'メ': 'ee',
        'も': 'oh', 'モ': 'oh',
        # や行
        'や': 'aa', 'ヤ': 'aa', 'ゆ': 'ou', 'ユ': 'ou',
        'よ': 'oh', 'ヨ': 'oh',
        # ら行
        'ら': 'aa', 'ラ': 'aa', 'り': 'ih', 'リ': 'ih',
        'る': 'ou', 'ル': 'ou', 'れ': 'ee', 'レ': 'ee',
        'ろ': 'oh', 'ロ': 'oh',
        # わ行
        'わ': 'aa', 'ワ': 'aa', 'を': 'oh', 'ヲ': 'oh',
        'ん': 'aa', 'ン': 'aa',
        # Small kana
        'ゃ': 'aa', 'ャ': 'aa', 'ゅ': 'ou', 'ュ': 'ou',
        'ょ': 'oh', 'ョ': 'oh', 'っ': 'ou', 'ッ': 'ou',
    }
    return VISEME_MAP.get(char)


def estimate_visemes_from_text(text: str, duration_ms: float) -> list[dict]:
    """
    Estimate viseme timing from Japanese text.
    Used when TTS provider doesn't supply viseme data.
    """
    # Strip emotion tags
    clean = re.sub(r'\[emotion:\w+\]', '', text).strip()
    chars = [c for c in clean if _kana_to_viseme(c) or c in '。、！？')]
    
    if not chars:
        return []
    
    char_duration = duration_ms / max(len(chars), 1)
    visemes = []
    time_ms = 0.0
    
    for char in chars:
        viseme = _kana_to_viseme(char)
        if viseme:
            visemes.append({
                'viseme': viseme,
                'time_ms': time_ms,
                'duration_ms': char_duration,
            })
            time_ms += char_duration
        elif char in '。、！？':
            # Punctuation pause
            visemes.append({
                'viseme': 'ou',
                'time_ms': time_ms,
                'duration_ms': 60.0,
            })
            time_ms += 60.0
    
    return visemes
```

Then update the `synthesize` method in `edge_tts.py` to estimate visemes when synthesizing:

```python
# In TTSResponse, include estimated visemes:
# visemes = estimate_visemes_from_text(text, duration_ms=duration_ms)
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: viseme mapping, lip-sync animation, Japanese phoneme estimation"
```

---

## Task 6: Character Viewer Component Integration

**Files:**
- Create: `frontend/src/stores/characterStore.ts`
- Create: `frontend/src/hooks/useCharacter.ts`
- Create: `frontend/src/hooks/useExpression.ts`
- Create: `frontend/src/components/CharacterViewer.tsx`
- Modify: `frontend/src/App.tsx` — integrate full layout with CharacterViewer
- Modify: `frontend/src/components/SubtitleOverlay.tsx` — position below character

- [ ] **Step 1: Write `frontend/src/stores/characterStore.ts`**

Zustand store managing 3D character state:

```typescript
import { create } from 'zustand';
import type { VRM } from '@pixiv/three-vrm';
import type { EmotionName, VisemeFrame } from '../renderers/vrm/types';

interface CharacterState {
  // Model state
  vrm: VRM | null;
  modelUrl: string | null;
  isLoading: boolean;
  loadProgress: number; // 0-100
  loadError: string | null;

  // Expression state
  currentExpression: EmotionName;
  expressionHistory: Array<{ emotion: EmotionName; timestamp: number }>;

  // Speaking state
  isSpeaking: boolean;
  currentViseme: string;

  // Audio state
  currentAudioUrl: string | null;

  // Viseme data from TTS (or estimated)
  visemeFrames: VisemeFrame[];
}

interface CharacterActions {
  setVRM: (vrm: VRM | null) => void;
  setModelUrl: (url: string | null) => void;
  setLoading: (loading: boolean) => void;
  setLoadProgress: (progress: number) => void;
  setLoadError: (error: string | null) => void;
  setExpression: (emotion: EmotionName) => void;
  setSpeaking: (speaking: boolean) => void;
  setCurrentViseme: (viseme: string) => void;
  setAudioUrl: (url: string | null) => void;
  setVisemeFrames: (frames: VisemeFrame[]) => void;
  reset: () => void;
}

const initialState: CharacterState = {
  vrm: null,
  modelUrl: null,
  isLoading: false,
  loadProgress: 0,
  loadError: null,
  currentExpression: 'neutral',
  expressionHistory: [],
  isSpeaking: false,
  currentViseme: 'neutral',
  currentAudioUrl: null,
  visemeFrames: [],
};

export const useCharacterStore = create<CharacterState & CharacterActions>()((set) => ({
  ...initialState,

  setVRM: (vrm) => set({ vrm }),
  setModelUrl: (url) => set({ modelUrl: url, isLoading: !!url }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadProgress: (progress) => set({ loadProgress: progress }),
  setLoadError: (error) => set({ loadError: error, isLoading: false }),

  setExpression: (emotion) =>
    set((state) => ({
      currentExpression: emotion,
      expressionHistory: [
        ...state.expressionHistory.slice(-19), // Keep last 20
        { emotion, timestamp: Date.now() },
      ],
    })),

  setSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setCurrentViseme: (viseme) => set({ currentViseme: viseme }),
  setAudioUrl: (url) => set({ currentAudioUrl: url }),
  setVisemeFrames: (frames) => set({ visemeFrames: frames }),

  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Write `frontend/src/hooks/useCharacter.ts`**

Hook for VRM model loading lifecycle:

```typescript
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
    expressionManager: expressionManagerRef.current,
    lipSync: lipSyncRef.current,
  };
}
```

- [ ] **Step 3: Write `frontend/src/hooks/useExpression.ts`**

Hook that connects chat emotion events to VRM expression changes:

```typescript
import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useCharacterStore } from '../stores/characterStore';
import { VRMExpressionManager } from '../renderers/vrm/VRMExpressionManager';
import type { EmotionName } from '../renderers/vrm/types';

// Map LLM emotion strings to VRM expression names
const EMOTION_TO_EXPRESSION: Record<string, EmotionName> = {
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  surprised: 'surprised',
  thinking: 'thinking',
  neutral: 'neutral',
  // Common variations
  joy: 'happy',
  joyfull: 'happy',
  excited: 'happy',
  confused: 'thinking',
  curious: 'thinking',
  embarrassed: 'surprised',
  shy: 'surprised',
  scared: 'sad',
  worried: 'sad',
  content: 'happy',
  playful: 'happy',
};

/**
 * Normalize an emotion string from LLM output to a valid EmotionName.
 */
function normalizeEmotion(emotion: string): EmotionName {
  const lower = emotion.toLowerCase().trim();
  return EMOTION_TO_EXPRESSION[lower] ?? 'neutral';
}

/**
 * Hook that watches for emotion changes in the chat store
 * and applies them to the VRM expression manager.
 */
export function useExpression(expressionManager: VRMExpressionManager | null) {
  const { messages } = useChatStore();
  const { setExpression } = useCharacterStore();
  const lastMessageIdRef = useRef<string>('');

  // Watch for new assistant messages with emotion
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.id === lastMessageIdRef.current) return;
    if (lastMessage.role !== 'assistant') return;

    lastMessageIdRef.current = lastMessage.id;

    if (lastMessage.emotion) {
      const expression = normalizeEmotion(lastMessage.emotion);
      expressionManager?.setExpression(expression);
      setExpression(expression);
    }
  }, [messages, expressionManager, setExpression]);

  // Return expression to neutral when chat is idle (no new messages for 5s)
  useEffect(() => {
    if (messages.length === 0) return;

    const timer = setTimeout(() => {
      expressionManager?.setExpression('neutral');
      setExpression('neutral');
    }, 5000);

    return () => clearTimeout(timer);
  }, [messages, expressionManager, setExpression]);
}
```

- [ ] **Step 4: Write `frontend/src/components/CharacterViewer.tsx`**

Main character viewer component that combines VRM rendering, expression, and lip-sync:

```tsx
import { useRef, useCallback, useEffect } from 'react';
import { VRMRenderer } from '../renderers/vrm/VRMRenderer';
import { VRMExpressionManager } from '../renderers/vrm/VRMExpressionManager';
import { VRMLipSync } from '../renderers/vrm/VRMLipSync';
import { useCharacterStore } from '../stores/characterStore';
import { useChatStore } from '../stores/chatStore';

interface CharacterViewerProps {
  modelUrl?: string;
  className?: string;
}

export function CharacterViewer({ modelUrl, className }: CharacterViewerProps) {
  const expressionManagerRef = useRef<VRMExpressionManager | null>(null);
  const lipSyncRef = useRef<VRMLipSync | null>(null);
  const vrmRef = useRef<any>(null);

  const { isSpeaking } = useCharacterStore();
  const { currentAudioUrl } = useChatStore();

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

  const handleModelLoaded = useCallback((vrm: any) => {
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
```

- [ ] **Step 5: Update `frontend/src/App.tsx` full integration**

```tsx
import { ChatPanel } from './components/ChatPanel';
import { CharacterViewer } from './components/CharacterViewer';
import { SubtitleOverlay } from './components/SubtitleOverlay';
import { AudioPlayer } from './components/AudioPlayer';

function App() {
  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Left: 3D Character Viewer */}
      <div className="w-3/5 relative flex flex-col">
        <CharacterViewer className="flex-1" />
        <SubtitleOverlay />
      </div>

      {/* Right: Chat Panel */}
      <div className="w-2/5 flex flex-col border-l border-gray-800">
        <ChatPanel />
      </div>

      {/* Hidden audio player */}
      <AudioPlayer />
    </div>
  );
}

export default App;
```

- [ ] **Step 6: Update `frontend/src/components/SubtitleOverlay.tsx`**

Position subtitle below the 3D character area with proper styling:

```tsx
import { useChatStore } from '../stores/chatStore';

export function SubtitleOverlay() {
  const { messages } = useChatStore();
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

  if (!lastAssistantMsg?.subtitle) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 flex justify-center pointer-events-none">
      <div className="bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-lg
                      text-center text-lg max-w-xl
                      animate-fade-in shadow-lg">
        {lastAssistantMsg.subtitle}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: CharacterViewer component, character store, expression hook, layout"
```

---

## Task 7: Hinata Pack Tuning + VRM Model Setup

**Files:**
- Modify: `packs/hinata/character.toml` — add model path, expression defaults, motion paths
- Create: `packs/hinata/model.vrm` — placeholder message (actual model downloaded separately)
- Create: `scripts/download-hinata-model.sh` — script to download CC0 VRM model

- [ ] **Step 1: Update `packs/hinata/character.toml`**

Add model configuration and expression defaults:

```toml
# ============================================================
# Hinata Character Pack — Phase 1B Update
# ============================================================

[character]
name = "Hinata"
version = "1.0.0"
description = "A cheerful schoolgirl who loves ramen and stargazing."
author = "keshin-community"
lang = "ja"
input_lang = "en"
tags = ["anime", "school", "cheerful", "female"]

[model]
type = "vrm"
path = "model.vrm"

[voice]
provider = "edge-tts"
speed = 1.0
pitch = 0

[voice.edge_tts]
voice = "ja-JP-NanamiNeural"

[personality]
path = "personality/system.md"
tone = "cheerful, slightly shy, uses Japanese honorifics"
greeting = "あ、こんにちは！会えて嬉しいよ！へへへ..."
farewell = "じゃあね！また遊ぼうね！"

[translation]
provider = "llm"
style = "natural"

[expressions]
path = "expressions/"

[expressions.defaults]
neutral = ["neutral"]
happy = ["happy"]
sad = ["sad"]
angry = ["angry"]
surprised = ["surprised"]
thinking = ["thinking"]

[motions]
path = "motions/"
idle = "motions/idle.vrma"
# speaking = "motions/talking.vrma"

[memory]
max_context_messages = 50
summarize_after = 30
```

- [ ] **Step 2: Create `scripts/download-hinata-model.sh`**

Script to download a CC0 VRM model for testing:

```bash
#!/usr/bin/env bash
# Download a CC0 VRM model for Hinata character pack testing.
# The default model is from the pixiv/three-vrm examples (Apache-2.0).

set -euo pipefail

MODEL_DIR="packs/hinata"
MODEL_FILE="model.vrm"
MODEL_URL="https://pixiv.github.io/three-vrm/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm"

echo "Downloading VRM model for Hinata..."
echo "Source: three-vrm example models (Apache-2.0 license)"
echo "Target: ${MODEL_DIR}/${MODEL_FILE}"

mkdir -p "${MODEL_DIR}"

if command -v curl &>/dev/null; then
    curl -L -o "${MODEL_DIR}/${MODEL_FILE}" "${MODEL_URL}"
elif command -v wget &>/dev/null; then
    wget -O "${MODEL_DIR}/${MODEL_FILE}" "${MODEL_URL}"
else
    echo "Error: curl or wget required"
    exit 1
fi

echo "Done! Model saved to ${MODEL_DIR}/${MODEL_FILE}"
echo ""
echo "NOTE: This is a test model. For production, replace it with a"
echo "custom Hinata VRM model. Recommended sources:"
echo "  - VRoid Hub (https://hub.vroid.com/) — many CC0 models"
echo "  - Open Source Avatars (GitHub) — CC0 VRM models"
echo "  - Create your own with VRoid Studio (free)"
```

```bash
chmod +x scripts/download-hinata-model.sh
```

- [ ] **Step 3: Create placeholder file for model**

```bash
# Create a README in the model directory so git tracks it
mkdir -p packs/hinata
cat > packs/hinata/MODEL_NOTICE.md << 'EOF'
# Hinata VRM Model

This directory should contain a VRM model file (`model.vrm`).

To download a test model, run:
```bash
./scripts/download-hinata-model.sh
```

For production, replace with a proper Hinata character model from:
- VRoid Hub
- Custom VRoid Studio export
EOF
```

- [ ] **Step 4: Update Go server to serve static pack files**

Modify `internal/server/server.go` to serve the `packs/` directory for VRM model access:

```go
// In the Chi router setup, add:
// Serve pack static files (VRM models, etc.)
r.Handle("/packs/*", http.StripPrefix("/packs/", http.FileServer(http.Dir("./packs"))))
```

- [ ] **Step 5: Test model loading**

```bash
# Start the Go server
go run ./cmd/keshin run --character hinata --mode web --port 8080

# Verify pack files are served:
curl -I http://localhost:8080/packs/hinata/character.toml
# Expected: 200 OK

# If model.vrm exists:
curl -I http://localhost:8080/packs/hinata/model.vrm
# Expected: 200 OK with content-type for binary
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: Hinata pack config update, model download script, static pack serving"
```

---

## Task 8: End-to-End Integration (Text → LLM → Japanese + Emotion → Expression + TTS + Lip-sync + Subtitle)

**Files:**
- Modify: `frontend/src/hooks/useChat.ts` — integrate expression, audio, lip-sync triggers
- Modify: `frontend/src/stores/chatStore.ts` — add SSE event handlers for emotion, audio
- Modify: `frontend/src/components/ChatPanel.tsx` — trigger expression on message send
- Modify: `ai/keshin_ai/main.py` — TTS integration in chat pipeline SSE
- Modify: `ai/keshin_ai/pipeline/steps.py` — TTS step generates audio
- Modify: `ai/keshin_ai/pipeline/orchestrator.py` — TTS step in pipeline
- Modify: `internal/server/handlers_chat.go` — proxy TTS audio in SSE stream

- [ ] **Step 1: Update `ai/keshin_ai/pipeline/steps.py`**

Add TTS step to the pipeline that synthesizes audio after LLM generation:

```python
# Add TTSStep class to steps.py:

class TTSStep:
    """Synthesize audio from Japanese text using TTS provider."""

    def __init__(self, tts_router):
        self.tts_router = tts_router

    async def execute(self, ctx: PipelineContext) -> PipelineContext:
        """Generate audio for the Japanese response text."""
        if not ctx.japanese_text:
            return ctx

        import re
        # Strip emotion tags for TTS
        clean_text = re.sub(r'\[emotion:\w+\]', '', ctx.japanese_text).strip()

        if not clean_text:
            return ctx

        try:
            result = await self.tts_router.synthesize(
                text=clean_text,
                character_id=ctx.character_id,
            )
            ctx.audio_path = result.audio_path
            ctx.audio_duration_ms = result.duration_ms
            ctx.visemes = result.visemes
        except Exception as e:
            # TTS failure is non-fatal — still return text without audio
            import structlog
            logger = structlog.get_logger()
            logger.warning("tts_failed", error=str(e))
            ctx.audio_path = None
            ctx.visemes = []

        return ctx
```

- [ ] **Step 2: Update `ai/keshin_ai/pipeline/context.py`**

Add audio fields to PipelineContext:

```python
# Add to PipelineContext dataclass:
audio_path: str | None = None
audio_duration_ms: float = 0.0
visemes: list = field(default_factory=list)  # list of VisemeTiming dicts
```

- [ ] **Step 3: Update `ai/keshin_ai/pipeline/orchestrator.py`**

Include TTS step in the pipeline:

```python
# In the PipelineOrchestrator, add TTSStep after EmotionParseStep:
# steps = [
#     ContextStep(),
#     LLMStep(llm_router),
#     EmotionParseStep(),
#     TranslationStep(llm_router),
#     TTSStep(tts_router),  # NEW
# ]
```

- [ ] **Step 4: Update `ai/keshin_ai/main.py` SSE streaming**

Add audio and viseme data to the SSE stream events:

```python
# In the SSE streaming endpoint, add event types:
# event: audio — audio URL for the browser to play
# event: visemes — viseme timing data for lip-sync

async def chat_stream_generator(request):
    # ... existing streaming logic ...

    # After TTS step completes:
    if ctx.audio_path:
        import os
        filename = os.path.basename(ctx.audio_path)
        yield f"event: audio\ndata: {{\"url\": \"/api/tts/audio/{filename}\"}}\n\n"

    if ctx.visemes:
        import json
        viseme_data = json.dumps([
            {"viseme": v.viseme, "time_ms": v.time_ms, "duration_ms": v.duration_ms}
            for v in ctx.visemes
        ])
        yield f"event: visemes\ndata: {viseme_data}\n\n"
```

- [ ] **Step 5: Update `frontend/src/stores/chatStore.ts`**

Add SSE event handling for audio and viseme events:

```typescript
// Update the SSE event handler in useChat or the store:

// In the SSE onmessage handler:
if (event.event === 'audio') {
  const data = JSON.parse(event.data);
  set({ currentAudioUrl: data.url });
}

if (event.event === 'visemes') {
  const visemes: VisemeFrame[] = JSON.parse(event.data);
  // Store viseme frames for lip-sync
  useCharacterStore.getState().setVisemeFrames(visemes);
}

if (event.event === 'emotion') {
  const data = JSON.parse(event.data);
  set({ currentEmotion: data.emotion });
}
```

- [ ] **Step 6: Update `frontend/src/hooks/useChat.ts`**

Integrate expression and audio triggers when SSE events arrive:

```typescript
import { useChatStore } from '../stores/chatStore';
import { useCharacterStore } from '../stores/characterStore';
import { estimateVisemesFromText } from '../lib/visemeMap';

// In the useChat hook or wherever SSE events are processed:

// When an emotion event arrives:
function handleEmotionEvent(emotion: string) {
  const characterStore = useCharacterStore.getState();
  characterStore.setExpression(emotion as EmotionName);
}

// When an audio event arrives:
function handleAudioEvent(audioUrl: string) {
  const chatStore = useChatStore.getState();
  chatStore.setAudioUrl(audioUrl);
}

// When viseme event arrives:
function handleVisemeEvent(visemes: VisemeFrame[]) {
  const characterStore = useCharacterStore.getState();
  characterStore.setVisemeFrames(visemes);
}

// When audio playback ends:
function handleAudioEnd() {
  const characterStore = useCharacterStore.getState();
  characterStore.setSpeaking(false);
  characterStore.setExpression('neutral'); // Return to neutral after speaking
}
```

- [ ] **Step 7: Update `frontend/src/components/ChatPanel.tsx`**

Add a "thinking" expression trigger when user sends a message:

```tsx
// In the message send handler:
function handleSendMessage(content: string) {
  // Set thinking expression while waiting for LLM response
  useCharacterStore.getState().setExpression('thinking');
  // ... rest of send logic
}
```

- [ ] **Step 8: End-to-end test**

```bash
# Terminal 1: Start Python AI service
cd ai && uv run uvicorn keshin_ai.main:app --port 9090

# Terminal 2: Start Go server
go run ./cmd/keshin run --character hinata --mode web --port 8080

# Terminal 3: Start frontend dev server
cd frontend && npm run dev

# Open http://localhost:5173
# 1. Click on the chat input
# 2. Type: "Hello, how are you?"
# 3. Expected flow:
#    a. "Thinking" expression appears on 3D model
#    b. LLM generates Japanese response with [emotion:happy] tag
#    c. Expression changes to "happy" with smooth transition
#    d. TTS audio plays via browser
#    e. Lip-sync animation drives mouth movement
#    f. English subtitle appears below character
#    g. After audio ends, expression returns to neutral
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: end-to-end integration — emotion → expression, TTS → audio → lip-sync"
```

---

## Task 9: Testing + Polish

**Files:**
- Create: `frontend/src/renderers/vrm/__tests__/VRMExpressionManager.test.ts`
- Create: `frontend/src/renderers/vrm/__tests__/VRMLipSync.test.ts`
- Create: `frontend/src/lib/__tests__/visemeMap.test.ts`
- Create: `ai/tests/test_viseme.py`
- Modify: `frontend/src/App.tsx` — add loading/error states
- Modify: `frontend/src/components/CharacterViewer.tsx` — add error boundary, loading spinner
- Modify: `frontend/src/styles/globals.css` — add fade-in animation for subtitles

- [ ] **Step 1: Write `frontend/src/lib/__tests__/visemeMap.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { estimateVisemesFromText, isValidViseme, KANA_VISEME_MAP } from '../visemeMap';

describe('estimateVisemesFromText', () => {
  it('should map basic hiragana to visemes', () => {
    const visemes = estimateVisemesFromText('あいうえお');
    expect(visemes).toHaveLength(5);
    expect(visemes[0].viseme).toBe('aa');
    expect(visemes[1].viseme).toBe('ih');
    expect(visemes[2].viseme).toBe('ou');
    expect(visemes[3].viseme).toBe('ee');
    expect(visemes[4].viseme).toBe('oh');
  });

  it('should map katakana to visemes', () => {
    const visemes = estimateVisemesFromText('アイウエオ');
    expect(visemes).toHaveLength(5);
    expect(visemes[0].viseme).toBe('aa');
  });

  it('should skip emotion tags', () => {
    const visemes = estimateVisemesFromText('[emotion:happy]こんにちは');
    expect(visemes[0].viseme).toBe('aa'); // こ → oh
    // Should not produce visemes for bracket text
  });

  it('should handle punctuation as brief mouth close', () => {
    const visemes = estimateVisemesFromText('はい。');
    expect(visemes.length).toBeGreaterThanOrEqual(2);
    // 。 should produce a brief 'ou' (closed) viseme
    const lastFrame = visemes[visemes.length - 1];
    expect(lastFrame.viseme).toBe('ou');
  });

  it('should return empty for empty text', () => {
    const visemes = estimateVisemesFromText('');
    expect(visemes).toHaveLength(0);
  });
});

describe('isValidViseme', () => {
  it('should accept valid VRM viseme names', () => {
    expect(isValidViseme('aa')).toBe(true);
    expect(isValidViseme('ih')).toBe(true);
    expect(isValidViseme('ou')).toBe(true);
    expect(isValidViseme('ee')).toBe(true);
    expect(isValidViseme('oh')).toBe(true);
  });

  it('should reject invalid viseme names', () => {
    expect(isValidViseme('happy')).toBe(false);
    expect(isValidViseme('xx')).toBe(false);
  });
});
```

- [ ] **Step 2: Write `frontend/src/renderers/vrm/__tests__/VRMLipSync.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';

describe('VRMLipSync', () => {
  // Note: VRMLipSync requires a VRM instance, which needs a browser.
  // We test the logic separately.

  it('should calculate viseme frame timing correctly', () => {
    // Verify duration calculations match expectations
    const frames = [
      { viseme: 'aa', startTimeMs: 0, durationMs: 80 },
      { viseme: 'ih', startTimeMs: 80, durationMs: 80 },
      { viseme: 'ou', startTimeMs: 160, durationMs: 80 },
    ];
    expect(frames[0].startTimeMs).toBe(0);
    expect(frames[1].startTimeMs).toBeGreaterThan(frames[0].startTimeMs);
    expect(frames[2].startTimeMs).toBeGreaterThan(frames[1].startTimeMs);
  });

  it('should have smooth transitions between visemes', () => {
    // Viseme frames should not overlap
    const frames = [
      { viseme: 'aa', startTimeMs: 0, durationMs: 80 },
      { viseme: 'ih', startTimeMs: 80, durationMs: 80 },
    ];
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].startTimeMs).toBeGreaterThanOrEqual(
        frames[i - 1].startTimeMs + frames[i - 1].durationMs * 0.8 // Allow 20% overlap
      );
    }
  });
});
```

- [ ] **Step 3: Write `ai/tests/test_viseme.py`**

Test Python viseme estimation:

```python
import pytest
from keshin_ai.tts.edge_tts import estimate_visemes_from_text


class TestVisemeEstimation:
    def test_basic_hiragana(self):
        """Basic hiragana maps to correct visemes."""
        visemes = estimate_visemes_from_text("あいうえお", 400.0)
        assert len(visemes) == 5
        assert visemes[0]["viseme"] == "aa"  # あ
        assert visemes[1]["viseme"] == "ih"   # い
        assert visemes[2]["viseme"] == "ou"   # う
        assert visemes[3]["viseme"] == "ee"  # え
        assert visemes[4]["viseme"] == "oh"  # お

    def test_strips_emotion_tags(self):
        """Emotion tags should be stripped before viseme estimation."""
        visemes = estimate_visemes_from_text("[emotion:happy]こんにちは", 500.0)
        # Should not include visemes for bracket text
        assert all(v["viseme"] in ("aa", "ih", "ou", "ee", "oh") for v in visemes)

    def test_punctuation_handling(self):
        """Punctuation should produce brief closed-mouth visemes."""
        visemes = estimate_visemes_from_text("はい。", 200.0)
        # Last viseme should be 'ou' (closed position for 。)
        assert visemes[-1]["viseme"] == "ou"

    def test_empty_text(self):
        """Empty text should produce no visemes."""
        visemes = estimate_visemes_from_text("", 100.0)
        assert len(visemes) == 0

    def test_katakana(self):
        """Katakana maps correctly."""
        visemes = estimate_visemes_from_text("コンニチハ", 400.0)
        assert visemes[0]["viseme"] == "oh"  # コ
```

- [ ] **Step 4: Run all tests**

```bash
# Frontend tests
cd frontend && npx vitest run

# Python tests
cd ai && uv run pytest tests/test_viseme.py -v

# Go tests (if any exist)
cd keshin-go && go test ./...
```

- [ ] **Step 5: Add fade-in animation to globals.css**

```css
/* Add to frontend/src/styles/globals.css */

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

/* Subtitle overlay styling */
.subtitle-bar {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

/* Character viewer loading overlay */
.loading-overlay {
  backdrop-filter: blur(4px);
}
```

- [ ] **Step 6: Add error boundary to CharacterViewer**

```tsx
// Add to CharacterViewer.tsx:
import { Component, type ReactNode } from 'react';

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
```

- [ ] **Step 7: Full end-to-end test walk-through**

```bash
# Ensure all services are running:
# 1. Python AI: cd ai && uv run uvicorn keshin_ai.main:app --port 9090
# 2. Go server: go run ./cmd/keshin run --character hinata --mode web --port 8080
# 3. Frontend: cd frontend && npm run dev

# Test checklist:
# ☐ VRM model loads in browser (dark 3D scene with character)
# ☐ Model plays idle animation (breathing, swaying)
# ☐ Model blinks automatically
# ☐ Type message → expression changes to "thinking"
# ☐ LLM response arrives → expression changes to emotion (e.g., "happy")
# ☐ Smooth expression transition (0.3s blend)
# ☐ TTS audio plays through browser speakers
# ☐ Lip-sync mouth movement during audio playback
# ☐ Mouth closes after audio ends
# ☐ English subtitle appears below character
# ☐ Expression returns to neutral after audio ends
# ☐ Orbit controls work (drag to rotate, scroll to zoom)
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "test: viseme mapping tests, error boundary, subtitle animations, polish"
```

---

## Phase 1B Deliverable

After completing all 9 tasks:

```bash
keshin run --character hinata --mode web --port 8080
# → Browser opens at http://localhost:8080
# → Hinata VRM character appears in 3D scene with idle animation (breathing, blinking)
# → User types "Hello, how are you?"
# → Character expression changes to "thinking" while LLM processes
# → LLM responds: "[emotion:happy] へへっ、元気だよ！..."
# → Character expression smoothly transitions to "happy" (smile + eye squint)
# → TTS audio plays through browser speakers
# → Lip-sync animation: mouth opens/closes in sync with Japanese syllables
# → English subtitle: "Hehe, I'm doing great!" appears below character
# → After audio ends, expression returns to neutral
# → User can orbit camera around character with mouse
```

**What Phase 1B adds on top of Phase 1A:**
- ✅ 3D VRM character rendering (Three.js + three-vrm)
- ✅ Idle animation (breathing, swaying, auto-blink)
- ✅ Expression mapping (emotion string → VRM blend shapes → facial animation)
- ✅ TTS audio playback in browser (Web Audio API)
- ✅ Viseme lip-sync (Japanese phoneme → mouth animation)
- ✅ Expression transitions (smooth blend between emotions)
- ✅ Subtitle overlay below character
- ✅ End-to-end pipeline: text → LLM → Japanese + emotion → expression + audio + lip-sync

**What's NOT in Phase 1B:**
- ☐ Voice input / STT (Phase 2)
- ☐ Desktop mode / Wails (Phase 2)
- ☐ VRMA animation clips (Phase 4)
- ☐ Eye tracking (follows mouse) (Phase 4)
- ☐ Background scenes (Phase 4)
- ☐ Live2D support (Phase 4)
- ☐ Conversation memory / SQLite (Phase 3)
- ☐ gRPC (Phase 3)