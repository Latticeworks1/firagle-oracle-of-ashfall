
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { IS_TOUCH_DEVICE } from '../../constants';

interface CameraLookControllerProps {
    isPointerLocked: boolean;
    touchLookInputRef: React.RefObject<{ dx: number; dy: number }>;
}

const CameraLookController: React.FC<CameraLookControllerProps> = ({ isPointerLocked, touchLookInputRef }) => {
    const { camera } = useThree();
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');

    useFrame(() => {
        if (isPointerLocked || !IS_TOUCH_DEVICE || !touchLookInputRef.current) return;

        const { dx, dy } = touchLookInputRef.current;

        if (dx !== 0 || dy !== 0) {
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= dx * 0.0025; // sensitivity
            euler.x -= dy * 0.0025;
            euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
            camera.quaternion.setFromEuler(euler);
        }
        
        // Reset for next frame
        touchLookInputRef.current.dx = 0;
        touchLookInputRef.current.dy = 0;
    });

    return null;
};

export default CameraLookController;
