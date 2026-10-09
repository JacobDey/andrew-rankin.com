// The specimen plate: a displaced grid + per-pixel normal map, raking key
// light with heightfield self-shadowing, softbox reflections, marble shadow /
// caustic / AO, and cloth shadows via the occluder map.

import * as THREE from 'three'
import type { SurfaceBake } from '../core/surface'
import { LIGHTING_FUNCS, LIGHTING_UNIFORMS } from './glsl'

export interface SurfaceTextures {
  height: THREE.DataTexture
  normal: THREE.DataTexture
  albedo: THREE.DataTexture
  material: THREE.DataTexture
}

export function makeSurfaceTextures(b: SurfaceBake): SurfaceTextures {
  const r = b.res
  const lin = (t: THREE.DataTexture, mips = false) => {
    t.magFilter = THREE.LinearFilter
    t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
    t.generateMipmaps = mips
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    t.anisotropy = mips ? 4 : 1
    t.needsUpdate = true
    return t
  }
  const height = lin(new THREE.DataTexture(b.heightHalf, r, r, THREE.RedFormat, THREE.HalfFloatType))
  const normal = lin(new THREE.DataTexture(b.normalHalf, r, r, THREE.RGFormat, THREE.HalfFloatType))
  const albedo = new THREE.DataTexture(b.albedo, r, r, THREE.RGBAFormat, THREE.UnsignedByteType)
  albedo.colorSpace = THREE.SRGBColorSpace
  lin(albedo, true)
  const material = lin(new THREE.DataTexture(b.material, r, r, THREE.RGBAFormat, THREE.UnsignedByteType), true)
  return { height, normal, albedo, material }
}

/** Uniforms shared by every lit material on the bench (one object, many materials). */
export function makeLightingUniforms(size: number) {
  return {
    uHeight: { value: null as THREE.Texture | null },
    uOcc: { value: null as THREE.Texture | null },
    uOccOn: { value: 0 },
    uSize: { value: size },
    uL: { value: new THREE.Vector3(-0.68, 0.68, 0.27).normalize() },
    uLightCol: { value: new THREE.Color(1, 0.94, 0.88).multiplyScalar(8.5) },
    uLampSize: { value: 0.09 },
    uCam: { value: new THREE.Vector3(0, 0, 100) },
    uBox: { value: new THREE.Vector3(0.35, 0.45, 1).normalize() },
    uBoxCol: { value: new THREE.Color(1, 1, 1).multiplyScalar(0.45) },
    uSky: { value: new THREE.Color(0.07, 0.075, 0.085) },
    uGround: { value: new THREE.Color(0.03, 0.028, 0.026) },
    uMarble: { value: new THREE.Vector4(0, 0, 0, 0) },
    uGlass: { value: 1 },
  }
}
export type LightingUniforms = ReturnType<typeof makeLightingUniforms>

export interface SurfaceOptions {
  segments: number
  shadowSteps: number
}

export function makeSurfaceMesh(tex: SurfaceTextures, size: number, lighting: LightingUniforms, o: SurfaceOptions): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, o.segments, o.segments)
  const mat = new THREE.ShaderMaterial({
    defines: { SHADOW_STEPS: o.shadowSteps },
    uniforms: {
      ...lighting,
      uNormal: { value: tex.normal },
      uAlbedo: { value: tex.albedo },
      uMat: { value: tex.material },
      uDebug: { value: 0 },
      uBump: { value: 1.5 },
    },
    vertexShader: /* glsl */ `
      uniform sampler2D uHeight;
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vec3 p = vec3(position.xy, texture(uHeight, uv).r);
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${LIGHTING_UNIFORMS}
      uniform sampler2D uNormal;
      uniform sampler2D uAlbedo;
      uniform sampler2D uMat;
      uniform float uDebug;
      uniform float uBump;
      varying vec2 vUv;
      varying vec3 vPos;
      ${LIGHTING_FUNCS}
      void main() {
        vec2 nxy = texture(uNormal, vUv).rg * uBump;
        vec3 n = normalize(vec3(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.04))));
        vec4 A = texture(uAlbedo, vUv);
        vec4 M = texture(uMat, vUv);
        vec3 albedo = A.rgb;
        float ao = A.a;
        float rough = clamp(M.r, 0.05, 1.0);
        float metal = M.g;
        vec3 V = normalize(uCam - vPos);
        vec3 diff = albedo * (1.0 - metal);
        vec3 f0 = mix(vec3(0.04), albedo, metal);

        float sh = marchShadow(vPos + vec3(0.0, 0.0, 0.004), 0.025);
        vec2 mt = marbleTerms(vPos, n);
        // cloth contact darkening: occluder just above us = something resting here
        float clothAO = clothContactAO(vUv, vPos.z);
        float nl = max(dot(n, uL), 0.0);
        vec3 direct = (diff / PI + ggx(n, V, uL, rough, f0)) * nl * uLightCol * sh * mt.x;
        vec3 amb = mix(uGround, uSky, n.z * 0.5 + 0.5) * diff * ao;
        vec3 R = reflect(-V, n);
        vec3 env = fresnelSchlick(max(dot(n, V), 0.0), f0) * softbox(R, rough) * ao;
        vec3 col = direct + (amb + env) * mt.y * clothAO;
        if (uDebug > 0.5) col = vec3(sh * mt.x);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  return mesh
}
