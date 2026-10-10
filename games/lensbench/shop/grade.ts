// Grading measures (lensbench.md §6.10) and repair tags 01–05 (§6.7). Analytic, from ShotRecord,
// LensProfile and world targets; exposure from the latent.
import * as THREE from 'three'
import { acceptableCocMm, cocMm, computeProfile, type LensProfile } from '@shared/optics'
import { BODIES, SHUTTERS, STOCKS } from '../core/catalog'
import type { FrameRecord, LatentImage, ShotRecord, TagId, TargetId } from '../core/types'
import type { World } from '../street/world/world'
import { latentEV } from '../film/develop'

export const GRADE_W = 1600
const LAMBDA = 0.00055

export interface TagDef { id: TagId; from: string; ask: string; teaches: string; unlocks: string[]; readIt?: TargetId; hint: string }
export const TAGS: TagDef[] = [
  { id: 'T01', from: 'Q.', ask: 'Any picture of the street. No glass, no lies.', teaches: 'pinhole, exposure', unlocks: ['glass:crown', 'shutter:leaf', 'body:box', 'stock:pan100', 'preset:meniscus'], hint: 'Pinhole tin on the shop step. Sun: count six.' },
  { id: 'T02', from: 'Ada, Bakery No. 9', ask: 'What year is over my door? I’ve forgotten.', teaches: 'focus', unlocks: ['stock:pan400', 'stop:iris', 'body:rangefinder', 'preset:achromat', 'preset:triplet'], readIt: 'bakeryYear', hint: 'Box camera, meniscus, focus on the door.' },
  { id: 'T03', from: 'Mrs. Halloran', ask: 'Biscuit’s eyes. The rest can go soft.', teaches: 'shallow depth of field', unlocks: ['glass:flint', 'glass:lightFlint', 'stop:card', 'preset:portrait'], hint: 'Long lens, wide open, close to the cat.' },
  { id: 'T04', from: 'The Lantern Society', ask: 'Prove the square is haunted.', teaches: 'long exposure, ND, tripod', unlocks: ['filter:nd', 'preset:telephoto'], hint: 'Tripod, ND×64, four seconds or more.' },
  { id: 'T05', from: 'Juno, lamplighter', ask: 'Stars on my lamps, please.', teaches: 'diffraction stars', unlocks: ['stock:colour200', 'glass:denseFlint', 'glass:lanthanumCrown', 'preset:retrofocus', 'body:reflex', 'body:view'], hint: 'After nine, blades in the iris, f/8 or smaller.' },
]

export interface Measure { value: number; pass: boolean }
export interface GradeResult { pass: boolean; measures: Record<string, Measure>; budget: Record<string, number>; hash: string; fix: string }

const cam = new THREE.PerspectiveCamera()
const v = new THREE.Vector3(), v2 = new THREE.Vector3()

function poseAt(shot: ShotRecord, arr: Float32Array, tRel: number): [number, number] {
  const n = arr.length / 2
  const x = Math.max(0, Math.min(n - 1, tRel * shot.trackHz))
  const i = Math.floor(x), f = x - i, j = Math.min(n - 1, i + 1)
  return [arr[i * 2] * (1 - f) + arr[j * 2] * f, arr[i * 2 + 1] * (1 - f) + arr[j * 2 + 1] * f]
}

/** Project a world point for a shot at tRel, with or without shake. Returns print px (top-left origin) and depth. */
export function project(shot: ShotRecord, p: LensProfile, world: THREE.Vector3, tRel: number, shaken: boolean): { x: number; y: number; s: number; inFrame: boolean; r01: number } {
  const b = BODIES[shot.camera.body]
  const [fw, fh] = b.format
  const [yaw, pitch] = poseAt(shot, shaken ? shot.track : shot.aimNoShake, tRel)
  cam.fov = (2 * Math.atan(fh / 2 / (p.efl + (p.pinhole ? 0 : shot.ext))) * 180) / Math.PI
  cam.aspect = fw / fh
  cam.near = 0.05; cam.far = 5000
  cam.position.set(...shot.pos)
  cam.rotation.set(pitch, yaw, 0, 'YXZ')
  cam.updateMatrixWorld(); cam.updateProjectionMatrix()
  v.copy(world).applyMatrix4(cam.matrixWorldInverse)
  const s = -v.z
  v.copy(world).project(cam)
  const W = GRADE_W, H = (GRADE_W * fh) / fw
  const x = (v.x * 0.5 + 0.5) * W, y = (0.5 - v.y * 0.5) * H
  const inFrame = s > 0 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1
  const r01 = Math.min(1, Math.hypot(v.x * fw, v.y * fh) / Math.hypot(fw, fh))
  return { x, y, s, inFrame, r01 }
}

export interface TargetMeasure { inFrame: boolean; distM: number; defocus: number; motion: number; shake: number; glass: number; diffraction: number; total: number; c0px: number; glyphPx: number; exposureEV: number; sizePx: number }

export function measureTarget(shot: ShotRecord, w: World, id: TargetId, latent: LatentImage | null): TargetMeasure {
  const b = BODIES[shot.camera.body]
  const [fw, fh] = b.format
  const p = computeProfile(shot.camera.lens, { w: fw, h: fh }, 'full')
  const tg = w.targets[id]
  const pxPerMm = GRADE_W / fw
  const c0px = acceptableCocMm({ w: fw, h: fh }) * pxPerMm
  const sh = SHUTTERS[shot.camera.shutter]
  const t = shot.shutterS
  const mid = shot.worldT0 + t / 2
  tg.at(mid, v2)
  const pm = project(shot, p, v2, t / 2, false)
  // focal-plane: this target's own window opens at t0(u, v)
  const u = pm.x / GRADE_W, vv = pm.y / ((GRADE_W * fh) / fw)
  const t0 = sh.travel > 0 ? (sh.dir === 'left' ? sh.travel * (1 - u) : sh.travel * vv) : 0
  const defocus = Math.abs(cocMm(p, shot.ext, Math.max(0.05, pm.s), pm.r01, 1)) * pxPerMm
  tg.at(shot.worldT0 + t0, v2)
  const a = project(shot, p, v2, t0, false)
  tg.at(shot.worldT0 + t0 + t, v2)
  const z = project(shot, p, v2, t0 + t, false)
  const motion = Math.hypot(z.x - a.x, z.y - a.y)
  // shake: a static point at the target, θ alone
  tg.at(mid, v2)
  let shakeMax = 0
  const s0 = project(shot, p, v2, t0, true), s0n = project(shot, p, v2, t0, false)
  const steps = 8
  for (let i = 1; i <= steps; i++) {
    const tt = t0 + (t * i) / steps
    const sa = project(shot, p, v2, tt, true), sn = project(shot, p, v2, tt, false)
    const dx = (sa.x - sn.x) - (s0.x - s0n.x), dy = (sa.y - sn.y) - (s0.y - s0n.y)
    shakeMax = Math.max(shakeMax, Math.hypot(dx, dy))
  }
  const halfDiag = Math.hypot(fw, fh) / 2
  const h = pm.r01 * halfDiag
  const fieldCurv = Math.abs((p.efl / p.fNumber) * (-0.5 * p.petzval * h * h) / p.efl) * pxPerMm
  const latCA = Math.abs(p.lateralCA[0] - p.lateralCA[2]) * h * pxPerMm
  const glass = p.pinhole ? 0 : Math.hypot(p.saBlurMm * pxPerMm, fieldCurv, latCA)
  const Nw = p.fNumber * (1 + (p.pinhole ? 0 : shot.ext / p.efl))
  const diffraction = 2.44 * LAMBDA * Nw * pxPerMm
  const total = Math.hypot(defocus, motion, shakeMax, glass, diffraction)
  const dist = Math.max(0.05, pm.s)
  const glyphPx = tg.glyphM ? (tg.glyphM / dist) * (p.efl + shot.ext) * pxPerMm : 0
  const sizePx = (tg.sizeM / dist) * (p.efl + shot.ext) * pxPerMm
  let exposureEV = -10
  if (latent && pm.inFrame) {
    const uu = pm.x / GRADE_W, vvv = pm.y / ((GRADE_W * fh) / fw)
    const du = 2.5 / latent.w, dv = 2.5 / latent.h
    exposureEV = latentEV(latent, shot.camera.stock, Math.max(0, uu - du), Math.max(0, vvv - dv), Math.min(1, uu + du), Math.min(1, vvv + dv))
  }
  return { inFrame: pm.inFrame, distM: dist, defocus, motion, shake: shakeMax, glass, diffraction, total, c0px, glyphPx, exposureEV, sizePx }
}

function hashLatent(l: LatentImage | null): string {
  if (!l) return 'none'
  let h = 0x811c9dc5
  for (let i = 0; i < l.data.length; i += 7) { h ^= l.data[i]; h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16)
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

export function gradeFrame(f: FrameRecord, w: World, latent: LatentImage | null, tag?: string, answer?: string): GradeResult {
  const shot = f.shots[0]
  const measures: Record<string, Measure> = {}
  let budget: Record<string, number> = {}
  let fix = ''
  const ap = (m: TargetMeasure) => { budget = { defocus: m.defocus, motion: m.motion, shake: m.shake, glass: m.glass, diffraction: m.diffraction } }
  const fixFor = (m: TargetMeasure, what: string): string => {
    const parts: [string, number][] = [['defocus', m.defocus], ['motion', m.motion], ['shake', m.shake], ['glass', m.glass], ['diffraction', m.diffraction]]
    parts.sort((a, b) => b[1] - a[1])
    const [k, val] = parts[0]
    if (k === 'defocus') return `focus on ${what}: ${m.distM.toFixed(1)} m, or stop down`
    if (k === 'motion') return `motion ${val.toFixed(0)} px → a faster speed`
    if (k === 'shake') return 'shake → tripod or ≥ 1/250'
    if (k === 'diffraction') return 'diffraction → open up a stop or two'
    return 'glass → stop down, or a better lens'
  }
  const ev = latent ? latentEV(latent, shot.camera.stock) : NaN
  measures.exposure = { value: ev, pass: Number.isFinite(ev) && Math.abs(ev) <= 2 }
  const id = (tag ?? '') as TagId
  if (id === 'T01') {
    fix = Number.isFinite(ev) ? (ev < -2 ? 'thin negative → expose longer' : ev > 2 ? 'dense negative → shorter exposure' : '') : 'develop the film first'
  } else if (id === 'T02') {
    const m = measureTarget(shot, w, 'bakeryYear', latent)
    ap(m)
    measures.inFrame = { value: m.inFrame ? 1 : 0, pass: m.inFrame }
    measures.glyph = { value: m.glyphPx, pass: m.glyphPx >= 8 }
    measures.blur = { value: m.total, pass: m.total <= 0.35 * m.glyphPx }
    const want = w.targets.bakeryYear.answer?.(shot.textSeed) ?? ''
    measures.answer = { value: answer && norm(answer) === norm(want) ? 1 : 0, pass: !!answer && norm(answer) === norm(want) }
    fix = !m.inFrame ? 'the year is over the bakery door' : m.glyphPx < 8 ? 'too small → get closer or a longer lens' : fixFor(m, 'the door')
  } else if (id === 'T03') {
    const e = measureTarget(shot, w, 'catEye', latent), wall = measureTarget(shot, w, 'catWall', latent)
    ap(e)
    const headFrac = (0.22 / e.distM) * (computeProfile(shot.camera.lens, { w: BODIES[shot.camera.body].format[0], h: BODIES[shot.camera.body].format[1] }).efl + shot.ext) / BODIES[shot.camera.body].format[1]
    measures.catEye = { value: e.total / e.c0px, pass: e.inFrame && e.total <= 1.0 * e.c0px * 1.0 + 0.0001 }
    measures.catWall = { value: wall.defocus / wall.c0px, pass: wall.defocus >= 6 * wall.c0px }
    measures.catSize = { value: headFrac, pass: headFrac >= 0.12 }
    fix = !e.inFrame ? 'Biscuit is on the bakery sill' : headFrac < 0.12 ? 'closer, or a longer lens' : wall.defocus < 6 * wall.c0px ? 'open up for a softer wall' : fixFor(e, 'the cat')
  } else if (id === 'T04') {
    const r = measureTarget(shot, w, 'reader', latent)
    ap(r)
    const t = shot.shutterS
    const w1 = 0.45 / (1.3 * t), w2 = 0.45 / (1.4 * t)
    measures.openTime = { value: t, pass: t >= 4 }
    measures.walkers = { value: Math.min(1, Math.max(w1, w2)), pass: Math.min(1, w1) <= 0.25 && Math.min(1, w2) <= 0.25 }
    measures.reader = { value: r.total / r.c0px, pass: r.inFrame && r.total <= 2 * r.c0px }
    measures.readerEV = { value: r.exposureEV, pass: Math.abs(r.exposureEV) <= 1.5 }
    fix = t < 4 ? 'longer: four seconds or more (ND, tripod)' : !r.inFrame ? 'the reader is on the bench by the postbox' : fixFor(r, 'the reader')
  } else if (id === 'T05') {
    const l = measureTarget(shot, w, 'lamp2', latent)
    ap(l)
    const stop = shot.camera.lens.stop
    const n = stop.kind === 'iris' ? stop.blades : 0
    const p = computeProfile(shot.camera.lens, { w: BODIES[shot.camera.body].format[0], h: BODIES[shot.camera.body].format[1] })
    const Nw = p.fNumber * (1 + shot.ext / p.efl)
    const points = n && Nw >= 8 ? (n % 2 ? 2 * n : n) : 0
    measures.night = { value: shot.timeOfDay, pass: shot.timeOfDay >= 21 }
    measures.lamp = { value: l.defocus / l.c0px, pass: l.inFrame && l.defocus <= l.c0px }
    measures.stars = { value: points, pass: points >= 6 }
    fix = shot.timeOfDay < 21 ? 'after nine, when the lamps are lit' : !l.inFrame ? 'lamp two is by the shop' : points < 6 ? 'blades in the iris, f/8 or smaller' : fixFor(l, 'the lamp')
  }
  const pass = Object.values(measures).every((m) => m.pass) && (!!tag || measures.exposure.pass)
  return { pass, measures, budget, hash: hashLatent(latent), fix }
}

export function stockLabel(f: FrameRecord): string {
  const s = f.shots[0]
  const p = computeProfile(s.camera.lens, { w: BODIES[s.camera.body].format[0], h: BODIES[s.camera.body].format[1] }, 'fast')
  const sp = s.shutterS >= 1 ? `${s.shutterS.toFixed(1)} s` : `1/${Math.round(1 / s.shutterS)}`
  return `f/${p.pinhole ? Math.round(p.fNumber) : p.fNumber.toFixed(1)} · ${sp} · ${STOCKS[s.camera.stock].name} · ${s.camera.name} ${Math.round(p.efl)} mm`
}
