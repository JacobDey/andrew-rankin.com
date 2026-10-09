// Calibration: solves the VC dichroic filter table and the graded-paper gammas
// against ISO targets, and prints tables to paste into core/paper.ts.
//   node spikes/photochem/tools/calibrate.ts
import { dichroicFilter } from '../core/bands.ts'
import { type Curve } from '../core/curve.ts'
import { paper, paperMetrics, VC_GRADES, VC_ISO_R_TARGET, gradeLabel, GRADED_ISO_P, makePaper, PAPERS, printCurve } from '../core/paper.ts'
import { isoRange, logHAtDensity } from '../core/curve.ts'

const m = paper('vcGlossy')
const metric = (y: number, mm: number) => paperMetrics(m, dichroicFilter(y, mm))

function bisect(f: (x: number) => number, lo: number, hi: number, it = 50): number {
  let flo = f(lo)
  for (let i = 0; i < it; i++) {
    const mid = 0.5 * (lo + hi)
    const fm = f(mid)
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm } else hi = mid
  }
  return 0.5 * (lo + hi)
}

/** For fixed M, Y that gives speed logH06 = x (or -1 if even Y=0 is too slow). */
function yForSpeed(mm: number, x: number): number {
  if (metric(0, mm).logH06 > x) return -1
  if (metric(400, mm).logH06 < x) return 400
  return bisect((y) => metric(y, mm).logH06 - x, 0, 400, 40)
}

const ISO_A = 500, ISO_B = 250
const xA = Math.log10(1000 / ISO_A), xB = Math.log10(1000 / ISO_B)
const rows: string[] = []
for (let i = 0; i < VC_GRADES.length; i++) {
  const g = VC_GRADES[i], R = VC_ISO_R_TARGET[i]
  const x = g >= 4 ? xB : xA
  // Feasible M range: Y(M) >= 0.
  let mMax = 0
  for (let mm = 0; mm <= 400; mm += 5) { if (yForSpeed(mm, x) >= 0) mMax = mm; else break }
  const rAt = (mm: number) => { const y = yForSpeed(mm, x); return y < 0 ? 0 : metric(y, mm).isoR }
  let mSol: number
  if (rAt(0) <= R) mSol = 0
  else if (rAt(mMax) >= R) mSol = mMax
  else mSol = bisect((mm) => rAt(mm) - R, 0, mMax, 30)
  const ySol = Math.max(0, yForSpeed(mSol, x))
  const r = metric(ySol, mSol)
  rows.push(`  { grade: ${g}, y: ${ySol.toFixed(1)}, m: ${mSol.toFixed(1)} }, // R ${r.isoR.toFixed(1)} (target ${R}), ISO P ${r.isoP.toFixed(0)}`)
}
console.log('VC_FILTER_TABLE (speed targets ISO P', ISO_A, '/', ISO_B, ')')
console.log(rows.join('\n'))
const none = metric(0, 0)
console.log('unfiltered:', none.isoR.toFixed(1), 'ISO P', none.isoP.toFixed(0))

// Graded paper: solve gamma per grade for R targets.
const R_GRADED = [160, 130, 110, 90, 70, 50]
const gam: string[] = []
for (let g = 0; g <= 5; g++) {
  const solve = (gamma: number) => {
    const p = makePaper({ ...PAPERS.bromide, grade: g })
    const c: Curve = { ...p.hard.curve, gamma }
    const pm = { ...p, hard: { ...p.hard, curve: c } }
    const f = printCurve(pm)
    return isoRange(f, f(8))
  }
  const gm = bisect((gm) => solve(gm) - R_GRADED[g], 0.8, 12, 40)
  gam.push(gm.toFixed(3))
}
console.log('GRADED_GAMMA', '[' + gam.join(', ') + ']', 'ISO P', GRADED_ISO_P.join(','))
void logHAtDensity
void gradeLabel
