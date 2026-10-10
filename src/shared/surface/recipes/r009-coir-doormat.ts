// No. 009 Coir doormat: coconut-husk bristle tufts on a rubber-dark backing, tips dirty with the street.
import type { Field, LayerSpec, SurfaceRecipe } from '../types'
import { phys, rgb, SMOOTH } from './helpers'

export const r009: SurfaceRecipe = {
  id: 'coir-doormat',
  no: 9,
  atlasId: 'coir-doormat',
  name: 'Coir doormat',
  binomial: 'Cocos nucifera, fibra',
  orientation: 'floor',
  form: { kind: 'plane' },
  body: { preset: 'soft' },
  loose: { rgb: rgb('#C8B48A'), reposeDeg: 33, grain: 'sand' },
  pile: { dirDeg: 90 },
  tell: 'Chaotic bounces on a rugged tuft; sand sits on the cloth.',
  secret: { id: 'sand', text: 'Shake the stage and sand rains out of the mat.' },
  card: {
    title: 'No. 009 · Coir doormat',
    caption:
      'Coir is the fibre between a coconut\'s shell and its husk, stiff enough to scrape a boot and rot-proof enough to sit on a step all winter. Every tuft is a bundle of hairs that were once soaked for months in lagoons. The dark tips are today\'s street, wiped off by everyone who has ever come to this door.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 8-frame stack @ 80 µm · raking 15°',
  },
  reveal: { prop: 'mat', scene: 'hall' },
  pool: true,

  build(k) {
    const tuftF1 = k.worley({ cell: 2.5, jitter: 0.8, out: 'f1' })
    const tuftId = k.worley({ cell: 2.5, jitter: 0.8, out: 'id' })
    const tuft: Field = k.memo((x, y) => {
      const d = tuftF1(x, y) / 2.5
      return Math.max(0, 1 - d * 1.55)
    })
    const fibres = k.cache(k.fbm({ scale: 0.16, oct: 4, stretch: [1, 1] }), 0.03)
    const dirt = k.cache(k.fbm({ scale: 1.6, oct: 3 }), 0.12)
    const backingN = k.cache(k.fbm({ scale: 0.5, oct: 3 }), 0.06)
    const backing: LayerSpec = {
      name: 'Latex backing',
      colourName: 'soot black',
      phys: phys({ hardness: 0.2, muS: 0.9, muK: 0.8, restitution: 0.2, rollResist: 0.05, roughness: 0.9 }),
      thicknessUm: () => 2000,
      reliefUm: (x, y) => 60 * backingN(x, y),
      albedo: k.palette([[0, '#1E1812'], [1, '#33291E']], k.clamp(k.add(0.5, k.scale(backingN, 0.8)), 0, 1)),
    }
    const coirPal = k.palette([[0, '#8A6A3F'], [0.5, '#B08A55'], [1, '#C9A46D']], k.clamp(k.add(0.5, k.scale(fibres, 0.8)), 0, 1))
    const dirty = rgb('#3E3022')
    const coir: LayerSpec = {
      name: 'Coir bristles',
      colourName: 'coconut brown',
      phys: phys({
        hardness: 0.08, muS: 0.9, muK: 0.8, restitution: 0.15, rollResist: 0.1, roughness: 0.95,
        soft: { sinkMm: 0.5, recoverS: 4 }, residue: { rgb: rgb('#7A5E36'), rate: 0.4, kind: 'lint' },
      }),
      thicknessUm: (x, y) => {
        const t = tuft(x, y)
        if (t <= 0.02) return 0
        const h = 0.55 + 0.45 * tuftId(x, y)
        return 3000 * h * SMOOTH(t * 1.3) * (0.25 + 0.75 * Math.max(0, 0.5 + 0.8 * fibres(x, y)))
      },
      reliefUm: (x, y) => 1100 * fibres(x, y),
      albedo: (x, y, o) => {
        coirPal(x, y, o)
        const d = SMOOTH((tuft(x, y) - 0.3) / 0.5) * Math.max(0, 0.5 + 0.7 * dirt(x, y)) * 0.65
        o[0] += (dirty[0] - o[0]) * d
        o[1] += (dirty[1] - o[1]) * d
        o[2] += (dirty[2] - o[2]) * d
        return o
      },
    }
    return { substrate: backing, layers: [coir], looseInitUm: (x, y) => 22 * Math.max(0, 1 - tuft(x, y) * 1.3) }
  },
}
