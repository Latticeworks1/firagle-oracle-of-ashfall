
import React, { useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider, RapierRigidBody } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import type { UserData, Enemy, PlayerTookDamagePayload } from '../../types';
import { ENEMY_AGGRO_RANGE, ENEMY_SPEED, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_DAMAGE } from '../../constants';
import { eventBus } from '../../systems/eventBus';

const HealthBar: React.FC<{ health: number; maxHealth: number }> = ({ health, maxHealth }) => {
    const healthPercentage = (health / maxHealth) * 100;
    const color = healthPercentage > 50 ? '#4CAF50' : healthPercentage > 25 ? '#FFC107' : '#F44336';
    return (
        <div style={{ width: '80px', height: '8px', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid #333', borderRadius: '2px', transform: 'translateX(-50%)' }}>
            <div style={{ width: `${healthPercentage}%`, height: '100%', backgroundColor: color, transition: 'width 0.2s' }} />
        </div>
    );
};

interface RockMonsterProps extends Omit<Enemy, 'onDeath'> {
    playerPos: THREE.Vector3;
}

const RockMonster: React.FC<RockMonsterProps> = ({ id, initialPosition, health, maxHealth, playerPos }) => {
    const bodyRef = useRef<RapierRigidBody>(null);
    const [lastAttackTime, setLastAttackTime] = useState(0);
    const userData = useMemo<UserData>(() => ({ type: 'enemy', id }), [id]);
    
    const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5c544d', roughness: 0.9, metalness: 0.1 }), []);

    const direction = useMemo(() => new THREE.Vector3(), []);
    const targetRotation = useMemo(() => new THREE.Quaternion(), []);
    const currentRotation = useMemo(() => new THREE.Quaternion(), []);
    const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

    useFrame((_, delta) => {
        if (!bodyRef.current || health <= 0) return;
        const monsterPos = bodyRef.current.translation();
        const distance = playerPos.distanceTo(monsterPos);

        if (distance < ENEMY_AGGRO_RANGE) {
            direction.subVectors(playerPos, monsterPos);
            direction.y = 0; 
            
            if (direction.lengthSq() > 0.0001) {
                direction.normalize();
                
                const currentLinvel = bodyRef.current.linvel();
                bodyRef.current.setLinvel({ x: direction.x * ENEMY_SPEED, y: currentLinvel.y, z: direction.z * ENEMY_SPEED }, true);
                
                const angle = Math.atan2(direction.x, direction.z);
                targetRotation.setFromAxisAngle(yAxis, angle);
                
                const rot = bodyRef.current.rotation();
                currentRotation.set(rot.x, rot.y, rot.z, rot.w);

                currentRotation.slerp(targetRotation, 0.1);
                bodyRef.current.setRotation(currentRotation, true);
            } else {
                 const currentLinvel = bodyRef.current.linvel();
                 bodyRef.current.setLinvel({ x: 0, y: currentLinvel.y, z: 0 }, true);
            }
        }

        if (distance < ENEMY_ATTACK_RANGE) {
            const now = performance.now();
            if (now - lastAttackTime > ENEMY_ATTACK_COOLDOWN) {
                eventBus.dispatch<PlayerTookDamagePayload>('PLAYER_TOOK_DAMAGE', { amount: ENEMY_DAMAGE });
                setLastAttackTime(now);
            }
        }
    });

    if (health <= 0) return null;

    return (
        <RigidBody ref={bodyRef} position={initialPosition} colliders={false} type="dynamic" mass={50} enabledRotations={[false, true, false]} userData={userData}>
            <BallCollider args={[0.8]} />
            <mesh castShadow material={material}>
                <sphereGeometry args={[0.8, 16, 12]} />
            </mesh>
            <Html position={[0, 1.5, 0]} center>
                <HealthBar health={health} maxHealth={maxHealth} />
            </Html>
        </RigidBody>
    );
};

export default RockMonster;
