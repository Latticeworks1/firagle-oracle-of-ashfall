import React, { useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider, RapierRigidBody } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import type { UserData, Enemy, PlayerTookDamagePayload } from '../../types';
import { ENEMY_AGGRO_RANGE, ENEMY_SPEED, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_DAMAGE } from '../../constants';
import { eventBus } from '../../systems/eventBus';
import { modelCache } from '../../systems/ModelCache';
import HealthBar from '../ui/HealthBar';

interface RockMonsterProps extends Omit<Enemy, 'onDeath'> {
  playerPos: THREE.Vector3;
}

// Simple, working rock material - no custom shaders
function makeRockMaterial(base = new THREE.Color('#5c544d'), crack = new THREE.Color('#ff7a33')) {
  return new THREE.MeshStandardMaterial({
    color: base,
    roughness: 0.95,
    metalness: 0.05,
    emissive: crack.clone().multiplyScalar(0.1),
    emissiveIntensity: 0.3
  });
}

const RockMonster: React.FC<RockMonsterProps> = ({ id, initialPosition, health, maxHealth, playerPos }) => {
  const bodyRef = useRef<RapierRigidBody>(null);
  const [lastAttackTime, setLastAttackTime] = useState(0);
  const userData = useMemo<UserData>(() => ({ type: 'enemy', id }), [id]);

  // core rock + plates + crystals materials
  const rockMat = useMemo(() => makeRockMaterial(new THREE.Color('#5c544d'), new THREE.Color('#ff8a4b')), []);
  const plateMat = useMemo(() => makeRockMaterial(new THREE.Color('#3e3a35'), new THREE.Color('#ff6a2a')), []);
  const crystalMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#7fd7ff',
        emissive: '#55c8ff',
        emissiveIntensity: 0.8,
        transmission: 0.0,
        roughness: 0.25,
        metalness: 0.2,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2
      }),
    []
  );

  // small helpers reused each frame
  const direction = useMemo(() => new THREE.Vector3(), []);
  const targetRotation = useMemo(() => new THREE.Quaternion(), []);
  const currentRotation = useMemo(() => new THREE.Quaternion(), []);
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  // dust motes (low-cost points) – show motion
  const dust = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const N = 60;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 1.6;
      pos[i * 3 + 1] = Math.random() * 1.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { g, m: new THREE.PointsMaterial({ size: 0.03, transparent: true, opacity: 0.0 }) };
  }, []);

  useFrame((_, delta) => {
    if (!bodyRef.current || health <= 0) return;
    const monsterPos = bodyRef.current.translation();
    const distance = playerPos.distanceTo(monsterPos);

    // No shader time ticking needed - using simple materials

    // idle breathing: scale y slightly
    const t = performance.now() * 0.001;
    const breathe = 1.0 + Math.sin(t * 1.6) * 0.02;
    bodyRef.current.setAdditionalMass(0); // noop but keeps Rapier happy with updates
    // move group scale via visual meshes instead of physics—done below in mesh

    // AI: same behavior, slight smoothing
    if (distance < ENEMY_AGGRO_RANGE) {
      direction.subVectors(playerPos, monsterPos);
      direction.y = 0;

      if (direction.lengthSq() > 0.0001) {
        direction.normalize();
        const currentLinvel = bodyRef.current.linvel();
        const target = direction.clone().multiplyScalar(ENEMY_SPEED);
        // smooth accelerate
        tmpVec.set(
          THREE.MathUtils.lerp(currentLinvel.x, target.x, 0.15),
          currentLinvel.y,
          THREE.MathUtils.lerp(currentLinvel.z, target.z, 0.15)
        );
        bodyRef.current.setLinvel({ x: tmpVec.x, y: tmpVec.y, z: tmpVec.z }, true);

        const angle = Math.atan2(direction.x, direction.z);
        targetRotation.setFromAxisAngle(yAxis, angle);
        const rot = bodyRef.current.rotation();
        currentRotation.set(rot.x, rot.y, rot.z, rot.w);
        currentRotation.slerp(targetRotation, 0.15);
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
        // flash cracks brighter on attack
        const u1 = (rockMat as any).userData?.uCrack; const u2 = (plateMat as any).userData?.uCrack;
        if (u1 && u2) {
          u1.value = 1.6; u2.value = 1.6;
          setTimeout(() => { u1.value = 1.0; u2.value = 1.0; }, 160);
        }
      }
    }

    // dust opacity = speed
    const v = bodyRef.current.linvel();
    const planarSpeed = Math.hypot(v.x, v.z);
    dust.m.opacity = THREE.MathUtils.lerp(dust.m.opacity, Math.min(0.45, planarSpeed / 8), 0.15);
    // gentle drift
    const arr = (dust.g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += (Math.random() - 0.5) * 0.002;
    }
    (dust.g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    // apply breathing scale visually via ref group by traversing
    // handled in JSX via onUpdate
  });

  if (health <= 0) return null;

  return (
    <RigidBody
      ref={bodyRef}
      position={initialPosition}
      colliders={false}
      type="dynamic"
      mass={50}
      enabledRotations={[false, true, false]}
      userData={userData}
    >
      <BallCollider args={[0.8]} />

      {/* Visual group: keeps a simple sphere core, adds plates, crystals, eyes, dust */}
      <group
        onUpdate={(g) => {
          const t = performance.now() * 0.001;
          const breathe = 1.0 + Math.sin(t * 1.6) * 0.02;
          g.scale.set(1.0, breathe, 1.0);
        }}
      >
        {/* Core boulder */}
        <mesh castShadow material={rockMat}>
          <icosahedronGeometry args={[0.85, 1]} />
        </mesh>

        {/* Layered rock plates (offset rings) */}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`plate-${i}`} castShadow material={plateMat} position={[0, -0.15 + i * 0.1, 0]} rotation={[0, (i * Math.PI) / 5, 0]}>
            <torusGeometry args={[0.55 - i * 0.07, 0.06, 8, 20]} />
          </mesh>
        ))}

        {/* Crystal spikes on the back */}
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2;
          const r = 0.55;
          return (
            <mesh key={`cr-${i}`} castShadow material={crystalMat} position={[Math.cos(a) * r, 0.35, Math.sin(a) * r]} rotation={[-Math.PI / 4, a, 0]}>
              <coneGeometry args={[0.09, 0.35, 6]} />
            </mesh>
          );
        })}

        {/* Eyes (subtle emissive) */}
        <mesh position={[0.18, 0.18, 0.62]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={'#ff5544'} />
        </mesh>
        <mesh position={[-0.18, 0.18, 0.62]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={'#ff5544'} />
        </mesh>

        {/* Dust motes */}
        <points geometry={dust.g} material={dust.m} position={[0, 0.1, 0]} />
      </group>

      <Html position={[0, 1.5, 0]} center>
        <div className="enemy-health-container">
          <HealthBar 
            current={health} 
            max={maxHealth} 
            type="enemy" 
            size="compact" 
            showText={false}
            isCritical={health < maxHealth * 0.3}
          />
        </div>
      </Html>
    </RigidBody>
  );
};

export default RockMonster;