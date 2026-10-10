// Shared core harness: __game.selftest() runs every acceptance check from architecture.md §4.1.
import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import {
  mulberry32, hashString, hash2, hash3, rngStream, gauss, shuffle, pick, randInt,
  valueNoise1, valueNoise2, gradientNoise2, fbm1, fbm2, ridged2, worley2, bandNoise,
  clamp, smoothstep, mod, springStep, monotoneCubic, median, percentile, damp,
  createBus, createLoop, flags, _setFlagsForTests, prefersReducedMotion,
  createGestures, circularDrag, createPerfMonitor, detectTier, dprCap, deviceInfo,
  shouldGameIgnoreKey, importImage, ImportError, runSliced, installGameApi, markReady, nextFrame, extendGameApi,
  type GestureEvent,
} from '@shared/core'

interface Check {
  name: string
  ok: boolean
  detail?: string
}

function pointer(el: Element, type: string, id: number, x: number, y: number, extra: PointerEventInit = {}): void {
  const r = el.getBoundingClientRect()
  el.dispatchEvent(
    new PointerEvent(type, {
      pointerId: id,
      pointerType: 'touch',
      isPrimary: id === 1,
      clientX: r.left + x,
      clientY: r.top + y,
      bubbles: true,
      cancelable: true,
      buttons: type === 'pointerup' ? 0 : 1,
      ...extra,
    }),
  )
}

async function selftest(): Promise<{ ok: boolean; results: Check[] }> {
  const out: Check[] = []
  const t = (name: string, ok: boolean, detail?: string): void => {
    out.push({ name, ok, detail })
  }
  const origSearch = location.search

  // rng
  const r = mulberry32(42)
  const first = [r(), r(), r()]
  t('mulberry32(42) matches the reference', first[0] === 0.6011037519201636 && first[1] === 0.44829055899754167 && first[2] === 0.8524657934904099, first.join(','))
  t('hashString is FNV-1a and stable', hashString('texturedle') === 492053795 && hashString('') === 2166136261 && hashString('a') === 3826002220)
  const a = rngStream(7, 'sim')
  const b = rngStream(7, 'sim')
  const c = rngStream(7, 'render')
  t('rngStream is deterministic and independent', a() === b() && a() !== c())
  let lo = 1
  let hi = 0
  for (let i = 0; i < 2000; i++) {
    const h = hash2(i, -i, 5)
    const h3 = hash3(i, 2 * i, -i, 5)
    lo = Math.min(lo, h, h3)
    hi = Math.max(hi, h, h3)
  }
  t('hash2 and hash3 stay in [0,1)', lo >= 0 && hi < 1)
  const g = mulberry32(3)
  let gs = 0
  let gs2 = 0
  for (let i = 0; i < 20000; i++) {
    const v = gauss(g)
    gs += v
    gs2 += v * v
  }
  t('gauss is about N(0,1)', Math.abs(gs / 20000) < 0.03 && Math.abs(gs2 / 20000 - 1) < 0.05)
  const arr = shuffle(mulberry32(1), [1, 2, 3, 4, 5, 6, 7, 8])
  t('shuffle is a permutation', [...arr].sort().join('') === '12345678')
  t('pick and randInt stay in range', randInt(mulberry32(1), 3, 5) >= 3 && ['a', 'b'].includes(pick(mulberry32(2), ['a', 'b'])))

  // noise
  let fmin = 9
  let fmax = -9
  for (let i = 0; i < 10000; i++) {
    const v = fbm2(i * 0.173, i * 0.0731, { octaves: 5 })
    fmin = Math.min(fmin, v)
    fmax = Math.max(fmax, v)
  }
  t('fbm2 stays within [-1.05, 1.05] over 10k samples', fmin >= -1.05 && fmax <= 1.05, `${fmin.toFixed(3)}..${fmax.toFixed(3)}`)
  let gmin = 9
  let gmax = -9
  for (let i = 0; i < 10000; i++) {
    const v = gradientNoise2(i * 0.37, i * 0.113)
    gmin = Math.min(gmin, v)
    gmax = Math.max(gmax, v)
  }
  t('gradientNoise2 within [-1, 1] and not flat', gmin >= -1 && gmax <= 1 && gmax - gmin > 1)
  t('value noise is deterministic and continuous', valueNoise2(1.5, 2.5, 3) === valueNoise2(1.5, 2.5, 3) && Math.abs(valueNoise2(1.5, 2.5) - valueNoise2(1.5001, 2.5)) < 0.01 && Math.abs(valueNoise1(3.2) - valueNoise1(3.2001)) < 0.01)
  const rg = ridged2(0.3, 0.7)
  t('ridged2 in [0,1]', rg >= 0 && rg <= 1)
  const w = worley2(3.3, 4.4)
  t('worley2: f1 <= f2, feature point near', w.f1 <= w.f2 && Math.hypot(w.cx - 3.3, w.cy - 4.4) < 2)
  let ss = 0
  const N = 40000
  for (let i = 0; i < N; i++) ss += bandNoise(i * 0.005, 1, 8, 9, 8) ** 2
  t('bandNoise is about unit RMS', Math.abs(Math.sqrt(ss / N) - 1) < 0.2, String(Math.sqrt(ss / N)))
  t('fbm1 finite', Number.isFinite(fbm1(12.3)))

  // math
  t('mod is always positive, clamp and smoothstep behave', mod(-1, 5) === 4 && clamp(5, 0, 1) === 1 && smoothstep(0, 1, 0.5) === 0.5)
  const sp = { x: 0, v: 0 }
  for (let i = 0; i < 600; i++) springStep(sp, 1, 12, 0.8, 1 / 60)
  t('springStep converges', Math.abs(sp.x - 1) < 1e-3)
  const sp2 = { x: 0, v: 0 }
  springStep(sp2, 1, 400, 5, 0.5) // huge dt, stiff, over-damped
  t('springStep is stable for a huge dt', Number.isFinite(sp2.x) && Math.abs(sp2.x) < 2)
  const mc = monotoneCubic([0, 1, 2, 3], [0, 1, 1.1, 5])
  let mono = true
  let prev = -Infinity
  for (let x = 0; x <= 3; x += 0.01) {
    const v = mc(x)
    if (v < prev - 1e-9) mono = false
    prev = v
  }
  t('monotoneCubic is monotone', mono && Math.abs(mc(1) - 1) < 1e-9)
  t('median and percentile', median([5, 1, 3]) === 3 && percentile([0, 10], 0.5) === 5)
  t('damp is frame-rate independent', Math.abs(damp(damp(0, 1, 5, 0.5), 1, 5, 0.5) - damp(0, 1, 5, 1)) < 1e-9)

  // bus
  const bus = createBus<{ hit: number }>()
  let got = 0
  const off = bus.on('hit', (v) => (got += v))
  bus.emit('hit', 2)
  off()
  bus.emit('hit', 5)
  bus.once('hit', (v) => (got += v))
  bus.emit('hit', 10)
  bus.emit('hit', 10)
  t('bus on, off and once', got === 12, String(got))

  // loop
  const loop = createLoop({ autoStart: false })
  let steps = 0
  let frames = 0
  const order: string[] = []
  loop.onStep(() => steps++)
  loop.onStep(() => order.push('b'), 2)
  loop.onStep(() => order.push('a'), 1)
  loop.onFrame(() => frames++)
  loop.advance(60)
  t('loop.advance(60) runs exactly 60 steps and one frame', steps === 60 && frames === 1 && Math.abs(loop.simTime - 1) < 1e-9, `${steps} steps, ${frames} frames, simTime ${loop.simTime}`)
  t('loop steps run in ascending order', order[0] === 'a' && order[1] === 'b')
  loop.setPaused(true)
  loop.advance(5)
  t('loop.advance works while paused', steps === 65)
  const live = createLoop({ pauseWhenHidden: false })
  let liveFrames = 0
  live.onFrame(() => liveFrames++)
  await new Promise((res) => setTimeout(res, 250))
  live.stop()
  t('live loop runs rAF frames', liveFrames > 0 && live.stats().fps >= 0, String(liveFrames))

  // flags
  const f = _setFlagsForTests('?test=1&seed=42&quality=low&embed=poster&reset&theme=dark&mute=1&debug=bake&x=3.5&flag=0')
  t(
    'flags parse',
    f.test && f.seed === 42 && f.quality === 'low' && f.embed === 'poster' && f.reset && f.theme === 'dark' && f.muted && f.debug === 'bake' && f.num('x', 0) === 3.5 && !f.bool('flag') && f.has('flag') && !f.fresh,
  )
  t('flags: ?q= alias and bad values', _setFlagsForTests('?q=high&quality=bogus&seed=abc&embed=wat').quality === 'high' && _setFlagsForTests('?seed=abc&embed=wat').seed === null && _setFlagsForTests('?embed=wat').embed === null)
  _setFlagsForTests(origSearch)
  t('flags() is cached', flags() === flags())
  t('prefersReducedMotion honours data-motion', (() => {
    const had = document.documentElement.getAttribute('data-motion')
    document.documentElement.setAttribute('data-motion', 'reduce')
    const on = prefersReducedMotion()
    if (had === null) document.documentElement.removeAttribute('data-motion')
    else document.documentElement.setAttribute('data-motion', had)
    return on
  })())

  // quality
  const tier = detectTier()
  t('detectTier returns a tier (test under webdriver)', ['high', 'medium', 'low', 'test'].includes(tier) && (!deviceInfo().webdriver || tier === 'test' || !!flags().quality), tier)
  t('dprCap per tier', dprCap('high') === 2 && dprCap('medium') === 1.5 && dprCap('low') === 1 && dprCap('test') === 1)
  const pm = createPerfMonitor()
  let degraded = 0
  pm.onDegrade(() => degraded++, { windowS: 1, cooldownS: 0.5 })
  for (let i = 0; i < 120; i++) pm.sample(30)
  t('perf monitor degrades on slow frames', degraded >= 1 && Math.abs(pm.p75Ms - 30) < 0.5, `${degraded}`)
  const pm2 = createPerfMonitor()
  let d2 = 0
  pm2.onDegrade(() => d2++)
  for (let i = 0; i < 600; i++) pm2.sample(8)
  t('perf monitor stays quiet on fast frames', d2 === 0 && pm2.meanMs < 9)

  // gestures
  const pad = document.getElementById('pad') as HTMLElement
  const gest = createGestures(pad)
  const seen: GestureEvent[] = []
  gest.on((e) => {
    seen.push(e)
  })
  pointer(pad, 'pointerdown', 1, 100, 100)
  pointer(pad, 'pointerup', 1, 100, 100)
  t('tap', seen.some((e) => e.kind === 'tap'), seen.map((e) => e.kind).join(','))
  seen.length = 0
  pointer(pad, 'pointerdown', 1, 50, 50)
  pointer(pad, 'pointermove', 1, 60, 50)
  pointer(pad, 'pointermove', 1, 90, 60)
  pointer(pad, 'pointerup', 1, 90, 60)
  const kinds = seen.map((e) => e.kind)
  const dragEv = seen.find((e) => e.kind === 'drag')
  t('drag: dragStart, drag, dragEnd, no tap', kinds.includes('dragStart') && kinds.includes('drag') && kinds.includes('dragEnd') && !kinds.includes('tap') && !!dragEv && dragEv.totalDx > 0, kinds.join(','))
  seen.length = 0
  pointer(pad, 'pointerdown', 1, 100, 100)
  pointer(pad, 'pointerdown', 2, 200, 100)
  pointer(pad, 'pointermove', 2, 300, 100)
  const pinch = seen.find((e) => e.kind === 'pinch')
  t('pinch scales about 2x', !!pinch && Math.abs(pinch.scale - 2) < 0.05, pinch ? String(pinch.scale) : 'none')
  pointer(pad, 'pointermove', 2, 300, 200)
  t('twist reports an angle', seen.some((e) => e.kind === 'twist' && Math.abs(e.angle) > 0.2))
  pointer(pad, 'pointerup', 2, 300, 200)
  pointer(pad, 'pointerup', 1, 100, 100)
  seen.length = 0
  pad.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, bubbles: true, cancelable: true }))
  t('wheel normalised to px', seen.some((e) => e.kind === 'wheel' && e.deltaY === 48))
  let order2 = ''
  const padEl2 = document.createElement('div')
  padEl2.style.cssText = 'width:20px;height:20px'
  document.body.appendChild(padEl2)
  const g2 = createGestures(padEl2)
  g2.on((e) => {
    if (e.kind === 'down') order2 += 'low'
  }, 0)
  g2.on((e) => {
    if (e.kind !== 'down') return
    order2 += 'high'
    return true
  }, 5)
  pointer(padEl2, 'pointerdown', 1, 5, 5)
  pointer(padEl2, 'pointerup', 1, 5, 5)
  t('gesture priority: higher first, true stops lower handlers', order2 === 'high', order2)
  padEl2.remove()
  gest.dispose()
  g2.dispose()
  const cd = circularDrag(0, 0)
  cd.update(1, 0)
  t('circularDrag returns a quarter turn', Math.abs(cd.update(0, 1) - Math.PI / 2) < 1e-9)

  // keys
  const inp = document.createElement('input')
  document.body.appendChild(inp)
  let ignored = false
  inp.addEventListener('keydown', (e) => {
    ignored = shouldGameIgnoreKey(e)
  })
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
  inp.remove()
  t('shouldGameIgnoreKey is true inside an input', ignored)

  // files
  let importErr = ''
  try {
    await importImage(new Blob(['not an image'], { type: 'text/plain' }))
  } catch (e) {
    importErr = e instanceof ImportError ? e.message : 'wrong error type'
  }
  t('importImage rejects non-images with user-safe copy', importErr === "That file wouldn't load.", importErr)
  const cv = document.createElement('canvas')
  cv.width = 64
  cv.height = 32
  const cctx = cv.getContext('2d')!
  cctx.fillStyle = '#c33'
  cctx.fillRect(0, 0, 64, 32)
  const png = await new Promise<Blob>((res) => cv.toBlob((bb) => res(bb as Blob), 'image/png'))
  const imp = await importImage(png, { cropAspect: 1, maxSide: 16 })
  t('importImage decodes, centre-crops and limits size', imp.w === 16 && imp.h === 16 && imp.srcW === 64 && imp.image.data.length === 16 * 16 * 4, `${imp.w}x${imp.h}`)

  // idle
  let n = 0
  const job = (function* (): Generator<void, string, void> {
    for (let i = 0; i < 5000; i++) {
      n++
      yield
    }
    return 'done'
  })()
  const res = await runSliced(job, { sliceMs: 2 })
  t('runSliced finishes a long job', res === 'done' && n === 5000)

  // test api
  t('window.__game base contract', window.__game?.slug === 'shared:core' && typeof window.__game.errors === 'function' && typeof window.__game.whenReady === 'function')
  extendGameApi({ extra: 1 })
  t('extendGameApi merges members', (window.__game as unknown as { extra?: number }).extra === 1)
  t('errors() is empty', (window.__game as unknown as { errors(): string[] }).errors().length === 0, JSON.stringify((window.__game as unknown as { errors(): string[] }).errors()))

  const result = { ok: out.every((x) => x.ok), results: out }
  ;(document.getElementById('out') as HTMLElement).textContent = out.map((x) => `${x.ok ? 'ok  ' : 'FAIL'} ${x.name}${x.detail ? '  [' + x.detail + ']' : ''}`).join('\n')
  return result
}

installGameApi('shared:core', 'shared-core@1', {
  state: () => ({ tier: detectTier(), flags: { test: flags().test, seed: flags().seed } }),
  selftest,
})
void nextFrame().then(() => markReady())
