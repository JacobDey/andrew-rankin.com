// No. 001 Rusty mailbox, lid (texturedle.md 6.2). Galvanized steel under red-oxide primer and green enamel,
// on the R = 120 mm arch of a lid: the marble drifts right (+x) on a level stage. Rust blisters lift the paint,
// run-off streaks all run +x (the way the marble drifts), a stamped rib at y = +2.4 mm along x.
import type { Field, LayerSpec, RGB, SurfaceRecipe } from '../types'
import { phys, rgb } from './helpers'

const SMOOTH = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

export const r001: SurfaceRecipe = {
  id: 'rusty-mailbox',
  no: 1,
  atlasId: 'rusty-mailbox',
  name: 'Rusty mailbox, lid',
  binomial: 'Ferrum rubiginosum, var. capsa epistularis',
  orientation: 'floor',
  form: { kind: 'cylinder', radiusMm: 120, axisDeg: 90, crownOffsetMm: [-6, 0] },
  body: {
    preset: 'hollow-sheet',
    modes: [[212, 1.4 * 0.8, 1], [337, 1.1 * 0.8, 0.7], [529, 0.9 * 0.8, 0.5], [811, 0.7 * 0.8, 0.35], [1240, 0.6 * 0.8, 0.25]],
    rattle: true,
  },
  aniso: { dirDeg: 90, strength: 0.4 },
  streakDirDeg: 0,
  loose: { rgb: rgb('#A0522D'), reposeDeg: 38, grain: 'flake' },
  tell: 'The lens cloth comes away rust-orange; burlap scrubs green, then red, then grey metal; the lid rings hollow.',
  secret: { id: 'blister', text: 'Pop a blister.' },
  card: {
    title: 'No. 001 · Rusty mailbox, lid',
    caption:
      'Galvanized steel under green enamel, on the curve of a lid that has shed a few thousand rainstorms. The zinc went first, spending itself to protect the steel, and that white crust is the evidence. Then the iron did what iron has always wanted to do. The orange is lepidocrocite and the brown is goethite: rust is a family, not a colour. It takes up several times the room of the metal it eats, which is why it lifts paint into blisters instead of just staining it.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 7-frame stack @ 60 µm · raking 15°',
  },
  reveal: { prop: 'mailbox', scene: 'drive' },
  pool: true,

  build(k) {
    // ---- shared fields
    const scratchShallow = k.scratches({ n: 5, len: [10, 24], width: [0.03, 0.08], dirDeg: 157, dirSpread: 0.35, extentMm: 24 })
    const scratchDeep = k.scratches({ n: 2, len: [8, 18], width: [0.035, 0.07], dirDeg: 150, dirSpread: 0.5, extentMm: 24 })
    const scratchAny = k.memo(k.max(scratchShallow, scratchDeep))
    const scratchDeepM = k.memo(scratchDeep)
    const front: Field = k.memo(
      k.add(0.2, k.scale(k.cache(k.fbm({ scale: 2.5, oct: 4 }), 0.1), 1.7), k.scale(k.convexity(), 0.6), k.scale(scratchAny, 0.4), -0.15),
    )
    const rustPresence = k.smooth(front, 0.5, 0.6)
    const blisterZone = k.mul(k.smooth(front, 0.08, 0.16), k.sub(1, k.smooth(front, 0.5, 0.56)))
    const domes = k.blobs({ cell: 2.2, r: [0.3, 1.0], density: 0.95, height: 1 }) // 0..1 dome profile
    const blister = k.mul(domes, blisterZone)
    const rib: Field = (_x, y) => {
      const d = Math.abs(y - 2.4)
      return d >= 0.75 ? 0 : 0.5 * (1 + Math.cos((Math.PI * d) / 0.75))
    }
    const craqCell = k.cracks({ cell: 0.7, width: 0.05, depth: 1, jitter: 0.95 })
    const mounds = k.cache(k.fbm({ scale: 0.3, oct: 4 }), 0.05)
    const pitsId = k.worley({ cell: 0.6, jitter: 0.85, out: 'id' })
    const pitsF1 = k.worley({ cell: 0.6, jitter: 0.85, out: 'f1' })
    const chalk = k.cache(k.clamp(k.add(0.35, k.scale(k.fbm({ scale: 1.5, oct: 3 }), 0.9), k.scale(k.convexity(), 0.5)), 0, 1), 0.12)
    const spangle = k.worley({ cell: 5, jitter: 0.9, out: 'id' })
    const streakSrc = k.mul(rustPresence, k.smooth(k.fbm({ scale: 1.3, oct: 2, stretch: [0.12, 1] }), -0.25, 0.25))
    const streaks = k.cache(k.streak({ src: streakSrc, dirDeg: 0, lenMm: 4 }), 0.08)
    const striation = k.cache(k.fbm({ scale: 0.12, oct: 2, stretch: [1, 0.02] }), 0.03)
    const peel = k.cache(k.fbm({ scale: 2, oct: 2 }), 0.2)
    const dust = k.blobs({ cell: 0.35, r: [0.01, 0.045], density: 0.18, height: 1 })

    // ---- 0 galvanized steel (substrate)
    const steelCol = rgb('#A7ABAE')
    const steel: LayerSpec = {
      name: 'Galvanized steel',
      colourName: 'steel grey',
      phys: phys({ hardness: 0.9, muS: 0.4, muK: 0.3, restitution: 0.55, rollResist: 0.004, metalness: 1, roughness: 0.35 }),
      thicknessUm: () => 1000,
      reliefUm: (x, y) => 2 * striation(x, y) + 400 * rib(x, y),
      albedo: (x, y, o) => {
        const s = 1 + 0.12 * (spangle(x, y) - 0.5)
        o[0] = steelCol[0] * s
        o[1] = steelCol[1] * s
        o[2] = steelCol[2] * s
        return o
      },
    }

    // ---- 1 white rust (zinc carbonate): a crusty halo where 0.45 < front < 0.55
    const wr = rgb('#D9D6CC')
    const whiteRust: LayerSpec = {
      name: 'White rust',
      colourName: 'chalk white',
      phys: phys({ hardness: 0.2, roughness: 0.95, residue: { rgb: wr, rate: 0.6, kind: 'powder' } }),
      thicknessUm: (x, y) => {
        const f = front(x, y)
        return 15 * SMOOTH((f - 0.43) / 0.04) * (1 - SMOOTH((f - 0.53) / 0.04))
      },
      albedo: (_x, _y, o) => { o[0] = wr[0]; o[1] = wr[1]; o[2] = wr[2]; return o },
    }

    // ---- 2 red-oxide primer
    const pc = rgb('#8E3B2A')
    const primer: LayerSpec = {
      name: 'Red-oxide primer',
      colourName: 'brick red',
      phys: phys({ hardness: 0.4, muS: 0.5, muK: 0.4, restitution: 0.4, roughness: 0.7 }),
      thicknessUm: (x, y) => 25 * (1 - scratchDeepM(x, y)) * (1 - rustPresence(x, y)),
      albedo: (_x, _y, o) => { o[0] = pc[0]; o[1] = pc[1]; o[2] = pc[2]; return o },
    }

    // ---- 3 green enamel, UV-chalked
    const enamelPal = k.palette([[0, '#3E5B44'], [1, '#6E8470']], chalk)
    const stainCol = rgb('#8A4B2A')
    const enamel: LayerSpec = {
      name: 'Green enamel',
      colourName: 'green',
      phys: phys({
        hardness: 0.35, muS: 0.35, muK: 0.3, restitution: 0.45, rollResist: 0.006, roughness: 0.55, polish: 0.2, roughnessMin: 0.3,
        residue: { rgb: rgb('#9DB59C'), rate: 0.15, kind: 'powder' },
      }),
      thicknessUm: (x, y) => {
        const pres = 1 - rustPresence(x, y)
        if (pres <= 0) return 0
        let t = 60 * pres * (1 - scratchAny(x, y))
        const bz = blisterZone(x, y)
        if (bz > 0.01) t -= 40 * craqCell(x, y) * (1 - 0.0) * bz
        return t > 0 ? t : 0
      },
      reliefUm: (x, y) => 3 * peel(x, y) + 150 * blister(x, y),
      albedo: (x, y, o) => {
        enamelPal(x, y, o)
        const st = 0.5 * Math.min(1, streaks(x, y) * 1.6)
        if (st > 0.002) {
          o[0] += (stainCol[0] - o[0]) * st
          o[1] += (stainCol[1] - o[1]) * st
          o[2] += (stainCol[2] - o[2]) * st
        }
        const bl = blister(x, y)
        if (bl > 0.05) {
          // the shell chalks over a blister
          const c = Math.min(1, bl * 1.5) * 0.3
          o[0] += (0.52 - o[0]) * c
          o[1] += (0.58 - o[1]) * c
          o[2] += (0.5 - o[2]) * c
        }
        const d = dust(x, y)
        if (d > 0.1) { o[0] *= 0.7; o[1] *= 0.7; o[2] *= 0.7 }
        return o
      },
    }

    // ---- 4 rust scale and tubercles
    const oxide = k.palette([[0, '#7A3324'], [0.5, '#9C6A2E'], [1, '#C1652F']], k.cache(k.clamp(k.add(0.5, k.scale(k.fbm({ scale: 0.8, oct: 3 }), 0.9)), 0, 1), 0.08))
    const magnetite = rgb('#2A2522')
    const specks = k.cache(k.smooth(k.fbm({ scale: 0.25, oct: 2, salt: 5 }), 0.45, 0.65), 0.04)
    const rust: LayerSpec = {
      name: 'Rust scale',
      colourName: 'rust orange',
      phys: phys({ hardness: 0.25, muS: 0.85, muK: 0.6, restitution: 0.2, rollResist: 0.03, roughness: 0.9, residue: { rgb: rgb('#C1652F'), rate: 0.8, kind: 'powder' } }),
      thicknessUm: (x, y) => {
        const r = rustPresence(x, y)
        return r > 0 ? r * (160 + 140 * (0.5 + 0.5 * mounds(x, y))) : 0
      },
      reliefUm: (x, y) => {
        let h = 300 * mounds(x, y)
        if (pitsId(x, y) < 0.3) h -= 250 * (1 - SMOOTH(pitsF1(x, y) / 0.2)) * (0.4 + 0.6 * pitsId(x, y) / 0.3)
        return h
      },
      albedo: (x, y, o) => {
        oxide(x, y, o)
        const s = specks(x, y)
        if (s > 0.01) {
          o[0] += (magnetite[0] - o[0]) * s * 0.8
          o[1] += (magnetite[1] - o[1]) * s * 0.8
          o[2] += (magnetite[2] - o[2]) * s * 0.8
        }
        return o
      },
    }

    // ---- 5 hand-painted numeral 7 (landmark, 1:2), 6 flag-pivot rivet (1:1), 7 grass-seed husk
    const seven = k.glyph({ text: '7', at: [22, 8], size: 22, stroke: 3.4 })
    const paintWhite = rgb('#D8D4C6')
    const numeral: LayerSpec = {
      name: 'White paint numeral',
      colourName: 'chalk white',
      phys: phys({ hardness: 0.3, roughness: 0.6, residue: { rgb: paintWhite, rate: 0.15, kind: 'powder' } }),
      thicknessUm: (x, y) => 70 * seven(x, y),
      reliefUm: (x, y) => 10 * peel(x, y),
      albedo: (_x, _y, o) => { o[0] = paintWhite[0]; o[1] = paintWhite[1]; o[2] = paintWhite[2]; return o },
    }
    const rivetMetal = rgb('#8F9396')
    const rivet: LayerSpec = {
      name: 'Pivot rivet',
      colourName: 'steel grey',
      phys: phys({ hardness: 0.9, muS: 0.4, muK: 0.3, restitution: 0.6, rollResist: 0.004, metalness: 1, roughness: 0.4 }),
      thicknessUm: (x, y) => {
        const r = Math.hypot(x + 12, y + 8) / 2.5
        return r < 1 ? 1200 * Math.sqrt(1 - r * r) : 0
      },
      albedo: (_x, _y, o) => { o[0] = rivetMetal[0]; o[1] = rivetMetal[1]; o[2] = rivetMetal[2]; return o },
    }
    const straw = rgb('#A89458')
    const ca = Math.cos(-0.35)
    const sa = Math.sin(-0.35)
    const husk: LayerSpec = {
      name: 'Grass-seed husk',
      colourName: 'straw',
      phys: phys({ hardness: 0.1, roughness: 0.8, restitution: 0.15 }),
      thicknessUm: (x, y) => {
        const dx = x - 2.6
        const dy = y + 1.6
        const u = (dx * ca - dy * sa) / 1.5
        const v = (dx * sa + dy * ca) / 0.4
        const r2 = u * u + v * v
        return r2 < 1 ? 380 * Math.sqrt(1 - r2) : 0
      },
      albedo: (_x, _y, o) => { o[0] = straw[0]; o[1] = straw[1]; o[2] = straw[2]; return o },
    }

    const cav = k.cavity()
    const looseInitUm: Field = (x, y) => {
      const f = front(x, y)
      return f > 0.3 ? 40 * Math.min(1, cav(x, y) * 3 + 0.1) * SMOOTH((f - 0.3) / 0.3) : 0
    }
    const blisterMask: Field = (x, y) => (blister(x, y) > 0.3 ? 1 : 0)
    return { substrate: steel, layers: [whiteRust, primer, enamel, rust, numeral, rivet, husk], looseInitUm, blisterMask }
  },

  secretHook(e, rt) {
    if (e.t !== 'impact' || e.x === undefined || e.y === undefined) return null
    if ((e.speed ?? 0) < 250) return null
    const m = rt.fields().blisterMask
    return m && m(e.x, e.y) > 0.5 ? { id: 'blister', x: e.x, y: e.y } : null
  },
}

export type { RGB }
