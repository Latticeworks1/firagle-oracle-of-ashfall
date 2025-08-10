
import React, { forwardRef } from 'react';
import type { Group } from 'three';
import StaffBody from './StaffBody';
import HeadAssembly from './HeadAssembly';
import type { AnimationState, WeaponSchema } from '../../types';
import { STAFF_SHAFT_LENGTH, FERRULE_LENGTH } from '../../constants';

interface FiragleProps {
  animationState: AnimationState;
  headRef: React.Ref<Group>;
  weaponStats: WeaponSchema['stats'];
}

const Firagle = forwardRef<Group, FiragleProps>(({ animationState, headRef, weaponStats }, ref) => {
    return (
        <group ref={ref} position-y={-STAFF_SHAFT_LENGTH / 2 + FERRULE_LENGTH} rotation-x={-0.2}>
            <StaffBody animationState={animationState} weaponStats={weaponStats} />
            <HeadAssembly ref={headRef} animationState={animationState} />
        </group>
    );
});

Firagle.displayName = 'Firagle';

export default Firagle;
