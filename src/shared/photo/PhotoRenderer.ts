// PhotoRenderer: physically-motivated still-photo renderer for three.js (WebGL2).
//
//   const photo = new PhotoRenderer(renderer)
//   const shot = await photo.capture({ scene, setTime }, spec, { pose: camera, samples: 32, longEdge: 1024 })
//   shot.latent  // Float32Array RGBA, top row first, in X units (1 = metered mid-grey; * meta.exposure.hPerUnit = lux*s)
//
// How it works (one loop gives DOF, motion blur, rolling-shutter skew, leaf efficiency and bokeh shape):
//   for each sub-frame k of the shutter plan:
//     pose the scene at time t_k, move the eye to pupil point p_k, shear the frustum so the focus plane
//     stays fixed (thin-lens accumulation), jitter by a sub-pixel, render radiance (cd/m^2) to a float
//     target (scissored to the band of rows the slit reaches in this bin), then add it into an
//     accumulator weighted by how long each row's slit overlapped the bin.
//   resolve: X = sum(X*w)/sum(w); inverse distortion; lateral colour; cos^4.
//   optics: Airy blur, veiling glare, glow, ghosts, blade stars.  film: grain.  -> float RGBA readback.

import * as THREE from 'three'
import {
  computeOptics,
  resolveSpec,
  undistortR,
  xPerNit,
  hPerUnit,
  reciprocityFactor,
  LAMBDA_MM,
  type CameraSpec,
  type DeepPartial,
  type Optics,
} from './spec.ts'
import { planShutter, planFlash, orderSubframes, sampleAperture, halton, makeRng, type ShutterPlan, type SubFrame, type FlashOptions } from './sampling.ts'
import {
  FULLSCREEN_VERT,
  ACCUM_FRAG,
  RESOLVE_FRAG,
  BLUR_FRAG,
  DOWN_FRAG,
  UP_FRAG,
  MEAN_FRAG,
  COMPOSITE_FRAG,
  PREVIEW_FRAG,
  PROBE_VEIL_FRAG,
  PRINT_FRAG,
  EMITTER_FRAG,
} from './shaders.ts'
import { buildPrintLUT, LUT_LO, LUT_HI, NEGATIVE_COLOR, PAPER_RA4, PAN_WEIGHTS, type FilmCurve, type PaperCurve } from './film.ts'

// ------------------------------------------------------------------ public types

export interface SubFrameInfo {
  /** render-order index and total */
  index: number
  total: number
  /** absolute scene time to pose at, seconds (= time0 + tRel) */
  time: number
  /** seconds after the shutter began to open */
  tRel: number
  /** pupil point, mm (camera right, up) */
  lensMm: [number, number]
  /** two uniform random numbers for the scene's own jitter (area lights, foliage flutter...) */
  rand: [number, number]
}

/** A scene the renderer can pose at any instant inside the exposure. */
export interface PhotoScene {
  scene: THREE.Scene
  /** Pose every moving thing at absolute time `time`. Must be deterministic and cheap: it runs once per sub-frame. */
  setTime?(time: number, info: SubFrameInfo): void
  /**
   * Flash sub-frames: when `on`, render ONLY flash-lit radiance (ambient lights, sky and emissives off,
   * the flash a light at `eye`, intensity in cd for the pulse). Called on, render, off.
   */
  setFlash?(on: boolean, eye: CameraPose): void
}

export interface CameraPose {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

export interface CaptureProgress {
  done: number
  total: number
  fraction: number
  elapsedMs: number
  phase: 'expose' | 'develop' | 'readback' | 'done'
}

export interface CaptureOptions {
  /** camera pose at shutter press: any Object3D (its world transform is used) or an explicit pose */
  pose: THREE.Object3D | CameraPose
  /** optional moving camera (pans, hand shake); tRel = seconds after the shutter started opening */
  poseAt?: (tRel: number) => CameraPose
  /** scene time at shutter press, seconds (default 0) */
  time0?: number
  /** sub-frames per pixel: THE quality knob. 64 desktop, 24 phone, 4 for tests. Default 32 */
  samples?: number
  /** long edge of the output image, px. Default 1024 */
  longEdge?: number
  /** focal-plane only: cap on total (scissored) renders. Default samples * 6 */
  maxRenders?: number
  /** CPU milliseconds of work per animation frame. Infinity = do it all in one go. Default 10 */
  sliceMs?: number
  /** 'blocked' (default) | 'progressive' | 'chronological': see PlanOptions.order */
  order?: 'blocked' | 'progressive' | 'chronological'
  near?: number
  far?: number
  /** film grain on/off (default true). Turn off when a downstream chemistry model adds its own. */
  grain?: boolean
  /** optical flare/glow/ghosts/stars on/off (default true) */
  flare?: boolean
  /**
   * Wide-angle glare probe (default true when flare is on): one extra low-res render covering 3x the
   * field so bright things just outside the frame (the sun) still veil the image and throw ghosts in.
   */
  glareProbe?: boolean
  /** angular falloff of out-of-frame glare beyond the frame edge, degrees (default 10; a deep hood ~4) */
  glareFalloffDeg?: number
  /** read the final latent back to a Float32Array (default true) */
  readback?: boolean
  /** hand the final GPU target to the caller (caller must dispose it). Default false */
  keepTarget?: boolean
  /**
   * Depth-aware pre-blur of each sub-frame by ~CoC/(2 sqrt(N)) so N pupil samples tile the bokeh disc
   * smoothly instead of leaving N sharp copies (default true; 12 extra taps per pixel per sub-frame).
   */
  smoothBokeh?: boolean
  /** multiplier on the pre-blur width (default 1). Higher = smoother rims, slightly larger saturated discs */
  smoothStrength?: number
  /** fire a flash during the exposure (needs PhotoScene.setFlash). Above X-sync a slit gives a band. */
  flash?: FlashOptions
  /**
   * Double/multiple exposure: a previous capture's pre-grain target (`result.preGrainTarget`) on the
   * same frame size; its latent is added before grain (exposures add on film).
   */
  baseTarget?: THREE.WebGLRenderTarget
  /** also return `preGrainTarget` (caller owns it) so the next capture can expose on top of it */
  keepPreGrain?: boolean
  /**
   * Re-render shadow maps every n sub-frames (default 1 = always). Shadow passes are ~2/3 of the
   * per-sub-frame cost in a typical yard; 4-8 is visually identical unless big casters move fast.
   */
  shadowEvery?: number
  seed?: number
  signal?: AbortSignal
  onProgress?: (p: CaptureProgress) => void
  /** cd/m^2 per rendered unit: 1 (scene in nits, the default) or 1000 (scene in kcd/m^2: Lens Bench and Sunny 16) */
  radianceScale?: number
  /** front-standard tilt about the camera x axis (Scheimpflug) via the rank-1 projection update; 0 = ordinary depth of field */
  tilt?: { deg: number }
  /** custom shutter timing (gravity drop, roller blind, lens-cap ramps); overrides spec.shutterType timing */
  shutterProfile?: ShutterProfile
  /** rendered RGB -> film channels (rows: ortho, pan, colour crosstalk). Default identity for colour film, pan weights for mono */
  spectral?: [[number, number, number], [number, number, number], [number, number, number]]
  /** camera layer mask for the capture (default 1 = layer 0 only; Sunny 16 keeps its own tripod on layer 2) */
  layers?: number
  /** optional analytic point sources drawn as energy-conserving pupil-shaped sprites (Lens Bench hero bokeh). Fill `out`, return the count */
  emitters?: (time: number, out: PhotoEmitter[]) => number
}

export interface LatentStats {
  meanX: number
  medianX: number
  p01: number
  p99: number
  maxX: number
  /** fraction of pixels above +6 EV over mid-grey (blocked highlights on most negatives) */
  over6: number
  /** fraction of pixels below -5 EV (empty shadows) */
  under5: number
}

export interface CaptureMeta {
  spec: CameraSpec
  optics: Optics
  exposure: {
    unit: 'X'
    /** latent X per cd/m^2 on axis */
    xPerNit: number
    /** time-integral of the shutter transmission (pupil-averaged), s */
    effectiveTime: number
    /** effectiveTime / marked time */
    shutterEfficiency: number
    reciprocityFactor: number
    /** lux*s per X unit */
    hPerUnit: number
    /** log2(N^2/t) */
    ev: number
    /** scene EV100 these settings suit */
    ev100: number
  }
  sampling: {
    renders: number
    bins: number
    span: number
    samplesPerPixel: number
    renderSize: [number, number]
    overscan: number
    apertureArea: number
  }
  timing: { totalMs: number; exposeMs: number; developMs: number; readbackMs: number; slices: number }
  caps: PhotoCaps
  stats: LatentStats | null
  time0: number
  seed: number
}

export interface CaptureResult {
  /** RGBA float, row-major, TOP row first, X units. null when readback: false */
  latent: Float32Array | null
  width: number
  height: number
  /** final GPU target (RGBA, X units, bottom row first) when keepTarget: true */
  target: THREE.WebGLRenderTarget | null
  /** latent before grain (caller owns it) when keepPreGrain: true; feed it to the next capture's baseTarget */
  preGrainTarget: THREE.WebGLRenderTarget | null
  meta: CaptureMeta
}

export interface PhotoCaps {
  /** RGBA32F renderable (EXT_color_buffer_float) */
  floatRender: boolean
  /** RGBA32F blendable (EXT_float_blend): accumulator precision */
  floatBlend: boolean
  /** RGBA32F linear filtering (OES_texture_float_linear) */
  floatLinear: boolean
  maxSize: number
  accum: 'float32' | 'float16'
  gpu: string
}

/** Custom shutter timing (gravity drop, roller blind, lens-cap ramps): overrides spec.shutterType timing. */
export interface ShutterProfile {
  /** seconds from first opening to last closing */
  span: number
  /** fraction (0..1) of [tRel, tRel + dt] for which print pixel (u, v in [0,1], upright, v = 0 at the top) is open */
  open(u: number, v: number, tRel: number, dt: number): number
}

/** An analytic point source drawn as an energy-conserving pupil-shaped disc (street lamps, fairy lights). */
export interface PhotoEmitter {
  x: number
  y: number
  z: number
  /** luminous intensity in scene units; times radianceScale = candela */
  rgb: [number, number, number]
}

/** Incremental exposure: one sub-frame per addSample (Sunny 16's live path). Created by PhotoRenderer.begin(). */
export interface Exposure {
  /** Renders one sub-frame now, through the next pupil point. `weightS` = seconds this sample stands for (default: time since the previous sample, else 1/60). */
  addSample(o: { time: number; tRel: number; pose?: CameraPose; weightS?: number }): void
  readonly samples: number
  readonly exposedSeconds: number
  /** Draws a ghost of the accumulation so far (the finder at low opacity while the shutter is open). */
  drawGhost(target?: THREE.WebGLRenderTarget | null, viewport?: { x: number; y: number; width: number; height: number }, opacity?: number): void
  /** Develops the optics and film and returns the latent. Releases the renderer. */
  finish(o?: { readback?: boolean }): Promise<CaptureResult>
  /** Throws the exposure away and releases the renderer. */
  abort(): void
}

const PROFILE_N = 64
const IDENT3 = new THREE.Matrix3()

interface SubOverride {
  time: number
  tRel: number
  weight: number
  pose?: CameraPose
}

interface FinalizeArgs {
  tStart: number
  exposeMs: number
  slices: number
  /** multiplier on the accumulated (per-second) exposure; 1 for a normal capture */
  gain: number
  exposedSeconds: number
  samples: number
  readback: boolean
  report: (phase: CaptureProgress['phase']) => void
  probePose?: CameraPose
  probeTime?: number
}

interface Session {
  spec: CameraSpec
  optics: Optics
  plan: ShutterPlan
  subs: SubFrame[]
  subAt(k: number): SubFrame
  total: number
  seed: number
  time0: number
  pupilR: number
  tanW: number
  tanH: number
  rW: number
  rH: number
  perSecond: number
  valueScale: number
  accType: THREE.TextureDataType
  expected: number
  open(): void
  close(): void
  renderSub(sf: SubFrame, idx: number, ov: SubOverride | null): void
  finalize(c: FinalizeArgs): Promise<CaptureResult>
  sceneRT: THREE.WebGLRenderTarget
  accRT: THREE.WebGLRenderTarget
}

/** Shutter plan for a custom ShutterProfile: K equal time bins, per-pixel coverage comes from the profile. */
function planProfile(spec: CameraSpec, prof: ShutterProfile, samples: number, seed: number, order: 'blocked' | 'progressive' | 'chronological', blockSize: number): ShutterPlan {
  const K = Math.max(1, Math.round(samples))
  const span = Math.max(1e-6, prof.span)
  const dt = span / K
  const aperture = sampleAperture(spec.aperture, K, seed)
  const rng = makeRng(seed * 104729 + 3)
  const jx0 = rng()
  const jy0 = rng()
  const tj0 = rng()
  const fr = (x: number) => x - Math.floor(x)
  const subs: SubFrame[] = []
  for (let k = 0; k < K; k++) {
    const t0 = k * dt
    const t1 = (k + 1) * dt
    subs.push({
      order: 0,
      bin: k,
      t0,
      t1,
      time: t0 + dt * fr(halton(k + 1, 5) + tj0),
      lens: [aperture.points[k * 2], aperture.points[k * 2 + 1]],
      jitter: [fr(halton(k + 1, 2) + jx0) - 0.5, fr(halton(k + 1, 3) + jy0) - 0.5],
      weight: 1,
      rowMin: 0,
      rowMax: 1,
      rand: [rng(), rng()],
    })
  }
  // mean open time over the print: the exposure the ratio estimator is scaled to
  const G = 8
  const S = 64
  let acc = 0
  for (let j = 0; j < G; j++)
    for (let i = 0; i < G; i++) for (let s = 0; s < S; s++) acc += prof.open((i + 0.5) / G, (j + 0.5) / G, (s * span) / S, span / S) * (span / S)
  const effectiveTime = Math.max(1e-6, acc / (G * G))
  orderSubframes(subs, order, blockSize)
  return {
    type: 'leaf',
    span,
    binWidth: dt,
    effectiveTime,
    curtainTravel: 0,
    curtainDirection: spec.curtainDirection,
    samplesPerPixel: K,
    subframes: subs,
    aperture,
  }
}

class ExposureImpl implements Exposure {
  samples = 0
  exposedSeconds = 0
  private done = false
  private refW = 0
  private lastT = Number.NaN
  private readonly t0 = performance.now()
  private exposeMs = 0
  private readonly mid: { time: number; pose?: CameraPose }[] = []

  constructor(
    private readonly r: PhotoRenderer,
    private readonly ses: Session,
    private readonly o: Omit<CaptureOptions, 'samples' | 'order'>,
    private readonly release: () => void,
  ) {}

  addSample(a: { time: number; tRel: number; pose?: CameraPose; weightS?: number }): void {
    if (this.done) throw new Error('Exposure: already finished')
    const t0 = performance.now()
    const ses = this.ses
    const wS = a.weightS ?? (Number.isFinite(this.lastT) ? Math.max(1e-6, a.tRel - this.lastT) : 1 / 60)
    if (!(this.refW > 0)) this.refW = wS
    this.lastT = a.tRel
    const sf = ses.subAt(this.samples)
    ses.open()
    ses.renderSub(sf, this.samples, { time: a.time, tRel: a.tRel, weight: wS / this.refW, pose: a.pose })
    ses.close()
    this.samples++
    this.exposedSeconds += wS
    // remember a mid-exposure pose for the glare probe
    if (this.mid.length < 4096) this.mid.push({ time: a.time, pose: a.pose })
    this.exposeMs += performance.now() - t0
  }

  /** Exposure so far relative to one second (the accumulator holds a per-second image). */
  private gain(): number {
    const { spec, optics } = this.ses
    if (!(this.exposedSeconds > 0)) return 0
    return xPerNit(spec, optics, this.exposedSeconds) / xPerNit(spec, optics, 1)
  }

  drawGhost(target: THREE.WebGLRenderTarget | null = null, viewport?: { x: number; y: number; width: number; height: number }, opacity = 0.15): void {
    if (this.done) return
    // the accumulator holds X per second weighted by sample weight; the displayed gain is the exposure so far,
    // scaled by the reference weight so unequal samples display consistently
    this.r.drawAccumulation(target, viewport, { gain: this.gain(), opacity })
  }

  async finish(f?: { readback?: boolean }): Promise<CaptureResult> {
    if (this.done) throw new Error('Exposure: already finished')
    this.done = true
    try {
      const m = this.mid[this.mid.length >> 1]
      return await this.ses.finalize({
        tStart: this.t0,
        exposeMs: this.exposeMs,
        slices: this.samples,
        gain: this.gain(),
        exposedSeconds: this.exposedSeconds,
        samples: this.samples,
        readback: f?.readback !== false,
        report: (p) => this.o.onProgress?.({ done: this.samples, total: this.samples, fraction: 1, elapsedMs: performance.now() - this.t0, phase: p }),
        probeTime: m?.time,
        probePose: m?.pose,
      })
    } finally {
      this.release()
    }
  }

  abort(): void {
    if (this.done) return
    this.done = true
    this.release()
  }
}

// ------------------------------------------------------------------ internals

const POST_SCALE = 1 / 256

class Pass {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  readonly mesh: THREE.Mesh
  constructor(geo: THREE.BufferGeometry) {
    this.mesh = new THREE.Mesh(geo)
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
  }
  run(renderer: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null): void {
    this.mesh.material = material
    renderer.setRenderTarget(target)
    renderer.render(this.scene, this.camera)
  }
}

function shader(frag: string, uniforms: Record<string, THREE.IUniform>, defines: Record<string, string | number | boolean> = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: frag,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
  })
}

const nextFrame = (): Promise<number> => new Promise((r) => requestAnimationFrame(r))

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

export function latentStats(latent: Float32Array, width: number, height: number): LatentStats {
  const n = width * height
  const step = Math.max(1, Math.floor(n / 40000))
  const vals: number[] = []
  let sum = 0
  let max = 0
  let over = 0
  let under = 0
  for (let i = 0; i < n; i += step) {
    const o = i * 4
    const y = 0.2126 * latent[o] + 0.7152 * latent[o + 1] + 0.0722 * latent[o + 2]
    vals.push(y)
    sum += y
    if (y > max) max = y
    if (y > 64) over++
    if (y < 1 / 32) under++
  }
  vals.sort((a, b) => a - b)
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(p * (vals.length - 1))))]
  return {
    meanX: sum / vals.length,
    medianX: q(0.5),
    p01: q(0.01),
    p99: q(0.99),
    maxX: max,
    over6: over / vals.length,
    under5: under / vals.length,
  }
}

// ------------------------------------------------------------------ the renderer

export class PhotoRenderer {
  readonly renderer: THREE.WebGLRenderer
  readonly caps: PhotoCaps
  busy = false
  lastPlan: ShutterPlan | null = null

  private readonly geo = new THREE.PlaneGeometry(2, 2)
  private readonly pass = new Pass(this.geo)
  private readonly cam = new THREE.PerspectiveCamera()
  private readonly accumMats = new Map<string, THREE.ShaderMaterial>()
  private readonly resolveMat: THREE.ShaderMaterial
  private readonly blurMats = new Map<number, THREE.ShaderMaterial>()
  private readonly downMat: THREE.ShaderMaterial
  private readonly upMat: THREE.ShaderMaterial
  private readonly meanMat: THREE.ShaderMaterial
  private readonly probeVeilMat: THREE.ShaderMaterial
  private printMat: THREE.ShaderMaterial | null = null
  private printLut: THREE.DataTexture | null = null
  private printKey = ''
  private readonly probeCam = new THREE.PerspectiveCamera()
  private readonly compMats = new Map<string, THREE.ShaderMaterial>()
  private readonly previewMat: THREE.ShaderMaterial
  private rts = new Map<string, THREE.WebGLRenderTarget>()
  private previewCrop = new THREE.Vector2(1, 1)
  private hasAccum = false
  private emitterMat: THREE.ShaderMaterial | null = null

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.caps = PhotoRenderer.detect(renderer)
    if (!this.caps.floatRender) console.warn('[photo-render] EXT_color_buffer_float missing: falling back to half-float scene targets (the sun will clip)')
    const resolveDefines: Record<string, string | number | boolean> = {}
    if (this.caps.accum === 'float32' && !this.caps.floatLinear) resolveDefines.MANUAL_BILINEAR = 1
    this.resolveMat = shader(RESOLVE_FRAG, {
      tAcc: { value: null },
      uAccSize: { value: new THREE.Vector2() },
      uHalfSensor: { value: new THREE.Vector2() },
      uHalfFormat: { value: new THREE.Vector2() },
      uHalfDiag: { value: 1 },
      uK: { value: new THREE.Vector2() },
      uLatCA: { value: new THREE.Vector3() },
      uNatVig: { value: 1 },
      uImageDist: { value: 50 },
      uPostScale: { value: POST_SCALE },
      uVignette: { value: 0 },
      uRimRadius: { value: 1 },
      uPupilCount: { value: 0 },
      uPupil: { value: Array.from({ length: 64 }, () => new THREE.Vector3()) },
    }, resolveDefines)
    this.downMat = shader(DOWN_FRAG, { tSrc: { value: null }, uSrcTexel: { value: new THREE.Vector2() }, uScale: { value: 1 }, uM: { value: IDENT3 } })
    this.probeVeilMat = shader(PROBE_VEIL_FRAG, { tProbe: { value: null }, uSize: { value: new THREE.Vector2(1, 1) }, uFrameTan: { value: new THREE.Vector2() }, uFalloff: { value: 0.17 } })
    this.upMat = shader(UP_FRAG, { tCoarse: { value: null }, tFine: { value: null }, uCoarseTexel: { value: new THREE.Vector2() } })
    this.meanMat = shader(MEAN_FRAG, { tSrc: { value: null }, uSize: { value: new THREE.Vector2(1, 1) } })
    this.previewMat = shader(PREVIEW_FRAG, { tAcc: { value: null }, uCrop: { value: this.previewCrop }, uFlash: { value: 1 }, uOpacity: { value: 1 }, uGhost: { value: 0 }, uGain: { value: 1 } })
  }

  /** Output size a capture of this format at `longEdge` will have (to match baseTarget for multiple exposures). */
  static outputSize(format: { width: number; height: number }, longEdge: number, maxSize = 16384): [number, number] {
    const aspect = format.width / format.height
    let le = Math.max(16, Math.round(longEdge))
    le = Math.min(le, Math.floor(maxSize / 1.7))
    const w = aspect >= 1 ? le : Math.max(8, Math.round(le * aspect))
    const h = aspect >= 1 ? Math.max(8, Math.round(le / aspect)) : le
    return [w, h]
  }

  static detect(renderer: THREE.WebGLRenderer): PhotoCaps {
    const ext = renderer.extensions
    const gl = renderer.getContext()
    const floatRender = ext.has('EXT_color_buffer_float')
    const floatBlend = floatRender && ext.has('EXT_float_blend')
    let gpu = 'unknown'
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    } catch {
      /* ignore */
    }
    return {
      floatRender,
      floatBlend,
      floatLinear: ext.has('OES_texture_float_linear'),
      maxSize: renderer.capabilities.maxTextureSize,
      accum: floatBlend ? 'float32' : 'float16',
      gpu,
    }
  }

  // ---------------------------------------------------------------- targets

  private rt(key: string, w: number, h: number, type: THREE.TextureDataType, linear: boolean, depth = false): THREE.WebGLRenderTarget {
    let t = this.rts.get(key)
    const filter = linear ? THREE.LinearFilter : THREE.NearestFilter
    if (t && (t.texture.type !== type || t.texture.minFilter !== filter || t.depthBuffer !== depth)) {
      t.dispose()
      t = undefined
    }
    if (!t) {
      t = new THREE.WebGLRenderTarget(w, h, {
        type,
        format: THREE.RGBAFormat,
        minFilter: filter,
        magFilter: filter,
        depthBuffer: depth,
        stencilBuffer: false,
        generateMipmaps: false,
      })
      t.texture.wrapS = t.texture.wrapT = THREE.ClampToEdgeWrapping
      if (depth) {
        t.depthTexture = new THREE.DepthTexture(w, h)
        t.depthTexture.type = THREE.UnsignedIntType
        t.depthTexture.minFilter = t.depthTexture.magFilter = THREE.NearestFilter
      }
      this.rts.set(key, t)
    } else if (t.width !== w || t.height !== h) t.setSize(w, h)
    t.scissorTest = false
    t.scissor.set(0, 0, w, h)
    t.viewport.set(0, 0, w, h)
    return t
  }

  private accumMaterial(warp: boolean, smooth: boolean): THREE.ShaderMaterial {
    const key = `${warp}|${smooth}`
    let m = this.accumMats.get(key)
    if (!m) {
      const defines: Record<string, number> = {}
      if (warp) defines.FOCUS_WARP = 1
      if (smooth) defines.SMOOTH = 1
      m = shader(ACCUM_FRAG, {
        tScene: { value: null },
        uHalfSensor: { value: new THREE.Vector2() },
        uHalfFormat: { value: new THREE.Vector2() },
        uHalfDiag: { value: 1 },
        uK: { value: new THREE.Vector2() },
        uLens: { value: new THREE.Vector2() },
        uRimRadius: { value: 1 },
        uVignette: { value: 0 },
        uImageDist: { value: 50 },
        uFieldCurv: { value: 0 },
        uAstig: { value: 0 },
        uLongCA: { value: new THREE.Vector3() },
        uValueScale: { value: 1 },
        uAccScale: { value: 1 },
        uMode: { value: 0 },
        uWeight: { value: 1 },
        uBin: { value: new THREE.Vector4() },
        uTravel: { value: 0 },
        uDir: { value: new THREE.Vector4(0, 1, 0, 0) },
        uFlashScale: { value: 0 },
        tDepth: { value: null },
        uNear: { value: 0.05 },
        uFar: { value: 5000 },
        uCocK: { value: 0 },
        uInvS: { value: 0 },
        uSmooth: { value: 0 },
        uTexel: { value: new THREE.Vector2() },
        uRot: { value: 0 },
        uSpectral: { value: new THREE.Matrix3() },
        tProfile: { value: null },
        uProfileOn: { value: 0 },
        uTiltTy: { value: 0 },
        uTanH: { value: 1 },
      }, defines)
      m.blending = THREE.CustomBlending
      m.blendEquation = THREE.AddEquation
      m.blendSrc = THREE.OneFactor
      m.blendDst = THREE.OneFactor
      m.blendEquationAlpha = THREE.AddEquation
      m.blendSrcAlpha = THREE.OneFactor
      m.blendDstAlpha = THREE.OneFactor
      this.accumMats.set(key, m)
    }
    return m
  }

  private emitterMaterial(): THREE.ShaderMaterial {
    if (!this.emitterMat) {
      const m = shader(EMITTER_FRAG, {
        uHalfSensor: { value: new THREE.Vector2() },
        uHalfFormat: { value: new THREE.Vector2() },
        uHalfDiag: { value: 1 },
        uK: { value: new THREE.Vector2() },
        uCentre: { value: new THREE.Vector2() },
        uRadius: { value: 1 },
        uShapeScale: { value: 1 },
        uColour: { value: new THREE.Vector3() },
        uMode: { value: 0 },
        uWeight: { value: 1 },
        uBin: { value: new THREE.Vector4() },
        uTravel: { value: 0 },
        uDir: { value: new THREE.Vector4(0, 1, 0, 0) },
        uBlades: { value: 0 },
        uRot: { value: 0 },
        uCurv: { value: 1 },
        tMask: { value: null },
        uMaskOn: { value: 0 },
        uPx: { value: 0.01 },
      })
      m.blending = THREE.CustomBlending
      m.blendEquation = THREE.AddEquation
      m.blendSrc = THREE.OneFactor
      m.blendDst = THREE.OneFactor
      m.blendEquationAlpha = THREE.AddEquation
      m.blendSrcAlpha = THREE.OneFactor
      m.blendDstAlpha = THREE.OneFactor
      this.emitterMat = m
    }
    return this.emitterMat
  }

  private blurMaterial(radius: number): THREE.ShaderMaterial {
    let m = this.blurMats.get(radius)
    if (!m) {
      m = shader(BLUR_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uSigma: { value: new THREE.Vector3(1, 1, 1) } }, { RADIUS: radius })
      this.blurMats.set(radius, m)
    }
    return m
  }

  private compositeMaterial(flare: boolean, stars: boolean, grain: boolean): THREE.ShaderMaterial {
    const key = `${flare}|${stars}|${grain}`
    let m = this.compMats.get(key)
    if (!m) {
      const defines: Record<string, number> = {}
      if (flare) defines.FLARE = 1
      if (stars) defines.STARS = 1
      if (grain) defines.GRAIN = 1
      m = shader(COMPOSITE_FRAG, {
        tLatent: { value: null },
        tGlow: { value: null },
        tGhost: { value: null },
        tStar: { value: null },
        tMean: { value: null },
        tProbe: { value: null },
        tProbeVeil: { value: null },
        uProbeOn: { value: 0 },
        tBase: { value: null },
        uBaseOn: { value: 0 },
        uNoGrain: { value: 0 },
        uPostScale: { value: POST_SCALE },
        uGlowLevels: { value: 1 },
        uGlow: { value: 0 },
        uVeil: { value: 0 },
        uGhost: { value: 0 },
        uStar: { value: 0 },
        uStarTexel: { value: new THREE.Vector2() },
        uStarRot: { value: 0 },
        uStarLines: { value: 0 },
        uOutSize: { value: new THREE.Vector2() },
        uGrainSigma: { value: 0 },
        uGrainCell: { value: 1 },
        uGrainColor: { value: 0 },
        uSeed: { value: 0 },
      }, defines)
      this.compMats.set(key, m)
    }
    return m
  }

  // ---------------------------------------------------------------- capture

  async capture(input: PhotoScene | THREE.Scene, specIn: DeepPartial<CameraSpec> | CameraSpec, opts: CaptureOptions): Promise<CaptureResult> {
    if (this.busy) throw new Error('PhotoRenderer.capture: a capture is already running')
    this.busy = true
    try {
      return await this.captureInner(input, specIn, opts)
    } finally {
      this.busy = false
    }
  }

  /**
   * Start an incremental exposure: the caller adds sub-frames one at a time (Sunny 16's live path:
   * Bulb, lens cap, anything over 1/8 s) and finishes when the shutter closes. The result matches
   * `capture()` fed the same samples: sub-frame k uses the k-th pupil point, jitter and random pair.
   */
  begin(
    input: PhotoScene | THREE.Scene,
    specIn: DeepPartial<CameraSpec> | CameraSpec,
    o: Omit<CaptureOptions, 'samples' | 'order'> & { expectedSamples?: number },
  ): Exposure {
    if (this.busy) throw new Error('PhotoRenderer.begin: a capture is already running')
    this.busy = true
    try {
      const ses = this.prepare(input, specIn, { ...o, samples: o.expectedSamples ?? 32 }, 'incremental')
      return new ExposureImpl(this, ses, o, () => {
        this.busy = false
      })
    } catch (e) {
      this.busy = false
      throw e
    }
  }

  private async captureInner(input: PhotoScene | THREE.Scene, specIn: DeepPartial<CameraSpec> | CameraSpec, opts: CaptureOptions): Promise<CaptureResult> {
    const tStart = performance.now()
    const ses = this.prepare(input, specIn, opts, 'capture')
    const renderer = this.renderer
    const sliceMs = opts.sliceMs ?? 10
    const subs = ses.subs
    const total = subs.length
    const gl = renderer.getContext() as WebGL2RenderingContext
    let i = 0
    let slices = 0
    let perSlice = 2
    let exposeMs = 0
    let pending: WebGLSync | null = null
    const report = (phase: CaptureProgress['phase']) =>
      opts.onProgress?.({ done: i, total, fraction: total ? i / total : 1, elapsedMs: performance.now() - tStart, phase })
    while (i < total) {
      if (opts.signal?.aborted) throw new DOMException('capture aborted', 'AbortError')
      if (pending && Number.isFinite(sliceMs)) {
        // keep at most one slice queued on the GPU
        const st = gl.clientWaitSync(pending, 0, 0)
        if (st === gl.TIMEOUT_EXPIRED) {
          perSlice = Math.max(1, Math.floor(perSlice * 0.6))
          await nextFrame()
          continue
        }
        gl.deleteSync(pending)
        pending = null
        perSlice = Math.min(512, Math.ceil(perSlice * 1.5))
      }
      const t0 = performance.now()
      ses.open()
      let n = 0
      while (i < total && (n === 0 || ((performance.now() - t0 < sliceMs) && n < perSlice) || !Number.isFinite(sliceMs))) {
        ses.renderSub(subs[i], i, null)
        i++
        n++
      }
      ses.close()
      exposeMs += performance.now() - t0
      slices++
      report('expose')
      if (i < total && Number.isFinite(sliceMs)) {
        pending = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        gl.flush()
        await nextFrame()
      }
    }
    if (pending) gl.deleteSync(pending)
    return ses.finalize({ tStart, exposeMs, slices, gain: 1, exposedSeconds: ses.plan.effectiveTime, samples: total, readback: opts.readback !== false, report })
  }

  /** Everything before the first sub-frame: geometry, plan, uniforms, and the closures that render and develop. */
  private prepare(input: PhotoScene | THREE.Scene, specIn: DeepPartial<CameraSpec> | CameraSpec, opts: CaptureOptions, mode: 'capture' | 'incremental'): Session {
    const renderer = this.renderer
    const caps = this.caps
    const incremental = mode === 'incremental'
    const pscene: PhotoScene = (input as THREE.Scene).isScene ? { scene: input as THREE.Scene } : (input as PhotoScene)
    const spec = resolveSpec(specIn as DeepPartial<CameraSpec>)
    const optics = computeOptics(spec)
    const samples = Math.max(1, Math.round(opts.samples ?? 32))
    const seed = opts.seed ?? 1 // deterministic by default (architecture §3.3): pass a seed per shot
    const time0 = opts.time0 ?? 0
    const near = opts.near ?? 0.05
    const far = opts.far ?? 5000
    const lens = spec.lens
    const radianceScale = opts.radianceScale ?? 1
    const layers = opts.layers ?? 1
    const profile = incremental ? null : (opts.shutterProfile ?? null)

    // ---- output geometry
    const halfW = spec.format.width / 2
    const halfH = spec.format.height / 2
    const halfDiag = optics.halfDiag
    const [outW, outH] = PhotoRenderer.outputSize(spec.format, opts.longEdge ?? 1024, caps.maxSize)
    const pitch = spec.format.width / outW // mm per px

    // ---- shutter plan (an incremental exposure only borrows the plan's pupil points and constants)
    const planSpec: CameraSpec = incremental ? { ...spec, shutterType: 'leaf', leafRamp: 0, shutter: 1 } : spec
    const plan: ShutterPlan = profile && !incremental
      ? planProfile(spec, profile, samples, seed, opts.order ?? 'blocked', Math.max(8, 2 * Math.round(opts.shadowEvery ?? 1)))
      : planShutter(planSpec, {
          samples,
          maxRenders: Math.max(samples, Math.round(opts.maxRenders ?? samples * 6)),
          seed,
          order: incremental ? 'chronological' : (opts.order ?? 'blocked'),
          blockSize: Math.max(8, 2 * Math.round(opts.shadowEvery ?? 1)),
        })
    this.lastPlan = plan
    const pupilR = optics.apertureDiameter / 2 // mm, equal-area nominal radius
    const pupilRMax = pupilR * plan.aperture.maxRadius

    // ---- tilt (Scheimpflug): the plane of sharp focus tilts about the camera x axis
    const tiltRad = ((opts.tilt?.deg ?? 0) * Math.PI) / 180
    const tilted = Math.abs(tiltRad) > 1e-6 && Number.isFinite(spec.focusDistance)
    const sM = spec.focusDistance // m
    const fM = spec.focalLength / 1000
    const tiltTy = tilted ? ((sM + fM) * Math.tan(tiltRad)) / fM : 0
    const cosT = tilted ? Math.cos(tiltRad) : 1
    const sinT = tilted ? Math.sin(tiltRad) : 0

    // ---- overscan so distortion / colour / focus warps never sample outside the render
    const k1 = lens.distortionK1
    const k2 = lens.distortionK2
    const ruCorner = undistortR(1, k1, k2)
    const latHalf = Math.abs(lens.lateralCA) / 2
    const warp = Math.abs(lens.fieldCurvature) > 1e-6 || Math.abs(lens.longitudinalCA) > 1e-6
    const dispMarginMm = warp ? (pupilRMax / 1000) * (Math.abs(lens.fieldCurvature) * 2 + Math.abs(lens.longitudinalCA)) * optics.imageDistance * 1.5 : 0
    const distShiftMm = Math.abs(ruCorner - 1) * halfDiag
    let over = Math.max(1, ruCorner) / (1 - latHalf) + (dispMarginMm + 2 * pitch) / Math.min(halfW, halfH)
    over = Math.min(1.6, over)
    const rW = Math.min(caps.maxSize, Math.round(outW * over))
    const rH = Math.min(caps.maxSize, Math.round(outH * over))
    const halfSW = halfW * (rW / outW)
    const halfSH = halfH * (rH / outH)

    // ---- targets
    const sceneType = caps.floatRender ? THREE.FloatType : THREE.HalfFloatType
    const sceneLinear = sceneType === THREE.HalfFloatType || caps.floatLinear
    const sceneRT = this.rt('scene', rW, rH, sceneType, sceneLinear, true)
    const accType = caps.accum === 'float32' ? THREE.FloatType : THREE.HalfFloatType
    const accLinear = accType === THREE.HalfFloatType || caps.floatLinear
    const accRT = this.rt('acc', rW, rH, accType, accLinear)
    this.previewCrop.set(halfW / halfSW, halfH / halfSH)
    this.previewMat.uniforms.tAcc.value = accRT.texture
    this.previewMat.uniforms.uGain.value = 1

    // ---- spectral matrix: rendered RGB -> film channels
    const spectral = new THREE.Matrix3()
    if (opts.spectral) {
      const s = opts.spectral
      spectral.set(s[0][0], s[0][1], s[0][2], s[1][0], s[1][1], s[1][2], s[2][0], s[2][1], s[2][2])
    } else if (!spec.film.color) {
      const p = PAN_WEIGHTS
      spectral.set(p[0], p[1], p[2], p[0], p[1], p[2], p[0], p[1], p[2])
    }

    // ---- accumulate material
    const smooth = opts.smoothBokeh !== false && plan.samplesPerPixel > 1.5 && optics.apertureDiameter > 0
    const accMat = this.accumMaterial(warp, smooth)
    const u = accMat.uniforms
    u.tScene.value = sceneRT.texture
    u.tDepth.value = sceneRT.depthTexture
    u.uNear.value = near
    u.uFar.value = far
    u.uCocK.value = (optics.apertureDiameter * optics.imageDistance) / (2000 * pitch)
    u.uInvS.value = Number.isFinite(spec.focusDistance) ? 1 / spec.focusDistance : 0
    // sigma = half the mean pupil-sample spacing (R sqrt(pi/N) / 2); kernel support = 2 sigma
    u.uSmooth.value = ((opts.smoothStrength ?? 1) * 1.77) / Math.sqrt(Math.max(1, plan.samplesPerPixel))
    u.uTexel.value.set(1 / rW, 1 / rH)
    u.uHalfSensor.value.set(halfSW, halfSH)
    u.uHalfFormat.value.set(halfW, halfH)
    u.uHalfDiag.value = halfDiag
    u.uK.value.set(k1, k2)
    u.uRimRadius.value = optics.maxApertureRadius / 1000
    u.uVignette.value = lens.vignetting
    u.uImageDist.value = optics.imageDistance
    u.uFieldCurv.value = lens.fieldCurvature
    u.uAstig.value = lens.astigmatism
    u.uLongCA.value.set(lens.longitudinalCA / 2, 0, -lens.longitudinalCA / 2)
    u.uSpectral.value = spectral
    u.uTiltTy.value = tiltTy
    u.uTanH.value = halfSH / optics.imageDistance
    // An incremental exposure does not know its length yet: accumulate on a per-second basis and apply the
    // exposure (including reciprocity) at the end.
    const perSecond = xPerNit(spec, optics, 1) * radianceScale
    const valueScale = incremental ? perSecond : xPerNit(spec, optics, plan.effectiveTime) * radianceScale
    u.uValueScale.value = valueScale
    const expected = Math.max(1, plan.samplesPerPixel)
    const accScale = accType === THREE.FloatType ? 1 : 1 / (4 * expected)
    u.uAccScale.value = accScale
    const focal = !incremental && plan.type === 'focal-plane'
    u.uMode.value = focal ? 1 : 0
    u.uTravel.value = plan.curtainTravel
    const dirV = { up: [0, 1], down: [0, -1], right: [1, 0], left: [-1, 0] }[plan.curtainDirection]
    u.uDir.value.set(dirV[0], dirV[1], 0, 0)
    // custom shutter profile: a small coverage texture per sub-frame
    let profileTex: THREE.DataTexture | null = null
    let profileData: Uint8Array | null = null
    if (profile) {
      profileData = new Uint8Array(PROFILE_N * PROFILE_N)
      profileTex = new THREE.DataTexture(profileData, PROFILE_N, PROFILE_N, THREE.RedFormat, THREE.UnsignedByteType)
      profileTex.minFilter = profileTex.magFilter = THREE.LinearFilter
      profileTex.wrapS = profileTex.wrapT = THREE.ClampToEdgeWrapping
      profileTex.needsUpdate = true
    }
    u.tProfile.value = profileTex
    u.uProfileOn.value = profile ? 1 : 0

    // ---- analytic emitters (bokeh discs)
    const emitterMat = opts.emitters ? this.emitterMaterial() : null
    const emitterBuf: PhotoEmitter[] = []
    if (emitterMat) {
      const eu = emitterMat.uniforms
      eu.uHalfSensor.value.set(halfSW, halfSH)
      eu.uHalfFormat.value.set(halfW, halfH)
      eu.uHalfDiag.value = halfDiag
      eu.uK.value.set(k1, k2)
      eu.uMode.value = focal ? 1 : 0
      eu.uTravel.value = plan.curtainTravel
      eu.uDir.value.set(dirV[0], dirV[1], 0, 0)
      eu.uBlades.value = Math.round(spec.aperture.blades)
      eu.uRot.value = (spec.aperture.rotation * Math.PI) / 180
      eu.uCurv.value = spec.aperture.curvature
      eu.uShapeScale.value = Math.sqrt(Math.PI / Math.max(plan.aperture.area, 1e-4))
      eu.uPx.value = (2 * halfSW) / rW
      const mask = spec.aperture.mask
      if (mask && mask.size > 0) {
        const n = mask.size
        const data = new Uint8Array(n * n)
        for (let k = 0; k < n * n; k++) data[k] = mask.data[k] > 0.5 ? 255 : 0
        const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType)
        tex.minFilter = tex.magFilter = THREE.NearestFilter
        tex.needsUpdate = true
        eu.tMask.value?.dispose?.()
        eu.tMask.value = tex
        eu.uMaskOn.value = 1
      } else eu.uMaskOn.value = 0
    }

    // ---- renderer state
    const saved = {
      target: renderer.getRenderTarget(),
      autoClear: renderer.autoClear,
      clearColor: renderer.getClearColor(new THREE.Color()),
      clearAlpha: renderer.getClearAlpha(),
      shadowAuto: renderer.shadowMap.autoUpdate,
    }
    const open = () => {
      renderer.autoClear = false
      renderer.setClearColor(0x000000, 0)
    }
    const close = () => {
      sceneRT.scissorTest = false
      accRT.scissorTest = false
      renderer.setRenderTarget(saved.target)
      renderer.autoClear = saved.autoClear
      renderer.setClearColor(saved.clearColor, saved.clearAlpha)
      renderer.shadowMap.autoUpdate = saved.shadowAuto
    }

    // clear accumulator
    open()
    renderer.setRenderTarget(accRT)
    renderer.clear(true, false, false)
    this.hasAccum = true
    close()

    // ---- per-sub-frame
    const cam = this.cam
    cam.layers.mask = layers
    const basePose = poseOf(opts.pose)
    const livePose = incremental && !!(opts.pose as THREE.Object3D).isObject3D
    const tanW = halfSW / optics.imageDistance
    const tanH = halfSH / optics.imageDistance
    const invS = Number.isFinite(spec.focusDistance) ? 1 / spec.focusDistance : 0
    const offset = new THREE.Vector3()
    const shadowEvery = Math.max(1, Math.round(opts.shadowEvery ?? 1))
    const padMm = distShiftMm + dispMarginMm + 2 * pitch
    const vertical = plan.curtainDirection === 'up' || plan.curtainDirection === 'down'
    const sign = plan.curtainDirection === 'up' || plan.curtainDirection === 'right' ? 1 : -1
    const subs: SubFrame[] = plan.subframes.slice()
    // flash: energy added on top of the ambient ratio estimate. RGB/A at the end = mean ambient + flash,
    // so each flash sample carries K = xPerNit(pulse) * accScale * (expected final A per pixel) / samples.
    let flashScale = 0
    if (!incremental && opts.flash && pscene.setFlash) {
      const fl = planFlash(spec, plan, opts.flash, seed)
      if (fl.length) {
        const wsum = focal ? spec.shutter / plan.binWidth : plan.subframes.reduce((a, sf) => a + sf.weight, 0)
        const d = Math.max(1e-6, opts.flash.duration ?? 1 / 1000)
        flashScale = (xPerNit(spec, optics, d) * radianceScale * accScale * wsum) / fl.length
        subs.push(...fl)
      }
    }
    const total = subs.length

    // central-camera matrices for the tilt path
    const W0 = new THREE.Matrix4()
    const V0 = new THREE.Matrix4()
    const P0 = new THREE.Matrix4()
    const M0 = new THREE.Matrix4()
    const Ma = new THREE.Matrix4()
    const Ws = new THREE.Matrix4()
    const unit = new THREE.Vector3(1, 1, 1)
    const aW = new THREE.Vector3()
    const aView = new THREE.Vector3()
    const centre = new THREE.Vector3()

    const renderSub = (sf: SubFrame, idx: number, ov: SubOverride | null) => {
      const lx = (sf.lens[0] * pupilR) / 1000
      const ly = (sf.lens[1] * pupilR) / 1000
      const sfTime = ov ? ov.tRel : sf.time
      const info: SubFrameInfo = {
        index: idx,
        total,
        time: ov ? ov.time : time0 + sf.time,
        tRel: sfTime,
        lensMm: [sf.lens[0] * pupilR, sf.lens[1] * pupilR],
        rand: sf.rand,
      }
      pscene.setTime?.(info.time, info)
      const pose = ov?.pose ?? (opts.poseAt ? opts.poseAt(sfTime) : livePose ? poseOf(opts.pose) : basePose)
      cam.layers.mask = layers
      const jx = (sf.jitter[0] * 2 * tanW) / rW
      const jy = (sf.jitter[1] * 2 * tanH) / rH
      cam.near = near
      cam.far = far
      if (!tilted) {
        offset.set(lx, ly, 0).applyQuaternion(pose.quaternion)
        cam.position.copy(pose.position).add(offset)
        cam.quaternion.copy(pose.quaternion)
        cam.updateMatrixWorld(true)
        cam.projectionMatrix.makePerspective(
          near * (-tanW - lx * invS + jx),
          near * (tanW - lx * invS + jx),
          near * (tanH - ly * invS + jy),
          near * (-tanH - ly * invS + jy),
          near,
          far,
        )
      } else {
        // rank-1 projection update: M_a = M0 - (M0 a) pi^T / (pi^T a). Every point of the focus plane lands on
        // the same pixel for every pupil point; rows x, y, w come from the update, depth stays the central one.
        W0.compose(pose.position, pose.quaternion, unit)
        V0.copy(W0).invert()
        P0.makePerspective(near * (-tanW + jx), near * (tanW + jx), near * (tanH + jy), near * (-tanH + jy), near, far)
        M0.multiplyMatrices(P0, V0)
        aView.set(lx, ly * cosT, -ly * sinT)
        aW.copy(aView).applyQuaternion(pose.quaternion).add(pose.position)
        cam.position.copy(aW)
        cam.quaternion.copy(pose.quaternion)
        cam.updateMatrixWorld(true)
        // plane in the central view space: ty*y + z + s = 0  ->  world space pi_w = V0^T pi_v
        const e = V0.elements
        const pv = [0, tiltTy, 1, sM]
        const pw = [0, 0, 0, 0]
        for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) pw[c] += pv[r] * e[c * 4 + r]
        const m = M0.elements
        const ah = [aW.x, aW.y, aW.z, 1]
        const den = pw[0] * ah[0] + pw[1] * ah[1] + pw[2] * ah[2] + pw[3] * ah[3]
        const ma = Ma.elements
        for (let r = 0; r < 4; r++) {
          let ma_r = 0
          for (let c = 0; c < 4; c++) ma_r += m[c * 4 + r] * ah[c]
          for (let c = 0; c < 4; c++) ma[c * 4 + r] = r === 2 ? m[c * 4 + r] : m[c * 4 + r] - (ma_r * pw[c]) / den
        }
        Ws.copy(cam.matrixWorld)
        cam.projectionMatrix.multiplyMatrices(Ma, Ws)
      }
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert()

      // scissor to the band of rows the slit reaches in this bin
      let scissor = false
      if (focal && (sf.rowMin > 0 || sf.rowMax < 1)) {
        const half = vertical ? halfH : halfW
        const halfS = vertical ? halfSH : halfSW
        const size = vertical ? rH : rW
        const c0 = sign > 0 ? (sf.rowMin - 0.5) * 2 * half : (0.5 - sf.rowMax) * 2 * half
        const c1 = sign > 0 ? (sf.rowMax - 0.5) * 2 * half : (0.5 - sf.rowMin) * 2 * half
        const p0 = Math.max(0, Math.floor(((c0 - padMm) / halfS) * 0.5 * size + 0.5 * size))
        const p1 = Math.min(size, Math.ceil(((c1 + padMm) / halfS) * 0.5 * size + 0.5 * size))
        if (p1 <= p0) return
        if (p0 > 0 || p1 < size) {
          scissor = true
          if (vertical) {
            sceneRT.scissor.set(0, p0, rW, p1 - p0)
            accRT.scissor.set(0, p0, rW, p1 - p0)
          } else {
            sceneRT.scissor.set(p0, 0, p1 - p0, rH)
            accRT.scissor.set(p0, 0, p1 - p0, rH)
          }
        }
      }
      sceneRT.scissorTest = scissor
      accRT.scissorTest = scissor

      renderer.shadowMap.autoUpdate = saved.shadowAuto && (shadowEvery === 1 || idx % shadowEvery === 0)
      if (sf.flash) pscene.setFlash?.(true, { position: cam.position, quaternion: cam.quaternion })
      renderer.setRenderTarget(sceneRT)
      renderer.clear(true, true, false)
      renderer.render(pscene.scene, cam)
      if (sf.flash) pscene.setFlash?.(false, { position: cam.position, quaternion: cam.quaternion })

      u.uLens.value.set(lx, ly)
      u.uRot.value = sf.rand[0] * Math.PI * 2
      const wgt = ov ? ov.weight : sf.weight
      u.uWeight.value = wgt
      if (sf.flash) {
        u.uFlashScale.value = flashScale
        u.uBin.value.set(sf.t0, sf.t1, 1 / Math.max(1e-9, sf.t1 - sf.t0), spec.shutter)
      } else {
        u.uFlashScale.value = 0
        u.uBin.value.set(sf.t0, sf.t1, 1 / plan.binWidth, spec.shutter)
      }
      if (profile && profileData && profileTex) {
        const dtBin = plan.binWidth
        for (let j = 0; j < PROFILE_N; j++) {
          const v = (j + 0.5) / PROFILE_N
          for (let i2 = 0; i2 < PROFILE_N; i2++) {
            const o = profile.open((i2 + 0.5) / PROFILE_N, v, sf.t0, dtBin)
            profileData[j * PROFILE_N + i2] = o <= 0 ? 0 : o >= 1 ? 255 : Math.round(o * 255)
          }
        }
        profileTex.needsUpdate = true
      }
      this.pass.run(renderer, accMat, accRT)

      // analytic point emitters: pupil-shaped discs added straight into the accumulator
      if (emitterMat && opts.emitters && !sf.flash) {
        const n = opts.emitters(info.time, emitterBuf)
        const eu = emitterMat.uniforms
        const W = new THREE.Matrix4().compose(pose.position, pose.quaternion, unit)
        const Vp = W.invert()
        const sx = eu.uShapeScale.value as number
        eu.uWeight.value = wgt
        eu.uBin.value.set(sf.t0, sf.t1, 1 / plan.binWidth, spec.shutter)
        for (let q = 0; q < n; q++) {
          const em = emitterBuf[q]
          if (!em) continue
          centre.set(em.x, em.y, em.z).applyMatrix4(Vp)
          const zv = -centre.z
          if (zv < 0.02) continue
          const d = zv
          const cx = (centre.x / d) * optics.imageDistance
          const cy = (centre.y / d) * optics.imageDistance
          if (Math.abs(cx) > halfSW * 1.5 || Math.abs(cy) > halfSH * 1.5) continue
          const invFocus = invS * (1 - tiltTy * (centre.y / d))
          const bMm = (optics.apertureDiameter * optics.imageDistance * Math.abs(invFocus - 1 / d)) / 1000
          const rMm = Math.max(0.5 * bMm, 1.5 * (2 * halfSW / rW))
          const eqScale = (optics.imageDistance * optics.imageDistance) / (d * d * Math.PI * rMm * rMm)
          eu.uCentre.value.set(cx, cy)
          eu.uRadius.value = rMm
          const k = eqScale * valueScale * accScale
          eu.uColour.value.set(em.rgb[0] * k, em.rgb[1] * k, em.rgb[2] * k)
          // scissor to the disc's bounding box
          const half = rMm * sx * 1.15 + 2 * (2 * halfSW / rW)
          const x0 = Math.max(0, Math.floor(((cx - half) / halfSW) * 0.5 * rW + 0.5 * rW))
          const x1 = Math.min(rW, Math.ceil(((cx + half) / halfSW) * 0.5 * rW + 0.5 * rW))
          const y0 = Math.max(0, Math.floor(((cy - half) / halfSH) * 0.5 * rH + 0.5 * rH))
          const y1 = Math.min(rH, Math.ceil(((cy + half) / halfSH) * 0.5 * rH + 0.5 * rH))
          if (x1 <= x0 || y1 <= y0) continue
          accRT.scissorTest = true
          accRT.scissor.set(x0, y0, x1 - x0, y1 - y0)
          this.pass.run(renderer, emitterMat, accRT)
        }
        accRT.scissorTest = scissor
      }
    }

    const finalize = async (c: FinalizeArgs): Promise<CaptureResult> => {
      const tDev = performance.now()
      const gain = c.gain
      const report = c.report
      // ---------------------------------------------------------------- develop the optics + film
      report('develop')
      open()
      const half = THREE.HalfFloatType
      const rtA = this.rt('postA', outW, outH, half, true)
      const rtB = this.rt('postB', outW, outH, half, true)
      const ru = this.resolveMat.uniforms
      ru.tAcc.value = accRT.texture
      ru.uAccSize.value.set(rW, rH)
      ru.uHalfSensor.value.set(halfSW, halfSH)
      ru.uHalfFormat.value.set(halfW, halfH)
      ru.uHalfDiag.value = halfDiag
      ru.uK.value.set(k1, k2)
      ru.uLatCA.value.set(lens.lateralCA / 2, 0, -lens.lateralCA / 2)
      ru.uNatVig.value = lens.naturalVignetting
      ru.uImageDist.value = optics.imageDistance
      ru.uPostScale.value = POST_SCALE * gain
      ru.uVignette.value = lens.vignetting
      ru.uRimRadius.value = optics.maxApertureRadius / 1000
      {
        // a fixed, well-spread pupil set (weighted by leaf open time) for the rim-pass fraction
        const pts = plan.aperture.points
        const n = Math.min(64, pts.length / 2)
        const arr = ru.uPupil.value as THREE.Vector3[]
        const qScale = spec.maxAperture / spec.fNumber
        for (let k = 0; k < n; k++) {
          const x = pts[k * 2]
          const y = pts[k * 2 + 1]
          const q = Math.min(1, Math.hypot(x, y) * qScale)
          const wgt = plan.type === 'leaf' && !incremental && !profile ? Math.max(0, plan.span - 2 * q * spec.leafRamp) : 1
          arr[k].set((x * pupilR) / 1000, (y * pupilR) / 1000, wgt)
        }
        ru.uPupilCount.value = n
      }
      this.pass.run(renderer, this.resolveMat, rtA)

      // diffraction (Airy core ~ gaussian sigma 0.42 * lambda * Nw)
      let latentRT = rtA
      if (lens.diffraction) {
        const sig = LAMBDA_MM.map((l) => (0.42 * l * optics.workingFNumber) / pitch)
        const smax = Math.max(...sig)
        if (smax > 0.3) {
          const radius = Math.min(16, Math.max(1, Math.ceil(smax * 3)))
          const bm = this.blurMaterial(radius)
          bm.uniforms.uSigma.value.set(Math.max(sig[0], 0.05), Math.max(sig[1], 0.05), Math.max(sig[2], 0.05))
          bm.uniforms.tSrc.value = rtA.texture
          bm.uniforms.uTexel.value.set(1 / outW, 0)
          this.pass.run(renderer, bm, rtB)
          bm.uniforms.tSrc.value = rtB.texture
          bm.uniforms.uTexel.value.set(0, 1 / outH)
          this.pass.run(renderer, bm, rtA)
          latentRT = rtA
        }
      }

      // flare chain
      const wantFlare = opts.flare !== false
      const glowAmt = wantFlare ? Math.min(0.5, lens.glow * Math.pow(spec.maxAperture / spec.fNumber, 2) + 0.002) : 0
      const veil = wantFlare ? Math.min(0.3, lens.veilingGlare) : 0
      const ghostAmt = wantFlare ? Math.max(0, lens.ghosts) : 0
      const blades = Math.round(spec.aperture.blades)
      const starLines = blades >= 3 && !spec.aperture.mask ? (blades % 2 === 0 ? blades / 2 : blades) : 0
      const starAmt = wantFlare && lens.diffraction && starLines > 0
        ? Math.min(0.05, lens.starStrength * 2 * (LAMBDA_MM[1] * spec.fNumber) / spec.focalLength * 40 * (1 - Math.min(1, spec.aperture.curvature)))
        : 0
      const useFlare = wantFlare && (glowAmt > 0 || veil > 0 || ghostAmt > 0)
      const downs: THREE.WebGLRenderTarget[] = []
      const ups: THREE.WebGLRenderTarget[] = []
      let meanRT: THREE.WebGLRenderTarget | null = null
      if (useFlare || starAmt > 0) {
        let w = outW
        let h = outH
        let src = latentRT
        for (let l = 0; l < 8; l++) {
          w = Math.max(1, Math.ceil(w / 2))
          h = Math.max(1, Math.ceil(h / 2))
          const d = this.rt(`down${l}`, w, h, half, true)
          this.downMat.uniforms.uScale.value = 1
          this.downMat.uniforms.uM.value = IDENT3
          this.downMat.uniforms.tSrc.value = src.texture
          this.downMat.uniforms.uSrcTexel.value.set(1 / src.width, 1 / src.height)
          this.pass.run(renderer, this.downMat, d)
          downs.push(d)
          src = d
          if (w <= 24 && h <= 24) break
        }
        // up chain: U_n = D_n, U_i = D_i + tent(U_{i+1}) -> sum of all levels, each a wider PSF
        let coarse = downs[downs.length - 1]
        for (let l = downs.length - 2; l >= 0; l--) {
          const d = downs[l]
          const up = this.rt(`up${l}`, d.width, d.height, half, true)
          this.upMat.uniforms.tCoarse.value = coarse.texture
          this.upMat.uniforms.tFine.value = d.texture
          this.upMat.uniforms.uCoarseTexel.value.set(1 / coarse.width, 1 / coarse.height)
          this.pass.run(renderer, this.upMat, up)
          ups.unshift(up)
          coarse = up
        }
        const last = downs[downs.length - 1]
        meanRT = this.rt('mean', 1, 1, half, false)
        this.meanMat.uniforms.tSrc.value = last.texture
        this.meanMat.uniforms.uSize.value.set(last.width, last.height)
        this.pass.run(renderer, this.meanMat, meanRT)
      }

      // glare probe: what is just outside the frame (rendered once, mid-exposure, pinhole)
      let probeSmall: THREE.WebGLRenderTarget | null = null
      let probeVeil: THREE.WebGLRenderTarget | null = null
      if (useFlare && (veil > 0 || ghostAmt > 0) && opts.glareProbe !== false) {
        const pw = 384
        const ph = Math.max(8, Math.round((pw * halfH) / halfW))
        const probeRT = this.rt('probe', pw, ph, sceneType, sceneLinear, true)
        const tMid = incremental ? c.exposedSeconds / 2 : plan.span / 2
        const pose = c.probePose ?? (opts.poseAt ? opts.poseAt(tMid) : livePose ? poseOf(opts.pose) : basePose)
        pscene.setTime?.(c.probeTime ?? time0 + tMid, { index: -1, total, time: c.probeTime ?? time0 + tMid, tRel: tMid, lensMm: [0, 0], rand: [0.5, 0.5] })
        const pc = this.probeCam
        pc.layers.mask = layers
        pc.position.copy(pose.position)
        pc.quaternion.copy(pose.quaternion)
        pc.updateMatrixWorld(true)
        const tw = (3 * halfW) / optics.imageDistance
        const th = (3 * halfH) / optics.imageDistance
        pc.projectionMatrix.makePerspective(-near * tw, near * tw, near * th, -near * th, near, far)
        pc.projectionMatrixInverse.copy(pc.projectionMatrix).invert()
        renderer.setRenderTarget(probeRT)
        renderer.clear(true, true, false)
        renderer.render(pscene.scene, pc)
        // two 13-tap downsamples to ~96 px, converting cd/m^2 -> X * postScale on the way
        const p1 = this.rt('probe1', Math.ceil(pw / 2), Math.ceil(ph / 2), half, true)
        this.downMat.uniforms.tSrc.value = probeRT.texture
        this.downMat.uniforms.uSrcTexel.value.set(1 / pw, 1 / ph)
        this.downMat.uniforms.uScale.value = valueScale * gain * POST_SCALE
        this.downMat.uniforms.uM.value = spectral
        this.pass.run(renderer, this.downMat, p1)
        probeSmall = this.rt('probe2', Math.ceil(p1.width / 2), Math.ceil(p1.height / 2), half, true)
        this.downMat.uniforms.tSrc.value = p1.texture
        this.downMat.uniforms.uSrcTexel.value.set(1 / p1.width, 1 / p1.height)
        this.downMat.uniforms.uScale.value = 1
        this.downMat.uniforms.uM.value = IDENT3
        this.pass.run(renderer, this.downMat, probeSmall)
        probeVeil = this.rt('probeVeil', 1, 1, half, false)
        const pv = this.probeVeilMat.uniforms
        pv.tProbe.value = probeSmall.texture
        pv.uSize.value.set(probeSmall.width, probeSmall.height)
        pv.uFrameTan.value.set(halfW / optics.imageDistance, halfH / optics.imageDistance)
        pv.uFalloff.value = ((opts.glareFalloffDeg ?? 10) * Math.PI) / 180
        this.pass.run(renderer, this.probeVeilMat, probeVeil)
      }

      const grainOn = opts.grain !== false && spec.film.granularity > 0
      const outType = caps.floatRender ? THREE.FloatType : THREE.HalfFloatType
      let outRT = this.rt('out', outW, outH, outType, false)
      const cm = this.compositeMaterial(useFlare, starAmt > 0, grainOn)
      const cu = cm.uniforms
      cu.tLatent.value = latentRT.texture
      cu.uOutSize.value.set(outW, outH)
      if (useFlare || starAmt > 0) {
        cu.tGlow.value = (ups[0] ?? downs[0]).texture
        cu.uGlowLevels.value = downs.length
        cu.tGhost.value = downs[Math.min(2, downs.length - 1)].texture
        const starSrc = downs[Math.min(1, downs.length - 1)]
        cu.tStar.value = starSrc.texture
        cu.uStarTexel.value.set(1 / starSrc.width, 1 / starSrc.height)
        cu.tMean.value = meanRT!.texture
      }
      if (opts.baseTarget && (opts.baseTarget.width !== outW || opts.baseTarget.height !== outH))
        throw new Error('PhotoRenderer.capture: baseTarget size differs from this capture (same format and longEdge required)')
      cu.tBase.value = opts.baseTarget?.texture ?? null
      cu.uBaseOn.value = opts.baseTarget ? 1 : 0
      cu.uNoGrain.value = 0
      cu.uProbeOn.value = probeSmall ? 1 : 0
      cu.tProbe.value = probeSmall?.texture ?? null
      cu.tProbeVeil.value = probeVeil?.texture ?? null
      cu.uGlow.value = glowAmt
      cu.uVeil.value = veil
      cu.uGhost.value = ghostAmt
      cu.uStar.value = starAmt
      cu.uStarLines.value = starLines
      cu.uStarRot.value = ((spec.aperture.rotation + (blades % 2 === 0 ? 180 / Math.max(blades, 1) : 90)) * Math.PI) / 180
      // grain: Selwyn granularity G(ISO) ~ 0.43 um * sqrt(ISO/100) (RMS diffuse density * sqrt(area)),
      // sigma_D = G / max(pixel pitch, grain size); expressed as ln-exposure via gamma 0.65.
      const pitchUm = pitch * 1000
      const G = 0.43 * Math.sqrt(spec.iso / 100) * spec.film.granularity
      const sigmaD = G / Math.max(pitchUm, spec.film.grainSize)
      cu.uGrainSigma.value = grainOn ? (sigmaD / 0.65) * Math.LN10 : 0
      cu.uGrainCell.value = Math.max(1, spec.film.grainSize / pitchUm)
      cu.uGrainColor.value = spec.film.color ? 0.55 : 0
      cu.uSeed.value = seed % 65521
      let preGrainTarget: THREE.WebGLRenderTarget | null = null
      if (opts.keepPreGrain) {
        preGrainTarget = new THREE.WebGLRenderTarget(outW, outH, { type: outType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false })
        cu.uNoGrain.value = 1
        this.pass.run(renderer, cm, preGrainTarget)
        cu.uNoGrain.value = 0
      }
      this.pass.run(renderer, cm, outRT)
      close()
      const developMs = performance.now() - tDev

      // ---------------------------------------------------------------- readback
      const tRead = performance.now()
      let latent: Float32Array | null = null
      if (c.readback) {
        report('readback')
        latent = new Float32Array(outW * outH * 4)
        if (outType === THREE.FloatType) {
          await renderer.readRenderTargetPixelsAsync(outRT, 0, 0, outW, outH, latent)
        } else {
          const h16 = new Uint16Array(outW * outH * 4)
          await renderer.readRenderTargetPixelsAsync(outRT, 0, 0, outW, outH, h16)
          for (let k = 0; k < h16.length; k++) latent[k] = halfToFloat(h16[k])
        }
        // flip to top-row-first
        const row = outW * 4
        const tmp = new Float32Array(row)
        for (let y = 0; y < outH >> 1; y++) {
          const a = y * row
          const b = (outH - 1 - y) * row
          tmp.set(latent.subarray(a, a + row))
          latent.copyWithin(a, b, b + row)
          latent.set(tmp, b)
        }
      }
      const readbackMs = performance.now() - tRead
      let target: THREE.WebGLRenderTarget | null = null
      if (opts.keepTarget) {
        target = outRT
        this.rts.delete('out') // caller owns it now
        outRT = target
      }
      const stats = latent ? latentStats(latent, outW, outH) : null
      report('done')
      profileTex?.dispose()
      if (emitterMat) (emitterMat.uniforms.tMask.value as THREE.Texture | null)?.dispose?.()
      const effTime = c.exposedSeconds
      return {
        latent,
        width: outW,
        height: outH,
        target,
        preGrainTarget,
        meta: {
          spec,
          optics,
          exposure: {
            unit: 'X',
            xPerNit: incremental ? xPerNit(spec, optics, effTime) * radianceScale : valueScale,
            effectiveTime: effTime,
            shutterEfficiency: incremental ? 1 : plan.effectiveTime / spec.shutter,
            reciprocityFactor: reciprocityFactor(effTime, spec.film.reciprocityP),
            hPerUnit: hPerUnit(spec.iso),
            ev: incremental ? Math.log2((spec.fNumber * spec.fNumber) / Math.max(effTime, 1e-9)) : optics.ev,
            ev100: incremental ? Math.log2((spec.fNumber * spec.fNumber) / Math.max(effTime, 1e-9)) - Math.log2(spec.iso / 100) : optics.ev100,
          },
          sampling: {
            renders: c.samples,
            bins: Math.round(plan.span / plan.binWidth),
            span: plan.span,
            samplesPerPixel: incremental ? c.samples : plan.samplesPerPixel,
            renderSize: [rW, rH],
            overscan: over,
            apertureArea: plan.aperture.area,
          },
          timing: { totalMs: performance.now() - c.tStart, exposeMs: c.exposeMs, developMs, readbackMs, slices: c.slices },
          caps,
          stats,
          time0,
          seed,
        },
      }
    }

    // an incremental exposure can outrun its expected sample count: the plan is prefix-consistent, so re-plan bigger
    const subAt = (k: number): SubFrame => {
      if (k < subs.length) return subs[k]
      const more = planShutter(planSpec, {
        samples: Math.max(2 * subs.length, k + 1, 64),
        maxRenders: Number.MAX_SAFE_INTEGER,
        seed,
        order: 'chronological',
      }).subframes
      subs.length = 0
      subs.push(...more)
      return subs[Math.min(k, subs.length - 1)]
    }
    return {
      spec,
      optics,
      plan,
      subs,
      subAt,
      total,
      seed,
      time0,
      pupilR,
      tanW,
      tanH,
      rW,
      rH,
      perSecond,
      valueScale,
      accType,
      expected,
      open,
      close,
      renderSub,
      finalize,
      sceneRT,
      accRT,
    }
  }

  /**
   * Compile every shader variant the pipeline uses (and the scene's materials into float targets) by
   * running a tiny capture. Call during a loading screen: the first real capture otherwise pays
   * ~0.3-0.5 s of program compilation.
   */
  async warmup(input: PhotoScene | THREE.Scene, spec?: DeepPartial<CameraSpec>): Promise<void> {
    const pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
    const base = resolveSpec(spec ?? {})
    for (const v of [
      { shutterType: 'focal-plane' as const, lens: { fieldCurvature: 0, longitudinalCA: 0 } },
      { shutterType: 'leaf' as const, lens: { fieldCurvature: 0.5, longitudinalCA: 0.5 } },
    ]) {
      await this.capture(input, resolveSpec(v, base), { pose, samples: 2, longEdge: 64, sliceMs: Infinity, readback: false })
    }
  }

  /**
   * Draw the accumulation so far (progressive preview) into `target` (null = canvas) at `viewport`
   * (canvas CSS pixels, like renderer.setViewport). Call it from your frame loop while capture() runs.
   */
  drawPreview(target: THREE.WebGLRenderTarget | null = null, viewport?: { x: number; y: number; width: number; height: number }): void {
    this.drawAccumulation(target, viewport, { gain: 1, opacity: 1 })
  }

  /** Draws the accumulator (progressive preview or finder ghost). `opacity` < 1 blends over what is already there and leaves unexposed areas transparent. */
  drawAccumulation(target: THREE.WebGLRenderTarget | null, viewport: { x: number; y: number; width: number; height: number } | undefined, o: { gain: number; opacity: number }): void {
    if (!this.hasAccum) return
    const pu = this.previewMat.uniforms
    pu.uGain.value = o.gain
    pu.uOpacity.value = o.opacity
    pu.uGhost.value = o.opacity < 1 ? 1 : 0
    this.previewMat.transparent = o.opacity < 1
    this.previewMat.blending = o.opacity < 1 ? THREE.NormalBlending : THREE.NoBlending
    const r = this.renderer
    const prevVp = new THREE.Vector4()
    r.getViewport(prevVp)
    const prevTarget = r.getRenderTarget()
    const prevAuto = r.autoClear
    r.autoClear = false
    if (viewport) r.setViewport(viewport.x, viewport.y, viewport.width, viewport.height)
    this.pass.run(r, this.previewMat, target)
    if (viewport) r.setViewport(prevVp)
    r.setRenderTarget(prevTarget)
    r.autoClear = prevAuto
  }

  /**
   * Draw the last capture as a developed print straight from the GPU (no readback): the same
   * negative + paper LUT as film.ts develop(). `target` null = canvas; viewport in CSS px.
   * Use it to show the photo instantly and read the latent back lazily (or never).
   */
  drawPrint(
    target: THREE.WebGLRenderTarget | null = null,
    viewport?: { x: number; y: number; width: number; height: number },
    o: { film?: FilmCurve; paper?: PaperCurve; printStops?: number; mono?: boolean; source?: THREE.WebGLRenderTarget } = {},
  ): boolean {
    const src = o.source ?? this.rts.get('out')
    if (!src) return false
    const film = o.film ?? NEGATIVE_COLOR
    const paper = o.paper ?? PAPER_RA4
    const key = JSON.stringify([film, paper, o.printStops ?? 0])
    if (!this.printLut || key !== this.printKey) {
      const full = buildPrintLUT(film, paper, o.printStops ?? 0)
      const n = 1024 // WebGL2 only guarantees 2048-wide textures
      const data = new Uint8Array(n)
      for (let i = 0; i < n; i++) data[i] = full[Math.round((i / (n - 1)) * (full.length - 1))]
      this.printLut?.dispose()
      this.printLut = new THREE.DataTexture(data, n, 1, THREE.RedFormat, THREE.UnsignedByteType)
      this.printLut.minFilter = this.printLut.magFilter = THREE.LinearFilter
      this.printLut.needsUpdate = true
      this.printKey = key
    }
    if (!this.printMat)
      this.printMat = shader(PRINT_FRAG, {
        tLatent: { value: null },
        tLut: { value: null },
        uLo: { value: LUT_LO },
        uHi: { value: LUT_HI },
        uMono: { value: 0 },
        uPan: { value: new THREE.Vector3(...PAN_WEIGHTS) },
      })
    const u = this.printMat.uniforms
    u.tLatent.value = src.texture
    u.tLut.value = this.printLut
    u.uMono.value = o.mono || !film.color ? 1 : 0
    const r = this.renderer
    const prevVp = new THREE.Vector4()
    r.getViewport(prevVp)
    const prevTarget = r.getRenderTarget()
    const prevAuto = r.autoClear
    r.autoClear = false
    if (viewport) r.setViewport(viewport.x, viewport.y, viewport.width, viewport.height)
    this.pass.run(r, this.printMat, target)
    if (viewport) r.setViewport(prevVp)
    r.setRenderTarget(prevTarget)
    r.autoClear = prevAuto
    return true
  }

  dispose(): void {
    for (const t of this.rts.values()) t.dispose()
    this.rts.clear()
    for (const m of [...this.accumMats.values(), ...this.blurMats.values(), ...this.compMats.values()]) m.dispose()
    this.resolveMat.dispose()
    this.downMat.dispose()
    this.upMat.dispose()
    this.meanMat.dispose()
    this.probeVeilMat.dispose()
    this.printMat?.dispose()
    this.printLut?.dispose()
    this.previewMat.dispose()
    this.emitterMat?.dispose()
    this.geo.dispose()
  }
}

function poseOf(p: THREE.Object3D | CameraPose): CameraPose {
  if ((p as THREE.Object3D).isObject3D) {
    const o = p as THREE.Object3D
    o.updateWorldMatrix(true, false)
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    o.matrixWorld.decompose(position, quaternion, new THREE.Vector3())
    return { position, quaternion }
  }
  const c = p as CameraPose
  return { position: c.position.clone(), quaternion: c.quaternion.clone() }
}
