// Live finder (lensbench.md §11.3 "Live finder"): HDR render → DOF-lite gather + lens pass + ACES → canvas.
// Also the bench's ground-glass inset (same class, inverted).
import * as THREE from 'three'
import { samplePupil, type LensProfile } from '@shared/optics'
import type { GLCore } from '../core/gl'
import type { World } from './world/world'

export type FinderKind = 'sight' | 'frame' | 'reflex' | 'groundglass'

export interface Finder {
  render(dt: number): void
  meterEV(): number
  setView(v: { pos: [number, number, number]; yaw: number; pitch: number }): void
}

export interface FinderLens {
  profile: LensProfile
  ext: number
  /** f-number used for the view's DOF (taking N for groundglass/DOF preview; wide open for reflex) */
  viewN: number
  formatMm: [number, number]
  kind: FinderKind
  brightness: number
}

const TAPS = 12

const POST_FS = /* glsl */ `
precision highp float;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec2 uRes; uniform float uNear; uniform float uFar;
uniform float uF; uniform float uN; uniform float uExt; uniform float uFmtW; uniform float uDof; uniform float uPinPx;
uniform vec2 uTaps[${TAPS}];
uniform float uExposure; uniform vec2 uFlip; uniform float uK1; uniform float uVigEdge; uniform float uCos4; uniform float uGG; uniform float uTime;
varying vec2 vUv;
float linDepth(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float cocPx(float sM){
  if (uDof < 0.5) return 0.0;
  if (uPinPx > 0.0) return uPinPx;
  float s = max(sM * 1000.0, uF * 1.001);
  float v = uF * s / (s - uF);
  float vf = uF + uExt;
  float c = (uF / uN) * (v - vf) / v;
  return min(abs(c) * uRes.x / uFmtW * 0.5, 16.0);
}
vec3 aces(vec3 x){ const float a=2.51; const float b=0.03; const float c=2.43; const float d=0.59; const float e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  if (uFlip.x > 0.5) uv.x = 1.0 - uv.x;
  if (uFlip.y > 0.5) uv.y = 1.0 - uv.y;
  // barrel/pincushion (k1) about the centre, normalised to the half-diagonal
  vec2 c = uv - 0.5; float asp = uRes.x / uRes.y; vec2 cc = vec2(c.x * asp, c.y);
  float rho2 = dot(cc, cc) / (0.25 * (asp * asp + 1.0));
  uv = 0.5 + c * (1.0 + uK1 * rho2);
  vec3 col = texture2D(tColor, uv).rgb;
  float d0 = linDepth(uv);
  float r0 = cocPx(d0);
  if (r0 > 0.5) {
    vec3 acc = col; float wsum = 1.0;
    for (int i = 0; i < ${TAPS}; i++) {
      vec2 o = uTaps[i] * r0 / uRes;
      vec2 suv = uv + o;
      float dS = linDepth(suv);
      float rS = cocPx(dS);
      float w = (dS < d0 - 0.2) ? smoothstep(0.0, 1.0, rS / max(r0, 0.001)) : 1.0;
      acc += texture2D(tColor, suv).rgb * w; wsum += w;
    }
    col = acc / wsum;
  } else if (uPinPx > 0.0) {
    col = texture2D(tColor, uv).rgb;
  }
  float r = sqrt(rho2);
  float vig = mix(1.0, uVigEdge, smoothstep(0.55, 1.0, r)) * mix(1.0, pow(cos(atan(r * uCos4)), 4.0), 1.0);
  col *= vig;
  vec3 o = aces(col * uExposure);
  if (uGG > 0.5) {
    // ground glass: hot spot, fresnel rings, corner fall-off, grain
    float hs = 1.15 - 0.45 * r * r;
    float rings = 0.96 + 0.04 * sin(r * 160.0);
    o *= hs * rings;
    o += (hash(vUv * uRes + uTime) - 0.5) * 0.05;
  }
  gl_FragColor = vec4(srgb(clamp(o, 0.0, 1.0)), 1.0);
}`

const METER_FS = /* glsl */ `
precision highp float;
uniform sampler2D tColor; varying vec2 vUv;
void main(){
  float s = 0.0;
  for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) {
    vec2 o = (vec2(float(i), float(j)) - 1.5) / 64.0;
    vec3 c = texture2D(tColor, vUv + o).rgb;
    float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
    s += log2(max(L, 1e-7));
  }
  s /= 16.0;
  gl_FragColor = vec4(clamp((s + 24.0) / 40.0, 0.0, 1.0), 0.0, 0.0, 1.0);
}`

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

export class FinderView implements Finder {
  readonly camera = new THREE.PerspectiveCamera(40, 1.5, 0.05, 3000)
  private rt: THREE.WebGLRenderTarget
  private meterRT: THREE.WebGLRenderTarget
  private post: THREE.ShaderMaterial
  private meterMat: THREE.ShaderMaterial
  private quad: THREE.Mesh
  private qscene = new THREE.Scene()
  private qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private lastMeter = 0
  private meterBusy = false
  private ev = 12
  private expo = 1
  private time = 0
  private meterBuf = new Uint8Array(16 * 16 * 4)
  private width: number
  lens: FinderLens | null = null
  extraRoll = 0
  constructor(private gl: GLCore, private world: World, width: number) {
    this.width = width
    const caps = gl.caps
    const type = caps.floatRT ? THREE.HalfFloatType : THREE.UnsignedByteType
    this.rt = new THREE.WebGLRenderTarget(width, Math.round(width / 1.5), { type, depthBuffer: true, samples: 0 })
    this.rt.depthTexture = new THREE.DepthTexture(width, Math.round(width / 1.5))
    this.rt.texture.minFilter = THREE.LinearFilter
    this.meterRT = new THREE.WebGLRenderTarget(16, 16, { type: THREE.UnsignedByteType })
    const taps = samplePupil(new Uint8Array(64 * 64).fill(1), 64, TAPS, 5)
    const tapArr: THREE.Vector2[] = []
    for (let i = 0; i < TAPS; i++) tapArr.push(new THREE.Vector2(taps[i * 2], taps[i * 2 + 1]))
    this.post = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uRes: { value: new THREE.Vector2(width, width / 1.5) },
        uNear: { value: 0.05 }, uFar: { value: 3000 }, uF: { value: 50 }, uN: { value: 4 }, uExt: { value: 0 }, uFmtW: { value: 36 }, uDof: { value: 1 },
        uPinPx: { value: 0 }, uTaps: { value: tapArr }, uExposure: { value: 1 }, uFlip: { value: new THREE.Vector2(0, 0) }, uK1: { value: 0 },
        uVigEdge: { value: 1 }, uCos4: { value: 0.4 }, uGG: { value: 0 }, uTime: { value: 0 },
      },
    })
    this.meterMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: METER_FS, uniforms: { tColor: { value: this.rt.texture } }, depthTest: false, depthWrite: false })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post)
    this.quad.frustumCulled = false
    this.qscene.add(this.quad)
  }
  setView(v: { pos: [number, number, number]; yaw: number; pitch: number }): void {
    this.camera.position.set(v.pos[0], v.pos[1], v.pos[2])
    this.camera.rotation.set(v.pitch, v.yaw, this.extraRoll, 'YXZ')
    this.camera.updateMatrixWorld()
  }
  meterEV(): number { return this.ev }
  /** Exposure the display is currently using (for the HUD). */
  get exposure(): number { return this.expo }

  private resize(aspect: number) {
    const w = this.width, h = Math.max(16, Math.round(w / aspect))
    if (this.rt.width !== w || this.rt.height !== h) {
      this.rt.setSize(w, h)
      ;(this.post.uniforms.uRes.value as THREE.Vector2).set(w, h)
    }
  }

  /** Letterboxed rect (CSS px, top-left origin) of the last render inside the GL canvas. */
  rect = { x: 0, y: 0, w: 0, h: 0 }
  render(dt: number, viewport?: { x: number; y: number; w: number; h: number }): void {
    const L = this.lens
    if (!L) return
    this.time += dt
    const r = this.gl.renderer
    const [fw, fh] = L.formatMm
    const aspect = fw / fh
    this.resize(aspect)
    const f = L.profile.efl
    const vfov = (2 * Math.atan(fh / 2 / (f + L.ext)) * 180) / Math.PI
    // sight finders are wide and sharp: show a little more than the frame
    const show = L.kind === 'sight' ? 1.15 : L.kind === 'frame' ? 1.12 : 1
    this.camera.fov = Math.min(150, vfov * show)
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    r.setRenderTarget(this.rt)
    r.setClearColor(0x000000, 1)
    r.clear()
    r.render(this.world.scene, this.camera)
    // meter (every 250 ms)
    this.time >= 0 && this.maybeMeter()
    const u = this.post.uniforms
    u.uF.value = f
    u.uN.value = Math.max(0.5, L.viewN)
    u.uExt.value = L.ext
    u.uFmtW.value = fw * show
    u.uDof.value = L.kind === 'reflex' || L.kind === 'groundglass' ? 1 : 0
    u.uPinPx.value = L.profile.pinhole && u.uDof.value > 0 ? Math.min(8, (L.profile.pinholeBlurMm * this.rt.width) / fw * 0.5) : 0
    u.uK1.value = L.kind === 'reflex' || L.kind === 'groundglass' ? L.profile.distortion.k1 : 0
    u.uVigEdge.value = L.kind === 'reflex' || L.kind === 'groundglass' ? Math.max(0.05, L.profile.vignette[15]) : 1
    u.uCos4.value = Math.tan(L.profile.fieldHalfDiagRad)
    u.uGG.value = L.kind === 'groundglass' ? 1 : 0
    ;(u.uFlip.value as THREE.Vector2).set(L.kind === 'groundglass' ? 1 : 0, L.kind === 'groundglass' ? 1 : 0)
    u.uTime.value = this.time
    // auto exposure keyed to the meter, times finder brightness
    const Lavg = Math.pow(2, this.ev) / 8 / 1000 // kcd/m²
    const target = (0.18 / Math.max(1e-7, Lavg)) * L.brightness
    this.expo += (target - this.expo) * (1 - Math.exp(-dt * 6))
    if (!Number.isFinite(this.expo) || this.expo <= 0) this.expo = target
    u.uExposure.value = this.expo
    r.setRenderTarget(null)
    if (!viewport) {
      const sz = this.gl.size()
      let w = sz.w, h = w / aspect
      if (h > sz.h) { h = sz.h; w = h * aspect }
      viewport = { x: (sz.w - w) / 2, y: (sz.h - h) / 2, w, h }
      r.setClearColor(0x000000, 1)
      r.clear()
    }
    this.rect = { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h }
    {
      r.setViewport(viewport.x, viewport.y, viewport.w, viewport.h)
      r.setScissor(viewport.x, viewport.y, viewport.w, viewport.h)
      r.setScissorTest(true)
    }
    r.render(this.qscene, this.qcam)
    {
      r.setScissorTest(false)
      const s = this.gl.size()
      r.setViewport(0, 0, s.w, s.h)
    }
  }

  /** Force the exposure to settle now (tests, standpoint jumps). */
  settle(): void { this.expo = -1 }

  private maybeMeter() {
    const now = performance.now()
    if (this.meterBusy || now - this.lastMeter < 250) return
    this.lastMeter = now
    const r = this.gl.renderer
    this.quad.material = this.meterMat
    r.setRenderTarget(this.meterRT)
    r.render(this.qscene, this.qcam)
    this.quad.material = this.post
    r.setRenderTarget(null)
    this.meterBusy = true
    const done = (buf: Uint8Array) => {
      let s = 0, ws = 0
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const v = buf[(y * 16 + x) * 4] / 255 * 40 - 24
          const centre = x >= 4 && x < 12 && y >= 4 && y < 12
          const w = centre ? 3 : 1
          s += v * w; ws += w
        }
      const log2L = s / ws // log2 kcd/m²
      const ev = log2L + Math.log2(1000 * 8)
      if (Number.isFinite(ev)) this.ev = ev
      this.meterBusy = false
    }
    try {
      const p = r.readRenderTargetPixelsAsync(this.meterRT, 0, 0, 16, 16, this.meterBuf) as Promise<unknown>
      p.then(() => done(this.meterBuf)).catch(() => { this.meterBusy = false })
    } catch {
      r.readRenderTargetPixels(this.meterRT, 0, 0, 16, 16, this.meterBuf)
      done(this.meterBuf)
    }
  }

  /** Synchronous meter read (tests). */
  meterNow(): number {
    const r = this.gl.renderer
    this.quad.material = this.meterMat
    r.setRenderTarget(this.meterRT)
    r.render(this.qscene, this.qcam)
    this.quad.material = this.post
    r.readRenderTargetPixels(this.meterRT, 0, 0, 16, 16, this.meterBuf)
    r.setRenderTarget(null)
    let s = 0, ws = 0
    for (let i = 0; i < 256; i++) {
      const x = i % 16, y = (i / 16) | 0
      const w = x >= 4 && x < 12 && y >= 4 && y < 12 ? 3 : 1
      s += (this.meterBuf[i * 4] / 255 * 40 - 24) * w; ws += w
    }
    this.ev = s / ws + Math.log2(8000)
    return this.ev
  }

  dispose(): void {
    this.rt.dispose(); this.meterRT.dispose(); this.post.dispose(); this.meterMat.dispose()
    this.quad.geometry.dispose()
  }
}
