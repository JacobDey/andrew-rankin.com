// Demo page for the photo-render spike: live viewfinder of a calibrated yard, every camera/lens/film
// parameter on a slider, a Take Photo button that renders progressively and shows the developed print.

import * as THREE from 'three'
import './demo/style.css'
import {
  PhotoRenderer,
  computeOptics,
  resolveSpec,
  defaultSpec,
  FORMATS,
  formatShutter,
  formatFNumber,
  formatDistance,
  luminanceToEV100,
  xPerNit,
  develop,
  NEGATIVE_BW,
  NEGATIVE_COLOR,
  type CameraSpec,
  type CaptureResult,
  type CameraPose,
  type DeepPartial,
  type ApertureMask,
  type DevelopMode,
} from './core/index.ts'
import { Yard } from './demo/yard.ts'
import * as ui from './demo/ui.ts'
import { runAll, testCalibration, testCoC, testFOV, testMotion, testSkew, testFlash } from './demo/tests.ts'
import { bokehField } from './demo/diag.ts'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const coarse = matchMedia('(pointer: coarse)').matches
const isPhone = coarse && Math.min(screen.width, screen.height) < 820

// ------------------------------------------------------------------ value lists

const SHUTTERS: number[] = []
for (let n = 15; n >= -39; n--) SHUTTERS.push(Math.pow(2, n / 3))
const FSTOPS = [0.95, 1, 1.1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22, 25, 29, 32, 36, 40, 45, 51, 57, 64, 90, 128, 180, 256]
const ISOS = [6, 12, 25, 32, 40, 50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 12800, 25600]
const SAMPLES = [1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512]
const RESOLUTIONS = [256, 384, 512, 768, 1024, 1280, 1536, 2048, 3072]
const BLADES = [0, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18]

// ------------------------------------------------------------------ aperture masks (Waterhouse stops)

function makeMask(kind: string): ApertureMask | null {
  if (kind === 'none') return null
  const n = 64
  const data = new Float32Array(n * n)
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * 2 - 1
      const y = 1 - ((j + 0.5) / n) * 2
      let open = false
      if (kind === 'heart') {
        const X = x * 1.15
        const Y = y * 1.15 + 0.25
        open = Math.pow(X * X + Y * Y - 0.5, 3) - X * X * Y * Y * Y * 0.9 < 0
      } else if (kind === 'star') {
        const a = Math.atan2(y, x)
        const r = Math.hypot(x, y)
        const k = Math.cos(2.5 * a + Math.PI / 2)
        open = r < 0.45 + 0.5 * Math.pow(Math.abs(k), 3) * (k > 0 ? 1 : 0.0) + 0.05
      } else if (kind === 'donut') {
        const r = Math.hypot(x, y)
        open = r < 0.98 && r > 0.55 && !(Math.abs(x) < 0.03 || Math.abs(y) < 0.03)
      } else if (kind === 'slot') {
        open = Math.abs(x) < 0.95 && Math.abs(y) < 0.18
      }
      data[j * n + i] = open ? 1 : 0
    }
  return { size: n, data }
}

// ------------------------------------------------------------------ lens presets

const LENS_PRESETS: Record<string, { label: string; spec: DeepPartial<CameraSpec> }> = {
  modern: {
    label: 'Modern multicoated prime',
    spec: { lens: { transmittance: 0.92, vignetting: 0.35, naturalVignetting: 1, distortionK1: -0.01, distortionK2: 0, lateralCA: 0.0008, longitudinalCA: 0.15, fieldCurvature: 0, astigmatism: 0, veilingGlare: 0.004, ghosts: 0.15, glow: 0.01 }, aperture: { blades: 9, curvature: 0.85, rotation: 0 } },
  },
  triplet: {
    label: 'Uncoated 1893-type triplet',
    spec: { lens: { transmittance: 0.8, vignetting: 0.6, naturalVignetting: 1, distortionK1: 0.015, distortionK2: 0, lateralCA: 0.003, longitudinalCA: 0.6, fieldCurvature: 0.35, astigmatism: 0.3, veilingGlare: 0.035, ghosts: 1, glow: 0.08 }, aperture: { blades: 6, curvature: 0, rotation: 15 } },
  },
  petzval: {
    label: 'Petzval portrait (swirl)',
    spec: { lens: { transmittance: 0.85, vignetting: 0.9, naturalVignetting: 1, distortionK1: 0, distortionK2: 0, lateralCA: 0.002, longitudinalCA: 0.4, fieldCurvature: 1.6, astigmatism: 0.85, veilingGlare: 0.02, ghosts: 0.6, glow: 0.12 }, aperture: { blades: 0, curvature: 1, rotation: 0 } },
  },
  zoom: {
    label: 'Cheap wide zoom',
    spec: { lens: { transmittance: 0.88, vignetting: 0.7, naturalVignetting: 0.75, distortionK1: -0.12, distortionK2: 0.02, lateralCA: 0.006, longitudinalCA: 0.2, fieldCurvature: 0.4, astigmatism: 0.2, veilingGlare: 0.012, ghosts: 0.5, glow: 0.03 }, aperture: { blades: 7, curvature: 0.3, rotation: 0 } },
  },
  toy: {
    label: 'Plastic toy camera',
    spec: { lens: { transmittance: 0.85, vignetting: 1.3, naturalVignetting: 1, distortionK1: 0.06, distortionK2: 0, lateralCA: 0.008, longitudinalCA: 1.2, fieldCurvature: 2.5, astigmatism: 0.5, veilingGlare: 0.05, ghosts: 0.8, glow: 0.2 }, aperture: { blades: 0, curvature: 1, rotation: 0 } },
  },
}

// ------------------------------------------------------------------ state

const P = {
  formatKey: '35mm',
  spec: resolveSpec({ focalLength: 50, fNumber: 8, maxAperture: 1.8, focusDistance: 4.5, shutter: 1 / 250, iso: 100 }, defaultSpec()),
  apertureMask: 'none',
  pan: 0, // deg/s
  shake: 0, // deg
  samples: isPhone ? 24 : 48,
  longEdge: isPhone ? 1024 : 1536,
  sliceMs: 10,
  shadowEvery: 4,
  renderCap: 8,
  evf: true,
  smooth: true,
  freeze: false,
  flash: false,
  flashSync: 'front' as 'front' | 'rear',
  multi: false,
  printMode: 'positive' as DevelopMode,
  printStops: 0,
  mono: false,
}

// ------------------------------------------------------------------ renderer + world

const finder = $<HTMLCanvasElement>('finder')
const renderer = new THREE.WebGLRenderer({ canvas: finder, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.AgXToneMapping
renderer.outputColorSpace = THREE.SRGBColorSpace
const photo = new PhotoRenderer(renderer)
const yard = new Yard(renderer)
$('caps').textContent = `accum ${photo.caps.accum} · float RT ${photo.caps.floatRender ? 'y' : 'n'} · float blend ${photo.caps.floatBlend ? 'y' : 'n'} · float linear ${photo.caps.floatLinear ? 'y' : 'n'} · ${photo.caps.gpu.slice(0, 60)}`

const camera = new THREE.PerspectiveCamera(40, 1.5, 0.05, 3000)
let yaw = 0
let pitch = -0.06
camera.position.set(0.3, 1.5, 5.4)

function applyView(): void {
  camera.rotation.set(pitch, yaw, 0, 'YXZ')
  camera.updateMatrixWorld()
}
function lookAt(target: THREE.Vector3): void {
  const d = target.clone().sub(camera.position).normalize()
  yaw = Math.atan2(-d.x, -d.z)
  pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1))
  applyView()
}
applyView()

// ------------------------------------------------------------------ layout

const finderWrap = $<HTMLDivElement>('finder-wrap')
function layout(): void {
  const aspect = P.spec.format.width / P.spec.format.height
  const availW = $('stage').clientWidth - (window.innerWidth <= 900 ? 24 : 32)
  const maxH = window.innerHeight * (window.innerWidth <= 900 ? 0.55 : 0.62)
  let w = availW
  let h = w / aspect
  if (h > maxH) {
    h = maxH
    w = h * aspect
  }
  finderWrap.style.width = `${Math.floor(w)}px`
  renderer.setSize(Math.floor(w), Math.floor(h), true)
}
window.addEventListener('resize', layout)

// ------------------------------------------------------------------ panel

const panel = $<HTMLElement>('panel')
const ctl: Record<string, ui.Ctl<any>> = {}
const changed = () => {
  P.spec = resolveSpec({}, P.spec)
  updateHud()
}

{
  const g = ui.group(panel, 'Camera', true, 'Format and focal length set the field of view; f-number, shutter and ISO set exposure.')
  const fmtOpts = Object.entries(FORMATS).map(([k, v]) => [k, v.name ?? k] as [string, string])
  ctl.format = ui.select('Format', fmtOpts, P.formatKey, (k) => {
    P.formatKey = k
    P.spec.format = { ...FORMATS[k] }
    layout()
    changed()
  })
  ctl.focal = ui.slider('Focal length', 4, 1200, P.spec.focalLength, (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)} mm`, (v) => {
    P.spec.focalLength = v
    changed()
  }, { log: true })
  ctl.fnum = ui.steps('Aperture', FSTOPS, P.spec.fNumber, formatFNumber, (v) => {
    P.spec.fNumber = Math.max(v, P.spec.maxAperture)
    changed()
  })
  ctl.focus = ui.slider('Focus distance', 0.1, 2000, P.spec.focusDistance, (v) => (v >= 1999 ? '∞' : formatDistance(v)), (v) => {
    P.spec.focusDistance = v >= 1999 ? Infinity : v
    changed()
  }, { log: true })
  ctl.shutter = ui.steps('Shutter', SHUTTERS, P.spec.shutter, formatShutter, (v) => {
    P.spec.shutter = v
    changed()
  })
  ctl.iso = ui.steps('ISO', ISOS, P.spec.iso, (v) => String(v), (v) => {
    P.spec.iso = v
    changed()
  })
  g.append(ctl.format.el, ctl.focal.el, ctl.fnum.el, ctl.focus.el, ctl.shutter.el, ctl.iso.el)
}
{
  const g = ui.group(panel, 'Shutter mechanism', false, 'Focal-plane: a slit crosses the film, so fast things lean. Leaf: blades in the lens, no skew, more light when stopped down at fast speeds.')
  ctl.stype = ui.select('Type', [['focal-plane', 'Focal-plane (slit)'], ['leaf', 'Leaf (in-lens)']], P.spec.shutterType, (v) => {
    P.spec.shutterType = v as CameraSpec['shutterType']
    changed()
  })
  ctl.travel = ui.slider('Curtain travel', 0.5, 1000, P.spec.curtainTravel * 1000, (v) => `${v.toFixed(v < 10 ? 1 : 0)} ms`, (v) => {
    P.spec.curtainTravel = v / 1000
    changed()
  }, { log: true })
  ctl.dir = ui.select('Slit direction (on print)', [['up', 'up (vertical travel)'], ['down', 'down'], ['right', 'right (horizontal travel)'], ['left', 'left']], P.spec.curtainDirection, (v) => {
    P.spec.curtainDirection = v as CameraSpec['curtainDirection']
    changed()
  })
  ctl.ramp = ui.slider('Leaf opening ramp', 0, 6, P.spec.leafRamp * 1000, (v) => `${v.toFixed(2)} ms`, (v) => {
    P.spec.leafRamp = v / 1000
    changed()
  })
  g.append(ctl.stype.el, ctl.travel.el, ctl.dir.el, ctl.ramp.el)
}
{
  const g = ui.group(panel, 'Aperture & bokeh', false, 'Blade count/curvature shape the bokeh and the diffraction stars (even n -> n points, odd n -> 2n).')
  ctl.maxap = ui.steps('Widest aperture', FSTOPS, P.spec.maxAperture, formatFNumber, (v) => {
    P.spec.maxAperture = v
    if (P.spec.fNumber < v) {
      P.spec.fNumber = v
      ctl.fnum.set(v)
    }
    changed()
  })
  ctl.blades = ui.steps('Blades', BLADES, P.spec.aperture.blades, (v) => (v === 0 ? 'round' : String(v)), (v) => {
    P.spec.aperture.blades = v
    changed()
  })
  ctl.rot = ui.slider('Blade rotation', 0, 90, P.spec.aperture.rotation, (v) => `${v.toFixed(0)}°`, (v) => {
    P.spec.aperture.rotation = v
    changed()
  })
  ctl.curv = ui.slider('Blade curvature', 0, 1, P.spec.aperture.curvature, (v) => v.toFixed(2), (v) => {
    P.spec.aperture.curvature = v
    changed()
  })
  ctl.mask = ui.select('Waterhouse stop', [['none', 'none (iris)'], ['heart', 'heart'], ['star', 'star'], ['donut', 'donut (mirror lens)'], ['slot', 'slot']], 'none', (v) => {
    P.apertureMask = v
    P.spec.aperture.mask = makeMask(v)
    changed()
  })
  g.append(ctl.maxap.el, ctl.blades.el, ctl.rot.el, ctl.curv.el, ctl.mask.el)
}
{
  const g = ui.group(panel, 'Lens character', false, 'Aberrations and flare. Presets are starting points; every value is live.')
  const presetSel = ui.select('Preset', [['custom', '(custom)'], ...Object.entries(LENS_PRESETS).map(([k, v]) => [k, v.label] as [string, string])], 'custom', (k) => {
    const p = LENS_PRESETS[k]
    if (!p) return
    P.spec = resolveSpec(p.spec, P.spec)
    syncLensCtl()
    changed()
  })
  const L = P.spec.lens
  const lensSlider = (key: keyof typeof L, label: string, min: number, max: number, fmt: (v: number) => string) => {
    const c = ui.slider(label, min, max, L[key] as number, fmt, (v) => {
      ;(P.spec.lens as unknown as Record<string, number>)[key] = v
      changed()
    })
    ctl['lens.' + key] = c
    return c.el
  }
  ctl.diff = ui.toggle('Diffraction (Airy + stars)', L.diffraction, (v) => {
    P.spec.lens.diffraction = v
    changed()
  })
  g.append(
    presetSel.el,
    lensSlider('transmittance', 'Transmittance', 0.5, 1, (v) => `${(v * 100).toFixed(0)}%`),
    lensSlider('vignetting', 'Mechanical vignetting (cat\'s eye)', 0, 1.5, (v) => v.toFixed(2)),
    lensSlider('naturalVignetting', 'Natural vignetting (cos⁴)', 0, 1, (v) => v.toFixed(2)),
    lensSlider('distortionK1', 'Distortion k1 (− barrel, + pin)', -0.3, 0.3, (v) => v.toFixed(3)),
    lensSlider('distortionK2', 'Distortion k2', -0.15, 0.15, (v) => v.toFixed(3)),
    lensSlider('lateralCA', 'Lateral colour', -0.015, 0.015, (v) => `${(v * 100).toFixed(2)}%`),
    lensSlider('longitudinalCA', 'Longitudinal colour', -3, 3, (v) => `${v.toFixed(2)} D`),
    lensSlider('fieldCurvature', 'Field curvature', -4, 4, (v) => `${v.toFixed(2)} D`),
    lensSlider('astigmatism', 'Astigmatism (swirl)', 0, 0.95, (v) => v.toFixed(2)),
    lensSlider('veilingGlare', 'Veiling glare', 0, 0.08, (v) => `${(v * 100).toFixed(1)}%`),
    lensSlider('ghosts', 'Ghost reflections', 0, 2, (v) => v.toFixed(2)),
    lensSlider('glow', 'Glow (spherical aberration)', 0, 0.4, (v) => v.toFixed(2)),
    lensSlider('starStrength', 'Star strength', 0, 20, (v) => v.toFixed(1)),
    ctl.diff.el,
  )
}
function syncLensCtl(): void {
  for (const [k, c] of Object.entries(ctl)) if (k.startsWith('lens.')) c.set((P.spec.lens as unknown as Record<string, number>)[k.slice(5)])
  ctl.diff.set(P.spec.lens.diffraction)
  ctl.blades.set(P.spec.aperture.blades)
  ctl.curv.set(P.spec.aperture.curvature)
  ctl.rot.set(P.spec.aperture.rotation)
}
{
  const g = ui.group(panel, 'Film', false, 'Grain follows Selwyn: RMS density ~ sqrt(ISO) / sqrt(area), so big formats look finer.')
  ctl.color = ui.toggle('Colour film (off = panchromatic B&W)', P.spec.film.color, (v) => {
    P.spec.film.color = v
    P.mono = !v
    changed()
    redevelop()
  })
  ctl.grainSize = ui.slider('Grain clump size', 1, 40, P.spec.film.grainSize, (v) => `${v.toFixed(0)} µm`, (v) => {
    P.spec.film.grainSize = v
    changed()
  })
  ctl.granularity = ui.slider('Granularity', 0, 4, P.spec.film.granularity, (v) => `${v.toFixed(2)}×`, (v) => {
    P.spec.film.granularity = v
    changed()
  })
  ctl.recip = ui.slider('Reciprocity exponent p', 0.6, 1, P.spec.film.reciprocityP, (v) => v.toFixed(2), (v) => {
    P.spec.film.reciprocityP = v
    changed()
  })
  g.append(ctl.color.el, ctl.grainSize.el, ctl.granularity.el, ctl.recip.el)
}
{
  const g = ui.group(panel, 'Scene', true, 'Sun drives real illuminance (lux) and sky luminance (cd/m²). Below 0° the fairy lights take over.')
  ctl.sunEl = ui.slider('Sun elevation', -8, 80, 38, (v) => `${v.toFixed(1)}°`, (v) => scheduleSun(v, ctl.sunAz.get()))
  ctl.sunAz = ui.slider('Sun azimuth', 0, 360, 35, (v) => `${v.toFixed(0)}°`, (v) => scheduleSun(ctl.sunEl.get(), v))
  ctl.pin = ui.slider('Pinwheel', 0, 30, yard.params.pinwheelRps, (v) => `${v.toFixed(1)} rev/s`, (v) => yard.setPinwheelRps(v))
  ctl.car = ui.slider('Toy car', 0, 25, yard.params.carSpeed, (v) => `${v.toFixed(1)} m/s`, (v) => yard.setCarSpeed(v))
  ctl.ball = ui.toggle('Bouncing ball', true, (v) => (yard.params.ball = v))
  ctl.freeze = ui.toggle('Freeze time (live view)', false, (v) => (P.freeze = v))
  g.append(ctl.sunEl.el, ctl.sunAz.el, ctl.pin.el, ctl.car.el, ctl.ball.el, ctl.freeze.el)
}
{
  const g = ui.group(panel, 'Flash & multiple exposure', false, 'A guide number GN exposes mid-grey at f/(GN/distance). Faster than X-sync, a focal-plane slit only catches the flash in a band. Multiple exposure = do not wind on.')
  ctl.flash = ui.toggle('Fire flash', P.flash, (v) => (P.flash = v))
  ctl.gn = ui.slider('Guide number (ISO 100)', 4, 60, yard.flashGN, (v) => `${v.toFixed(0)} m`, (v) => (yard.flashGN = v), { step: 1 })
  ctl.fdur = ui.steps('Flash duration', [1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000, 1 / 8000, 1 / 16000, 1 / 32000], yard.flashDuration, formatShutter, (v) => (yard.flashDuration = v))
  ctl.fsync = ui.select('Sync', [['front', 'front curtain (X-sync)'], ['rear', 'rear curtain']], 'front', (v) => (P.flashSync = v as 'front' | 'rear'))
  ctl.multi = ui.toggle('Multiple exposure (next shot adds to this frame)', P.multi, (v) => {
    P.multi = v
    if (!v) resetMulti()
  })
  g.append(ctl.flash.el, ctl.gn.el, ctl.fdur.el, ctl.fsync.el, ctl.multi.el)
}
{
  const g = ui.group(panel, 'Camera motion', false, 'Pan follows the action during the exposure; shake is a hand tremor (8-13 Hz).')
  ctl.pan = ui.slider('Pan', -120, 120, 0, (v) => `${v.toFixed(0)}°/s`, (v) => (P.pan = v), { step: 1 })
  ctl.shake = ui.slider('Hand shake', 0, 0.6, 0, (v) => `${v.toFixed(2)}°`, (v) => (P.shake = v))
  g.append(ctl.pan.el, ctl.shake.el)
}
{
  const g = ui.group(panel, 'Quality & output', true, 'Samples per pixel is the main cost knob. Phones: 16-24 at 1024 px.')
  ctl.samples = ui.steps('Samples / pixel', SAMPLES, P.samples, String, (v) => (P.samples = v))
  ctl.res = ui.steps('Long edge', RESOLUTIONS, P.longEdge, (v) => `${v} px`, (v) => (P.longEdge = v))
  ctl.slice = ui.slider('Frame budget', 2, 40, P.sliceMs, (v) => `${v.toFixed(0)} ms`, (v) => (P.sliceMs = v))
  ctl.evf = ui.toggle('Exposure preview in viewfinder (EVF)', P.evf, (v) => (P.evf = v))
  ctl.smooth = ui.toggle('Smooth bokeh (per-sample pre-blur)', P.smooth, (v) => (P.smooth = v))
  ctl.shadowEvery = ui.steps('Shadow refresh', [1, 2, 4, 8, 16, 1000], P.shadowEvery, (v) => (v >= 1000 ? 'once' : v === 1 ? 'every sub-frame' : `every ${v}`), (v) => (P.shadowEvery = v))
  const diagBtn = document.createElement('button')
  diagBtn.textContent = 'Shoot bokeh-field diagnostic'
  diagBtn.addEventListener('click', () => void diagnostic('bokeh'))
  g.append(diagBtn)
  ctl.renderCap = ui.steps('Focal-plane render cap', [2, 4, 6, 8, 12, 16, 24, 32], P.renderCap, (v) => `${v}× samples`, (v) => (P.renderCap = v))
  g.append(ctl.samples.el, ctl.res.el, ctl.slice.el, ctl.shadowEvery.el, ctl.renderCap.el, ctl.evf.el, ctl.smooth.el)
}

let sunTimer = 0
function scheduleSun(el: number, az: number): void {
  clearTimeout(sunTimer)
  sunTimer = window.setTimeout(() => {
    yard.setSun(el, az)
    updateHud()
  }, 60)
}

function syncAll(): void {
  ctl.focal.set(P.spec.focalLength)
  ctl.fnum.set(P.spec.fNumber)
  ctl.focus.set(Number.isFinite(P.spec.focusDistance) ? P.spec.focusDistance : 2000)
  ctl.shutter.set(P.spec.shutter)
  ctl.iso.set(P.spec.iso)
  ctl.stype.set(P.spec.shutterType)
  ctl.travel.set(P.spec.curtainTravel * 1000)
  ctl.dir.set(P.spec.curtainDirection)
  ctl.ramp.set(P.spec.leafRamp * 1000)
  ctl.maxap.set(P.spec.maxAperture)
  ctl.color.set(P.spec.film.color)
  ctl.grainSize.set(P.spec.film.grainSize)
  ctl.granularity.set(P.spec.film.granularity)
  syncLensCtl()
}

// ------------------------------------------------------------------ presets (standpoints)

interface Standpoint {
  label: string
  pos: [number, number, number]
  look: [number, number, number]
  spec: DeepPartial<CameraSpec>
  sun?: [number, number]
  scene?: { pin?: number; car?: number }
  pan?: number
}
const STANDPOINTS: Record<string, Standpoint> = {
  yard: { label: 'Yard', pos: [0.3, 1.5, 5.4], look: [0.1, 1.0, -3], spec: { focalLength: 35, fNumber: 8, focusDistance: 4.5, shutter: 1 / 250, iso: 100, shutterType: 'focal-plane' }, sun: [38, 35] },
  pinwheel: { label: 'Bendy pinwheel', pos: [0.95, 1.3, 3.0], look: [1.25, 1.22, 1.33], spec: { focalLength: 85, fNumber: 5.6, focusDistance: 1.7, shutter: 1 / 1000, iso: 100, shutterType: 'focal-plane', curtainTravel: 0.03, curtainDirection: 'up' }, scene: { pin: 9 } },
  chart: { label: 'Test chart', pos: [-1.75, 1.0, 2.75], look: [-2.3, 0.95, 1.4], spec: { focalLength: 50, fNumber: 5.6, focusDistance: 1.46, shutter: 1 / 500, iso: 100, shutterType: 'leaf' }, sun: [38, 35] },
  bokeh: { label: 'Dusk bokeh', pos: [2.25, 1.02, -0.85], look: [2.8, 0.98, -2.2], spec: { focalLength: 85, fNumber: 1.8, maxAperture: 1.8, focusDistance: 1.45, shutter: 1 / 60, iso: 800, shutterType: 'focal-plane' }, sun: [-5, 250] },
  sun: { label: 'Into the sun', pos: [0.2, 1.3, 4.5], look: [0, 0, 0], spec: { focalLength: 28, fNumber: 11, focusDistance: 4, shutter: 1 / 500, iso: 100, shutterType: 'leaf' }, sun: [9, 200] },
  car: { label: 'Panning the car', pos: [0.6, 0.55, 3.4], look: [0.5, 0.3, -0.7], spec: { focalLength: 50, fNumber: 11, focusDistance: 4.0, shutter: 1 / 30, iso: 100, shutterType: 'leaf' }, scene: { car: 6 } },
  lartigue: { label: 'Lartigue', pos: [0.6, 0.45, 3.0], look: [0.5, 0.3, -0.7], spec: { focalLength: 50, fNumber: 8, focusDistance: 3.6, shutter: 1 / 1000, iso: 400, shutterType: 'focal-plane', curtainTravel: 0.08, curtainDirection: 'up' }, scene: { car: 14 } },
}

function goStandpoint(key: string): void {
  const s = STANDPOINTS[key]
  if (!s) return
  camera.position.set(...s.pos)
  P.spec = resolveSpec(s.spec, P.spec)
  if (s.sun) {
    ctl.sunEl.set(s.sun[0])
    ctl.sunAz.set(s.sun[1])
    yard.setSun(s.sun[0], s.sun[1])
  }
  if (s.scene?.pin !== undefined) {
    yard.setPinwheelRps(s.scene.pin)
    ctl.pin.set(s.scene.pin)
  }
  if (s.scene?.car !== undefined) {
    yard.setCarSpeed(s.scene.car)
    ctl.car.set(s.scene.car)
  }
  if (key === 'sun') {
    const d = yard.sun.dir.clone()
    lookAt(camera.position.clone().add(new THREE.Vector3(d.x, d.y * 0.55, d.z)))
  } else lookAt(new THREE.Vector3(...s.look))
  P.pan = s.pan ?? 0
  ctl.pan.set(P.pan)
  syncAll()
  layout()
  applyView()
  meter()
  updateHud()
}
{
  const bar = $('presets')
  for (const [k, s] of Object.entries(STANDPOINTS)) {
    const b = document.createElement('button')
    b.textContent = s.label
    b.addEventListener('click', () => goStandpoint(k))
    bar.append(b)
  }
}

// ------------------------------------------------------------------ viewfinder input

const ray = new THREE.Raycaster()
const pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>()
let pinchDist = 0
finder.addEventListener('pointerdown', (e) => {
  finder.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() })
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
  }
})
finder.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId)
  if (!p) return
  const dx = e.clientX - p.x
  const dy = e.clientY - p.y
  p.x = e.clientX
  p.y = e.clientY
  if (pointers.size === 1) {
    const o = computeOptics(P.spec)
    const k = ((o.fovH * Math.PI) / 180) / finder.clientWidth
    yaw += dx * k
    pitch = THREE.MathUtils.clamp(pitch + dy * k, -1.45, 1.45)
    applyView()
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinchDist > 0) zoom(d / pinchDist)
    pinchDist = d
  }
})
const endPointer = (e: PointerEvent) => {
  const p = pointers.get(e.pointerId)
  pointers.delete(e.pointerId)
  if (!p) return
  const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0)
  if (moved < 6 && performance.now() - p.t0 < 450 && pointers.size === 0) focusAt(e.clientX, e.clientY)
}
finder.addEventListener('pointerup', endPointer)
finder.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId))
finder.addEventListener('wheel', (e) => {
  e.preventDefault()
  zoom(Math.pow(1.0015, -e.deltaY))
}, { passive: false })

function zoom(factor: number): void {
  P.spec.focalLength = THREE.MathUtils.clamp(P.spec.focalLength * factor, 4, 1200)
  ctl.focal.set(P.spec.focalLength)
  changed()
}

function focusAt(clientX: number, clientY: number): void {
  const r = finder.getBoundingClientRect()
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const hit = ray.intersectObjects(yard.focusables, false)[0]
  if (!hit) return
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  const d = hit.point.clone().sub(camera.position).dot(fwd)
  P.spec.focusDistance = Math.max(0.12, d)
  ctl.focus.set(P.spec.focusDistance)
  changed()
  const ring = $('focus-ring')
  ring.style.left = `${clientX - r.left}px`
  ring.style.top = `${clientY - r.top}px`
  ring.style.opacity = '1'
  setTimeout(() => (ring.style.opacity = '0'), 700)
}

const keys = new Set<string>()
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return
  if (e.code === 'Space') {
    e.preventDefault()
    void takePhoto()
  }
  keys.add(e.code)
})
window.addEventListener('keyup', (e) => keys.delete(e.code))

// ------------------------------------------------------------------ meter (reflected, centre-weighted average)

const meterRT = new THREE.WebGLRenderTarget(48, 32, { type: photo.caps.floatRender ? THREE.FloatType : THREE.HalfFloatType, depthBuffer: true })
let meterL = 1000
function meter(): void {
  const aspect = P.spec.format.width / P.spec.format.height
  const w = 48
  const h = Math.max(8, Math.round(48 / aspect))
  if (meterRT.width !== w || meterRT.height !== h) meterRT.setSize(w, h)
  renderer.setRenderTarget(meterRT)
  renderer.render(yard.scene, camera)
  renderer.setRenderTarget(null)
  const isF = meterRT.texture.type === THREE.FloatType
  const buf = isF ? new Float32Array(w * h * 4) : new Uint16Array(w * h * 4)
  renderer.readRenderTargetPixels(meterRT, 0, 0, w, h, buf)
  let s = 0
  let ws = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = isF ? buf[i] : THREE.DataUtils.fromHalfFloat(buf[i])
      const g = isF ? buf[i + 1] : THREE.DataUtils.fromHalfFloat(buf[i + 1])
      const b = isF ? buf[i + 2] : THREE.DataUtils.fromHalfFloat(buf[i + 2])
      const L = Math.min(2e5, 0.2126 * r + 0.7152 * g + 0.0722 * b) // a selenium cell saturates on the sun
      const cx = (x + 0.5) / w - 0.5
      const cy = (y + 0.5) / h - 0.5
      const wt = 1 + 2 * Math.exp(-(cx * cx + cy * cy) / 0.04)
      s += L * wt
      ws += wt
    }
  meterL = s / ws
}

// ------------------------------------------------------------------ HUD

function updateHud(): void {
  const s = P.spec
  const o = computeOptics(s)
  const sceneEV = luminanceToEV100(meterL)
  const delta = sceneEV - o.ev100
  const cls = Math.abs(delta) < 0.35 ? 'ok' : delta > 0 ? 'over' : 'under'
  const dirArrow = { up: '↑', down: '↓', left: '←', right: '→' }[s.curtainDirection]
  const sun = yard.sun
  $('hud').innerHTML = [
    `<div><b>${Math.round(s.focalLength)} mm · ${formatFNumber(s.fNumber)} · ${formatShutter(s.shutter)} · ISO ${s.iso}</b> · ${s.shutterType === 'leaf' ? 'leaf shutter' : `focal-plane ${dirArrow} ${(s.curtainTravel * 1000).toFixed(1)} ms`} · ${s.format.name ?? `${s.format.width}x${s.format.height}`}</div>`,
    `<div>FOV ${o.fovH.toFixed(1)}° × ${o.fovV.toFixed(1)}° · lens-film ${o.imageDistance.toFixed(1)} mm${o.bellowsStops > 0.05 ? ` (bellows −${o.bellowsStops.toFixed(2)} EV, works at ${formatFNumber(o.workingFNumber)})` : ''} · CoC ${o.coc.toFixed(3)} mm · Airy ⌀ ${(2 * o.airyRadiusUm).toFixed(1)} µm</div>`,
    `<div>Focus ${formatDistance(s.focusDistance)} · DOF ${formatDistance(o.dofNear)} – ${formatDistance(o.dofFar)} · hyperfocal ${formatDistance(o.hyperfocal)}</div>`,
    `<div>Camera suits EV₁₀₀ <b>${o.ev100.toFixed(1)}</b> · meter reads EV₁₀₀ <b>${sceneEV.toFixed(1)}</b> → <span class="${cls}">${delta >= 0 ? '+' : ''}${delta.toFixed(1)} EV ${Math.abs(delta) < 0.35 ? 'on the nose' : delta > 0 ? 'over' : 'under'}</span></div>`,
    `<div>Sun ${sun.elevation.toFixed(1)}° · direct ${(sun.directLux / 1000).toFixed(1)} klx · sky ${(sun.skyLux / 1000).toFixed(2)} klx · sunlit grey card EV₁₀₀ ${luminanceToEV100(yard.greyCardLuminance()).toFixed(1)}</div>`,
  ].join('')
}

// ------------------------------------------------------------------ capture

let capturing = false
let abortCtl: AbortController | null = null
let multiBase: THREE.WebGLRenderTarget | null = null
let multiCount = 0
const sameSize = (t: THREE.WebGLRenderTarget, [w, h]: [number, number]) => t.width === w && t.height === h
function resetMulti(): void {
  multiBase?.dispose()
  multiBase = null
  multiCount = 0
}
let last: { result: CaptureResult; pixels: Uint8ClampedArray | null } | null = null
const printCanvas = $<HTMLCanvasElement>('print')
const printCtx = printCanvas.getContext('2d')!

function cameraMotion(span: number): ((tRel: number) => CameraPose) | undefined {
  if (!P.pan && !P.shake) return undefined
  const basePos = camera.position.clone()
  const baseQ = camera.quaternion.clone()
  const up = new THREE.Vector3(0, 1, 0)
  const right = new THREE.Vector3(1, 0, 0)
  const ph = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28]
  const q = new THREE.Quaternion()
  const q2 = new THREE.Quaternion()
  return (tRel: number) => {
    const t = tRel - span / 2
    const panA = (P.pan * Math.PI) / 180 * t
    const a = (P.shake * Math.PI) / 180
    const sx = a * (0.6 * Math.sin(2 * Math.PI * 9.3 * tRel + ph[0]) + 0.4 * Math.sin(2 * Math.PI * 12.7 * tRel + ph[1]))
    const sy = a * (0.6 * Math.sin(2 * Math.PI * 8.1 * tRel + ph[2]) + 0.4 * Math.sin(2 * Math.PI * 11.3 * tRel + ph[3]))
    q.setFromAxisAngle(up, -panA + sy)
    q2.setFromAxisAngle(right, sx)
    const quaternion = q.clone().multiply(baseQ).multiply(q2)
    return { position: basePos, quaternion }
  }
}

async function takePhoto(overrides: { samples?: number; longEdge?: number; sliceMs?: number; seed?: number; smoothBokeh?: boolean; grain?: boolean; flare?: boolean; glareProbe?: boolean } = {}): Promise<ReturnType<typeof summary> | null> {
  if (capturing) return null
  capturing = true
  abortCtl = new AbortController()
  $('lamp').classList.add('on')
  $<HTMLButtonElement>('shoot').disabled = true
  $<HTMLButtonElement>('abort').disabled = false
  const spec = resolveSpec({}, P.spec)
  const span = spec.shutterType === 'leaf' ? spec.shutter + spec.leafRamp : spec.shutter + spec.curtainTravel
  const t0 = yard.time
  yard.beginExposure(span)
  const bar = $('progress').firstElementChild as HTMLDivElement
  try {
    const res = await photo.capture(yard.photoScene, spec, {
      pose: camera,
      poseAt: cameraMotion(span),
      time0: t0,
      samples: overrides.samples ?? P.samples,
      longEdge: overrides.longEdge ?? P.longEdge,
      sliceMs: overrides.sliceMs ?? P.sliceMs,
      seed: overrides.seed,
      smoothBokeh: overrides.smoothBokeh ?? P.smooth,
      shadowEvery: P.shadowEvery,
      maxRenders: (overrides.samples ?? P.samples) * P.renderCap,
      grain: overrides.grain,
      flare: overrides.flare,
      glareProbe: overrides.glareProbe,
      flash: P.flash
        ? {
            duration: yard.flashDuration,
            time: P.flashSync === 'rear' ? Math.max(0, spec.shutter - yard.flashDuration) + (spec.shutterType === 'leaf' ? spec.leafRamp / 2 : 0) : undefined,
          }
        : undefined,
      baseTarget: P.multi && multiBase && sameSize(multiBase, PhotoRenderer.outputSize(spec.format, overrides.longEdge ?? P.longEdge, photo.caps.maxSize)) ? multiBase : undefined,
      keepPreGrain: P.multi,
      signal: abortCtl.signal,
      onProgress: (p) => {
        bar.style.width = `${(p.fraction * 100).toFixed(1)}%`
        $('status').textContent = `${p.phase} ${p.done}/${p.total} · ${(p.elapsedMs / 1000).toFixed(1)} s`
      },
    })
    last = { result: res, pixels: null }
    if (P.multi && res.preGrainTarget) {
      multiBase?.dispose()
      multiBase = res.preGrainTarget
      multiCount++
    }
    redevelop()
    const s = summary()
    return s
  } catch (err) {
    if ((err as Error).message?.includes('baseTarget size')) resetMulti()
    if ((err as Error).name !== 'AbortError') {
      console.error(err)
      $('status').textContent = `error: ${(err as Error).message}`
    } else $('status').textContent = 'aborted'
    return null
  } finally {
    yard.endExposure(span)
    capturing = false
    $('lamp').classList.remove('on')
    $<HTMLButtonElement>('shoot').disabled = false
    $<HTMLButtonElement>('abort').disabled = true
  }
}
$('shoot').addEventListener('click', () => void takePhoto())
$('abort').addEventListener('click', () => abortCtl?.abort())

/** Shoot a diagnostic scene with the current camera settings (focus forced near so everything is bokeh). */
async function diagnostic(kind: 'bokeh', o: { samples?: number; longEdge?: number; focus?: number } = {}): Promise<ReturnType<typeof summary> | null> {
  if (capturing) return null
  capturing = true
  try {
    const scene = kind === 'bokeh' ? bokehField() : bokehField()
    const spec = resolveSpec({ focusDistance: o.focus ?? 1.2, shutter: 1 / 4, iso: 100 }, P.spec)
    const res = await photo.capture(scene, spec, {
      pose: { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() },
      samples: o.samples ?? Math.max(64, P.samples),
      longEdge: o.longEdge ?? P.longEdge,
      sliceMs: P.sliceMs,
      grain: false,
    })
    last = { result: res, pixels: null }
    redevelop()
    return summary()
  } finally {
    capturing = false
  }
}

function redevelop(): void {
  if (!last) return
  const r = last.result
  if (!r.latent) return
  const film = P.mono || !r.meta.spec.film.color ? NEGATIVE_BW : NEGATIVE_COLOR
  const t0 = performance.now()
  const px = develop(r.latent, r.width, r.height, { film, mode: P.printMode, printStops: P.printStops, mono: P.mono })
  const devMs = performance.now() - t0
  last.pixels = px
  printCanvas.width = r.width
  printCanvas.height = r.height
  printCtx.putImageData(new ImageData(px as unknown as Uint8ClampedArray<ArrayBuffer>, r.width, r.height), 0, 0)
  $('print-wrap').classList.remove('empty')
  const m = r.meta
  const s = m.spec
  $('caption').innerHTML = [
    `${formatFNumber(s.fNumber)} · ${formatShutter(s.shutter)} · ISO ${s.iso}`,
    `${Math.round(s.focalLength)} mm on ${s.format.name ?? `${s.format.width}x${s.format.height}`}`,
    `${s.shutterType}${s.shutterType === 'leaf' ? ` (eff. ${(m.exposure.shutterEfficiency * 100).toFixed(0)}%)` : ` ${(s.curtainTravel * 1000).toFixed(1)} ms`}`,
    ...(P.flash ? [`flash GN ${yard.flashGN} ${P.flashSync}`] : []),
    ...(P.multi && multiCount > 1 ? [`${multiCount} exposures on this frame`] : []),
    `focus ${formatDistance(s.focusDistance)}`,
    `median X ${m.stats ? m.stats.medianX.toFixed(2) : '?'} (${m.stats ? (Math.log2(Math.max(1e-6, m.stats.medianX)) >= 0 ? '+' : '') + Math.log2(Math.max(1e-6, m.stats.medianX)).toFixed(1) : '?'} EV vs grey)`,
  ].map((x) => `<span>${x}</span>`).join('')
  const t = m.timing
  $('perf').textContent =
    `${m.sampling.renders} sub-frames (${m.sampling.samplesPerPixel.toFixed(1)} per pixel) at ${m.sampling.renderSize[0]}x${m.sampling.renderSize[1]} -> ${r.width}x${r.height}` +
    ` · expose ${t.exposeMs.toFixed(0)} ms CPU-side over ${t.slices} frames, wall ${t.totalMs.toFixed(0)} ms (${(t.totalMs / Math.max(1, m.sampling.renders)).toFixed(1)} ms/sub-frame)` +
    ` · optics+film ${t.developMs.toFixed(0)} ms · readback ${t.readbackMs.toFixed(0)} ms · print ${devMs.toFixed(0)} ms` +
    `\nlatent X: p01 ${m.stats?.p01.toFixed(3)} median ${m.stats?.medianX.toFixed(3)} p99 ${m.stats?.p99.toFixed(2)} max ${m.stats?.maxX.toExponential(2)} · H = X × ${m.exposure.hPerUnit.toFixed(4)} lux·s`
}

function summary() {
  if (!last) return null
  const m = last.result.meta
  return {
    width: last.result.width,
    height: last.result.height,
    renders: m.sampling.renders,
    spp: +m.sampling.samplesPerPixel.toFixed(2),
    renderSize: m.sampling.renderSize,
    overscan: +m.sampling.overscan.toFixed(3),
    timing: Object.fromEntries(Object.entries(m.timing).map(([k, v]) => [k, Math.round(v)])),
    stats: m.stats,
    exposure: { ev: +m.exposure.ev.toFixed(2), ev100: +m.exposure.ev100.toFixed(2), eff: +m.exposure.shutterEfficiency.toFixed(3), xPerNit: m.exposure.xPerNit },
    optics: { fovH: +m.optics.fovH.toFixed(2), coc: +m.optics.coc.toFixed(4), dofNear: +m.optics.dofNear.toFixed(3), dofFar: m.optics.dofFar },
    caps: m.caps,
  }
}

{
  const tools = $('print-tools')
  const mode = ui.select('View', [['positive', 'Print (positive)'], ['negative', 'Negative'], ['zones', 'Latent zones (stops vs grey)']], 'positive', (v) => {
    P.printMode = v as DevelopMode
    redevelop()
  })
  const stops = ui.slider('Print exposure', -3, 3, 0, (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} EV`, (v) => {
    P.printStops = v
    redevelop()
  }, { step: 0.1 })
  const mono = ui.toggle('Print in B&W', false, (v) => {
    P.mono = v
    redevelop()
  })
  const save = document.createElement('button')
  save.textContent = 'Save print PNG'
  save.addEventListener('click', () => {
    if (!last) return
    printCanvas.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `photo-${Date.now()}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    })
  })
  for (const c of [mode.el, stops.el, mono.el]) {
    c.style.minWidth = '200px'
    tools.append(c)
  }
  tools.append(save)
}

// ------------------------------------------------------------------ frame loop

let lastT = performance.now()
let frameNo = 0
let holdUntil = 0
function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastT) / 1000)
  lastT = now
  frameNo++
  if (performance.now() < holdUntil) {
    // showing a GPU print in the viewfinder
  } else if (!capturing) {
    // keyboard walk
    const v = 2.2 * dt
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    if (keys.has('KeyW')) camera.position.addScaledVector(fwd, v)
    if (keys.has('KeyS')) camera.position.addScaledVector(fwd, -v)
    if (keys.has('KeyA')) camera.position.addScaledVector(right, -v)
    if (keys.has('KeyD')) camera.position.addScaledVector(right, v)
    if (keys.has('KeyQ')) camera.position.y = Math.max(0.1, camera.position.y - v)
    if (keys.has('KeyE')) camera.position.y += v
    if (keys.has('ArrowLeft')) yaw += dt
    if (keys.has('ArrowRight')) yaw -= dt
    if (keys.has('ArrowUp')) pitch = Math.min(1.45, pitch + dt)
    if (keys.has('ArrowDown')) pitch = Math.max(-1.45, pitch - dt)
    applyView()
    if (!P.freeze) yard.update(dt)
    const o = computeOptics(P.spec)
    camera.fov = o.fovV
    camera.aspect = P.spec.format.width / P.spec.format.height
    camera.updateProjectionMatrix()
    if (frameNo % 10 === 1) {
      meter()
      updateHud()
    }
    // EVF: show what the film will get (X = 1 -> scene-linear 0.18), else auto-expose like an eye
    renderer.toneMappingExposure = P.evf ? 0.18 * xPerNit(P.spec, o, P.spec.shutter) : 0.18 / Math.max(meterL, 1e-3)
    renderer.setRenderTarget(null)
    renderer.render(yard.scene, camera)
  } else {
    photo.drawPreview(null)
  }
  requestAnimationFrame(frame)
}

// ------------------------------------------------------------------ test hooks

declare global {
  interface Window {
    __spike: unknown
  }
}
window.__spike = {
  ready: true,
  caps: photo.caps,
  spec: () => P.spec,
  set: (partial: DeepPartial<CameraSpec>) => {
    P.spec = resolveSpec(partial, P.spec)
    syncAll()
    layout()
    updateHud()
    return P.spec
  },
  scene: (p: { sunElevation?: number; sunAzimuth?: number; pinwheelRps?: number; carSpeed?: number; carPhase?: number; ball?: boolean; freeze?: boolean }) => {
    if (p.sunElevation !== undefined || p.sunAzimuth !== undefined) {
      const el = p.sunElevation ?? yard.sun.elevation
      const az = p.sunAzimuth ?? yard.sun.azimuth
      ctl.sunEl.set(el)
      ctl.sunAz.set(az)
      yard.setSun(el, az)
    }
    if (p.pinwheelRps !== undefined) yard.setPinwheelRps(p.pinwheelRps)
    if (p.carSpeed !== undefined) yard.setCarSpeed(p.carSpeed)
    if (p.carPhase !== undefined) yard.setCarPhase((p.carPhase * Math.PI) / 180)
    if (p.ball !== undefined) yard.params.ball = p.ball
    if (p.freeze !== undefined) P.freeze = p.freeze
    updateHud()
  },
  motion: (pan: number, shake: number) => {
    P.pan = pan
    P.shake = shake
    ctl.pan.set(pan)
    ctl.shake.set(shake)
  },
  preset: (k: string) => goStandpoint(k),
  lens: (k: string) => {
    const p = LENS_PRESETS[k]
    if (p) P.spec = resolveSpec(p.spec, P.spec)
    syncAll()
  },
  mask: (k: string) => {
    P.spec.aperture.mask = makeMask(k)
    ctl.mask.set(k)
  },
  view: (mode: DevelopMode, stops = 0) => {
    P.printMode = mode
    P.printStops = stops
    redevelop()
  },
  diag: (kind: 'bokeh' = 'bokeh', o?: { samples?: number; longEdge?: number; focus?: number }) => diagnostic(kind, o),
  shoot: (o?: { samples?: number; longEdge?: number; sliceMs?: number; seed?: number; smoothBokeh?: boolean; grain?: boolean; flare?: boolean; glareProbe?: boolean }) => takePhoto(o),
  /** draw the last capture as a print via the GPU path into the viewfinder (pauses the live view for `ms`) */
  gpuPrint: (ms = 3000) => {
    holdUntil = performance.now() + ms
    const film = P.mono || !last?.result.meta.spec.film.color ? NEGATIVE_BW : NEGATIVE_COLOR
    return photo.drawPrint(null, undefined, { film, printStops: P.printStops, mono: P.mono })
  },
  /** flash + multiple exposure from tests */
  flash: (on: boolean, gn = 32, duration = 1 / 1000, sync: 'front' | 'rear' = 'front') => {
    P.flash = on
    yard.flashGN = gn
    yard.flashDuration = duration
    P.flashSync = sync
    ctl.flash.set(on)
    ctl.gn.set(gn)
    ctl.fdur.set(duration)
    ctl.fsync.set(sync)
  },
  multi: (on: boolean) => {
    P.multi = on
    ctl.multi.set(on)
    if (!on) resetMulti()
  },
  /** turn the camera by (dYaw, dPitch) degrees */
  look: (dYawDeg: number, dPitchDeg: number) => {
    yaw += (dYawDeg * Math.PI) / 180
    pitch = THREE.MathUtils.clamp(pitch + (dPitchDeg * Math.PI) / 180, -1.45, 1.45)
    applyView()
  },
  step: (frames = 1, dt = 1 / 60) => {
    for (let i = 0; i < frames; i++) yard.update(dt)
    return yard.time
  },
  meter: () => {
    meter()
    updateHud()
    return { L: meterL, ev100: luminanceToEV100(meterL), cameraEv100: computeOptics(P.spec).ev100 }
  },
  last: () => summary(),
  /** show the print alone, filling the viewport, optionally zoomed into a region (u0,v0,u1,v1 of the frame) */
  inspect: (on = true, region?: [number, number, number, number]) => {
    document.body.classList.toggle('inspect', on)
    const c = printCanvas
    if (!on || !region) {
      c.style.transform = ''
      return
    }
    const [u0, v0, u1, v1] = region
    const sx = 1 / (u1 - u0)
    const sy = 1 / (v1 - v0)
    const s = Math.min(sx, sy)
    c.style.transformOrigin = '0 0'
    c.style.transform = `scale(${s}) translate(${-u0 * 100}%, ${-v0 * 100}%)`
  },
  probe: (u: number, v: number, half = 3) => {
    if (!last?.result.latent) return null
    const r = last.result
    const lat = last.result.latent
    const cx = Math.round(u * (r.width - 1))
    const cy = Math.round(v * (r.height - 1))
    const acc = [0, 0, 0]
    let n = 0
    for (let y = cy - half; y <= cy + half; y++)
      for (let x = cx - half; x <= cx + half; x++) {
        if (x < 0 || y < 0 || x >= r.width || y >= r.height) continue
        const i = (y * r.width + x) * 4
        acc[0] += lat[i]
        acc[1] += lat[i + 1]
        acc[2] += lat[i + 2]
        n++
      }
    return acc.map((a) => +(a / n).toFixed(4))
  },
  tests: {
    all: () => runAll(photo),
    calibration: () => testCalibration(photo),
    coc: () => testCoC(photo),
    fov: () => testFOV(photo),
    skew: () => testSkew(photo),
    motion: () => testMotion(photo),
    flash: () => testFlash(photo),
  },
  /** timing table: each case captures the current view with the given overrides (no readback skew: readback on) */
  bench: async (cases: { samples: number; longEdge: number; shutterType?: CameraSpec['shutterType']; shadowEvery?: number; sliceMs?: number; smoothBokeh?: boolean }[]) => {
    const rows = []
    for (const c of cases) {
      const spec = resolveSpec({ shutterType: c.shutterType ?? P.spec.shutterType }, P.spec)
      const span = spec.shutterType === 'leaf' ? spec.shutter + spec.leafRamp : spec.shutter + spec.curtainTravel
      yard.beginExposure(span)
      const r = await photo.capture(yard.photoScene, spec, {
        pose: camera,
        time0: yard.time,
        samples: c.samples,
        longEdge: c.longEdge,
        sliceMs: c.sliceMs ?? 12,
        shadowEvery: c.shadowEvery ?? 1,
        smoothBokeh: c.smoothBokeh,
        maxRenders: c.samples * 8,
      })
      yard.endExposure(0)
      const t = r.meta.timing
      rows.push({ ...c, shutterType: spec.shutterType, renders: r.meta.sampling.renders, totalMs: Math.round(t.totalMs), cpuMs: Math.round(t.exposeMs), postMs: Math.round(t.developMs), readMs: Math.round(t.readbackMs), msPerRender: +(t.totalMs / r.meta.sampling.renders).toFixed(2) })
    }
    return rows
  },
  camera,
  photo,
  yard,
  THREE,
}

layout()
updateHud()
requestAnimationFrame(frame)
// compile the photo pipeline's shaders up front (the first capture is otherwise ~0.4 s slower)
void photo.warmup(yard.photoScene).then(() => ($('status').textContent = 'ready'))
