import React, { useEffect, useState } from 'react';
import { 
  useGameStore, 
  usePlayerStore, 
  useWeaponStore, 
  useWorldStore,
  useConstants,
  initializeStores,
  selectPlayerHealth,
  selectCurrentWeapon,
  selectGameMode
} from '../../stores';

interface TestResult {
  test: string;
  status: 'pending' | 'passed' | 'failed';
  message?: string;
}

const StoreTest: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Test selectors
  const gameMode = useGameStore(selectGameMode);
  const playerHealth = usePlayerStore(selectPlayerHealth);
  const currentWeapon = useWeaponStore(selectCurrentWeapon);
  
  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    const results: TestResult[] = [];
    
    try {
      // Test 1: Store initialization
      results.push({ test: 'Store Initialization', status: 'pending' });
      initializeStores();
      results.push({ test: 'Store Initialization', status: 'passed', message: 'All stores initialized' });
      setTestResults([...results]);
      
      // Test 2: Game Store
      results.push({ test: 'Game Store', status: 'pending' });
      const gameStore = useGameStore.getState();
      gameStore.startGame();
      gameStore.setPerformanceLevel('MEDIUM');
      if (useGameStore.getState().gameMode === 'playing') {
        results[results.length - 1] = { test: 'Game Store', status: 'passed', message: 'Game state management working' };
      }
      setTestResults([...results]);
      
      // Test 3: Player Store
      results.push({ test: 'Player Store', status: 'pending' });
      const playerStore = usePlayerStore.getState();
      const initialHealth = playerStore.health;
      playerStore.takeDamage(10);
      playerStore.addScore(500);
      const afterActions = usePlayerStore.getState();
      if (afterActions.health === initialHealth - 10 && afterActions.score === 500) {
        results[results.length - 1] = { test: 'Player Store', status: 'passed', message: 'Player actions working' };
      }
      setTestResults([...results]);
      
      // Test 4: Weapon Store
      results.push({ test: 'Weapon Store', status: 'pending' });
      const weaponStore = useWeaponStore.getState();
      weaponStore.startCharging();
      weaponStore.recordShot();
      const weaponStats = useWeaponStore.getState().combatStats;
      if (weaponStats.totalShots > 0) {
        results[results.length - 1] = { test: 'Weapon Store', status: 'passed', message: 'Weapon stats tracking working' };
      }
      setTestResults([...results]);
      
      // Test 5: World Store  
      results.push({ test: 'World Store', status: 'pending' });
      const worldStore = useWorldStore.getState();
      worldStore.generateTerrain(12345);
      worldStore.setTimeOfDay(15.5);
      const worldState = useWorldStore.getState();
      if (worldState.terrainGenerated && worldState.timeOfDay === 15.5) {
        results[results.length - 1] = { test: 'World Store', status: 'passed', message: 'World generation working' };
      }
      setTestResults([...results]);
      
      // Test 6: Constants Store
      results.push({ test: 'Constants Store', status: 'pending' });
      const constants = useConstants.getState();
      const initialMaxHealth = constants.player.maxHealth;
      constants.updatePlayerConfig({ maxHealth: initialMaxHealth + 50 });
      if (useConstants.getState().player.maxHealth === initialMaxHealth + 50) {
        results[results.length - 1] = { test: 'Constants Store', status: 'passed', message: 'Runtime configuration working' };
      }
      setTestResults([...results]);
      
      // Test 7: Selectors
      results.push({ test: 'Selectors', status: 'pending' });
      if (gameMode && playerHealth && currentWeapon) {
        results[results.length - 1] = { test: 'Selectors', status: 'passed', message: 'Optimized selectors working' };
      }
      setTestResults([...results]);
      
    } catch (error) {
      results.push({ 
        test: 'Critical Error', 
        status: 'failed', 
        message: `${error}` 
      });
      setTestResults([...results]);
    }
    
    setIsRunning(false);
  };
  
  const passedTests = testResults.filter(r => r.status === 'passed').length;
  const failedTests = testResults.filter(r => r.status === 'failed').length;
  const totalTests = testResults.length;
  
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'monospace', 
      backgroundColor: '#1a1a1a', 
      color: '#fff',
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '400px',
      maxHeight: '80vh',
      overflow: 'auto',
      borderRadius: '8px',
      border: '1px solid #333'
    }}>
      <h3>🔧 Zustand Store Tests</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={runTests} 
          disabled={isRunning}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: isRunning ? '#555' : '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? 'Running Tests...' : 'Run Store Tests'}
        </button>
      </div>
      
      {totalTests > 0 && (
        <div style={{ marginBottom: '15px', fontSize: '14px' }}>
          <div>✅ Passed: {passedTests}</div>
          <div>❌ Failed: {failedTests}</div>
          <div>📊 Total: {totalTests}</div>
        </div>
      )}
      
      <div>
        {testResults.map((result, index) => (
          <div key={index} style={{ 
            marginBottom: '8px',
            padding: '8px',
            backgroundColor: result.status === 'passed' ? '#1a3d1a' : 
                           result.status === 'failed' ? '#3d1a1a' : '#2a2a2a',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <div style={{ fontWeight: 'bold' }}>
              {result.status === 'passed' ? '✅' : 
               result.status === 'failed' ? '❌' : '⏳'} {result.test}
            </div>
            {result.message && (
              <div style={{ color: '#ccc', marginTop: '4px' }}>
                {result.message}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '15px', fontSize: '11px', color: '#888' }}>
        <div>Game Mode: {gameMode}</div>
        <div>Player Health: {playerHealth.health}/{playerHealth.maxHealth}</div>
        <div>Current Weapon: {currentWeapon.name}</div>
      </div>
    </div>
  );
};

export default StoreTest;