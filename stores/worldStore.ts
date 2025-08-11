import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Vector3 } from 'three';
import type { Enemy, EffectTriggerPayload } from '../types';
import { eventBus } from '../systems/eventBus';
import { ENEMY_MAX_COUNT, TERRAIN_WIDTH, TERRAIN_HEIGHT } from '../constants';

export interface WorldState {
  // Terrain & environment
  terrainGenerated: boolean;
  terrainSeed: number;
  heightmapData: Float32Array | null;
  terrainScale: number;
  
  // Weather & atmosphere
  timeOfDay: number; // 0-24 hours
  weatherType: 'clear' | 'fog' | 'storm' | 'ash_rain';
  windSpeed: number;
  windDirection: { x: number; z: number };
  
  // Enemies
  enemies: Map<string, Enemy>;
  enemySpawnPoints: Vector3[];
  lastEnemySpawnTime: number;
  enemySpawnRate: number; // enemies per minute
  maxEnemies: number;
  
  // Effects & particles
  activeEffects: Map<string, {
    effect: EffectTriggerPayload;
    createdAt: number;
    duration: number;
  }>;
  
  // World objects & assets
  worldObjects: Map<string, {
    id: string;
    type: 'rock' | 'tree' | 'crystal' | 'ruins';
    position: Vector3;
    rotation: { x: number; y: number; z: number };
    scale: number;
    isCollectable: boolean;
    health?: number;
  }>;
  
  // Lighting & rendering
  ambientLightIntensity: number;
  directionalLightIntensity: number;
  shadowQuality: 'low' | 'medium' | 'high';
  renderDistance: number;
  
  // Audio zones
  audioZones: Array<{
    id: string;
    center: Vector3;
    radius: number;
    soundId: string;
    volume: number;
    isActive: boolean;
  }>;
}

interface WorldActions {
  // Terrain management
  generateTerrain: (seed?: number) => void;
  setTerrainScale: (scale: number) => void;
  getHeightAtPosition: (x: number, z: number) => number;
  
  // Weather & atmosphere
  setTimeOfDay: (hours: number) => void;
  setWeather: (weather: 'clear' | 'fog' | 'storm' | 'ash_rain') => void;
  setWind: (speed: number, direction: { x: number; z: number }) => void;
  updateAtmosphere: (deltaTime: number) => void;
  
  // Enemy management
  addEnemy: (enemy: Enemy) => void;
  removeEnemy: (enemyId: string) => void;
  updateEnemyHealth: (enemyId: string, health: number) => void;
  getEnemiesInRange: (center: Vector3, radius: number) => Enemy[];
  spawnEnemyWave: (count?: number) => void;
  setEnemySpawnRate: (rate: number) => void;
  
  // Effects management
  addEffect: (effect: EffectTriggerPayload, duration?: number) => string;
  removeEffect: (effectId: string) => void;
  updateEffects: () => void;
  getActiveEffects: () => EffectTriggerPayload[];
  
  // World objects
  addWorldObject: (object: {
    type: 'rock' | 'tree' | 'crystal' | 'ruins';
    position: Vector3;
    rotation?: { x: number; y: number; z: number };
    scale?: number;
    isCollectable?: boolean;
    health?: number;
  }) => string;
  removeWorldObject: (objectId: string) => void;
  damageWorldObject: (objectId: string, damage: number) => boolean;
  getObjectsInRange: (center: Vector3, radius: number) => Array<{
    id: string;
    type: 'rock' | 'tree' | 'crystal' | 'ruins';
    position: Vector3;
    distance: number;
  }>;
  
  // Lighting & rendering
  setAmbientLight: (intensity: number) => void;
  setDirectionalLight: (intensity: number) => void;
  setShadowQuality: (quality: 'low' | 'medium' | 'high') => void;
  setRenderDistance: (distance: number) => void;
  
  // Audio zones
  addAudioZone: (zone: {
    center: Vector3;
    radius: number;
    soundId: string;
    volume: number;
  }) => string;
  removeAudioZone: (zoneId: string) => void;
  updateAudioZones: (playerPosition: Vector3) => void;
  
  // Utility
  getWorldBounds: () => { min: Vector3; max: Vector3 };
  isPositionValid: (position: Vector3) => boolean;
  findNearestSpawnPoint: (position: Vector3) => Vector3 | null;
  reset: () => void;
}

type WorldStore = WorldState & WorldActions;

const initialWorldState: WorldState = {
  terrainGenerated: false,
  terrainSeed: Math.random() * 1000000,
  heightmapData: null,
  terrainScale: 1.5,
  
  timeOfDay: 12, // Noon
  weatherType: 'clear',
  windSpeed: 0.5,
  windDirection: { x: 1, z: 0 },
  
  enemies: new Map(),
  enemySpawnPoints: [],
  lastEnemySpawnTime: 0,
  enemySpawnRate: 15, // enemies per minute
  maxEnemies: ENEMY_MAX_COUNT,
  
  activeEffects: new Map(),
  worldObjects: new Map(),
  
  ambientLightIntensity: 0.3,
  directionalLightIntensity: 1.0,
  shadowQuality: 'high',
  renderDistance: 100,
  
  audioZones: [],
};

export const useWorldStore = create<WorldStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialWorldState,
    
    // Terrain management
    generateTerrain: (seed?: number) => {
      const terrainSeed = seed || Math.random() * 1000000;
      
      // Generate heightmap data (placeholder - would use actual noise generation)
      const size = TERRAIN_WIDTH * TERRAIN_HEIGHT;
      const heightmapData = new Float32Array(size);
      
      // Simple noise generation for now
      for (let i = 0; i < size; i++) {
        const x = i % TERRAIN_WIDTH;
        const z = Math.floor(i / TERRAIN_WIDTH);
        heightmapData[i] = Math.random() * 25; // 0-25 height range
      }
      
      // Generate spawn points around the terrain
      const spawnPoints: Vector3[] = [];
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const radius = 50 + Math.random() * 50;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = get().getHeightAtPosition(x, z);
        spawnPoints.push({ x, y, z } as Vector3);
      }
      
      set({ 
        terrainGenerated: true,
        terrainSeed,
        heightmapData,
        enemySpawnPoints: spawnPoints
      });
      
      eventBus.dispatch('TERRAIN_GENERATED', { seed: terrainSeed });
    },
    
    setTerrainScale: (scale: number) => {
      set({ terrainScale: Math.max(0.1, scale) });
    },
    
    getHeightAtPosition: (x: number, z: number) => {
      const state = get();
      if (!state.heightmapData) return 0;
      
      // Convert world coordinates to heightmap indices
      const mapX = Math.floor((x + TERRAIN_WIDTH / 2) / state.terrainScale);
      const mapZ = Math.floor((z + TERRAIN_HEIGHT / 2) / state.terrainScale);
      
      if (mapX < 0 || mapX >= TERRAIN_WIDTH || mapZ < 0 || mapZ >= TERRAIN_HEIGHT) {
        return 0;
      }
      
      const index = mapZ * TERRAIN_WIDTH + mapX;
      return state.heightmapData[index];
    },
    
    // Weather & atmosphere
    setTimeOfDay: (hours: number) => {
      set({ timeOfDay: Math.max(0, Math.min(24, hours)) });
      eventBus.dispatch('TIME_OF_DAY_CHANGED', { timeOfDay: hours });
    },
    
    setWeather: (weather) => {
      set({ weatherType: weather });
      eventBus.dispatch('WEATHER_CHANGED', { weather });
    },
    
    setWind: (speed: number, direction: { x: number; z: number }) => {
      const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
      const normalized = length > 0 ? { x: direction.x / length, z: direction.z / length } : { x: 1, z: 0 };
      
      set({ 
        windSpeed: Math.max(0, speed),
        windDirection: normalized
      });
    },
    
    updateAtmosphere: (deltaTime: number) => {
      const state = get();
      const timeIncrement = deltaTime / 1000 / 60; // Convert to minutes
      const newTime = state.timeOfDay + timeIncrement;
      
      if (newTime >= 24) {
        get().setTimeOfDay(newTime - 24);
      } else {
        get().setTimeOfDay(newTime);
      }
    },
    
    // Enemy management
    addEnemy: (enemy: Enemy) => {
      set(state => {
        const newEnemies = new Map(state.enemies);
        newEnemies.set(enemy.id, enemy);
        return { enemies: newEnemies };
      });
      eventBus.dispatch('ENEMY_SPAWNED', { enemy });
    },
    
    removeEnemy: (enemyId: string) => {
      set(state => {
        const newEnemies = new Map(state.enemies);
        const enemy = newEnemies.get(enemyId);
        newEnemies.delete(enemyId);
        
        if (enemy) {
          eventBus.dispatch('ENEMY_REMOVED', { enemy });
        }
        
        return { enemies: newEnemies };
      });
    },
    
    updateEnemyHealth: (enemyId: string, health: number) => {
      set(state => {
        const newEnemies = new Map(state.enemies);
        const enemy = newEnemies.get(enemyId);
        
        if (enemy) {
          const updatedEnemy = { ...enemy, health: Math.max(0, health) };
          newEnemies.set(enemyId, updatedEnemy);
          
          if (updatedEnemy.health <= 0) {
            eventBus.dispatch('ENEMY_DIED', { 
              id: enemyId, 
              position: enemy.initialPosition 
            });
          }
        }
        
        return { enemies: newEnemies };
      });
    },
    
    getEnemiesInRange: (center: Vector3, radius: number) => {
      const state = get();
      const enemiesInRange: Enemy[] = [];
      
      state.enemies.forEach(enemy => {
        const distance = Math.sqrt(
          Math.pow(enemy.initialPosition.x - center.x, 2) +
          Math.pow(enemy.initialPosition.y - center.y, 2) +
          Math.pow(enemy.initialPosition.z - center.z, 2)
        );
        
        if (distance <= radius) {
          enemiesInRange.push(enemy);
        }
      });
      
      return enemiesInRange;
    },
    
    spawnEnemyWave: (count = 5) => {
      const state = get();
      if (state.enemies.size >= state.maxEnemies) return;
      
      const spawnCount = Math.min(count, state.maxEnemies - state.enemies.size);
      const spawnPoints = state.enemySpawnPoints;
      
      for (let i = 0; i < spawnCount; i++) {
        const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        const enemy: Enemy = {
          id: `enemy_${Date.now()}_${i}`,
          initialPosition: spawnPoint,
          health: 100,
          maxHealth: 100
        };
        
        get().addEnemy(enemy);
      }
    },
    
    setEnemySpawnRate: (rate: number) => {
      set({ enemySpawnRate: Math.max(0, rate) });
    },
    
    // Effects management
    addEffect: (effect: EffectTriggerPayload, duration = 5000) => {
      const effectId = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      set(state => {
        const newEffects = new Map(state.activeEffects);
        newEffects.set(effectId, {
          effect,
          createdAt: Date.now(),
          duration
        });
        return { activeEffects: newEffects };
      });
      
      return effectId;
    },
    
    removeEffect: (effectId: string) => {
      set(state => {
        const newEffects = new Map(state.activeEffects);
        newEffects.delete(effectId);
        return { activeEffects: newEffects };
      });
    },
    
    updateEffects: () => {
      const now = Date.now();
      set(state => {
        const newEffects = new Map();
        const expiredIds: string[] = [];
        
        state.activeEffects.forEach((data, id) => {
          if (now - data.createdAt < data.duration) {
            newEffects.set(id, data);
          } else {
            expiredIds.push(id);
          }
        });
        
        expiredIds.forEach(id => {
          eventBus.dispatch('EFFECT_EXPIRED', { effectId: id });
        });
        
        return { activeEffects: newEffects };
      });
    },
    
    getActiveEffects: () => {
      const state = get();
      return Array.from(state.activeEffects.values()).map(data => data.effect);
    },
    
    // World objects
    addWorldObject: (object) => {
      const id = `object_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const worldObject = {
        id,
        ...object,
        rotation: object.rotation || { x: 0, y: 0, z: 0 },
        scale: object.scale || 1,
        isCollectable: object.isCollectable || false,
        health: object.health
      };
      
      set(state => {
        const newObjects = new Map(state.worldObjects);
        newObjects.set(id, worldObject);
        return { worldObjects: newObjects };
      });
      
      return id;
    },
    
    removeWorldObject: (objectId: string) => {
      set(state => {
        const newObjects = new Map(state.worldObjects);
        newObjects.delete(objectId);
        return { worldObjects: newObjects };
      });
    },
    
    damageWorldObject: (objectId: string, damage: number) => {
      const state = get();
      const obj = state.worldObjects.get(objectId);
      
      if (!obj || obj.health === undefined) return false;
      
      const newHealth = Math.max(0, obj.health - damage);
      const isDestroyed = newHealth <= 0;
      
      if (isDestroyed) {
        get().removeWorldObject(objectId);
        eventBus.dispatch('WORLD_OBJECT_DESTROYED', { objectId, object: obj });
      } else {
        set(state => {
          const newObjects = new Map(state.worldObjects);
          newObjects.set(objectId, { ...obj, health: newHealth });
          return { worldObjects: newObjects };
        });
      }
      
      return isDestroyed;
    },
    
    getObjectsInRange: (center: Vector3, radius: number) => {
      const state = get();
      const objectsInRange: Array<{
        id: string;
        type: 'rock' | 'tree' | 'crystal' | 'ruins';
        position: Vector3;
        distance: number;
      }> = [];
      
      state.worldObjects.forEach((obj, id) => {
        const distance = Math.sqrt(
          Math.pow(obj.position.x - center.x, 2) +
          Math.pow(obj.position.y - center.y, 2) +
          Math.pow(obj.position.z - center.z, 2)
        );
        
        if (distance <= radius) {
          objectsInRange.push({
            id,
            type: obj.type,
            position: obj.position,
            distance
          });
        }
      });
      
      return objectsInRange.sort((a, b) => a.distance - b.distance);
    },
    
    // Lighting & rendering
    setAmbientLight: (intensity: number) => {
      set({ ambientLightIntensity: Math.max(0, Math.min(1, intensity)) });
    },
    
    setDirectionalLight: (intensity: number) => {
      set({ directionalLightIntensity: Math.max(0, Math.min(2, intensity)) });
    },
    
    setShadowQuality: (quality) => {
      set({ shadowQuality: quality });
    },
    
    setRenderDistance: (distance: number) => {
      set({ renderDistance: Math.max(10, Math.min(500, distance)) });
    },
    
    // Audio zones
    addAudioZone: (zone) => {
      const id = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const audioZone = {
        id,
        ...zone,
        isActive: false
      };
      
      set(state => ({
        audioZones: [...state.audioZones, audioZone]
      }));
      
      return id;
    },
    
    removeAudioZone: (zoneId: string) => {
      set(state => ({
        audioZones: state.audioZones.filter(zone => zone.id !== zoneId)
      }));
    },
    
    updateAudioZones: (playerPosition: Vector3) => {
      set(state => {
        const updatedZones = state.audioZones.map(zone => {
          const distance = Math.sqrt(
            Math.pow(zone.center.x - playerPosition.x, 2) +
            Math.pow(zone.center.y - playerPosition.y, 2) +
            Math.pow(zone.center.z - playerPosition.z, 2)
          );
          
          const wasActive = zone.isActive;
          const isActive = distance <= zone.radius;
          
          if (isActive && !wasActive) {
            eventBus.dispatch('AUDIO_ZONE_ENTERED', { zone });
          } else if (!isActive && wasActive) {
            eventBus.dispatch('AUDIO_ZONE_EXITED', { zone });
          }
          
          return { ...zone, isActive };
        });
        
        return { audioZones: updatedZones };
      });
    },
    
    // Utility
    getWorldBounds: () => {
      const halfWidth = TERRAIN_WIDTH / 2;
      const halfHeight = TERRAIN_HEIGHT / 2;
      return {
        min: { x: -halfWidth, y: 0, z: -halfHeight } as Vector3,
        max: { x: halfWidth, y: 100, z: halfHeight } as Vector3
      };
    },
    
    isPositionValid: (position: Vector3) => {
      const bounds = get().getWorldBounds();
      return (
        position.x >= bounds.min.x && position.x <= bounds.max.x &&
        position.z >= bounds.min.z && position.z <= bounds.max.z &&
        position.y >= bounds.min.y && position.y <= bounds.max.y
      );
    },
    
    findNearestSpawnPoint: (position: Vector3) => {
      const state = get();
      if (state.enemySpawnPoints.length === 0) return null;
      
      let nearest = state.enemySpawnPoints[0];
      let minDistance = Infinity;
      
      state.enemySpawnPoints.forEach(point => {
        const distance = Math.sqrt(
          Math.pow(point.x - position.x, 2) +
          Math.pow(point.y - position.y, 2) +
          Math.pow(point.z - position.z, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearest = point;
        }
      });
      
      return nearest;
    },
    
    reset: () => {
      set({
        ...initialWorldState,
        terrainSeed: Math.random() * 1000000
      });
    }
  }))
);

// Selectors for optimized subscriptions
export const selectTerrain = (state: WorldStore) => ({
  terrainGenerated: state.terrainGenerated,
  terrainSeed: state.terrainSeed,
  terrainScale: state.terrainScale,
  getHeightAtPosition: state.getHeightAtPosition
});

export const selectAtmosphere = (state: WorldStore) => ({
  timeOfDay: state.timeOfDay,
  weatherType: state.weatherType,
  windSpeed: state.windSpeed,
  windDirection: state.windDirection
});

export const selectEnemies = (state: WorldStore) => ({
  enemies: Array.from(state.enemies.values()),
  enemyCount: state.enemies.size,
  maxEnemies: state.maxEnemies,
  spawnRate: state.enemySpawnRate
});

export const selectLighting = (state: WorldStore) => ({
  ambientLightIntensity: state.ambientLightIntensity,
  directionalLightIntensity: state.directionalLightIntensity,
  shadowQuality: state.shadowQuality,
  renderDistance: state.renderDistance
});

export const selectWorldObjects = (state: WorldStore) => Array.from(state.worldObjects.values());

// Auto-update effects and atmosphere
let worldUpdateInterval: ReturnType<typeof setInterval> | null = null;

export const initWorldStore = () => {
  if (worldUpdateInterval) return;
  
  worldUpdateInterval = setInterval(() => {
    const store = useWorldStore.getState();
    store.updateEffects();
    store.updateAtmosphere(16); // ~60fps updates
  }, 16);
};