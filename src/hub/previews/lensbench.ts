// Lens Bench (8 s, hero 3.0): a side view of an optical bench on drafting paper. Three elements
// (biconvex, biconcave, plano-convex) with a violet coating edge. A comb of 11 rays enters from
// the left and is really traced with Snell's law through spherical surfaces (n = 1.52 and 1.62)
// at three wavelengths with a small dispersion, so colour fringes open up at focus. The ray angle
// sweeps slowly; an iris between the elements closes from f/2 towards f/8 and opens again, and
// the spot on the ground glass sharpens as the bundle narrows.

import type { Preview, PreviewEnv } from './types'
import { W, H, TAU, designSpace, finish, ctx2d, makeCanvas, mulberry32 } from './kit'

// [vertex mm, radius mm (Infinity = plane), index after the surface, dispersion weight]
type Surf = readonly [number, number, number, number]
const SURFS: readonly Surf[] = [
  [30, 30, 1.52, 1],
  [38, -30, 1, 0],
  [46, -26, 1.62, 1.6],
  [48.5, 26, 1, 0],
  [57, Infinity, 1.52, 1],
  [63, -24, 1, 0],
]
const APERTURE = [14, 14, 11.5, 11.5, 12.5, 12.5]
const IRIS_X = 53
const SCREEN_X = 88.6
const SX = 3.0 // design units per mm
const OX = 14
const AXIS = 116
const WAVES = [
  { dn: -0.008, col: 'rgb(255,118,104)' },
  { dn: 0, col: 'rgb(118,214,136)' },
  { dn: 0.012, col: 'rgb(128,146,255)' },
] as const

const X = (mm: number): number => OX + mm * SX
const Y = (mm: number): number => AXIS + mm * SX

interface Hit {
  pts: number[] // x0, y0, x1, y1, … in mm
  end: 'screen' | 'iris'
  y: number
}

function trace(y0: number, ang: number, dn: number, iris: number): Hit {
  let px = 0
  let py = y0
  let dx = Math.cos(ang)
  let dy = Math.sin(ang)
  let n1 = 1
  const pts = [px, py]
  for (let s = 0; s < SURFS.length; s++) {
    const [xv, R, nb, glass] = SURFS[s]!
    if (s === 4) {
      // the iris sits between the second and third elements
      const t = (IRIS_X - px) / dx
      const yi = py + t * dy
      if (Math.abs(yi) > iris) {
        pts.push(IRIS_X, yi)
        return { pts, end: 'iris', y: yi }
      }
    }
    const n2 = nb === 1 ? 1 : nb + dn * glass
    let hx: number
    let hy: number
    let nx: number
    let ny: number
    if (!Number.isFinite(R)) {
      const t = (xv - px) / dx
      hx = xv
      hy = py + t * dy
      nx = -1
      ny = 0
    } else {
      const cx = xv + R
      const ox = px - cx
      const oy = py
      const b = ox * dx + oy * dy
      const disc = b * b - (ox * ox + oy * oy - R * R)
      if (disc < 0) return { pts, end: 'iris', y: py }
      const sq = Math.sqrt(disc)
      const r1 = -b - sq
      const r2 = -b + sq
      const x1 = px + r1 * dx
      const x2 = px + r2 * dx
      const r = Math.abs(x1 - xv) < Math.abs(x2 - xv) ? r1 : r2
      hx = px + r * dx
      hy = py + r * dy
      nx = (hx - cx) / R
      ny = hy / R
    }
    const eta = n1 / n2
    let cosi = -(nx * dx + ny * dy)
    if (cosi < 0) {
      nx = -nx
      ny = -ny
      cosi = -cosi
    }
    const k = 1 - eta * eta * (1 - cosi * cosi)
    if (k < 0) return { pts, end: 'iris', y: hy }
    const f = eta * cosi - Math.sqrt(k)
    dx = eta * dx + f * nx
    dy = eta * dy + f * ny
    const L = Math.hypot(dx, dy)
    dx /= L
    dy /= L
    px = hx
    py = hy
    n1 = n2
    pts.push(px, py)
  }
  const t = (SCREEN_X - px) / dx
  const ys = py + t * dy
  pts.push(SCREEN_X, ys)
  return { pts, end: 'screen', y: ys }
}

export function createLensbenchPreview(): Preview {
  const period = 8
  let env: PreviewEnv | null = null
  let paper: HTMLCanvasElement | null = null

  function buildPaper(seed: number): HTMLCanvasElement {
    const S = 2
    const c = makeCanvas(W * S, H * S)
    const g = ctx2d(c)
    g.scale(S, S)
    g.fillStyle = '#ECE7DB'
    g.fillRect(0, 0, W, H)
    const r = mulberry32(seed)
    for (let i = 0; i < 600; i++) {
      g.fillStyle = `rgba(120,100,70,${0.025 + r() * 0.03})`
      g.fillRect(r() * W, r() * H, 0.6 + r(), 0.6 + r())
    }
    for (let x = 0; x <= W; x += 6) {
      g.strokeStyle = x % 30 === 0 ? 'rgba(80,120,160,0.24)' : 'rgba(80,120,160,0.1)'
      g.lineWidth = 0.5
      g.beginPath()
      g.moveTo(x + 0.25, 0)
      g.lineTo(x + 0.25, H)
      g.stroke()
    }
    for (let y = 0; y <= H; y += 6) {
      g.strokeStyle = y % 30 === 0 ? 'rgba(80,120,160,0.24)' : 'rgba(80,120,160,0.1)'
      g.lineWidth = 0.5
      g.beginPath()
      g.moveTo(0, y + 0.25)
      g.lineTo(W, y + 0.25)
      g.stroke()
    }
    // the walnut rail and the carriages
    const rail = g.createLinearGradient(0, 196, 0, 210)
    rail.addColorStop(0, '#8A5A34')
    rail.addColorStop(0.4, '#6B4226')
    rail.addColorStop(1, '#3E2615')
    g.fillStyle = 'rgba(0,0,0,0.18)'
    g.fillRect(8, 200, 348, 14)
    g.fillStyle = rail
    g.fillRect(6, 196, 348, 12)
    g.strokeStyle = 'rgba(30,18,8,0.35)'
    g.lineWidth = 0.6
    for (let i = 0; i < 6; i++) {
      g.beginPath()
      g.moveTo(6, 199 + i * 1.6)
      g.bezierCurveTo(120, 198 + i * 1.8, 240, 201 + i * 1.4, 354, 199 + i * 1.7)
      g.stroke()
    }
    g.fillStyle = 'rgba(30,20,10,0.6)'
    for (let x = 20; x < 350; x += 30) g.fillRect(x, 207, 0.6, 1.5)
    for (const mm of [34, 47.2, 60, IRIS_X]) {
      const x = X(mm)
      g.fillStyle = '#2B2622'
      g.fillRect(x - 1, AXIS + 46, 2, 196 - AXIS - 46)
      g.fillStyle = '#3B3530'
      g.fillRect(x - 9, 190, 18, 7)
    }
    // the ground-glass back and its stand
    g.fillStyle = '#2B2622'
    g.fillRect(X(SCREEN_X) - 1, AXIS + 52, 2, 196 - AXIS - 52)
    g.fillRect(X(SCREEN_X) - 10, 190, 20, 7)
    // optical axis, dashed
    g.strokeStyle = 'rgba(70,62,56,0.45)'
    g.lineWidth = 0.6
    g.setLineDash([5, 3, 1, 3])
    g.beginPath()
    g.moveTo(0, AXIS)
    g.lineTo(W, AXIS)
    g.stroke()
    g.setLineDash([])
    return c
  }

  function lensPath(g: CanvasRenderingContext2D, a: Surf, b: Surf, ap: number): void {
    const side = (s: Surf, from: number, to: number): void => {
      const [xv, R] = s
      const steps = 18
      for (let i = 0; i <= steps; i++) {
        const y = from + ((to - from) * i) / steps
        const x = Number.isFinite(R) ? xv : xv + R - Math.sign(R) * Math.sqrt(R * R - y * y)
        if (i === 0 && s === a) g.moveTo(X(x), Y(y))
        else g.lineTo(X(x), Y(y))
      }
    }
    g.beginPath()
    side(a, -ap, ap)
    side(b, ap, -ap)
    g.closePath()
  }

  return {
    period,
    heroT: 3.0,
    init(e) {
      env = e
      paper = buildPaper(e.seed)
    },
    resize(e) {
      env = e
    },
    draw(t) {
      if (!env || !paper) return
      const { ctx, w, h } = env
      const tt = ((t % period) + period) % period
      const ph = (tt / period) * TAU
      const ang = 0.032 * Math.sin(ph + 0.5)
      const iris = 6.25 + 4.25 * Math.cos(ph - TAU / 8)
      ctx.save()
      designSpace(ctx, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.drawImage(paper, 0, 0, W, H)

      // ground glass (dark, so the spot reads)
      const gx = X(SCREEN_X)
      ctx.fillStyle = '#34312D'
      ctx.fillRect(gx - 2.5, AXIS - 52, 6, 104)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(gx - 2.5, AXIS - 52, 1.2, 104)

      // rays, three wavelengths, multiplied on the paper so the fringes separate at focus
      ctx.globalCompositeOperation = 'multiply'
      ctx.lineWidth = 1.05
      ctx.lineJoin = 'round'
      const spots: { y: number; n: number; lo: number; hi: number }[] = []
      for (const wv of WAVES) {
        ctx.strokeStyle = wv.col
        let sum = 0
        let n = 0
        let lo = Infinity
        let hi = -Infinity
        for (let i = 0; i < 11; i++) {
          const y0 = -10 + i * 2 - Math.tan(ang) * 0
          const hit = trace(y0, ang, wv.dn, iris)
          const p = hit.pts
          ctx.beginPath()
          ctx.moveTo(X(p[0]!) - 20, Y(p[1]!) - 20 * Math.tan(ang))
          for (let k = 0; k < p.length; k += 2) ctx.lineTo(X(p[k]!), Y(p[k + 1]!))
          ctx.stroke()
          if (hit.end === 'screen') {
            sum += hit.y
            n++
            lo = Math.min(lo, hit.y)
            hi = Math.max(hi, hit.y)
          }
        }
        spots.push({ y: n ? sum / n : 0, n, lo, hi })
      }
      ctx.globalCompositeOperation = 'source-over'

      // the spot on the ground glass: smaller and brighter as the iris closes
      ctx.globalCompositeOperation = 'lighter'
      WAVES.forEach((wv, i) => {
        const s = spots[i]!
        if (!s.n) return
        const spread = Math.max(0.6, (s.hi - s.lo) * SX * 0.5)
        const cy = Y(s.y)
        const g = ctx.createRadialGradient(gx, cy, 0, gx, cy, spread + 3)
        g.addColorStop(0, wv.col)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.globalAlpha = Math.min(1, 0.35 + 6 / (spread + 4))
        ctx.fillRect(gx - spread - 4, cy - spread - 4, (spread + 4) * 2, (spread + 4) * 2)
      })
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      // the glass, with its coating
      const pairs: [number, number][] = [[0, 1], [2, 3], [4, 5]]
      for (const [a, b] of pairs) {
        lensPath(ctx, SURFS[a]!, SURFS[b]!, APERTURE[a]!)
        ctx.fillStyle = 'rgba(160,200,226,0.28)'
        ctx.fill()
        ctx.lineWidth = 2.6
        ctx.strokeStyle = 'rgba(150,118,236,0.55)'
        ctx.stroke()
        ctx.lineWidth = 0.9
        ctx.strokeStyle = '#2E333C'
        ctx.stroke()
        // a glint along the front face
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 0.8
        const [xv, R] = SURFS[a]!
        ctx.beginPath()
        for (let i = 0; i <= 8; i++) {
          const y = -APERTURE[a]! * 0.85 + i * 0.6
          const x = Number.isFinite(R) ? xv : xv + R - Math.sign(R) * Math.sqrt(R * R - y * y)
          if (i === 0) ctx.moveTo(X(x) + 1.4, Y(y))
          else ctx.lineTo(X(x) + 1.4, Y(y))
        }
        ctx.stroke()
      }

      // the iris blades
      const ix = X(IRIS_X)
      ctx.fillStyle = '#26221F'
      ctx.fillRect(ix - 1.6, Y(-15), 3.2, Y(-iris) - Y(-15))
      ctx.fillRect(ix - 1.6, Y(iris), 3.2, Y(15) - Y(iris))
      ctx.fillStyle = '#5B3FA6'
      ctx.fillRect(ix - 1.6, Y(-iris) - 1, 3.2, 1)
      ctx.fillRect(ix - 1.6, Y(iris), 3.2, 1)
      // readouts
      ctx.font = '500 9px "IBM Plex Mono", ui-monospace, monospace'
      ctx.fillStyle = '#3A342E'
      const fnum = 50 / (2 * iris)
      ctx.fillText(`f/${fnum.toFixed(1)}`, ix - 14, Y(-15) - 6)
      ctx.fillStyle = '#6B6359'
      ctx.font = '500 7px "IBM Plex Mono", ui-monospace, monospace'
      ctx.fillText(`${((ang * 180) / Math.PI).toFixed(1)}°`, 10, AXIS - 40)
      ctx.fillText('n 1.52', X(31), Y(-APERTURE[0]!) - 5)
      ctx.fillText('n 1.62', X(44.5), Y(-APERTURE[2]!) - 5)
      ctx.restore()
      finish(ctx, tt, w, h, { bloom: 0.18, vignette: 0.22 })
    },
  }
}
