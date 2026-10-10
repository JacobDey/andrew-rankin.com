// Sunny 16 (8 s, hero 5.5): a flat cutaway diorama of a little summer house. The garage workshop in
// warm wood (left), the backyard in green (right) with a swaying tree and a ball bouncing on the
// lawn, and the basement darkroom in red below. A tiny camera on a tripod fires a soft flash at
// 3.0 s (under 25% white, 120 ms). A dotted film path runs from the camera through the house and
// down the stairs to the darkroom, where a print slides into a tray and comes up at 5–6.5 s.

import type { Preview, PreviewEnv } from './types'
import { W, H, TAU, designSpace, finish, ctx2d, makeCanvas, smoothstep, windowed, easeInOut, mulberry32 } from './kit'

const GROUND = 150
const PATH: [number, number][] = [
  [214, 133],
  [196, 126],
  [168, 118],
  [148, 140],
  [152, 156],
  [160, 176],
  [150, 196],
  [124, 204],
  [106, 206],
]

export function createStudioPreview(): Preview {
  const period = 8
  let env: PreviewEnv | null = null
  let still: HTMLCanvasElement | null = null
  const segLen: number[] = []
  let total = 0

  function buildStill(seed: number): HTMLCanvasElement {
    const S = 2
    const c = makeCanvas(W * S, H * S)
    const g = ctx2d(c)
    g.scale(S, S)
    const r = mulberry32(seed)
    // sky
    const sky = g.createLinearGradient(0, 0, 0, GROUND)
    sky.addColorStop(0, '#8DB8DA')
    sky.addColorStop(1, '#EDE6CF')
    g.fillStyle = sky
    g.fillRect(0, 0, W, GROUND)
    const sun = g.createRadialGradient(330, 26, 2, 330, 26, 40)
    sun.addColorStop(0, 'rgba(255,248,220,1)')
    sun.addColorStop(0.25, 'rgba(255,240,200,0.7)')
    sun.addColorStop(1, 'rgba(255,240,200,0)')
    g.fillStyle = sun
    g.fillRect(280, 0, 80, 70)
    // earth (cut away) below the ground line
    g.fillStyle = '#4F3A28'
    g.fillRect(0, GROUND, W, H - GROUND)
    g.fillStyle = 'rgba(0,0,0,0.12)'
    for (let i = 0; i < 70; i++) g.fillRect(r() * W, GROUND + 4 + r() * 86, 2 + r() * 4, 1.2)
    // lawn surface
    g.fillStyle = '#5E9A52'
    g.fillRect(176, GROUND - 4, W - 176, 6)
    // fence
    g.fillStyle = '#DCD3BD'
    for (let x = 182; x < W; x += 9) {
      g.beginPath()
      g.moveTo(x, GROUND - 4)
      g.lineTo(x, 122)
      g.lineTo(x + 3, 118)
      g.lineTo(x + 6, 122)
      g.lineTo(x + 6, GROUND - 4)
      g.fill()
    }
    g.fillRect(178, 128, W - 178, 3)
    g.fillRect(178, 140, W - 178, 3)
    // the house: roof, walls, cutaway workshop
    g.fillStyle = '#6E3B2A'
    g.beginPath()
    g.moveTo(14, 80)
    g.lineTo(100, 30)
    g.lineTo(186, 80)
    g.closePath()
    g.fill()
    g.fillStyle = '#572C1F'
    for (let i = 0; i < 6; i++) g.fillRect(30 + i * 8, 72 - i * 4.6, 140 - i * 16, 1.2)
    g.fillStyle = '#E5D7BC'
    g.fillRect(22, 78, 156, GROUND - 78)
    const wood = g.createLinearGradient(0, 84, 0, GROUND)
    wood.addColorStop(0, '#B88252')
    wood.addColorStop(1, '#9A6639')
    g.fillStyle = wood
    g.fillRect(28, 84, 144, GROUND - 84)
    g.strokeStyle = 'rgba(70,40,20,0.25)'
    g.lineWidth = 0.6
    for (let x = 34; x < 172; x += 9) {
      g.beginPath()
      g.moveTo(x, 84)
      g.lineTo(x, GROUND)
      g.stroke()
    }
    // pegboard and tools
    g.fillStyle = '#C9A274'
    g.fillRect(40, 92, 70, 26)
    g.fillStyle = 'rgba(60,35,15,0.45)'
    for (let y = 95; y < 116; y += 4) for (let x = 43; x < 108; x += 4) g.fillRect(x, y, 0.8, 0.8)
    g.fillStyle = '#3A3430'
    g.fillRect(48, 96, 2, 14)
    g.fillRect(45, 96, 8, 3)
    g.beginPath()
    g.arc(66, 104, 5, 0, TAU)
    g.lineWidth = 1.6
    g.strokeStyle = '#3A3430'
    g.stroke()
    g.fillRect(82, 95, 3, 18)
    g.fillRect(92, 98, 10, 2)
    g.fillRect(96, 98, 2, 12)
    // workbench with a camera half-built on it
    g.fillStyle = '#6B4428'
    g.fillRect(36, 124, 84, 5)
    g.fillRect(40, 129, 4, 21)
    g.fillRect(112, 129, 4, 21)
    g.fillStyle = '#2C2A28'
    g.fillRect(70, 113, 18, 11)
    g.fillStyle = '#4B4845'
    g.beginPath()
    g.arc(79, 118.5, 4, 0, TAU)
    g.fill()
    g.fillStyle = '#8FA6B8'
    g.beginPath()
    g.arc(79, 118.5, 2, 0, TAU)
    g.fill()
    // a hanging lamp
    g.strokeStyle = '#2C2A28'
    g.lineWidth = 0.8
    g.beginPath()
    g.moveTo(128, 84)
    g.lineTo(128, 98)
    g.stroke()
    g.fillStyle = '#2C2A28'
    g.beginPath()
    g.moveTo(122, 104)
    g.lineTo(134, 104)
    g.lineTo(130, 98)
    g.lineTo(126, 98)
    g.fill()
    const lamp = g.createRadialGradient(128, 106, 1, 128, 112, 30)
    lamp.addColorStop(0, 'rgba(255,230,160,0.55)')
    lamp.addColorStop(1, 'rgba(255,230,160,0)')
    g.fillStyle = lamp
    g.fillRect(96, 100, 64, 50)
    // the floor, and the stair down to the basement
    g.fillStyle = '#5A3A22'
    g.fillRect(22, GROUND - 2, 156, 6)
    // basement darkroom, under the safelight
    g.fillStyle = '#3A0E09'
    g.fillRect(28, 156, 144, 70)
    const safe = g.createRadialGradient(70, 160, 4, 70, 172, 110)
    safe.addColorStop(0, 'rgba(255,70,40,0.75)')
    safe.addColorStop(0.5, 'rgba(180,30,15,0.35)')
    safe.addColorStop(1, 'rgba(120,10,5,0)')
    g.fillStyle = safe
    g.fillRect(28, 156, 144, 70)
    g.fillStyle = '#FF5A3A'
    g.fillRect(64, 157, 12, 4)
    g.fillStyle = '#2A0A06'
    for (let i = 0; i < 7; i++) g.fillRect(140 + (i % 2) * 0, 156 + i * 10, 30 - i * 4, 3)
    g.fillStyle = '#5A1A10'
    g.beginPath()
    g.moveTo(144, 156)
    g.lineTo(170, 156)
    g.lineTo(170, 226)
    g.lineTo(166, 226)
    g.closePath()
    g.fill()
    // the clothesline and two prints drying
    g.strokeStyle = 'rgba(255,200,180,0.5)'
    g.lineWidth = 0.6
    g.beginPath()
    g.moveTo(34, 168)
    g.quadraticCurveTo(80, 174, 130, 168)
    g.stroke()
    g.fillStyle = 'rgba(255,190,170,0.75)'
    g.fillRect(46, 170, 14, 11)
    g.fillRect(96, 171, 13, 10)
    // the wet bench and its tray
    g.fillStyle = '#1E0806'
    g.fillRect(40, 210, 100, 16)
    g.fillStyle = '#C9B9A8'
    g.fillRect(88, 201, 34, 9)
    g.fillStyle = 'rgba(255,90,60,0.35)'
    g.fillRect(90, 202, 30, 7)
    return c
  }

  function along(p: number): [number, number] {
    let d = p * total
    for (let i = 0; i < segLen.length; i++) {
      const L = segLen[i]!
      if (d <= L || i === segLen.length - 1) {
        const a = PATH[i]!
        const b = PATH[i + 1]!
        const k = L > 0 ? Math.min(1, d / L) : 0
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
      }
      d -= L
    }
    return PATH[PATH.length - 1]!
  }

  return {
    period,
    heroT: 5.5,
    init(e) {
      env = e
      still = buildStill(e.seed)
      segLen.length = 0
      total = 0
      for (let i = 0; i < PATH.length - 1; i++) {
        const L = Math.hypot(PATH[i + 1]![0] - PATH[i]![0], PATH[i + 1]![1] - PATH[i]![1])
        segLen.push(L)
        total += L
      }
    },
    resize(e) {
      env = e
    },
    draw(t) {
      if (!env || !still) return
      const { ctx, w, h } = env
      const tt = ((t % period) + period) % period
      const ph = (tt / period) * TAU
      ctx.save()
      designSpace(ctx, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.drawImage(still, 0, 0, W, H)

      // the tree, swaying
      const sway = 0.035 * Math.sin(2 * ph) + 0.012 * Math.sin(4 * ph + 1)
      ctx.save()
      ctx.translate(322, GROUND - 2)
      ctx.rotate(sway)
      ctx.fillStyle = '#5A3E2A'
      ctx.fillRect(-3, -50, 6, 50)
      ctx.fillStyle = '#3F7A3E'
      for (const [x, y, r] of [[0, -64, 22], [-16, -54, 15], [16, -52, 16], [-6, -80, 14], [10, -78, 13]] as const) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(160,210,120,0.35)'
      ctx.beginPath()
      ctx.arc(-8, -72, 9, 0, TAU)
      ctx.fill()
      ctx.restore()

      // the ball: four bounces per loop, squashed at contact
      const b = Math.abs(Math.sin((Math.PI * tt) / 2))
      const by = GROUND - 6 - 36 * b
      const squash = b < 0.12 ? 1 - (0.12 - b) * 1.6 : 1
      ctx.fillStyle = `rgba(0,0,0,${0.28 * (1 - b * 0.6)})`
      ctx.beginPath()
      ctx.ellipse(266, GROUND - 1.5, 7 - b * 2.5, 1.8, 0, 0, TAU)
      ctx.fill()
      ctx.save()
      ctx.translate(266, by + 6 * (1 - squash))
      ctx.scale(1 / squash, squash)
      ctx.fillStyle = '#E2503B'
      ctx.beginPath()
      ctx.arc(0, 0, 6, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#F3EFE4'
      ctx.fillRect(-6, -1, 12, 2)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      ctx.arc(-2, -2.5, 1.6, 0, TAU)
      ctx.fill()
      ctx.restore()

      // a sparrow on the fence, bobbing
      const bob = Math.max(0, Math.sin(ph * 4)) * 1.2
      ctx.fillStyle = '#5B4636'
      ctx.beginPath()
      ctx.ellipse(232, 115 - bob, 4.2, 2.8, -0.2, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(235.5, 112.5 - bob * 1.4, 2, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#D9A441'
      ctx.fillRect(237.2, 112.3 - bob * 1.4, 1.6, 0.8)

      // the camera on its tripod, aimed at the ball
      ctx.strokeStyle = '#2C2A28'
      ctx.lineWidth = 1.1
      ctx.beginPath()
      ctx.moveTo(214, 136)
      ctx.lineTo(206, GROUND - 1)
      ctx.moveTo(214, 136)
      ctx.lineTo(214, GROUND - 1)
      ctx.moveTo(214, 136)
      ctx.lineTo(222, GROUND - 1)
      ctx.stroke()
      ctx.fillStyle = '#2C2A28'
      ctx.fillRect(207, 126, 15, 10)
      ctx.fillRect(221, 128.5, 4, 5)
      ctx.fillStyle = '#9C9890'
      ctx.fillRect(209, 123.5, 5, 2.5)

      // the flash: soft, under 25% white, 120 ms
      const flash = windowed(tt, 2.98, 3.0, 3.08, 3.1)
      if (flash > 0) {
        const g = ctx.createRadialGradient(214, 126, 2, 214, 126, 150)
        g.addColorStop(0, `rgba(255,255,250,${0.24 * flash})`)
        g.addColorStop(1, 'rgba(255,255,250,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
      }

      // the film path: a dotted line, and the roll travelling along it
      const pathOn = windowed(tt, 3.1, 3.4, 6.6, 7.2)
      if (pathOn > 0) {
        ctx.globalAlpha = pathOn * 0.85
        ctx.strokeStyle = '#F2C443'
        ctx.lineWidth = 1.3
        ctx.setLineDash([0.1, 4.2])
        ctx.lineCap = 'round'
        ctx.lineDashOffset = -tt * 9
        ctx.beginPath()
        ctx.moveTo(PATH[0]![0], PATH[0]![1])
        for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i]![0], PATH[i]![1])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        const p = easeInOut((tt - 3.2) / 1.7)
        if (p > 0 && p < 1) {
          const [x, y] = along(p)
          ctx.fillStyle = '#F2C443'
          ctx.fillRect(x - 2.6, y - 3.4, 5.2, 6.8)
          ctx.fillStyle = '#2C2A28'
          ctx.fillRect(x - 2.6, y - 1, 5.2, 0.9)
        }
      }

      // the print slides into the tray and comes up
      const slide = easeInOut((tt - 4.9) / 0.45)
      const fade = 1 - smoothstep(7.2, 7.8, tt)
      if (slide > 0 && fade > 0) {
        const x = 92 + (1 - slide) * 18
        const y = 202.5
        ctx.globalAlpha = fade
        ctx.fillStyle = '#F4EEE2'
        ctx.fillRect(x, y, 26, 6)
        const dev = smoothstep(5.0, 6.5, tt)
        ctx.globalAlpha = fade * dev
        ctx.fillStyle = '#7FA9C9'
        ctx.fillRect(x + 1, y + 0.6, 24, 2.6)
        ctx.fillStyle = '#4F8A46'
        ctx.fillRect(x + 1, y + 3.2, 24, 2.2)
        ctx.fillStyle = '#C9402E'
        ctx.beginPath()
        ctx.arc(x + 15, y + 2.6, 1.3, 0, TAU)
        ctx.fill()
        ctx.globalAlpha = 1
        // the safelight makes everything in the basement red
        ctx.globalCompositeOperation = 'multiply'
        ctx.fillStyle = '#FF7A60'
        ctx.fillRect(x - 1, y - 1, 28, 8)
        ctx.globalCompositeOperation = 'source-over'
      }
      ctx.restore()
      finish(ctx, tt, w, h, { bloom: 0.3 })
    },
  }
}
