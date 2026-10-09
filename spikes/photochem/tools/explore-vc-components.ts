// Explores VC emulsion component shapes (2 or 3 components): extremes, solved filters per grade, and the
// "dog-leg" ratio (max slope at D 1.2-2.0 over slope at D 0.8). Used to choose VC_SOFT/HARD_CURVE.
//   node spikes/photochem/tools/explore-vc-components.ts '[{"s":[...5 bands],"g":1.32,"x0":-0.34,"t":0.2,"sh":0.22}, {...}]'
import { type Bands, dichroicFilter, lightBands, makeSpectral, actinic } from '../core/bands.ts'
import { type Curve, curveDensityH, logHAtDensity, isoRange, softmin } from '../core/curve.ts'
import { observedNet, SURFACE_FLOOR } from '../core/paper.ts'
const L = lightBands('enlarger', 1)
const surf = SURFACE_FLOOR.glossy
type Comp = { sens: Bands; curve: Curve }
function family(comps: Comp[]) {
  const sp = comps.map((c) => makeSpectral(c.sens))
  const f = (y: number, m: number) => {
    const F = dichroicFilter(y, m)
    const g = sp.map((s) => actinic(s, L, F))
    return (x: number) => { const H = 10 ** x; let d = 0; comps.forEach((c, i) => (d += curveDensityH(c.curve, H * g[i]))); return observedNet(surf, softmin(d, 2.9, 0.12)) }
  }
  return f
}
function metrics(fx: (x: number) => number) { return { R: isoRange(fx, fx(8)), x06: logHAtDensity(fx, 0.6) } }
function kink(fx: (x: number) => number) {
  const x08 = logHAtDensity(fx, 0.8), g08 = (fx(x08 + 0.01) - fx(x08 - 0.01)) / 0.02
  let gmax = 0; const x1 = logHAtDensity(fx, 1.2), x2 = logHAtDensity(fx, 2.0)
  for (let x = x1; x < x2; x += 0.01) gmax = Math.max(gmax, (fx(x + 0.01) - fx(x - 0.01)) / 0.02)
  return gmax / g08
}
function bisect(f: (x: number) => number, lo: number, hi: number, it = 34) { let flo = f(lo); for (let i = 0; i < it; i++) { const m = (lo + hi) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm } else hi = m } return (lo + hi) / 2 }
const cfg = JSON.parse((globalThis as any).process.argv[2])
const comps: Comp[] = cfg.map((c: any) => ({ sens: c.s, curve: { gamma: c.g, logH0: c.x0, toe: c.t, dmax: 2.9, shoulder: c.sh } }))
const fam = family(comps)
const ex = (y: number, m: number) => metrics(fam(y, m))
console.log('soft-only', ex(300, 0).R.toFixed(0), 'hard-only', ex(0, 300).R.toFixed(0), 'open', ex(0, 0).R.toFixed(0), 'x06 soft', ex(300, 0).x06.toFixed(2), 'x06 hard', ex(0, 300).x06.toFixed(2))
const ySpeed = (m: number, x: number) => { if (ex(0, m).x06 > x) return -1; if (ex(400, m).x06 < x) return 400; return bisect((y) => ex(y, m).x06 - x, 0, 400, 26) }
const xA = Math.max(ex(300, 0).x06, ex(0, 50).x06) + 0.02
const xB = Math.max(xA + 0.301, ex(0, 300).x06 + 0.02)
const out: string[] = []
for (const [g, R] of [[-1, 180], [0, 160], [1, 130], [2, 110], [3, 90], [3.5, 80], [4, 70], [5, 50]]) {
  const x = g >= 4 ? xB : xA
  let mMax = 0; for (let mm = 0; mm <= 400; mm += 10) { if (ySpeed(mm, x) >= 0) mMax = mm; else break }
  const rAt = (mm: number) => { const y = ySpeed(mm, x); return y < 0 ? 0 : ex(y, mm).R }
  const mm = rAt(0) <= R ? 0 : rAt(mMax) >= R ? mMax : bisect((q) => rAt(q) - R, 0, mMax, 20)
  const y = Math.max(0, ySpeed(mm, x))
  const fx = fam(y, mm)
  out.push(`g${g} Y${y.toFixed(0)} M${mm.toFixed(0)} R${metrics(fx).R.toFixed(0)} k${kink(fx).toFixed(2)}`)
}
console.log(out.join(' | '))
