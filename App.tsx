

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
import { generateHeightData } from './utils/noise';

// UI Components
import FPVUI from './components/ui/FPVUI';
import LoreModal from './components/ui/LoreModal';
import GameOverScreen from './components/ui/GameOverScreen';
import StartScreen from './components/ui/StartScreen';
import OnScreenControls from './components/ui/OnScreenControls';
import InventoryUI from './components/ui/InventoryUI';
import GameHUD from './components/ui/GameHUD';
import GestureDrawCanvas from './components/ui/GestureDrawCanvas';

// 3D Components
import { Physics } from '@react-three/rapier';
import EffectsManager from './systems/EffectsManager';
import FPVPlayer from './components/player/FPVPlayer';
import FPVView from './components/player/FPVView';
import Ground from './components/world/Ground';
import ScatteredAssets from './components/world/ScatteredAssets';
import Fireball from './components/world/Fireball';
import RockMonster from './components/enemy/RockMonster';
import ChargingSigil from './components/effects/ChargingSigil';
import CameraLookController from './components/misc/CameraLookController';
import PlayerPositionTracker from './components/misc/PlayerPositionTracker';
import ChainLightningHandler from './components/effects/ChainLightningHandler';
import ProjectileHandler from './components/logic/ProjectileHandler';


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

    // Lore Modal State
    const [isLoreModalOpen, setIsLoreModalOpen] = useState(false);
    const [loreResponse, setLoreResponse] = useState("Ask a question about this world...");
    const [isLoreLoading, setIsLoreLoading] = useState(false);
    const [loreError, setLoreError] = useState("");

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

    const { enemies, resetEnemies } = useEnemyManager(
        (isPointerLocked || IS_TOUCH_DEVICE) && !playerState.isDead && !isLoreModalOpen && !isInventoryOpen,
        playerPos
    );
        
    const heightData = useMemo(() => generateHeightData(), []);

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
      if (playerState.isDead || isInventoryOpen || isLoreModalOpen) return;
      if (controlsRef.current?.isLocked) controlsRef.current.unlock();
      setDrawnPoints([]);
      drawnPointsRef.current = [];
      setIsDrawing(true);
    }, [playerState.isDead, isInventoryOpen, isLoreModalOpen]);

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
        if (isDrawing || isLoreModalOpen || isInventoryOpen || controlsRef.current?.isLocked || playerState.isDead) return;
        if ((event.target as HTMLElement).closest('button, [role="dialog"], .inventory-panel')) return;
        controlsRef.current?.lock();
    }, [isDrawing, isLoreModalOpen, isInventoryOpen, playerState.isDead]);

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

    // This effect handles the actual firing logic when the animation state changes
    useEffect(() => {
        if (animationState === AnimationState.Discharging) {
            setTriggerFire(true);
        }
    }, [animationState]);


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
            if (event.key.toLowerCase() === 't' && !isLoreModalOpen && !isInventoryOpen) handleOpenLoreModal();
            if (event.key.toLowerCase() === 'i' && !isLoreModalOpen) {
                isInventoryOpen ? setIsInventoryOpen(false) : handleOpenInventory();
            }
            if (event.key === 'Escape') {
                if (isLoreModalOpen) setIsLoreModalOpen(false);
                if (isInventoryOpen) setIsInventoryOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLoreModalOpen, isInventoryOpen, handleOpenLoreModal, handleOpenInventory]);
    
    useEffect(() => { if (!isPointerLocked) resetState(); }, [isPointerLocked, resetState]);
    
    return (
        <div id="game-container" className="w-screen h-screen relative bg-black" onClickCapture={requestPointerLock}>
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

            <div className="absolute inset-0 z-20 pointer-events-none bg-red-600 transition-opacity duration-500" style={{ opacity: damageFlash }} />
            {playerState.isDead && <GameOverScreen score={playerState.score} onRestart={resetGame} />}
            {!isPointerLocked && !playerState.isDead && !isLoreModalOpen && !isInventoryOpen && !IS_TOUCH_DEVICE && <StartScreen />}
            
            <FPVUI state={animationState} onExport={exportGLTF} onOpenLoreModal={handleOpenLoreModal}/>
            <GameHUD playerState={playerState} equippedWeapon={equippedWeapon} />
            
            <KeyboardControls map={controlMap}>
                 <DrawInputHandler startDrawing={startDrawing} endDrawing={endDrawing} />
                 <Canvas camera={{ fov: 75 }} shadows gl={{ antialias: true, powerPreference: 'high-performance' }}>
                     <CameraLookController isPointerLocked={isPointerLocked} touchLookInputRef={touchLookInputRef} />
                     <PlayerPositionTracker playerRef={playerRef} playerPos={playerPos} />
                     
                     <Sky sunPosition={[10, 10, 5]} />
                     
                     {/* New Atmospheric Lighting */}
                     <fog attach="fog" args={['#2d202b', 15, 70]} />
                     <ambientLight intensity={0.15} color="#ff8844" />
                     <hemisphereLight color={0x4c549e} groundColor={0x702d1d} intensity={0.5} />
                     <directionalLight
                         position={[10, 10, 5]}
                         intensity={1.5}
                         color="#b8d5ff"
                         castShadow
                         shadow-mapSize-width={2048}
                         shadow-mapSize-height={2048}
                         shadow-camera-far={100}
                         shadow-camera-left={-50}
                         shadow-camera-right={50}
                         shadow-camera-top={50}
                         shadow-camera-bottom={-50}
                     />

                     <Physics gravity={[0, -20, 0]}>
                        <Ground heightData={heightData} />
                        <ScatteredAssets heightData={heightData} />
                        <FPVPlayer playerRef={playerRef} touchMoveInput={touchMoveInput} />
                        {enemies.map(enemy => <RockMonster key={enemy.id} {...enemy} playerPos={playerPos} />)}
                        <EffectsManager />
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
        </div>
    );
};

export default App;