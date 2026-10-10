// Low-discrepancy sampling, aperture-shape sampling and the shutter plan.
// Pure TS (no three.js). The plan decides which sub-frames get rendered, at what time,
// through which point of the pupil, and how much each one weighs.

import type { ApertureShape, CameraSpec, CurtainDirection, ShutterType } from './spec.ts'

// ---------------------------------------------------------------- sequences

const PLASTIC = 1.324717957244746
const A1 = 1 / PLASTIC
const A2 = 1 / (PLASTIC * PLASTIC)

/** R2 quasi-random sequence (Roberts 2018). Any contiguous run of indices is itself well spread. */
export function r2(i: number, ox = 0.5, oy = 0.5): [number, number] {
  return [fract(ox + A1 * i), fract(oy + A2 * i)]
}

/** radical inverse in base b (Halton component) */
export function halton(i: number, b: number): number {
  let f = 1
  let r = 0
  while (i > 0) {
    f /= b
    r += f * (i % b)
    i = Math.floor(i / b)
  }
  return r
}

/** mulberry32 PRNG */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fract(x: number): number {
  return x - Math.floor(x)
}

// ---------------------------------------------------------------- aperture

/** Is the point (x, y) in [-1,1]^2 inside the aperture shape? The shape is inscribed in the unit disc. */
export function insideAperture(x: number, y: number, a: ApertureShape): boolean {
  if (a.mask && a.mask.size > 0) {
    const n = a.mask.size
    const cx = Math.floor(((x + 1) / 2) * n)
    const cy = Math.floor(((1 - y) / 2) * n) // mask row 0 is the top
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return false
    return a.mask.data[cy * n + cx] > 0.5
  }
  const r2v = x * x + y * y
  if (r2v > 1) return false
  const n = Math.round(a.blades)
  if (n < 3 || a.curvature >= 1) return true
  const sector = (2 * Math.PI) / n
  let ang = Math.atan2(y, x) - (a.rotation * Math.PI) / 180
  ang = ((ang % sector) + sector) % sector - sector / 2
  const apothem = Math.cos(Math.PI / n)
  const ap = apothem + (1 - apothem) * Math.max(0, a.curvature) // rounded blades = polygon grown into the disc
  return Math.sqrt(r2v) * Math.cos(ang) <= ap
}

/** Fraction of the unit disc's bounding square covered by the shape, times 4 = area in normalised units. */
export function apertureArea(a: ApertureShape, grid = 192): number {
  let hit = 0
  for (let j = 0; j < grid; j++)
    for (let i = 0; i < grid; i++) {
      const x = ((i + 0.5) / grid) * 2 - 1
      const y = ((j + 0.5) / grid) * 2 - 1
      if (insideAperture(x, y, a)) hit++
    }
  return (hit / (grid * grid)) * 4
}

export interface ApertureSamples {
  /** xy pairs in "equal-area" units: the shape is scaled so its area equals the unit disc's (pi). */
  points: Float32Array
  /** largest radius among the points (equal-area units) */
  maxRadius: number
  /** shape area before rescaling (normalised units, unit disc = pi) */
  area: number
  /** number of R2 candidates consumed */
  tried: number
}

/**
 * `count` points uniformly covering the aperture shape, in R2 order (so any contiguous run is
 * well spread: important because a focal-plane row only sees a contiguous run of sub-frames).
 * Scaled to equal area so the f-number keeps its meaning (N = f / equivalent diameter).
 */
export function sampleAperture(a: ApertureShape, count: number, seed = 0): ApertureSamples {
  const area = apertureArea(a)
  const scale = Math.sqrt(Math.PI / Math.max(area, 1e-4))
  const rng = makeRng(seed * 7919 + 17)
  const ox = rng()
  const oy = rng()
  const pts = new Float32Array(count * 2)
  let k = 0
  let i = 0
  let maxR = 0
  const limit = count * 4000 + 1000
  while (k < count && i < limit) {
    const [u, v] = r2(i++, ox, oy)
    const x = u * 2 - 1
    const y = v * 2 - 1
    if (!insideAperture(x, y, a)) continue
    pts[k * 2] = x * scale
    pts[k * 2 + 1] = y * scale
    maxR = Math.max(maxR, Math.hypot(x, y) * scale)
    k++
  }
  // degenerate mask (nothing open): pinhole at the centre
  for (; k < count; k++) {
    pts[k * 2] = 0
    pts[k * 2 + 1] = 0
  }
  return { points: pts, maxRadius: maxR, area, tried: i }
}

// ---------------------------------------------------------------- shutter plan

export interface SubFrame {
  /** position in render order */
  order: number
  /** time bin index (chronological) */
  bin: number
  /** bin bounds, seconds after the shutter starts to open */
  t0: number
  t1: number
  /** the instant the scene is posed at for this sub-frame (inside [t0, t1]) */
  time: number
  /** pupil point in equal-area units (multiply by f/(2N) for mm) */
  lens: [number, number]
  /** sub-pixel jitter in [-0.5, 0.5] */
  jitter: [number, number]
  /** leaf / global: normalised weight w/Δ in [0, 1]. focal-plane: 1 (per-row weight is computed on the GPU) */
  weight: number
  /** curtain coordinate range a in [0, 1] (0 = first edge exposed) that receives light in this bin */
  rowMin: number
  rowMax: number
  /** two spare uniforms for the scene hook (area-light jitter etc.) */
  rand: [number, number]
  /** flash sub-frame: the scene is rendered flash-lit only and its energy is added on top */
  flash?: boolean
}

export interface ShutterPlan {
  type: ShutterType
  /** seconds from first light to last light */
  span: number
  /** bin width Δ, seconds */
  binWidth: number
  /** time-integral of the shutter's transmission averaged over the pupil, seconds (leaf efficiency lives here) */
  effectiveTime: number
  /** curtain travel and direction (focal-plane) */
  curtainTravel: number
  curtainDirection: CurtainDirection
  /** approximate number of sub-frames each pixel receives */
  samplesPerPixel: number
  subframes: SubFrame[]
  aperture: ApertureSamples
}

export interface PlanOptions {
  /** target sub-frames per pixel (the quality knob) */
  samples: number
  /** cap on total renders for focal-plane shutters (renders are scissored to the slit, so they are cheap) */
  maxRenders: number
  seed: number
  /**
   * 'blocked' (default): blocks of `blockSize` time-consecutive sub-frames, the blocks visited in a
   *   progressive (radical-inverse) order: previews fill evenly AND neighbouring renders are close in
   *   time, so a shadow map refreshed every few renders stays coherent.
   * 'progressive': fully permuted (best early previews, worst coherence).
   * 'chronological': the real curtain sweep.
   */
  order: 'blocked' | 'progressive' | 'chronological'
  blockSize?: number
}

/**
 * Build the sub-frame list.
 *
 * Leaf (global) shutter: K = samples bins tile [0, t + ramp]. The blades open linearly in radius over
 * `leafRamp`, so a pupil point at relative radius q (= rho / Rmax) is uncovered during
 * [q*ramp, span - q*ramp]. Each sub-frame's weight is the overlap of its bin with that window, which
 * reproduces leaf-shutter efficiency (stopped-down lenses get relatively more light at fast speeds).
 *
 * Focal-plane: a slit of width t (in time) crosses the gate in `curtainTravel`. Row a (0..1) is open
 * during [a*Tc, a*Tc + t]. K bins tile [0, Tc + t]; each bin only reaches rows whose window overlaps it,
 * so its render is scissored to that band. K is raised until every row sees ~`samples` bins.
 */
export function planShutter(spec: CameraSpec, opt: PlanOptions): ShutterPlan {
  const t = spec.shutter
  const rng = makeRng(opt.seed * 104729 + 3)
  const type = spec.shutterType
  let span: number
  let K: number
  const Tc = type === 'focal-plane' ? spec.curtainTravel : 0
  if (type === 'leaf') {
    span = t + spec.leafRamp
    K = Math.max(1, Math.round(opt.samples))
  } else {
    span = Tc + t
    const want = Math.ceil((opt.samples * span) / t)
    K = Math.max(Math.round(opt.samples), Math.min(want, Math.max(opt.samples, opt.maxRenders)))
  }
  const dt = span / K
  const aperture = sampleAperture(spec.aperture, K, opt.seed)
  const qScale = spec.maxAperture / spec.fNumber // equal-area pupil units -> fraction of Rmax
  const lensCount = aperture.points.length / 2
  const subs: SubFrame[] = []
  const jx0 = rng()
  const jy0 = rng()
  const tj0 = rng()
  const T = spec.leafRamp
  // leaf: a pupil point at relative radius q is uncovered during [q*T, span - q*T]
  const openTime = (q: number) => Math.max(0, span - 2 * Math.min(1, q) * T)
  for (let k = 0; k < K; k++) {
    const li = k % lensCount
    const lx = aperture.points[li * 2]
    const ly = aperture.points[li * 2 + 1]
    let t0 = k * dt
    let t1 = (k + 1) * dt
    let time = t0 + dt * fract(halton(k + 1, 5) + tj0) // stratified inside the bin
    let weight = 1
    let rowMin = 0
    let rowMax = 1
    if (type === 'leaf') {
      // importance sampling: put this pupil point's instant uniformly inside its own open window and
      // weight it by the window length. No sample is wasted on closed blades.
      const q = Math.hypot(lx, ly) * qScale
      const w = openTime(q)
      if (w <= 1e-12) continue
      const a = Math.min(1, q) * T
      time = a + w * fract(halton(k + 1, 5) + tj0)
      t0 = t1 = time
      weight = w / span
    } else if (Tc > 0) {
      rowMin = Math.max(0, (t0 - t) / Tc)
      rowMax = Math.min(1, t1 / Tc)
      if (rowMax <= rowMin) continue
    }
    subs.push({
      order: 0,
      bin: k,
      t0,
      t1,
      time: Math.min(t1, Math.max(t0, time)),
      lens: [lx, ly],
      jitter: [fract(halton(k + 1, 2) + jx0) - 0.5, fract(halton(k + 1, 3) + jy0) - 0.5],
      weight,
      rowMin,
      rowMax,
      rand: [rng(), rng()],
    })
  }
  let effectiveTime = t
  if (type === 'leaf') {
    // exact-enough pupil average of the open time (dense, independent of the render sample count)
    const dense = sampleAperture(spec.aperture, 4096, 991)
    let acc = 0
    for (let i = 0; i < 4096; i++) acc += openTime(Math.hypot(dense.points[i * 2], dense.points[i * 2 + 1]) * qScale)
    effectiveTime = acc / 4096
  }
  orderSubframes(subs, opt.order, opt.blockSize ?? 8)
  const spp = type === 'leaf' ? subs.length : Math.min(K, (K * t) / span + 1)
  return {
    type,
    span,
    binWidth: dt,
    effectiveTime,
    curtainTravel: Tc,
    curtainDirection: spec.curtainDirection,
    samplesPerPixel: spp,
    subframes: subs,
    aperture,
  }
}

/** Reorders sub-frames in place: 'progressive' (radical-inverse permutation), 'blocked' (blocks of consecutive sub-frames visited progressively) or 'chronological'. Sets `order`. */
export function orderSubframes(subs: SubFrame[], order: 'blocked' | 'progressive' | 'chronological', blockSize = 8): void {
  if (order === 'progressive') {
    const n = subs.length
    const key = subs.map((s, i) => ({ s, k: halton(i + 1, 2) + 1e-9 * i }))
    key.sort((a, b) => a.k - b.k)
    for (let i = 0; i < n; i++) subs[i] = key[i].s
  } else if (order === 'blocked') {
    const B = Math.max(1, Math.round(blockSize))
    const nb = Math.ceil(subs.length / B)
    const blocks = Array.from({ length: nb }, (_, b) => ({ b, k: halton(b + 1, 2) + 1e-9 * b }))
    blocks.sort((a, c) => a.k - c.k)
    const out: SubFrame[] = []
    for (const { b } of blocks) out.push(...subs.slice(b * B, b * B + B))
    for (let i = 0; i < out.length; i++) subs[i] = out[i]
  }
  subs.forEach((s, i) => (s.order = i))
}

// ---------------------------------------------------------------- flash

export interface FlashOptions {
  /** seconds after the shutter starts to open; default = X-sync (first curtain fully open / blades fully open) */
  time?: number
  /** pulse length, seconds (full-power speedlight ~1/1000, low power ~1/20000) */
  duration?: number
  /** pupil samples for the flash exposure (default 16) */
  samples?: number
}

/** Default X-sync instant: the moment the gate is fully uncovered (if it ever is). */
export function xSyncTime(spec: CameraSpec): number {
  if (spec.shutterType === 'leaf') return Math.min(spec.leafRamp, (spec.shutter + spec.leafRamp) / 2)
  return spec.curtainTravel
}

/**
 * Flash sub-frames: the scene is frozen at the flash instant (a flash stops motion) and seen through
 * `samples` pupil points. Focal-plane rows only get the part of the pulse their slit window overlapped,
 * so above X-sync you get the classic black band. Leaf: a pupil point only sees the pulse if the
 * blades have uncovered it.
 */
export function planFlash(spec: CameraSpec, plan: ShutterPlan, f: FlashOptions, seed: number): SubFrame[] {
  const tf = f.time ?? xSyncTime(spec)
  const d = Math.max(1e-6, f.duration ?? 1 / 1000)
  const n = Math.max(1, Math.round(f.samples ?? 16))
  const ap = sampleAperture(spec.aperture, n, seed + 77)
  const Tc = plan.type === 'focal-plane' ? plan.curtainTravel : 0
  const t = spec.shutter
  const qScale = spec.maxAperture / spec.fNumber
  const out: SubFrame[] = []
  for (let k = 0; k < n; k++) {
    const lx = ap.points[k * 2]
    const ly = ap.points[k * 2 + 1]
    let weight = 1
    let rowMin = 0
    let rowMax = 1
    if (plan.type === 'leaf') {
      const q = Math.min(1, Math.hypot(lx, ly) * qScale)
      const o0 = q * spec.leafRamp
      const o1 = plan.span - q * spec.leafRamp
      weight = Math.max(0, Math.min(tf + d, o1) - Math.max(tf, o0)) / d
      if (weight <= 1e-6) continue
    } else if (Tc > 0) {
      rowMin = Math.max(0, (tf - t) / Tc)
      rowMax = Math.min(1, (tf + d) / Tc)
      if (rowMax <= rowMin) continue
    } else if (tf + d <= 0 || tf >= t) continue
    out.push({
      order: 0,
      bin: -1,
      t0: tf,
      t1: tf + d,
      time: tf,
      lens: [lx, ly],
      jitter: [halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5],
      weight,
      rowMin,
      rowMax,
      rand: [halton(k + 1, 5), halton(k + 1, 7)],
      flash: true,
    })
  }
  return out
}
