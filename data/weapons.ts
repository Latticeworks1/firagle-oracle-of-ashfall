
import type { WeaponSchema, ProjectileWeaponSchema, ChainWeaponSchema } from '../types';
import { WeaponType } from '../types';

export const FIRAGLE_SCHEMA: ProjectileWeaponSchema = {
    id: 'firagle_staff',
    type: WeaponType.Projectile,
    name: 'The Firagle',
    description: 'A legendary staff imbued with the essence of a volcano. It hurls condensed fire that explodes on impact.',
    modelId: 'firagle_staff',
    stats: {
        damage: 40,
        splashDamage: 25,
        splashRadius: 3.0,
        projectileSpeed: 15,
        chargeDuration: 250,
        dischargePeakDuration: 150,
        decayDuration: 800,
    },
    effects: {
        projectileVisual: 'fireball',
        projectileColor: '#ff8c00',
    }
};

export const LIGHTNING_STAFF_SCHEMA: ChainWeaponSchema = {
    id: 'staff_of_storms',
    type: WeaponType.HitscanChain,
    name: 'Staff of Storms',
    description: 'A staff that channels the raw fury of a thunderstorm, instantly striking a foe and arcing to nearby enemies.',
    modelId: 'staff_of_storms',
    stats: {
        damage: 35, // Initial hit damage
        maxChainTargets: 3,
        chainRadius: 10,
        damageFalloff: 0.65, // Each arc deals 65% of the previous arc's damage
        chargeDuration: 150,
        dischargePeakDuration: 100,
        decayDuration: 200,
    },
};


export const WEAPONS_DATA: WeaponSchema[] = [
    FIRAGLE_SCHEMA,
    LIGHTNING_STAFF_SCHEMA,
];
