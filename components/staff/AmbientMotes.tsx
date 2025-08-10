
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { AnimationState } from '../../types';
import { AnimationState as AnimStateEnum } from '../../types';
import { ORB_DIAMETER, COLOR_EMBER } from '../../constants';
import { lerp } from 'three/src/math/MathUtils';

const AmbientMotes: React.FC<{ animationState: AnimationState }> = ({ animationState }) => {
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.PointsMaterial>(null);

    const particles = useMemo(() => {
        const count = 5000;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = (ORB_DIAMETER / 2) + Math.random() * ORB_DIAMETER * 1.5;
            const i3 = i * 3;
            positions[i3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = r * Math.cos(phi);
        }
        return positions;
    }, []);

    useFrame((_, delta) => {
        if (!materialRef.current || !pointsRef.current) return;
        pointsRef.current.rotation.y += delta * 0.2;
        pointsRef.current.rotation.x += delta * 0.1;
        
        let targetOpacity = (animationState === AnimStateEnum.Discharging) ? 0.8 : 0;
        if (materialRef.current) {
            materialRef.current.opacity = lerp(materialRef.current.opacity, targetOpacity, delta * 4.0);
        }
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={particles.length / 3} array={particles} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial
                ref={materialRef}
                size={0.02}
                color={COLOR_EMBER}
                sizeAttenuation
                transparent
                opacity={0}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
            />
        </points>
    );
};

export default AmbientMotes;
