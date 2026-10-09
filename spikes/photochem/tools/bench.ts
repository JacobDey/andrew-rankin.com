// Micro-benchmark of the SilverSheet hot loops in Node:  node spikes/photochem/tools/bench.ts
import { lightBands, makeDeveloper, paper, SilverSheet, vcGradeFilter } from '../core/index.ts'
const w = 320, h = 256
const s = new SilverSheet(paper('vcPearl'), w, h)
const mask = new Float32Array(w * h).map((_, i) => 10 ** -(0.3 + 1.5 * ((i % w) / w)))
let t = performance.now()
s.expose(lightBands('enlarger'), 14, { mask, filter: vcGradeFilter(2) })
console.log('expose', (performance.now() - t).toFixed(1), 'ms')
const dev = makeDeveloper()
t = performance.now(); s.recompute(); console.log('recompute', (performance.now() - t).toFixed(1), 'ms')
for (let k = 0; k < 3; k++) {
  t = performance.now()
  for (let i = 0; i < 10; i++) s.process(dev, 0.5)
  const ms = (performance.now() - t) / 10
  console.log('develop step', ms.toFixed(2), 'ms =', (ms * 1e6 / (w * h)).toFixed(0), 'ns/px')
}
const out = new Uint8ClampedArray(w * h * 4)
t = performance.now(); for (let i = 0; i < 5; i++) s.render(out); console.log('render', ((performance.now() - t) / 5).toFixed(1), 'ms')
