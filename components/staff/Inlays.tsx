
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { AnimationState } from '../../types';
import { AnimationState as AnimStateEnum } from '../../types';
import {
    INLAY_COUNT,
    INLAY_TUBE_RADIUS,
    INLAY_HELIX_RADIUS,
    INLAY_HELIX_HEIGHT,
    INLAY_HELIX_TURNS,
    STAFF_SHAFT_LENGTH,
    FERRULE_LENGTH,
    GRIP_LENGTH,
    GRIP_OFFSET_FROM_FERRULE,
    COLOR_INLAY_IDLE,
    INLAY_BRIGHTNESS_IDLE,
    INLAY_BRIGHTNESS_DISCHARGE_PEAK,
} from '../../constants';
import { lerp } from 'three/src/math/MathUtils';

const Inlays: React.FC<{ animationState: AnimationState }> = ({ animationState }) => {
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);

    const helixPoints = useMemo(() => {
        const points = [];
        const height = INLAY_HELIX_HEIGHT;
        const startY = -STAFF_SHAFT_LENGTH / 2 + FERRULE_LENGTH + GRIP_LENGTH + GRIP_OFFSET_FROM_FERRULE;
        for (let i = 0; i <= 100; i++) {
            const t = i / 100;
            points.push(new THREE.Vector3(
                INLAY_HELIX_RADIUS * Math.cos(t * Math.PI * 2 * INLAY_HELIX_TURNS),
                startY + t * height,
                INLAY_HELIX_RADIUS * Math.sin(t * Math.PI * 2 * INLAY_HELIX_TURNS)
            ));
        }
        return new THREE.CatmullRomCurve3(points);
    }, []);
    
    const tubeGeometry = useMemo(() => new THREE.TubeGeometry(helixPoints, 100, INLAY_TUBE_RADIUS, 8, false), [helixPoints]);

    useFrame((_, delta) => {
        if (!materialRef.current) return;
        let targetIntensity: number;
        switch(animationState) {
            case AnimStateEnum.Discharging:
                targetIntensity = INLAY_BRIGHTNESS_DISCHARGE_PEAK;
                break;
            case AnimStateEnum.Charged:
                targetIntensity = INLAY_BRIGHTNESS_IDLE * 1.5;
                break;
            case AnimStateEnum.Decay:
                targetIntensity = lerp(materialRef.current.emissiveIntensity, INLAY_BRIGHTNESS_IDLE, delta * 1.5);
                break;
            default:
                targetIntensity = INLAY_BRIGHTNESS_IDLE;
        }
        materialRef.current.emissiveIntensity = lerp(materialRef.current.emissiveIntensity, targetIntensity, delta * 5.0);
    });

    const inlayMaterial = useMemo(() => 
        new THREE.MeshStandardMaterial({
            color: COLOR_INLAY_IDLE,
            emissive: COLOR_INLAY_IDLE,
            emissiveIntensity: INLAY_BRIGHTNESS_IDLE,
            toneMapped: false,
        })
    , []);

    return (
        <group>
            {Array.from({ length: INLAY_COUNT }).map((_, i) => (
                <mesh key={i} rotation-y={(i / INLAY_COUNT) * Math.PI * 2} geometry={tubeGeometry}>
                   <primitive object={i === 0 ? inlayMaterial : inlayMaterial.clone()} ref={i === 0 ? materialRef : null} attach="material" />
                </mesh>
            ))}
        </group>
    );
};

export default Inlays;
