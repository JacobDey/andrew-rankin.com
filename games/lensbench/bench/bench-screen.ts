// The Bench (lensbench.md §4.2, §7 "Bench"): a 2D fog tank with a walnut rail, section-drawn
// pucks, C/d/F rays in haze, the spec plate, the parts tray and a live ground-glass inset.
import {
  GLASSES, GLASS_IDS, PRESET_INFO, autoThickness, clampElementZ, collimate, computeProfile, encodeCard, heartCard,
  pinholeOptimum, sag, setFNumber, spotDiagram, traceFan, fovDeg, type Ch, type ElementSpec, type GlassId,
  type LensDesign, type LensProfile, type PresetId, CARD_SIZE,
} from '@shared/optics'
import { BODIES, BODY_IDS, F_STOPS, FILTERS, FILTER_IDS, SHUTTERS, SHUTTER_IDS, STOCKS, STOCK_IDS } from '../core/catalog'
import type { Screen } from '../core/types'
import type { App } from '../core/app'
import { sfx } from '../audio/audio'
import './bench.css'

const RAY_COL = ['#FF4A3D', '#FFD04A', '#4AA8FF']
const BLANKS: { id: string; label: string; c1: number; c2: number; D: number }[] = [
  { id: 'biconvex', label: 'Biconvex', c1: 0.02, c2: -0.02, D: 30 },
  { id: 'planoconvex', label: 'Plano-convex', c1: 0.03, c2: 0, D: 30 },
  { id: 'posmeniscus', label: 'Meniscus +', c1: 0.035, c2: 0.012, D: 30 },
  { id: 'biconcave', label: 'Biconcave', c1: -0.025, c2: 0.025, D: 24 },
  { id: 'negmeniscus', label: 'Meniscus −', c1: 0.012, c2: 0.035, D: 24 },
]
const PRESET_ORDER: PresetId[] = ['pinhole', 'meniscus', 'achromat', 'portrait', 'triplet', 'telephoto', 'retrofocus']
const GAUGES = [0.2, 0.3, 0.45, 0.6, 1.0]

type Drag =
  | { kind: 'slide'; idx: number; z0: number; x0: number; moved: boolean }
  | { kind: 'bend'; idx: number; side: 1 | 2; y0: number; c0: number }
  | { kind: 'stop'; z0: number; x0: number }
  | { kind: 'needle'; x0: number; y0: number; d0: number }
  | { kind: 'pan'; x0: number; off0: number }
  | { kind: 'new'; blank: (typeof BLANKS)[number]; el: HTMLElement }

export interface BenchScreen extends Screen { readonly canvas: HTMLCanvasElement; redraw(): void; laser: boolean }

export function createBenchScreen(root: HTMLElement, app: App): BenchScreen {
  root.classList.add('lb-bench')
  root.innerHTML = `
    <div class="lb-bench-tank">
      <canvas class="lb-bench-canvas" aria-label="Optical bench: drag glass along the rail"></canvas>
      <div class="lb-gg" aria-hidden="true"><div class="lb-gg-view"></div><span class="lb-gg-label">ground glass</span></div>
      <div class="lb-qnote" hidden></div>
      <div class="lb-bench-tools">
        <button class="lb-chip" data-act="light" title="Light: laser or white (L)">White light</button>
        <button class="lb-chip" data-act="field" title="Off-axis rays (F)">Off-axis</button>
        <button class="lb-chip" data-act="collimate" title="Collimate ∞ (C)">Collimate ∞</button>
        <button class="lb-chip" data-act="fit" title="Fit the rail (Z)">Fit</button>
      </div>
    </div>
    <aside class="lb-spec">
      <div class="lb-plate" aria-live="polite"></div>
      <div class="lb-selects"></div>
      <div class="lb-presets"><div class="lb-h">Q.'s card file</div><div class="lb-preset-list"></div></div>
      <div class="lb-share"><button class="lb-chip" data-act="share">Share camera</button><button class="lb-chip" data-act="save">Save design</button></div>
    </aside>
    <div class="lb-tray" role="toolbar" aria-label="Parts tray"></div>`
  const tank = root.querySelector('.lb-bench-tank') as HTMLElement
  const canvas = root.querySelector('.lb-bench-canvas') as HTMLCanvasElement
  const ggView = root.querySelector('.lb-gg-view') as HTMLElement
  const plate = root.querySelector('.lb-plate') as HTMLElement
  const selects = root.querySelector('.lb-selects') as HTMLElement
  const presetList = root.querySelector('.lb-preset-list') as HTMLElement
  const tray = root.querySelector('.lb-tray') as HTMLElement
  const qnote = root.querySelector('.lb-qnote') as HTMLElement
  const g = canvas.getContext('2d') as CanvasRenderingContext2D

  let laser = false
  let offAxis = true
  let selected = -1
  let drag: Drag | null = null
  let view = { zMin: -180, zMax: 40, off: 0 }
  let haze: HTMLCanvasElement | null = null
  let profile: LensProfile = app.profile()
  let lastFull = 0
  let dirtyFull = false
  let active = false
  let cssW = 0, cssH = 0, dpr = 1
  let squash = 0
  let lastChime = 0
  let lastRubZ = 0

  const design = () => app.store.get().camera.lens
  const fmt = () => { const b = BODIES[app.store.get().camera.body]; return { w: b.format[0], h: b.format[1] } }
  const setLens = (lens: LensDesign, o: { full?: boolean; keepN?: boolean } = {}) => {
    const st = app.store.get()
    let l = lens
    if (o.keepN !== false && l.stop.kind !== 'card') l = setFNumber(l, st.fNumber, fmt())
    app.setCamera({ lens: l })
    profile = computeProfile(l, fmt(), o.full ? 'full' : 'fast')
    if (!o.full) { dirtyFull = true; lastFull = performance.now() }
    redraw(); renderPlate()
  }

  // ------------------------------------------------------------------ geometry
  const pxPerMm = () => (cssW - 20) / (view.zMax - view.zMin)
  const zx = (z: number) => 10 + (z - view.zMin) * pxPerMm() + view.off
  const xz = (x: number) => (x - 10 - view.off) / pxPerMm() + view.zMin
  const axisY = () => cssH * 0.5
  const yy = (y: number) => axisY() - y * pxPerMm()
  const fit = () => {
    const d = design()
    let front = d.stop.z
    for (const e of d.elements) front = Math.min(front, e.z)
    const p = profile
    front = Math.min(front, p.ep.z)
    const span = Math.max(80, -front + 30)
    let maxD = d.stop.kind === 'pinhole' ? 30 : 10
    for (const e of d.elements) maxD = Math.max(maxD, e.diameter)
    const needH = (maxD * 1.6) / (cssH || 300)
    const spanH = needH * (cssW - 20)
    const s = Math.max(span * 1.25, spanH)
    view = { zMin: -s * 0.85, zMax: s * 0.15, off: 0 }
  }

  // ------------------------------------------------------------------ drawing
  const makeHaze = () => {
    const c = document.createElement('canvas')
    c.width = 256; c.height = 128
    const h = c.getContext('2d') as CanvasRenderingContext2D
    const img = h.createImageData(256, 128)
    let s = 12345
    for (let i = 0; i < 256 * 128; i++) {
      s = (s * 1103515245 + 12345) >>> 0
      const v = (s >>> 24) / 255
      img.data[i * 4] = 40; img.data[i * 4 + 1] = 46; img.data[i * 4 + 2] = 58; img.data[i * 4 + 3] = Math.round(v * 18)
    }
    h.putImageData(img, 0, 0)
    return c
  }
  const resize = () => {
    const r = canvas.getBoundingClientRect()
    dpr = Math.min(2, devicePixelRatio || 1)
    cssW = Math.max(100, r.width); cssH = Math.max(100, r.height)
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr)
    fit()
    redraw()
  }

  function puckPath(e: ElementSpec): Path2D {
    const p = new Path2D()
    const R = e.diameter / 2, t = autoThickness(e)
    const n = 16
    for (let i = 0; i <= n; i++) { const y = -R + (2 * R * i) / n; const z = e.z + sag(e.c1, Math.abs(y)); i ? p.lineTo(zx(z), yy(y)) : p.moveTo(zx(z), yy(y)) }
    for (let i = n; i >= 0; i--) { const y = -R + (2 * R * i) / n; const z = e.z + t + sag(e.c2, Math.abs(y)); p.lineTo(zx(z), yy(y)) }
    p.closePath()
    return p
  }

  function drawBody() {
    const st = app.store.get()
    const b = BODIES[st.camera.body]
    const x0 = zx(0)
    const half = (b.format[1] / 2) * pxPerMm()
    g.save()
    g.fillStyle = '#17181A'
    g.strokeStyle = '#B8893A'; g.lineWidth = 1
    const w = Math.max(18, 30 * pxPerMm())
    g.fillRect(x0, axisY() - half - 10, w, half * 2 + 20)
    g.strokeRect(x0 + 0.5, axisY() - half - 10.5, w, half * 2 + 20)
    // film line
    g.strokeStyle = '#EDE8DC'; g.lineWidth = 2
    g.beginPath(); g.moveTo(x0, axisY() - half); g.lineTo(x0, axisY() + half); g.stroke()
    if (st.camera.body === 'reflex') {
      const clear = profile.rearZ <= -38
      g.strokeStyle = clear ? '#888' : '#d8432c'; g.lineWidth = 2
      g.beginPath(); g.moveTo(zx(-34), yy(-14)); g.lineTo(zx(-4), yy(14)); g.stroke()
      if (!clear) { g.fillStyle = 'rgba(216,67,44,0.18)'; g.fillRect(zx(-38), axisY() - half, zx(0) - zx(-38), half * 2) }
    }
    g.fillStyle = '#EDE8DC'; g.font = '600 10px "Arial Narrow", sans-serif'
    g.fillText(b.name.toUpperCase(), x0 + 4, axisY() + half + 22)
    g.restore()
  }

  function drawRail() {
    const y0 = cssH - 26
    const grad = g.createLinearGradient(0, y0, 0, y0 + 18)
    grad.addColorStop(0, '#6a4329'); grad.addColorStop(1, '#3a2414')
    g.fillStyle = grad
    g.fillRect(0, y0, cssW, 18)
    g.strokeStyle = 'rgba(30,15,5,0.35)'; g.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      g.beginPath()
      for (let x = 0; x <= cssW; x += 8) { const y = y0 + 3 + i * 2.6 + Math.sin(x * 0.02 + i * 1.3) * 1.2; x ? g.lineTo(x, y) : g.moveTo(x, y) }
      g.stroke()
    }
    // mm scale
    g.strokeStyle = '#EDE8DC'; g.fillStyle = '#EDE8DC'; g.font = '9px ui-monospace, Consolas, monospace'
    const ppm = pxPerMm()
    const step = ppm > 4 ? 1 : ppm > 1.5 ? 5 : 10
    for (let z = Math.ceil(view.zMin / step) * step; z <= view.zMax; z += step) {
      const x = zx(z)
      const major = z % (step * 10) === 0
      g.globalAlpha = major ? 0.9 : 0.4
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + (major ? 7 : 3)); g.stroke()
      if (major) g.fillText(String(z), x + 2, y0 + 15)
    }
    g.globalAlpha = 1
  }

  function redraw() {
    if (!cssW) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    // fog tank
    const bg = g.createLinearGradient(0, 0, 0, cssH)
    bg.addColorStop(0, '#0B0D10'); bg.addColorStop(1, '#151a20')
    g.fillStyle = bg
    g.fillRect(0, 0, cssW, cssH)
    if (!haze) haze = makeHaze()
    g.globalAlpha = 0.9
    g.drawImage(haze, 0, 0, cssW, cssH)
    g.globalAlpha = 1
    // lamp glow from the right
    const lamp = g.createRadialGradient(cssW * 0.95, cssH * 0.1, 10, cssW * 0.95, cssH * 0.1, cssW * 0.7)
    lamp.addColorStop(0, 'rgba(255,190,120,0.10)'); lamp.addColorStop(1, 'rgba(255,190,120,0)')
    g.fillStyle = lamp; g.fillRect(0, 0, cssW, cssH)
    // axis
    g.strokeStyle = 'rgba(237,232,220,0.15)'; g.setLineDash([4, 6])
    g.beginPath(); g.moveTo(0, axisY()); g.lineTo(cssW, axisY()); g.stroke(); g.setLineDash([])
    drawRail()
    drawBody()
    const d = design()
    // rays
    const chs: Ch[] = laser ? [1] : [0, 1, 2]
    const fields = offAxis && !d.elements.length ? [0, profile.fieldHalfDiagRad * 0.7] : offAxis ? [0, profile.fieldHalfDiagRad * 0.7] : [0]
    g.save()
    g.globalCompositeOperation = 'lighter'
    for (const f of fields) {
      const fan = traceFan(d, { fieldRad: f, rays: d.elements.length ? 9 : 5, chs, toZ: Math.min(view.zMax, 40) })
      for (const r of fan) {
        const col = laser ? RAY_COL[1] : RAY_COL[r.ch]
        const p = r.pts
        if (p.length < 4) continue
        for (const [wdt, a] of [[6, 0.08], [1.5, f ? 0.35 : 0.7]] as const) {
          g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = wdt
          g.beginPath()
          g.moveTo(zx(Math.max(view.zMin, p[0])), yy(p[1]))
          for (let i = 2; i < p.length; i += 2) g.lineTo(zx(p[i]), yy(p[i + 1]))
          g.stroke()
        }
        if (r.fate === 'tir') { g.globalAlpha = 0.9; g.fillStyle = '#ff3020'; g.beginPath(); g.arc(zx(p[p.length - 2]), yy(p[p.length - 1]), 4, 0, 6.3); g.fill() }
      }
    }
    // focus glow where rays converge
    if (!profile.pinhole && profile.valid) {
      const fz = profile.p2z + profile.efl
      const glow = g.createRadialGradient(zx(fz), axisY(), 0, zx(fz), axisY(), 26)
      glow.addColorStop(0, 'rgba(255,230,170,0.35)'); glow.addColorStop(1, 'rgba(255,230,170,0)')
      g.globalAlpha = 1; g.fillStyle = glow; g.fillRect(zx(fz) - 30, axisY() - 30, 60, 60)
    }
    g.restore()
    // stop
    const s = d.stop
    const sx = zx(s.z)
    g.fillStyle = '#17181A'; g.strokeStyle = '#B8893A'
    const sr = Math.max(0.6, (s.diameter / 2) * pxPerMm())
    const outer = Math.max(sr + 8, 22 * pxPerMm() * (d.elements.length ? 1 : 0.6))
    g.fillRect(sx - 2, axisY() - outer, 4, outer - sr)
    g.fillRect(sx - 2, axisY() + sr, 4, outer - sr)
    if (s.kind === 'pinhole') {
      // needle in the pincushion
      g.fillStyle = '#c0c4c8'
      g.fillRect(sx - 1, axisY() - outer - 26, 2, 22)
      g.fillStyle = '#d8432c'; g.beginPath(); g.arc(sx, axisY() - outer - 28, 4, 0, 6.3); g.fill()
      g.fillStyle = '#EDE8DC'; g.font = '10px ui-monospace, monospace'
      g.fillText(`${s.diameter.toFixed(2)} mm · f/${Math.round(profile.fNumber)}`, sx + 6, axisY() - outer - 20)
    } else {
      g.fillStyle = '#EDE8DC'; g.font = '10px ui-monospace, monospace'
      g.fillText(s.kind === 'card' ? `card f/${profile.fNumber.toFixed(1)}♥` : `f/${profile.fNumber.toFixed(1)}${s.blades ? ` · ${s.blades} blades` : ''}`, sx + 4, axisY() - outer - 4)
    }
    // pucks
    d.elements.forEach((e, i) => {
      const path = puckPath(e)
      const gl = GLASSES[e.glass]
      g.save()
      if (i === selected && squash > 0) { /* squash on snap */ }
      const gr = g.createLinearGradient(0, yy(e.diameter / 2), 0, yy(-e.diameter / 2))
      gr.addColorStop(0, hexA(gl.tint, 0.55)); gr.addColorStop(0.5, hexA(gl.tint, 0.22)); gr.addColorStop(1, hexA(gl.tint, 0.45))
      g.fillStyle = gr
      g.fill(path)
      if (e.coating) { g.strokeStyle = e.coating === 2 ? 'rgba(120,230,160,0.8)' : 'rgba(174,151,242,0.9)'; g.lineWidth = 2; g.stroke(path) }
      g.strokeStyle = i === selected ? '#E2C27A' : 'rgba(237,232,220,0.75)'; g.lineWidth = i === selected ? 1.6 : 1
      g.stroke(path)
      // crosshatch per glass (section view)
      g.clip(path)
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1
      const hatch = GLASS_IDS.indexOf(e.glass) + 2
      const x0 = zx(e.z) - 40, x1 = zx(e.z + autoThickness(e)) + 40
      for (let x = x0; x < x1; x += hatch * 2) { g.beginPath(); g.moveTo(x, yy(e.diameter / 2)); g.lineTo(x + 30, yy(-e.diameter / 2)); g.stroke() }
      g.restore()
      // rim handles
      for (const side of [1, 2] as const) {
        const z = side === 1 ? e.z + sag(e.c1, e.diameter / 2) : e.z + autoThickness(e) + sag(e.c2, e.diameter / 2)
        g.fillStyle = '#B8893A'
        g.beginPath(); g.arc(zx(z), yy(e.diameter / 2) - 7, 4.5, 0, 6.3); g.fill()
      }
    })
    // NO IMAGE stamp
    if (!profile.valid) {
      g.save(); g.translate(cssW * 0.5, cssH * 0.22); g.rotate(-0.12)
      g.strokeStyle = '#d8432c'; g.lineWidth = 3; g.strokeRect(-70, -18, 140, 36)
      g.fillStyle = '#d8432c'; g.font = 'bold 20px "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('NO IMAGE', 0, 1); g.restore()
    }
    drawSpot()
  }

  function drawSpot() {
    const R = 46
    const cx = cssW - R - 10, cy = cssH - R - 36
    g.save()
    g.beginPath(); g.arc(cx, cy, R, 0, 6.3); g.fillStyle = '#05070a'; g.fill()
    g.strokeStyle = '#B8893A'; g.lineWidth = 2; g.stroke()
    g.clip()
    const d = design()
    const scale = 50 * (R / 46) * 0.9 // 50× loupe, scaled to the disc
    const chs: Ch[] = laser ? [1] : [0, 1, 2]
    for (const [field, oy] of [[0, -14], [profile.fieldHalfDiagRad * 0.7, 18]] as const) {
      for (const ch of chs) {
        const pts = spotDiagram(d, field, ch, 8)
        g.fillStyle = laser ? RAY_COL[1] : RAY_COL[ch]
        g.globalAlpha = 0.8
        for (let i = 0; i < pts.length; i += 2) {
          const x = cx + pts[i] * scale, y = cy + oy - pts[i + 1] * scale
          g.fillRect(x - 0.6, y - 0.6, 1.2, 1.2)
        }
      }
    }
    g.globalAlpha = 1
    g.restore()
    g.fillStyle = 'rgba(237,232,220,0.7)'; g.font = '9px ui-monospace, monospace'; g.textAlign = 'center'
    g.fillText('SPOT ×50', cx, cy + R + 11)
    g.textAlign = 'left'
  }

  // ------------------------------------------------------------------ plate and selectors
  let prevPlate: Record<string, string> = {}
  function renderPlate() {
    const st = app.store.get()
    const p = profile
    const b = BODIES[st.camera.body]
    const fov = fovDeg(b.format[0], p.efl, st.ext)
    const rows: [string, string][] = [
      ['EFL', `${p.efl.toFixed(1)} mm`],
      ['APERTURE', p.pinhole ? `f/${Math.round(p.fNumber)}` : `f/${p.fNumber.toFixed(1)}${st.camera.lens.stop.kind === 'card' ? '♥' : ''}  T/${p.tStop.toFixed(1)}`],
      ['BACK FOCUS', `${p.bfd.toFixed(1)} mm`],
      ['LENGTH', `${p.lengthMm.toFixed(0)} mm`],
      ['MASS', `${Math.round(p.massG + b.massG)} g`],
      ['FIELD', `${fov.toFixed(0)}°`],
      ['DISTORTION', `${p.distortion.edgePct.toFixed(1)} %`],
      ['COLOUR', `${(p.longCA[0] - p.longCA[2]).toFixed(2)} mm`],
    ]
    const flags = [
      ['∞ OK', p.valid && Math.abs(collimate(st.camera.lens).shiftMm) < 0.5],
      ['MIRROR CLEAR', st.camera.body !== 'reflex' || p.rearZ <= -38],
      ['VALID', p.valid],
    ] as const
    const html = `<div class="lb-plate-head">QUIST · ${st.camera.name.toUpperCase()}</div>` +
      rows.map(([k, v]) => `<div class="lb-row${prevPlate[k] !== undefined && prevPlate[k] !== v ? ' lb-stamp' : ''}"><span>${k}</span><b>${v}</b></div>`).join('') +
      `<div class="lb-flags">${flags.map(([k, ok]) => `<span class="${ok ? 'ok' : 'bad'}">${k}</span>`).join('')}</div>`
    prevPlate = Object.fromEntries(rows)
    plate.innerHTML = html
  }

  function sel<T extends string>(label: string, val: T, opts: { v: T; t: string; locked?: boolean }[], on: (v: T) => void): HTMLElement {
    const wrap = document.createElement('label')
    wrap.className = 'lb-sel'
    wrap.innerHTML = `<span>${label}</span>`
    const s = document.createElement('select')
    for (const o of opts) { const op = document.createElement('option'); op.value = o.v; op.textContent = o.t + (o.locked ? ' (locked)' : ''); op.selected = o.v === val; s.appendChild(op) }
    s.addEventListener('change', () => { on(s.value as T); sfx.detent() })
    wrap.appendChild(s)
    return wrap
  }
  function renderSelects() {
    const st = app.store.get()
    const c = st.camera
    selects.innerHTML = ''
    selects.append(
      sel('Body', c.body, BODY_IDS.map((v) => ({ v, t: BODIES[v].name, locked: !app.unlocked(`body:${v}`) })), (v) => { app.setCamera({ body: v, shutter: BODIES[v].shutter }); profile = computeProfile(design(), fmt(), 'full'); renderAll() }),
      sel('Shutter', c.shutter, SHUTTER_IDS.map((v) => ({ v, t: SHUTTERS[v].name })), (v) => { app.setCamera({ shutter: v }); app.clampSpeed(); renderPlate() }),
      sel('Film', c.stock, STOCK_IDS.map((v) => ({ v, t: STOCKS[v].name, locked: !app.unlocked(`stock:${v}`) })), (v) => app.setCamera({ stock: v })),
      sel('Filter', c.filter, FILTER_IDS.map((v) => ({ v, t: FILTERS[v].name })), (v) => app.setCamera({ filter: v })),
    )
  }
  function renderPresets() {
    presetList.innerHTML = ''
    for (const id of PRESET_ORDER) {
      const b = document.createElement('button')
      b.className = 'lb-preset'
      const locked = !app.unlocked(`preset:${id}`)
      b.innerHTML = `<b>${PRESET_INFO[id].name}</b><span>${PRESET_INFO[id].f} mm · f/${PRESET_INFO[id].N}${locked ? ' · locked' : ''}</span>`
      b.disabled = locked
      b.addEventListener('click', () => { app.loadPreset(id); profile = app.profile(); fit(); renderAll(); sfx.tock() })
      presetList.appendChild(b)
    }
  }
  function renderTray() {
    tray.innerHTML = ''
    const glassUnlocked = app.unlocked('glass:crown')
    for (const bl of BLANKS) {
      const b = document.createElement('button')
      b.className = 'lb-blank'
      b.dataset.blank = bl.id
      b.disabled = !glassUnlocked
      b.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${blankIcon(bl.c1, bl.c2)}"/></svg><span>${bl.label}</span>`
      b.title = glassUnlocked ? `${bl.label}: drag onto the rail` : 'Locked: finish Tag 01'
      b.addEventListener('pointerdown', (e) => { if (b.disabled) return; e.preventDefault(); drag = { kind: 'new', blank: bl, el: b }; b.setPointerCapture(e.pointerId) })
      b.addEventListener('pointerup', (e) => { if (drag?.kind === 'new') { dropNew(bl, e.clientX, e.clientY); drag = null } })
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addElement(bl) } })
      tray.appendChild(b)
    }
    const stops: [string, string, () => void][] = [
      ['Iris', 'iris', () => setStopKind('iris')],
      ['Cut card', 'card', () => openCardPad()],
      ['Pinhole', 'pinhole', () => app.loadPreset('pinhole')],
    ]
    for (const [label, k, fn] of stops) {
      const b = document.createElement('button')
      b.className = 'lb-blank lb-stopblank'
      b.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="${k === 'iris' ? '6 3' : k === 'card' ? '2 2' : 'none'}"/><circle cx="20" cy="20" r="${k === 'pinhole' ? 1.5 : 6}" /></svg><span>${label}</span>`
      b.disabled = k !== 'pinhole' && !app.unlocked(k === 'iris' ? 'stop:iris' : 'stop:card')
      b.addEventListener('click', () => { fn(); profile = app.profile(); fit(); renderAll() })
      tray.appendChild(b)
    }
  }
  function blankIcon(c1: number, c2: number): string {
    const k = 260
    const a = 12 + c1 * k * 0.6, b = 28 + c2 * k * 0.6
    return `M${12 + Math.max(0, c1 * k * 0.2)} 6 Q${a} 20 ${12 + Math.max(0, c1 * k * 0.2)} 34 L${28 + Math.min(0, c2 * k * 0.2)} 34 Q${b} 20 ${28 + Math.min(0, c2 * k * 0.2)} 6 Z`
  }

  function setStopKind(kind: 'iris' | 'card') {
    const d = design()
    if (!d.elements.length) { app.loadPreset('meniscus'); return }
    const stop = { ...d.stop, kind, blades: d.stop.blades, card: kind === 'card' ? d.stop.card ?? heartCard() : undefined }
    setLens({ ...d, stop }, { full: true })
  }

  function addElement(bl: (typeof BLANKS)[number], zAt?: number) {
    const d = design()
    if (d.elements.length >= 6) { app.toast('Six elements is the most the rail holds.'); return }
    const base: LensDesign = d.stop.kind === 'pinhole' ? { v: 1, elements: [], stop: { z: -60, kind: 'iris', diameter: 12, blades: 0, roundness: 1 } } : d
    const e: ElementSpec = { id: `e${Date.now() % 100000}`, z: zAt ?? (Math.min(base.stop.z, ...base.elements.map((x) => x.z)) - 20), t: 0, c1: bl.c1, c2: bl.c2, diameter: bl.D, glass: 'crown', coating: 0 }
    e.t = autoThickness(e)
    const next: LensDesign = { v: 1, elements: [...base.elements, e], stop: { ...base.stop } }
    const idx = next.elements.length - 1
    const cz = clampElementZ(next, idx, e.z)
    next.elements[idx].z = cz.z
    selected = idx
    squash = 1
    sfx.tock()
    if (!app.store.get().progress.onboarded) app.markOnboarded()
    setLens(next, { full: true })
    app.noteOnce('crown', 'Crown bends red and blue apart. Watch the focus.')
  }
  function dropNew(bl: (typeof BLANKS)[number], cx: number, cy: number) {
    const r = canvas.getBoundingClientRect()
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) addElement(bl, Math.min(-5, xz(cx - r.left)))
    else addElement(bl)
  }

  // ------------------------------------------------------------------ card pad
  function openCardPad() {
    const dlg = document.createElement('dialog')
    dlg.className = 'lb-cardpad'
    dlg.innerHTML = `<p>Draw a closed shape. The stroke snaps shut.</p><canvas width="256" height="256"></canvas><div><button class="lb-chip" data-a="heart">Heart</button><button class="lb-chip" data-a="clear">Clear</button><button class="lb-chip" data-a="ok">Cut it</button><button class="lb-chip" data-a="cancel">Cancel</button></div>`
    document.body.appendChild(dlg)
    const pc = dlg.querySelector('canvas') as HTMLCanvasElement
    const pg = pc.getContext('2d') as CanvasRenderingContext2D
    const pts: [number, number][] = []
    const paint = () => {
      pg.fillStyle = '#111'; pg.fillRect(0, 0, 256, 256)
      pg.strokeStyle = '#555'; pg.beginPath(); pg.arc(128, 128, 126, 0, 6.3); pg.stroke()
      if (pts.length > 2) { pg.fillStyle = '#f4f1ea'; pg.beginPath(); pg.moveTo(pts[0][0], pts[0][1]); for (const p of pts) pg.lineTo(p[0], p[1]); pg.closePath(); pg.fill() }
    }
    paint()
    let down = false
    pc.addEventListener('pointerdown', (e) => { down = true; pts.length = 0; pc.setPointerCapture(e.pointerId) })
    pc.addEventListener('pointermove', (e) => { if (!down) return; const r = pc.getBoundingClientRect(); pts.push([((e.clientX - r.left) / r.width) * 256, ((e.clientY - r.top) / r.height) * 256]); paint() })
    pc.addEventListener('pointerup', () => { down = false })
    const finish = (card: string | null) => {
      dlg.close(); dlg.remove()
      if (!card) return
      const d = design()
      const base = d.elements.length ? d : (app.loadPreset('meniscus'), design())
      setLens({ ...base, stop: { ...base.stop, kind: 'card', card } }, { full: true, keepN: false })
      app.noteOnce('card', 'Any shape you cut is the shape of every blur.')
    }
    dlg.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).dataset.a
      if (a === 'heart') finish(heartCard())
      else if (a === 'clear') { pts.length = 0; paint() }
      else if (a === 'cancel') finish(null)
      else if (a === 'ok') {
        if (pts.length < 6) { finish(heartCard()); return }
        const bits = new Uint8Array(CARD_SIZE * CARD_SIZE)
        const img = pg.getImageData(0, 0, 256, 256).data
        for (let y = 0; y < CARD_SIZE; y++) for (let x = 0; x < CARD_SIZE; x++) {
          const px = Math.floor((x + 0.5) * 8), py = Math.floor((y + 0.5) * 8)
          bits[y * CARD_SIZE + x] = img[(py * 256 + px) * 4] > 128 ? 1 : 0
        }
        finish(encodeCard(bits))
      }
    })
    dlg.showModal()
  }

  // ------------------------------------------------------------------ input
  const hitElement = (x: number, y: number): { idx: number; part: 'body' | 1 | 2 } | null => {
    const d = design()
    for (let i = d.elements.length - 1; i >= 0; i--) {
      const e = d.elements[i]
      for (const side of [1, 2] as const) {
        const z = side === 1 ? e.z + sag(e.c1, e.diameter / 2) : e.z + autoThickness(e) + sag(e.c2, e.diameter / 2)
        if (Math.hypot(x - zx(z), y - (yy(e.diameter / 2) - 7)) < 14) return { idx: i, part: side }
      }
      if (g.isPointInPath(puckPath(e), x * dpr, y * dpr) || (x >= zx(e.z) - 8 && x <= zx(e.z + autoThickness(e)) + 8 && Math.abs(y - axisY()) <= (e.diameter / 2) * pxPerMm())) return { idx: i, part: 'body' }
    }
    return null
  }
  const local = (e: PointerEvent | WheelEvent | MouseEvent) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const }
  const holdTimer = { id: 0 }
  canvas.addEventListener('pointerdown', (e) => {
    sfx.unlock()
    const [x, y] = local(e)
    canvas.setPointerCapture(e.pointerId)
    const d = design()
    const sx = zx(d.stop.z)
    const h = hitElement(x, y)
    if (d.stop.kind === 'pinhole' && Math.abs(x - sx) < 22) {
      drag = { kind: 'needle', x0: x, y0: y, d0: d.stop.diameter }
      return
    }
    if (h) {
      selected = h.idx
      const el = d.elements[h.idx]
      if (h.part === 'body') {
        drag = { kind: 'slide', idx: h.idx, z0: el.z, x0: x, moved: false }
        window.clearTimeout(holdTimer.id)
        if (e.pointerType === 'touch') holdTimer.id = window.setTimeout(() => { if (drag?.kind === 'slide' && !drag.moved) { drag = null; openGlassMenu(h.idx, e.clientX, e.clientY) } }, 400)
      } else drag = { kind: 'bend', idx: h.idx, side: h.part, y0: y, c0: h.part === 1 ? el.c1 : el.c2 }
      redraw()
      return
    }
    if (Math.abs(x - sx) < 14 && d.stop.kind !== 'pinhole') { drag = { kind: 'stop', z0: d.stop.z, x0: x }; return }
    selected = -1
    drag = { kind: 'pan', x0: x, off0: view.off }
    redraw()
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return
    const [x, y] = local(e)
    const d = design()
    const fine = e.shiftKey ? 0.1 : 1
    if (drag.kind === 'slide') {
      const dz = ((x - drag.x0) / pxPerMm()) * fine
      if (Math.abs(x - drag.x0) > 3) { drag.moved = true; window.clearTimeout(holdTimer.id) }
      if (Math.abs(y - axisY()) > cssH * 0.48) return
      const next: LensDesign = { v: 1, elements: d.elements.map((el) => ({ ...el })), stop: { ...d.stop } }
      const want = drag.z0 + dz
      const c = clampElementZ(next, drag.idx, want)
      if (c.clamped && Math.abs(c.z - next.elements[drag.idx].z) < 0.05) sfx.clink(0.4)
      sfx.rub(Math.min(1, Math.abs(c.z - lastRubZ) / 6)); lastRubZ = c.z
      next.elements[drag.idx].z = c.z
      setLens(next)
    } else if (drag.kind === 'bend') {
      const dc = -((y - drag.y0) / 400) * 0.05 * fine
      const next: LensDesign = { v: 1, elements: d.elements.map((el) => ({ ...el })), stop: { ...d.stop } }
      const el = next.elements[drag.idx]
      const lim = 0.95 / (el.diameter / 2)
      const c = Math.max(-lim, Math.min(lim, drag.c0 + (drag.side === 1 ? dc : -dc)))
      if (drag.side === 1) el.c1 = c; else el.c2 = c
      el.t = autoThickness(el)
      // keep neighbours from overlapping
      const cz = clampElementZ(next, drag.idx, el.z)
      el.z = cz.z
      sfx.creak(Math.min(1, Math.abs(c) * 20))
      setLens(next)
    } else if (drag.kind === 'stop') {
      const z = Math.max(-640, Math.min(-2, drag.z0 + (x - drag.x0) / pxPerMm() * fine))
      setLens({ ...d, stop: { ...d.stop, z } })
    } else if (drag.kind === 'needle') {
      const dd = Math.max(0.2, Math.min(1.2, drag.d0 + ((x - drag.x0) - (y - drag.y0)) * 0.004))
      setPinhole(dd)
    } else if (drag.kind === 'pan') {
      view.off = drag.off0 + (x - drag.x0)
      redraw()
    }
  })
  const endDrag = (e: PointerEvent) => {
    window.clearTimeout(holdTimer.id)
    if (!drag) return
    const [, y] = local(e)
    if (drag.kind === 'slide' && (y > cssH - 4 || y < 4)) {
      const d = design()
      const next: LensDesign = { v: 1, elements: d.elements.filter((_, i) => i !== (drag as { idx: number }).idx), stop: { ...d.stop } }
      sfx.glug(); selected = -1
      setLens(next.elements.length ? next : { v: 1, elements: [], stop: { z: -100, kind: 'pinhole', diameter: 0.45, blades: 0, roundness: 1 } }, { full: true })
    } else if (drag.kind === 'slide' && drag.moved) sfx.tock()
    if (drag.kind === 'needle') { sfx.needle() }
    drag = null
    sfx.rub(0)
    profile = computeProfile(design(), fmt(), 'full')
    redraw(); renderPlate()
  }
  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)
  canvas.addEventListener('dblclick', (e) => {
    const [x, y] = local(e)
    const h = hitElement(x, y)
    if (!h) return
    const d = design()
    const next: LensDesign = { v: 1, elements: d.elements.map((el) => ({ ...el })), stop: { ...d.stop } }
    const el = next.elements[h.idx]
    const c1 = -el.c2, c2 = -el.c1
    el.c1 = c1; el.c2 = c2; el.t = autoThickness(el)
    sfx.tock()
    setLens(next, { full: true })
  })
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const [x, y] = local(e)
    const h = hitElement(x, y)
    if (h) openGlassMenu(h.idx, e.clientX, e.clientY)
  })
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const [x, y] = local(e)
    const d = design()
    const h = hitElement(x, y)
    if (h) {
      const next: LensDesign = { v: 1, elements: d.elements.map((el) => ({ ...el })), stop: { ...d.stop } }
      const el = next.elements[h.idx]
      el.diameter = Math.max(8, Math.min(80, el.diameter + (e.deltaY < 0 ? 2 : -2)))
      const lim = 0.95 / (el.diameter / 2)
      el.c1 = Math.max(-lim, Math.min(lim, el.c1)); el.c2 = Math.max(-lim, Math.min(lim, el.c2))
      el.t = autoThickness(el)
      sfx.detent()
      setLens(next, { full: true })
      return
    }
    if (Math.abs(x - zx(d.stop.z)) < 30) { stepAperture(e.deltaY > 0 ? 1 : -1); return }
    // zoom the rail about the pointer
    const z = xz(x)
    const k = e.deltaY > 0 ? 1.12 : 1 / 1.12
    view.zMin = z + (view.zMin - z) * k; view.zMax = z + (view.zMax - z) * k
    redraw()
  }, { passive: false })

  function openGlassMenu(idx: number, cx: number, cy: number) {
    document.querySelector('.lb-glassmenu')?.remove()
    const m = document.createElement('div')
    m.className = 'lb-glassmenu'
    m.style.left = `${Math.min(cx, innerWidth - 200)}px`; m.style.top = `${Math.min(cy, innerHeight - 260)}px`
    const d = design()
    for (const id of GLASS_IDS) {
      const b = document.createElement('button')
      const gl = GLASSES[id]
      const locked = !app.unlocked(`glass:${id}`)
      b.disabled = locked
      b.innerHTML = `<i style="background:${gl.tint}"></i>${gl.name} <small>${gl.code}</small>${locked ? ' 🔒' : ''}`
      b.addEventListener('click', () => { setGlass(idx, id); m.remove() })
      m.appendChild(b)
    }
    for (const c of [0, 1, 2] as const) {
      const b = document.createElement('button')
      b.innerHTML = `<i class="coat${c}"></i>${['Uncoated', 'Single coat', 'Multi coat'][c]}`
      b.addEventListener('click', () => {
        const next: LensDesign = { v: 1, elements: design().elements.map((el, i) => (i === idx ? { ...el, coating: c } : { ...el })), stop: { ...d.stop } }
        setLens(next, { full: true }); m.remove()
      })
      m.appendChild(b)
    }
    document.body.appendChild(m)
    const close = (ev: PointerEvent) => { if (!m.contains(ev.target as Node)) { m.remove(); window.removeEventListener('pointerdown', close, true) } }
    window.setTimeout(() => window.addEventListener('pointerdown', close, true), 0)
  }
  function setGlass(idx: number, id: GlassId) {
    const d = design()
    const next: LensDesign = { v: 1, elements: d.elements.map((el, i) => (i === idx ? { ...el, glass: id } : { ...el })), stop: { ...d.stop } }
    sfx.tock()
    if (id === 'flint' || id === 'lightFlint' || id === 'denseFlint') app.noteOnce('flint', 'Crown bends red and blue apart. Flint bends them apart more. Put them back to back and they argue themselves straight.')
    setLens(next, { full: true })
  }
  function stepAperture(dir: number) {
    const st = app.store.get()
    const d = design()
    if (d.stop.kind === 'pinhole') { const i = Math.max(0, Math.min(GAUGES.length - 1, GAUGES.findIndex((x) => x >= d.stop.diameter - 1e-6) + dir)); setPinhole(GAUGES[i]); return }
    let i = F_STOPS.findIndex((n) => n >= st.fNumber - 0.01)
    if (i < 0) i = F_STOPS.length - 1
    i = Math.max(0, Math.min(F_STOPS.length - 1, i + dir))
    app.setAperture(F_STOPS[i])
    profile = app.profile()
    sfx.detent()
    if (F_STOPS[i] > 22) app.noteOnce('sulk', 'Smaller hole, softer picture. Light is a wave and it sulks in tight spaces.')
    redraw(); renderPlate()
  }
  function setPinhole(dMm: number) {
    const d = design()
    const next: LensDesign = { v: 1, elements: [], stop: { ...d.stop, kind: 'pinhole', diameter: dMm } }
    app.setCamera({ lens: next })
    app.store.set({ fNumber: -next.stop.z / dMm })
    profile = computeProfile(next, fmt(), 'full')
    const opt = pinholeOptimum(-next.stop.z, 'rayleigh').dMm
    if (Math.abs(dMm - opt) / opt < 0.08 && performance.now() - lastChime > 800) { sfx.chime(); lastChime = performance.now() }
    redraw(); renderPlate()
  }

  root.querySelector('.lb-bench-tools')?.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.act
    if (a === 'light') toggleLight()
    else if (a === 'field') { offAxis = !offAxis; redraw() }
    else if (a === 'collimate') doCollimate()
    else if (a === 'fit') { fit(); redraw() }
  })
  root.querySelector('.lb-share')?.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.act
    if (a === 'share') app.share()
    else if (a === 'save') app.saveDesign()
  })
  function toggleLight() {
    laser = !laser
    const b = root.querySelector('[data-act="light"]') as HTMLElement
    b.textContent = laser ? 'Laser (d)' : 'White light'
    redraw()
  }
  function doCollimate() {
    const c = collimate(design())
    if (Math.abs(c.shiftMm) > 0.01) app.toast(`Collimated: the group moved ${c.shiftMm.toFixed(1)} mm.`)
    sfx.clink(0.8)
    setLens(c.design, { full: true })
  }
  const onKey = (e: KeyboardEvent) => {
    if (!active || e.defaultPrevented) return
    const t = e.target as HTMLElement
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
    if (e.key === 'l' || e.key === 'L') toggleLight()
    else if (e.key === 'f' || e.key === 'F') { offAxis = !offAxis; redraw() }
    else if (e.key === 'c' || e.key === 'C') doCollimate()
    else if (e.key === 'z' || e.key === 'Z') { fit(); redraw() }
    else if (e.key === '[') stepAperture(-1)
    else if (e.key === ']') stepAperture(1)
    else if (e.key === 'b' || e.key === 'B') {
      const d = design()
      if (d.stop.kind !== 'iris') return
      const seq = [0, 5, 6, 8, 9] as const
      const nb = seq[(seq.indexOf(d.stop.blades) + 1) % seq.length]
      setLens({ ...d, stop: { ...d.stop, blades: nb, roundness: nb ? 0.15 : 1 } }, { full: true })
      sfx.detent()
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected >= 0) {
      const d = design()
      const next: LensDesign = { v: 1, elements: d.elements.filter((_, i) => i !== selected), stop: { ...d.stop } }
      selected = -1
      setLens(next.elements.length ? next : { v: 1, elements: [], stop: { z: -100, kind: 'pinhole', diameter: 0.45, blades: 0, roundness: 1 } }, { full: true })
    }
  }
  window.addEventListener('keydown', onKey)
  const ro = new ResizeObserver(() => { if (active) resize() })
  ro.observe(tank)

  function renderAll() { renderPlate(); renderSelects(); renderPresets(); renderTray(); redraw() }
  const unsub = app.store.on('camera', () => { if (!drag) { profile = app.profile(); if (active) { renderPlate(); redraw() } } })
  const unsubP = app.store.on('progress', () => { if (active) { renderTray(); renderPresets(); renderSelects(); if (app.store.get().progress.onboarded) qnote.hidden = true } })

  const scr: BenchScreen = {
    canvas, get laser() { return laser }, set laser(v: boolean) { laser = v },
    redraw: () => { profile = app.profile(); renderAll() },
    enter() {
      active = true
      root.hidden = false
      profile = app.profile()
      resize()
      renderAll()
      app.gl.attachTo(ggView)
      const st = app.store.get()
      if (!st.progress.onboarded) {
        qnote.hidden = false
        qnote.innerHTML = `<span class="lb-hand">No glass, no lies. — Q.</span><small>Drag the needle to open the pinhole.</small>`
      } else qnote.hidden = true
    },
    exit() { active = false; root.hidden = true; drag = null; app.gl.attachTo(null) },
    update(dt: number) {
      if (!active) return
      if (dirtyFull && !drag && performance.now() - lastFull > 150) {
        dirtyFull = false
        profile = computeProfile(design(), fmt(), 'full')
        renderPlate(); redraw()
      }
      if (squash > 0) squash = Math.max(0, squash - dt * 6)
      app.renderGroundGlass(dt, ggView)
    },
    dispose() { window.removeEventListener('keydown', onKey); ro.disconnect(); unsub(); unsubP() },
  }
  return scr
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
