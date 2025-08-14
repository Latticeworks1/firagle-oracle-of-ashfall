import * as THREE from 'three';
import { generateHeightData } from '../utils/noise';
import { assetManager } from './assetManager';
import { ENVIRONMENT_ASSETS } from '../data/assetMap';
import { TERRAIN_WIDTH, TERRAIN_HEIGHT, TERRAIN_SCALE, TERRAIN_MAX_ALTITUDE } from '../constants';

export class MapGenerator {
    private static instance: MapGenerator;
    private cachedMap: THREE.Group | null = null;

    static getInstance(): MapGenerator {
        if (!MapGenerator.instance) {
            MapGenerator.instance = new MapGenerator();
        }
        return MapGenerator.instance;
    }




    private async generateTerrain(heightData: Float32Array): Promise<THREE.Mesh> {
        // Reduce geometry resolution for better performance
        const resolution = Math.min(TERRAIN_WIDTH - 1, 64); // Cap at 64x64 for performance
        const geometry = new THREE.PlaneGeometry(
            TERRAIN_WIDTH * TERRAIN_SCALE,
            TERRAIN_HEIGHT * TERRAIN_SCALE,
            resolution,
            resolution
        );

        const vertices = geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = Math.floor((vertices[i] / TERRAIN_SCALE + TERRAIN_WIDTH / 2));
            const z = Math.floor((-vertices[i + 1] / TERRAIN_SCALE + TERRAIN_HEIGHT / 2));
            const heightIndex = Math.max(0, Math.min(heightData.length - 1, x + z * TERRAIN_WIDTH));
            vertices[i + 2] = heightData[heightIndex];
        }

        geometry.rotateX(-Math.PI / 2);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            color: '#8b4513',
            roughness: 0.9,
            metalness: 0.1
        });

        return new THREE.Mesh(geometry, material);
    }

    private async generateAssets(heightData: Float32Array): Promise<THREE.Group[]> {
        const count = Math.floor(TERRAIN_WIDTH * TERRAIN_HEIGHT * 0.003); // Reduced from 0.015 to 0.003
        const assets: THREE.Group[] = [];

        // Load asset models
        let treeModel: THREE.Group | null = null;
        let bushModel: THREE.Group | null = null;

        try {
            if (ENVIRONMENT_ASSETS['petrified_tree']) {
                treeModel = await assetManager.load('petrified_tree');
            }
        } catch (error) {
            console.warn('Failed to load tree asset:', error);
        }

        try {
            if (ENVIRONMENT_ASSETS['latt_bush']) {
                bushModel = await assetManager.load('latt_bush');
            }
        } catch (error) {
            console.warn('Failed to load bush asset:', error);
        }

        // Use instanced meshes for better performance
        const rockGeometry = new THREE.IcosahedronGeometry(0.6, 1);
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: '#555', 
            roughness: 0.8 
        });
        
        const rockPositions: THREE.Vector3[] = [];
        const treePositions: THREE.Vector3[] = [];
        const bushPositions: THREE.Vector3[] = [];

        // Generate positions with proper ground detection
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * TERRAIN_WIDTH * TERRAIN_SCALE;
            const z = (Math.random() - 0.5) * TERRAIN_HEIGHT * TERRAIN_SCALE;

            // Correct terrain coordinate mapping
            const terrainX = Math.floor((x / TERRAIN_SCALE + TERRAIN_WIDTH / 2));
            const terrainZ = Math.floor((z / TERRAIN_SCALE + TERRAIN_HEIGHT / 2));
            
            // Clamp to valid terrain bounds
            const clampedX = Math.max(0, Math.min(terrainX, TERRAIN_WIDTH - 1));
            const clampedZ = Math.max(0, Math.min(terrainZ, TERRAIN_HEIGHT - 1));
            
            const heightIndex = clampedZ * TERRAIN_WIDTH + clampedX;
            const groundY = heightData[heightIndex] || 0;

            // Skip if terrain is too steep or at extremes
            if (groundY < 2 || groundY > TERRAIN_MAX_ALTITUDE - 3) continue;

            const rand = Math.random();
            
            if (rand > 0.7) {
                // Rocks sit on the ground
                rockPositions.push(new THREE.Vector3(x, groundY + 0.3, z));
            } else if (rand > 0.4 && treeModel) {
                // Trees planted at ground level
                treePositions.push(new THREE.Vector3(x, groundY, z));
            } else if (bushModel) {
                // Bushes at ground level
                bushPositions.push(new THREE.Vector3(x, groundY, z));
            }
        }

        // Create instanced meshes for rocks
        if (rockPositions.length > 0) {
            const rockMesh = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockPositions.length);
            const matrix = new THREE.Matrix4();
            
            rockPositions.forEach((pos, i) => {
                matrix.makeRotationFromEuler(new THREE.Euler(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI
                ));
                matrix.setPosition(pos);
                rockMesh.setMatrixAt(i, matrix);
            });
            
            rockMesh.instanceMatrix.needsUpdate = true;
            rockMesh.castShadow = true;
            rockMesh.receiveShadow = true;
            
            const rockGroup = new THREE.Group();
            rockGroup.add(rockMesh);
            assets.push(rockGroup);
        }

        // Add individual trees and bushes (fewer of these)
        treePositions.slice(0, Math.min(20, treePositions.length)).forEach(pos => {
            if (treeModel) {
                const tree = treeModel.clone();
                const scale = 0.8 + Math.random() * 0.4;
                tree.scale.setScalar(scale);
                tree.position.copy(pos);
                tree.rotation.y = Math.random() * Math.PI * 2;
                tree.castShadow = true;
                tree.receiveShadow = true;
                
                const treeGroup = new THREE.Group();
                treeGroup.add(tree);
                assets.push(treeGroup);
            }
        });

        bushPositions.slice(0, Math.min(15, bushPositions.length)).forEach(pos => {
            if (bushModel) {
                const bush = bushModel.clone();
                const scale = 0.8 + Math.random() * 0.4;
                bush.scale.setScalar(scale);
                bush.position.copy(pos);
                bush.rotation.y = Math.random() * Math.PI * 2;
                bush.castShadow = true;
                bush.receiveShadow = true;
                
                const bushGroup = new THREE.Group();
                bushGroup.add(bush);
                assets.push(bushGroup);
            }
        });

        return assets;
    }

    async getMap(): Promise<THREE.Group> {
        if (this.cachedMap) {
            return this.cachedMap.clone();
        }

        // Generate new map
        console.log('Generating new map...');
        const heightData = generateHeightData();
        
        const mapGroup = new THREE.Group();
        mapGroup.name = 'GeneratedMap';

        // Generate terrain
        const terrain = await this.generateTerrain(heightData);
        terrain.name = 'Terrain';
        terrain.castShadow = false;
        terrain.receiveShadow = true;
        mapGroup.add(terrain);

        // Generate assets
        const assets = await this.generateAssets(heightData);
        const assetsGroup = new THREE.Group();
        assetsGroup.name = 'Assets';
        assets.forEach(asset => assetsGroup.add(asset));
        mapGroup.add(assetsGroup);

        // Cache in memory only
        this.cachedMap = mapGroup;

        return mapGroup.clone();
    }

    clearCache(): void {
        this.cachedMap = null;
        console.log('Map cache cleared');
    }

    getHeightData(): Float32Array {
        return generateHeightData();
    }
}

export const mapGenerator = MapGenerator.getInstance();