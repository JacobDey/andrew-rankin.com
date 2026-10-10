// The recipe kit: field primitives and combinators (texturedle.md section 6.1). Every primitive returns a
// `Field`: a pure function of specimen millimetres, seeded from `kit.seed` plus a salt, so the baker can
// evaluate it on any grid at any ratio and a pit at 5:1 is the same pit at 2:1.
import { gradientNoise2, fbm2, ridged2, worley2, mulberry32, hash2i, type FbmOptions, type WorleyHit } from './noise'
import { hexToLinear, paletteFn, solid, tintFn, blendFn } from './colour'
import { glyphField } from './glyphs'
import type { Field, FieldLike, RecipeKit, WorleyOpts } from './types'

const DEG = Math.PI / 180

/** Coarse relief-derived maps (pass 1 of the bake): cavity / convexity in 0..1 over [-size/2, size/2]^2. */
export interface CoarseMaps {
  n: number
  size: number
  convexity: Float32Array | null
  cavity: Float32Array | null
}

export interface Kit extends RecipeKit {
  readonly coarse: CoarseMaps
  /** Bake extent (mm) used by cache() and scratches(). */
  readonly sizeMm: number
  /** Drop every cache() grid (called after pass 1, once cavity / convexity exist). */
  resetCaches(): void
}

const lift = (f: FieldLike): Field => (typeof f === 'number' ? (() => f) : f)

function sampleGrid(g: Float32Array, n: number, size: number, x: number, y: number): number {
  let fx = (x / size + 0.5) * n - 0.5
  let fy = (y / size + 0.5) * n - 0.5
  fx = fx < 0 ? 0 : fx > n - 1.001 ? n - 1.001 : fx
  fy = fy < 0 ? 0 : fy > n - 1.001 ? n - 1.001 : fy
  const i = fx | 0
  const j = fy | 0
  const tx = fx - i
  const ty = fy - j
  const k = j * n + i
  const a = g[k] + (g[k + 1] - g[k]) * tx
  const b = g[k + n] + (g[k + n + 1] - g[k + n]) * tx
  return a + (b - a) * ty
}

export function createKit(seed: number, o: { sizeMm?: number } = {}): Kit {
  const sizeMm = o.sizeMm ?? 80
  const coarse: CoarseMaps = { n: 128, size: sizeMm, convexity: null, cavity: null }
  let counter = 0
  const saltOf = (s?: number): number => {
    const k = s ?? ++counter
    return (seed + Math.imul(k + 1, 0x9e3779b1)) | 0
  }

  const fbm: RecipeKit['fbm'] = (p) => {
    const sx = (p.stretch?.[0] ?? 1) / p.scale
    const sy = (p.stretch?.[1] ?? 1) / p.scale
    const sd = saltOf(p.salt)
    const opts: FbmOptions = { octaves: p.oct ?? 4, gain: p.gain ?? 0.5, lacunarity: p.lac ?? 2.03, seed: sd, basis: 'gradient' }
    const w = p.warp ?? 0
    if (!w) return (x, y) => fbm2(x * sx, y * sy, opts)
    const wsd = sd + 77
    return (x, y) => {
      const wx = w * gradientNoise2(x * sx * 0.7 + 17.3, y * sy * 0.7, wsd)
      const wy = w * gradientNoise2(x * sx * 0.7, y * sy * 0.7 + 31.9, wsd + 1)
      return fbm2((x + wx) * sx, (y + wy) * sy, opts)
    }
  }

  const ridged: RecipeKit['ridged'] = (p) => {
    const sx = (p.stretch?.[0] ?? 1) / p.scale
    const sy = (p.stretch?.[1] ?? 1) / p.scale
    const opts: FbmOptions = { octaves: p.oct ?? 4, gain: p.gain ?? 0.5, lacunarity: p.lac ?? 2.03, seed: saltOf(p.salt) }
    return (x, y) => ridged2(x * sx, y * sy, opts)
  }

  const worley = (p: WorleyOpts): Field => {
    const cell = p.cell
    const inv = 1 / cell
    const wo = { jitter: p.jitter ?? 0.9, seed: saltOf(p.salt) }
    const out: WorleyHit = { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 }
    switch (p.out ?? 'f1') {
      case 'f2': return (x, y) => worley2(x * inv, y * inv, wo, out).f2 * cell
      case 'edge': return (x, y) => { const h = worley2(x * inv, y * inv, wo, out); return (h.f2 - h.f1) * cell }
      case 'id': return (x, y) => worley2(x * inv, y * inv, wo, out).id / 4294967296
      default: return (x, y) => worley2(x * inv, y * inv, wo, out).f1 * cell
    }
  }

  const stripes: RecipeKit['stripes'] = (p) => {
    const a = p.angleDeg * DEG
    const sn = Math.sin(a)
    const cs = Math.cos(a)
    const inv = 1 / p.period
    const warp = p.warp === undefined ? null : lift(p.warp)
    const prof = p.profile ?? 'sine'
    return (x, y) => {
      let ph = (-x * sn + y * cs) * inv
      if (warp) ph += warp(x, y)
      const f = ph - Math.floor(ph)
      switch (prof) {
        case 'tri': return 1 - Math.abs(2 * f - 1)
        case 'square': return f < 0.5 ? 1 : 0
        case 'wale': { const u = 2 * f - 1; return Math.sqrt(Math.max(0, 1 - u * u)) }
        default: return 0.5 + 0.5 * Math.sin(2 * Math.PI * ph)
      }
    }
  }

  const weave: RecipeKit['weave'] = (p) => {
    const kind = p.kind ?? 'plain'
    const relief = p.yarnRelief ?? 1
    const sd = saltOf()
    return (x, y) => {
      const fx = x / p.warp
      const fy = y / p.weft
      const i = Math.floor(fx)
      const j = Math.floor(fy)
      const u = fx - i
      const v = fy - j
      if (kind === 'loop') {
        // terry loops: a dome per cell with a random height, plus a little ring structure
        const hh = 0.55 + 0.45 * (hash2i(i, j, sd) / 4294967296)
        const du = u - 0.5
        const dv = v - 0.5
        const r2 = (du * du + dv * dv) * 4
        return r2 < 1 ? hh * Math.sqrt(1 - r2) * relief : 0
      }
      const pw = Math.sin(Math.PI * u) // warp yarn: runs along y, rounded across x
      const pe = Math.sin(Math.PI * v) // weft yarn: runs along x, rounded across y
      const over = kind === 'twill3x1' ? ((i + j) % 4 + 4) % 4 < 3 : (((i + j) % 2) + 2) % 2 === 0
      const h = over ? 0.45 + 0.55 * pw * (0.75 + 0.25 * pe) : 0.4 * pe * (0.7 + 0.3 * pw)
      return h * relief
    }
  }

  const hexDomes: RecipeKit['hexDomes'] = (p) => {
    const dy = p.cell * 0.8660254
    const R = p.radius
    const prof = p.profile ?? 'dome'
    return (x, y) => {
      const j0 = Math.round(y / dy)
      let best = 1e9
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        const off = (j & 1) * 0.5 * p.cell
        const i = Math.round((x - off) / p.cell)
        for (let di = -1; di <= 1; di++) {
          const cx = (i + di) * p.cell + off
          const ddx = x - cx
          const ddy = y - j * dy
          const d = ddx * ddx + ddy * ddy
          if (d < best) best = d
        }
      }
      const r = Math.sqrt(best)
      if (r >= R) return 0
      const t = r / R
      if (prof === 'cone') return p.height * (1 - t)
      if (prof === 'flat') return p.height * (1 - Math.pow(t, 6))
      return p.height * Math.sqrt(1 - t * t)
    }
  }

  const cracks: RecipeKit['cracks'] = (p) => {
    const e = worley({ cell: p.cell, jitter: p.jitter ?? 0.95, out: 'edge', salt: p.salt })
    const curl = p.curl ?? 0
    return (x, y) => {
      const d = e(x, y)
      let v = 0
      if (d < p.width) { const t = 1 - d / p.width; v = p.depth * t * t * (3 - 2 * t) }
      if (curl) {
        const l = d > p.width * 4 ? 0 : d <= p.width ? 1 : 1 - (d - p.width) / (p.width * 3)
        v -= curl * l * l
      }
      return v
    }
  }

  const blobs: RecipeKit['blobs'] = (p) => {
    const sd = saltOf(p.salt)
    const c = p.cell
    const inv = 1 / c
    // Centres sit in [0.15, 0.85] of their cell: a blob no bigger than 0.15 cell never leaves its own cell.
    const reach = p.r[1] > 0.15 * c ? 1 : 0
    return (x, y) => {
      const gx = Math.floor(x * inv)
      const gy = Math.floor(y * inv)
      let best = 0
      for (let j = -reach; j <= reach; j++) {
        for (let i = -reach; i <= reach; i++) {
          const cx = gx + i
          const cy = gy + j
          const h = hash2i(cx, cy, sd)
          if (h / 4294967296 >= p.density) continue
          const px = (cx + 0.15 + 0.7 * ((h & 0xffff) / 65536)) * c
          const py = (cy + 0.15 + 0.7 * (((h >>> 16) & 0xffff) / 65536)) * c
          const r = p.r[0] + (p.r[1] - p.r[0]) * ((hash2i(cx + 91, cy - 17, sd) >>> 8) / 16777216)
          const dx = x - px
          const dy = y - py
          const d2 = (dx * dx + dy * dy) / (r * r)
          if (d2 >= 1) continue
          const v = p.height * Math.sqrt(1 - d2) * (0.7 + 0.3 * ((h >>> 5) & 7) / 7)
          if (v > best) best = v
        }
      }
      return best
    }
  }

  const scratches: RecipeKit['scratches'] = (p) => {
    const ext = p.extentMm ?? Math.max(sizeMm, 20)
    const rand = mulberry32(saltOf(p.salt))
    const segs: { ax: number; ay: number; ux: number; uy: number; len: number; w: number; wob: number }[] = []
    for (let s = 0; s < p.n; s++) {
      const len = p.len[0] + (p.len[1] - p.len[0]) * rand()
      const w = p.width[0] + (p.width[1] - p.width[0]) * rand()
      const cx = (rand() - 0.5) * ext
      const cy = (rand() - 0.5) * ext
      let ang: number
      if (p.arcAbout) ang = Math.atan2(cy - p.arcAbout[1], cx - p.arcAbout[0]) + Math.PI / 2 + (rand() - 0.5) * 0.3
      else if (p.dirDeg !== undefined) ang = p.dirDeg * DEG + (rand() - 0.5) * (p.dirSpread ?? 0.3)
      else ang = rand() * Math.PI
      const ux = Math.cos(ang)
      const uy = Math.sin(ang)
      segs.push({ ax: cx - (ux * len) / 2, ay: cy - (uy * len) / 2, ux, uy, len, w, wob: rand() * 100 })
    }
    // spatial hash (4 mm buckets) over the window
    const B = 4
    const buckets = new Map<number, number[]>()
    const key = (i: number, j: number): number => (i + 4096) * 8192 + (j + 4096)
    segs.forEach((s, idx) => {
      const x0 = Math.min(s.ax, s.ax + s.ux * s.len) - s.w * 2
      const x1 = Math.max(s.ax, s.ax + s.ux * s.len) + s.w * 2
      const y0 = Math.min(s.ay, s.ay + s.uy * s.len) - s.w * 2
      const y1 = Math.max(s.ay, s.ay + s.uy * s.len) + s.w * 2
      for (let j = Math.floor(y0 / B); j <= Math.floor(y1 / B); j++) {
        for (let i = Math.floor(x0 / B); i <= Math.floor(x1 / B); i++) {
          const k = key(i, j)
          const l = buckets.get(k)
          if (l) l.push(idx)
          else buckets.set(k, [idx])
        }
      }
    })
    const wsd = saltOf()
    return (x, y) => {
      const l = buckets.get(key(Math.floor(x / B), Math.floor(y / B)))
      if (!l) return 0
      let best = 0
      for (let q = 0; q < l.length; q++) {
        const S = segs[l[q]]
        const px = x - S.ax
        const py = y - S.ay
        const t = px * S.ux + py * S.uy
        if (t < -S.w || t > S.len + S.w) continue
        const tc = t < 0 ? 0 : t > S.len ? S.len : t
        let d = Math.abs(px * S.uy - py * S.ux) + S.w * 0.35 * gradientNoise2(t * 0.8 + S.wob, 0.5, wsd)
        if (t !== tc) d = Math.hypot(t - tc, d)
        const taper = Math.min(1, tc / 1.2) * Math.min(1, (S.len - tc) / 2)
        const w = S.w * (0.35 + 0.65 * Math.max(0, taper))
        if (d > w) continue
        const u = d / w
        const m = (1 - u * u) * Math.max(0.2, taper)
        if (m > best) best = m
      }
      return best
    }
  }

  const grooves: RecipeKit['grooves'] = (p) => {
    const [cx, cy] = p.centre
    return (x, y) => {
      const r = Math.hypot(x - cx, y - cy) / p.pitch
      const idx = Math.floor(r)
      const f = r - idx
      const v = 1 - Math.abs(f - 0.5) / 0.25
      if (v <= 0) return 0
      return p.depth * v * (p.melody ? p.melody(idx) : 1)
    }
  }

  const ring: RecipeKit['ring'] = (p) => {
    const [cx, cy] = p.centre
    const half = p.width / 2
    const soft = p.width * 0.35
    return (x, y) => {
      const d = Math.abs(Math.hypot(x - cx, y - cy) - p.r)
      if (d <= half) return 1
      if (d >= half + soft) return 0
      const u = 1 - (d - half) / soft
      return u * u * (3 - 2 * u)
    }
  }

  const streak: RecipeKit['streak'] = (p) => {
    const a = p.dirDeg * DEG
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const n = p.samples ?? 6
    return (x, y) => {
      let best = 0
      for (let k = 0; k <= n; k++) {
        const t = k / n
        const v = p.src(x - ux * t * p.lenMm, y - uy * t * p.lenMm) * (1 - t)
        if (v > best) best = v
      }
      return best
    }
  }

  const add: RecipeKit['add'] = (...fs) => {
    const f = fs.map(lift)
    return (x, y) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i](x, y); return s }
  }
  const mul: RecipeKit['mul'] = (...fs) => {
    const f = fs.map(lift)
    return (x, y) => { let s = 1; for (let i = 0; i < f.length; i++) { s *= f[i](x, y); if (s === 0) return 0 } return s }
  }
  const max: RecipeKit['max'] = (...fs) => {
    const f = fs.map(lift)
    return (x, y) => { let s = -Infinity; for (let i = 0; i < f.length; i++) { const v = f[i](x, y); if (v > s) s = v } return s }
  }
  const min: RecipeKit['min'] = (...fs) => {
    const f = fs.map(lift)
    return (x, y) => { let s = Infinity; for (let i = 0; i < f.length; i++) { const v = f[i](x, y); if (v < s) s = v } return s }
  }

  const resets: (() => void)[] = []
  const cache: RecipeKit['cache'] = (f, cellMm) => {
    let grid: Float32Array | null = null
    resets.push(() => { grid = null })
    const margin = cellMm * 2
    const S = sizeMm + 2 * margin
    const n = Math.min(640, Math.max(8, Math.ceil(S / cellMm)))
    return (x, y) => {
      if (!grid) {
        grid = new Float32Array(n * n)
        for (let j = 0; j < n; j++) {
          const yy = ((j + 0.5) / n - 0.5) * S
          for (let i = 0; i < n; i++) grid[j * n + i] = f(((i + 0.5) / n - 0.5) * S, yy)
        }
      }
      return sampleGrid(grid, n, S, x, y)
    }
  }

  return {
    seed,
    sizeMm,
    coarse,
    resetCaches: () => { for (const r of resets) r() },
    hex: hexToLinear,
    convexity: () => (x, y) => (coarse.convexity ? sampleGrid(coarse.convexity, coarse.n, coarse.size, x, y) : 0),
    cavity: () => (x, y) => (coarse.cavity ? sampleGrid(coarse.cavity, coarse.n, coarse.size, x, y) : 0),
    fbm,
    ridged,
    worley,
    stripes,
    weave,
    hexDomes,
    cracks,
    blobs,
    scratches,
    grooves,
    ring,
    glyph: (p) => glyphField(p.text, p.at, p.size, p.stroke),
    streak,
    add,
    sub: (a, b) => { const fa = lift(a); const fb = lift(b); return (x, y) => fa(x, y) - fb(x, y) },
    mul,
    max,
    min,
    mix: (a, b, t) => { const fa = lift(a); const fb = lift(b); const ft = lift(t); return (x, y) => { const u = ft(x, y); const va = fa(x, y); return va + (fb(x, y) - va) * u } },
    smooth: (f, e0, e1) => {
      const ff = lift(f)
      return (x, y) => { const t = Math.min(1, Math.max(0, (ff(x, y) - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
    },
    clamp: (f, lo, hi) => { const ff = lift(f); return (x, y) => { const v = ff(x, y); return v < lo ? lo : v > hi ? hi : v } },
    scale: (f, s, offset = 0) => { const ff = lift(f); return (x, y) => ff(x, y) * s + offset },
    rotate: (f, deg, cx = 0, cy = 0) => {
      const a = -deg * DEG
      const c = Math.cos(a)
      const s = Math.sin(a)
      return (x, y) => { const dx = x - cx; const dy = y - cy; return f(cx + dx * c - dy * s, cy + dx * s + dy * c) }
    },
    warp: (f, w) => {
      if ('dx' in w) return (x, y) => f(x + w.dx(x, y), y + w.dy(x, y))
      const sd = saltOf(w.salt)
      const inv = 1 / w.scale
      return (x, y) => f(x + w.amp * gradientNoise2(x * inv, y * inv, sd), y + w.amp * gradientNoise2(x * inv + 41.7, y * inv - 13.3, sd + 1))
    },
    palette: (stops, t) => paletteFn(stops, t),
    tint: tintFn,
    solid,
    blend: blendFn,
    cache,
    memo: (f) => {
      let lx = NaN
      let ly = NaN
      let lv = 0
      return (x, y) => { if (x === lx && y === ly) return lv; lx = x; ly = y; lv = f(x, y); return lv }
    },
    rng: (salt) => mulberry32(saltOf(salt)),
  }
}
