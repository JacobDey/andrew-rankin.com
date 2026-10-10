// games/plates/content/scenes1.ts — TRIAL and plates 1–6, staged per plates-story.md §6.
// Values are linear actinic radiance (1 ≈ the subject's diffuse white → L ≈ 0 on the plate).
import { Painter, figure, pose, lerpPose, STAND, SIT, cat, hipAbove } from './paint'

const hold = (t: number, a = 0.42, b = 0.58) => (t < a ? 0 : t > b ? 1 : (t - a) / (b - a))

// ---- shared bits of the 1887 store-room (the player's own room) ----
function storeWall(P: Painter, light: number, doorSide: 'right' | 'left' = 'right'): void {
  P.at(2.6)
  if (doorSide === 'right') P.hgrad(-40, 0, 560, 300, 0.12 * light, 0.62 * light)
  else P.hgrad(-40, 0, 560, 300, 0.62 * light, 0.12 * light)
  // vault
  P.c.save(); P.c.beginPath(); P.c.moveTo(-40, 0); P.c.lineTo(520, 0); P.c.lineTo(520, 40); P.c.quadraticCurveTo(240, -10, -40, 50); P.c.closePath()
  P.c.fillStyle = 'rgb(20,20,20)'; P.c.fill(); P.c.restore()
}
function testCard(P: Painter, x: number, y: number, w: number, L: number): void {
  const h = w * 0.75
  P.rect(x, y, w, h, 0.95 * L)
  // six-step grey scale along the bottom
  const steps = [0.95, 0.66, 0.44, 0.27, 0.13, 0.05]
  for (let i = 0; i < 6; i++) P.rect(x + w * 0.06 + i * w * 0.148, y + h * 0.78, w * 0.148, h * 0.14, steps[i] * L)
  // 24-spoke star (left)
  const sx = x + w * 0.25, sy = y + h * 0.42, sr = h * 0.28
  for (let k = 0; k < 24; k += 2) {
    const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2
    P.poly([sx, sy, sx + Math.cos(a0) * sr, sy + Math.sin(a0) * sr, sx + Math.cos(a1) * sr, sy + Math.sin(a1) * sr], 0.04 * L)
  }
  // concentric rings (right)
  const rx = x + w * 0.73, ry = y + h * 0.36
  for (let k = 5; k >= 1; k--) P.circle(rx, ry, k * h * 0.045, (k % 2 ? 0.04 : 0.95) * L)
  P.text('GAUNT ROCK', x + w * 0.5, y + h * 0.13, Math.max(8, w * 0.085), 0.04 * L, { align: 'center', bold: true })
  P.text('trial of the batch', x + w * 0.73, y + h * 0.62, Math.max(6, w * 0.05), 0.04 * L, { align: 'center', italic: true })
  P.text('Novr. 4th 1887', x + w * 0.73, y + h * 0.71, Math.max(5, w * 0.038), 0.04 * L, { align: 'center', italic: true })
  P.text('O. F.', x + w * 0.9, y + h * 0.97, 6, 0.04 * L, { align: 'center', italic: true })
}
function bottles(P: Painter, x: number, y: number, n: number, L: number, labels = false): void {
  for (let i = 0; i < n; i++) {
    const bx = x + i * 22, tall = 34 + ((i * 7) % 3) * 6
    P.rect(bx, y - tall, 16, tall, 0.06 * L)
    P.rect(bx + 5, y - tall - 8, 6, 9, 0.06 * L)
    if (labels) P.rect(bx + 2, y - tall * 0.6, 12, 9, 0.5 * L)
  }
}
function darkroomLamp(P: Painter, x: number, y: number, z: number, L: number, crack: boolean, etch: number): void {
  P.at(z)
  const s = P.s(z), w = 0.30 * s, h = 0.36 * s
  P.rect(x - w / 2, y - h / 2, w, h, 0.06 * L)
  P.rect(x - w / 2 + 2, y - h / 2 - 0.03 * s, w - 4, 0.03 * s, 0.05 * L)
  P.line([x - w * 0.3, y - h / 2 - 0.03 * s, x, y - h / 2 - 0.09 * s, x + w * 0.3, y - h / 2 - 0.03 * s], Math.max(1, s * 0.008), 0.08 * L)
  const ww = 0.254 * s * 0.92, wh = 0.305 * s * 0.88
  P.rect(x - ww / 2, y - wh / 2 + h * 0.04, ww, wh, 0.004)
  if (crack) {
    const x0 = x - ww / 2, y0 = y - wh / 2 + h * 0.04
    const lw = Math.max(1.4, s * 0.005)
    P.line([x0 + ww * 0.08, y0 + wh * 0.1, x0 + ww * 0.5, y0 + wh * 0.5, x0 + ww * 0.92, y0 + wh * 0.93], lw, 0.9 * L)
    P.line([x0 + ww * 0.5, y0 + wh * 0.5, x0 + ww * 0.88, y0 + wh * 0.3], lw, 0.9 * L)
    P.line([x0 + ww * 0.5, y0 + wh * 0.5, x0 + ww * 0.2, y0 + wh * 0.72], lw, 0.9 * L)
    P.line([x0 + ww * 0.5, y0 + wh * 0.5, x0 + ww * 0.42, y0 + wh * 0.06], lw, 0.9 * L)
  }
  if (etch > 0) {
    const ey = y - wh / 2 + h * 0.04 + wh - 4
    P.text('B.S.L. · GAUNT ROCK · SECTOR', x - ww / 2 + 3, ey, Math.max(4, s * 0.012), 0.012, {})
    const sx = x + ww / 2 - 14
    for (let k = 0; k < 3; k++) P.rect(sx + k * 4, ey - 12, 2, 12, etch)
  }
  // brass maker plate
  P.rect(x + w / 2 - 2, y - h * 0.1, 3, h * 0.12, 0.3 * L)
}
function plateBox(P: Painter, x: number, y: number, z: number, L: number): { left: number; top: number } {
  P.at(z)
  const s = P.s(z), w = 0.45 * s, h = 0.12 * s
  P.rect(x - w / 2, y - h, w, h, 0.45 * L)
  P.rect(x - w / 2 + 4, y - h - 0.04 * s, w - 8, 0.05 * s, 0.14 * L)
  P.rect(x - w / 2, y - h, 5, h, 0.32 * L)
  return { left: x - w / 2, top: y - h }
}

// =============================================================================================
export function p00(P: Painter): void {
  const t = P.t
  storeWall(P, 1.0)
  // shelf + bottles (upper left)
  P.at(2.4); P.rect(-30, 120, 170, 8, 0.25); bottles(P, -20, 120, 6, 0.6, true)
  // hanging lamp (arrival: intact original glass) upper right
  P.at(2.3); P.line([392, 0, 392, 42], 2, 0.1)
  darkroomLamp(P, 392, 92, 2.3, 0.9, false, 0)
  // the test card on the whitewash above the trays
  P.at(2.2); testCard(P, 140, 60, 196, 1.05)
  // bench
  P.at(1.9); P.rect(-40, 292, 560, 16, 0.34); P.vgrad(-40, 308, 560, 120, 0.1, 0.04)
  // trays on the bench (edges)
  P.at(1.85); for (let k = 0; k < 3; k++) { P.rect(150 + k * 92, 278, 82, 14, 0.75); P.rect(152 + k * 92, 280, 78, 6, 0.55) }
  // Wick's tail-tip, BEHIND the plate box's left end — only the left eye sees round the box.
  P.at(3.1)
  const sway = Math.sin(t * Math.PI) * 2.5
  P.line([128, 258, 120 + sway, 252], 4, 0.05)
  P.circle(118 + sway, 251, 4.2, 0.95)
  // the open plate box with Wick curled asleep in it
  const box = plateBox(P, 210, 300, 1.12, 1.0)
  P.at(1.12); P.rect(box.left + 6, box.top - 2, 0.45 * P.s(1.12) - 12, 10, 0.18)
  cat(P, 214, box.top - 6, 1.12, 'curl', 1.0, false)
}

// =============================================================================================
function granite(P: Painter, x: number, y: number, w: number, h: number, Y: number, course: number, seed: number): void {
  P.rect(x, y, w, h, Y)
  P.speckle(x, y, w, h, Math.floor((w * h) / 90), 2, Y * 0.55, seed)
  P.speckle(x, y, w, h, Math.floor((w * h) / 160), 1.5, Y * 1.5, seed + 1)
  for (let yy = y + course; yy < y + h; yy += course) P.rect(x, yy, w, 1.5, Y * 0.45)
}
function shawl(P: Painter, j: { neck: [number, number]; H: number }, L: number): void {
  const [nx, ny] = j.neck, H = j.H
  P.poly([nx - 0.13 * H, ny + 0.01 * H, nx + 0.13 * H, ny + 0.01 * H, nx, ny + 0.2 * H], 0.45 * L)
  for (let k = -3; k <= 3; k++) P.line([nx + k * 0.03 * H, ny + 0.015 * H, nx + k * 0.012 * H, ny + 0.17 * H], Math.max(1, H * 0.006), 0.28 * L)
}
function concertina(P: Painter, x: number, y: number, s: number, L: number): void {
  const w = 0.32 * s, h = 0.16 * s
  P.rect(x - w / 2, y - h / 2, w * 0.18, h, 0.2 * L); P.rect(x + w / 2 - w * 0.18, y - h / 2, w * 0.18, h, 0.2 * L)
  for (let k = 0; k < 6; k++) P.rect(x - w / 2 + w * 0.18 + k * w * 0.107, y - h / 2 + 1, w * 0.107, h - 2, (k % 2 ? 0.1 : 0.8) * L)
}

export function p01(P: Painter): void {
  const t = P.t, zT = 5.5, sT = P.s(zT)
  // tower granite fills the frame
  P.at(zT + 0.4); granite(P, -40, 0, 560, 424, 0.3, 0.45 * sT, 11)
  // door (centred), recess
  P.at(zT); P.rect(240 - 0.55 * sT, 300 - 2.1 * sT, 1.1 * sT, 2.1 * sT, 0.18); P.rect(240 - 0.5 * sT, 300 - 2.0 * sT, 1.0 * sT, 2.0 * sT, 0.025)
  // three steps
  const steps: [number, number][] = [[300, 5.5], [324, 5.25], [348, 5.0]]
  for (const [yy, z] of steps) { P.at(z); P.rect(-40, yy, 560, 24, 0.42); P.rect(-40, yy, 560, 3, 0.62) }
  P.at(4.8); P.rect(-40, 372, 560, 60, 0.25); P.speckle(-40, 372, 560, 60, 260, 2, 0.12, 5)
  // 1. Penwarden — top step, left of the door, arms folded RIGHT hand on top (tattoo to lens), pipe
  const pz = 5.5, ph = 1.82
  const pj = figure(P, { x: 150, y: 300 - hipAbove(P, ph, pz), z: pz, h: ph, build: 1.25, pose: pose({ lu: 30, ll: 95, ru: -30, rl: -95 }), coat: 0.07, legs: 0.07, skin: 0.3, beard: 0.06, beardFull: true, hat: 'cap', hatY: 0.08 })
  // folded forearms across the chest, his right hand (screen-left arm) on top: back of hand + anchor
  const cy = pj.neck[1] + 0.14 * pj.H, cx = pj.neck[0]
  P.line([cx - 0.12 * pj.H, cy + 2, cx + 0.12 * pj.H, cy + 2], 0.06 * pj.H, 0.06)
  const hx = cx + 0.07 * pj.H, hy = cy - 1
  P.ellipse(hx, hy, 9, 6.5, 0.2)
  // anchor tattoo (dark) on the back of the hand
  P.line([hx, hy - 4, hx, hy + 3.5], 1.6, 0.012); P.line([hx - 3, hy - 2, hx + 3, hy - 2], 1.4, 0.012)
  P.line([hx - 4, hy + 1.5, hx - 2, hy + 3.8, hx, hy + 3.8, hx + 2, hy + 3.8, hx + 4, hy + 1.5], 1.4, 0.012)
  P.line([pj.head[0] + 3, pj.head[1] + 9, pj.head[0] + 16, pj.head[1] + 12], 2, 0.55)   // clay pipe
  // 2. Amos — in the doorway, right hand on Nell's shoulder; white braid band
  const az = 5.55, ah = 1.75
  figure(P, { x: 236, y: 300 - hipAbove(P, ah, az), z: az, h: ah, build: 1.1, pose: pose({ lu: 22, ll: 12 }), coat: 0.08, legs: 0.07, skin: 0.32, beard: 0.7, beardFull: true, hat: 'capBand', hatY: 0.08, bandY: 0.9, buttons: 0.6, buttonRows: 2 })
  // 4. Keturah — right of the door, hands folded on apron, keys
  const kz = 5.5, kh = 1.62
  const kj = figure(P, { x: 334, y: 300 - hipAbove(P, kh, kz), z: kz, h: kh, pose: pose({ lu: 22, ll: 60, ru: -22, rl: -60 }), coat: 0.1, legs: 0.1, skin: 0.32, skirt: true, apron: 0.85, hair: 0.12, bun: true })
  shawl(P, kj, 1); P.circle(kj.hip[0] + 0.07 * kj.H, kj.hip[1] - 0.02 * kj.H, 3, 0.5); P.circle(kj.hip[0] + 0.08 * kj.H, kj.hip[1] - 0.005 * kj.H, 2, 0.5)
  // 3. Nell — second step, in front of her father; Wick in her LEFT arm, slate pencil in LEFT hand; scarf
  const nz = 5.25, nh = 1.4
  const nj = figure(P, { x: 246, y: 324 - hipAbove(P, nh, nz), z: nz, h: nh, build: 0.8, pose: pose({ lu: 6, ll: 4, ru: -40, rl: -110 }), coat: 0.15, legs: 0.15, skin: 0.33, skirt: true, pinafore: 0.8, hair: 0.2, plait: true, scarf: 0.035 })
  cat(P, nj.neck[0] + 0.07 * nj.H, nj.neck[1] + 0.2 * nj.H, nz - 0.1, 'sit', 1.0, true)
  P.line([nj.haR[0] - 2, nj.haR[1], nj.haR[0] + 3, nj.haR[1] - 11], 2.2, 0.75)          // slate pencil
  // Amos's right hand rests on Nell's shoulder (drawn over her)
  P.at(5.4); P.ellipse(nj.shL[0] + 2, nj.shL[1] - 2, 7, 5, 0.3); P.line([nj.shL[0] - 2, nj.shL[1] - 16, nj.shL[0] + 2, nj.shL[1] - 4], 9, 0.08)
  // 5. Davy — on the bottom step at right, concertina on his knee; laughs (head turns & tips: double ghost)
  const dz = 5.0, dh = 1.7
  const k = hold(t)
  const dPose = lerpPose(pose({ head: -6, lu: 20, ll: 70, ru: -20, rl: -75 }, SIT), pose({ head: 28, trunk: -8, lu: 20, ll: 70, ru: -20, rl: -75 }, SIT), k)
  const dj = figure(P, { x: 398, y: 352, z: dz, h: dh, build: 0.85, pose: dPose, coat: 0.6, legs: 0.12, skin: 0.33, hair: 0.15, hat: 'capBack', hatY: 0.08 })
  concertina(P, dj.hip[0] + 4, dj.hip[1] - 0.06 * dj.H, P.s(dz), 1)
  void STAND
}

// =============================================================================================
function lanternGlazing(P: Painter, sky: number, z: number, top: number, bottom: number): void {
  P.at(z)
  // sky through the glazing (emissive), astragals (diagonal frames)
  P.glowPoly([-40, top, 520, top, 520, bottom, -40, bottom], sky)
  P.rect(-40, top - 4, 560, 6, 0.08); P.rect(-40, bottom - 2, 560, 8, 0.08)
  for (let x = -60; x < 560; x += 70) { P.line([x, top, x + 50, bottom], 3, 0.06); P.line([x + 50, top, x, bottom], 3, 0.06) }
}
function lensDrum(P: Painter, x: number, y0: number, y1: number, w: number, L: number): void {
  P.rect(x - w / 2, y0, w, y1 - y0, 0.35 * L)
  const n = 14
  for (let k = 0; k < n; k++) {
    const yy = y0 + ((y1 - y0) * k) / n
    P.rect(x - w / 2, yy, w, 2, 0.08 * L)
    P.hgrad(x - w / 2, yy + 3, w, (y1 - y0) / n - 4, 0.25 * L, 0.7 * L)
  }
  P.rect(x - w * 0.04, y0, w * 0.08, y1 - y0, 0.1 * L)
}
function sectorFrame(P: Painter, x: number, y: number, pw: number, ph: number, gap: number, panes: [boolean, boolean, boolean], open: number, L: number, numerals: boolean, tuft: boolean): number[] {
  const xs: number[] = []
  P.rect(x - 4, y - 4, 3 * pw + 2 * gap + 8, ph + 8, 0.25 * L)
  for (let i = 0; i < 3; i++) {
    const px = x + i * (pw + gap)
    xs.push(px)
    if (panes[i]) P.rect(px, y, pw, ph, 0.004)
    else P.glowPoly([px, y, px + pw, y, px + pw, y + ph, px, y + ph], open)
    if (numerals) {
      P.rect(px + pw * 0.2, y + ph + 6, pw * 0.6, Math.max(6, ph * 0.22), 0.5 * L)
      P.text(['I', 'II', 'III'][i], px + pw / 2, y + ph + 6 + Math.max(6, ph * 0.22) * 0.85, Math.max(6, ph * 0.2), 0.06 * L, { align: 'center', bold: true })
    }
  }
  if (tuft) {
    const tx = xs[2] + 1, ty = y + ph - 3
    P.circle(tx + 1, ty, 1.6, 0.25 * L)           // screw head
    P.poly([tx - 1, ty - 1, tx + 4, ty - 4, tx + 5, ty + 2, tx + 2, ty + 5, tx - 2, ty + 3], 0.003)
  }
  return xs
}

export function p02(P: Painter): void {
  // lantern interior, bright overcast sky through all the glazing
  P.at(4.0); P.rect(-40, 0, 560, 424, 0.04)
  lanternGlazing(P, 1.35, 4.2, 40, 290)
  // Wick outside on the gallery rail, silhouetted, upper left
  P.at(4.6); P.rect(-40, 268, 560, 5, 0.03)
  cat(P, 62, 268, 4.6, 'sit', 0.25, false)
  // sector frame: right third; panes I, II, III solid black; brass numerals
  P.at(3.6); sectorFrame(P, 300, 150, 44, 54, 9, [true, true, true], 1.3, 1.0, true, false)
  // lens drum (centre)
  P.at(2.9); lensDrum(P, 228, 70, 330, 150, 1.0)
  P.at(2.9); P.rect(150, 330, 156, 120, 0.06)
  // Nell at the east glazing, profile to screen-left, LEFT hand flat on Sector III; scarf (black)
  const nz = 3.55, nh = 1.4
  const nj = figure(P, { x: 452, y: 150 + 54 + 150, z: nz, h: nh, build: 0.8, pose: pose({ lu: 170, ll: -168, ru: 10, rl: 6 }), coat: 0.15, legs: 0.15, skin: 0.3, skirt: true, pinafore: 0.75, hair: 0.2, plait: true, scarf: 0.03, profile: -1 })
  void nj
  P.at(3.6); P.ellipse(300 + 2 * 53 + 22, 150 + 30, 6.5, 8, 0.28)        // her left hand, flat on III
  // Amos — left of centre, linen apron, 3/4 profile to screen-right, magnifier 3 cm from his left eye
  const az = 2.25, ah = 1.75
  const aj = figure(P, { x: 128, y: 345, z: az, h: ah, build: 1.1, pose: pose({ trunk: 10, head: 8, lu: -4, ll: 6, ru: 150, rl: -150 }), coat: 0.08, legs: 0.07, skin: 0.3, apron: 0.85, skirt: false, beard: 0.7, beardFull: true, hat: 'capBand', bandY: 0.88, profile: 1, eyeR: 0.95, eyes: 0.05 })
  P.at(az)
  // linen apron over the jacket
  P.poly([aj.neck[0] - 0.05 * aj.H, aj.neck[1] + 0.06 * aj.H, aj.neck[0] + 0.07 * aj.H, aj.neck[1] + 0.06 * aj.H, aj.hip[0] + 0.1 * aj.H, aj.hip[1] + 0.2 * aj.H, aj.hip[0] - 0.08 * aj.H, aj.hip[1] + 0.2 * aj.H], 0.82)
  // spectacles + magnifier ring at the far eye
  const r = aj.headR
  P.c.save(); P.c.strokeStyle = 'rgb(140,140,140)'; P.c.lineWidth = 2.5
  P.c.beginPath(); P.c.arc(aj.head[0] + r * 1.15, aj.head[1] - r * 0.12, r * 0.42, 0, Math.PI * 2); P.c.stroke(); P.c.restore()
  P.line([aj.head[0] + r * 1.2, aj.head[1] + r * 0.3, aj.haR[0], aj.haR[1]], 3, 0.3)
}

// =============================================================================================
export function p03(P: Painter): void {
  // the store-room by day, from the open door, looking along the bench to its left end
  storeWall(P, 0.9, 'left')
  // shelf, bottles; Wick between two brown bottles (shadow)
  P.at(2.9); P.rect(10, 128, 150, 7, 0.12); bottles(P, 14, 128, 2, 0.35); bottles(P, 98, 128, 2, 0.35)
  cat(P, 78, 128, 2.9, 'sit', 0.35, true)
  // TRIAL card still pinned above the trays; empty iron hook
  P.at(2.7); testCard(P, 200, 70, 120, 0.7)
  P.at(1.7); P.line([300, 0, 300, 40, 312, 52, 322, 44], 3, 0.06)
  // bench along the room, receding to the left
  P.at(1.6); P.poly([-40, 250, 520, 300, 520, 330, -40, 262], 0.4); P.poly([-40, 262, 520, 330, 520, 424, -40, 424], 0.07)
  // Nell on the upturned coal bin at left, chin in both hands, staring at the lamp
  P.at(2.4); P.rect(30, 268, 70, 60, 0.08); P.rect(26, 262, 78, 8, 0.12)
  const nz = 2.4
  figure(P, { x: 66, y: 262, z: nz, h: 1.4, build: 0.8, pose: pose({ trunk: 18, head: 6, lu: 150, ll: -160, ru: 160, rl: -170 }, SIT), coat: 0.15, legs: 0.15, skin: 0.33, skirt: true, pinafore: 0.75, hair: 0.2, plait: true, scarf: 0.03, profile: 1 })
  // the darkroom lamp ON THE BENCH, near middle ground, its window star-cracked
  darkroomLamp(P, 300, 214, 1.42, 1.0, true, 0)
  // dustpan with three slivers
  P.at(1.25); P.poly([250, 318, 340, 318, 352, 338, 238, 338], 0.15); P.rect(338, 322, 40, 5, 0.15)
  P.line([270, 326, 280, 323], 2, 0.95); P.line([294, 329, 300, 325], 2, 0.95); P.line([312, 327, 320, 330], 2, 0.95)
}

// =============================================================================================
function clock(P: Painter, x: number, y: number, r: number, hh: number, mm: number, L: number, handY: number): void {
  P.circle(x, y, r + 2, 0.2 * L); P.circle(x, y, r, 0.92 * L)
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; P.circle(x + Math.sin(a) * r * 0.82, y - Math.cos(a) * r * 0.82, Math.max(0.6, r * 0.06), 0.1 * L) }
  const am = (mm / 60) * Math.PI * 2, ah = ((hh % 12) / 12 + mm / 720) * Math.PI * 2
  P.line([x, y, x + Math.sin(ah) * r * 0.5, y - Math.cos(ah) * r * 0.5], Math.max(1.2, r * 0.12), handY * L)
  P.line([x, y, x + Math.sin(am) * r * 0.78, y - Math.cos(am) * r * 0.78], Math.max(1, r * 0.08), handY * L)
}
function chair(P: Painter, x: number, y: number, s: number, L: number): void {
  P.rect(x - 0.22 * s, y - 0.45 * s, 0.44 * s, 0.05 * s, 0.38 * L)
  P.rect(x - 0.2 * s, y - 0.45 * s, 0.04 * s, 0.45 * s, 0.3 * L); P.rect(x + 0.16 * s, y - 0.45 * s, 0.04 * s, 0.45 * s, 0.3 * L)
  P.rect(x + 0.16 * s, y - 0.95 * s, 0.04 * s, 0.5 * s, 0.3 * L); P.rect(x + 0.0 * s, y - 0.9 * s, 0.2 * s, 0.05 * s, 0.3 * L)
}

export function p04(P: Painter): void {
  const t = P.t
  // kitchen, window light from the left
  P.at(4.4); P.hgrad(-40, 0, 560, 300, 0.75, 0.32)
  P.at(4.4); P.rect(-40, 300, 560, 124, 0.18); P.speckle(-40, 300, 560, 124, 300, 2, 0.1, 9)
  // range on the back wall + kettle
  P.at(4.3); P.rect(180, 170, 130, 130, 0.05); P.rect(170, 160, 150, 12, 0.1); P.ellipse(230, 152, 16, 12, 0.12)
  // clock reading 12.45 (white face, mid-grey hands)
  P.at(4.3); clock(P, 126, 96, 20, 12, 45, 1.0, 0.42)
  // duty slate, chalk text
  P.at(4.3); P.rect(338, 70, 96, 78, 0.08); P.rect(334, 66, 104, 4, 0.3)
  const chalk = ['WATCHES FRI 11', '4.30 – 8  A.K.', '8 – 12  S.P.', '12 – 4  D.L.', '4 – 8  A.K.']
  chalk.forEach((s, i) => P.text(s, 343, 85 + i * 14, i === 0 ? 9 : 10, 0.9, { bold: true, font: 'Arial, Helvetica, sans-serif' }))
  // Keturah carrying a pot from the range to the table: two translucent positions
  const k = hold(t, 0.4, 0.6)
  const kz = 3.9, kx = 230 + (300 - 230) * k
  const kj = figure(P, { x: kx, y: 300 - hipAbove(P, 1.62, kz), z: kz, h: 1.62, pose: pose({ lu: 40, ll: 80, ru: -40, rl: -80 }), coat: 0.1, legs: 0.1, skin: 0.32, skirt: true, apron: 0.85, hair: 0.12, bun: true, light: 0.95 })
  P.ellipse(kj.neck[0], kj.neck[1] + 0.2 * kj.H, 16, 10, 0.06)
  // Amos at the head of the table, hands clasped for grace
  const az = 3.6
  const aj = figure(P, { x: 240, y: 268, z: az, h: 1.75, build: 1.1, pose: pose({ head: 10, lu: 30, ll: 120, ru: -30, rl: -120 }, SIT), coat: 0.08, legs: 0.07, skin: 0.33, beard: 0.7, beardFull: true, hat: 'none', hair: 0.75, buttons: 0.6, buttonRows: 2 })
  void aj
  // the table, down the middle of the frame
  P.at(2.6); P.poly([160, 280, 320, 280, 420, 424, 60, 424], 0.42); P.poly([160, 280, 320, 280, 322, 286, 158, 286], 0.55)
  for (let i = 0; i < 4; i++) { P.ellipse(200 + i * 8, 300 + i * 30, 12 + i * 3, 5 + i, 0.8); P.ellipse(282 - i * 8, 300 + i * 30, 12 + i * 3, 5 + i, 0.8) }
  // Penwarden, left side, fork in his right hand (small ghost)
  const pz = 2.9
  const fork = 70 + 25 * Math.sin(t * Math.PI * 2)
  const pj = figure(P, { x: 120, y: 300, z: pz, h: 1.82, build: 1.25, pose: pose({ trunk: 8, ru: fork, rl: 120, lu: 10, ll: 40 }, SIT), coat: 0.07, legs: 0.07, skin: 0.3, beard: 0.06, beardFull: true, profile: 1, hair: 0.06 })
  P.line([pj.haR[0], pj.haR[1], pj.haR[0] + 10, pj.haR[1] - 4], 1.5, 0.6)
  // Davy, right side, turned toward the empty place (slight ghost); concertina on the floor
  const dz = 2.8, dk = 0.5 + 0.5 * Math.sin(t * Math.PI)
  figure(P, { x: 372 + dk * 4, y: 300, z: dz, h: 1.7, build: 0.85, pose: pose({ trunk: -6, head: 12 * dk, lu: 20, ll: 60, ru: -10, rl: -40 }, SIT), coat: 0.6, legs: 0.12, skin: 0.33, hair: 0.15, profile: 1 })
  P.at(2.6); concertina(P, 440, 392, P.s(2.6), 0.9)
  // Nell's place, right foreground: the empty chair; plate, spoon, tin cup with N; Wick on the chair
  P.at(1.9); chair(P, 330, 424, P.s(1.9), 1.0)
  P.at(1.9); P.ellipse(300, 360, 34, 10, 0.85); P.line([340, 362, 356, 358], 3, 0.6)
  P.rect(262, 334, 26, 28, 0.55); P.text('N', 275, 356, 18, 0.05, { align: 'center', bold: true })
  cat(P, 338, 380, 1.9, 'sit', 1.0, true)
}

// =============================================================================================
export function p05(P: Painter): void {
  const t = P.t
  // bright sky; the tower rising from lower left; lantern upper right; sea + the Teeth at right
  P.at(60); P.glowPoly([-40, 0, 520, 0, 520, 300, -40, 300], 1.3)
  P.at(60); P.rect(-40, 268, 560, 160, 0.16); P.speckle(-40, 268, 560, 70, 380, 2, 0.6, 21)
  // the Teeth: a dark broken line with a white slick of surf
  P.at(55); for (let i = 0; i < 9; i++) P.poly([380 + i * 11, 272, 385 + i * 11, 262 - (i % 3) * 3, 392 + i * 11, 272], 0.02)
  P.rect(372, 272, 110, 4, 0.95)
  // cottages at left
  P.at(30); P.poly([-40, 268, 20, 268, 20, 232, 0, 218, -20, 232, -40, 232], 0.5); P.poly([20, 268, 70, 268, 70, 236, 45, 222, 20, 236], 0.55)
  // the tower (granite), tapered, with gallery and lantern upper right
  P.at(22)
  P.poly([60, 424, 300, 424, 356, 92, 268, 92], 0.32)
  P.speckle(150, 120, 170, 300, 900, 2, 0.18, 33)
  P.rect(250, 82, 124, 10, 0.12); P.line([248, 66, 378, 66], 2, 0.1); for (let x = 252; x < 378; x += 9) P.rect(x, 66, 1.5, 16, 0.1)
  // lantern: glazing + the sector frame facing the camera; opening III shows sky
  P.rect(272, 20, 92, 62, 0.15)
  P.at(22); for (let x = 276; x < 362; x += 22) P.rect(x, 22, 2, 58, 0.06)
  sectorFrame(P, 286, 36, 11, 13, 4, [true, true, false], 1.3, 1.0, false, false)
  P.poly([262, 20, 374, 20, 318, -10], 0.08); P.circle(318, -6, 4, 0.1)
  // Penwarden, small, on the gallery wiping the storm panes (beard, size)
  figure(P, { x: 344, y: 60, z: 22, h: 1.82, build: 1.25, pose: pose({ ru: 150 + 20 * Math.sin(t * 6.28), rl: 170 }), coat: 0.07, legs: 0.07, skin: 0.3, beard: 0.06, beardFull: true, hat: 'cap' })
  // the landing steps (dark granite) with Wick's white tail-tip
  P.at(9); P.poly([20, 424, 160, 424, 140, 330, 60, 330], 0.06)
  for (let y = 340; y < 424; y += 14) P.rect(40, y, 120, 2, 0.12)
  P.at(9); P.circle(102, 372, 2.2, 0.9); P.line([96, 378, 101, 373], 1.5, 0.03)
  // the iron stage + derrick (foreground right) and Davy coiling a rope (arms ghosted)
  P.at(4.2); P.rect(220, 352, 300, 14, 0.12); P.rect(220, 366, 300, 70, 0.06)
  P.line([480, 352, 470, 150, 420, 160], 5, 0.1)
  const a = 60 + 70 * Math.sin(t * Math.PI * 4)
  const dj = figure(P, { x: 352, y: 352 - hipAbove(P, 1.7, 4.2), z: 4.2, h: 1.7, build: 0.85, pose: pose({ trunk: 12, lu: a, ll: a + 40, ru: -a * 0.4 + 40, rl: 60 }), coat: 0.6, legs: 0.12, skin: 0.33, hair: 0.15, hat: 'capBack' })
  P.ellipse(dj.haL[0] + 6, dj.hip[1] + 40, 26, 10, 0.5)
}

// =============================================================================================
export function p06(P: Painter): void {
  // door open "a hand": the plate is dark; one wedge of daylight across the floor and bench end
  P.at(3); P.rect(-40, 0, 560, 424, 0.006)
  P.at(2.6); P.hgrad(-40, 0, 560, 300, 0.012, 0.03)
  P.at(2.2); P.poly([360, 424, 520, 424, 520, 300, 470, 300], 0.45)              // the wedge of light
  P.at(2.2); P.rect(-40, 300, 560, 12, 0.02); P.poly([440, 300, 520, 300, 520, 312, 452, 312], 0.3)
  // the lamp on its hook, upper centre; window intact, BLACK; the etched band's right end reads III
  P.at(1.3); P.line([228, 0, 228, 36, 240, 46], 3, 0.02)
  darkroomLamp(P, 228, 130, 1.3, 0.25, false, 0.07)
  // Nell, right of the lamp, chin up, holding the TRIAL plate toward it like a prize; no scarf
  const nz = 1.6
  const nj = figure(P, { x: 372, y: 342, z: nz, h: 1.4, build: 0.8, pose: pose({ head: -10, lu: 130, ll: 120, ru: 150, rl: 130 }), coat: 0.15, legs: 0.15, skin: 0.33, skirt: true, pinafore: 0.75, hair: 0.2, plait: true, collar: 0.85, light: 0.14 })
  P.at(nz); P.poly([nj.haL[0] - 18, nj.haL[1] - 8, nj.haL[0] + 2, nj.haL[1] - 12, nj.haL[0] + 4, nj.haL[1] + 4, nj.haL[0] - 16, nj.haL[1] + 8], 0.06)
  // dustpan with the cracked slivers on the floor
  P.at(1.5); P.poly([180, 392, 260, 392, 270, 410, 170, 410], 0.03); P.line([196, 400, 204, 397], 2, 0.2); P.line([222, 402, 228, 398], 2, 0.2)
  // Wick asleep on the coal bin at left
  P.at(2.1); P.rect(10, 300, 84, 70, 0.012); P.rect(6, 294, 92, 7, 0.018)
  cat(P, 52, 292, 2.1, 'curl', 0.12, true)
}
