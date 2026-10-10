// Live finder preview: one render of the scene to a float target, a depth-based circle-of-confusion gather,
// a filmic tonemap, and a centre-weighted reflected-light meter read back every 250 ms. It is what the
// player looks through while the real exposure (PhotoRenderer) stays a separate, much heavier thing.

import * as THREE from 'three'
import { type CameraSpec, computeOptics, ev100ToLuminance, luminanceToEV100 } from './spec.ts'

export interface FinderOptions {
  /** long edge of the finder render, px (320..1024) */
  longEdge: number
  /** gather taps per pixel, 8 to 16 */
  taps: number
  /** largest circle-of-confusion radius, px */
  maxCocPx: number
}

export interface FinderRenderOptions {
  /** the exposure the finder is shown at (default: the spec's own aperture, shutter and ISO) */
  exposureEV100?: number
  flipX?: boolean
  flipY?: boolean
  /** extra display gain (default 1) */
  brightness?: number
  target?: THREE.WebGLRenderTarget | null
  viewport?: { x: number; y: number; width: number; height: number }
  /** cd/m^2 per rendered unit (1000 for kcd/m^2 scenes) */
  radianceScale?: number
  /** camera layer mask used for this render (default: the camera's own) */
  layers?: number
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const GATHER = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uCocK;      // CoC radius, px per dioptre of defocus
uniform float uInvS;      // 1 / focus distance
uniform float uMaxCoc;
uniform int uTaps;
uniform float uExposure;  // linear display scale: 0.18 / L_mid, times brightness
uniform vec2 uFlip;
varying vec2 vUv;

float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).r;
  return (uNear * uFar) / (uFar - d * (uFar - uNear));
}
float cocPx(vec2 uv) {
  return min(uMaxCoc, uCocK * abs(1.0 / viewZ(uv) - uInvS));
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
void main() {
  vec2 uv = vec2(uFlip.x > 0.0 ? vUv.x : 1.0 - vUv.x, uFlip.y > 0.0 ? vUv.y : 1.0 - vUv.y);
  float zc = viewZ(uv);
  float r0 = cocPx(uv);
  vec3 acc = texture2D(tColor, uv).rgb;
  float wsum = 1.0;
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  // how far could a nearer, more defocused neighbour reach us? probe a ring of 8
  float rNear = r0;
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.7853982 + rot;
    vec2 q = uv + vec2(cos(a), sin(a)) * (0.55 * uMaxCoc) * uTexel;
    rNear = max(rNear, cocPx(q));
  }
  float rg = max(max(r0, rNear), 1.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uTaps) break;
    float f = (float(i) + 0.5) / float(uTaps);
    float a = float(i) * 2.3999632 + rot;
    vec2 p = sqrt(f) * vec2(cos(a), sin(a));
    vec2 o = p * rg;
    vec2 tuv = uv + o * uTexel;
    float zj = viewZ(tuv);
    float rj = cocPx(tuv);
    float dist = length(o);
    float spread = step(dist, rj + 0.5);                                            // the tap's blur reaches us
    float behind = step(zc * 1.15, zj) * step(dist, r0 + 0.5) * 0.6;                // we are blurred and it is behind us
    float w = max(spread, behind);
    acc += texture2D(tColor, tuv).rgb * w;
    wsum += w;
  }
  vec3 lin = acc / wsum * uExposure;
  vec3 y = lin * (1.0 + lin / 16.0) / (1.0 + lin);
  gl_FragColor = vec4(toSRGB(y), 1.0);
}
`

const METER = /* glsl */ `
uniform sampler2D tColor;
varying vec2 vUv;
void main() {
  vec3 s = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      s += texture2D(tColor, vUv + (vec2(float(i), float(j)) - 1.5) * 0.0625 * 0.25).rgb;
    }
  }
  gl_FragColor = vec4(s / 16.0, 1.0);
}
`

function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15
  const e = (h & 0x7c00) >> 10
  const f = h & 0x03ff
  let v: number
  if (e === 0) v = (f / 1024) * Math.pow(2, -14)
  else if (e === 31) v = f ? NaN : Infinity
  else v = (1 + f / 1024) * Math.pow(2, e - 15)
  return s ? -v : v
}

const METER_N = 16

export class FinderPreview {
  private readonly renderer: THREE.WebGLRenderer
  private readonly o: FinderOptions
  private readonly geo = new THREE.PlaneGeometry(2, 2)
  private readonly pass: { scene: THREE.Scene; camera: THREE.OrthographicCamera; mesh: THREE.Mesh }
  private readonly gather: THREE.ShaderMaterial
  private readonly meter: THREE.ShaderMaterial
  private sceneRT: THREE.WebGLRenderTarget | null = null
  private readonly meterRT: THREE.WebGLRenderTarget
  private readonly floatOk: boolean
  private lastMeterAt = -1e9
  private meterPending = false
  private ev = 12
  private haveEV = false
  private lastRadianceScale = 1
  private weights: Float32Array

  constructor(renderer: THREE.WebGLRenderer, o: FinderOptions) {
    this.renderer = renderer
    this.o = { longEdge: Math.max(64, o.longEdge), taps: Math.max(1, Math.min(16, Math.round(o.taps))), maxCocPx: Math.max(0, o.maxCocPx) }
    this.floatOk = renderer.extensions.has('EXT_color_buffer_float')
    const scene = new THREE.Scene()
    const mesh = new THREE.Mesh(this.geo)
    mesh.frustumCulled = false
    scene.add(mesh)
    this.pass = { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mesh }
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false })
    this.gather = mk(GATHER, {
      tColor: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uNear: { value: 0.05 }, uFar: { value: 5000 },
      uCocK: { value: 0 }, uInvS: { value: 0 }, uMaxCoc: { value: this.o.maxCocPx }, uTaps: { value: this.o.taps }, uExposure: { value: 1 },
      uFlip: { value: new THREE.Vector2(1, 1) },
    })
    this.meter = mk(METER, { tColor: { value: null } })
    this.meterRT = new THREE.WebGLRenderTarget(METER_N, METER_N, {
      type: this.floatOk ? THREE.FloatType : THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthBuffer: false, generateMipmaps: false,
    })
    // centre-weighted: a gaussian with sigma 0.3 of the half-width (about 40% of the weight in the middle third)
    this.weights = new Float32Array(METER_N * METER_N)
    let sum = 0
    for (let y = 0; y < METER_N; y++)
      for (let x = 0; x < METER_N; x++) {
        const dx = ((x + 0.5) / METER_N - 0.5) * 2
        const dy = ((y + 0.5) / METER_N - 0.5) * 2
        const w = Math.exp(-(dx * dx + dy * dy) / (2 * 0.3 * 0.3))
        this.weights[y * METER_N + x] = w
        sum += w
      }
    for (let i = 0; i < this.weights.length; i++) this.weights[i] /= sum
  }

  private target(w: number, h: number): THREE.WebGLRenderTarget {
    let t = this.sceneRT
    if (t && (t.width !== w || t.height !== h)) {
      t.dispose()
      t = null
    }
    if (!t) {
      t = new THREE.WebGLRenderTarget(w, h, {
        type: this.floatOk ? THREE.FloatType : THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: this.floatOk && !this.renderer.extensions.has('OES_texture_float_linear') ? THREE.NearestFilter : THREE.LinearFilter,
        magFilter: this.floatOk && !this.renderer.extensions.has('OES_texture_float_linear') ? THREE.NearestFilter : THREE.LinearFilter,
        depthBuffer: true,
        stencilBuffer: false,
        generateMipmaps: false,
      })
      t.depthTexture = new THREE.DepthTexture(w, h)
      t.depthTexture.type = THREE.UnsignedIntType
      t.depthTexture.minFilter = t.depthTexture.magFilter = THREE.NearestFilter
      this.sceneRT = t
    }
    return t
  }

  private run(material: THREE.Material, target: THREE.WebGLRenderTarget | null): void {
    this.pass.mesh.material = material
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.pass.scene, this.pass.camera)
  }

  /**
   * Renders the finder image into `o.target` (default: the canvas) at `o.viewport` (CSS px, like setViewport).
   * Cost: one scene render plus one gather pass; the meter pass and a tiny readback run every 250 ms.
   */
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, spec: CameraSpec, o: FinderRenderOptions = {}): void {
    const r = this.renderer
    const optics = computeOptics(spec)
    const aspect = camera.aspect > 0 ? camera.aspect : spec.format.width / spec.format.height
    const w = aspect >= 1 ? this.o.longEdge : Math.max(32, Math.round(this.o.longEdge * aspect))
    const h = aspect >= 1 ? Math.max(32, Math.round(this.o.longEdge / aspect)) : this.o.longEdge
    const rt = this.target(w, h)
    const radianceScale = o.radianceScale ?? 1
    this.lastRadianceScale = radianceScale

    const saved = {
      target: r.getRenderTarget(), autoClear: r.autoClear, vp: r.getViewport(new THREE.Vector4()), mask: camera.layers.mask,
      clear: r.getClearColor(new THREE.Color()), alpha: r.getClearAlpha(),
    }
    if (o.layers !== undefined) camera.layers.mask = o.layers
    r.autoClear = true
    r.setClearColor(0x000000, 1)
    r.setRenderTarget(rt)
    r.render(scene, camera)
    camera.layers.mask = saved.mask

    // exposure: mid grey (18%) at the chosen EV100 displays as 18% linear
    const ev = o.exposureEV100 ?? Math.log2((spec.fNumber * spec.fNumber) / spec.shutter) - Math.log2(spec.iso / 100)
    const lMid = ev100ToLuminance(ev)
    const pitch = spec.format.width / w // mm per finder px
    const gu = this.gather.uniforms
    gu.tColor.value = rt.texture
    gu.tDepth.value = rt.depthTexture
    gu.uTexel.value.set(1 / w, 1 / h)
    gu.uNear.value = camera.near
    gu.uFar.value = camera.far
    gu.uCocK.value = (optics.apertureDiameter * optics.imageDistance) / (2000 * pitch)
    gu.uInvS.value = Number.isFinite(spec.focusDistance) ? 1 / spec.focusDistance : 0
    gu.uExposure.value = ((0.18 / lMid) * (o.brightness ?? 1)) * radianceScale
    gu.uFlip.value.set(o.flipX ? -1 : 1, o.flipY ? -1 : 1)
    r.autoClear = false
    if (o.viewport) r.setViewport(o.viewport.x, o.viewport.y, o.viewport.width, o.viewport.height)
    this.run(this.gather, o.target ?? null)

    // meter
    const now = performance.now()
    if (!this.haveEV || (!this.meterPending && now - this.lastMeterAt > 250)) {
      this.lastMeterAt = now
      this.meter.uniforms.tColor.value = rt.texture
      r.setViewport(0, 0, METER_N, METER_N)
      this.run(this.meter, this.meterRT)
      if (!this.haveEV) this.readMeterSync()
      else this.readMeterAsync()
    }
    r.setViewport(saved.vp)
    r.setRenderTarget(saved.target)
    r.autoClear = saved.autoClear
    r.setClearColor(saved.clear, saved.alpha)
  }

  private consume(buf: Float32Array | Uint16Array): void {
    const half = buf instanceof Uint16Array
    let L = 0
    for (let i = 0; i < METER_N * METER_N; i++) {
      const rr = half ? halfToFloat(buf[i * 4]) : buf[i * 4]
      const gg = half ? halfToFloat(buf[i * 4 + 1]) : buf[i * 4 + 1]
      const bb = half ? halfToFloat(buf[i * 4 + 2]) : buf[i * 4 + 2]
      L += this.weights[i] * (0.2126 * rr + 0.7152 * gg + 0.0722 * bb)
    }
    this.ev = luminanceToEV100(Math.max(1e-6, L * this.lastRadianceScale))
    this.haveEV = true
  }

  private readMeterSync(): void {
    if (this.floatOk) {
      const buf = new Float32Array(METER_N * METER_N * 4)
      this.renderer.readRenderTargetPixels(this.meterRT, 0, 0, METER_N, METER_N, buf)
      this.consume(buf)
    } else {
      const buf = new Uint16Array(METER_N * METER_N * 4)
      this.renderer.readRenderTargetPixels(this.meterRT, 0, 0, METER_N, METER_N, buf)
      this.consume(buf)
    }
  }

  private readMeterAsync(): void {
    this.meterPending = true
    const done = (): void => {
      this.meterPending = false
    }
    if (this.floatOk) {
      const buf = new Float32Array(METER_N * METER_N * 4)
      this.renderer.readRenderTargetPixelsAsync(this.meterRT, 0, 0, METER_N, METER_N, buf).then(() => {
        this.consume(buf)
        done()
      }, done)
    } else {
      const buf = new Uint16Array(METER_N * METER_N * 4)
      this.renderer.readRenderTargetPixelsAsync(this.meterRT, 0, 0, METER_N, METER_N, buf).then(() => {
        this.consume(buf)
        done()
      }, done)
    }
  }

  /** Centre-weighted reflected-light reading, EV100, of the scene as last rendered. Refreshes about every 250 ms. */
  meterEV100(): number {
    return this.ev
  }

  dispose(): void {
    this.sceneRT?.dispose()
    this.meterRT.dispose()
    this.gather.dispose()
    this.meter.dispose()
    this.geo.dispose()
  }
}
