// games/plates/content/expose.ts — tableau → ExposureMap (GDD §5.8, painted in 2D with real stereo).
// Sub-frames are accumulated additively with weight 1/N, so movers ghost and still figures stay sharp.
import { PLATE_W, PLATE_H, EYE, WEDGE, REBATE_NUMBER, L_MIN, L_SPAN, type ExposureMap } from '../contracts'
import { Painter, EYE_W, EYE_H, DECODE, GLOW_MAX } from './paint'
import type { PlateDef } from './plates'

let canvases: { base: HTMLCanvasElement; glow: HTMLCanvasElement; b: CanvasRenderingContext2D; g: CanvasRenderingContext2D } | null = null
function surfaces() {
  if (canvases) return canvases
  const base = document.createElement('canvas'), glow = document.createElement('canvas')
  base.width = glow.width = EYE_W; base.height = glow.height = EYE_H
  const b = base.getContext('2d', { willReadFrequently: true }), g = glow.getContext('2d', { willReadFrequently: true })
  if (!b || !g) throw new Error('2D canvas unavailable')
  canvases = { base, glow, b, g }
  return canvases
}

export const lToByte = (L: number) => Math.max(0, Math.min(255, Math.round(((L - L_MIN) / L_SPAN) * 255)))

/** Render one eye: accumulate N sub-frames of linear radiance Y. */
export function renderEye(def: PlateDef, eye: 'L' | 'R', subframes: number): Float32Array {
  const s = surfaces()
  const P = new Painter(s.b, s.g, def.fov)
  P.eye = eye
  const acc = new Float32Array(EYE_W * EYE_H)
  const n = def.motion ? subframes : 1
  for (let i = 0; i < n; i++) {
    P.t = (i + 0.5) / n
    P.reset()
    def.scene(P)
    const bd = s.b.getImageData(0, 0, EYE_W, EYE_H).data, gd = s.g.getImageData(0, 0, EYE_W, EYE_H).data
    for (let k = 0, j = 0; k < acc.length; k++, j += 4) acc[k] += DECODE[bd[j]] + (gd[j] / 255) * GLOW_MAX
  }
  if (n > 1) for (let k = 0; k < acc.length; k++) acc[k] /= n
  return acc
}

/** Assemble the 1024×512 L map: both eyes, the pre-flashed wedge, the rebate, the scratched number. */
export function assemble(def: PlateDef, left: Float32Array, right: Float32Array): ExposureMap {
  const L = new Uint8Array(PLATE_W * PLATE_H)            // rebate: L = -12 → byte 0
  const put = (src: Float32Array, ox: number, oy: number) => {
    for (let y = 0; y < EYE_H; y++) for (let x = 0; x < EYE_W; x++) {
      const Y = src[y * EYE_W + x] * def.scale
      L[(oy + y) * PLATE_W + ox + x] = lToByte(Math.log2(Math.max(Y, 1 / 4096)))
    }
  }
  put(left, EYE.L.x, EYE.L.y); put(right, EYE.R.x, EYE.R.y)
  for (let n = 1; n <= WEDGE.steps; n++) {
    const x0 = WEDGE.x0 + (n - 1) * (WEDGE.size + WEDGE.gap), b = lToByte(-(n - 1))
    for (let y = WEDGE.y; y < WEDGE.y + WEDGE.size; y++) for (let x = x0; x < x0 + WEDGE.size; x++) L[y * PLATE_W + x] = b
  }
  scratch(L, def.scratch)
  return { id: def.id, L }
}

/** Ottilie's pencil-thin scratch in the rebate: 1-px strokes at L = -0.5. */
function scratch(L: Uint8Array, text: string): void {
  const c = document.createElement('canvas'); c.width = 400; c.height = 24
  const x = c.getContext('2d', { willReadFrequently: true })
  if (!x) return
  x.fillStyle = '#000'; x.fillRect(0, 0, 400, 24)
  x.strokeStyle = '#fff'; x.lineWidth = 1
  x.font = `italic ${REBATE_NUMBER.h + 4}px Georgia, serif`; x.textBaseline = 'top'
  x.strokeText(text, 1, 2)
  const d = x.getImageData(0, 0, 400, 24).data, b = lToByte(-0.5)
  for (let y = 0; y < 24; y++) for (let xx = 0; xx < 400; xx++) {
    if (d[(y * 400 + xx) * 4] > 110) {
      const px = REBATE_NUMBER.x + xx, py = REBATE_NUMBER.y + y - 2
      if (px < PLATE_W && py < PLATE_H) L[py * PLATE_W + px] = b
    }
  }
}

export function exposePlate(def: PlateDef, quality: 'low' | 'full'): ExposureMap {
  const n = quality === 'full' ? 12 : 4
  return assemble(def, renderEye(def, 'L', n), renderEye(def, 'R', n))
}
