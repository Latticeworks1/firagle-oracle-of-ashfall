

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

const FPVView: React.FC<FPVViewProps> = ({ staffRef, headRef, equippedWeapon, animationState }) => {
    const { camera } = useThree();
    const [model, setModel] = useState<Group | null>(null);
    const cameraGroupRef = useRef<Group>(null);
    const recoilRef = useRef<Group>(null);
    const particlesRef = useRef<EmitterAPI>(null);

    // Recoil effect
    useEffect(() => {
        if (animationState === AnimationState.Discharging && recoilRef.current) {
            // Apply impulse
            recoilRef.current.position.z = 0.2; // Kick back
            recoilRef.current.rotation.x = -0.3; // Tilt up
        }
    }, [animationState]);

     // Particle effects and Discharge controller
    useEffect(() => {
        const emitter = particlesRef.current;
        if (!emitter || !headRef.current) return;

        const isLightningStaff = equippedWeapon.type === WeaponType.HitscanChain;
        const isCharging = animationState === AnimationState.Charging || animationState === AnimationState.Charged;

        // Continuous effect for lightning staff charging
        if (isLightningStaff) {
            emitter.pause(!isCharging); // if charging, un-pause. if not, pause.
        } else {
            emitter.pause(true); // Always paused for other staves unless bursting
        }

        // Effects on firing for ALL staves
        if (animationState === AnimationState.Discharging) {
            const pos = headRef.current.getWorldPosition(new THREE.Vector3());
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir); // Fire in the direction camera is facing
            
            // Particle Burst
            emitter.emit(800, pos, dir, 7);
            
            // Muzzle Flash / Discharge Effect
            const dischargeColor = isLightningStaff 
                ? new THREE.Color('#944dff') 
                : new THREE.Color(COLOR_PROJECTILE);

            eventBus.dispatch<EffectTriggerPayload>('EFFECT_TRIGGERED', {
                id: THREE.MathUtils.generateUUID(),
                type: 'discharge',
                position: pos,
                color: dischargeColor,
            });
        }
        
    }, [animationState, equippedWeapon.type, headRef, camera]);


    useFrame((_, delta) => {
        if (cameraGroupRef.current) {
            cameraGroupRef.current.quaternion.copy(camera.quaternion);
            cameraGroupRef.current.position.copy(camera.position);
        }

        // Dampen recoil back to idle
        if (recoilRef.current) {
            recoilRef.current.position.lerp(new THREE.Vector3(0, 0, 0), delta * 10);
            recoilRef.current.rotation.x = THREE.MathUtils.lerp(recoilRef.current.rotation.x, 0, delta * 10);
        }
    });

    const isProcedural = equippedWeapon.modelId === 'firagle_staff' || equippedWeapon.modelId === 'staff_of_storms';

    useEffect(() => {
        if (isProcedural) {
            setModel(null);
            return;
        };

        let isMounted = true;
        setModel(null);

        assetManager.load(equippedWeapon.modelId).then(loadedModel => {
            if (isMounted) {
                setModel(loadedModel);
                const headNode = loadedModel.getObjectByName('HeadAssembly');
                if (headNode && headRef && 'current' in headRef) {
                    (headRef as React.MutableRefObject<Group | null>).current = headNode as Group;
                } else if (headRef && 'current' in headRef) {
                     (headRef as React.MutableRefObject<Group | null>).current = loadedModel;
                }
            }
        }).catch(error => console.error(error));

        return () => { isMounted = false; };
    }, [equippedWeapon.modelId, headRef, isProcedural]);

    return (
        <group ref={cameraGroupRef}>
            <group position={[0.4, -0.55, -1.2]} rotation={[0, Math.PI - 0.5, 0]}>
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
            
            {/* The particle system is rendered here, outside the staff's transform group. 
                Its shader calculates world positions, so it ignores parent transforms. 
                The `staffTip` prop provides the world-space coordinates for emission.
             */}
            <GPUStaffParticles
                ref={particlesRef}
                staffTip={headRef.current}
                continuous={equippedWeapon.type === WeaponType.HitscanChain}
            />
        </group>
    );
};

export default FPVView;
