
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { extend, useFrame } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import type { AnimationState, WeaponSchema } from '../../types';
import { AnimationState as AnimStateEnum } from '../../types';
import {
    STAFF_SHAFT_LENGTH,
    FERRULE_LENGTH,
    GRIP_LENGTH,
    GRIP_OFFSET_FROM_FERRULE,
    SHAFT_RADIUS,
    COLOR_PROJECTILE,
} from '../../constants';
import { lerp } from 'three/src/math/MathUtils';

const PlasmaMaterial = shaderMaterial(
    { 
      uTime: 0, 
      uProgress: 0, 
      uColor: new THREE.Color(COLOR_PROJECTILE), 
      uBandHeight: 0.55,
      uResolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
    },
    ` 
      varying vec2 vUv; 
      void main() { 
        vUv = uv; 
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
      } 
    `,
    `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uProgress;
      uniform vec3 uColor;
      uniform float uBandHeight;
      uniform vec2 uResolution;
      float noise(vec2 p) { 
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); 
      }
      float turbulence(vec2 p) { 
        float n = 0.0; 
        float freq = 1.0; 
        float amp = 1.0; 
        for (int i = 0; i < 6; i++) { 
          n += amp * noise(p * freq + uTime * 0.1); 
          freq *= 2.0; 
          amp *= 0.5; 
        } 
        return n; 
      }
      float layeredNoise(vec2 p) { 
        float n = turbulence(p); 
        n += 0.25 * turbulence(p * 4.0 + vec2(uTime * 0.05, 0.0)); 
        n += 0.125 * turbulence(p * 8.0 + vec2(0.0, uTime * 0.03)); 
        return clamp(n, 0.0, 1.0); 
      }
      void main() {
          float y = vUv.y;
          float plasma_top = uProgress;
          float plasma_bottom = uProgress - uBandHeight;
          if (y < plasma_bottom || y > plasma_top) discard;
          // Convert to polar coordinates for mandala effect
          vec2 uv = vUv - 0.5; // Center at (0.5, 0.5)
          float angle = atan(uv.y, uv.x) + uTime * 0.5; // Rotating angle
          float radius = length(uv) * 2.0; // Scale radius for detail
          // Create radial segments
          float segment = floor(angle / (3.14159 / 8.0)); // 16 segments
          float pattern = sin(radius * 10.0 + segment * 0.5) * 0.5 + 0.5; // Radial wave pattern
          float band_progress = (y - plasma_bottom) / uBandHeight;
          float base_intensity = sin(band_progress * 3.14159) * pattern; // Modulate with mandala
          float flicker = noise(vec2(angle * 10.0, radius * 10.0) + uTime * 2.0) * 0.5 + 0.5;
          float turbulence_effect = layeredNoise(vec2(angle, radius) * 15.0) * 0.4;
          float high_def_intensity = clamp(base_intensity * flicker + turbulence_effect, 0.0, 1.0);
          // Geometric mandala color gradient
          vec3 baseColor = uColor;
          vec3 accentColor = vec3(uColor.r * 0.7, uColor.g * 1.3, uColor.b * 1.1); // Warm accent
          float mandala_gradient = cos(radius * 3.14159) * 0.5 + 0.5; // Radial gradient
          vec3 finalColor = mix(baseColor, accentColor, mandala_gradient);
          float glow = smoothstep(0.2, 0.8, band_progress) * smoothstep(0.3, 0.7, pattern) * 0.4; // Enhanced glow
          gl_FragColor = vec4(finalColor + vec3(glow), high_def_intensity * 0.9);
      }
    `
  );

extend({ PlasmaMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    plasmaMaterial: any;
  }
}

const PlasmaCharge: React.FC<{ animationState: AnimationState; weaponStats: WeaponSchema['stats'] }> = ({ animationState, weaponStats }) => {
    const materialRef = useRef<any>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const animationProgress = useRef(0);

    useEffect(() => {
        if (animationState !== AnimStateEnum.Charging) {
            animationProgress.current = 0;
        }
    }, [animationState]);

    useFrame((_, delta) => {
        if (!materialRef.current || !meshRef.current) return;
        
        materialRef.current.uTime += delta;
        const isVisible = animationState === AnimStateEnum.Charging;
        
        if (isVisible) {
            animationProgress.current = Math.min(1, animationProgress.current + (delta / (weaponStats.chargeDuration / 1000)));
        }

        const targetProgress = isVisible ? animationProgress.current : 0;
        materialRef.current.uniforms.uProgress.value = lerp(materialRef.current.uniforms.uProgress.value, targetProgress, delta * 10.0);
        
        meshRef.current.visible = materialRef.current.uniforms.uProgress.value > 0.01;
    });

    const plasmaHeight = STAFF_SHAFT_LENGTH - FERRULE_LENGTH - GRIP_LENGTH - GRIP_OFFSET_FROM_FERRULE;
    const plasmaYOffset = -STAFF_SHAFT_LENGTH / 2 + FERRULE_LENGTH + GRIP_OFFSET_FROM_FERRULE + plasmaHeight / 2;

    return (
        <mesh ref={meshRef} position-y={plasmaYOffset} visible={false}>
            <cylinderGeometry args={[SHAFT_RADIUS * 1.01, SHAFT_RADIUS * 1.01, plasmaHeight, 32, 1, true]} />
            <plasmaMaterial
                ref={materialRef}
                key={PlasmaMaterial.key}
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};

export default PlasmaCharge;