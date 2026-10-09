#!/usr/bin/env node
// A/B the first-use cost (compile + link + first draw) of recipes under different toolkit
// versions, interleaved in ONE browser session so machine noise hits every variant equally.
//
//   node spikes/materials/tools/compile-ab.mjs --gpu --dist <dir> --ids rusty-mailbox,cracked-mud \
//        --variant base=path/to/toolkitA.ts --variant new=path/to/toolkitB.ts --reps 3
//
// A variant file is any .ts file containing `TOOLKIT_GLSL = /* glsl */ \`...\``. Omit --variant to
// probe the current toolkit only. Prints median totalMs and ANGLE-translated source size per cell.

import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const argv = process.argv.slice(2)
const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const all = (n) => argv.flatMap((a, i) => (a === `--${n}` ? [argv[i + 1]] : []))
const gpu = argv.includes('--gpu')
const dist = val('dist', '')
const reps = Number(val('reps', 3))
const size = Number(val('size', 256))
const variants = all('variant').map((v) => {
  const [name, file] = v.split('=')
  const src = readFileSync(file, 'utf8')
  const m = src.match(/TOOLKIT_GLSL = \/\* glsl \*\/ `([\s\S]*?)`;?\s*$/m) || src.match(/TOOLKIT_GLSL = \/\* glsl \*\/ `([\s\S]*?)`/)
  if (!m) throw new Error(`no TOOLKIT_GLSL in ${file}`)
  return { name, toolkit: m[1] }
})
// --recipe name=path/to/file.ts:EXPORT_NAME  probes a single-pass recipe string exported from a
// file in place of the registered recipe (e.g. RUSTY_MAILBOX_SINGLE vs the split RUSTY_MAILBOX)
for (const v of all('recipe')) {
  const [name, rest] = v.split('=')
  const [file, exp] = rest.split(/:(?=[A-Z_]+$)/)
  const src = readFileSync(file, 'utf8')
  const m = src.match(new RegExp(`export const ${exp} = /\\* glsl \\*/ \`([\\s\\S]*?)\``))
  if (!m) throw new Error(`no ${exp} in ${file}`)
  variants.push({ name, toolkit: null, recipe: m[1] })
}
if (!variants.length || all('recipe').length) variants.unshift({ name: 'current', toolkit: null })

const browser = await chromium.launch({ args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
if (dist) {
  await page.route('http://materials.test/**', (route) => {
    const u = new URL(route.request().url())
    const file = resolve(dist, '.' + decodeURIComponent(u.pathname))
    return existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: '' })
  })
}
await page.goto(dist ? 'http://materials.test/index.html?gallery=0' : 'http://127.0.0.1:5173/spikes/materials/?gallery=0', { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__spike, null, { timeout: 90000 })
const renderer = await page.evaluate(() => window.__spike.caps.renderer)
const ids = val('ids', '') ? val('ids').split(',') : await page.evaluate(() => window.__spike.catalog)
// warm up the device and the compiler
await page.evaluate(() => window.__spike.compileProbe(window.__spike.surfaceSource('sandpaper') + '\n// warm'))

// --synthetic 8,16,32,64: recipes made of N gradient-noise calls (plus 1/8 as many Voronoi), to
// measure how first-use cost scales with recipe size
const synth = val('synthetic', '')
if (synth) {
  const rows = []
  for (const n of synth.split(',').map(Number)) {
    const NL = String.fromCharCode(10)
    const kind = val('kind', 'mix') // mix | gnoise | fbm | worley | voronoi
    let body = 'Surface surface(vec2 uv) {' + NL + '  float h = 0.0;' + NL
    const call = (k) => kind === 'fbm' ? `fbmT(uv + ${(k * 0.137).toFixed(3)}, ${4 + (k % 7)}.0, 4, 0.5, ${k + 1}u)`
      : kind === 'worley' ? `worleyT(uv + ${(k * 0.137).toFixed(3)}, ${4 + (k % 7)}.0, ${k + 1}u, 1.0).x`
      : kind === 'voronoi' ? `voronoiT(uv + ${(k * 0.137).toFixed(3)}, ${4 + (k % 7)}.0, ${k + 1}u, 1.0).edge`
      : `gnoiseT(uv + ${(k * 0.137).toFixed(3)}, ${4 + (k % 7)}.0, ${k + 1}u)`
    for (let k = 0; k < n; k++) body += `  h += ${call(k)};` + NL
    if (kind === 'mix') for (let k = 0; k < Math.floor(n / 8); k++) body += `  h += voronoiT(uv, ${3 + k}.0, ${100 + k}u, 1.0).edge;` + NL
    body += '  return surf(h, vec3(h), 0.5, 0.0);' + NL + '}' + NL
    const ms = []
    for (let r = 0; r < reps; r++) {
      const res = await page.evaluate(([b, tag, size]) => window.__spike.compileProbe(window.__spike.surfaceSource('sandpaper', undefined, b) + String.fromCharCode(10) + '// ' + tag, size), [body, `syn-${n}-${r}-${Math.random()}`, size])
      ms.push(res.totalMs)
    }
    rows.push({ n, voronoi: Math.floor(n / 8), ms })
    console.log(`synthetic ${String(n).padStart(4)} gnoise + ${Math.floor(n / 8)} voronoi: median ${[...ms].sort((x, y) => x - y)[ms.length >> 1]} ms  (${ms.join(',')})`)
  }
  await browser.close()
  process.exit(0)
}

const rows = {}
for (let r = 0; r < reps; r++) {
  for (const id of ids) {
    for (const v of variants) {
      const res = await page.evaluate(([id, tk, rc, tag, size]) => {
        const srcs = window.__spike.passSources(id, tk ?? undefined, rc ?? undefined).map((p) => p + String.fromCharCode(10) + '// ' + tag)
        return window.__spike.compileProbe(srcs, size)
      }, [id, v.toolkit, v.recipe ?? null, `${v.name}-${r}-${Math.random()}`, size])
      if (!res.ok) console.log(`${id}/${v.name} FAILED: ${res.log}`)
      const key = `${id}|${v.name}`
      ;(rows[key] ||= { id, variant: v.name, ms: [], translated: res.translatedChars, frag: res.fragChars }).ms.push(res.totalMs)
    }
  }
}
await browser.close()
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1]
console.log(renderer)
console.log('id'.padEnd(20), 'variant'.padEnd(10), 'median ms'.padStart(10), 'all ms'.padStart(22), 'translated chars'.padStart(17))
for (const r of Object.values(rows)) console.log(r.id.padEnd(20), r.variant.padEnd(10), String(med(r.ms)).padStart(10), r.ms.join(',').padStart(22), String(r.translated).padStart(17))
