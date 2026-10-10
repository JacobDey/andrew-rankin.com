// games/plates/content/paint.ts — the tableau painter.
//
// Each eye is a 480×424 canvas painted in *linear actinic radiance* Y (1 = a diffuse white under the
// scene's key light). The base canvas stores Y gamma-encoded (precision in the shadows); a second
// additive canvas stores emitters up to Y = 16 (flames, magnesium, trails, sky glow). Depth gives
// real stereo: everything drawn at depth z is shifted ±f·B/(2z) px per eye, so near things occlude
// differently in the two eyes (disocclusion clues) and the wiggle view shows parallax.
import { mulberry32 } from '../render/dither'

export const EYE_W = 480, EYE_H = 424
export const BASE = 0.076                       // stereo base (m)
export const GLOW_MAX = 16

export type EyeSide = 'L' | 'R'

export class Painter {
  readonly c: CanvasRenderingContext2D
  readonly g: CanvasRenderingContext2D
  readonly f: number
  eye: EyeSide = 'L'
  t = 0.5
  private shift = 0
  constructor(c: CanvasRenderingContext2D, g: CanvasRenderingContext2D, fovDeg: number) {
    this.c = c; this.g = g
    this.f = (EYE_W / 2) / Math.tan((fovDeg * Math.PI) / 360)
  }
  /** px per metre at depth z. */
  s(z: number): number { return this.f / z }
  /** Set the depth for what follows (horizontal eye shift). */
  at(z: number): this {
    const half = (this.f * BASE) / (2 * z)
    this.shift = this.eye === 'L' ? half : -half
    this.c.setTransform(1, 0, 0, 1, this.shift, 0)
    this.g.setTransform(1, 0, 0, 1, this.shift, 0)
    return this
  }
  get isL(): boolean { return this.eye === 'L' }
  reset(): void {
    this.c.setTransform(1, 0, 0, 1, 0, 0); this.g.setTransform(1, 0, 0, 1, 0, 0)
    this.c.globalAlpha = 1; this.g.globalAlpha = 1
    this.c.globalCompositeOperation = 'source-over'; this.g.globalCompositeOperation = 'source-over'
    this.c.fillStyle = '#000'; this.c.fillRect(0, 0, EYE_W, EYE_H)
    this.g.fillStyle = '#000'; this.g.fillRect(0, 0, EYE_W, EYE_H)
    this.g.globalCompositeOperation = 'lighter'
    this.c.lineCap = 'round'; this.c.lineJoin = 'round'
    this.g.lineCap = 'round'; this.g.lineJoin = 'round'
  }
  // ---- base (reflective) drawing; Y ∈ [0, 1]. Every opaque shape also blacks out the emitter
  //      layer beneath it, so a figure in front of a bright sky occludes the sky. ----
  private both(path: (x: CanvasRenderingContext2D) => void, fill: string | CanvasGradient, stroke?: { w: number }): void {
    const c = this.c, g = this.g
    if (stroke) { c.strokeStyle = fill; c.lineWidth = stroke.w; path(c); c.stroke() } else { c.fillStyle = fill; path(c); c.fill() }
    if (c.globalAlpha < 0.99) return
    g.globalCompositeOperation = 'source-over'
    if (stroke) { g.strokeStyle = '#000'; g.lineWidth = stroke.w; path(g); g.stroke() } else { g.fillStyle = '#000'; path(g); g.fill() }
    g.globalCompositeOperation = 'lighter'
  }
  fill(Y: number): this { this.c.fillStyle = grey(Y); return this }
  stroke(Y: number, w: number): this { this.c.strokeStyle = grey(Y); this.c.lineWidth = w; return this }
  rect(x: number, y: number, w: number, h: number, Y: number): this { this.both((k) => { k.beginPath(); k.rect(x, y, w, h) }, grey(Y)); return this }
  ellipse(x: number, y: number, rx: number, ry: number, Y: number, rot = 0): this {
    this.both((k) => { k.beginPath(); k.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2) }, grey(Y)); return this
  }
  circle(x: number, y: number, r: number, Y: number): this { return this.ellipse(x, y, r, r, Y) }
  poly(pts: number[], Y: number): this {
    this.both((k) => { k.beginPath(); k.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) k.lineTo(pts[i], pts[i + 1]); k.closePath() }, grey(Y)); return this
  }
  line(pts: number[], w: number, Y: number): this {
    this.both((k) => { k.beginPath(); k.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) k.lineTo(pts[i], pts[i + 1]) }, grey(Y), { w }); return this
  }
  /** Vertical linear gradient rect (Y top → Y bottom). */
  vgrad(x: number, y: number, w: number, h: number, Y0: number, Y1: number): this {
    const gr = this.c.createLinearGradient(0, y, 0, y + h)
    gr.addColorStop(0, grey(Y0)); gr.addColorStop(1, grey(Y1))
    this.both((k) => { k.beginPath(); k.rect(x, y, w, h) }, gr); return this
  }
  hgrad(x: number, y: number, w: number, h: number, Y0: number, Y1: number): this {
    const gr = this.c.createLinearGradient(x, 0, x + w, 0)
    gr.addColorStop(0, grey(Y0)); gr.addColorStop(1, grey(Y1))
    this.both((k) => { k.beginPath(); k.rect(x, y, w, h) }, gr); return this
  }
  /** Radial light pool: a soft disc from Y0 (centre) to Y1 (edge). */
  pool(x: number, y: number, r: number, Y0: number, Y1: number, sy = 1): this {
    this.c.save(); this.c.translate(x, y); this.c.scale(1, sy)
    const gr = this.c.createRadialGradient(0, 0, 0, 0, 0, r)
    gr.addColorStop(0, grey(Y0)); gr.addColorStop(1, grey(Y1))
    this.c.fillStyle = gr; this.c.beginPath(); this.c.arc(0, 0, r, 0, Math.PI * 2); this.c.fill(); this.c.restore(); return this
  }
  text(s: string, x: number, y: number, px: number, Y: number, o: { italic?: boolean; bold?: boolean; align?: CanvasTextAlign; rot?: number; font?: string } = {}): this {
    for (const k of [this.c, this.g]) {
      k.save(); k.translate(x, y); if (o.rot) k.rotate(o.rot)
      k.font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${px}px ${o.font ?? 'Georgia, "Times New Roman", serif'}`
      k.textAlign = o.align ?? 'left'; k.textBaseline = 'alphabetic'
      if (k === this.g) { k.globalCompositeOperation = 'source-over'; k.fillStyle = '#000' } else k.fillStyle = grey(Y)
      k.fillText(s, 0, 0); k.restore()
    }
    this.g.globalCompositeOperation = 'lighter'
    return this
  }
  alpha(a: number): this { this.c.globalAlpha = a; return this }
  /** Speckle a region with seeded dots (granite, stone, foam). */
  speckle(x: number, y: number, w: number, h: number, n: number, r: number, Y: number, seed: number): this {
    const rnd = mulberry32(seed)
    this.fill(Y)
    for (let i = 0; i < n; i++) { const px = x + rnd() * w, py = y + rnd() * h, rr = r * (0.5 + rnd()); this.c.fillRect(px, py, rr, rr) }
    return this
  }
  // ---- emitters (additive, Y up to GLOW_MAX) ----
  glowDisc(x: number, y: number, r: number, Y: number, soft = true): this {
    const g = this.g
    if (soft) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, lin(Y)); gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr
    } else g.fillStyle = lin(Y)
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); return this
  }
  glowLine(pts: number[], w: number, Y: number): this {
    const g = this.g
    g.strokeStyle = lin(Y); g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
    g.stroke(); return this
  }
  glowPoly(pts: number[], Y: number): this {
    const g = this.g
    g.fillStyle = lin(Y); g.beginPath(); g.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
    g.closePath(); g.fill(); return this
  }
}

/** Gamma-encoded grey for the base canvas. */
export function grey(Y: number): string {
  const v = Math.round(255 * Math.pow(Math.min(1, Math.max(0, Y)), 1 / 2.2))
  return `rgb(${v},${v},${v})`
}
function lin(Y: number): string {
  const v = Math.round(255 * Math.min(1, Math.max(0, Y / GLOW_MAX)))
  return `rgb(${v},${v},${v})`
}
export const DECODE: Float32Array = (() => { const a = new Float32Array(256); for (let i = 0; i < 256; i++) a[i] = Math.pow(i / 255, 2.2); return a })()

// ---------------------------------------------------------------------------------------------
// Figures. Angles in degrees: 0 = straight down, +90 = screen right, 180 = up. Limb angles are
// absolute. "l*" limbs are the screen-left ones.
export interface Pose { trunk?: number; head?: number; lu?: number; ll?: number; ru?: number; rl?: number; lt?: number; ls?: number; rt?: number; rs?: number }
export const STAND: Required<Pose> = { trunk: 0, head: 0, lu: -8, ll: -4, ru: 8, rl: 4, lt: -3, ls: -2, rt: 3, rs: 2 }
export const SIT: Required<Pose> = { trunk: 0, head: 0, lu: -6, ll: 30, ru: 6, rl: -30, lt: -80, ls: -4, rt: 80, rs: 4 }

export function pose(p: Pose, base: Required<Pose> = STAND): Required<Pose> { return { ...base, ...p } }
export function lerpPose(a: Required<Pose>, b: Required<Pose>, t: number): Required<Pose> {
  const o = { ...a }
  for (const k of Object.keys(a) as (keyof Pose)[]) o[k] = a[k] + (b[k] - a[k]) * t
  return o
}

export type Hat = 'none' | 'cap' | 'capBand' | 'capBack' | 'bowler'
export interface Fig {
  x: number; y: number; z: number          // hip point (px, cyclopean) and depth (m)
  h: number                                 // standing height (m)
  build?: number
  pose: Required<Pose>
  light?: number                            // illumination multiplier
  coat: number; legs: number; skin: number
  hair?: number; hairLong?: boolean; bun?: boolean; plait?: boolean
  beard?: number; beardFull?: boolean; moustache?: number
  hat?: Hat; hatY?: number; bandY?: number
  skirt?: boolean; apron?: number; pinafore?: number
  scarf?: number; collar?: number
  buttons?: number; buttonRows?: 1 | 2
  long?: boolean                            // long coat
  eyes?: number                             // eye Y (default dark)
  eyeR?: number                             // override for the (figure's) right eye, e.g. milky
  profile?: -1 | 0 | 1                       // face turned to screen-left / front / right
  noHead?: boolean
}
export interface Joints { hip: [number, number]; neck: [number, number]; head: [number, number]; headR: number
  shL: [number, number]; shR: [number, number]; elL: [number, number]; elR: [number, number]; haL: [number, number]; haR: [number, number]
  knL: [number, number]; knR: [number, number]; ftL: [number, number]; ftR: [number, number]; H: number }

const d2r = Math.PI / 180
function dir(a: number, len: number): [number, number] { return [Math.sin(a * d2r) * len, Math.cos(a * d2r) * len] }
function add(p: [number, number], v: [number, number]): [number, number] { return [p[0] + v[0], p[1] + v[1]] }

export function figureJoints(P: Painter, f: Fig): Joints {
  const H = P.s(f.z) * f.h, b = f.build ?? 1, q = f.pose
  const hip: [number, number] = [f.x, f.y]
  const up = (a: number, len: number): [number, number] => [Math.sin(a * d2r) * len, -Math.cos(a * d2r) * len]
  const neck = add(hip, up(q.trunk, 0.30 * H))
  const headR = 0.062 * H
  const head = add(neck, up(q.trunk + q.head, 0.085 * H))
  const sw = 0.115 * H * b
  const shL: [number, number] = [neck[0] - sw, neck[1] + 0.02 * H]
  const shR: [number, number] = [neck[0] + sw, neck[1] + 0.02 * H]
  const elL = add(shL, dir(q.lu, 0.17 * H)), elR = add(shR, dir(q.ru, 0.17 * H))
  const haL = add(elL, dir(q.ll, 0.16 * H)), haR = add(elR, dir(q.rl, 0.16 * H))
  const hw = 0.06 * H * b
  const knL = add([hip[0] - hw, hip[1]], dir(q.lt, 0.24 * H)), knR = add([hip[0] + hw, hip[1]], dir(q.rt, 0.24 * H))
  const ftL = add(knL, dir(q.ls, 0.25 * H)), ftR = add(knR, dir(q.rs, 0.25 * H))
  return { hip, neck, head, headR, shL, shR, elL, elR, haL, haR, knL, knR, ftL, ftR, H }
}

/** Standing hip height above the ground line (px) for a figure of height h at depth z. */
export function hipAbove(P: Painter, h: number, z: number): number { return P.s(z) * h * 0.49 }

export function figure(P: Painter, f: Fig): Joints {
  P.at(f.z)
  const j = figureJoints(P, f), H = j.H, b = f.build ?? 1, L = f.light ?? 1
  const c = (Y: number) => Y * L
  const legW = 0.072 * H * b, armW = 0.052 * H * b
  // legs
  if (!f.skirt) {
    P.line([j.hip[0] - 0.06 * H * b, j.hip[1], j.knL[0], j.knL[1], j.ftL[0], j.ftL[1]], legW, c(f.legs))
    P.line([j.hip[0] + 0.06 * H * b, j.hip[1], j.knR[0], j.knR[1], j.ftR[0], j.ftR[1]], legW, c(f.legs))
    P.line([j.ftL[0], j.ftL[1], j.ftL[0] - 0.05 * H, j.ftL[1] + 0.005 * H], legW * 0.7, c(0.05))
    P.line([j.ftR[0], j.ftR[1], j.ftR[0] + 0.05 * H, j.ftR[1] + 0.005 * H], legW * 0.7, c(0.05))
  } else {
    // feet peeking, then the skirt cone from the waist to a hem near the lower feet
    const hemY = Math.max(j.ftL[1], j.ftR[1]) - 0.02 * H
    const hemW = 0.21 * H * b
    const sitting = Math.abs(f.pose.lt) > 45
    if (sitting) {
      const kx0 = Math.min(j.knL[0], j.knR[0]) - legW * 0.6, kx1 = Math.max(j.knL[0], j.knR[0]) + legW * 0.6
      P.poly([j.hip[0] - 0.1 * H, j.hip[1] - 0.04 * H, j.hip[0] + 0.1 * H, j.hip[1] - 0.04 * H, kx1, j.knR[1] - legW * 0.6, kx1, j.ftR[1], kx0, j.ftL[1], kx0, j.knL[1] - legW * 0.6], c(f.legs))
    } else {
      P.poly([j.hip[0] - 0.08 * H * b, j.hip[1] - 0.05 * H, j.hip[0] + 0.08 * H * b, j.hip[1] - 0.05 * H, j.hip[0] + hemW, hemY, j.hip[0] - hemW, hemY], c(f.legs))
      P.ellipse(j.ftL[0], j.ftL[1], 0.035 * H, 0.015 * H, c(0.05)); P.ellipse(j.ftR[0], j.ftR[1], 0.035 * H, 0.015 * H, c(0.05))
    }
    if (f.apron !== undefined && !sitting) P.poly([j.hip[0] - 0.07 * H, j.hip[1] - 0.06 * H, j.hip[0] + 0.07 * H, j.hip[1] - 0.06 * H, j.hip[0] + 0.12 * H, hemY - 0.05 * H, j.hip[0] - 0.12 * H, hemY - 0.05 * H], c(f.apron))
  }
  // torso
  const tw = 0.11 * H * b, hw = 0.085 * H * b
  const bottom = f.long ? 0.22 * H : 0.03 * H
  P.poly([j.shL[0] - 0.01 * H, j.shL[1] - 0.01 * H, j.shR[0] + 0.01 * H, j.shR[1] - 0.01 * H, j.hip[0] + hw + (f.long ? 0.04 * H : 0), j.hip[1] + bottom, j.hip[0] - hw - (f.long ? 0.04 * H : 0), j.hip[1] + bottom], c(f.coat))
  void tw
  if (f.pinafore !== undefined) P.poly([j.neck[0] - 0.06 * H, j.neck[1] + 0.05 * H, j.neck[0] + 0.06 * H, j.neck[1] + 0.05 * H, j.hip[0] + 0.07 * H, j.hip[1] + 0.12 * H, j.hip[0] - 0.07 * H, j.hip[1] + 0.12 * H], c(f.pinafore))
  if (f.apron !== undefined && f.skirt) P.poly([j.neck[0] - 0.05 * H, j.neck[1] + 0.09 * H, j.neck[0] + 0.05 * H, j.neck[1] + 0.09 * H, j.hip[0] + 0.07 * H, j.hip[1] - 0.04 * H, j.hip[0] - 0.07 * H, j.hip[1] - 0.04 * H], c(f.apron))
  if (f.buttons !== undefined) {
    const rows = f.buttonRows ?? 1, r = Math.max(0.6, 0.009 * H)
    for (let k = 0; k < 5; k++) {
      const yy = j.neck[1] + 0.07 * H + k * 0.045 * H
      const xx = j.neck[0] + (j.hip[0] - j.neck[0]) * ((yy - j.neck[1]) / Math.max(1, j.hip[1] - j.neck[1]))
      if (rows === 2) { P.circle(xx - 0.03 * H, yy, r, c(f.buttons)); P.circle(xx + 0.03 * H, yy, r, c(f.buttons)) } else P.circle(xx, yy, r, c(f.buttons))
    }
  }
  if (f.collar !== undefined) P.poly([j.neck[0] - 0.04 * H, j.neck[1] - 0.01 * H, j.neck[0] + 0.04 * H, j.neck[1] - 0.01 * H, j.neck[0] + 0.03 * H, j.neck[1] + 0.035 * H, j.neck[0] - 0.03 * H, j.neck[1] + 0.035 * H], c(f.collar))
  // arms (sleeves + hands)
  P.line([j.shL[0], j.shL[1], j.elL[0], j.elL[1], j.haL[0], j.haL[1]], armW, c(f.coat))
  P.line([j.shR[0], j.shR[1], j.elR[0], j.elR[1], j.haR[0], j.haR[1]], armW, c(f.coat))
  P.circle(j.haL[0], j.haL[1], 0.028 * H, c(f.skin)); P.circle(j.haR[0], j.haR[1], 0.028 * H, c(f.skin))
  // neck + scarf
  P.line([j.neck[0], j.neck[1] + 0.02 * H, j.head[0], j.head[1]], 0.05 * H, c(f.skin))
  if (f.scarf !== undefined) {
    P.ellipse(j.neck[0], j.neck[1] + 0.005 * H, 0.065 * H, 0.03 * H, c(f.scarf))
    P.line([j.neck[0] + 0.02 * H, j.neck[1], j.neck[0] + 0.035 * H, j.neck[1] + 0.12 * H], 0.03 * H, c(f.scarf))
  }
  if (!f.noHead) head(P, f, j, c)
  return j
}

function head(P: Painter, f: Fig, j: Joints, c: (Y: number) => number): void {
  const [hx, hy] = j.head, r = j.headR, H = j.H, prof = f.profile ?? 0
  if (f.hairLong || f.bun || f.plait) {
    P.ellipse(hx, hy - r * 0.1, r * 1.12, r * 1.15, c(f.hair ?? 0.15))
    if (f.bun) P.circle(hx - prof * r * 0.9, hy - r * 0.95, r * 0.42, c(f.hair ?? 0.15))
    if (f.plait) P.line([hx + r * 0.7, hy, hx + r * 0.9, hy + r * 2.6], r * 0.35, c(f.hair ?? 0.15))
  }
  P.ellipse(hx + prof * r * 0.12, hy, r * 0.88, r * 1.05, c(f.skin))
  if (f.hair !== undefined && !f.hairLong && !f.bun && !f.plait) P.ellipse(hx, hy - r * 0.62, r * 0.9, r * 0.5, c(f.hair))
  // eyes
  const ey = hy - r * 0.12, ex = r * 0.34, er = Math.max(0.5, r * 0.13)
  const eyeY = c(f.eyes ?? 0.05)
  if (prof <= 0) P.circle(hx - ex + prof * r * 0.3, ey, er, eyeY)
  if (prof >= 0) P.circle(hx + ex + prof * r * 0.3, ey, er, f.eyeR !== undefined ? c(f.eyeR) : eyeY)
  if (prof < 0 && f.eyeR !== undefined) P.circle(hx + ex * 0.2 + prof * r * 0.3, ey, er * 1.1, c(f.eyeR))
  if (f.beard !== undefined) {
    if (f.beardFull) P.ellipse(hx + prof * r * 0.15, hy + r * 0.55, r * 0.8, r * 0.7, c(f.beard))
    else P.ellipse(hx + prof * r * 0.15, hy + r * 0.85, r * 0.7, r * 0.35, c(f.beard))
  }
  if (f.moustache !== undefined) P.ellipse(hx + prof * r * 0.2, hy + r * 0.38, r * 0.45, r * 0.12, c(f.moustache))
  const hat = f.hat ?? 'none'
  if (hat === 'cap' || hat === 'capBand' || hat === 'capBack') {
    const back = hat === 'capBack' ? -0.25 : 0
    P.poly([hx - r * 0.98, hy - r * 0.45 + back * r, hx + r * 0.98, hy - r * 0.45 + back * r, hx + r * 0.9, hy - r * 1.25 + back * r, hx - r * 0.9, hy - r * 1.25 + back * r], c(f.hatY ?? 0.08))
    P.line([hx - r * 1.0 + prof * r * 0.5, hy - r * 0.45 + back * r, hx + r * 1.15 + prof * r * 0.5, hy - r * 0.38 + back * r], Math.max(1, r * 0.18), c(0.04))
    if (hat === 'capBand') P.rect(hx - r * 0.97, hy - r * 0.78, r * 1.94, Math.max(1.6, r * 0.26), c(f.bandY ?? 0.85))
  } else if (hat === 'bowler') {
    P.ellipse(hx, hy - r * 0.85, r * 0.92, r * 0.7, c(f.hatY ?? 0.05))
    P.ellipse(hx, hy - r * 0.55, r * 1.35, r * 0.2, c(f.hatY ?? 0.05))
  }
  void H
}

// ---------------------------------------------------------------------------------------------
// Wick, the cat (black, white bib and white tail-tip).
export function cat(P: Painter, x: number, y: number, z: number, kind: 'sit' | 'curl' | 'walk' | 'eyes', light = 1, tailTip = true): void {
  P.at(z)
  const s = P.s(z) * 0.3, body = 0.05 * light, white = 0.9 * light
  if (kind === 'eyes') { P.circle(x - s * 0.08, y, Math.max(0.7, s * 0.03), 0.9 * light); P.circle(x + s * 0.08, y, Math.max(0.7, s * 0.03), 0.9 * light); return }
  if (kind === 'curl') {
    P.ellipse(x, y, s * 0.55, s * 0.28, body)
    P.circle(x + s * 0.38, y - s * 0.08, s * 0.17, body)
    P.ellipse(x + s * 0.3, y + s * 0.05, s * 0.1, s * 0.07, white)
    if (tailTip) P.circle(x - s * 0.5, y + s * 0.12, s * 0.08, white)
    return
  }
  if (kind === 'sit') {
    P.ellipse(x, y - s * 0.32, s * 0.26, s * 0.36, body)
    P.circle(x, y - s * 0.78, s * 0.17, body)
    P.poly([x - s * 0.15, y - s * 0.86, x - s * 0.11, y - s * 1.02, x - s * 0.03, y - s * 0.9], body)
    P.poly([x + s * 0.15, y - s * 0.86, x + s * 0.11, y - s * 1.02, x + s * 0.03, y - s * 0.9], body)
    P.ellipse(x, y - s * 0.5, s * 0.1, s * 0.14, white)
    P.line([x + s * 0.2, y - s * 0.05, x + s * 0.45, y - s * 0.02, x + s * 0.55, y - s * 0.2], s * 0.07, body)
    if (tailTip) P.circle(x + s * 0.56, y - s * 0.24, s * 0.06, white)
    return
  }
  // walk
  P.ellipse(x, y - s * 0.3, s * 0.45, s * 0.16, body)
  P.circle(x + s * 0.48, y - s * 0.4, s * 0.15, body)
  P.line([x - s * 0.3, y - s * 0.2, x - s * 0.35, y], s * 0.06, body); P.line([x + s * 0.3, y - s * 0.2, x + s * 0.35, y], s * 0.06, body)
  P.line([x - s * 0.42, y - s * 0.35, x - s * 0.6, y - s * 0.7], s * 0.07, body)
  if (tailTip) P.circle(x - s * 0.62, y - s * 0.74, s * 0.06, white)
}

/** A storm lantern / hand-lamp held at (x, y): tin body + flame emitter. */
export function lantern(P: Painter, x: number, y: number, z: number, flameY: number, light = 1): void {
  P.at(z)
  const s = P.s(z)
  P.rect(x - s * 0.06, y - s * 0.12, s * 0.12, s * 0.2, 0.12 * light)
  P.rect(x - s * 0.05, y - s * 0.1, s * 0.1, s * 0.13, 0.35 * light)
  P.line([x - s * 0.05, y - s * 0.14, x, y - s * 0.22, x + s * 0.05, y - s * 0.14], Math.max(1, s * 0.01), 0.2 * light)
  P.glowDisc(x, y - s * 0.04, s * 0.05, flameY)
}
