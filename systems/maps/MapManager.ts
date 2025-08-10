import * as THREE from 'three';
import type { MapRecord, AssetPlacement, SpawnPoint, TerrainData } from '../database/schema';
import { db } from '../database/PuterDatabase';
import { generateTerrain } from '../../utils/noise';

export class MapManager {
  private loadedMaps: Map<string, LoadedMap> = new Map();
  private currentMap: LoadedMap | null = null;
  private assetCache: Map<string, THREE.Object3D> = new Map();

  async loadMap(mapId: string): Promise<LoadedMap> {
    // Check if map is already loaded
    if (this.loadedMaps.has(mapId)) {
      return this.loadedMaps.get(mapId)!;
    }

    try {
      // Load map data from database
      const mapResult = await db.read('maps', mapId);
      if (!mapResult.success) {
        throw new Error(`Failed to load map: ${mapResult.error}`);
      }

      const mapData = mapResult.data as MapRecord;
      console.log(`Loading map: ${mapData.name}`);

      // Create loaded map instance
      const loadedMap = new LoadedMap(mapData);
      
      // Load terrain
      await loadedMap.loadTerrain();
      
      // Load assets
      await loadedMap.loadAssets();
      
      // Setup spawn points
      loadedMap.setupSpawnPoints();
      
      // Setup collision
      await loadedMap.setupCollision();

      // Cache the loaded map
      this.loadedMaps.set(mapId, loadedMap);
      
      console.log(`Map "${mapData.name}" loaded successfully`);
      return loadedMap;

    } catch (error) {
      console.error(`Failed to load map ${mapId}:`, error);
      throw error;
    }
  }

  async setCurrentMap(mapId: string): Promise<void> {
    const map = await this.loadMap(mapId);
    this.currentMap = map;
  }

  getCurrentMap(): LoadedMap | null {
    return this.currentMap;
  }

  async createMap(mapData: Omit<MapRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.create('maps', id, { ...mapData, id } as MapRecord);
    
    if (!result.success) {
      throw new Error(`Failed to create map: ${result.error}`);
    }

    return id;
  }

  async saveMap(mapId: string, updates: Partial<MapRecord>): Promise<void> {
    const result = await db.update('maps', mapId, updates);
    if (!result.success) {
      throw new Error(`Failed to save map: ${result.error}`);
    }

    // Invalidate cached map
    this.loadedMaps.delete(mapId);
  }

  async getAvailableMaps(): Promise<MapRecord[]> {
    const result = await db.query('maps', { isPublic: true });
    if (!result.success) {
      throw new Error(`Failed to get maps: ${result.error}`);
    }
    
    return result.data as MapRecord[];
  }

  // Create default Ashfall map
  async createDefaultAshfallMap(): Promise<string> {
    const ashfallMap: Omit<MapRecord, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Ashfall',
      description: 'A volcanic wasteland filled with ancient magic and rock monsters',
      creatorId: 'system',
      version: '1.0.0',
      maxPlayers: 8,
      recommendedGameModes: ['deathmatch', 'survival'],
      terrain: {
        heightmap: 'procedural', // Generated using noise
        size: { width: 200, height: 200 },
        scale: { x: 1, y: 20, z: 1 },
        materials: [
          {
            id: 'volcanic_rock',
            texture: '/textures/volcanic-rock.jpg',
            normalMap: '/textures/volcanic-rock-normal.jpg',
            scale: 2.0,
            blendMode: 'multiply'
          },
          {
            id: 'ash',
            texture: '/textures/ash.jpg',
            scale: 4.0,
            blendMode: 'overlay'
          }
        ],
        collision: {
          meshes: [],
          areas: [
            {
              id: 'death_zone',
              type: 'damage',
              geometry: 'box',
              position: new THREE.Vector3(0, -10, 0),
              size: new THREE.Vector3(300, 10, 300),
              properties: { damage: 100, interval: 1000 }
            }
          ]
        }
      },
      assets: [
        {
          id: 'bush_1',
          assetId: 'latt-bush',
          position: new THREE.Vector3(10, 0, 15),
          rotation: new THREE.Euler(0, Math.PI * 0.25, 0),
          scale: new THREE.Vector3(1, 1, 1),
          properties: { destructible: true },
          interactions: [
            {
              type: 'destructible',
              radius: 2,
              cooldown: 0,
              effects: ['debris_explosion'],
              conditions: {}
            }
          ]
        },
        {
          id: 'rock_1',
          assetId: 'latt-rock1',
          position: new THREE.Vector3(-15, 0, -20),
          rotation: new THREE.Euler(0, Math.PI * 0.75, 0),
          scale: new THREE.Vector3(1.2, 1.2, 1.2),
          properties: { cover: true },
          interactions: []
        }
      ],
      spawnPoints: [
        {
          id: 'spawn_1',
          position: new THREE.Vector3(0, 2, 0),
          rotation: new THREE.Euler(0, 0, 0),
          type: 'player',
          team: 'neutral',
          priority: 1,
          conditions: {}
        },
        {
          id: 'spawn_2',
          position: new THREE.Vector3(20, 2, 20),
          rotation: new THREE.Euler(0, Math.PI, 0),
          type: 'player',
          team: 'neutral',
          priority: 1,
          conditions: {}
        },
        {
          id: 'spawn_3',
          position: new THREE.Vector3(-20, 2, -20),
          rotation: new THREE.Euler(0, Math.PI * 0.5, 0),
          type: 'player',
          team: 'neutral',
          priority: 1,
          conditions: {}
        },
        {
          id: 'spawn_4',
          position: new THREE.Vector3(20, 2, -20),
          rotation: new THREE.Euler(0, Math.PI * 1.5, 0),
          type: 'player',
          team: 'neutral',
          priority: 1,
          conditions: {}
        }
      ],
      objectives: [
        {
          id: 'center_artifact',
          type: 'artifact',
          position: new THREE.Vector3(0, 5, 0),
          radius: 3,
          captureTime: 5000,
          rewards: { score: 100 },
          requirements: {}
        }
      ],
      environment: {
        lighting: {
          ambientColor: '#2d1810',
          ambientIntensity: 0.3,
          sunColor: '#ff6b35',
          sunIntensity: 1.5,
          sunPosition: new THREE.Vector3(-50, 100, 50),
          shadows: true,
          fog: {
            enabled: true,
            color: '#4a2c1a',
            near: 50,
            far: 200,
            density: 0.01
          }
        },
        weather: {
          type: 'volcanic',
          intensity: 0.7,
          windSpeed: 5,
          windDirection: new THREE.Vector3(1, 0, 0.5),
          effects: [
            {
              type: 'particles',
              properties: {
                type: 'ash',
                count: 1000,
                size: 0.1,
                speed: 2,
                color: '#8b4513'
              }
            }
          ]
        },
        audio: {
          ambientSounds: [
            {
              id: 'volcanic_ambience',
              file: '/audio/volcanic-ambience.mp3',
              volume: 0.3,
              loop: true,
              conditions: {}
            },
            {
              id: 'wind',
              file: '/audio/wind.mp3',
              volume: 0.2,
              loop: true,
              conditions: {}
            }
          ],
          reverb: {
            enabled: true,
            type: 'outdoor',
            intensity: 0.2
          },
          acoustics: []
        },
        effects: [
          {
            id: 'heat_distortion',
            type: 'post_processing',
            properties: {
              shader: 'heat_distortion',
              strength: 0.5
            },
            triggers: [
              {
                type: 'time',
                properties: { always: true }
              }
            ]
          }
        ]
      },
      isPublic: true,
      downloads: 0,
      rating: 5.0,
      tags: ['volcanic', 'magic', 'deathmatch', 'ashfall']
    };

    return await this.createMap(ashfallMap);
  }
}

export class LoadedMap {
  public mapData: MapRecord;
  public terrainMesh: THREE.Mesh | null = null;
  public assetObjects: Map<string, THREE.Object3D> = new Map();
  public spawnPoints: SpawnPoint[] = [];
  public collisionMeshes: THREE.Object3D[] = [];
  public scene: THREE.Scene;

  constructor(mapData: MapRecord) {
    this.mapData = mapData;
    this.scene = new THREE.Scene();
    this.spawnPoints = [...mapData.spawnPoints];
  }

  async loadTerrain(): Promise<void> {
    const terrain = this.mapData.terrain;
    
    // Generate heightmap using noise
    const heightData = generateTerrain(
      terrain.size.width, 
      terrain.size.height, 
      { 
        scale: 0.02, 
        octaves: 4, 
        persistence: 0.5, 
        lacunarity: 2.0 
      }
    );

    // Create terrain geometry
    const geometry = new THREE.PlaneGeometry(
      terrain.size.width, 
      terrain.size.height, 
      terrain.size.width - 1, 
      terrain.size.height - 1
    );

    // Apply heightmap to geometry
    const vertices = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = Math.floor((vertices[i] + terrain.size.width / 2) / terrain.size.width * terrain.size.width);
      const z = Math.floor((vertices[i + 2] + terrain.size.height / 2) / terrain.size.height * terrain.size.height);
      const heightIndex = Math.min(x + z * terrain.size.width, heightData.length - 1);
      vertices[i + 1] = heightData[heightIndex] * terrain.scale.y;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    // Create material
    const material = new THREE.MeshLambertMaterial({ 
      color: '#8b4513',
      wireframe: false
    });

    // Create mesh
    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.rotation.x = -Math.PI / 2;
    this.terrainMesh.receiveShadow = true;
    
    this.scene.add(this.terrainMesh);
  }

  async loadAssets(): Promise<void> {
    // Load each asset placement
    for (const asset of this.mapData.assets) {
      try {
        const assetObject = await this.loadAsset(asset);
        if (assetObject) {
          this.assetObjects.set(asset.id, assetObject);
          this.scene.add(assetObject);
        }
      } catch (error) {
        console.warn(`Failed to load asset ${asset.id}:`, error);
      }
    }
  }

  private async loadAsset(placement: AssetPlacement): Promise<THREE.Object3D | null> {
    // This would normally load from asset registry
    // For now, create placeholder objects
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    switch (placement.assetId) {
      case 'latt-bush':
        geometry = new THREE.SphereGeometry(0.8, 8, 6);
        material = new THREE.MeshLambertMaterial({ color: '#228b22' });
        break;
      case 'latt-rock1':
        geometry = new THREE.BoxGeometry(2, 1.5, 2);
        material = new THREE.MeshLambertMaterial({ color: '#696969' });
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
        material = new THREE.MeshLambertMaterial({ color: '#ff00ff' });
    }

    const object = new THREE.Mesh(geometry, material);
    object.position.copy(placement.position);
    object.rotation.copy(placement.rotation);
    object.scale.copy(placement.scale);
    object.castShadow = true;
    object.receiveShadow = true;
    
    // Add user data for interactions
    object.userData = {
      id: placement.id,
      assetId: placement.assetId,
      properties: placement.properties,
      interactions: placement.interactions
    };

    return object;
  }

  setupSpawnPoints(): void {
    // Spawn points are already set from map data
    // Add visual indicators for debugging (optional)
    this.spawnPoints.forEach((spawn, index) => {
      const indicator = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8),
        new THREE.MeshBasicMaterial({ 
          color: spawn.type === 'player' ? '#00ff00' : '#ff0000',
          transparent: true,
          opacity: 0.3
        })
      );
      indicator.position.copy(spawn.position);
      indicator.visible = false; // Hidden in gameplay, visible in editor
      indicator.userData = { type: 'spawn_point', spawnData: spawn };
      
      this.scene.add(indicator);
    });
  }

  async setupCollision(): Promise<void> {
    // Setup collision meshes based on terrain and assets
    const collisionAreas = this.mapData.terrain.collision.areas;
    
    for (const area of collisionAreas) {
      let geometry: THREE.BufferGeometry;
      
      switch (area.geometry) {
        case 'box':
          geometry = new THREE.BoxGeometry(area.size.x, area.size.y, area.size.z);
          break;
        case 'sphere':
          geometry = new THREE.SphereGeometry(area.size.x);
          break;
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(area.size.x, area.size.x, area.size.y);
          break;
        default:
          continue;
      }

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ visible: false }) // Invisible collision mesh
      );
      
      mesh.position.copy(area.position);
      mesh.userData = {
        type: 'collision_area',
        areaType: area.type,
        properties: area.properties
      };

      this.collisionMeshes.push(mesh);
      this.scene.add(mesh);
    }
  }

  getRandomSpawnPoint(type: 'player' | 'enemy' = 'player'): SpawnPoint | null {
    const availableSpawns = this.spawnPoints.filter(spawn => spawn.type === type);
    if (availableSpawns.length === 0) return null;
    
    return availableSpawns[Math.floor(Math.random() * availableSpawns.length)];
  }

  getSpawnPointById(id: string): SpawnPoint | null {
    return this.spawnPoints.find(spawn => spawn.id === id) || null;
  }

  // Environment setup
  setupLighting(scene: THREE.Scene): void {
    const lighting = this.mapData.environment.lighting;
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(lighting.ambientColor, lighting.ambientIntensity);
    scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(lighting.sunColor, lighting.sunIntensity);
    directionalLight.position.copy(lighting.sunPosition);
    directionalLight.castShadow = lighting.shadows;
    
    if (lighting.shadows) {
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 200;
      directionalLight.shadow.camera.left = -100;
      directionalLight.shadow.camera.right = 100;
      directionalLight.shadow.camera.top = 100;
      directionalLight.shadow.camera.bottom = -100;
    }
    
    scene.add(directionalLight);
    
    // Fog
    if (lighting.fog.enabled) {
      scene.fog = new THREE.Fog(
        lighting.fog.color,
        lighting.fog.near,
        lighting.fog.far
      );
    }
  }

  dispose(): void {
    // Clean up resources
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        } else if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        }
      }
    });
    
    this.assetObjects.clear();
    this.collisionMeshes.length = 0;
  }
}

// Global map manager instance
export const mapManager = new MapManager();