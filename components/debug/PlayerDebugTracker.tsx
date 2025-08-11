import React from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { getTerrainHeightAtPosition } from '../../utils/noise';

export interface DebugData {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    terrainHeight: number;
    heightAboveTerrain: number;
    isGrounded: boolean;
    mass: number;
    rotationY: number;
}

interface PlayerDebugTrackerProps {
    playerRef: React.RefObject<RapierRigidBody>;
    heightData: Float32Array;
    onUpdate: (data: DebugData) => void;
}

/**
 * This component runs inside the R3F Canvas and uses useFrame to track player physics data.
 * It renders nothing in 3D space but passes data to the UI component outside the Canvas.
 */
const PlayerDebugTracker: React.FC<PlayerDebugTrackerProps> = ({ 
    playerRef, 
    heightData, 
    onUpdate 
}) => {
    useFrame(() => {
        if (!playerRef.current) return;

        const body = playerRef.current;
        const position = new THREE.Vector3().copy(body.translation());
        const velocity = new THREE.Vector3().copy(body.linvel());
        const rotation = body.rotation();
        
        const terrainHeight = getTerrainHeightAtPosition(position.x, position.z, heightData);
        const heightAboveTerrain = position.y - terrainHeight;
        const isGrounded = heightAboveTerrain < 1.1; // Account for player capsule height

        const debugData: DebugData = {
            position,
            velocity,
            terrainHeight,
            heightAboveTerrain,
            isGrounded,
            mass: body.mass(),
            rotationY: rotation.y
        };

        onUpdate(debugData);
    });

    // This component renders nothing in 3D space
    return null;
};

export default PlayerDebugTracker;