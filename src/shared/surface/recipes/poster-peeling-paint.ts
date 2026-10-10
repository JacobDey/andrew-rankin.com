// Poster recipe (never in the pool): peeling white paint over weathered wood, matching the hub's procedural
// preview (hub.md 4.3): a height field of fbm plus cracks, curled paint edges, bare wood where it has gone.
import type { Field, LayerSpec, SurfaceRecipe } from '../types'
import { phys, rgb, SMOOTH } from './helpers'

export const posterPeelingPaint: SurfaceRecipe = {
  id: 'poster-peeling-paint',
  no: 0,
  atlasId: 'peeling-painted-wood',
  name: 'Peeling paint on wood',
  binomial: 'Pigmentum desquamans',
  orientation: 'floor',
  form: { kind: 'plane' },
  body: { preset: 'board' },
  tell: 'Paint curls away from bare grey wood.',
  secret: { id: 'poster', text: 'This one is for the hub.' },
  card: {
    title: 'Peeling paint on wood',
    caption: 'A coat of white over an older coat of pale blue, lifting at every edge it can find, over wood that has been waiting for it.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · raking 15°',
  },
  reveal: { prop: 'panel', scene: 'yard' },
  pool: false,

  build(k) {
    const grain = k.stripes({ period: 1.5, angleDeg: 0, profile: 'tri', warp: k.scale(k.cache(k.fbm({ scale: 8, oct: 2 }), 0.3), 0.7) })
    const woodN = k.cache(k.fbm({ scale: 0.5, oct: 3 }), 0.05)
    const wood: LayerSpec = {
      name: 'Weathered wood',
      colourName: 'driftwood grey',
      phys: phys({ hardness: 0.4, muS: 0.55, muK: 0.45, restitution: 0.3, roughness: 0.85 }),
      thicknessUm: () => 3000,
      reliefUm: (x, y) => 90 * grain(x, y) + 30 * woodN(x, y),
      albedo: k.palette([[0, '#6B665C'], [1, '#9A9487']], k.clamp(k.add(0.5, k.scale(woodN, 0.5), k.scale(grain, 0.3, -0.15)), 0, 1)),
    }
    const field1: Field = k.cache(k.add(k.fbm({ scale: 5, oct: 4 }), k.scale(k.fbm({ scale: 1.2, oct: 2, salt: 21 }), 0.12)), 0.07)
    const field2: Field = k.cache(k.add(k.fbm({ scale: 4, oct: 3, salt: 31 }), 0.1), 0.07)
    const cr = k.cache(k.cracks({ cell: 1.1, width: 0.05, depth: 1, jitter: 0.95 }), 0.015)
    const old: Field = k.memo((x, y) => SMOOTH((field2(x, y) - 0.02) / 0.04 + 0.5))
    const upper: Field = k.memo((x, y) => SMOOTH((field1(x, y) + 0.05) / 0.04))
    const edge = (f: (x: number, y: number) => number, t0: number): Field => (x, y) => Math.max(0, 1 - Math.abs(f(x, y) - t0) / 0.035)
    const edge2 = edge(field2, 0.0)
    const edge1 = edge(field1, -0.05)
    const blueCol = rgb('#9DB0B8')
    const blue: LayerSpec = {
      name: 'Old blue paint',
      colourName: 'pale blue',
      phys: phys({ hardness: 0.35, muS: 0.45, muK: 0.35, restitution: 0.4, roughness: 0.5, residue: { rgb: blueCol, rate: 0.2, kind: 'flake' } }),
      thicknessUm: (x, y) => 60 * old(x, y) * (1 - SMOOTH(cr(x, y) * 1.2)),
      reliefUm: (x, y) => 150 * edge2(x, y),
      albedo: (_x, _y, o) => { o[0] = blueCol[0]; o[1] = blueCol[1]; o[2] = blueCol[2]; return o },
    }
    const whiteCol = rgb('#EDEAE0')
    const chalkN = k.cache(k.fbm({ scale: 0.9, oct: 3 }), 0.07)
    const white: LayerSpec = {
      name: 'White paint',
      colourName: 'warm white',
      phys: phys({ hardness: 0.3, muS: 0.4, muK: 0.3, restitution: 0.45, roughness: 0.55, residue: { rgb: whiteCol, rate: 0.2, kind: 'flake' } }),
      thicknessUm: (x, y) => 90 * upper(x, y) * (1 - SMOOTH(cr(x, y) * 1.1)),
      reliefUm: (x, y) => 380 * edge1(x, y) + 6 * chalkN(x, y),
      albedo: (x, y, o) => {
        const s = 0.93 + 0.08 * chalkN(x, y)
        o[0] = whiteCol[0] * s
        o[1] = whiteCol[1] * s
        o[2] = whiteCol[2] * s
        return o
      },
    }
    return { substrate: wood, layers: [blue, white] }
  },
}
