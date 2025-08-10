import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { COLOR_PROJECTILE } from '../../constants';
import { eventBus } from '../../systems/eventBus';
import type { UserData, EnemyHitPayload } from '../../types';

interface NovaEffectProps {
  position: THREE.Vector3;
  onComplete: () => void;

  // Backward compatible controls
  radius?: number;
  damage?: number;
  durationMs?: number;
  ringThickness?: number;
  impulse?: number;
  collisionGroups?: number;
  includeFriends?: boolean;

  // New, optional layers (all default off; turning them on costs GPU only when visible)
  echoes?: number;           // extra echo rings (0-3 recommended)
  emberCount?: number;       // GPU sparks/embers (0 to disable)
  pillar?: boolean;          // vertical plasma column
  fakeRefraction?: boolean;  // heat-haze wobble on shock ring
  scorchDecal?: boolean;     // quick ground scorch
}

const DEFAULTS = {
  radius: 15,
  damage: 50,
  durationMs: 1000,
  ringThickness: 0.6,
  impulse: 0,
  echoes: 2,
  emberCount: 250,
  pillar: true,
  fakeRefraction: true,
  scorchDecal: true,
};

const GEOM = {
  ring: new THREE.CylinderGeometry(1, 1, 0.02, 128, 1, true),
  ringThin: new THREE.CylinderGeometry(1, 1, 0.01, 96, 1, true),
  torus: new THREE.TorusGeometry(1, 0.045, 14, 192),
  quad: new THREE.PlaneGeometry(1, 1),
  // GPU embers: billboarded quads via InstancedMesh; geometry reused
  ember: new THREE.PlaneGeometry(0.08, 0.08),
};

const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function makeShockMaterial(color: THREE.Color, maxR: number, fakeRefract: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: 0 },
      uOuter: { value: 0 },
      uMaxR: { value: maxR },
      uColor: { value: color.clone() },
      uRefract: { value: fakeRefract ? 1 : 0 },
    },
    vertexShader: `
      varying vec2 vXZ;
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vWorld = wp.xyz;
        vXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime, uInner, uOuter, uMaxR;
      uniform vec3 uColor;
      uniform int uRefract;
      varying vec2 vXZ;
      varying vec3 vWorld;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);
        float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
        vec2 u=f*f*(3.-2.*f);
        return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
      }

      void main(){
        float r = length(vXZ);
        float shell = smoothstep(uInner-0.18, uInner+0.18, r) * (1.0 - smoothstep(uOuter-0.18, uOuter+0.18, r));
        // Edge burn/noise
        float n = noise(vXZ*0.7 + uTime*0.8)*0.5 + 0.5;
        float energy = smoothstep(1.0, 0.0, uInner/(uMaxR*1.05));
        float alpha = shell * (0.52 + 0.48*n) * energy;

        // Fake refraction: offset alpha with another band (gives a wobble shimmer)
        if(uRefract==1){
          float wob = noise(vXZ*1.4 - uTime*0.9);
          alpha *= (0.85 + 0.15*wob);
        }

        vec3 col = uColor * (1.15 + 0.65*n) * energy;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function makeEchoMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uScale: { value: 1 },
      uPhase: { value: Math.random() * 10 },
    },
    vertexShader: `
      varying float vR;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vR = length(wp.xz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime, uScale;
      uniform vec3 uColor;
      varying float vR;
      void main(){
        float edge = smoothstep(0.0, 1.0, 1.0 - abs(fract(vR*uScale - uTime*3.0)-0.5)*2.0);
        float fade = smoothstep(1.0, 0.0, uTime);
        gl_FragColor = vec4(uColor, edge * fade * 0.3);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function makePillarMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
    },
    vertexShader: `
      varying float vY;
      void main(){
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying float vY;

      float bands(float y){
        float s = sin((y+uTime*4.0)*6.2831);
        return 0.55 + 0.45*abs(s);
      }

      void main(){
        float fade = smoothstep(1.0, 0.0, uTime);
        float a = bands(vY) * fade * 0.5;
        gl_FragColor = vec4(uColor*1.2, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function makeEmberMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
    },
    vertexShader: `
      attribute float aAngle;
      attribute float aSeed;
      attribute float aRadius0;
      attribute float aHeight;
      varying float vLife;
      void main(){
        // life in [0,1]
        float t = fract(aSeed + uTime*0.85);
        vLife = t;

        // expanding spiral + gentle rise
        float r = mix(aRadius0, aRadius0*4.0, t);
        float ang = aAngle + t*6.0;
        vec3 pos = vec3(cos(ang)*r, t*aHeight, sin(ang)*r);

        // billboard
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        // scale shrinks over time
        float s = mix(1.0, 0.5, t);
        mv.xy += vec2(position.x, position.y) * s * 0.12;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vLife;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        float alpha = smoothstep(0.6, 0.0, d) * (1.0 - vLife);
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const NovaEffect: React.FC<NovaEffectProps> = ({
  position,
  onComplete,
  radius = DEFAULTS.radius,
  damage = DEFAULTS.damage,
  durationMs = DEFAULTS.durationMs,
  ringThickness = DEFAULTS.ringThickness,
  impulse = DEFAULTS.impulse,
  collisionGroups,
  includeFriends = false,
  echoes = DEFAULTS.echoes,
  emberCount = DEFAULTS.emberCount,
  pillar = DEFAULTS.pillar,
  fakeRefraction = DEFAULTS.fakeRefraction,
  scorchDecal = DEFAULTS.scorchDecal,
}) => {
  const { world, rapier } = useRapier();

  // --- Materials (pooled, no per-frame allocs)
  const color = useMemo(() => new THREE.Color(COLOR_PROJECTILE), []);
  const matShock = useMemo(() => makeShockMaterial(color, radius, fakeRefraction), [color, radius, fakeRefraction]);
  const matEcho = useMemo(() => makeEchoMaterial(color), [color]);
  const matHalo = useMemo(() => makePillarMaterial(color), [color]);
  const matEmber = useMemo(() => makeEmberMaterial(color), [color]);

  // --- Refs
  const ringRef = useRef<THREE.Mesh>(null);
  const echoRefs = useRef<THREE.Mesh[]>([]);
  const pillarRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const scorchRef = useRef<THREE.Mesh>(null);
  const emberRef = useRef<THREE.InstancedMesh>(null);

  const elapsedRef = useRef(0);
  const prevRRef = useRef(0);
  const hitOnce = useRef<Set<string | number>>(new Set());

  // --- Embers attributes (GPU driven)
  useEffect(() => {
    if (!emberRef.current || emberCount <= 0) return;
    const mesh = emberRef.current;
    mesh.count = emberCount;

    const aAngle = new Float32Array(emberCount);
    const aSeed = new Float32Array(emberCount);
    const aRadius0 = new Float32Array(emberCount);
    const aHeight = new Float32Array(emberCount);

    for (let i = 0; i < emberCount; i++) {
      aAngle[i] = Math.random() * Math.PI * 2;
      aSeed[i] = Math.random();
      aRadius0[i] = 0.15 + Math.random() * 0.35;
      aHeight[i] = radius * (0.4 + Math.random() * 0.4);
    }

    mesh.geometry.setAttribute('aAngle', new THREE.InstancedBufferAttribute(aAngle, 1));
    mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    mesh.geometry.setAttribute('aRadius0', new THREE.InstancedBufferAttribute(aRadius0, 1));
    mesh.geometry.setAttribute('aHeight', new THREE.InstancedBufferAttribute(aHeight, 1));

    for (let i = 0; i < emberCount; i++) {
      const m = new THREE.Matrix4();
      m.setPosition(position.x, position.y + 0.2, position.z);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [emberCount, radius, position]);

  // --- Scorch decal
  const scorchMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x201008),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  }), []);

  // --- Cleanup
  useEffect(() => {
    return () => {
      matShock.dispose();
      matEcho.dispose();
      matHalo.dispose();
      matEmber.dispose();
      scorchMat.dispose();
    };
  }, [matShock, matEcho, matHalo, matEmber, scorchMat]);

  // --- Once on spawn: create quick scorch fade-in
  useEffect(() => {
    if (!scorchDecal || !scorchRef.current) return;
    const s = scorchRef.current;
    s.position.set(position.x, position.y + 0.001, position.z);
    s.rotation.x = -Math.PI / 2;
    s.scale.set(radius * 0.9, radius * 0.9, 1);
    (s.material as THREE.MeshBasicMaterial).opacity = 0.35;
    const to = setTimeout(() => {
      // fade-out over time (handled in frame)
    }, 0);
    return () => clearTimeout(to);
  }, [scorchDecal, position, radius]);

  // --- Core damage sweep
  useFrame((_, dt) => {
    elapsedRef.current += dt;
    const t = Math.min(elapsedRef.current / (durationMs / 1000), 1.0);
    const easeT = 1.0 - Math.pow(1.0 - t, 2.0);

    const currR = easeT * radius;
    const prevR = prevRRef.current;
    const inner = Math.max(0, currR - ringThickness * 0.5);
    const outer = currR + ringThickness * 0.5;

    // visuals: ring + echoes
    if (ringRef.current) {
      ringRef.current.position.copy(position);
      ringRef.current.scale.set(currR, 1, currR);
      const m = ringRef.current.material as THREE.ShaderMaterial;
      m.uniforms.uTime.value = elapsedRef.current;
      m.uniforms.uInner.value = inner;
      m.uniforms.uOuter.value = outer;
    }

    for (let i = 0; i < echoRefs.current.length; i++) {
      const e = echoRefs.current[i];
      if (!e) continue;
      // late echoes start a bit after; they also scale faster but fade harder
      const et = THREE.MathUtils.clamp((easeT - (i + 1) * 0.12) / (1 - (i + 1) * 0.12), 0, 1);
      const r = et * radius * (1 + 0.15 * (i + 1));
      e.position.copy(position);
      e.scale.set(r, 1, r);
      (e.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsedRef.current * (1 + 0.25 * i);
    }

    if (pillar && pillarRef.current && haloRef.current) {
      const h = THREE.MathUtils.lerp(radius * 0.4, 0, easeT); // taper down
      pillarRef.current.position.set(position.x, position.y + h * 0.5 + 0.4, position.z);
      pillarRef.current.scale.set(0.6 + 0.4 * Math.sin(easeT * Math.PI), h, 0.6 + 0.4 * Math.sin(easeT * Math.PI));
      (pillarRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsedRef.current;

      haloRef.current.position.set(position.x, position.y + 0.6, position.z);
      haloRef.current.scale.set(currR, currR, currR);
      (haloRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsedRef.current;
    }

    if (emberRef.current && emberCount > 0) {
      (emberRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsedRef.current;
    }

    if (lightRef.current) {
      const e = Math.max(0, 1.0 - easeT);
      lightRef.current.intensity = 45 * (e * e + 0.04);
      lightRef.current.distance = radius * 1.9;
      lightRef.current.position.copy(position).addScaledVector(UP, 0.8);
    }

    if (scorchDecal && scorchRef.current) {
      const sm = scorchRef.current.material as THREE.MeshBasicMaterial;
      // appear quick, then slowly fade
      const appear = THREE.MathUtils.smoothstep(easeT, 0.0, 0.25);
      const fade = THREE.MathUtils.smoothstep(1.0, 0.0, easeT);
      sm.opacity = 0.38 * Math.max(appear, 0.8 * fade);
    }

    // Physics: hit once when entering shell band this frame
    const shape = new rapier.Ball(currR);
    world.intersectionsWithShape(
      position,
      { w: 1, x: 0, y: 0, z: 0 },
      shape,
      (collider) => {
        const rb = collider.parent();
        if (!rb) return true;
        const ud = rb.userData as UserData | undefined;
        if (!ud) return true;
        if (!includeFriends && ud.type !== 'enemy') return true;

        const id = ud.id ?? rb.handle;
        if (hitOnce.current.has(id)) return true;

        const p = rb.translation();
        TMP_A.set(p.x, p.y, p.z);
        const dist = TMP_A.distanceTo(position);
        const justInside = dist <= outer && dist >= inner && dist > prevR - ringThickness * 0.5;
        if (!justInside) return true;

        // distance falloff (soft)
        const fall = THREE.MathUtils.smoothstep(dist, inner, outer);
        const dmg = Math.max(1, Math.round(damage * (1.0 - 0.85 * fall)));
        eventBus.dispatch<EnemyHitPayload>('ENEMY_HIT', { id, damage: dmg, position: TMP_A.clone() });

        if (impulse > 0) {
          TMP_B.copy(TMP_A).sub(position).normalize();
          const mass = rb.mass && typeof rb.mass === 'function' ? rb.mass() : 1;
          rb.applyImpulse({ x: TMP_B.x * impulse * mass, y: Math.max(0, TMP_B.y) * impulse * 0.35 * mass, z: TMP_B.z * impulse * mass }, true);
        }
        hitOnce.current.add(id);
        return true;
      },
      collisionGroups
    );

    prevRRef.current = currR;

    if (t >= 1) onComplete();
  });

  return (
    <group>
      {/* Core expanding shock ring */}
      <mesh ref={ringRef} geometry={GEOM.ring} rotation-x={-Math.PI * 0.5}>
        <primitive object={matShock} attach="material" />
      </mesh>

      {/* Echo rings (thin, wispy) */}
      {Array.from({ length: Math.max(0, Math.min(3, echoes)) }).map((_, i) => (
        <mesh
          key={i}
          ref={el => (echoRefs.current[i] = el!)}
          geometry={GEOM.ringThin}
          rotation-x={-Math.PI * 0.5}
        >
          <primitive object={matEcho} attach="material" />
        </mesh>
      ))}

      {/* Vertical plasma pillar + outward halo */}
      {pillar && (
        <>
          <mesh ref={pillarRef} position={[position.x, position.y + 0.8, position.z]}>
            {/* Tall capsule made from a scaled torus “tube” illusion; simple & cheap */}
            <cylinderGeometry args={[0.25, 0.25, 1.0, 20, 1, true]} />
            <primitive object={matHalo} attach="material" />
          </mesh>
          <mesh ref={haloRef} geometry={GEOM.torus} position={[position.x, position.y + 0.6, position.z]}>
            <primitive object={matHalo} attach="material" />
          </mesh>
        </>
      )}

      {/* Embers / sparks (GPU instanced) */}
      {emberCount > 0 && (
        <instancedMesh ref={emberRef} args={[GEOM.ember, matEmber, emberCount]} />
      )}

      {/* Pulsing point light */}
      <pointLight ref={lightRef} color={COLOR_PROJECTILE} intensity={0} distance={radius * 1.9} decay={2} />

      {/* Scorch decal (flat billboard) */}
      {scorchDecal && (
        <mesh ref={scorchRef} geometry={GEOM.quad}>
          <primitive object={scorchMat} attach="material" />
        </mesh>
      )}
    </group>
  );
};

export default NovaEffect;
