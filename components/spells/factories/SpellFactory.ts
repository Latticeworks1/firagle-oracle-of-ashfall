import React from 'react';
import * as THREE from 'three';
import type { WeaponSchema, WeaponType, EffectTriggerPayload } from '../../../types';

// Core spell configuration interfaces
export interface SpellVisualConfig {
  primaryColor: THREE.Color;
  secondaryColor: THREE.Color;
  glowIntensity: number;
  particleCount: number;
  trailLength: number;
}

export interface SigilConfig {
  baseRadius: number;
  ringCount: number;
  rotationSpeed: number[];
  glyphCount: number;
  pulseBehavior: 'steady' | 'pulse' | 'charge-sync';
}

export interface ProjectileConfig {
  size: number;
  speed: number;
  trailType: 'ember' | 'spark' | 'arc' | 'none';
  collisionBehavior: 'explode' | 'pierce' | 'chain';
}

export interface ShaderConfig {
  fragmentShader: string;
  vertexShader: string;
  uniforms: Record<string, { value: any }>;
  renderSettings: {
    transparent: boolean;
    blending: THREE.Blending;
    depthWrite: boolean;
  };
}

// Master spell configuration
export interface SpellTemplate {
  id: string;
  name: string;
  weaponType: WeaponType;
  visual: SpellVisualConfig;
  sigil: SigilConfig;
  projectile: ProjectileConfig;
  shader: ShaderConfig;
  effects: {
    onHit: EffectTriggerPayload['type'][];
    onCharge: EffectTriggerPayload['type'][];
    onCast: EffectTriggerPayload['type'][];
  };
  multiplayer: {
    networkSync: boolean;
    authoritative: boolean;
    predictable: boolean;
  };
}

// Pre-built spell templates
export const FIRE_SPELL_TEMPLATE: SpellTemplate = {
  id: 'fire_nova',
  name: 'Fire Nova',
  weaponType: WeaponType.Projectile,
  visual: {
    primaryColor: new THREE.Color('#ff6b35'),
    secondaryColor: new THREE.Color('#ff8c42'),
    glowIntensity: 20,
    particleCount: 50,
    trailLength: 1.5
  },
  sigil: {
    baseRadius: 0.5,
    ringCount: 3,
    rotationSpeed: [0.7, -1.0, 1.5],
    glyphCount: 4,
    pulseBehavior: 'charge-sync'
  },
  projectile: {
    size: 0.2,
    speed: 15,
    trailType: 'ember',
    collisionBehavior: 'explode'
  },
  shader: {
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv;
      float noise(vec2 p) { return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 center = vec2(0.5); float dist = distance(vUv, center);
        if (dist > 0.5) discard;
        float distortion = noise(vUv * 8.0 + uTime * 25.0) * 0.15;
        float radius = 0.5 - distortion;
        if (dist > radius) discard;
        float intensity = pow(1.0 - (dist / radius), 2.0) * uIntensity;
        vec3 fireColor = mix(uColor * 0.8, uColor * 1.2, intensity);
        fireColor.gb *= mix(0.4, 0.8, intensity);
        gl_FragColor = vec4(fireColor, intensity);
      }`,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#ff6b35') },
      uIntensity: { value: 1.0 }
    },
    renderSettings: {
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }
  },
  effects: {
    onHit: ['explosion', 'splash_damage'],
    onCharge: ['charging_glow'],
    onCast: ['muzzle_flash']
  },
  multiplayer: {
    networkSync: true,
    authoritative: true,
    predictable: true
  }
};

export const LIGHTNING_SPELL_TEMPLATE: SpellTemplate = {
  id: 'chain_lightning',
  name: 'Chain Lightning',
  weaponType: WeaponType.HitscanChain,
  visual: {
    primaryColor: new THREE.Color('#944dff'),
    secondaryColor: new THREE.Color('#c77dff'),
    glowIntensity: 25,
    particleCount: 30,
    trailLength: 2.0
  },
  sigil: {
    baseRadius: 0.5,
    ringCount: 3,
    rotationSpeed: [1.2, -1.8, 2.5],
    glyphCount: 6,
    pulseBehavior: 'pulse'
  },
  projectile: {
    size: 0.15,
    speed: 50,
    trailType: 'arc',
    collisionBehavior: 'chain'
  },
  shader: {
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv;
      float noise(vec2 p) { return fract(sin(dot(p.xy * 0.129898, vec2(78.233, 12.9898))) * 43758.5453); }
      void main() {
        vec2 center = vec2(0.5); float dist = distance(vUv, center);
        if (dist > 0.5) discard;
        float electric = noise(vUv * 12.0 + uTime * 40.0);
        electric = smoothstep(0.3, 0.7, electric);
        float radius = 0.5 - electric * 0.2;
        if (dist > radius) discard;
        float intensity = (1.0 - (dist / radius)) * uIntensity;
        vec3 lightningColor = mix(uColor, vec3(1.0), electric * 0.5);
        gl_FragColor = vec4(lightningColor, intensity);
      }`,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#944dff') },
      uIntensity: { value: 1.0 }
    },
    renderSettings: {
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }
  },
  effects: {
    onHit: ['arc_lightning', 'chain_damage'],
    onCharge: ['electric_buildup'],
    onCast: ['lightning_flash']
  },
  multiplayer: {
    networkSync: true,
    authoritative: true,
    predictable: false
  }
};

// Factory functions for creating spell components
export const createSpellMaterial = (template: SpellTemplate): THREE.ShaderMaterial => {
  return new THREE.ShaderMaterial({
    uniforms: { ...template.shader.uniforms },
    fragmentShader: template.shader.fragmentShader,
    vertexShader: template.shader.vertexShader,
    ...template.shader.renderSettings
  });
};

export const createSigilGeometry = (config: SigilConfig) => {
  const rings: React.ReactElement[] = [];
  const ringRadii = Array.from({ length: config.ringCount }, (_, i) => 
    config.baseRadius * (1.1 - (i * 0.3))
  );
  
  ringRadii.forEach((radius, i) => {
    rings.push(React.createElement('torusGeometry', {
      key: `ring-${i}`,
      args: [radius, 0.01 + (i * 0.005), 16, 100]
    }));
  });
  
  return rings;
};

export const createGlyphPositions = (config: SigilConfig) => {
  return Array.from({ length: config.glyphCount }, (_, i) => {
    const angle = (i * Math.PI * 2) / config.glyphCount;
    return {
      rotation: angle,
      position: [
        Math.cos(angle) * config.baseRadius * 0.9,
        Math.sin(angle) * config.baseRadius * 0.9,
        0
      ] as [number, number, number]
    };
  });
};

// Multiplayer-ready spell state interface
export interface NetworkSpellState {
  id: string;
  template: string;
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  timestamp: number;
  ownerId: string;
  phase: 'charging' | 'cast' | 'traveling' | 'hit' | 'expired';
  customData: Record<string, any>;
}

// Network sync utilities
export const serializeSpellState = (state: NetworkSpellState): string => {
  return JSON.stringify({
    ...state,
    position: [state.position.x, state.position.y, state.position.z],
    velocity: state.velocity ? [state.velocity.x, state.velocity.y, state.velocity.z] : undefined
  });
};

export const deserializeSpellState = (data: string): NetworkSpellState => {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    position: new THREE.Vector3().fromArray(parsed.position),
    velocity: parsed.velocity ? new THREE.Vector3().fromArray(parsed.velocity) : undefined
  };
};

// Get spell template by ID
export const getSpellTemplate = (id: string): SpellTemplate | undefined => {
  const templates = [FIRE_SPELL_TEMPLATE, LIGHTNING_SPELL_TEMPLATE];
  return templates.find(t => t.id === id);
};

// Get spell template by weapon type
export const getSpellTemplateByWeapon = (weapon: WeaponSchema): SpellTemplate | undefined => {
  const templates = [FIRE_SPELL_TEMPLATE, LIGHTNING_SPELL_TEMPLATE];
  return templates.find(t => t.weaponType === weapon.type);
};