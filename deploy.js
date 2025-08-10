#!/usr/bin/env node

/**
 * Deployment script for Firagle Multiplayer to Puter
 * This script uploads the lobby and sets up subdomain hosting
 */

async function deployToPuter() {
    try {
        // Check if we're in browser environment
        if (typeof window === 'undefined') {
            console.log('This script should be run in a browser environment with Puter loaded.');
            console.log('Please open this in a browser and include the Puter script tag:');
            console.log('<script src="https://js.puter.com/v2/"></script>');
            return;
        }

        console.log('🚀 Starting Firagle Multiplayer deployment to Puter...');

        // 1. Ensure user is authenticated
        const isSignedIn = await puter.auth.isSignedIn();
        if (!isSignedIn) {
            console.log('❌ Please sign in to Puter first');
            await puter.auth.signIn();
        }

        const user = await puter.auth.getUser();
        console.log(`✅ Authenticated as: ${user.username}`);

        // 2. Create project directories
        console.log('📁 Creating project directories...');
        const directories = [
            '/firagle-multiplayer',
            '/firagle-multiplayer/assets',
            '/firagle-multiplayer/components',
            '/firagle-multiplayer/systems',
            '/firagle-db',
            '/firagle-db/players',
            '/firagle-db/games',
            '/firagle-db/maps',
            '/firagle-db/sessions'
        ];

        for (const dir of directories) {
            try {
                await puter.fs.mkdir(dir);
                console.log(`  ✓ Created ${dir}`);
            } catch (e) {
                console.log(`  - ${dir} already exists`);
            }
        }

        // 3. Upload lobby HTML
        console.log('📄 Uploading lobby files...');
        
        // Read the lobby.html content (assuming it's available in the current context)
        const lobbyHTML = await fetch('./lobby.html').then(r => r.text());
        await puter.fs.write('/firagle-multiplayer/index.html', lobbyHTML);
        console.log('  ✓ Uploaded lobby HTML');

        // 4. Create and upload lobby styles
        const lobbyCSS = `
/* Lobby Styles - extracted and optimized */
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Courier New', monospace;
    background: linear-gradient(135deg, #1a0f0a 0%, #2d1810 50%, #4a2c1a 100%);
    color: #ff6b35; min-height: 100vh; display: flex; align-items: center; justify-content: center;
}
.lobby-container { background: rgba(0,0,0,0.8); padding: 2rem; border-radius: 10px; border: 2px solid #ff6b35; min-width: 600px; text-align: center; }
.title { font-size: 2.5rem; margin-bottom: 1rem; text-shadow: 0 0 10px #ff6b35; animation: glow 2s ease-in-out infinite alternate; }
@keyframes glow { from { text-shadow: 0 0 10px #ff6b35; } to { text-shadow: 0 0 20px #ff6b35, 0 0 30px #ff8c42; } }
.section { margin: 2rem 0; padding: 1rem; border: 1px solid #944dff; border-radius: 5px; }
.button { background: linear-gradient(45deg, #ff6b35, #ff8c42); color: black; border: none; padding: 1rem 2rem; margin: 0.5rem; border-radius: 5px; font-size: 1.2rem; cursor: pointer; font-weight: bold; transition: all 0.3s ease; }
.button:hover { transform: scale(1.05); box-shadow: 0 0 15px #ff6b35; }
.input { background: rgba(255,107,53,0.1); border: 2px solid #ff6b35; color: #ff6b35; padding: 0.8rem; margin: 0.5rem; border-radius: 5px; font-size: 1.1rem; width: 300px; }
.game-list { max-height: 300px; overflow-y: auto; margin-top: 1rem; }
.game-item { background: rgba(148,77,255,0.1); border: 1px solid #944dff; margin: 0.5rem 0; padding: 1rem; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; }
.status { margin: 1rem 0; min-height: 50px; padding: 1rem; background: rgba(255,107,53,0.1); border-radius: 5px; border-left: 4px solid #ff6b35; }
.loading { display: inline-block; width: 20px; height: 20px; border: 3px solid #ff6b35; border-radius: 50%; border-top-color: transparent; animation: spin 1s ease-in-out infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
        `;

        await puter.fs.write('/firagle-multiplayer/lobby-styles.css', lobbyCSS);
        console.log('  ✓ Uploaded lobby styles');

        // 5. Create game lobby JavaScript
        const gameLobbyJS = `
class GameLobby {
    constructor() {
        this.gameId = new URLSearchParams(window.location.search).get('gameId');
        this.playerId = null;
        this.gameData = null;
        this.socket = null;
        this.init();
    }

    async init() {
        if (!this.gameId) {
            document.body.innerHTML = '<h1>Error: No game ID provided</h1>';
            return;
        }

        try {
            await this.loadGameData();
            await this.authenticatePlayer();
            this.setupSocket();
            this.renderLobby();
        } catch (error) {
            console.error('Failed to initialize game lobby:', error);
            this.showError('Failed to load game lobby');
        }
    }

    async loadGameData() {
        const gameContent = await puter.fs.read(\`/firagle-db/games/\${this.gameId}.json\`);
        this.gameData = JSON.parse(gameContent);
    }

    async authenticatePlayer() {
        const isSignedIn = await puter.auth.isSignedIn();
        if (!isSignedIn) {
            window.location.href = 'index.html';
            return;
        }
        
        const user = await puter.auth.getUser();
        this.playerId = user.id;
    }

    renderLobby() {
        document.body.innerHTML = \`
            <div class="game-lobby-container">
                <h1>\${this.gameData.name}</h1>
                <h2>Map: \${this.gameData.map}</h2>
                <div id="playerList">
                    <h3>Players (\${this.gameData.currentPlayers}/\${this.gameData.maxPlayers})</h3>
                    <ul>
                        \${this.gameData.players.map(p => \`
                            <li>\${p.username} \${p.isHost ? '(Host)' : ''}</li>
                        \`).join('')}
                    </ul>
                </div>
                <div id="gameControls">
                    \${this.isHost() ? '<button class="button" onclick="gamelobby.startGame()">Start Game</button>' : ''}
                    <button class="button" onclick="gamelobby.leaveLobby()">Leave</button>
                </div>
                <div id="status">Waiting for players...</div>
            </div>
        \`;
    }

    isHost() {
        return this.gameData.players.some(p => p.playerId === this.playerId && p.isHost);
    }

    async startGame() {
        if (!this.isHost()) return;
        
        // Update game status to starting
        this.gameData.status = 'starting';
        await puter.fs.write(\`/firagle-db/games/\${this.gameId}.json\`, JSON.stringify(this.gameData, null, 2));
        
        // Redirect to game
        window.location.href = \`game.html?gameId=\${this.gameId}\`;
    }

    async leaveLobby() {
        // Remove player from game
        this.gameData.players = this.gameData.players.filter(p => p.playerId !== this.playerId);
        this.gameData.currentPlayers--;
        
        await puter.fs.write(\`/firagle-db/games/\${this.gameId}.json\`, JSON.stringify(this.gameData, null, 2));
        
        window.location.href = 'index.html';
    }

    showError(message) {
        document.body.innerHTML = \`<div class="lobby-container"><h1>Error</h1><p>\${message}</p></div>\`;
    }
}

let gamelobby;
window.addEventListener('DOMContentLoaded', () => {
    gamelobby = new GameLobby();
});
        `;

        await puter.fs.write('/firagle-multiplayer/game-lobby.js', gameLobbyJS);
        console.log('  ✓ Uploaded game lobby script');

        // 6. Create default map
        console.log('🗺️ Creating default Ashfall map...');
        try {
            // This would normally use the MapManager, but for deployment we'll create it directly
            const defaultMap = {
                id: 'ashfall_default',
                name: 'Ashfall',
                description: 'Default volcanic map',
                creatorId: user.id,
                version: '1.0.0',
                maxPlayers: 8,
                recommendedGameModes: ['deathmatch'],
                isPublic: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
                // ... rest of map data would be added here
            };

            await puter.fs.write('/firagle-db/maps/ashfall_default.json', JSON.stringify(defaultMap, null, 2));
            console.log('  ✓ Created default Ashfall map');
        } catch (e) {
            console.log('  - Default map already exists');
        }

        // 7. Create hosting configuration
        console.log('🌐 Setting up Puter hosting...');
        
        const hostingConfig = {
            name: 'firagle-multiplayer',
            source: '/firagle-multiplayer',
            subdomain: \`firagle-\${user.username.toLowerCase()}\`,
            public: true
        };

        const hosting = await puter.hosting.create(hostingConfig);
        console.log(\`✅ Hosting created: \${hosting.url}\`);

        // 8. Final success message
        console.log('\\n🎉 Deployment completed successfully!');
        console.log(\`🔗 Your Firagle Multiplayer lobby is now available at: \${hosting.url}\`);
        console.log('\\nNext steps:');
        console.log('1. Visit the lobby URL to test the interface');
        console.log('2. Create a game session');
        console.log('3. Invite friends to join');
        console.log('4. Start playing!');

        return hosting.url;

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        throw error;
    }
}

// Auto-run if in browser environment with Puter
if (typeof window !== 'undefined' && window.puter) {
    deployToPuter().catch(console.error);
} else if (typeof window !== 'undefined') {
    console.log('⏳ Waiting for Puter to load...');
    window.addEventListener('load', () => {
        if (window.puter) {
            deployToPuter().catch(console.error);
        }
    });
}

// For Node.js environments, provide instructions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { deployToPuter };
    console.log('To deploy Firagle Multiplayer:');
    console.log('1. Open a browser');
    console.log('2. Load Puter: <script src="https://js.puter.com/v2/"></script>');
    console.log('3. Run: deployToPuter()');
}