import { eventBus } from './eventBus';

/**
 * Simple Game Manager - Replaces over-engineered core systems
 * 
 * Provides basic game coordination without complex cloud integration:
 * - Simple scene management
 * - Basic campaign progression
 * - Event-driven coordination
 */
export class SimpleGameManager {
    private isInitialized: boolean = false;
    private currentScene: string | null = null;
    private isPaused: boolean = false;
    
    constructor() {
        this.setupEventListeners();
    }
    
    private setupEventListeners(): void {
        eventBus.on('SCENE_COMPLETE', this.handleSceneComplete.bind(this));
        eventBus.on('PLAYER_DIED', this.handlePlayerDeath.bind(this));
        eventBus.on('GAME_PAUSE', this.handleGamePause.bind(this));
    }
    
    public async initialize(): Promise<void> {
        if (this.isInitialized) return;
        
        console.log('SimpleGameManager: Initializing basic game systems...');
        this.isInitialized = true;
        
        eventBus.dispatch('GAME_INITIALIZED', { 
            cloudEnabled: false,
            playerProfile: null
        });
        
        console.log('SimpleGameManager: Initialized successfully');
    }
    
    public async startCampaign(campaignId: string): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('SimpleGameManager not initialized');
        }
        
        console.log(`SimpleGameManager: Starting campaign ${campaignId}`);
        
        // Start with volcanic scene
        const firstScene = 'volcanic_crater';
        await this.loadScene(firstScene);
        
        console.log('SimpleGameManager: Campaign started');
    }
    
    public async loadScene(sceneId: string): Promise<void> {
        console.log(`SimpleGameManager: Loading scene ${sceneId}`);
        
        // Show loading screen
        eventBus.dispatch('SHOW_LOADING_SCREEN', { sceneId });
        
        // Simulate scene loading with terrain generation
        setTimeout(() => {
            this.currentScene = sceneId;
            
            // Generate some enemies for the scene
            const enemyCount = Math.floor(Math.random() * 3) + 2; // 2-4 enemies
            for (let i = 0; i < enemyCount; i++) {
                const angle = (i / enemyCount) * Math.PI * 2;
                const distance = 20 + Math.random() * 10;
                const x = Math.cos(angle) * distance;
                const z = Math.sin(angle) * distance;
                
                eventBus.dispatch('SPAWN_ENEMY', {
                    type: 'rock_monster',
                    position: { x, y: 5, z },
                    id: `enemy_${Date.now()}_${i}`
                });
            }
            
            // Hide loading screen
            eventBus.dispatch('HIDE_LOADING_SCREEN', {});
            
            // Notify scene loaded
            eventBus.dispatch('SCENE_LOADED', { sceneId });
            
        }, 1000); // Brief loading delay
    }
    
    private handleSceneComplete(): void {
        console.log('SimpleGameManager: Scene completed - loading next scene');
        
        // Simple progression - just reload the same scene with more enemies
        this.loadScene(this.currentScene || 'volcanic_crater');
    }
    
    private handlePlayerDeath(): void {
        console.log('SimpleGameManager: Player died');
        eventBus.dispatch('SHOW_DEATH_SCREEN', {});
    }
    
    private handleGamePause(): void {
        this.isPaused = !this.isPaused;
        console.log(`SimpleGameManager: Game ${this.isPaused ? 'paused' : 'resumed'}`);
        eventBus.dispatch('GAME_STATE_CHANGED', { isPaused: this.isPaused });
    }
    
    public getCurrentScene(): string | null {
        return this.currentScene;
    }
    
    public isPausedState(): boolean {
        return this.isPaused;
    }
    
    public dispose(): void {
        eventBus.off('SCENE_COMPLETE', this.handleSceneComplete.bind(this));
        eventBus.off('PLAYER_DIED', this.handlePlayerDeath.bind(this));
        eventBus.off('GAME_PAUSE', this.handleGamePause.bind(this));
    }
}

// Simple environment manager replacement
export class SimpleEnvironmentManager {
    private currentEnvironment = {
        id: 'volcanic_crater',
        terrainType: 'volcanic',
        terrainSeed: 42
    };
    
    public async initialize(): Promise<void> {
        console.log('SimpleEnvironmentManager: Initialized');
    }
    
    public getCurrentEnvironment() {
        return this.currentEnvironment;
    }
    
    public dispose(): void {
        // Nothing to dispose
    }
}

// Global instances
export const simpleGameManager = new SimpleGameManager();
export const simpleEnvironmentManager = new SimpleEnvironmentManager();