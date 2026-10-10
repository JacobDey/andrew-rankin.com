// Dev page for @shared/fluid: a tray rocked by TrayBody.autoRock with the wave visualised, and selftest().
import { installGameApi, markReady } from '@shared/core/testapi'
import { ScalarField, TrayBody, TrayFluid, sloshFrequency, wallSlapToGain, type TrayFluidOptions } from '@shared/fluid'

const DEG = Math.PI / 180
const DARKROOM: TrayFluidOptions = { nx: 48, ny: 36, dx: 0.0075, depth: 0.012, lip: 0.045, damping: 0.8 }
const L = DARKROOM.nx * DARKROOM.dx
const params = new URLSearchParams(location.search)
const testMode = params.get('test') === '1'

let fluid = new TrayFluid(DARKROOM)
let body = new TrayBody()
let dye = new ScalarField(fluid)
body.autoRock(true)
let plate = false
let lastSpill = 0
let totalSpill = 0
let lastKinetic = 0
let slaps = 0
let frames = 0

const top = document.getElementById('top') as HTMLCanvasElement
const side = document.getElementById('side') as HTMLCanvasElement
const hud = document.getElementById('hud')!
const tctx = top.getContext('2d')!
const sctx = side.getContext('2d')!
const img = tctx.createImageData(fluid.nx, fluid.ny)
const off = document.createElement('canvas')
off.width = fluid.nx
off.height = fluid.ny
const octx = off.getContext('2d')!

function frame(dt: number): void {
  const r = body.step(dt)
  fluid.setTilt(Math.tan(body.tiltX), Math.tan(body.tiltY))
  fluid.setAccel(r.ax, r.ay)
  const rep = fluid.step(dt)
  dye.step(dt, 2e-6, 0.02)
  lastSpill = rep.spill
  totalSpill += rep.spill
  lastKinetic = rep.kinetic
  slaps += rep.slaps.length
  frames++
}

function draw(): void {
  const { nx, ny, h, ux, uy } = fluid
  const d = img.data
  const lip = DARKROOM.lip
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i
      const k = (j * nx + i) * 4
      const depth = h[c]
      const t = Math.min(1, depth / lip)
      const sp = Math.min(1, Math.hypot(ux[c], uy[c]) * 3)
      const dv = Math.min(1, Math.max(0, dye.data[c]))
      if (depth < 1e-4) { d[k] = 20; d[k + 1] = 17; d[k + 2] = 14 } else {
        d[k] = 60 + 150 * sp + 120 * dv
        d[k + 1] = 40 + 180 * t - 60 * dv
        d[k + 2] = 70 + 160 * t
      }
      d[k + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  tctx.imageSmoothingEnabled = false
  tctx.clearRect(0, 0, top.width, top.height)
  tctx.drawImage(off, 0, 0, top.width, top.height)
  // cross-section along x at the middle row
  const W = side.width
  const H = side.height
  sctx.clearRect(0, 0, W, H)
  const scale = (H - 8) / (lip * 1.6)
  const base = H - 4
  sctx.strokeStyle = '#8a8070'
  sctx.beginPath()
  sctx.moveTo(0, base - lip * scale)
  sctx.lineTo(W, base - lip * scale)
  sctx.stroke()
  sctx.fillStyle = '#3d6f9a'
  sctx.beginPath()
  sctx.moveTo(0, base)
  for (let i = 0; i < W; i++) {
    const x = (i / (W - 1) - 0.5) * L
    sctx.lineTo(i, base - fluid.surfaceAt(x, 0) * scale)
  }
  sctx.lineTo(W, base)
  sctx.fill()
  if (plate) {
    sctx.fillStyle = '#cfd5d1'
    for (let i = 0; i < W; i++) {
      const x = (i / (W - 1) - 0.5) * L
      const f = fluid.floorAt(x, 0)
      if (f > 0) sctx.fillRect(i, base - f * scale, 1, f * scale)
    }
  }
  hud.textContent =
    `tilt ${(body.tiltX / DEG).toFixed(2)} / ${(body.tiltY / DEG).toFixed(2)} deg   volume ${(fluid.volume() * 1e3).toFixed(4)} L   ` +
    `KE ${lastKinetic.toExponential(2)} J   spill ${(totalSpill * 1e6).toFixed(1)} mL   slaps ${slaps}   ${fluid.sleeping ? 'asleep' : 'awake'}`
}

let last = performance.now()
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (!testMode) {
    frame(dt)
    draw()
  }
  requestAnimationFrame(loop)
}

function setPressed(id: string, on: boolean): void {
  document.getElementById(id)!.setAttribute('aria-pressed', String(on))
}
document.getElementById('rock')!.addEventListener('click', () => {
  const on = !body.isRocking
  body.autoRock(on)
  setPressed('rock', on)
})
document.getElementById('res')!.addEventListener('click', () => {
  body = new TrayBody({ maxTiltRad: 12 * DEG })
  body.autoRock(true, { ampX: 8 * DEG, ampY: 0, fx: 0.5 })
  setPressed('rock', true)
})
document.getElementById('refill')!.addEventListener('click', () => { fluid.refill(); dye.clear(); totalSpill = 0 })
document.getElementById('pour')!.addEventListener('click', () => { fluid.addVolume(-0.1, 0.02, 0.02, 2e-4) })
document.getElementById('dye')!.addEventListener('click', () => { dye.add(-0.1, 0, 0.025, 1) })
document.getElementById('plate')!.addEventListener('click', () => {
  plate = !plate
  fluid.setFloor(plate ? (x, y) => (Math.abs(x) < 0.09 && Math.abs(y) < 0.07 ? 0.002 : 0) : null)
  setPressed('plate', plate)
})
top.addEventListener('pointerdown', (e) => {
  const r = top.getBoundingClientRect()
  fluid.poke(((e.clientX - r.left) / r.width - 0.5) * fluid.width, ((e.clientY - r.top) / r.height - 0.5) * fluid.height, 2)
})

// ---------------------------------------------------------------- selftest
interface Check { name: string; ok: boolean; info?: string }

function mk(o: Partial<TrayFluidOptions> = {}): TrayFluid {
  return new TrayFluid({ ...DARKROOM, ...o })
}

function drive(f: TrayFluid, b: TrayBody, seconds: number, onStep?: (rep: ReturnType<TrayFluid['step']>) => void): void {
  const n = Math.round(seconds * 60)
  for (let k = 0; k < n; k++) {
    const r = b.step(1 / 60)
    f.setTilt(Math.tan(b.tiltX), Math.tan(b.tiltY))
    f.setAccel(r.ax, r.ay)
    const rep = f.step(1 / 60)
    onStep?.(rep)
  }
}

function selftest(): { pass: boolean; checks: Check[] } {
  const checks: Check[] = []
  const add = (name: string, ok: boolean, info?: string): void => { checks.push({ name, ok, info }) }

  // 1. volume conserved without spill over 60 s of gentle rocking
  {
    const f = mk()
    const b = new TrayBody()
    b.autoRock(true, { ampX: 2 * DEG, ampY: 1 * DEG, fx: 0.3, fy: 0.37 })
    const v0 = f.volume()
    let spill = 0
    drive(f, b, 60, (r) => { spill += r.spill })
    const rel = Math.abs(f.volume() + spill - v0) / v0
    add('volume conserved over 60 s (no spill)', spill === 0 && rel < 1e-6, `rel err ${rel.toExponential(2)}, spill ${spill}`)
  }

  // 2. fundamental slosh period within 10% of sloshFrequency
  {
    const f = mk()
    f.setTilt(0.03, 0)
    for (let k = 0; k < 120; k++) f.step(1 / 60)
    f.setTilt(0, 0)
    const row = 18 * f.nx
    const ts: number[] = []
    let prev = f.h[row + 2] - f.h[row + 45]
    let t = 0
    for (let k = 0; k < 60 * 6; k++) {
      f.step(1 / 60)
      t += 1 / 60
      const d = f.h[row + 2] - f.h[row + 45]
      if (prev * d < 0) ts.push(t)
      prev = d
    }
    const halves = ts.slice(1).map((x, i) => x - ts[i])
    const mean = halves.reduce((a, b) => a + b, 0) / Math.max(1, halves.length)
    const expect = 0.5 / sloshFrequency(L, DARKROOM.depth)
    add('slosh period within 10% of sloshFrequency', halves.length >= 3 && Math.abs(mean / expect - 1) < 0.1, `half-period ${mean.toFixed(3)} s vs ${expect.toFixed(3)} s`)
  }

  // 3. tilt beyond atan(2 h0 / L) uncovers the high end; below it, no
  {
    const crit = Math.atan((2 * DARKROOM.depth) / L)
    const run = (mult: number): { high: number; low: number } => {
      const f = mk()
      f.setTilt(Math.tan(crit) * mult, 0)
      for (let k = 0; k < 60 * 12; k++) f.step(1 / 60)
      const row = 18 * f.nx
      return { high: f.h[row], low: f.h[row + f.nx - 1] }
    }
    const under = run(0.8)
    const over = run(1.3)
    add('tilt below atan(2h0/L) keeps the high end wet', under.high > 5e-4, `high end ${(under.high * 1e3).toFixed(2)} mm`)
    add('tilt beyond atan(2h0/L) uncovers the high end', over.high < 1e-4 && over.low > DARKROOM.depth, `high ${(over.high * 1e3).toFixed(3)} mm, low ${(over.low * 1e3).toFixed(1)} mm`)
  }

  // 4. resonance: a 0.5 Hz rock at 8 degrees spills; a gentle off-resonance rock does not
  {
    const f = mk()
    const b = new TrayBody({ maxTiltRad: 12 * DEG })
    b.autoRock(true, { ampX: 8 * DEG, ampY: 0, fx: 0.5 })
    let spill = 0
    drive(f, b, 20, (r) => { spill += r.spill })
    add('0.5 Hz rock at resonance (8 deg) spills', spill > 1e-5, `${(spill * 1e6).toFixed(1)} mL in 20 s`)
    // the default auto-rock sits on both fundamental modes (0.48 / 0.64 Hz), so it does build up and spill, as the GDD intends
    const f2 = mk()
    const b2 = new TrayBody()
    b2.autoRock(true, { ampX: 3 * DEG, ampY: 1.5 * DEG, fx: 0.3, fy: 0.37 })
    let spill2 = 0
    drive(f2, b2, 30, (r) => { spill2 += r.spill })
    add('a gentle off-resonance rock (3 / 1.5 deg, 0.3 Hz) does not spill', spill2 === 0, `${(spill2 * 1e6).toFixed(2)} mL in 30 s`)
  }

  // 5. snapshot / restore is bit-exact (the body is not part of a fluid snapshot: replay it from rest)
  {
    const f = mk()
    const b = new TrayBody()
    b.autoRock(true)
    drive(f, b, 5)
    f.impulse(0.05, 0.02, 0.02, 0.003)
    const snap = f.snapshot()
    drive(f, b, 3)
    const a = f.snapshot()
    f.restore(snap)
    const b2 = new TrayBody()
    b2.autoRock(true)
    for (let k = 0; k < 300; k++) b2.step(1 / 60)
    drive(f, b2, 3)
    const c = f.snapshot()
    let same = true
    for (let i = 0; i < a.h.length; i++) if (a.h[i] !== c.h[i] || a.ux[i] !== c.ux[i] || a.uy[i] !== c.uy[i]) same = false
    add('snapshot/restore is bit-exact', same)
  }

  // 6. sleep: a bump rings down and the tray goes to sleep; volume untouched
  {
    const f = mk()
    const v0 = f.volume()
    f.impulse(0, 0, 0.02, 0.004)
    let t = 0
    while (!f.sleeping && t < 30) { f.step(1 / 60); t += 1 / 60 }
    add('a disturbed tray goes to sleep', f.sleeping && Math.abs(f.volume() - v0) / v0 < 1e-5, `asleep after ${t.toFixed(1)} s`)
    f.poke(0.05, 0.02, 1)
    add('poke wakes it', !f.sleeping)
  }

  // 7. plate floor (Plates preset): volume conserved, surface above the plate
  {
    const f = new TrayFluid({ nx: 60, ny: 48, dx: 0.005, depth: 0.008, lip: 0.025, floor: (x, y) => (Math.abs(x) < 0.06 && Math.abs(y) < 0.05 ? 0.002 : 0) })
    const v0 = f.volume()
    for (let k = 0; k < 600; k++) { f.setTilt(0.01 * Math.sin(k / 30), 0); f.step(1 / 60) }
    const drift = Math.abs(f.volume() - v0) / v0
    add('plate floor: volume conserved', drift < 1e-6, `drift ${drift.toExponential(2)}`)
    add('plate floor: liquid covers the plate', f.depthAt(0, 0) > 0.002 && f.surfaceAt(0, 0) > 0.002 + 0.002, `depth over plate ${(f.depthAt(0, 0) * 1e3).toFixed(2)} mm`)
  }

  // 8. impulse / poke / addVolume / takeVolume bookkeeping
  {
    const f = mk()
    const v0 = f.volume()
    f.poke(0, 0, 1)
    f.impulse(0.1, 0.05, 0.01, 0.002)
    add('poke and impulse conserve volume', Math.abs(f.volume() - v0) / v0 < 1e-6, `${((f.volume() - v0) / v0).toExponential(2)}`)
    f.addVolume(0, 0, 0.02, 1e-4)
    const got = f.takeVolume(0, 0, 5e-5)
    add('addVolume and takeVolume are exact', Math.abs(f.volume() - v0 - 1e-4 + got) < 1e-9, `took ${got.toExponential(2)} m3`)
  }

  // 9. scalar field mass and TrayBody landing
  {
    const f = mk()
    const s = new ScalarField(f)
    s.add(-0.1, 0, 0.02, 1)
    const m0 = s.data.reduce((a, b) => a + b, 0)
    f.setTilt(0.05, 0)
    for (let k = 0; k < 300; k++) { f.step(1 / 60); s.step(1 / 60, 1e-4, 0) }
    const m1 = s.data.reduce((a, b) => a + b, 0)
    add('scalar field keeps its mass (no decay)', Math.abs(m1 / m0 - 1) < 0.01, `ratio ${(m1 / m0).toFixed(4)}`)
    const b = new TrayBody()
    b.hold(0.15, 0.05)
    for (let k = 0; k < 60; k++) b.step(1 / 60)
    b.release()
    let landed = 0
    for (let k = 0; k < 120; k++) landed = Math.max(landed, b.step(1 / 60).landed)
    add('TrayBody reports landing on release', landed > 0.02, `${landed.toFixed(3)} m/s`)
    add('wallSlapToGain is monotone in 0..1', wallSlapToGain(0) === 0 && wallSlapToGain(0.01) < wallSlapToGain(0.1) && wallSlapToGain(10) <= 1)
  }

  return { pass: checks.every((c) => c.ok), checks }
}

function bench(frames = 600): { msPerFrame: number; substeps: number } {
  const f = mk()
  const b = new TrayBody()
  b.autoRock(true)
  drive(f, b, 5)
  let sub = 0
  const t0 = performance.now()
  drive(f, b, frames / 60, (r) => { sub += r.substeps })
  return { msPerFrame: (performance.now() - t0) / frames, substeps: sub / frames }
}

installGameApi('shared:fluid', 'fluid@1', {
  state: () => ({
    tilt: [body.tiltX, body.tiltY],
    volume: fluid.volume(),
    kinetic: lastKinetic,
    sleeping: fluid.sleeping,
    spilled: totalSpill,
    lastSpill,
    slaps,
    frames,
    plate,
  }),
  selftest,
  bench,
  /** Deterministic: n frames of 1/60 s, then redraw. */
  step(n = 1): void {
    for (let k = 0; k < n; k++) frame(1 / 60)
    draw()
  },
  reset(): void {
    fluid = new TrayFluid(DARKROOM)
    dye = new ScalarField(fluid)
    body = new TrayBody()
    body.autoRock(true)
    totalSpill = 0
    slaps = 0
    frames = 0
    plate = false
    draw()
  },
})

draw()
markReady()
requestAnimationFrame(loop)
