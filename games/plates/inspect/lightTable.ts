// games/plates/inspect/lightTable.ts — the canary light table (GDD §4.4, §5.9): the plate through the
// frozen PLATE_GLSL at device resolution, the velvet edge (positive left of it), the loupe with true
// grains, L / Both / R eyes, wiggle, the Register line, Cite, and the Sector III pane view.
import * as THREE from 'three'
import { EYE, PLATE_W, PLATE_H, type Ctx, type LightTable, type InspectOpts, type PlateId, type BenchPointer } from '../contracts'
import { PLATE_GLSL, plateUniforms } from '../render/plateGLSL'
import { BAYER_GLSL } from '../render/dither'
import { hex3, PALETTES } from '../render/palette'
import type { PlatesBench } from '../bench/wetBench'
import { paneTexture, PANE_ETCH_RECT } from './pane'

const FRAG = /* glsl */ `
${PLATE_GLSL}
${BAYER_GLSL}
uniform vec4 uRect;      // device px: x, y (top-left), w, h of the shown region
uniform vec4 uRegion;    // plate texels: x, y, w, h
uniform vec4 uRect2; uniform vec4 uRegion2; uniform float uTwo;   // optional second strip (wedge under one eye)
uniform vec3 uLoupe;     // device px centre x, y, radius
uniform float uPower; uniform float uLoupeOn;
uniform float uVelvet;   // device px x of the velvet edge (positive left of it)
uniform float uTime; uniform float uHasE; uniform float uPane; uniform float uDpr;
uniform sampler2D uPaneTex; uniform vec2 uPaneSize;
uniform vec3 uInk; uniform vec3 uLight;
uniform vec2 uView;      // canvas device px
uniform float uShiftR;   // texels to shift (wiggle convergence)
float noise1(float y) { return fract(sin(y * 12.9898) * 43758.5453) * 2.0 - 1.0; }
vec2 toPlate(vec2 p, vec4 rect, vec4 region) { return region.xy + (p - rect.xy) / rect.zw * region.zw; }
void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);     // device px, y down
  vec4 rect = uRect, region = uRegion;
  bool in1 = all(greaterThanEqual(p, rect.xy)) && all(lessThan(p, rect.xy + rect.zw));
  bool in2 = uTwo > 0.5 && all(greaterThanEqual(p, uRect2.xy)) && all(lessThan(p, uRect2.xy + uRect2.zw));
  vec2 q = p;
  float scale = rect.z / region.z;                             // device px per texel at fit
  float tppMul = 1.0;
  bool inLoupe = uLoupeOn > 0.5 && distance(p, uLoupe.xy) < uLoupe.z;
  if (inLoupe) { q = uLoupe.xy + (p - uLoupe.xy) / uPower; tppMul = 1.0 / uPower; in1 = all(greaterThanEqual(q, rect.xy)) && all(lessThan(q, rect.xy + rect.zw)); in2 = uTwo > 0.5 && all(greaterThanEqual(q, uRect2.xy)) && all(lessThan(q, uRect2.xy + uRect2.zw)); }
  float bit = 0.0;
  bool any = in1 || in2;
  if (any) {
    vec2 t = in1 ? toPlate(q, rect, region) : toPlate(q, uRect2, uRegion2);
    if (uPane > 0.5) {
      vec2 puv = t / uPaneSize;
      float v = texture(uPaneTex, puv).r;
      float tpp = (1.0 / scale) * tppMul;
      bit = v > 0.5 ? 1.0 : 0.0;
      float g = texture(uNoise, (floor(t / max(1.0, tpp)) + 0.5) / 128.0).r;
      if (v > 0.12 && v <= 0.5) bit = step(g, v);
    } else {
      if (in1 && t.x >= 512.0) t.x -= uShiftR;
      vec2 uv = t / vec2(${PLATE_W}.0, ${PLATE_H}.0);
      float tpp = max(1.0 / scale * tppMul, 1e-3);
      float silver = uHasE > 0.5 ? plateSilver(uv, tpp) : 0.0;
      float milk = plateMilk(uv, tpp);
      // velvet edge: x_edge(y) = x0 + 6px sin(y/37 + t 0.3) + 3px noise
      float yy = p.y / uDpr;
      float edge = uVelvet + (6.0 * sin(yy / 37.0 + uTime * 0.3) + 3.0 * noise1(floor(yy / 3.0))) * uDpr;
      bool pos = p.x < edge;
      if (!pos) bit = (silver > 0.5 || milk > 0.5) ? 0.0 : 1.0;      // transmission: silver ink, clear light, milk ink
      else bit = (silver > 0.5 || milk > 0.5) ? 1.0 : 0.0;           // over velvet: silver light, clear ink, milk light
    }
  } else {
    // the opal table around the glass: canary light, a soft dithered falloff toward the corners
    vec2 c = p / uView - 0.5;
    float l = 0.62 - dot(c, c) * 1.2;
    bit = step(bayer8(floor(p / max(1.0, uDpr))), l);
    if (uPane < 0.5) {
      float yy = p.y / uDpr;
      float edge = uVelvet + (6.0 * sin(yy / 37.0 + uTime * 0.3) + 3.0 * noise1(floor(yy / 3.0))) * uDpr;
      if (p.x < edge) bit = step(bayer8(floor(p / max(1.0, uDpr))), 0.06);
    }
  }
  if (uLoupeOn > 0.5) {
    float d = distance(p, uLoupe.xy);
    if (d >= uLoupe.z && d < uLoupe.z + 7.0 * uDpr) bit = (d < uLoupe.z + 2.0 * uDpr || d > uLoupe.z + 5.0 * uDpr) ? 0.0 : 1.0;
  }
  gl_FragColor = vec4(bit > 0.5 ? uLight : uInk, 1.0);
}`

export interface PlatesLightTable extends LightTable {
  readonly opts: Required<Omit<InspectOpts, 'loupe'>> & { loupe: InspectOpts['loupe'] }
  readonly paneSeconds: number
  onClose: (() => void) | null
  onCite: ((id: PlateId) => void) | null
  onRegister: ((id: PlateId) => void) | null
  onPaneRead: (() => void) | null
  onLeave: (() => void) | null
  twoColourCheck(): number
  layout(): void
  loupeOverEtch(): boolean
}

export function createLightTable(ctx: Ctx, bench: PlatesBench, root?: HTMLElement): PlatesLightTable {
  const renderer = ctx.renderer
  const blank = new THREE.DataTexture(new Uint8Array(16), 4, 4, THREE.RedFormat, THREE.UnsignedByteType); blank.needsUpdate = true
  const blankChem = new THREE.DataTexture(new Uint16Array(16 * 4), 4, 4, THREE.RGBAFormat, THREE.HalfFloatType); blankChem.needsUpdate = true
  const pane = paneTexture()
  const uniforms = {
    ...plateUniforms({ E: blank, chem: blankChem, seed: new THREE.Vector2() }, ctx.noise),
    uRect: { value: new THREE.Vector4() }, uRegion: { value: new THREE.Vector4() }, uRect2: { value: new THREE.Vector4() }, uRegion2: { value: new THREE.Vector4() }, uTwo: { value: 0 },
    uLoupe: { value: new THREE.Vector3() }, uPower: { value: 4 }, uLoupeOn: { value: 0 }, uVelvet: { value: 0 }, uTime: { value: 0 }, uHasE: { value: 0 }, uPane: { value: 0 }, uDpr: { value: 1 },
    uPaneTex: { value: pane.tex }, uPaneSize: { value: new THREE.Vector2(pane.w, pane.h) },
    uInk: { value: new THREE.Vector3(...hex3(PALETTES.canary.ink)) }, uLight: { value: new THREE.Vector3(...hex3(PALETTES.canary.light)) },
    uView: { value: new THREE.Vector2(1, 1) }, uShiftR: { value: 0 },
  }
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG, depthTest: false, depthWrite: false })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false
  const scene = new THREE.Scene(); scene.add(quad)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  // ---- DOM: velvet tab, caption, bottom bar, register slip, eye pager
  const ui = document.createElement('div'); ui.className = 'pl-table'; ui.hidden = true
  ui.innerHTML = `
    <button class="pl-velvet-tab" type="button" aria-label="Velvet: drag across the plate">VELVET</button>
    <div class="pl-table-cap"><div class="pl-cap-title"></div><div class="pl-cap-when"></div><div class="pl-cap-grade"></div></div>
    <div class="pl-register" hidden><p></p></div>
    <div class="pl-table-hint">Compare the two eyes: drag the VELVET tab across the glass, or press Wiggle. Loupe magnifies. Cite files a plate in the Return.</div>
    <div class="pl-table-bar" role="toolbar" aria-label="Light table">
      <button type="button" data-a="back" aria-label="Back to the bench">‹ Back</button>
      <span class="pl-eyes" role="group" aria-label="Eye"><button type="button" data-a="L">L</button><button type="button" data-a="both">Both</button><button type="button" data-a="R">R</button></span>
      <button type="button" data-a="wiggle">Wiggle</button>
      <button type="button" data-a="loupe">Loupe</button>
      <button type="button" data-a="register">Register</button>
      <button type="button" data-a="cite">Cite</button>
    </div>`
  ;(root ?? document.body).appendChild(ui)
  const tab = ui.querySelector('.pl-velvet-tab') as HTMLButtonElement
  const capTitle = ui.querySelector('.pl-cap-title') as HTMLElement, capWhen = ui.querySelector('.pl-cap-when') as HTMLElement, capGrade = ui.querySelector('.pl-cap-grade') as HTMLElement
  const reg = ui.querySelector('.pl-register') as HTMLElement
  const bar = ui.querySelector('.pl-table-bar') as HTMLElement

  let showing: PlateId | 'pane' | null = null
  let isOpen = false, time = 0, wiggleT = 0, wigglePhase = 0, paneSeconds = 0, paneReadSent = false
  const opts = { velvet: 0, eye: 'both' as 'L' | 'R' | 'both', wiggle: false, loupe: null as InspectOpts['loupe'], zoom: 1, pan: [0, 0] as [number, number] }
  let loupePx: [number, number] | null = null      // css px when following the cursor
  let loupeOn = false, power: 2 | 4 | 8 = 4
  let rectCss = { x: 0, y: 0, w: 1, h: 1 }, region = { x: 0, y: 0, w: PLATE_W, h: PLATE_H }

  const portrait = () => { const r = renderer.domElement.getBoundingClientRect(); return r.height > r.width * 1.1 }
  function layout(): void {
    const hintEl = ui.querySelector('.pl-table-hint') as HTMLElement | null; if (hintEl) { const bh = bar.offsetHeight; hintEl.style.bottom = `${(bh || 62) + 6}px`; hintEl.hidden = showing === 'pane' }
    const c = renderer.domElement.getBoundingClientRect()
    const W = c.width, H = c.height, barH = 64, topH = 8
    const eye = opts.wiggle ? (wigglePhase ? 'R' : 'L') : (opts.eye === 'both' && portrait() ? 'L' : opts.eye)
    if (showing === 'pane') region = { x: 0, y: 0, w: pane.w, h: pane.h }
    else if (eye === 'L') region = { x: EYE.L.x - 8, y: EYE.L.y - 8, w: EYE.L.w + 16, h: 500 - EYE.L.y + 4 }
    else if (eye === 'R') region = { x: EYE.L.x - 8, y: EYE.L.y - 8, w: EYE.L.w + 16, h: 500 - EYE.L.y + 4 }
    else region = { x: 0, y: 0, w: PLATE_W, h: PLATE_H }
    const availW = W * 0.92, availH = (H - barH - topH) * 0.92
    const s = Math.min(availW / region.w, availH / region.h)
    const w = region.w * s, h = region.h * s
    rectCss = { x: (W - w) / 2, y: topH + (H - barH - topH - h) / 2, w, h }
    uniforms.uTwo.value = 0
    if (showing !== 'pane' && eye === 'R') {
      // show the right image in the same frame; the wedge strip under the left eye stays visible
      uniforms.uShiftR.value = 0
      region = { x: EYE.R.x - 8, y: EYE.R.y - 8, w: EYE.R.w + 16, h: 500 - EYE.R.y + 4 }
    }
    if (opts.wiggle && eye === 'R' && showing !== 'pane') uniforms.uShiftR.value = ctx.lib.meta(showing as PlateId).convergencePx
    else uniforms.uShiftR.value = 0
  }
  function applyUniforms(): void {
    const dpr = renderer.getPixelRatio()
    const size = renderer.getDrawingBufferSize(new THREE.Vector2())
    uniforms.uView.value.copy(size); uniforms.uDpr.value = dpr
    uniforms.uRect.value.set(rectCss.x * dpr, rectCss.y * dpr, rectCss.w * dpr, rectCss.h * dpr)
    uniforms.uRegion.value.set(region.x, region.y, region.w, region.h)
    const vx = rectCss.x + rectCss.w * opts.velvet
    uniforms.uVelvet.value = (opts.velvet <= 0 ? -100 : opts.velvet >= 1 ? 1e5 : vx) * dpr
    tab.style.left = `${Math.max(34, opts.velvet <= 0 ? 0 : vx - 4)}px`
    tab.style.top = `${rectCss.y + rectCss.h * 0.5}px`
    const L = currentLoupe()
    uniforms.uLoupeOn.value = L ? 1 : 0
    if (L) { uniforms.uLoupe.value.set(L[0] * dpr, L[1] * dpr, 0.22 * Math.min(rectCss.w + 200, window.innerHeight) * dpr * 0.75); uniforms.uPower.value = L[2] }
    uniforms.uTime.value = time
  }
  function currentLoupe(): [number, number, number] | null {
    if (opts.loupe) {
      // plate uv → css px within the current layout
      const tx = opts.loupe.u * PLATE_W, ty = opts.loupe.v * PLATE_H
      const x = rectCss.x + ((tx - region.x) / region.w) * rectCss.w, y = rectCss.y + ((ty - region.y) / region.h) * rectCss.h
      return [x, y, opts.loupe.power]
    }
    if (loupeOn && loupePx) return [loupePx[0], loupePx[1], power]
    return null
  }
  function bindPlate(id: PlateId): void {
    const gpu = bench.gpu(id)
    if (gpu) { uniforms.uE.value = gpu.E; uniforms.uChem.value = gpu.chem; uniforms.uNoiseSeed.value = gpu.seed; uniforms.uHasE.value = 1 }
    else { uniforms.uE.value = blank; uniforms.uHasE.value = 0 }
  }
  function caption(): void {
    if (showing === 'pane' || !showing) { capTitle.textContent = showing === 'pane' ? 'The window of your lamp' : ''; capWhen.textContent = ''; capGrade.textContent = ''; return }
    const m = ctx.lib.meta(showing)
    capTitle.textContent = `${m.no === 'TRIAL' ? 'Trial' : 'No. ' + m.no} · ${m.title}`
    capWhen.textContent = `${m.date}, ${m.time}`
    const c = bench.chem(showing)
    capGrade.textContent = c.fixed ? bench.wedge(showing).grade : 'not fixed'
    reg.querySelector('p')!.textContent = m.register
  }
  function syncBar(): void {
    bar.querySelectorAll<HTMLButtonElement>('button[data-a]').forEach((b) => {
      const a = b.dataset.a
      b.setAttribute('aria-pressed', String((a === opts.eye && !opts.wiggle) || (a === 'wiggle' && opts.wiggle) || (a === 'loupe' && (loupeOn || !!opts.loupe))))
      if (a === 'cite' || a === 'register' || a === 'L' || a === 'R' || a === 'both' || a === 'wiggle') b.hidden = showing === 'pane'
    })
    tab.hidden = showing === 'pane'
  }

  bar.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return
    const a = b.dataset.a
    ctx.bus.emit({ t: 'sfx', name: 'paper', gain: 0.4 })
    if (a === 'back') { table.close(); table.onLeave?.() }
    else if (a === 'L' || a === 'R' || a === 'both') table.set({ eye: a, wiggle: false })
    else if (a === 'wiggle') table.set({ wiggle: !opts.wiggle })
    else if (a === 'loupe') { loupeOn = !loupeOn; opts.loupe = null; if (loupeOn && !loupePx) loupePx = [rectCss.x + rectCss.w * 0.5, rectCss.y + rectCss.h * 0.4] }
    else if (a === 'register') { reg.hidden = !reg.hidden; if (showing && showing !== 'pane') table.onRegister?.(showing) }
    else if (a === 'cite' && showing && showing !== 'pane') table.onCite?.(showing)
    syncBar()
  })
  // velvet tab drag (pointer events on the tab)
  let tabDrag: { x0: number; v0: number } | null = null
  tab.addEventListener('pointerdown', (e) => { tabDrag = { x0: e.clientX, v0: opts.velvet }; tab.setPointerCapture(e.pointerId); e.preventDefault() })
  tab.addEventListener('pointermove', (e) => { if (!tabDrag) return; opts.velvet = Math.max(0, Math.min(1, tabDrag.v0 + (e.clientX - tabDrag.x0) / Math.max(1, rectCss.w))) })
  tab.addEventListener('pointerup', () => { tabDrag = null })
  tab.addEventListener('click', () => { if (Math.abs(opts.velvet - 0) < 0.02 || opts.velvet > 0.98) { /* keyboard: V */ } })

  const table: PlatesLightTable = {
    get isOpen() { return isOpen }, get showing() { return showing }, get opts() { return opts as PlatesLightTable['opts'] }, get paneSeconds() { return paneSeconds },
    onClose: null, onCite: null, onRegister: null, onPaneRead: null, onLeave: null,
    open(id) {
      showing = id; isOpen = true; ui.hidden = false; reg.hidden = true
      paneSeconds = 0
      opts.velvet = 0; opts.eye = 'both'; opts.wiggle = false; opts.loupe = null
      if (id === 'pane') { uniforms.uPane.value = 1; loupeOn = true; power = 2; loupePx = null }
      else { uniforms.uPane.value = 0; bindPlate(id); if (id === 'p13') opts.velvet = 0.5 }
      layout(); caption(); syncBar()
      ctx.bus.emit({ t: 'inspect', id })
    },
    close() { if (!isOpen) return; isOpen = false; ui.hidden = true; showing = null; loupeOn = false; ctx.bus.emit({ t: 'inspect', id: null }); table.onClose?.() },
    set(o) {
      if (o.velvet !== undefined) opts.velvet = Math.max(0, Math.min(1, o.velvet))
      if (o.eye) opts.eye = o.eye
      if (o.wiggle !== undefined) opts.wiggle = o.wiggle
      if (o.loupe !== undefined) opts.loupe = o.loupe
      if (o.zoom !== undefined) opts.zoom = o.zoom
      if (o.pan) opts.pan = o.pan
      layout(); syncBar()
    },
    update(dt) {
      if (!isOpen) return
      time += dt
      if (opts.wiggle) {
        wiggleT += dt
        const period = ctx.settings.reducedMotion || ctx.test ? 1.0 : 0.167
        if (wiggleT >= period) { wiggleT = 0; wigglePhase ^= 1 }
      }
      if (showing && showing !== 'pane') { const g = bench.gpu(showing); if (g && uniforms.uHasE.value < 0.5) bindPlate(showing) }
      if (showing === 'pane') {
        paneSeconds += dt
        if (!paneReadSent && (paneSeconds >= 1 || table.loupeOverEtch())) { paneReadSent = true; table.onPaneRead?.() }
      }
      layout()
    },
    render() {
      if (!isOpen) return
      applyUniforms()
      renderer.setRenderTarget(null)
      renderer.render(scene, cam)
    },
    pointer(p: BenchPointer) {
      if (!isOpen) return false
      if (p.kind === 'move' || p.kind === 'down') {
        if (loupeOn || showing === 'pane') loupePx = p.kind === 'move' && p.touches > 0 ? [p.x, p.y - 80] : [p.x, p.y]
        return true
      }
      if (p.kind === 'dbl' && showing !== 'pane') { table.set({ wiggle: !opts.wiggle }); return true }
      return true
    },
    twoColourCheck() {
      const gl = renderer.getContext()
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
      const px = new Uint8Array(w * h * 4)
      table.render()
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
      const a = hex3(PALETTES.canary.ink).map((v) => v * 255), b = hex3(PALETTES.canary.light).map((v) => v * 255)
      let ok = 0
      for (let i = 0; i < px.length; i += 4) {
        const da = Math.hypot(px[i] - a[0], px[i + 1] - a[1], px[i + 2] - a[2]), db = Math.hypot(px[i] - b[0], px[i + 1] - b[1], px[i + 2] - b[2])
        if (Math.min(da, db) < 8) ok++
      }
      return ok / (w * h)
    },
    layout,
    loupeOverEtch() {
      const L = currentLoupe()
      if (!L || showing !== 'pane') return false
      const ex = rectCss.x + (PANE_ETCH_RECT.x / pane.w) * rectCss.w, ey = rectCss.y + (PANE_ETCH_RECT.y / pane.h) * rectCss.h
      const ew = (PANE_ETCH_RECT.w / pane.w) * rectCss.w, eh = (PANE_ETCH_RECT.h / pane.h) * rectCss.h
      return L[0] > ex && L[0] < ex + ew && L[1] > ey - 40 && L[1] < ey + eh + 40
    },
  }
  window.addEventListener('wheel', (e) => { if (!isOpen || !loupeOn) return; power = (e.deltaY < 0 ? (power === 2 ? 4 : 8) : power === 8 ? 4 : 2) as 2 | 4 | 8 }, { passive: true })
  return table
}
