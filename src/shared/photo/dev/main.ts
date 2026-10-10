// Dev harness for @shared/photo (architecture §4.10 acceptance). Every shot is deterministic (fixed seed,
// scene posed by time), so the shoot harness can compare numbers instead of pixels.
//   fountain-fast   particle fountain at 1/1000 s: frozen droplets
//   fountain-slow   the same at 1/2 s: silk
//   bokeh-heart     string lights through a heart-shaped aperture mask (scene spheres, then analytic emitters)
//   windmill        a 12 ms focal-plane shutter on a spinning windmill: bent blades
//   tilt            a ground plane with and without front tilt
//   incremental     begin() + 30 addSample() against capture() with the same samples

import * as THREE from 'three'
import { installGameApi, markReady, flags } from '@shared/core'
import { type CameraPose, type CameraSpec, type CaptureResult, type DeepPartial, FinderPreview, PhotoRenderer, develop, selftest, resolveSpec } from '@shared/photo'
import { heartMask, makeYard, type Yard } from './scene.ts'

const out = document.getElementById('out') as HTMLPreElement
const gallery = document.getElementById('gallery') as HTMLDivElement
const bar = document.getElementById('bar') as HTMLDivElement
const f = flags()

const canvas = document.createElement('canvas')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
renderer.setSize(64, 64, false)
const photo = new PhotoRenderer(renderer)

let day: Yard | null = null
let dusk: Yard | null = null
let marked: Yard | null = null
const yard = (m: 'day' | 'dusk'): Yard => (m === 'day' ? (day ??= makeYard({ mood: 'day' })) : (dusk ??= makeYard({ mood: 'dusk' })))

function lookAt(from: [number, number, number], to: [number, number, number]): CameraPose {
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...from), new THREE.Vector3(...to), new THREE.Vector3(0, 1, 0))
  return { position: new THREE.Vector3(...from), quaternion: new THREE.Quaternion().setFromRotationMatrix(m) }
}

function show(name: string, r: CaptureResult, caption: string): void {
  let fig = gallery.querySelector<HTMLElement>(`figure[data-name="${name}"]`)
  if (!fig) {
    fig = document.createElement('figure')
    fig.dataset.name = name
    fig.innerHTML = '<canvas></canvas><figcaption></figcaption>'
    gallery.appendChild(fig)
  }
  const c = fig.querySelector('canvas') as HTMLCanvasElement
  c.width = r.width
  c.height = r.height
  const rgba = develop(r.latent!, r.width, r.height, { mode: 'positive' })
  const img = new ImageData(new Uint8ClampedArray(rgba), r.width, r.height)
  c.getContext('2d')?.putImageData(img, 0, 0)
  fig.querySelector('figcaption')!.textContent = caption
}

const BASE: DeepPartial<CameraSpec> = { format: { width: 36, height: 24 }, shutterType: 'leaf', leafRamp: 0.0015, film: { granularity: 1, grainSize: 9, color: true } }
const longEdge = f.test ? 448 : 768

async function shot(name: string, y: Yard, spec: DeepPartial<CameraSpec>, pose: CameraPose, o: Record<string, unknown> = {}, caption = ''): Promise<CaptureResult> {
  const r = await photo.capture(y, resolveSpec({ ...BASE, ...spec } as DeepPartial<CameraSpec>), {
    pose, samples: f.test ? 6 : 32, longEdge, sliceMs: f.test ? Infinity : 10, seed: 3, ...o,
  } as never)
  const s = r.meta.stats
  show(name, r, `${name}: ${caption} ${r.meta.timing.totalMs.toFixed(0)} ms, ${r.meta.sampling.renders} renders, mean X ${s?.meanX.toFixed(2)}`)
  return r
}

const cam = lookAt([0.4, 1.25, 0], [0.4, 0.95, -4.2])

const demos: Record<string, () => Promise<Record<string, unknown>>> = {
  async 'fountain-fast'() {
    const r = await shot('fountain-fast', yard('day'), { focalLength: 85, fNumber: 5.6, maxAperture: 1.8, focusDistance: 4.2, shutter: 1 / 1000, iso: 100 }, cam, {}, '1/1000 s')
    return { meanX: r.meta.stats?.meanX ?? 0, ms: r.meta.timing.totalMs }
  },
  async 'fountain-slow'() {
    const r = await shot('fountain-slow', yard('day'), { focalLength: 85, fNumber: 22, maxAperture: 1.8, focusDistance: 4.2, shutter: 1 / 2, iso: 3 }, cam, {}, '1/2 s, silk')
    return { meanX: r.meta.stats?.meanX ?? 0, ms: r.meta.timing.totalMs }
  },
  async 'bokeh-heart'() {
    const y = yard('dusk')
    const c2 = lookAt([0, 1.4, 0], [0, 2.2, -7.5])
    const spec: DeepPartial<CameraSpec> = { focalLength: 85, fNumber: 1.8, maxAperture: 1.8, focusDistance: 1.3, shutter: 1 / 250, iso: 100, aperture: { blades: 0, curvature: 1, rotation: 0, mask: heartMask(64) }, lens: { glow: 0.01, ghosts: 0, veilingGlare: 0.004 } }
    const a = await shot('bokeh-heart', y, spec, c2, {}, 'scene spheres through a heart stop,')
    y.lights.forEach((m) => (m.visible = false))
    const b = await shot('bokeh-heart-emitters', y, spec, c2, { emitters: (_t: number, o: unknown[]) => { y.lightEmitters.forEach((e, i) => (o[i] = e)); return y.lightEmitters.length } }, 'analytic emitters:')
    y.lights.forEach((m) => (m.visible = true))
    return { meanSpheres: a.meta.stats?.meanX ?? 0, meanEmitters: b.meta.stats?.meanX ?? 0 }
  },
  async windmill() {
    const y = yard('day')
    const c2 = lookAt([-1.1, 1.6, 0], [-1.1, 1.6, -3.4])
    const r = await shot('windmill', y, { focalLength: 85, fNumber: 8, maxAperture: 1.8, focusDistance: 3.4, shutter: 1 / 1000, iso: 100, shutterType: 'focal-plane', curtainTravel: 0.012, curtainDirection: 'down' }, c2, { maxRenders: f.test ? 24 : 160 }, '1/1000 s, 12 ms curtain')
    return { meanX: r.meta.stats?.meanX ?? 0, renders: r.meta.sampling.renders }
  },
  async tilt() {
    const h = 1.5
    const theta = (30 * Math.PI) / 180
    const fl = 100
    const s = h / Math.sin(theta)
    const alpha = Math.atan(((fl / 1000) * Math.cos(theta)) / (h + (fl / 1000) * Math.sin(theta)))
    const y = (marked ??= makeYard({ mood: 'day', markers: true }))
    const c2 = lookAt([0, h, 0], [0, 0, -h / Math.tan(theta)])
    const spec: DeepPartial<CameraSpec> = { focalLength: fl, fNumber: 1.4, maxAperture: 1.4, focusDistance: s, shutter: 1 / 1000, iso: 100 }
    const a = await shot('tilt-0', y, spec, c2, { tilt: { deg: 0 } }, 'no tilt,')
    const b = await shot('tilt-on', y, spec, c2, { tilt: { deg: (alpha * 180) / Math.PI } }, `tilt ${((alpha * 180) / Math.PI).toFixed(2)}°,`)
    return { alphaDeg: (alpha * 180) / Math.PI, meanFlat: a.meta.stats?.meanX ?? 0, meanTilt: b.meta.stats?.meanX ?? 0 }
  },
  async incremental() {
    const y = yard('day')
    const spec = resolveSpec({ ...BASE, focalLength: 85, fNumber: 4, maxAperture: 1.8, focusDistance: 4.2, shutter: 1 / 15, iso: 12, shutterType: 'leaf', leafRamp: 0 } as DeepPartial<CameraSpec>)
    const N = 30
    const cap = await photo.capture(y, spec, { pose: cam, samples: N, longEdge: 384, sliceMs: Infinity, order: 'chronological', seed: 4, grain: false })
    const ex = photo.begin(y, spec, { pose: cam, longEdge: 384, seed: 4, grain: false, expectedSamples: N })
    for (let k = 0; k < N; k++) ex.addSample({ time: (k / N) * spec.shutter, tRel: (k / N) * spec.shutter, weightS: spec.shutter / N })
    const inc = await ex.finish()
    show('incremental-capture', cap, `capture(30)  mean X ${cap.meta.stats?.meanX.toFixed(3)}`)
    show('incremental-begin', inc, `begin + 30 addSample  mean X ${inc.meta.stats?.meanX.toFixed(3)}`)
    let d = 0
    let tot = 0
    for (let i = 0; i < cap.width * cap.height; i++) {
      d += Math.abs(cap.latent![i * 4 + 1] - inc.latent![i * 4 + 1])
      tot += cap.latent![i * 4 + 1]
    }
    return { meanCapture: cap.meta.stats?.meanX ?? 0, meanIncremental: inc.meta.stats?.meanX ?? 0, relDiff: d / tot }
  },
}

let finder: FinderPreview | null = null
const finderRT = new THREE.WebGLRenderTarget(384, 256, { depthBuffer: false })

/** The live finder: scene render, circle-of-confusion gather and tonemap, plus the meter reading. */
function finderDemo(): Record<string, unknown> {
  const y = yard('day')
  const spec = resolveSpec({ ...BASE, focalLength: 85, fNumber: 2, maxAperture: 1.8, focusDistance: 4.2, shutter: 1 / 2000, iso: 100 } as DeepPartial<CameraSpec>)
  const camera = new THREE.PerspectiveCamera((2 * Math.atan(12 / 85) * 180) / Math.PI, 1.5, 0.05, 500)
  camera.position.copy(cam.position)
  camera.quaternion.copy(cam.quaternion)
  camera.updateMatrixWorld(true)
  y.setTime?.(0.37, { index: 0, total: 1, time: 0.37, tRel: 0.37, lensMm: [0, 0], rand: [0.5, 0.5] })
  finder ??= new FinderPreview(renderer, { longEdge: 384, taps: 12, maxCocPx: 20 })
  finder.render(y.scene, camera, spec, { target: finderRT })
  const px = new Uint8Array(384 * 256 * 4)
  renderer.readRenderTargetPixels(finderRT, 0, 0, 384, 256, px)
  // flip to top-first for the 2d canvas
  const img = new ImageData(384, 256)
  for (let r = 0; r < 256; r++) img.data.set(px.subarray((255 - r) * 384 * 4, (256 - r) * 384 * 4), r * 384 * 4)
  let fig = gallery.querySelector<HTMLElement>('figure[data-name="finder"]')
  if (!fig) {
    fig = document.createElement('figure')
    fig.dataset.name = 'finder'
    fig.innerHTML = '<canvas width="384" height="256"></canvas><figcaption></figcaption>'
    gallery.appendChild(fig)
  }
  fig.querySelector('canvas')!.getContext('2d')?.putImageData(img, 0, 0)
  const ev = finder.meterEV100()
  fig.querySelector('figcaption')!.textContent = `finder: 85 mm f/2, focus 4.2 m, shown at the spec exposure; meter ${ev.toFixed(2)} EV100`
  const row = 128
  return { meterEV100: ev, row: Array.from({ length: 24 }, (_, i) => px[(row * 384 + 150 + i * 4) * 4]) }
}

const api = {
  finder: finderDemo,
  /** Shoot one named demo ('fountain-fast', 'fountain-slow', 'bokeh-heart', 'windmill', 'tilt', 'incremental') or 'all'. */
  async demo(name: string): Promise<Record<string, unknown>> {
    if (name === 'all') {
      const r: Record<string, unknown> = {}
      for (const k of Object.keys(demos)) r[k] = await demos[k]()
      return r
    }
    if (!demos[name]) throw new Error(`no demo ${name}`)
    return { [name]: await demos[name]() }
  },
  /** Runs the self-test (all groups, or the named ones) and prints it. */
  async selftest(groups?: string[]): Promise<{ total: number; failed: number; checks: ReturnType<typeof Object>[] }> {
    const checks = await selftest({ renderer, only: groups, log: (l) => (out.textContent += l + '\n') })
    const bad = checks.filter((c) => !c.pass)
    out.textContent += `selftest: ${checks.length - bad.length}/${checks.length} pass\n` + bad.map((c) => `FAIL ${c.group} / ${c.name}: ${c.value} (${c.expect})`).join('\n')
    out.className = bad.length ? 'fail' : ''
    return { total: checks.length, failed: bad.length, checks: checks as never }
  },
  caps: () => photo.caps,
  state: (): unknown => ({ caps: photo.caps }),
}

for (const name of [...Object.keys(demos), 'all']) {
  const b = document.createElement('button')
  b.textContent = name
  b.onclick = () => void api.demo(name).then((r) => (out.textContent = JSON.stringify(r, null, 1)))
  bar.appendChild(b)
}
const st = document.createElement('button')
st.textContent = 'selftest'
st.onclick = () => void api.selftest()
bar.appendChild(st)

installGameApi('shared:photo', 'photo@1', api)
requestAnimationFrame(() => markReady())
