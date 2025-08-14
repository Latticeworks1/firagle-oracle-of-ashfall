import React, { useState, useEffect, useRef } from 'react';
import type { Group } from 'three';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import type { WeaponSchema, EffectTriggerPayload } from '../../types';
import { assetManager } from '../../systems/assetManager';
import Firagle from '../staff/Firagle';
import { AnimationState, WeaponType } from '../../types';
import GPUStaffParticles, { type EmitterAPI } from '../effects/GPUStaffParticles';
import { eventBus } from '../../systems/eventBus';
import { COLOR_PROJECTILE } from '../../constants';

interface FPVViewProps {
    staffRef: React.RefObject<Group>;
    headRef: React.RefObject<Group>;
    equippedWeapon: WeaponSchema;
    animationState: AnimationState;
}

const RECOIL_OFFSET_Z = 0.2;
const RECOIL_ROTATION_X = -0.3;
const RECOIL_DAMPING = 10;
const PARTICLE_BURST_COUNT = 800;
const PARTICLE_BURST_SPEED = 7;

const FPVView: React.FC<FPVViewProps> = ({ staffRef, headRef, equippedWeapon, animationState }) => {
    const { camera } = useThree();
    const [model, setModel] = useState<Group | null>(null);

    const cameraGroupRef = useRef<Group>(null);
    const recoilRef = useRef<Group>(null);
    const particlesRef = useRef<EmitterAPI>(null);

    const isProcedural = equippedWeapon.modelId.startsWith('procedural_');
    const isLightningStaff = equippedWeapon.type === WeaponType.HitscanChain;
    const isCharging = animationState === AnimationState.Charging || animationState === AnimationState.Charged;

    // Handle recoil impulse
    useEffect(() => {
        if (animationState === AnimationState.Discharging && recoilRef.current) {
            recoilRef.current.position.z = RECOIL_OFFSET_Z;
            recoilRef.current.rotation.x = RECOIL_ROTATION_X;
        }
    }, [animationState]);

    // Particle effects and discharge control
    useEffect(() => {
        const emitter = particlesRef.current;
        if (!emitter || !headRef.current) return;

        emitter.pause(!(isLightningStaff && isCharging));

        if (animationState === AnimationState.Discharging) {
            const position = headRef.current.getWorldPosition(new THREE.Vector3());
            const direction = camera.getWorldDirection(new THREE.Vector3());

            emitter.emit(PARTICLE_BURST_COUNT, position, direction, PARTICLE_BURST_SPEED);

            const dischargeColor = isLightningStaff
                ? new THREE.Color('#944dff')
                : new THREE.Color(COLOR_PROJECTILE);

            eventBus.dispatch<EffectTriggerPayload>('EFFECT_TRIGGERED', {
                id: THREE.MathUtils.generateUUID(),
                type: 'discharge',
                position,
                color: dischargeColor,
            });
        }
    }, [animationState, isLightningStaff, isCharging, headRef, camera]);

    // Keep camera group synced to actual camera
    useFrame((_, delta) => {
        if (cameraGroupRef.current) {
            cameraGroupRef.current.quaternion.copy(camera.quaternion);
            cameraGroupRef.current.position.copy(camera.position);
        }

        // Smooth recoil return
        if (recoilRef.current) {
            recoilRef.current.position.lerp(new THREE.Vector3(0, 0, 0), delta * RECOIL_DAMPING);
            recoilRef.current.rotation.x = THREE.MathUtils.lerp(recoilRef.current.rotation.x, 0, delta * RECOIL_DAMPING);
        }
    });

    // Load non-procedural weapon models
    useEffect(() => {
        if (isProcedural) {
            setModel(null);
            return;
        }

        let isMounted = true;
        setModel(null);

        assetManager.load(equippedWeapon.modelId)
            .then(loadedModel => {
                if (!isMounted) return;
                setModel(loadedModel);

                const headNode = loadedModel.getObjectByName('HeadAssembly') as Group;
                (headRef as React.MutableRefObject<Group | null>).current = headNode || loadedModel;
            })
            .catch(console.error);

        return () => { isMounted = false; };
    }, [equippedWeapon.modelId, headRef, isProcedural]);

    return (
        <group ref={cameraGroupRef}>
            <group position={[0, 0, -1.2]} rotation={[0, Math.PI, 0]}>
                <group ref={recoilRef}>
                    {isProcedural ? (
                        <Firagle
                            ref={staffRef}
                            headRef={headRef}
                            animationState={animationState}
                            weaponStats={equippedWeapon.stats}
                        />
                    ) : (
                        model && <primitive object={model} ref={staffRef} />
                    )}
                </group>
            </group>

            <GPUStaffParticles
                ref={particlesRef}
                staffTip={headRef.current}
                continuous={isLightningStaff}
            />
        </group>
    );
};

export default FPVView;