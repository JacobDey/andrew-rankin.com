import { runSelfTest } from '../selftest.ts'
const t0 = performance.now()
const res = runSelfTest()
const ms = performance.now() - t0
let fail = 0
for (const r of res) {
  if (!r.pass) fail++
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.group.padEnd(12)} ${r.name.padEnd(52)} ${r.value.padStart(12)}   (${r.expect})`)
}
console.log(`\n${res.length - fail}/${res.length} passed in ${ms.toFixed(0)} ms`)
if (fail) throw new Error(`${fail} checks failed`)
