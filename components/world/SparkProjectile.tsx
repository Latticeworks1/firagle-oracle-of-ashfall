import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider, RapierRigidBody, IntersectionEnterPayload } from '@react-three/rapier';
import type { UserData, Projectile } from '../../types';
import { PROJECTILE_LIFESPAN } from '../../constants';

interface SparkProjectileProps extends Projectile {
  onExpire: (id: string) => void;
  onHit: (id: string, hit: { type: UserData['type'], enemyId?: string, position: THREE.Vector3 }) => void;
}

const SparkProjectile: React.FC<SparkProjectileProps> = ({ id, onExpire, onHit, start, velocity }) => {
    const bodyRef = useRef<RapierRigidBody>(null);
    const userData = useMemo<UserData>(() => ({ type: 'spark', id }), [id]);

    useEffect(() => {
        const timer = setTimeout(() => onExpire(id), PROJECTILE_LIFESPAN);
        return () => clearTimeout(timer);
    }, [id, onExpire]);

    useFrame((_, delta) => {
        if (bodyRef.current) {
            const currentPos = bodyRef.current.translation();
            const nextPos = new THREE.Vector3().copy(currentPos).addScaledVector(velocity, delta);
            bodyRef.current.setNextKinematicTranslation(nextPos);
        }
    });

    const handleIntersection = (payload: IntersectionEnterPayload) => {
        const otherUserData = payload.other.rigidBodyObject?.userData as UserData;
        if (!otherUserData || !bodyRef.current || otherUserData.type === 'player' || otherUserData.type === 'spark') return;
        onHit(id, { type: otherUserData.type, enemyId: otherUserData.id, position: new THREE.Vector3().copy(bodyRef.current.translation()) });
    }

    return (
        <RigidBody ref={bodyRef} type="kinematicPosition" position={start} colliders={false} userData={userData} onIntersectionEnter={handleIntersection}>
            <mesh>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshBasicMaterial color="#ffffaa" toneMapped={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <pointLight color="#ffffaa" intensity={5} distance={2} decay={2} />
            <BallCollider args={[0.05]} sensor />
        </RigidBody>
    );
};

export default SparkProjectile;
