

import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { COLOR_PROJECTILE, COLOR_EMBER } from '../../constants';

interface ExplosionEffectProps {
  position: THREE.Vector3;
  onComplete: () => void;

  // Optional tuning (all default sane)
  durationMs?: number;       // total life
  radius?: number;           // final shock radius
  emberCount?: number;       // GPU billboards count (0 to disable)
  ringOnly?: boolean;        // disable core for cheaper look
}

const DEFAULTS = {
  durationMs: 700,
  radius: 6,
  emberCount: 220,
  ringOnly: false,
};

// ---------- Shared static geometry (no re-alloc) ----------
const GEOM = {
  sphere: new THREE.SphereGeometry(1, 48, 32),
  ring: new THREE.CylinderGeometry(1, 1, 0.015, 128, 1, true),
  quad: new THREE.PlaneGeometry(1, 1),
  ember: new THREE.PlaneGeometry(1, 1), // billboarded in shader
};

// ---------- Shock sphere (fresnel + noise + tri-color ramp) ----------
function makeShockSphereMat(colA: THREE.Color, colB: THREE.Color, colC: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColA: { value: colA.clone() },
      uColB: { value: colB.clone() },
      uColC: { value: colC.clone() },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColA, uColB, uColC;
      varying vec3 vN, vV;

      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
      float noise(vec3 p){
        vec3 i = floor(p), f = fract(p);
        float a=hash(i);
        float b=hash(i+vec3(1,0,0));
        float c=hash(i+vec3(0,1,0));
        float d=hash(i+vec3(1,1,0));
        float e=hash(i+vec3(0,0,1));
        float g=hash(i+vec3(1,0,1));
        float h=hash(i+vec3(0,1,1));
        float k=hash(i+vec3(1,1,1));
        vec3 u = f*f*(3.0-2.0*f);
        return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y),
                   mix(mix(e,g,u.x), mix(h,k,u.x), u.y), u.z);
      }

      void main(){
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.5);
        float n = noise(vec3(vN*2.0 + vV*0.01 + uTime*0.9));
        // time envelope: quick in, smooth out
        float t = clamp(uTime, 0.0, 1.0);
        float envIn = smoothstep(0.0, 0.08, t);
        float envOut = smoothstep(1.0, 0.0, t);
        float energy = envIn * envOut;

        vec3 col = mix(uColA, uColB, smoothstep(0.0,1.0,t));
        col = mix(col, uColC, fres);
        col *= (1.0 + 0.65*n);

        float alpha = (0.35 + 0.65*fres) * energy;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

// ---------- Razor-thin ring (shock edge halo + shimmer) ----------
function makeShockRingMat(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uInner: { value: 0 }, // meters (world)
      uOuter: { value: 0 },
    },
    vertexShader: `
      varying vec2 vXZ;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime, uInner, uOuter;
      uniform vec3 uColor;
      varying vec2 vXZ;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=hash(i), b=hash(i+vec2(1,0));
        float c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
        vec2 u=f*f*(3.-2.*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
      }

      void main(){
        float r = length(vXZ);
        float band = smoothstep(uInner-0.12, uInner+0.12, r) * (1.0 - smoothstep(uOuter-0.12, uOuter+0.12, r));
        float shimmer = 0.7 + 0.3*noise(vXZ*1.2 + uTime*1.3);
        float alpha = band * shimmer;
        gl_FragColor = vec4(uColor * (1.2 + 0.6*shimmer), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---------- GPU embers (instanced billboards, no per-frame CPU) ----------
function makeEmberMat(color: THREE.Color) {
  // We do full instancing (read instanceMatrix + custom per-instance attrs)
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uGravity: { value: new THREE.Vector3(0, -4.5, 0) },
      uSpeed: { value: 6.0 },
    },
    vertexShader: `
      // Instancing Attributes
      attribute vec3 aVel;
      attribute float aSeed;
      attribute float aSize;   // base size
      varying float vLife;

      // Uniforms
      uniform float uTime;
      uniform vec3 uGravity;
      uniform float uSpeed;

      void main(){
        // life in [0..1]; staggered by seed
        float t = fract(aSeed + uTime*0.9);
        vLife = t;

        // base position is the explosion origin (instanceMatrix translation)
        vec3 origin = (instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;

        // ballistic motion with gravity
        vec3 pos = origin + aVel * (t * uSpeed) + 0.5 * uGravity * (t*t);

        // billboard facing camera: use modelView for right/up
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vec3 right = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
        vec3 up    = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);

        // quad local position (unit plane geom)
        vec3 quad = position.xyz; // [-0.5..0.5] from PlaneGeometry(1,1)
        float size = aSize * mix(1.2, 0.6, t); // shrink over time

        mv.xyz += (right * quad.x + up * quad.y) * size;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vLife;
      void main(){
        // soft disc alpha
        vec2 uv = gl_PointCoord; // safe even though we use quads (ignored), we'll do radial via distance to center using fragCoord trick:
        // approximate: fade by life and vignette by quad corners
        float life = 1.0 - vLife;
        // simulate radial falloff:
        float r = length((gl_FragCoord.xy - floor(gl_FragCoord.xy)) - vec2(0.5)); // coarse, but good enough for small quads
        float alpha = smoothstep(0.6, 0.0, r) * life;
        gl_FragColor = vec4(uColor, alpha);
    }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const ExplosionEffect: React.FC<ExplosionEffectProps> = ({
  position,
  onComplete,
  durationMs = DEFAULTS.durationMs,
  radius = DEFAULTS.radius,
  emberCount = DEFAULTS.emberCount,
  ringOnly = DEFAULTS.ringOnly,
}) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const embersRef = useRef<THREE.InstancedMesh>(null);
  const elapsed = useRef(0);

  // Color palette (tri-band ramp)
  const COL_A = useMemo(() => new THREE.Color(COLOR_PROJECTILE), []);
  const COL_B = useMemo(() => new THREE.Color(COLOR_EMBER), []);
  const COL_C = useMemo(() => new THREE.Color(0xfff2cc), []); // hot white-amber tip

  // Materials
  const matShockSphere = useMemo(() => makeShockSphereMat(COL_A, COL_B, COL_C), [COL_A, COL_B, COL_C]);
  const matRing = useMemo(() => makeShockRingMat(COL_A), [COL_A]);
  const matCore = useMemo(() => new THREE.MeshBasicMaterial({
    color: COL_C, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [COL_C]);
  const matFlash = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffe2b0),
    transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  const matEmbers = useMemo(() => makeEmberMat(new THREE.Color(COLOR_EMBER)), []);

  // Init embers attributes (pure GPU motion; no per-frame CPU)
  useEffect(() => {
    if (!embersRef.current || emberCount <= 0) return;
    const mesh = embersRef.current;
    mesh.count = emberCount;

    const aVel = new Float32Array(emberCount * 3);
    const aSeed = new Float32Array(emberCount);
    const aSize = new Float32Array(emberCount);

    // Velocity cone with randomness
    for (let i = 0; i < emberCount; i++) {
      const i3 = i * 3;
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 1.6,
        (Math.random() * 1.0 + 0.2),
        (Math.random() - 0.5) * 1.6
      ).normalize().multiplyScalar(THREE.MathUtils.lerp(2.0, 5.0, Math.random()));
      aVel[i3 + 0] = dir.x;
      aVel[i3 + 1] = dir.y;
      aVel[i3 + 2] = dir.z;

      aSeed[i] = Math.random();
      aSize[i] = THREE.MathUtils.lerp(0.06, 0.14, Math.random());
    }

    mesh.geometry.setAttribute('aVel', new THREE.InstancedBufferAttribute(aVel, 3));
    mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    mesh.geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 1));

    // Instance matrices all at explosion origin
    const m = new THREE.Matrix4();
    m.setPosition(position.x, position.y, position.z);
    for (let i = 0; i < emberCount; i++) mesh.setMatrixAt(i, m);
    mesh.instanceMatrix.needsUpdate = true;
  }, [emberCount, position]);

  // Auto-complete on end
  useEffect(() => {
    const to = setTimeout(onComplete, durationMs);
    return () => clearTimeout(to);
  }, [onComplete, durationMs]);

  // Animate
  useFrame((_, dt) => {
    elapsed.current += dt;
    const t = Math.min(elapsed.current / (durationMs / 1000), 1);
    const ease = 1 - Math.pow(1 - t, 2); // fast start, smooth finish
    const R = radius * ease;

    // Light pulse: quick hot flash -> cool falloff
    if (lightRef.current) {
      const hot = Math.sin(Math.min(1, t * 1.2) * Math.PI);
      lightRef.current.intensity = 55 * (hot * hot + 0.06);
      lightRef.current.distance = radius * 3.0;
      lightRef.current.position.copy(position).y += 0.6;
      lightRef.current.color.setHSL(THREE.MathUtils.lerp(0.08, 0.02, t), 1.0, 0.6);
    }

    // Ground flash (quick bloom disc)
    if (flashRef.current) {
      const aIn = THREE.MathUtils.smoothstep(t, 0.0, 0.07);
      const aOut = THREE.MathUtils.smoothstep(1.0, 0.0, t);
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * Math.max(aIn, aOut * 0.6);
      flashRef.current.position.set(position.x, position.y + 0.001, position.z);
      flashRef.current.rotation.x = -Math.PI / 2;
      flashRef.current.scale.setScalar(THREE.MathUtils.lerp(0.5, radius * 1.2, ease));
    }

    // Core plasma (tiny hot sphere that fades)
    if (!ringOnly && coreRef.current) {
      const a = THREE.MathUtils.smoothstep(0.0, 0.12, t) * THREE.MathUtils.smoothstep(1.0, 0.0, t);
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = a * 0.9;
      coreRef.current.scale.setScalar(THREE.MathUtils.lerp(0.2, 0.7, ease));
    }

    // Expanding shock sphere (fresnel + noise)
    if (sphereRef.current) {
      sphereRef.current.scale.setScalar(Math.max(0.001, R));
      (sphereRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    }

    // Razor shock ring (thin halo)
    if (ringRef.current) {
      ringRef.current.scale.set(R, 1, R);
      const m = ringRef.current.material as THREE.ShaderMaterial;
      const ringInner = Math.max(0.0, R - 0.25);
      m.uniforms.uTime.value = elapsed.current;
      m.uniforms.uInner.value = ringInner;
      m.uniforms.uOuter.value = R + 0.25;
    }

    // GPU embers time
    if (embersRef.current) {
      (embersRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed.current;
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      matShockSphere.dispose();
      matRing.dispose();
      matCore.dispose();
      matFlash.dispose();
      matEmbers.dispose();
    };
  }, [matShockSphere, matRing, matCore, matFlash, matEmbers]);

  return (
    <group>
      {/* Hot light */}
      <pointLight ref={lightRef} color={COLOR_PROJECTILE} intensity={0} distance={radius * 3} decay={2} />

      {/* Ground flash */}
      <mesh ref={flashRef} geometry={GEOM.quad}>
        <primitive object={matFlash} attach="material" />
      </mesh>

      {/* Core spark (optional) */}
      {!ringOnly && (
        <mesh ref={coreRef} geometry={GEOM.sphere} position={[position.x, position.y, position.z]}>
          <primitive object={matCore} attach="material" />
        </mesh>
      )}

      {/* Fresnel shock sphere */}
      <mesh ref={sphereRef} geometry={GEOM.sphere} position={[position.x, position.y, position.z]}>
        <primitive object={matShockSphere} attach="material" />
      </mesh>

      {/* Razor shock ring */}
      <mesh ref={ringRef} geometry={GEOM.ring} rotation-x={-Math.PI * 0.5} position={[position.x, position.y, position.z]}>
        <primitive object={matRing} attach="material" />
      </mesh>

      {/* Embers (GPU) */}
      {emberCount > 0 && (
        <instancedMesh ref={embersRef} args={[GEOM.ember, matEmbers, emberCount]}>
          {/* instanceMatrix provided by InstancedMesh; custom attrs set in effect */}
        </instancedMesh>
      )}
    </group>
  );
};

export default ExplosionEffect;
