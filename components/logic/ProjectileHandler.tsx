

import React, { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ProjectileWeaponSchema, WeaponFiredPayload } from '../../types';
import { eventBus } from '../../systems/eventBus';

interface ProjectileHandlerProps {
    weaponStats: ProjectileWeaponSchema['stats'];
    effects: ProjectileWeaponSchema['effects'];
    staffTipRef: React.RefObject<THREE.Group>;
    onComplete: () => void;
}

const ProjectileHandler: React.FC<ProjectileHandlerProps> = ({ weaponStats, effects, staffTipRef, onComplete }) => {
    const { camera } = useThree();

    useEffect(() => {
        if (!staffTipRef.current) {
            onComplete();
            return;
        };

        const startPos = staffTipRef.current.getWorldPosition(new THREE.Vector3());
        const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
        const velocity = cameraDirection.multiplyScalar(weaponStats.projectileSpeed);

        const payload: WeaponFiredPayload = {
            id: THREE.MathUtils.generateUUID(),
            start: startPos,
            velocity: velocity,
            visualType: effects.projectileVisual,
        };
        
        eventBus.dispatch<WeaponFiredPayload>('WEAPON_FIRED', payload);

        onComplete();
    // This effect should run only once when the component is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null; // This component does not render anything
};

export default ProjectileHandler;
