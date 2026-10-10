// Handheld shake: the camera as a body in a hand (lensbench.md §5.9). 1 kHz semi-implicit Euler.
import { mulberry32 } from '@shared/core'
import type { LensDesign, LensProfile } from '@shared/optics'
import { autoThickness, elementVolume, GLASSES } from '@shared/optics'

/**
 * Tremor amplitude, N·m. The GDD's A = 0.0014 N·m is the nominal; ×2.25 calibrates this integrator so a
 * 600 g body with a 50 mm lens gives ω_rms ≈ 0.02 rad/s (lensbench.md §5.9: "the self-test asserts ±30%").
 */
export const TREMOR_A = 0.0014 * 2.25

export interface ShakeParams { I: number; tripod: boolean }

/** Moment of inertia (kg·m²) about the grip pivot (20 mm behind the film plane). */
export function inertia(bodyG: number, lens: LensDesign, p: LensProfile): number {
  const pivot = 20 // mm, behind the film
  let I = (bodyG / 1000) * 0.045 * 0.045
  let dMax = 0, zSum = 0, n = 0
  for (const e of lens.elements) {
    const t = autoThickness(e)
    const m = ((GLASSES[e.glass]?.rho ?? 2.5) * elementVolume({ ...e, t })) / 1e6 // kg
    const r = (pivot - (e.z + t / 2)) / 1000
    I += m * r * r
    dMax = Math.max(dMax, e.diameter)
    zSum += e.z + t / 2; n++
  }
  const barrel = (1.2 * p.lengthMm * (dMax / 10)) / 1000
  if (n > 0) { const r = (pivot - zSum / n) / 1000; I += barrel * r * r }
  return Math.max(1e-5, I)
}

export class Shake {
  yaw = 0; pitch = 0; vy = 0; vp = 0
  t = 0
  private f: number[] = []; private a: number[] = []; private ph: number[] = []
  private fP: number[] = []; private phP: number[] = []
  halfPressT = -1
  constructor(public params: ShakeParams, seed: number) { this.reseed(seed) }
  reseed(seed: number) {
    const r = mulberry32(seed >>> 0)
    this.f = []; this.a = []; this.ph = []; this.fP = []; this.phP = []
    let s2 = 0
    for (let j = 0; j < 6; j++) { this.f.push(8 + 4 * r()); const a = 0.5 + r(); this.a.push(a); s2 += a * a; this.ph.push(r() * Math.PI * 2) }
    const norm = Math.sqrt(2 / s2) // RMS of Σ a sin = sqrt(Σa²/2) → 1
    this.a = this.a.map((a) => a * norm)
    for (let j = 0; j < 6; j++) { this.fP.push(8 + 4 * r()); this.phP.push(r() * Math.PI * 2) }
  }
  reset() { this.yaw = this.pitch = this.vy = this.vp = 0 }
  private tremor(t: number, f: number[], ph: number[]): number {
    let s = 0
    for (let j = 0; j < 6; j++) s += this.a[j] * Math.sin(2 * Math.PI * f[j] * t + ph[j])
    return TREMOR_A * s
  }
  /** Gain from holding your breath: 0.4 for 2.5 s, rising to 1.4 by 5 s. */
  gain(): number {
    if (this.halfPressT < 0) return 1
    const h = this.halfPressT
    return h < 2.5 ? 0.4 : Math.min(1.4, 0.4 + ((h - 2.5) / 2.5) * 1.0)
  }
  /** Advance by dt seconds with 1 ms steps. */
  step(dt: number): void {
    const { I, tripod } = this.params
    const k = tripod ? 60 : 1.6
    const zeta = tripod ? 0.05 : 0.3
    const c = 2 * zeta * Math.sqrt(k * I)
    const h = 0.001
    const n = Math.min(2000, Math.max(1, Math.round(dt / h)))
    for (let i = 0; i < n; i++) {
      const g = tripod ? 0 : this.gain()
      const held = this.halfPressT >= 0
      const breath = tripod ? 0 : 0.002 * Math.sin(2 * Math.PI * 0.25 * this.t) * (held ? 0.1 : 1)
      const ty = g * this.tremor(this.t, this.f, this.ph)
      const tp = g * this.tremor(this.t, this.fP, this.phP) + breath
      this.vy += ((-k * this.yaw - c * this.vy + ty) / I) * h
      this.vp += ((-k * this.pitch - c * this.vp + tp) / I) * h
      this.yaw += this.vy * h
      this.pitch += this.vp * h
      this.t += h
      if (this.halfPressT >= 0) this.halfPressT += h
    }
  }
  impulse(J: number): void { this.vp += J / this.params.I }
}

/** ω_rms (rad/s) of a 600 g body with the given lens, handheld (self-test: ≈ 0.02 ± 30%). */
export function omegaRms(I: number, seed = 1): number {
  const s = new Shake({ I, tripod: false }, seed)
  s.step(2)
  let acc = 0, n = 0
  for (let i = 0; i < 8000; i++) { s.step(0.001); acc += s.vy * s.vy + s.vp * s.vp; n++ }
  return Math.sqrt(acc / n / 2)
}
