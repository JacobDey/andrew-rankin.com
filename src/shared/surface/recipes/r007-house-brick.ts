// No. 007 House brick: fired clay with sand inclusions and air pits, a white bloom of salts, a recessed mortar joint.
import type { Field, LayerSpec, SurfaceRecipe } from '../types'
import { phys, rgb, SMOOTH } from './helpers'

export const r007: SurfaceRecipe = {
  id: 'house-brick',
  no: 7,
  atlasId: 'house-brick',
  name: 'House brick',
  binomial: 'Later coctus, murus domesticus',
  orientation: 'wall',
  form: { kind: 'plane' },
  body: { preset: 'solid-stone' },
  loose: { rgb: rgb('#9A4A33'), reposeDeg: 34, grain: 'dust' },
  tell: 'Burlap sheds red grit; a dead, stony tick; a matte face.',
  secret: { id: 'crumb', text: 'A throw into the mortar dislodges a crumb.' },
  card: {
    title: 'No. 007 · House brick',
    caption:
      'Clay baked hard enough to ring, still carrying the sand it was dug up with and the bubbles the kiln left behind. The white bloom is salt the rain pulled out of the wall and the sun left on the face. Below the joint the mortar has been eaten back by thirty winters.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 7-frame stack @ 60 µm · raking 15°',
  },
  reveal: { prop: 'panel', scene: 'yard' },
  pool: true,

  build(k) {
    const sandId = k.worley({ cell: 0.55, jitter: 0.95, out: 'id' })
    const sandD = k.worley({ cell: 0.55, jitter: 0.95, out: 'f1' })
    const airId = k.worley({ cell: 1.3, jitter: 0.9, out: 'id', salt: 4 })
    const airD = k.worley({ cell: 1.3, jitter: 0.9, out: 'f1', salt: 4 })
    const clayN = k.cache(k.fbm({ scale: 0.8, oct: 4 }), 0.06)
    const tone = k.cache(k.fbm({ scale: 3, oct: 3 }), 0.2)
    const joint: Field = (_x, y) => SMOOTH((y - 6.8) / 0.5)
    const clayRed = k.palette([[0, '#7C3624'], [0.5, '#9A4A33'], [1, '#B05C42']], k.clamp(k.add(0.5, k.scale(tone, 0.6), k.scale(clayN, 0.3)), 0, 1))
    const sandCol = rgb('#C9B58E')
    const brick: LayerSpec = {
      name: 'Fired clay',
      colourName: 'brick red',
      phys: phys({ hardness: 0.7, muS: 0.7, muK: 0.55, restitution: 0.25, rollResist: 0.02, roughness: 0.88, residue: { rgb: rgb('#9A4A33'), rate: 0.45, kind: 'powder' } }),
      thicknessUm: () => 5000,
      reliefUm: (x, y) => {
        let h = 40 * clayN(x, y) - 3000 * joint(x, y)
        const si = sandId(x, y)
        if (si < 0.3) h += 90 * (1 - Math.min(1, sandD(x, y) / (0.1 + 0.18 * si / 0.3)))
        const ai = airId(x, y)
        if (ai < 0.1) h -= 420 * Math.max(0, 1 - airD(x, y) / (0.25 + 1.2 * ai))
        return h
      },
      albedo: (x, y, o) => {
        clayRed(x, y, o)
        if (sandId(x, y) < 0.3 && sandD(x, y) < 0.12) { o[0] = sandCol[0]; o[1] = sandCol[1]; o[2] = sandCol[2] }
        return o
      },
    }
    const mortarN = k.cache(k.fbm({ scale: 0.3, oct: 3 }), 0.04)
    const mortarCol = k.palette([[0, '#A29C8E'], [1, '#C4BEB0']], k.clamp(k.add(0.5, k.scale(mortarN, 0.9)), 0, 1))
    const mortar: LayerSpec = {
      name: 'Lime mortar',
      colourName: 'putty grey',
      phys: phys({ hardness: 0.2, muS: 0.8, muK: 0.7, restitution: 0.1, rollResist: 0.04, roughness: 0.95, residue: { rgb: rgb('#B7B1A3'), rate: 0.5, kind: 'powder' } }),
      thicknessUm: (x, y) => 200 * joint(x, y),
      reliefUm: (x, y) => 90 * mortarN(x, y),
      albedo: mortarCol,
    }
    const bloomF: Field = k.cache(k.smooth(k.add(-0.12, k.fbm({ scale: 3.5, oct: 3, salt: 8 })), 0.12, 0.3), 0.15)
    const bloomN = k.cache(k.fbm({ scale: 0.3, oct: 2, salt: 2 }), 0.05)
    const bloomCol = rgb('#E8E4DA')
    const bloom: LayerSpec = {
      name: 'Efflorescence',
      colourName: 'chalk white',
      phys: phys({ hardness: 0.1, muS: 0.6, muK: 0.5, restitution: 0.1, roughness: 0.95, residue: { rgb: bloomCol, rate: 0.5, kind: 'powder' } }),
      thicknessUm: (x, y) => 22 * bloomF(x, y) * (1 - joint(x, y)),
      reliefUm: (x, y) => 8 * bloomN(x, y),
      albedo: (x, y, o) => {
        const s = 0.9 + 0.15 * bloomN(x, y)
        o[0] = bloomCol[0] * s
        o[1] = bloomCol[1] * s
        o[2] = bloomCol[2] * s
        return o
      },
    }
    const cav = k.cavity()
    return { substrate: brick, layers: [mortar, bloom], looseInitUm: (x, y) => 20 * Math.min(1, cav(x, y) * 4) }
  },

  secretHook(e) {
    if (e.t !== 'impact' || e.x === undefined || e.y === undefined || (e.speed ?? 0) < 250) return null
    return e.y > 7 ? { id: 'crumb', x: e.x, y: e.y } : null
  },
}
