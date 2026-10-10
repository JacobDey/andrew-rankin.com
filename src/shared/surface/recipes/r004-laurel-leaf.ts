// No. 004 Laurel hedge leaf: a waxy cuticle over a curled leaf, a network of veins, a midrib off to one side.
import type { LayerSpec, SurfaceRecipe } from '../types'
import { phys, rgb } from './helpers'

export const r004: SurfaceRecipe = {
  id: 'laurel-leaf',
  no: 4,
  atlasId: 'laurel-leaf',
  name: 'Laurel hedge leaf',
  binomial: 'Prunus laurocerasus, folium',
  orientation: 'floor',
  // the leaf curls down away from its midrib (midrib at x = +8 mm: it enters the frame at 2:1)
  form: { kind: 'cylinder', radiusMm: 60, axisDeg: 90, crownOffsetMm: [8, 0] },
  body: { preset: 'soft' },
  tell: 'The marble runs down the vein channels; a waxy highlight slides across the cuticle.',
  secret: { id: 'dew', text: 'Tilt past four degrees for two seconds and a dew bead forms.' },
  card: {
    title: 'No. 004 · Laurel hedge leaf',
    caption:
      'The shine is wax, laid down in a layer thinner than a soap film so rain beads and rolls instead of soaking in. Under it the veins form a network that carries water in and sugar out. This leaf has been part of a hedge long enough that nobody remembers planting it.',
    exif: '5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 7-frame stack @ 60 µm · raking 15°',
  },
  reveal: { prop: 'sphere', scene: 'garden' },
  pool: true,

  build(k) {
    const veinsR = k.cache(k.ridged({ scale: 1.7, oct: 3, stretch: [1, 0.7] }), 0.06)
    const tissueN = k.cache(k.fbm({ scale: 0.7, oct: 3 }), 0.05)
    const tone = k.cache(k.fbm({ scale: 2.2, oct: 3 }), 0.15)
    const stomata = k.blobs({ cell: 0.14, r: [0.025, 0.04], density: 0.45, height: 1 })
    const midrib = (x: number): number => Math.exp(-(((x - 8) / 0.55) ** 2))
    const leaf: LayerSpec = {
      name: 'Leaf tissue',
      colourName: 'green',
      phys: phys({ hardness: 0.1, muS: 0.45, muK: 0.35, restitution: 0.25, rollResist: 0.012, roughness: 0.5 }),
      thicknessUm: () => 400,
      reliefUm: (x, y) => {
        const v = veinsR(x, y)
        return (-110 * Math.max(0, v - 0.3)) / 0.7 + 16 * tissueN(x, y) - 260 * midrib(x)
      },
      albedo: k.palette([[0, '#1F3F25'], [1, '#2E5528']], k.clamp(k.add(0.5, k.scale(tissueN, 0.5)), 0, 1)),
    }
    const cuticle: LayerSpec = {
      name: 'Waxy cuticle',
      colourName: 'glossy green',
      phys: phys({
        hardness: 0.15, muS: 0.35, muK: 0.3, restitution: 0.35, rollResist: 0.008, roughness: 0.25,
        residue: { rgb: rgb('#6FA24A'), rate: 0.25, kind: 'wet' },
      }),
      thicknessUm: () => 15,
      reliefUm: (x, y) => -7 * stomata(x, y),
      albedo: k.palette([[0, '#264C25'], [1, '#3F6A2E']], k.clamp(k.add(0.5, k.scale(tone, 0.8), k.scale(veinsR, 0.2, -0.1)), 0, 1)),
    }
    return { substrate: leaf, layers: [cuticle] }
  },
}
