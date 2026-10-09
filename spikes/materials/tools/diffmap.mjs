#!/usr/bin/env node
// Where do two devices disagree? Bakes one material on SwiftShader and on the hardware GPU and
// prints an ASCII heat map of albedo differences (and which channel/feature they follow).
//
//   node spikes/materials/tools/diffmap.mjs galvanized-steel --dist <dir> [--size 128] [--seed 7]

import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const id = argv[0]
const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const dist = val('dist', '')
const size = Number(val('size', 128)), seed = Number(val('seed', 7))

async function bake(gpu) {
  const browser = await chromium.launch({ args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  try {
    const page = await browser.newPage()
    if (dist) await page.route('http://materials.test/**', (r) => { const f = resolve(dist, '.' + new URL(r.request().url()).pathname); return existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' }) })
    await page.goto(dist ? 'http://materials.test/index.html?gallery=0' : 'http://127.0.0.1:5173/spikes/materials/?gallery=0')
    await page.waitForFunction(() => !!window.__spike, null, { timeout: 90000 })
    // --recipe-file f.glsl: bake a diagnostic recipe registered under id (metadata from --base)
    const rf = val('recipe-file', '')
    if (rf) await page.evaluate(([b, id, src]) => window.__spike.registerTest(b, id, src), [val('base', 'galvanized-steel'), id, readFileSync(rf, 'utf8')])
    const d = await page.evaluate(([id, size, seed]) => window.__spike.fingerprintData({ ids: [id], size, seed }), [id, size, seed])
    return { a: Uint8Array.from(Buffer.from(d[id].a, 'base64')), h: new Int16Array(Uint8Array.from(Buffer.from(d[id].h, 'base64')).buffer) }
  } finally { await browser.close() }
}
const sw = await bake(false), hw = await bake(true)
const B = 8, n = size / B
const ramp = ' .:-=+*#%@'
let out = ''
for (let by = n - 1; by >= 0; by--) {
  let line = ''
  for (let bx = 0; bx < n; bx++) {
    let m = 0
    for (let y = by * B; y < (by + 1) * B; y++) for (let x = bx * B; x < (bx + 1) * B; x++) {
      const i = (y * size + x) * 4
      for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(sw.a[i + c] - hw.a[i + c]))
    }
    line += ramp[Math.min(ramp.length - 1, m)]
  }
  out += line + '\n'
}
let over1 = 0, maxA = 0
for (let i = 0; i < sw.a.length; i++) { if (i % 4 === 3) continue; const d = Math.abs(sw.a[i] - hw.a[i]); maxA = Math.max(maxA, d); if (d > 1) over1++ }
for (let c = 0; c < 3; c++) { let m = 0, k = 0; for (let i = c; i < sw.a.length; i += 4) { const d = Math.abs(sw.a[i] - hw.a[i]); m = Math.max(m, d); if (d > 1) k++ } console.log(`  channel ${'RGB'[c]}: max diff ${m}, ${k} texels > 1`) }
if (argv.includes('--samples')) {
  let shown = 0
  for (let i = 0; i < sw.a.length && shown < 14; i += 4) {
    if (Math.abs(sw.a[i + 1] - hw.a[i + 1]) > 20) { console.log(`  px ${i / 4}: swiftshader R,G = ${sw.a[i]},${sw.a[i + 1]}   gpu R,G = ${hw.a[i]},${hw.a[i + 1]}`); shown++ }
  }
}
console.log(`albedo: max diff ${maxA}, ${(100 * over1 / (sw.a.length * 0.75)).toFixed(2)}% of channel values differ by more than 1`)
let hd = 0
for (let i = 0; i < sw.h.length; i++) hd = Math.max(hd, Math.abs(sw.h[i] - hw.h[i]))
console.log(`${id}: max albedo diff per ${B}x${B} block (' '=0 '.'=1 ... '@'>=9), max height diff ${hd} um`)
console.log(out)
