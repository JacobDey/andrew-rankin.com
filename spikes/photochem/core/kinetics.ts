// Small, exact time-steppers and rate laws shared by every process.
//
// Everything here is frame-rate independent: stepping 1 x 30 s or 1800 x 1/60 s
// gives the same answer for constant coefficients, so a game can run the
// chemistry at 60 Hz while a test jumps straight to the end.

/** Temperature coefficient: rate multiplier for a Q10 law relative to `ref` °C. */
export function q10(q10: number, tempC: number, ref = 20): number {
  return Math.pow(q10, (tempC - ref) / 10)
}

/** Exponential relaxation of x toward target with time constant tau. */
export function relax(x: number, target: number, tau: number, dt: number): number {
  if (tau <= 0) return target
  return target + (x - target) * Math.exp(-dt / tau)
}

/** Exponential decay of x with time constant tau. */
export function decay(x: number, tau: number, dt: number): number {
  return tau <= 0 ? 0 : x * Math.exp(-dt / tau)
}

/**
 * Exact step of the autocatalytic development law
 *
 *   dp/dt = R (a + b p) (1 - p),   p in [0, 1]
 *
 * a = seed (first-order) rate, b = autocatalytic rate, R = activity.
 * b = 0 gives first-order kinetics p = 1 - exp(-R a t): the Sheppard–Nietz
 * time-gamma law used for film. b >> a gives a logistic curve with an
 * induction period ln(b/a)/(R b): the "nothing, nothing, then it comes up"
 * feel of a print in the tray.
 *
 * Closed form: (a + b p)/(1 - p) = K0 exp((a + b) R t)  =>  p = (K - a)/(K + b)
 */
export function devStep(p: number, R: number, a: number, b: number, dt: number): number {
  if (p >= 1) return 1
  const k = (a + b) * R * dt
  if (k <= 0) return p
  if (k > 60) return 1
  const K = ((a + b * p) / (1 - p)) * Math.exp(k)
  const out = (K - a) / (K + b)
  return out > 1 ? 1 : out < p ? p : out
}

/** Time (same units as 1/R) for devStep to take p from p0 to p1. */
export function devTimeBetween(p0: number, p1: number, R: number, a: number, b: number): number {
  const g = (p: number) => Math.log((a + b * p) / (1 - p))
  return (g(p1) - g(p0)) / ((a + b) * R)
}

/**
 * Reciprocity law failure as an intensity efficiency η(I), so exposures can be
 * integrated frame by frame (dH = η(I) I dt) through clouds, dodging and
 * flickering safelights.
 *
 *   η(I) = (1 + (Ic/I)²)^(-p/2) * (1 + (I/Ih)²)^(-q/2)
 *
 * For I << Ic this is Schwarzschild's law H = I^(1+p) t / Ic^p, the familiar
 * "t_corrected = t^(1+p)" rule (p ≈ 0.27 gives the classic t^1.3 film rule:
 * metered 8 s needs ~14 s). For I >> Ic it is 1 to second order, so normal
 * exposures are untouched (the transition is one octave wide; at I = Ic the
 * loss is 2^(-p/2), about 1/8 stop). The second factor is high-intensity
 * failure (flash at 1/16 000 s loses about 1/3 stop).
 */
export interface Reciprocity {
  /** Low-intensity threshold, effective lux. Below this, efficiency falls. */
  iLow: number
  /** Schwarzschild exponent deficit (0 = perfect reciprocity). */
  pLow: number
  /** High-intensity threshold, effective lux (Infinity = none). */
  iHigh: number
  pHigh: number
}

export const PERFECT_RECIPROCITY: Reciprocity = { iLow: 0, pLow: 0, iHigh: Infinity, pHigh: 0 }

export function reciprocityEfficiency(r: Reciprocity, I: number): number {
  if (!(I > 0)) return 0
  let e = 1
  if (r.pLow > 0 && r.iLow > 0) {
    const u = r.iLow / I
    e *= Math.pow(1 + u * u, -0.5 * r.pLow)
  }
  if (r.pHigh > 0 && Number.isFinite(r.iHigh)) {
    const v = I / r.iHigh
    e *= Math.pow(1 + v * v, -0.5 * r.pHigh)
  }
  return e
}

/**
 * Build a reciprocity model from the photographer's description: exposures of
 * "normal" density `Hn` start failing when the metered time exceeds `tc`
 * seconds, with exponent p. High-intensity failure starts at `tHigh` seconds.
 */
export function reciprocityFromTimes(Hn: number, tc: number, p: number, tHigh = 0, pHigh = 0.2): Reciprocity {
  return { iLow: Hn / tc, pLow: p, iHigh: tHigh > 0 ? Hn / tHigh : Infinity, pHigh: tHigh > 0 ? pHigh : 0 }
}

/** The time you actually need when the meter says `tMetered` for exposure H. */
export function reciprocityCorrectedTime(r: Reciprocity, tMetered: number, H: number): number {
  const I = H / tMetered
  return tMetered / reciprocityEfficiency(r, I)
}

/** Hermite smoothstep. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/** Deterministic hash -> [0,1). Integer coordinates + seed. */
export function hash01(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Deterministic approximately-normal sample (Irwin–Hall of 4). */
export function hashGauss(x: number, y: number, seed = 0): number {
  return (
    (hash01(x, y, seed) + hash01(x, y, seed + 101) + hash01(x, y, seed + 202) + hash01(x, y, seed + 303) - 2) *
    1.7320508
  )
}
