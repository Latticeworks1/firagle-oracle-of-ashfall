
import { useState, useRef, useCallback } from 'react';
import { AnimationState, type WeaponSchema } from '../types';

export const useAnimationStateManager = (weaponStats: WeaponSchema['stats']) => {
    const [animationState, setAnimationState] = useState<AnimationState>(AnimationState.Idle);
    const chargeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetState = useCallback(() => {
        if(chargeTimeoutRef.current) clearTimeout(chargeTimeoutRef.current);
        if(sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
        setAnimationState(AnimationState.Idle);
    }, []);

    const startCharging = useCallback(() => {
        if (animationState === AnimationState.Idle) {
            setAnimationState(AnimationState.Charging);
            chargeTimeoutRef.current = setTimeout(() => {
                setAnimationState(AnimationState.Charged);
            }, weaponStats.chargeDuration);
        }
    }, [animationState, weaponStats.chargeDuration]);

    const fire = useCallback(() => {
        if (chargeTimeoutRef.current) {
            clearTimeout(chargeTimeoutRef.current);
            chargeTimeoutRef.current = null;
        }

        if (animationState === AnimationState.Charged) {
            setAnimationState(AnimationState.Discharging);
            sequenceTimeoutRef.current = setTimeout(() => {
                setAnimationState(AnimationState.Decay);
                sequenceTimeoutRef.current = setTimeout(() => {
                    setAnimationState(AnimationState.Idle);
                }, weaponStats.decayDuration);
            }, weaponStats.dischargePeakDuration);
        } else if (animationState === AnimationState.Charging) {
            setAnimationState(AnimationState.Idle);
        }
    }, [animationState, weaponStats.dischargePeakDuration, weaponStats.decayDuration]);

    return { animationState, startCharging, fire, resetState };
};
