
import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { RigidBody } from '@react-three/rapier';

const rockMaterial = new THREE.MeshStandardMaterial({ color: '#5c544d', roughness: 0.9, metalness: 0.1 });
const boxGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);

const CrumbleEffect: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const pieces = useMemo(() => Array.from({ length: 15 }).map(() => ({
        id: Math.random(),
        position: new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 5, (Math.random() - 0.5) * 4),
    })), []);

    useEffect(() => {
        const timer = setTimeout(onComplete, 2000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <group>
            {pieces.map(p => (
                <RigidBody key={p.id} colliders="cuboid" position={p.position.toArray()} linearVelocity={p.velocity.toArray()} mass={0.2}>
                    <mesh material={rockMaterial} geometry={boxGeometry} />
                </RigidBody>
            ))}
        </group>
    );
};

interface RockMonsterDeathEffectProps {
    position: THREE.Vector3;
    onComplete: () => void;
}

const RockMonsterDeathEffect: React.FC<RockMonsterDeathEffectProps> = ({ position, onComplete }) => {
    return (
        <group position={position}>
            <CrumbleEffect onComplete={onComplete} />
        </group>
    );
};

export default RockMonsterDeathEffect;
