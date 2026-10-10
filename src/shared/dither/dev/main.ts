// Dev page for @shared/dither: the spike's cabin through OneBitPass, a palette sweep,
// a CPU ditherImage gradient, and selftest().
import * as THREE from 'three'
import { installGameApi, markReady } from '@shared/core/testapi'
import {
  PALETTES,
  bayer8,
  bayerMatrix,
  ditherImage,
  generateBlueNoise,
  getThresholdMap,
  hexToRgb,
  type PaletteName,
  type PatternName,
} from '@shared/dither'
import { AnchorTracker, OneBitPass } from '@shared/dither/three'
import { buildCabin } from './cabin'
import { LookRig } from './look'
import { makePhotoCanvas } from './photo'

const params = new URLSearchParams(location.search)
const testMode = params.get('test') === '1'
const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(1)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const startPalette = (params.get('palette') as PaletteName | null) ?? 'bone'
const pass = new OneBitPass(renderer, {
  palette: startPalette,
  pixelScale: 'auto',
  targetLongSide: 640,
  ditherMode: 'sphere',
  pattern: 'bluenoise',
  outline: { enabled: true, color: 'auto' },
  tone: { exposure: 1.6, whitePoint: 6, gamma: 1.4, contrast: 1.5 },
})

function canvasTex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
function invert(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const g = c.getContext('2d')!
  g.filter = 'invert(1)'
  g.drawImage(src, 0, 0)
  return c
}
const photo = makePhotoCanvas()
const cabin = buildCabin(canvasTex(photo), canvasTex(invert(photo)), pass.surface)
if (testMode) cabin.setShadows(true, 256)
cabin.printMaterial.develop = 0.9
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 30)
const rig = new LookRig(camera, canvas)
const tracker = new AnchorTracker()

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, true)
  pass.syncSize()
  camera.aspect = pass.aspect
  rig.aspect = pass.aspect
  rig.apply()
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

let frames = 0
function draw(): void {
  rig.update(0)
  tracker.update(pass, camera)
  pass.render(cabin.scene, camera)
  frames++
}

// ---- CPU gradient
function drawCpu(palette: PaletteName, pattern: PatternName): void {
  const w = 256
  const h = 96
  const lum = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lum[y * w + x] = x / (w - 1)
  const img = ditherImage(lum, w, h, { palette, pattern, cell: 1 })
  ;(document.getElementById('cpu') as HTMLCanvasElement).getContext('2d')!.putImageData(img, 0, 0)
}

// ---- UI
let palName: PaletteName = startPalette
let patName: PatternName = 'bluenoise'
const hud = document.getElementById('hud')!
function setPressed(sel: string, on: (el: HTMLElement) => boolean): void {
  document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.setAttribute('aria-pressed', String(on(el))))
}
function setPalette(name: PaletteName, frames = 0): void {
  palName = name
  pass.setPalette(name, frames)
  setPressed('[data-pal]', (el) => el.dataset.pal === name)
  drawCpu(palName, patName)
}
function setPattern(p: PatternName): void {
  patName = p
  pass.setPattern(p)
  setPressed('[data-pat]', (el) => el.dataset.pat === p)
  drawCpu(palName, patName)
}
document.querySelectorAll<HTMLElement>('[data-pal]').forEach((el) => el.addEventListener('click', () => setPalette(el.dataset.pal as PaletteName, 12)))
document.querySelectorAll<HTMLElement>('[data-pat]').forEach((el) => el.addEventListener('click', () => setPattern(el.dataset.pat as PatternName)))
let outlineOn = true
document.getElementById('outline')!.addEventListener('click', (e) => {
  outlineOn = !outlineOn
  pass.setOutline({ enabled: outlineOn })
  ;(e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(outlineOn))
})
/** Palette sweep: 0.8 s Bayer threshold dissolve (48 frames at 60 fps). */
function sweep(frames = 48): void {
  const order: PaletteName[] = ['bone', 'ruby', 'latentTerminal']
  const next = order[(order.indexOf(palName) + 1) % order.length]
  setPalette(next, frames)
}
document.getElementById('sweep')!.addEventListener('click', () => sweep())

// ---- loop
let acc = 0
function frame(): void {
  if (!testMode) {
    draw()
    if (++acc % 20 === 0) hud.textContent = `${pass.width}x${pass.height} @${pass.scale}x ${pass.ditherMode}/${pass.getPattern()} ${palName}`
  }
  requestAnimationFrame(frame)
}
setPalette(startPalette, 0)
draw()
markReady()
requestAnimationFrame(frame)

// ---- selftest
interface Check { name: string; ok: boolean; info?: string }

function isPermutation(a: Float32Array): boolean {
  const N = a.length
  const seen = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const r = Math.round(a[i] * N - 0.5)
    if (r < 0 || r >= N || seen[r] || Math.abs(a[i] * N - 0.5 - r) > 1e-3) return false
    seen[r] = 1
  }
  return true
}

/** Fraction of pixels within `tol` per channel of the palette's ink or light. */
function twoColourFraction(rgba: Uint8Array, name: PaletteName, tol = 3): number {
  const ink = hexToRgb(PALETTES[name].ink).map((v) => v * 255)
  const light = hexToRgb(PALETTES[name].light).map((v) => v * 255)
  const near = (i: number, c: number[]): boolean =>
    Math.abs(rgba[i] - c[0]) <= tol && Math.abs(rgba[i + 1] - c[1]) <= tol && Math.abs(rgba[i + 2] - c[2]) <= tol
  let ok = 0
  const n = rgba.length / 4
  for (let p = 0; p < n; p++) if (near(p * 4, ink) || near(p * 4, light)) ok++
  return ok / n
}

function readbackTwoColour(name: PaletteName, outline: boolean): number {
  pass.setPalette(name, 0)
  pass.setOutline({ enabled: outline })
  renderer.getDrawingBufferSize(new THREE.Vector2())
  const w = Math.max(1, renderer.domElement.width)
  const h = Math.max(1, renderer.domElement.height)
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false })
  rig.update(0)
  tracker.update(pass, camera)
  pass.render(cabin.scene, camera, rt)
  const buf = new Uint8Array(w * h * 4)
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf)
  rt.dispose()
  pass.setPalette(palName, 0)
  pass.setOutline({ enabled: outlineOn })
  return twoColourFraction(buf, name)
}

function selftest(): { pass: boolean; checks: Check[] } {
  const checks: Check[] = []
  const add = (name: string, ok: boolean, info?: string): void => { checks.push({ name, ok, info }) }

  let t = performance.now()
  const bn64 = generateBlueNoise({ size: 64, seed: 3 })
  const t64 = performance.now() - t
  add('blue noise 64 is a permutation', isPermutation(bn64), `${t64.toFixed(0)} ms`)
  t = performance.now()
  const bn128 = generateBlueNoise({ size: 128, seed: 3 })
  const t128 = performance.now() - t
  add('blue noise 128 is a permutation', isPermutation(bn128), `${t128.toFixed(0)} ms`)
  add('blue noise deterministic', generateBlueNoise({ size: 64, seed: 3 })[17] === bn64[17])
  // Blue noise spectrum sanity: low-frequency energy far below white noise.
  const lowFreq = (a: Float32Array, size: number): number => {
    let sum = 0
    let tot = 0
    const mean = 0.5
    for (let ky = 0; ky <= 2; ky++) for (let kx = 0; kx <= 2; kx++) {
      if (!kx && !ky) continue
      let re = 0
      let im = 0
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const ph = (2 * Math.PI * (kx * x + ky * y)) / size
        const v = a[y * size + x] - mean
        re += v * Math.cos(ph)
        im -= v * Math.sin(ph)
      }
      sum += re * re + im * im
    }
    for (let i = 0; i < a.length; i++) tot += (a[i] - mean) * (a[i] - mean)
    return sum / (tot * size * size)
  }
  const white = new Float32Array(64 * 64)
  for (let i = 0; i < white.length; i++) white[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1 / 2 + 0.5
  add('blue noise low-frequency energy below white', lowFreq(bn64, 64) < 0.25 * lowFreq(white, 64), `${lowFreq(bn64, 64).toExponential(2)} vs ${lowFreq(white, 64).toExponential(2)}`)

  for (const n of [2, 4, 8, 16] as const) add(`bayer ${n} is rank-complete`, isPermutation(bayerMatrix(n)))
  const m8 = bayerMatrix(8)
  let bayerOk = true
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (Math.abs(m8[y * 8 + x] - bayer8(x, y)) > 1e-6) bayerOk = false
  add('bayer8() equals bayerMatrix(8)', bayerOk)
  for (const p of ['bayer', 'bluenoise', 'cluster', 'bayer-ign'] as const) {
    const m = getThresholdMap(p, 64, 1, false)
    add(`threshold map ${p}`, m.length === 4096 && m.some((v) => v > 200) && m.some((v) => v < 50))
  }

  for (const name of ['bone', 'ruby', 'latentTerminal'] as const) {
    const f = readbackTwoColour(name, true)
    add(`readback two-colour ${name} (outlines)`, f > 0.9999, `${(f * 100).toFixed(3)}%`)
  }
  const f0 = readbackTwoColour('bone', false)
  add('readback two-colour bone (no outlines)', f0 > 0.9999, `${(f0 * 100).toFixed(3)}%`)

  // CPU dither: only ink/light, and mean coverage tracks the input.
  const w = 128
  const h = 64
  const lum = new Float32Array(w * h).fill(0.3)
  const img = ditherImage(lum, w, h, { palette: 'mono', pattern: 'bluenoise' })
  let on = 0
  let other = 0
  for (let i = 0; i < w * h; i++) {
    const v = img.data[i * 4]
    if (v === 255) on++
    else if (v !== 0) other++
  }
  add('ditherImage two-colour', other === 0)
  add('ditherImage coverage ~ tone', Math.abs(on / (w * h) - 0.3) < 0.03, `${(on / (w * h)).toFixed(3)}`)

  return { pass: checks.every((c) => c.ok), checks }
}

installGameApi('shared:dither', 'dither@1', {
  state: () => ({ palette: palName, pattern: patName, outline: outlineOn, size: [pass.width, pass.height], scale: pass.scale, frames }),
  selftest,
  /** Deterministic: render n frames synchronously. */
  step(n = 1): void { for (let i = 0; i < n; i++) draw() },
  setPalette,
  setPattern,
  sweep,
  bench(n = 30): { meanMs: number } {
    const t0 = performance.now()
    for (let i = 0; i < n; i++) draw()
    renderer.getContext().finish()
    return { meanMs: (performance.now() - t0) / n }
  },
})
