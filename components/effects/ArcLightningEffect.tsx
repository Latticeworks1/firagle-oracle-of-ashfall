import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const LIGHTNING_COLOR = new THREE.Color('#9bbff2');
const FADE_DURATION = 0.5; // in seconds

interface ArcLightningEffectProps {
    points: THREE.Vector3[];
    onComplete: () => void;
}

const ArcLightningEffect: React.FC<ArcLightningEffectProps> = ({ points, onComplete }) => {
    const materialRef = useRef<THREE.MeshBasicMaterial>(null);
    const elapsed = useRef(0);

    const curve = useMemo(() => {
        if (points.length < 2) return null;
        // Jitter the intermediate points to make the arc look jagged
        const jaggedPoints = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const start = points[i-1];
            const end = points[i];
            const midpointsCount = Math.floor(start.distanceTo(end) * 2); // more segments for longer arcs
            for (let j = 1; j < midpointsCount; j++) {
                const t = j / midpointsCount;
                const mid = new THREE.Vector3().lerpVectors(start, end, t);
                mid.add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.4,
                    (Math.random() - 0.5) * 0.4,
                    (Math.random() - 0.5) * 0.4
                ));
                jaggedPoints.push(mid);
            }
            jaggedPoints.push(end);
        }
        return new THREE.CatmullRomCurve3(jaggedPoints);
    }, [points]);

    const geometry = useMemo(() => {
        if (!curve) return null;
        return new THREE.TubeGeometry(curve, 64, 0.05, 8, false);
    }, [curve]);

    useEffect(() => {
        const timer = setTimeout(onComplete, FADE_DURATION * 1000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    useFrame((_, delta) => {
        if (!materialRef.current) return;
        elapsed.current += delta;
        const progress = Math.min(elapsed.current / FADE_DURATION, 1);
        
        // Fade out
        materialRef.current.opacity = (1 - progress) * 0.9;

        // Flicker effect
        if (Math.random() > 0.8) {
             materialRef.current.color.setScalar(1.5);
        } else {
             materialRef.current.color.copy(LIGHTNING_COLOR);
        }
    });

    if (!geometry) return null;

    return (
        <mesh geometry={geometry}>
            <meshBasicMaterial 
                ref={materialRef}
                color={LIGHTNING_COLOR}
                blending={THREE.AdditiveBlending}
                transparent
                depthWrite={false}
                toneMapped={false}
            />
        </mesh>
    );
};

export default ArcLightningEffect;