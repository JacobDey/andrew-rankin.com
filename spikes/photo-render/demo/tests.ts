// Quantitative checks of the photo renderer against closed-form optics. Each test builds a tiny
// scene, captures it, measures the latent and compares with the formula. Exposed on window.__spike.tests.

import * as THREE from 'three'
import {
  PhotoRenderer,
  computeOptics,
  resolveSpec,
  blurCircleMm,
  xPerNit,
  type CameraSpec,
  type DeepPartial,
  type CaptureResult,
} from '../core/index.ts'

export interface TestResult {
  name: string
  pass: boolean
  expected: number
  measured: number
  unit: string
  note?: string
  ms: number
}

const CLEAN: DeepPartial<CameraSpec> = {
  lens: {
    vignetting: 0,
    naturalVignetting: 0,
    distortionK1: 0,
    distortionK2: 0,
    lateralCA: 0,
    longitudinalCA: 0,
    fieldCurvature: 0,
    astigmatism: 0,
    veilingGlare: 0,
    ghosts: 0,
    glow: 0,
    diffraction: false,
  },
  film: { granularity: 0, reciprocityP: 1 },
}

function emissive(L: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(L, L, L) })
}

const lookForward = { position: new THREE.Vector3(0, 0, 0), quaternion: new THREE.Quaternion() }

async function shoot(photo: PhotoRenderer, scene: THREE.Scene, spec: DeepPartial<CameraSpec>, extra: { samples?: number; longEdge?: number; setTime?: (t: number) => void } = {}): Promise<CaptureResult> {
  return photo.capture(
    { scene, setTime: extra.setTime },
    resolveSpec({ ...CLEAN, ...spec, lens: { ...CLEAN.lens, ...(spec.lens ?? {}) }, film: { ...CLEAN.film, ...(spec.film ?? {}) } } as DeepPartial<CameraSpec>),
    { pose: lookForward, samples: extra.samples ?? 32, longEdge: extra.longEdge ?? 768, sliceMs: Infinity, grain: false, flare: false, seed: 7 },
  )
}

function lum(l: Float32Array, i: number): number {
  return 0.2126 * l[i * 4] + 0.7152 * l[i * 4 + 1] + 0.0722 * l[i * 4 + 2]
}

function boxMean(r: CaptureResult, cx: number, cy: number, half: number): number {
  const l = r.latent!
  let s = 0
  let n = 0
  for (let y = Math.round(cy - half); y <= Math.round(cy + half); y++)
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      if (x < 0 || y < 0 || x >= r.width || y >= r.height) continue
      s += lum(l, y * r.width + x)
      n++
    }
  return s / Math.max(1, n)
}

/** intensity-weighted centroid and second moment of pixels above `thresh` within a window */
function moments(r: CaptureResult, x0: number, y0: number, x1: number, y1: number, thresh = 0): { cx: number; cy: number; m2: number; sum: number } {
  const l = r.latent!
  let s = 0
  let sx = 0
  let sy = 0
  for (let y = Math.max(0, y0); y < Math.min(r.height, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(r.width, x1); x++) {
      const v = lum(l, y * r.width + x)
      if (v <= thresh) continue
      s += v
      sx += v * (x + 0.5)
      sy += v * (y + 0.5)
    }
  const cx = sx / s
  const cy = sy / s
  let m2 = 0
  for (let y = Math.max(0, y0); y < Math.min(r.height, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(r.width, x1); x++) {
      const v = lum(l, y * r.width + x)
      if (v <= thresh) continue
      m2 += v * ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)
    }
  return { cx, cy, m2: m2 / s, sum: s }
}

function result(name: string, expected: number, measured: number, tol: number, unit: string, t0: number, note?: string): TestResult {
  const pass = Math.abs(measured - expected) <= tol * Math.max(1e-9, Math.abs(expected))
  return { name, pass, expected: +expected.toFixed(4), measured: +measured.toFixed(4), unit, note, ms: Math.round(performance.now() - t0) }
}

// ------------------------------------------------------------------ tests

/** Sunny-16 calibration: a Lambertian 18% card under 69.8 klx at f/16 1/125 ISO 100 -> X ~ 1.07 on axis. */
export async function testCalibration(photo: PhotoRenderer): Promise<TestResult[]> {
  const t0 = performance.now()
  const scene = new THREE.Scene()
  const card = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.18, 0.18, 0.18) }))
  card.position.z = -5
  scene.add(card)
  const sun = new THREE.DirectionalLight(0xffffff, 69813)
  sun.position.set(0, 0, 10)
  scene.add(sun, sun.target)
  const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 16, maxAperture: 2, shutter: 1 / 125, iso: 100, focusDistance: 5, shutterType: 'focal-plane', curtainTravel: 0.012 }
  const full = resolveSpec({ ...CLEAN, ...spec } as DeepPartial<CameraSpec>)
  const o = computeOptics(full)
  const L = (0.18 * 69813) / Math.PI
  const expected = L * xPerNit(full, o, full.shutter)
  const r = await shoot(photo, scene, spec, { samples: 8 })
  const out: TestResult[] = []
  out.push(result('calibration: grey card X on axis (focal-plane)', expected, boxMean(r, r.width / 2, r.height / 2, 4), 0.02, 'X', t0, `L=${L.toFixed(0)} cd/m2, EV100=${Math.log2((L * 100) / 12.5).toFixed(2)}, camera EV=${o.ev.toFixed(2)}`))
  // natural vignetting at the corner: cos^4
  const t1 = performance.now()
  const rv = await shoot(photo, scene, { ...spec, lens: { naturalVignetting: 1 } }, { samples: 4 })
  const tanT = o.halfDiag / o.imageDistance
  const cos4 = 1 / (1 + tanT * tanT) ** 2
  const corner = boxMean(rv, 3, 3, 2) / boxMean(rv, rv.width / 2, rv.height / 2, 3)
  out.push(result('natural vignetting: corner/centre = cos^4', cos4 * (1 + 0), corner, 0.03, 'ratio', t1))
  // linearity: one stop more time -> 2x X (leaf, ramp 0)
  const t2 = performance.now()
  const ra = await shoot(photo, scene, { ...spec, shutterType: 'leaf', leafRamp: 0, shutter: 1 / 250 }, { samples: 4 })
  const rb = await shoot(photo, scene, { ...spec, shutterType: 'leaf', leafRamp: 0, shutter: 1 / 125 }, { samples: 4 })
  out.push(result('linearity: X(1/125)/X(1/250)', 2, boxMean(rb, rb.width / 2, rb.height / 2, 4) / boxMean(ra, ra.width / 2, ra.height / 2, 4), 0.01, 'ratio', t2))
  // leaf efficiency: at 1/500 a stopped-down lens gets more light than wide open
  const t3 = performance.now()
  const wide = await shoot(photo, scene, { ...spec, shutterType: 'leaf', leafRamp: 0.0015, shutter: 1 / 500, fNumber: 2, aperture: { blades: 0, curvature: 1, rotation: 0 } }, { samples: 64 })
  const tight = await shoot(photo, scene, { ...spec, shutterType: 'leaf', leafRamp: 0.0015, shutter: 1 / 500, fNumber: 16, aperture: { blades: 0, curvature: 1, rotation: 0 } }, { samples: 64 })
  const effWide = wide.meta.exposure.shutterEfficiency
  const effTight = tight.meta.exposure.shutterEfficiency
  // analytic pupil average: t_eff = t + T(1 - 2 E[q]); E[q] over a uniform disc = 2/3 * (Nmin/N)
  const expWide = (1 / 500 + 0.0015 * (1 - (2 * 2) / 3)) * 500
  const expTight = (1 / 500 + 0.0015 * (1 - ((2 * 2) / 3) * (2 / 16))) * 500
  out.push(result('leaf efficiency f/2 @1/500', expWide, effWide, 0.01, 't_eff/t', t3))
  out.push(result('leaf efficiency f/16 @1/500', expTight, effTight, 0.01, 't_eff/t', t3))
  // and the image agrees with the meta (ratio estimator + exact effective time)
  const lin = (tight.meta.exposure.effectiveTime / wide.meta.exposure.effectiveTime) * (2 * 2) / (16 * 16)
  out.push(result('leaf image X ratio f/16 vs f/2', lin, boxMean(tight, tight.width / 2, tight.height / 2, 4) / boxMean(wide, wide.width / 2, wide.height / 2, 4), 0.01, 'ratio', t3))
  // mechanical vignetting: equal circles (pupil wide open, rim) offset by k*R at the corner
  const t4 = performance.now()
  const k = 0.6
  const vspec: DeepPartial<CameraSpec> = { ...spec, fNumber: 2, maxAperture: 2, shutter: 1 / 2000, shutterType: 'focal-plane', curtainTravel: 0.012, aperture: { blades: 0, curvature: 1, rotation: 0 }, lens: { vignetting: k } }
  const rvig = await shoot(photo, scene, vspec, { samples: 32 })
  const pitch = 36 / rvig.width
  // field radius of the pixel we measure (3 px in from the corner)
  const fx = (rvig.width / 2 - 3.5) * pitch
  const fy = (rvig.height / 2 - 3.5) * pitch
  const field = Math.hypot(fx, fy) / o.halfDiag
  const d = k * field // in units of R
  const lens2 = 2 * Math.acos(d / 2) - (d / 2) * Math.sqrt(4 - d * d)
  const fracExp = lens2 / Math.PI
  out.push(result('mechanical vignetting (cat-eye) corner/centre', fracExp, boxMean(rvig, 3, 3, 0) / boxMean(rvig, rvig.width / 2, rvig.height / 2, 3), 0.04, 'ratio', t4, `${rvig.meta.sampling.samplesPerPixel.toFixed(1)} samples/row`))
  // banding: row means across a central strip should not wander (focal-plane, few samples per row)
  const rows: number[] = []
  for (let y = Math.round(rvig.height * 0.3); y < Math.round(rvig.height * 0.7); y++) {
    let sm = 0
    for (let x = Math.round(rvig.width * 0.45); x < Math.round(rvig.width * 0.55); x++) sm += lum(rvig.latent!, y * rvig.width + x)
    rows.push(sm)
  }
  // high-pass: each row against the mean of its +-4 neighbours (removes the smooth vignetting gradient)
  const mean = rows.reduce((a, b) => a + b, 0) / rows.length
  let acc2 = 0
  let nres = 0
  for (let i = 4; i < rows.length - 4; i++) {
    let loc = 0
    for (let j = -4; j <= 4; j++) if (j) loc += rows[i + j]
    loc /= 8
    acc2 += (rows[i] - loc) ** 2
    nres++
  }
  const sd = Math.sqrt(acc2 / nres) / mean
  out.push({ ...result('row banding (focal-plane 1/2000, vignetting on): high-passed row-mean CV', 0, sd, 0, 'CV', t4), pass: sd < 0.004 })
  card.geometry.dispose()
  return out
}

/** Depth of field: blur-disc diameter of an out-of-focus point vs thin-lens CoC. */
export async function testCoC(photo: PhotoRenderer): Promise<TestResult[]> {
  const out: TestResult[] = []
  for (const [d, s, N, blades] of [[1, 4, 1.4, 0], [8, 2, 2, 6]] as [number, number, number, number][]) {
    const t0 = performance.now()
    const scene = new THREE.Scene()
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0006 * d, 8, 6), emissive(1e6))
    dot.position.set(0, 0, -d)
    scene.add(dot)
    const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: N, maxAperture: N, focusDistance: s, shutter: 1 / 125, shutterType: 'leaf', leafRamp: 0, aperture: { blades, rotation: 0, curvature: 0 } }
    const r = await shoot(photo, scene, spec, { samples: 256, longEdge: 1024 })
    const pitch = 36 / r.width
    const expected = blurCircleMm(resolveSpec({ ...CLEAN, ...spec } as DeepPartial<CameraSpec>), d) / pitch
    const m = moments(r, 0, 0, r.width, r.height, 0)
    // uniform disc: E[r^2] = R^2/2 ; regular hexagon of equal area has the same second moment within 0.8%
    const measured = 2 * Math.sqrt(2 * m.m2)
    out.push(result(`DOF: blur disc d=${d} m, focus ${s} m, f/${N}${blades ? ` (${blades} blades)` : ''}`, expected, measured, 0.06, 'px', t0, `centroid ${m.cx.toFixed(1)},${m.cy.toFixed(1)}`))
  }
  return out
}

/** Field of view: two points at +-15 deg land at +-f*tan(15)/pitch. */
export async function testFOV(photo: PhotoRenderer): Promise<TestResult[]> {
  const out: TestResult[] = []
  for (const [f, fmt] of [[50, { width: 36, height: 24 }], [28, { width: 56, height: 56 }]] as [number, { width: number; height: number }][]) {
    const t0 = performance.now()
    const scene = new THREE.Scene()
    const th = (15 * Math.PI) / 180
    for (const sgn of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), emissive(1e4))
      p.position.set(Math.sin(th) * 200 * sgn, 0, -Math.cos(th) * 200)
      scene.add(p)
    }
    const r = await shoot(photo, scene, { focalLength: f, format: fmt, fNumber: 8, focusDistance: Infinity, shutterType: 'leaf', leafRamp: 0 }, { samples: 4, longEdge: 1024 })
    const pitch = fmt.width / r.width
    const left = moments(r, 0, 0, r.width / 2, r.height)
    const right = moments(r, r.width / 2, 0, r.width, r.height)
    const expected = (2 * f * Math.tan(th)) / pitch
    out.push(result(`FOV: ${f} mm on ${fmt.width}x${fmt.height}, +-15 deg separation`, expected, right.cx - left.cx, 0.005, 'px', t0))
  }
  return out
}

/** Focal-plane skew: a vertical bar moving at v is sheared by v*Tc across the frame (Lartigue lean). */
export async function testSkew(photo: PhotoRenderer): Promise<TestResult[]> {
  const out: TestResult[] = []
  const v = 20
  const dist = 5
  const scene = new THREE.Scene()
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 6, 0.02), emissive(5000))
  bar.position.z = -dist
  scene.add(bar)
  const setTime = (t: number) => {
    bar.position.x = -0.12 + v * t
  }
  for (const [type, Tc] of [['focal-plane', 0.012], ['leaf', 0]] as ['focal-plane' | 'leaf', number][]) {
    const t0 = performance.now()
    const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 8, focusDistance: dist, shutter: 1 / 4000, shutterType: type, curtainTravel: Tc, curtainDirection: 'up', leafRamp: 0 }
    const r = await shoot(photo, scene, spec, { samples: 16, longEdge: 1024, setTime })
    const o = computeOptics(resolveSpec({ ...CLEAN, ...spec } as DeepPartial<CameraSpec>))
    const pitch = 36 / r.width
    const scale = o.imageDistance / (dist * 1000) // film mm per scene mm
    // rows: top band (y ~ 10%) is exposed last with an upward curtain
    const top = moments(r, 0, Math.round(r.height * 0.08), r.width, Math.round(r.height * 0.12))
    const bot = moments(r, 0, Math.round(r.height * 0.88), r.width, Math.round(r.height * 0.92))
    const frac = 0.8 // rows 0.1 .. 0.9 of the gate
    const expected = type === 'leaf' ? 0 : (v * 1000 * Tc * frac * scale) / pitch
    const measured = top.cx - bot.cx
    out.push({ ...result(`skew: ${type} at 1/4000, bar at ${v} m/s`, expected, measured, 0.04, 'px', t0), pass: type === 'leaf' ? Math.abs(measured) < 1 : Math.abs(measured - expected) < 0.04 * expected })
  }
  return out
}

/** Motion blur length: FWHM of a moving bar ~ v*t (film) when v*t > bar width. */
export async function testMotion(photo: PhotoRenderer): Promise<TestResult[]> {
  const t0 = performance.now()
  const v = 2
  const dist = 5
  const scene = new THREE.Scene()
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.01, 6, 0.01), emissive(5000))
  bar.position.z = -dist
  scene.add(bar)
  const spec: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: 8, focusDistance: dist, shutter: 1 / 30, shutterType: 'leaf', leafRamp: 0 }
  const r = await shoot(photo, scene, spec, { samples: 64, longEdge: 1024, setTime: (t) => (bar.position.x = -v / 60 + v * t) })
  const o = computeOptics(resolveSpec({ ...CLEAN, ...spec } as DeepPartial<CameraSpec>))
  const pitch = 36 / r.width
  const expected = (v * (1 / 30) * 1000 * (o.imageDistance / (dist * 1000))) / pitch
  // FWHM along the middle row band
  const yMid = Math.round(r.height / 2)
  const prof = new Float32Array(r.width)
  for (let y = yMid - 5; y <= yMid + 5; y++) for (let x = 0; x < r.width; x++) prof[x] += lum(r.latent!, y * r.width + x)
  let mx = 0
  for (const p of prof) mx = Math.max(mx, p)
  let first = -1
  let last = -1
  for (let x = 0; x < r.width; x++) if (prof[x] >= mx / 2) {
    if (first < 0) first = x
    last = x
  }
  return [result('motion blur: bar 2 m/s at 5 m, 1/30 s (FWHM)', expected, last - first + 1, 0.08, 'px', t0)]
}

/** Flash: GN exposure, X-sync band, and double exposure additivity. */
export async function testFlash(photo: PhotoRenderer): Promise<TestResult[]> {
  const out: TestResult[] = []
  const t0 = performance.now()
  const scene = new THREE.Scene()
  const card = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.18, 0.18, 0.18) }))
  card.position.z = -3
  scene.add(card)
  const flash = new THREE.PointLight(0xffffff, 0, 0, 2)
  scene.add(flash)
  const GN = 24
  const tau = 1 / 1000
  const I = (2.006 * GN * GN) / tau
  const ps = {
    scene,
    setFlash: (on: boolean, eye: { position: THREE.Vector3 }) => {
      flash.position.copy(eye.position)
      flash.intensity = on ? I : 0
    },
  }
  const base: DeepPartial<CameraSpec> = { focalLength: 50, fNumber: GN / 3, maxAperture: 2, focusDistance: 3, iso: 100 }
  const full = (o: DeepPartial<CameraSpec>) => resolveSpec({ ...CLEAN, ...base, ...o, lens: { ...CLEAN.lens }, film: { ...CLEAN.film } } as DeepPartial<CameraSpec>)
  const cap = (o: DeepPartial<CameraSpec>, extra: Record<string, unknown> = {}) =>
    photo.capture(ps, full(o), { pose: lookForward, samples: 16, longEdge: 512, sliceMs: Infinity, grain: false, flare: false, seed: 3, flash: { duration: tau }, ...extra })
  // 1) GN rule at 1/60 (slower than X-sync): mid-grey at 3 m, f/8 -> X ~ (pi/4 T / q)(...) i.e. the GN calibration
  const spec60 = full({ shutter: 1 / 60, shutterType: 'focal-plane', curtainTravel: 0.012 })
  const o = computeOptics(spec60)
  const L = (0.18 * I) / (3 * 3 * Math.PI) // cd/m^2 at the card centre during the pulse
  const expected = L * xPerNit(spec60, o, tau)
  const r60 = await cap({ shutter: 1 / 60, shutterType: 'focal-plane', curtainTravel: 0.012 })
  out.push(result('flash: GN 24 at 3 m, f/8, 1/60 (centre X)', expected, boxMean(r60, r60.width / 2, r60.height / 2, 3), 0.03, 'X', t0, 'about 1.07: the GN rule matches the meter rule'))
  // 2) above X-sync: 1/1000 with a 12 ms vertical slit -> only a band of rows sees the pulse
  const t1 = performance.now()
  const r1k = await cap({ shutter: 1 / 1000, shutterType: 'focal-plane', curtainTravel: 0.012, curtainDirection: 'up' })
  let lit = 0
  const xc = Math.round(r1k.width / 2)
  for (let y = 0; y < r1k.height; y++) if (lum(r1k.latent!, y * r1k.width + xc) > expected * 0.25) lit++
  // row a (0 = bottom, slit moving up) catches overlap([a*Tc, a*Tc + t], [tf, tf + d]) / d of the pulse, tf = Tc
  let litExp = 0
  for (let y = 0; y < r1k.height; y++) {
    const aRow = 1 - (y + 0.5) / r1k.height
    const ov = Math.max(0, Math.min(0.012 + tau, aRow * 0.012 + 1 / 1000) - Math.max(0.012, aRow * 0.012)) / tau
    if (ov > 0.25) litExp++
  }
  out.push(result('flash above X-sync: lit band fraction (1/1000, 12 ms slit)', litExp / r1k.height, lit / r1k.height, 0.05, 'frame', t1, 'the classic black band'))
  // 3) leaf shutter syncs at any speed: whole frame lit at 1/500
  const t2 = performance.now()
  const rl = await cap({ shutter: 1 / 500, shutterType: 'leaf', leafRamp: 0.001 })
  // a point flash on a flat card falls off as cos^3 (inverse square x incidence); the lens adds nothing here
  const pitchL = 36 / rl.width
  const tanC = Math.hypot((rl.width / 2 - 4.5) * pitchL, (rl.height / 2 - 4.5) * pitchL) / computeOptics(full({ shutter: 1 / 500 })).imageDistance
  const cos3 = Math.pow(1 / (1 + tanC * tanC), 1.5)
  out.push(result('flash with leaf at 1/500: corner/centre = cos^3 (whole frame lit)', cos3, boxMean(rl, 4, 4, 2) / boxMean(rl, rl.width / 2, rl.height / 2, 2), 0.03, 'ratio', t2))
  // 4) double exposure: two flash shots on one frame = 2x
  const t3 = performance.now()
  const a = await cap({ shutter: 1 / 60, shutterType: 'focal-plane' }, { keepPreGrain: true })
  const b = await cap({ shutter: 1 / 60, shutterType: 'focal-plane' }, { baseTarget: a.preGrainTarget!, keepPreGrain: false })
  a.preGrainTarget?.dispose()
  out.push(result('double exposure: X(a+b) / X(a)', 2, boxMean(b, b.width / 2, b.height / 2, 3) / boxMean(a, a.width / 2, a.height / 2, 3), 0.01, 'ratio', t3))
  card.geometry.dispose()
  return out
}

export async function runAll(photo: PhotoRenderer): Promise<TestResult[]> {
  const all: TestResult[] = []
  for (const t of [testCalibration, testFOV, testCoC, testSkew, testMotion, testFlash]) all.push(...(await t(photo)))
  return all
}
