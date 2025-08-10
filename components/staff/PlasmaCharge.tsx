
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { extend, useFrame } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import type { AnimationState, WeaponSchema } from '../../types';
import { AnimationState as AnimStateEnum } from '../../types';
import {
    STAFF_SHAFT_LENGTH,
    FERRULE_LENGTH,
    GRIP_LENGTH,
    GRIP_OFFSET_FROM_FERRULE,
    SHAFT_RADIUS,
    COLOR_PROJECTILE,
} from '../../constants';
import { lerp } from 'three/src/math/MathUtils';

const PlasmaMaterial = shaderMaterial(
  { uTime: 0, uProgress: 0, uColor: new THREE.Color(COLOR_PROJECTILE), uBandHeight: 0.15 },
  ` varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); } `,
  `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uProgress;
    uniform vec3 uColor;
    uniform float uBandHeight;
    float noise(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
        float y = vUv.y;
        float plasma_top = uProgress;
        float plasma_bottom = uProgress - uBandHeight;
        if (y < plasma_bottom || y > plasma_top) discard;
        float band_progress = (y - plasma_bottom) / uBandHeight;
        float intensity = sin(band_progress * 3.14159);
        float flicker = noise(vUv * 20.0 + uTime * 2.0) * 0.5 + 0.5;
        intensity *= flicker;
        gl_FragColor = vec4(uColor, intensity * 0.8);
    }
  `
);

extend({ PlasmaMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    plasmaMaterial: any;
  }
}

const PlasmaCharge: React.FC<{ animationState: AnimationState; weaponStats: WeaponSchema['stats'] }> = ({ animationState, weaponStats }) => {
    const materialRef = useRef<any>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const animationProgress = useRef(0);

    useEffect(() => {
        if (animationState !== AnimStateEnum.Charging) {
            animationProgress.current = 0;
        }
    }, [animationState]);

    useFrame((_, delta) => {
        if (!materialRef.current || !meshRef.current) return;
        
        materialRef.current.uTime += delta;
        const isVisible = animationState === AnimStateEnum.Charging;
        
        if (isVisible) {
            animationProgress.current = Math.min(1, animationProgress.current + (delta / (weaponStats.chargeDuration / 1000)));
        }

        const targetProgress = isVisible ? animationProgress.current : 0;
        materialRef.current.uniforms.uProgress.value = lerp(materialRef.current.uniforms.uProgress.value, targetProgress, delta * 10.0);
        
        meshRef.current.visible = materialRef.current.uniforms.uProgress.value > 0.01;
    });

    const plasmaHeight = STAFF_SHAFT_LENGTH - FERRULE_LENGTH - GRIP_LENGTH - GRIP_OFFSET_FROM_FERRULE;
    const plasmaYOffset = -STAFF_SHAFT_LENGTH / 2 + FERRULE_LENGTH + GRIP_OFFSET_FROM_FERRULE + plasmaHeight / 2;

    return (
        <mesh ref={meshRef} position-y={plasmaYOffset} visible={false}>
            <cylinderGeometry args={[SHAFT_RADIUS * 1.01, SHAFT_RADIUS * 1.01, plasmaHeight, 32, 1, true]} />
            <plasmaMaterial
                ref={materialRef}
                key={PlasmaMaterial.key}
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};

export default PlasmaCharge;