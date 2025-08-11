import React, { useEffect } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { eventBus } from '../../systems/eventBus';
import * as THREE from 'three';

/**
 * Simple declarative camera that follows player position via event bus
 */
const PlayerCamera: React.FC = () => {
  const { camera } = useThree();

  useEffect(() => {
    const handlePlayerPositionUpdate = ({ position }: { position: THREE.Vector3 }) => {
      camera.position.copy(position);
    };

    eventBus.on('PLAYER_POSITION_UPDATED', handlePlayerPositionUpdate);
    return () => eventBus.off('PLAYER_POSITION_UPDATED', handlePlayerPositionUpdate);
  }, [camera]);

  return (
    <PerspectiveCamera 
      makeDefault 
      fov={75}
      near={0.1}
      far={1000}
    />
  );
};

export default PlayerCamera;