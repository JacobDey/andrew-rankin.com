// Rendering helpers for generated materials.
//
// createMacroViewMaterial(): a ShaderMaterial for a flat specimen viewed through
// a macro lens: raking key light with heightfield ray-marched self-shadows,
// GGX specular, a procedural softbox reflection, parallax for the +-5 degree
// tilt, and debug channel views. Put it on a PlaneGeometry (or a full-screen
// quad); UV 0..1 of the plane maps to the uvOffset/uvScale window of the maps.
//
// applyMapsToStandardMaterial(): wires the maps into a MeshStandardMaterial for
// props in 3D scenes.

import * as THREE from 'three'
import type { MaterialMaps } from './types'

export type ViewMode = 'lit' | 'albedo' | 'height' | 'normal' | 'roughness' | 'ao' | 'metalness' | 'curvature' | 'loose'
const MODES: ViewMode[] = ['lit', 'albedo', 'height', 'normal', 'roughness', 'ao', 'metalness', 'curvature', 'loose']

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tAlbedo;
uniform sampler2D tNormal;
uniform sampler2D tOrm;
uniform sampler2D tHeight;
uniform vec2 uUvOffset;
uniform vec2 uUvScale;
uniform float uMapMm;        // millimetres covered by uv 0..1 of the maps
uniform vec2 uHRange;        // min/max height (mm)
uniform vec3 uLight;         // direction TO the light, tangent space (z up)
uniform vec3 uLightColor;
uniform vec3 uView;          // direction TO the viewer, tangent space (tilt)
uniform float uRing;         // 1 = ring light on the lens axis (flat, true colour)
uniform int uMode;
uniform int uShadowSteps;
uniform float uExposure;
uniform float uAmbient;
uniform float uVignette;
uniform float uParallax;
varying vec2 vUv;

float Hs(vec2 uv) { return texture2D(tHeight, uv).r; }

vec3 neutralTonemap(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, newPeak * vec3(1.0), g);
}
vec3 toLinear(vec3 srgb) { return pow(srgb, vec3(2.2)); }

float D_GGX(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (3.14159265 * d * d); }
float V_Smith(float NoV, float NoL, float a) {
  float k = a * 0.5;
  return 0.25 / max((NoV * (1.0 - k) + k) * (NoL * (1.0 - k) + k), 1e-4);
}
vec3 F_Schlick(vec3 f0, float VoH) { return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0); }

float sat01(float x) { return clamp(x, 0.0, 1.0); }
// the studio the specimen sits in: a dim room brighter toward the ceiling, a big
// gridded softbox ~25 deg off the lens axis on the key-light side, and a thin
// strip light opposite it. Flat metals mirror the softbox edge across the frame.
float boxLight(vec3 R, vec3 c, vec2 half_, float blur) {
  vec3 ax = normalize(cross(vec3(0.0, 0.0, 1.0), c));
  vec3 ay = cross(c, ax);
  float z = dot(R, c);
  vec2 p = vec2(dot(R, ax), dot(R, ay)) / max(z, 0.05);
  vec2 q = abs(p) - half_;
  float box = (1.0 - smoothstep(-blur, blur, max(q.x, q.y))) * smoothstep(0.0, 0.1, z);
  vec2 g = abs(fract(p * 2.5) - 0.5);
  float grid = 1.0 - 0.35 * (1.0 - smoothstep(0.02, 0.02 + blur, min(g.x, g.y))) * step(blur, 0.25);
  return box * grid;
}
float studioEnv(vec3 R, float rough) {
  float blur = 0.025 + rough * rough * 1.6;
  float room = 0.035 + 0.22 * smoothstep(0.1, 1.0, R.z);
  float soft = boxLight(R, normalize(vec3(-0.3, 0.3, 0.9)), vec2(0.5, 0.36), blur);
  float strip = boxLight(R, normalize(vec3(0.62, -0.55, 0.56)), vec2(0.06, 0.6), blur);
  return room + soft * 2.6 + strip * 1.2;
}

void main() {
  vec2 base = uUvOffset + vUv * uUvScale;
  // per-pixel view ray of a ~20 degree lens (so flat metals show a reflection gradient)
  vec2 scr = (vUv - 0.5) * vec2(uUvScale.x / uUvScale.y, 1.0) * 0.36;
  vec3 V = normalize(normalize(uView) - vec3(scr, 0.0));
  float hMid = 0.5 * (uHRange.x + uHRange.y);
  // parallax (tilt): find where the view ray meets the heightfield
  vec2 uv = base;
  if (uParallax > 0.5) {
    for (int i = 0; i < 4; i++) {
      float h = Hs(uv);
      uv = base + V.xy / V.z * (h - hMid) / uMapMm;
    }
  }
  vec4 albA = texture2D(tAlbedo, uv);
  vec3 alb = albA.rgb;
  vec4 nm = texture2D(tNormal, uv);
  vec3 N = normalize(nm.xyz * 2.0 - 1.0);
  vec4 orm = texture2D(tOrm, uv);
  vec4 hh = texture2D(tHeight, uv);
  float ao = orm.r, rough = max(orm.g, 0.03), metal = orm.b;
  float h0 = hh.r;

  vec3 col;
  if (uMode == 0) {
    vec3 L = normalize(uRing > 0.5 ? V : uLight);
    float sh = 1.0;
    if (uRing < 0.5 && uShadowSteps > 0) {
      float lxy = max(length(L.xy), 1e-4);
      vec2 ld = L.xy / lxy;
      float tanE = L.z / lxy;
      float maxDist = clamp((uHRange.y - h0) / tanE, 0.0, uMapMm * 0.3);
      float stepMm = maxDist / float(uShadowSteps);
      float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      for (int i = 0; i < 64; i++) {
        if (i >= uShadowSteps) break;
        float dmm = stepMm * (float(i) + 0.5 + 0.5 * jit);
        float rayH = h0 + dmm * tanE;
        float occ = Hs(uv + ld * dmm / uMapMm);
        sh = min(sh, sat01(0.5 + (rayH - occ) / (dmm * 0.09 + 1e-5)));
      }
    }
    vec3 H = normalize(L + V);
    float NoL = max(dot(N, L), 0.0), NoV = max(dot(N, V), 1e-3), NoH = max(dot(N, H), 0.0), VoH = max(dot(V, H), 0.0);
    float a = rough * rough;
    vec3 f0 = mix(vec3(0.04), alb, metal);
    vec3 F = F_Schlick(f0, VoH);
    vec3 spec = F * D_GGX(NoH, a) * V_Smith(NoV, NoL, a);
    vec3 kd = (1.0 - F) * (1.0 - metal);
    vec3 direct = (kd * alb / 3.14159265 + spec) * NoL * sh * uLightColor;
    // ambient: cool hemisphere fill + studio reflections
    vec3 hemi = mix(vec3(0.05, 0.05, 0.055), vec3(0.16, 0.17, 0.19), N.z * 0.5 + 0.5) * uAmbient;
    vec3 R = reflect(-V, N);
    vec3 Fr = f0 + (max(vec3(1.0 - rough), f0) - f0) * pow(1.0 - NoV, 5.0);
    vec3 envSpec = Fr * studioEnv(R, rough) * uAmbient;
    col = direct + (alb * (1.0 - metal) * hemi + envSpec) * ao;
    col *= uExposure;
    vec2 vc = vUv - 0.5;
    col *= 1.0 - uVignette * dot(vc, vc) * 1.6;
    col = neutralTonemap(col);
  } else if (uMode == 1) col = alb;
  else if (uMode == 2) col = vec3(sat01((h0 - uHRange.x) / max(uHRange.y - uHRange.x, 1e-6)));
  else if (uMode == 3) col = toLinear(nm.xyz);
  else if (uMode == 4) col = vec3(rough);
  else if (uMode == 5) col = vec3(ao);
  else if (uMode == 6) col = vec3(metal);
  else if (uMode == 7) col = toLinear(vec3(0.5 + hh.g * 0.02 * uMapMm / 10.0));
  else col = toLinear(mix(vec3(0.08), vec3(1.0, 0.6, 0.2), albA.a));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

export interface MacroViewMaterial extends THREE.ShaderMaterial {
  setMaps(maps: MaterialMaps): void
  /** azimuth: degrees counter-clockwise from +U. elevation: degrees above the surface. */
  setLight(azimuthDeg: number, elevationDeg: number, intensity?: number): void
  /** camera tilt in degrees about the U and V axes (+-5 is the game's range) */
  setTilt(tiltUDeg: number, tiltVDeg: number): void
  setMode(mode: ViewMode): void
  /** show part of the maps: offset/scale in the maps' UV space */
  setWindow(offsetU: number, offsetV: number, scale: number): void
}

export interface MacroViewOptions {
  /** shadow ray-march steps (0 disables). Default 24; 12 on phones. */
  shadowSteps?: number
  parallax?: boolean
  exposure?: number
  vignette?: number
}

export function createMacroViewMaterial(maps: MaterialMaps | null, opts: MacroViewOptions = {}): MacroViewMaterial {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      tAlbedo: { value: null },
      tNormal: { value: null },
      tOrm: { value: null },
      tHeight: { value: null },
      uUvOffset: { value: new THREE.Vector2(0, 0) },
      uUvScale: { value: new THREE.Vector2(1, 1) },
      uMapMm: { value: 10 },
      uHRange: { value: new THREE.Vector2(0, 1) },
      uLight: { value: new THREE.Vector3(0, 0, 1) },
      uLightColor: { value: new THREE.Color(1, 0.95, 0.89).multiplyScalar(4.2) },
      uView: { value: new THREE.Vector3(0, 0, 1) },
      uRing: { value: 0 },
      uMode: { value: 0 },
      uShadowSteps: { value: opts.shadowSteps ?? 24 },
      uExposure: { value: opts.exposure ?? 1 },
      uAmbient: { value: 1 },
      uVignette: { value: opts.vignette ?? 0.25 },
      uParallax: { value: opts.parallax === false ? 0 : 1 },
    },
    toneMapped: false,
  }) as MacroViewMaterial
  const u = mat.uniforms
  mat.setMaps = (m) => {
    u.tAlbedo.value = m.albedo
    u.tNormal.value = m.normal
    u.tOrm.value = m.orm
    u.tHeight.value = m.height
    u.uMapMm.value = m.info.tileMm * m.region.w
    const lo = m.heightRange ? m.heightRange[0] : 0
    const hi = m.heightRange ? m.heightRange[1] : m.info.reliefMm
    ;(u.uHRange.value as THREE.Vector2).set(lo, hi)
  }
  mat.setLight = (az, el, intensity) => {
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el)
    ;(u.uLight.value as THREE.Vector3).set(Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e))
    if (intensity !== undefined) (u.uLightColor.value as THREE.Color).setRGB(1, 0.95, 0.89).multiplyScalar(intensity)
  }
  mat.setTilt = (tu, tv) => {
    const x = Math.sin(THREE.MathUtils.degToRad(tu)), y = Math.sin(THREE.MathUtils.degToRad(tv))
    ;(u.uView.value as THREE.Vector3).set(x, y, Math.sqrt(Math.max(1e-4, 1 - x * x - y * y)))
  }
  mat.setMode = (m) => { u.uMode.value = Math.max(0, MODES.indexOf(m)) }
  mat.setWindow = (ou, ov, s) => {
    ;(u.uUvOffset.value as THREE.Vector2).set(ou, ov)
    ;(u.uUvScale.value as THREE.Vector2).set(s, s)
  }
  mat.setLight(135, 20)
  if (maps) mat.setMaps(maps)
  return mat
}

/** Wire maps into a MeshStandardMaterial. Textures are shared: setting repeat here affects every user of these maps. */
export function applyMapsToStandardMaterial(mat: THREE.MeshStandardMaterial, maps: MaterialMaps, repeat?: [number, number]): THREE.MeshStandardMaterial {
  mat.map = maps.albedo
  mat.normalMap = maps.normal
  mat.normalMapType = THREE.TangentSpaceNormalMap
  mat.roughnessMap = maps.orm
  mat.metalnessMap = maps.orm
  mat.aoMap = maps.orm
  mat.aoMapIntensity = 1
  mat.roughness = 1
  mat.metalness = 1
  if (repeat) for (const t of [maps.albedo, maps.normal, maps.orm]) t.repeat.set(repeat[0], repeat[1])
  mat.needsUpdate = true
  return mat
}
