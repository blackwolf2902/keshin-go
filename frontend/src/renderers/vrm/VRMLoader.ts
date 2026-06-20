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
        VRMUtils.rotateVRM0(vrm);

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
