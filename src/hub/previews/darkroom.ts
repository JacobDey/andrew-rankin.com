// Darkroom (8 s, hero 5.2): a white enamel tray seen from above under the red safelight. The
// water sloshes left and right twice per loop (a moving highlight band and a refraction wobble).
// In the tray, a cyanotype photogram of a fern goes from pale yellow-green to Prussian blue as each
// wave passes. From 6.5 s the white light comes on: the finished blue-and-white print, flat and
// calm. Then the lights go down and a fresh sheet is in the tray.

import type { Preview, PreviewEnv } from './types'
import { W, H, TAU, ctx2d, makeCanvas, designSpace, mulberry32, smoothstep, easeInOut, windowed, finish, mixHex, clamp } from './kit'

const PX = 80
const PY = 52
const PW = 200
const PH = 136
const PS = 2 // paper canvas pixels per design unit

const UNEXPOSED = '#D6D49A'
const WASHED = '#EEECE4'
const PRUSSIAN = '#16336F'

export function createDarkroomPreview(): Preview {
  const period = 8
  let env: PreviewEnv | null = null
  let bg: HTMLCanvasElement | null = null
  let fern: HTMLCanvasElement | null = null
  let blue: HTMLCanvasElement | null = null
  let paper: HTMLCanvasElement | null = null
  let px: CanvasRenderingContext2D | null = null

  function drawFern(c: HTMLCanvasElement, seed: number): void {
    const g = ctx2d(c)
    const r = mulberry32(seed)
    const w = c.width
    const h = c.height
    g.fillStyle = '#fff'
    g.strokeStyle = '#fff'
    g.lineCap = 'round'
    // the rachis: a gentle S from bottom-left to top-right
    const p0 = [0.16 * w, 0.95 * h]
    const p1 = [0.3 * w, 0.5 * h]
    const p2 = [0.62 * w, 0.42 * h]
    const p3 = [0.88 * w, 0.1 * h]
    const at = (s: number): [number, number] => {
      const u = 1 - s
      return [
        u * u * u * p0[0]! + 3 * u * u * s * p1[0]! + 3 * u * s * s * p2[0]! + s * s * s * p3[0]!,
        u * u * u * p0[1]! + 3 * u * u * s * p1[1]! + 3 * u * s * s * p2[1]! + s * s * s * p3[1]!,
      ]
    }
    for (let i = 0; i < 60; i++) {
      const a = at(i / 60)
      const b = at((i + 1) / 60)
      g.lineWidth = (1 - i / 60) * 0.012 * w + 1.2
      g.beginPath()
      g.moveTo(a[0], a[1])
      g.lineTo(b[0], b[1])
      g.stroke()
    }
    const pinnae = 17
    for (let k = 0; k < pinnae; k++) {
      const s = 0.1 + (k / pinnae) * 0.86
      const [bx, by] = at(s)
      const [nx, ny] = at(Math.min(1, s + 0.01))
      const ang = Math.atan2(ny - by, nx - bx)
      const side = k % 2 === 0 ? 1 : -1
      const len = (0.34 * Math.sin(Math.PI * Math.min(1, s * 1.05 + 0.08)) + 0.04) * w * (0.9 + r() * 0.2)
      const dir = ang + side * (1.05 - s * 0.25)
      const curl = side * (0.25 + r() * 0.1)
      const leaves = Math.max(4, Math.round(len / (0.022 * w)))
      let x = bx
      let y = by
      let d = dir
      g.lineWidth = 1.4
      for (let j = 0; j < leaves; j++) {
        const step = len / leaves
        const nx2 = x + Math.cos(d) * step
        const ny2 = y + Math.sin(d) * step
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(nx2, ny2)
        g.stroke()
        const sz = (1 - j / leaves) * 0.022 * w + 1.5
        for (const sgn of [-1, 1]) {
          const la = d + sgn * 1.1
          g.beginPath()
          g.ellipse(nx2 + Math.cos(la) * sz * 0.7, ny2 + Math.sin(la) * sz * 0.7, sz, sz * 0.48, la, 0, TAU)
          g.fill()
        }
        x = nx2
        y = ny2
        d += curl * 0.12
      }
    }
  }

  function drawBg(): HTMLCanvasElement {
    const S = 2
    const c = makeCanvas(W * S, H * S)
    const g = ctx2d(c)
    g.scale(S, S)
    // the bench: dark, faintly grained wood
    const bench = g.createLinearGradient(0, 0, 0, H)
    bench.addColorStop(0, '#2A221C')
    bench.addColorStop(1, '#1A1512')
    g.fillStyle = bench
    g.fillRect(0, 0, W, H)
    const r = mulberry32(41)
    g.strokeStyle = 'rgba(0,0,0,0.22)'
    g.lineWidth = 0.7
    for (let i = 0; i < 26; i++) {
      const y0 = r() * H
      g.beginPath()
      g.moveTo(0, y0)
      g.bezierCurveTo(W * 0.3, y0 + (r() - 0.5) * 14, W * 0.7, y0 + (r() - 0.5) * 14, W, y0 + (r() - 0.5) * 8)
      g.stroke()
    }
    // tray shadow, enamel body, blue-black rim
    g.fillStyle = 'rgba(0,0,0,0.5)'
    roundRect(g, 38, 27, 296, 202, 16)
    g.fill()
    g.fillStyle = '#E9E4D8'
    roundRect(g, 32, 20, 296, 200, 15)
    g.fill()
    g.lineWidth = 3.5
    g.strokeStyle = '#1C2533'
    roundRect(g, 33.5, 21.5, 293, 197, 14)
    g.stroke()
    // the well, with its inner shadow
    const well = g.createLinearGradient(0, 30, 0, 210)
    well.addColorStop(0, '#D9D3C6')
    well.addColorStop(1, '#E4DFD3')
    g.fillStyle = well
    roundRect(g, 46, 32, 268, 176, 10)
    g.fill()
    g.save()
    roundRect(g, 46, 32, 268, 176, 10)
    g.clip()
    g.strokeStyle = 'rgba(40,30,20,0.28)'
    g.lineWidth = 10
    g.filter = 'blur(4px)'
    roundRect(g, 41, 27, 278, 186, 14)
    g.stroke()
    g.filter = 'none'
    // a chip in the enamel and a few ribs on the floor
    g.strokeStyle = 'rgba(80,70,60,0.12)'
    g.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      g.beginPath()
      g.moveTo(60, 60 + i * 30)
      g.lineTo(300, 60 + i * 30)
      g.stroke()
    }
    g.restore()
    g.fillStyle = '#26313F'
    g.beginPath()
    g.ellipse(300, 214, 4, 2.2, 0.3, 0, TAU)
    g.fill()
    // bamboo tongs resting on the rim
    g.lineCap = 'round'
    for (const [dx, col] of [[0, '#B98E55'], [7, '#A87E48']] as const) {
      g.strokeStyle = 'rgba(0,0,0,0.35)'
      g.lineWidth = 5
      g.beginPath()
      g.moveTo(262 + dx + 3, 6 + 3)
      g.lineTo(344 + dx + 3, 64 + 3)
      g.stroke()
      g.strokeStyle = col
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(262 + dx, 6)
      g.lineTo(344 + dx, 64)
      g.stroke()
    }
    return c
  }

  function composePaper(te: number): void {
    const g = px!
    const w = paper!.width
    const h = paper!.height
    const wash = smoothstep(6.5, 7.15, te)
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = mixHex(UNEXPOSED, WASHED, wash)
    g.fillRect(0, 0, w, h)
    // the image comes up behind each wave front; a third pass deepens it in the wash
    const strips = 36
    const sw = w / strips
    const f1 = easeInOut((te - 0.5) / 2.1) * 1.25 - 0.12 // left to right
    const f2 = 1.12 - easeInOut((te - 2.7) / 2.1) * 1.25 // right to left
    const deep = smoothstep(6.4, 7.2, te)
    for (let i = 0; i < strips; i++) {
      const xc = (i + 0.5) / strips
      const a1 = 0.6 * smoothstep(f1 + 0.1, f1 - 0.1, xc)
      const a2 = 0.62 * smoothstep(f2 - 0.1, f2 + 0.1, xc)
      const a = 1 - (1 - a1) * (1 - a2) * (1 - deep)
      if (a <= 0.002) continue
      g.globalAlpha = a
      g.drawImage(blue!, i * sw, 0, sw + 0.5, h, i * sw, 0, sw + 0.5, h)
    }
    g.globalAlpha = 1
  }

  return {
    period,
    heroT: 5.2,
    init(e) {
      env = e
      bg = drawBg()
      fern = makeCanvas(PW * PS, PH * PS)
      drawFern(fern, e.seed)
      blue = makeCanvas(PW * PS, PH * PS)
      const b = ctx2d(blue)
      b.fillStyle = PRUSSIAN
      b.fillRect(0, 0, blue.width, blue.height)
      // a little mottling in the iron
      const r = mulberry32(e.seed ^ 0x55)
      for (let i = 0; i < 140; i++) {
        b.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,20'},${0.03 + r() * 0.05})`
        b.beginPath()
        b.arc(r() * blue.width, r() * blue.height, 6 + r() * 30, 0, TAU)
        b.fill()
      }
      b.globalCompositeOperation = 'destination-out'
      b.drawImage(fern, 0, 0)
      paper = makeCanvas(PW * PS, PH * PS)
      px = ctx2d(paper)
    },
    resize(e) {
      env = e
    },
    draw(t) {
      if (!env || !bg) return
      const { ctx, w, h } = env
      const tt = ((t % period) + period) % period
      const te = tt < 7.75 ? tt : 0 // effective development time; the swap hides in the dark
      composePaper(te)
      ctx.save()
      designSpace(ctx, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(bg, 0, 0, W, H)
      const ph = (tt / period) * TAU
      const calm = 1 - 0.85 * smoothstep(6.5, 7.2, te)
      const slosh = Math.sin(2 * ph) * calm
      // paper under water: drawn in slices, each nudged by the refraction wobble
      const slices = 28
      const sh = PH / slices
      const drift = 2.2 * slosh
      ctx.save()
      ctx.translate(PX + PW / 2 + drift, PY + PH / 2)
      ctx.rotate(-0.04)
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(-PW / 2 + 2, -PH / 2 + 3, PW, PH)
      for (let i = 0; i < slices; i++) {
        const yy = i * sh
        const off = calm * (1.3 * Math.sin(yy * 0.11 + 2 * ph * 3) + 0.8 * Math.sin(yy * 0.05 - ph * 2))
        ctx.drawImage(paper!, 0, yy * PS, PW * PS, sh * PS + 1, -PW / 2 + off, -PH / 2 + yy, PW, sh + 0.6)
      }
      ctx.restore()
      // the water: a faint body, a highlight band riding the slosh, a dark refraction edge
      ctx.save()
      roundRect(ctx, 46, 32, 268, 176, 10)
      ctx.clip()
      ctx.fillStyle = 'rgba(120,130,135,0.06)'
      ctx.fillRect(46, 32, 268, 176)
      const xb = 180 + 118 * Math.sin(2 * ph - 0.5)
      const band = ctx.createLinearGradient(xb - 34, 0, xb + 34, 0)
      const ba = 0.18 + 0.12 * Math.abs(Math.cos(2 * ph - 0.5))
      band.addColorStop(0, 'rgba(255,255,255,0)')
      band.addColorStop(0.45, `rgba(255,255,255,${ba * calm})`)
      band.addColorStop(0.55, `rgba(255,255,255,${ba * 0.8 * calm})`)
      band.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = band
      ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([1, 0, -0.18, 1, 20, 0])))
      ctx.fillRect(0, 0, W + 60, H)
      ctx.restore()
      ctx.save()
      roundRect(ctx, 46, 32, 268, 176, 10)
      ctx.clip()
      const xe = xb + 30
      const edge = ctx.createLinearGradient(xe - 6, 0, xe + 6, 0)
      edge.addColorStop(0, 'rgba(0,0,0,0)')
      edge.addColorStop(0.5, `rgba(20,24,30,${0.14 * calm})`)
      edge.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = edge
      ctx.fillRect(xe - 8, 0, 16, H)
      ctx.restore()
      // the light: red safelight, then white light from 6.5 s
      const safe = 1 - smoothstep(6.5, 6.85, te)
      if (safe > 0.001) {
        ctx.globalCompositeOperation = 'multiply'
        ctx.fillStyle = mixHex('#FFFFFF', '#FF4A26', safe)
        ctx.fillRect(0, 0, W, H)
        ctx.globalCompositeOperation = 'screen'
        const glow = ctx.createRadialGradient(70, -20, 10, 70, -20, 300)
        glow.addColorStop(0, `rgba(150,20,0,${0.22 * safe})`)
        glow.addColorStop(1, 'rgba(150,20,0,0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, W, H)
        ctx.globalCompositeOperation = 'source-over'
      }
      // lights down, new sheet, lights up (the loop seam)
      const dark = windowed(tt, 7.4, 7.7, 7.82, 8.0)
      if (dark > 0.001) {
        ctx.fillStyle = `rgba(4,3,2,${clamp(dark * 0.94, 0, 1)})`
        ctx.fillRect(0, 0, W, H)
      }
      ctx.restore()
      finish(ctx, tt, w, h, { bloom: 0.28 })
    },
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}
