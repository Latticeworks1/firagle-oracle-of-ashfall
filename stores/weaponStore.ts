import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Vector3 } from 'three';
import { AnimationState, type WeaponSchema, type Projectile } from '../types';
import { WEAPONS_DATA } from '../data/weapons';
import { eventBus } from '../systems/eventBus';

export interface WeaponState {
  // Current weapon
  currentWeapon: WeaponSchema;
  weaponInventory: WeaponSchema[];
  
  // Animation & timing
  animationState: AnimationState;
  chargeStartTime: number;
  lastFireTime: number;
  
  // Active projectiles & effects
  activeProjectiles: Map<string, {
    projectile: Projectile;
    createdAt: number;
    lifespan: number;
  }>;
  
  // Weapon stats & modifiers
  damageMultiplier: number;
  speedMultiplier: number;
  cooldownReduction: number;
  
  // Gesture system
  isGestureMode: boolean;
  currentGesture: { x: number; y: number }[];
  gestureRecognized: string | null;
  
  // Combat statistics
  combatStats: {
    totalShots: number;
    totalHits: number;
    totalDamage: number;
    criticalHits: number;
    accuracy: number;
  };
}

interface WeaponActions {
  // Weapon management
  switchWeapon: (weaponId: string) => boolean;
  addWeapon: (weapon: WeaponSchema) => void;
  removeWeapon: (weaponId: string) => void;
  
  // Animation state management
  startCharging: () => void;
  stopCharging: () => void;
  fire: () => void;
  forceState: (state: AnimationState) => void;
  
  // Projectile management
  addProjectile: (projectile: Projectile, lifespan?: number) => void;
  removeProjectile: (projectileId: string) => void;
  updateProjectiles: () => void;
  getActiveProjectiles: () => Projectile[];
  
  // Weapon modifiers
  setDamageMultiplier: (multiplier: number) => void;
  setSpeedMultiplier: (multiplier: number) => void;
  setCooldownReduction: (reduction: number) => void;
  resetModifiers: () => void;
  
  // Gesture system
  enableGestureMode: () => void;
  disableGestureMode: () => void;
  addGesturePoint: (point: { x: number; y: number }) => void;
  clearGesture: () => void;
  recognizeGesture: () => string | null;
  
  // Combat tracking
  recordShot: () => void;
  recordHit: (damage: number, isCritical?: boolean) => void;
  updateAccuracy: () => void;
  
  // Utility
  canFire: () => boolean;
  getChargeProgress: () => number;
  getCurrentDamage: () => number;
  reset: () => void;
}

type WeaponStore = WeaponState & WeaponActions;

const initialWeaponState: WeaponState = {
  currentWeapon: WEAPONS_DATA[0], // Default to first weapon (Firagle)
  weaponInventory: [...WEAPONS_DATA],
  
  animationState: AnimationState.Idle,
  chargeStartTime: 0,
  lastFireTime: 0,
  
  activeProjectiles: new Map(),
  
  damageMultiplier: 1.0,
  speedMultiplier: 1.0,
  cooldownReduction: 0.0,
  
  isGestureMode: false,
  currentGesture: [],
  gestureRecognized: null,
  
  combatStats: {
    totalShots: 0,
    totalHits: 0,
    totalDamage: 0,
    criticalHits: 0,
    accuracy: 0,
  },
};

export const useWeaponStore = create<WeaponStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialWeaponState,
    
    // Weapon management actions
    switchWeapon: (weaponId: string) => {
      const state = get();
      const weapon = state.weaponInventory.find(w => w.id === weaponId);
      
      if (!weapon) return false;
      if (state.animationState !== AnimationState.Idle) return false;
      
      set({ currentWeapon: weapon });
      eventBus.dispatch('WEAPON_SWITCHED', { 
        previousWeapon: state.currentWeapon.id, 
        newWeapon: weaponId 
      });
      return true;
    },
    
    addWeapon: (weapon: WeaponSchema) => {
      set(state => {
        const exists = state.weaponInventory.some(w => w.id === weapon.id);
        if (exists) return state;
        
        return {
          weaponInventory: [...state.weaponInventory, weapon]
        };
      });
      eventBus.dispatch('WEAPON_ACQUIRED', { weapon });
    },
    
    removeWeapon: (weaponId: string) => {
      set(state => {
        const newInventory = state.weaponInventory.filter(w => w.id !== weaponId);
        let newCurrentWeapon = state.currentWeapon;
        
        // If removing current weapon, switch to first available
        if (state.currentWeapon.id === weaponId && newInventory.length > 0) {
          newCurrentWeapon = newInventory[0];
        }
        
        return {
          weaponInventory: newInventory,
          currentWeapon: newCurrentWeapon
        };
      });
    },
    
    // Animation state management
    startCharging: () => {
      const state = get();
      if (state.animationState !== AnimationState.Idle) return;
      
      set({ 
        animationState: AnimationState.Charging,
        chargeStartTime: Date.now()
      });
      
      eventBus.dispatch('WEAPON_CHARGE_START', { 
        weaponId: state.currentWeapon.id 
      });
      
      // Auto-transition to charged after charge duration
      setTimeout(() => {
        const currentState = get();
        if (currentState.animationState === AnimationState.Charging) {
          set({ animationState: AnimationState.Charged });
          eventBus.dispatch('WEAPON_CHARGED', { 
            weaponId: currentState.currentWeapon.id 
          });
        }
      }, state.currentWeapon.stats.chargeDuration);
    },
    
    stopCharging: () => {
      const state = get();
      if (state.animationState === AnimationState.Charging) {
        set({ 
          animationState: AnimationState.Idle,
          chargeStartTime: 0
        });
        eventBus.dispatch('WEAPON_CHARGE_CANCELLED', { 
          weaponId: state.currentWeapon.id 
        });
      }
    },
    
    fire: () => {
      const state = get();
      if (!get().canFire()) return;
      
      const now = Date.now();
      set({ 
        animationState: AnimationState.Discharging,
        lastFireTime: now,
        chargeStartTime: 0
      });
      
      get().recordShot();
      
      eventBus.dispatch('WEAPON_FIRED', { 
        weaponId: state.currentWeapon.id,
        chargeTime: now - state.chargeStartTime,
        damage: get().getCurrentDamage()
      });
      
      // Handle discharge -> decay -> idle transition
      setTimeout(() => {
        set({ animationState: AnimationState.Decay });
        setTimeout(() => {
          set({ animationState: AnimationState.Idle });
        }, state.currentWeapon.stats.decayDuration);
      }, state.currentWeapon.stats.dischargePeakDuration);
    },
    
    forceState: (state: AnimationState) => {
      set({ animationState: state });
    },
    
    // Projectile management
    addProjectile: (projectile: Projectile, lifespan = 3000) => {
      set(state => {
        const newProjectiles = new Map(state.activeProjectiles);
        newProjectiles.set(projectile.id, {
          projectile,
          createdAt: Date.now(),
          lifespan
        });
        return { activeProjectiles: newProjectiles };
      });
    },
    
    removeProjectile: (projectileId: string) => {
      set(state => {
        const newProjectiles = new Map(state.activeProjectiles);
        newProjectiles.delete(projectileId);
        return { activeProjectiles: newProjectiles };
      });
    },
    
    updateProjectiles: () => {
      const now = Date.now();
      set(state => {
        const newProjectiles = new Map();
        const expiredIds: string[] = [];
        
        state.activeProjectiles.forEach((data, id) => {
          if (now - data.createdAt < data.lifespan) {
            newProjectiles.set(id, data);
          } else {
            expiredIds.push(id);
          }
        });
        
        // Dispatch events for expired projectiles
        expiredIds.forEach(id => {
          eventBus.dispatch('PROJECTILE_EXPIRED', { projectileId: id });
        });
        
        return { activeProjectiles: newProjectiles };
      });
    },
    
    getActiveProjectiles: () => {
      const state = get();
      return Array.from(state.activeProjectiles.values()).map(data => data.projectile);
    },
    
    // Weapon modifiers
    setDamageMultiplier: (multiplier: number) => {
      set({ damageMultiplier: Math.max(0, multiplier) });
    },
    
    setSpeedMultiplier: (multiplier: number) => {
      set({ speedMultiplier: Math.max(0, multiplier) });
    },
    
    setCooldownReduction: (reduction: number) => {
      set({ cooldownReduction: Math.max(0, Math.min(1, reduction)) });
    },
    
    resetModifiers: () => {
      set({ 
        damageMultiplier: 1.0,
        speedMultiplier: 1.0,
        cooldownReduction: 0.0
      });
    },
    
    // Gesture system
    enableGestureMode: () => {
      set({ 
        isGestureMode: true,
        currentGesture: [],
        gestureRecognized: null
      });
    },
    
    disableGestureMode: () => {
      set({ 
        isGestureMode: false,
        currentGesture: [],
        gestureRecognized: null
      });
    },
    
    addGesturePoint: (point: { x: number; y: number }) => {
      set(state => ({
        currentGesture: [...state.currentGesture, point]
      }));
    },
    
    clearGesture: () => {
      set({ 
        currentGesture: [],
        gestureRecognized: null
      });
    },
    
    recognizeGesture: () => {
      const state = get();
      // This would integrate with your gesture recognition system
      // For now, return null as placeholder
      const recognized = null; // recognizeGesturePattern(state.currentGesture);
      set({ gestureRecognized: recognized });
      return recognized;
    },
    
    // Combat tracking
    recordShot: () => {
      set(state => ({
        combatStats: {
          ...state.combatStats,
          totalShots: state.combatStats.totalShots + 1
        }
      }));
      get().updateAccuracy();
    },
    
    recordHit: (damage: number, isCritical = false) => {
      set(state => ({
        combatStats: {
          ...state.combatStats,
          totalHits: state.combatStats.totalHits + 1,
          totalDamage: state.combatStats.totalDamage + damage,
          criticalHits: state.combatStats.criticalHits + (isCritical ? 1 : 0)
        }
      }));
      get().updateAccuracy();
    },
    
    updateAccuracy: () => {
      set(state => {
        const accuracy = state.combatStats.totalShots > 0 
          ? (state.combatStats.totalHits / state.combatStats.totalShots) * 100 
          : 0;
        return {
          combatStats: {
            ...state.combatStats,
            accuracy: Math.round(accuracy * 100) / 100
          }
        };
      });
    },
    
    // Utility functions
    canFire: () => {
      const state = get();
      const now = Date.now();
      const timeSinceLastFire = now - state.lastFireTime;
      const minCooldown = 100; // Minimum 100ms between shots
      
      return (
        (state.animationState === AnimationState.Charged || 
         state.animationState === AnimationState.Charging) &&
        timeSinceLastFire >= minCooldown
      );
    },
    
    getChargeProgress: () => {
      const state = get();
      if (state.animationState !== AnimationState.Charging) return 0;
      
      const elapsed = Date.now() - state.chargeStartTime;
      const chargeDuration = state.currentWeapon.stats.chargeDuration;
      return Math.min(1, elapsed / chargeDuration);
    },
    
    getCurrentDamage: () => {
      const state = get();
      let baseDamage = 0;
      
      if (state.currentWeapon.type === 'projectile') {
        baseDamage = state.currentWeapon.stats.damage;
      } else if (state.currentWeapon.type === 'hitscan-chain') {
        baseDamage = state.currentWeapon.stats.damage;
      }
      
      return Math.round(baseDamage * state.damageMultiplier);
    },
    
    reset: () => {
      set({ 
        ...initialWeaponState,
        weaponInventory: get().weaponInventory, // Keep unlocked weapons
        currentWeapon: get().currentWeapon
      });
    }
  }))
);

// Selectors for optimized subscriptions
export const selectCurrentWeapon = (state: WeaponStore) => state.currentWeapon;
export const selectAnimationState = (state: WeaponStore) => ({
  state: state.animationState,
  chargeProgress: state.getChargeProgress(),
  canFire: state.canFire()
});
export const selectWeaponInventory = (state: WeaponStore) => state.weaponInventory;
export const selectActiveProjectiles = (state: WeaponStore) => state.getActiveProjectiles();
export const selectCombatStats = (state: WeaponStore) => state.combatStats;
export const selectGestureState = (state: WeaponStore) => ({
  isGestureMode: state.isGestureMode,
  currentGesture: state.currentGesture,
  gestureRecognized: state.gestureRecognized
});

// Auto-update projectiles every frame
let projectileUpdateInterval: ReturnType<typeof setInterval> | null = null;

export const initWeaponStore = () => {
  if (projectileUpdateInterval) return;
  
  projectileUpdateInterval = setInterval(() => {
    useWeaponStore.getState().updateProjectiles();
  }, 16); // ~60fps updates
  
  // Listen for hit events to update combat stats
  eventBus.on('PROJECTILE_HIT', (payload: { damage: number; isCritical?: boolean }) => {
    useWeaponStore.getState().recordHit(payload.damage, payload.isCritical);
  });
};