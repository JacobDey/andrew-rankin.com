// games/plates/render/postfx.ts — the room's 1-bit pipeline (GDD §7.1): render to a low internal
// target (lum, flag, id, depth), then threshold with a camera-anchored Bayer 8×8, draw edges
// ("bone lines in the dark"), map to the two-colour palette with a threshold-sweep transition, and
// blit nearest-neighbour to the canvas with the shake as a sub-texel offset.
import * as THREE from 'three'
import { BAYER_GLSL } from './dither'
import { hex3, PALETTES, type PaletteSweep } from './palette'

const FRAG = /* glsl */ `
${BAYER_GLSL}
uniform sampler2D tA; uniform sampler2D tDepth;
uniform vec2 uRes; uniform vec2 uCamOff; uniform vec2 uShake;
uniform float uExposure; uniform float uNear; uniform float uFar; uniform float uEdges;
uniform vec3 uInkA; uniform vec3 uLightA; uniform vec3 uInkB; uniform vec3 uLightB; uniform float uSweep;
uniform float uDim;
varying vec2 vUv;
float linZ(float d) { return (uNear * uFar) / (uFar - d * (uFar - uNear)); }
void main() {
  vec2 px = floor(vUv * uRes + uShake);
  px = clamp(px, vec2(0.0), uRes - 1.0);
  vec2 uv = (px + 0.5) / uRes;
  vec4 c = texture(tA, uv);
  float bit;
  if (c.g > 0.5) {
    bit = c.r > 0.5 ? 1.0 : 0.0;
  } else {
    float v = pow(clamp(c.r * uExposure, 0.0, 1.0), 1.0 / 2.2);
    bit = v > bayer8(px + uCamOff) ? 1.0 : 0.0;
    if (uEdges > 0.5) {
      vec2 e = 1.0 / uRes;
      float z = linZ(texture(tDepth, uv).r);
      float zl = linZ(texture(tDepth, uv - vec2(e.x, 0.0)).r), zr = linZ(texture(tDepth, uv + vec2(e.x, 0.0)).r);
      float zd = linZ(texture(tDepth, uv - vec2(0.0, e.y)).r), zu = linZ(texture(tDepth, uv + vec2(0.0, e.y)).r);
      float gz = length(vec2(zr - zl, zu - zd)) * 0.5 / max(z, 1e-3);
      float id = c.b;
      vec4 l = texture(tA, uv - vec2(e.x, 0.0)), r = texture(tA, uv + vec2(e.x, 0.0)), d = texture(tA, uv - vec2(0.0, e.y)), u = texture(tA, uv + vec2(0.0, e.y));
      bool idEdge = (abs(l.b - id) > 0.001 && l.b > id) || (abs(d.b - id) > 0.001 && d.b > id) || (abs(r.b - id) > 0.001 && r.b > id) || (abs(u.b - id) > 0.001 && u.b > id);
      if (gz > 0.08 || idEdge) bit = (c.r * uExposure) < 0.3 ? 1.0 : 0.0;
    }
  }
  if (uDim > 0.0 && bit > 0.5 && bayer8(px) < uDim) bit = 0.0;
  bool useB = bayer8(px * 1.0 + vec2(3.0, 5.0)) < uSweep;
  vec3 ink = useB ? uInkB : uInkA, light = useB ? uLightB : uLightA;
  gl_FragColor = vec4(bit > 0.5 ? light : ink, 1.0);
}`

export interface PostFX {
  target: THREE.WebGLRenderTarget
  resize(cssW: number, cssH: number, boost?: number): void
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, o: { sweep: PaletteSweep; exposure: number; camOff: [number, number]; shake: THREE.Vector2; dim: number }): void
  readonly internal: [number, number]
}

export function createPostFX(): PostFX {
  const depth = new THREE.DepthTexture(4, 4)
  const target = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, depthTexture: depth, type: THREE.UnsignedByteType })
  target.texture.generateMipmaps = false
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tA: { value: target.texture }, tDepth: { value: depth }, uRes: { value: new THREE.Vector2(4, 4) }, uCamOff: { value: new THREE.Vector2() }, uShake: { value: new THREE.Vector2() },
      uExposure: { value: 1.6 }, uNear: { value: 0.05 }, uFar: { value: 30 }, uEdges: { value: 1 },
      uInkA: { value: new THREE.Vector3() }, uLightA: { value: new THREE.Vector3() }, uInkB: { value: new THREE.Vector3() }, uLightB: { value: new THREE.Vector3() }, uSweep: { value: 1 }, uDim: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAG, depthTest: false, depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  const scene = new THREE.Scene(); scene.add(quad)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const internal: [number, number] = [4, 4]
  const toLin = (h: string) => { const [r, g, b] = hex3(h); return new THREE.Vector3(r, g, b) }
  return {
    target, internal,
    resize(cssW, cssH, boost = 1) {
      const h = Math.round((cssH >= 900 ? 450 : 360) * boost)
      const maxW = Math.round(960 * boost)
      const w = Math.min(maxW, Math.round(h * (cssW / Math.max(1, cssH))))
      const hh = w === maxW ? Math.round(maxW / (cssW / cssH)) : h
      internal[0] = Math.max(16, w); internal[1] = Math.max(16, hh)
      target.setSize(internal[0], internal[1])
      mat.uniforms.uRes.value.set(internal[0], internal[1])
    },
    render(renderer, roomScene, camera, o) {
      renderer.setRenderTarget(target)
      renderer.setClearColor(0x000000, 1)
      renderer.clear()
      renderer.render(roomScene, camera)
      renderer.setRenderTarget(null)
      const a = PALETTES[o.sweep.from], b = PALETTES[o.sweep.to]
      const u = mat.uniforms
      u.uInkA.value.copy(toLin(a.ink)); u.uLightA.value.copy(toLin(a.light)); u.uInkB.value.copy(toLin(b.ink)); u.uLightB.value.copy(toLin(b.light))
      u.uSweep.value = o.sweep.t >= 1 ? 1.01 : o.sweep.t
      u.uExposure.value = o.exposure
      u.uCamOff.value.set(o.camOff[0], o.camOff[1])
      u.uShake.value.copy(o.shake)
      u.uNear.value = camera.near; u.uFar.value = camera.far
      u.uDim.value = o.dim
      renderer.render(scene, cam)
    },
  }
}
