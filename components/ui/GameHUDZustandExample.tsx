/**
 * Example component showing proper integration between existing patterns and Zustand
 * This demonstrates how to gradually migrate from useState hooks to Zustand stores
 */
import React from 'react';
import { usePlayerStateBridge, useGameStateBridge } from '../../hooks/useZustandBridge';
import { usePlayerStore, selectPlayerHealth } from '../../stores';

// Example 1: Using the bridge for backward compatibility
export const GameHUDBridgeExample: React.FC = () => {
  const { playerState, zustand } = usePlayerStateBridge();
  const { isPlaying, settings } = useGameStateBridge();
  
  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      background: 'rgba(0,0,0,0.8)', 
      padding: '10px',
      borderRadius: '5px',
      color: 'white',
      fontSize: '14px',
      fontFamily: 'monospace'
    }}>
      <h4>🔗 Bridge Integration Example</h4>
      
      {/* Uses legacy format - maintains compatibility */}
      <div>Health: {playerState.health}/{playerState.maxHealth}</div>
      <div>Shield: {playerState.shield}</div>
      <div>Score: {playerState.score}</div>
      <div>Game Playing: {isPlaying ? 'Yes' : 'No'}</div>
      
      {/* Uses new Zustand methods */}
      <div>Combat Stats: {zustand.combatStats?.totalHits || 0} hits</div>
      
      {/* Action buttons using both approaches */}
      <div style={{ marginTop: '10px' }}>
        <button 
          onClick={() => zustand.takeDamage(10, 'test')}
          style={{ marginRight: '5px', padding: '2px 6px', fontSize: '12px' }}
        >
          Take Damage (Zustand)
        </button>
        <button 
          onClick={() => zustand.addScore(100)}
          style={{ padding: '2px 6px', fontSize: '12px' }}
        >
          Add Score (Zustand)
        </button>
      </div>
    </div>
  );
};

// Example 2: Pure Zustand approach with optimized selectors
export const GameHUDOptimizedExample: React.FC = () => {
  // Only subscribes to specific health data - optimal performance
  const healthData = usePlayerStore(selectPlayerHealth);
  const addScore = usePlayerStore(state => state.addScore);
  const takeDamage = usePlayerStore(state => state.takeDamage);
  
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 10, 
      right: 10, 
      background: 'rgba(0,100,0,0.8)', 
      padding: '10px',
      borderRadius: '5px',
      color: 'white',
      fontSize: '14px',
      fontFamily: 'monospace'
    }}>
      <h4>⚡ Pure Zustand Example</h4>
      
      {/* Optimal subscriptions - only re-renders when health data changes */}
      <div>Health: {healthData.health}/{healthData.maxHealth}</div>
      <div>Shield: {healthData.shield}</div>
      
      <div style={{ marginTop: '10px' }}>
        <button 
          onClick={() => takeDamage(5, 'test')}
          style={{ marginRight: '5px', padding: '2px 6px', fontSize: '12px' }}
        >
          -5 HP
        </button>
        <button 
          onClick={() => addScore(50)}
          style={{ padding: '2px 6px', fontSize: '12px' }}
        >
          +50 Score
        </button>
      </div>
    </div>
  );
};

// Example 3: Mixed approach - existing hook + Zustand enhancement
export const GameHUDMixedExample: React.FC = () => {
  // Keep using existing hook for main functionality
  const { playerState, zustand } = usePlayerStateBridge();
  
  // Add specific Zustand features where beneficial
  const combatStats = usePlayerStore(state => state.stats);
  
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 10, 
      left: 10, 
      background: 'rgba(100,0,100,0.8)', 
      padding: '10px',
      borderRadius: '5px',
      color: 'white',
      fontSize: '12px',
      fontFamily: 'monospace'
    }}>
      <h4>🔀 Mixed Approach Example</h4>
      
      {/* Existing pattern - no changes needed */}
      <div>Health: {playerState.health}/{playerState.maxHealth}</div>
      <div>Dead: {playerState.isDead ? 'Yes' : 'No'}</div>
      
      {/* Enhanced with Zustand data */}
      <div>Enemies Killed: {combatStats.enemiesKilled}</div>
      <div>Damage Dealt: {combatStats.damageDealt}</div>
      <div>Time Played: {Math.floor(combatStats.timePlayed / 1000)}s</div>
    </div>
  );
};