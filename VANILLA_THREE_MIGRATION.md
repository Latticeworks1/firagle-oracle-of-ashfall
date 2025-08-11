# Vanilla Three.js to React Three Fiber Migration Plan

## Overview

This document identifies all vanilla Three.js patterns in the Firagle codebase that need conversion to React Three Fiber declarative patterns. The migration will eliminate imperative Three.js object manipulation in favor of JSX-based declarative rendering.

## Critical Vanilla Three.js Patterns Found

### 1. FPVView.tsx - Mixed Imperative/Declarative Patterns

**Lines 33-34, 81-87**: Direct position/rotation manipulation
```typescript
// VANILLA THREE.JS - NEEDS CONVERSION
recoilRef.current.position.z = 0.2;
recoilRef.current.rotation.x = -0.3;
cameraGroupRef.current.position.copy(camera.position);
recoilRef.current.position.lerp(new THREE.Vector3(0, 0, 0), delta * 10);
```

**Should become**: React Three Fiber spring animations or declarative position props

### 2. FPVPlayer.tsx - Camera Position Imperative Updates

**Line 42**: Direct camera position manipulation
```typescript
// VANILLA THREE.JS - NEEDS CONVERSION  
state.camera.position.set(worldPos.x, worldPos.y + 0.9, worldPos.z);
```

**Should become**: React Three Fiber camera component with declarative position

### 3. MapManager.ts - Complete Vanilla Three.js Class

**Entire file (537 lines)**: Pure vanilla Three.js scene management
- Scene creation and management
- Mesh creation with `new THREE.Mesh()`
- Direct geometry/material instantiation  
- Manual scene.add() calls
- Direct property assignments (position.copy, rotation.copy)

**Key problem areas**:
- Lines 335-344: Direct geometry attribute manipulation
- Lines 354-357: Imperative mesh creation and scene addition
- Lines 395-410: Manual object creation and positioning
- Lines 483-516: Direct scene lighting setup

### 4. Systems/MultiplayerECS.ts - ECS with Vanilla Three.js

**Lines 365-406**: Direct Three.js object manipulation in ECS systems
```typescript
// VANILLA THREE.JS PATTERNS
transform.position.add(this.velocity.clone().multiplyScalar(deltaTime));
transform.rotation.y -= input.mouseMovement.x * 0.002;
```

### 5. RockMonster.tsx - Shader Material Custom Logic

**Lines 95-110**: Direct material creation and uniform management
```typescript
// MIXING VANILLA WITH REACT THREE FIBER
const rockMat = useMemo(() => makeRockMaterial(...), []);
// Then using onBeforeCompile with direct shader manipulation
```

## Migration Strategy by Priority

### Phase 1: Core Component Conversion (High Priority)

#### 1.1 FPVView.tsx Recoil System
- **Replace**: Direct position/rotation manipulation
- **With**: React Three Fiber spring animations via `@react-spring/three`
- **Pattern**: Declarative animated props instead of useFrame mutations

#### 1.2 FPVPlayer.tsx Camera Control  
- **Replace**: Direct camera.position.set() calls
- **With**: React Three Fiber `<PerspectiveCamera>` component with declarative positioning
- **Pattern**: Camera follows player through declarative binding

### Phase 2: Scene Management Migration (Medium Priority)

#### 2.1 MapManager.ts Complete Rewrite
- **Replace**: Class-based vanilla Three.js scene management
- **With**: React Three Fiber components for terrain, assets, lighting
- **Components needed**:
  - `<TerrainMesh>` - Declarative heightmap terrain
  - `<MapAssets>` - Asset placement via JSX mapping  
  - `<MapLighting>` - Declarative lighting setup
  - `<SpawnPoints>` - Visual spawn point indicators

#### 2.2 Asset Loading Integration
- **Replace**: Manual geometry/material creation in MapManager
- **With**: React Three Fiber `<primitive>` or custom geometry components
- **Pattern**: Asset registry returning React components instead of Three.js objects

### Phase 3: ECS Integration (Advanced)

#### 3.1 MultiplayerECS.ts Transform System
- **Challenge**: ECS systems need imperative control but should use R3F patterns
- **Solution**: Hybrid approach with R3F components controlled by ECS refs
- **Pattern**: ECS manages data, R3F components render declaratively from ECS state

## Specific Technical Conversions

### Direct Position Manipulation → Animated Props
```typescript
// BEFORE (Vanilla)
useFrame(() => {
  recoilRef.current.position.lerp(targetPos, 0.1);
});

// AFTER (React Three Fiber + Spring)
const [{ position }, set] = useSpring(() => ({ position: [0, 0, 0] }));
return <animated.group position={position} />
```

### Manual Scene Management → JSX Mapping
```typescript
// BEFORE (Vanilla)  
for (const asset of assets) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(asset.position);
  scene.add(mesh);
}

// AFTER (React Three Fiber)
return (
  <>
    {assets.map(asset => (
      <mesh key={asset.id} position={asset.position.toArray()}>
        <boxGeometry />
        <meshStandardMaterial />
      </mesh>
    ))}
  </>
);
```

### Camera Control → Declarative Camera Component
```typescript
// BEFORE (Vanilla)
useFrame((state) => {
  state.camera.position.set(x, y, z);
});

// AFTER (React Three Fiber)
return (
  <PerspectiveCamera 
    makeDefault 
    position={[x, y, z]}
    fov={75}
  />
);
```

## Migration Benefits

### Performance Improvements
- Automatic frustum culling through R3F scene graph
- Efficient re-rendering only when props change
- Better memory management through React lifecycle

### Code Maintainability  
- Declarative component hierarchy easier to understand
- Consistent React patterns throughout codebase
- Better separation of concerns between rendering and logic

### Development Experience
- Hot reloading works properly with R3F components
- Better debugging through React DevTools
- Type safety through R3F's TypeScript definitions

## Implementation Notes

### Preserve Existing Functionality
- Maintain all current game mechanics during migration
- Ensure physics integration (Rapier) continues working
- Keep event bus communication intact

### Gradual Migration Approach
- Convert one component at a time to avoid breaking changes  
- Use feature flags to switch between old/new implementations
- Test each conversion thoroughly before proceeding

### Performance Monitoring
- Monitor frame rates during conversion to catch regressions
- Profile memory usage to ensure no memory leaks from migration
- Validate that physics simulation remains stable

## Completion Criteria

### Phase 1 Complete When:
- No direct Three.js position/rotation manipulation in React components
- All animations use React Three Fiber spring or declarative patterns  
- Camera control fully declarative

### Phase 2 Complete When:
- MapManager.ts converted to React Three Fiber components
- All scene management happens through JSX
- Asset loading integrated with R3F component patterns

### Phase 3 Complete When:
- ECS systems work with React Three Fiber declarative rendering
- No mixed imperative/declarative patterns remain
- Full type safety throughout 3D rendering pipeline

This migration will transform Firagle from a mixed imperative/declarative 3D application to a fully React-native 3D experience while preserving all existing functionality.