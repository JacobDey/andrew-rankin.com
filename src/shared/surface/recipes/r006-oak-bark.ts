// No. 006 Oak bark: deep furrows stretched along the trunk, a corky micro-texture, pale lichen crust on the ridges.
import type { Field, LayerSpec, SurfaceRecipe } from '../types'
import { phys, rgb } from './helpers'

export const r006: SurfaceRecipe = {
  id: 'oak-bark',
  no: 6,
  atlasId: 'oak-bark',
  name: 'Oak bark',
  binomial: 'Quercus robur, cortex',
  orientation: 'wall',
  form: { kind: 'cylinder', radiusMm: 250, axisDeg: 90, crownOffsetMm: [0, 0] },
  body: { preset: 'board', modes: [[140, 0.15, 1], [310, 0.1, 0.5]] },
  loose: { rgb: rgb('#5A4330'), reposeDeg: 40, grain: 'crumb' },
  tell: 'The marble gets trapped in furrows; the shadows are huge.',
  secret: { id: 'springtail', text: 'A springtail hops when the marble lands within three millimetres.' },
  card: {
    title: 'No. 006 · Oak bark',
    caption:
      'Bark is the tree\'s dead skin, split into furrows as the trunk swells beneath it. The pale crust on the ridges is lichen, a partnership of fungus and alga that grows a millimetre in a year. Everything here is older than the hedge and will outlast the fence.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 9-frame stack @ 80 µm · raking 15°',
  },
  reveal: { prop: 'cylinder', scene: 'garden' },
  pool: true,

  build(k) {
    const crease = k.cache(k.ridged({ scale: 11, oct: 4, stretch: [1, 0.25] }), 0.1)
    const cork = k.cache(k.fbm({ scale: 0.45, oct: 4 }), 0.05)
    const tone = k.cache(k.fbm({ scale: 2.5, oct: 3 }), 0.15)
    const furrow: Field = k.memo((x, y) => Math.max(0, Math.min(1, (crease(x, y) - 0.5) / 0.4)))
    const bark: LayerSpec = {
      name: 'Oak bark',
      colourName: 'brown',
      phys: phys({ hardness: 0.45, muS: 0.75, muK: 0.6, restitution: 0.2, rollResist: 0.03, roughness: 0.92, residue: { rgb: rgb('#5A4330'), rate: 0.3, kind: 'flake' } }),
      thicknessUm: () => 4000,
      reliefUm: (x, y) => -4000 * furrow(x, y) + 160 * cork(x, y) + 400 * tone(x, y),
      albedo: (x, y, o) => {
        const f = furrow(x, y)
        const t = Math.max(0, Math.min(1, 0.5 + 0.6 * cork(x, y) + 0.3 * tone(x, y) - 0.6 * f))
        const a = rgb('#3D2E22')
        const b = rgb('#7A6650')
        o[0] = a[0] + (b[0] - a[0]) * t
        o[1] = a[1] + (b[1] - a[1]) * t
        o[2] = a[2] + (b[2] - a[2]) * t
        return o
      },
    }
    const lichenField: Field = k.cache(k.smooth(k.add(-0.12, k.fbm({ scale: 6, oct: 3, salt: 7 })), 0.08, 0.22), 0.1)
    const lichenCol = rgb('#A9B39A')
    const lichenFleck = k.cache(k.fbm({ scale: 0.25, oct: 2 }), 0.04)
    const lichen: LayerSpec = {
      name: 'Lichen crust',
      colourName: 'pale green-grey',
      phys: phys({ hardness: 0.1, muS: 0.6, muK: 0.5, restitution: 0.15, rollResist: 0.02, roughness: 0.85, residue: { rgb: lichenCol, rate: 0.3, kind: 'powder' } }),
      thicknessUm: (x, y) => 35 * lichenField(x, y) * (1 - 0.9 * furrow(x, y)),
      reliefUm: (x, y) => 15 * lichenFleck(x, y),
      albedo: (x, y, o) => {
        const s = 0.85 + 0.25 * lichenFleck(x, y)
        o[0] = lichenCol[0] * s
        o[1] = lichenCol[1] * s
        o[2] = lichenCol[2] * s
        return o
      },
    }
    const cav = k.cavity()
    return { substrate: bark, layers: [lichen], looseInitUm: (x, y) => 40 * Math.min(1, furrow(x, y) * 0.6 + cav(x, y)) }
  },
}
