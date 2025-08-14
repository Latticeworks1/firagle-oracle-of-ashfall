import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { IS_TOUCH_DEVICE } from '../../constants';

const GRAVITY = 20;
const STEPS_PER_FRAME = 5;

interface UnifiedPlayerControllerProps {
    playerRef: React.RefObject<RapierRigidBody>;
    position: [number, number, number];
    isDead: boolean;
    isModalOpen: boolean;
    isPointerLocked: boolean;
    touchMoveInput: { x: number; y: number };
    touchLookInputRef: React.RefObject<{ dx: number; dy: number }>;
    playerPos: THREE.Vector3;
    children?: React.ReactNode;
}

function useKeyboard() {
    const keyMap = useRef<Record<string, boolean>>({});

    useEffect(() => {
        const onDocumentKey = (e: KeyboardEvent) => {
            keyMap.current[e.code] = e.type === 'keydown';
        };
        document.addEventListener('keydown', onDocumentKey);
        document.addEventListener('keyup', onDocumentKey);
        return () => {
            document.removeEventListener('keydown', onDocumentKey);
            document.removeEventListener('keyup', onDocumentKey);
        };
    }, []);

    return keyMap.current;
}

const UnifiedPlayerController: React.FC<UnifiedPlayerControllerProps> = ({ 
    playerRef, 
    position, 
    isDead, 
    isModalOpen,
    isPointerLocked,
    touchMoveInput,
    touchLookInputRef,
    playerPos,
    children 
}) => {
    const { camera } = useThree();
    const keyboard = useKeyboard();
    
    let rapier;
    try {
        rapier = useRapier();
    } catch (error) {
        console.warn('Rapier not available, using fallback physics');
        rapier = null;
    }
    
    const playerOnFloor = useRef(false);
    const playerVelocity = useMemo(() => new THREE.Vector3(), []);
    const playerDirection = useMemo(() => new THREE.Vector3(), []);
    const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

    function getForwardVector(camera: THREE.Camera, playerDirection: THREE.Vector3) {
        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();
        return playerDirection;
    }

    function getSideVector(camera: THREE.Camera, playerDirection: THREE.Vector3) {
        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();
        playerDirection.cross(camera.up);
        return playerDirection;
    }

    function handleMovementControls(camera: THREE.Camera, delta: number, playerVelocity: THREE.Vector3, playerOnFloor: boolean, playerDirection: THREE.Vector3) {
        if (isDead || isModalOpen) return;
        
        const speedDelta = delta * (playerOnFloor ? 25 : 8);
        
        // Keyboard controls
        if (keyboard['KeyA']) {
            playerVelocity.add(getSideVector(camera, playerDirection).multiplyScalar(-speedDelta));
        }
        if (keyboard['KeyD']) {
            playerVelocity.add(getSideVector(camera, playerDirection).multiplyScalar(speedDelta));
        }
        if (keyboard['KeyW']) {
            playerVelocity.add(getForwardVector(camera, playerDirection).multiplyScalar(speedDelta));
        }
        if (keyboard['KeyS']) {
            playerVelocity.add(getForwardVector(camera, playerDirection).multiplyScalar(-speedDelta));
        }
        
        // Touch controls
        if (IS_TOUCH_DEVICE && (touchMoveInput.x !== 0 || touchMoveInput.y !== 0)) {
            const touchSpeedDelta = speedDelta * 0.5; // Reduce touch sensitivity
            playerVelocity.add(getSideVector(camera, playerDirection).multiplyScalar(touchMoveInput.x * touchSpeedDelta));
            playerVelocity.add(getForwardVector(camera, playerDirection).multiplyScalar(-touchMoveInput.y * touchSpeedDelta));
        }
        
        // Jump - only if grounded
        if (playerOnFloor && keyboard['Space']) {
            // Apply jump directly to rigid body for immediate effect
            if (playerRef.current) {
                const currentVel = playerRef.current.linvel();
                playerRef.current.setLinvel({
                    x: currentVel.x,
                    y: 12, // Jump velocity
                    z: currentVel.z
                }, true);
            }
        }
    }

    function handleLookControls() {
        // Touch look controls
        if (IS_TOUCH_DEVICE && !isPointerLocked && touchLookInputRef.current) {
            const { dx, dy } = touchLookInputRef.current;

            if (dx !== 0 || dy !== 0) {
                euler.setFromQuaternion(camera.quaternion);
                euler.y -= dx * 0.0025;
                euler.x -= dy * 0.0025;
                euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
                camera.quaternion.setFromEuler(euler);
            }
            
            // Reset for next frame
            touchLookInputRef.current.dx = 0;
            touchLookInputRef.current.dy = 0;
        }
    }

    function updatePlayerPhysics(delta: number, playerVelocity: THREE.Vector3, playerOnFloor: boolean) {
        if (!playerRef.current) return playerOnFloor;
        
        let damping = Math.exp(-4 * delta) - 1;
        if (!playerOnFloor) {
            playerVelocity.y -= GRAVITY * delta;
            damping *= 0.1;
        }
        playerVelocity.addScaledVector(playerVelocity, damping);
        
        // Apply velocity to rigid body
        const currentVel = playerRef.current.linvel();
        playerRef.current.setLinvel({
            x: playerVelocity.x,
            y: currentVel.y + playerVelocity.y * delta,
            z: playerVelocity.z
        }, true);
        
        // Proper ground detection using raycast
        try {
            const playerPosition = playerRef.current.translation();
            if (playerPosition && rapier && rapier.world) {
                const rayOrigin = { x: playerPosition.x, y: playerPosition.y - 0.5, z: playerPosition.z };
                const rayDirection = { x: 0, y: -1, z: 0 };
                const maxToi = 0.6; // Ray length
                
                const hit = rapier.world.castRay(rayOrigin, rayDirection, maxToi, true);
                playerOnFloor = hit !== null && hit.toi < 0.15;
            } else {
                // Fallback to velocity check if raycast unavailable
                playerOnFloor = Math.abs(currentVel.y) < 0.1;
            }
        } catch (error) {
            // Fallback to velocity check on error
            playerOnFloor = Math.abs(currentVel.y) < 0.1;
        }
        
        return playerOnFloor;
    }

    function updateCameraPosition() {
        if (!playerRef.current) return;
        
        try {
            // Get player position and update camera to follow
            const playerPosition = playerRef.current.translation();
            
            if (playerPosition) {
                // Update shared player position reference
                playerPos.set(playerPosition.x, playerPosition.y, playerPosition.z);
                
                // Always set camera position for FPV (eye height offset)
                camera.position.set(
                    playerPosition.x, 
                    playerPosition.y + 0.9,
                    playerPosition.z
                );
            }
        } catch (error) {
            console.warn('Error updating camera position:', error);
        }
    }

    function teleportPlayerIfOob() {
        if (!playerRef.current) return;
        
        const pos = playerRef.current.translation();
        if (pos && pos.y <= -100) {
            playerVelocity.set(0, 0, 0);
            const resetPos = { x: position[0] || 0, y: position[1] || 10, z: position[2] || 0 };
            playerRef.current.setTranslation(resetPos, true);
            playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
            camera.position.set(resetPos.x, resetPos.y + 0.9, resetPos.z);
            camera.rotation.set(0, 0, 0);
        }
    }

    useFrame(({ camera }, delta) => {
        if (!playerRef.current) return;
        
        // Handle all controls
        handleMovementControls(camera, delta, playerVelocity, playerOnFloor.current, playerDirection);
        handleLookControls();
        
        // Update physics in steps
        const deltaSteps = Math.min(0.05, delta) / STEPS_PER_FRAME;
        for (let i = 0; i < STEPS_PER_FRAME; i++) {
            playerOnFloor.current = updatePlayerPhysics(deltaSteps, playerVelocity, playerOnFloor.current);
        }
        
        // Update camera and position tracking
        updateCameraPosition();
        teleportPlayerIfOob();
    });

    return (
        <RigidBody 
            ref={playerRef}
            position={position}
            type="dynamic"
            colliders={false}
            lockRotations
        >
            <CapsuleCollider args={[0.5, 0.5]} />
            {children}
        </RigidBody>
    );
};

export default UnifiedPlayerController;