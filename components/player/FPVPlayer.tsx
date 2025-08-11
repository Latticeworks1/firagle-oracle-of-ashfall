
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import type { Controls, UserData } from '../../types';
import { Controls as ControlsEnum } from '../../types';
import { MOVEMENT_SPEED } from '../../constants';
import { eventBus } from '../../systems/eventBus';

interface FPVPlayerProps {
    playerRef: React.RefObject<RapierRigidBody>;
    touchMoveInput: { x: number; y: number };
    spawnPosition?: [number, number, number];
}

const FPVPlayer: React.FC<FPVPlayerProps> = ({ playerRef, touchMoveInput, spawnPosition = [0, 35, 0] }) => {
    const [, getControls] = useKeyboardControls<ControlsEnum>();
    const frontVector = useMemo(() => new THREE.Vector3(), []);
    const sideVector = useMemo(() => new THREE.Vector3(), []);
    const direction = useMemo(() => new THREE.Vector3(), []);
    const speedVec = useMemo(() => new THREE.Vector3(), []);
    
    const userData = useMemo<UserData>(() => ({ type: 'player' }), []);

    useFrame((state) => {
        if (!playerRef.current) return;
        const { forward, backward, left, right } = getControls();

        const f = (backward ? 1 : 0) - (forward ? 1 : 0);
        const s = (left ? 1 : 0) - (right ? 1 : 0);
        
        frontVector.set(0, 0, f + touchMoveInput.y);
        sideVector.set(s + touchMoveInput.x, 0, 0);

        direction.addVectors(frontVector, sideVector);
        
        // Only apply movement if there's input
        if (direction.length() > 0) {
            direction.normalize().multiplyScalar(MOVEMENT_SPEED).applyEuler(state.camera.rotation);
            
            const currentVel = playerRef.current.linvel();
            speedVec.set(direction.x, currentVel.y, direction.z);
            playerRef.current.setLinvel(speedVec, true);
        } else {
            // Stop horizontal movement if no input
            const currentVel = playerRef.current.linvel();
            speedVec.set(0, currentVel.y, 0);
            playerRef.current.setLinvel(speedVec, true);
        }
        
        // Emit position update for other systems (not camera - camera follows directly)
        const worldPos = playerRef.current.translation();
        eventBus.dispatch('PLAYER_POSITION_UPDATED', { 
            position: new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z) 
        });
    });

    return (
        <RigidBody ref={playerRef} colliders={false} mass={1} type="dynamic" enabledRotations={[false, true, false]} position={spawnPosition} userData={userData}>
            <CapsuleCollider args={[0.9, 0.4]} />
        </RigidBody>
    );
};

export default FPVPlayer;
