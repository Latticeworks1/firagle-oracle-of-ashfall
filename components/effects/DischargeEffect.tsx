
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { lerp } from 'three/src/math/MathUtils';

const DURATION = 250; // ms

interface DischargeEffectProps {
  position: THREE.Vector3;
  color: THREE.Color;
  onComplete: () => void;
}

const DischargeEffect: React.FC<DischargeEffectProps> = ({ position, color, onComplete }) => {
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);

  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), [color]);

  const planeGeom = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useFrame((state, delta) => {
    elapsed.current += delta * 1000;
    const t = Math.min(elapsed.current / DURATION, 1.0);

    if (!groupRef.current) return;
    
    // Animate scale and opacity
    const scale = lerp(0.1, 1.2, t) * (1 - t);
    const opacity = Math.sin(t * Math.PI); // A nice curve that starts and ends at 0

    groupRef.current.scale.setScalar(scale);
    material.opacity = opacity;

    // Look at camera
    groupRef.current.quaternion.copy(state.camera.quaternion);

    if (t >= 1.0) {
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={position}>
        {/* Create a starburst shape with multiple planes */}
        <mesh geometry={planeGeom} material={material} scale={[1, 0.15, 1]} />
        <mesh geometry={planeGeom} material={material} scale={[1, 0.15, 1]} rotation-z={Math.PI / 2} />
        <mesh geometry={planeGeom} material={material} scale={[0.7, 0.1, 1]} rotation-z={Math.PI / 4} />
        <mesh geometry={planeGeom} material={material} scale={[0.7, 0.1, 1]} rotation-z={-Math.PI / 4} />
    </group>
  );
};

export default DischargeEffect;
