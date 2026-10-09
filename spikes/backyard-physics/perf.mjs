#!/usr/bin/env node
// Perf probe for the backyard spike (hardware GL, optional CPU throttling to mimic a phone).
//
//   node spikes/backyard-physics/perf.mjs [url] [--cpu 4] [--mobile] [--q medium] [--seconds 6] [--swiftshader]
//
// Default url: the production preview from build-check.mjs (http://127.0.0.1:4321/).
// Reports: GPU string, rAF frame intervals (avg / p95), CPU ms per frame, physics ms per step
// (Rapier profiler + hook timings), draw calls and triangles.
import { chromium } from 'playwright'

const argv = process.argv.slice(2)
const opt = { url: 'http://127.0.0.1:4321/', cpu: 1, mobile: false, q: '', seconds: 6, swiftshader: false }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--cpu') opt.cpu = Number(argv[++i])
  else if (a === '--mobile') opt.mobile = true
  else if (a === '--q') opt.q = argv[++i]
  else if (a === '--seconds') opt.seconds = Number(argv[++i])
  else if (a === '--swiftshader') opt.swiftshader = true
  else if (!a.startsWith('--')) opt.url = a
}
let url = opt.url
if (opt.q) url += (url.includes('?') ? '&' : '?') + 'q=' + opt.q

const args = opt.swiftshader
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--ignore-gpu-blocklist', '--enable-gpu']
const browser = await chromium.launch({ args })
const context = await browser.newContext({
  viewport: opt.mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  deviceScaleFactor: opt.mobile ? 3 : 1,
  hasTouch: opt.mobile,
  isMobile: opt.mobile,
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
if (opt.cpu > 1) {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: opt.cpu })
}
await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => window.__spike && window.__spike.ready, null, { timeout: 120000 })
await page.waitForTimeout(2500)
const result = await page.evaluate(async (seconds) => {
  const S = window.__spike
  const gl = S.renderer.getContext()
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  // Worst-ish case: the whole domino run cascading, the tower hit, the swing going.
  const stir = () => {
    S.setWater(1)
    S.knockDomino(0)
    S.pushSwing(0, 0, -20)
    S.teleport(-2.6, 0, -3.6, 0.05, -0.15)
    S.throwBall(11, 2)
  }
  S.pw.paused = true
  const snap = S.pw.snapshot()
  stir()
  const active = S.profile(180)
  const activeAwake = S.state().awake
  S.pw.restore(snap)
  S.pw.paused = false
  stir()
  const dts = []
  let last = performance.now()
  await new Promise((resolve) => {
    const t0 = last
    const tick = (t) => {
      dts.push(t - last)
      last = t
      if (t - t0 < seconds * 1000) requestAnimationFrame(tick)
      else resolve(null)
    }
    requestAnimationFrame(tick)
  })
  dts.shift()
  dts.sort((a, b) => a - b)
  const avg = dts.reduce((a, b) => a + b, 0) / dts.length
  const p95 = dts[Math.floor(dts.length * 0.95)]
  const st = S.state()
  S.pw.paused = true
  const prof = S.profile(240)
  return {
    gpu,
    quality: S.quality.name,
    canvas: [S.renderer.domElement.width, S.renderer.domElement.height],
    frames: dts.length,
    frameAvgMs: +avg.toFixed(2),
    frameP95Ms: +p95.toFixed(2),
    fps: +(1000 / avg).toFixed(1),
    cpuFrameMs: st.frameMs,
    cpuRenderSubmitMs: st.renderMs,
    physStepTotalMs: st.stepTotalMs,
    droppedSimSeconds: +st.droppedTime.toFixed(2),
    awakeDuringRun: st.awake,
    drawCalls: st.drawCalls,
    triangles: st.triangles,
    profileIdle: prof,
    profileActive: active,
    awakeActive: activeAwake,
    timings: S.timings,
  }
}, opt.seconds)
console.log(JSON.stringify({ url, cpuThrottle: opt.cpu, mobile: opt.mobile, ...result, errors }, null, 1))
await browser.close()
