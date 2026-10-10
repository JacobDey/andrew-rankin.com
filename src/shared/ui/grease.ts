// Grease-pencil marks (art-direction §6.3): hand-drawn shapes come from code, seeded, so they stay
// the same across reloads. Every function returns an SVG path `d` string. A string seed goes through hashString.

import { mulberry32, hashString, type Rng } from '../core/rng'
import { prefersReducedMotion } from '../core/flags'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Pt = [number, number]

function rngOf(seed: number | string): Rng {
  return mulberry32(typeof seed === 'string' ? hashString(seed) : seed >>> 0)
}
const f = (n: number): string => (Math.round(n * 100) / 100).toString()

/** Catmull-Rom through the points, written as cubic Beziers. */
function smooth(pts: Pt[], closed = false): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${f(pts[0]![0])} ${f(pts[0]![1])}`
  const at = (i: number): Pt => (closed ? pts[((i % n) + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!)
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}

const rot = (p: Pt, c: Pt, a: number): Pt => {
  const s = Math.sin(a)
  const co = Math.cos(a)
  const x = p[0] - c[0]
  const y = p[1] - c[1]
  return [c[0] + x * co - y * s, c[1] + x * s + y * co]
}

/**
 * A loose ellipse around `rect`: radii = half the size + 6-10% padding, random start angle, 2 pi plus
 * 0.35-0.6 rad of overshoot, radius wobble from two low-frequency sines, whole shape rotated +/-3 degrees,
 * sampled every 8 degrees.
 */
export function circlePath(rect: Rect, seed: number | string): string {
  const r = rngOf(seed)
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const pad = 1.06 + r() * 0.04 + 0.0 // 6-10%
  const rx = (rect.w / 2) * pad * 1.08
  const ry = (rect.h / 2) * pad * 1.08
  const start = r() * Math.PI * 2
  const sweep = Math.PI * 2 + 0.35 + r() * 0.25
  const a1 = 2 + r() * 3 // wobble amplitude, px
  const a2 = 2 + r() * 3
  const ph1 = r() * Math.PI * 2
  const ph2 = r() * Math.PI * 2
  const tilt = ((r() * 6 - 3) * Math.PI) / 180
  const step = (8 * Math.PI) / 180
  const n = Math.ceil(sweep / step)
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = Math.min(sweep, i * step)
    const turn = t / (Math.PI * 2)
    const w = a1 * Math.sin(turn * Math.PI * 2 * 2 + ph1) + a2 * Math.sin(turn * Math.PI * 2 * 3 + ph2)
    // the loop drifts outward a little as it overshoots, like a real pencil circle that does not quite close
    const drift = 1 + 0.025 * Math.max(0, turn - 0.75) * 4
    const a = start + t
    pts.push(rot([cx + (rx * drift + w) * Math.cos(a), cy + (ry * drift + w) * Math.sin(a)], [cx, cy], tilt))
  }
  return smooth(pts)
}

/** A slightly wavy line left to right across `w`, with a small flick at the end. Starts at (0, 0). */
export function underlinePath(w: number, seed: number | string): string {
  const r = rngOf(seed)
  const slope = (r() - 0.5) * 0.04
  const amp = 1.2 + r() * 1.6
  const ph = r() * Math.PI * 2
  const n = Math.max(3, Math.round(w / 28))
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const x = (w * i) / n
    pts.push([x, x * slope + amp * Math.sin((i / n) * Math.PI * 2 * 1.3 + ph)])
  }
  const last = pts[pts.length - 1]!
  pts.push([last[0] + 5 + r() * 3, last[1] - 3 - r() * 2])
  return smooth(pts)
}

/** A tick in roughly a 32x32 box. */
export function checkPath(seed: number | string): string {
  const r = rngOf(seed)
  const j = (v: number): number => v + (r() - 0.5) * 2.5
  const pts: Pt[] = [
    [j(3), j(17)],
    [j(11), j(26)],
    [j(19), j(14)],
    [j(30), j(4)],
  ]
  return smooth(pts)
}

/** A bowed arrow from `from` to `to`, ending in a two-stroke head. */
export function arrowPath(from: [number, number], to: [number, number], seed: number | string): string {
  const r = rngOf(seed)
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const bow = len * (0.06 + r() * 0.08) * (r() < 0.5 ? -1 : 1)
  const mid: Pt = [(from[0] + to[0]) / 2 + nx * bow, (from[1] + to[1]) / 2 + ny * bow]
  const q1: Pt = [from[0] + dx * 0.25 + nx * bow * 0.8, from[1] + dy * 0.25 + ny * bow * 0.8]
  const q3: Pt = [from[0] + dx * 0.75 + nx * bow * 0.7, from[1] + dy * 0.75 + ny * bow * 0.7]
  const shaft = smooth([from, q1, mid, q3, to])
  // arrowhead: two short strokes, rotated about the direction at the tip
  const ang = Math.atan2(to[1] - q3[1], to[0] - q3[0])
  const hl = Math.min(18, Math.max(8, len * 0.18))
  const spread = 0.5 + r() * 0.15
  const h1: Pt = [to[0] - hl * Math.cos(ang - spread), to[1] - hl * Math.sin(ang - spread)]
  const h2: Pt = [to[0] - hl * Math.cos(ang + spread), to[1] - hl * Math.sin(ang + spread)]
  return `${shaft}M${f(h1[0])} ${f(h1[1])}L${f(to[0])} ${f(to[1])}L${f(h2[0])} ${f(h2[1])}`
}

/** A five-point star in one stroke (a pentagram), centred at (r, r): it fits a 2r x 2r box. */
export function starPath(rad: number, seed: number | string): string {
  const r = rngOf(seed)
  const order = [0, 2, 4, 1, 3, 0]
  const rot0 = -Math.PI / 2 + (r() - 0.5) * 0.25
  const pts: Pt[] = order.map((k) => {
    const a = rot0 + (k * 2 * Math.PI) / 5
    const rr = rad * (0.96 + (r() - 0.5) * 0.12)
    return [rad + rr * Math.cos(a), rad + rr * Math.sin(a)]
  })
  // straight-ish strokes with a hint of bow: draw each leg as a short quadratic
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * rad * 0.1
    const my = (a[1] + b[1]) / 2 + (r() - 0.5) * rad * 0.1
    d += `Q${f(mx)} ${f(my)} ${f(b[0])} ${f(b[1])}`
  }
  return d
}

/** Four L-shaped corner marks just outside `rect`, like crop marks drawn with a grease pencil. */
export function cropMarksPath(rect: Rect, seed: number | string): string {
  const r = rngOf(seed)
  const len = Math.max(8, Math.min(22, Math.min(rect.w, rect.h) * 0.2))
  const gap = 4 + r() * 3
  const j = (): number => (r() - 0.5) * 2
  const corners: Array<[number, number, number, number]> = [
    [rect.x - gap, rect.y - gap, 1, 1],
    [rect.x + rect.w + gap, rect.y - gap, -1, 1],
    [rect.x + rect.w + gap, rect.y + rect.h + gap, -1, -1],
    [rect.x - gap, rect.y + rect.h + gap, 1, -1],
  ]
  let d = ''
  for (const [x, y, sx, sy] of corners) {
    const a: Pt = [x + sx * (len + j()), y + j()]
    const b: Pt = [x + j() * 0.5, y + j() * 0.5]
    const c: Pt = [x + j(), y + sy * (len + j())]
    d += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}L${f(c[0])} ${f(c[1])}`
  }
  return d
}

/** A question mark in a size x size box (the dot is a zero-length segment; use round caps). */
export function questionPath(size: number, seed: number | string): string {
  const r = rngOf(seed)
  const s = size
  const j = (): number => (r() - 0.5) * s * 0.04
  const hook =
    `M${f(s * 0.26 + j())} ${f(s * 0.3 + j())}` +
    `C${f(s * 0.26 + j())} ${f(s * 0.06 + j())} ${f(s * 0.78 + j())} ${f(s * 0.04 + j())} ${f(s * 0.76 + j())} ${f(s * 0.3 + j())}` +
    `C${f(s * 0.74 + j())} ${f(s * 0.52 + j())} ${f(s * 0.5 + j())} ${f(s * 0.5 + j())} ${f(s * 0.5 + j())} ${f(s * 0.72 + j())}`
  const dot = `M${f(s * 0.5 + j())} ${f(s * 0.92 + j())}h0.01`
  return hook + dot
}

/** Animate a stroke being drawn along its length (dash-offset). Instant under reduced motion. */
export function drawStroke(path: SVGPathElement, o: { ms?: number } = {}): Promise<void> {
  const L = path.getTotalLength()
  path.style.strokeDasharray = `${L}`
  if (prefersReducedMotion() || typeof path.animate !== 'function') {
    path.style.strokeDashoffset = '0'
    return Promise.resolve()
  }
  path.style.strokeDashoffset = `${L}`
  const anim = path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], {
    duration: o.ms ?? 480,
    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    fill: 'forwards',
  })
  return anim.finished.then(
    () => {
      path.style.strokeDashoffset = '0'
      anim.cancel()
    },
    () => {
      path.style.strokeDashoffset = '0'
    },
  )
}

/** The waxy texture filter, `filter#ar-grease`, defined once per page in a hidden <svg>. */
export function ensureGreaseFilter(): void {
  if (typeof document === 'undefined' || document.getElementById('ar-grease')) return
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.position = 'absolute'
  svg.innerHTML =
    '<filter id="ar-grease" x="-10%" y="-10%" width="120%" height="120%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
    '<feComponentTransfer in="n" result="holes"><feFuncA type="discrete" tableValues="1 1 1 0.55 1 1 0.7 1"/></feComponentTransfer>' +
    '<feComposite in="d" in2="holes" operator="in"/>' +
    '</filter>'
  ;(document.body ?? document.documentElement).prepend(svg)
}
