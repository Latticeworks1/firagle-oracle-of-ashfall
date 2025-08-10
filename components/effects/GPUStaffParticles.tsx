
// GPUStaffParticles.tsx
import * as THREE from 'three';
import React, { useMemo, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';

// === Tunables ===
const MAX_PARTICLES = 20000;
const BURST_SIZE    = 1200;
const RATE_PER_SEC  = 600;          // for continuous emission
const LIFETIME      = 1.2;          // seconds
const START_SIZE    = 0.06;
const END_SIZE      = 0.0;
const GRAVITY       = new THREE.Vector3(0,-2.2,0);
const DRAG          = 0.9;          // 0..1
const CURL_SCALE    = 0.9;          // strength of curl swirl
const CURL_FREQ     = 1.8;          // spatial frequency
const GLOW_COLOR_A  = new THREE.Color('#72f1ff'); // start
const GLOW_COLOR_B  = new THREE.Color('#9b5cff'); // end

export type EmitterAPI = {
  emit: (count?: number, pos?: THREE.Vector3, dir?: THREE.Vector3, speed?: number) => void;
  pause: (p?: boolean) => void;
  clear: () => void;
};

type Props = {
  staffTip?: THREE.Object3D | null;   // optional attachment (follow this object)
  continuous?: boolean;               // emit continuously
  sort?: boolean;                     // enable depth sorting (costly)
};

export default forwardRef<EmitterAPI, Props>(function GPUStaffParticles(
  { staffTip, continuous = false, sort = false }, ref
) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const clock = useRef(0);
  const poolHead = useRef(0);
  const paused = useRef(false);

  // Per-instance attributes:
  // spawnTime (f32), life (f32), seed (f32), initial velocity (vec3), startPos (vec3)
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.InstancedBufferGeometry();
    // base quad (billboarded in vertex)
    const base = new THREE.PlaneGeometry(1, 1, 1, 1);
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;

    const spawnTime = new Float32Array(MAX_PARTICLES);
    const life      = new Float32Array(MAX_PARTICLES);
    const seed      = new Float32Array(MAX_PARTICLES);
    const vel       = new Float32Array(MAX_PARTICLES * 3);
    const startPos  = new Float32Array(MAX_PARTICLES * 3);

    geo.setAttribute('iSpawn',   new THREE.InstancedBufferAttribute(spawnTime, 1));
    geo.setAttribute('iLife',    new THREE.InstancedBufferAttribute(life, 1));
    geo.setAttribute('iSeed',    new THREE.InstancedBufferAttribute(seed, 1));
    geo.setAttribute('iVel',     new THREE.InstancedBufferAttribute(vel, 3));
    geo.setAttribute('iStart',   new THREE.InstancedBufferAttribute(startPos, 3));

    // Shader
    const vsh = /* glsl */`
      attribute float iSpawn;
      attribute float iLife;
      attribute float iSeed;
      attribute vec3  iVel;
      attribute vec3  iStart;

      uniform float uTime;
      uniform float uDrag;
      uniform vec3  uGravity;
      uniform float uStartSize;
      uniform float uEndSize;
      uniform float uCurlScale;
      uniform float uCurlFreq;
      uniform mat4  uView;
      uniform mat4  uProj;

      varying float vLifeT;     // 0..1
      varying float vGlowMix;   // color ramp
      varying float vAlpha;

      // 3D value noise, compact
      float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float vnoise(vec3 p){
        vec3 i=floor(p), f=fract(p);
        float n = mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                          mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                          mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
        return n;
      }
      // Curl from noise gradient (cheap approximation)
      vec3 curl(vec3 p){
        float e=0.1;
        float x  = vnoise(p+vec3( e,0,0)) - vnoise(p-vec3( e,0,0));
        float y  = vnoise(p+vec3(0, e,0)) - vnoise(p-vec3(0, e,0));
        float z  = vnoise(p+vec3(0,0, e)) - vnoise(p-vec3(0,0, e));
        vec3 g = vec3(x,y,z);
        // Perpendicular swizzle for rotational field
        return normalize(vec3(g.y - g.z, g.z - g.x, g.x - g.y) + 1e-5);
      }

      void main(){
        float t = (uTime - iSpawn) / max(iLife, 1e-4); // normalized 0..1
        vLifeT = clamp(t, 0.0, 1.0);
        if (t < 0.0 || t > 1.0) { // kill offscreen by collapsing to degenerate
          gl_Position = vec4(2.0,2.0,2.0,1.0);
          vAlpha = 0.0;
          return;
        }

        // Analytic integration with drag
        float drag = clamp(uDrag, 0.0, 0.999);
        float k = 1.0 - pow(drag, t * 60.0); // frame-rate normalized drag feel
        vec3 vel = iVel * (1.0 - k) + uGravity * t;

        // Curl swirl in world space
        vec3 sw = curl(iStart * uCurlFreq + vec3(iSeed*13.1) + t * 2.0) * uCurlScale;
        vec3 pos = iStart + vel * t + sw * t;

        // Size fade
        float size = mix(uEndSize, uStartSize, 1.0 - smoothstep(0.0, 1.0, vLifeT));

        // Billboard to camera: use view (no scale from model)
        vec2 quad = position.xy * size;
        // Extract camera right/up from inverse of view (rows 0/1)
        vec3 right = normalize(vec3(uView[0][0], uView[1][0], uView[2][0]));
        vec3 up    = normalize(vec3(uView[0][1], uView[1][1], uView[2][1]));
        vec3 world = pos + right * quad.x + up * quad.y;

        vGlowMix = smoothstep(0.0, 0.8, vLifeT);
        vAlpha   = (1.0 - vLifeT) * (0.75 + 0.25 * sin(iSeed*6.2831 + vLifeT*10.0));

        gl_Position = uProj * uView * vec4(world, 1.0);
      }
    `;

    const fsh = /* glsl */`
      precision mediump float;
      varying float vLifeT;
      varying float vGlowMix;
      varying float vAlpha;

      uniform vec3 uColorA;
      uniform vec3 uColorB;

      // Soft round sprite with additive rim
      void main(){
        vec2 uv = gl_PointCoord * 2.0 - 1.0; // not used (billboarded), but keep fallbacks
        float r = length(uv);
        float soft = smoothstep(1.0, 0.0, r);
        float rim  = pow(1.0 - r, 6.0);

        vec3 color = mix(uColorA, uColorB, vGlowMix);
        float a = soft * vAlpha + rim * 0.15;
        gl_FragColor = vec4(color, a);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uDrag:       { value: DRAG },
        uGravity:    { value: GRAVITY.clone() },
        uStartSize:  { value: START_SIZE },
        uEndSize:    { value: END_SIZE },
        uCurlScale:  { value: CURL_SCALE },
        uCurlFreq:   { value: CURL_FREQ },
        uView:       { value: new THREE.Matrix4() },
        uProj:       { value: new THREE.Matrix4() },
        uColorA:     { value: GLOW_COLOR_A.clone() },
        uColorB:     { value: GLOW_COLOR_B.clone() },
      },
      vertexShader: vsh,
      fragmentShader: fsh,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    return { geo, mat };
  }, []);

  // Fill geometry and material refs
  useEffect(() => {
    materialRef.current = mat;
    return () => { mat.dispose(); geo.dispose(); };
  }, [mat, geo]);

  // API
  useImperativeHandle(ref, () => ({
    emit(count = BURST_SIZE, pos, dir, speed = 6) {
      const mesh = meshRef.current;
      if (!mesh) return;

      const iSpawn = mesh.geometry.getAttribute('iSpawn') as THREE.InstancedBufferAttribute;
      const iLife  = mesh.geometry.getAttribute('iLife')  as THREE.InstancedBufferAttribute;
      const iSeed  = mesh.geometry.getAttribute('iSeed')  as THREE.InstancedBufferAttribute;
      const iVel   = mesh.geometry.getAttribute('iVel')   as THREE.InstancedBufferAttribute;
      const iStart = mesh.geometry.getAttribute('iStart') as THREE.InstancedBufferAttribute;

      const basePos = pos ? pos.clone() : staffTip?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3();
      const forward = dir ? dir.clone().normalize()
                          : staffTip?.getWorldDirection(new THREE.Vector3()).negate() || new THREE.Vector3(0,0,-1);

      for (let n = 0; n < count; n++) {
        const idx = poolHead.current++ % MAX_PARTICLES;
        const tnow = clock.current;

        // random radial cone around forward
        const u = Math.random(), v = Math.random();
        const ang = (u - 0.5) * 0.35; // cone angle
        const az  = v * Math.PI * 2.0;
        const axis = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0));
        const quat = new THREE.Quaternion().setFromAxisAngle(axis.normalize(), ang);
        const dirv = forward.clone().applyQuaternion(quat);
        dirv.applyAxisAngle(forward, az * 0.2);

        const spd = speed * (0.6 + Math.random() * 0.8);
        const vel = dirv.multiplyScalar(spd);

        iSpawn.setX(idx, tnow);
        iLife.setX(idx, LIFETIME * (0.8 + Math.random()*0.4));
        iSeed.setX(idx, Math.random());
        iVel.setXYZ(idx, vel.x, vel.y, vel.z);
        iStart.setXYZ(idx, basePos.x, basePos.y, basePos.z);
      }
      iSpawn.needsUpdate = iLife.needsUpdate = iSeed.needsUpdate = true;
      iVel.needsUpdate = iStart.needsUpdate = true;
    },
    pause(p = true){ paused.current = p; },
    clear(){
      poolHead.current = 0;
      const iLife  = meshRef.current.geometry.getAttribute('iLife') as THREE.InstancedBufferAttribute;
      for (let i=0;i<MAX_PARTICLES;i++) iLife.setX(i, 0);
      iLife.needsUpdate = true;
    }
  }), [staffTip]);

  // Continuous emission loop
  useFrame((state, delta) => {
    clock.current += delta;
    const mat = materialRef.current;
    if(!mat) return;
    mat.uniforms.uTime.value = clock.current;
    mat.uniforms.uView.value.copy(state.camera.matrixWorldInverse);
    mat.uniforms.uProj.value.copy(state.camera.projectionMatrix);

    if (!paused.current && continuous) {
      const want = RATE_PER_SEC * delta;
      const whole = Math.floor(want);
      const frac = want - whole;
      if (whole > 0) (ref as any)?.current?.emit(whole);
      if (Math.random() < frac) (ref as any)?.current?.emit(1);
    }

    if (sort) {
      // Optional: depth sort instances (CPU cost; usually unnecessary with additive blending)
      // Skipped by default for perf.
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      {/* shared unit quad; scaled in shader */}
      <planeGeometry args={[1,1]} />
      <primitive object={mat} attach="material" />
      {/* swap geometry to our instanced buffer */}
      {/* @ts-ignore */}
      <primitive object={geo} attach="geometry" />
    </instancedMesh>
  );
});
