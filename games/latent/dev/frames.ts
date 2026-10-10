// Dev harness: a contact sheet of every frame (positive), plus solve() for the legibility tuning.
import '@shared/ui/fonts'
import { installGameApi, markReady } from '@shared/core'
import { RECIPES, rollMeta, recipe, allDetails, ROLL7_DEV } from '../data/rolls'
import { createFrameStore } from '../frames/frameStore'
import { createNegative, makeDev } from '../film/filmModel'
import { naiveOps, simulatePrint, solveDetail, evaluateLegibility } from '../print/simulate'
import type { DevResult } from '../core/types'

const stage = document.getElementById('stage') as HTMLElement
const store = createFrameStore({ capacity: 200 })
const q = new URLSearchParams(location.search)
const rollSel = q.get('roll') ? Number(q.get('roll')) : 0

function devFor(roll: number): DevResult {
  if (roll === 7) return ROLL7_DEV
  if (roll === 8 || roll === 9) return makeDev({ tDev: 765, inversionsPerMin: 8, rapped: true })
  return makeDev({ tDev: 480, inversionsPerMin: 8, rapped: true })
}

async function sheet(): Promise<void> {
  const list = RECIPES.filter((r) => (rollSel ? r.roll === rollSel : true))
  for (const r of list) {
    const img = await store.get({ roll: r.roll, frame: r.frame })
    const m = img.mips[1]
    const c = document.createElement('canvas'); c.width = m.w; c.height = m.h
    const g = c.getContext('2d')!
    const id = g.createImageData(m.w, m.h)
    const ev = Math.pow(2, r.ev)
    for (let i = 0; i < m.L.length; i++) { const v = Math.round(255 * Math.min(1, Math.pow(m.L[i] * ev * 1.2, 1 / 2.2))); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255 }
    g.putImageData(id, 0, 0)
    for (const d of r.details) { g.strokeStyle = '#f33'; g.strokeRect(d.bbox[0] * m.w, d.bbox[1] * m.h, d.bbox[2] * m.w, d.bbox[3] * m.h) }
    const wrap = document.createElement('div'); wrap.className = 'c'
    wrap.append(c, document.createElement('br'), `R${r.roll}F${r.frame} ${r.template}`)
    stage.append(wrap)
  }
}

async function solve(): Promise<unknown[]> {
  const rows: unknown[] = []
  for (const { recipe: r, detail: d } of allDetails()) {
    const img = await store.get({ roll: r.roll, frame: r.frame })
    const neg = createNegative(img, devFor(r.roll), rollMeta(r.roll), r.ev)
    const sol = solveDetail(neg, img, d)
    const nOps = naiveOps()
    const nNeg = r.roll === 7 ? neg : createNegative(img, makeDev({ tDev: 480, inversionsPerMin: 8, rapped: true }), rollMeta(r.roll), r.ev)
    const D = simulatePrint(nNeg, nOps)
    const nv = evaluateLegibility(img, [d], nOps, D)[0]
    void neg
    rows.push({ d: d.id, f: `R${r.roll}F${r.frame}`, sol: [sol.result.pass, +sol.result.rho.toFixed(2), +sol.result.contrast.toFixed(3), sol.ops.grade, +sol.ops.seconds.toFixed(1), +sol.ops.M.toFixed(1)], naive: [nv.pass, +nv.rho.toFixed(2), +nv.contrast.toFixed(3), nv.why] })
  }
  return rows
}

installGameApi('latent:dev:frames', 'latent@dev', { state: () => ({ n: RECIPES.length }), solve, recipe })
void sheet().then(() => markReady())
