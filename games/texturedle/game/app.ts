// Texturedle spine (architecture §5.1, texturedle.md §3, §11.3): the daily
// loop and state machine, wired from injected factories. main.ts calls
// startTexturedle with the real bench, renderer and audio.

import { flags, detectTier, prefersReducedMotion, shareOrDownload, markReady, installGameApi, createPerfMonitor } from '@shared/core'
import { resetGame } from '@shared/storage'
import { toast, openDialog, createSwitch, createSegmented, confirmDialog, showLoader, type Shell, type HelpContent } from '@shared/ui'
import { RATIOS, MISS_TITLE, type Bench, type BenchEvent, type ClothKind, type Renderer, type AudioEngine, type ViewState, type MarbleState, type Vec2 } from '../contracts'
import type { BenchExtras } from '../sim/bench'
import type { RendererExtras } from '../render/renderer'
import { bakeSurface, createRuntime, getRecipe, WALK, POOL, SURFACE_SOURCE, type SurfaceRuntime, type SurfaceRecipe, type SurfaceBake } from '../glue/surface'
import { createView, type View } from '../ui/view'
import { createInput, type Input } from '../input/input'
import { createNotes, type Notes, type Chip } from './notes'
import { ATLAS, atlasEntry, lintAtlas, FAMILY_NAME, HABITAT_NAME, HARDNESS_NAME, GRAIN_NAME, WEAR_NAME, type AtlasEntry } from './atlas'
import { resolveGuess, suggest, complete, feedback, consistent, tileGlyph, type Tile } from './guess'
import { dayNumber, recipeForDay, teaser, dateForDay } from './daily'
import { loadSave, writeSave, clearSave, hubNote, defaultSave, type SaveV1, type DayRecord } from './save'
import { shareText } from './share'

export interface AppDeps {
  stage: HTMLElement
  shell: Shell
  createBench: (seed: number) => Bench & BenchExtras
  createRenderer: (canvas: HTMLCanvasElement, opts: { quality: 'high' | 'low'; force2d?: boolean; test?: boolean }) => Renderer & RendererExtras
  createAudio: () => AudioEngine & { setMuted(m: boolean): void }
}

export const HELP: HelpContent = {
  intro: "Name today's surface in six guesses. Touching is free; every miss racks the lens back and shows more.",
  controls: [
    { action: 'Tilt the stage', mouse: 'Drag bare surface, or right-drag', touch: 'Drag bare surface', keys: 'WASD / arrows · T locks' },
    { action: 'Marble', mouse: 'Drag from the dish; flick to throw', touch: 'Drag from the dish', keys: 'M drops it' },
    { action: 'Lens cloth / burlap', mouse: 'Drag a swatch onto the surface', touch: 'Drag a swatch', keys: 'C wipe · B scrub' },
    { action: 'Knock / shake', mouse: 'Double-click bare surface', touch: 'Double-tap', keys: 'Space · Space ×3' },
    { action: 'Lamp', mouse: 'Drag the bezel; click the lamp for ring light', touch: 'Drag the bezel', keys: 'Q / E · L' },
    { action: 'Focus', mouse: 'Wheel or the ribbed strip', touch: 'Ribbed strip', keys: '[ ] · G autofocus' },
    { action: 'Return probes', keys: 'R' },
    { action: 'Guess', keys: 'Enter' },
  ],
  tips: [
    'The marble is a magnifier: rest it on something and look inside.',
    'Tilting five degrees doubles or halves every shadow.',
    'Every sound has a caption in Settings.',
    'The field card always names the Tell, so you can spot it on real things.',
  ],
}

const DT = 1 / 60
const COACH = ['Drag the surface to tilt it.', 'Pick up the marble.', 'Wipe it with the lens cloth.', 'Scrub it with the burlap.', 'What is this? Name it below.']

export async function startTexturedle(deps: AppDeps): Promise<void> {
  const F = flags()
  const test = F.test
  const poster = F.embed === 'poster'
  const reduced = () => prefersReducedMotion() || test
  if (F.reset) { try { await resetGame('texturedle') } catch { clearSave() } }
  let { save, persistent } = loadSave(prefersReducedMotion())
  const tierRaw = detectTier()
  let quality: 'high' | 'low' = save.settings.quality !== 'auto' ? save.settings.quality : tierRaw === 'high' || tierRaw === 'medium' ? 'high' : 'low'
  if (F.quality) quality = F.quality === 'high' || F.quality === 'medium' ? 'high' : 'low'

  const view: View = createView(deps.stage)
  view.root.dataset.tiles = save.settings.tiles
  const loader = poster ? null : showLoader(deps.stage, { label: 'Warming the lamp…' })
  view.layout()
  const renderer = deps.createRenderer(view.canvas, { quality, test })
  const bench = deps.createBench(F.seed ?? 1)
  bench.setQuality(quality)
  bench.setPortrait(view.portrait)
  const audio = deps.createAudio()
  if (test || poster) audio.setMuted(true)
  audio.setRoomTone(save.settings.roomTone)
  void audio.unlock()

  // ---------------- day + specimen ----------------
  const today = F.num('day', dayNumber())
  let day = today
  let recipeId = F.get('recipe') ?? recipeForDay(day, WALK, POOL).recipeId
  if (poster) recipeId = 'poster-peeling-paint'
  let recipe: SurfaceRecipe = getRecipe(recipeId)
  let answer: AtlasEntry = atlasEntry(recipe.atlasId) ?? ATLAS[0]
  let rec: DayRecord = freshRecord()
  let notes: Notes = createNotes()
  let rows: Array<{ guess: AtlasEntry; tiles: Tile[] }> = []
  let phase: 'loading' | 'playing' | 'busy' | 'reveal' | 'card' | 'free' = 'loading'
  let rt: SurfaceRuntime | null = null
  let bakeMs = 0
  const bakes = new Map<number, Promise<SurfaceBake>>()

  function freshRecord(): DayRecord {
    return { recipeId, status: 'playing', mode: save.settings.hard ? 'hard' : 'normal', guesses: [], ratioIndex: 0, evidence: [], probes: { tilt: false, marble: false, lens: false, burlap: false }, secret: false, notes: [] }
  }
  function loadRecord(): void {
    const ex = poster ? undefined : save.days[day]
    rec = ex && ex.recipeId === recipeId ? ex : freshRecord()
    if (!poster) save.days[day] = rec
    notes = createNotes()
    notes.restore(rec.notes ?? [])
    Object.assign(notes.probes, rec.probes)
    rows = rec.guesses.map((id) => { const g = atlasEntry(id)!; return { guess: g, tiles: tilesFor(g) } })
  }
  const tileNames = (g: AtlasEntry) => ({ family: FAMILY_NAME[g.family], habitat: HABITAT_NAME[g.habitat], hd: HARDNESS_NAME, gr: GRAIN_NAME, wr: WEAR_NAME })
  const tilesFor = (g: AtlasEntry) => feedback(g, answer, tileNames(g))

  const sizeFor = (i: number) => 1.06 * Math.max(RATIOS[i].fovMm[0], RATIOS[i].fovMm[1])
  const bakeRes = () => (SURFACE_SOURCE === 'local' ? 512 : quality === 'high' ? 1024 : 512)
  function bakeFor(i: number): Promise<SurfaceBake> {
    let p = bakes.get(i)
    if (!p) {
      p = bakeSurface(recipe, { ratio: RATIOS[i].m, res: bakeRes(), physRes: quality === 'high' ? 256 : 128, seed: 1, sizeMm: sizeFor(i) })
      bakes.set(i, p)
      // keep at most two bakes alive
      for (const k of [...bakes.keys()]) if (k !== i && k !== i - 1 && k !== i + 1 && bakes.size > 2) bakes.delete(k)
    }
    return p
  }
  async function useRatio(i: number, carry: boolean): Promise<void> {
    const b = await bakeFor(i)
    bakeMs = b.ms
    const next = createRuntime(b, recipe, carry && rt ? rt : undefined)
    rt = next
    bench.setPortrait(view.portrait)
    bench.setSurface(next, RATIOS[i], true)
    renderer.setSurface(next)
    audio.setSurface(next)
    rec.ratioIndex = i
    view.setTurret(i)
    view.setReadout(RATIOS[i], 0, lamp.az, carry)
    if (!test && i < 5) setTimeout(() => { void bakeFor(i + 1) }, 1500)
  }

  // ---------------- view state ----------------
  const lamp = { az: 135, el: 15, mode: 'rake' as 'rake' | 'ring' }
  const focus = { z: 0, v: 0, manual: 0, offset: 0, peaking: false, manualUntil: 0 }
  let hover = { x: 0, y: 0 }
  let timeWall = 0
  let lastActivity = performance.now()
  let lampSwept = 0
  const vs = (): ViewState => ({
    ratio: RATIOS[rec.ratioIndex], portrait: view.portrait, tilt: bench.state.tilt,
    lamp: { azDeg: lamp.az, elDeg: lamp.el, mode: lamp.mode }, focus: { zMm: focus.z + focus.offset, peaking: focus.peaking },
    bench: bench.state, reducedMotion: reduced(), timeWall, dust: false,
  })

  function setLamp(az: number): void {
    const prev = lamp.az
    lamp.az = ((az % 360) + 360) % 360
    lampSwept += Math.abs(((lamp.az - prev + 540) % 360) - 180)
    bench.setLampSwept(lampSwept)
    if (Math.floor(prev / 5) !== Math.floor(lamp.az / 5)) audio.ui('ratchet')
    view.setLampPos(lamp.az, lamp.mode)
    if (lampSwept >= 20) notes.probes.tilt = true
  }

  // ---------------- input ----------------
  let input: Input | null = null
  if (!poster) {
    input = createInput({
      bench, renderer, frameEl: view.frame, bezelEl: view.bezel, lampEl: view.lamp, focusEl: view.focus,
      tray: { dish: view.dish, lens: view.lensBtn, burlap: view.burlapBtn },
      enabled: () => phase === 'playing' || phase === 'free',
      onActivity: () => { lastActivity = performance.now(); view.setCoach(null); void audio.unlock() },
      setLamp, getLamp: () => lamp.az,
      toggleLampMode: () => { lamp.mode = lamp.mode === 'rake' ? 'ring' : 'rake'; view.setLampPos(lamp.az, lamp.mode); audio.ui('detent') },
      nudgeFocus: (dz) => { focus.manual += dz; focus.manualUntil = performance.now() + 4000; audio.ui('detent') },
      autoFocus: () => { focus.manualUntil = 0; focus.manual = 0 },
      togglePeaking: () => { focus.peaking = !focus.peaking },
      hover: (x, y) => { hover = { x, y } },
      focusGuess: () => view.input.focus(),
      openHelp: () => deps.shell.openHelp(),
      stroke: (k, x, y) => { void scriptedStroke(k, x, y) },
      probeUsed: (k) => { notes.probes[k] = true },
    })
  }

  async function scriptedStroke(k: ClothKind, x: number, y: number): Promise<void> {
    const fw = bench.frame().w
    const path: Array<[number, number]> = k === 'lens'
      ? [[x - fw * 0.25, y], [x + fw * 0.25, y], [x - fw * 0.25, y - 0.3], [x + fw * 0.25, y - 0.3]]
      : [[x - fw * 0.2, y], [x + fw * 0.2, y], [x - fw * 0.2, y], [x + fw * 0.2, y]]
    await dragPath(k, path, 1200, 1, false)
  }

  /** Drag a cloth along a polyline over `ms` of wall time. sync = run physics now (tests). */
  async function dragPath(k: ClothKind, path: Array<[number, number]>, ms: number, press: number, sync: boolean): Promise<void> {
    const frames = Math.max(2, Math.round((ms / 1000) * 60))
    const seg: number[] = [0]
    for (let i = 1; i < path.length; i++) seg.push(seg[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
    const total = seg[seg.length - 1] || 1
    const at = (u: number): [number, number] => {
      const d = u * total
      let i = 1
      while (i < seg.length - 1 && seg[i] < d) i++
      const t = (d - seg[i - 1]) / Math.max(1e-9, seg[i] - seg[i - 1])
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t]
    }
    bench.clothGrab(k, path[0][0], path[0][1], press)
    notes.probes[k] = true
    for (let f = 1; f <= frames; f++) {
      const [x, y] = at(f / frames)
      bench.clothMove(x, y, press)
      hover = { x, y }
      if (sync) frame(DT, false)
      else await new Promise((r) => requestAnimationFrame(() => r(null)))
    }
    bench.clothRelease()
    if (sync) for (let i = 0; i < 6; i++) frame(DT, false)
  }

  // ---------------- main frame ----------------
  const evBuf: BenchEvent[] = []
  const freshChips = new Set<string>()
  let chipsDirty = true
  const perf = createPerfMonitor()
  let fpsAcc = 0, fpsN = 0, fps = 60
  if (!test) perf.onDegrade(() => {
    if (quality === 'high') { quality = 'low'; renderer.setQuality('low'); bench.setQuality('low'); if (rt) bench.setSurface(rt, RATIOS[rec.ratioIndex], true) }
  }, { thresholdMs: 22, windowS: 2 })

  function frame(dt: number, render: boolean): void {
    timeWall += dt
    input?.frame(dt)
    bench.step(dt)
    evBuf.length = 0
    bench.drainEvents(evBuf)
    if (rt) {
      for (const e of evBuf) {
        // the day's Secret
        if (!rec.secret && recipe.secretHook) {
          const hit = recipe.secretHook(e as unknown as Parameters<NonNullable<SurfaceRecipe['secretHook']>>[0], rt)
          if (hit) {
            rec.secret = true
            if (!save.stats.secrets.includes(recipe.id)) save.stats.secrets.push(recipe.id)
            if (hit.id === 'pop-blister') bench.popAt(hit.x, hit.y)
            if (!test) toast('✨ Something gave way.')
            persist()
          }
        }
        audio.event(e)
      }
      const ctx = { lampDeg: lamp.az, lampMode: lamp.mode, tiltDeg: Math.hypot(bench.state.tilt.x, bench.state.tilt.y), ratio: RATIOS[rec.ratioIndex], frameW: bench.frame().w, frameH: bench.frame().h }
      const fresh = notes.ingest(evBuf, bench.stats, rt, ctx)
      if (fresh.length) {
        for (const c of fresh) { freshChips.add(c.id); if (!rec.evidence.includes(c.id)) rec.evidence.push(c.id) }
        rec.notes = notes.chips.map((c) => ({ ...c }))
        chipsDirty = true
        audio.ui('stamp')
        persist()
      }
      Object.assign(rec.probes, notes.probes)
      audio.update(bench.contacts())
    }
    // autofocus: the active probe, else the hover point, else the centre
    const ms = bench.state.marble
    let fx = hover.x, fy = hover.y
    if (ms.where === 'held' || (ms.where === 'plate' && Math.hypot(ms.vel[0], ms.vel[1]) > 5)) { fx = ms.pos[0]; fy = ms.pos[1] }
    const fw = bench.frame()
    fx = Math.max(-fw.w / 2, Math.min(fw.w / 2, fx)); fy = Math.max(-fw.h / 2, Math.min(fw.h / 2, fy))
    if (rt) {
      const target = renderer.focusZAt(fx, fy, bench.state.tilt) + (performance.now() < focus.manualUntil || test ? focus.manual : 0)
      const w = 18, z = 0.45
      const a = w * w * (target - focus.z) - 2 * z * w * focus.v
      focus.v += a * dt
      focus.z += focus.v * dt
      if (test) { focus.z = target; focus.v = 0 }
    }
    focus.offset *= Math.exp(-dt * 3.2)
    if (Math.abs(focus.offset) < 1e-4) focus.offset = 0
    if (render) draw()
  }

  function draw(): void {
    if (!rt) return
    if (bench.looseVersion >= 0) renderer.setLoose(bench.loose, bench.physRes, bench.looseVersion, recipe.loose ? recipe.loose.rgb : [0.4, 0.2, 0.1])
    const v = vs()
    renderer.render(v)
    const tl = Math.hypot(v.tilt.x, v.tilt.y)
    view.setReadout(v.ratio, tl, lamp.az, false)
    view.setScaleBar(v.ratio, renderer.mmPerPx())
    const m = bench.state.marble.where
    view.tray.dataset.marble = m === 'dish' ? 'in' : 'out'
    view.tray.dataset.lens = bench.state.cloths.lens.where === 'tray' ? 'in' : 'out'
    view.tray.dataset.burlap = bench.state.cloths.burlap.where === 'tray' ? 'in' : 'out'
    if (chipsDirty) { view.setChips(notes.chips, freshChips); freshChips.clear(); chipsDirty = false }
  }

  // ---------------- loop ----------------
  let raf = 0
  let lastT = 0
  let hidden = false
  function loop(t: number): void {
    raf = requestAnimationFrame(loop)
    if (hidden) return
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : DT
    lastT = t
    const t0 = performance.now()
    frame(dt, true)
    perf.sample(performance.now() - t0 + 0)
    fpsAcc += dt; fpsN++
    if (fpsAcc > 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0 }
    coach()
  }
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden
    lastT = 0
    if (hidden) persist()
  })
  window.addEventListener('pagehide', () => persist())

  // ---------------- onboarding coach ----------------
  let coachIdx = -1
  const startAt = performance.now()
  function beatDone(i: number): boolean {
    const s = bench.stats
    switch (i) {
      case 0: return s.tiltMax >= 2
      case 1: return notes.probes.marble
      case 2: return s.wiped.lens >= 1
      case 3: return s.wiped.burlap >= 1
      case 4: return rec.guesses.length > 0
      default: return true
    }
  }
  function coach(): void {
    if (test || poster || phase !== 'playing' || save.onboarding.beats === 31) return
    for (let i = 0; i < 5; i++) if (!(save.onboarding.beats & (1 << i)) && beatDone(i)) { save.onboarding.beats |= 1 << i; persist() }
    const idle = performance.now() - lastActivity > 6000
    let next = -1
    for (let i = 0; i < 5; i++) if (!(save.onboarding.beats & (1 << i))) { next = i; break }
    if (next === 4 && !(notes.chips.length >= 3 || performance.now() - startAt > 60000)) next = -1
    if (idle && next >= 0) {
      if (coachIdx !== next) { coachIdx = next; view.setCoach(COACH[next]) }
      view.dish.dataset.pulse = next === 1 ? '1' : '0'
      view.lensBtn.dataset.pulse = next === 2 ? '1' : '0'
      view.burlapBtn.dataset.pulse = next === 3 ? '1' : '0'
      view.guessbar.dataset.glow = next === 4 ? '1' : '0'
    } else if (!idle && coachIdx >= 0) {
      coachIdx = -1
      view.setCoach(null)
      view.dish.dataset.pulse = view.lensBtn.dataset.pulse = view.burlapBtn.dataset.pulse = '0'
      view.guessbar.dataset.glow = '0'
    }
  }

  // ---------------- persistence ----------------
  function persist(): void {
    if (poster) return
    rec.notes = notes.chips.map((c) => ({ ...c }))
    save.days[day] = rec
    writeSave(save)
  }

  // ---------------- guessing ----------------
  let busy: Promise<void> = Promise.resolve()
  let sel = -1
  let suggList: AtlasEntry[] = []

  function renderRows(flip: boolean): void {
    view.setRows(rows.map((r) => ({ name: r.guess.name, tiles: r.tiles })), flip)
  }
  function showSuggestions(): void {
    const q = view.input.value
    suggList = complete(q, 8)
    if (!q.trim() || !suggList.length) { view.sugg.hidden = true; view.input.setAttribute('aria-expanded', 'false'); return }
    const easy = rec.mode !== 'hard'
    const ok = suggList.map((e) => !easy || rows.length === 0 || consistent(e, rows))
    // easy mode: consistent entries first
    const order = suggList.map((e, i) => [e, ok[i]] as const).sort((a, b) => Number(b[1]) - Number(a[1]))
    suggList = order.map((o) => o[0])
    view.sugg.innerHTML = ''
    order.forEach(([e, good], i) => {
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      li.id = `tx-opt-${i}`
      li.dataset.grey = good ? '0' : '1'
      li.setAttribute('aria-selected', i === sel ? 'true' : 'false')
      li.innerHTML = `<span>${e.name}</span><small>${FAMILY_NAME[e.family]}</small>`
      li.addEventListener('pointerdown', (ev) => { ev.preventDefault(); view.input.value = e.name; view.sugg.hidden = true; submit() })
      view.sugg.append(li)
    })
    view.sugg.hidden = false
    view.input.setAttribute('aria-expanded', 'true')
  }
  view.input.addEventListener('input', () => { sel = -1; showSuggestions(); view.msg.textContent = '' })
  view.input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!suggList.length) return
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + suggList.length) % suggList.length
      showSuggestions()
      view.input.setAttribute('aria-activedescendant', `tx-opt-${sel}`)
    } else if (e.key === 'Enter' && sel >= 0 && suggList[sel]) {
      view.input.value = suggList[sel].name
    } else if (e.key === 'Escape') { view.sugg.hidden = true; view.input.blur() }
  })
  view.input.addEventListener('blur', () => setTimeout(() => { view.sugg.hidden = true }, 150))
  view.guessbar.addEventListener('submit', (e) => { e.preventDefault(); submit() })
  function submit(): void {
    let t = view.input.value
    // Enter on a partial name takes the top suggestion
    if (!resolveGuess(t) && !view.sugg.hidden && suggList.length) t = suggList[Math.max(0, sel)].name
    const r = guess(t)
    if (r.ok) { view.input.value = ''; view.sugg.hidden = true; sel = -1 }
  }
  function shakeBar(msg: string): void {
    view.guessbar.dataset.shake = '0'
    void view.guessbar.offsetWidth
    view.guessbar.dataset.shake = '1'
    view.msg.textContent = msg
  }

  function guess(text: string): { ok: boolean; tiles?: string; solved?: boolean; reason?: string } {
    if (rec.status !== 'playing' || phase === 'reveal' || phase === 'card' || phase === 'free') return { ok: false, reason: 'finished' }
    if (phase === 'busy' || phase === 'loading') return { ok: false, reason: 'busy' }
    const g = resolveGuess(text)
    if (!g) {
      const s = suggest(text)
      shakeBar(s ? `Not in the Atlas. Did you mean ${s.name.toLowerCase()}?` : 'Not in the Atlas.')
      return { ok: false, reason: 'not-in-atlas' }
    }
    if (rec.guesses.includes(g.id)) { shakeBar('Already tried.'); return { ok: false, reason: 'repeat' } }
    if (rec.mode === 'hard') {
      for (const r of rows) {
        const keys: Array<keyof AtlasEntry> = ['family', 'habitat', 'hardness', 'grain', 'wear']
        for (let i = 0; i < 5; i++) if (r.tiles[i].state === 'hit' && g[keys[i]] !== r.guess[keys[i]]) {
          shakeBar('Hard mode: keep every right tile.')
          return { ok: false, reason: 'hard-mode' }
        }
      }
    }
    view.msg.textContent = ''
    const tiles = tilesFor(g)
    rows.push({ guess: g, tiles })
    rec.guesses.push(g.id)
    const solved = g.id === answer.id
    const lost = !solved && rec.guesses.length >= 6
    if (solved || lost) {
      rec.status = solved ? 'solved' : 'lost'
      rec.finishedAt = new Date().toISOString()
      const st = save.stats
      st.played++
      if (solved) {
        st.solved++
        st.histogram[rec.ratioIndex]++
        st.streak = st.lastSolvedDay === day - 1 ? st.streak + 1 : 1
        st.bestStreak = Math.max(st.bestStreak, st.streak)
        st.lastSolvedDay = day
        hubNote(`Solved today at ${RATIOS[rec.ratioIndex].label}`)
      } else {
        st.histogram[6]++
        st.streak = 0
        hubNote("Today's got away")
      }
    }
    persist()
    phase = 'busy'
    const flipMs = reduced() ? 0 : 5 * 120 + 360
    renderRows(!reduced())
    for (let i = 0; i < 5 && !reduced(); i++) setTimeout(() => audio.ui('tile'), i * 120)
    busy = busy.then(async () => {
      await wait(flipMs + (reduced() ? 0 : 300))
      if (solved || lost) {
        await revealSequence()
      } else {
        const next = Math.min(5, rec.ratioIndex + 1)
        if (!test) toast(`Not ${g.name.toLowerCase()}. Racking out to ${RATIOS[next].label}.`)
        await rackTo(next)
        phase = 'playing'
      }
    })
    return { ok: true, tiles: tiles.map(tileGlyph).join(' '), solved }
  }

  async function rackTo(i: number): Promise<void> {
    if (i === rec.ratioIndex) return
    const irisMs = reduced() ? 0 : 300
    if (irisMs) audio.ui('iris')
    const pre = bakeFor(i)
    await view.iris(true, irisMs)
    await pre
    await useRatio(i, true)
    // focus breathing: a little hunt as the iris opens
    focus.offset = reduced() ? 0 : RATIOS[i].dofMm * 1.6
    persist()
    if (test) frame(DT, true)
    await view.iris(false, irisMs)
  }

  // ---------------- reveal + field card ----------------
  async function revealSequence(): Promise<void> {
    phase = 'reveal'
    renderer.render(vs())
    const rm = reduced()
    const p = renderer.playReveal(recipe, { reducedMotion: rm })
    if (test) {
      // drive the short reveal with the virtual clock
      for (let i = 0; i < 30; i++) { timeWall += 1 / 60; renderer.render(vs()) }
    }
    await p
    audio.ui('shutter')
    if (!rm) view.flash()
    setTimeout(() => audio.ui('dish'), 200)
    showCard(false)
  }

  function showCard(resumed: boolean): void {
    phase = 'card'
    const solved = rec.status === 'solved'
    const r = RATIOS[rec.ratioIndex]
    const no = String(day).padStart(3, '0')
    const nextR = getRecipe(recipeForDay(day + 1, WALK, POOL).recipeId)
    const card = document.createElement('article')
    card.className = 'tx-card'
    if (reduced()) card.style.animation = 'none'
    card.setAttribute('aria-label', 'Field card')
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
    card.innerHTML = `
      <div class="tx-kicker">Field card · No. ${no} · ${dateForDay(day).toLocaleDateString('en-CA', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}</div>
      <h2>${esc(recipe.card.title)}</h2>
      <div class="tx-bin">${esc(recipe.binomial)}</div>
      <p>${esc(recipe.card.caption)}</p>
      <div class="tx-exif">${esc(recipe.card.exif)}</div>
      <dl><dt>Tell</dt><dd>${esc(recipe.tell)}</dd><dt>Secret</dt><dd>${rec.secret ? `✨ ${esc(recipe.secret.text)}` : "There's one more thing it can do."}</dd></dl>
      <div class="tx-score">${solved ? `Solved at ${r.label} · ${r.title}` : `Released at 1:2. ${MISS_TITLE}.`}</div>
      <div class="tx-actions"></div>
      <div class="tx-teaser">${teaser(nextR.reveal.scene)}</div>`
    const actions = card.querySelector('.tx-actions') as HTMLElement
    const btn = (label: string, primary: boolean, fn: () => void) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = primary ? 'ar-btn ar-btn--primary' : 'ar-btn'
      b.textContent = label
      b.addEventListener('click', fn)
      actions.append(b)
      return b
    }
    btn('Share', true, () => { void share() })
    btn('Keep touching', false, () => keepTouching())
    view.cardWrap.innerHTML = ''
    view.cardWrap.append(card)
    view.cardWrap.hidden = false
    view.input.disabled = true
    view.guessBtn.disabled = true
    view.msg.textContent = solved ? 'Specimen confirmed. Come back tomorrow.' : "Today's surface got away. Come back tomorrow."
    updateShellActions()
    if (resumed) void 0
  }

  function keepTouching(): void {
    view.cardWrap.hidden = true
    renderer.endReveal()
    phase = 'free'
    view.canvas.focus()
  }

  async function share(): Promise<void> {
    const text = shareText(day, rec, rows.map((r) => r.tiles), save.settings.tiles === 'contrast')
    const r = await shareOrDownload({ text, title: 'Texturedle' })
    if (r === 'copied') toast('Copied.')
    else if (r === 'failed') toast("Couldn't share that.", { kind: 'error' })
  }

  // ---------------- settings ----------------
  function openSettings(): void {
    const body = document.createElement('div')
    body.style.display = 'grid'
    body.style.gap = '12px'
    const s = save.settings
    const sw = (label: string, on: boolean, fn: (v: boolean) => void) => body.append(createSwitch({ label, checked: on, onChange: (v) => { fn(v); persist() } }))
    sw('Captions', s.captions, (v) => { s.captions = v })
    sw('Haptics', s.haptics, (v) => { s.haptics = v })
    sw('Hard mode (from tomorrow if you have guessed today)', s.hard, (v) => { s.hard = v; if (rec.guesses.length === 0 && rec.status === 'playing') rec.mode = v ? 'hard' : 'normal' })
    sw('Room tone', s.roomTone, (v) => { s.roomTone = v; audio.setRoomTone(v) })
    body.append(createSegmented({ label: 'Tile colours', options: [{ value: 'standard', label: 'Standard' }, { value: 'contrast', label: 'High contrast' }], value: s.tiles, onChange: (v) => { s.tiles = v; view.root.dataset.tiles = v; persist() } }))
    body.append(createSegmented({ label: 'Quality', options: [{ value: 'auto', label: 'Auto' }, { value: 'high', label: 'High' }, { value: 'low', label: 'Low' }], value: s.quality, onChange: (v) => { s.quality = v; persist(); toast('Quality applies on the next load.') } }))
    if (!persistent) {
      const p = document.createElement('p')
      p.textContent = "This browser isn't keeping saves, so today's notes won't stick."
      body.append(p)
    }
    openDialog({
      edge: 'RANKIN 400 · DATASHEET · ▸01 TEXTUREDLE', title: 'Settings', body,
      actions: [
        { id: 'fresh', label: 'Start fresh', kind: 'ghost', onSelect: () => { void startFresh(); return true } },
        { id: 'done', label: 'Done', kind: 'primary' },
      ],
    })
  }
  async function startFresh(): Promise<void> {
    const ok = await confirmDialog('Clear every Texturedle day, streak and setting on this device?', { title: 'Start fresh', ok: 'Clear', cancel: 'Keep' })
    if (!ok) return
    clearSave()
    save = defaultSave(prefersReducedMotion())
    location.reload()
  }

  function updateShellActions(): void {
    if (poster) return
    const finished = rec.status !== 'playing'
    deps.shell.setActions([
      ...(finished ? [{ id: 'share', label: 'Share', icon: 'download' as const, kind: 'primary' as const, priority: 0, onSelect: () => { void share() } }] : []),
      { id: 'settings', label: 'Settings', icon: 'more' as const, priority: 2, onSelect: openSettings },
      { id: 'howto', label: 'How to play', icon: 'help' as const, priority: 1, shortcut: '?', onSelect: () => deps.shell.openHelp() },
    ])
  }

  audio.onCaption((t) => { if (save.settings.captions) view.caption(t) })

  // ---------------- boot ----------------
  loadRecord()
  view.setTurret(rec.ratioIndex)
  renderRows(false)
  view.onLayout = () => { renderer.resize(); bench.setPortrait(view.portrait) }
  const ro = new ResizeObserver(() => view.layout())
  ro.observe(view.viewer)
  window.visualViewport?.addEventListener('resize', () => view.layout())
  loader?.label(['Warming the lamp…', 'Stopping down…', 'Cleaning the sensor (mostly)…'][day % 3])
  await useRatio(poster ? 0 : rec.ratioIndex, false)
  loader?.progress(1)
  await loader?.done()
  phase = 'playing'
  view.layout()
  renderer.resize()
  updateShellActions()
  const resumedInProgress = rec.status === 'playing' && (rec.guesses.length > 0 || rec.evidence.length > 0)
  if (rec.status !== 'playing' && !poster) showCard(true)
  else if (resumedInProgress && !test) toast('Back where you left it.')
  chipsDirty = true

  // the intro: rack from blur to sharp, lamp sweep 90° → 135°, the marble drops in
  if (!test && !poster) {
    focus.offset = reduced() ? 0 : 0.6
    if (!reduced()) {
      const t0 = performance.now()
      const sweep = () => {
        const u = Math.min(1, (performance.now() - t0) / 1200)
        lamp.az = 90 + 45 * (1 - (1 - u) ** 3)
        view.setLampPos(lamp.az, lamp.mode)
        if (u < 1 && performance.now() - lastActivity > 50) requestAnimationFrame(sweep)
        else lamp.az = Math.round(lamp.az)
      }
      requestAnimationFrame(sweep)
    }
    if (rec.status === 'playing' || true) setTimeout(() => { if (bench.state.marble.where === 'dish') bench.marbleDrop(0, 0.4, 2.5) }, reduced() ? 0 : 600)
  }

  // poster composition
  async function composePoster(): Promise<void> {
    lamp.az = 135
    lamp.mode = 'rake'
    bench.marbleDrop(1.2, -0.6, 0.0)
    for (let i = 0; i < 40; i++) frame(DT, false)
    bench.marbleDrop(1.2, -0.6, 0.0)
    frame(DT, true)
  }

  // ---------------- test API (texturedle.md §13.1) ----------------
  let testTilt = false
  function releaseTestTilt(): void {
    if (!testTilt) return
    testTilt = false
    if (input) { input.tiltLock = false; input.tiltTarget.x = 0; input.tiltTarget.y = 0 }
    bench.setTiltTarget({ x: 0, y: 0 })
  }
  const api = {
    poster: async () => { await composePoster() },
    setDay: async (n: number) => { day = n; recipeId = recipeForDay(n, WALK, POOL).recipeId; await reloadSpecimen() },
    loadRecipe: async (id: string, ratio = 0) => { recipeId = id; await reloadSpecimen(); if (ratio) await rackTo(ratio) },
    setRatio: async (i: number) => { await rackTo(Math.max(0, Math.min(5, i))) },
    pause: () => { cancelAnimationFrame(raf); raf = 0 },
    resume: () => { if (!raf) { lastT = 0; raf = requestAnimationFrame(loop) } },
    advance: (frames: number) => { for (let i = 0; i < frames; i++) frame(DT, false); draw() },
    // a test tilt is held (like tilt lock) until the next probe call
    setTilt: (x: number, y: number) => { testTilt = true; if (input) { input.tiltLock = true; input.tiltTarget.x = x; input.tiltTarget.y = y } bench.setTiltTarget({ x, y }); notes.probes.tilt = true },
    setLamp: (az: number, mode?: 'rake' | 'ring') => { setLamp(az); if (mode) lamp.mode = mode },
    setFocus: (z: number | 'auto') => { if (z === 'auto') { focus.manual = 0; focus.manualUntil = 0 } else { focus.manual = z; focus.manualUntil = Infinity } },
    dropMarble: (x: number, y: number, hMm = 2) => { releaseTestTilt(); bench.marbleDrop(x, y, hMm); notes.probes.marble = true },
    throwMarble: (x: number, y: number, vxSim: number, vySim: number) => {
      releaseTestTilt()
      const s = RATIOS[rec.ratioIndex].timeScale
      bench.marbleGrab(x, y)
      bench.marbleRelease(vxSim * s, vySim * s)
      notes.probes.marble = true
    },
    dragCloth: async (kind: ClothKind, path: Array<[number, number]>, ms: number, press = 1) => { releaseTestTilt(); await dragPath(kind, path, ms, press, true); draw() },
    flipCloth: (kind: ClothKind) => bench.clothFlip(kind),
    tap: (x = 0, y = 0) => bench.tap(x, y),
    shake: () => bench.shake(),
    resetProbes: () => bench.resetProbes(),
    guess: (text: string) => guess(text),
    whenIdle: async () => { await busy; await wait(0) },
    reveal: async () => { await revealSequence() },
    toScreen: (x: number, y: number): [number, number] => { const c = renderer.frameToClient(x, y); return [c.cx, c.cy] },
    lintAtlas: () => lintAtlas(),
    resetSave: () => { clearSave(); save = defaultSave(prefersReducedMotion()) },
    chips: () => notes.chips.map((c: Chip) => `${c.id}: ${c.text}`),
    stats: () => bench.stats,
    probe: (kind: 'marble' | 'lens' | 'burlap', x: number, y: number) => {
      if (!rt) return null
      const o = rt.contactAt(kind, x, y, { d: 0, nx: 0, ny: 0, nz: 1, layer: 0 })
      const b = rt.bake
      const i = Math.min(b.res - 1, Math.max(0, Math.floor((x + b.sizeMm / 2) / b.mmPerTexel)))
      const j = Math.min(b.res - 1, Math.max(0, Math.floor((y + b.sizeMm / 2) / b.mmPerTexel)))
      return { ...o, h: b.height[j * b.res + i] }
    },
    state: () => ({
      day, recipeId: recipe.id, ratioIndex: rec.ratioIndex, status: rec.status, guesses: [...rec.guesses], evidence: [...rec.evidence],
      bench: {
        tilt: { ...bench.state.tilt } as Vec2, marble: bench.state.marble.where as MarbleState['where'],
        marblePos: bench.state.marble.pos.map((v) => Math.round(v * 1000) / 1000), snags: bench.stats.snags, layersRevealed: [...bench.stats.layersRevealed],
      },
      perf: { fps: Math.round(fps), tier: quality, bakeMs: Math.round(bakeMs) },
      errors: (window.__game?.errors?.() ?? []) as string[],
      surface: SURFACE_SOURCE,
    }),
  }
  installGameApi('texturedle', 'texturedle@1', api)

  async function reloadSpecimen(): Promise<void> {
    recipe = getRecipe(recipeId)
    answer = atlasEntry(recipe.atlasId) ?? ATLAS[0]
    bakes.clear()
    rt = null
    loadRecord()
    renderRows(false)
    chipsDirty = true
    view.cardWrap.hidden = true
    renderer.endReveal()
    view.input.disabled = false
    view.guessBtn.disabled = false
    await useRatio(rec.ratioIndex, false)
    phase = rec.status === 'playing' ? 'playing' : 'card'
    if (rec.status !== 'playing') showCard(true)
    draw()
  }

  // first real frame
  if (poster) await composePoster()
  frame(DT, true)
  draw()
  if (!test) raf = requestAnimationFrame(loop)
  document.body.dataset.txReady = '1'
  markReady()
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
