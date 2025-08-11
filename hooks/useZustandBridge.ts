/**
 * Bridge hook that allows gradual migration from existing useState hooks to Zustand stores
 * This maintains full backward compatibility while enabling new Zustand functionality
 */
import { useEffect } from 'react';
import { 
  usePlayerStore, 
  useWeaponStore, 
  useGameStore, 
  useWorldStore 
} from '../stores';
import { eventBus } from '../systems/eventBus';
import type { 
  PlayerTookDamagePayload, 
  IncreaseScorePayload, 
  PlayerAddShieldPayload,
  WeaponFiredPayload
} from '../types';

/**
 * Player State Bridge - syncs existing usePlayerState with Zustand playerStore
 */
export const usePlayerStateBridge = () => {
  const playerStore = usePlayerStore();
  
  useEffect(() => {
    // Bridge event bus to Zustand store
    const handleDamage = (payload: PlayerTookDamagePayload) => {
      playerStore.takeDamage(payload.amount, 'event_bus');
    };
    
    const handleScore = (payload: IncreaseScorePayload) => {
      playerStore.addScore(payload.amount);
    };
    
    const handleShield = (payload: PlayerAddShieldPayload) => {
      playerStore.addShield(payload.amount);
    };
    
    // Listen to event bus and update Zustand store
    eventBus.on<PlayerTookDamagePayload>('PLAYER_TOOK_DAMAGE', handleDamage);
    eventBus.on<IncreaseScorePayload>('INCREASE_SCORE', handleScore);
    eventBus.on<PlayerAddShieldPayload>('PLAYER_ADD_SHIELD', handleShield);
    
    return () => {
      eventBus.off<PlayerTookDamagePayload>('PLAYER_TOOK_DAMAGE', handleDamage);
      eventBus.off<IncreaseScorePayload>('INCREASE_SCORE', handleScore);
      eventBus.off<PlayerAddShieldPayload>('PLAYER_ADD_SHIELD', handleShield);
    };
  }, [playerStore]);
  
  // Return both legacy format AND Zustand store methods
  return {
    // Legacy format (maintains compatibility with existing components)
    playerState: {
      health: playerStore.health,
      maxHealth: playerStore.maxHealth,
      shield: playerStore.shield,
      maxShield: playerStore.maxShield,
      score: playerStore.score,
      isDead: playerStore.isDead
    },
    resetPlayer: playerStore.resetPlayer,
    
    // New Zustand methods (for components that want to use them)
    zustand: {
      takeDamage: playerStore.takeDamage,
      addScore: playerStore.addScore,
      addShield: playerStore.addShield,
      heal: playerStore.heal,
      store: playerStore
    }
  };
};

/**
 * Weapon State Bridge - syncs animation state management with Zustand weaponStore
 */
export const useWeaponStateBridge = (weaponStats: any) => {
  const weaponStore = useWeaponStore();
  
  useEffect(() => {
    // Sync weapon stats when they change
    weaponStore.updateWeaponStats(weaponStats);
  }, [weaponStats, weaponStore]);
  
  useEffect(() => {
    // Bridge weapon fired events
    const handleWeaponFired = (payload: WeaponFiredPayload) => {
      weaponStore.recordShot();
      // Add projectile to store if needed
    };
    
    eventBus.on<WeaponFiredPayload>('WEAPON_FIRED', handleWeaponFired);
    
    return () => {
      eventBus.off<WeaponFiredPayload>('WEAPON_FIRED', handleWeaponFired);
    };
  }, [weaponStore]);
  
  // Return legacy animation state format AND Zustand methods
  return {
    // Legacy format (maintains compatibility)
    animationState: weaponStore.animationState,
    startCharging: weaponStore.startCharging,
    fire: weaponStore.fire,
    resetState: weaponStore.resetState,
    
    // New Zustand methods
    zustand: {
      combatStats: weaponStore.combatStats,
      projectiles: weaponStore.projectiles,
      recordHit: weaponStore.recordHit,
      store: weaponStore
    }
  };
};

/**
 * Game State Bridge - provides unified access to game flow state
 */
export const useGameStateBridge = () => {
  const gameStore = useGameStore();
  
  // Return unified interface
  return {
    // Game flow control
    gameMode: gameStore.gameMode,
    isPlaying: gameStore.gameMode === 'playing',
    startGame: gameStore.startGame,
    pauseGame: gameStore.pauseGame,
    endGame: gameStore.endGame,
    
    // UI state
    showInventory: gameStore.showInventory,
    showLoreModal: gameStore.showLoreModal,
    toggleInventory: gameStore.toggleInventory,
    toggleLoreModal: gameStore.toggleLoreModal,
    
    // Settings and device detection
    settings: gameStore.settings,
    isTouchDevice: gameStore.isTouchDevice,
    
    // Zustand store access
    store: gameStore
  };
};

/**
 * Complete State Bridge - provides access to all stores with proper synchronization
 */
export const useCompleteBridge = () => {
  const playerBridge = usePlayerStateBridge();
  const gameBridge = useGameStateBridge();
  const worldStore = useWorldStore();
  
  return {
    player: playerBridge,
    game: gameBridge,
    world: {
      terrainGenerated: worldStore.terrainGenerated,
      generateTerrain: worldStore.generateTerrain,
      timeOfDay: worldStore.timeOfDay,
      setTimeOfDay: worldStore.setTimeOfDay,
      enemies: worldStore.enemies,
      store: worldStore
    }
  };
};