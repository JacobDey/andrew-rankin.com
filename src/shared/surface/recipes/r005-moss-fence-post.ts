// No. 005 Moss on the fence post: a soft green cushion over grey weathered wood; the marble sinks and stops dead.
import type { Field, LayerSpec, SurfaceRecipe } from '../types'
import { phys, rgb, SMOOTH } from './helpers'

export const r005: SurfaceRecipe = {
  id: 'moss-fence-post',
  no: 5,
  atlasId: 'moss-fence-post',
  name: 'Moss on the fence post',
  binomial: 'Bryum argenteum, pulvinus',
  orientation: 'floor',
  form: { kind: 'plane' },
  body: { preset: 'soft' },
  pile: { dirDeg: 70 },
  tell: 'The marble sinks in and stops dead; the cloth comes away green and wet.',
  secret: { id: 'droplet', text: 'Stroke against the pile, then tilt: a droplet beads up and rolls.' },
  card: {
    title: 'No. 005 · Moss on the fence post',
    caption:
      'Each leaf is one cell thick, so the cushion drinks through its whole surface and dries just as fast. It holds a lot of water for something so small, which is why the marble finds nothing to push against. The red stalks, wider out, are the next generation, waiting for rain.',
    exif: '5:1 · f/8 (eff. f/48) · 1/100 s · ISO 100 · 7-frame stack @ 60 µm · soft raking 25°',
  },
  reveal: { prop: 'mat', scene: 'garden' },
  pool: true,

  build(k) {
    const grain = k.stripes({ period: 1.8, angleDeg: 90, profile: 'tri', warp: k.scale(k.cache(k.fbm({ scale: 7, oct: 2 }), 0.3), 0.6) })
    const woodN = k.cache(k.fbm({ scale: 0.6, oct: 3 }), 0.05)
    const wood: LayerSpec = {
      name: 'Weathered wood',
      colourName: 'slate grey',
      phys: phys({ hardness: 0.35, muS: 0.55, muK: 0.45, restitution: 0.3, rollResist: 0.015, roughness: 0.85 }),
      thicknessUm: () => 3000,
      reliefUm: (x, y) => 70 * grain(x, y) + 25 * woodN(x, y),
      albedo: k.palette([[0, '#6E6A60'], [1, '#8C887C']], k.clamp(k.add(0.5, k.scale(woodN, 0.5), k.scale(grain, 0.2, -0.1)), 0, 1)),
    }
    const cover: Field = k.cache(k.smooth(k.add(0.25, k.fbm({ scale: 9, oct: 3 })), 0.0, 0.18), 0.12)
    const envelope = k.cache(k.add(0.6, k.scale(k.fbm({ scale: 4, oct: 2, salt: 3 }), 0.9)), 0.12)
    const stars = k.blobs({ cell: 0.4, r: [0.2, 0.6], density: 0.9, height: 1 })
    const fuzz = k.cache(k.fbm({ scale: 0.35, oct: 3 }), 0.05)
    const tipTone: Field = k.cache(k.fbm({ scale: 1.1, oct: 2, salt: 9 }), 0.1)
    const pal = k.palette([[0, '#3F5A24'], [0.6, '#587330'], [1, '#78913A']], k.clamp(k.add(0.5, k.scale(fuzz, 0.7)), 0, 1))
    const yellow = rgb('#C9C65A')
    const moss: LayerSpec = {
      name: 'Moss cushion',
      colourName: 'moss green',
      phys: phys({
        hardness: 0.05, muS: 0.8, muK: 0.7, restitution: 0.05, rollResist: 0.08, roughness: 0.9,
        soft: { sinkMm: 0.3, recoverS: 6 }, residue: { rgb: rgb('#5F8A30'), rate: 0.6, kind: 'wet' },
      }),
      thicknessUm: (x, y) => {
        const c = cover(x, y)
        return c <= 0.02 ? 0 : 1000 * Math.max(0.6, Math.min(2.0, 1 + envelope(x, y))) * c * 2
      },
      reliefUm: (x, y) => 260 * stars(x, y) + 140 * fuzz(x, y),
      albedo: (x, y, o) => {
        pal(x, y, o)
        const t = Math.max(0, Math.min(1, stars(x, y) * 1.2 - 0.25)) * Math.max(0, tipTone(x, y) + 0.3) * 0.7
        o[0] += (yellow[0] - o[0]) * t
        o[1] += (yellow[1] - o[1]) * t
        o[2] += (yellow[2] - o[2]) * t
        return o
      },
    }
    // red sporophyte stalks: outside the 5:1 frame, they appear at 2:1
    const stalks = k.blobs({ cell: 3, r: [0.05, 0.09], density: 0.45, height: 1 })
    const stalkRed = rgb('#8E2A20')
    const sporophyte: LayerSpec = {
      name: 'Sporophyte stalks',
      colourName: 'brick red',
      phys: phys({ hardness: 0.1, muS: 0.5, muK: 0.4, restitution: 0.2, roughness: 0.6 }),
      thicknessUm: (x, y) => 1500 * stalks(x, y) * SMOOTH((Math.max(Math.abs(x), Math.abs(y)) - 4) / 1.2) * (cover(x, y) > 0.3 ? 1 : 0),
      albedo: (_x, _y, o) => { o[0] = stalkRed[0]; o[1] = stalkRed[1]; o[2] = stalkRed[2]; return o },
    }
    return { substrate: wood, layers: [moss, sporophyte] }
  },
}
