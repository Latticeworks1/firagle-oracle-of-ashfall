
import React, { useRef, forwardRef } from 'react';
import type { Group, PointLight } from 'three';
import { useFrame } from '@react-three/fiber';
import Orb from './Orb';
import Rings from './Rings';
import AmbientMotes from './AmbientMotes';
import { AnimationState } from '../../types';
import { STAFF_SHAFT_LENGTH, HEAD_ASSEMBLY_HEIGHT, COLOR_PROJECTILE } from '../../constants';
import { lerp } from 'three/src/math/MathUtils';

interface HeadAssemblyProps {
    animationState: AnimationState;
}

const HeadAssembly = forwardRef<Group, HeadAssemblyProps>(({ animationState }, ref) => {
    const lightRef = useRef<PointLight>(null);

    useFrame((_, delta) => {
        if (!lightRef.current) return;
        const targetIntensity = animationState === AnimationState.Discharging ? 30.0 : 0;
        lightRef.current.intensity = lerp(lightRef.current.intensity, targetIntensity, delta * 15);
    });

    return (
        <group ref={ref} position={[0, (STAFF_SHAFT_LENGTH / 2) + (HEAD_ASSEMBLY_HEIGHT / 2), 0]}>
            <pointLight ref={lightRef} color={COLOR_PROJECTILE} intensity={0} distance={6} decay={2} />
            <Orb animationState={animationState} />
            <Rings animationState={animationState} />
            <AmbientMotes animationState={animationState} />
        </group>
    );
});

HeadAssembly.displayName = 'HeadAssembly';

export default HeadAssembly;
