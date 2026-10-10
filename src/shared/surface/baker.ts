// The baker: a recipe (pure functions of specimen millimetres) -> SurfaceBake (render maps, layer stack,
// contact fields, snag map, loose layer, audio heightfield). Typed arrays only, so it runs in a worker.
//   pass 1: a coarse 128^2 relief pass builds the cavity / convexity maps the recipe can read
//   pass 2: full-resolution layers -> height, albedo, ORM, top layer, per-layer thickness
//   pass 3: AO, contact fields, snag map, loose initial state, audio heightfield, CPU mips
import { createKit, type Kit } from './fields'
import { toSrgb8, linearToSrgb } from './colour'
import { boxBlur, buildContact, contactRes, avgPoolSquare, snagMap, PROBES } from './contact'
import type { BakeOptions, Field, FormSpec, LayerSpec, MaterialPhys, ProbeKind, RGB, SurfaceBake, SurfaceMaps, SurfaceRecipe } from './types'

const DEG = Math.PI / 180
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Height (mm) of the base form at (x, y). */
export function formField(f: FormSpec): Field {
  if (f.kind === 'plane') return () => 0
  if (f.kind === 'cylinder') {
    const a = f.axisDeg * DEG
    const nx = -Math.sin(a)
    const ny = Math.cos(a)
    const [cx, cy] = f.crownOffsetMm
    const R = f.radiusMm
    const sgn = f.concave ? 1 : -1
    return (x, y) => {
      const u = (x - cx) * nx + (y - cy) * ny
      const uu = Math.min(Math.abs(u), R * 0.999)
      return sgn * (R - Math.sqrt(R * R - uu * uu))
    }
  }
  const R = f.radiusMm
  return (x, y) => {
    const r2 = x * x + y * y
    return r2 >= R * R ? -R : Math.sqrt(R * R - r2) - R
  }
}

/** Default bake square: 1.06 x the frame's long side, so either orientation fits without re-baking. */
export function defaultSizeMm(ratio: number): number {
  return (1.06 * 36) / ratio
}

// linear 0..1 -> sRGB 8 bit through a LUT
const LUT_N = 8192
let lut: Uint8Array | null = null
function srgbLut(): Uint8Array {
  if (!lut) {
    lut = new Uint8Array(LUT_N + 1)
    for (let i = 0; i <= LUT_N; i++) lut[i] = Math.round(linearToSrgb(i / LUT_N) * 255)
  }
  return lut
}
const enc = (l: Uint8Array, c: number): number => l[c <= 0 ? 0 : c >= 1 ? LUT_N : (c * LUT_N + 0.5) | 0]
const to8 = (v: number): number => { const x = Math.round(v * 255); return x < 0 ? 0 : x > 255 ? 255 : x }

/** Thin layers (< this, um) are translucent: the layer below shows through. */
const TRANSLUCENT_UM = 8
/** Thickness below which a layer counts as absent (um). */
const GONE_UM = 0.5

export interface Prepared {
  kit: Kit
  spec: ReturnType<SurfaceRecipe['build']>
  /** substrate + layers, bottom to top. */
  layers: LayerSpec[]
  form: Field
}

/** Build the recipe for a seed and extent and run pass 1 (coarse relief -> cavity / convexity maps). */
export function prepare(recipe: SurfaceRecipe, seed: number, size: number): Prepared {
  const kit: Kit = createKit(seed, { sizeMm: size })
  const spec = recipe.build(kit)
  const layers = [spec.substrate, ...spec.layers]
  const L = layers.length
  if (L > 255) throw new Error('too many layers')
  const form = formField(recipe.form)
  {
    const n = kit.coarse.n
    const H = new Float32Array(n * n)
    for (let j = 0; j < n; j++) {
      const y = ((j + 0.5) / n - 0.5) * size
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n - 0.5) * size
        let sumT = 0
        let top = 0
        for (let k = 1; k < L; k++) {
          const tk = layers[k].thicknessUm(x, y)
          if (tk > GONE_UM) { sumT += tk; top = k }
        }
        const rel = (spec.substrate.reliefUm?.(x, y) ?? 0) + (top > 0 ? layers[top].reliefUm?.(x, y) ?? 0 : 0)
        H[j * n + i] = form(x, y) + (rel + sumT) / 1000
      }
    }
    const cellMm = size / n
    const Hb = boxBlur(H, n, Math.min(12, Math.max(2, Math.round(0.6 / cellMm))), 2)
    const cav = new Float32Array(n * n)
    const conv = new Float32Array(n * n)
    for (let k = 0; k < n * n; k++) {
      const d = H[k] - Hb[k]
      conv[k] = d > 0 ? Math.min(1, d / 0.12) : 0
      cav[k] = d < 0 ? Math.min(1, -d / 0.12) : 0
    }
    kit.coarse.convexity = conv
    kit.coarse.cavity = cav
    kit.resetCaches()
  }
  return { kit, spec, layers, form }
}

export function bakeSync(recipe: SurfaceRecipe, o: BakeOptions): SurfaceBake {
  const t0 = now()
  const ratio = o.ratio
  const size = o.sizeMm ?? defaultSizeMm(ratio)
  const res = o.res
  const physRes = o.physRes
  const seed = o.seed ?? 1
  const { spec, layers, form } = prepare(recipe, seed, size)
  const L = layers.length

  // ---- pass 2: full resolution
  const N = res * res
  const height = new Float32Array(N)
  const albedo = new Uint8Array(N * 4)
  const orm = new Uint8Array(N * 4)
  const topLayer = new Uint8Array(N)
  const layerT = new Uint16Array(L * N)
  const hardF = new Float32Array(N)
  const l8 = srgbLut()
  const t = new Float64Array(L)
  const rgbA: RGB = [0, 0, 0]
  const rgbB: RGB = [0, 0, 0]
  const phys: MaterialPhys[] = layers.map((l) => l.phys)
  const anisoA = recipe.aniso ? to8(recipe.aniso.strength) : 0
  const pileA = recipe.pile ? 255 : 0
  const texel = size / res
  for (let j = 0; j < res; j++) {
    const y = -size / 2 + (j + 0.5) * texel
    for (let i = 0; i < res; i++) {
      const x = -size / 2 + (i + 0.5) * texel
      const k = j * res + i
      let sumT = 0
      let top = 0
      for (let q = 1; q < L; q++) {
        let tq = layers[q].thicknessUm(x, y)
        if (!(tq > GONE_UM)) tq = 0
        t[q] = tq
        if (tq > 0) { sumT += tq; top = q }
      }
      let t0s = layers[0].thicknessUm(x, y)
      if (!(t0s > GONE_UM)) t0s = 1000
      t[0] = t0s
      const rel = (layers[0].reliefUm?.(x, y) ?? 0) + (top > 0 ? layers[top].reliefUm?.(x, y) ?? 0 : 0)
      height[k] = form(x, y) + (rel + sumT) / 1000
      topLayer[k] = top
      for (let q = 0; q < L; q++) { const v = Math.round(t[q]); layerT[q * N + k] = v > 65535 ? 65535 : v }
      // colour and shading: the top layer, translucent when thin
      const lt = layers[top]
      lt.albedo(x, y, rgbA)
      let rough = lt.roughness ? lt.roughness(x, y) : lt.phys.roughness
      let metal = lt.phys.metalness
      let hard = lt.phys.hardness
      if (top > 0 && t[top] < TRANSLUCENT_UM) {
        let b = top - 1
        while (b > 0 && !(t[b] > 0)) b--
        const lb = layers[b]
        lb.albedo(x, y, rgbB)
        const f = t[top] / TRANSLUCENT_UM
        rgbA[0] = rgbB[0] + (rgbA[0] - rgbB[0]) * f
        rgbA[1] = rgbB[1] + (rgbA[1] - rgbB[1]) * f
        rgbA[2] = rgbB[2] + (rgbA[2] - rgbB[2]) * f
        const rb = lb.roughness ? lb.roughness(x, y) : lb.phys.roughness
        rough = rb + (rough - rb) * f
        metal = lb.phys.metalness + (metal - lb.phys.metalness) * f
        hard = lb.phys.hardness + (hard - lb.phys.hardness) * f
      }
      hardF[k] = hard
      const a4 = k * 4
      albedo[a4] = enc(l8, rgbA[0])
      albedo[a4 + 1] = enc(l8, rgbA[1])
      albedo[a4 + 2] = enc(l8, rgbA[2])
      albedo[a4 + 3] = pileA
      orm[a4 + 1] = to8(rough)
      orm[a4 + 2] = to8(metal)
      orm[a4 + 3] = anisoA
    }
  }

  // ---- pass 3: AO (multi-scale cavity), contact fields, snag, loose, audio, mips
  {
    const bs = boxBlur(height, res, Math.max(1, 0.12 / texel), 2)
    const bm = boxBlur(height, res, Math.max(1, 0.5 / texel), 2)
    const bb = boxBlur(height, res, Math.max(1, 1.6 / texel), 2)
    for (let k = 0; k < N; k++) {
      const h = height[k]
      const cs = bs[k] - h
      const cm = bm[k] - h
      const cb = bb[k] - h
      let ao = 1 - 3.2 * (cs > 0 ? cs : 0) - 1.6 * (cm > 0 ? cm : 0) - 0.5 * (cb > 0 ? cb : 0)
      ao = ao < 0.25 ? 0.25 : ao > 1 ? 1 : ao
      orm[k * 4] = to8(ao)
    }
  }

  const bake: SurfaceBake = {
    recipeId: recipe.id,
    ratio,
    seed,
    sizeMm: size,
    res,
    mmPerTexel: texel,
    height,
    heightMips: [],
    albedo,
    orm,
    topLayer,
    layerT,
    physRes,
    loose: null,
    contact: {} as Record<ProbeKind, SurfaceBake['contact'][ProbeKind]>,
    snag: new Float32Array(0),
    audioRes: 0,
    audioHeight: new Float32Array(0),
    phys,
    ms: 0,
    nLayers: L,
  }

  if (!o.maps) {
    for (const kind of Object.keys(PROBES) as ProbeKind[]) bake.contact[kind] = buildContact(height, res, size, PROBES[kind].radiusMm)
    bake.snag = snagMap(height, hardF, res, size, bake.contact.burlap.res)
    if (recipe.loose) {
      const loose = new Float32Array(physRes * physRes)
      const f = spec.looseInitUm
      if (f) {
        for (let j = 0; j < physRes; j++) {
          const y = -size / 2 + ((j + 0.5) / physRes) * size
          for (let i = 0; i < physRes; i++) loose[j * physRes + i] = Math.max(0, f(-size / 2 + ((i + 0.5) / physRes) * size, y))
        }
      }
      bake.loose = loose
    }
    const ar = Math.min(512, res)
    const ah = avgPoolSquare(height, res, ar)
    const ab = boxBlur(ah, ar, Math.max(1, 1 / (size / ar)), 2)
    const audio = new Float32Array(ar * ar)
    for (let k = 0; k < audio.length; k++) audio[k] = ah[k] - ab[k]
    bake.audioRes = ar
    bake.audioHeight = audio
    let cur = height
    let cr = res
    while (cr > 4) {
      const nr = cr >> 1
      const nx = new Float32Array(nr * nr)
      for (let j = 0; j < nr; j++) {
        for (let i = 0; i < nr; i++) {
          const a = (2 * j) * cr + 2 * i
          nx[j * nr + i] = 0.25 * (cur[a] + cur[a + 1] + cur[a + cr] + cur[a + cr + 1])
        }
      }
      bake.heightMips.push(nx)
      cur = nx
      cr = nr
    }
  } else {
    // keep the shapes valid for callers that read them
    for (const kind of Object.keys(PROBES) as ProbeKind[]) {
      const r = contactRes(size, PROBES[kind].radiusMm)
      bake.contact[kind] = { res: r, cellMm: size / r, radiusMm: PROBES[kind].radiusMm, data: new Float32Array(0) }
    }
  }
  bake.ms = now() - t0
  return bake
}

/** Transferable buffers of a bake (worker postMessage). */
export function bakeTransferables(b: SurfaceBake): ArrayBuffer[] {
  const out: ArrayBuffer[] = [
    b.height.buffer, b.albedo.buffer, b.orm.buffer, b.topLayer.buffer, b.layerT.buffer, b.snag.buffer, b.audioHeight.buffer,
  ] as ArrayBuffer[]
  for (const m of b.heightMips) out.push(m.buffer as ArrayBuffer)
  if (b.loose) out.push(b.loose.buffer as ArrayBuffer)
  for (const k of Object.keys(b.contact) as ProbeKind[]) out.push(b.contact[k].data.buffer as ArrayBuffer)
  return out
}

/** 3D-prop maps from a bake (normal from the height gradient, tangent space, OpenGL convention). */
export function mapsFromBake(b: SurfaceBake): SurfaceMaps {
  const res = b.res
  const h = b.height
  const normal = new Uint8Array(res * res * 4)
  const inv2 = 1 / (2 * b.mmPerTexel)
  for (let j = 0; j < res; j++) {
    const jm = j > 0 ? j - 1 : 0
    const jp = j < res - 1 ? j + 1 : res - 1
    for (let i = 0; i < res; i++) {
      const im = i > 0 ? i - 1 : 0
      const ip = i < res - 1 ? i + 1 : res - 1
      const gx = (h[j * res + ip] - h[j * res + im]) * inv2
      const gy = (h[jp * res + i] - h[jm * res + i]) * inv2
      const l = 1 / Math.sqrt(gx * gx + gy * gy + 1)
      const k = (j * res + i) * 4
      normal[k] = to8(0.5 - gx * l * 0.5)
      normal[k + 1] = to8(0.5 - gy * l * 0.5)
      normal[k + 2] = to8(0.5 + l * 0.5)
      normal[k + 3] = 255
    }
  }
  const orm = b.orm.slice()
  const albedo = b.albedo.slice()
  for (let k = 3; k < orm.length; k += 4) { orm[k] = 255; albedo[k] = 255 }
  return { sizeMm: b.sizeMm, res, albedo, normal, orm, height: b.height.slice() }
}

export { toSrgb8 }
