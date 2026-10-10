// Pointer input (darkroom.md §4.1–4.2): pick priority carried > widget > paper >
// object > tray > bench. Hold = 140 ms, drag = 6 px.
import { TILT } from '../constants'
import type { DarkroomBus } from '../events'
import type { Platform } from '../glue/platform'
import { ENLARGER, TRAY_INTERIOR, trayLayout } from '../layout'
import type { WorldX } from '../sim/world'
import type { Pick, TrayId, View } from '../types'
import type { Hud } from '../ui/hud'

const DEG = Math.PI / 180
const HOLD_MS = 140
const DRAG_PX = 6

export interface Input { readonly mode: string; height01: number; cancel(): void }

export function createInput(o: { canvas: HTMLCanvasElement; stage: HTMLElement; world: WorldX; view: View; hud: Hud; bus: DarkroomBus; platform: Platform }): Input {
  const { canvas, world, view, hud } = o
  const W = world.cmd
  canvas.style.touchAction = 'none'
  let mode: 'none' | 'pending-paper' | 'paper' | 'tray' | 'pan' | 'occlude' | 'brush' | 'dryer' | 'prop' | 'object' = 'none'
  let pid = -1
  let sx = 0, sy = 0, lx = 0, ly = 0, t0 = 0
  let pick: Pick | null = null
  let holdTimer = 0
  let tray: TrayId | null = null
  let lastTap = { t: 0, x: 0, y: 0, id: '' }
  let height01 = 0.4
  let hole = 0.025
  let brushLast: { u: number; v: number; t: number } | null = null
  let propId = ''
  let touch = false

  const occluderAt = (cx: number, cy: number, fist: boolean) => {
    const bp = view.benchPoint(cx, cy - (touch ? 60 : 0), 0.03)
    if (!bp) return
    const near = Math.abs(bp.x - ENLARGER.easel.x) < 0.3 && Math.abs(bp.z - ENLARGER.easel.z) < 0.3
    if (!near) { W.setOccluder(null); return }
    const tool = hud.tool === 'card' ? 'card' : hud.tool === 'wand' ? 'wand' : fist ? 'fist' : 'hand'
    W.setOccluder({ tool, x: bp.x, z: bp.z, rot: 0, height01, hole })
  }
  const paperUV = (cx: number, cy: number, id: string) => {
    const p = world.paper(id)
    if (!p) return null
    const bp = view.benchPoint(cx, cy, 0.005)
    if (!bp) return null
    const pos = world.placePos(p)
    return { u: (bp.x - pos.x) / 0.203 + 0.5, v: (bp.z - pos.z) / 0.254 + 0.5 }
  }

  function startCarry(id: string) {
    if (W.pick(id)) {
      mode = 'paper'
      const bp = view.benchPoint(lx, ly, 0.05)
      if (bp) W.carry(bp.x, bp.z)
    }
  }
  function dropCarry(cx: number, cy: number) {
    const pk = view.pick(cx, cy)
    if (pk?.kind === 'line') world.setCarryTarget({ at: 'line', slot: -1 } as never)
    const id = world.carried
    if (pk?.kind === 'line' && id) { world.setCarryTarget(null); W.hang(id); return }
    world.setCarryTarget(null)
    W.drop()
  }

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const pk = view.pick(e.clientX, e.clientY)
    if (pk?.kind === 'paper' && pk.id) W.flip(pk.id)
  })

  canvas.addEventListener('pointerdown', (e) => {
    if (pid !== -1 && e.pointerId !== pid) return
    if (e.button === 2) return
    touch = e.pointerType === 'touch'
    pid = e.pointerId
    canvas.setPointerCapture(e.pointerId)
    sx = lx = e.clientX; sy = ly = e.clientY; t0 = performance.now()
    o.platform.audio.ui('tick')
    // carrying: the press moves the sheet; release drops it
    if (world.carried) {
      mode = 'paper'
      const bp = view.benchPoint(e.clientX, e.clientY, 0.05)
      if (bp) W.carry(bp.x, bp.z)
      return
    }
    pick = view.pick(e.clientX, e.clientY)
    const tool = hud.tool
    if ((tool === 'hand' || tool === 'wand' || tool === 'card') && hud.station === 'enlarger' && (pick?.kind === 'easel' || pick?.kind === 'bench' || (pick?.kind === 'paper' && world.paper(pick.id ?? '')?.place.at === 'easel'))) {
      mode = 'occlude'
      occluderAt(e.clientX, e.clientY, tool === 'hand')
      return
    }
    if (tool === 'dryer') { mode = 'dryer'; const bp = view.benchPoint(e.clientX, e.clientY); if (bp) W.blow(bp.x, bp.z, true); return }
    if (tool === 'dropper' && pick?.kind === 'tray' && pick.tray) {
      const lay = trayLayout(pick.tray)
      if (lay) W.peroxide(pick.tray, pick.point.x - lay.x, pick.point.z - lay.z)
      mode = 'none'
      return
    }
    if ((tool === 'brush' || tool === 'rod') && pick?.kind === 'paper' && pick.id && world.paper(pick.id)?.place.at === 'coat') {
      mode = 'brush'
      if (world.iron.brushLoad < 0.1) W.loadTool(tool)
      const uv = paperUV(e.clientX, e.clientY, pick.id)
      brushLast = uv ? { ...uv, t: performance.now() } : null
      return
    }
    if (pick?.kind === 'paper' && pick.id) {
      mode = 'pending-paper'
      const id = pick.id
      holdTimer = window.setTimeout(() => { if (mode === 'pending-paper') startCarry(id) }, HOLD_MS + (touch ? 80 : 0))
      return
    }
    if (pick?.kind === 'object' && pick.name?.startsWith('prop:')) { mode = 'prop'; propId = pick.name.slice(5); return }
    if (pick?.kind === 'object' || pick?.kind === 'easel') { mode = 'object'; return }
    if (pick?.kind === 'tray' && pick.tray) { mode = 'tray'; tray = pick.tray; return }
    mode = 'pan'
  })

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) {
      // hover (mouse)
      if (pid === -1 && e.pointerType === 'mouse') {
        if (world.carried) { const bp = view.benchPoint(e.clientX, e.clientY, 0.05); if (bp) W.carry(bp.x, bp.z) }
        else if ((hud.tool === 'hand' || hud.tool === 'wand' || hud.tool === 'card') && hud.station === 'enlarger') occluderAt(e.clientX, e.clientY, false)
      }
      return
    }
    const dx = e.clientX - sx, dy = e.clientY - sy
    const moved = Math.hypot(dx, dy) > DRAG_PX
    const ddx = e.clientX - lx
    lx = e.clientX; ly = e.clientY
    switch (mode) {
      case 'pending-paper':
        if (moved && pick?.id) { clearTimeout(holdTimer); startCarry(pick.id) }
        break
      case 'paper': { const bp = view.benchPoint(e.clientX, e.clientY, 0.05); if (bp) W.carry(bp.x, bp.z); break }
      case 'tray':
        if (tray && moved) {
          const tx = Math.max(-TILT.maxDeg, Math.min(TILT.maxDeg, dx * TILT.degPerPx)) * DEG
          const ty = Math.max(-TILT.maxDeg, Math.min(TILT.maxDeg, dy * TILT.degPerPx)) * DEG
          W.holdTray(tray, tx, ty, dx * 0.0009 * TILT.offsetPerM, dy * 0.0009 * TILT.offsetPerM)
        }
        break
      case 'pan': if (Math.abs(dx) > DRAG_PX || !touch) view.panBy(ddx); break
      case 'occlude': occluderAt(e.clientX, e.clientY, hud.tool === 'hand'); break
      case 'dryer': { const bp = view.benchPoint(e.clientX, e.clientY); if (bp) W.blow(bp.x, bp.z, true); break }
      case 'brush': {
        const id = pick?.id
        if (!id) break
        const uv = paperUV(e.clientX, e.clientY, id)
        const now = performance.now()
        if (uv && brushLast) W.stroke(id, brushLast.u, brushLast.v, uv.u, uv.v, Math.max(0.008, (now - brushLast.t) / 1000))
        brushLast = uv ? { ...uv, t: now } : null
        break
      }
      default: break
    }
  })

  const end = (e: PointerEvent) => {
    if (e.pointerId !== pid) return
    pid = -1
    clearTimeout(holdTimer)
    const dx = e.clientX - sx, dy = e.clientY - sy
    const moved = Math.hypot(dx, dy) > DRAG_PX
    const quick = performance.now() - t0 < 300
    switch (mode) {
      case 'paper': dropCarry(e.clientX, e.clientY); break
      case 'pending-paper': {
        const id = pick?.id ?? ''
        const p = world.paper(id)
        const now = performance.now()
        if (now - lastTap.t < 320 && lastTap.id === id) { W.flip(id); lastTap.t = 0; break }
        lastTap = { t: now, x: e.clientX, y: e.clientY, id }
        if (p?.place.at === 'tray') W.dunk(id)
        else if (p?.place.at === 'line') (hud as Hud & { inspect?: (id: string) => void }).inspect?.(id)
        break
      }
      case 'tray':
        if (tray) {
          if (moved) W.releaseTray(tray)
          else if (pick) { const lay = trayLayout(tray); if (lay) W.poke(tray, Math.max(-TRAY_INTERIOR.w / 2, Math.min(TRAY_INTERIOR.w / 2, pick.point.x - lay.x)), Math.max(-TRAY_INTERIOR.d / 2, Math.min(TRAY_INTERIOR.d / 2, pick.point.z - lay.z)), 1) }
        }
        tray = null
        break
      case 'pan': if (moved) { view.settle(); hud.setStation(view.focus) } break
      case 'occlude': if (!touch) occluderAt(e.clientX, e.clientY, false); else W.setOccluder(null); break
      case 'dryer': W.blow(0, 0, false); break
      case 'prop': {
        const bp = view.benchPoint(e.clientX, e.clientY, 0.03)
        if (bp && moved) W.placeProp(propId, bp.x, bp.z, 0)
        else if (!moved) { const pr = world.props.find((q) => q.id === propId); if (pr) W.placeProp(propId, pr.on === 'easel' ? 1.36 : 1.75, pr.on === 'easel' ? 0.24 : 0.40, 0) }
        break
      }
      case 'object': if (!moved && quick && pick) objectClick(pick); break
      default: break
    }
    brushLast = null
    mode = 'none'
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('wheel', (e) => {
    if (hud.station === 'enlarger' && world.occluder) {
      e.preventDefault()
      if (hud.tool === 'card') hole = Math.max(0.01, Math.min(0.05, hole - e.deltaY * 0.00005))
      else height01 = Math.max(0, Math.min(1, height01 - e.deltaY * 0.001))
      const oc = world.occluder
      W.setOccluder({ ...oc, height01, hole })
    }
  }, { passive: false })

  function objectClick(pk: Pick) {
    const n = pk.name ?? (pk.kind === 'easel' ? 'easel' : '')
    switch (n) {
      case 'paperBox': { const id = W.take('box-sheet'); if (id) W.moveTo(id, { at: 'easel' }); hud.setStation('enlarger'); break }
      case 'envelope': { const id = W.take('envelope'); if (id) { W.moveTo(id, { at: 'tray', tray: 'dev' }); hud.setStation('trays', 0) } else hud.toast('The envelope is empty.'); break }
      case 'rag': { const id = W.take('rag'); if (id) W.moveTo(id, { at: 'coat' }); break }
      case 'beaker': W.loadTool(hud.tool === 'rod' ? 'rod' : 'brush'); hud.setTool('brush'); break
      case 'bottleA': W.pour('A', 1); break
      case 'bottleB': W.pour('B', 1); break
      case 'tap': W.tap(!world.iron.tap); break
      case 'peroxide': hud.setTool('dropper'); break
      case 'uvbox': W.setUVLid(!world.iron.uvLid); break
      case 'frame': world.iron.frameIn = world.iron.frameIn === 'iron' ? 'uvbox' : 'iron'; break
      case 'lightTable': hud.setStation('prep'); break
      case 'enlargerHead': W.setFocusLamp(!world.enlarger.focus); break
      default: break
    }
  }

  return {
    get mode() { return mode },
    get height01() { return height01 },
    set height01(v: number) { height01 = v },
    cancel() { mode = 'none'; pid = -1 },
  }
}
