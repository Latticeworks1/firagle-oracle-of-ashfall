import { useEffect } from 'react';
import { usePlayerStore, selectPlayerHealth } from '../stores';
import { eventBus } from '../systems/eventBus';

// This hook provides backward compatibility with the existing event bus system
// while leveraging Zustand for state management
export const useZustandPlayerState = () => {
  // Get player state and actions from Zustand
  const playerHealth = usePlayerStore(selectPlayerHealth);
  const takeDamage = usePlayerStore(state => state.takeDamage);
  const addShield = usePlayerStore(state => state.addShield);
  const addScore = usePlayerStore(state => state.addScore);
  const reset = usePlayerStore(state => state.reset);
  
  // Set up event bus listeners to integrate with existing game systems
  useEffect(() => {
    const handleDamage = (payload: { amount: number; source?: string }) => {
      takeDamage(payload.amount, payload.source);
    };
    
    const handleShield = (payload: { amount: number }) => {
      addShield(payload.amount);
    };
    
    const handleScore = (payload: { amount: number }) => {
      addScore(payload.amount);
    };
    
    const handleReset = () => {
      reset();
    };
    
    // Subscribe to events
    eventBus.on('PLAYER_TOOK_DAMAGE', handleDamage);
    eventBus.on('PLAYER_ADD_SHIELD', handleShield);
    eventBus.on('INCREASE_SCORE', handleScore);
    eventBus.on('GAME_RESTARTED', handleReset);
    
    return () => {
      eventBus.off('PLAYER_TOOK_DAMAGE', handleDamage);
      eventBus.off('PLAYER_ADD_SHIELD', handleShield);
      eventBus.off('INCREASE_SCORE', handleScore);
      eventBus.off('GAME_RESTARTED', handleReset);
    };
  }, [takeDamage, addShield, addScore, reset]);
  
  // Return the same interface as the original hook for drop-in replacement
  return {
    playerState: {
      health: playerHealth.health,
      maxHealth: playerHealth.maxHealth,
      shield: playerHealth.shield,
      maxShield: playerHealth.maxShield,
      score: usePlayerStore(state => state.score),
      isDead: playerHealth.isDead,
    },
    resetPlayer: reset
  };
};