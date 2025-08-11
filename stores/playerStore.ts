import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Vector3 } from 'three';
import { eventBus } from '../systems/eventBus';
import { PLAYER_MAX_HEALTH } from '../constants';

export interface PlayerState {
  // Core stats
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  isDead: boolean;
  
  // Position & movement
  position: Vector3 | null;
  velocity: Vector3 | null;
  rotation: { x: number; y: number; z: number };
  isMoving: boolean;
  
  // Status effects
  statusEffects: Array<{
    id: string;
    type: 'shield' | 'damage_boost' | 'speed_boost' | 'invulnerability';
    duration: number;
    startTime: number;
    intensity: number;
  }>;
  
  // Experience & progression
  experience: number;
  level: number;
  skillPoints: number;
  
  // Statistics
  stats: {
    enemiesKilled: number;
    damageDealt: number;
    damageTaken: number;
    spellsCast: number;
    timePlayed: number;
    highestScore: number;
  };
}

interface PlayerActions {
  // Health & damage
  takeDamage: (amount: number, source?: string) => void;
  heal: (amount: number) => void;
  addShield: (amount: number, maxAmount?: number) => void;
  removeShield: (amount: number) => void;
  
  // Score & progression
  addScore: (points: number) => void;
  addExperience: (xp: number) => void;
  levelUp: () => void;
  spendSkillPoint: (skillId: string) => boolean;
  
  // Position & movement
  updatePosition: (position: Vector3) => void;
  updateVelocity: (velocity: Vector3) => void;
  updateRotation: (rotation: { x: number; y: number; z: number }) => void;
  setMoving: (isMoving: boolean) => void;
  
  // Status effects
  addStatusEffect: (effect: {
    type: 'shield' | 'damage_boost' | 'speed_boost' | 'invulnerability';
    duration: number;
    intensity: number;
  }) => string;
  removeStatusEffect: (id: string) => void;
  updateStatusEffects: () => void;
  
  // Statistics
  incrementStat: (stat: keyof PlayerState['stats'], amount?: number) => void;
  
  // Player lifecycle
  respawn: () => void;
  reset: () => void;
}

type PlayerStore = PlayerState & PlayerActions;

const initialPlayerState: PlayerState = {
  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  shield: 0,
  maxShield: 100,
  score: 0,
  isDead: false,
  
  position: null,
  velocity: null,
  rotation: { x: 0, y: 0, z: 0 },
  isMoving: false,
  
  statusEffects: [],
  
  experience: 0,
  level: 1,
  skillPoints: 0,
  
  stats: {
    enemiesKilled: 0,
    damageDealt: 0,
    damageTaken: 0,
    spellsCast: 0,
    timePlayed: 0,
    highestScore: 0,
  },
};

export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialPlayerState,
    
    // Health & damage actions
    takeDamage: (amount: number, source?: string) => {
      const state = get();
      if (state.isDead) return;
      
      // Check for invulnerability
      const invulnerability = state.statusEffects.find(e => e.type === 'invulnerability');
      if (invulnerability) return;
      
      let damageLeft = amount;
      let newShield = state.shield;
      
      // Shield absorbs damage first
      if (state.shield > 0) {
        const shieldDamage = Math.min(damageLeft, state.shield);
        newShield -= shieldDamage;
        damageLeft -= shieldDamage;
      }
      
      const newHealth = Math.max(0, state.health - damageLeft);
      const isDead = newHealth <= 0;
      
      set({
        health: newHealth,
        shield: newShield,
        isDead,
        stats: {
          ...state.stats,
          damageTaken: state.stats.damageTaken + amount
        }
      });
      
      // REMOVED: Event bus dispatches cause infinite loops with bridge hooks
      // The event bus should dispatch TO stores, not FROM stores
    },
    
    heal: (amount: number) => {
      set(state => ({
        health: Math.min(state.maxHealth, state.health + amount)
      }));
      // REMOVED: eventBus.dispatch('PLAYER_HEALED', { amount });
    },
    
    addShield: (amount: number, maxAmount?: number) => {
      set(state => {
        const newMaxShield = maxAmount || Math.max(state.maxShield, amount);
        return {
          shield: Math.min(newMaxShield, amount),
          maxShield: newMaxShield
        };
      });
      // REMOVED: eventBus.dispatch('PLAYER_SHIELD_ADDED', { amount });
    },
    
    removeShield: (amount: number) => {
      set(state => ({
        shield: Math.max(0, state.shield - amount)
      }));
    },
    
    // Score & progression actions
    addScore: (points: number) => {
      set(state => {
        const newScore = state.score + points;
        const newHighestScore = Math.max(state.stats.highestScore, newScore);
        
        return {
          score: newScore,
          stats: {
            ...state.stats,
            highestScore: newHighestScore
          }
        };
      });
      // REMOVED: eventBus.dispatch('SCORE_INCREASED', { points, newScore: get().score });
    },
    
    addExperience: (xp: number) => {
      set(state => {
        const newExperience = state.experience + xp;
        const xpForNextLevel = state.level * 100; // Simple XP formula
        
        if (newExperience >= xpForNextLevel) {
          return {
            experience: newExperience - xpForNextLevel,
            level: state.level + 1,
            skillPoints: state.skillPoints + 1
          };
        }
        
        return { experience: newExperience };
      });
    },
    
    levelUp: () => {
      set(state => ({
        level: state.level + 1,
        skillPoints: state.skillPoints + 1,
        maxHealth: state.maxHealth + 10,
        health: state.health + 10
      }));
      // REMOVED: eventBus.dispatch('PLAYER_LEVEL_UP', { newLevel: get().level });
    },
    
    spendSkillPoint: (skillId: string) => {
      const state = get();
      if (state.skillPoints <= 0) return false;
      
      set({ skillPoints: state.skillPoints - 1 });
      // REMOVED: eventBus.dispatch('SKILL_LEARNED', { skillId });
      return true;
    },
    
    // Position & movement actions
    updatePosition: (position: Vector3) => {
      set({ position: position.clone() });
    },
    
    updateVelocity: (velocity: Vector3) => {
      set({ velocity: velocity.clone() });
    },
    
    updateRotation: (rotation: { x: number; y: number; z: number }) => {
      set({ rotation: { ...rotation } });
    },
    
    setMoving: (isMoving: boolean) => {
      set({ isMoving });
    },
    
    // Status effects actions
    addStatusEffect: (effect) => {
      const id = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newEffect = {
        ...effect,
        id,
        startTime: Date.now()
      };
      
      set(state => ({
        statusEffects: [...state.statusEffects, newEffect]
      }));
      
      // REMOVED: eventBus.dispatch('STATUS_EFFECT_APPLIED', { effect: newEffect });
      return id;
    },
    
    removeStatusEffect: (id: string) => {
      set(state => ({
        statusEffects: state.statusEffects.filter(effect => effect.id !== id)
      }));
      // REMOVED: eventBus.dispatch('STATUS_EFFECT_REMOVED', { effectId: id });
    },
    
    updateStatusEffects: () => {
      const now = Date.now();
      set(state => {
        const activeEffects = state.statusEffects.filter(effect => {
          const elapsed = now - effect.startTime;
          return elapsed < effect.duration;
        });
        
        // Dispatch events for expired effects
        const expiredEffects = state.statusEffects.filter(effect => {
          const elapsed = now - effect.startTime;
          return elapsed >= effect.duration;
        });
        
        // REMOVED: Event dispatches for expired effects
        // expiredEffects.forEach(effect => {
        //   eventBus.dispatch('STATUS_EFFECT_EXPIRED', { effect });
        // });
        
        return { statusEffects: activeEffects };
      });
    },
    
    // Statistics actions
    incrementStat: (stat: keyof PlayerState['stats'], amount = 1) => {
      set(state => ({
        stats: {
          ...state.stats,
          [stat]: state.stats[stat] + amount
        }
      }));
    },
    
    // Player lifecycle actions
    respawn: () => {
      const state = get();
      set({
        health: state.maxHealth,
        shield: 0,
        isDead: false,
        statusEffects: [],
        position: null,
        velocity: null,
        isMoving: false
      });
      // REMOVED: eventBus.dispatch('PLAYER_RESPAWNED', {});
    },
    
    reset: () => {
      set({ ...initialPlayerState });
      // REMOVED: eventBus.dispatch('PLAYER_RESET', {});
    }
  }))
);

// Selectors for optimized subscriptions
export const selectPlayerHealth = (state: PlayerStore) => ({
  health: state.health,
  maxHealth: state.maxHealth,
  shield: state.shield,
  maxShield: state.maxShield,
  isDead: state.isDead
});

export const selectPlayerProgress = (state: PlayerStore) => ({
  score: state.score,
  experience: state.experience,
  level: state.level,
  skillPoints: state.skillPoints
});

export const selectPlayerPosition = (state: PlayerStore) => ({
  position: state.position,
  velocity: state.velocity,
  rotation: state.rotation,
  isMoving: state.isMoving
});

export const selectPlayerEffects = (state: PlayerStore) => state.statusEffects;
export const selectPlayerStats = (state: PlayerStore) => state.stats;

// Set up event bus listeners for automatic state updates
let statusEffectInterval: ReturnType<typeof setInterval> | null = null;

// Auto-update status effects every second
export const initPlayerStore = () => {
  if (statusEffectInterval) return;
  
  statusEffectInterval = setInterval(() => {
    usePlayerStore.getState().updateStatusEffects();
  }, 1000);
  
  // Listen for game events
  eventBus.on('ENEMY_KILLED', () => {
    usePlayerStore.getState().incrementStat('enemiesKilled');
    usePlayerStore.getState().addExperience(10);
  });
  
  eventBus.on('SPELL_CAST', () => {
    usePlayerStore.getState().incrementStat('spellsCast');
  });
  
  eventBus.on('DAMAGE_DEALT', (payload: { amount: number }) => {
    usePlayerStore.getState().incrementStat('damageDealt', payload.amount);
  });
};