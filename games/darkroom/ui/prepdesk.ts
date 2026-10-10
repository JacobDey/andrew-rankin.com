// PREP desk (darkroom.md §5.9, §7.2): import, channel, invert, flip, 5-point
// curve on a spring, and the two outputs (8×10 transparency, 35 mm film).
import { cropTo45, CURVE_PRESETS, defaultPrep, monotoneCurve, PREP_H, PREP_W, prep, renderTransparency } from '../content/prep'
import { drawPositive, NEG_H, NEG_W } from '../content/negatives'
import type { DarkroomContent, PrepSettings } from '../types'
import { h } from './dom'

export interface PrepDesk {
  el: HTMLElement
  preview: HTMLCanvasElement
  loadFile(f: Blob, name?: string): Promise<boolean>
  loadImageData(img: ImageData, name: string): void
  settings: PrepSettings
  output(format: '35mm' | '8x10'): string
  update(dt: number): void
}

export function createPrepDesk(content: DarkroomContent, o: { onOutput(id: string, format: '35mm' | '8x10'): void; onError(msg: string): void; onImported(name: string, blob: Blob | null): void }): PrepDesk {
  const s = defaultPrep()
  let src: ImageData | null = null
  let srcName = 'Mailbox (O.)'
  let outCount = 0
  const preview = document.createElement('canvas')
  preview.width = PREP_W; preview.height = PREP_H
  const pctx = preview.getContext('2d') as CanvasRenderingContext2D
  const pimg = pctx.createImageData(PREP_W, PREP_H)
  let dirty = true

  function sample(id: string) {
    const L = drawPositive(id)
    const img = new ImageData(NEG_W, NEG_H)
    for (let i = 0; i < L.length; i++) { const v = Math.round(255 * L[i]); img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255 }
    src = img
    srcName = id
    dirty = true
  }

  // curve wire with springy handles
  const curve = { y: s.curve.slice(), v: [0, 0, 0, 0, 0], target: s.curve.slice() }
  const cv = h('canvas', { className: 'dr-curve', width: 240, height: 160, 'aria-label': 'Tone curve: drag the five handles' }) as HTMLCanvasElement
  const cctx = cv.getContext('2d') as CanvasRenderingContext2D
  let dragK = -1
  const toLocal = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height } }
  cv.addEventListener('pointerdown', (e) => {
    const p = toLocal(e)
    dragK = Math.max(0, Math.min(4, Math.round(p.x * 4)))
    cv.setPointerCapture(e.pointerId)
    curve.target[dragK] = Math.max(0, Math.min(1, p.y))
  })
  cv.addEventListener('pointermove', (e) => { if (dragK >= 0) curve.target[dragK] = Math.max(0, Math.min(1, toLocal(e).y)) })
  const end = () => { dragK = -1 }
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end)
  function drawCurve() {
    const W = cv.width, H = cv.height
    cctx.clearRect(0, 0, W, H)
    cctx.fillStyle = '#16130f'; cctx.fillRect(0, 0, W, H)
    cctx.strokeStyle = 'rgba(237,228,211,0.12)'
    for (let i = 1; i < 4; i++) { cctx.beginPath(); cctx.moveTo((i * W) / 4, 0); cctx.lineTo((i * W) / 4, H); cctx.moveTo(0, (i * H) / 4); cctx.lineTo(W, (i * H) / 4); cctx.stroke() }
    const f = monotoneCurve(curve.y)
    cctx.strokeStyle = '#86ABF0'; cctx.lineWidth = 2; cctx.beginPath()
    for (let x = 0; x <= W; x += 2) { const y = H - f(x / W) * H; if (x === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y) }
    cctx.stroke()
    for (let k = 0; k < 5; k++) { cctx.fillStyle = k === dragK ? '#EDE4D3' : '#86ABF0'; cctx.beginPath(); cctx.arc((k / 4) * W, H - curve.y[k] * H, 6, 0, 7); cctx.fill() }
  }

  const chanSeg = h('div', { className: 'dr-seg', role: 'radiogroup', 'aria-label': 'Channel' })
  const chans: PrepSettings['channel'][] = ['lum', 'r', 'g', 'b']
  const chanBtns = chans.map((c) => {
    const b = h('button', { className: 'dr-segbtn', type: 'button', role: 'radio', textContent: c === 'lum' ? 'Lum' : c.toUpperCase() }) as HTMLButtonElement
    b.addEventListener('click', () => { s.channel = c; dirty = true; sync() })
    chanSeg.appendChild(b)
    return b
  })
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = h('button', { className: 'dr-toggle', type: 'button', textContent: label }) as HTMLButtonElement
    b.addEventListener('click', () => { set(!get()); dirty = true; sync() })
    return { b, get }
  }
  const tInvert = toggle('Invert', () => s.invert, (v) => { s.invert = v })
  const tFlip = toggle('Flip', () => s.flip, (v) => { s.flip = v })
  const tUv = toggle('UV tint', () => s.uvTint, (v) => { s.uvTint = v })
  const presetSel = h('select', { className: 'dr-select', 'aria-label': 'Curve preset' }) as HTMLSelectElement
  for (const k of Object.keys(CURVE_PRESETS)) presetSel.appendChild(h('option', { value: k, textContent: k }))
  presetSel.addEventListener('change', () => { curve.target = CURVE_PRESETS[presetSel.value].slice() })
  const sampleSel = h('select', { className: 'dr-select', 'aria-label': 'Sample image' }) as HTMLSelectElement
  for (const [id, n] of [['mailbox', 'Mailbox'], ['pear', 'Pear'], ['dishrack', 'Dish rack'], ['cat', 'Cat'], ['bus', 'Bus shelter'], ['fire', 'Fire escape']]) sampleSel.appendChild(h('option', { value: id, textContent: `O.'s ${n}` }))
  sampleSel.addEventListener('change', () => sample(sampleSel.value))
  const nameEl = h('p', { className: 'dr-mono dr-small', textContent: '' })

  function sync() {
    chanBtns.forEach((b, i) => b.setAttribute('aria-checked', String(s.channel === chans[i])))
    for (const t of [tInvert, tFlip, tUv]) t.b.setAttribute('aria-pressed', String(t.get()))
    nameEl.textContent = src ? `${srcName} · ${PREP_W}×${PREP_H}` : ''
  }

  const btn8 = h('button', { className: 'dr-btn dr-btn--primary', type: 'button', textContent: 'Print transparency 8×10' }) as HTMLButtonElement
  const btn35 = h('button', { className: 'dr-btn', type: 'button', textContent: 'Film recorder 35 mm' }) as HTMLButtonElement
  btn8.addEventListener('click', () => { const id = desk.output('8x10'); o.onOutput(id, '8x10') })
  btn35.addEventListener('click', () => { const id = desk.output('35mm'); o.onOutput(id, '35mm') })
  const importBtn = h('button', { className: 'dr-btn', type: 'button', textContent: 'Import a PNG' }) as HTMLButtonElement
  const fileIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', className: 'dr-file', 'aria-label': 'Import an image' }) as HTMLInputElement
  importBtn.addEventListener('click', () => fileIn.click())
  fileIn.addEventListener('change', () => { const f = fileIn.files?.[0]; if (f) void desk.loadFile(f, f.name); fileIn.value = '' })

  const el = h('div', { className: 'dr-prep' },
    h('div', { className: 'dr-row' }, importBtn, fileIn, sampleSel),
    nameEl,
    h('div', { className: 'dr-row' }, chanSeg),
    h('div', { className: 'dr-row' }, tInvert.b, tFlip.b, tUv.b, presetSel),
    cv,
    h('div', { className: 'dr-row' }, btn8, btn35),
  )

  const desk: PrepDesk = {
    el, preview, settings: s,
    async loadFile(f, name = 'import') {
      try {
        const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' })
        const img = cropTo45(bmp, bmp.width, bmp.height)
        bmp.close?.()
        src = img; srcName = name.replace(/\.[a-z]+$/i, '').slice(0, 24); dirty = true; sync()
        o.onImported(srcName, f)
        return true
      } catch (e) {
        console.debug('[darkroom] import failed', e)
        o.onError("The film jammed. That file wouldn't load.")
        return false
      }
    },
    loadImageData(img, name) {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
      ;(c.getContext('2d') as CanvasRenderingContext2D).putImageData(img, 0, 0)
      src = cropTo45(c, img.width, img.height); srcName = name; dirty = true; sync()
    },
    output(format) {
      if (!src) sample('mailbox')
      const id = `imp${++outCount}-${format === '8x10' ? 't' : 'f'}`
      const settings = { ...s, curve: curve.y.slice(), flip: format === '35mm' ? false : s.flip }
      const neg = prep.toNegative(id, `${srcName} (${format === '8x10' ? 'transparency' : '35 mm'})`, src as ImageData, settings, format)
      if (srcName === 'mailbox' || srcName === 'pear' || srcName === 'dishrack' || srcName === 'cat' || srcName === 'bus' || srcName === 'fire') neg.source = 'builtin'
      content.addNegative(neg)
      return id
    },
    update(dt) {
      // curve handles on a spring (k 40, ζ 0.7)
      let moving = false
      for (let k = 0; k < 5; k++) {
        const kk = 40, c = 2 * 0.7 * Math.sqrt(kk)
        const a = kk * (curve.target[k] - curve.y[k]) - c * curve.v[k]
        curve.v[k] += a * dt; curve.y[k] += curve.v[k] * dt
        // keep monotone-ish ordering soft: clamp to [0,1]
        curve.y[k] = Math.max(0, Math.min(1, curve.y[k]))
        if (Math.abs(curve.target[k] - curve.y[k]) > 1e-4 || Math.abs(curve.v[k]) > 1e-4) moving = true
      }
      if (moving) { s.curve = curve.y.slice(); dirty = true }
      if (dirty && src) {
        const r = prep.run(src, { ...s, curve: curve.y.slice() })
        renderTransparency(r.T, r.W, r.H, pimg)
        pctx.putImageData(pimg, 0, 0)
        dirty = false
        drawCurve()
        previewVersion++
      }
    },
  }
  let previewVersion = 0
  ;(desk as PrepDesk & { version(): number }).version = () => previewVersion
  sample('mailbox')
  sync()
  drawCurve()
  return desk
}
