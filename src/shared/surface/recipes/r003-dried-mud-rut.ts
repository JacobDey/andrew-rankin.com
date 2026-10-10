// No. 003 Dried mud rut: a silt crust, cracked into plates that curl at their edges, in a tyre rut.
import type { Field, SurfaceRecipe } from '../types'
import { phys, rgb, SMOOTH } from './helpers'

export const r003: SurfaceRecipe = {
  id: 'dried-mud-rut',
  no: 3,
  atlasId: 'dried-mud-rut',
  name: 'Dried mud, tyre rut',
  binomial: 'Limus siccatus, var. orbita',
  orientation: 'floor',
  form: { kind: 'cylinder', radiusMm: 400, axisDeg: 90, crownOffsetMm: [0, 0], concave: true },
  body: { preset: 'solid-stone' },
  loose: { rgb: rgb('#A08A6A'), reposeDeg: 35, grain: 'dust' },
  tell: 'The plate edges crumble to tan dust; the marble ticks into a crack and stays.',
  secret: { id: 'crack', text: 'A hard throw cracks a new crack line.' },
  card: {
    title: 'No. 003 · Dried mud, tyre rut',
    caption:
      'Wet clay shrinks as it dries, and a crust cannot shrink without tearing. The polygons are the compromise: each plate pulls away from its neighbours until the stress is spent, curling slightly at the rim as the top dries faster than the bottom. Somebody drove through here in spring.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 8-frame stack @ 60 µm · raking 15°',
  },
  reveal: { prop: 'mat', scene: 'drive' },
  pool: true,

  build(k) {
    const cr = k.cracks({ cell: 9, width: 0.5, depth: 1, curl: 0.2, jitter: 0.9 })
    const crack: Field = k.memo((x, y) => Math.min(1, Math.max(0, cr(x, y))))
    const lift: Field = (x, y) => Math.max(0, -cr(x, y))
    const clayN = k.cache(k.fbm({ scale: 0.8, oct: 4 }), 0.06)
    const siltN = k.cache(k.fbm({ scale: 1.6, oct: 3 }), 0.1)
    const grain = k.cache(k.fbm({ scale: 0.12, oct: 2 }), 0.025)
    const pits = k.blobs({ cell: 1.2, r: [0.08, 0.3], density: 0.25, height: 1 })
    const stripes = k.stripes({ period: 14, angleDeg: 0, profile: 'tri', warp: (x) => -Math.abs(x) * 0.16 })
    const tread: Field = (x, y) => SMOOTH((Math.abs(x) - 12) / 2) * stripes(x, y)

    const clay = {
      name: 'Wet clay',
      colourName: 'mud brown',
      phys: phys({ hardness: 0.3, muS: 0.7, muK: 0.55, restitution: 0.15, rollResist: 0.03, roughness: 0.8 }),
      thicknessUm: () => 3000,
      reliefUm: (x: number, y: number) => 70 * clayN(x, y),
      albedo: k.palette([[0, '#48372A'], [0.5, '#5A4632'], [1, '#6A553C']], k.clamp(k.add(0.5, k.scale(clayN, 0.6)), 0, 1)),
    }
    const crustCol = k.palette([[0, '#8E7857'], [0.5, '#A08A6A'], [1, '#B6A180']], k.clamp(k.add(0.5, k.scale(siltN, 0.7), k.scale(grain, 0.3)), 0, 1))
    const crust = {
      name: 'Silt crust',
      colourName: 'tan',
      phys: phys({
        hardness: 0.5, muS: 0.65, muK: 0.5, restitution: 0.3, rollResist: 0.025, roughness: 0.9,
        residue: { rgb: rgb('#A08A6A'), rate: 0.5, kind: 'powder' as const },
      }),
      thicknessUm: (x: number, y: number) => {
        const c = crack(x, y)
        return c > 0.97 ? 0 : 1100 * (1 - SMOOTH(c * 1.15)) + 140 * tread(x, y)
      },
      reliefUm: (x: number, y: number) => 1000 * lift(x, y) + 35 * siltN(x, y) + 6 * grain(x, y) - 120 * pits(x, y) + 160 * tread(x, y),
      albedo: crustCol,
    }
    const cav = k.cavity()
    return { substrate: clay, layers: [crust], looseInitUm: (x, y) => 18 * Math.min(1, cav(x, y) * 3 + 0.15 * crack(x, y)) }
  },

  secretHook(e) {
    if (e.t !== 'impact' || e.x === undefined || e.y === undefined) return null
    return (e.speed ?? 0) >= 280 ? { id: 'crack', x: e.x, y: e.y } : null
  },
}
