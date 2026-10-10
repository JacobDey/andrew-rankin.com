// Station 2: the light table (GDD §4.3). The carton of eleven cassettes, developed strips in negative,
// the loupe, and sending a frame to the enlarger's carrier.
import { PALETTES } from '@shared/dither'
import { clamp } from '@shared/core'
import type { App } from '../core/app'
import { S, rollDeveloped } from '../core/state'
import type { FrameRef, GamePointer, Negative, Station } from '../core/types'
import { ROLLS, recipe, rollMeta } from '../data/rolls'
import { createNegative } from '../film/filmModel'
import { RED, crispText, gray } from '../render/screen'

interface Rect { x: number; y: number; w: number; h: number }
const hit = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

export interface LightTableHooks { sendToTank(roll: number): void; toCarrier(ref: FrameRef): void; shelfBusy(): boolean }

export function createLightTableStation(app: App, hooks: LightTableHooks): Station & { showRoll(r: number): void } {
  const pal = PALETTES.latentLightTable
  let w = 1, h = 1, phone = false
  let carton: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let cass: Rect[] = []
  let table: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let frameRects: { r: Rect; ref: FrameRef }[] = []
  let selCass = 0
  let showRollId = 0
  let selFrame: FrameRef | null = null
  let loupe: { x: number; y: number; on: boolean; power: number } = { x: 0, y: 0, on: false, power: 4 }
  const thumbs = new Map<string, HTMLCanvasElement>()
  const negs = new Map<string, Negative>()
  const pending = new Set<string>()
  let turned = false

  const controls = document.createElement('div')
  controls.className = 'li-lt-controls'

  function developedRolls(): number[] { return ROLLS.map((r) => r.id).filter((id) => !!rollDeveloped(id)) }
  function rebuild(): void {
    controls.innerHTML = ''
    const devd = developedRolls()
    const strip = document.createElement('div'); strip.className = 'li-rolls'
    for (const id of devd) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'li-chip'; b.textContent = `R${id}`
      b.setAttribute('aria-pressed', String(id === showRollId)); b.addEventListener('click', () => showRoll(id)); strip.append(b)
    }
    if (devd.length) controls.append(strip)
    const row = document.createElement('div'); row.className = 'li-row'
    if (selCass) {
      const dev = !!rollDeveloped(selCass)
      const b = document.createElement('button'); b.type = 'button'; b.className = 'li-chip li-primary'
      b.textContent = dev ? `Roll ${selCass} is developed` : hooks.shelfBusy() ? 'Tank shelf busy' : `Send roll ${selCass} to the tank`
      b.disabled = dev || hooks.shelfBusy()
      b.addEventListener('click', () => { hooks.sendToTank(selCass); app.sfx('latent.tok'); rebuild() })
      const t = document.createElement('button'); t.type = 'button'; t.className = 'li-chip'; t.textContent = turned ? 'Turn back' : 'Turn over'
      t.addEventListener('click', () => { turned = !turned; rebuild() })
      row.append(b, t)
    }
    if (selFrame) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'li-chip li-primary'
      b.innerHTML = `R${selFrame.roll}/F${selFrame.frame} → carrier <kbd>E</kbd>`
      b.addEventListener('click', () => { if (selFrame) hooks.toCarrier(selFrame) })
      row.append(b)
    }
    controls.append(row)
  }

  function showRoll(r: number): void { showRollId = r; selFrame = null; rebuild() }

  function layout(): void {
    if (phone) {
      carton = { x: 10, y: 10, w: w - 20, h: 112 }
      table = { x: 10, y: carton.y + carton.h + 14, w: w - 20, h: h - carton.h - 140 }
    } else {
      carton = { x: 24, y: 20, w: Math.min(520, w * 0.42), h: 150 }
      table = { x: 24, y: carton.y + carton.h + 24, w: w - 48, h: h - carton.h - 140 }
    }
    cass = []
    const cols = 6, cw = (carton.w - 30) / cols
    for (let i = 0; i < 11; i++) cass.push({ x: carton.x + 15 + (i % cols) * cw, y: carton.y + 26 + Math.floor(i / cols) * ((carton.h - 34) / 2), w: cw - 8, h: (carton.h - 44) / 2 })
  }

  function key(r: number, f: number): string { return `${r}:${f}` }
  function ensureThumb(ref: FrameRef): HTMLCanvasElement | null {
    const k = key(ref.roll, ref.frame)
    const t = thumbs.get(k)
    if (t) return t
    if (pending.has(k)) return null
    const dev = rollDeveloped(ref.roll)
    const rec = recipe(ref.roll, ref.frame)
    if (!dev || !rec) return null
    pending.add(k)
    void app.frames.get(ref).then((img) => {
      const neg = createNegative(img, dev, rollMeta(ref.roll), rec.ev)
      negs.set(k, neg)
      const tw = 96, th = 64
      const c = document.createElement('canvas'); c.width = tw; c.height = th
      const g = c.getContext('2d')!
      const im = g.createImageData(tw, th)
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
        const D = neg.density(((x + 0.5) / tw) * 36, ((y + 0.5) / th) * 24, 36 / tw)
        const v = Math.round(255 * Math.min(1, 0.97 * Math.pow(10, -D * 0.85)))
        const q = (y * tw + x) * 4
        im.data[q] = im.data[q + 1] = im.data[q + 2] = v; im.data[q + 3] = 255
      }
      g.putImageData(im, 0, 0)
      thumbs.set(k, c); pending.delete(k)
    }).catch(() => pending.delete(k))
    return null
  }

  const station: Station & { showRoll(r: number): void } = {
    id: 'lighttable',
    palette: () => pal,
    controls,
    showRoll,
    enter() {
      const d = developedRolls()
      if (!showRollId || !d.includes(showRollId)) showRollId = d[d.length - 1] ?? 0
      rebuild()
      app.loop('latent.room', { level: 0.6, rain: 0.3 })
    },
    exit() { loupe.on = false },
    update() { /* static */ },
    resize(W, H, ph) { w = W; h = H; phone = ph; layout() },
    drawLum(g) {
      g.fillStyle = gray(0.02); g.fillRect(0, 0, w, h)
      // the glowing table
      g.fillStyle = gray(1); g.fillRect(table.x, table.y, table.w, table.h)
      // carton
      g.fillStyle = gray(0.55); g.fillRect(carton.x, carton.y, carton.w, carton.h)
      g.fillStyle = gray(0.38); g.fillRect(carton.x + 8, carton.y + 20, carton.w - 16, carton.h - 28)
      ROLLS.forEach((r, i) => {
        const c = cass[i]
        const dev = !!rollDeveloped(r.id)
        const away = S.save.shelf === r.id
        if (r.sleeve) { g.fillStyle = gray(dev ? 0.8 : 0.75); g.fillRect(c.x, c.y, c.w, c.h); g.fillStyle = gray(0.2); g.fillRect(c.x + 4, c.y + c.h * 0.3, c.w - 8, c.h * 0.4) }
        else if (!away) {
          g.fillStyle = gray(dev ? 0.25 : 0.12); g.fillRect(c.x, c.y + 4, c.w, c.h - 8)
          g.fillStyle = gray(0.85); g.fillRect(c.x + 4, c.y + c.h * 0.32, c.w - 8, c.h * 0.36)
          if (r.dx) for (let k = 0; k < 6; k++) { g.fillStyle = gray(k % 2 ? 0.05 : 0.9); g.fillRect(c.x + 4 + k * ((c.w - 8) / 6), c.y + c.h * 0.32, (c.w - 8) / 6, c.h * 0.18); g.fillStyle = gray(k % 2 ? 0.9 : 0.05); g.fillRect(c.x + 4 + k * ((c.w - 8) / 6), c.y + c.h * 0.5, (c.w - 8) / 6, c.h * 0.18) }
        }
      })
      // strips of the shown roll
      frameRects = []
      if (showRollId) {
        const meta = rollMeta(showRollId)
        const n = meta.frames
        const perStrip = 6
        const strips = Math.ceil(n / perStrip)
        const fw0 = (table.w - 40) / perStrip
        const fh0 = (fw0 * 2) / 3
        const maxStripH = (table.h - 30) / strips
        const scale = Math.min(1, (maxStripH - 18) / fh0)
        const fw = fw0 * scale, fh = fh0 * scale
        for (let s = 0; s < strips; s++) {
          const sy = table.y + 16 + s * (fh + 18)
          g.fillStyle = gray(0.62); g.fillRect(table.x + 14, sy - 8, fw * perStrip + 12, fh + 16)
          for (let k = 0; k < perStrip; k++) {
            const f = s * perStrip + k + 1
            if (f > n) break
            const r = { x: table.x + 20 + k * fw, y: sy, w: fw - 4, h: fh }
            frameRects.push({ r, ref: { roll: showRollId, frame: f } })
            const t = ensureThumb({ roll: showRollId, frame: f })
            if (t) g.drawImage(t, r.x, r.y, r.w, r.h); else { g.fillStyle = gray(0.7); g.fillRect(r.x, r.y, r.w, r.h) }
            // the gate tooth: a clear notch at the top-right film edge
            g.fillStyle = gray(0.95); g.fillRect(r.x + r.w * 0.93 - 2, r.y - 5, 5, 5)
            for (let p = 0; p < 4; p++) { g.fillStyle = gray(0.95); g.fillRect(r.x + 4 + p * (r.w / 4), r.y - 7, 4, 3); g.fillRect(r.x + 4 + p * (r.w / 4), r.y + r.h + 4, 4, 3) }
          }
        }
      }
      // the loupe
      if (loupe.on) {
        const R = phone ? 70 : 90
        const lx = loupe.x, ly = loupe.y
        g.save(); g.beginPath(); g.arc(lx, ly, R, 0, Math.PI * 2); g.clip()
        g.fillStyle = gray(0.95); g.fillRect(lx - R, ly - R, R * 2, R * 2)
        const hitR = frameRects.find((f) => hit(f.r, loupe.x, loupe.y + (loupe.y !== ly ? 0 : 0)))
        if (hitR) {
          const neg = negs.get(key(hitR.ref.roll, hitR.ref.frame))
          if (neg) {
            const step = app.screen.cell
            const pxPerMm = (hitR.r.w / 36) * loupe.power
            for (let yy = -R; yy < R; yy += step) for (let xx = -R; xx < R; xx += step) {
              if (xx * xx + yy * yy > R * R) continue
              const fx = (loupe.x - hitR.r.x) / hitR.r.w * 36 + xx / pxPerMm, fy = (loupe.y - hitR.r.y) / hitR.r.h * 24 + yy / pxPerMm
              let v = 0.62
              if (fx >= 0 && fx <= 36 && fy >= 0 && fy <= 24) v = Math.min(1, 0.97 * Math.pow(10, -neg.density(fx, fy, step / pxPerMm) * 0.85))
              g.fillStyle = gray(v); g.fillRect(lx + xx, ly + yy, step, step)
            }
          }
        }
        g.restore()
        g.strokeStyle = gray(0.1); g.lineWidth = 6; g.beginPath(); g.arc(lx, ly, R, 0, Math.PI * 2); g.stroke()
      }
    },
    drawCrisp(g) {
      const ink = pal.ink
      crispText(g, 'HOLD — R.K.', carton.x + 12, carton.y + 15, 18, ink, { font: 'hand', weight: 700 })
      ROLLS.forEach((r, i) => {
        const c = cass[i]
        if (S.save.shelf === r.id) { crispText(g, 'AT TANK', c.x + c.w / 2, c.y + c.h / 2 + 4, 9, ink, { align: 'center' }); return }
        const label = r.sleeve ? r.label : r.label
        if (label && !r.dx) crispText(g, label, c.x + c.w / 2, c.y + c.h / 2 + 4, r.hand === 'cursive' ? 14 : 8, ink, { align: 'center', font: r.hand === 'cursive' ? 'hand' : 'mono', weight: r.hand === 'cursive' ? 700 : 600, max: c.w - 10 })
        if (i + 1 === selCass) { g.strokeStyle = RED; g.lineWidth = 2; g.strokeRect(c.x - 3, c.y - 3, c.w + 6, c.h + 6) }
      })
      // the selected cassette's label, large (turned over: the property sticker)
      if (selCass) {
        const r = rollMeta(selCass)
        const bx = phone ? carton.x : carton.x + carton.w + 24, by = phone ? table.y + table.h - 60 : carton.y + 10
        const bw = phone ? carton.w : Math.min(300, w - bx - 24)
        g.fillStyle = gray(0.92); g.fillRect(bx, by, bw, phone ? 56 : 120)
        if (!turned) {
          crispText(g, r.dx ? 'NO LABEL · DX ▚▚▚▚' : r.label, bx + 12, by + (phone ? 34 : 50), r.hand === 'cursive' ? 30 : 18, ink, { font: r.hand === 'cursive' ? 'hand' : 'mono', weight: 700, max: bw - 24 })
          if (!phone) crispText(g, r.sleeve ? 'GLASSINE SLEEVE · DEVELOPED' : r.dx ? 'CASSETTE · CHECKERBOARD OF SILVER AND BLACK' : 'CASSETTE · 35MM', bx + 12, by + 90, 11, ink, { max: bw - 24 })
        } else {
          crispText(g, `PROPERTY ${r.property}`, bx + 12, by + 30, 14, ink, { weight: 600 })
          if (!phone) crispText(g, r.dx ? 'VARROW PAN 400 · DX' : 'VARROW PAN 400', bx + 12, by + 60, 12, ink)
        }
      }
      if (showRollId) {
        crispText(g, `ROLL ${showRollId} · VARROW PAN 400`, table.x + 16, table.y + table.h - 10, 11, ink)
        for (const f of frameRects) crispText(g, String(f.ref.frame), f.r.x + 3, f.r.y + f.r.h + 13, 9, ink)
        if (selFrame) { const f = frameRects.find((x) => x.ref.frame === selFrame!.frame && x.ref.roll === selFrame!.roll); if (f) { g.strokeStyle = RED; g.lineWidth = 3; g.strokeRect(f.r.x - 3, f.r.y - 3, f.r.w + 6, f.r.h + 6) } }
        const hov = frameRects.find((f) => hit(f.r, loupe.x, loupe.y))
        if (hov && loupe.on) crispText(g, `R${hov.ref.roll} F${hov.ref.frame}`, loupe.x + 70, loupe.y - 70, 11, ink)
      } else crispText(g, 'Nothing developed yet. Send a cassette to the tank.', table.x + 20, table.y + 40, 14, ink, { font: 'ui' })
      // what to do next, in plain words
      const hint = selFrame ? 'Send the frame to the carrier, then go to the DARKROOM and press Expose.'
        : selCass && !rollDeveloped(selCass) ? 'Send it to the tank, then go to the DARKROOM: open the bag and wind the film.'
        : showRollId ? 'Tap a frame to pick it for printing. Hold your finger or mouse over one for the loupe.' : 'Tap a cassette in the carton to pick a roll to develop.'
      const per = Math.max(20, Math.floor((table.w - 32) / 8.6))
      const words = hint.split(' '); const lines: string[] = []; let cur = ''
      for (const wd of words) { if (cur && (cur + ' ' + wd).length > per) { lines.push(cur); cur = wd } else cur = cur ? cur + ' ' + wd : wd }
      if (cur) lines.push(cur)
      lines.forEach((ln, i) => crispText(g, ln, table.x + 16, table.y + 150 + i * 17, 14, ink, { weight: 700 }))
    },
    pointer(p: GamePointer) {
      const lift = p.pointerType === 'touch' ? 72 : 0
      if (p.type === 'down') {
        for (let i = 0; i < 11; i++) if (hit(cass[i], p.x, p.y)) {
          const id = i + 1
          if (rollDeveloped(id)) { showRoll(id); selCass = id } else { selCass = id; turned = false }
          app.sfx('latent.tok'); rebuild(); return true
        }
        for (const f of frameRects) if (hit(f.r, p.x, p.y)) { selFrame = f.ref; selCass = 0; app.sfx('latent.key'); rebuild(); loupe = { ...loupe, x: p.x, y: p.y - lift, on: true }; return true }
        if (hit(table, p.x, p.y)) { loupe = { ...loupe, x: p.x, y: p.y - lift, on: true }; return true }
        return false
      }
      if (p.type === 'move') { if (loupe.on || p.pointerType === 'mouse') { loupe.x = p.x; loupe.y = p.y - lift } return loupe.on }
      if (p.type === 'up' || p.type === 'cancel') { loupe.on = false; return true }
      if (p.type === 'dbl') {
        for (let i = 0; i < 11; i++) if (hit(cass[i], p.x, p.y)) { selCass = i + 1; turned = !turned; rebuild(); return true }
        for (const f of frameRects) if (hit(f.r, p.x, p.y)) { hooks.toCarrier(f.ref); return true }
      }
      return false
    },
    wheel(dy) { if (loupe.on) { loupe.power = clamp(loupe.power + (dy > 0 ? -4 : 4), 4, 8); return true } return false },
    key(e) {
      if (e.code === 'KeyE' && selFrame) { hooks.toCarrier(selFrame); return true }
      if (e.code === 'Space') { loupe.on = e.type === 'keydown'; return true }
      if (selFrame && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        const n = rollMeta(selFrame.roll).frames
        selFrame = { roll: selFrame.roll, frame: clamp(selFrame.frame + (e.code === 'ArrowRight' ? 1 : -1), 1, n) }
        const f = frameRects.find((x) => x.ref.frame === selFrame!.frame)
        if (f) loupe = { ...loupe, x: f.r.x + f.r.w / 2, y: f.r.y + f.r.h / 2, on: true }
        rebuild(); return true
      }
      return false
    },
    layout() {
      const out: Record<string, [number, number]> = {}
      cass.forEach((c, i) => { out[`cassette${i + 1}`] = [c.x + c.w / 2, c.y + c.h / 2] })
      frameRects.forEach((f) => { out[`frame${f.ref.frame}`] = [f.r.x + f.r.w / 2, f.r.y + f.r.h / 2] })
      return out
    },
  }
  return station
}
