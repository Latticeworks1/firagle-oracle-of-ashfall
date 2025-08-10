

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider, RapierRigidBody } from '@react-three/rapier';
import type { IntersectionEnterPayload } from '@react-three/rapier';
import type { UserData, Projectile, EffectTriggerPayload, EnemyHitPayload } from '../../types';
import { PROJECTILE_LIFESPAN, COLOR_PROJECTILE, COLOR_EMBER } from '../../constants';
import { eventBus } from '../../systems/eventBus';
import type { ProjectileWeaponSchema } from '../../types';
import { WEAPONS_DATA } from '../../data/weapons';


const FireballMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(COLOR_PROJECTILE) } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
        uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        float noise(vec2 p) { return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 center = vec2(0.5, 0.5); float dist = distance(vUv, center); if (dist > 0.5) discard;
            float distortion = noise(vUv * 5.0 + uTime * 20.0) * 0.1; float radius = 0.5 - distortion;
            if (dist > radius) discard;
            float intensity = pow(1.0 - (dist / radius), 1.5); vec3 fireColor = uColor * intensity; fireColor.gb *= 0.6;
            gl_FragColor = vec4(fireColor, intensity);
        }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
});

const TrailEmber: React.FC<{ particleCount?: number; parentRef: React.RefObject<THREE.Object3D> }> = ({ particleCount = 50, parentRef }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const particles = useMemo(() => Array.from({ length: particleCount }).map(() => ({ position: new THREE.Vector3(), scale: 1, life: 0 })), [particleCount]);
    
    useFrame((_, delta) => {
        if (!meshRef.current || !parentRef.current || !parentRef.current.parent) return;
        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= delta * 2.5; p.position.y += delta * 0.2; dummy.position.copy(p.position);
                const scale = Math.max(0, p.life); dummy.scale.set(scale, scale, scale);
                dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        const p = particles[Math.floor(Math.random() * particleCount)];
        if (p.life <= 0) {
            p.life = 1; parentRef.current.getWorldPosition(p.position);
            p.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2));
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });
    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color={COLOR_EMBER} blending={THREE.AdditiveBlending} transparent depthWrite={false}/>
        </instancedMesh>
    );
};

interface FireballProps extends Projectile {
  onExpire: (id: string) => void;
}

const Fireball: React.FC<FireballProps> = ({ id, onExpire, start, velocity }) => {
    const bodyRef = useRef<RapierRigidBody>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const groupRef = useRef<THREE.Group>(null);
    const userData = useMemo<UserData>(() => ({ type: 'fireball', id }), [id]);

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
        if (materialRef.current) materialRef.current.uniforms.uTime.value += delta;
    });
    
    const handleIntersection = (payload: IntersectionEnterPayload) => {
        const otherUserData = payload.other.rigidBodyObject?.userData as UserData;
        if (!otherUserData || !bodyRef.current || otherUserData.type === 'player' || otherUserData.type === 'fireball') return;

        const position = new THREE.Vector3().copy(bodyRef.current.translation());
        
        // This is a simplification. A better approach would be to pass weaponId with projectile.
        const weapon = WEAPONS_DATA.find(w => w.type === 'projectile') as ProjectileWeaponSchema;
        if (!weapon) return;

        eventBus.dispatch('EFFECT_TRIGGERED', {
            id: THREE.MathUtils.generateUUID(), type: 'explosion', position
        });

        if(weapon.stats.splashRadius > 0) {
            eventBus.dispatch('EFFECT_TRIGGERED', {
                id: THREE.MathUtils.generateUUID(),
                type: 'splash_damage',
                position,
                radius: weapon.stats.splashRadius,
                damage: weapon.stats.splashDamage,
                sourceEnemyId: otherUserData.type === 'enemy' ? otherUserData.id : undefined,
            });
        }

        if(otherUserData.type === 'enemy' && otherUserData.id) {
            eventBus.dispatch<EnemyHitPayload>('ENEMY_HIT', {
                id: otherUserData.id,
                damage: weapon.stats.damage,
                position,
            });
        }
        
        onExpire(id);
    }

    return (
        <RigidBody ref={bodyRef} type="kinematicPosition" position={start} colliders={false} userData={userData} onIntersectionEnter={handleIntersection}>
            <group ref={groupRef}>
                <mesh><sphereGeometry args={[0.2, 32, 32]} /><primitive object={FireballMaterial} ref={materialRef} attach="material" /></mesh>
                <pointLight color={COLOR_PROJECTILE} intensity={20} distance={4} decay={2} />
                <TrailEmber parentRef={groupRef} />
            </group>
            <BallCollider args={[0.2]} sensor />
        </RigidBody>
    );
};

export default Fireball;
