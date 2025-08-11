import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  useGameStore, 
  usePlayerStore, 
  useWeaponStore, 
  useWorldStore,
  useConstants
} from '../../stores';

interface TestLog {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

const ZustandGameTest: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);
  
  // Use simple selectors to avoid infinite loops
  const gameMode = useGameStore(state => state.gameMode);
  const playerHealth = usePlayerStore(state => state.health);
  const playerMaxHealth = usePlayerStore(state => state.maxHealth);
  const playerShield = usePlayerStore(state => state.shield);
  const currentWeapon = useWeaponStore(state => state.currentWeapon);
  const terrainGenerated = useWorldStore(state => state.terrainGenerated);
  
  // Memoize display values to prevent unnecessary re-renders
  const displayValues = useMemo(() => ({
    gameMode,
    health: playerHealth,
    maxHealth: playerMaxHealth,
    shield: playerShield,
    weaponName: currentWeapon?.name || 'Unknown',
    terrainGenerated
  }), [gameMode, playerHealth, playerMaxHealth, playerShield, currentWeapon?.name, terrainGenerated]);
  
  const addLog = useCallback((message: string, type: TestLog['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-9), {
      timestamp: Date.now(),
      message,
      type
    }]);
  }, []);
  
  const testGameStore = useCallback(() => {
    try {
      const store = useGameStore.getState();
      addLog(`Game mode: ${store.gameMode}`, 'info');
      
      store.startGame();
      addLog(`Started game - new mode: ${useGameStore.getState().gameMode}`, 'success');
      
      store.toggleInventory();
      const inventoryOpen = useGameStore.getState().showInventory;
      addLog(`Toggled inventory: ${inventoryOpen}`, inventoryOpen ? 'success' : 'info');
      
    } catch (error) {
      addLog(`❌ Game store test failed: ${error}`, 'error');
    }
  }, [addLog]);
  
  const testPlayerStore = useCallback(() => {
    try {
      const store = usePlayerStore.getState();
      const initialHealth = store.health;
      addLog(`Initial health: ${initialHealth}`, 'info');
      
      store.takeDamage(15, 'test_damage');
      const newHealth = usePlayerStore.getState().health;
      addLog(`After 15 damage: ${newHealth} (${initialHealth - newHealth} damage taken)`, 'success');
      
      store.addScore(500);
      const score = usePlayerStore.getState().score;
      addLog(`Added 500 score, total: ${score}`, 'success');
      
      store.addShield(25);
      const shield = usePlayerStore.getState().shield;
      addLog(`Added shield: ${shield}`, 'success');
      
    } catch (error) {
      addLog(`❌ Player store test failed: ${error}`, 'error');
    }
  }, [addLog]);
  
  const testWeaponStore = useCallback(() => {
    try {
      const store = useWeaponStore.getState();
      addLog(`Current weapon: ${store.currentWeapon.name}`, 'info');
      addLog(`Animation state: ${store.animationState}`, 'info');
      
      store.startCharging();
      const chargingState = useWeaponStore.getState().animationState;
      addLog(`Started charging - state: ${chargingState}`, 'success');
      
      // Test combat stats
      store.recordShot();
      store.recordHit(50, true);
      const stats = useWeaponStore.getState().combatStats;
      addLog(`Combat: ${stats.totalShots} shots, ${stats.totalHits} hits, ${stats.accuracy.toFixed(1)}% accuracy`, 'success');
      
    } catch (error) {
      addLog(`❌ Weapon store test failed: ${error}`, 'error');
    }
  }, [addLog]);
  
  const testWorldStore = useCallback(() => {
    try {
      const store = useWorldStore.getState();
      addLog(`Terrain generated: ${store.terrainGenerated}`, 'info');
      
      if (!store.terrainGenerated) {
        store.generateTerrain(99999);
        const generated = useWorldStore.getState().terrainGenerated;
        addLog(`Generated terrain: ${generated}`, generated ? 'success' : 'error');
      }
      
      store.setTimeOfDay(14.5);
      store.setWeather('storm');
      const timeAndWeather = useWorldStore.getState();
      addLog(`Time: ${timeAndWeather.timeOfDay}h, Weather: ${timeAndWeather.weatherType}`, 'success');
      
    } catch (error) {
      addLog(`❌ World store test failed: ${error}`, 'error');
    }
  }, [addLog]);
  
  const testConstants = useCallback(() => {
    try {
      const store = useConstants.getState();
      const initialMaxHealth = store.player.maxHealth;
      addLog(`Initial max health: ${initialMaxHealth}`, 'info');
      
      store.updatePlayerConfig({ maxHealth: initialMaxHealth + 25 });
      const newMaxHealth = useConstants.getState().player.maxHealth;
      addLog(`Updated max health: ${newMaxHealth}`, newMaxHealth !== initialMaxHealth ? 'success' : 'error');
      
      store.applyPerformancePreset('MEDIUM');
      const renderDistance = useConstants.getState().performance.renderDistance;
      addLog(`Applied MEDIUM preset, render distance: ${renderDistance}`, 'success');
      
    } catch (error) {
      addLog(`❌ Constants test failed: ${error}`, 'error');
    }
  }, [addLog]);
  
  const runAllTests = useCallback(() => {
    addLog('=== Starting Zustand Integration Tests ===', 'info');
    
    // Run tests with delays to see state changes
    setTimeout(() => testGameStore(), 50);
    setTimeout(() => testPlayerStore(), 150);
    setTimeout(() => testWeaponStore(), 250);
    setTimeout(() => testWorldStore(), 350);
    setTimeout(() => testConstants(), 450);
    setTimeout(() => addLog('=== All tests completed ===', 'success'), 600);
  }, [addLog, testGameStore, testPlayerStore, testWeaponStore, testWorldStore, testConstants]);
  
  // Remove auto-initialization - stores should already be initialized
  
  // Keyboard shortcut to toggle visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.key === '`')) {
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  if (!isVisible) {
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        Press F12 to show Zustand tests
      </div>
    );
  }
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      width: '500px',
      maxHeight: '80vh',
      backgroundColor: 'rgba(0,0,0,0.95)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '11px',
      fontFamily: 'monospace',
      zIndex: 10000,
      overflow: 'auto',
      border: '1px solid #333'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>🧪 Zustand Live Test</h3>
        <button 
          onClick={() => setIsVisible(false)}
          style={{ 
            background: '#666', 
            border: 'none', 
            color: 'white', 
            padding: '2px 6px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={runAllTests}
          style={{
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            marginRight: '8px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Run All Tests
        </button>
        
        <button 
          onClick={() => setLogs([])}
          style={{
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Clear Logs
        </button>
      </div>
      
      {/* Live State Display */}
      <div style={{ 
        backgroundColor: 'rgba(255,255,255,0.1)', 
        padding: '8px', 
        borderRadius: '4px',
        marginBottom: '10px'
      }}>
        <div><strong>Live State:</strong></div>
        <div>Game Mode: {displayValues.gameMode}</div>
        <div>Health: {displayValues.health}/{displayValues.maxHealth}</div>
        <div>Shield: {displayValues.shield}</div>
        <div>Weapon: {displayValues.weaponName}</div>
        <div>Terrain: {displayValues.terrainGenerated ? 'Generated' : 'Not Generated'}</div>
      </div>
      
      {/* Test Logs */}
      <div style={{ 
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: '8px',
        borderRadius: '4px',
        maxHeight: '300px',
        overflow: 'auto'
      }}>
        <div><strong>Test Logs:</strong></div>
        {logs.length === 0 ? (
          <div style={{ color: '#888', fontStyle: 'italic' }}>No logs yet...</div>
        ) : (
          logs.map((log, index) => (
            <div 
              key={index}
              style={{ 
                color: log.type === 'success' ? '#4CAF50' : 
                       log.type === 'error' ? '#f44336' : '#fff',
                marginBottom: '2px',
                wordBreak: 'break-word'
              }}
            >
              [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
            </div>
          ))
        )}
      </div>
      
      <div style={{ 
        marginTop: '10px', 
        fontSize: '10px', 
        color: '#888',
        borderTop: '1px solid #333',
        paddingTop: '8px'
      }}>
        Press F12 to toggle • Tests run automatically in live game environment
      </div>
    </div>
  );
};

export default ZustandGameTest;