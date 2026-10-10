// Local stand-in recipes (Day 1 mailbox + the hub poster), written in the
// @shared/surface recipe grammar so they can be dropped the moment the shared
// library lands. Glue only: the real recipes live in src/shared/surface/recipes.

import type { LayerSpec, RGB, SurfaceRecipe, MaterialPhys, BenchEventLike, SurfaceRuntime, SecretHit } from './surface-types'
import { fbm, gnoise, ridged, worley, worleyHit, hash2, smoothstep, clamp, mix, hexLin } from './noise'

const lerp3 = (out: RGB, a: RGB, b: RGB, t: number): RGB => {
  out[0] = a[0] + (b[0] - a[0]) * t
  out[1] = a[1] + (b[1] - a[1]) * t
  out[2] = a[2] + (b[2] - a[2]) * t
  return out
}

// ---------------------------------------------------------------- mailbox ----
const STEEL: MaterialPhys = { hardness: 0.9, muS: 0.4, muK: 0.3, restitution: 0.55, rollResist: 0.004, metalness: 1, roughness: 0.35 }
const WHITE_RUST: MaterialPhys = { hardness: 0.2, muS: 0.6, muK: 0.5, restitution: 0.3, rollResist: 0.02, metalness: 0, roughness: 0.95, residue: { rgb: hexLin('#D9D6CC'), rate: 0.6, kind: 'powder' } }
const PRIMER: MaterialPhys = { hardness: 0.4, muS: 0.5, muK: 0.4, restitution: 0.4, rollResist: 0.008, metalness: 0, roughness: 0.7, residue: { rgb: hexLin('#8E3B2A'), rate: 0.08, kind: 'powder' } }
const ENAMEL: MaterialPhys = { hardness: 0.35, muS: 0.35, muK: 0.3, restitution: 0.45, rollResist: 0.006, metalness: 0, roughness: 0.55, roughnessMin: 0.25, polish: 0.2, residue: { rgb: hexLin('#8FA58C'), rate: 0.15, kind: 'powder' } }
const RUST: MaterialPhys = { hardness: 0.25, muS: 0.85, muK: 0.6, restitution: 0.2, rollResist: 0.03, metalness: 0, roughness: 0.9, residue: { rgb: hexLin('#B8602C'), rate: 0.8, kind: 'powder' } }

function mailbox(): SurfaceRecipe {
  const recipe: SurfaceRecipe = {
    id: 'rusty-mailbox', no: 1, atlasId: 'rusty-mailbox', name: 'Rusty mailbox', binomial: 'Ferrum rubiginosum, var. capsa epistularis',
    orientation: 'floor',
    form: { kind: 'cylinder', radiusMm: 120, axisDeg: 90, crownOffsetMm: [-6, 0] },
    body: { preset: 'hollow-sheet', modes: [[212, 1.12, 1], [337, 0.88, 0.7], [529, 0.72, 0.5], [811, 0.56, 0.35], [1240, 0.48, 0.25]], rattle: true },
    aniso: { dirDeg: 90, strength: 0.4 },
    streakDirDeg: 0,
    loose: { rgb: hexLin('#A0522D'), reposeDeg: 38, grain: 'flake' },
    tell: 'The lens cloth comes away rust-orange, the burlap scrubs green to red to grey metal, and every drop rings hollow.',
    secret: { id: 'pop-blister', text: 'Pop a blister: throw the marble hard at one and the paint shell cracks.' },
    card: {
      title: 'No. 001 · Rusty mailbox, lid',
      caption: 'Galvanized steel under green enamel, on the curve of a lid that has shed a few thousand rainstorms. The zinc went first, spending itself to protect the steel, and that white crust is the evidence. Then the iron did what iron has always wanted to do. The orange is lepidocrocite and the brown is goethite: rust is a family, not a colour. It takes up several times the room of the metal it eats, which is why it lifts paint into blisters instead of just staining it.',
      exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 7-frame stack @ 60 µm · raking 15°',
    },
    reveal: { prop: 'mailbox', scene: 'drive' },
    pool: true,
    build(k) {
      const seed = k.seed
      const W = worleyHit()
      const Wp = worleyHit()
      const Wc = worleyHit()
      // per-texel context, memoized: every layer function is called at the same (x, y) in turn
      let lx = NaN
      let ly = NaN
      const c = { front: 0, blister: 0, blisterProx: 0, crack: 0, pit: 0, pitW: 0, rib: 0, scratch: 0, streak: 0, chalk: 0, peel: 0, mound: 0, rv: 0, speck: 0, spangle: 0, mill: 0, white: 0 }
      const frontRaw = (x: number, y: number) => {
        const ribD = Math.abs(y - 2.4)
        return fbm(x / 2.5, y / 2.5, seed + 11, 4) * 0.9 + 0.22 * fbm(x / 0.7, y / 0.7, seed + 12, 3) + 0.35 * Math.exp(-((ribD / 1.1) ** 2)) + 0.42 - 0.15 + 0.012 * x
      }
      // the rust front is smooth: cache it on a lazy 0.05 mm grid (±40 mm) and interpolate
      const FG = 0.05, FN = 1600, FO = 40
      const fgrid = new Float32Array(FN * FN).fill(NaN)
      const node = (i: number, j: number) => {
        const ii = i < 0 ? 0 : i >= FN ? FN - 1 : i, jj = j < 0 ? 0 : j >= FN ? FN - 1 : j
        const k = jj * FN + ii
        let v = fgrid[k]
        if (v !== v) { v = frontRaw(ii * FG - FO, jj * FG - FO); fgrid[k] = v }
        return v
      }
      const front = (x: number, y: number) => {
        const fx = (x + FO) / FG, fy = (y + FO) / FG
        const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j
        const a = node(i, j) + (node(i + 1, j) - node(i, j)) * tx
        const b = node(i, j + 1) + (node(i + 1, j + 1) - node(i, j + 1)) * tx
        return a + (b - a) * ty
      }
      // scratches: 6 slightly curved lines
      const scr: { ax: number; ay: number; ux: number; uy: number; len: number; w: number; d: number }[] = []
      for (let s = 0; s < 6; s++) {
        const a = 2.6 + (hash2(s, 1, seed) - 0.5) * 0.6
        const len = 3 + hash2(s, 2, seed) * 9
        const cx = (hash2(s, 3, seed) - 0.5) * 9
        const cy = (hash2(s, 4, seed) - 0.5) * 7
        scr.push({ ax: cx - (Math.cos(a) * len) / 2, ay: cy - (Math.sin(a) * len) / 2, ux: Math.cos(a), uy: Math.sin(a), len, w: 0.015 + hash2(s, 5, seed) * 0.025, d: 20 + hash2(s, 6, seed) * 20 })
      }
      const ctx = (x: number, y: number) => {
        if (x === lx && y === ly) return c
        lx = x
        ly = y
        const f = front(x, y)
        c.front = f
        // blisters (worley cell 2.2 mm) where 0.2 < front < 0.55
        worley(x / 2.2, y / 2.2, seed + 31, W, 0.85)
        const bf = front(W.cx * 2.2, W.cy * 2.2)
        const rB = 0.3 + 0.7 * hash2(Math.floor(W.cx), Math.floor(W.cy), seed + 32)
        const bd = (W.f1 * 2.2) / rB
        const has = bf > 0.2 && bf < 0.55 && W.id < 0.8
        c.blister = has && bd < 1 ? (80 + 70 * hash2(Math.floor(W.cx), Math.floor(W.cy), seed + 33)) * Math.pow(1 - bd * bd, 1.5) : 0
        // within 1.2 mm of a blister's edge
        c.blisterProx = has ? smoothstep(1.2, 0.0, Math.max(0, W.f1 * 2.2 - rB)) : 0
        // craquelure (worley edge, cell 0.4–0.9 mm, 15 µm wide) near blisters and the rust front
        c.crack = 0
        const crackAmt = Math.max(c.blisterProx * 0.9, smoothstep(0.49, 0.535, f)) * (1 - smoothstep(0.535, 0.57, f))
        if (crackAmt > 0.01) {
          worley(x / 0.5, y / 0.5, seed + 61, Wc, 0.95)
          c.crack = (1 - smoothstep(0, 0.045, Wc.f2 - Wc.f1)) * crackAmt
        }
        // rust mounds and pits where front > 0.55
        const rr = smoothstep(0.5, 0.62, f)
        c.mound = rr * (200 + 200 * (0.5 + 0.5 * fbm(x / 0.3, y / 0.3, seed + 41, 4)))
        c.pit = 0
        c.pitW = 0
        if (rr > 0.01) {
          worley(x / 0.6, y / 0.6, seed + 43, Wp, 0.8)
          if (Wp.id < 0.3) {
            const t = (Wp.f1 * 0.6) / 0.18
            if (t < 1) {
              c.pit = -(100 + 150 * hash2(Math.floor(Wp.cx), Math.floor(Wp.cy), seed + 44)) * (1 - t * t) * rr
              c.pitW = (1 - t) * rr
            }
          }
        }
        c.white = smoothstep(0.42, 0.47, f) * smoothstep(0.58, 0.52, f)
        // stamped rib along x at y = +2.4: cosine profile 1.5 mm wide, 0.4 mm high, gutters either side
        const ry = Math.abs(y - 2.4)
        c.rib = ry < 0.75 ? 200 * (1 + Math.cos((Math.PI * ry) / 0.75)) : ry < 1.5 ? -30 * Math.sin((Math.PI * (ry - 0.75)) / 0.75) : 0
        // scratches
        let sc = 0
        for (let s = 0; s < scr.length; s++) {
          const S = scr[s]
          const px = x - S.ax
          const py = y - S.ay
          const t = px * S.ux + py * S.uy
          if (t < 0 || t > S.len) continue
          const bow = 0.15 * Math.sin((t / S.len) * Math.PI)
          const dp = Math.abs(px * S.uy - py * S.ux - bow)
          const taper = smoothstep(0, 0.8, t) * smoothstep(S.len, S.len - 0.8, t)
          if (dp < S.w * 1.5) sc = Math.max(sc, smoothstep(S.w * 1.5, S.w * 0.4, dp) * taper)
        }
        c.scratch = sc
        // streaks: rust upstream (towards -x) bleeds downhill to +x, 4 mm
        let st = 0
        for (let q = 1; q <= 6; q++) st = Math.max(st, smoothstep(0.5, 0.6, front(x - q * 0.66, y + 0.03 * (q & 1))) * (1 - q / 7))
        c.streak = st * smoothstep(-0.5, 0.3, gnoise(x * 0.25, y * 2.2, seed + 21)) * (1 - rr)
        c.chalk = smoothstep(-0.3, 0.6, fbm(x / 1.6, y / 1.6, seed + 111, 3))
        c.peel = gnoise(x / 2, y / 2, seed + 71) * 0.5 + gnoise(x * 1.7, y * 1.7, seed + 72) * 0.5
        c.rv = clamp(0.5 + ridged(x * 2.3, y * 2.3, seed + 101, 3) - 0.45 + gnoise(x * 1.3, y * 1.3, seed + 121) * 0.35, 0, 1)
        c.speck = smoothstep(0.75, 0.92, gnoise(x * 6.5, y * 6.5, seed + 122) * 0.5 + 0.5)
        worley(x / 5, y / 5, seed + 151, W, 0.9)
        c.spangle = (W.id - 0.5) * 0.12 + 0.02 * gnoise(x * 3, y * 3, seed + 152)
        c.mill = gnoise(x * 2, y * 0.05, seed + 91) * 1 + gnoise(x * 9, y * 0.2, seed + 92) * 0.6
        return c
      }
      const steelC = hexLin('#A7ABAE')
      const whiteC = hexLin('#D9D6CC')
      const corrC = hexLin('#9C6A2E')
      const primerC = hexLin('#8E3B2A')
      const enamC = hexLin('#3E5B44')
      const enamL = hexLin('#6E8470')
      const stainC = hexLin('#8A4B2A')
      const lepi = hexLin('#C1652F')
      const goet = hexLin('#9C6A2E')
      const hema = hexLin('#7A3324')
      const magn = hexLin('#2A2522')
      const tmp: RGB = [0, 0, 0]
      const substrate: LayerSpec = {
        name: 'Galvanized steel', colourName: 'silver', phys: STEEL,
        thicknessUm: () => 65535,
        reliefUm: (x, y) => { const q = ctx(x, y); return q.rib + q.mill * 2 + q.pit },
        albedo: (x, y, out) => { const q = ctx(x, y); const s = 1 + q.spangle; out[0] = steelC[0] * s; out[1] = steelC[1] * s; out[2] = steelC[2] * s * 1.01; return out },
        roughness: (x, y) => 0.35 + ctx(x, y).spangle,
      }
      const layers: LayerSpec[] = [
        {
          name: 'White rust', colourName: 'chalk white', phys: WHITE_RUST,
          thicknessUm: (x, y) => { const q = ctx(x, y); return Math.max(q.white * 15, q.blister) * (1 - q.scratch) * (1 - smoothstep(0.55, 0.6, q.front)) },
          albedo: (x, y, out) => { const q = ctx(x, y); return lerp3(out, whiteC, corrC, smoothstep(5, 40, q.blister)) },
        },
        {
          name: 'Red-oxide primer', colourName: 'brick red', phys: PRIMER,
          thicknessUm: (x, y) => { const q = ctx(x, y); return 25 * (1 - smoothstep(0.5, 0.56, q.front)) * (1 - q.scratch * 0.9) },
          albedo: (x, y, out) => { const q = ctx(x, y); const v = 1 + 0.08 * q.peel; out[0] = primerC[0] * v; out[1] = primerC[1] * v; out[2] = primerC[2] * v; return out },
        },
        {
          name: 'Green enamel', colourName: 'moss green', phys: ENAMEL,
          thicknessUm: (x, y) => { const q = ctx(x, y); return Math.max(0, (60 + 3 * q.peel) * (1 - smoothstep(0.48, 0.55, q.front)) * (1 - q.scratch) - q.crack * 40) },
          albedo: (x, y, out) => {
            const q = ctx(x, y)
            lerp3(out, enamC, enamL, q.chalk * 0.85)
            const d = 1 - q.crack * 0.35
            out[0] *= d; out[1] *= d; out[2] *= d
            return lerp3(out, out.slice() as RGB, stainC, clamp(q.streak * 0.8, 0, 0.6))
          },
          roughness: (x, y) => mix(0.45, 0.68, ctx(x, y).chalk),
        },
        {
          name: 'Rust scale', colourName: 'rust orange', phys: RUST,
          thicknessUm: (x, y) => ctx(x, y).mound,
          albedo: (x, y, out) => {
            const q = ctx(x, y)
            lerp3(out, hema, goet, smoothstep(0.05, 0.4, q.rv))
            lerp3(tmp, out, lepi, smoothstep(0.3, 0.75, q.rv))
            out[0] = tmp[0]; out[1] = tmp[1]; out[2] = tmp[2]
            lerp3(out, out.slice() as RGB, magn, q.speck * 0.6 + q.pitW * 0.5)
            return out
          },
        },
      ]
      return {
        substrate, layers,
        looseInitUm: (x, y) => { const q = ctx(x, y); return 40 * smoothstep(0.45, 0.6, q.front) * smoothstep(0.2, 0.8, q.pitW + 0.3 * (1 - q.rv)) },
        blisterMask: (x, y) => smoothstep(10, 30, ctx(x, y).blister),
      }
    },
    secretHook(e: BenchEventLike, rt: SurfaceRuntime): SecretHit | null {
      if (e.t !== 'impact' || (e.speed ?? 0) < 250 || e.x === undefined || e.y === undefined) return null
      const ext = blisterAt.get(rt.bake)
      if (!ext || ext(e.x, e.y) < 0.5) return null
      return { id: 'pop-blister', x: e.x, y: e.y }
    },
  }
  return recipe
}

/** Bakes register a blister lookup here so the secret hook can find it. */
export const blisterAt = new WeakMap<object, (x: number, y: number) => number>()

// ----------------------------------------------------------- poster paint ----
const WOOD: MaterialPhys = { hardness: 0.5, muS: 0.6, muK: 0.5, restitution: 0.35, rollResist: 0.02, metalness: 0, roughness: 0.85, residue: { rgb: hexLin('#8D8A82'), rate: 0.05, kind: 'lint' } }
const PAINT: MaterialPhys = { hardness: 0.3, muS: 0.4, muK: 0.35, restitution: 0.4, rollResist: 0.01, metalness: 0, roughness: 0.6, residue: { rgb: hexLin('#E8E4DA'), rate: 0.3, kind: 'flake' } }

function posterPaint(): SurfaceRecipe {
  return {
    id: 'poster-peeling-paint', no: 0, atlasId: 'peeling-painted-wood', name: 'Peeling painted wood', binomial: 'Lignum desquamans',
    orientation: 'wall', form: { kind: 'plane' }, body: { preset: 'board' },
    aniso: { dirDeg: 0, strength: 0.3 },
    tell: 'White paint curls off grey, weathered grain.', secret: { id: 'none', text: '' },
    card: { title: 'Peeling painted wood', caption: 'Paint over weathered wood.', exif: '5:1 · f/8 (eff. f/48)' },
    reveal: { prop: 'panel', scene: 'yard' }, pool: false,
    build(k) {
      const seed = k.seed
      const W = worleyHit()
      const woodA = hexLin('#6E665B')
      const woodB = hexLin('#A39A8B')
      const paintC = hexLin('#ECE8DE')
      const grain = (x: number, y: number) => 0.5 + 0.5 * Math.sin(y * 9 + 2.2 * fbm(x * 0.15, y * 0.9, seed + 3, 3))
      const peel = (x: number, y: number) => fbm(x / 1.6, y / 1.2, seed + 9, 4) + 0.15 * gnoise(x * 3, y * 3, seed + 10)
      return {
        substrate: {
          name: 'Weathered wood', colourName: 'ash grey', phys: WOOD, thicknessUm: () => 65535,
          reliefUm: (x, y) => 40 * grain(x, y) + 15 * gnoise(x * 4, y * 20, seed + 5),
          albedo: (x, y, out) => lerp3(out, woodA, woodB, grain(x, y) * 0.8 + 0.1 * gnoise(x, y * 6, seed + 6)),
        },
        layers: [{
          name: 'White paint', colourName: 'chalk white', phys: PAINT,
          thicknessUm: (x, y) => {
            const p = peel(x, y)
            worley(x / 0.9, y / 0.9, seed + 21, W, 0.9)
            const crack = 1 - smoothstep(0, 0.06, W.f2 - W.f1)
            if (p < 0.02) return 0
            const curl = p < 0.12 ? 160 * (1 - (p - 0.02) / 0.1) : 0
            return Math.max(0, 70 + curl - crack * 70)
          },
          albedo: (x, y, out) => { const v = 1 - 0.06 * (0.5 + 0.5 * gnoise(x * 2, y * 2, seed + 30)); out[0] = paintC[0] * v; out[1] = paintC[1] * v; out[2] = paintC[2] * v; return out },
        }],
      }
    },
  }
}

const RECIPES: Record<string, SurfaceRecipe> = {}
for (const r of [mailbox(), posterPaint()]) RECIPES[r.id] = r
export function getRecipeLocal(id: string): SurfaceRecipe {
  const r = RECIPES[id]
  if (!r) throw new Error(`unknown recipe ${id}`)
  return r
}
export const POOL_LOCAL: readonly string[] = ['rusty-mailbox']
export const WALK_LOCAL: readonly string[] = ['rusty-mailbox']
