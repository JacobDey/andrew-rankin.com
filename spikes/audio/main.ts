// Demo page for the procedural audio kit: every sound with its params, live scope,
// scenes, a drag pad for the continuous sounds, offline spectrogram thumbnails, a CPU bench.
import { Audio, Synth, GrainStream } from './core'
import type { LoopHandle, LoopDef, ParamSpec, Params, SoundDef, Quality } from './core'
import { analyze, benchReference, benchScene, renderOffline, spectrogram, type BenchResult, type SoundStats, type Spectrogram } from './core/analysis'
import { SCENES, STRESS } from './scenes'

Audio.arm()

// ---------------- tiny DOM helper ----------------
type Kid = Node | string | null | undefined | false
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k]
    else if (k === 'text') e.textContent = attrs[k]
    else e.setAttribute(k, attrs[k])
  }
  for (const c of kids) if (c) e.append(c)
  return e
}
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

// ---------------- param <-> slider ----------------
const SL = 1000
function toSlider(sp: ParamSpec, v: number): number {
  if (sp.log) return (Math.log(v / sp.min) / Math.log(sp.max / sp.min)) * SL
  return ((v - sp.min) / (sp.max - sp.min)) * SL
}
function fromSlider(sp: ParamSpec, x: number): number {
  let v = sp.log ? sp.min * Math.pow(sp.max / sp.min, x / SL) : sp.min + ((sp.max - sp.min) * x) / SL
  if (sp.step && !sp.log) v = Math.round(v / sp.step) * sp.step
  return v
}
function fmt(sp: ParamSpec, v: number): string {
  if (sp.options) return sp.options[Math.round(v)] ?? String(v)
  if (sp.unit === 's' && sp.log && v < 0.5) return `1/${Math.round(1 / v)} s`
  const d = sp.step !== undefined && sp.step >= 1 ? 0 : Math.abs(v) >= 100 ? 0 : 2
  return v.toFixed(d) + (sp.unit ? ' ' + sp.unit : '')
}

// ---------------- audio helpers ----------------
async function ensureAudio(): Promise<boolean> {
  if (Audio.ready) return true
  return Audio.init()
}

// ---------------- header controls ----------------
const controls = $('controls')
const startBtn = el('button', { class: 'btn primary', text: 'Start sound' })
startBtn.addEventListener('click', () => void ensureAudio())
const muteBtn = el('button', { class: 'btn', 'aria-pressed': 'false' })
const syncMute = (): void => {
  muteBtn.textContent = Audio.muted ? 'Sound off' : 'Sound on'
  muteBtn.setAttribute('aria-pressed', String(Audio.muted))
  muteBtn.classList.toggle('on', !Audio.muted)
}
muteBtn.addEventListener('click', () => {
  Audio.setMuted(!Audio.muted)
  if (!Audio.muted) Audio.play('ui.switch')
})
const vol = el('input', { type: 'range', min: '0', max: '1', step: '0.01', 'aria-label': 'Master volume' })
vol.value = String(Audio.volume)
vol.addEventListener('input', () => Audio.setVolume(Number(vol.value)))
Audio.onChange(() => {
  syncMute()
  vol.value = String(Audio.volume)
})
const quality = el('select', { 'aria-label': 'Quality' }, el('option', { value: 'high', text: 'High quality' }), el('option', { value: 'low', text: 'Low (phones)' }))
quality.addEventListener('change', () => Audio.setQuality(quality.value as Quality))
const cloth = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '0', 'aria-label': 'Dark cloth muffle' })
cloth.addEventListener('input', () => {
  const x = Number(cloth.value)
  Audio.setMuffle(x <= 0.001 ? 20000 : 20000 * Math.pow(600 / 20000, x))
})
const room = el('input', { type: 'checkbox', 'aria-label': 'Room reverb' })
room.addEventListener('change', () => Audio.setRoom(room.checked ? { rt60: 0.45, wet: 0.3 } : null))
controls.append(
  startBtn,
  muteBtn,
  el('label', { class: 'ctl' }, 'Volume', vol),
  el('label', { class: 'ctl' }, quality),
  el('label', { class: 'ctl' }, 'Dark cloth', cloth),
  el('label', { class: 'ctl' }, room, 'Room'),
)
syncMute()
Audio.onReady(() => {
  startBtn.textContent = 'Sound running'
  startBtn.classList.remove('primary')
  startBtn.disabled = true
  quality.value = Audio.quality
})

// ---------------- scope ----------------
const scope = $<HTMLCanvasElement>('scope')
const sctx = scope.getContext('2d')!
let lastRms = 0
let tdBuf: Float32Array<ArrayBuffer> | null = null
let fBuf: Uint8Array<ArrayBuffer> | null = null
function drawScope(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = Math.round(scope.clientWidth * dpr)
  const H = Math.round(scope.clientHeight * dpr)
  if (scope.width !== W || scope.height !== H) {
    scope.width = W
    scope.height = H
  }
  sctx.fillStyle = '#0a0606'
  sctx.fillRect(0, 0, W, H)
  const an = Audio.ready ? Audio.analyser() : null
  if (!an) {
    sctx.fillStyle = '#b39d8f'
    sctx.font = `${13 * dpr}px system-ui, sans-serif`
    sctx.textAlign = 'center'
    sctx.fillText('Tap anywhere to start sound', W / 2, H / 2 + 4 * dpr)
    requestAnimationFrame(drawScope)
    return
  }
  if (!tdBuf || tdBuf.length !== an.fftSize) tdBuf = new Float32Array(an.fftSize)
  if (!fBuf || fBuf.length !== an.frequencyBinCount) fBuf = new Uint8Array(an.frequencyBinCount)
  an.getFloatTimeDomainData(tdBuf)
  an.getByteFrequencyData(fBuf)
  const split = Math.round(W * 0.58)
  // waveform
  let ss = 0
  sctx.strokeStyle = '#ffb35c'
  sctx.lineWidth = 1.2 * dpr
  sctx.beginPath()
  for (let i = 0; i < tdBuf.length; i++) {
    const v = tdBuf[i]
    ss += v * v
    const x = (i / (tdBuf.length - 1)) * (split - 8 * dpr)
    const y = H / 2 - v * H * 0.9
    if (i) sctx.lineTo(x, y)
    else sctx.moveTo(x, y)
  }
  sctx.stroke()
  lastRms = Math.sqrt(ss / tdBuf.length)
  // spectrum, log-x
  const sr = Audio.context?.sampleRate ?? 48000
  const bars = 64
  const bw = (W - split) / bars
  for (let b = 0; b < bars; b++) {
    const f0 = 40 * Math.pow(18000 / 40, b / bars)
    const f1 = 40 * Math.pow(18000 / 40, (b + 1) / bars)
    const k0 = Math.floor((f0 / (sr / 2)) * fBuf.length)
    const k1 = Math.max(k0 + 1, Math.floor((f1 / (sr / 2)) * fBuf.length))
    let m = 0
    for (let k = k0; k < k1 && k < fBuf.length; k++) m = Math.max(m, fBuf[k])
    const h = (m / 255) * H
    sctx.fillStyle = colormap(m / 255)
    sctx.fillRect(split + b * bw, H - h, Math.max(1, bw - 1), h)
  }
  requestAnimationFrame(drawScope)
}
requestAnimationFrame(drawScope)

// ---------------- stat line ----------------
const statline = $('statline')
let lastNodes = 0
let lastT = performance.now()
let thumbMsg = ''
setInterval(() => {
  const st = Audio.stats()
  const now = performance.now()
  const nps = ((st.nodesCreated - lastNodes) * 1000) / (now - lastT)
  lastNodes = st.nodesCreated
  lastT = now
  statline.textContent = [
    `ctx ${st.state}`,
    st.sampleRate ? `${st.sampleRate} Hz` : '',
    st.sampleRate ? `latency ${(st.baseLatency * 1000).toFixed(1)}+${(st.outputLatency * 1000).toFixed(1)} ms` : '',
    `voices ${st.voices}`,
    `loops ${st.loops}`,
    `nodes ${st.nodesCreated} (${nps.toFixed(0)}/s)`,
    `play ${st.playCostMs.toFixed(3)} ms`,
    `tick ${st.tickCostMs.toFixed(3)} ms`,
    `out ${lastRms > 0 ? (20 * Math.log10(lastRms)).toFixed(1) : '-inf'} dBFS`,
    st.quality,
    thumbMsg,
  ]
    .filter(Boolean)
    .join(' · ')
}, 250)

// ---------------- scenes ----------------
interface SceneRun {
  handles: LoopHandle[]
  timers: number[]
}
const sceneRuns = new Map<string, SceneRun>()
const scenesEl = $('scenes')
const sceneBtns = new Map<string, HTMLButtonElement>()
function stopScene(name: string): void {
  const run = sceneRuns.get(name)
  if (!run) return
  for (const h of run.handles) h.stop(0.6)
  for (const t of run.timers) clearTimeout(t)
  sceneRuns.delete(name)
  sceneBtns.get(name)?.classList.remove('on')
}
async function startScene(name: string): Promise<void> {
  const sc = SCENES.find((s) => s.name === name)
  if (!sc) return
  for (const k of [...sceneRuns.keys()]) stopScene(k)
  await ensureAudio()
  const run: SceneRun = { handles: [], timers: [] }
  for (const l of sc.loops) run.handles.push(Audio.loop(l.id, l.params ?? {}, { fadeIn: 0.8 }))
  for (const e of sc.events ?? []) {
    const fire = (): void => {
      Audio.play(e.id, e.params ?? {})
      run.timers.push(window.setTimeout(fire, (e.every[0] + Math.random() * (e.every[1] - e.every[0])) * 1000))
    }
    run.timers.push(window.setTimeout(fire, Math.random() * e.every[1] * 1000))
  }
  sceneRuns.set(name, run)
  sceneBtns.get(name)?.classList.add('on')
}
const benchOut = el('pre', { class: 'stats', style: 'white-space:pre-wrap;margin:8px 0 0' })
const benchBtn = el('button', { class: 'btn small', text: 'Run CPU benchmark' })
benchBtn.addEventListener('click', () => void runBench(10, 1))
const chips = el('div', { class: 'chips' })
for (const sc of SCENES) {
  const b = el('button', { class: 'btn', text: sc.name })
  b.addEventListener('click', () => (sceneRuns.has(sc.name) ? stopScene(sc.name) : void startScene(sc.name)))
  sceneBtns.set(sc.name, b)
  chips.append(b)
}
chips.append(benchBtn)
scenesEl.append(el('h2', { text: 'Scenes' }), chips, benchOut)

async function runBench(dur: number, q: 0 | 1): Promise<Array<BenchResult & { voiceEq: number }>> {
  benchBtn.disabled = true
  benchOut.textContent = 'Rendering scenes offline (best of 3 each)…'
  const ref = await benchReference(dur, 20, 44100, 3)
  const res: Array<BenchResult & { voiceEq: number }> = []
  for (const sc of [...SCENES, STRESS]) {
    const r = await benchScene((id) => Audio.def(id), sc, dur, { quality: q, reps: 3 })
    res.push({ ...r, voiceEq: (r.wallMs / ref) * 20 })
    benchOut.textContent =
      `reference: 20 filtered-noise voices = ${((ref / (dur * 1000)) * 100).toFixed(2)}% of a core\n` +
      res
        .map((r) => `${r.name.padEnd(20)} ${r.rtf.toFixed(0).padStart(5)}x real time  ≈${(r.coreShare * 100).toFixed(2)}% core  ≈${r.voiceEq.toFixed(0)} voices  ${r.nodes} nodes/${r.audioSec}s`)
        .join('\n')
  }
  benchBtn.disabled = false
  return res
}

// ---------------- drag pad ----------------
interface PadTarget {
  label: string
  loop: string
  params?: Params
  drive: string
  signed?: boolean
  decay?: number
  tap?: [string, Params]
  y?: string
}
const PAD: PadTarget[] = [
  { label: 'Marble on tin mailbox', loop: 'marble.roll', params: { roughness: 0.55, hardness: 0.9, hollow: 0.8 }, drive: 'speed', tap: ['marble.clack', { surface: 1 }], y: 'roughness' },
  { label: 'Marble on wood', loop: 'marble.roll', params: { roughness: 0.25, hardness: 0.6, hollow: 0 }, drive: 'speed', tap: ['marble.clack', { surface: 2 }] },
  { label: 'Fine cloth', loop: 'cloth.rustle', params: { roughness: 0.1 }, drive: 'speed' },
  { label: 'Rough cloth', loop: 'cloth.rustle', params: { roughness: 0.85 }, drive: 'speed' },
  { label: 'Rock the tray', loop: 'liquid.slosh', drive: 'energy', decay: 0.97, tap: ['liquid.lap', {}] },
  { label: 'Pour', loop: 'liquid.pour', drive: 'flow', y: 'fill', decay: 0.9 },
  { label: 'Bellows', loop: 'bellows', drive: 'rate', signed: true },
  { label: 'Focus ring', loop: 'focus.ring', params: { grease: 0.5 }, drive: 'velocity', signed: true },
  { label: 'Rewind crank', loop: 'film.rewind', drive: 'speed', decay: 0.93 },
  { label: 'Geiger (hover the hot spot)', loop: 'geiger', drive: 'rate' },
]
const padPanel = $('pad-panel')
const pad = el('canvas', { id: 'pad', 'aria-label': 'Drag pad: drag to drive the selected continuous sound' })
const padRow = el('div', { class: 'pad-row' })
let padIdx = 0
let padHandle: LoopHandle | null = null
const padBtns: HTMLButtonElement[] = []
PAD.forEach((pt, i) => {
  const b = el('button', { class: 'btn small' + (i === 0 ? ' on' : ''), text: pt.label })
  b.addEventListener('click', () => {
    padBtns[padIdx].classList.remove('on')
    padIdx = i
    b.classList.add('on')
    padHandle?.stop(0.2)
    padHandle = null
  })
  padBtns.push(b)
  padRow.append(b)
})
padPanel.append(
  el('h2', { text: 'Drag pad' }),
  padRow,
  pad,
  el('p', { class: 'pad-note', text: 'Drag speed drives the sound (direction for bellows and focus; height sets roughness or fill). Tap for a clack or a lap. Works with mouse and touch.' }),
)
const pctx = pad.getContext('2d')!
let drive = 0
let driveSign = 1
let pdown = false
let lastP: { x: number; y: number; t: number } | null = null
let ptr = { x: 0.5, y: 0.5 }
let moved = 0
const trail: Array<{ x: number; y: number; t: number }> = []
function padHandleFor(): LoopHandle {
  const pt = PAD[padIdx]
  if (!padHandle || padHandle.stopped) padHandle = Audio.loop(pt.loop, { ...(pt.params ?? {}), [pt.drive]: 0 })
  return padHandle
}
pad.addEventListener('pointerdown', (e) => {
  pad.setPointerCapture(e.pointerId)
  pdown = true
  moved = 0
  const r = pad.getBoundingClientRect()
  lastP = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }
  void ensureAudio().then(() => padHandleFor())
})
pad.addEventListener('pointermove', (e) => {
  const r = pad.getBoundingClientRect()
  const x = e.clientX - r.left
  const y = e.clientY - r.top
  ptr = { x: x / r.width, y: y / r.height }
  const now = performance.now()
  if (PAD[padIdx].loop === 'geiger') return
  if (!pdown || !lastP) return
  const dt = Math.max(1, now - lastP.t) / 1000
  const dx = x - lastP.x
  const dy = y - lastP.y
  const v = Math.hypot(dx, dy) / dt / (r.width * 1.5)
  moved += Math.hypot(dx, dy)
  drive = drive * 0.6 + Math.min(1, v) * 0.4
  if (Math.abs(dx) > 0.5) driveSign = dx > 0 ? 1 : -1
  lastP = { x, y, t: now }
  trail.push({ x: x / r.width, y: y / r.height, t: now })
})
const endPad = (): void => {
  pdown = false
  const pt = PAD[padIdx]
  if (moved < 6 && pt.tap) Audio.play(pt.tap[0], { ...pt.tap[1], velocity: 0.7, intensity: 0.8 })
}
pad.addEventListener('pointerup', endPad)
pad.addEventListener('pointercancel', endPad)
function padFrame(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = Math.round(pad.clientWidth * dpr)
  const H = Math.round(pad.clientHeight * dpr)
  if (pad.width !== W || pad.height !== H) {
    pad.width = W
    pad.height = H
  }
  const pt = PAD[padIdx]
  const now = performance.now()
  if (pt.loop === 'geiger') {
    const d = Math.hypot(ptr.x - 0.75, (ptr.y - 0.5) * (H / W))
    drive = Math.max(0, Math.min(1, 1 - d * 2.2))
  } else if (!pdown || (lastP && now - lastP.t > 60)) drive *= pt.decay ?? 0.85
  if (padHandle && !padHandle.stopped) {
    padHandle.set(pt.drive, pt.signed ? drive * driveSign : drive)
    if (pt.y) padHandle.set(pt.y, Math.max(0, Math.min(1, 1 - ptr.y)))
  } else if (pt.loop === 'geiger' && Audio.ready) padHandleFor()
  pctx.fillStyle = '#120c0b'
  pctx.fillRect(0, 0, W, H)
  if (pt.loop === 'geiger') {
    const g = pctx.createRadialGradient(W * 0.75, H * 0.5, 0, W * 0.75, H * 0.5, W * 0.4)
    g.addColorStop(0, 'rgba(143,209,138,0.35)')
    g.addColorStop(1, 'rgba(143,209,138,0)')
    pctx.fillStyle = g
    pctx.fillRect(0, 0, W, H)
  }
  while (trail.length && now - trail[0].t > 700) trail.shift()
  for (let i = 1; i < trail.length; i++) {
    const a = 1 - (now - trail[i].t) / 700
    pctx.strokeStyle = `rgba(255,${120 + 80 * a | 0},80,${a})`
    pctx.lineWidth = (2 + 10 * a) * dpr
    pctx.lineCap = 'round'
    pctx.beginPath()
    pctx.moveTo(trail[i - 1].x * W, trail[i - 1].y * H)
    pctx.lineTo(trail[i].x * W, trail[i].y * H)
    pctx.stroke()
  }
  pctx.fillStyle = colormap(0.3 + 0.7 * Math.abs(drive))
  pctx.fillRect(0, H - 6 * dpr, W * Math.abs(drive), 6 * dpr)
  pctx.fillStyle = '#b39d8f'
  pctx.font = `${12 * dpr}px ui-monospace, monospace`
  pctx.textAlign = 'left'
  pctx.fillText(`${pt.label} · ${pt.drive} ${(pt.signed ? drive * driveSign : drive).toFixed(2)}`, 10 * dpr, 20 * dpr)
  requestAnimationFrame(padFrame)
}
requestAnimationFrame(padFrame)

// ---------------- cards ----------------
interface Card {
  def: SoundDef
  params: Params
  root: HTMLElement
  canvas: HTMLCanvasElement
  statsEl: HTMLElement
  handle: LoopHandle | null
  btn: HTMLButtonElement
  stats?: SoundStats & { nodes: number; wallMs: number; renderDur: number }
}
const cards = new Map<string, Card>()
const groupsEl = $('groups')
const byGroup = new Map<string, SoundDef[]>()
for (const d of Audio.list()) {
  if (!byGroup.has(d.group)) byGroup.set(d.group, [])
  byGroup.get(d.group)!.push(d)
}
for (const [g, defs] of byGroup) {
  groupsEl.append(el('div', { class: 'group' }, el('h2', { text: g }), el('span', { class: 'count', text: `${defs.length} sounds` })))
  const grid = el('div', { class: 'grid' })
  for (const d of defs) grid.append(makeCard(d))
  groupsEl.append(grid)
}

function makeCard(def: SoundDef): HTMLElement {
  const params: Params = {}
  const canvas = el('canvas', { class: 'spec', width: '320', height: '64', 'aria-hidden': 'true' })
  const statsEl = el('div', { class: 'stats', text: 'rendering…' })
  const btn = el('button', { class: 'btn small', text: def.kind === 'loop' ? 'Start' : 'Play' })
  const root = el(
    'article',
    { class: 'card', 'data-id': def.id },
    el('div', { class: 'card-head' }, el('div', {}, el('h3', { text: def.label }), el('code', { text: def.id })), el('span', { class: 'kind' + (def.kind === 'loop' ? ' loop' : ''), text: def.kind === 'loop' ? 'loop' : 'one-shot' })),
    el('div', { class: 'tags' }, ...def.games.map((g) => el('span', { class: 'tag', text: g }))),
    canvas,
    statsEl,
    def.desc ? el('p', { class: 'desc', text: def.desc }) : null,
  )
  const card: Card = { def, params, root, canvas, statsEl, handle: null, btn }
  const ps = el('div', { class: 'params' })
  let rerender = 0
  for (const name in def.params ?? {}) {
    const sp = def.params![name]
    params[name] = sp.default
    const label = el('label', { text: sp.label ?? name })
    const out = el('output', { text: fmt(sp, sp.default) })
    let input: HTMLInputElement | HTMLSelectElement
    if (sp.options) {
      const sel = el('select', { 'aria-label': `${def.label} ${name}` })
      sp.options.forEach((o, i) => sel.append(el('option', { value: String(i), text: o })))
      sel.value = String(sp.default)
      input = sel
    } else {
      const r = el('input', { type: 'range', min: '0', max: String(SL), step: '1', 'aria-label': `${def.label} ${name}` })
      r.value = String(toSlider(sp, sp.default))
      input = r
    }
    input.addEventListener('input', () => {
      const v = sp.options ? Number(input.value) : fromSlider(sp, Number(input.value))
      params[name] = v
      out.textContent = fmt(sp, v)
      card.handle?.set(name, v)
      if (def.kind === 'oneshot') {
        clearTimeout(rerender)
        rerender = window.setTimeout(() => void thumb(card), 250)
      }
    })
    ps.append(label, input, out)
  }
  btn.addEventListener('click', async () => {
    await ensureAudio()
    if (def.kind === 'oneshot') {
      Audio.play(def.id, { ...params })
      root.classList.add('playing')
      setTimeout(() => root.classList.remove('playing'), 250)
    } else if (card.handle && !card.handle.stopped) {
      card.handle.stop()
      card.handle = null
      btn.textContent = 'Start'
      root.classList.remove('playing')
    } else {
      card.handle = Audio.loop(def.id, { ...params })
      btn.textContent = 'Stop'
      root.classList.add('playing')
    }
  })
  root.append(el('div', { class: 'actions' }, btn), ps)
  cards.set(def.id, card)
  return root
}

// ---------------- offline thumbnails ----------------
const CMAP: Array<[number, number, number, number]> = [
  [0, 10, 6, 6],
  [0.25, 70, 12, 10],
  [0.5, 200, 45, 25],
  [0.7, 255, 110, 50],
  [0.85, 255, 180, 92],
  [1, 255, 243, 214],
]
function cmapRGB(u: number): [number, number, number] {
  u = Math.max(0, Math.min(1, u))
  for (let i = 1; i < CMAP.length; i++) {
    if (u <= CMAP[i][0]) {
      const [a0, r0, g0, b0] = CMAP[i - 1]
      const [a1, r1, g1, b1] = CMAP[i]
      const t = (u - a0) / (a1 - a0)
      return [r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t]
    }
  }
  return [255, 243, 214]
}
function colormap(u: number): string {
  const [r, g, b] = cmapRGB(u)
  return `rgb(${r | 0},${g | 0},${b | 0})`
}
const scratch = document.createElement('canvas')
function drawSpec(cv: HTMLCanvasElement, sp: Spectrogram): void {
  scratch.width = sp.cols
  scratch.height = sp.bins
  const sctx2 = scratch.getContext('2d')!
  const img = sctx2.createImageData(sp.cols, sp.bins)
  for (let c = 0; c < sp.cols; c++) {
    for (let b = 0; b < sp.bins; b++) {
      const [r, g, bl] = cmapRGB(sp.data[c * sp.bins + b])
      const o = ((sp.bins - 1 - b) * sp.cols + c) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = bl
      img.data[o + 3] = 255
    }
  }
  sctx2.putImageData(img, 0, 0)
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(scratch, 0, 0, cv.width, cv.height)
  ctx.strokeStyle = 'rgba(255,243,214,0.55)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let c = 0; c < sp.cols; c++) {
    const x = ((c + 0.5) / sp.cols) * cv.width
    const y = cv.height - sp.env[c] * cv.height
    if (c) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.stroke()
}
async function thumb(card: Card): Promise<void> {
  try {
    const r = await renderOffline(card.def, card.params, { seed: 7 })
    const st = analyze(r.buffer)
    const sp = spectrogram(r.buffer, 160, 48)
    drawSpec(card.canvas, sp)
    card.stats = { ...st, nodes: r.nodes, wallMs: r.wallMs, renderDur: r.dur }
    const warn = st.nan ? ' NaN!' : st.clipped ? ' CLIP' : st.peakDb < -40 ? ' quiet' : ''
    const loop = card.def.kind === 'loop' ? ` (${r.dur}s preview${(card.def as LoopDef).preview?.auto ? ', driven' : ''})` : ''
    card.statsEl.innerHTML = ''
    card.statsEl.append(
      `peak ${st.peakDb.toFixed(1)} dB · rms ${st.rmsDb.toFixed(1)} · ${st.dur.toFixed(2)} s · ${r.nodes} nodes · ${(st.centroid / 1000).toFixed(1)} kHz${loop}`,
      warn ? el('span', { class: 'warn', text: warn }) : '',
    )
  } catch (e) {
    card.statsEl.textContent = 'render failed: ' + String(e)
    console.error(card.def.id, e)
  }
}
let thumbsDone = false
async function renderAllThumbs(): Promise<void> {
  const t0 = performance.now()
  for (const c of cards.values()) {
    await thumb(c)
  }
  thumbsDone = true
  thumbMsg = `${cards.size} sounds rendered offline in ${((performance.now() - t0) / 1000).toFixed(1)} s`
}
const query = new URLSearchParams(location.search)
if (query.has('nothumbs')) thumbsDone = true
else void renderAllThumbs()

// ---------------- test hooks ----------------
const handles = new Map<string, LoopHandle>()
declare global {
  interface Window {
    __spike: Record<string, unknown>
  }
}
window.__spike = {
  Audio,
  lib: { Synth, GrainStream, benchReference, benchScene },
  ids: () => Audio.list().map((d) => d.id),
  init: () => Audio.init(),
  ready: () => Audio.ready,
  play: (id: string, p: Params = {}) => !!Audio.play(id, p),
  loop: (id: string, p: Params = {}) => {
    const h = Audio.loop(id, p)
    handles.set(id, h)
    return h.playing
  },
  set: (id: string, name: string, v: number) => handles.get(id)?.set(name, v).get(name),
  get: (id: string, name: string) => handles.get(id)?.get(name),
  stop: (id: string) => handles.get(id)?.stop(),
  stats: () => Audio.stats(),
  level: () => (lastRms > 0 ? 20 * Math.log10(lastRms) : -Infinity),
  thumbsDone: () => thumbsDone,
  results: () =>
    [...cards.values()].map((c) => ({
      id: c.def.id,
      kind: c.def.kind,
      peakDb: c.stats ? +c.stats.peakDb.toFixed(1) : null,
      rmsDb: c.stats ? +c.stats.rmsDb.toFixed(1) : null,
      dur: c.stats ? +c.stats.dur.toFixed(2) : null,
      nodes: c.stats?.nodes ?? null,
      centroid: c.stats ? Math.round(c.stats.centroid) : null,
      nan: c.stats?.nan ?? null,
      renderMs: c.stats ? +c.stats.wallMs.toFixed(1) : null,
    })),
  render: async (id: string, p: Params = {}, q: 0 | 1 = 1) => {
    const d = Audio.def(id)
    if (!d) return null
    const r = await renderOffline(d, p, { quality: q })
    return { ...analyze(r.buffer), nodes: r.nodes, wallMs: r.wallMs }
  },
  bench: (dur = 10, q: 0 | 1 = 1) => runBench(dur, q),
  /** Each loop alone vs the reference (20 filtered-noise voices): cost in voice-equivalents. */
  profile: async (dur = 5, q: 0 | 1 = 1) => {
    const rows: string[] = []
    const ref = await benchReference(dur, 20, 44100, 3)
    for (const d of Audio.list()) {
      if (d.kind !== 'loop') continue
      const r = await benchScene((id) => Audio.def(id), { name: d.id, loops: [{ id: d.id }] }, dur, { quality: q, reps: 3 })
      rows.push(`${d.id}=${((r.wallMs / ref) * 20).toFixed(1)}v/${r.nodes}n`)
    }
    const ref2 = await benchReference(dur, 20, 44100, 3)
    return `ref ${ref.toFixed(0)}ms→${ref2.toFixed(0)}ms per 20 voices × ${dur}s | ` + rows.join(' ')
  },
  benchOne: async (name: string, dur = 10, q: 0 | 1 = 1) => {
    const sc = [...SCENES, STRESS].find((s) => s.name === name)
    if (!sc) return null
    const ref = await benchReference(dur, 20, 44100, 3)
    const r = await benchScene((id) => Audio.def(id), sc, dur, { quality: q, reps: 3 })
    return { ...r, refMs: ref, voiceEq: (r.wallMs / ref) * 20 }
  },
  benchOneOld: (name: string, dur = 10, q: 0 | 1 = 1) => {
    const sc = [...SCENES, STRESS].find((s) => s.name === name)
    return sc ? benchScene((id) => Audio.def(id), sc, dur, { quality: q }) : null
  },
  scene: (name: string, on = true) => (on ? startScene(name) : stopScene(name)),
  scenes: () => SCENES.map((s) => s.name),
  pad: (i: number) => padBtns[i]?.click(),
}
