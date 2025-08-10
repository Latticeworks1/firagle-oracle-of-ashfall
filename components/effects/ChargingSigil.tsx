

import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { AnimationState, WeaponSchema } from '../../types';
import { AnimationState as AnimStateEnum, WeaponType } from '../../types';
import { COLOR_PROJECTILE } from '../../constants';
import { lerp } from 'three/src/math/MathUtils';

const Glyph: React.FC = () => {
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        s.moveTo(0, 0.5);
        s.lineTo(0.25, 0.1);
        s.lineTo(0.1, 0.1);
        s.lineTo(0, -0.3);
        s.lineTo(-0.5, 0.1);
        s.lineTo(-0.25, 0.1);
        s.closePath();
        return s;
    }, []);
    return <extrudeGeometry args={[shape, { steps: 1, depth: 0.01, bevelEnabled: false }]} />;
};

const ChargingSigil: React.FC<{ animationState: AnimationState, equippedWeapon: WeaponSchema }> = ({ animationState, equippedWeapon }) => {
    const groupRef = useRef<THREE.Group>(null);
    const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
    const { camera } = useThree();
    
    const sigilColor = useMemo(() => {
        return equippedWeapon.type === WeaponType.HitscanChain
            ? new THREE.Color('#944dff')
            : new THREE.Color(COLOR_PROJECTILE);
    }, [equippedWeapon.type]);

    const material = useMemo(() => new THREE.MeshBasicMaterial({ color: sigilColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [sigilColor]);
    
    const animationProgress = useRef(0);

    useEffect(() => {
        if (animationState === AnimStateEnum.Charging) {
            animationProgress.current = 0;
        }
    }, [animationState]);

    useFrame((_, delta) => {
        if (!groupRef.current) return;

        const isChargingOrCharged = animationState === AnimStateEnum.Charging || animationState === AnimStateEnum.Charged;
        let targetScale: number, targetOpacity: number;

        if (isChargingOrCharged) {
            groupRef.current.visible = true;
            groupRef.current.position.lerp(camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(2.5)), delta * 20);
            groupRef.current.quaternion.slerp(camera.quaternion, delta * 20);
            
            if (animationState === AnimStateEnum.Charging) {
                animationProgress.current = Math.min(1, animationProgress.current + delta / (equippedWeapon.stats.chargeDuration / 1000));
                targetScale = lerp(0.01, 1, animationProgress.current);
                targetOpacity = lerp(0, 0.8, animationProgress.current);
            } else { // Charged
                animationProgress.current = 1;
                targetScale = 1 + Math.sin(performance.now() * 0.005) * 0.05;
                targetOpacity = 1;
            }
        } else {
            targetScale = lerp(groupRef.current.scale.x, 0, delta * 15);
            targetOpacity = lerp(material.opacity, 0, delta * 15);
        }

        groupRef.current.scale.setScalar(lerp(groupRef.current.scale.x, targetScale, delta * 10));
        material.opacity = lerp(material.opacity, targetOpacity, delta * 10);

        if (material.opacity < 0.01 && !isChargingOrCharged) {
            groupRef.current.visible = false;
        }

        const speedMultiplier = animationProgress.current * (animationState === AnimStateEnum.Charged ? 1.5 : 1.0);
        if (refs[2].current) refs[2].current.rotation.z += delta * 1.5 * speedMultiplier;
        if (refs[1].current) refs[1].current.rotation.z -= delta * 1.0 * speedMultiplier;
        if (refs[0].current) refs[0].current.rotation.z += delta * 0.7 * speedMultiplier;
    });

    const baseRadius = 0.5;
    return (
        <group ref={groupRef} visible={false}>
            <mesh ref={refs[0]} material={material}><torusGeometry args={[baseRadius * 1.1, 0.01, 16, 100]} /></mesh>
            <mesh ref={refs[1]} material={material}><torusGeometry args={[baseRadius * 0.7, 0.02, 16, 100]} /></mesh>
            <mesh ref={refs[2]} material={material}><torusGeometry args={[baseRadius * 0.4, 0.01, 16, 100]} /></mesh>
            {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map(rot => (
                 <mesh key={rot} rotation-z={rot} position={[Math.cos(rot) * baseRadius * 0.9, Math.sin(rot) * baseRadius * 0.9, 0]} material={material} scale={0.25}><Glyph /></mesh>
            ))}
        </group>
    );
};

export default ChargingSigil;