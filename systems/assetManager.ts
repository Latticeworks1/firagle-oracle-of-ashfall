
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSET_MAP } from '../data/assetMap';

class AssetManager {
    private loader = new GLTFLoader();
    private cache = new Map<string, THREE.Group>();
    private loadingPromises = new Map<string, Promise<THREE.Group>>();

    public async load(modelId: string): Promise<THREE.Group> {
        // 1. Check cache first
        if (this.cache.has(modelId)) {
            return this.cache.get(modelId)!.clone();
        }

        // 2. Check if it's already being loaded
        if (this.loadingPromises.has(modelId)) {
            const model = await this.loadingPromises.get(modelId)!;
            return model.clone();
        }

        // 3. Load from URL
        const url = ASSET_MAP[modelId];
        if (!url) {
            throw new Error(`Asset with id "${modelId}" not found in asset map.`);
        }

        const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    const model = gltf.scene;
                    // Store the original model in the cache
                    this.cache.set(modelId, model); 
                    // Resolve the promise with the original model for other waiting calls
                    resolve(model);
                    // Clean up promise map
                    this.loadingPromises.delete(modelId);
                },
                undefined, // onProgress
                (error) => {
                    console.error(`Failed to load asset: ${modelId}`, error);
                    reject(error);
                    // Clean up promise map
                    this.loadingPromises.delete(modelId);
                }
            );
        });

        this.loadingPromises.set(modelId, loadPromise);

        // Await the load and return a clone
        const loadedModel = await loadPromise;
        return loadedModel.clone();
    }
}

export const assetManager = new AssetManager();
