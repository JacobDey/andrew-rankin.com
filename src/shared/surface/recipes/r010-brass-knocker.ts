// No. 010 Brass door knocker: polished brass with a brown tarnish film, verdigris in the cavities, a tooled sparrow.
import type { Field, LayerSpec, SurfaceRecipe } from '../types'
import { phys, rgb, SMOOTH } from './helpers'

export const r010: SurfaceRecipe = {
  id: 'brass-knocker',
  no: 10,
  atlasId: 'brass-knocker',
  name: 'Brass door knocker',
  binomial: 'Aes cuprum-zincum, malleus ostii',
  orientation: 'wall',
  form: { kind: 'cylinder', radiusMm: 12, axisDeg: 90, crownOffsetMm: [0, 0] },
  body: { preset: 'solid-stone', modes: [[900, 0.8, 1], [2400, 0.6, 0.6], [4100, 0.4, 0.35]] },
  tell: 'The lens cloth comes away black; bright worn spots glint.',
  secret: { id: 'mirror', text: 'Polish one spot for three seconds and it turns to a mirror.' },
  card: {
    title: 'No. 010 · Brass door knocker',
    caption:
      'A hand-width of brass, rubbed bright where fingers close on it and left to darken everywhere else. The black is tarnish, a film of copper sulphide a few millionths of a metre thick; the green in the crevices is verdigris, which prefers places no cloth reaches. A small sparrow has been tooled into it. Whoever owns this house knocks first.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 8-frame stack @ 50 µm · raking 15°',
  },
  reveal: { prop: 'cylinder', scene: 'hall' },
  pool: true,

  build(k) {
    const hammer = k.cache(k.fbm({ scale: 1.1, oct: 3 }), 0.08)
    const polishMarks = k.cache(k.fbm({ scale: 0.15, oct: 2, stretch: [1, 0.12] }), 0.025)
    const pits = k.blobs({ cell: 0.45, r: [0.03, 0.09], density: 0.2, height: 1 })
    // a worn, hand-polished band along the lower part of the ring; tarnish builds up everywhere else
    const worn: Field = k.memo((x, y) => {
      const n = hammer(x, y)
      const band = SMOOTH(1 - Math.abs(y + 1.4 - 0.6 * x) / 2.4)
      return Math.max(0, Math.min(1, band * (0.75 + 0.5 * n)))
    })
    // the tooled sparrow (landmark, 2:1): body, head, beak and tail as one stamped silhouette
    const sparrow: Field = (x, y) => {
      const ca = Math.cos(-0.3)
      const sa = Math.sin(-0.3)
      const px = x + 6.4
      const py = y - 3.2
      const u = px * ca - py * sa
      const v = px * sa + py * ca
      const body = (u / 2.5) ** 2 + (v / 1.35) ** 2
      const head = ((u - 2.1) / 1) ** 2 + ((v - 0.7) / 0.95) ** 2
      const tail = u < -2 && u > -4.3 && Math.abs(v) < 0.45 + 0.1 * (u + 4.3) ? 1 : 0
      const beak = u > 2.9 && u < 3.9 && Math.abs(v - 0.65) < 0.3 * (3.9 - u) ? 1 : 0
      return body < 1 || head < 1 || tail || beak ? 1 : 0
    }
    const brass: LayerSpec = {
      name: 'Cast brass',
      colourName: 'brass yellow',
      phys: phys({
        hardness: 0.8, muS: 0.35, muK: 0.25, restitution: 0.55, rollResist: 0.004, metalness: 1, roughness: 0.2, polish: 0.6, roughnessMin: 0.05,
      }),
      thicknessUm: () => 3000,
      reliefUm: (x, y) => 10 * hammer(x, y) + 3 * polishMarks(x, y) - 30 * pits(x, y) - 55 * sparrow(x, y),
      roughness: (x, y) => 0.2 + 0.1 * Math.max(0, polishMarks(x, y)),
      albedo: k.palette([[0, '#B98F3E'], [0.5, '#D8B25C'], [1, '#EBCB7F']], k.clamp(k.add(0.5, k.scale(hammer, 0.4), k.scale(polishMarks, 0.2)), 0, 1)),
    }
    const tarnishCol = rgb('#5C4020')
    const tarnishN = k.cache(k.fbm({ scale: 0.7, oct: 3, salt: 11 }), 0.06)
    const tarnish: LayerSpec = {
      name: 'Tarnish film',
      colourName: 'soot black',
      phys: phys({
        hardness: 0.2, muS: 0.5, muK: 0.4, restitution: 0.4, rollResist: 0.01, roughness: 0.45, polish: 0.5, roughnessMin: 0.2,
        residue: { rgb: rgb('#1A1612'), rate: 0.7, kind: 'powder' },
      }),
      thicknessUm: (x, y) => 7.4 * (1 - worn(x, y)) * (0.65 + 0.35 * SMOOTH((tarnishN(x, y) + 0.4) / 0.9)),
      albedo: (x, y, o) => {
        const t = 0.35 + 0.5 * (0.5 + 0.5 * tarnishN(x, y))
        const dark = rgb('#241A0E')
        o[0] = dark[0] + (tarnishCol[0] - dark[0]) * t
        o[1] = dark[1] + (tarnishCol[1] - dark[1]) * t
        o[2] = dark[2] + (tarnishCol[2] - dark[2]) * t
        return o
      },
    }
    const cav = k.cavity()
    const vdN = k.cache(k.fbm({ scale: 0.25, oct: 3, salt: 13 }), 0.03)
    const vdCol = rgb('#4FA08A')
    const verdigris: LayerSpec = {
      name: 'Verdigris',
      colourName: 'verdigris',
      phys: phys({ hardness: 0.15, muS: 0.7, muK: 0.6, restitution: 0.15, rollResist: 0.03, roughness: 0.88, residue: { rgb: vdCol, rate: 0.5, kind: 'powder' } }),
      thicknessUm: (x, y) => {
        const c = Math.min(1, cav(x, y) * 2.5 + 0.9 * pits(x, y) + 0.25 * sparrow(x, y))
        return 45 * SMOOTH((c - 0.3) / 0.4) * SMOOTH((vdN(x, y) + 0.5) / 0.8) * (1 - worn(x, y))
      },
      reliefUm: (x, y) => 12 * vdN(x, y),
      albedo: (x, y, o) => {
        const s = 0.85 + 0.3 * (0.5 + 0.5 * vdN(x, y))
        o[0] = vdCol[0] * s
        o[1] = vdCol[1] * s
        o[2] = vdCol[2] * s
        return o
      },
    }
    return { substrate: brass, layers: [tarnish, verdigris] }
  },
}
