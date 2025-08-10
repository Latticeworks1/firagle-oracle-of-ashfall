import type { Vector3, Color } from 'three';

export enum AnimationState {
  Idle,
  Charging,
  Charged,
  Discharging,
  Decay,
}

export enum Controls {
  forward = 'forward',
  backward = 'backward',
  left = 'left',
  right = 'right',
  draw = 'draw',
}

export enum WeaponType {
  Projectile = 'projectile',
  HitscanChain = 'hitscan-chain',
}

interface BaseWeaponSchema {
  id: string;
  name: string;
  description: string;
  modelId: string;
}

export interface ProjectileWeaponSchema extends BaseWeaponSchema {
  type: WeaponType.Projectile;
  stats: {
    damage: number;
    splashDamage: number;
    splashRadius: number;
    projectileSpeed: number;
    chargeDuration: number;
    dischargePeakDuration: number;
    decayDuration: number;
  };
  effects: {
    projectileVisual: 'fireball';
    projectileColor: string;
  };
}

export interface ChainWeaponSchema extends BaseWeaponSchema {
    type: WeaponType.HitscanChain;
    stats: {
        damage: number;
        maxChainTargets: number;
        chainRadius: number;
        damageFalloff: number; // e.g., 0.7 means each subsequent target takes 70% of the previous hit's damage
        chargeDuration: number;
        dischargePeakDuration: number;
        decayDuration: number;
    };
}

export type WeaponSchema = ProjectileWeaponSchema | ChainWeaponSchema;

export type GestureSpell = {
    id: 'fire_nova' | 'protective_ward';
    name: string;
    description: string;
    template: { x: number; y: number }[];
}

export type Projectile = {
    id:string;
    start: Vector3;
    velocity: Vector3;
    visualType: 'fireball';
};

export type Enemy = {
  id: string;
  initialPosition: Vector3;
  health: number;
  maxHealth: number;
};

export type PlayerState = {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  isDead: boolean;
};

export type UserData = {
  type: 'player' | 'enemy' | 'ground' | 'fireball' | 'scenery' | 'spark';
  id?: string;
};

// --- Event Bus Payloads ---
export type PlayerTookDamagePayload = { amount: number };
export type PlayerAddShieldPayload = { amount: number };
export type IncreaseScorePayload = { amount: number };
export type EnemyHitPayload = { id: string; damage: number; position: Vector3 };
export type EnemyDiedPayload = { id: string; position: Vector3 };
export type WeaponFiredPayload = Projectile;

export type EffectTriggerPayload = {
    id: string;
    type: 'explosion' | 'rock_monster_death' | 'nova';
    position: Vector3;
} | {
    id: string;
    type: 'arc_lightning';
    points: Vector3[];
} | {
    id: string;
    type: 'splash_damage';
    position: Vector3;
    radius: number;
    damage: number;
    sourceEnemyId?: string;
} | {
    id: string;
    type: 'discharge';
    position: Vector3;
    color: Color;
};

export type SplashDamageEvent = Extract<EffectTriggerPayload, { type: 'splash_damage' }>;