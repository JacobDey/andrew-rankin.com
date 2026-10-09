#!/usr/bin/env node
// Headless screenshot + smoke harness for every page in this repo.
//
//   node scripts/shoot.mjs /games/darkroom/ --out shots/darkroom.png
//   node scripts/shoot.mjs /games/darkroom/ --mobile --steps '[{"tap":[200,400]},{"wait":500},{"shot":"shots/after.png"}]'
//   node scripts/shoot.mjs /games/darkroom/ --eval "window.__game.state()"
//
// Options
//   --base URL        dev server origin (default http://127.0.0.1:5173, or $SHOOT_BASE)
//   --out FILE        final screenshot path (default shots/<page>.png)
//   --wait MS         wait after load before steps (default 2500)
//   --size WxH        viewport (default 1280x800)
//   --mobile          390x844 touch viewport with a phone user agent
//   --steps JSON|FILE array of actions, run in order (see below)
//   --eval JS         expression evaluated at the end; result printed as JSON
//   --full            full-page screenshot
//   --timeout MS      overall timeout (default 90000)
//   --gpu             try hardware GL instead of SwiftShader
//
// Step actions (coordinates are CSS pixels in the viewport):
//   {"click":[x,y]}  {"dblclick":[x,y]}  {"tap":[x,y]}  {"move":[x,y]}
//   {"down":[x,y]}   {"up":[x,y]}        {"drag":[[x1,y1],[x2,y2]], "steps":20, "ms":400}
//   {"wheel":[dx,dy], "at":[x,y]}        {"key":"Space"}  {"hold":"KeyW","ms":800}
//   {"type":"text"}  {"wait":ms}         {"eval":"js expr"}  {"shot":"file.png"}
//   {"clickText":"Develop"}              {"waitFor":"css selector"}
//   {"upload":"path/to/file.png", "selector":"input[type=file]"}
//
// Exit code 1 when the page threw an uncaught error or failed to load.

import { chromium } from 'playwright'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const argv = process.argv.slice(2)
const opt = { base: process.env.SHOOT_BASE || 'http://127.0.0.1:5173', wait: 2500, size: '1280x800', timeout: 90000 }
let target = '/'
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  const next = () => argv[++i]
  if (a === '--base') opt.base = next()
  else if (a === '--out') opt.out = next()
  else if (a === '--wait') opt.wait = Number(next())
  else if (a === '--size') opt.size = next()
  else if (a === '--mobile') opt.mobile = true
  else if (a === '--steps') opt.steps = next()
  else if (a === '--eval') opt.eval = next()
  else if (a === '--full') opt.full = true
  else if (a === '--timeout') opt.timeout = Number(next())
  else if (a === '--gpu') opt.gpu = true
  else if (!a.startsWith('--')) target = a
}

// Git Bash (MSYS) rewrites a leading "/" into the Git install path; undo that.
const msys = target.match(/^[A-Za-z]:[\\/].*?Git[\\/]?(.*)$/)
if (msys) target = '/' + msys[1].replace(/\\/g, '/')
const url = /^https?:/.test(target) ? target : opt.base.replace(/\/$/, '') + (target.startsWith('/') ? target : '/' + target)
const slug = (target.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'hub') + (opt.mobile ? '-mobile' : '')
const out = opt.out || `shots/${slug}.png`

let steps = []
if (opt.steps) {
  const raw = existsSync(opt.steps) ? readFileSync(opt.steps, 'utf8') : opt.steps
  steps = JSON.parse(raw)
}

const glArgs = opt.gpu
  ? ['--ignore-gpu-blocklist', '--enable-gpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

const log = { console: [], pageErrors: [], failedRequests: [], evals: [] }
const killer = setTimeout(() => {
  console.error(`TIMEOUT after ${opt.timeout}ms`)
  process.exit(2)
}, opt.timeout)

const browser = await chromium.launch({ args: [...glArgs, '--autoplay-policy=no-user-gesture-required'] })
const [w, h] = opt.mobile ? [390, 844] : opt.size.split('x').map(Number)
const context = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: 1,
  hasTouch: !!opt.mobile,
  isMobile: !!opt.mobile,
  userAgent: opt.mobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : undefined,
})
const page = await context.newPage()
page.on('console', (m) => {
  const t = m.type()
  if (t === 'error' || t === 'warning' || t === 'log' || t === 'info') log.console.push(`[${t}] ${m.text()}`.slice(0, 600))
})
page.on('pageerror', (e) => log.pageErrors.push(String(e && e.stack ? e.stack : e).slice(0, 1500)))
page.on('requestfailed', (r) => log.failedRequests.push(`${r.failure()?.errorText} ${r.url()}`))
page.on('response', (r) => { if (r.status() >= 400) log.failedRequests.push(`${r.status()} ${r.url()}`) })

const save = async (file, full = false) => {
  mkdirSync(dirname(resolve(file)), { recursive: true })
  await page.screenshot({ path: file, fullPage: full })
  console.log(`shot: ${file}`)
}

let loadOk = true
try {
  await page.goto(url, { waitUntil: 'load', timeout: 45000 })
} catch (e) {
  loadOk = false
  log.pageErrors.push('NAVIGATION FAILED: ' + e.message)
}

if (loadOk) {
  await page.waitForTimeout(opt.wait)
  const mouse = page.mouse
  for (const s of steps) {
    try {
      if (s.click) await mouse.click(s.click[0], s.click[1])
      else if (s.dblclick) await mouse.dblclick(s.dblclick[0], s.dblclick[1])
      else if (s.tap) await page.touchscreen.tap(s.tap[0], s.tap[1])
      else if (s.move) await mouse.move(s.move[0], s.move[1], { steps: s.steps || 5 })
      else if (s.down) { await mouse.move(s.down[0], s.down[1]); await mouse.down() }
      else if (s.up) { await mouse.move(s.up[0], s.up[1]); await mouse.up() }
      else if (s.drag) {
        const [[x1, y1], [x2, y2]] = s.drag
        const n = s.steps || 20
        await mouse.move(x1, y1)
        await mouse.down()
        for (let i = 1; i <= n; i++) {
          await mouse.move(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n)
          if (s.ms) await page.waitForTimeout(s.ms / n)
        }
        await mouse.up()
      } else if (s.wheel) {
        if (s.at) await mouse.move(s.at[0], s.at[1])
        await mouse.wheel(s.wheel[0], s.wheel[1])
      } else if (s.key) await page.keyboard.press(s.key)
      else if (s.hold) { await page.keyboard.down(s.hold); await page.waitForTimeout(s.ms || 500); await page.keyboard.up(s.hold) }
      else if (s.type) await page.keyboard.type(s.type)
      else if (s.wait) await page.waitForTimeout(s.wait)
      else if (s.eval) {
        const r = await page.evaluate(s.eval)
        log.evals.push({ expr: s.eval, result: r })
      } else if (s.shot) await save(s.shot, s.full)
      else if (s.clickText) await page.getByText(s.clickText, { exact: false }).first().click({ timeout: 5000 })
      else if (s.waitFor) await page.waitForSelector(s.waitFor, { timeout: s.ms || 10000 })
      else if (s.upload) await page.setInputFiles(s.selector || 'input[type=file]', s.upload)
    } catch (e) {
      log.pageErrors.push(`STEP FAILED ${JSON.stringify(s)}: ${e.message.split('\n')[0]}`)
    }
  }
  if (opt.eval) {
    try {
      const r = await page.evaluate(opt.eval)
      log.evals.push({ expr: opt.eval, result: r })
    } catch (e) {
      log.pageErrors.push('EVAL FAILED: ' + e.message.split('\n')[0])
    }
  }
  await save(out, !!opt.full)
}

clearTimeout(killer)
await browser.close()

const show = (title, arr) => { if (arr.length) console.log(`\n${title} (${arr.length}):\n  ` + arr.slice(0, 40).join('\n  ')) }
console.log(`url: ${url}  viewport: ${w}x${h}${opt.mobile ? ' (mobile/touch)' : ''}`)
show('console', log.console)
show('page errors', log.pageErrors)
show('failed requests', log.failedRequests)
for (const e of log.evals) console.log(`\neval ${e.expr}\n  => ${JSON.stringify(e.result, null, 0)?.slice(0, 4000)}`)
process.exit(log.pageErrors.some((e) => !e.startsWith('STEP FAILED')) ? 1 : 0)
