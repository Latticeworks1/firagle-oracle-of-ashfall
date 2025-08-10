
import type { RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import type { Vector3 } from 'three';

interface PlayerPositionTrackerProps {
    playerRef: React.RefObject<RapierRigidBody>;
    playerPos: Vector3;
}

const PlayerPositionTracker: React.FC<PlayerPositionTrackerProps> = ({ playerRef, playerPos }) => {
    useFrame(() => {
        if (playerRef.current) {
            playerPos.copy(playerRef.current.translation());
        }
    });
    return null;
};

export default PlayerPositionTracker;
