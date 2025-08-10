

import React, { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useRapier } from '@react-three/rapier';

import { eventBus } from './eventBus';
import type { EffectTriggerPayload, EnemyDiedPayload, UserData, EnemyHitPayload } from '../types';

import ExplosionEffect from '../components/effects/ExplosionEffect';
import RockMonsterDeathEffect from '../components/enemy/RockMonsterDeathEffect';
import LightningBolt from '../components/world/LightningBolt';
import NovaEffect from '../components/effects/NovaEffect';
import DischargeEffect from '../components/effects/DischargeEffect';

type Effect = {
    id: string;
    type: EffectTriggerPayload['type'];
    position?: THREE.Vector3;
    points?: THREE.Vector3[];
    color?: THREE.Color;
};

const EffectsManager: React.FC = () => {
    const { world, rapier } = useRapier();
    const [effects, setEffects] = useState<Effect[]>([]);

    const onEffectComplete = useCallback((id: string) => {
        setEffects(prev => prev.filter(effect => effect.id !== id));
    }, []);

    const handleSplashDamage = useCallback((payload: Extract<EffectTriggerPayload, { type: 'splash_damage' }>) => {
        const { position, radius, damage, sourceEnemyId } = payload;
        if (radius <= 0) return;

        const shape = new rapier.Ball(radius);
        const alreadyHit = new Set<string>();

        world.intersectionsWithShape(
            position,
            { w: 1.0, x: 0.0, y: 0.0, z: 0.0 },
            shape,
            (collider) => {
                const rigidBody = collider.parent();
                if (!rigidBody) return true;
                
                const userData = rigidBody.userData as UserData;
                
                if (
                    userData?.type === 'enemy' && 
                    userData.id && 
                    userData.id !== sourceEnemyId && 
                    !alreadyHit.has(userData.id)
                ) {
                     eventBus.dispatch<EnemyHitPayload>('ENEMY_HIT', { id: userData.id, damage, position: new THREE.Vector3().copy(rigidBody.translation()) });
                     alreadyHit.add(userData.id);
                }
                return true; // continue checking
            }
        );
    }, [world, rapier]);

    useEffect(() => {
        const handleEffectTrigger = (payload: EffectTriggerPayload) => {
            if (payload.type === 'splash_damage') {
                handleSplashDamage(payload);
            } else if (payload.type === 'arc_lightning') {
                 setEffects(prev => [...prev, { id: payload.id, type: payload.type, points: payload.points }]);
            } else if (payload.type === 'discharge') {
                 setEffects(prev => [...prev, { id: payload.id, type: payload.type, position: payload.position, color: payload.color }]);
            } else {
                setEffects(prev => [...prev, { id: payload.id, type: payload.type, position: payload.position }]);
            }
        };

        const handleEnemyDied = (payload: EnemyDiedPayload) => {
            handleEffectTrigger({ type: 'rock_monster_death', id: payload.id, position: payload.position });
        };
        
        eventBus.on('EFFECT_TRIGGERED', handleEffectTrigger);
        eventBus.on('ENEMY_DIED', handleEnemyDied);

        return () => {
            eventBus.off('EFFECT_TRIGGERED', handleEffectTrigger);
            eventBus.off('ENEMY_DIED', handleEnemyDied);
        };
    }, [handleSplashDamage]);

    return (
        <>
            {effects.map(effect => {
                if (effect.type === 'explosion' && effect.position) {
                    return <ExplosionEffect key={effect.id} position={effect.position} onComplete={() => onEffectComplete(effect.id)} />;
                }
                if (effect.type === 'rock_monster_death' && effect.position) {
                    return <RockMonsterDeathEffect key={effect.id} position={effect.position} onComplete={() => onEffectComplete(effect.id)} />;
                }
                if (effect.type === 'arc_lightning' && effect.points) {
                    return <LightningBolt key={effect.id} points={effect.points} onComplete={() => onEffectComplete(effect.id)} />;
                }
                if (effect.type === 'nova' && effect.position) {
                    return <NovaEffect key={effect.id} position={effect.position} onComplete={() => onEffectComplete(effect.id)} />;
                }
                if (effect.type === 'discharge' && effect.position && effect.color) {
                    return <DischargeEffect key={effect.id} position={effect.position} color={effect.color} onComplete={() => onEffectComplete(effect.id)} />;
                }
                return null;
            })}
        </>
    );
};

export default EffectsManager;
