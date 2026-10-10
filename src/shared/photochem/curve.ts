// Characteristic (H&D) curves: density versus log10 exposure.
//
// One parametric family covers paper and film. It is a straight line of slope
// `gamma` with a softplus toe and a soft-min shoulder:
//
//   lin(x)  = gamma * (x - logH0)                     x = log10 H
//   toe(x)  = t * softplus(lin / t)                    -> 0 below, -> lin above
//   D(x)    = softmin(toe(x), dmax; s)                 -> dmax at high exposure
//   D(x)   -= sol * softplus(k (x - xs)) / k           optional solarisation
//
// `t` (toe) and `s` (shoulder) are in density units: 0.05 is a sharp corner,
// 0.4 a long gentle toe. `logH0` is the inertia point (where the extrapolated
// straight line meets zero net density). Densities are *net* (above base+fog).
//
// Why this family: every parameter has a photographic meaning, the straight
// line slope is exactly gamma, it is smooth and monotone (without
// solarisation), it costs two exp + two log per call, and it ports to GLSL
// line for line (see glsl.ts).

export interface Curve {
  /** Straight-line slope dD/dlogH. Paper 1.2 (soft) .. 5 (hard); film 0.5 .. 0.9. */
  gamma: number
  /** Inertia point: log10 H where the straight line meets D = 0. */
  logH0: number
  /** Toe softness, density units. */
  toe: number
  /** Net maximum density. */
  dmax: number
  /** Shoulder softness, density units. */
  shoulder: number
  /** Density lost per decade of gross overexposure (0 = none). */
  solarize?: number
  /** log10 H where solarisation starts. */
  solarizeAt?: number
}

/** Numerically safe softplus. */
export function softplus(x: number): number {
  return x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x))
}

/** Smooth minimum with softness s (s -> 0 gives min). */
export function softmin(a: number, b: number, s: number): number {
  const m = a < b ? a : b
  return m - s * Math.log1p(Math.exp(-Math.abs(a - b) / s))
}

/** Net density at log10 exposure x. */
export function curveDensity(c: Curve, x: number): number {
  const lin = c.gamma * (x - c.logH0)
  const toe = c.toe * softplus(lin / c.toe)
  let d = softmin(toe, c.dmax, c.shoulder)
  if (c.solarize) {
    const k = 3
    d -= (c.solarize * softplus(k * (x - (c.solarizeAt ?? 99)))) / k
  }
  return d > 0 ? d : 0
}

/** Net density for a linear exposure H (H <= 0 is treated as no exposure). */
export function curveDensityH(c: Curve, H: number): number {
  return curveDensity(c, H > 1e-30 ? Math.log10(H) : -30)
}

/** Local gradient dD/dlogH (central difference). */
export function curveGradient(c: Curve, x: number, h = 1e-3): number {
  return (curveDensity(c, x + h) - curveDensity(c, x - h)) / (2 * h)
}

/** log10 H at which the curve first reaches net density d (bisection). NaN if never. */
export function logHAtDensity(c: Curve | ((x: number) => number), d: number, lo = -12, hi = 12): number {
  const f = typeof c === 'function' ? c : (x: number) => curveDensity(c, x)
  // Walk up to the first bracket so solarising curves still return the rising branch.
  let a = lo
  let fa = f(a) - d
  if (fa > 0) return lo
  const steps = 96
  let b = a
  let fb = fa
  for (let i = 1; i <= steps; i++) {
    b = lo + ((hi - lo) * i) / steps
    fb = f(b) - d
    if (fb >= 0) break
    a = b
    fa = fb
  }
  if (fb < 0) return NaN
  for (let i = 0; i < 60; i++) {
    const m = 0.5 * (a + b)
    const fm = f(m) - d
    if (fm >= 0) b = m
    else a = m
  }
  return 0.5 * (a + b)
}

// ---------------------------------------------------------------------------
// Standard sensitometric numbers
// ---------------------------------------------------------------------------

/**
 * ISO 6846 paper exposure range R: 100 x (log H at 0.9 x net Dmax - log H at
 * 0.04 above base+fog). Grade 0 ≈ 160, grade 2 ≈ 110, grade 5 ≈ 50.
 * `f` maps log H to *observed* net density.
 */
export function isoRange(f: (x: number) => number, dmaxNet: number): number {
  const lo = logHAtDensity(f, 0.04)
  const hi = logHAtDensity(f, 0.9 * dmaxNet)
  return 100 * (hi - lo)
}

/** ISO 6846 paper speed: ISO P = 1000 / H(0.6 net). */
export function isoPaperSpeed(f: (x: number) => number): number {
  return 1000 / Math.pow(10, logHAtDensity(f, 0.6))
}

/**
 * ISO 6 film speed: S = 0.8 / Hm, Hm at 0.10 above base+fog. Valid when the
 * density rise over the next 1.3 log H is 0.80 (contrast index ≈ 0.62); the
 * returned `deltaD` tells you how close the development is to that condition.
 */
export function isoFilmSpeed(f: (x: number) => number): { speed: number; logHm: number; deltaD: number } {
  const logHm = logHAtDensity(f, 0.1)
  return { speed: 0.8 / Math.pow(10, logHm), logHm, deltaD: f(logHm + 1.3) - 0.1 }
}

/**
 * Kodak-style contrast index: slope of the line joining the point at 0.2 above
 * base+fog and the point 2.0 log H further along (a fair stand-in for the
 * official arc construction, close enough for games).
 */
export function contrastIndex(f: (x: number) => number): number {
  const a = logHAtDensity(f, 0.2)
  return (f(a + 2.0) - 0.2) / 2.0
}

/**
 * Average gradient between two densities (G-bar). For paper the useful
 * number is between 0.04 and 0.9 Dmax, which is just the inverse of R.
 */
export function averageGradient(f: (x: number) => number, d1: number, d2: number): number {
  return (d2 - d1) / (logHAtDensity(f, d2) - logHAtDensity(f, d1))
}
