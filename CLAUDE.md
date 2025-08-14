# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Setup

Set `GEMINI_API_KEY` in `.env.local` for the Oracle (lore) functionality to work.

## Architecture Overview

**Firagle: Oracle of Ashfall** is a React-based 3D fantasy action game built with Three.js and React Three Fiber. The game features first-person view magic combat against rock monsters in a volcanic landscape.

### Core Systems

**Event-Driven Architecture**: Central `eventBus` system coordinates communication between all game components. Key events include `WEAPON_FIRED`, `PLAYER_TOOK_DAMAGE`, `ENEMY_HIT`, `EFFECT_TRIGGERED`, and others defined in `types.ts`.

**Component-Based Entity System**: Game entities (player, enemies, projectiles, effects) are React components that interact through the event bus rather than direct prop passing.

**Animation State Machine**: Weapon behavior is controlled by a finite state machine (`AnimationState` enum) managing Idle → Charging → Charged → Discharging → Decay transitions via `useAnimationStateManager` hook.

**Physics Integration**: Uses Rapier physics engine through `@react-three/rapier` for collision detection, rigid body dynamics, and spatial queries.

### Key Architectural Patterns

**Custom Hook Pattern**: Game logic is encapsulated in hooks:
- `useAnimationStateManager`: Weapon state transitions and timing
- `usePlayerState`: Health, shield, score, death state
- `useEnemyManager`: Enemy spawning, pathfinding, lifecycle

**Procedural Generation**: Terrain uses Perlin noise (`utils/noise.ts`) for heightmaps. Asset placement uses the same heightmap for consistent world generation.

**Gesture Recognition**: Custom gesture recognition system (`utils/gestureRecognizer.ts`) processes mouse/touch input patterns to cast spells defined in `data/gestures.ts`.

**Weapon Schema System**: Type-safe weapon definitions in `data/weapons.ts` support multiple weapon types (Projectile, HitscanChain) with distinct behavior patterns.

### File Organization

```
components/
├── effects/      # Visual effects (explosions, lightning, particles)
├── enemy/        # Rock monster AI and death effects  
├── logic/        # Game mechanics (projectile handling)
├── misc/         # Utilities (camera, position tracking)
├── player/       # First-person view and movement
├── staff/        # Procedural weapon model generation
├── ui/           # Game interface and overlays
└── world/        # Environment (terrain, assets, projectiles)

systems/
├── EffectsManager.tsx    # Centralized effect spawning/cleanup
├── assetManager.ts       # Resource loading and caching  
└── eventBus.ts          # Event coordination hub

data/
├── weapons.ts      # Weapon configurations and stats
├── gestures.ts     # Spell gesture templates
└── assetMap.ts     # Asset loading definitions
```

### Key Technical Decisions

**Hybrid State Management**: Primary game logic uses React hooks + event bus pattern. Zustand is available for complex multiplayer state (see `MultiplayerECS.ts`) but the core game avoids traditional global state for better React Three Fiber integration.

**Procedural Staff Generation**: The magical staff ("Firagle") is procedurally generated from mathematical constants in `constants.ts` rather than loading 3D models.

**Touch-First Design**: Supports both desktop (mouse/keyboard) and mobile (touch) with unified input handling through `IS_TOUCH_DEVICE` detection.

**Ref-Based Entity Communication**: Critical game objects use React refs for direct access (player position, staff tip for projectile spawning) while maintaining React patterns.

### Performance Considerations

**Object Pooling**: Projectiles and effects are recycled rather than recreated to minimize garbage collection.

**Conditional Rendering**: Heavy 3D components (effects, enemies) are conditionally rendered based on game state to maintain 60fps.

**Event Bus Error Handling**: All event listeners are wrapped in try-catch to prevent cascading failures.

### External Dependencies

**AI Integration**: Gemini API integration (`services/geminiService.ts`) provides lore responses through the "Oracle" system with appropriate fallback handling.

**Three.js Ecosystem**: Heavily uses `@react-three/drei` for camera controls, environment, and utilities. Physics through `@react-three/rapier`.

### Advanced Systems (In Development)

**Puter Cloud Integration**: Database layer (`systems/database/PuterDatabase.ts`) integrates with Puter.com's filesystem for cloud-native multiplayer data persistence, replacing traditional databases.

**Multiplayer ECS Architecture**: Complete Entity-Component-System implementation (`systems/multiplayer/MultiplayerECS.ts`) with:
- Component-based entities (Transform, Network, Player, Weapon, Projectile)
- Client-server prediction with rollback
- Network interpolation for smooth remote player movement  
- Zustand-based multiplayer state management

**Development and Build Setup**

- **TypeScript Configuration**: Configured for ES2022 with experimental decorators, JSX support, and path aliases (`@/*` maps to project root)
- **Vite Build System**: Environment variable injection for API keys, path resolution aliases
- **No Build Tools Required**: Can run directly with `npm run dev` for development, `npm run build` for production

### Development Workflow

**Environment Variables**: Set `GEMINI_API_KEY` in `.env.local` for Oracle functionality. The build system automatically injects this as `process.env.GEMINI_API_KEY`.

**Hot Module Replacement**: Vite provides instant feedback during development with proper React Three Fiber integration.

**Physics Debugging**: Rapier physics engine provides built-in debug rendering - useful for collision detection troubleshooting.

## Critical Development Rules

**Testing Requirements**: Never claim functionality "works" without runtime verification. Compilation success != working code. Always test actual user interactions - gestures, weapon firing, physics, collision detection.

**Code Quality Standards**: Fix all TypeScript warnings and errors before claiming completion. Warnings indicate real issues that will cause runtime failures.

**Debug & Verification**: Use Tab key to toggle debug mode showing player position, velocity, terrain height, and physics state. Essential for verifying movement, collision, and terrain interaction.

**Build Verification**: Always run `npm run build` after significant changes to catch production-specific issues like missing environment variables or import errors.

## Testing Specific Systems

**Weapon System Testing**: Each weapon type has distinct behavior patterns - test both Projectile (Firagle) and HitscanChain (Lightning Staff) weapons. Verify charging animations, projectile spawning, and damage application.

**Gesture Recognition**: Test both mouse gesture drawing (right-click + drag) and touch gestures. Verify fire_nova and protective_ward spells trigger correctly with proper visual feedback.

**Physics Integration**: Test player movement on terrain, collision with enemies and environment objects. Verify heightmap-based spawn positioning and terrain collision.

**Touch vs Desktop**: The game has completely different input handling for touch devices. Test both modes - desktop uses PointerLockControls, touch uses OnScreenControls.

**Map Loading**: Terrain generation is async via CachedMapLoader. Test scenarios where terrain hasn't loaded yet (fallback ground should appear).