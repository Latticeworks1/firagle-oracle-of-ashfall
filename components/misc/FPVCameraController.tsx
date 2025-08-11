import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

interface FPVCameraControllerProps {
    playerRef: React.RefObject<RapierRigidBody>;
    isActive: boolean;
}

/**
 * Controls camera position to follow player in first-person view.
 * Camera rotation is handled by PointerLockControls, this handles position.
 */
const FPVCameraController: React.FC<FPVCameraControllerProps> = ({ 
    playerRef, 
    isActive 
}) => {
    const { camera } = useThree();
    
    useFrame(() => {
        if (!isActive || !playerRef.current) return;
        
        // Get player position
        const playerPos = playerRef.current.translation();
        
        // Set camera position to player position + eye height offset
        camera.position.set(
            playerPos.x, 
            playerPos.y + 0.9, // Eye height offset (0.9 units above player center)
            playerPos.z
        );
    });

    return null; // This component doesn't render anything
};

export default FPVCameraController;