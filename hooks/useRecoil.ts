import { useEffect } from 'react';
import * as THREE from 'three';
import { AnimationState } from '../types';

export function useRecoil(recoilRef: React.RefObject<THREE.Group>, animationState: AnimationState) {
  useEffect(() => {
    if (animationState === AnimationState.Discharging && recoilRef.current) {
      recoilRef.current.position.z = 0.2;
      recoilRef.current.rotation.x = -0.3;
    }
  }, [animationState]);
}