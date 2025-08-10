import { AnimationState } from '../types';
import { lerp } from 'three/src/math/MathUtils';

// Math utilities
export { lerp } from 'three/src/math/MathUtils';

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
};

// Animation state utilities
export const getAnimationIntensity = (animationState: AnimationState): number => {
  switch (animationState) {
    case AnimationState.Idle:
      return 0.1;
    case AnimationState.Charging:
      return 0.3;
    case AnimationState.Charged:
      return 0.8;
    case AnimationState.Discharging:
      return 1.0;
    case AnimationState.Decay:
      return 0.5;
    default:
      return 0.1;
  }
};

export const getAnimationScale = (animationState: AnimationState, baseScale: number = 1): number => {
  const intensity = getAnimationIntensity(animationState);
  return baseScale * (1 + intensity * 0.2);
};

export const isActiveState = (animationState: AnimationState): boolean => {
  return animationState !== AnimationState.Idle;
};

export const shouldShowChargeEffect = (animationState: AnimationState): boolean => {
  return animationState === AnimationState.Charging || 
         animationState === AnimationState.Charged || 
         animationState === AnimationState.Discharging;
};

export const getAnimationOpacity = (animationState: AnimationState, baseOpacity: number = 1): number => {
  const intensity = getAnimationIntensity(animationState);
  return lerp(baseOpacity * 0.3, baseOpacity, intensity);
};