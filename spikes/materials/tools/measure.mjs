#!/usr/bin/env node
// Measurement tool for the materials spike (the shared harness truncates eval output).
//
//   node spikes/materials/tools/measure.mjs bench --gpu --size 1024 --reps 3 --out shots/materials-bench-gpu-1024.json
//   node spikes/materials/tools/measure.mjs bench --size 512 --reps 1          (SwiftShader)
//   node spikes/materials/tools/measure.mjs seams --size 256
//   node spikes/materials/tools/measure.mjs determinism --size 64              (SwiftShader vs --gpu, per material)
//   node spikes/materials/tools/measure.mjs gallery --gpu                      (gallery build time)
//
// Respects the harness's browser-slot locks (shots/.locks, SHOOT_SLOTS).

import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, existsSync, statSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const argv = process.argv.slice(2)
const what = argv[0]
const flag = (n) => argv.includes(`--${n}`)
const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const base = process.env.SHOOT_BASE || 'http://127.0.0.1:5173'
const size = Number(val('size', what === 'determinism' ? 64 : 1024))
const reps = Number(val('reps', 2))
const ids = val('ids', '')
const out = val('out', `spikes/materials/results/${what}${flag('gpu') ? '-gpu' : ''}${flag('zoom') ? '-zoom' : ''}-${size}.json`)
const TIMEOUT = Number(val('timeout', 600000))
// --dist <dir>: serve a production build (tools/build.mjs) via request interception instead of the dev server
const dist = val('dist', '')
const pageUrl = (q) => dist ? `http://materials.test/index.html${q}` : `${base}/spikes/materials/${q}`
async function serveDist(page) {
  if (!dist) return
  await page.route('http://materials.test/**', (route) => {
    const u = new URL(route.request().url())
    const file = resolve(dist, '.' + decodeURIComponent(u.pathname))
    if (!file.startsWith(resolve(dist)) || !existsSync(file)) return route.fulfill({ status: 404, body: 'not found' })
    return route.fulfill({ path: file })
  })
}

async function withSlot(fn) {
  const SLOTS = Number(process.env.SHOOT_SLOTS || 3)
  const lockDir = resolve('shots/.locks')
  mkdirSync(lockDir, { recursive: true })
  let lock = null
  for (let t = 0; !lock; t++) {
    for (let i = 0; i < SLOTS && !lock; i++) {
      const f = resolve(lockDir, `slot-${i}`)
      try {
        if (existsSync(f) && Date.now() - statSync(f).mtimeMs > TIMEOUT + 15000) unlinkSync(f)
        writeFileSync(f, String(process.pid), { flag: 'wx' })
        lock = f
      } catch {}
    }
    if (!lock) { if (t % 20 === 0) console.log('waiting for a browser slot...'); await new Promise((r) => setTimeout(r, 750)) }
  }
  try { return await fn() } finally { try { unlinkSync(lock) } catch {} }
}

// Evaluates exprFor(id) once per material (short calls survive dev-server reloads: a call that
// is interrupted by a full page reload is retried). exprFor(null) = a single whole-run call.
async function run(gpu, exprFor, idList) {
  return withSlot(async () => {
    const args = gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    const browser = await chromium.launch({ args })
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      page.on('pageerror', (e) => console.error('pageerror', String(e).slice(0, 400)))
      await serveDist(page)
      await page.goto(pageUrl('?gallery=0'), { waitUntil: 'load' })
      // the shared dev server sometimes answers 504 "Outdated Optimize Dep" while it re-bundles
      // dependencies for another agent: reload until the page boots
      const ready = async () => {
        for (let k = 0; ; k++) {
          await page.waitForLoadState('load').catch(() => {})
          try { await page.waitForFunction(() => !!window.__spike, null, { timeout: 30000 }); return }
          catch (e) { if (k >= 8) throw e; console.log('page did not boot, reloading'); await page.reload({ waitUntil: 'load' }).catch(() => {}) }
        }
      }
      await ready()
      const caps = await page.evaluate(() => window.__spike.caps)
      if (!idList) idList = await page.evaluate(() => window.__spike.catalog)
      const t0 = Date.now()
      const result = {}
      for (const id of idList) {
        for (let attempt = 1; ; attempt++) {
          try {
            Object.assign(result, await page.evaluate(exprFor(id)))
            break
          } catch (e) {
            if (attempt >= 6 || !/context was destroyed|navigation|__spike/i.test(String(e))) throw e
            console.log(`page reloaded during ${id} (attempt ${attempt}), retrying`)
            await new Promise((r) => setTimeout(r, 1500))
            await ready()
          }
        }
      }
      return { renderer: caps.renderer, wallMs: Date.now() - t0, result }
    } finally { await browser.close() }
  })
}

const idList = ids ? ids.split(',') : null
const killer = setTimeout(() => { console.error('TIMEOUT'); process.exit(2) }, TIMEOUT)

const decode = (b64) => Uint8Array.from(Buffer.from(b64, 'base64'))
function compare(a, b) {
  const rows = {}
  for (const id of Object.keys(a)) {
    const ha = new Int16Array(decode(a[id].h).buffer), hb = new Int16Array(decode(b[id].h).buffer)
    const aa = decode(a[id].a), ab = decode(b[id].a)
    let hMax = 0, hSum = 0, hOver = 0
    for (let i = 0; i < ha.length; i++) {
      const d = Math.abs(ha[i] - hb[i])
      hMax = Math.max(hMax, d); hSum += d
      if (d > a[id].relief * 1000 * 0.01) hOver++ // > 1% of relief
    }
    let aMax = 0, aSum = 0, a1 = 0, a8 = 0, n = 0
    for (let i = 0; i < aa.length; i++) {
      if (i % 4 === 3) continue
      const d = Math.abs(aa[i] - ab[i])
      aMax = Math.max(aMax, d); aSum += d; n++
      if (d > 1) a1++
      if (d > 8) a8++
    }
    rows[id] = {
      heightMaxUm: hMax, heightMeanUm: +(hSum / ha.length).toFixed(3), heightPxOver1pctRelief: +(100 * hOver / ha.length).toFixed(2),
      albedoMax: aMax, albedoMean: +(aSum / n).toFixed(4), albedoPctOver1: +(100 * a1 / n).toFixed(2), albedoPctOver8: +(100 * a8 / n).toFixed(2),
    }
  }
  return rows
}

let report
if (what === 'bench') {
  report = await run(flag('gpu'), (id) => `__spike.bench({ids: ['${id}'], size: ${size}, reps: ${reps}, detail: '${val('detail', 'base')}'})`, idList)
} else if (what === 'seams') {
  report = await run(flag('gpu'), (id) => `__spike.seams({ids: ['${id}'], size: ${size}})`, idList)
} else if (what === 'view') {
  // macro-view frame cost at a given stage size (--w/--h CSS px), per shadow-step setting
  report = await withSlot(async () => {
    const args = flag('gpu') ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    const browser = await chromium.launch({ args })
    try {
      const page = await browser.newPage({ viewport: { width: Number(val('w', 1280)), height: Number(val('h', 800)) } })
      await serveDist(page)
      await page.goto(pageUrl(`?gallery=0&spin=0&bake=1024&open=${val('id', 'rusty-mailbox')}`), { waitUntil: 'load' })
      await page.waitForFunction(() => !!window.__spike, null, { timeout: 90000 })
      await page.evaluate(() => window.__spike.waitBaked())
      return { renderer: await page.evaluate(() => window.__spike.caps.renderer), result: await page.evaluate(() => window.__spike.viewBench(20)) }
    } finally { await browser.close() }
  })
  console.log(JSON.stringify(report))
} else if (what === 'periodicity') {
  report = await run(flag('gpu'), (id) => `__spike.periodicity({ids: ['${id}'], size: ${size}})`, idList)
} else if (what === 'fingerprint') {
  report = await run(flag('gpu'), (id) => `__spike.fingerprint({ids: ['${id}'], size: ${size}})`, idList)
} else if (what === 'determinism') {
  const expr = (id) => `__spike.fingerprintData({ids: ['${id}'], size: ${size}, seed: ${Number(val('seed', 7))}, zoom: ${flag('zoom')}})`
  const sw = await run(false, expr, idList)
  const hw = await run(true, expr, idList)
  const sw2 = flag('repeat') ? await run(false, expr, idList) : null
  report = { a: sw.renderer, b: hw.renderer, size, rows: compare(sw.result, hw.result), selfCheck: sw2 ? compare(sw.result, sw2.result) : undefined }
} else if (what === 'gallery') {
  report = await withSlot(async () => {
    const args = flag('gpu') ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    const browser = await chromium.launch({ args })
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      await serveDist(page)
      const t0 = Date.now()
      await page.goto(pageUrl(`?thumb=${size}`), { waitUntil: 'load' })
      await page.waitForSelector('body[data-ready="1"]', { timeout: TIMEOUT })
      return { wallMs: Date.now() - t0, timings: await page.evaluate(() => window.__spike.timings), renderer: await page.evaluate(() => window.__spike.caps.renderer) }
    } finally { await browser.close() }
  })
} else {
  console.error('usage: measure.mjs bench|seams|fingerprint|determinism|gallery [--gpu] [--size N] [--reps N] [--ids a,b] [--out f]')
  process.exit(1)
}
clearTimeout(killer)
mkdirSync(dirname(resolve(out)), { recursive: true })
writeFileSync(out, JSON.stringify(report, null, 1))
console.log(`wrote ${out}`)
if (what === 'determinism') {
  for (const [id, r] of Object.entries(report.rows)) console.log(id.padEnd(20), JSON.stringify(r))
} else if (what === 'bench') {
  const vals = Object.values(report.result).map((r) => r.bakeMs).sort((x, y) => x - y)
  console.log(report.renderer, `median ${vals[vals.length >> 1]} ms, max ${vals[vals.length - 1]} ms at ${size}^2`)
  for (const [id, r] of Object.entries(report.result)) console.log(id.padEnd(20), JSON.stringify(r))
}
process.exit(0)
