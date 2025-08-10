
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AnimationState, type WeaponSchema } from '../../types';
import Inlays from './Inlays';
import PlasmaCharge from './PlasmaCharge';
import {
    STAFF_SHAFT_LENGTH,
    FERRULE_LENGTH,
    GRIP_LENGTH,
    GRIP_OFFSET_FROM_FERRULE,
    SHAFT_RADIUS,
    COLOR_DARKSTEEL,
    COLOR_WYVERNHIDE,
    COLOR_EMBER
} from '../../constants';

// Material Factory Functions
const makeDarksteelMaterial = () => {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLOR_DARKSTEEL), metalness: 0.95, roughness: 0.32 });
    // This is a simplified version for brevity. Can be expanded with onBeforeCompile for more detail.
    return mat;
};

const makeLeatherMaterial = () => {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(COLOR_WYVERNHIDE), metalness: 0.05, roughness: 0.85 });
};

// Sub-components
const ChamferRing: React.FC<{ r?: number, R?: number, segments?: number, color?: string }> = ({ r = 0.02, R = 0.0018, segments = 48, color = COLOR_DARKSTEEL }) => {
    return (
        <mesh>
            <torusGeometry args={[r, R, 10, segments]} />
            <meshStandardMaterial color={color} metalness={0.9} roughness={0.25} />
        </mesh>
    );
};

const HelixInlay: React.FC<{ radius: number; pitch?: number; turns?: number; thickness?: number; glow?: string; gain?: number }> = ({
    radius,
    pitch = 0.08,
    turns = 2.25,
    thickness = 0.004,
    glow = COLOR_EMBER,
    gain = 0.0,
}) => {
    const curve = useMemo(() => {
        const points: THREE.Vector3[] = [];
        const steps = 240;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * turns * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(t) * radius, (i / steps - 0.5) * turns * pitch, Math.sin(t) * radius));
        }
        return new THREE.CatmullRomCurve3(points);
    }, [radius, pitch, turns]);

    const geo = useMemo(() => new THREE.TubeGeometry(curve, 480, thickness, 12, false), [curve, thickness]);
    const matRef = React.useRef<THREE.MeshBasicMaterial>(null!);

    useFrame(() => {
        if(matRef.current) {
            matRef.current.opacity = THREE.MathUtils.lerp(matRef.current.opacity, 0.35 + 0.65 * gain, 0.1);
        }
    });

    return <mesh geometry={geo}>
        <meshBasicMaterial ref={matRef} color={new THREE.Color(glow)} transparent blending={THREE.AdditiveBlending} opacity={0} depthWrite={false} />
    </mesh>;
};


const StaffBody: React.FC<{ animationState: AnimationState; weaponStats: WeaponSchema['stats'] }> = ({ animationState, weaponStats }) => {
    const darksteelMaterial = useMemo(() => makeDarksteelMaterial(), []);
    const leatherMaterial = useMemo(() => makeLeatherMaterial(), []);

    const glowGain = 
        animationState === AnimationState.Discharging ? 1.0 :
        animationState === AnimationState.Charged ? 0.75 :
        animationState === AnimationState.Charging ? 0.4 :
        animationState === AnimationState.Decay ? 0.25 : 0.12;

    return (
        <group>
            {/* Main Shaft */}
            <mesh material={darksteelMaterial}>
                <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, STAFF_SHAFT_LENGTH, 48]} />
            </mesh>

            {/* Grip */}
            <group position={[0, -STAFF_SHAFT_LENGTH / 2 + FERRULE_LENGTH + GRIP_OFFSET_FROM_FERRULE, 0]}>
                <mesh material={leatherMaterial} position={[0, GRIP_LENGTH / 2, 0]}>
                    <cylinderGeometry args={[SHAFT_RADIUS * 1.055, SHAFT_RADIUS * 1.055, GRIP_LENGTH, 32]} />
                </mesh>
                <group position={[0, GRIP_LENGTH, 0]}><ChamferRing r={SHAFT_RADIUS * 1.02} /></group>
                <group position={[0, 0, 0]}><ChamferRing r={SHAFT_RADIUS * 1.02} /></group>
            </group>

            {/* Ferrule (Bottom Tip) */}
            <group position={[0, -STAFF_SHAFT_LENGTH / 2 + FERRULE_LENGTH / 2, 0]}>
                <mesh material={darksteelMaterial}>
                    <coneGeometry args={[SHAFT_RADIUS * 1.02, FERRULE_LENGTH, 48]} />
                </mesh>
                <group position={[0, FERRULE_LENGTH / 2, 0]}><ChamferRing r={SHAFT_RADIUS * 1.04} /></group>
                <mesh material={darksteelMaterial} position={[0, -FERRULE_LENGTH / 2 - SHAFT_RADIUS * 0.5, 0]}>
                    <coneGeometry args={[SHAFT_RADIUS * 0.6, SHAFT_RADIUS * 1.1, 32]} />
                </mesh>
            </group>
            
            {/* Top Rings */}
            <group position={[0, STAFF_SHAFT_LENGTH / 2 - SHAFT_RADIUS * 1.6, 0]}>
                <ChamferRing r={SHAFT_RADIUS * 1.08} />
                <ChamferRing r={SHAFT_RADIUS * 1.14} position-y={0.005} />
            </group>

            {/* Decorative Helices */}
            <group>
                <HelixInlay radius={SHAFT_RADIUS * 0.82} pitch={0.11} turns={2.6} thickness={0.0035} gain={glowGain} />
                <HelixInlay radius={SHAFT_RADIUS * 0.82} pitch={-0.11} turns={2.6} thickness={0.0035} gain={glowGain} />
            </group>

            <Inlays animationState={animationState} />
            <PlasmaCharge animationState={animationState} weaponStats={weaponStats} />
        </group>
    );
};

export default StaffBody;
