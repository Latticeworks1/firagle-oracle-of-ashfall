
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ASSET_MAP, ENVIRONMENT_ASSETS } from '../data/assetMap';

class AssetManager {
    private gltfLoader = new GLTFLoader();
    private fbxLoader = new FBXLoader();
    private cache = new Map<string, THREE.Group>();
    private loadingPromises = new Map<string, Promise<THREE.Group>>();

    public async load(modelId: string): Promise<THREE.Group> {
        // Reject procedural asset loading attempts
        if (modelId.startsWith('procedural_')) {
            throw new Error(`Cannot load procedural asset "${modelId}" - should be generated, not loaded`);
        }

        // 1. Check cache first
        if (this.cache.has(modelId)) {
            return this.cache.get(modelId)!.clone();
        }

        // 2. Check if it's already being loaded
        if (this.loadingPromises.has(modelId)) {
            const model = await this.loadingPromises.get(modelId)!;
            return model.clone();
        }

        // 3. Load from local file path
        const url = ASSET_MAP[modelId];
        if (!url) {
            throw new Error(`Asset with id "${modelId}" not found in asset map.`);
        }

        const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
            const isGLTF = url.endsWith('.glb') || url.endsWith('.gltf');
            
            if (isGLTF) {
                this.gltfLoader.load(
                    url,
                    (gltf) => {
                        const model = gltf.scene;
                        this.processModel(model, modelId);
                        this.cache.set(modelId, model);
                        resolve(model);
                        this.loadingPromises.delete(modelId);
                    },
                    undefined,
                    (error) => {
                        console.error(`Failed to load GLTF asset: ${modelId}`, error);
                        reject(error);
                        this.loadingPromises.delete(modelId);
                    }
                );
            } else if (url.endsWith('.fbx')) {
                this.fbxLoader.load(
                    url,
                    (fbx) => {
                        this.processModel(fbx, modelId);
                        this.cache.set(modelId, fbx);
                        resolve(fbx);
                        this.loadingPromises.delete(modelId);
                    },
                    undefined,
                    (error) => {
                        console.error(`Failed to load FBX asset: ${modelId}`, error);
                        reject(error);
                        this.loadingPromises.delete(modelId);
                    }
                );
            } else {
                const error = new Error(`Unsupported file format for asset: ${modelId}`);
                console.error(error);
                reject(error);
                this.loadingPromises.delete(modelId);
            }
        });

        this.loadingPromises.set(modelId, loadPromise);

        // Await the load and return a clone
        const loadedModel = await loadPromise;
        return loadedModel.clone();
    }

    private processModel(model: THREE.Group, modelId: string): void {
        // Fix materials and add shadows
        model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // Enable shadows
                child.castShadow = true;
                child.receiveShadow = true;

                // Fix black materials
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => this.fixMaterial(mat, modelId));
                    } else {
                        this.fixMaterial(child.material, modelId);
                    }
                }
            }
        });

        // Add userData for identification
        model.userData = { 
            type: 'environment', 
            assetId: modelId,
            processedAt: Date.now()
        };
    }

    private fixMaterial(material: THREE.Material, modelId: string): void {
        if (material instanceof THREE.MeshStandardMaterial) {
            // If material appears black/unlit, give it proper colors
            if (material.color.getHex() === 0x000000) {
                // Default colors based on asset type
                if (modelId.includes('tree')) {
                    material.color.setHex(0x4a3e2a); // Brown tree
                } else if (modelId.includes('bush')) {
                    material.color.setHex(0x2d4a2d); // Green bush
                } else {
                    material.color.setHex(0x666666); // Gray default
                }
            }

            // Ensure proper lighting response
            material.roughness = Math.max(material.roughness, 0.3);
            material.metalness = Math.min(material.metalness, 0.2);
            
            // Force material update
            material.needsUpdate = true;
        }
    }
}

export const assetManager = new AssetManager();
