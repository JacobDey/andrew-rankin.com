// Local stand-in for @shared/surface's baker and runtime (texturedle.md §6.1,
// §5.2, §11.2). It bakes on the main thread (the shared module uses a worker)
// and is only used until src/shared/surface lands. API-compatible on purpose.

import type {
  SurfaceRecipe, SurfaceBake, SurfaceRuntime, ProbeKind, ContactField, ContactSample, MaterialPhys, RGB, TexRect, FormSpec, RecipeKit,
} from './surface-types'
import { HeightField } from '../sim/heightfield'
import { getRecipeLocal, blisterAt } from './recipes-local'
import { linToSrgb, srgbToLin, hexLin, smoothstep } from './noise'

interface Extra {
  nL: number
  base: Float32Array // form + substrate relief (mm)
  lAlb: Uint8Array // nL × res² × 3 sRGB
  lRough: Uint8Array // nL × res²
  metal: Uint8Array // nL
  blister: Float32Array | null
  fields: Record<ProbeKind, { src: HeightField; d: HeightField }>
}
const extras = new WeakMap<SurfaceBake, Extra>()

const PROBE_R: Record<ProbeKind, number> = { marble: 1.5, burlap: 0.45, lens: 0.08 }

function formHeight(f: FormSpec, x: number, y: number): number {
  if (f.kind === 'plane') return 0
  if (f.kind === 'cylinder') {
    const a = (f.axisDeg * Math.PI) / 180
    // distance across the axis
    const dx = x - f.crownOffsetMm[0]
    const dy = y - f.crownOffsetMm[1]
    const across = -dx * Math.sin(a) + dy * Math.cos(a)
    const R = f.radiusMm
    const u = Math.min(Math.abs(across), R * 0.999)
    const h = Math.sqrt(R * R - u * u) - R
    return f.concave ? -h : h
  }
  const R = f.radiusMm
  const r2 = x * x + y * y
  return r2 < R * R ? Math.sqrt(R * R - r2) - R : -R
}

function kit(seed: number): RecipeKit {
  return { seed, convexity: () => () => 0, cavity: () => () => 0, hex: (s) => hexLin(s) }
}

export interface BakeOpts { ratio: number; res: number; physRes: number; seed?: number; sizeMm?: number }

export async function bakeSurfaceLocal(recipe: SurfaceRecipe, opts: BakeOpts): Promise<SurfaceBake> {
  const t0 = performance.now()
  const seed = opts.seed ?? 1
  const res = opts.res
  const size = opts.sizeMm ?? 7.632
  const mpt = size / res
  const built = recipe.build(kit(seed))
  const L = [built.substrate, ...built.layers]
  const nL = L.length
  const N = res * res
  const base = new Float32Array(N)
  const layerT = new Uint16Array(nL * N)
  const lAlb = new Uint8Array(nL * N * 3)
  const lRough = new Uint8Array(nL * N)
  const blister = built.blisterMask ? new Float32Array(N) : null
  const rgb: RGB = [0, 0, 0]
  for (let j = 0; j < res; j++) {
    const y = -size / 2 + (j + 0.5) * mpt
    for (let i = 0; i < res; i++) {
      const x = -size / 2 + (i + 0.5) * mpt
      const k = j * res + i
      base[k] = formHeight(recipe.form, x, y) + (L[0].reliefUm ? L[0].reliefUm(x, y) / 1000 : 0)
      for (let l = 0; l < nL; l++) {
        const t = l === 0 ? 65535 : Math.max(0, Math.min(65000, L[l].thicknessUm(x, y)))
        layerT[l * N + k] = t
        L[l].albedo(x, y, rgb)
        const o = (l * N + k) * 3
        lAlb[o] = Math.round(linToSrgb(rgb[0]) * 255)
        lAlb[o + 1] = Math.round(linToSrgb(rgb[1]) * 255)
        lAlb[o + 2] = Math.round(linToSrgb(rgb[2]) * 255)
        const rf = L[l].roughness
        lRough[l * N + k] = Math.round(Math.max(0.02, Math.min(1, rf ? rf(x, y) : L[l].phys.roughness)) * 255)
      }
      if (blister && built.blisterMask) blister[k] = built.blisterMask(x, y)
    }
    if ((j & 31) === 31) await new Promise((r) => setTimeout(r, 0))
  }
  const height = new Float32Array(N)
  const albedo = new Uint8Array(N * 4)
  const orm = new Uint8Array(N * 4)
  const topLayer = new Uint8Array(N)
  const phys = L.map((l) => l.phys)
  const metal = new Uint8Array(phys.map((p) => Math.round(p.metalness * 255)))
  const bake: SurfaceBake = {
    recipeId: recipe.id, ratio: opts.ratio, seed, sizeMm: size, res, mmPerTexel: mpt,
    height, heightMips: [], albedo, orm, topLayer, layerT,
    physRes: opts.physRes, loose: null,
    contact: {} as Record<ProbeKind, ContactField>, snag: new Float32Array(0),
    audioRes: 0, audioHeight: new Float32Array(0), phys, ms: 0,
  }
  const ex: Extra = { nL, base, lAlb, lRough, metal, blister, fields: {} as Extra['fields'] }
  extras.set(bake, ex)
  compose(bake, ex, { x0: 0, y0: 0, x1: res - 1, y1: res - 1 })
  // cavity AO from a blurred height (coarse pass stand-in)
  const hf = new HeightField(res, res, size, size, height)
  const blur = hf.blur(Math.max(mpt * 2, 0.08), 2)
  for (let k = 0; k < N; k++) {
    const cav = Math.max(-1, Math.min(1, (height[k] - blur.data[k]) / 0.05))
    orm[k * 4] = Math.round((0.72 + 0.28 * smoothstep(-1, 0.4, cav)) * 255)
  }
  bake.heightMips = buildMips(height, res)
  // contact fields
  for (const p of ['marble', 'burlap', 'lens'] as ProbeKind[]) {
    const r = PROBE_R[p]
    const fr = Math.max(64, Math.min(256, Math.round(size / (r / 6))))
    const src = hf.maxPool(fr, fr)
    const d = src.dilate(r)
    ex.fields[p] = { src, d }
    bake.contact[p] = { res: fr, cellMm: size / fr, radiusMm: r, data: d.data }
  }
  // snag map at burlap resolution: hardness_top · clamp((−∇²Hσ − κ0)/κ1, 0, 1)
  {
    const f = ex.fields.burlap.src
    const fr = f.nx
    const sm = f.blur(0.1, 2)
    const s = new Float32Array(fr * fr)
    const h2 = f.dx * f.dx
    for (let j = 1; j < fr - 1; j++)
      for (let i = 1; i < fr - 1; i++) {
        const k = j * fr + i
        const lap = (sm.data[k - 1] + sm.data[k + 1] + sm.data[k - fr] + sm.data[k + fr] - 4 * sm.data[k]) / h2
        const x = -size / 2 + (i + 0.5) * f.dx
        const y = -size / 2 + (j + 0.5) * f.dy
        const ti = Math.min(res - 1, Math.max(0, Math.floor((x + size / 2) / mpt)))
        const tj = Math.min(res - 1, Math.max(0, Math.floor((y + size / 2) / mpt)))
        const hard = phys[topLayer[tj * res + ti]].hardness
        s[k] = hard * Math.max(0, Math.min(1, (-lap - 3) / 8))
      }
    bake.snag = s
  }
  // loose layer at physRes
  const P = opts.physRes
  if (built.looseInitUm) {
    const loose = new Float32Array(P * P)
    const pd = size / P
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) loose[j * P + i] = Math.max(0, built.looseInitUm(-size / 2 + (i + 0.5) * pd, -size / 2 + (j + 0.5) * pd))
    bake.loose = loose
  }
  // audio heightfield: high-passed at 1 mm
  {
    const ar = Math.min(512, res)
    const a = ar === res ? hf : hf.maxPool(ar, ar)
    const lo = a.blur(1, 2)
    const out = new Float32Array(ar * ar)
    for (let k = 0; k < out.length; k++) out[k] = a.data[k] - lo.data[k]
    bake.audioRes = ar
    bake.audioHeight = out
  }
  if (blister) {
    blisterAt.set(bake, (x, y) => {
      const i = Math.floor((x + size / 2) / mpt)
      const j = Math.floor((y + size / 2) / mpt)
      if (i < 0 || j < 0 || i >= res || j >= res) return 0
      return blister[j * res + i]
    })
  }
  bake.ms = performance.now() - t0
  return bake
}

function buildMips(h: Float32Array, res: number): Float32Array[] {
  const mips: Float32Array[] = []
  let src = h
  let n = res
  while (n > 1) {
    const m = n >> 1
    const d = new Float32Array(m * m)
    for (let j = 0; j < m; j++)
      for (let i = 0; i < m; i++) {
        const a = (2 * j) * n + 2 * i
        d[j * m + i] = 0.25 * (src[a] + src[a + 1] + src[a + n] + src[a + n + 1])
      }
    mips.push(d)
    src = d
    n = m
  }
  return mips
}

/** Rebuild height, top layer, albedo and ORM (G, B, A) in a texel rect. */
function compose(b: SurfaceBake, ex: Extra, r: TexRect): void {
  const res = b.res
  const N = res * res
  const { nL, base, lAlb, lRough, metal } = ex
  for (let j = r.y0; j <= r.y1; j++) {
    for (let i = r.x0; i <= r.x1; i++) {
      const k = j * res + i
      let sum = 0
      let top = 0
      for (let l = 1; l < nL; l++) {
        const t = b.layerT[l * N + k]
        if (t > 0) {
          sum += t
          top = l
        }
      }
      b.topLayer[k] = top
      b.height[k] = base[k] + sum / 1000
      // thin paint is translucent: blend toward the layer below under 8 µm
      const tt = top === 0 ? 65535 : b.layerT[top * N + k]
      let below = 0
      for (let l = top - 1; l >= 1; l--) if (b.layerT[l * N + k] > 0) { below = l; break }
      const w = top === 0 ? 1 : Math.min(1, tt / 8)
      const o1 = (top * N + k) * 3
      const o0 = (below * N + k) * 3
      b.albedo[k * 4] = lAlb[o0] + (lAlb[o1] - lAlb[o0]) * w
      b.albedo[k * 4 + 1] = lAlb[o0 + 1] + (lAlb[o1 + 1] - lAlb[o0 + 1]) * w
      b.albedo[k * 4 + 2] = lAlb[o0 + 2] + (lAlb[o1 + 2] - lAlb[o0 + 2]) * w
      b.albedo[k * 4 + 3] = 255
      b.orm[k * 4 + 1] = lRough[top * N + k]
      b.orm[k * 4 + 2] = metal[top]
      b.orm[k * 4 + 3] = 255
    }
  }
}

export function createRuntimeLocal(bake: SurfaceBake, recipe: SurfaceRecipe): SurfaceRuntime {
  const ex = extras.get(bake)
  if (!ex) throw new Error('createRuntimeLocal: not a local bake')
  const res = bake.res
  const N = res * res
  const size = bake.sizeMm
  const mpt = bake.mmPerTexel
  const subs: Array<(r: TexRect, what: 'height' | 'albedo' | 'orm' | 'loose') => void> = []
  const fire = (r: TexRect, what: 'height' | 'albedo' | 'orm' | 'loose') => { for (const s of subs) s(r, what) }
  const revealedEver = new Set<number>()
  const tex = (x: number) => Math.floor((x + size / 2) / mpt)
  const topAt = (x: number, y: number) => {
    const i = Math.min(res - 1, Math.max(0, tex(x)))
    const j = Math.min(res - 1, Math.max(0, tex(y)))
    return bake.topLayer[j * res + i]
  }
  // initial revealed: every top layer present at bake time
  for (let k = 0; k < N; k += 7) revealedEver.add(bake.topLayer[k])
  const hs = { h: 0, gx: 0, gy: 0 }

  function refreshContact(r: TexRect): void {
    // re-pool + re-dilate the touched region of each contact field
    const hf = new HeightField(res, res, size, size, bake.height)
    for (const p of ['marble', 'burlap', 'lens'] as ProbeKind[]) {
      const F = ex!.fields[p]
      const fr = F.src.nx
      const f = fr / res
      const pad = Math.ceil(PROBE_R[p] / F.src.dx) + 1
      const i0 = Math.max(0, Math.floor(r.x0 * f) - 1)
      const i1 = Math.min(fr - 1, Math.ceil(r.x1 * f) + 1)
      const j0 = Math.max(0, Math.floor(r.y0 * f) - 1)
      const j1 = Math.min(fr - 1, Math.ceil(r.y1 * f) + 1)
      // max pool
      const bs = res / fr
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          let m = -Infinity
          const ja = Math.floor(j * bs)
          const jb = Math.max(ja + 1, Math.floor((j + 1) * bs))
          const ia = Math.floor(i * bs)
          const ib = Math.max(ia + 1, Math.floor((i + 1) * bs))
          for (let jj = ja; jj < jb; jj++) for (let ii = ia; ii < ib; ii++) { const v = hf.data[jj * res + ii]; if (v > m) m = v }
          F.src.data[j * fr + i] = m
        }
      // dilate the padded region
      const rr = PROBE_R[p]
      const dx = F.src.dx
      const ri = Math.ceil(rr / dx)
      for (let j = Math.max(0, j0 - pad); j <= Math.min(fr - 1, j1 + pad); j++)
        for (let i = Math.max(0, i0 - pad); i <= Math.min(fr - 1, i1 + pad); i++) {
          let best = -Infinity
          for (let dj = -ri; dj <= ri; dj++) {
            const jj = Math.min(fr - 1, Math.max(0, j + dj))
            for (let di = -ri; di <= ri; di++) {
              const d2 = (di * dx) ** 2 + (dj * dx) ** 2
              if (d2 > rr * rr) continue
              const ii = Math.min(fr - 1, Math.max(0, i + di))
              const v = F.src.data[jj * fr + ii] + Math.sqrt(rr * rr - d2) - rr
              if (v > best) best = v
            }
          }
          F.d.data[j * fr + i] = best
        }
      F.d.invalidate()
    }
  }

  const rt: SurfaceRuntime = {
    bake, recipe,
    contactAt(p, x, y, out: ContactSample) {
      ex.fields[p].d.sampleGrad(x, y, hs)
      out.d = hs.h
      const l = 1 / Math.sqrt(hs.gx * hs.gx + hs.gy * hs.gy + 1)
      out.nx = -hs.gx * l
      out.ny = -hs.gy * l
      out.nz = l
      out.layer = topAt(x, y)
      return out
    },
    materialAt(x, y): MaterialPhys { return bake.phys[topAt(x, y)] },
    residueAt(x, y) { const r = bake.phys[topAt(x, y)].residue; return r ? { rgb: r.rgb, rate: r.rate, kind: r.kind } : null },
    snagAt(x, y) {
      const f = bake.contact.burlap
      const i = Math.min(f.res - 1, Math.max(0, Math.floor((x + size / 2) / f.cellMm)))
      const j = Math.min(f.res - 1, Math.max(0, Math.floor((y + size / 2) / f.cellMm)))
      return bake.snag[j * f.res + i] ?? 0
    },
    abradeBatch(splats, n) {
      const revealed: number[] = []
      const removed: RGB[] = []
      if (n <= 0) return { revealed, removed }
      let rx0 = res, ry0 = res, rx1 = -1, ry1 = -1
      const remTot = new Float64Array(ex.nL)
      for (let s = 0; s < n; s++) {
        const x = splats[s * 4], y = splats[s * 4 + 1], rMm = splats[s * 4 + 2], dep = splats[s * 4 + 3]
        if (dep <= 0) continue
        const ci = (x + size / 2) / mpt - 0.5
        const cj = (y + size / 2) / mpt - 0.5
        const rt2 = rMm / mpt
        const i0 = Math.max(0, Math.floor(ci - rt2)), i1 = Math.min(res - 1, Math.ceil(ci + rt2))
        const j0 = Math.max(0, Math.floor(cj - rt2)), j1 = Math.min(res - 1, Math.ceil(cj + rt2))
        if (i0 > i1 || j0 > j1) continue
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const d2 = ((i - ci) ** 2 + (j - cj) ** 2) / (rt2 * rt2)
            if (d2 > 1) continue
            const k = j * res + i
            let left = dep * (1 - d2 * 0.6)
            // grind through layers from the top; harder layers resist more
            for (let l = ex.nL - 1; l >= 1 && left > 0; l--) {
              const idx = l * N + k
              const t = bake.layerT[idx]
              if (t === 0) continue
              // depth is already hardness-scaled by the bench (Archard); harder
              // layers below take proportionally less of the remainder
              const take = Math.min(t, left)
              const nt = Math.max(0, Math.round(t - take))
              if (nt !== t) {
                remTot[l] += t - nt
                bake.layerT[idx] = nt
              }
              left -= take
              if (nt > 0) break
              left *= bake.phys[l].hardness / Math.max(0.15, bake.phys[l - 1].hardness)
            }
            // the steel itself barely wears (relief), so stop there
          }
        rx0 = Math.min(rx0, i0); ry0 = Math.min(ry0, j0); rx1 = Math.max(rx1, i1); ry1 = Math.max(ry1, j1)
      }
      if (rx1 < 0) return { revealed, removed }
      const r: TexRect = { x0: rx0, y0: ry0, x1: rx1, y1: ry1 }
      compose(bake, ex, r)
      for (let j = ry0; j <= ry1; j++) for (let i = rx0; i <= rx1; i++) {
        const t = bake.topLayer[j * res + i]
        if (!revealedEver.has(t)) { revealedEver.add(t); revealed.push(t) }
      }
      for (let l = 1; l < ex.nL; l++) if (remTot[l] > 2) {
        const o = (l * N + (ry0 * res + rx0)) * 3
        removed.push([srgbToLin(ex.lAlb[o] / 255), srgbToLin(ex.lAlb[o + 1] / 255), srgbToLin(ex.lAlb[o + 2] / 255)])
      }
      refreshContact(r)
      fire(r, 'height'); fire(r, 'albedo'); fire(r, 'orm')
      return { revealed, removed }
    },
    polishBatch(splats, n) {
      if (n <= 0) return
      let rx0 = res, ry0 = res, rx1 = -1, ry1 = -1
      for (let s = 0; s < n; s++) {
        const x = splats[s * 4], y = splats[s * 4 + 1], rMm = splats[s * 4 + 2], amt = splats[s * 4 + 3]
        const ci = (x + size / 2) / mpt - 0.5, cj = (y + size / 2) / mpt - 0.5, rt2 = rMm / mpt
        const i0 = Math.max(0, Math.floor(ci - rt2)), i1 = Math.min(res - 1, Math.ceil(ci + rt2))
        const j0 = Math.max(0, Math.floor(cj - rt2)), j1 = Math.min(res - 1, Math.ceil(cj + rt2))
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = j * res + i
          const ph = bake.phys[bake.topLayer[k]]
          if (!ph.polish) continue
          const min = Math.round((ph.roughnessMin ?? 0.1) * 255)
          const cur = bake.orm[k * 4 + 1]
          const nv = Math.max(min, cur - ph.polish * amt * 255)
          bake.orm[k * 4 + 1] = nv
          ex.lRough[bake.topLayer[k] * N + k] = nv
        }
        if (i0 <= i1) { rx0 = Math.min(rx0, i0); ry0 = Math.min(ry0, j0); rx1 = Math.max(rx1, i1); ry1 = Math.max(ry1, j1) }
      }
      if (rx1 >= 0) fire({ x0: rx0, y0: ry0, x1: rx1, y1: ry1 }, 'orm')
    },
    takeLoose(x, y, rMm, um) {
      const L = bake.loose
      if (!L) return 0
      const P = bake.physRes
      const pd = size / P
      const ci = (x + size / 2) / pd - 0.5, cj = (y + size / 2) / pd - 0.5, rr = rMm / pd
      let took = 0
      for (let j = Math.max(0, Math.floor(cj - rr)); j <= Math.min(P - 1, Math.ceil(cj + rr)); j++)
        for (let i = Math.max(0, Math.floor(ci - rr)); i <= Math.min(P - 1, Math.ceil(ci + rr)); i++) {
          if ((i - ci) ** 2 + (j - cj) ** 2 > rr * rr) continue
          const k = j * P + i
          const t = Math.min(L[k], um)
          L[k] -= t
          took += t
        }
      return took
    },
    editHeight(x, y, rMm, fn) {
      const ci = (x + size / 2) / mpt - 0.5, cj = (y + size / 2) / mpt - 0.5, rt2 = rMm / mpt
      const i0 = Math.max(0, Math.floor(ci - rt2)), i1 = Math.min(res - 1, Math.ceil(ci + rt2))
      const j0 = Math.max(0, Math.floor(cj - rt2)), j1 = Math.min(res - 1, Math.ceil(cj + rt2))
      if (i0 > i1 || j0 > j1) return
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i - ci, j - cj) * mpt
        if (d > rMm) continue
        const k = j * res + i
        const h0 = bake.height[k]
        const h1 = fn(h0, d)
        ex.base[k] += h1 - h0
        bake.height[k] = h1
      }
      const r = { x0: i0, y0: j0, x1: i1, y1: j1 }
      refreshContact(r)
      fire(r, 'height')
    },
    markLooseDirty(r) { fire(r, 'loose') },
    onDirty(cb) { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1) } },
  }
  return rt
}

/** CPU-lit thumbnail (lamp from upper left). */
export async function thumbnailLocal(recipeId: string, px: number, lampAzDeg = 135): Promise<ImageData> {
  const b = await bakeSurfaceLocal(getRecipeLocal(recipeId), { ratio: 0, res: px, physRes: 32, sizeMm: 7.632 })
  const img = new ImageData(px, px)
  const az = (lampAzDeg * Math.PI) / 180
  const lx = Math.cos(az) * Math.cos(0.5), ly = Math.sin(az) * Math.cos(0.5), lz = Math.sin(0.5)
  const m = b.mmPerTexel
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const k = j * px + i
    const hx = (b.height[j * px + Math.min(px - 1, i + 1)] - b.height[j * px + Math.max(0, i - 1)]) / (2 * m)
    const hy = (b.height[Math.min(px - 1, j + 1) * px + i] - b.height[Math.max(0, j - 1) * px + i]) / (2 * m)
    const l = 1 / Math.hypot(hx, hy, 1)
    const nd = Math.max(0, (-hx * lx - hy * ly + lz) * l)
    const sh = 0.25 + 1.6 * nd
    const o = ((px - 1 - j) * px + i) * 4
    for (let c = 0; c < 3; c++) img.data[o + c] = Math.min(255, Math.round(linToSrgb(srgbToLin(b.albedo[k * 4 + c] / 255) * sh) * 255))
    img.data[o + 3] = 255
  }
  return img
}
