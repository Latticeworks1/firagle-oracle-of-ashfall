// Quick test to verify store integration
import { 
  useGameStore, 
  usePlayerStore, 
  useWeaponStore, 
  useWorldStore, 
  useConstants,
  initializeStores 
} from './stores/index.js';

// Test function
const testStores = () => {
  console.log('🧪 Testing Zustand Stores...\n');
  
  // Initialize stores
  initializeStores();
  
  // Test Game Store
  console.log('🎮 Game Store Test:');
  const gameState = useGameStore.getState();
  console.log('- Initial game mode:', gameState.gameMode);
  gameState.startGame();
  console.log('- After start game:', useGameStore.getState().gameMode);
  
  // Test Player Store
  console.log('\n👤 Player Store Test:');
  const playerState = usePlayerStore.getState();
  console.log('- Initial health:', playerState.health);
  playerState.takeDamage(25);
  console.log('- After taking 25 damage:', usePlayerStore.getState().health);
  playerState.addScore(500);
  console.log('- After adding 500 score:', usePlayerStore.getState().score);
  
  // Test Weapon Store
  console.log('\n⚔️ Weapon Store Test:');
  const weaponState = useWeaponStore.getState();
  console.log('- Current weapon:', weaponState.currentWeapon.name);
  console.log('- Animation state:', weaponState.animationState);
  weaponState.startCharging();
  console.log('- After start charging:', useWeaponStore.getState().animationState);
  
  // Test World Store
  console.log('\n🌍 World Store Test:');
  const worldState = useWorldStore.getState();
  console.log('- Terrain generated:', worldState.terrainGenerated);
  worldState.generateTerrain(12345);
  console.log('- After generation:', useWorldStore.getState().terrainGenerated);
  console.log('- Terrain seed:', useWorldStore.getState().terrainSeed);
  
  // Test Constants
  console.log('\n⚙️ Constants Test:');
  const constants = useConstants.getState();
  console.log('- Player max health:', constants.player.maxHealth);
  console.log('- Enemy spawn rate:', constants.enemy.spawnInterval);
  constants.updatePlayerConfig({ maxHealth: 150 });
  console.log('- After updating:', useConstants.getState().player.maxHealth);
  
  console.log('\n✅ All stores working correctly!');
};

// Only run if this is the main module
if (typeof window !== 'undefined') {
  // Browser environment
  window.testStores = testStores;
  console.log('Run testStores() in the browser console to test');
} else {
  // Node environment
  console.log('Stores created successfully - run in browser to test');
}