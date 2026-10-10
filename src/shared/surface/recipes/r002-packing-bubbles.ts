// No. 002 Packing bubbles: the parcel in the mailbox. Polyethylene film dome-blisters over fluted cardboard.
import type { SurfaceRecipe } from '../types'
import { flat, heightAt, phys, rgb } from './helpers'

export const r002: SurfaceRecipe = {
  id: 'packing-bubbles',
  no: 2,
  atlasId: 'packing-bubbles',
  name: 'Packing bubbles',
  binomial: 'Polyethylenum bullatum',
  orientation: 'floor',
  form: { kind: 'plane' },
  body: { preset: 'soft', modes: [[180, 0.06, 1]] },
  tell: 'The marble bounces lively off a glossy dome and rolls into the valley.',
  secret: { id: 'pop', text: 'Pop a bubble.' },
  card: {
    title: 'No. 002 · Packing bubbles',
    caption:
      'Each dome is a pocket of trapped air, sealed between two films, standing guard over whatever was in the box. The valleys between them are flat film pressed on corrugated board, whose flutes you can see as faint stripes. A bubble is cheap armour: it spends itself, one pop at a time.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 6-frame stack @ 60 µm · raking 15°',
  },
  reveal: { prop: 'drape', scene: 'drive' },
  pool: true,

  build(k) {
    const flutes = k.stripes({ period: 3, angleDeg: 0, warp: k.scale(k.cache(k.fbm({ scale: 6, oct: 2 }), 0.3), 0.05) })
    const fibre = k.cache(k.fbm({ scale: 0.35, oct: 3 }), 0.05)
    const tone = k.cache(k.fbm({ scale: 3, oct: 2 }), 0.25)
    const cardboardCol = k.palette([[0, '#8E6A3F'], [0.5, '#A27B4E'], [1, '#B58E5C']], k.clamp(k.add(0.5, k.scale(tone, 0.5), k.scale(fibre, 0.2), k.scale(flutes, 0.25, -0.12)), 0, 1))
    const board = {
      name: 'Corrugated cardboard',
      colourName: 'tan',
      phys: phys({ hardness: 0.25, muS: 0.6, muK: 0.5, restitution: 0.25, rollResist: 0.02, roughness: 0.85, residue: { rgb: rgb('#A27B4E'), rate: 0.2, kind: 'lint' as const } }),
      thicknessUm: () => 1500,
      reliefUm: (x: number, y: number) => 90 * flutes(x, y) + 14 * fibre(x, y),
      albedo: cardboardCol,
    }
    const domes0 = k.hexDomes({ cell: 11, radius: 4.75, height: 3.5, profile: 'dome' })
    const domes: (x: number, y: number) => number = (x, y) => domes0(x - 3.4, y - 1.6)
    const wrinkle = k.cache(k.fbm({ scale: 0.9, oct: 3 }), 0.08)
    const milk = rgb('#E3E8EA')
    const film = {
      name: 'Polyethylene film',
      colourName: 'clear milky',
      phys: phys({ hardness: 0.1, muS: 0.3, muK: 0.2, restitution: 0.62, rollResist: 0.008, roughness: 0.15 }),
      thicknessUm: () => 60,
      reliefUm: (x: number, y: number) => 1000 * domes(x, y) + 6 * wrinkle(x, y),
      albedo: (x: number, y: number, o: [number, number, number]) => {
        cardboardCol(x, y, o)
        const m = 0.1 + 0.05 * Math.min(1, domes(x, y) / 2)
        o[0] += (milk[0] - o[0]) * m
        o[1] += (milk[1] - o[1]) * m
        o[2] += (milk[2] - o[2]) * m
        return o
      },
    }
    void flat
    return { substrate: board, layers: [film] }
  },

  secretHook(e, rt) {
    if (e.t !== 'impact' || e.x === undefined || e.y === undefined || (e.speed ?? 0) < 300) return null
    return heightAt(rt, e.x, e.y) > 1.2 ? { id: 'pop', x: e.x, y: e.y } : null
  },
}
