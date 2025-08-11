# Firagle Game Flow Architecture
## From Opening Game → Playing: What We Actually Need

## Game Startup Flow

### 1. **App Load** → **Authentication Check**
**From:** `App.tsx` entry point  
**Uses:** Puter Auth API  
**Needs:**
- `window.puter.auth.isSignedIn()` check
- User profile data if signed in
- Guest mode fallback if not signed in

**Plugs Into:** Session selection (single/multiplayer)

---

### 2. **Session Selection** → **Game Mode Setup**
**From:** Authentication state  
**Uses:** Zustand store + Puter database  
**Needs:**
- Session type selection (single vs multiplayer)
- If multiplayer: join existing session OR create new session
- Puter file system for session persistence: `/game-sessions/${sessionId}.json`

**Plugs Into:** Terrain loading

---

### 3. **Terrain Loading** → **World Initialization**
**From:** Session created  
**Uses:** Pre-generated terrain data + assetManager  
**Needs:**
- `fetch('/terrain/ashfall-heightmap.bin')` → Float32Array
- `generateHeightData()` fallback if fetch fails
- Height data passed to Ground.tsx and ScatteredAssets.tsx
- Physics world creation (Rapier World instance)

**Plugs Into:** Player spawning

---

### 4. **Player Spawning** → **Physics Body Creation**
**From:** Terrain loaded  
**Uses:** React Three Fiber + Rapier  
**Needs:**
- `<FPVPlayer>` with RapierRigidBody ref
- Initial spawn position from terrain height data
- `<PlayerCamera>` listening to position events
- Input system initialization (keyboard + touch)

**Plugs Into:** Game loop start

---

### 5. **Game Loop Start** → **Real-time Systems**
**From:** Player spawned  
**Uses:** useFrame + Event Bus + Zustand selectors  
**Needs:**

**Physics Loop (60fps):**
- `useFrame()` in FPVPlayer updating Rapier body
- Position changes → `eventBus.dispatch('PLAYER_POSITION_UPDATED')`
- Collision detection → immediate event firing

**State Loop (React renders):**
- Zustand selectors triggering component re-renders
- UI state changes (health, inventory, etc.)
- Non-physics state updates

**Network Loop (20fps multiplayer only):**
- Position sync to other players via Puter file updates
- Incoming position updates from other players
- Network state reconciliation

**Plugs Into:** Gameplay systems

---

## Gameplay Systems Integration

### 6. **Input Handling** → **Action Execution**
**From:** Game loop running  
**Uses:** useKeyboardControls + touch events + eventBus  
**Needs:**
- Keyboard: `useKeyboardControls<ControlsEnum>()` → movement vector
- Touch: OnScreenControls → movement + look deltas  
- Mouse: PointerLockControls → look rotation
- Gestures: Canvas drawing → gesture recognition → spell casting

**Plugs Into:** Physics movement + weapon systems

---

### 7. **Movement System** → **Physics Updates**
**From:** Input processed  
**Uses:** FPVPlayer useFrame + Rapier setLinvel  
**Needs:**
- Movement vector applied to rigid body: `playerRef.current.setLinvel()`
- Camera rotation applied via: `eventBus.dispatch('PLAYER_POSITION_UPDATED')`
- Ground detection for jump/fall logic
- Collision response with terrain/assets

**Plugs Into:** Camera system + network sync

---

### 8. **Camera System** → **View Updates**
**From:** Player position changes  
**Uses:** PlayerCamera component + event bus  
**Needs:**
- Listen to `'PLAYER_POSITION_UPDATED'` event
- Update camera position: `camera.position.copy(position)`
- Handle recoil animations from weapon firing
- Smooth camera transitions (no direct manipulation)

**Plugs Into:** Weapon/combat systems

---

### 9. **Weapon System** → **Combat Actions**
**From:** Input firing + animation state  
**Uses:** useAnimationStateManager + eventBus + weapon schemas  
**Needs:**
- Animation states: Idle → Charging → Charged → Discharging → Decay
- `eventBus.dispatch('WEAPON_FIRED')` → projectile creation
- Weapon stats from `WEAPONS_DATA` schemas
- Visual effects coordination via EffectsManager

**Plugs Into:** Projectile physics + effects

---

### 10. **Projectile System** → **Combat Resolution**
**From:** Weapon fired  
**Uses:** Fireball.tsx + Rapier physics + collision detection  
**Needs:**
- Projectile rigid bodies with velocity
- Collision detection with enemies/terrain
- `eventBus.dispatch('ENEMY_HIT')` on collision
- Projectile cleanup after lifespan/collision
- Splash damage calculations

**Plugs Into:** Enemy system + effects

---

### 11. **Enemy System** → **AI Behavior**
**From:** Game loop + player position  
**Uses:** useEnemyManager + RockMonster components  
**Needs:**
- Enemy spawning based on timer + count limits
- AI pathfinding using terrain height data
- Health management via event bus
- Attack logic when near player
- Death effects and cleanup

**Plugs Into:** Scoring + effects

---

### 12. **Effects System** → **Visual Feedback**
**From:** Combat actions + game events  
**Uses:** EffectsManager + GPU particles + event bus  
**Needs:**
- Listen to `'EFFECT_TRIGGERED'` events
- Coordinate particle systems, explosions, lightning
- GPU-based particle rendering for performance
- Effect cleanup after duration
- Audio integration (future)

**Plugs Into:** UI feedback

---

### 13. **UI System** → **Player Feedback**
**From:** Game state changes  
**Uses:** Zustand selectors + React components  
**Needs:**
- Health/shield bars updating from `usePlayerState`
- Score display from player state
- Inventory UI with weapon selection
- Game over screen on player death
- HUD overlay with game info

**Plugs Into:** Game state persistence

---

### 14. **State Persistence** → **Cloud Sync**
**From:** Game state changes  
**Uses:** Puter file system + Zustand store  
**Needs:**

**Single Player:**
- Auto-save player progress to `/firagle/save.json`
- Save high scores, unlocked weapons
- Resume game state on reload

**Multiplayer:**
- Real-time sync via Puter file watching
- Session state updates: `/game-sessions/${id}.json`
- Player position/action broadcasting
- Conflict resolution for simultaneous actions

**Plugs Into:** Session end/restart

---

## Critical Integration Points

### **What Each System Actually Needs:**

**Physics (Rapier):** 
- Direct rigid body refs (can't be in Zustand)
- useFrame for real-time updates
- Immediate collision event firing

**State (Zustand):**
- UI state (health, inventory, scores)
- Session management (players, settings)
- Non-physics game state

**Events (EventBus):**
- Immediate action coordination
- Cross-system communication
- Physics → UI updates

**Network (Puter):**
- File-based state sync
- Real-time multiplayer updates  
- Cloud save persistence

**React Three Fiber:**
- Declarative 3D rendering
- Component lifecycle management
- useFrame physics integration

### **Performance-Critical Separations:**

**60fps Physics Loop:** Direct rigid body manipulation, immediate events
**React Render Loop:** State-based UI updates, component re-renders  
**20fps Network Loop:** Position sync, multiplayer coordination
**Storage Operations:** Async cloud saves, session persistence

**The key insight: Not everything goes through Zustand. Physics stays in useFrame, UI state goes to Zustand, events coordinate between them.**