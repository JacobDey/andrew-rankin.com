// Station 4: the drying line (GDD §4.5). Fixed prints pegged in order; drag to reorder, double-click to
// look closely, turn over (T / long-press) for the stamp and recipe, and the envelope (6 slots).
import { PALETTES } from '@shared/dither'
import type { App } from '../core/app'
import { S, autosave, loadPrintD, printById, toggleEnvelope } from '../core/state'
import type { GamePointer, Station } from '../core/types'
import { LABELS } from '../data/text'
import { RED, crispText, floatToCanvas, gray } from '../render/screen'
import { PH, PW, displayL } from '../print/optics'

interface Rect { x: number; y: number; w: number; h: number }
const hit = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

export function createLineStation(app: App): Station & { inspect(id: string | null): void } {
  const pal = PALETTES.latentLine ?? { ink: '#0B0B0C', light: '#F1EDE3' }
  let w = 1, h = 1, phone = false
  let slots: { id: string; r: Rect }[] = []
  let env: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let sel: string | null = null
  let inspectId: string | null = null
  let turned = false
  let drag: { id: string; x: number; y: number; sx: number; sy: number } | null = null
  const canv = new Map<string, HTMLCanvasElement>()
  const loading = new Set<string>()
  let swing = 0

  const controls = document.createElement('div')
  controls.className = 'li-line-controls'
  function rebuild(): void {
    controls.innerHTML = ''
    if (!sel) return
    const inEnv = S.save.envelope.includes(sel)
    const a = btn(inEnv ? 'Out of the envelope' : 'Into the envelope', () => { toggleEnvelope(sel!); app.sfx('latent.tok'); rebuild() })
    const b = btn(turned ? 'Turn back' : 'Turn over', () => { turned = !turned; rebuild() }, 'T')
    const c = btn(inspectId ? 'Back to the line' : 'Look closely', () => { inspectId = inspectId ? null : sel; rebuild() })
    controls.append(a, b, c)
  }
  function btn(label: string, fn: () => void, key?: string): HTMLButtonElement {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'li-chip'; b.innerHTML = key ? `${label} <kbd>${key}</kbd>` : label
    b.addEventListener('click', fn); return b
  }

  function image(id: string): HTMLCanvasElement | null {
    const c = canv.get(id)
    if (c) return c
    if (loading.has(id)) return null
    loading.add(id)
    void loadPrintD(id).then((D) => {
      if (D) canv.set(id, floatToCanvas(D, PW, PH, (d) => displayL(d)))
      loading.delete(id)
    })
    return null
  }

  function layout(): void {
    slots = []
    const ids = S.save.line
    const pw = phone ? Math.min(170, (w - 48) / 2) : Math.min(280, (w - 80) / Math.max(3, Math.min(6, ids.length || 1)))
    const ph = (pw * PH) / PW
    const perRow = Math.max(1, Math.floor((w - 40) / (pw + 16)))
    ids.forEach((id, i) => {
      const row = Math.floor(i / perRow), col = i % perRow
      slots.push({ id, r: { x: 24 + col * (pw + 16), y: 44 + row * (ph + 46), w: pw, h: ph } })
    })
    env = phone ? { x: 16, y: h - 150, w: w - 32, h: 100 } : { x: 24, y: h - 170, w: Math.min(420, w * 0.4), h: 130 }
  }

  const st: Station & { inspect(id: string | null): void } = {
    id: 'line',
    palette: () => pal,
    controls,
    inspect(id) { inspectId = id; sel = id; turned = false; rebuild() },
    enter() { layout(); rebuild(); app.loop('latent.room', { level: 0.5, rain: 0.3 }) },
    exit() { /* */ },
    update(dt) { swing += dt },
    resize(W, H, ph) { w = W; h = H; phone = ph; layout() },
    drawLum(g) {
      layout()
      g.fillStyle = gray(1); g.fillRect(0, 0, w, h)
      // the line(s)
      const rows = new Set(slots.map((s) => s.r.y))
      for (const y of rows) { g.strokeStyle = gray(0.2); g.lineWidth = 2; g.beginPath(); g.moveTo(0, y - 14); g.quadraticCurveTo(w / 2, y - 4, w, y - 14); g.stroke() }
      for (const s of slots) {
        const p = printById(s.id)
        const a = app.reduced() || S.save.settings.screenshotMode ? 0 : Math.sin(swing * 1.3 + s.r.x * 0.01) * 0.012
        const r = drag?.id === s.id ? { ...s.r, x: drag.x - s.r.w / 2, y: drag.y - 20 } : s.r
        g.save(); g.translate(r.x + r.w / 2, r.y - 14); g.rotate(a); g.translate(-(r.x + r.w / 2), -(r.y - 14))
        g.fillStyle = gray(0.97); g.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8)
        if (turned && s.id === sel) { g.fillStyle = gray(0.95); g.fillRect(r.x, r.y, r.w, r.h) }
        else { const c = image(s.id); if (c) g.drawImage(c, r.x, r.y, r.w, r.h); else { g.fillStyle = gray(0.5); g.fillRect(r.x, r.y, r.w, r.h) } }
        g.fillStyle = gray(0.35); g.fillRect(r.x + r.w / 2 - 4, r.y - 18, 8, 16)
        g.restore()
        void p
      }
      // envelope
      g.fillStyle = gray(0.9); g.fillRect(env.x, env.y, env.w, env.h)
      g.fillStyle = gray(1); g.beginPath(); g.moveTo(env.x, env.y); g.lineTo(env.x + env.w / 2, env.y + env.h * 0.45); g.lineTo(env.x + env.w, env.y); g.fill()
      // inspect
      if (inspectId) {
        g.fillStyle = gray(0.08); g.fillRect(0, 0, w, h)
        const c = image(inspectId)
        const iw = Math.min(w - 40, ((h - 60) * PW) / PH), ih = (iw * PH) / PW
        if (!turned && c) g.drawImage(c, (w - iw) / 2, (h - ih) / 2, iw, ih)
        else { g.fillStyle = gray(0.95); g.fillRect((w - iw) / 2, (h - ih) / 2, iw, ih) }
      }
    },
    drawCrisp(g) {
      const ink = pal.ink
      if (inspectId) {
        const p = printById(inspectId)
        const iw = Math.min(w - 40, ((h - 60) * PW) / PH), ih = (iw * PH) / PW
        if (p && turned) back(g, p.id, (w - iw) / 2 + 20, (h - ih) / 2 + 40, 18)
        crispText(g, 'ESC or double-click to return', 20, h - 14, 12, pal.light)
        return
      }
      if (!slots.length) crispText(g, 'Nothing on the line yet. Prints hang here once they are fixed.', 24, 70, 15, ink, { font: 'ui' })
      for (const s of slots) {
        const p = printById(s.id)
        if (!p) continue
        if (turned && s.id === sel) back(g, s.id, s.r.x + 6, s.r.y + 16, 11)
        crispText(g, `R${p.ref.roll}/F${p.ref.frame}`, s.r.x, s.r.y + s.r.h + 18, 12, ink)
        if (S.save.envelope.includes(s.id)) { g.fillStyle = RED; g.fillRect(s.r.x + s.r.w - 14, s.r.y + s.r.h + 6, 12, 12) }
        if (s.id === sel) { g.strokeStyle = RED; g.lineWidth = 3; g.strokeRect(s.r.x - 6, s.r.y - 6, s.r.w + 12, s.r.h + 12) }
      }
      crispText(g, LABELS.envelope, env.x + 10, env.y + env.h - 12, phone ? 9 : 11, ink, { max: env.w - 20 })
      const n = S.save.envelope.length
      for (let i = 0; i < 6; i++) { g.strokeStyle = RED; g.lineWidth = 2; g.strokeRect(env.x + 12 + i * 26, env.y + 14, 20, 26); if (i < n) { g.fillStyle = RED; g.fillRect(env.x + 15 + i * 26, env.y + 17, 14, 20) } }
    },
    pointer(p: GamePointer) {
      if (inspectId) { if (p.type === 'dbl' || (p.type === 'down' && p.button === 2)) { inspectId = null; rebuild() } else if (p.type === 'long') { turned = !turned } return true }
      if (p.type === 'down') {
        const s = slots.find((x) => hit(x.r, p.x, p.y))
        if (s) { sel = s.id; turned = p.button === 2 ? !turned : turned; drag = { id: s.id, x: p.x, y: p.y, sx: p.x, sy: p.y }; app.sfx('latent.tok'); rebuild(); return true }
        if (hit(env, p.x, p.y) && sel) { toggleEnvelope(sel); rebuild(); return true }
        sel = null; rebuild(); return false
      }
      if (p.type === 'move' && drag) { drag.x = p.x; drag.y = p.y; return true }
      if ((p.type === 'up' || p.type === 'cancel') && drag) {
        const d = drag; drag = null
        if (Math.hypot(p.x - d.sx, p.y - d.sy) > 20) {
          if (hit(env, p.x, p.y)) { if (!S.save.envelope.includes(d.id)) toggleEnvelope(d.id); app.sfx('latent.tok') }
          else {
            const ids = S.save.line
            const from = ids.indexOf(d.id)
            let to = slots.findIndex((s) => p.x < s.r.x + s.r.w / 2 && Math.abs(p.y - s.r.y - s.r.h / 2) < s.r.h)
            if (to < 0) to = ids.length - 1
            ids.splice(from, 1); ids.splice(Math.min(to, ids.length), 0, d.id); autosave()
          }
          rebuild()
        }
        return true
      }
      if (p.type === 'dbl') { const s = slots.find((x) => hit(x.r, p.x, p.y)); if (s) { inspectId = s.id; sel = s.id; rebuild() } return true }
      if (p.type === 'long') { const s = slots.find((x) => hit(x.r, p.x, p.y)); if (s) { sel = s.id; turned = !turned; rebuild() } return true }
      return false
    },
    key(e) {
      if (e.code === 'Escape' && inspectId) { inspectId = null; rebuild(); return true }
      if (e.code === 'KeyT' && sel) { turned = !turned; rebuild(); return true }
      return false
    },
    layout() {
      const o: Record<string, [number, number]> = { envelope: [env.x + env.w / 2, env.y + env.h / 2] }
      slots.forEach((s, i) => { o[`print${i}`] = [s.r.x + s.r.w / 2, s.r.y + s.r.h / 2] })
      return o
    },
  }

  function back(g: CanvasRenderingContext2D, id: string, x: number, y: number, size: number): void {
    const p = printById(id)
    if (!p) return
    const lines = [`R${p.ref.roll}/F${p.ref.frame}`, `M ${p.ops.M.toFixed(1)}×  GRADE ${p.ops.grade}`, `${p.ops.seconds.toFixed(1)} s  DEV ${p.ops.devSeconds} s${p.ops.flip ? '  FLIP' : ''}`]
    lines.forEach((s, i) => crispText(g, s, x, y + i * size * 1.3, size, pal.ink))
    if (p.legible.length) {
      const yy = y + lines.length * size * 1.3 + 6
      g.strokeStyle = RED; g.lineWidth = 2; g.strokeRect(x, yy, size * 6, size * 1.7)
      crispText(g, LABELS.stamp, x + size * 3, yy + size * 1.25, size * 1.1, RED, { align: 'center', weight: 700 })
      crispText(g, `R${p.ref.roll}/F${p.ref.frame} ${String(Math.floor((21 * 60 + p.clock) / 60) % 24).padStart(2, '0')}:${String((21 * 60 + p.clock) % 60).padStart(2, '0')}`, x + size * 6.6, yy + size * 1.2, size * 0.8, RED)
    }
    if (p.fogged) crispText(g, 'FOGGED', x, y - size, size, RED)
  }
  return st
}
