// games/plates/content/scenes2.ts — plates 7–13, staged per plates-story.md §6.
import { Painter, figure, pose, SIT, cat, hipAbove, lantern } from './paint'

function astragals(P: Painter, top: number, bottom: number, Y: number): void {
  P.rect(-40, top - 4, 560, 6, Y); P.rect(-40, bottom - 2, 560, 8, Y)
  for (let x = -60; x < 560; x += 70) { P.line([x, top, x + 50, bottom], 3, Y); P.line([x + 50, top, x, bottom], 3, Y) }
}

// =============================================================================================
// Plate 7: Lighting-up. Nell in the hatch is hidden from the LEFT lens by the pedestal's edge.
export function p07(P: Painter): void {
  P.at(4); P.rect(-40, 0, 560, 424, 0.012)
  // dusk sky through the glazing: dim, even grey
  P.at(4.2); P.glowPoly([-40, 40, 520, 40, 520, 290, -40, 290], 0.22); astragals(P, 40, 290, 0.02)
  // the sector frame (right): panes I and II black, opening III empty (dusk grey), red-wool tuft on its screw
  P.at(2.6)
  const x0 = 330, y0 = 132, pw = 30, ph = 36, gap = 7
  P.rect(x0 - 4, y0 - 4, 3 * pw + 2 * gap + 8, ph + 8, 0.03)
  P.rect(x0, y0, pw, ph, 0.002); P.rect(x0 + pw + gap, y0, pw, ph, 0.002)
  P.glowPoly([x0 + 2 * (pw + gap), y0, x0 + 3 * pw + 2 * gap, y0, x0 + 3 * pw + 2 * gap, y0 + ph, x0 + 2 * (pw + gap), y0 + ph], 0.24)
  const tx = x0 + 2 * (pw + gap) + 1, ty = y0 + ph - 4
  P.circle(tx + 1, ty + 1, 1.6, 0.05)
  P.poly([tx - 1, ty - 1, tx + 4, ty - 4, tx + 5, ty + 2, tx + 2, ty + 5, tx - 2, ty + 3], 0.0005)
  // the lens drum with the flame inside (small, very bright, halating)
  P.at(2.3); P.rect(170, 60, 130, 250, 0.03)
  for (let k = 0; k < 14; k++) { P.rect(170, 60 + k * 18, 130, 2, 0.008); P.hgrad(170, 63 + k * 18, 130, 14, 0.02, 0.08) }
  P.glowDisc(236, 186, 7, 16, false); P.glowDisc(236, 186, 26, 1.2)
  P.c.save(); P.g.save(); P.g.strokeStyle = 'rgb(10,10,10)'; P.g.lineWidth = 3; P.g.beginPath(); P.g.arc(236, 186, 18, 0, Math.PI * 2); P.g.stroke(); P.g.restore(); P.c.restore()
  // Amos at the lens, left of centre, face lit from below, the spent match in his fingers; sharp
  const az = 2.0
  const aj = figure(P, { x: 140, y: 330, z: az, h: 1.75, build: 1.1, pose: pose({ head: 4, ru: 140, rl: 160, lu: -6, ll: 4 }), coat: 0.08, legs: 0.07, skin: 0.22, beard: 0.6, beardFull: true, hat: 'capBand', bandY: 0.6, buttons: 0.4, buttonRows: 2, light: 0.35, profile: 1 })
  P.line([aj.haR[0], aj.haR[1], aj.haR[0] + 7, aj.haR[1] - 5], 1.5, 0.05)
  // the floor hatch (left foreground), ladder going down
  P.at(1.6); P.poly([10, 360, 170, 360, 190, 424, -10, 424], 0.0015)
  P.rect(30, 356, 160, 6, 0.03)
  // Nell's head and shoulders rise out of the hatch; Wick's tail-tip on the rung below (RIGHT eye only)
  if (!P.isL) {
    const nz = 2.8
    P.at(nz)
    const s = P.s(nz)
    P.ellipse(152, 336, 0.15 * s, 0.09 * s, 0.012)                   // shoulders (dark dress)
    P.ellipse(152, 306, 0.075 * s, 0.095 * s, 0.03)                  // face
    P.ellipse(152, 292, 0.08 * s, 0.05 * s, 0.008)                   // hair
    P.circle(140, 304, 1.3, 0.003); P.circle(162, 304, 1.3, 0.003)
    P.ellipse(186, 356, 0.035 * s, 0.022 * s, 0.03)                  // one hand on the hatch rim
    P.circle(170, 392, 2.4, 0.2)                                     // Wick's tail-tip, ladder rung
  }
  // the lens pedestal's edge: dark iron, near the camera, between camera and hatch
  P.at(0.9); P.poly([60, 230, 160, 230, 166, 424, 54, 424], 0.004); P.rect(56, 224, 108, 8, 0.01)
}

// =============================================================================================
// Plate 8: The Light in the Gale. A swung lamp leaves a fan of arcs; the red sector has a white slot.
export function p08(P: Painter): void {
  const t = P.t
  P.at(80); P.rect(-40, 0, 560, 424, 0.002)
  // the light in the rain and spray (azimuth function): white sectors bright, red sector dark, the slot white
  P.at(40)
  P.glowPoly([-40, 0, 520, 0, 520, 250, -40, 250], 0.32)
  // red sector: a dark fan toward the Teeth (azimuth 70°–110°)
  P.poly([150, -40, 520, -40, 520, 252, 300, 252], 0.004)
  // the white slot (86°–94°) through empty opening III, straight at the Teeth
  P.glowPoly([268, -40, 306, -40, 338, 252, 326, 252], 1.6)
  // sea, black; the Teeth on the horizon in the slot
  P.at(60); P.rect(-40, 252, 560, 172, 0.003); for (let i = 0; i < 6; i++) P.poly([314 + i * 6, 254, 318 + i * 6, 247 - (i % 2) * 3, 323 + i * 6, 254], 0.002)
  // the ketch's masthead light: a short streak running into the slot
  P.at(55); P.glowLine([292, 226, 318, 236], 2.2, 4)
  // rain streaks
  P.at(10); for (let i = 0; i < 70; i++) { const x = (i * 97) % 520 - 20, y = (i * 53) % 400; P.glowLine([x, y, x - 3, y + 14], 1, 0.05) }
  // the cottage below left: kitchen window weakly lit, Keturah's silhouette in a shawl, Wick beside her
  P.at(25); P.rect(-40, 290, 200, 134, 0.004); P.poly([-40, 290, 70, 290, 40, 262, -10, 262], 0.003)
  P.rect(70, 318, 34, 40, 0.07)
  P.ellipse(84, 330, 5, 6, 0.004); P.poly([74, 358, 94, 358, 90, 336, 78, 336], 0.004)
  P.circle(98, 354, 1.1, 0.004); P.circle(99, 351, 0.8, 0.004)
  // the gallery rail curving away from left foreground to right
  P.at(2.2); P.line([-40, 330, 160, 300, 380, 288, 520, 292], 6, 0.03); P.line([-40, 380, 200, 352, 520, 340], 4, 0.03)
  for (let x = 0; x < 500; x += 52) P.line([x, 300 + (x < 200 ? 30 - x * 0.1 : 0), x, 380], 3, 0.02)
  // Penwarden at the rail, foreground right, swaying (dim ghost), the hand-lamp swung at arm's length
  const sway = Math.sin(t * Math.PI * 10) * 6
  figure(P, { x: 410 + sway, y: 300, z: 2.4, h: 1.82, build: 1.25, pose: pose({ trunk: -8 + sway * 0.4, lu: 120, ll: 120 }), coat: 0.07, legs: 0.07, skin: 0.2, beard: 0.05, beardFull: true, hat: 'cap', light: 0.05 })
  // fan of overlapping arcs (authored trails): ten swings, ~70° each, pivoting at his shoulder
  P.at(2.4)
  const sx = 380, sy = 182
  for (let k = 0; k < 10; k++) {
    const r = 112 + (k % 3) * 7 + k
    const a0 = (-120 - 35 + (k % 2) * 4) * Math.PI / 180, a1 = (-120 + 35 - (k % 2) * 4) * Math.PI / 180
    P.g.strokeStyle = 'rgb(48,48,48)'; P.g.lineWidth = 2.4
    P.g.beginPath(); P.g.arc(sx, sy, r, a0, a1); P.g.stroke()
  }
  P.glowDisc(sx + Math.cos(-2.1) * 118, sy + Math.sin(-2.1) * 118, 6, 3)
}

// =============================================================================================
// Plates 9 and 10: Magnesium at the landing. Light falls off as 1/r² from the ribbon (up and right).
function landing(P: Painter, off: number, wave: boolean, t: number): void {
  P.at(80); P.rect(-40, 0, 560, 424, 0.0015)
  // the sea, black, foam streaks lit with distance
  P.at(30); P.rect(-40, 200, 560, 224, 0.002)
  for (let i = 0; i < 40; i++) { const x = ((i * 131) % 600) - 60 + off, y = 206 + ((i * 37) % 210); const L = Math.min(0.6, 0.02 * Math.pow(1 + (y - 200) / 40, 2)); P.line([x, y, x + 18 + (i % 5) * 4, y + 1], 1.5 + (y - 200) / 90, L) }
  // the ketch on the Teeth at 60 m, heeled over; binnacle lamp
  P.at(60); P.poly([330 + off, 214, 372 + off, 214, 380 + off, 204, 322 + off, 206], 0.004)
  P.glowDisc(350 + off, 206, 2.6, 2.5)
  // outer rocks at 22 m
  P.at(22); P.poly([96 + off, 236, 120 + off, 222, 150 + off, 230, 166 + off, 240], 0.003)
  // the stage: iron, stanchions every 1.5 m, seaward edge; derrick at the north end
  P.at(7); P.poly([170 + off, 300, 420 + off, 300, 520 + off, 330, 120 + off, 334], 0.03)
  for (let k = 0; k < 7; k++) { const x = 180 + off + k * 44; P.line([x, 300, x, 276], 3, 0.06) }
  P.line([180 + off, 278, 446 + off, 278], 2, 0.05)
  P.at(8); P.line([150 + off, 300, 140 + off, 170, 200 + off, 180], 5, 0.03)
  // the steps down (near), granite
  P.at(2.5); P.poly([-40 + off, 424, 300 + off, 424, 250 + off, 330, 0 + off, 330], 0.08)
  for (let y = 340; y < 424; y += 18) P.rect(-40 + off, y, 360, 3, 0.16)
  if (wave) {
    const a = 0.5 + 0.5 * Math.sin(t * Math.PI)
    P.at(10); P.glowPoly([240 + off, 258 - a * 10, 470 + off, 248 - a * 14, 500 + off, 272, 230 + off, 278], 0.35 + 0.2 * a)
  }
}
export function p09(P: Painter): void {
  const t = P.t, off = 0
  landing(P, off, true, t)
  // 8. the mainmast mid-fall (ghosted streak) over a bowler-hatted man at the wheel (lit by the binnacle)
  P.at(60)
  const m = t * 70 * Math.PI / 180
  P.line([352, 206, 352 + Math.sin(m) * 40, 206 - Math.cos(m) * 40], 2, 0.03)
  P.at(60); P.rect(343, 196, 5, 9, 0.02); P.ellipse(345.5, 194, 2.6, 2.4, 0.03); P.ellipse(345.5, 191.5, 2.4, 1.6, 0.002); P.rect(342, 192.6, 7, 0.9, 0.002)
  // 7. Rype, far out at the outer rocks, 22 m, clinging to a spar: fair head + white dots; alone
  P.at(22); P.line([108, 238, 152, 232], 3, 0.006)
  P.ellipse(126, 232, 5, 4, 0.011); P.circle(126, 226, 3.2, 0.02)
  for (let k = 0; k < 4; k++) P.rect(122 + k * 2.2, 231 + (k % 2), 1, 1, 0.035)
  // 5/10. Davy kneeling at the stage's seaward edge, his right hand on the boy Shilling's wrist
  const dz = 9, sDav = 0.13
  const dj = figure(P, { x: 430, y: 290, z: dz, h: 1.7, build: 0.85, pose: pose({ trunk: 40, head: 10, lt: -60, ls: 10, rt: 70, rs: -20, ru: 30, rl: 20, lu: -20, ll: -10 }, SIT), coat: 0.6, legs: 0.12, skin: 0.33, hair: 0.15, hat: 'capBack', light: sDav })
  // Shilling in the water below the edge: oilskin throws bright streaks
  P.at(dz); P.ellipse(dj.haR[0] + 4, dj.haR[1] + 16, 9, 12, 0.55 * sDav); P.circle(dj.haR[0] + 3, dj.haR[1] + 2, 4, 0.33 * sDav)
  P.glowLine([dj.haR[0] - 2, dj.haR[1] + 10, dj.haR[0] + 6, dj.haR[1] + 24], 1.5, 0.35); P.glowLine([dj.haR[0] + 8, dj.haR[1] + 8, dj.haR[0] + 12, dj.haR[1] + 20], 1.2, 0.3)
  // 4. Abery on the line in the surf, hand over hand: brass buttons catch the magnesium
  P.at(12)
  const lineY = (x: number) => 224 + (x - 40) * 0.42
  const ax = 238
  figure(P, { x: ax, y: lineY(ax) + 16, z: 12, h: 1.78, build: 1.05, pose: pose({ trunk: -50, lu: 130, ll: 140, ru: 150, rl: 160, lt: -20, rt: 20 }), coat: 0.09, legs: 0.09, skin: 0.3, moustache: 0.05, light: 0.09 })
  for (let k = 0; k < 3; k++) P.glowDisc(ax - 3 + k * 3, lineY(ax) + 12 - k * 3, 1.3, 1.2, false)
  // 3. Penwarden on the stage, braced, hauling the taut line (arms a small ghost)
  const pz = 6.2, haul = Math.sin(t * Math.PI * 2) * 12
  const pj = figure(P, { x: 300, y: 300 - hipAbove(P, 1.82, pz) + 16, z: pz, h: 1.82, build: 1.25, pose: pose({ trunk: 24, lu: 110 + haul, ll: 100 + haul, ru: 100 + haul, rl: 95, lt: 20, ls: 25, rt: -25, rs: -30 }), coat: 0.07, legs: 0.07, skin: 0.3, beard: 0.06, beardFull: true, hat: 'cap', light: 0.26 })
  P.at(9); P.line([pj.haL[0], pj.haL[1], 40, 224], 1.6, 0.3)
  // 2. Amos on the steps, storm-lantern held high; the white band of his cap
  const az = 3.2
  const aj = figure(P, { x: 150, y: 360 - hipAbove(P, 1.75, az), z: az, h: 1.75, build: 1.1, pose: pose({ ru: 165, rl: 170 }), coat: 0.08, legs: 0.07, skin: 0.32, beard: 0.7, beardFull: true, hat: 'capBand', bandY: 0.9, buttons: 0.6, buttonRows: 2, light: 0.62, profile: 1 })
  lantern(P, aj.haR[0], aj.haR[1] - 4, az, 3, 0.62)
  // 1. Keturah, foreground left at the top of the steps, arms full of blankets, face turned from the glare
  const kz = 1.9
  const kj = figure(P, { x: 60, y: 424 - hipAbove(P, 1.62, kz) + 70, z: kz, h: 1.62, pose: pose({ head: -18, lu: 60, ll: 100, ru: -50, rl: -100 }), coat: 0.1, legs: 0.1, skin: 0.32, skirt: true, apron: 0.85, hair: 0.12, bun: true, profile: -1, light: 1.0 })
  P.at(kz); P.ellipse(kj.neck[0] + 6, kj.neck[1] + 0.2 * kj.H, 0.1 * kj.H, 0.09 * kj.H, 0.62); P.ellipse(kj.neck[0] + 4, kj.neck[1] + 0.13 * kj.H, 0.09 * kj.H, 0.05 * kj.H, 0.7)
  // Wick under the derrick: two white eye-dots in the glare
  P.at(8); P.circle(156, 292, 1.1, 0.5); P.circle(160, 292, 1.1, 0.5)
}

export function p10(P: Painter): void {
  const off = -69
  landing(P, off, false, P.t)
  // the ketch's mast down across her deck, no one at the wheel
  P.at(60); P.line([326 + off, 210, 378 + off, 204], 2, 0.012)
  // the spar at the outer rocks, empty
  P.at(22); P.line([108 + off, 238, 152 + off, 232], 3, 0.012)
  // a black bowler floating in the white foam near the stage
  P.at(10); P.ellipse(420 + off + 69, 318, 26, 7, 0.75); P.ellipse(420 + off + 69, 312, 6, 5, 0.004); P.ellipse(420 + off + 69, 315, 9, 2, 0.004)
  // the stage is swept: Davy's cap on the outer stanchion; the boy lying where Davy knelt, arms round it
  const st = 180 + off + 6 * 44
  P.at(7); P.line([st, 300, st, 270], 4, 0.15)
  P.at(7); P.poly([st - 7, 270, st + 7, 270, st + 6, 263, st - 6, 263], 0.15); P.rect(st - 9, 269, 18, 2, 0.15)
  P.at(8.6)
  P.ellipse(st - 22, 298, 24, 6, 0.55 * 0.18); P.circle(st - 2, 296, 4.5, 0.33 * 0.18)
  P.line([st - 8, 295, st, 286], 3, 0.5 * 0.18); P.line([st - 10, 299, st + 1, 292], 3, 0.5 * 0.18)
  P.glowLine([st - 40, 296, st - 14, 294], 1.2, 0.3)
  // Penwarden crawling toward the boy along the stage, one hand out
  const pz = 6.6
  figure(P, { x: 300 + off + 40, y: 292, z: pz, h: 1.82, build: 1.25, pose: pose({ trunk: 72, head: -20, lu: 160, ll: 100, ru: 120, rl: 100, lt: -60, ls: 30, rt: -40, rs: 60 }), coat: 0.07, legs: 0.07, skin: 0.3, beard: 0.06, beardFull: true, hat: 'cap', light: 0.24 })
  // on the steps: Abery lies; Keturah kneels over him wrapping a blanket; Amos stands, lantern lowered
  P.at(2.9); P.ellipse(220 + off + 69, 392, 70, 16, 0.1); P.circle(156 + off + 69, 388, 10, 0.32 * 0.7)
  const kz = 2.7
  const kj = figure(P, { x: 232 + off + 69, y: 352, z: kz, h: 1.62, pose: pose({ trunk: 40, head: 20, lt: -70, ls: 30, rt: -60, rs: 40, lu: 40, ll: 20, ru: 30, rl: 10 }), coat: 0.1, legs: 0.1, skin: 0.32, skirt: true, hair: 0.12, bun: true, light: 0.7 })
  P.at(kz); P.ellipse(kj.haL[0], kj.haL[1] + 10, 40, 14, 0.6)
  const az = 3.4
  const aj = figure(P, { x: 110 + off + 69, y: 352 - hipAbove(P, 1.75, az) + 10, z: az, h: 1.75, build: 1.1, pose: pose({ head: 6, ru: 10, rl: 6 }), coat: 0.08, legs: 0.07, skin: 0.32, beard: 0.7, beardFull: true, hat: 'capBand', bandY: 0.9, buttons: 0.6, buttonRows: 2, light: 0.55, profile: 1 })
  lantern(P, aj.haR[0] + 2, aj.haR[1] + 8, az, 2, 0.55)
  // Wick on top of the blanket pile at the head of the steps
  P.at(1.9); P.ellipse(30, 404, 50, 22, 0.66); cat(P, 34, 384, 1.9, 'sit', 1.0, true)
}

// =============================================================================================
// Plate 11: The Kitchen, Midnight. One oil lamp on the table, 60 seconds.
export function p11(P: Painter): void {
  const t = P.t
  P.at(5); P.rect(-40, 0, 560, 424, 0.01)
  // back wall lit by the lamp pool; range; inner door at back
  P.at(4.2); P.pool(250, 230, 260, 0.2, 0.012, 0.8)
  P.at(4.1); P.rect(300, 150, 100, 120, 0.012); P.rect(292, 140, 116, 10, 0.03)
  P.at(4.3); P.rect(130, 110, 64, 170, 0.006)
  // Nell in the inner doorway, pale nightgown, swaying (ghost)
  const nsw = Math.sin(t * Math.PI * 2) * 5
  figure(P, { x: 162 + nsw, y: 280 - hipAbove(P, 1.4, 4.3), z: 4.3, h: 1.4, build: 0.8, pose: pose({}), coat: 0.85, legs: 0.85, skin: 0.33, skirt: true, hair: 0.2, plait: true, light: 0.14 })
  // Abery by the range: white head bandage, left arm in a white sling, cup; Wick under his chair
  const ab = 3.7
  const aj = figure(P, { x: 352, y: 300, z: ab, h: 1.78, build: 1.05, pose: pose({ lu: 20, ll: 80, ru: -20, rl: -100 }, SIT), coat: 0.09, legs: 0.09, skin: 0.3, moustache: 0.05, buttons: 0.7, light: 0.32 })
  P.at(ab); P.ellipse(aj.head[0], aj.head[1] - aj.headR * 0.5, aj.headR * 0.95, aj.headR * 0.45, 0.9 * 0.32)
  P.poly([aj.shR[0] - 4, aj.shR[1], aj.shL[0] + 6, aj.hip[1] - 22, aj.shL[0] + 2, aj.hip[1] - 14, aj.shR[0] - 10, aj.shR[1] + 6], 0.9 * 0.32)
  P.rect(aj.haR[0] - 4, aj.haR[1] - 8, 8, 9, 0.4 * 0.32)
  cat(P, 368, 330, 3.7, 'curl', 0.12, true)
  // Shilling asleep on the settle at right, wrapped in a blanket
  P.at(2.9); P.rect(408, 262, 120, 80, 0.04); P.rect(408, 236, 120, 30, 0.03)
  P.ellipse(462, 258, 50, 16, 0.7 * 0.3); P.circle(420, 252, 9, 0.32 * 0.3)
  // the table + oil lamp; Keturah pouring from the cask (arm ghosts); Penwarden, head in his hands, cup turned down
  P.at(2.6); P.poly([60, 300, 420, 300, 470, 380, 10, 380], 0.3 * 0.7)
  lantern(P, 236, 292, 2.6, 6, 0.7)
  const kz = 3.0
  const pour = Math.sin(t * Math.PI * 3) * 14
  const kj = figure(P, { x: 290, y: 300 - hipAbove(P, 1.62, kz) + 6, z: kz, h: 1.62, pose: pose({ trunk: 10, ru: 60 + pour, rl: 100 + pour, lu: 30, ll: 60 }), coat: 0.1, legs: 0.1, skin: 0.32, skirt: true, apron: 0.85, hair: 0.12, bun: true, light: 0.42, profile: 1 })
  // the cask, stencilled
  P.at(2.75); P.ellipse(336, 286, 22, 16, 0.4 * 0.5); P.rect(314, 270, 44, 32, 0.4 * 0.5)
  P.rect(316, 272, 3, 28, 0.05); P.rect(353, 272, 3, 28, 0.05)
  P.text('BRANDY', 336, 283, 8, 0.03, { align: 'center', bold: true, font: 'Arial, sans-serif' })
  P.text('ANNICK ROSE', 336, 294, 6.5, 0.03, { align: 'center', bold: true, font: 'Arial, sans-serif' })
  P.line([kj.haR[0], kj.haR[1], kj.haR[0] + 8, kj.haR[1] + 12], 2, 0.5 * 0.4)
  // Penwarden at the near side, head in his hands; his tin cup upside down before him
  const pz = 2.2
  figure(P, { x: 200, y: 360, z: pz, h: 1.82, build: 1.25, pose: pose({ trunk: 22, head: 20, lu: 150, ll: 175, ru: 165, rl: -175 }, SIT), coat: 0.07, legs: 0.07, skin: 0.3, beard: 0.06, beardFull: true, hair: 0.06, light: 0.45 })
  P.at(2.2); P.poly([250, 330, 272, 330, 268, 312, 254, 312], 0.55 * 0.6); P.rect(250, 312, 22, 3, 0.7 * 0.6)
  // Rype's body: a door across two chairs at left, under a sheet to the chest; cut brow; dotted cuff
  P.at(2.4); P.rect(-40, 352, 160, 14, 0.14 * 0.4); P.rect(-10, 366, 6, 50, 0.06); P.rect(96, 366, 6, 50, 0.06)
  P.poly([-40, 352, 120, 352, 118, 334, -40, 330], 0.85 * 0.35)
  P.ellipse(70, 332, 13, 10, 0.32 * 0.4); P.line([62, 328, 77, 325], 1.8, 0.004); P.ellipse(70, 324, 12, 5, 0.75 * 0.35)
  P.rect(18, 342, 24, 9, 0.07 * 0.4); for (let k = 0; k < 4; k++) P.rect(20 + k * 5.5, 344 + (k % 2) * 3, 2, 2, 0.85 * 0.35)
  // the black window at the left edge, angled, reflecting a woman beside a tripod (Ottilie)
  P.at(1.3); P.poly([-40, 40, 40, 70, 40, 300, -40, 330], 0.003)
  P.ellipse(14, 152, 5, 6, 0.02); P.poly([6, 196, 22, 196, 20, 160, 8, 160], 0.006); P.rect(10, 158, 8, 4, 0.025)
  P.line([30, 166, 26, 214], 1.2, 0.02); P.line([30, 166, 36, 214], 1.2, 0.02); P.rect(26, 158, 9, 9, 0.02)
}

// =============================================================================================
// Plate 12: The Watch Room, Three O'Clock. The 19h10 entry being written at 2.58 a.m.
export function p12(P: Painter): void {
  const t = P.t
  P.at(3); P.rect(-40, 0, 560, 424, 0.008)
  P.at(2.4); P.pool(300, 260, 300, 0.25, 0.01, 0.7)
  // the ladder to the hatch at the back, a flap of canvas dark in it
  P.at(2.8); P.rect(196, 0, 70, 22, 0.002); P.rect(200, 18, 62, 30, 0.004); P.line([210, 30, 214, 170], 3, 0.04); P.line([252, 30, 256, 170], 3, 0.04)
  for (let y = 46; y < 170; y += 24) P.line([212, y, 254, y], 2, 0.04)
  // the clock, top right, reads 2.58
  P.at(2.6)
  P.circle(420, 66, 30, 0.08); P.circle(420, 66, 27, 0.8)
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; P.circle(420 + Math.sin(a) * 22, 66 - Math.cos(a) * 22, 1.3, 0.05) }
  const am = (58 / 60) * Math.PI * 2, ah = (2 / 12 + 58 / 720) * Math.PI * 2
  P.line([420, 66, 420 + Math.sin(ah) * 13, 66 - Math.cos(ah) * 13], 3, 0.03); P.line([420, 66, 420 + Math.sin(am) * 21, 66 - Math.cos(am) * 21], 2, 0.03)
  // the desk + oil lamp
  P.at(1.5); P.rect(-40, 318, 560, 106, 0.12)
  lantern(P, 470, 300, 1.5, 7, 0.9)
  // the open log, large in frame; older lines drier; the squeezed fresh entry
  P.at(1.25)
  P.poly([140, 168, 470, 160, 476, 320, 132, 326], 0.82)
  P.line([302, 164, 304, 323], 1.5, 0.3)
  const ink = 0.02, dry = 0.09
  const lines: [string, number][] = [['Friday 11th November 1887.', dry], ['16h32. Lit up. All in order. A.K.', dry], ['19h00. Wind SW 9.', dry], ['19h15. Vessel struck upon', dry], ['the Teeth. 19h35. All hands', dry], ['to the landing.', dry]]
  let y = 190
  for (const [s, Y] of lines) { P.text(s, 146, y, 12, Y, { italic: true }); y += 22 }
  // squeezed between the 19h00 and 19h15 lines, fresh ink, cramped
  P.text('19h10 Sea broke in the lantern glazing & carried', 146, 241, 10, ink, { italic: true, bold: true })
  P.text('away Sector glass III. Canvas rigged. A.K.', 146, 252, 10, ink, { italic: true, bold: true })
  // Nell's scarf, folded beside the log (a black knitted square); Wick curled against it
  P.at(1.3); P.rect(400, 330, 70, 50, 0.01); for (let k = 0; k < 6; k++) P.line([404, 334 + k * 8, 466, 334 + k * 8], 1, 0.03)
  cat(P, 470, 360, 1.3, 'curl', 0.5, true)
  // Amos's head and shoulders, left third, face 5 cm from the page; magnifier in his left hand, pen in his right
  const az = 0.95
  P.at(az)
  P.ellipse(70, 420, 120, 90, 0.05)                                // shoulder and back (dark jacket)
  P.ellipse(110, 250, 54, 62, 0.28)                                // head, side-on, bent to the page
  P.ellipse(96, 222, 52, 36, 0.7)                                  // white hair
  P.ellipse(146, 286, 36, 30, 0.72)                                // white beard over the page edge
  P.c.save(); P.c.strokeStyle = 'rgb(150,150,150)'; P.c.lineWidth = 4; P.c.beginPath(); P.c.arc(168, 262, 22, 0, Math.PI * 2); P.c.stroke(); P.c.restore()
  P.line([168, 284, 150, 340], 5, 0.35)
  const pen = Math.sin(t * Math.PI * 6) * 3
  P.at(1.2); P.ellipse(236 + pen, 268, 14, 10, 0.3); P.line([236 + pen, 266, 246 + pen, 244], 2, 0.05)
}

// =============================================================================================
// Plate 13: In the Camera. Ottilie and the sleeping Nell, the lamp in her lap, Wick.
export function p13(P: Painter): void {
  // morning light from the wide-open door (right)
  P.at(2.8); P.hgrad(-40, 0, 560, 290, 0.18, 0.7)
  P.at(2.6); P.rect(-40, 230, 560, 14, 0.42); P.rect(-40, 244, 560, 60, 0.12)
  // the open plate tin on the bench, a stack of dark slides going in
  P.at(2.6); P.rect(330, 200, 90, 32, 0.12); P.rect(334, 196, 82, 8, 0.05); for (let k = 0; k < 5; k++) P.rect(340 + k * 3, 180 - k * 2, 60, 16, 0.04)
  P.at(2.2); P.rect(-40, 300, 560, 124, 0.25); P.speckle(-40, 300, 560, 124, 220, 2, 0.14, 13)
  // the coal bin
  P.at(1.9); P.rect(150, 300, 170, 80, 0.06); P.rect(144, 294, 182, 8, 0.1)
  // Nell asleep against Ottilie's shoulder, wrapped in the shawl
  const nz = 1.95
  const nj = figure(P, { x: 290, y: 292, z: nz, h: 1.4, build: 0.8, pose: pose({ trunk: -22, head: -30, lu: 30, ll: 70, ru: -20, rl: -60 }, SIT), coat: 0.45, legs: 0.15, skin: 0.34, skirt: true, hair: 0.2, plait: true })
  void nj
  // Ottilie on the coal bin, straight to the lens: thin, high pale collar, dark hair up; lamp in her lap
  const oz = 1.9
  const oj = figure(P, { x: 216, y: 292, z: oz, h: 1.68, build: 0.85, pose: pose({ lu: 18, ll: 70, ru: -26, rl: -70 }, SIT), coat: 0.08, legs: 0.08, skin: 0.34, skirt: true, hair: 0.1, bun: true, collar: 0.88 })
  // the darkroom lamp in her lap, window black, her right hand flat on it
  P.at(1.8)
  const lx = oj.hip[0] + 4, ly = oj.hip[1] - 36
  P.rect(lx - 38, ly - 44, 76, 88, 0.06); P.rect(lx - 30, ly - 34, 60, 66, 0.004)
  P.ellipse(lx - 10, ly - 4, 12, 8, 0.34)
  // Wick in Nell's lap
  cat(P, 300, 270, 1.85, 'curl', 1.0, true)
}
