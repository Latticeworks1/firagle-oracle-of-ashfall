import { useEffect } from 'react';
import { useRapier } from '@react-three/rapier';
import type { SplashDamageEvent, UserData } from '../../types';

interface SplashDamageHandlerProps {
    splashEvents: SplashDamageEvent[];
    onSplashComplete: () => void;
    onEnemyHit: (id: string, damage: number) => boolean;
    onEnemyKilledBySplash: () => void;
    damage: number;
    radius: number;
}

const SplashDamageHandler: React.FC<SplashDamageHandlerProps> = ({ splashEvents, onSplashComplete, onEnemyHit, onEnemyKilledBySplash, damage, radius }) => {
    const { world, rapier } = useRapier();

    useEffect(() => {
        if (splashEvents.length === 0 || radius <= 0) {
            if(splashEvents.length > 0) onSplashComplete();
            return;
        };

        const shape = new rapier.Ball(radius);
        const alreadyHit = new Set<string>();

        splashEvents.forEach(event => {
            world.intersectionsWithShape(
                event.position,
                { w: 1.0, x: 0.0, y: 0.0, z: 0.0 }, // identity rotation
                shape,
                (collider) => {
                    const rigidBody = collider.parent();
                    if (!rigidBody) return true; // continue
                    
                    const userData = rigidBody.userData as UserData;
                    
                    if (
                        userData && 
                        userData.type === 'enemy' && 
                        userData.id && 
                        userData.id !== event.sourceEnemyId && 
                        !alreadyHit.has(userData.id)
                    ) {
                         const wasKilled = onEnemyHit(userData.id, damage);
                         if (wasKilled) {
                             onEnemyKilledBySplash();
                         }
                         alreadyHit.add(userData.id);
                    }
                    return true; // continue checking for other intersections
                }
            );
        });

        onSplashComplete();
    }, [splashEvents, world, rapier, onSplashComplete, onEnemyHit, onEnemyKilledBySplash, damage, radius]);

    return null;
};

export default SplashDamageHandler;
