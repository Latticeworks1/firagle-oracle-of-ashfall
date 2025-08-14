import { chromium } from 'playwright';

async function takeScreenshot() {
  console.log('🎮 Taking screenshot of Firagle game...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-web-security']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  
  const page = await context.newPage();
  
  try {
    console.log('📡 Navigating to localhost:5174...');
    await page.goto('http://localhost:5174', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for game to load...');
    
    // Wait for the game container to appear
    await page.waitForSelector('#game-container', { timeout: 10000 });
    
    // Wait for canvas to be ready
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // Give extra time for WebGL and assets to load
    await page.waitForTimeout(3000);
    
    console.log('📸 Taking screenshot...');
    await page.screenshot({ 
      path: 'firagle-game-screenshot.png',
      fullPage: false
    });
    
    console.log('✅ Screenshot saved as firagle-game-screenshot.png');
    
  } catch (error) {
    console.error('❌ Screenshot failed:', error);
    
    // Try to get console logs for debugging
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    
    if (logs.length > 0) {
      console.log('🔍 Browser console logs:');
      logs.forEach(log => console.log('  ', log));
    }
    
    // Take screenshot anyway to see what's happening
    try {
      await page.screenshot({ 
        path: 'firagle-error-screenshot.png',
        fullPage: true 
      });
      console.log('📸 Error screenshot saved as firagle-error-screenshot.png');
    } catch (e) {
      console.error('Failed to take error screenshot:', e);
    }
  }
  
  await browser.close();
}

takeScreenshot();