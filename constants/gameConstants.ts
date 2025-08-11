// Enhanced constants manager with runtime configuration support
import { create } from 'zustand';

// Core game constants (immutable)
export const CORE_CONSTANTS = {
  // Rendering
  TARGET_FPS: 60,
  FRAME_TIME_MS: 1000 / 60,
  
  // Physics
  GRAVITY: -9.81,
  PHYSICS_TIMESTEP: 1 / 60,
  
  // World bounds
  TERRAIN_WIDTH: 256,
  TERRAIN_HEIGHT: 256,
  TERRAIN_MAX_ALTITUDE: 25.0,
  WORLD_BOUNDS: {
    MIN_X: -128,
    MAX_X: 128,
    MIN_Z: -128,
    MAX_Z: 128,
    MIN_Y: 0,
    MAX_Y: 100
  },
  
  // Asset paths
  ASSETS: {
    MODELS_PATH: '/models/',
    TEXTURES_PATH: '/textures/',
    SOUNDS_PATH: '/sounds/',
    SHADERS_PATH: '/shaders/'
  },
  
  // Input
  TOUCH_DEVICE_CHECK: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  
  // Network
  DEFAULT_SERVER_PORT: 3001,
  NETWORK_UPDATE_RATE: 20, // Hz
  MAX_NETWORK_LATENCY: 5000, // ms
} as const;

// Runtime configurable constants
interface ConfigurableConstants {
  // Player settings
  player: {
    maxHealth: number;
    movementSpeed: number;
    jumpHeight: number;
    sprintMultiplier: number;
  };
  
  // Enemy settings
  enemy: {
    maxCount: number;
    spawnInterval: number;
    maxHealth: number;
    speed: number;
    damage: number;
    attackCooldown: number;
    attackRange: number;
    aggroRange: number;
  };
  
  // Weapon settings
  weapon: {
    projectileLifespan: number;
    maxProjectiles: number;
    chargingSpeedMultiplier: number;
    criticalHitChance: number;
    criticalHitMultiplier: number;
  };
  
  // Performance settings
  performance: {
    enableParticles: boolean;
    maxParticles: number;
    renderDistance: number;
    shadowQuality: 'off' | 'low' | 'medium' | 'high';
    antialiasing: boolean;
    bloomEffect: boolean;
    postProcessing: boolean;
  };
  
  // Audio settings
  audio: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    enableReverb: boolean;
    enable3DAudio: boolean;
  };
  
  // Visual settings
  visual: {
    terrainScale: number;
    fogDensity: number;
    ambientLightIntensity: number;
    directionalLightIntensity: number;
    colorGrading: boolean;
    motionBlur: boolean;
  };
}

// Default configuration
const DEFAULT_CONFIG: ConfigurableConstants = {
  player: {
    maxHealth: 100,
    movementSpeed: 5,
    jumpHeight: 2,
    sprintMultiplier: 1.5,
  },
  
  enemy: {
    maxCount: 15,
    spawnInterval: 4000,
    maxHealth: 100,
    speed: 1.5,
    damage: 10,
    attackCooldown: 1000,
    attackRange: 1.8,
    aggroRange: 25,
  },
  
  weapon: {
    projectileLifespan: 3000,
    maxProjectiles: 50,
    chargingSpeedMultiplier: 1.0,
    criticalHitChance: 0.1,
    criticalHitMultiplier: 2.0,
  },
  
  performance: {
    enableParticles: true,
    maxParticles: 1000,
    renderDistance: 100,
    shadowQuality: 'high',
    antialiasing: true,
    bloomEffect: true,
    postProcessing: true,
  },
  
  audio: {
    masterVolume: 0.7,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    enableReverb: true,
    enable3DAudio: true,
  },
  
  visual: {
    terrainScale: 1.5,
    fogDensity: 0.02,
    ambientLightIntensity: 0.3,
    directionalLightIntensity: 1.0,
    colorGrading: true,
    motionBlur: false,
  },
};

// Performance presets
export const PERFORMANCE_PRESETS = {
  LOW: {
    performance: {
      enableParticles: false,
      maxParticles: 100,
      renderDistance: 50,
      shadowQuality: 'off' as const,
      antialiasing: false,
      bloomEffect: false,
      postProcessing: false,
    },
    visual: {
      ...DEFAULT_CONFIG.visual,
      fogDensity: 0.05,
      motionBlur: false,
      colorGrading: false,
    }
  },
  
  MEDIUM: {
    performance: {
      enableParticles: true,
      maxParticles: 500,
      renderDistance: 75,
      shadowQuality: 'low' as const,
      antialiasing: true,
      bloomEffect: true,
      postProcessing: true,
    },
    visual: {
      ...DEFAULT_CONFIG.visual,
      fogDensity: 0.03,
      motionBlur: false,
    }
  },
  
  HIGH: {
    performance: {
      enableParticles: true,
      maxParticles: 1000,
      renderDistance: 100,
      shadowQuality: 'high' as const,
      antialiasing: true,
      bloomEffect: true,
      postProcessing: true,
    },
    visual: {
      ...DEFAULT_CONFIG.visual,
      motionBlur: true,
    }
  }
} as const;

// Constants store for runtime configuration
interface ConstantsStore extends ConfigurableConstants {
  // Actions
  updatePlayerConfig: (config: Partial<ConfigurableConstants['player']>) => void;
  updateEnemyConfig: (config: Partial<ConfigurableConstants['enemy']>) => void;
  updateWeaponConfig: (config: Partial<ConfigurableConstants['weapon']>) => void;
  updatePerformanceConfig: (config: Partial<ConfigurableConstants['performance']>) => void;
  updateAudioConfig: (config: Partial<ConfigurableConstants['audio']>) => void;
  updateVisualConfig: (config: Partial<ConfigurableConstants['visual']>) => void;
  
  // Presets
  applyPerformancePreset: (preset: 'LOW' | 'MEDIUM' | 'HIGH') => void;
  resetToDefaults: () => void;
  
  // Persistence
  saveToStorage: () => void;
  loadFromStorage: () => boolean;
  
  // Utilities
  getConfig: () => ConfigurableConstants;
  validateConfig: (config: Partial<ConfigurableConstants>) => boolean;
}

const STORAGE_KEY = 'firagle_game_constants';

export const useConstants = create<ConstantsStore>()((set, get) => ({
  ...DEFAULT_CONFIG,
  
  updatePlayerConfig: (config) => {
    set((state) => ({
      player: { ...state.player, ...config }
    }));
  },
  
  updateEnemyConfig: (config) => {
    set((state) => ({
      enemy: { ...state.enemy, ...config }
    }));
  },
  
  updateWeaponConfig: (config) => {
    set((state) => ({
      weapon: { ...state.weapon, ...config }
    }));
  },
  
  updatePerformanceConfig: (config) => {
    set((state) => ({
      performance: { ...state.performance, ...config }
    }));
  },
  
  updateAudioConfig: (config) => {
    set((state) => ({
      audio: { ...state.audio, ...config }
    }));
  },
  
  updateVisualConfig: (config) => {
    set((state) => ({
      visual: { ...state.visual, ...config }
    }));
  },
  
  applyPerformancePreset: (preset) => {
    const presetConfig = PERFORMANCE_PRESETS[preset];
    set((state) => ({
      ...state,
      ...presetConfig
    }));
    get().saveToStorage();
  },
  
  resetToDefaults: () => {
    set(DEFAULT_CONFIG);
    get().saveToStorage();
  },
  
  saveToStorage: () => {
    try {
      const config = get().getConfig();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save constants to storage:', error);
    }
  },
  
  loadFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored) as ConfigurableConstants;
        if (get().validateConfig(config)) {
          set(config);
          return true;
        }
      }
    } catch (error) {
      console.warn('Failed to load constants from storage:', error);
    }
    return false;
  },
  
  getConfig: () => {
    const state = get();
    return {
      player: state.player,
      enemy: state.enemy,
      weapon: state.weapon,
      performance: state.performance,
      audio: state.audio,
      visual: state.visual,
    };
  },
  
  validateConfig: (config) => {
    try {
      // Basic validation - ensure required properties exist
      return (
        config.player && typeof config.player.maxHealth === 'number' &&
        config.enemy && typeof config.enemy.maxCount === 'number' &&
        config.weapon && typeof config.weapon.projectileLifespan === 'number' &&
        config.performance && typeof config.performance.enableParticles === 'boolean' &&
        config.audio && typeof config.audio.masterVolume === 'number' &&
        config.visual && typeof config.visual.terrainScale === 'number'
      );
    } catch {
      return false;
    }
  },
}));

// Initialize constants from storage on first load
const loadStoredConstants = () => {
  const success = useConstants.getState().loadFromStorage();
  if (success) {
    console.log('Loaded constants from storage');
  } else {
    console.log('Using default constants configuration');
  }
};

// Auto-detect performance level and apply appropriate preset
export const autoConfigurePerformance = () => {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory || 4;
  const connection = (navigator as any).connection;
  
  let preset: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
  
  // Simple performance detection
  if (cores < 4 || memory < 2) {
    preset = 'LOW';
  } else if (cores < 8 || memory < 4) {
    preset = 'MEDIUM';
  }
  
  // Adjust for slow connections
  if (connection && connection.effectiveType && 
      (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
    preset = 'LOW';
  }
  
  console.log(`Auto-detected performance level: ${preset}`);
  useConstants.getState().applyPerformancePreset(preset);
  
  return preset;
};

// Initialize constants system
export const initializeConstants = () => {
  loadStoredConstants();
  
  // Auto-configure performance on first run if no stored config
  const hasStoredConfig = localStorage.getItem(STORAGE_KEY);
  if (!hasStoredConfig) {
    autoConfigurePerformance();
  }
};

// Convenience selectors
export const selectPlayerConstants = (state: ConstantsStore) => state.player;
export const selectEnemyConstants = (state: ConstantsStore) => state.enemy;
export const selectWeaponConstants = (state: ConstantsStore) => state.weapon;
export const selectPerformanceConstants = (state: ConstantsStore) => state.performance;
export const selectAudioConstants = (state: ConstantsStore) => state.audio;
export const selectVisualConstants = (state: ConstantsStore) => state.visual;