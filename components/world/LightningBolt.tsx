
import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';

const LightningMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#9479ff'),
    uOpacity: 1.0,
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    float noise(vec2 p) { return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      float flicker = noise(vUv * 30.0 + uTime * 40.0) * 0.4 + 0.6;
      float core = pow(smoothstep(0.0, 1.0, 1.0 - abs(vUv.y - 0.5) * 2.0), 10.0);
      float glow = pow(smoothstep(0.0, 1.0, 1.0 - abs(vUv.y - 0.5) * 2.0), 2.0);
      vec3 finalColor = uColor * (glow * 0.5 + core * 0.5) * flicker;
      gl_FragColor = vec4(finalColor, (glow + core) * uOpacity);
    }
  `
);

extend({ LightningMaterial });

// This is necessary for TypeScript to recognize the custom material
declare module '@react-three/fiber' {
  interface ThreeElements {
    lightningMaterial: any;
  }
}

const FADE_DURATION = 0.5; // seconds

interface LightningBoltProps {
    points: THREE.Vector3[];
    onComplete: () => void;
}

const LightningBolt: React.FC<LightningBoltProps> = ({ points, onComplete }) => {
    const materialRef = useRef<any>(null);
    const elapsed = useRef(0);

    const curve = useMemo(() => {
        if (points.length < 2) return null;
        const jaggedPoints = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const start = points[i - 1];
            const end = points[i];
            const dist = start.distanceTo(end);
            const midpointsCount = Math.max(2, Math.floor(dist * 1.5));
            for (let j = 1; j < midpointsCount; j++) {
                const t = j / midpointsCount;
                const mid = new THREE.Vector3().lerpVectors(start, end, t);
                mid.add(new THREE.Vector3(
                    (Math.random() - 0.5) * dist * 0.1,
                    (Math.random() - 0.5) * dist * 0.1,
                    (Math.random() - 0.5) * dist * 0.1
                ));
                jaggedPoints.push(mid);
            }
            jaggedPoints.push(end);
        }
        return new THREE.CatmullRomCurve3(jaggedPoints);
    }, [points]);

    const geometry = useMemo(() => {
        if (!curve) return null;
        return new THREE.TubeGeometry(curve, 64, 0.08, 8, false);
    }, [curve]);

    useEffect(() => {
        const timer = setTimeout(onComplete, FADE_DURATION * 1000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    useFrame((_, delta) => {
        if (!materialRef.current) return;
        elapsed.current += delta;
        const progress = Math.min(elapsed.current / FADE_DURATION, 1);
        materialRef.current.uTime += delta;
        materialRef.current.uOpacity = (1.0 - progress);
    });

    if (!geometry) return null;

    return (
        <mesh geometry={geometry}>
            <lightningMaterial
                ref={materialRef}
                key={LightningMaterial.key}
                blending={THREE.AdditiveBlending}
                transparent
                depthWrite={false}
                toneMapped={false}
            />
        </mesh>
    );
};

export default LightningBolt;
