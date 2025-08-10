
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import type { AnimationState } from '../../types';
import { AnimationState as AnimStateEnum } from '../../types';
import {
    ORB_DIAMETER,
    RINGS_WIDTH,
    RINGS_THICKNESS,
    COLOR_GILDED,
    COLOR_EMBER,
    RING_SPEED_IDLE,
    RING_SPEED_CHARGED,
    RING_SPEED_DISCHARGE,
    RING_SPEED_DECAY,
} from '../../constants';

// --- Gilded Ring Material (Shader) ---
const GildedRingMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uBase: { value: new THREE.Color(COLOR_GILDED) },
        uEmissive: { value: new THREE.Color(COLOR_EMBER) },
        uEmissiveGain: { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uBase;
        uniform vec3 uEmissive;
        uniform float uEmissiveGain;
        varying vec2 vUv;
        varying vec3 vNormal;
        
        float noise(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

        void main() {
            float scroll = noise(vUv * 20.0 + uTime * 0.1);
            vec3 finalColor = uBase * (0.8 + 0.2 * scroll);
            vec3 emissiveColor = uEmissive * (0.5 + 0.5 * scroll) * uEmissiveGain;
            gl_FragColor = vec4(finalColor + emissiveColor, 1.0);
        }
    `
});


// --- Effects Components ---
const ArcEffect: React.FC<{ radius: number; count?: number; getGain: () => number }> = ({ radius, count = 6, getGain }) => {
    const group = useRef<THREE.Group>(null);
    const material = useMemo(() => new THREE.MeshBasicMaterial({ color: COLOR_EMBER, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), []);
    const geometry = useMemo(() => new THREE.PlaneGeometry(0.14, 0.04), []);

    useFrame(() => {
        if (!group.current) return;
        const t = performance.now() * 0.001;
        const gain = getGain();
        for (let i = 0; i < group.current.children.length; i++) {
            const mesh = group.current.children[i] as THREE.Mesh;
            const phase = t * 1.6 + i * 2.1;
            const y = Math.sin(phase * 1.7) * 0.12;
            mesh.position.set(Math.cos(phase) * radius, y, Math.sin(phase) * radius);
            mesh.lookAt(0, 0, 0);
            (mesh.material as THREE.MeshBasicMaterial).opacity = (0.15 + 0.85 * Math.pow(Math.max(0, Math.sin(phase * 2.0)), 2.0)) * gain;
            mesh.scale.setScalar(0.8 + 0.4 * Math.sin(phase * 3.0 + 1.0) * gain);
        }
    });

    return (
        <group ref={group}>
            {Array.from({ length: count }).map((_, i) => (
                <mesh key={i} geometry={geometry} material={material} />
            ))}
        </group>
    );
};

// --- Rings Component ---
const Rings: React.FC<{ animationState: AnimationState }> = ({ animationState }) => {
    const outerRef = useRef<RapierRigidBody>(null);
    const middleRef = useRef<RapierRigidBody>(null);
    const innerRef = useRef<RapierRigidBody>(null);

    const ringRadius = ORB_DIAMETER / 2 + RINGS_WIDTH / 2;
    const ringGeom = useMemo(() => new THREE.TorusGeometry(ringRadius, RINGS_THICKNESS, 24, 160), [ringRadius]);
    const midGeom = useMemo(() => new THREE.TorusGeometry(ringRadius - RINGS_THICKNESS * 2.5, RINGS_THICKNESS, 24, 160), [ringRadius]);
    const inGeom = useMemo(() => new THREE.TorusGeometry(ringRadius - RINGS_THICKNESS * 5.0, RINGS_THICKNESS, 24, 160), [ringRadius]);
    
    const gildedMaterial = useMemo(() => GildedRingMaterial.clone(), []);

    const getAnimationTargets = () => {
        switch(animationState) {
            case AnimStateEnum.Charging: return { s: RING_SPEED_CHARGED, gain: 0.5 };
            case AnimStateEnum.Charged: return { s: RING_SPEED_CHARGED, gain: 0.7 };
            case AnimStateEnum.Discharging: return { s: RING_SPEED_DISCHARGE, gain: 1.0 };
            case AnimStateEnum.Decay: return { s: RING_SPEED_DECAY, gain: 0.35 };
            default: return { s: RING_SPEED_IDLE, gain: 0.15 };
        }
    };

    useFrame((_, dt) => {
        gildedMaterial.uniforms.uTime.value += dt;
        const { s, gain } = getAnimationTargets();
        gildedMaterial.uniforms.uEmissiveGain.value = THREE.MathUtils.lerp(gildedMaterial.uniforms.uEmissiveGain.value, gain, dt * 6.0);
        
        if (outerRef.current) outerRef.current.setAngvel({ x: 0, y: s.outer, z: 0 }, true);
        if (middleRef.current) middleRef.current.setAngvel({ x: s.middle, y: 0, z: 0 }, true);
        if (innerRef.current) innerRef.current.setAngvel({ x: 0, y: 0, z: s.inner }, true);
    });

    const getGain = () => gildedMaterial.uniforms.uEmissiveGain.value as number;

    return (
        <group>
            <RigidBody ref={outerRef} type="kinematicVelocity" colliders="trimesh">
                <mesh geometry={ringGeom} material={gildedMaterial} />
                <ArcEffect radius={ringRadius + 0.01} count={7} getGain={getGain} />
            </RigidBody>
            <RigidBody ref={middleRef} type="kinematicVelocity" colliders="trimesh">
                <mesh geometry={midGeom} material={gildedMaterial} />
                <ArcEffect radius={ringRadius - RINGS_THICKNESS * 2.5 + 0.01} count={6} getGain={getGain} />
            </RigidBody>
            <RigidBody ref={innerRef} type="kinematicVelocity" colliders="trimesh">
                <mesh geometry={inGeom} material={gildedMaterial} />
                <ArcEffect radius={ringRadius - RINGS_THICKNESS * 5.0 + 0.01} count={5} getGain={getGain} />
            </RigidBody>
        </group>
    );
};

export default Rings;
