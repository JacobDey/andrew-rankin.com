// Node runner:  node src/shared/photochem/dev/run-selftest.ts   (Node 22.18+ type stripping)
import { bench, selftest } from '../index.ts'

declare const process: { argv: string[]; exitCode?: number }

const t0 = performance.now()
const res = selftest()
const ms = performance.now() - t0
let fail = 0
for (const r of res) {
  if (!r.pass) fail++
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.group.padEnd(14)} ${r.name.padEnd(56)} ${r.value.padStart(12)}   (${r.expect})`)
}
console.log(`\n${res.length - fail}/${res.length} passed in ${ms.toFixed(0)} ms`)
if (process.argv.includes('--bench')) console.log(JSON.stringify(bench(), null, 1))
if (fail) process.exitCode = 1
