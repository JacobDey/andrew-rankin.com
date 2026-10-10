// SurfaceRuntime: the live, editable view of a bake (contact queries, materials, abrasion, polish, loose
// grit, height edits) for the main thread. Edits mutate the bake's typed arrays in place and report dirty
// rectangles; contact fields are refreshed locally (dirty rect + probe radius).
import { prepare, type Prepared } from './baker'
import { dilate, PROBES } from './contact'
import { linearToSrgb } from './colour'
import type {
  ContactSample, MaterialPhys, ProbeKind, RGB, SurfaceBake, SurfaceRecipe, SurfaceRuntime, TexRect,
} from './types'

const GONE_UM = 0.5
const TRANSLUCENT_UM = 8
const KINDS: ProbeKind[] = ['marble', 'burlap', 'lens']
type DirtyKind = 'height' | 'albedo' | 'orm' | 'loose'
const to8 = (v: number): number => { const x = Math.round(v * 255); return x < 0 ? 0 : x > 255 ? 255 : x }
const enc8 = (c: number): number => to8(linearToSrgb(c))

class SurfaceRuntimeImpl implements SurfaceRuntime {
  readonly bake: SurfaceBake
  readonly recipe: SurfaceRecipe
  private readonly res: number
  private readonly size: number
  private readonly texel: number
  private readonly N: number
  private readonly L: number
  private prep: Prepared | null = null
  private listeners = new Set<(r: TexRect, what: DirtyKind) => void>()
  /** Thickness and height as baked (for carry-over between bakes). */
  readonly baseT: Uint16Array
  readonly baseHeight: Float32Array
  private hEdit: Float32Array | null = null
  private wear: Float32Array | null = null
  private pooled: Record<ProbeKind, Float32Array> | null = null
  private tmpT: Float64Array
  private readonly rgbA: RGB = [0, 0, 0]
  private readonly rgbB: RGB = [0, 0, 0]
  private readonly pileA: number
  private readonly anisoA: number

  constructor(bake: SurfaceBake, recipe: SurfaceRecipe) {
    this.bake = bake
    this.recipe = recipe
    this.res = bake.res
    this.size = bake.sizeMm
    this.texel = bake.mmPerTexel
    this.N = bake.res * bake.res
    this.L = bake.nLayers
    this.baseT = bake.layerT.slice()
    this.baseHeight = bake.height.slice()
    this.tmpT = new Float64Array(this.L)
    this.pileA = recipe.pile ? 255 : 0
    this.anisoA = recipe.aniso ? to8(recipe.aniso.strength) : 0
  }

  // ------------------------------------------------------------------ queries

  private texelIndex(x: number, y: number): number {
    const r = this.res
    let i = Math.floor((x / this.size + 0.5) * r)
    let j = Math.floor((y / this.size + 0.5) * r)
    i = i < 0 ? 0 : i >= r ? r - 1 : i
    j = j < 0 ? 0 : j >= r ? r - 1 : j
    return j * r + i
  }

  private bil(d: Float32Array, res: number, x: number, y: number): number {
    let fx = (x / this.size + 0.5) * res - 0.5
    let fy = (y / this.size + 0.5) * res - 0.5
    fx = fx < 0 ? 0 : fx > res - 1.0001 ? res - 1.0001 : fx
    fy = fy < 0 ? 0 : fy > res - 1.0001 ? res - 1.0001 : fy
    const i = fx | 0
    const j = fy | 0
    const tx = fx - i
    const ty = fy - j
    const k = j * res + i
    const a = d[k] + (d[k + 1] - d[k]) * tx
    const b = d[k + res] + (d[k + res + 1] - d[k + res]) * tx
    return a + (b - a) * ty
  }

  contactAt(p: ProbeKind, x: number, y: number, out: ContactSample): ContactSample {
    const f = this.bake.contact[p]
    const h = f.cellMm
    const d = this.bil(f.data, f.res, x, y)
    const gx = (this.bil(f.data, f.res, x + h, y) - this.bil(f.data, f.res, x - h, y)) / (2 * h)
    const gy = (this.bil(f.data, f.res, x, y + h) - this.bil(f.data, f.res, x, y - h)) / (2 * h)
    const l = 1 / Math.sqrt(gx * gx + gy * gy + 1)
    out.d = d
    out.nx = -gx * l
    out.ny = -gy * l
    out.nz = l
    out.layer = this.bake.topLayer[this.texelIndex(x, y)]
    return out
  }

  materialAt(x: number, y: number): MaterialPhys {
    return this.bake.phys[this.bake.topLayer[this.texelIndex(x, y)]]
  }

  residueAt(x: number, y: number): { rgb: RGB; rate: number; kind: string } | null {
    const r = this.materialAt(x, y).residue
    return r ? { rgb: r.rgb, rate: r.rate, kind: r.kind } : null
  }

  snagAt(x: number, y: number): number {
    const s = this.bake.snag
    if (!s.length) return 0
    return this.bil(s, this.bake.contact.burlap.res, x, y)
  }

  fields(): ReturnType<SurfaceRecipe['build']> {
    return this.prepared().spec
  }

  private prepared(): Prepared {
    if (!this.prep) this.prep = prepare(this.recipe, this.bake.seed, this.size)
    return this.prep
  }

  onDirty(cb: (r: TexRect, what: DirtyKind) => void): () => void {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }

  private emit(r: TexRect, what: DirtyKind): void {
    for (const cb of this.listeners) cb(r, what)
  }

  // ------------------------------------------------------------------ edits

  /** Recompute one texel from the current layer thicknesses (the baker's compositing, with edits added). */
  private recomposite(k: number, x: number, y: number): void {
    const { layers, form } = this.prepared()
    const b = this.bake
    const N = this.N
    const L = this.L
    const t = this.tmpT
    let sumT = 0
    let top = 0
    for (let q = 1; q < L; q++) {
      const v = b.layerT[q * N + k]
      t[q] = v
      if (v > GONE_UM) { sumT += v; top = q }
    }
    t[0] = b.layerT[k]
    const rel = (layers[0].reliefUm?.(x, y) ?? 0) + (top > 0 ? layers[top].reliefUm?.(x, y) ?? 0 : 0)
    b.height[k] = form(x, y) + (rel + sumT) / 1000 + (this.hEdit ? this.hEdit[k] : 0)
    b.topLayer[k] = top
    const lt = layers[top]
    lt.albedo(x, y, this.rgbA)
    let rough = lt.roughness ? lt.roughness(x, y) : lt.phys.roughness
    let metal = lt.phys.metalness
    if (top > 0 && t[top] < TRANSLUCENT_UM) {
      let q = top - 1
      while (q > 0 && !(t[q] > GONE_UM)) q--
      const lb = layers[q]
      lb.albedo(x, y, this.rgbB)
      const f = t[top] / TRANSLUCENT_UM
      for (let c = 0; c < 3; c++) this.rgbA[c] = this.rgbB[c] + (this.rgbA[c] - this.rgbB[c]) * f
      const rb = lb.roughness ? lb.roughness(x, y) : lb.phys.roughness
      rough = rb + (rough - rb) * f
      metal = lb.phys.metalness + (metal - lb.phys.metalness) * f
    }
    const a4 = k * 4
    b.albedo[a4] = enc8(this.rgbA[0])
    b.albedo[a4 + 1] = enc8(this.rgbA[1])
    b.albedo[a4 + 2] = enc8(this.rgbA[2])
    b.albedo[a4 + 3] = this.pileA
    b.orm[a4 + 1] = to8(rough)
    b.orm[a4 + 2] = to8(metal)
    b.orm[a4 + 3] = this.anisoA
  }

  private pooledFor(kind: ProbeKind): Float32Array {
    if (!this.pooled) {
      const p = {} as Record<ProbeKind, Float32Array>
      for (const k of KINDS) {
        const c = this.bake.contact[k]
        const out = new Float32Array(c.res * c.res)
        const r = this.res
        for (let j = 0; j < c.res; j++) {
          const j0 = Math.floor((j * r) / c.res)
          const j1 = Math.max(j0 + 1, Math.floor(((j + 1) * r) / c.res))
          for (let i = 0; i < c.res; i++) {
            const i0 = Math.floor((i * r) / c.res)
            const i1 = Math.max(i0 + 1, Math.floor(((i + 1) * r) / c.res))
            let m = -Infinity
            for (let y = j0; y < j1; y++) for (let x = i0; x < i1; x++) { const v = this.bake.height[y * r + x]; if (v > m) m = v }
            out[j * c.res + i] = m
          }
        }
        p[k] = out
      }
      this.pooled = p
    }
    return this.pooled[kind]
  }

  /** Refresh the contact fields inside a texel rectangle (plus each probe's radius). */
  private refreshContacts(r: TexRect): void {
    if (!this.bake.contact.marble.data.length) return
    const rr = this.res
    for (const kind of KINDS) {
      const c = this.bake.contact[kind]
      const pooled = this.pooledFor(kind)
      const ci0 = Math.max(0, Math.floor((r.x0 * c.res) / rr) - 1)
      const ci1 = Math.min(c.res, Math.ceil((r.x1 * c.res) / rr) + 1)
      const cj0 = Math.max(0, Math.floor((r.y0 * c.res) / rr) - 1)
      const cj1 = Math.min(c.res, Math.ceil((r.y1 * c.res) / rr) + 1)
      for (let j = cj0; j < cj1; j++) {
        const j0 = Math.floor((j * rr) / c.res)
        const j1 = Math.max(j0 + 1, Math.floor(((j + 1) * rr) / c.res))
        for (let i = ci0; i < ci1; i++) {
          const i0 = Math.floor((i * rr) / c.res)
          const i1 = Math.max(i0 + 1, Math.floor(((i + 1) * rr) / c.res))
          let m = -Infinity
          for (let y = j0; y < j1; y++) for (let x = i0; x < i1; x++) { const v = this.bake.height[y * rr + x]; if (v > m) m = v }
          pooled[j * c.res + i] = m
        }
      }
      const m = Math.ceil(PROBES[kind].radiusMm / c.cellMm) + 1
      dilate(pooled, c.res, this.size, PROBES[kind].radiusMm, c.data, {
        i0: Math.max(0, ci0 - m), i1: Math.min(c.res, ci1 + m), j0: Math.max(0, cj0 - m), j1: Math.min(c.res, cj1 + m),
      })
    }
  }

  /** Texel window of a disc (mm). */
  private window(x: number, y: number, rMm: number): TexRect {
    const r = this.res
    const t = this.texel
    return {
      x0: Math.max(0, Math.floor((x - rMm) / t + r / 2)),
      x1: Math.min(r, Math.ceil((x + rMm) / t + r / 2) + 1),
      y0: Math.max(0, Math.floor((y - rMm) / t + r / 2)),
      y1: Math.min(r, Math.ceil((y + rMm) / t + r / 2) + 1),
    }
  }

  abradeBatch(splats: Float32Array, n: number): { revealed: number[]; removed: RGB[] } {
    const b = this.bake
    const N = this.N
    const res = this.res
    const revealed = new Set<number>()
    const removed: RGB[] = []
    const dirty: TexRect = { x0: res, y0: res, x1: 0, y1: 0 }
    const changed: number[] = []
    for (let s = 0; s < n; s++) {
      const x = splats[s * 4]
      const y = splats[s * 4 + 1]
      const rMm = Math.max(splats[s * 4 + 2], this.texel * 0.75)
      const depth = splats[s * 4 + 3]
      if (!(depth > 0)) continue
      const w = this.window(x, y, rMm)
      let took = 0
      let layerTaken = -1
      for (let j = w.y0; j < w.y1; j++) {
        const py = -this.size / 2 + (j + 0.5) * this.texel
        for (let i = w.x0; i < w.x1; i++) {
          const px = -this.size / 2 + (i + 0.5) * this.texel
          const d2 = ((px - x) * (px - x) + (py - y) * (py - y)) / (rMm * rMm)
          if (d2 >= 1) continue
          const k = j * res + i
          let top = b.topLayer[k]
          if (top === 0) continue // the substrate is not abraded
          const was = top
          const amount = depth * (1 - d2)
          took += amount
          layerTaken = top
          // wear accumulates as fractions of a um; whole micrometres come off the stored thickness
          const acc = (this.wear ??= new Float32Array(N))
          acc[k] += amount
          if (acc[k] < 1) continue
          let take = Math.floor(acc[k])
          acc[k] -= take
          while (take > 0 && top > 0) {
            const idx = top * N + k
            const t = Math.min(take, b.layerT[idx])
            b.layerT[idx] -= t
            take -= t
            if (b.layerT[idx] <= GONE_UM) {
              b.layerT[idx] = 0
              top--
              while (top > 0 && !(b.layerT[top * N + k] > GONE_UM)) top--
              acc[k] = 0
            }
          }
          changed.push(k)
          if (top !== was) revealed.add(top)
        }
      }
      if (took > 0 && layerTaken >= 0) {
        // the colour of what came off: the layer that gave up most (the last one touched)
        this.prepared().layers[layerTaken].albedo(x, y, this.rgbA)
        removed.push([this.rgbA[0], this.rgbA[1], this.rgbA[2]])
      }
      dirty.x0 = Math.min(dirty.x0, w.x0); dirty.y0 = Math.min(dirty.y0, w.y0)
      dirty.x1 = Math.max(dirty.x1, w.x1); dirty.y1 = Math.max(dirty.y1, w.y1)
    }
    if (changed.length) {
      for (const k of changed) {
        const j = (k / res) | 0
        const i = k - j * res
        this.recomposite(k, -this.size / 2 + (i + 0.5) * this.texel, -this.size / 2 + (j + 0.5) * this.texel)
      }
      this.refreshContacts(dirty)
      this.emit(dirty, 'height')
      this.emit(dirty, 'albedo')
      this.emit(dirty, 'orm')
    }
    return { revealed: [...revealed], removed }
  }

  polishBatch(splats: Float32Array, n: number): void {
    const b = this.bake
    const res = this.res
    const dirty: TexRect = { x0: res, y0: res, x1: 0, y1: 0 }
    let any = false
    for (let s = 0; s < n; s++) {
      const x = splats[s * 4]
      const y = splats[s * 4 + 1]
      const rMm = Math.max(splats[s * 4 + 2], this.texel * 0.75)
      const amount = splats[s * 4 + 3]
      const w = this.window(x, y, rMm)
      for (let j = w.y0; j < w.y1; j++) {
        const py = -this.size / 2 + (j + 0.5) * this.texel
        for (let i = w.x0; i < w.x1; i++) {
          const px = -this.size / 2 + (i + 0.5) * this.texel
          const d2 = ((px - x) * (px - x) + (py - y) * (py - y)) / (rMm * rMm)
          if (d2 >= 1) continue
          const k = j * res + i
          const ph = b.phys[b.topLayer[k]]
          if (!ph.polish) continue
          const floor = ph.roughnessMin ?? 0.04
          const cur = b.orm[k * 4 + 1] / 255
          const next = Math.max(floor, cur - ph.polish * amount * (1 - d2))
          if (next < cur) { b.orm[k * 4 + 1] = to8(next); any = true }
        }
      }
      dirty.x0 = Math.min(dirty.x0, w.x0); dirty.y0 = Math.min(dirty.y0, w.y0)
      dirty.x1 = Math.max(dirty.x1, w.x1); dirty.y1 = Math.max(dirty.y1, w.y1)
    }
    if (any) this.emit(dirty, 'orm')
  }

  /** Remove up to `um` of loose material from each physics cell within rMm; returns the mean amount actually taken (um). */
  takeLoose(x: number, y: number, rMm: number, um: number): number {
    const loose = this.bake.loose
    if (!loose) return 0
    const pr = this.bake.physRes
    const cell = this.size / pr
    const i0 = Math.max(0, Math.floor((x - rMm) / cell + pr / 2))
    const i1 = Math.min(pr, Math.ceil((x + rMm) / cell + pr / 2) + 1)
    const j0 = Math.max(0, Math.floor((y - rMm) / cell + pr / 2))
    const j1 = Math.min(pr, Math.ceil((y + rMm) / cell + pr / 2) + 1)
    let total = 0
    let cells = 0
    for (let j = j0; j < j1; j++) {
      const py = -this.size / 2 + (j + 0.5) * cell
      for (let i = i0; i < i1; i++) {
        const px = -this.size / 2 + (i + 0.5) * cell
        if ((px - x) * (px - x) + (py - y) * (py - y) > rMm * rMm) continue
        const k = j * pr + i
        const t = Math.min(um, loose[k])
        loose[k] -= t
        total += t
        cells++
      }
    }
    if (total > 0) this.emit({ x0: i0, y0: j0, x1: i1, y1: j1 }, 'loose')
    return cells ? total / cells : 0
  }

  editHeight(x: number, y: number, rMm: number, fn: (h: number, d: number) => number): void {
    const b = this.bake
    const res = this.res
    if (!this.hEdit) this.hEdit = new Float32Array(this.N)
    const w = this.window(x, y, rMm)
    for (let j = w.y0; j < w.y1; j++) {
      const py = -this.size / 2 + (j + 0.5) * this.texel
      for (let i = w.x0; i < w.x1; i++) {
        const px = -this.size / 2 + (i + 0.5) * this.texel
        const d = Math.hypot(px - x, py - y)
        if (d >= rMm) continue
        const k = j * res + i
        const nh = fn(b.height[k], d)
        this.hEdit[k] += nh - b.height[k]
        b.height[k] = nh
      }
    }
    this.refreshContacts(w)
    this.emit(w, 'height')
  }

  markLooseDirty(r: TexRect): void {
    this.emit(r, 'loose')
  }

  // ------------------------------------------------------------------ carry-over between bakes

  /** Adopt another runtime's wear (removed layers, height edits, loose) of the same recipe and seed. */
  adopt(from: SurfaceRuntimeImpl): void {
    if (from.recipe.id !== this.recipe.id || from.bake.seed !== this.bake.seed || from.L !== this.L) return
    const ob = from.bake
    const nb = this.bake
    const res = this.res
    const ores = from.res
    const N = this.N
    const oN = from.N
    const L = this.L
    let any = false
    const changed: number[] = []
    for (let j = 0; j < res; j++) {
      const y = -this.size / 2 + (j + 0.5) * this.texel
      const oj = Math.floor((y / from.size + 0.5) * ores)
      if (oj < 0 || oj >= ores) continue
      for (let i = 0; i < res; i++) {
        const x = -this.size / 2 + (i + 0.5) * this.texel
        const oi = Math.floor((x / from.size + 0.5) * ores)
        if (oi < 0 || oi >= ores) continue
        const ko = oj * ores + oi
        const k = j * res + i
        let hit = false
        for (let q = 1; q < L; q++) {
          const gone = from.baseT[q * oN + ko] - ob.layerT[q * oN + ko]
          if (gone > 0) {
            const idx = q * N + k
            nb.layerT[idx] = Math.max(0, nb.layerT[idx] - gone)
            hit = true
          }
        }
        const dh = ob.height[ko] - from.baseHeight[ko]
        const edited = from.hEdit ? from.hEdit[ko] : 0
        if (edited !== 0) {
          if (!this.hEdit) this.hEdit = new Float32Array(N)
          this.hEdit[k] = edited
          hit = true
        }
        void dh
        if (hit) changed.push(k)
      }
    }
    for (const k of changed) {
      const j = (k / res) | 0
      this.recomposite(k, -this.size / 2 + ((k - j * res) + 0.5) * this.texel, -this.size / 2 + (j + 0.5) * this.texel)
      any = true
    }
    if (any) this.refreshContacts({ x0: 0, y0: 0, x1: res, y1: res })
    // loose layer: copy what the old runtime has left, inside its extent
    if (ob.loose && nb.loose) {
      const pr = nb.physRes
      const opr = ob.physRes
      for (let j = 0; j < pr; j++) {
        const y = -this.size / 2 + ((j + 0.5) / pr) * this.size
        const oj = Math.floor((y / from.size + 0.5) * opr)
        if (oj < 0 || oj >= opr) continue
        for (let i = 0; i < pr; i++) {
          const x = -this.size / 2 + ((i + 0.5) / pr) * this.size
          const oi = Math.floor((x / from.size + 0.5) * opr)
          if (oi < 0 || oi >= opr) continue
          nb.loose[j * pr + i] = ob.loose[oj * opr + oi]
        }
      }
    }
  }
}

export function createRuntime(bake: SurfaceBake, recipe: SurfaceRecipe, carryFrom?: SurfaceRuntime): SurfaceRuntime {
  const rt = new SurfaceRuntimeImpl(bake, recipe)
  if (carryFrom instanceof SurfaceRuntimeImpl) rt.adopt(carryFrom)
  return rt
}
