// Ruby Sector (7 s, hero 4.0): strict 1-bit, bone on ink, even in colour mode. A glass plate on a
// lightbox: a negative of an original tableau (three men in a deckhouse doorway, a hanging
// lantern, the ship's rail, and a lighthouse throwing its sector across the water). Over 0–2.5 s
// the plate develops grain by grain (a stochastic threshold rising). At 3.5 s the velvet slides
// behind it and it reads as a positive. A thin magnifier ring drifts over one face at 4–6 s.

import type { Preview, PreviewEnv } from './types'
import { W, H, TAU, ctx2d, makeCanvas, designSpace, hash2, bayer8, smoothstep, clamp, mulberry32 } from './kit'

const IW = 180
const IH = 120
const BONE = 0xffcbdfe6 // #E6DFCB as little-endian ABGR
const INK = 0xff101214 // #141210

export function createPlatesPreview(): Preview {
  const period = 7
  let env: PreviewEnv | null = null
  const tone = new Float32Array(IW * IH)
  const grain = new Float32Array(IW * IH)
  const thr = new Float32Array(IW * IH)
  let small: HTMLCanvasElement | null = null
  let img: ImageData | null = null

  function tableau(seed: number): void {
    const c = makeCanvas(IW, IH)
    const g = ctx2d(c, { willReadFrequently: true })
    const grey = (v: number): string => {
      const b = Math.round(clamp(v, 0, 1) * 255)
      return `rgb(${b},${b},${b})`
    }
    // sky and sea
    const sky = g.createLinearGradient(0, 0, 0, 74)
    sky.addColorStop(0, grey(0.04))
    sky.addColorStop(1, grey(0.34))
    g.fillStyle = sky
    g.fillRect(0, 0, IW, 74)
    g.fillStyle = grey(0.12)
    g.fillRect(0, 74, IW, 46)
    g.fillStyle = grey(0.62)
    for (let i = 0; i < 9; i++) g.fillRect(70 + ((i * 37) % 100), 77 + i * 2.2, 18 + (i % 3) * 9, 0.9)
    // the lighthouse on its rock, and its sector across the water
    g.fillStyle = grey(0.08)
    g.beginPath()
    g.moveTo(118, 75)
    g.quadraticCurveTo(140, 62, 166, 75)
    g.fill()
    g.fillStyle = grey(0.82)
    g.beginPath()
    g.moveTo(137, 66)
    g.lineTo(139.5, 36)
    g.lineTo(145.5, 36)
    g.lineTo(148, 66)
    g.fill()
    g.fillStyle = grey(0.3)
    g.fillRect(138.2, 48, 9.2, 3)
    g.fillStyle = grey(0.15)
    g.fillRect(138, 30, 9, 6)
    const beam = g.createLinearGradient(142, 33, 40, 18)
    beam.addColorStop(0, grey(1))
    beam.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = beam
    g.beginPath()
    g.moveTo(142, 33)
    g.lineTo(20, 4)
    g.lineTo(26, 30)
    g.closePath()
    g.fill()
    const lamp = g.createRadialGradient(142.5, 33, 0, 142.5, 33, 9)
    lamp.addColorStop(0, grey(1))
    lamp.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = lamp
    g.fillRect(130, 22, 26, 22)
    // the deckhouse, its lit doorway and the three men in it
    g.fillStyle = grey(0.06)
    g.fillRect(0, 22, 92, 82)
    g.fillStyle = grey(0.2)
    for (let y = 26; y < 104; y += 7) g.fillRect(0, y, 92, 0.8)
    // the deckhouse roof and corner catch the lantern light
    g.fillStyle = grey(0.95)
    g.fillRect(0, 21, 94, 1.6)
    g.fillRect(91.5, 21, 1.4, 70)
    const inside = g.createRadialGradient(44, 64, 4, 44, 64, 40)
    inside.addColorStop(0, grey(1))
    inside.addColorStop(1, grey(0.72))
    g.fillStyle = inside
    g.fillRect(26, 38, 38, 66)
    g.fillStyle = grey(0.04)
    const man = (x: number, top: number, hw: number, cap: boolean): void => {
      g.beginPath()
      g.arc(x, top + 4.4, 4.2, 0, TAU)
      g.fill()
      if (cap) g.fillRect(x - 5.2, top - 0.2, 10.4, 2.6)
      g.beginPath()
      g.moveTo(x - hw, 104)
      g.lineTo(x - hw, top + 13)
      g.quadraticCurveTo(x, top + 7, x + hw, top + 13)
      g.lineTo(x + hw, 104)
      g.fill()
    }
    man(33.5, 52, 6.4, true)
    man(45, 47, 7.2, false)
    man(56, 54, 6, true)
    g.fillStyle = grey(0.05)
    g.fillRect(24, 36, 42, 3)
    // the lantern on its bracket
    g.strokeStyle = grey(0.05)
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(66, 44)
    g.lineTo(76, 44)
    g.lineTo(76, 48)
    g.stroke()
    const glow = g.createRadialGradient(76, 54, 0, 76, 54, 14)
    glow.addColorStop(0, grey(1))
    glow.addColorStop(0.35, grey(0.75))
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = glow
    g.fillRect(60, 38, 32, 32)
    g.fillStyle = grey(0.05)
    g.fillRect(73.5, 48, 5, 1.6)
    g.fillRect(73.5, 59, 5, 1.6)
    // a few stars, and the beam's glitter on the water
    const sr = mulberry32(seed ^ 0x5a5)
    g.fillStyle = grey(1)
    for (let i = 0; i < 26; i++) g.fillRect(96 + sr() * 84, sr() * 26, 1, 1)
    for (let i = 0; i < 14; i++) g.fillRect(126 + sr() * 30 - i * 0.6, 77 + i * 2, 3 + sr() * 7, 1)
    // the ship's rail in the foreground, and the deck below it
    g.fillStyle = grey(0.16)
    g.fillRect(0, 104, IW, 16)
    g.fillStyle = grey(0.55)
    for (let x = -4; x < IW; x += 13) g.fillRect(x, 106, 1, 14)
    g.fillStyle = grey(0.03)
    g.beginPath()
    g.moveTo(0, 88)
    g.lineTo(IW, 92)
    g.lineTo(IW, 96)
    g.lineTo(0, 92)
    g.fill()
    g.fillStyle = grey(0.92)
    g.beginPath()
    g.moveTo(0, 87.5)
    g.lineTo(IW, 91.5)
    g.lineTo(IW, 93.5)
    g.lineTo(0, 89.5)
    g.fill()
    g.fillStyle = grey(0.04)
    for (let x = 6; x < IW; x += 15) g.fillRect(x, 90 + (x / IW) * 4, 2.2, 16)
    const px = g.getImageData(0, 0, IW, IH).data
    // a hard print curve: one-bit reads best with few midtones
    for (let i = 0; i < IW * IH; i++) tone[i] = smoothstep(0.14, 0.8, px[i * 4]! / 255)
    for (let y = 0; y < IH; y++) {
      for (let x = 0; x < IW; x++) {
        grain[y * IW + x] = hash2(x, y, seed)
        thr[y * IW + x] = bayer8(x, y)
      }
    }
  }

  function render(t: number): void {
    const dev = Math.min(smoothstep(0.15, 2.5, t), 1 - smoothstep(6.25, 6.95, t))
    const wipe = (smoothstep(3.35, 3.85, t) - smoothstep(6.95, 7.0, t)) * (IW + 24) - 12 // velvet edge, in pixels
    const out = new Uint32Array(img!.data.buffer)
    for (let y = 0; y < IH; y++) {
      const skew = (IH - y) * 0.12 // the velvet's edge is a little slanted
      for (let x = 0; x < IW; x++) {
        const i = y * IW + x
        if (grain[i]! >= dev) {
          out[i] = BONE
          continue
        }
        const on = tone[i]! > thr[i]!
        const positive = x < wipe + skew
        out[i] = positive === on ? BONE : INK
      }
    }
    // the plate's edges and a chipped corner
    for (let x = 0; x < IW; x++) {
      out[x] = INK
      out[IW + x] = INK
      out[(IH - 1) * IW + x] = INK
      out[(IH - 2) * IW + x] = INK
    }
    for (let y = 0; y < IH; y++) {
      out[y * IW] = INK
      out[y * IW + 1] = INK
      out[y * IW + IW - 1] = INK
      out[y * IW + IW - 2] = INK
    }
    for (let k = 0; k < 6; k++) for (let j = 0; j <= 6 - k; j++) out[(IH - 3 - k) * IW + IW - 3 - j] = INK
    ctx2d(small!).putImageData(img!, 0, 0)
  }

  return {
    period,
    heroT: 4.0,
    init(e) {
      env = e
      tableau(e.seed)
      small = makeCanvas(IW, IH)
      img = ctx2d(small).createImageData(IW, IH)
    },
    resize(e) {
      env = e
    },
    draw(t) {
      if (!env || !small) return
      const { ctx, w, h } = env
      const tt = ((t % period) + period) % period
      render(tt)
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(small, 0, 0, w, h)
      // the magnifier: in from the right, over the middle man's face, away up and right
      const a = smoothstep(3.55, 3.98, tt)
      const b = smoothstep(5.6, 6.2, tt)
      if (a > 0 && b < 1) {
        const fx = 45
        const fy = 52
        const cx = fx + (1 - a) * 150 + b * 120 + Math.sin(tt * 2.1) * 1.5
        const cy = fy + (1 - a) * 20 - b * 70 + Math.cos(tt * 1.7) * 1.2
        const r = 21
        designSpace(ctx, w, h)
        ctx.scale(W / IW, H / IH)
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, TAU)
        ctx.clip()
        const m = 1.9
        ctx.drawImage(small, cx - r / m, cy - r / m, (2 * r) / m, (2 * r) / m, cx - r, cy - r, 2 * r, 2 * r)
        ctx.restore()
        ctx.lineWidth = 2.4
        ctx.strokeStyle = '#141210'
        ctx.beginPath()
        ctx.arc(cx, cy, r + 0.6, 0, TAU)
        ctx.stroke()
        ctx.lineWidth = 1.2
        ctx.strokeStyle = '#E6DFCB'
        ctx.beginPath()
        ctx.arc(cx, cy, r + 1.8, 0, TAU)
        ctx.stroke()
        ctx.lineWidth = 3
        ctx.strokeStyle = '#141210'
        ctx.beginPath()
        ctx.moveTo(cx + (r + 2) * 0.72, cy + (r + 2) * 0.72)
        ctx.lineTo(cx + r * 1.35, cy + r * 1.35)
        ctx.stroke()
        ctx.lineWidth = 1.2
        ctx.strokeStyle = '#E6DFCB'
        ctx.stroke()
      }
      ctx.restore()
    },
  }
}

