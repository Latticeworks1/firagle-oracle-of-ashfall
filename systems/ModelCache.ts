import * as THREE from 'three';

class ModelCache {
    private static instance: ModelCache;
    private cache = new Map<string, THREE.Object3D>();
    private geometryCache = new Map<string, THREE.BufferGeometry>();
    private materialCache = new Map<string, THREE.Material>();

    static getInstance(): ModelCache {
        if (!ModelCache.instance) {
            ModelCache.instance = new ModelCache();
        }
        return ModelCache.instance;
    }

    // Create and cache a rock monster model once
    getRockMonsterModel(): THREE.Mesh {
        const cacheKey = 'rock_monster';
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!.clone() as THREE.Mesh;
        }

        // Create the model once
        const geometry = this.getRockGeometry();
        const material = this.getRockMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { type: 'enemy' };

        // Cache it
        this.cache.set(cacheKey, mesh);
        return mesh.clone() as THREE.Mesh;
    }

    private getRockGeometry(): THREE.BufferGeometry {
        const cacheKey = 'rock_geometry';
        
        if (this.geometryCache.has(cacheKey)) {
            return this.geometryCache.get(cacheKey)!;
        }

        // Create a more detailed rock geometry
        const geometry = new THREE.IcosahedronGeometry(1, 2);
        
        // Add some variation to make it look more rock-like
        const positions = geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
            const noise = (Math.random() - 0.5) * 0.15;
            positions[i] += noise;
            positions[i + 1] += noise;
            positions[i + 2] += noise;
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();

        this.geometryCache.set(cacheKey, geometry);
        return geometry;
    }

    private getRockMaterial(): THREE.Material {
        const cacheKey = 'rock_material';
        
        if (this.materialCache.has(cacheKey)) {
            return this.materialCache.get(cacheKey)!;
        }

        const material = new THREE.MeshStandardMaterial({
            color: '#5c544d',
            roughness: 0.95,
            metalness: 0.05,
            emissive: '#331100',
            emissiveIntensity: 0.2
        });

        this.materialCache.set(cacheKey, material);
        return material;
    }

    // Clear cache when needed
    clearCache(): void {
        this.cache.clear();
        this.geometryCache.clear();
        this.materialCache.clear();
    }
}

export const modelCache = ModelCache.getInstance();