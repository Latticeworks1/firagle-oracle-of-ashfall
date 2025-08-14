

import './styles/hud.css';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { KeyboardControls, PointerLockControls, useKeyboardControls, Sky } from '@react-three/drei';
import type { RapierRigidBody } from '@react-three/rapier';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Types and Constants
import type { Controls, Projectile, WeaponSchema, WeaponFiredPayload, PlayerAddShieldPayload, EffectTriggerPayload } from './types';
import { Controls as ControlsEnum, AnimationState, WeaponType } from './types';
import { IS_TOUCH_DEVICE } from './constants';
import { WEAPONS_DATA } from './data/weapons';
import { GESTURE_SPELLS } from './data/gestures';

// Systems & Services
import { eventBus } from './systems/eventBus';
import { askOracle } from './services/geminiService';
import { recognizeGesture } from './utils/gestureRecognizer';

// Hooks
import { useAnimationStateManager } from './hooks/useAnimationStateManager';
import { usePlayerState } from './hooks/usePlayerState';
import { useEnemyManager } from './hooks/useEnemyManager';

// Utils
import { getSafeSpawnPosition } from './utils/noise';

// Map System
import CachedMapLoader from './components/world/CachedMapLoader';

// UI Components
import FPVUI from './components/ui/FPVUI';
import LoreModal from './components/ui/LoreModal';
import GameOverScreen from './components/ui/GameOverScreen';
import StartScreen from './components/ui/StartScreen';
import OnScreenControls from './components/ui/OnScreenControls';
import InventoryUI from './components/ui/InventoryUI';
import GameHUD from './components/ui/GameHUD';
import GestureDrawCanvas from './components/ui/GestureDrawCanvas';
import PauseMenu from './components/ui/PauseMenu';
import SimplePlayerProfileUI from './components/ui/SimplePlayerProfileUI';

// 3D Components
import { Physics } from '@react-three/rapier';
import EffectsManager from './systems/EffectsManager';
import UnifiedPlayerController from './components/player/UnifiedPlayerController';
import FPVView from './components/player/FPVView';
import Ground from './components/world/Ground';
import ScatteredAssets from './components/world/ScatteredAssets';
import Fireball from './components/world/Fireball';
import RockMonster from './components/enemy/RockMonster';
import ChargingSigil from './components/effects/ChargingSigil';
import ChainLightningHandler from './components/effects/ChainLightningHandler';
import ProjectileHandler from './components/logic/ProjectileHandler';

// Debug Components
import ZustandGameTest from './components/debug/ZustandGameTest';
import PlayerDebugger from './components/debug/PlayerDebugger';
import PlayerDebugTracker, { type DebugData } from './components/debug/PlayerDebugTracker';

// Zustand Stores - temporarily disabled
// import { initializeStores } from './stores';


const controlMap = [
    { name: ControlsEnum.forward, keys: ['ArrowUp', 'w', 'W'] },
    { name: ControlsEnum.backward, keys: ['ArrowDown', 's', 'S'] },
    { name: ControlsEnum.left, keys: ['ArrowLeft', 'a', 'A'] },
    { name: ControlsEnum.right, keys: ['ArrowRight', 'd', 'D'] },
    { name: ControlsEnum.draw, keys: ['Mouse2'] }, // Right mouse button
];

// Component to handle gesture input logic
const GestureHandler: React.FC<{
  isDrawing: boolean;
  setDrawnPoints: (updater: (prev: { x: number; y: number }[]) => { x: number; y: number }[]) => void;
}> = ({ isDrawing, setDrawnPoints }) => {
  const isDrawingRef = useRef(isDrawing);
  isDrawingRef.current = isDrawing;

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDrawingRef.current) {
      setDrawnPoints(prev => [...prev, { x: e.clientX, y: e.clientY }]);
    }
  }, [setDrawnPoints]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDrawingRef.current && e.touches.length > 0) {
      setDrawnPoints(prev => [...prev, { x: e.touches[0].clientX, y: e.touches[0].clientY }]);
    }
  }, [setDrawnPoints]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleMouseMove, handleTouchMove]);

  return null;
};

const DrawInputHandler: React.FC<{
    startDrawing: () => void;
    endDrawing: () => void;
}> = ({ startDrawing, endDrawing }) => {
    const keyboardApi = useKeyboardControls<ControlsEnum>();
    useEffect(() => {
        // Explicitly access the subscribe function from the API tuple.
        const subscribe = keyboardApi[0];
        const unsub = subscribe(
            (state) => state.draw,
            (pressed) => {
                if (pressed) {
                    startDrawing();
                } else {
                    endDrawing();
                }
            }
        );
        return unsub;
    }, [keyboardApi, startDrawing, endDrawing]);

    return null;
};


const App: React.FC = () => {
    // Initialize Zustand stores - temporarily disabled
    // useEffect(() => {
    //     initializeStores();
    // }, []);

    // Game State
    const [projectiles, setProjectiles] = useState<Projectile[]>([]);
    const [isPointerLocked, setIsPointerLocked] = useState(false);
    const [damageFlash, setDamageFlash] = useState(0);
    const [triggerFire, setTriggerFire] = useState(false);

    // Gesture State
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawnPoints, setDrawnPoints] = useState<{ x: number; y: number }[]>([]);
    const [gestureResult, setGestureResult] = useState<string | null>(null);
    const drawnPointsRef = useRef(drawnPoints);
    drawnPointsRef.current = drawnPoints;

    // Inventory State
    const [inventory, setInventory] = useState<WeaponSchema[]>(WEAPONS_DATA);
    const [equippedWeaponId, setEquippedWeaponId] = useState<string>(WEAPONS_DATA[0].id);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);

    // Touch Controls State
    const [touchMoveInput, setTouchMoveInput] = useState({ x: 0, y: 0 });
    const touchLookInputRef = useRef({ dx: 0, dy: 0 });

    // Debug State
    const [isDebugVisible, setIsDebugVisible] = useState(false);
    const [debugData, setDebugData] = useState<DebugData>({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        terrainHeight: 0,
        heightAboveTerrain: 0,
        isGrounded: false,
        mass: 0,
        rotationY: 0
    });

    // UI Modal States
    const [isLoreModalOpen, setIsLoreModalOpen] = useState(false);
    const [loreResponse, setLoreResponse] = useState("Ask a question about this world...");
    const [isLoreLoading, setIsLoreLoading] = useState(false);
    const [loreError, setLoreError] = useState("");
    const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Custom Hooks
    const equippedWeapon = useMemo(() => inventory.find(w => w.id === equippedWeaponId) || inventory[0], [inventory, equippedWeaponId]);
    const { animationState, startCharging, fire, resetState } = useAnimationStateManager(equippedWeapon.stats);
    const { playerState, resetPlayer } = usePlayerState();
    
    // Refs
    const headRef = useRef<THREE.Group>(null);
    const playerRef = useRef<RapierRigidBody>(null);
    const staffRef = useRef<THREE.Group>(null);
    const controlsRef = useRef<any>(null);
    const damageFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const playerPos = useRef(new THREE.Vector3()).current;

    // Map State
    const [heightData, setHeightData] = useState<Float32Array | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    const { enemies, resetEnemies } = useEnemyManager(
        (isPointerLocked || IS_TOUCH_DEVICE) && !playerState.isDead && !isLoreModalOpen && !isInventoryOpen && !isPauseMenuOpen && !isProfileOpen && isMapLoaded,
        playerPos
    );
        
    const playerSpawnPosition = useMemo(() => {
        if (!heightData) return new THREE.Vector3(0, 10, 0);
        const [x, y, z] = getSafeSpawnPosition(heightData);
        return new THREE.Vector3(x, y, z);
    }, [heightData]);

    // Game Logic Callbacks via Event Bus
    const handleExpireProjectile = useCallback((id: string) => setProjectiles(prev => prev.filter(p => p.id !== id)), []);

    useEffect(() => {
        const onWeaponFired = (payload: WeaponFiredPayload) => {
            setProjectiles(prev => [...prev, payload]);
        };
        const onPlayerTookDamage = () => {
            if (damageFlashTimeoutRef.current) clearTimeout(damageFlashTimeoutRef.current);
            setDamageFlash(0.5);
            damageFlashTimeoutRef.current = setTimeout(() => setDamageFlash(0), 100);
        };
        eventBus.on('WEAPON_FIRED', onWeaponFired);
        eventBus.on('PLAYER_TOOK_DAMAGE', onPlayerTookDamage);
        return () => {
            eventBus.off('WEAPON_FIRED', onWeaponFired);
            eventBus.off('PLAYER_TOOK_DAMAGE', onPlayerTookDamage);
        }
    }, []);

    // Gesture casting logic
    const castGestureSpell = useCallback((spellId: 'fire_nova' | 'protective_ward') => {
      setGestureResult(`Casted: ${spellId.replace('_', ' ')}!`);
      setTimeout(() => setGestureResult(null), 1500);

      if (spellId === 'fire_nova' && playerRef.current) {
         eventBus.dispatch<EffectTriggerPayload>('EFFECT_TRIGGERED', {
              id: THREE.MathUtils.generateUUID(),
              type: 'nova',
              position: new THREE.Vector3().copy(playerRef.current.translation())
          });
      } else if (spellId === 'protective_ward') {
          eventBus.dispatch<PlayerAddShieldPayload>('PLAYER_ADD_SHIELD', { amount: 75 });
      }
    }, []);
    
    // Drawing Handlers
    const startDrawing = useCallback(() => {
      if (playerState.isDead || isInventoryOpen || isLoreModalOpen || isPauseMenuOpen || isProfileOpen) return;
      if (controlsRef.current?.isLocked) controlsRef.current.unlock();
      setDrawnPoints([]);
      drawnPointsRef.current = [];
      setIsDrawing(true);
    }, [playerState.isDead, isInventoryOpen, isLoreModalOpen, isPauseMenuOpen, isProfileOpen]);

    const endDrawing = useCallback(() => {
      setIsDrawing(false);
      // Use the ref which is guaranteed to be up-to-date
      const pointsToRecognize = drawnPointsRef.current;
      if (pointsToRecognize.length > 10) {
          const recognized = recognizeGesture(pointsToRecognize, GESTURE_SPELLS);
          if (recognized) {
              castGestureSpell(recognized.id);
          } else {
             setGestureResult('Incantation failed...');
             setTimeout(() => setGestureResult(null), 1500);
          }
      }
      setDrawnPoints([]); // Clear visual trail
    }, [castGestureSpell]);


    // UI and Interaction Handlers
    const handleOpenLoreModal = useCallback(() => {
        if (controlsRef.current?.isLocked) controlsRef.current.unlock();
        setIsLoreModalOpen(true);
    }, []);

    const handleOpenInventory = useCallback(() => {
        if(controlsRef.current?.isLocked) controlsRef.current.unlock();
        setIsInventoryOpen(true);
    }, []);

    const requestPointerLock = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (isDrawing || isLoreModalOpen || isInventoryOpen || isPauseMenuOpen || isProfileOpen || controlsRef.current?.isLocked || playerState.isDead) return;
        if ((event.target as HTMLElement).closest('button, [role="dialog"], .inventory-panel')) return;
        controlsRef.current?.lock();
    }, [isDrawing, isLoreModalOpen, isInventoryOpen, isPauseMenuOpen, isProfileOpen, playerState.isDead]);

    const exportGLTF = useCallback(() => {
        if (!staffRef.current) return alert("Weapon model not ready.");
        const exporter = new GLTFExporter();
        exporter.parse(staffRef.current, (result) => {
            if (result instanceof ArrayBuffer) {
                const blob = new Blob([result], { type: 'application/octet-stream' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${equippedWeapon.id}.glb`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }
        }, (error) => console.error('GLTF Export Error:', error), { binary: true });
    }, [staffRef, equippedWeapon]);
    
    const handleAskOracle = useCallback(async (query: string) => {
        setIsLoreLoading(true);
        setLoreError("");
        setLoreResponse("");
        try {
            const response = await askOracle(query);
            setLoreResponse(response);
        } catch (e: any) {
            setLoreError(e.message || "An unknown error occurred.");
            setLoreResponse("Ask a question about this world...");
        } finally {
            setIsLoreLoading(false);
        }
    }, []);

    const resetGame = useCallback(() => {
        resetPlayer();
        resetEnemies();
        setProjectiles([]);
        resetState();
        setIsInventoryOpen(false);
        setIsLoreModalOpen(false);
    }, [resetPlayer, resetEnemies, resetState]);

    // Map loading callback
    const handleMapLoaded = useCallback((loadedHeightData: Float32Array) => {
        setHeightData(loadedHeightData);
        setIsMapLoaded(true);
        console.log('Map loaded successfully with heightData length:', loadedHeightData.length);
        console.log('Player spawn position:', playerSpawnPosition);
    }, [playerSpawnPosition]);

    // Debug data update callback
    const updateDebugData = useCallback((data: DebugData) => {
        setDebugData(data);
    }, []);

    // This effect handles the actual firing logic when the animation state changes
    useEffect(() => {
        if (animationState === AnimationState.Discharging) {
            console.log('App: Firing weapon', { weaponType: equippedWeapon.type, weaponId: equippedWeapon.id });
            setTriggerFire(true);
        }
    }, [animationState, equippedWeapon]);


    // Keyboard/Mouse Listeners
    useEffect(() => {
        if (IS_TOUCH_DEVICE || isDrawing) return;
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
            if (isPointerLocked) startCharging();
        };
        const handleMouseUp = (e: MouseEvent) => {
            if (e.button !== 0) return;
             if (isPointerLocked) fire();
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isPointerLocked, startCharging, fire, isDrawing]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT') return;
            if (event.key.toLowerCase() === 't' && !isLoreModalOpen && !isInventoryOpen && !isPauseMenuOpen && !isProfileOpen) handleOpenLoreModal();
            if (event.key.toLowerCase() === 'i' && !isLoreModalOpen && !isPauseMenuOpen && !isProfileOpen) {
                isInventoryOpen ? setIsInventoryOpen(false) : handleOpenInventory();
            }
            if (event.key.toLowerCase() === 'p' && !isLoreModalOpen && !isInventoryOpen && !isPauseMenuOpen) {
                isProfileOpen ? setIsProfileOpen(false) : setIsProfileOpen(true);
            }
            if (event.key === 'Tab') {
                event.preventDefault(); // Prevent default tab behavior
                setIsDebugVisible(!isDebugVisible);
            }
            if (event.key === 'Escape') {
                if (isLoreModalOpen) setIsLoreModalOpen(false);
                else if (isInventoryOpen) setIsInventoryOpen(false);
                else if (isProfileOpen) setIsProfileOpen(false);
                else if (isPauseMenuOpen) setIsPauseMenuOpen(false);
                else setIsPauseMenuOpen(true); // Open pause menu if nothing else is open
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLoreModalOpen, isInventoryOpen, isPauseMenuOpen, isProfileOpen, isDebugVisible, handleOpenLoreModal, handleOpenInventory]);
    
    useEffect(() => { if (!isPointerLocked) resetState(); }, [isPointerLocked, resetState]);
    
    // Debug output
    console.log('Render state:', { isMapLoaded, heightDataLength: heightData?.length, playerSpawnPosition, isPointerLocked });

    return (
        <div id="game-container" className="game-viewport" onClickCapture={requestPointerLock}>
            <GestureHandler 
                isDrawing={isDrawing} 
                setDrawnPoints={ (updater) => {
                    const newPoints = updater(drawnPointsRef.current);
                    drawnPointsRef.current = newPoints;
                    setDrawnPoints(newPoints);
                }}
            />
            <GestureDrawCanvas points={drawnPoints} isDrawing={isDrawing} resultText={gestureResult} />

            <LoreModal isOpen={isLoreModalOpen} onClose={() => setIsLoreModalOpen(false)} onAsk={handleAskOracle} response={loreResponse} isLoading={isLoreLoading} error={loreError}/>
            <InventoryUI isOpen={isInventoryOpen} onClose={() => setIsInventoryOpen(false)} inventory={inventory} equippedWeaponId={equippedWeaponId} onEquip={setEquippedWeaponId} />
            <PauseMenu 
                isOpen={isPauseMenuOpen} 
                onClose={() => setIsPauseMenuOpen(false)}
                onExport={exportGLTF}
                onOpenLoreModal={handleOpenLoreModal}
                onOpenInventory={handleOpenInventory}
                onOpenProfile={() => setIsProfileOpen(true)}
            />
            <SimplePlayerProfileUI 
                isOpen={isProfileOpen} 
                onClose={() => setIsProfileOpen(false)} 
            />

            <div className="damage-flash" style={{ opacity: damageFlash }} />
            {playerState.isDead && <GameOverScreen score={playerState.score} onRestart={resetGame} />}
            {!isPointerLocked && !playerState.isDead && !isLoreModalOpen && !isInventoryOpen && !IS_TOUCH_DEVICE && <StartScreen />}
            
            <GameHUD 
                playerState={playerState} 
                equippedWeapon={equippedWeapon}
                animationState={animationState}
                onExport={exportGLTF}
                onOpenLoreModal={handleOpenLoreModal}
            />
            
            {/* Player Debugger UI - F3 to toggle */}
            {isDebugVisible && <PlayerDebugger 
                debugData={debugData}
                playerState={playerState}
                equippedWeapon={equippedWeapon}
                animationState={animationState}
                isVisible={true}
            />}
            
            <KeyboardControls map={controlMap}>
                 <DrawInputHandler startDrawing={startDrawing} endDrawing={endDrawing} />
                 <Canvas camera={{ fov: 75, position: [0, 5, 10] }} shadows gl={{ antialias: true, powerPreference: 'high-performance' }}>
                     
                     <Sky sunPosition={[10, 10, 5]} />
                     
                     {/* Proper Global Lighting */}
                     <fog attach="fog" args={['#2d202b', 30, 100]} />
                     <ambientLight intensity={0.6} color="#ffffff" />
                     <hemisphereLight color={0x87ceeb} groundColor={0x4a4a4a} intensity={0.8} />
                     <directionalLight
                         position={[20, 20, 10]}
                         intensity={2.0}
                         color="#ffffff"
                         castShadow
                         shadow-mapSize-width={2048}
                         shadow-mapSize-height={2048}
                         shadow-camera-far={150}
                         shadow-camera-left={-100}
                         shadow-camera-right={100}
                         shadow-camera-top={100}
                         shadow-camera-bottom={-100}
                     />
                     
                     {/* Additional fill lighting */}
                     <directionalLight
                         position={[-10, 15, -10]}
                         intensity={0.5}
                         color="#ff8844"
                     />

                     <Physics gravity={[0, -20, 0]}>
                        <CachedMapLoader onMapLoaded={handleMapLoaded} />
                        {isMapLoaded && heightData && (
                            <>
                                <Ground heightData={heightData} />
                                <ScatteredAssets heightData={heightData} />
                            </>
                        )}
                        
                        {/* Fallback ground if map doesn't load */}
                        {!isMapLoaded && (
                            <mesh position={[0, -5, 0]} receiveShadow>
                                <boxGeometry args={[100, 1, 100]} />
                                <meshStandardMaterial color="#654321" />
                            </mesh>
                        )}
                        
                        {/* Always render player */}
                        <UnifiedPlayerController 
                            playerRef={playerRef}
                            position={[playerSpawnPosition.x, playerSpawnPosition.y, playerSpawnPosition.z]}
                            isDead={playerState.isDead}
                            isModalOpen={isLoreModalOpen || isInventoryOpen}
                            isPointerLocked={isPointerLocked}
                            touchMoveInput={touchMoveInput}
                            touchLookInputRef={touchLookInputRef}
                            playerPos={playerPos}
                        />
                        
                        {/* Test cube to verify rendering */}
                        <mesh position={[5, 2, 5]} castShadow>
                            <boxGeometry args={[2, 2, 2]} />
                            <meshStandardMaterial color="#ff0000" />
                        </mesh>
                        {enemies.map(enemy => <RockMonster key={enemy.id} {...enemy} playerPos={playerPos} />)}
                        <EffectsManager />
                        
                        {/* Debug tracker - runs inside Canvas with useFrame */}
                        {heightData && (
                            <PlayerDebugTracker 
                                playerRef={playerRef}
                                heightData={heightData}
                                onUpdate={updateDebugData}
                            />
                        )}
                        {triggerFire && equippedWeapon.type === WeaponType.HitscanChain && (
                           <ChainLightningHandler
                               weaponStats={equippedWeapon.stats}
                               staffTipRef={headRef}
                               onComplete={() => setTriggerFire(false)}
                           />
                        )}
                        <FPVView headRef={headRef} staffRef={staffRef} equippedWeapon={equippedWeapon} animationState={animationState} />
                        {projectiles.map(p => <Fireball key={p.id} {...p} onExpire={handleExpireProjectile} />)}
                     </Physics>

                    {triggerFire && equippedWeapon.type === WeaponType.Projectile && (
                        <ProjectileHandler
                            weaponStats={equippedWeapon.stats}
                            effects={equippedWeapon.effects}
                            staffTipRef={headRef}
                            onComplete={() => setTriggerFire(false)}
                        />
                     )}
                    <ChargingSigil animationState={animationState} equippedWeapon={equippedWeapon} />
                    {!IS_TOUCH_DEVICE && <PointerLockControls ref={controlsRef} onLock={() => setIsPointerLocked(true)} onUnlock={() => { setIsPointerLocked(false); if(isDrawing) endDrawing(); }} />}
                 </Canvas>
            </KeyboardControls>
            
            {IS_TOUCH_DEVICE && !playerState.isDead && <OnScreenControls onMove={setTouchMoveInput} onLook={(vec) => { touchLookInputRef.current = { dx: vec.dx, dy: vec.dy }; }} onFireStart={startCharging} onFireEnd={fire} onDrawStart={startDrawing} onDrawEnd={endDrawing} animationState={animationState} />}
            
            {/* Zustand Test Component - temporarily disabled due to infinite loops */}
            {/* <ZustandGameTest /> */}
        </div>
    );
};

export default App;