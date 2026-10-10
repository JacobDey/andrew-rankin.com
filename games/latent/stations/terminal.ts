// Station 1: the amber records terminal (GDD §4.2, §5.9; story bible §6–7). CRT on the left, the
// receipt tape on the right (stacked on phones). Typing goes through a hidden <input>.
import { PALETTES } from '@shared/dither'
import type { App } from '../core/app'
import { S, advanceClock, autosave, bus, clockText, setFlag, tape } from '../core/state'
import type { GamePointer, Station } from '../core/types'
import { BOOT_LINES, BOOT_QUERY, TERM } from '../data/text'
import { getDoc, search, type SearchResult } from '../search'
import { RED, crispText, gray, wrap } from '../render/screen'

type Mode = 'boot' | 'search' | 'doc' | 'disposition' | 'confirm'
interface Rect { x: number; y: number; w: number; h: number }
const hit = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

export interface TerminalHooks { onClose(d: 'FILE' | 'PURGE'): void; developedAny(): boolean; envelopeCount(): number }

export function createTerminalStation(app: App, hooks: TerminalHooks): Station & { search(q: string): SearchResult; openDoc(id: string): void; typeLine(s: string): void } {
  const pal = PALETTES.latentTerminal
  let mode: Mode = 'boot'
  let bootT = 0
  let query = ''
  let status = ''
  let result: SearchResult | null = null
  let sel = 0
  let docId = ''
  let scroll = 0
  let maxScroll = 0
  let disp: 'FILE' | 'PURGE' = 'FILE'
  let yes = true
  let lastLine = ''
  let w = 1, h = 1, phone = false
  let crt: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let tapeR: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let rows: Rect[] = []
  let tapeRows: { r: Rect; q: string }[] = []
  let words: { r: Rect; w: string }[] = []
  let choiceRects: Rect[] = []
  let queryRect: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let dragY: number | null = null
  let caret = 0

  const input = document.createElement('input')
  input.className = 'li-hidden-input'
  input.setAttribute('aria-label', 'Search the records')
  input.autocapitalize = 'characters'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.enterKeyHint = 'search'
  input.maxLength = 40
  const sr = document.createElement('div')
  sr.className = 'li-sr'
  sr.setAttribute('aria-live', 'polite')
  const controls = document.createElement('div')
  controls.className = 'li-term-controls'
  controls.append(input, sr)

  const fs = () => Math.round((phone ? 14 : 15) * S.save.settings.textSize)
  const lh = () => Math.round(fs() * 1.4)

  function bootDone(): boolean { return bootT * 40 >= BOOT_LINES.join('').length + 8 }
  function finishBoot(): void { if (mode === 'boot') { bootT = 999; mode = 'search'; query = BOOT_QUERY; input.value = query; try { input.setSelectionRange(0, query.length) } catch { /* */ } } }

  function runSearch(q: string, fromTape = false): SearchResult {
    finishBoot()
    const r = search(q)
    query = r.q
    input.value = query
    if (r.status === 'close') {
      if (!hooks.developedAny()) { status = TERM.notProcessed; result = null; return r }
      mode = 'disposition'; disp = 'FILE'; status = TERM.disposition; result = null
      app.sfx('latent.seek', { n: 4 })
      return r
    }
    if (r.status === 'help') { status = TERM.help; result = null; return r }
    if (r.status === 'empty') return r
    const already = S.save.tape.some((t) => t.text.toUpperCase() === r.q && t.count !== undefined)
    if (r.status === 'tooMany') status = TERM.tooMany
    else if (r.status === 'everything') status = TERM.everything
    else if (r.status === 'none') status = TERM.none
    else status = TERM.results(r.count)
    if (already && r.status !== 'tooMany') status = `${TERM.repeat}  ${status}`
    result = r.status === 'ok' ? r : null
    sel = 0
    mode = 'search'
    if (!already && !fromTape && (r.status === 'ok' || r.status === 'none' || r.status === 'everything')) {
      const lower = r.tokens.length === 1 && (r.tokens[0] === 'RUTH' || r.tokens[0] === 'MINA')
      tape(lower ? r.q.toLowerCase() : r.q, r.status === 'everything' ? '—' : String(r.count), lower)
      S.save.stats.searches++
      advanceClock(1)
    }
    const t = new Set(r.tokens)
    if (t.has('ODGER') || t.has('ODGERS') || t.has('4471')) setFlag('B')
    if (t.has('KDL') || t.has('417')) setFlag('D')
    if (t.has('STATURE') || t.has('FEMUR') || t.has('HEIGHT')) setFlag('H')
    app.sfx('latent.seek', { n: 3 + Math.min(4, r.count) })
    app.sfx('latent.tape', { lines: 1 })
    sr.textContent = `${status}. ${result ? result.shown.map((id) => { const d = getDoc(id)!; return `${d.date} ${id} ${d.type}` }).join('; ') : ''}`
    bus.emit('search', { q: r.q, count: r.count })
    return r
  }

  function openDoc(id: string): void {
    const d = getDoc(id)
    if (!d) return
    finishBoot()
    docId = id; mode = 'doc'; scroll = 0
    if (!S.save.docsRead.includes(id)) { S.save.docsRead.push(id); autosave() }
    app.sfx('latent.seek', { n: 3 })
    sr.textContent = [d.id, d.date, d.type, d.headline, ...d.body, ...d.margin.map((m) => `(${m.tag}) ${m.text}`)].join('. ')
    bus.emit('doc:open', id)
  }

  function back(): void {
    if (mode === 'doc') { mode = 'search'; return }
    if (mode === 'disposition' || mode === 'confirm') { mode = 'search'; status = ''; return }
  }

  function choose(): void {
    if (mode === 'disposition') { mode = 'confirm'; yes = true; status = disp === 'FILE' ? TERM.file(hooks.envelopeCount()) : TERM.purge; app.sfx('latent.key'); return }
    if (mode === 'confirm') {
      if (!yes) { mode = 'search'; status = ''; return }
      tape(`CLOSE 03-0417 ${disp}`)
      hooks.onClose(disp)
    }
  }

  function submit(): void {
    const q = input.value.trim()
    if (mode === 'disposition') {
      const u = q.toUpperCase()
      if (u === 'FILE' || u === 'PURGE') { disp = u; input.value = ''; choose() } else choose()
      return
    }
    if (mode === 'confirm') { const u = q.toUpperCase(); if (u === 'NO') yes = false; input.value = ''; choose(); return }
    if (mode === 'doc' && !q) { back(); return }
    if (result && !q.length) { openDoc(result.shown[sel]); return }
    if (result && q.toUpperCase() === lastLine && mode === 'search') { openDoc(result.shown[sel]); return }
    lastLine = q.toUpperCase()
    runSearch(q)
  }

  input.addEventListener('input', () => { input.value = input.value.toUpperCase(); query = input.value; caret = 0; app.sfx('latent.key') })
  input.addEventListener('keydown', (e) => {
    if (mode === 'boot') { finishBoot(); if (e.key === 'Enter' || e.key.length !== 1) { e.preventDefault(); return } input.value = ''; return }
    if (e.key === 'Enter') { e.preventDefault(); submit(); return }
    if (e.key === 'Escape') { e.preventDefault(); back(); return }
    if (e.key === 'Tab') { e.preventDefault(); app.go(e.shiftKey ? 'line' : 'lighttable'); return }
    if (mode === 'doc' && (e.key === 'ArrowDown' || e.key === 'PageDown')) { scroll = Math.min(maxScroll, scroll + (e.key === 'PageDown' ? h * 0.5 : lh() * 2)); e.preventDefault(); return }
    if (mode === 'doc' && (e.key === 'ArrowUp' || e.key === 'PageUp')) { scroll = Math.max(0, scroll - (e.key === 'PageUp' ? h * 0.5 : lh() * 2)); e.preventDefault(); return }
    if ((mode === 'disposition') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) { disp = disp === 'FILE' ? 'PURGE' : 'FILE'; app.sfx('latent.key'); e.preventDefault(); return }
    if ((mode === 'confirm') && (e.key.startsWith('Arrow'))) { yes = !yes; app.sfx('latent.key'); e.preventDefault(); return }
    if (result && mode === 'search' && e.key === 'ArrowDown') { sel = Math.min(result.shown.length - 1, sel + 1); app.sfx('latent.key'); e.preventDefault(); lastLine = input.value.toUpperCase() }
    if (result && mode === 'search' && e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); app.sfx('latent.key'); e.preventDefault(); lastLine = input.value.toUpperCase() }
  })

  function layout(): void {
    if (phone) {
      crt = { x: 8, y: 8, w: w - 16, h: Math.round(h * 0.76) }
      tapeR = { x: 12, y: crt.y + crt.h + 10, w: w - 24, h: h - crt.h - 26 }
    } else {
      crt = { x: 24, y: 20, w: Math.round(w * 0.62) - 24, h: h - 40 }
      tapeR = { x: crt.x + crt.w + 40, y: 30, w: Math.min(300, w - crt.x - crt.w - 64), h: Math.round(h * 0.6) }
    }
  }

  const st: Station & { search(q: string): SearchResult; openDoc(id: string): void; typeLine(s: string): void } = {
    id: 'terminal',
    palette: () => pal,
    controls,
    search: (q) => runSearch(q),
    openDoc,
    typeLine(s: string) { finishBoot(); input.value = s.toUpperCase(); query = input.value; submit() },
    enter() {
      if (S.save.stats.searches > 0 || S.save.tape.length > 0) finishBoot()
      if (!app.test && matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus({ preventScroll: true }), 30)
      app.loop('latent.room', { level: 0.7, rain: 0.6 })
    },
    exit() { input.blur() },
    update(dt) {
      if (mode === 'boot') { bootT += dt; if (bootDone()) finishBoot() }
      caret += dt
    },
    resize(W, H, ph) { w = W; h = H; phone = ph; layout() },
    drawLum(g) {
      // room: dark wall, desk
      g.fillStyle = gray(0.03); g.fillRect(0, 0, w, h)
      g.fillStyle = gray(0.1); g.fillRect(0, h * 0.86, w, h * 0.14)
      // CRT bezel and glass
      const r = crt
      g.fillStyle = gray(0.3); roundRect(g, r.x - 10, r.y - 10, r.w + 20, r.h + 20, 18); g.fill()
      g.fillStyle = gray(0.06); roundRect(g, r.x, r.y, r.w, r.h, 14); g.fill()
      const gr = g.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 10, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.7)
      gr.addColorStop(0, gray(0.05)); gr.addColorStop(1, gray(0.0))
      g.fillStyle = gr; roundRect(g, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 12); g.fill()
      // selected row band (the cursor bar), lit
      if (mode === 'search' && result && rows[sel]) { const rr = rows[sel]; g.fillStyle = gray(0.3); g.fillRect(rr.x - 4, rr.y, rr.w + 8, rr.h) }
      // the receipt tape: paper curling out of a slot
      const t = tapeR
      g.fillStyle = gray(0.22); g.fillRect(t.x - 14, t.y + t.h, t.w + 28, 16)
      g.fillStyle = gray(1); g.fillRect(t.x, t.y, t.w, t.h)
      if (!phone) {
        // the desk phone and the wall clock
        const px = t.x + 20, py = t.y + t.h + 60
        g.fillStyle = gray(0.3); roundRect(g, px, py, 90, 54, 8); g.fill()
        g.fillStyle = gray(0.45); roundRect(g, px - 6, py - 14, 102, 18, 9); g.fill()
        g.beginPath(); g.arc(t.x + t.w - 50, py + 26, 34, 0, Math.PI * 2); g.fillStyle = gray(0.8); g.fill()
        g.strokeStyle = gray(0.05); g.lineWidth = 3
        const m = S.save.clock + 21 * 60
        const a1 = ((m % 60) / 60) * Math.PI * 2 - Math.PI / 2, a2 = ((m / 60) % 12 / 12) * Math.PI * 2 - Math.PI / 2
        g.beginPath(); g.moveTo(t.x + t.w - 50, py + 26); g.lineTo(t.x + t.w - 50 + Math.cos(a1) * 26, py + 26 + Math.sin(a1) * 26); g.stroke()
        g.beginPath(); g.moveTo(t.x + t.w - 50, py + 26); g.lineTo(t.x + t.w - 50 + Math.cos(a2) * 16, py + 26 + Math.sin(a2) * 16); g.stroke()
      }
    },
    drawCrisp(g) {
      const amber = pal.light, ink = pal.ink
      const r = crt
      const pad = phone ? 14 : 22
      const x0 = r.x + pad, maxW = r.w - pad * 2
      let y = r.y + pad + fs()
      g.save(); g.beginPath(); g.rect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); g.clip()
      rows = []; words = []; choiceRects = []
      const F = fs(), LH = lh()
      g.font = `500 ${F}px 'IBM Plex Mono', monospace`
      if (mode === 'boot') {
        let n = Math.floor(bootT * 40)
        for (const line of BOOT_LINES) { const s = line.slice(0, Math.max(0, n)); n -= line.length; for (const l of wrap(g, s, maxW)) { crispText(g, l, x0, y, F, amber); y += LH } }
        if (n > 0) crispText(g, 'SEARCH: ' + BOOT_QUERY.slice(0, n) + (caret % 1 < 0.5 ? '_' : ''), x0, y, F, amber)
      } else if (mode === 'doc') {
        const d = getDoc(docId)!
        crispText(g, `${d.id} · ${d.date} · ${d.type}`, x0, y, F, amber, { weight: 600, max: maxW }); y += LH
        crispText(g, 'ESC: BACK TO RESULTS', x0, y, Math.round(F * 0.8), amber); y += LH * 1.2
        g.save(); g.beginPath(); g.rect(r.x, y - F, r.w, r.h - (y - F - r.y) - 8); g.clip()
        let yy = y - scroll
        const startY = yy
        if (d.headline) { g.font = `600 ${F * 1.5}px 'IBM Plex Mono', monospace`; for (const l of wrap(g, d.headline, maxW)) { crispText(g, l, x0, yy, F * 1.5, amber, { weight: 600 }); yy += LH * 1.5 } }
        g.font = `500 ${F}px 'IBM Plex Mono', monospace`
        for (const para of d.body) {
          for (const l of wrap(g, para, maxW)) {
            crispText(g, l, x0, yy, F, amber)
            let xx = x0
            for (const wd of l.split(' ')) { const ww = g.measureText(wd).width; words.push({ r: { x: xx, y: yy - F, w: ww, h: LH }, w: wd }); xx += ww + g.measureText(' ').width }
            yy += LH
          }
          yy += LH * 0.4
        }
        for (const m of d.margin) {
          const hand = m.tag.startsWith('margin')
          const size = hand ? F * 1.35 : F
          g.font = hand ? `600 ${size}px 'Caveat Variable', cursive` : `500 ${F}px 'IBM Plex Mono', monospace`
          crispText(g, `(${m.tag})`, x0, yy, Math.round(F * 0.75), amber); yy += LH * 0.9
          for (const l of wrap(g, m.text, maxW - 20)) { crispText(g, l, x0 + 20, yy, size, amber, { font: hand ? 'hand' : 'mono', weight: hand ? 600 : 500 }); yy += LH * (hand ? 1.2 : 1) }
          g.font = `500 ${F}px 'IBM Plex Mono', monospace`
        }
        maxScroll = Math.max(0, yy - startY - (r.h - (y - r.y)) + LH)
        g.restore()
      } else {
        // query line
        const q = mode === 'search' ? input.value : input.value
        queryRect = { x: x0 - 6, y: y - F - 4, w: maxW + 12, h: LH + 8 }
        crispText(g, `SEARCH: ${q}${caret % 1 < 0.5 ? '_' : ' '}`, x0, y, F, amber, { weight: 600 })
        y += LH * 1.4
        if (status) { g.font = `500 ${F}px 'IBM Plex Mono', monospace`; for (const l of wrap(g, status, maxW)) { crispText(g, l, x0, y, F, amber); y += LH }; y += LH * 0.4 }
        if (mode === 'search' && result) {
          for (let i = 0; i < result.shown.length; i++) {
            const d = getDoc(result.shown[i])!
            const unread = !S.save.docsRead.includes(d.id)
            const rr = { x: x0, y: y - F - 2, w: maxW, h: LH + 2 }
            rows.push(rr)
            const on = i === sel
            if (on) { g.fillStyle = amber; g.fillRect(rr.x - 4, rr.y, rr.w + 8, rr.h); g.fillStyle = RED; g.fillRect(rr.x - 10, rr.y, 4, rr.h) }
            const line = phone ? `${unread ? '•' : ' '} ${d.date.slice(2, 4)}${d.date.slice(5, 7)}${d.date.slice(8)} ${d.id}` : `${unread ? '•' : ' '}  ${d.date}  ${d.id.padEnd(16)} ${d.type}`
            crispText(g, line, x0, y, F, on ? ink : amber, { max: maxW })
            y += LH + 4
          }
          y += LH * 0.5
          crispText(g, phone ? '↑↓ + ENTER OR TAP TO OPEN' : '↑ ↓ + ENTER TO OPEN · CLICK A ROW · ESC BACK', x0, y, Math.round(F * 0.8), amber)
        }
        if (mode === 'disposition' || mode === 'confirm') {
          const opts = mode === 'disposition' ? ['FILE', 'PURGE'] : ['YES', 'NO']
          const cur = mode === 'disposition' ? (disp === 'FILE' ? 0 : 1) : yes ? 0 : 1
          let xx = x0
          g.font = `600 ${F * 1.4}px 'IBM Plex Mono', monospace`
          opts.forEach((o, i) => {
            const ww = g.measureText(o).width + 24
            const rr = { x: xx, y: y - F * 1.4, w: ww, h: F * 2 }
            choiceRects.push(rr)
            if (i === cur) { g.fillStyle = amber; g.fillRect(rr.x, rr.y, rr.w, rr.h); g.strokeStyle = RED; g.lineWidth = 2; g.strokeRect(rr.x - 3, rr.y - 3, rr.w + 6, rr.h + 6) }
            crispText(g, o, xx + 12, y, F * 1.4, i === cur ? ink : amber, { weight: 600 })
            xx += ww + 24
          })
        }
      }
      g.restore()
      // the tape
      const t = tapeR
      tapeRows = []
      const tf = Math.round((phone ? 11 : 12) * Math.min(1.5, S.save.settings.textSize))
      const tl = Math.round(tf * 1.45)
      g.save(); g.beginPath(); g.rect(t.x, t.y, t.w, t.h); g.clip()
      const lines = S.save.tape
      let ty = t.y + t.h - 10
      for (let i = lines.length - 1; i >= 0 && ty > t.y; i--) {
        const L = lines[i]
        const label = L.count !== undefined ? `${clockText(L.clock)}  ${L.text} ${'.'.repeat(Math.max(2, 16 - L.text.length))} ${L.count}` : `${clockText(L.clock)}  ${L.text}`
        crispText(g, label, t.x + 8, ty, tf, ink, { max: t.w - 16 })
        if (L.count !== undefined) tapeRows.push({ r: { x: t.x, y: ty - tf, w: t.w, h: tl }, q: L.text })
        ty -= tl
      }
      if (!lines.length) crispText(g, 'RECEIPT TAPE', t.x + 8, t.y + t.h - 10, tf, ink)
      g.restore()
      if (!phone) crispText(g, 'DESK  (P)', tapeR.x + 22, tapeR.y + tapeR.h + 132, 12, amber)
    },
    pointer(p: GamePointer) {
      if (p.type === 'down') {
        if (mode === 'boot') { finishBoot(); return true }
        input.focus({ preventScroll: true })
        if (!phone && p.x > tapeR.x && p.x < tapeR.x + 110 && p.y > tapeR.y + tapeR.h + 40 && p.y < tapeR.y + tapeR.h + 130) { app.phone(); return true }
        for (const tr of tapeRows) if (hit(tr.r, p.x, p.y)) { runSearch(tr.q, true); return true }
        if (mode === 'search' && result) for (let i = 0; i < rows.length; i++) if (hit(rows[i], p.x, p.y)) { if (sel === i || p.pointerType === 'touch') openDoc(result.shown[i]); else sel = i; app.sfx('latent.key'); return true }
        for (let i = 0; i < choiceRects.length; i++) if (hit(choiceRects[i], p.x, p.y)) {
          if (mode === 'disposition') { disp = i === 0 ? 'FILE' : 'PURGE'; choose() } else { yes = i === 0; choose() }
          return true
        }
        if (mode === 'doc') dragY = p.y
        return true
      }
      if (p.type === 'move' && dragY !== null && mode === 'doc') { scroll = Math.max(0, Math.min(maxScroll, scroll - (p.y - dragY))); dragY = p.y; return true }
      if (p.type === 'up' || p.type === 'cancel') { dragY = null; return true }
      if ((p.type === 'dbl' || p.type === 'long') && mode === 'doc') {
        for (const wd of words) if (hit(wd.r, p.x, p.y)) {
          const clean = wd.w.replace(/^[^A-Z0-9']+|[^A-Z0-9.']+$/gi, '').replace(/\.$/, '').toUpperCase()
          if (clean) { const cur = input.value.trim(); input.value = cur && cur.split(' ').length < 2 && mode === 'doc' ? `${cur} ${clean}` : clean; query = input.value; mode = 'search'; app.sfx('latent.key'); input.focus({ preventScroll: true }) }
          return true
        }
      }
      return false
    },
    wheel(dy) { if (mode === 'doc') { scroll = Math.max(0, Math.min(maxScroll, scroll + dy)); return true } return false },
    key(e) {
      if (mode === 'boot') { finishBoot(); return true }
      if (e.key === 'Escape') { back(); return true }
      return false
    },
    layout() {
      const out: Record<string, [number, number]> = { query: [queryRect.x + 40, queryRect.y + 10], tape: [tapeR.x + tapeR.w / 2, tapeR.y + tapeR.h - 10] }
      rows.forEach((r, i) => { out[`row${i}`] = [r.x + r.w / 2, r.y + r.h / 2] })
      return out
    },
  }
  return st
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
