// No. 008 Porch boards: sun-greyed pine with raised latewood grain, checks along the grain, old brown stain in the grooves.
import type { Field, LayerSpec, SurfaceRecipe } from '../types'
import { phys, rgb, SMOOTH } from './helpers'

export const r008: SurfaceRecipe = {
  id: 'porch-boards',
  no: 8,
  atlasId: 'porch-boards',
  name: 'Porch boards',
  binomial: 'Pinus, tabula vestibuli',
  orientation: 'floor',
  form: { kind: 'plane' },
  body: { preset: 'board', modes: [[110, 0.25, 1], [260, 0.25, 0.6], [480, 0.2, 0.4]] },
  aniso: { dirDeg: 0, strength: 0.6 },
  tell: 'The marble channels along the grain; burlap catches splinters.',
  secret: { id: 'splinter', text: 'Burlap lifts a long splinter.' },
  card: {
    title: 'No. 008 · Porch boards',
    caption:
      'Pine lays down a pale band in spring and a dense dark one in late summer; weather eats the soft bands first, so the hard ones stand proud like the ridges on a thumb. The brown in the grooves is stain from a coat applied the year the house was bought. The line of dark at the edge is where one board stops and the next begins.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 7-frame stack @ 60 µm · raking 15°',
  },
  reveal: { prop: 'slab', scene: 'yard' },
  pool: true,

  build(k) {
    const warpN = k.cache(k.fbm({ scale: 14, oct: 2 }), 0.4)
    const rings = k.stripes({ period: 2.6, angleDeg: 0, profile: 'wale', warp: k.scale(warpN, 0.9) })
    const fine = k.stripes({ period: 0.55, angleDeg: 0, profile: 'tri', warp: k.scale(k.cache(k.fbm({ scale: 3, oct: 2, salt: 6 }), 0.2), 0.4) })
    const fibre = k.cache(k.fbm({ scale: 0.35, oct: 3, stretch: [0.2, 1] }), 0.04)
    const checks = k.scratches({ n: 16, len: [5, 18], width: [0.05, 0.14], dirDeg: 0, dirSpread: 0.06, extentMm: 24, salt: 14 })
    const tone = k.cache(k.fbm({ scale: 4, oct: 3, stretch: [0.4, 1] }), 0.2)
    const gap: Field = (_x, y) => SMOOTH(1 - Math.abs(y - 30) / 1.3)
    const wood: LayerSpec = {
      name: 'Weathered pine',
      colourName: 'silver grey',
      phys: phys({ hardness: 0.4, muS: 0.55, muK: 0.45, restitution: 0.3, rollResist: 0.012, roughness: 0.82, residue: { rgb: rgb('#8D8A82'), rate: 0.3, kind: 'lint' } }),
      thicknessUm: () => 4000,
      reliefUm: (x, y) => 200 * rings(x, y) + 40 * fine(x, y) + 20 * fibre(x, y) - 450 * checks(x, y) - 6000 * gap(x, y),
      albedo: (x, y, o) => {
        const t = Math.max(0, Math.min(1, 0.55 + 0.5 * tone(x, y) + 0.25 * (rings(x, y) - 0.5) + 0.15 * fibre(x, y)))
        const a = rgb('#6F6C66')
        const b = rgb('#A19E96')
        const dark = 1 - 0.75 * gap(x, y) - 0.5 * checks(x, y)
        o[0] = (a[0] + (b[0] - a[0]) * t) * dark
        o[1] = (a[1] + (b[1] - a[1]) * t) * dark
        o[2] = (a[2] + (b[2] - a[2]) * t) * dark
        return o
      },
    }
    const stainCol = rgb('#5A4430')
    const stainN = k.cache(k.fbm({ scale: 0.9, oct: 2, salt: 3 }), 0.08)
    const stain: LayerSpec = {
      name: 'Old brown stain',
      colourName: 'chocolate',
      phys: phys({ hardness: 0.3, muS: 0.5, muK: 0.4, restitution: 0.25, roughness: 0.7, residue: { rgb: stainCol, rate: 0.15, kind: 'dye' } }),
      thicknessUm: (x, y) => {
        const g = 1 - rings(x, y)
        return 14 * SMOOTH((g - 0.45) / 0.3) * (0.5 + 0.5 * SMOOTH((stainN(x, y) + 0.3) / 0.5)) * (1 - gap(x, y))
      },
      albedo: (_x, _y, o) => { o[0] = stainCol[0]; o[1] = stainCol[1]; o[2] = stainCol[2]; return o },
    }
    const nailCol = rgb('#55575A')
    const nail: LayerSpec = {
      name: 'Nail head',
      colourName: 'iron grey',
      phys: phys({ hardness: 0.9, muS: 0.4, muK: 0.3, restitution: 0.55, rollResist: 0.004, metalness: 1, roughness: 0.5 }),
      thicknessUm: (x, y) => {
        const r = Math.hypot(x - 13, y + 6) / 2.2
        return r < 1 ? 700 * Math.sqrt(1 - r * r) : 0
      },
      albedo: (_x, _y, o) => { o[0] = nailCol[0]; o[1] = nailCol[1]; o[2] = nailCol[2]; return o },
    }
    const cav: Field = k.cavity()
    void cav
    return { substrate: wood, layers: [stain, nail] }
  },
}

export type { Field }
