#!/usr/bin/env node
// Capture posters (public/posters/<slug>.jpg) and OG cards (public/og/*.jpg) from the dev server.
//   node scripts/posters.mjs [slug ...] [--base URL] [--no-og]
// Same GL flags and 2-slot lock as scripts/shoot.mjs. A game without a working poster
// mode (no window.__game after load) keeps its existing stand-in.
import { chromium } from 'playwright'
import { mkdirSync, existsSync, writeFileSync, unlinkSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const SLUGS = ['texturedle', 'darkroom', 'plates', 'latent', 'lensbench', 'studio']
const args = process.argv.slice(2)
let base = process.env.SHOOT_BASE || 'http://127.0.0.1:5173'
let doOg = true
const picked = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base') base = args[++i]
  else if (args[i] === '--no-og') doOg = false
  else picked.push(args[i])
}
const slugs = picked.length ? picked : SLUGS
base = base.replace(/\/$/, '')

const SLOTS = Number(process.env.SHOOT_SLOTS || 2)
const lockDir = resolve('shots/.locks')
mkdirSync(lockDir, { recursive: true })
let lockFile = null
while (!lockFile) {
  for (let i = 0; i < SLOTS && !lockFile; i++) {
    const f = resolve(lockDir, `slot-${i}`)
    try {
      if (existsSync(f) && Date.now() - statSync(f).mtimeMs > 600000) unlinkSync(f)
      writeFileSync(f, String(process.pid), { flag: 'wx' })
      lockFile = f
    } catch {}
  }
  if (!lockFile) await new Promise((r) => setTimeout(r, 750))
}
const release = () => { try { unlinkSync(lockFile) } catch {} }
process.on('exit', release)
process.on('SIGINT', () => process.exit(130))

mkdirSync('public/posters', { recursive: true })
mkdirSync('public/og', { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

async function open(path, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await page.goto(base + path, { waitUntil: 'load', timeout: 45000 })
  return { ctx, page, errs }
}
const raf2 = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

async function poster(slug) {
  const { ctx, page, errs } = await open(`/games/${slug}/?embed=poster&test=1&motion=reduce`, 1200, 800)
  try {
    const has = await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 }).then(() => true, () => false)
    if (!has) return console.log(`${slug}: no window.__game, keeping stand-in`)
    const ok = await page.waitForFunction(() => window.__game.posterReady === true, null, { timeout: 10000 }).then(() => true, () => false)
    if (!ok) console.log(`${slug}: posterReady not set in 10s, capturing anyway`)
    await page.evaluate(() => window.__game.poster?.()).catch(() => {})
    await raf2(page); await raf2(page)
    const stage = page.locator('#stage')
    const target = (await stage.count()) ? stage.first() : page
    let q = 84, buf
    for (; q >= 60; q -= 6) {
      buf = await target.screenshot({ type: 'jpeg', quality: q })
      if (buf.length <= 140 * 1024) break
    }
    writeFileSync(`public/posters/${slug}.jpg`, buf)
    console.log(`${slug}: poster q${q} ${(buf.length / 1024).toFixed(0)}KB${errs.length ? ' errors: ' + errs[0] : ''}`)
  } catch (e) {
    console.log(`${slug}: FAILED ${e.message.split('\n')[0]}`)
  } finally { await ctx.close() }
}

async function og(name) {
  const { ctx, page } = await open(`/?og=${name}`, 1200, 630)
  try {
    await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 30000 }).catch(() => console.log(`og ${name}: ready timeout`))
    await raf2(page)
    const buf = await page.screenshot({ type: 'jpeg', quality: 86 })
    writeFileSync(`public/og/${name}.jpg`, buf)
    console.log(`og ${name}: ${(buf.length / 1024).toFixed(0)}KB`)
  } catch (e) { console.log(`og ${name}: FAILED ${e.message.split('\n')[0]}`) } finally { await ctx.close() }
}

for (const s of slugs) await poster(s)
if (doOg) { for (const s of slugs) await og(s); await og('hub') }
await browser.close()
