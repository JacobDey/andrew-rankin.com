// Latent Image (7 s, hero 4.6): a 1-bit-ish archive desk under an amber lamp. A search field types
// WINDOW letter by letter (caret blinking at 1 Hz). Six negative strips slide in with their frame
// numbers. One strip lifts, and a print comes up in a tray (a dither threshold rising): blind
// shadows striping a desk. An amber evidence tag, ▸04A, swings on its string.

import type { Preview, PreviewEnv } from './types'
import { W, H, TAU, ctx2d, makeCanvas, designSpace, bayer8, hash2, smoothstep, clamp, finish, easeInOut, mulberry32 } from './kit'

const BW = 180
const BH = 120
const DESK_INK = 0xff0a0e14 // #140E0A
const DESK_LIT = 0xff1f4a6e // #6E4A1F (dim amber)
const PAPER = '#EAD9B0'
const AMBER = '#E9B04A'
const WORD = 'WINDOW'

// the print in the tray (its own low-res 1-bit field)
const PW = 64
const PH = 80

export function createLatentPreview(): Preview {
  const period = 7
  let env: PreviewEnv | null = null
  let desk: HTMLCanvasElement | null = null
  let print: HTMLCanvasElement | null = null
  let printImg: ImageData | null = null
  const printTone = new Float32Array(PW * PH)
  const printThr = new Float32Array(PW * PH)
  let stripFrames: number[][] = []

  function buildDesk(seed: number): HTMLCanvasElement {
    const c = makeCanvas(BW, BH)
    const g = ctx2d(c)
    const im = g.createImageData(BW, BH)
    const o = new Uint32Array(im.data.buffer)
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const d = Math.hypot((x - 30) / 1.3, y + 12)
        let v = clamp(1 - d / 150, 0, 1) ** 1.6 * 0.9
        // two old file folders and a blotter under the lamp
        if (x > 112 && x < 176 && y > 22 && y < 112) v *= 0.55
        if (x > 4 && x < 104 && y > 96 && y < 118) v = v * 0.6 + 0.08
        v += (hash2(x >> 2, y >> 2, seed) - 0.5) * 0.06
        o[y * BW + x] = v > bayer8(x, y) ? DESK_LIT : DESK_INK
      }
    }
    g.putImageData(im, 0, 0)
    return c
  }

  function buildPrint(seed: number): void {
    for (let y = 0; y < PH; y++) {
      for (let x = 0; x < PW; x++) {
        // a desk top in the lower two thirds, a wall above; venetian-blind light across both
        const wall = y < 26
        let v = wall ? 0.32 : 0.42
        const band = ((x * 0.55 + y * 1.0) / 8.5) % 1
        const inLight = x > 6 && x < 60 && y > 4 && y < 76 && band < 0.48
        if (inLight) v += wall ? 0.45 : 0.5
        // a telephone and a cup, dark against the stripes
        const phone = Math.hypot((x - 20) / 11, (y - 48) / 6) < 1 || (x > 12 && x < 28 && y > 48 && y < 56)
        const cup = Math.hypot((x - 46) / 5, (y - 58) / 6) < 1
        if (phone || cup) v = 0.08
        if (y === 26 || y === 27) v = 0.15
        printTone[y * PW + x] = clamp(v + (hash2(x, y, seed) - 0.5) * 0.08, 0, 1)
        printThr[y * PW + x] = bayer8(x, y)
      }
    }
  }

  return {
    period,
    heroT: 4.6,
    init(e) {
      env = e
      desk = buildDesk(e.seed)
      buildPrint(e.seed)
      print = makeCanvas(PW, PH)
      printImg = ctx2d(print).createImageData(PW, PH)
      const r = mulberry32(e.seed ^ 0x404)
      stripFrames = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => r()))
    },
    resize(e) {
      env = e
    },
    draw(t) {
      if (!env || !desk || !print) return
      const { ctx, w, h } = env
      const tt = ((t % period) + period) % period
      ctx.save()
      designSpace(ctx, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(desk, 0, 0, W, H)
      ctx.imageSmoothingEnabled = true
      const out = smoothstep(6.25, 6.8, tt) // everything is filed away before the loop seam

      // ---- the search field
      ctx.fillStyle = 'rgba(8,6,4,0.92)'
      ctx.fillRect(16, 12, 190, 28)
      ctx.strokeStyle = 'rgba(233,176,74,0.55)'
      ctx.lineWidth = 1
      ctx.strokeRect(16.5, 12.5, 189, 27)
      ctx.font = '700 7px "Archivo Variable", "Archivo", sans-serif'
      ctx.fillStyle = 'rgba(233,176,74,0.8)'
      ctx.fillText('SEARCH  ▸', 24, 29)
      const typed = Math.floor(clamp((tt - 0.3) / 0.19, 0, WORD.length))
      const erased = Math.floor(clamp((tt - 6.0) / 0.1, 0, WORD.length))
      const text = WORD.slice(0, Math.max(0, typed - erased))
      ctx.font = '500 15px "IBM Plex Mono", ui-monospace, monospace'
      ctx.fillStyle = PAPER
      ctx.fillText(text, 70, 31)
      if (tt % 1 < 0.5) {
        const cw = ctx.measureText(text).width
        ctx.fillRect(71 + cw, 18, 7, 16)
      }

      // ---- six negative strips slide in
      const lift = easeInOut((tt - 2.85) / 0.45) * (1 - out)
      for (let i = 0; i < 6; i++) {
        const k = easeInOut((tt - 1.45 - i * 0.12) / 0.5)
        if (k <= 0) continue
        let x = 16 - (1 - k) * 230
        let y = 50 + i * 28
        const lifted = i === 2
        ctx.save()
        ctx.globalAlpha = 1 - out
        if (lifted && lift > 0) {
          x += 4 * lift
          y -= 5 * lift
          ctx.fillStyle = `rgba(0,0,0,${0.5 * lift})`
          ctx.fillRect(x + 3, y + 6, 190, 22)
        }
        ctx.fillStyle = '#3B2A14'
        ctx.fillRect(x, y, 190, 22)
        // perforations top and bottom
        ctx.fillStyle = '#120D08'
        for (let p = 0; p < 22; p++) {
          ctx.fillRect(x + 3 + p * 8.6, y + 1.5, 4, 2.4)
          ctx.fillRect(x + 3 + p * 8.6, y + 18.2, 4, 2.4)
        }
        // four frames: negatives, so the shadows are pale
        for (let f = 0; f < 4; f++) {
          const fx = x + 6 + f * 46
          const fy = y + 5
          ctx.fillStyle = '#8C6A35'
          ctx.fillRect(fx, fy, 42, 12.5)
          const s = stripFrames[i]![f]!
          ctx.fillStyle = '#C9A866'
          ctx.fillRect(fx + 4 + s * 18, fy + 3, 9 + s * 8, 6.5)
          ctx.fillStyle = '#E2C891'
          ctx.fillRect(fx + 2, fy + 9.5 - s * 2, 38, 1.5)
        }
        ctx.font = '700 5.5px "Archivo Variable", "Archivo", sans-serif'
        ctx.fillStyle = AMBER
        ctx.fillText(`▸${i + 1}`, x + 192 - 196, y + 14)
        if (lifted && lift > 0) {
          ctx.strokeStyle = `rgba(233,176,74,${0.9 * lift})`
          ctx.lineWidth = 1.2
          ctx.strokeRect(x - 0.5, y - 0.5, 191, 23)
        }
        ctx.restore()
      }

      // ---- the tray, and the print coming up in it
      ctx.fillStyle = '#0B0806'
      ctx.fillRect(222, 66, 124, 152)
      ctx.strokeStyle = '#4A3719'
      ctx.lineWidth = 3
      ctx.strokeRect(223.5, 67.5, 121, 149)
      const pa = smoothstep(3.05, 3.4, tt) * (1 - out)
      if (pa > 0) {
        const dev = smoothstep(3.4, 5.0, tt)
        const o = new Uint32Array(printImg!.data.buffer)
        for (let i = 0; i < PW * PH; i++) {
          const density = (1 - printTone[i]!) * dev
          o[i] = density > printThr[i]! + 0.04 ? 0xff0c1014 : 0xffb0d9ea
        }
        ctx2d(print).putImageData(printImg!, 0, 0)
        ctx.save()
        ctx.globalAlpha = pa
        ctx.translate(284, 142)
        ctx.rotate(-0.05)
        ctx.fillStyle = PAPER
        ctx.fillRect(-48, -60, 96, 120)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(print, -43, -55, 86, 107.5)
        ctx.imageSmoothingEnabled = true
        ctx.restore()
        // the developer's sheen
        ctx.fillStyle = 'rgba(233,176,74,0.07)'
        ctx.fillRect(226, 70, 116, 144)
      }

      // ---- the evidence tag on its string
      const th = 0.16 * Math.sin((tt / period) * TAU * 3) + 0.04 * Math.sin((tt / period) * TAU * 6 + 1)
      ctx.save()
      ctx.translate(318, -6)
      ctx.rotate(th)
      ctx.strokeStyle = '#D9CFBF'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, 58)
      ctx.stroke()
      ctx.translate(0, 58)
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      tagPath(ctx, 3, 4)
      ctx.fill()
      ctx.fillStyle = AMBER
      tagPath(ctx, 0, 0)
      ctx.fill()
      ctx.fillStyle = '#141210'
      ctx.beginPath()
      ctx.arc(0, 6, 2.2, 0, TAU)
      ctx.fill()
      ctx.font = '700 9px "Archivo Variable", "Archivo", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('▸04A', 0, 24)
      ctx.font = '500 5px "IBM Plex Mono", monospace'
      ctx.fillText('EVIDENCE', 0, 33)
      ctx.fillRect(-10, 37, 20, 0.7)
      ctx.fillRect(-10, 41, 14, 0.7)
      ctx.restore()

      ctx.restore()
      finish(ctx, tt, w, h, { bloom: 0.22 })
    },
  }
}

function tagPath(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
  ctx.beginPath()
  ctx.moveTo(dx - 8, dy)
  ctx.lineTo(dx + 8, dy)
  ctx.lineTo(dx + 14, dy + 7)
  ctx.lineTo(dx + 14, dy + 48)
  ctx.lineTo(dx - 14, dy + 48)
  ctx.lineTo(dx - 14, dy + 7)
  ctx.closePath()
}
