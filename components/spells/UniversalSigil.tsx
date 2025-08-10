import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { AnimationState, WeaponSchema } from '../../types';
import { AnimationState as AnimStateEnum } from '../../types';
import { lerp } from 'three/src/math/MathUtils';
import { getSpellTemplateByWeapon, createSigilGeometry, createGlyphPositions } from './factories/SpellFactory';

const Glyph: React.FC = () => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.5);
    s.lineTo(0.25, 0.1);
    s.lineTo(0.1, 0.1);
    s.lineTo(0, -0.3);
    s.lineTo(-0.5, 0.1);
    s.lineTo(-0.25, 0.1);
    s.closePath();
    return s;
  }, []);
  return <extrudeGeometry args={[shape, { steps: 1, depth: 0.01, bevelEnabled: false }]} />;
};

interface UniversalSigilProps {
  animationState: AnimationState;
  equippedWeapon: WeaponSchema;
}

const UniversalSigil: React.FC<UniversalSigilProps> = ({ animationState, equippedWeapon }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const glyphRefs = useRef<(THREE.Mesh | null)[]>([]);
  const { camera } = useThree();
  
  const template = useMemo(() => getSpellTemplateByWeapon(equippedWeapon), [equippedWeapon]);
  
  const material = useMemo(() => {
    if (!template) return new THREE.MeshBasicMaterial({ color: '#ffaa00' });
    
    return new THREE.MeshBasicMaterial({
      color: template.visual.primaryColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
  }, [template]);
  
  const glyphPositions = useMemo(() => {
    if (!template) return [];
    return createGlyphPositions(template.sigil);
  }, [template]);
  
  const animationProgress = useRef(0);

  useEffect(() => {
    if (animationState === AnimStateEnum.Charging) {
      animationProgress.current = 0;
    }
  }, [animationState]);

  useFrame((_, delta) => {
    if (!groupRef.current || !template) return;

    const isChargingOrCharged = animationState === AnimStateEnum.Charging || animationState === AnimStateEnum.Charged;
    let targetScale: number, targetOpacity: number;

    if (isChargingOrCharged) {
      groupRef.current.visible = true;
      groupRef.current.position.lerp(
        camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(2.5)), 
        delta * 20
      );
      groupRef.current.quaternion.slerp(camera.quaternion, delta * 20);
      
      if (animationState === AnimStateEnum.Charging) {
        animationProgress.current = Math.min(1, animationProgress.current + delta / (equippedWeapon.stats.chargeDuration / 1000));
        targetScale = lerp(0.01, 1, animationProgress.current);
        targetOpacity = lerp(0, 0.8, animationProgress.current);
      } else { // Charged
        animationProgress.current = 1;
        const pulseBehavior = template.sigil.pulseBehavior;
        
        if (pulseBehavior === 'pulse') {
          targetScale = 1 + Math.sin(performance.now() * 0.008) * 0.08;
          targetOpacity = 0.9 + Math.sin(performance.now() * 0.012) * 0.1;
        } else if (pulseBehavior === 'steady') {
          targetScale = 1;
          targetOpacity = 1;
        } else { // charge-sync
          targetScale = 1 + Math.sin(performance.now() * 0.005) * 0.05;
          targetOpacity = 1;
        }
      }
    } else {
      targetScale = lerp(groupRef.current.scale.x, 0, delta * 15);
      targetOpacity = lerp(material.opacity, 0, delta * 15);
    }

    groupRef.current.scale.setScalar(lerp(groupRef.current.scale.x, targetScale, delta * 10));
    material.opacity = lerp(material.opacity, targetOpacity, delta * 10);

    if (material.opacity < 0.01 && !isChargingOrCharged) {
      groupRef.current.visible = false;
    }

    // Animate rings with individual speeds
    const speedMultiplier = animationProgress.current * (animationState === AnimStateEnum.Charged ? 1.5 : 1.0);
    template.sigil.rotationSpeed.forEach((speed, i) => {
      const ring = ringRefs.current[i];
      if (ring) {
        ring.rotation.z += delta * speed * speedMultiplier;
      }
    });
    
    // Animate glyphs with subtle wobble
    glyphRefs.current.forEach((glyph, i) => {
      if (glyph) {
        const baseRotation = glyphPositions[i]?.rotation || 0;
        const wobble = Math.sin(performance.now() * 0.003 + i) * 0.1;
        glyph.rotation.z = baseRotation + wobble * animationProgress.current;
        
        // Scale glyphs based on animation progress
        const glyphScale = 0.2 + (0.05 * animationProgress.current);
        glyph.scale.setScalar(glyphScale);
      }
    });
  });

  if (!template) return null;

  const baseRadius = template.sigil.baseRadius;
  const ringCount = template.sigil.ringCount;
  
  return (
    <group ref={groupRef} visible={false}>
      {/* Render rings */}
      {Array.from({ length: ringCount }, (_, i) => {
        const radius = baseRadius * (1.1 - (i * 0.3));
        const thickness = 0.01 + (i * 0.005);
        
        return (
          <mesh 
            key={`ring-${i}`} 
            ref={el => ringRefs.current[i] = el}
            material={material}
          >
            <torusGeometry args={[radius, thickness, 16, 100]} />
          </mesh>
        );
      })}
      
      {/* Render glyphs */}
      {glyphPositions.map((glyph, i) => (
        <mesh 
          key={`glyph-${i}`}
          ref={el => glyphRefs.current[i] = el}
          position={glyph.position}
          rotation-z={glyph.rotation}
          material={material}
        >
          <Glyph />
        </mesh>
      ))}
      
      {/* Central glow effect for charged state */}
      {animationState === AnimStateEnum.Charged && (
        <mesh material={material}>
          <planeGeometry args={[baseRadius * 0.3, baseRadius * 0.3]} />
        </mesh>
      )}
    </group>
  );
};

export default UniversalSigil;