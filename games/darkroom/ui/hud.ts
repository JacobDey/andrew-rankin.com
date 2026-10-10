// HUD: switchplate, station strip, tool tray, station panels (anchored widgets
// docked into a bottom sheet on phones), ROCK tabs, the bench clock.
import { GRADES, IRON_K, TIMER } from '../constants'
import type { DarkroomBus } from '../events'
import { type Platform, flags } from '../glue/platform'
import { STATIONS, stationById, TRAYS } from '../layout'
import type { WorldX } from '../sim/world'
import type { Grade, StationId, TrayId, View } from '../types'
import { btn, h, holdBtn } from './dom'
import type { Logbook } from './logbook'
import type { Notes } from './notes'
import { createPrepDesk } from './prepdesk'
import type { Persist } from '../save/persist'
import { NEGATIVE_LIST } from '../content/negatives'

export type ToolSel = 'hand' | 'wand' | 'card' | 'brush' | 'rod' | 'dryer' | 'dropper' | null

export interface Hud {
  readonly station: StationId
  tool: ToolSel
  setTool(t: ToolSel): void
  setStation(id: StationId, sub?: number): void
  nextStation(d: number): void
  update(dt: number): void
  toast(text: string): void
  importPicker(): void
  importFile(f: Blob, name?: string): Promise<void>
  activeTray(): TrayId
  ffHeld: boolean
  setFF(on: boolean): void
  refreshPanel(): void
}

const TOOLS: Record<StationId, { id: Exclude<ToolSel, null>; label: string }[]> = {
  prep: [],
  enlarger: [{ id: 'hand', label: 'Hand' }, { id: 'wand', label: 'Wand' }, { id: 'card', label: 'Burn card' }],
  trays: [],
  sink: [{ id: 'dropper', label: 'Dropper' }],
  iron: [{ id: 'brush', label: 'Brush' }, { id: 'rod', label: 'Rod' }, { id: 'dryer', label: 'Dryer' }],
  window: [],
}

export function createHud(o: { stage: HTMLElement; world: WorldX; view: View & { setPrepTexture(c: HTMLCanvasElement | null): void }; platform: Platform; bus: DarkroomBus; notes: Notes; logbook: Logbook; persist: Persist; firstRun: boolean }): Hud {
  const { stage, world, view, platform, bus } = o
  const root = h('div', { className: 'dr-hud' })
  stage.appendChild(root)
  const W = world.cmd

  // ------------------------------------------------------------ switchplate
  const guardBtn = btn('', () => { W.guard(!world.guardOpen); platform.audio.play('darkroom.guard') }, { className: 'dr-guard', aria: 'Switch guard' })
  const switchBtn = btn('', () => {
    if (!world.guardOpen) { hud.toast('Guard up, then switch. Think first.'); return }
    W.setLight('room', world.lights.room > 0 ? 0 : 1)
  }, { className: 'dr-switch', aria: 'Room light switch' })
  const chainBtn = btn('', () => { W.setLight('safe', world.lights.safe > 0 ? 0 : 1); bus.emit('chain', {}) }, { className: 'dr-chain', aria: 'Safelight pull-chain' })
  chainBtn.append(h('span', { className: 'dr-chain__bead' }), h('span', { className: 'dr-chain__lume' }))
  const plate = h('div', { className: 'dr-switchplate', role: 'group', 'aria-label': 'Lights' },
    h('div', { className: 'dr-plate' }, guardBtn, switchBtn, h('span', { className: 'dr-plate__label', textContent: 'ROOM' })),
    h('div', { className: 'dr-chainwrap' }, chainBtn, h('span', { className: 'dr-plate__label', textContent: 'SAFE' })),
  )
  root.appendChild(plate)

  // ------------------------------------------------------------ clock (fast-forward)
  let ffHeld = false
  const clock = holdBtn('0:00', () => {}, { className: 'dr-clock', onStart: () => hud.setFF(true), onEnd: () => hud.setFF(false) })
  clock.setAttribute('aria-label', 'Bench clock: hold to fast-forward')
  root.appendChild(clock)

  // ------------------------------------------------------------ station strip
  const strip = h('nav', { className: 'dr-strip', 'aria-label': 'Stations' })
  const tabs = new Map<StationId, HTMLButtonElement>()
  for (const s of STATIONS) {
    const b = btn(s.label, () => hud.setStation(s.id), { className: 'dr-tab' })
    tabs.set(s.id, b)
    strip.appendChild(b)
  }
  root.appendChild(strip)

  // ------------------------------------------------------------ tool tray
  const toolsEl = h('div', { className: 'dr-tools', role: 'toolbar', 'aria-label': 'Tools' })
  root.appendChild(toolsEl)

  // ------------------------------------------------------------ panel (bottom sheet on phones)
  const panel = h('section', { className: 'dr-panel', 'aria-label': 'Station controls' })
  const panelHead = h('button', { className: 'dr-panel__head', type: 'button' })
  panelHead.addEventListener('click', () => panel.classList.toggle('is-collapsed'))
  const panelBody = h('div', { className: 'dr-panel__body' })
  panel.append(panelHead, panelBody)
  root.appendChild(panel)

  // anchored tabs (ROCK per tray) and labels
  const anchorLayer = h('div', { className: 'dr-anchors' })
  root.appendChild(anchorLayer)
  const rockTabs = new Map<TrayId, HTMLButtonElement>()
  for (const t of TRAYS) {
    const b = btn('ROCK', () => { const ts = world.trays[t.id]; W.autoRock(t.id, !ts.rocking) }, { className: 'dr-rock', aria: `Rock the ${t.label} tray` })
    rockTabs.set(t.id, b)
    anchorLayer.appendChild(b)
  }
  const hangBtn = btn('Hang it', () => { if (world.carried) W.hang(world.carried) }, { className: 'dr-btn dr-btn--primary dr-hang' })
  root.appendChild(hangBtn)

  // ------------------------------------------------------------ panels per station
  const prep = createPrepDesk(world.negatives, {
    onOutput: (id, format) => {
      if (format === '8x10') { W.putInFrame(id); hud.toast('Transparency printed. It is in the contact frame.') }
      else { W.loadNegative(id); hud.toast('Film strip out. Loaded in the enlarger.') }
      void o.persist
    },
    onError: (m) => hud.toast(m),
    onImported: (name, blob) => { hud.toast(`Imported ${name}.`); if (blob) void o.persist.saveBinder(name, blob, prep.settings) },
  })

  const timerOut = h('output', { className: 'dr-timer__read', textContent: '10 s' })
  const gradeSeg = h('div', { className: 'dr-seg', role: 'radiogroup', 'aria-label': 'Contrast grade (filter drawer)' })
  const gradeBtns = GRADES.map((g) => { const b = btn(g, () => W.setGrade(g as Grade), { className: 'dr-segbtn' }); b.setAttribute('role', 'radio'); gradeSeg.appendChild(b); return b })
  const negName = h('span', { className: 'dr-mono dr-negname', textContent: '' })
  const negList = () => world.negatives.listNegatives().filter((n) => n.format === '35mm' && !NEGATIVE_LIST.find((q) => q.id === n.id && (q.hidden || (q.gate && world.discoveries.length < 8))))
  const cycleNeg = (d: number) => {
    const L = negList()
    const ids: (string | null)[] = [null, ...L.map((n) => n.id)]
    const i = ids.indexOf(world.enlarger.negative)
    W.loadNegative(ids[(i + d + ids.length) % ids.length])
  }
  const startBtn = btn('START', () => { if (world.timer.running) W.stopExposure(); else W.startExposure(stripBtn.getAttribute('aria-pressed') === 'true' ? 'strip' : 'normal') }, { className: 'dr-btn dr-btn--primary dr-start' })
  const stripBtn = btn('Test strip', () => stripBtn.setAttribute('aria-pressed', String(stripBtn.getAttribute('aria-pressed') !== 'true')), { className: 'dr-toggle' })
  stripBtn.setAttribute('aria-pressed', 'false')
  const focusBtn = btn('Focus lamp', () => W.setFocusLamp(!world.enlarger.focus), { className: 'dr-toggle' })

  const enlargerPanel = h('div', { className: 'dr-grid' },
    h('div', { className: 'dr-row' }, btn('Take a sheet', () => takeSheet('box-sheet'), { className: 'dr-btn' }), btn('Practice sheet', () => takeSheet('envelope'), { className: 'dr-btn' })),
    h('div', { className: 'dr-row dr-timer' },
      btn('−', () => W.setTimer(world.timer.seconds - 1), { className: 'dr-btn dr-btn--icon', aria: 'One second less' }),
      timerOut,
      btn('+', () => W.setTimer(world.timer.seconds + 1), { className: 'dr-btn dr-btn--icon', aria: 'One second more' }),
      startBtn),
    h('div', { className: 'dr-row' }, stripBtn, focusBtn),
    h('div', { className: 'dr-row' }, h('span', { className: 'dr-label', textContent: 'Grade' }), gradeSeg),
    h('div', { className: 'dr-row' }, btn('‹', () => cycleNeg(-1), { className: 'dr-btn dr-btn--icon', aria: 'Previous negative' }), negName, btn('›', () => cycleNeg(1), { className: 'dr-btn dr-btn--icon', aria: 'Next negative' })),
    h('div', { className: 'dr-row' }, h('span', { className: 'dr-label', textContent: 'Props' }),
      ...world.props.map((p) => btn(p.name.split(' ')[0], () => { const pr = world.props.find((q) => q.id === p.id); if (!pr) return; if (pr.on === 'easel') W.placeProp(p.id, 1.36, 0.24, 0); else W.placeProp(p.id, 1.75 + (world.props.indexOf(pr) - 1) * 0.05, 0.40 + (world.props.indexOf(pr) - 1) * 0.03, 0.3 * (world.props.indexOf(pr) - 1)) }, { className: 'dr-toggle dr-prop', aria: `Put the ${p.name.toLowerCase()} on the easel` }))),
  )

  const fillRow = h('div', { className: 'dr-row' }, ...(['dev', 'stop', 'fix'] as TrayId[]).map((t) => btn(`Fill ${t.toUpperCase()}`, () => W.refill(t), { className: 'dr-btn dr-btn--small' })))
  const traysPanel = h('div', { className: 'dr-grid' },
    h('p', { className: 'dr-hint', textContent: 'Drag a tray to tilt it. Drag a sheet to move it. DEV 60–90 s, STOP 10 s, FIX 30 s.' }),
    h('div', { className: 'dr-row' }, btn('Hang it on the line', () => { const p = activePaper(); if (p) W.hang(p.id) }, { className: 'dr-btn dr-btn--primary' }), btn('Next tray →', () => advancePaper(), { className: 'dr-btn' })),
    fillRow,
  )
  const tapBtn = btn('Tap', () => W.tap(!world.iron.tap), { className: 'dr-toggle' })
  const sinkPanel = h('div', { className: 'dr-grid' },
    h('p', { className: 'dr-hint', textContent: 'WASH tray under the tap. Peroxide: one drop. Watch.' }),
    h('div', { className: 'dr-row' }, tapBtn, btn('One drop of peroxide', () => dropPeroxide(), { className: 'dr-btn dr-btn--primary' }), btn('Fill WASH', () => W.refill('wash'), { className: 'dr-btn dr-btn--small' })),
    h('div', { className: 'dr-row' }, btn('Hang it on the line', () => { const p = activePaper(); if (p) W.hang(p.id) }, { className: 'dr-btn' })),
  )
  const beakerRead = h('output', { className: 'dr-mono dr-beaker', textContent: 'A 0.0 · B 0.0 ml' })
  const dryerBtn = holdBtn('Hairdryer (hold)', () => {}, { className: 'dr-btn', onStart: () => W.blow(6.02, 0.44, true), onEnd: () => W.blow(6.02, 0.44, false) })
  const ironPanel = h('div', { className: 'dr-grid' },
    h('div', { className: 'dr-row' },
      holdBtn('Pour A', (dt) => W.pour('A', IRON_K.pourMlPerS * dt), { className: 'dr-btn dr-pour-a' }),
      holdBtn('Pour B', (dt) => W.pour('B', IRON_K.pourMlPerS * dt), { className: 'dr-btn dr-pour-b' }),
      beakerRead),
    h('div', { className: 'dr-row' }, btn('Rag paper', () => takeSheet('rag'), { className: 'dr-btn' }), btn('Load brush', () => W.loadTool('brush'), { className: 'dr-btn' }), btn('Coat it', () => autoCoat(), { className: 'dr-btn dr-btn--primary' })),
    h('div', { className: 'dr-row' }, dryerBtn, btn('Into the frame', () => { const p = world.papers.find((q) => q.place.at === 'coat'); if (p) W.moveTo(p.id, { at: 'frame' }) }, { className: 'dr-btn' })),
    h('div', { className: 'dr-row' }, btn('Transparency ‹›', () => cycleFrameNeg(), { className: 'dr-btn' }), btn('Frame to UV box', () => { world.iron.frameIn = 'uvbox'; hud.setStation('window') }, { className: 'dr-btn' })),
  )
  const uvRead = h('output', { className: 'dr-mono', textContent: 'UV off' })
  const lidBtn = btn('Close the lid', () => W.setUVLid(!world.iron.uvLid), { className: 'dr-btn dr-btn--primary' })
  const windowPanel = h('div', { className: 'dr-grid' },
    h('p', { className: 'dr-hint', textContent: 'Closing the lid turns the UV on. Wait for bronze in the shadows.' }),
    h('div', { className: 'dr-row' }, lidBtn, uvRead),
    h('div', { className: 'dr-row' }, btn('Frame back to the bench', () => { W.setUVLid(false); world.iron.frameIn = 'iron' }, { className: 'dr-btn' }), btn('Sheet to WASH', () => { const p = world.papers.find((q) => q.place.at === 'frame'); if (p) { W.setUVLid(false); W.moveTo(p.id, { at: 'tray', tray: 'wash' }); hud.setStation('sink') } }, { className: 'dr-btn' })),
  )
  const panels: Record<StationId, HTMLElement> = { prep: prep.el, enlarger: enlargerPanel, trays: traysPanel, sink: sinkPanel, iron: ironPanel, window: windowPanel }
  let uvT = 0

  function takeSheet(from: 'box-sheet' | 'envelope' | 'rag') {
    if (world.carried) { hud.toast('Your hands are full.'); return }
    if (from === 'box-sheet' && world.lights.room > 0) hud.toast('Open only in the dark.')
    const id = W.take(from)
    if (!id) { hud.toast('The envelope is empty.'); return }
    // put it straight where it goes: silver on the easel, rag on the coating spot
    if (from === 'rag') W.moveTo(id, { at: 'coat' })
    else if (from === 'box-sheet') W.moveTo(id, { at: 'easel' })
    else { W.moveTo(id, { at: 'tray', tray: 'dev' }); hud.setStation('trays', 0) }
  }
  function activePaper() {
    const order = ['carried', 'tray', 'easel', 'coat', 'frame', 'bench']
    const ps = world.papers.filter((p) => p.place.at !== 'line').sort((a, b) => order.indexOf(a.place.at) - order.indexOf(b.place.at))
    if (station === 'trays' || station === 'sink') { const inTray = ps.find((p) => p.place.at === 'tray'); if (inTray) return inTray }
    return ps[0]
  }
  function advancePaper() {
    const p = world.papers.find((q) => q.place.at === 'tray')
    if (!p || p.place.at !== 'tray') { hud.toast('Nothing in the trays.'); return }
    const next: Record<string, TrayId | 'line'> = { dev: 'stop', stop: 'fix', fix: 'wash', wash: 'line' }
    const n = next[p.place.tray]
    if (n === 'line') W.hang(p.id)
    else { W.moveTo(p.id, { at: 'tray', tray: n }); if (n === 'wash') hud.setStation('sink') }
  }
  function dropPeroxide() {
    const ws = world.trays.wash
    W.peroxide('wash', (Math.sin(world.time * 3.1) * 0.03), -0.01 + Math.cos(world.time * 2.3) * 0.02)
    void ws
  }
  function autoCoat() {
    const p = world.papers.find((q) => q.place.at === 'coat' && q.kind === 'cyano')
    if (!p) { hud.toast('Put rag paper on the coating spot first.'); return }
    if (world.iron.beakerA + world.iron.beakerB < 0.5 && world.iron.brushLoad < 0.2) { hud.toast('Pour A and B into the beaker first.'); return }
    // five overlapping horizontal strokes, reloading from the beaker
    for (let k = 0; k < 5; k++) { if (world.iron.brushLoad < 1) W.loadTool(hud.tool === 'rod' ? 'rod' : 'brush'); W.stroke(p.id, -0.06, 0.1 + k * 0.2, 1.06, 0.12 + k * 0.2, 0.6) }
  }
  function cycleFrameNeg() {
    const L = world.negatives.listNegatives().filter((n) => n.format === '8x10')
    const ids: (string | null)[] = [null, ...L.map((n) => n.id)]
    const i = ids.indexOf(world.iron.frameNegative)
    world.iron.frameNegative = ids[(i + 1) % ids.length]
    hud.toast(world.iron.frameNegative ? `Frame: ${world.negatives.getNegative(world.iron.frameNegative)?.name}` : 'Frame: no transparency (photogram)')
  }

  // drop-anywhere import
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('is-drop') })
  stage.addEventListener('dragleave', () => stage.classList.remove('is-drop'))
  stage.addEventListener('drop', (e) => {
    e.preventDefault(); stage.classList.remove('is-drop')
    const f = e.dataTransfer?.files?.[0]
    if (f) void hud.importFile(f, f.name)
  })

  let station: StationId = 'trays'
  const hud: Hud = {
    get station() { return station },
    tool: null,
    ffHeld,
    setTool(t) {
      hud.tool = hud.tool === t ? null : t
      if (hud.tool !== 'hand' && hud.tool !== 'wand' && hud.tool !== 'card') W.setOccluder(null)
      renderTools()
    },
    setStation(id, sub) {
      station = id
      panel.dataset.station = id
      view.setFocus(id, sub)
      for (const [k, b] of tabs) { b.setAttribute('aria-current', String(k === id)); b.classList.toggle('is-current', k === id) }
      panelHead.textContent = stationById(id).label.toUpperCase()
      panelBody.replaceChildren(panels[id])
      panel.classList.remove('is-collapsed')
      if (!TOOLS[id].some((t) => t.id === hud.tool)) hud.tool = id === 'enlarger' ? 'hand' : null
      if (id !== 'enlarger') W.setOccluder(null)
      renderTools()
      o.notes.station(id)
      view.setPrepTexture(id === 'prep' ? prep.preview : null)
    },
    nextStation(d) {
      const i = STATIONS.findIndex((s) => s.id === station)
      hud.setStation(STATIONS[Math.max(0, Math.min(STATIONS.length - 1, i + d))].id)
    },
    update(dt) {
      // switchplate
      guardBtn.setAttribute('aria-pressed', String(world.guardOpen))
      plate.classList.toggle('is-guard-open', world.guardOpen)
      plate.classList.toggle('is-room', world.lights.room > 0)
      switchBtn.setAttribute('aria-pressed', String(world.lights.room > 0))
      chainBtn.setAttribute('aria-pressed', String(world.lights.safe > 0))
      root.classList.toggle('is-dark', world.lights.room <= 0 && world.lights.safe <= 0)
      root.classList.toggle('is-safe', world.lights.safe > 0 && world.lights.room <= 0)
      // clock: the active sheet's time in its bath
      const ap = activePaper()
      let status: string | null = null
      if (ap && ap.place.at === 'tray') {
        const t = ap.place.tray
        const s = t === 'dev' ? ap.log.dev : t === 'stop' ? ap.log.stop : t === 'fix' ? ap.log.fix : ap.log.wash
        status = `${t.toUpperCase()} · ${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
      } else if (world.timer.running) status = `EXPOSE · ${world.timer.remaining.toFixed(1)} s`
      else if (world.iron.uvOn) status = `UV · ${Math.floor(uvT)} s`
      clock.textContent = status ?? `${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}`
      clock.classList.toggle('is-ff', world.fastForward)
      platform.shell.setStatus(status)
      // enlarger
      timerOut.textContent = world.timer.running ? `${world.timer.remaining.toFixed(1)} s` : `${world.timer.seconds} s`
      startBtn.textContent = world.timer.running ? 'STOP' : 'START'
      gradeBtns.forEach((b, i) => b.setAttribute('aria-checked', String(GRADES[i] === world.enlarger.grade)))
      focusBtn.setAttribute('aria-pressed', String(world.enlarger.focus))
      const neg = world.enlarger.negative ? world.negatives.getNegative(world.enlarger.negative) : null
      negName.textContent = neg ? neg.name : 'No negative (photogram)'
      // iron
      beakerRead.textContent = `A ${world.iron.beakerA.toFixed(1)} · B ${world.iron.beakerB.toFixed(1)} ml · brush ${world.iron.brushLoad.toFixed(1)}`
      tapBtn.setAttribute('aria-pressed', String(world.iron.tap))
      if (world.iron.uvOn) uvT += dt; else if (!world.iron.uvLid) uvT = 0
      uvRead.textContent = world.iron.uvOn ? `UV on · ${Math.floor(uvT)} s` : 'UV off'
      lidBtn.textContent = world.iron.uvLid ? 'Open the lid' : 'Close the lid'
      // prep
      if (station === 'prep') { prep.update(dt); view.setPrepTexture(prep.preview) }
      // ROCK tabs
      for (const [id, b] of rockTabs) {
        const p = view.project('trayRim:' + id)
        const show = p.visible && (station === 'trays' || station === 'sink')
        b.hidden = !show
        if (show) b.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y + 6)}px) translate(-50%, 0)`
        b.setAttribute('aria-pressed', String(world.trays[id].rocking))
      }
      hangBtn.hidden = !world.carried
    },
    toast(text) { platform.shell.toast(text) },
    importPicker() {
      const inp = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }) as HTMLInputElement
      inp.addEventListener('change', () => { const f = inp.files?.[0]; if (f) void hud.importFile(f, f.name) })
      inp.click()
    },
    async importFile(f, name) {
      hud.setStation('prep')
      await prep.loadFile(f, name)
    },
    activeTray() {
      const p = activePaper()
      if (p && p.place.at === 'tray') return p.place.tray
      const sub = Math.round((view.focusX - 2.66) / 0.44)
      return station === 'sink' ? 'wash' : (['dev', 'stop', 'fix'] as TrayId[])[Math.max(0, Math.min(2, sub))]
    },
    setFF(on) { ffHeld = on; W.fastForward(on) },
    refreshPanel() { /* panels are live */ },
  }
  ;(hud as Hud & { prep: typeof prep }).prep = prep
  ;(hud as Hud & { inspect(id: string): void }).inspect = (id: string) => { const p = world.paper(id); if (p) o.logbook.inspect(p) }

  function renderTools() {
    const list = TOOLS[station]
    toolsEl.replaceChildren(...list.map((t) => {
      const b = btn(t.label, () => hud.setTool(t.id), { className: 'dr-tool' })
      b.setAttribute('aria-pressed', String(hud.tool === t.id))
      return b
    }))
    toolsEl.hidden = list.length === 0
  }
  hud.setStation('trays')
  if (flags().test) root.classList.add('is-test')
  void TIMER
  return hud
}
