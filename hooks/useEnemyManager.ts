
import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import type { Enemy, EnemyHitPayload, EnemyDiedPayload } from '../types';
import { ENEMY_MAX_COUNT, ENEMY_SPAWN_INTERVAL, ENEMY_MAX_HEALTH } from '../constants';
import { eventBus } from '../systems/eventBus';

const getSpawnPosition = (playerPos: THREE.Vector3): THREE.Vector3 => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 25 + Math.random() * 20; // Spawn outside aggro range
    return new THREE.Vector3(
      playerPos.x + Math.cos(angle) * radius,
      35,
      playerPos.z + Math.sin(angle) * radius
    );
};

export const useEnemyManager = (isGameActive: boolean, playerPosition: THREE.Vector3) => {
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const enemiesRef = useRef(enemies);
    enemiesRef.current = enemies;

    const spawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const spawnEnemy = useCallback(() => {
        setEnemies(prev => {
            if (prev.length >= ENEMY_MAX_COUNT) return prev;
            const newEnemy: Enemy = {
                id: THREE.MathUtils.generateUUID(),
                initialPosition: getSpawnPosition(playerPosition),
                health: ENEMY_MAX_HEALTH,
                maxHealth: ENEMY_MAX_HEALTH,
            };
            return [...prev, newEnemy];
        });
    }, [playerPosition]);
    
    const handleEnemyHit = useCallback((payload: EnemyHitPayload) => {
        const enemy = enemiesRef.current.find(e => e.id === payload.id);
        if (!enemy) return;

        const newHealth = enemy.health - payload.damage;

        if (newHealth <= 0) {
            setEnemies(prev => prev.filter(e => e.id !== payload.id));
            eventBus.dispatch<EnemyDiedPayload>('ENEMY_DIED', {
                id: payload.id,
                position: payload.position,
            });
            eventBus.dispatch('INCREASE_SCORE', { amount: 100 });
        } else {
            setEnemies(prev => prev.map(e => 
                e.id === payload.id ? { ...e, health: newHealth } : e
            ));
        }
    }, []);

    const resetEnemies = useCallback(() => {
        setEnemies([]);
        if (spawnIntervalRef.current) {
            clearInterval(spawnIntervalRef.current);
            spawnIntervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        eventBus.on<EnemyHitPayload>('ENEMY_HIT', handleEnemyHit);
        return () => { eventBus.off<EnemyHitPayload>('ENEMY_HIT', handleEnemyHit); };
    }, [handleEnemyHit]);

    useEffect(() => {
        if (isGameActive) {
            if (!spawnIntervalRef.current) {
                spawnIntervalRef.current = setInterval(spawnEnemy, ENEMY_SPAWN_INTERVAL);
            }
        } else if (spawnIntervalRef.current) {
            clearInterval(spawnIntervalRef.current);
            spawnIntervalRef.current = null;
        }
        return () => {
            if (spawnIntervalRef.current) {
                clearInterval(spawnIntervalRef.current);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGameActive, spawnEnemy]);

    return { enemies, resetEnemies };
};
