// Sky dome in renderer units (kcd/m²): a day gradient whose zenith luminance tracks E_sky/π, a sun disc and
// aureole, and below −4° a crossfade to the night dome (#1B2740 → #05070D) with stars (studio.md §5.2).
import * as THREE from 'three'
import type { SunState } from './contracts'

export interface Sky {
  mesh: THREE.Mesh
  update(sun: SunState, sunRGB: [number, number, number]): void
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

const FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunCol;
uniform float uDisc;
uniform float uGlow;
uniform float uNight;
uniform vec3 uNightTop;
uniform vec3 uNightBot;
uniform float uStars;
uniform vec3 uMoonDir;
uniform float uMoon;
varying vec3 vDir;

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }

void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.45));
  float c = dot(d, uSunDir);
  float cp = max(c, 0.0);
  col += uSunCol * uGlow * (0.55 * pow(cp, 400.0) + 0.25 * pow(cp, 24.0) + 0.08 * pow(cp, 4.0));
  col += uSunCol * uDisc * smoothstep(0.99985, 0.99995, c);
  // night dome
  vec3 night = mix(uNightBot, uNightTop, pow(up, 0.6));
  // stars: a fixed hash field on the dome
  vec3 q = floor(d * 380.0);
  float s = hash(q);
  float star = step(0.9975, s) * smoothstep(0.0, 0.25, d.y) * (0.4 + 0.6 * hash(q + 7.0));
  night += vec3(0.85, 0.9, 1.0) * star * uStars;
  col = mix(col, night, uNight);
  // the moon
  float mc = dot(d, uMoonDir);
  col += vec3(1.0, 0.97, 0.92) * uMoon * smoothstep(0.99988, 0.99993, mc);
  // below the horizon: dark ground haze
  col = mix(col, uHorizon * 0.35 + night * 0.2, smoothstep(0.0, -0.08, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createSky(_seed: number): Sky {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uZenith: { value: new THREE.Color(0.2, 0.35, 0.7) },
    uHorizon: { value: new THREE.Color(0.6, 0.75, 0.9) },
    uSunCol: { value: new THREE.Color(1, 1, 1) },
    uDisc: { value: 1000 },
    uGlow: { value: 1 },
    uNight: { value: 0 },
    uNightTop: { value: new THREE.Color(0x1b2740) },
    uNightBot: { value: new THREE.Color(0x05070d) },
    uStars: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uMoon: { value: 0 },
  }
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.BackSide, depthWrite: false, fog: false })
  mat.toneMapped = true
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  mesh.name = 'sky'
  const zen = new THREE.Color()
  const hor = new THREE.Color()
  return {
    mesh,
    update(sun, rgb) {
      const el = sun.elevDeg
      uniforms.uSunDir.value.copy(sun.dir)
      uniforms.uMoonDir.value.copy(sun.moonDir)
      // zenith luminance ~ E_sky/π (kcd/m²); horizon brighter and warmer near sunset
      const L = sun.skyLux / Math.PI / 1000
      const warm = 1 - THREE.MathUtils.smoothstep(el, -2, 18)
      zen.setRGB(0.16, 0.34, 0.95, THREE.LinearSRGBColorSpace) // #5B8FD1-ish in linear
      zen.lerp(new THREE.Color(0.32, 0.36, 0.62), warm * 0.6)
      hor.setRGB(0.6, 0.76, 0.98, THREE.LinearSRGBColorSpace) // #CFE3F2
      hor.lerp(new THREE.Color(1.0, 0.62, 0.32), warm * 0.85)
      uniforms.uZenith.value.copy(zen).multiplyScalar(L * 0.5)
      uniforms.uHorizon.value.copy(hor).multiplyScalar(L * 0.85)
      uniforms.uSunCol.value.setRGB(rgb[0], rgb[1], rgb[2])
      // sun disc: capped so half floats survive; aureole scales with the direct sun
      uniforms.uDisc.value = Math.min(30000, sun.sunLux / 1000 * 250)
      uniforms.uGlow.value = (sun.sunLux / 1000) * 0.6
      const night = THREE.MathUtils.smoothstep(-el, 4, 14)
      uniforms.uNight.value = night
      // night dome around the night horizontal illuminance (0.002–3 lx); stars are a few times brighter
      const Ln = Math.max(0.002, sun.skyLux + sun.moonLux) / Math.PI / 1000
      uniforms.uNightTop.value.setRGB(0.011, 0.02, 0.05).multiplyScalar(Ln / 0.02)
      uniforms.uNightBot.value.setRGB(0.002, 0.003, 0.006).multiplyScalar(Ln / 0.02)
      uniforms.uStars.value = night * 0.00025
      uniforms.uMoon.value = sun.moonDir.y > 0 ? 0.0025 * night + 0.001 : 0
    },
  }
}
