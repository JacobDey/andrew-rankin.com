// Camera parts (studio.md §6.2) and deriveSpec(): the thin-lens §5.6 math, plus the bridge to @shared/photo.
import { resolveSpec, type PhotoSpec } from '@shared/photo'
import type { BodyId, CameraBuild, CameraSettings, CameraSpec, ShutterKind, StockId } from '../core/contracts'

export interface BodyDef { id: BodyId; name: string; formatMm: [number, number]; frames: number; finder: CameraSpec['finder']; mass: number; v: [number, number] | 'helicoid'; tilt: number; sheet: boolean }
export interface LensDef { id: string; name: string; f: number | 'body'; nMin: number; nMax: number; blades: number; ic: number; glow: number; edge: number; ca: number; k1: number; mass: number; stops?: number[] }
export interface StockDef { id: StockId; name: string; iso: number; color: boolean; grain: number; devNominalS: number; spectral: [number, number, number] }

export const BODIES: Record<string, BodyDef> = {
  oatcan: { id: 'oatcan', name: 'Oatmeal-can pinhole', formatMm: [120, 96], frames: 1, finder: 'pins', mass: 0.12, v: [100, 100], tilt: 0, sheet: true },
  box: { id: 'box', name: 'Box camera', formatMm: [56, 56], frames: 8, finder: 'waist', mass: 0.6, v: 'helicoid', tilt: 0, sheet: false },
  field: { id: 'field', name: 'Field camera', formatMm: [121, 97], frames: 6, finder: 'ground', mass: 1.8, v: [60, 360], tilt: 10, sheet: true },
}
export const LENSES: Record<string, LensDef> = {
  pinhole: { id: 'pinhole', name: 'Pinhole foil', f: 'body', nMin: 0, nMax: 0, blades: 0, ic: 400, glow: 0, edge: 0, ca: 0, k1: 0, mass: 0.005 },
  meniscus75: { id: 'meniscus75', name: 'Meniscus 75', f: 75, nMin: 11, nMax: 32, blades: 0, ic: 90, glow: 0.1, edge: 3, ca: 0.002, k1: 0, mass: 0.08 },
  plasmat150: { id: 'plasmat150', name: 'Plasmat 150', f: 150, nMin: 5.6, nMax: 45, blades: 6, ic: 180, glow: 0.02, edge: 0, ca: 0.0005, k1: 0, mass: 0.35 },
  portrait120: { id: 'portrait120', name: 'Portrait 120', f: 120, nMin: 3.6, nMax: 8, blades: 0, ic: 130, glow: 0.08, edge: 1.5, ca: 0.002, k1: 0, mass: 0.3, stops: [3.6, 5.6, 8] },
}
export const SHUTTERS: Record<ShutterKind, { id: ShutterKind; name: string; loudness: number; speeds: number[]; mass: number }> = {
  cap: { id: 'cap', name: 'Lens cap', loudness: 0, speeds: [0], mass: 0.01 },
  leaf: { id: 'leaf', name: 'Leaf shutter', loudness: 0.15, speeds: [0, 1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500], mass: 0.12 },
  drop: { id: 'drop', name: 'Gravity drop', loudness: 0.9, speeds: [], mass: 0.15 },
  focalplane: { id: 'focalplane', name: 'Cloth focal-plane', loudness: 0.6, speeds: [1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000], mass: 0.1 },
}
const PAN: [number, number, number] = [0.2126, 0.7152, 0.0722]
export const STOCKS: Record<StockId, StockDef> = {
  ortho25: { id: 'ortho25', name: 'Nightjar Ortho 25', iso: 25, color: false, grain: 0.006, devNominalS: 300, spectral: [0, 0.35, 0.65] },
  nj100: { id: 'nj100', name: 'Nightjar 100', iso: 100, color: false, grain: 0.012, devNominalS: 420, spectral: PAN },
  nj400: { id: 'nj400', name: 'Nightjar 400', iso: 400, color: false, grain: 0.024, devNominalS: 570, spectral: PAN },
  colour200: { id: 'colour200', name: 'Nightjar Colour 200', iso: 200, color: true, grain: 0.018, devNominalS: 195, spectral: [1, 1, 1] },
}
export const PART_NAMES: Record<string, string> = {
  oatcan: 'Oatmeal can', box: 'Box camera', field: 'Field camera', pinhole: 'Pinhole foil', meniscus75: 'Meniscus 75', plasmat150: 'Plasmat 150',
  portrait120: 'Portrait 120', cap: 'Lens cap', leaf: 'Leaf shutter', drop: 'Gravity drop', ortho25: 'Ortho 25', nj100: 'Nightjar 100',
  nj400: 'Nightjar 400', colour200: 'Colour 200', closeup2: '+2 close-up', tripod: 'Tripod', tilt: 'Front tilt', gels: 'Lantern gels', bucket6: 'Bucket of balls',
}

export function bodyFocal(body: BodyDef): number {
  return body.v === 'helicoid' ? 75 : body.id === 'field' ? 150 : body.v[0]
}

export function lensFocal(build: CameraBuild): number {
  const body = BODIES[build.body]
  const lens = LENSES[build.lens] ?? LENSES.pinhole
  return lens.f === 'body' ? bodyFocal(body) : lens.f
}

/** v range (mm) for this build. Helicoid: [f, 1.08 f]; the +2 close-up adds 1/0.5 m to the focus range. */
export function vRange(build: CameraBuild): [number, number] {
  const body = BODIES[build.body]
  const f = lensFocal(build)
  if (body.v === 'helicoid') return [f, 1.08 * f]
  if (build.lens === 'pinhole') return [f, f]
  return [Math.max(body.v[0], f * 0.98), body.v[1]]
}

export function pinholeN(build: CameraBuild): number {
  return lensFocal(build) / (build.pinholeMm ?? 0.45)
}

export function deriveSpec(build: CameraBuild): CameraSpec {
  const body = BODIES[build.body]
  const lens = LENSES[build.lens] ?? LENSES.pinhole
  const sh = SHUTTERS[build.shutter]
  const stock = STOCKS[build.stock ?? 'nj100']
  const f = lensFocal(build)
  const isPin = lens.id === 'pinhole'
  const nMin = isPin ? pinholeN(build) : lens.nMin
  const nMax = isPin ? pinholeN(build) : lens.nMax
  const speeds = build.shutter === 'drop' ? dropSpeeds(build, f / nMin) : sh.speeds
  return {
    build,
    formatMm: body.formatMm,
    frames: body.frames,
    finder: body.finder,
    f, nMin, nMax,
    blades: lens.blades,
    imageCircleMm: lens.ic,
    vRangeMm: vRange(build),
    tiltMaxDeg: build.accessories.includes('tilt') || body.id === 'field' ? body.tilt : 0,
    shutterSpeeds: speeds,
    loudness: sh.loudness,
    massKg: body.mass + lens.mass + sh.mass + 0.02,
    iso: stock.iso,
    spectral: stock.color ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : [stock.spectral, stock.spectral, stock.spectral],
    post: { glow: lens.glow, edgeSoftPx: lens.edge, ca: lens.ca, k1: lens.k1, vignette: 0.3, swirl: 0 },
  }
}

/** Gravity drop: t = (20 mm + A)/v, v = √(2gh), h 5–40 cm in 5 cm notches. */
export function dropTime(hCm: number, A: number): number {
  const v = Math.sqrt(2 * 9.81 * (hCm / 100)) * 1000 // mm/s
  return (20 + A) / v
}
function dropSpeeds(build: CameraBuild, A: number): number[] {
  void build
  const out: number[] = []
  for (let h = 40; h >= 5; h -= 5) out.push(dropTime(h, A))
  return out
}

/** Effective time for a dial setting (leaf: 1/500 → 1/370, 1/250 → 1/215). */
export function actualTime(kind: ShutterKind, t: number): number {
  if (kind === 'leaf') {
    if (Math.abs(t - 1 / 500) < 1e-6) return 1 / 370
    if (Math.abs(t - 1 / 250) < 1e-6) return 1 / 215
  }
  return t
}

export function nearFocusM(build: CameraBuild): number {
  const f = lensFocal(build)
  const [, vMax] = vRange(build)
  let s = (f * vMax) / (vMax - f) / 1000
  if (!Number.isFinite(s) || s <= 0) s = Infinity
  if (build.accessories.includes('closeup2')) s = 1 / (1 / Math.min(s, 1e6) + 2)
  return s
}

export function clampFocus(build: CameraBuild, sM: number): number {
  const near = nearFocusM(build)
  if (build.lens === 'pinhole') return 3
  return Math.max(near === Infinity ? 1 : near, Math.min(1000, sM))
}

/** Bridge to @shared/photo. */
export function photoSpec(spec: CameraSpec, st: CameraSettings): PhotoSpec {
  const build = spec.build
  const isPin = build.lens === 'pinhole'
  const stock = STOCKS[build.stock ?? 'nj100']
  let focus = isPin ? 3 : st.focusM
  // +2 close-up: the slip-on dioptre shifts the focused distance (approximation: focus the lens at the equivalent far distance)
  const lens = LENSES[build.lens] ?? LENSES.pinhole
  const t = st.t > 0 ? actualTime(build.shutter, st.t) : 1
  const ramp = build.shutter === 'drop' ? Math.min(t * 0.45, (spec.f / st.N) / (Math.sqrt(2 * 9.81 * ((build.dropHeightCm ?? 40) / 100)) * 1000)) : build.shutter === 'cap' ? Math.min(0.02, t * 0.2) : 0.0015
  if (build.accessories.includes('closeup2') && !isPin) {
    const inv = 1 / focus - 2
    focus = inv > 0.001 ? 1 / inv : 1000
  }
  return resolveSpec({
    format: { width: spec.formatMm[0], height: spec.formatMm[1] },
    focalLength: spec.f,
    fNumber: st.N,
    maxAperture: spec.nMin,
    focusDistance: focus,
    shutter: t,
    iso: spec.iso,
    shutterType: 'leaf',
    leafRamp: ramp,
    aperture: { blades: lens.blades, rotation: 0, curvature: lens.blades ? 0.3 : 1, mask: null },
    lens: {
      transmittance: isPin ? 1 : 0.88,
      vignetting: isPin ? 0 : 0.25,
      naturalVignetting: 1,
      distortionK1: spec.post.k1,
      distortionK2: 0,
      lateralCA: spec.post.ca,
      longitudinalCA: 0,
      fieldCurvature: lens.edge ? 0.3 : 0,
      astigmatism: 0,
      veilingGlare: isPin ? 0.002 : 0.003,
      ghosts: isPin ? 0 : 0.05,
      glow: spec.post.glow,
      diffraction: true,
      starStrength: build.pinholeRagged ? 1 + build.pinholeRagged : 0.6,
    },
    film: { grainSize: 8, granularity: 0, color: stock.color, reciprocityP: stock.color ? 1 / 1.2 : 1 / 1.31 },
  })
}

export function defaultSettings(spec: CameraSpec): CameraSettings {
  const leafT = spec.build.shutter === 'leaf' ? 1 / 125 : spec.build.shutter === 'drop' ? spec.shutterSpeeds[0] : 15
  return { N: spec.build.lens === 'pinhole' ? spec.nMin : Math.min(spec.nMax, Math.max(spec.nMin, 16)), t: leafT, focusM: spec.build.lens === 'pinhole' ? 3 : 8, tiltDeg: 0 }
}

export const PRESETS: Record<'pinhole' | 'box' | 'field' | 'portrait', CameraBuild> = {
  pinhole: { v: 1, body: 'oatcan', lens: 'pinhole', shutter: 'cap', stock: 'ortho25', pinholeMm: 0.45, pinholeRagged: 0, accessories: [] },
  box: { v: 1, body: 'box', lens: 'meniscus75', shutter: 'leaf', stock: 'nj100', accessories: [] },
  field: { v: 1, body: 'field', lens: 'plasmat150', shutter: 'leaf', stock: 'nj100', accessories: ['tilt'] },
  portrait: { v: 1, body: 'box', lens: 'portrait120', shutter: 'leaf', stock: 'nj400', accessories: [] },
}

export function fmtShutter(t: number): string {
  if (t === 0) return 'B'
  if (t >= 1) return `${Math.round(t * 10) / 10}s`
  return `1/${Math.round(1 / t)}`
}
export function fmtN(N: number): string {
  return N >= 100 ? `f/${Math.round(N)}` : `f/${Math.round(N * 10) / 10}`
}
