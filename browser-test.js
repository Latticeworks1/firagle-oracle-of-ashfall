// Browser Console Test Script
// Copy and paste this into your browser console when the game is running
// at http://localhost:5177

console.log('🎮 Testing Zustand Stores in Live Game Environment...');

const testZustandInGame = async () => {
  try {
    console.log('\n🔍 Step 1: Checking if stores are available...');
    
    // Check if the game window has access to our stores
    const testButton = document.createElement('button');
    testButton.style.cssText = `
      position: fixed;
      top: 50px;
      right: 50px;
      z-index: 999999;
      padding: 10px 20px;
      background: #007acc;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 14px;
      cursor: pointer;
    `;
    testButton.textContent = 'Test Zustand Stores';
    document.body.appendChild(testButton);
    
    testButton.onclick = async () => {
      try {
        // Test importing stores dynamically
        console.log('📦 Attempting dynamic import of stores...');
        const stores = await import('./stores/index.js');
        console.log('✅ Stores imported successfully:', Object.keys(stores));
        
        // Test Game Store
        console.log('\n🎮 Testing Game Store...');
        const gameStore = stores.useGameStore.getState();
        console.log('- Current game mode:', gameStore.gameMode);
        console.log('- Touch device:', gameStore.isTouchDevice);
        
        gameStore.startGame();
        console.log('- After startGame():', stores.useGameStore.getState().gameMode);
        
        // Test Player Store
        console.log('\n👤 Testing Player Store...');
        const playerStore = stores.usePlayerStore.getState();
        console.log('- Player health:', playerStore.health + '/' + playerStore.maxHealth);
        
        playerStore.takeDamage(20, 'browser_test');
        console.log('- After 20 damage:', stores.usePlayerStore.getState().health);
        
        playerStore.addScore(777);
        console.log('- After adding 777 score:', stores.usePlayerStore.getState().score);
        
        // Test Weapon Store
        console.log('\n⚔️ Testing Weapon Store...');
        const weaponStore = stores.useWeaponStore.getState();
        console.log('- Current weapon:', weaponStore.currentWeapon.name);
        console.log('- Animation state:', weaponStore.animationState);
        
        weaponStore.startCharging();
        setTimeout(() => {
          console.log('- After charging delay:', stores.useWeaponStore.getState().animationState);
        }, 300);
        
        // Test World Store
        console.log('\n🌍 Testing World Store...');
        const worldStore = stores.useWorldStore.getState();
        console.log('- Terrain generated:', worldStore.terrainGenerated);
        
        if (!worldStore.terrainGenerated) {
          worldStore.generateTerrain(42069);
          console.log('- Terrain generated:', stores.useWorldStore.getState().terrainGenerated);
        }
        
        worldStore.setTimeOfDay(19.5);
        console.log('- Time set to:', stores.useWorldStore.getState().timeOfDay + 'h');
        
        // Test Constants
        console.log('\n⚙️ Testing Constants...');
        const constants = stores.useConstants.getState();
        console.log('- Player max health:', constants.player.maxHealth);
        console.log('- Performance particles:', constants.performance.enableParticles);
        
        constants.updatePlayerConfig({ maxHealth: 250 });
        console.log('- Updated max health:', stores.useConstants.getState().player.maxHealth);
        
        console.log('\n🎉 ALL ZUSTAND TESTS PASSED IN LIVE GAME! 🎉');
        
        // Update button to show success
        testButton.textContent = '✅ Tests Passed!';
        testButton.style.background = '#4CAF50';
        
        setTimeout(() => {
          testButton.textContent = 'Test Again';
          testButton.style.background = '#007acc';
        }, 2000);
        
      } catch (error) {
        console.error('❌ Test failed:', error);
        testButton.textContent = '❌ Test Failed';
        testButton.style.background = '#f44336';
        
        setTimeout(() => {
          testButton.textContent = 'Retry Test';
          testButton.style.background = '#007acc';
        }, 2000);
      }
    };
    
    console.log('✅ Test button added to page. Click it to run Zustand tests!');
    console.log('📍 Look for the blue "Test Zustand Stores" button in the top-right corner');
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to set up test environment:', error);
    return false;
  }
};

// Auto-run the test setup
testZustandInGame();