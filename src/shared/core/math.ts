// Small numeric helpers shared by every game.

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x)
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** Where x sits between a and b (unclamped); 0 when a === b. */
export const invLerp = (a: number, b: number, x: number): number => (a === b ? 0 : (x - a) / (b - a))
/** Map x from [inLo, inHi] to [outLo, outHi] (unclamped). */
export const remap = (x: number, inLo: number, inHi: number, outLo: number, outHi: number): number =>
  outLo + (outHi - outLo) * invLerp(inLo, inHi, x)
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01(invLerp(e0, e1, x))
  return t * t * (3 - 2 * t)
}
export function smootherstep(e0: number, e1: number, x: number): number {
  const t = clamp01(invLerp(e0, e1, x))
  return t * t * t * (t * (t * 6 - 15) + 10)
}
export const fract = (x: number): number => x - Math.floor(x)
/** Always-positive modulo (result in [0, n) for n > 0). */
export const mod = (x: number, n: number): number => ((x % n) + n) % n
export const degToRad = (d: number): number => (d * Math.PI) / 180
export const radToDeg = (r: number): number => (r * 180) / Math.PI
export const approxEq = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps

/** Frame-rate independent exponential approach: cur moves toward target with rate lambda (1/s). */
export function damp(cur: number, target: number, lambda: number, dt: number): number {
  return lerp(cur, target, 1 - Math.exp(-lambda * dt))
}
/** x * exp(-dt / tau): decay of a value with time constant tau (seconds). */
export function expDecay(x: number, tau: number, dt: number): number {
  return tau <= 0 ? 0 : x * Math.exp(-dt / tau)
}

export interface Spring1 {
  x: number
  v: number
}
/**
 * Damped spring toward `target` (omega rad/s, zeta damping ratio). Stable for any dt and any zeta:
 * semi-implicit Euler with implicit damping, substepped when dt*omega > 0.5.
 * Mutates and returns `s` (no allocation), so both `s = springStep(s, ...)` and `springStep(s, ...)` work.
 */
export function springStep(s: Spring1, target: number, omega: number, zeta: number, dt: number): Spring1 {
  if (dt <= 0) return s
  const n = Math.max(1, Math.ceil((dt * omega) / 0.5))
  const h = dt / n
  const w2 = omega * omega
  const c = 2 * zeta * omega
  let x = s.x
  let v = s.v
  for (let i = 0; i < n; i++) {
    v = (v - w2 * (x - target) * h) / (1 + c * h)
    x += v * h
  }
  s.x = x
  s.v = v
  return s
}

/** Catmull-Rom (uniform) between p1 and p2; t in [0, 1]. */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

/** Fritsch-Carlson monotone cubic interpolant through (xs, ys); xs ascending. Clamps outside the range. */
export function monotoneCubic(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const n = xs.length
  if (n === 0) return () => 0
  if (n === 1) return () => ys[0] as number
  const dx: number[] = []
  const m: number[] = [] // secant slopes
  for (let i = 0; i < n - 1; i++) {
    const d = (xs[i + 1] as number) - (xs[i] as number)
    dx.push(d)
    m.push(d === 0 ? 0 : ((ys[i + 1] as number) - (ys[i] as number)) / d)
  }
  const t: number[] = new Array<number>(n)
  t[0] = m[0] as number
  t[n - 1] = m[n - 2] as number
  for (let i = 1; i < n - 1; i++) {
    const a = m[i - 1] as number
    const b = m[i] as number
    t[i] = a * b <= 0 ? 0 : (a + b) / 2
  }
  for (let i = 0; i < n - 1; i++) {
    const mi = m[i] as number
    if (mi === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = (t[i] as number) / mi
    const b = (t[i + 1] as number) / mi
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      t[i] = k * a * mi
      t[i + 1] = k * b * mi
    }
  }
  return (x: number): number => {
    if (x <= (xs[0] as number)) return ys[0] as number
    if (x >= (xs[n - 1] as number)) return ys[n - 1] as number
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if ((xs[mid] as number) <= x) lo = mid
      else hi = mid
    }
    const h = dx[lo] as number
    const u = (x - (xs[lo] as number)) / h
    const u2 = u * u
    const u3 = u2 * u
    return (
      (2 * u3 - 3 * u2 + 1) * (ys[lo] as number) +
      (u3 - 2 * u2 + u) * h * (t[lo] as number) +
      (-2 * u3 + 3 * u2) * (ys[lo + 1] as number) +
      (u3 - u2) * h * (t[lo + 1] as number)
    )
  }
}

function sortedCopy(a: ArrayLike<number>): Float64Array {
  const c = Float64Array.from(a)
  c.sort()
  return c
}
export function median(a: ArrayLike<number>): number {
  return percentile(a, 0.5)
}
/** Linear-interpolated percentile; p in [0, 1]. Returns 0 for an empty array. */
export function percentile(a: ArrayLike<number>, p: number): number {
  const n = a.length
  if (n === 0) return 0
  const s = sortedCopy(a)
  const f = clamp01(p) * (n - 1)
  const i = Math.floor(f)
  const j = Math.min(n - 1, i + 1)
  return (s[i] as number) + ((s[j] as number) - (s[i] as number)) * (f - i)
}
