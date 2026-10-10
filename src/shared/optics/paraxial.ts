// Paraxial y–nu trace and system matrices (lensbench.md §5.3).
import type { Ch } from './types'
import { nOf, type Surface } from './trace'

/** 2×2 ray-transfer matrix on (y, n·u). */
export interface M2 { A: number; B: number; C: number; D: number }
const I2: M2 = { A: 1, B: 0, C: 0, D: 1 }
function mul(m: M2, n: M2): M2 {
  // m · n (apply n first)
  return { A: m.A * n.A + m.B * n.C, B: m.A * n.B + m.B * n.D, C: m.C * n.A + m.D * n.C, D: m.C * n.B + m.D * n.D }
}

/** System matrix from the plane of surface `from`'s vertex to the plane of surface `to−1`'s vertex (after refraction). */
export function systemMatrix(surfs: Surface[], ch: Ch, from = 0, to = surfs.length): M2 {
  let m = I2
  for (let i = from; i < to; i++) {
    const s = surfs[i]
    if (i > from) {
      const prev = surfs[i - 1]
      const n = nOf(prev.glassAfter, ch)
      const t = s.z - prev.z
      m = mul({ A: 1, B: t / n, C: 0, D: 1 }, m)
    }
    const phi = s.c * (nOf(s.glassAfter, ch) - nOf(s.glassBefore, ch))
    if (phi !== 0) m = mul({ A: 1, B: 0, C: -phi, D: 1 }, m)
  }
  return m
}

export interface Paraxial {
  efl: number
  bfd: number // last vertex → rear focus
  ffd: number // front focus → first vertex (positive when the focus is in front)
  focusZ: number // rear focal point z
  p2z: number
  p1z: number
  power: number
}

export function paraxial(surfs: Surface[], ch: Ch): Paraxial {
  if (!surfs.length) return { efl: Infinity, bfd: Infinity, ffd: Infinity, focusZ: Infinity, p1z: 0, p2z: 0, power: 0 }
  const m = systemMatrix(surfs, ch)
  const power = -m.C // n'=n=1
  const zFirst = surfs[0].z, zLast = surfs[surfs.length - 1].z
  if (Math.abs(power) < 1e-12) return { efl: Infinity, bfd: Infinity, ffd: Infinity, focusZ: Infinity, p1z: zFirst, p2z: zLast, power: 0 }
  const efl = 1 / power
  // Input ray y=1, nu=0 → (A, C); after last surface the ray height is A and slope C
  const bfd = -m.A / m.C
  // Reverse: ffd from y=1 exiting parallel: input slope u0 such that output slope 0 → D·u0 + C·1 ... use formula ffd = D/C
  const ffd = m.D / m.C // distance from first vertex back to the front focal point (positive = in front for a positive lens)
  const focusZ = zLast + bfd
  const p2z = focusZ - efl
  const frontFocusZ = zFirst - -ffd
  // ffd sign: front focus at zFirst + D/C… for a positive lens C<0, D≈1 → zFirst − f
  const p1z = frontFocusZ + efl
  return { efl, bfd, ffd: -ffd, focusZ, p1z, p2z, power }
}

/** Image of the stop through the surfaces before it (entrance pupil) and after it (exit pupil). */
export function pupils(surfs: Surface[], ch: Ch): { ep: { z: number; d: number }; xp: { z: number; d: number } } {
  const si = surfs.findIndex((s) => s.stop)
  if (si < 0) return { ep: { z: 0, d: 0 }, xp: { z: 0, d: 0 } }
  const stop = surfs[si]
  const dStop = stop.semi * 2
  // Front group: matrix from the first vertex plane to the stop plane.
  let ep = { z: stop.z, d: dStop }
  if (si > 0) {
    const mf = mul({ A: 1, B: (stop.z - surfs[si - 1].z) / nOf(surfs[si - 1].glassAfter, ch), C: 0, D: 1 }, systemMatrix(surfs, ch, 0, si))
    // object plane at zFirst − L: imaging condition A·L + B = 0
    if (Math.abs(mf.A) > 1e-9) {
      const L = -mf.B / mf.A
      ep = { z: surfs[0].z - L, d: dStop / Math.abs(mf.A) }
    }
  }
  let xp = { z: stop.z, d: dStop }
  if (si < surfs.length - 1) {
    const first = surfs[si + 1]
    const mr = mul(systemMatrix(surfs, ch, si + 1), { A: 1, B: (first.z - stop.z) / nOf(stop.glassAfter, ch), C: 0, D: 1 })
    if (Math.abs(mr.D) > 1e-9) {
      const L = -mr.B / mr.D
      const zLast = surfs[surfs.length - 1].z
      xp = { z: zLast + L, d: dStop / Math.abs(mr.D) }
    }
  }
  return { ep, xp }
}

/** Petzval sum Σ φ/(n n') in 1/mm (d line). */
export function petzvalSum(surfs: Surface[]): number {
  let p = 0
  for (const s of surfs) {
    const n1 = nOf(s.glassBefore, 1), n2 = nOf(s.glassAfter, 1)
    if (n1 === n2) continue
    p += (s.c * (n2 - n1)) / (n1 * n2)
  }
  return p
}
