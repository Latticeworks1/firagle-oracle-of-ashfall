
import React, { useEffect, useMemo } from 'react';
import { useRapier } from '@react-three/rapier';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ChainWeaponSchema, UserData, EnemyHitPayload, EffectTriggerPayload } from '../../types';
import { eventBus } from '../../systems/eventBus';

interface ChainLightningHandlerProps {
    weaponStats: ChainWeaponSchema['stats'];
    staffTipRef: React.RefObject<THREE.Group>;
    onComplete: () => void;
}

const ChainLightningHandler: React.FC<ChainLightningHandlerProps> = ({ weaponStats, staffTipRef, onComplete }) => {
    const { world, rapier } = useRapier();
    const { camera } = useThree();

    const ray = useMemo(() => new rapier.Ray(new THREE.Vector3(), new THREE.Vector3()), [rapier]);
    const shape = useMemo(() => new rapier.Ball(weaponStats.chainRadius), [rapier, weaponStats.chainRadius]);
    const lastHitPosition = useMemo(() => new THREE.Vector3(), []);
    
    useEffect(() => {
        if (!staffTipRef.current) {
            console.warn('ChainLightningHandler: staffTipRef.current is null, aborting');
            onComplete();
            return;
        };
        
        console.log('ChainLightningHandler: Executing lightning attack', { staffTip: staffTipRef.current });

        const chainPoints: THREE.Vector3[] = [];
        const hitEnemyIds = new Set<string>();

        const staffTipPos = staffTipRef.current.getWorldPosition(new THREE.Vector3());
        chainPoints.push(staffTipPos);

        ray.origin.copy(camera.position);
        ray.dir.copy(camera.getWorldDirection(new THREE.Vector3()));
        
        const hit = world.castRay(ray, 100, true, undefined, undefined, undefined, undefined);

        let currentDamage = weaponStats.damage;

        if (hit) {
            const primaryTargetCollider = world.getCollider(hit.colliderHandle);
            const primaryTargetBody = primaryTargetCollider?.parent();
            const userData = primaryTargetBody?.userData as UserData;

            if (userData?.type === 'enemy' && userData.id) {
                const position = new THREE.Vector3().copy(primaryTargetBody.translation());
                lastHitPosition.copy(position);
                chainPoints.push(lastHitPosition.clone());
                hitEnemyIds.add(userData.id);
                
                eventBus.dispatch<EnemyHitPayload>('ENEMY_HIT', { id: userData.id, damage: currentDamage, position });
                currentDamage *= weaponStats.damageFalloff;

                for (let i = 1; i < weaponStats.maxChainTargets; i++) {
                    let closestTarget: { body: any; dist: number } | null = null;
                    
                    world.intersectionsWithShape(lastHitPosition, { w: 1.0, x: 0.0, y: 0.0, z: 0.0 }, shape, (collider) => {
                        const body = collider.parent();
                        if (!body) return true;
                        const bodyUserData = body.userData as UserData;

                        if (bodyUserData?.type === 'enemy' && bodyUserData.id && !hitEnemyIds.has(bodyUserData.id)) {
                            const pos = body.translation();
                            const distSq = lastHitPosition.distanceToSquared(pos);
                            if (!closestTarget || distSq < closestTarget.dist) {
                                closestTarget = { body, dist: distSq };
                            }
                        }
                        return true;
                    });
                    
                    if (closestTarget) {
                        const nextTargetBody = closestTarget.body;
                        const nextTargetId = (nextTargetBody.userData as UserData).id!;
                        
                        const nextPosition = new THREE.Vector3().copy(nextTargetBody.translation());
                        lastHitPosition.copy(nextPosition);
                        chainPoints.push(lastHitPosition.clone());
                        hitEnemyIds.add(nextTargetId);

                        eventBus.dispatch<EnemyHitPayload>('ENEMY_HIT', { id: nextTargetId, damage: currentDamage, position: nextPosition });
                        currentDamage *= weaponStats.damageFalloff;
                    } else {
                        break;
                    }
                }
            }
        }
        
        if (chainPoints.length > 1) {
            eventBus.dispatch<Extract<EffectTriggerPayload, { type: 'arc_lightning' }>>('EFFECT_TRIGGERED', {
                id: THREE.MathUtils.generateUUID(),
                type: 'arc_lightning',
                points: chainPoints,
            });
        }
        onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
};

export default ChainLightningHandler;
