import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { extend, useFrame } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import type { AnimationState } from '../../types';
import { AnimationState as AnimStateEnum } from '../../types'; // aliasing to avoid name clash
import {
    ORB_DIAMETER,
    COLOR_OBSIDIAN,
    COLOR_PROJECTILE
} from '../../constants';
import { lerp } from 'three/src/math/MathUtils';

const EnergyCoreMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(COLOR_PROJECTILE),
    uIntensity: 1.0,
    uCharge: 0.0,
    uSeed: Math.random() * 1000,
    uLayers: 16,
    uGlow: 9.0,
    uRimPower: 9.5, 
  },
  `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
  `,
  `
  precision highp float;
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uIntensity;
  uniform float uCharge;
  uniform float uSeed;
  uniform int   uLayers;
  uniform float uGlow;
  uniform float uRimPower;
  uniform float uChromatic;

  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vViewDir;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    mat2 R = mat2(0.80, -0.60, 0.60, 0.80);
    for(int i=0;i<6;i++){ // Increased iterations from 5 to 6 for finer noise detail
      s += a * noise(p);
      p = R * p * 2.02; // Slightly adjusted scale for sharper details
      a *= 0.45; // Slightly reduced for more pronounced details
    }
    return s;
  }

  void main(){
    float NoV = clamp(dot(normalize(vN), normalize(vViewDir)), 0.0, 1.0);
    float rim = pow(1.0 - NoV, uRimPower);
    vec3 n = normalize(vN);
    vec2 base = vUv * 1.3 + n.xy * 0.15; // Adjusted UV scale for higher detail
    float t = uTime * 0.2 + uSeed;
    float cs = cos(t*0.35), sn = sin(t*0.35);
    mat2 rot = mat2(cs,-sn,sn,cs);

    vec3 accum = vec3(0.0);
    float alpha = 0.0;
    float pulse = smoothstep(0.0, 1.0, uCharge) * (0.65 + 0.35*sin(uTime*10.0));
    float gain = mix(0.9, 1.8, uCharge); // Increased max gain for brighter effect

    int L = uLayers;
    for(int i=0;i<16;i++){
      if(i>=L) break;
      float f = float(i) / float(max(L-1,1));
      float shell = 1.0 - f;
      float par = mix(1.1, 3.8, f); // Adjusted range for finer layer transitions
      float speed = mix(0.2, 0.55, f); // Slightly increased speed range

      vec2 uv = rot * (base * par + vec2(0.0, t*speed));
      float field = fbm(uv);
      float layer = field * mix(1.0, 0.65, f) + rim * 0.7; // Increased rim contribution
      layer *= gain;

      float a = clamp(layer * 0.6, 0.0, 1.0); // Adjusted for sharper layer definition
      vec3 col = uColor * mix(1.0, 1.6, pulse) * mix(0.75, 1.3, rim); // Enhanced contrast
      col.gb *= mix(1.0, 0.55, shell); // Slightly sharper color falloff

      accum = accum + (1.0 - alpha) * col * a;
      alpha = alpha + (1.0 - alpha) * a;
    }
    vec3 color = accum * uIntensity * (0.85 + 0.25*rim) * uGlow; // Enhanced rim contribution
    float a = clamp(alpha * (0.9 + 0.1*pulse), 0.0, 1.0); // Sharper alpha
    gl_FragColor = vec4(color, a * 0.95);
  }
  `
);

extend({ EnergyCoreMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    energyCoreMaterial: any;
  }
}

const Orb: React.FC<{ animationState: AnimationState }> = ({ animationState }) => {
  const materialRef = useRef<any>(null);

  const chargeTarget = useMemo(() => {
    switch (animationState) {
      case AnimStateEnum.Discharging: return 1.0;
      case AnimStateEnum.Charging: return 0.7;
      case AnimStateEnum.Charged: return 0.9;
      default: return 0.2;
    }
  }, [animationState]);

  useFrame((_, dt) => {
    const m = materialRef.current;
    if (!m) return;
    m.uTime += dt;
    m.uIntensity = lerp(m.uIntensity, 1.0 + chargeTarget * 2.5, dt * 6.0);
    m.uCharge = lerp(m.uCharge, chargeTarget, dt * 5.0);
    const spike = animationState === AnimStateEnum.Discharging ? 1.0 : 0.0;
    m.uGlow = lerp(m.uGlow, 1.0 + spike * 0.6, dt * 10.0);
  });

  return (
    <group>
      <mesh renderOrder={1}>
        <sphereGeometry args={[ORB_DIAMETER / 2 - 0.004, 128, 128]} /> {/* Increased from 64,64 to 128,128 */}
        <energyCoreMaterial
          ref={materialRef}
          key={EnergyCoreMaterial.key}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={true}
        />
      </mesh>
      <mesh renderOrder={0}>
        <sphereGeometry args={[ORB_DIAMETER / 2, 128, 128]} /> {/* Increased from 64,64 to 128,128 */}
        <meshPhysicalMaterial
          color={COLOR_OBSIDIAN}
          transmission={0.2} // Slightly reduced for sharper appearance
          ior={1.9} // Increased for more realistic refraction
          roughness={0.04} // Reduced for smoother surface
          thickness={0.05} // Slightly reduced for clarity
          specularIntensity={1.2} // Increased for brighter highlights
          clearcoat={0.25} // Slightly increased for enhanced sheen
          clearcoatRoughness={0.1} // Reduced for sharper clearcoat
        />
      </mesh>
    </group>
  );
};

export default Orb;