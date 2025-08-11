// Centralized store exports and initialization
export * from './gameStore';
export * from './playerStore';
export * from './weaponStore';
export * from './worldStore';

// Constants store
export * from '../constants/gameConstants';

import { initPlayerStore } from './playerStore';
import { initWeaponStore } from './weaponStore';
import { initWorldStore } from './worldStore';
import { initializeConstants } from '../constants/gameConstants';

// Initialize all stores - call this once at app startup
export const initializeStores = () => {
  initPlayerStore();
  initWeaponStore();
  initWorldStore();
  initializeConstants();
  
  console.log('Zustand stores initialized');
};

// Re-export commonly used selectors for convenience
export {
  selectGameMode,
  selectIsPlaying,
  selectUIState,
  selectSettings,
  selectInputState
} from './gameStore';

export {
  selectPlayerHealth,
  selectPlayerProgress,
  selectPlayerPosition,
  selectPlayerEffects,
  selectPlayerStats
} from './playerStore';

export {
  selectCurrentWeapon,
  selectAnimationState,
  selectWeaponInventory,
  selectActiveProjectiles,
  selectCombatStats,
  selectGestureState
} from './weaponStore';

export {
  selectTerrain,
  selectAtmosphere,
  selectEnemies,
  selectLighting,
  selectWorldObjects
} from './worldStore';