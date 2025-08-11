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

/* ——— rock shader helper: standard material with crack emissive + noise displacement ——— */
function makeRockMaterial(base = new THREE.Color('#5c544d'), crack = new THREE.Color('#ff7a33')) {
  const mat = new THREE.MeshStandardMaterial({
    color: base,
    roughness: 0.95,
    metalness: 0.05,
    emissive: crack.clone().multiplyScalar(0.0),
    emissiveIntensity: 1.0
  });
  // small uniforms carried on material; advanced but stays MeshStandardMaterial
  (mat as any).userData.uTime = { value: 0 };
  (mat as any).userData.uCrack = { value: 1.0 };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = (mat as any).userData.uTime;
    shader.uniforms.uCrack = (mat as any).userData.uCrack;

    // inject noise + crack logic
    shader.vertexShader = `
      varying vec3 vPos;
      uniform float uTime;
      // cheap 3D noise
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7, 74.7)))*43758.5453); }
      float noise(vec3 x){
        vec3 i = floor(x), f = fract(x);
        float n = mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
        return n;
      }
    ` + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
        vPos = position;
        // layered fbm-ish wobble for breathing mineral
        float n = noise(position * 2.4 + vec3(0.0, uTime*0.35, 0.0));
        float disp = (n - 0.5) * 0.035; // gentle
        vec3 transformed = position + normal * disp;
      `
    ).replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vPos; uniform float uTime;'
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vPos; uniform float uTime; uniform float uCrack;'
    ).replace(
      '#include <dithering_fragment>',
      `
        // procedural crack lines: threshold a high-frequency function of position
        float bands = sin(vPos.x*12.0) * sin(vPos.y*10.0) * sin(vPos.z*14.0);
        float crackMask = smoothstep(0.985, 0.991, abs(bands));
        // pulse emissive slightly
        float pulse = 0.85 + 0.15 * sin(uTime*3.0);
        outgoingLight += emissiveColor * crackMask * uCrack * pulse;
        #include <dithering_fragment>
      `
    );
    (mat as any).userData.shader = shader;
  };
  return mat;
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

    // tick rock shader time
    const s1 = (rockMat as any).userData?.uTime; if (s1) s1.value += delta;
    const s2 = (plateMat as any).userData?.uTime; if (s2) s2.value += delta;

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
        <HealthBar health={health} maxHealth={maxHealth} />
      </Html>
    </RigidBody>
  );
};

export default RockMonster;