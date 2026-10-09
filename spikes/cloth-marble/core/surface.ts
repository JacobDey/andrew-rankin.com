// Generic surface baking: a SurfaceRecipe is a pure function of plate-space
// millimetres; bakeSurface() turns it into render maps (height, normal, albedo,
// material), physics material fields and probe contact fields. Everything here
// is plain typed arrays so it can run in a Web Worker and be transferred.

import { HeightField, ScalarField } from './heightfield'

/** Per-texel output of a recipe. Colours are sRGB 0..1. */
export interface Texel {
  /** height in mm */
  h: number
  r: number
  g: number
  b: number
  /** perceptual roughness 0..1 */
  rough: number
  /** metalness 0..1 */
  metal: number
  /** friction multiplier for cloth contact (doc: 1.1 glass .. 1.6 rubber/rust) */
  mu: number
  /** marble restitution against this texel */
  rest: number
  /** marble rolling-resistance coefficient */
  crr: number
  /** 0..1 how readily sharp peaks here snag a coarse weave */
  hardness: number
  /** free channel the recipe can use for debugging/clues (e.g. rust weight) */
  tag: number
}

export function texel(): Texel {
  return { h: 0, r: 0, g: 0, b: 0, rough: 0.5, metal: 0, mu: 1.2, rest: 0.5, crr: 0.01, hardness: 0, tag: 0 }
}

export interface SurfaceRecipe {
  id: string
  name: string
  /** Build a sampler for this seed. May precompute coarse helper grids. */
  prepare(seed: number, sizeX: number, sizeY: number): (x: number, y: number, out: Texel) => void
}

export interface ProbeSpec {
  /** probe radius in mm */
  r: number
  /** contact-field resolution (square) */
  res: number
}

export interface BakeOptions {
  /** render-map resolution (square), e.g. 1024 desktop / 512 phone */
  res: number
  /** plate extent in mm (square) */
  size: number
  seed: number
  /** physics material-field resolution, e.g. 256 */
  physRes: number
  /** contact fields to precompute */
  probes: ProbeSpec[]
}

export interface ContactFieldData {
  r: number
  res: number
  data: Float32Array
}

/** Transferable result of a bake. */
export interface SurfaceBake {
  recipe: string
  res: number
  size: number
  seed: number
  /** heights mm, res*res, row 0 = bottom */
  height: Float32Array
  /** same as height, IEEE half floats (for an R16F texture) */
  heightHalf: Uint16Array
  /** RGBA8 sRGB albedo; A = baked ambient occlusion */
  albedo: Uint8Array
  /** RGBA8: R roughness, G metalness, B tag (recipe channel), A cavity (0.5 = flat) */
  material: Uint8Array
  /** RG16F tangent-space normal xy (z = sqrt(1 - x^2 - y^2)) */
  normalHalf: Uint16Array
  physRes: number
  /** cloth friction multiplier */
  mu: Float32Array
  /** marble restitution */
  rest: Float32Array
  /** marble rolling resistance */
  crr: Float32Array
  /** 0..1 snag strength for coarse cloth */
  snag: Float32Array
  /** mean |high-pass height| in mm (micro roughness; drives roll noise) */
  grain: Float32Array
  contacts: ContactFieldData[]
  ms: Record<string, number>
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export function bakeSurface(recipe: SurfaceRecipe, o: BakeOptions): SurfaceBake {
  const ms: Record<string, number> = {}
  let t0 = now()
  const { res, size, physRes } = o
  const n = res * res
  const sample = recipe.prepare(o.seed, size, size)
  ms.prepare = now() - t0
  t0 = now()

  const height = new Float32Array(n)
  const albedo = new Uint8Array(n * 4)
  const material = new Uint8Array(n * 4)
  // physics channels at full res first, pooled down afterwards
  const muF = new Float32Array(n)
  const restF = new Float32Array(n)
  const crrF = new Float32Array(n)
  const hardF = new Float32Array(n)
  const tx = texel()
  const d = size / res
  const x0 = -size / 2
  for (let j = 0; j < res; j++) {
    const y = x0 + (j + 0.5) * d
    for (let i = 0; i < res; i++) {
      const x = x0 + (i + 0.5) * d
      sample(x, y, tx)
      const k = j * res + i
      height[k] = tx.h
      albedo[k * 4] = to8(tx.r)
      albedo[k * 4 + 1] = to8(tx.g)
      albedo[k * 4 + 2] = to8(tx.b)
      material[k * 4] = to8(tx.rough)
      material[k * 4 + 1] = to8(tx.metal)
      material[k * 4 + 2] = to8(tx.tag)
      muF[k] = tx.mu
      restF[k] = tx.rest
      crrF[k] = tx.crr
      hardF[k] = tx.hardness
    }
  }
  ms.texels = now() - t0
  t0 = now()

  // --- ambient occlusion + cavity from multi-scale blur differences ---------
  const H = new HeightField(res, res, size, size, height)
  const bSmall = H.blur(0.12, 2).data
  const bMid = H.blur(0.5, 2).data
  const bBig = H.blur(1.6, 2).data
  for (let k = 0; k < n; k++) {
    const h = height[k]
    // positive where the texel sits below its neighbourhood (pits, cracks)
    const cavS = bSmall[k] - h
    const cavM = bMid[k] - h
    const cavB = bBig[k] - h
    let ao = 1 - 3.2 * Math.max(0, cavS) - 1.6 * Math.max(0, cavM) - 0.5 * Math.max(0, cavB)
    ao = ao < 0.25 ? 0.25 : ao > 1 ? 1 : ao
    albedo[k * 4 + 3] = to8(ao)
    // cavity/curvature: 0.5 flat, < 0.5 concave, > 0.5 convex (edges)
    material[k * 4 + 3] = to8(0.5 - cavS * 6 - cavM * 1.5)
  }
  ms.ao = now() - t0
  t0 = now()

  // --- normals (from full-precision heights; stored as half floats) ---------
  const normalHalf = new Uint16Array(n * 2)
  const inv2d = 1 / (2 * d)
  for (let j = 0; j < res; j++) {
    const jm = j > 0 ? j - 1 : 0
    const jp = j < res - 1 ? j + 1 : res - 1
    for (let i = 0; i < res; i++) {
      const im = i > 0 ? i - 1 : 0
      const ip = i < res - 1 ? i + 1 : res - 1
      const gx = (height[j * res + ip] - height[j * res + im]) * inv2d
      const gy = (height[jp * res + i] - height[jm * res + i]) * inv2d
      const l = 1 / Math.sqrt(gx * gx + gy * gy + 1)
      const k = j * res + i
      normalHalf[k * 2] = toHalf(-gx * l)
      normalHalf[k * 2 + 1] = toHalf(-gy * l)
    }
  }
  const heightHalf = new Uint16Array(n)
  for (let k = 0; k < n; k++) heightHalf[k] = toHalf(height[k])
  ms.normals = now() - t0
  t0 = now()

  // --- physics material fields at physRes -----------------------------------
  const pool = (src: Float32Array) => new HeightField(res, res, size, size, src).averagePool(physRes, physRes).data
  const mu = pool(muF)
  const rest = pool(restF)
  const crr = pool(crrF)
  // snag: sharp convex peaks (height above a 0.12 mm blur) on hard material
  const snagFull = new Float32Array(n)
  const grainFull = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    const peak = height[k] - bSmall[k]
    const s = (peak - 0.004) / 0.02
    snagFull[k] = (s < 0 ? 0 : s > 1 ? 1 : s) * hardF[k]
    grainFull[k] = Math.abs(peak)
  }
  // max-pool snag so a single sharp flake is not averaged away
  const snag = new HeightField(res, res, size, size, snagFull).maxPool(physRes, physRes).data
  const grain = pool(grainFull)
  ms.physics = now() - t0
  t0 = now()

  // --- probe contact fields ---------------------------------------------------
  const contacts: ContactFieldData[] = []
  for (const p of o.probes) {
    const t1 = now()
    const D = H.dilate(p.r, p.res, p.res)
    contacts.push({ r: p.r, res: p.res, data: D.data })
    ms[`contact_r${p.r}`] = now() - t1
  }
  ms.contacts = now() - t0
  return {
    recipe: recipe.id,
    res,
    size,
    seed: o.seed,
    height,
    heightHalf,
    albedo,
    material,
    normalHalf,
    physRes,
    mu,
    rest,
    crr,
    snag,
    grain,
    contacts,
    ms,
  }
}

/** All typed-array buffers of a bake, for postMessage transfer lists. */
export function bakeTransferables(b: SurfaceBake): ArrayBuffer[] {
  const out = [b.height, b.heightHalf, b.albedo, b.material, b.normalHalf, b.mu, b.rest, b.crr, b.snag, b.grain].map((a) => a.buffer as ArrayBuffer)
  for (const c of b.contacts) out.push(c.data.buffer as ArrayBuffer)
  return out
}

/** Physics-side view of a bake: HeightFields and ScalarFields ready for probes. */
export interface ProbeSurface {
  size: number
  height: HeightField
  mu: ScalarField
  rest: ScalarField
  crr: ScalarField
  snag: ScalarField
  grain: ScalarField
  /** contact field D_r for a probe radius baked earlier (nearest radius) */
  contact(r: number): HeightField
}

export function probeSurface(b: SurfaceBake): ProbeSurface {
  const s = b.size
  const sf = (a: Float32Array) => new ScalarField(b.physRes, b.physRes, s, s, a)
  const contacts = b.contacts.map((c) => ({ r: c.r, field: new HeightField(c.res, c.res, s, s, c.data) }))
  const height = new HeightField(b.res, b.res, s, s, b.height)
  return {
    size: s,
    height,
    mu: sf(b.mu),
    rest: sf(b.rest),
    crr: sf(b.crr),
    snag: sf(b.snag),
    grain: sf(b.grain),
    contact(r: number) {
      let best = contacts[0]
      for (const c of contacts) if (Math.abs(c.r - r) < Math.abs(best.r - r)) best = c
      if (!best || Math.abs(best.r - r) > 1e-3) {
        // not pre-baked: compute on demand (slow for big r; bake it instead)
        const f = height.dilate(r, Math.min(256, b.res), Math.min(256, b.res))
        contacts.push({ r, field: f })
        return f
      }
      return best.field
    },
  }
}

function to8(v: number): number {
  const x = Math.round(v * 255)
  return x < 0 ? 0 : x > 255 ? 255 : x
}

// float32 -> IEEE 754 half, round-to-nearest (no NaN payloads needed here)
const f32 = new Float32Array(1)
const u32 = new Uint32Array(f32.buffer)
export function toHalf(v: number): number {
  f32[0] = v
  const x = u32[0]
  const sign = (x >>> 16) & 0x8000
  let exp = ((x >>> 23) & 0xff) - 127 + 15
  let mant = x & 0x7fffff
  if (exp <= 0) {
    if (exp < -10) return sign
    mant |= 0x800000
    const shift = 14 - exp
    let half = mant >>> shift
    if ((mant >>> (shift - 1)) & 1) half++
    return sign | half
  }
  if (exp >= 31) return sign | 0x7c00
  let half = sign | (exp << 10) | (mant >>> 13)
  if (mant & 0x1000) half++ // round
  return half
}
