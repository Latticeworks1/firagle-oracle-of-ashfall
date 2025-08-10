import { useState, useCallback, useEffect } from 'react';
import type { PlayerState, PlayerTookDamagePayload, IncreaseScorePayload, PlayerAddShieldPayload } from '../types';
import { PLAYER_MAX_HEALTH } from '../constants';
import { eventBus } from '../systems/eventBus';

const initialPlayerState: PlayerState = {
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    shield: 0,
    maxShield: 100, // Default max shield, can be changed by spell
    score: 0,
    isDead: false,
};

export const usePlayerState = () => {
    const [playerState, setPlayerState] = useState<PlayerState>(initialPlayerState);

    const takeDamage = useCallback((payload: PlayerTookDamagePayload) => {
        setPlayerState(prev => {
            if (prev.isDead) return prev;
            
            let damageLeft = payload.amount;
            let newShield = prev.shield;
            
            if (prev.shield > 0) {
                const shieldDamage = Math.min(damageLeft, prev.shield);
                newShield -= shieldDamage;
                damageLeft -= shieldDamage;
            }

            const newHealth = Math.max(0, prev.health - damageLeft);

            return { ...prev, health: newHealth, shield: newShield, isDead: newHealth <= 0 };
        });
    }, []);
    
    const addShield = useCallback((payload: PlayerAddShieldPayload) => {
        setPlayerState(prev => {
             if (prev.isDead) return prev;
             const newMaxShield = Math.max(prev.maxShield, payload.amount);
             return { ...prev, shield: payload.amount, maxShield: newMaxShield };
        });
    }, []);

    const increaseScore = useCallback((payload: IncreaseScorePayload) => {
        setPlayerState(prev => ({ ...prev, score: prev.score + payload.amount }));
    }, []);

    const resetPlayer = useCallback(() => {
        setPlayerState(initialPlayerState);
    }, []);
    
    useEffect(() => {
        eventBus.on<PlayerTookDamagePayload>('PLAYER_TOOK_DAMAGE', takeDamage);
        eventBus.on<IncreaseScorePayload>('INCREASE_SCORE', increaseScore);
        eventBus.on<PlayerAddShieldPayload>('PLAYER_ADD_SHIELD', addShield);

        return () => {
            eventBus.off<PlayerTookDamagePayload>('PLAYER_TOOK_DAMAGE', takeDamage);
            eventBus.off<IncreaseScorePayload>('INCREASE_SCORE', increaseScore);
            eventBus.off<PlayerAddShieldPayload>('PLAYER_ADD_SHIELD', addShield);
        };
    }, [takeDamage, increaseScore, addShield]);

    return { playerState, resetPlayer };
};
