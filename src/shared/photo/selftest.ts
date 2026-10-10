// Self-test for @shared/photo: the spike's closed-form optics checks (grey card, cos^4, linearity, leaf
// efficiency, mechanical vignetting, DOF, FOV, rocket-skew, motion blur, flash, double exposure), determinism,
// and the additions (radianceScale, tilt, shutter profile, spectral, layers, emitters, incremental exposure,
// latent encodings, finder, optics bridge). Each test builds a tiny scene, captures it, measures the latent
// and compares it with the formula. Needs WebGL2, so it is async and builds its own renderer if none is given.

import * as THREE from 'three'
import {
  type CameraSpec,
  type DeepPartial,
  blurCircleMm,
  computeOptics,
  resolveSpec,
  xPerNit,
} from './spec.ts'
import { type CaptureResult, type CameraPose, PhotoRenderer } from './PhotoRenderer.ts'
import { decodeLog2, encodeLog2, bytesToPNG, pngToBytes } from './latent.ts'
import { FinderPreview } from './finder.ts'
import { photoSpecFromProfile } from './bridge.ts'

export interface Check {
  group: string
  name: string
  value: string
  expect: string
  pass: boolean
}

export interface SelfTestOptions {
  /** reuse a renderer (default: a private offscreen one) */
  renderer?: THREE.WebGLRenderer
  /** run only these groups (default: all) */
  only?: string[]
  /** progress callback, one line per finished group */
  log?: (line: string) => void
}

const CLEAN: DeepPartial<CameraSpec> = {
  lens: {
    vignetting: 0, naturalVignetting: 0, distortionK1: 0, distortionK2: 0, lateralCA: 0, longitudinalCA: 0, fieldCurvature: 0,
    astigmatism: 0, veilingGlare: 0, ghosts: 0, glow: 0, diffraction: false,
  },
  film: { granularity: 0, reciprocityP: 1 },
}

const emissive = (L: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(L, L, L) })
const lookForward: CameraPose = { position: new THREE.Vector3(0, 0, 0), quaternion: new THREE.Quaternion() }

type Extra = { samples?: number; longEdge?: number; setTime?: (t: number) => void; opts?: Record<string, unknown> }

function mkSpec(spec: DeepPartial<CameraSpec>): CameraSpec {
  return resolveSpec({ ...CLEAN, ...spec, lens: { ...CLEAN.lens, ...(spec.lens ?? {}) }, film: { ...CLEAN.film, ...(spec.film ?? {}) } } as DeepPartial<CameraSpec>)
}

function lum(l: Float32Array, i: number): number {
  return 0.2126 * l[i * 4] + 0.7152 * l[i * 4 + 1] + 0.0722 * l[i * 4 + 2]
}

function boxMean(r: CaptureResult, cx: number, cy: number, half: number): number {
  const l = r.latent!
  let s = 0
  let n = 0
  for (let y = Math.round(cy - half); y <= Math.round(cy + half); y++)
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      if (x < 0 || y < 0 || x >= r.width || y >= r.height) continue
      s += lum(l, y * r.width + x)
      n++
    }
  return s / Math.max(1, n)
}

function sumAll(r: CaptureResult): number {
  let s = 0
  for (let i = 0; i < r.width * r.height; i++) s += lum(r.latent!, i)
  return s
}

function moments(r: CaptureResult, x0: number, y0: number, x1: number, y1: number, thresh = 0): { cx: number; cy: number; m2: number; sum: number } {
  const l = r.latent!
  let s = 0
  let sx = 0
  let sy = 0
  for (let y = Math.max(0, y0); y < Math.min(r.height, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(r.width, x1); x++) {
      const v = lum(l, y * r.width + x)
      if (v <= thresh) continue
      s += v
      sx += v * (x + 0.5)
      sy += v * (y + 0.5)
    }
  const cx = sx / s
  const cy = sy / s
  let m2 = 0
  for (let y = Math.max(0, y0); y < Math.min(r.height, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(r.width, x1); x++) {
      const v = lum(l, y * r.width + x)
      if (v <= thresh) continue
      m2 += v * ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)
    }
  return { cx, cy, m2: m2 / s, sum: s }
}

function hashLatent(a: Float32Array): number {
  const u = new Uint32Array(a.buffer, a.byteOffset, a.length)
  let h = 2166136261
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0
  return h
}

class Runner {
  readonly out: Check[] = []
  constructor(readonly photo: PhotoRenderer) {}

  async shoot(scene: THREE.Scene, spec: DeepPartial<CameraSpec>, extra: Extra = {}): Promise<CaptureResult> {
    return this.photo.capture({ scene, setTime: extra.setTime }, mkSpec(spec), {
      pose: lookForward, samples: extra.samples ?? 16, longEdge: extra.longEdge ?? 512, sliceMs: Infinity, grain: false, flare: false, seed: 7, ...(extra.opts ?? {}),
    })
  }

  near(group: string, name: string, expected: number, measured: number, tol: number, unit = '', note = ''): void {
    const pass = Number.isFinite(measured) && Math.abs(measured - expected) <= tol * Math.max(1e-9, Math.abs(expected))
    this.out.push({ group, name, value: `${measured.toFixed(4)}${unit ? ' ' + unit : ''}`, expect: `${expected.toFixed(4)} ±${(tol * 100).toFixed(1)}%${note ? ' ' + note : ''}`, pass })
  }

  range(group: string, name: string, v: number, lo: number, hi: number, unit = ''): void {
    this.out.push({ group, name, value: `${v.toFixed(4)}${unit ? ' ' + unit : ''}`, expect: `${lo}..${hi}`, pass: v >= lo && v <= hi })
  }

  flag(group: string, name: string, ok: boolean, value: string, expect: string): void {
    this.out.push({ group, name, value, expect, pass: ok })
  }
}

// ------------------------------------------------------------------ the groups

async function calibration(t: Runner): Promise<void> {
  const g = 'Calibration'
  const scene = new THREE.Scene()
  const card = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.18, 0.18, 0.18) }))
  card.position.z = -5
  scene.add(card)
  const sun = new THREE.DirectionalLight(0xffffff, 69813)
  sun.position.set(0, 0, 10)
  scene.add(sun, sun.target)
  const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 16, maxAperture: 2, shutter: 1 / 125, iso: 100, focusDistance: 5, shutterType: 'focal-plane', curtainTravel: 0.012 }
  const full = mkSpec(spec)
  const o = computeOptics(full)
  const L = (0.18 * 69813) / Math.PI
  const expected = L * xPerNit(full, o, full.shutter)
  const r = await t.shoot(scene, spec, { samples: 8 })
  t.near(g, 'sunny-16 grey card X on axis (focal-plane)', expected, boxMean(r, r.width / 2, r.height / 2, 4), 0.02, 'X', `(EV100 ${Math.log2((L * 100) / 12.5).toFixed(2)})`)
  const rv = await t.shoot(scene, { ...spec, lens: { naturalVignetting: 1 } }, { samples: 4 })
  const tanT = o.halfDiag / o.imageDistance
  t.near(g, 'natural vignetting corner/centre = cos^4', 1 / (1 + tanT * tanT) ** 2, boxMean(rv, 3, 3, 2) / boxMean(rv, rv.width / 2, rv.height / 2, 3), 0.03, 'ratio')
  const ra = await t.shoot(scene, { ...spec, shutterType: 'leaf', leafRamp: 0, shutter: 1 / 250 }, { samples: 4 })
  const rb = await t.shoot(scene, { ...spec, shutterType: 'leaf', leafRamp: 0, shutter: 1 / 125 }, { samples: 4 })
  t.near(g, 'linearity X(1/125) / X(1/250)', 2, boxMean(rb, rb.width / 2, rb.height / 2, 4) / boxMean(ra, ra.width / 2, ra.height / 2, 4), 0.01, 'ratio')
  const open = { blades: 0, curvature: 1, rotation: 0 }
  const wide = await t.shoot(scene, { ...spec, shutterType: 'leaf', leafRamp: 0.0015, shutter: 1 / 500, fNumber: 2, aperture: open }, { samples: 48 })
  const tight = await t.shoot(scene, { ...spec, shutterType: 'leaf', leafRamp: 0.0015, shutter: 1 / 500, fNumber: 16, aperture: open }, { samples: 48 })
  t.near(g, 'leaf efficiency f/2 at 1/500', (1 / 500 + 0.0015 * (1 - 4 / 3)) * 500, wide.meta.exposure.shutterEfficiency, 0.01, 't_eff/t')
  t.near(g, 'leaf efficiency f/16 at 1/500', (1 / 500 + 0.0015 * (1 - (4 / 3) * (2 / 16))) * 500, tight.meta.exposure.shutterEfficiency, 0.01, 't_eff/t')
  t.near(g, 'leaf image X ratio f/16 vs f/2', (tight.meta.exposure.effectiveTime / wide.meta.exposure.effectiveTime) * (2 * 2) / (16 * 16),
    boxMean(tight, tight.width / 2, tight.height / 2, 4) / boxMean(wide, wide.width / 2, wide.height / 2, 4), 0.01, 'ratio')
  const k = 0.6
  const vspec: DeepPartial<CameraSpec> = { ...spec, fNumber: 2, maxAperture: 2, shutter: 1 / 2000, shutterType: 'focal-plane', curtainTravel: 0.012, aperture: open, lens: { vignetting: k } }
  const rvig = await t.shoot(scene, vspec, { samples: 24 })
  const pitch = 36 / rvig.width
  const field = Math.hypot((rvig.width / 2 - 3.5) * pitch, (rvig.height / 2 - 3.5) * pitch) / o.halfDiag
  const d = k * field
  const lensArea = (2 * Math.acos(d / 2) - (d / 2) * Math.sqrt(4 - d * d)) / Math.PI
  t.near(g, 'mechanical vignetting (cat-eye) corner/centre', lensArea, boxMean(rvig, 3, 3, 0) / boxMean(rvig, rvig.width / 2, rvig.height / 2, 3), 0.06, 'ratio')
  const rows: number[] = []
  for (let y = Math.round(rvig.height * 0.3); y < Math.round(rvig.height * 0.7); y++) {
    let sm = 0
    for (let x = Math.round(rvig.width * 0.45); x < Math.round(rvig.width * 0.55); x++) sm += lum(rvig.latent!, y * rvig.width + x)
    rows.push(sm)
  }
  const mean = rows.reduce((a, b) => a + b, 0) / rows.length
  let acc2 = 0
  let nres = 0
  for (let i = 4; i < rows.length - 4; i++) {
    let loc = 0
    for (let j = -4; j <= 4; j++) if (j) loc += rows[i + j]
    loc /= 8
    acc2 += (rows[i] - loc) ** 2
    nres++
  }
  t.range(g, 'row banding, focal-plane 1/2000 with vignetting (high-passed row CV)', Math.sqrt(acc2 / nres) / mean, 0, 0.006)
  card.geometry.dispose()
}

async function geometry(t: Runner): Promise<void> {
  const g = 'Geometry'
  for (const [d, s, N, blades] of [[1, 4, 1.4, 0], [8, 2, 2, 6]] as [number, number, number, number][]) {
    const scene = new THREE.Scene()
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0006 * d, 8, 6), emissive(1e6))
    dot.position.set(0, 0, -d)
    scene.add(dot)
    const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: N, maxAperture: N, focusDistance: s, shutter: 1 / 125, shutterType: 'leaf', leafRamp: 0, aperture: { blades, rotation: 0, curvature: 0 } }
    const r = await t.shoot(scene, spec, { samples: 128, longEdge: 768 })
    const pitch = 36 / r.width
    const expected = blurCircleMm(mkSpec(spec), d) / pitch
    const m = moments(r, 0, 0, r.width, r.height, 0)
    t.near(g, `blur disc d=${d} m, focus ${s} m, f/${N}${blades ? ` (${blades} blades)` : ''}`, expected, 2 * Math.sqrt(2 * m.m2), 0.08, 'px')
  }
  for (const [f, fmt] of [[50, { width: 36, height: 24 }], [28, { width: 56, height: 56 }]] as [number, { width: number; height: number }][]) {
    const scene = new THREE.Scene()
    const th = (15 * Math.PI) / 180
    for (const sgn of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), emissive(1e4))
      p.position.set(Math.sin(th) * 200 * sgn, 0, -Math.cos(th) * 200)
      scene.add(p)
    }
    const r = await t.shoot(scene, { focalLength: f, format: fmt, fNumber: 8, focusDistance: Infinity, shutterType: 'leaf', leafRamp: 0 }, { samples: 4, longEdge: 768 })
    const left = moments(r, 0, 0, r.width / 2, r.height)
    const right = moments(r, r.width / 2, 0, r.width, r.height)
    t.near(g, `FOV: ${f} mm on ${fmt.width}x${fmt.height}, ±15° separation`, (2 * f * Math.tan(th)) / (fmt.width / r.width), right.cx - left.cx, 0.006, 'px')
  }
}

async function motion(t: Runner): Promise<void> {
  const g = 'Motion'
  const v = 20
  const dist = 5
  const scene = new THREE.Scene()
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 6, 0.02), emissive(5000))
  bar.position.z = -dist
  scene.add(bar)
  const setTime = (tt: number) => {
    bar.position.x = -0.12 + v * tt
  }
  for (const [type, Tc] of [['focal-plane', 0.012], ['leaf', 0]] as ['focal-plane' | 'leaf', number][]) {
    const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 8, focusDistance: dist, shutter: 1 / 4000, shutterType: type, curtainTravel: Tc, curtainDirection: 'up', leafRamp: 0 }
    const r = await t.shoot(scene, spec, { samples: 12, longEdge: 768, setTime })
    const o = computeOptics(mkSpec(spec))
    const pitch = 36 / r.width
    const scale = o.imageDistance / (dist * 1000)
    const top = moments(r, 0, Math.round(r.height * 0.08), r.width, Math.round(r.height * 0.12))
    const bot = moments(r, 0, Math.round(r.height * 0.88), r.width, Math.round(r.height * 0.92))
    const measured = top.cx - bot.cx
    if (type === 'leaf') t.flag(g, 'leaf shutter does not skew a moving bar', Math.abs(measured) < 1, `${measured.toFixed(2)} px`, '|skew| < 1 px')
    else t.near(g, 'focal-plane skew: bar at 20 m/s, 1/4000, 12 ms travel', (v * 1000 * Tc * 0.8 * scale) / pitch, measured, 0.05, 'px')
  }
  const v2 = 2
  const scene2 = new THREE.Scene()
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 6, 0.01), emissive(5000))
  bar2.position.z = -dist
  scene2.add(bar2)
  const spec2: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 8, focusDistance: dist, shutter: 1 / 30, shutterType: 'leaf', leafRamp: 0 }
  const r2 = await t.shoot(scene2, spec2, { samples: 48, longEdge: 768, setTime: (tt) => (bar2.position.x = -v2 / 60 + v2 * tt) })
  const o2 = computeOptics(mkSpec(spec2))
  const expected = (v2 * (1 / 30) * 1000 * (o2.imageDistance / (dist * 1000))) / (36 / r2.width)
  const yMid = Math.round(r2.height / 2)
  const prof = new Float32Array(r2.width)
  for (let y = yMid - 5; y <= yMid + 5; y++) for (let x = 0; x < r2.width; x++) prof[x] += lum(r2.latent!, y * r2.width + x)
  let mx = 0
  for (const p of prof) mx = Math.max(mx, p)
  let first = -1
  let last = -1
  for (let x = 0; x < r2.width; x++) if (prof[x] >= mx / 2) {
    if (first < 0) first = x
    last = x
  }
  t.near(g, 'motion blur: bar 2 m/s at 5 m, 1/30 s (FWHM)', expected, last - first + 1, 0.1, 'px')
}

async function flash(t: Runner): Promise<void> {
  const g = 'Flash'
  const scene = new THREE.Scene()
  const card = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.18, 0.18, 0.18) }))
  card.position.z = -3
  scene.add(card)
  const fl = new THREE.PointLight(0xffffff, 0, 0, 2)
  scene.add(fl)
  const GN = 24
  const tau = 1 / 1000
  const I = (2.006 * GN * GN) / tau
  const ps = {
    scene,
    setFlash: (on: boolean, eye: { position: THREE.Vector3 }) => {
      fl.position.copy(eye.position)
      fl.intensity = on ? I : 0
    },
  }
  const base: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: GN / 3, maxAperture: 2, focusDistance: 3, iso: 100 }
  const cap = (o: DeepPartial<CameraSpec>, extra: Record<string, unknown> = {}) =>
    t.photo.capture(ps, mkSpec({ ...base, ...o }), { pose: lookForward, samples: 12, longEdge: 384, sliceMs: Infinity, grain: false, flare: false, seed: 3, flash: { duration: tau }, ...extra })
  const spec60 = mkSpec({ ...base, shutter: 1 / 60, shutterType: 'focal-plane', curtainTravel: 0.012 })
  const L = (0.18 * I) / (3 * 3 * Math.PI)
  const expected = L * xPerNit(spec60, computeOptics(spec60), tau)
  const r60 = await cap({ shutter: 1 / 60, shutterType: 'focal-plane', curtainTravel: 0.012 })
  t.near(g, 'GN 24 at 3 m, f/8, 1/60: centre X', expected, boxMean(r60, r60.width / 2, r60.height / 2, 3), 0.04, 'X')
  const r1k = await cap({ shutter: 1 / 1000, shutterType: 'focal-plane', curtainTravel: 0.012, curtainDirection: 'up' })
  let lit = 0
  let litExp = 0
  const xc = Math.round(r1k.width / 2)
  for (let y = 0; y < r1k.height; y++) {
    if (lum(r1k.latent!, y * r1k.width + xc) > expected * 0.25) lit++
    const aRow = 1 - (y + 0.5) / r1k.height
    const ov = Math.max(0, Math.min(0.012 + tau, aRow * 0.012 + 1 / 1000) - Math.max(0.012, aRow * 0.012)) / tau
    if (ov > 0.25) litExp++
  }
  t.near(g, 'above X-sync: lit band fraction (1/1000, 12 ms slit)', litExp / r1k.height, lit / r1k.height, 0.08, 'frame')
  const rl = await cap({ shutter: 1 / 500, shutterType: 'leaf', leafRamp: 0.001 })
  const tanC = Math.hypot((rl.width / 2 - 4.5) * (36 / rl.width), (rl.height / 2 - 4.5) * (36 / rl.width)) / computeOptics(mkSpec({ ...base, shutter: 1 / 500 })).imageDistance
  t.near(g, 'leaf at 1/500: corner/centre = cos^3 (whole frame lit)', Math.pow(1 / (1 + tanC * tanC), 1.5), boxMean(rl, 4, 4, 2) / boxMean(rl, rl.width / 2, rl.height / 2, 2), 0.04, 'ratio')
  const a = await cap({ shutter: 1 / 60, shutterType: 'focal-plane' }, { keepPreGrain: true })
  const b = await cap({ shutter: 1 / 60, shutterType: 'focal-plane' }, { baseTarget: a.preGrainTarget!, keepPreGrain: false })
  a.preGrainTarget?.dispose()
  t.near(g, 'double exposure X(a+b) / X(a)', 2, boxMean(b, b.width / 2, b.height / 2, 3) / boxMean(a, a.width / 2, a.height / 2, 3), 0.012, 'ratio')
  card.geometry.dispose()
}

async function determinism(t: Runner): Promise<void> {
  const g = 'Determinism'
  const scene = new THREE.Scene()
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), emissive(3000))
  dot.position.set(0.1, 0, -2)
  scene.add(dot)
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), emissive(300))
  bg.position.z = -6
  scene.add(bg)
  const run = (seed: number) =>
    t.photo.capture({ scene }, mkSpec({ focalLength: 50, fNumber: 2, maxAperture: 2, focusDistance: 4, shutter: 1 / 60, shutterType: 'leaf', film: { granularity: 1, grainSize: 9, color: true } }),
      { pose: lookForward, samples: 10, longEdge: 192, sliceMs: Infinity, seed })
  const a = await run(5)
  const b = await run(5)
  const c = await run(6)
  const ha = hashLatent(a.latent!)
  t.flag(g, 'same seed gives the same latent hash', ha === hashLatent(b.latent!), ha.toString(16), hashLatent(b.latent!).toString(16))
  t.flag(g, 'a different seed changes the grain', ha !== hashLatent(c.latent!), hashLatent(c.latent!).toString(16), 'differs')
}

async function additions(t: Runner): Promise<void> {
  const g = 'radianceScale'
  const open = { blades: 0, curvature: 1, rotation: 0 }
  // radianceScale: the same photograph from a kcd/m^2 scene
  {
    const mk = (L: number) => {
      const s = new THREE.Scene()
      const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), emissive(L))
      m.position.z = -5
      s.add(m)
      return s
    }
    const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 11, shutter: 1 / 125, iso: 100, focusDistance: 5, shutterType: 'leaf', leafRamp: 0 }
    const a = await t.shoot(mk(4000), spec, { samples: 4, longEdge: 256 })
    const b = await t.shoot(mk(4), spec, { samples: 4, longEdge: 256, opts: { radianceScale: 1000 } })
    t.near(g, 'kcd/m² scene with radianceScale 1000 equals the nits scene', boxMean(a, 128, 96, 4), boxMean(b, 128, 96, 4), 0.003, 'X')
  }
  // tilt: a ground plane brought into focus from near to far
  {
    const gt = 'Tilt'
    const h = 1.5
    const theta = (30 * Math.PI) / 180
    const f = 100 // 100 mm on 36x24: +-6.8 degrees vertically, so the ground from 2.1 m to 3.4 m is in frame
    const s = h / Math.sin(theta)
    const alpha = Math.atan((f / 1000) * Math.cos(theta) / (h + (f / 1000) * Math.sin(theta)))
    const scene = new THREE.Scene()
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), emissive(8))
    ground.rotation.x = -Math.PI / 2
    scene.add(ground)
    const dots: THREE.Mesh[] = []
    // horizontal distances along the ground line (relative to the camera at height h)
    for (const [dx, lat] of [[2.1, -0.3], [s * Math.cos(theta), 0.05], [3.3, 0.3]] as [number, number][]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0005 * dx, 8, 6), emissive(2e6))
      dot.position.set(lat, 0.0005 * dx, -dx)
      scene.add(dot)
      dots.push(dot)
    }
    const cam: CameraPose = { position: new THREE.Vector3(0, h, 0), quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -theta) }
    const spec: DeepPartial<CameraSpec> = { focalLength: f, fNumber: 1.4, maxAperture: 1.4, focusDistance: s, shutter: 1 / 125, shutterType: 'leaf', leafRamp: 0, aperture: open, format: { width: 36, height: 24 } }
    const blur = async (deg: number): Promise<number[]> => {
      const r = await t.photo.capture({ scene }, mkSpec(spec), { pose: cam, samples: 64, longEdge: 768, sliceMs: Infinity, grain: false, flare: false, seed: 9, tilt: { deg }, smoothBokeh: true })
      // locate each dot by its projection and measure the second-moment diameter in a window around it
      const o = computeOptics(mkSpec(spec))
      const pitch = 36 / r.width
      const inv = new THREE.Quaternion().copy(cam.quaternion).invert()
      return dots.map((dot) => {
        const p = dot.position.clone().sub(cam.position).applyQuaternion(inv)
        const px = ((p.x / -p.z) * o.imageDistance) / pitch + r.width / 2
        const py = r.height / 2 - ((p.y / -p.z) * o.imageDistance) / pitch
        const win = 40
        const m = moments(r, Math.round(px - win), Math.round(py - win), Math.round(px + win), Math.round(py + win), 0.4)
        return 2 * Math.sqrt(2 * m.m2)
      })
    }
    const flat = await blur(0)
    const tilted = await blur((alpha * 180) / Math.PI)
    t.flag(gt, `tilt ${((alpha * 180) / Math.PI).toFixed(2)}° keeps near, middle and far ground dots sharp`, Math.max(...tilted) < 4, tilted.map((x) => x.toFixed(1)).join(', ') + ' px', 'each < 4 px')
    t.flag(gt, 'without tilt the near and far dots are blurred', flat[0] > 6 && flat[2] > 6, flat.map((x) => x.toFixed(1)).join(', ') + ' px', 'near, far > 6 px')
  }
  // shutter profile
  {
    const gp = 'ShutterProfile'
    const scene = new THREE.Scene()
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), emissive(3000))
    wall.position.z = -5
    scene.add(wall)
    const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 8, shutter: 1 / 250, iso: 100, focusDistance: 5, shutterType: 'leaf', leafRamp: 0 }
    const ref = await t.shoot(scene, spec, { samples: 6, longEdge: 256 })
    const box = await t.shoot(scene, { ...spec, shutter: 1 / 1000 }, { samples: 6, longEdge: 256, opts: { shutterProfile: { span: 1 / 250, open: () => 1 } } })
    t.near(gp, 'a rectangular profile of span 1/250 matches a 1/250 leaf shutter', boxMean(ref, 128, 96, 4), boxMean(box, 128, 96, 4), 0.02, 'X')
    // a slit rolling top to bottom skews a moving bar like a focal-plane shutter
    const v = 20
    const dist = 5
    const bars = new THREE.Scene()
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 6, 0.02), emissive(5000))
    bar.position.z = -dist
    bars.add(bar)
    const Tc = 0.012
    const tShut = 1 / 4000
    const sp: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 8, focusDistance: dist, shutterType: 'leaf', leafRamp: 0, shutter: tShut }
    const prof = {
      span: Tc + tShut,
      // 'up': row coordinate a = 0 at the bottom opens first; v from the top
      open: (_u: number, vv: number, tRel: number, dt: number) => {
        const a = 1 - vv
        const o0 = a * Tc
        const o1 = o0 + tShut
        return Math.max(0, Math.min(tRel + dt, o1) - Math.max(tRel, o0)) / dt
      },
    }
    const r = await t.shoot(bars, sp, { samples: 12, longEdge: 512, setTime: (tt) => (bar.position.x = -0.12 + v * tt), opts: { shutterProfile: prof, order: 'chronological' } })
    const o = computeOptics(mkSpec(sp))
    const top = moments(r, 0, Math.round(r.height * 0.08), r.width, Math.round(r.height * 0.12))
    const bot = moments(r, 0, Math.round(r.height * 0.88), r.width, Math.round(r.height * 0.92))
    t.near(gp, 'a rolling-slit profile skews the bar like a curtain', (v * 1000 * Tc * 0.8 * (o.imageDistance / (dist * 1000))) / (36 / r.width), top.cx - bot.cx, 0.12, 'px')
  }
  // spectral and layers
  {
    const gs = 'Spectral and layers'
    const scene = new THREE.Scene()
    const red = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3000, 0, 0) }))
    red.position.z = -5
    scene.add(red)
    const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 8, shutter: 1 / 250, iso: 100, focusDistance: 5, shutterType: 'leaf', leafRamp: 0 }
    const colour = await t.shoot(scene, spec, { samples: 3, longEdge: 192 })
    const mono = await t.shoot(scene, { ...spec, film: { color: false } }, { samples: 3, longEdge: 192 })
    const ortho = await t.shoot(scene, spec, { samples: 3, longEdge: 192, opts: { spectral: [[0, 0.35, 0.65], [0, 0.35, 0.65], [0, 0.35, 0.65]] } })
    const px = (r: CaptureResult) => [r.latent![(96 * r.width + 96) * 4], r.latent![(96 * r.width + 96) * 4 + 1], r.latent![(96 * r.width + 96) * 4 + 2]]
    const c = px(colour)
    const m = px(mono)
    const o = px(ortho)
    t.flag(gs, 'colour film keeps a red target red', c[0] > 1 && c[1] < 1e-3 && c[2] < 1e-3, c.map((x) => x.toFixed(3)).join(' '), 'R > 1, G, B ≈ 0')
    t.near(gs, 'mono film: every channel carries the pan response (0.30 of red)', 0.3 * c[0], m[1], 0.01, 'X')
    t.flag(gs, 'ortho matrix renders red as black', o[0] + o[1] + o[2] < 1e-3, o.map((x) => x.toFixed(4)).join(' '), '≈ 0')
    const hidden = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), emissive(3000))
    hidden.position.z = -4
    hidden.layers.set(2)
    scene.add(hidden)
    const withDefault = await t.shoot(scene, spec, { samples: 3, longEdge: 192 })
    const withLayer = await t.shoot(scene, spec, { samples: 3, longEdge: 192, opts: { layers: 1 | 4 } })
    t.near(gs, 'layer 2 is invisible by default', c[0], px(withDefault)[0], 0.01, 'X')
    t.flag(gs, 'layers: 1|4 shows it', boxMean(withLayer, 96, 96, 2) > 1.5 * boxMean(withDefault, 96, 96, 2), boxMean(withLayer, 96, 96, 2).toFixed(2), '> 1.5x')
  }
  // emitters: a disc of the same energy as a defocused emissive sphere
  {
    const ge = 'Emitters'
    const d = 1.2
    const rho = 0.004
    const L = 2e5
    const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 1.8, maxAperture: 1.8, focusDistance: 4, shutter: 1 / 125, iso: 100, shutterType: 'leaf', leafRamp: 0, aperture: { blades: 6, rotation: 0, curvature: 0 } }
    const sphereScene = new THREE.Scene()
    const sph = new THREE.Mesh(new THREE.SphereGeometry(rho, 16, 12), emissive(L))
    sph.position.set(0.05, 0.02, -d)
    sphereScene.add(sph)
    const empty = new THREE.Scene()
    const a = await t.shoot(sphereScene, spec, { samples: 160, longEdge: 512, opts: { smoothBokeh: false } })
    const I = L * Math.PI * rho * rho // luminous intensity of a Lambertian disc seen face on
    const b = await t.shoot(empty, spec, { samples: 12, longEdge: 512, opts: { emitters: (_t: number, out: { x: number; y: number; z: number; rgb: [number, number, number] }[]) => { out[0] = { x: 0.05, y: 0.02, z: -d, rgb: [I, I, I] }; return 1 } } })
    t.near(ge, 'a disc emitter carries the same energy as the sphere it replaces', sumAll(a), sumAll(b), 0.12, 'ΣX')
    const ma = moments(a, 0, 0, a.width, a.height)
    const mb = moments(b, 0, 0, b.width, b.height)
    t.near(ge, 'and sits on the same centroid (px)', Math.hypot(ma.cx, ma.cy), Math.hypot(mb.cx, mb.cy), 0.01, 'px')
    t.near(ge, 'and has the same blur size (rms radius)', Math.sqrt(ma.m2), Math.sqrt(mb.m2), 0.12, 'px')
  }
  // incremental exposure matches capture with the same samples
  {
    const gi = 'Incremental exposure'
    const scene = new THREE.Scene()
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), emissive(200))
    wall.position.z = -8
    scene.add(wall)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), emissive(8e4))
    lamp.position.set(0.2, 0.05, -1.5)
    scene.add(lamp)
    const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 2.8, maxAperture: 2.8, focusDistance: 3, shutter: 1 / 15, iso: 100, shutterType: 'leaf', leafRamp: 0 }
    const N = 30
    const cap = await t.photo.capture({ scene }, mkSpec(spec), { pose: lookForward, samples: N, longEdge: 320, sliceMs: Infinity, grain: false, flare: false, seed: 4, order: 'chronological' })
    const ex = t.photo.begin({ scene }, mkSpec(spec), { pose: lookForward, longEdge: 320, grain: false, flare: false, seed: 4, expectedSamples: N })
    for (let k = 0; k < N; k++) ex.addSample({ time: (k * (1 / 15)) / N, tRel: (k * (1 / 15)) / N, weightS: 1 / 15 / N })
    const inc = await ex.finish()
    t.near(gi, '30 addSample calls match capture(samples 30): mean X', cap.meta.stats!.meanX, inc.meta.stats!.meanX, 0.02, 'X')
    let diff = 0
    let tot = 0
    for (let i = 0; i < cap.width * cap.height; i++) {
      diff += Math.abs(lum(cap.latent!, i) - lum(inc.latent!, i))
      tot += lum(cap.latent!, i)
    }
    t.flag(gi, '... and pixel for pixel (mean absolute difference / mean)', diff / tot < 0.03, (diff / tot).toFixed(4), '< 0.03')
    t.flag(gi, 'samples and exposed seconds are tracked', ex.samples === N && Math.abs(ex.exposedSeconds - 1 / 15) < 1e-9, `${ex.samples}, ${ex.exposedSeconds.toFixed(5)} s`, `${N}, 0.06667 s`)
    // a 4 s exposure of the same scene is brighter by 4 s / (1/15 s), less reciprocity
    const ex2 = t.photo.begin({ scene }, mkSpec({ ...spec, film: { reciprocityP: 1 } }), { pose: lookForward, longEdge: 192, grain: false, flare: false, seed: 4, expectedSamples: 8 })
    for (let k = 0; k < 8; k++) ex2.addSample({ time: k * 0.5, tRel: k * 0.5, weightS: 0.5 })
    const long = await ex2.finish()
    const ref = await t.shoot(scene, { ...spec, film: { reciprocityP: 1 } }, { samples: 8, longEdge: 192 })
    t.near(gi, 'a 4 s exposure is 60x the 1/15 s one (reciprocity off)', 60, long.meta.stats!.meanX / ref.meta.stats!.meanX, 0.03, 'ratio')
  }
  // latent encodings
  {
    const gl = 'Latent encodings'
    const w = 48
    const h = 32
    const X = new Float32Array(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      const s = -9 + (15.5 * (i % w)) / w
      X[i * 4] = Math.pow(2, s)
      X[i * 4 + 1] = Math.pow(2, s + 0.5)
      X[i * 4 + 2] = Math.pow(2, s - 0.5)
      X[i * 4 + 3] = 1
    }
    const o = { channels: 3 as const, minStops: -10, maxStops: 6.6 }
    const bytes = encodeLog2(X, w, h, o)
    const back = decodeLog2(bytes, w, h, o)
    let worst = 0
    for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(Math.log2(back[i * 3 + c] / X[i * 4 + c])))
    t.range(gl, 'log2 round trip, worst error (stops)', worst, 0, 0.09)
    const blob = await bytesToPNG(bytes, w, h, 3)
    const png = await pngToBytes(blob, 3)
    let same = png.w === w && png.h === h && png.bytes.length === bytes.length
    if (same) for (let i = 0; i < bytes.length; i++) if (png.bytes[i] !== bytes[i]) { same = false; break }
    t.flag(gl, 'PNG round trip is byte exact (colour)', same, `${blob.size} bytes`, 'identical')
    const mono = encodeLog2(X, w, h, { ...o, channels: 1 })
    const pm = await pngToBytes(await bytesToPNG(mono, w, h, 1), 1)
    let same1 = pm.bytes.length === mono.length
    if (same1) for (let i = 0; i < mono.length; i++) if (pm.bytes[i] !== mono[i]) { same1 = false; break }
    t.flag(gl, 'PNG round trip is byte exact (one channel)', same1, `${mono.length} px`, 'identical')
  }
}

async function finder(t: Runner, renderer: THREE.WebGLRenderer): Promise<void> {
  const g = 'Finder'
  const scene = new THREE.Scene()
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), emissive(4000))
  wall.position.z = -5
  scene.add(wall)
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 0.1), emissive(800))
  post.position.set(0, 0, -1)
  scene.add(post)
  const spec = mkSpec({ focalLength: 50, fNumber: 2, maxAperture: 2, shutter: 1 / 250, iso: 100, focusDistance: 5 })
  const cam = new THREE.PerspectiveCamera(2 * Math.atan(12 / 50) * (180 / Math.PI), 1.5, 0.05, 100)
  const fp = new FinderPreview(renderer, { longEdge: 256, taps: 12, maxCocPx: 24 })
  const rt = new THREE.WebGLRenderTarget(256, 171, { depthBuffer: false })
  const metered = Math.log2((4000 * 100) / 12.5)
  fp.render(scene, cam, spec, { target: rt, exposureEV100: metered })
  const px = new Uint8Array(4 * 256 * 171)
  renderer.readRenderTargetPixels(rt, 0, 0, 256, 171, px)
  const at = (x: number, y: number): number => px[(y * 256 + x) * 4]
  t.range(g, 'a metered sunlit wall shows as mid grey (18% -> sRGB 117)', at(200, 85), 108, 126, '/255')
  // the post (1 m) is far inside the focus distance (5 m) at f/2: its edge is a wide ramp, not a step
  const lo = at(128, 85)
  const hi = at(230, 85)
  let x25 = -1
  let x75 = -1
  for (let x = 128; x < 230; x++) {
    const v = (at(x, 85) - lo) / Math.max(1, hi - lo)
    if (x25 < 0 && v > 0.25) x25 = x
    if (x75 < 0 && v > 0.75) x75 = x
  }
  t.flag(g, 'the near post is out of focus (its edge is a wide ramp)', hi > lo + 20 && x75 - x25 >= 4, `${x75 - x25} px, post ${lo} wall ${hi}`, 'ramp ≥ 4 px')
  fp.dispose()
  const fp2 = new FinderPreview(renderer, { longEdge: 128, taps: 8, maxCocPx: 12 })
  const bare = new THREE.Scene()
  const wall2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), emissive(4000))
  wall2.position.z = -5
  bare.add(wall2)
  fp2.render(bare, cam, spec, { target: rt })
  t.near(g, 'centre-weighted meter reads a plain wall (EV100)', metered, fp2.meterEV100(), 0.01, 'EV')
  const fp3 = new FinderPreview(renderer, { longEdge: 128, taps: 8, maxCocPx: 12 })
  const kcd = new THREE.Scene()
  const wall3 = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), emissive(4))
  wall3.position.z = -5
  kcd.add(wall3)
  fp3.render(kcd, cam, spec, { target: rt, radianceScale: 1000 })
  t.near(g, 'radianceScale carries into the meter (kcd/m² scene)', metered, fp3.meterEV100(), 0.01, 'EV')
  fp2.dispose()
  fp3.dispose()
  rt.dispose()
}

async function bridge(t: Runner): Promise<void> {
  const g = 'Optics bridge'
  const optics = await import('@shared/optics')
  const lens = optics.loadPreset('portrait')
  const prof = optics.computeProfile(lens, { w: 36, h: 24 }, 'full')
  const patch = photoSpecFromProfile(prof)
  const spec = mkSpec(patch)
  t.near(g, 'focal length comes from the profile', prof.efl, spec.focalLength, 1e-6, 'mm')
  t.flag(g, 'every lens number is finite and in range', [spec.lens.distortionK1, spec.lens.lateralCA, spec.lens.longitudinalCA, spec.lens.fieldCurvature, spec.lens.vignetting, spec.lens.glow, spec.lens.ghosts].every(Number.isFinite) && spec.lens.vignetting >= 0, JSON.stringify({ k1: +spec.lens.distortionK1.toFixed(3), vig: +spec.lens.vignetting.toFixed(2), glow: +spec.lens.glow.toFixed(3) }), 'finite')
  t.flag(g, 'the pupil mask became the aperture', !!spec.aperture.mask && spec.aperture.mask.size === 64, String(spec.aperture.mask?.size), '64')
  const scene = new THREE.Scene()
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), emissive(5e5))
  lamp.position.set(0, 0, -3)
  scene.add(lamp)
  const r = await t.photo.capture({ scene }, spec, { pose: lookForward, samples: 8, longEdge: 192, sliceMs: Infinity, seed: 2 })
  t.flag(g, 'a capture through the profile renders', (r.meta.stats?.maxX ?? 0) > 0, (r.meta.stats?.maxX ?? 0).toExponential(2), '> 0')
}

const GROUPS: [string, (t: Runner, r: THREE.WebGLRenderer) => Promise<void>][] = [
  ['calibration', calibration],
  ['geometry', geometry],
  ['motion', motion],
  ['flash', flash],
  ['determinism', determinism],
  ['additions', additions],
  ['finder', finder],
  ['bridge', bridge],
]

/** Runs the checks (needs WebGL2). Group names: calibration, geometry, motion, flash, determinism, additions, finder, bridge. */
export async function selftest(o: SelfTestOptions = {}): Promise<Check[]> {
  let renderer = o.renderer ?? null
  let owned = false
  if (!renderer) {
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : undefined
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    renderer.setSize(64, 64, false)
    owned = true
  }
  const photo = new PhotoRenderer(renderer)
  const t = new Runner(photo)
  try {
    for (const [name, fn] of GROUPS) {
      if (o.only && !o.only.includes(name)) continue
      const n0 = t.out.length
      const t0 = performance.now()
      try {
        await fn(t, renderer)
      } catch (e) {
        t.out.push({ group: name, name: 'group ran without throwing', value: String(e instanceof Error ? e.message : e), expect: 'no error', pass: false })
      }
      o.log?.(`${name}: ${t.out.slice(n0).filter((c) => c.pass).length}/${t.out.length - n0} in ${Math.round(performance.now() - t0)} ms`)
    }
  } finally {
    photo.dispose()
    if (owned) renderer.dispose()
  }
  return t.out
}
