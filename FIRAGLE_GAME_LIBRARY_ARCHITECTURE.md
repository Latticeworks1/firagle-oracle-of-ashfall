# Firagle Game Library Architecture
## Strictly Typed, Zustand-Powered, Puter-Native Game Framework

## Vision: Our Own Game Library

**Goal**: Build `@firagle/core` - A strictly typed, multiplayer-first game library that other games can use.

**Philosophy**: 
- **Puter-Native**: Cloud storage, auth, hosting built-in
- **TypeScript-First**: Everything strictly typed with no `any`
- **Zustand State**: Single source of truth for all game state
- **React Three Fiber**: Declarative 3D rendering
- **Multiplayer-Core**: Single/multiplayer same codebase

## Current TypeScript Issues to Fix

### 1. Missing Strict Mode
**Current tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    // MISSING: strict type checking
  }
}
```

**Need to Add:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 2. Fragmented State Management

**Current Problems:**
- `useState` scattered across components (App.tsx, FPVView.tsx, etc.)
- No single source of truth
- No TypeScript interfaces for state shape
- Event bus untyped

**Solution: Unified Zustand Store**

## Core Library Structure

```
@firagle/core/
├── stores/           # Zustand stores (strictly typed)
├── components/       # Reusable R3F components  
├── hooks/           # Typed game hooks
├── systems/         # Game systems (physics, networking)
├── types/           # All TypeScript definitions
├── utils/           # Pure utility functions
└── puter/           # Puter.js integration layer
```

## Strictly Typed Zustand Game Store

### Core Game State Interface
```typescript
// @firagle/core/types/GameState.ts
export interface GameState {
  // Session Management
  session: {
    id: string;
    mode: 'singleplayer' | 'multiplayer';
    status: 'loading' | 'playing' | 'paused' | 'ended';
    players: Map<string, Player>;
    hostId: string;
  };
  
  // World State
  world: {
    terrain: TerrainData | null;
    assets: Map<string, WorldAsset>;
    effects: ActiveEffect[];
    projectiles: Map<string, Projectile>;
  };
  
  // Player State
  localPlayer: {
    id: string;
    position: Vector3;
    rotation: Euler;
    health: number;
    shield: number;
    score: number;
    inventory: Inventory;
    equipped: string; // weapon id
  };
  
  // UI State
  ui: {
    pointerLocked: boolean;
    inventoryOpen: boolean;
    loreModalOpen: boolean;
    gameOverVisible: boolean;
    hud: HUDState;
  };
  
  // Input State
  input: {
    keyboard: Record<string, boolean>;
    mouse: { deltaX: number; deltaY: number };
    touch: { move: Vector2; look: Vector2 };
    gestures: GestureState;
  };
  
  // Network State (Puter Integration)
  network: {
    connected: boolean;
    latency: number;
    puterSession: PuterSession | null;
    syncQueue: NetworkMessage[];
  };
}
```

### Typed Store Actions
```typescript
// @firagle/core/stores/gameStore.ts
interface GameActions {
  // Session Management
  createSession: (mode: 'singleplayer' | 'multiplayer') => Promise<void>;
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: () => void;
  
  // Player Actions
  updatePlayerPosition: (playerId: string, pos: Vector3, rot: Euler) => void;
  dealDamage: (playerId: string, damage: number) => void;
  equipWeapon: (weaponId: string) => void;
  
  // World Actions  
  loadTerrain: (terrainId: string) => Promise<void>;
  spawnEffect: (effect: EffectTriggerPayload) => void;
  fireProjectile: (projectile: ProjectileData) => void;
  
  // UI Actions
  setPointerLock: (locked: boolean) => void;
  openInventory: () => void;
  closeInventory: () => void;
  
  // Input Actions
  updateInput: (input: Partial<GameState['input']>) => void;
  
  // Network Actions (Puter)
  syncToCloud: () => Promise<void>;
  broadcastToPlayers: (message: NetworkMessage) => void;
}

export type GameStore = GameState & GameActions;
```

### Store Implementation
```typescript
// @firagle/core/stores/gameStore.ts
import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export const useGameStore = create<GameStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial State
        session: {
          id: '',
          mode: 'singleplayer',
          status: 'loading',
          players: new Map(),
          hostId: ''
        },
        world: {
          terrain: null,
          assets: new Map(),
          effects: [],
          projectiles: new Map()
        },
        localPlayer: {
          id: 'local',
          position: new Vector3(0, 35, 0),
          rotation: new Euler(0, 0, 0),
          health: 100,
          shield: 0,
          score: 0,
          inventory: { weapons: [], items: [] },
          equipped: 'firagle_staff'
        },
        ui: {
          pointerLocked: false,
          inventoryOpen: false,
          loreModalOpen: false,
          gameOverVisible: false,
          hud: { visible: true, opacity: 1.0 }
        },
        input: {
          keyboard: {},
          mouse: { deltaX: 0, deltaY: 0 },
          touch: { move: new Vector2(0, 0), look: new Vector2(0, 0) },
          gestures: { drawing: false, points: [] }
        },
        network: {
          connected: false,
          latency: 0,
          puterSession: null,
          syncQueue: []
        },

        // Actions
        createSession: async (mode) => {
          set((state) => {
            state.session.mode = mode;
            state.session.id = generateSessionId();
            state.session.status = 'loading';
          });
          
          if (mode === 'multiplayer') {
            await initializePuterSession(get());
          }
        },

        updatePlayerPosition: (playerId, pos, rot) => {
          set((state) => {
            if (playerId === 'local') {
              state.localPlayer.position = pos;
              state.localPlayer.rotation = rot;
            } else {
              const player = state.session.players.get(playerId);
              if (player) {
                player.position = pos;
                player.rotation = rot;
              }
            }
          });
          
          // Auto-sync to network if multiplayer
          if (get().session.mode === 'multiplayer') {
            get().broadcastToPlayers({
              type: 'PLAYER_POSITION',
              playerId,
              data: { position: pos, rotation: rot }
            });
          }
        },

        dealDamage: (playerId, damage) => {
          set((state) => {
            if (playerId === 'local') {
              state.localPlayer.health = Math.max(0, state.localPlayer.health - damage);
            } else {
              const player = state.session.players.get(playerId);
              if (player) {
                player.health = Math.max(0, player.health - damage);
              }
            }
          });
        },

        // ... other actions
      }))
    ),
    { name: 'firagle-game-store' }
  )
);
```

## Puter Integration Layer

### Puter-Native Session Management
```typescript
// @firagle/core/puter/PuterGameSession.ts
export class PuterGameSession {
  private store: GameStore;
  private puterClient: any; // Puter SDK

  constructor(store: GameStore) {
    this.store = store;
    this.puterClient = window.puter;
  }

  async createMultiplayerSession(): Promise<string> {
    // Use Puter's real-time database for session state
    const sessionData = {
      id: generateSessionId(),
      hostId: await this.puterClient.auth.getUser().id,
      players: {},
      worldState: this.store.world,
      createdAt: Date.now()
    };

    await this.puterClient.fs.write(`/game-sessions/${sessionData.id}.json`, 
      JSON.stringify(sessionData)
    );

    return sessionData.id;
  }

  async joinSession(sessionId: string): Promise<void> {
    const sessionPath = `/game-sessions/${sessionId}.json`;
    const sessionData = await this.puterClient.fs.read(sessionPath);
    
    // Add current player to session
    sessionData.players[this.store.localPlayer.id] = {
      ...this.store.localPlayer,
      joinedAt: Date.now()
    };

    await this.puterClient.fs.write(sessionPath, JSON.stringify(sessionData));
    
    // Subscribe to real-time updates
    this.subscribeToSessionUpdates(sessionId);
  }

  private subscribeToSessionUpdates(sessionId: string): void {
    // Use Puter's file watching for real-time multiplayer
    this.puterClient.fs.watch(`/game-sessions/${sessionId}.json`, 
      (changes: any) => {
        this.store.syncFromCloud(changes);
      }
    );
  }
}
```

### Cloud Save Integration
```typescript
// @firagle/core/puter/CloudSave.ts
export const usePuterSave = () => {
  const gameState = useGameStore();

  const saveToCloud = useCallback(async () => {
    if (!window.puter?.auth?.isSignedIn()) return;

    const saveData = {
      player: gameState.localPlayer,
      progress: {
        score: gameState.localPlayer.score,
        unlockedWeapons: gameState.localPlayer.inventory.weapons,
        achievments: [] // TODO
      },
      settings: gameState.ui,
      timestamp: Date.now()
    };

    await window.puter.fs.write('/firagle/save.json', JSON.stringify(saveData));
  }, [gameState]);

  const loadFromCloud = useCallback(async () => {
    try {
      const saveData = await window.puter.fs.read('/firagle/save.json');
      gameState.loadPlayerData(JSON.parse(saveData));
    } catch {
      // No save file exists, use defaults
    }
  }, [gameState]);

  return { saveToCloud, loadFromCloud };
};
```

## Typed Component Integration

### Replace useState with Zustand
```typescript
// Before: useState scattered everywhere
const [health, setHealth] = useState(100);
const [inventory, setInventory] = useState([]);

// After: Typed Zustand selectors
const health = useGameStore(state => state.localPlayer.health);
const inventory = useGameStore(state => state.localPlayer.inventory);
const dealDamage = useGameStore(state => state.dealDamage);
```

### Typed Event Bus Replacement
```typescript
// @firagle/core/hooks/useGameEvents.ts
export const useGameEvents = () => {
  const store = useGameStore();
  
  return {
    onWeaponFired: (projectile: ProjectileData) => {
      store.fireProjectile(projectile);
    },
    onPlayerHit: (damage: number) => {
      store.dealDamage('local', damage);
    },
    onEffectTriggered: (effect: EffectTriggerPayload) => {
      store.spawnEffect(effect);
    }
  };
};
```

## Library Export Structure
```typescript
// @firagle/core/index.ts
export { useGameStore } from './stores/gameStore';
export { PuterGameSession } from './puter/PuterGameSession';
export { usePuterSave } from './puter/CloudSave';
export * from './types';
export * from './components';
export * from './hooks';
```

## Benefits of This Architecture

### 1. **Strict Typing Everywhere**
- No `any` types allowed
- All state changes typed
- Network messages typed
- Component props strictly typed

### 2. **Single Source of Truth**
- All game state in one Zustand store
- No useState scattered across components
- Predictable state updates
- Easy debugging with Zustand DevTools

### 3. **Puter-Native Multiplayer**
- Real-time file watching for multiplayer sync
- Cloud save/load built-in
- Authentication integrated
- No external servers needed

### 4. **Reusable Game Library**
- Other games can use `@firagle/core`
- Modular component system
- Typed hooks for common game patterns
- Production-ready architecture

**Next Step: Convert current fragmented state to this unified, strictly typed system.**