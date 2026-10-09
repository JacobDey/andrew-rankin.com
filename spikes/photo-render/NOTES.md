# photo-render spike: NOTES

A physically motivated still-photo renderer for three.js (WebGL2). You give it a camera spec and a
scene that can be posed at any instant. It returns a calibrated float **latent image** in which depth
of field, motion blur, focal-plane skew, leaf-shutter efficiency, flash sync, vignetting, distortion,
colour fringing, flare and grain each come from one mechanism with real units. 19 of 19
quantitative checks against closed-form optics pass.

- Demo: `http://127.0.0.1:5173/spikes/photo-render/`. It is a live viewfinder of a calibrated back
  yard with every parameter on a slider. **Take photo** (or Space) renders progressively in the
  viewfinder (a red shutter lamp shows while the "curtain" fills), then shows the developed print.
  Preset standpoints: Yard, Bendy pinwheel, Test chart, Dusk bokeh, Into the sun, Panning the car,
  Lartigue.
- Core: `spikes/photo-render/core/`. It is pure TS plus three, with no DOM in the core. Copy the
  folder to `src/shared/photo/` as-is.

## Files

| File | What |
|---|---|
| `core/spec.ts` | `CameraSpec` types, defaults, `FORMATS`, closed-form optics (FOV with focus breathing, bellows, CoC, DOF, hyperfocal, EV, Airy), exposure calibration, distortion math, formatters. No three.js. |
| `core/sampling.ts` | R2/Halton sequences, aperture sampling (blades, curvature, drawn masks, equal-area scaling), the **shutter plan** (sub-frame times, pupil points, weights, slit bands, render order), the **flash plan**. No three.js. |
| `core/PhotoRenderer.ts` | The GPU pipeline: `capture()`, `warmup()`, `drawPreview()`, `drawPrint()`, `dispose()`, `PhotoRenderer.detect()`, `PhotoRenderer.outputSize()`. |
| `core/shaders.ts` | GLSL: accumulate, resolve, Airy blur, flare chain, glare-probe veil, composite (veil, glow, ghosts, stars, base exposure, grain), preview, print. |
| `core/film.ts` | A stand-in development step: latent through a negative H&D curve and a paper curve to sRGB (CPU LUT, about 6 ns/px; the same LUT drives `drawPrint` on the GPU), plus negative and zone views. |
| `core/motion.ts` | `MotionRecorder` lets a physics world be posed at any instant inside an exposure. |
| `demo/yard.ts` | The calibrated yard: a clear-sky sun model in lux, a sky dome in cd/m², PMREM sky IBL, fence, fairy lights, trees, shed, pinwheel, physics ball, toy car, gazing ball, test chart and a hot-shoe flash. |
| `demo/tests.ts` | Quantitative checks (`__spike.tests.*`). |
| `demo/diag.ts` | The bokeh-field diagnostic (point grid on black: blade shape, cat's-eye, swirl and fringes at a glance). |
| `main.ts`, `demo/ui.ts`, `demo/style.css` | The demo page (desktop and phone layout, mouse and touch). |

## Core API

```ts
import { PhotoRenderer, resolveSpec, computeOptics, develop, MotionRecorder } from './core/index.ts'

const photo = new PhotoRenderer(renderer)            // shares the game's WebGLRenderer
await photo.warmup(photoScene)                       // compile all programs at load (first capture is otherwise ~0.4 s slower)

const shot = await photo.capture(photoScene, spec /* CameraSpec | DeepPartial */, {
  pose: camera,                 // Object3D (world transform) | { position, quaternion }
  poseAt?: (tRel) => pose,      // moving camera: pans, hand shake (tRel = s after the shutter starts)
  time0?: number,               // scene time at shutter press
  samples?: 32,                 // sub-frames per pixel: THE quality knob (64 desktop / 24 phone / 4 tests)
  longEdge?: 1024,              // output px
  maxRenders?: samples * 6,     // focal-plane only: cap on scissored renders
  sliceMs?: 10,                 // CPU work per animation frame (Infinity = synchronous)
  order?: 'blocked',            // | 'progressive' | 'chronological'
  smoothBokeh?: true, smoothStrength?: 1,
  shadowEvery?: 1,              // re-render shadow maps every n sub-frames (4 is a good game default)
  flash?: { time?, duration?: 1/1000, samples?: 16 },   // needs PhotoScene.setFlash
  baseTarget?, keepPreGrain?,   // multiple exposures: expose on top of a previous pre-grain latent
  grain?: true, flare?: true, glareProbe?: true, glareFalloffDeg?: 10,
  readback?: true, keepTarget?: false,
  seed?, signal?: AbortSignal, onProgress?: (p) => void, near?: 0.05, far?: 5000,
})
// shot: { latent: Float32Array RGBA (TOP row first, X units) | null, width, height,
//         target | null (keepTarget), preGrainTarget | null (keepPreGrain), meta }
// meta.exposure.hPerUnit = lux*s per X.  meta.stats = mean/median/p01/p99/max X.  meta.optics, meta.timing,
// meta.sampling, meta.caps

photo.drawPreview(target | null, viewport?)                       // progressive preview while capture() runs
photo.drawPrint(target | null, viewport?, { film, paper, printStops, mono })  // GPU print of the last shot, no readback
const rgba8 = develop(shot.latent!, shot.width, shot.height, { film, paper, printStops, mode: 'positive' | 'negative' | 'zones' })
PhotoRenderer.outputSize(format, longEdge)                        // to match a baseTarget
```

```ts
interface PhotoScene {
  scene: THREE.Scene
  setTime?(time: number, info: SubFrameInfo): void   // pose everything at an absolute time; deterministic + cheap
  setFlash?(on: boolean, eye: CameraPose): void      // on: render ONLY flash-lit radiance (ambient off), flash at eye
}
interface CameraSpec {   // core/spec.ts has every field with units; resolveSpec(partial) fills defaults
  format: { width, height }                 // mm
  focalLength, fNumber, maxAperture         // mm, N, widest N
  focusDistance                             // m (Infinity ok)
  shutter, iso                              // s, ISO
  shutterType: 'leaf' | 'focal-plane'       // focal-plane with long travel = phone rolling shutter / slit-scan
  curtainTravel, curtainDirection           // s, 'up'|'down'|'left'|'right' across the upright print
  leafRamp                                  // s, blade opening ramp
  aperture: { blades, rotation, curvature, mask? }   // mask = drawn Waterhouse stop (heart bokeh)
  lens: { transmittance, vignetting, naturalVignetting, distortionK1, distortionK2, lateralCA,
          longitudinalCA, fieldCurvature, astigmatism, veilingGlare, ghosts, glow, diffraction, starStrength }
  film: { grainSize (um), granularity, color, reciprocityP }
}
```

Pure helpers include `computeOptics(spec)`, `blurCircleMm(spec, d)`, `luminanceToEV100(L)`,
`meteredShutter(spec, L)`, `xPerNit(spec, optics, t)`, `hPerUnit(iso)`, `planShutter`, `planFlash`,
`xSyncTime`, `sampleAperture`, `formatShutter`, `formatFNumber` and `formatDistance`.

## Calibration (shared contract for every game)

- **Scene radiance is in cd/m².** This lines up with three.js physical light units:
  `DirectionalLight.intensity` is lux, `PointLight` is candela, `HemisphereLight` is horizontal
  lux, and a `MeshBasicMaterial` colour is cd/m² (`setRGB`, above 1 is fine). A Lambertian albedo ρ
  under E lux renders as ρE/π.
- Meter: EV₁₀₀ = log₂(L·100/12.5). A sunlit 18% card under 69.8 klx gives L = 4000 cd/m² and
  EV 14.97, so sunny-16 holds.
- Film plane on axis: H = (π/4)·T·L·t_eff/N_w² lux·s, where N_w = N·v/f (bellows) and T is
  transmittance.
- **Latent unit X = H/H_m**, with H_m = q·K/S (ISO 2720, q = 0.65). X = 1 is "what the meter
  promised a mid-grey". On axis a metered grey reads 1.07 (q includes some falloff). For chemistry,
  `H = X * meta.exposure.hPerUnit`.
- Flash guide number: I·τ = 2.006·GN² cd·s (GN in m at ISO 100) puts a mid-grey at d m to
  X ≈ 1 at f/(GN/d).
- Reciprocity: Schwarzschild t^(p−1) for t > 1 s (p = 0.85 by default).
- The demo sun uses Kasten-Young air mass with per-channel extinction (about 91 klx direct and
  12 klx sky at 38°; it reddens near the horizon). The sun disc carries its true radiance of about
  1e9 cd/m², which is why scene targets are RGBA32F: flare, ghosts and stars come out at
  physically sized strength.

## Pipeline (one loop gives most effects)

For each sub-frame k of the **shutter plan**:

1. `setTime(time0 + t_k)` poses the world. `poseAt(t_k)` plus the pupil point p_k gives the eye.
2. **Thin-lens accumulation**: a sheared (off-axis) frustum keeps the focus plane fixed while the eye
   moves over the pupil. A sub-pixel jitter adds AA. FOV comes from the image distance
   v = 1/(1/f − 1/s), so lenses breathe and bellows extension is real.
3. Render radiance to RGBA32F. With a focal-plane shutter the render is **scissored to the band of
   rows the slit reaches in this time bin**.
4. **Accumulate pass** (ONE/ONE). Row weight = overlap(bin, [a·T_c, a·T_c + t])/Δ, which is exact
   time integration for a constant-speed slit. The barrel rim decides which pupil samples reach the
   pixel (cat's-eye). Field curvature, astigmatism and longitudinal CA become a per-pixel,
   per-channel warp proportional to the pupil offset (e·Δφ·v), giving swirl and colour bokeh. A
   depth-aware Gaussian pre-blur with σ about half the pupil-sample spacing (≈ CoC/√N) fills the
   gaps between pupil samples.
5. RGB holds Σ X·w and A holds Σ w (rim-pass included). **Ratio estimator**: X = RGB/A, then times
   the analytic rim fraction in the resolve pass. Exposure is therefore exact at any sample count,
   and few samples per row cannot cause brightness banding.

- **Leaf shutter**: blades open linearly in radius over `leafRamp`, so a pupil point at relative
  radius q is open during [qT, t + T − qT]. Each pupil sample's instant is importance-sampled inside
  its own window, and `effectiveTime` is a dense 4096-point pupil integral, so leaf efficiency is
  exact.
- **Flash**: extra sub-frames at the sync instant (scene frozen, flash-lit only, 16 pupil samples).
  They add energy to RGB but nothing to A, scaled by xPerNit(pulse)·(expected final A)/n. A
  focal-plane row only gets the part of the pulse its slit overlapped (the black band above X-sync);
  a leaf syncs at any speed. Front sync by default, rear by `time`.
- **Multiple exposure**: the composite adds a previous pre-grain latent before grain, because
  exposures add on film.

Post at output resolution:

1. Resolve: inverse Brown-Conrady distortion (Newton), lateral CA (per-channel radial scale), cos⁴,
   rim fraction.
2. Airy blur: σ = 0.42λN_w per channel, so small sensors at f/22 really soften.
3. Flare: veiling glare is a fraction of the frame mean plus a **wide glare probe**. That is one
   384-px pinhole render covering 3× the field, so a sun just outside the frame still veils the
   image (angular falloff) and throws ghosts into it. Glow is a heavy-tailed PSF from a 13-tap
   down / tent up chain, scaled by (N_min/N)² for spherical aberration. Ghosts are six mirrored
   images through the axis at magnification m, with energy ∝ 1/m². Stars run along the blade-edge
   normals: n rays for even blade counts, 2n for odd.
4. Grain: log-normal in exposure, with Selwyn σ_D = G(ISO)/max(pitch, grain) and
   G = 0.43 µm·√(ISO/100). It uses clumped value noise at the grain size, partly independent dye
   layers for colour, and is weighted by negative density. Big formats look finer at the same ISO.
5. Read back to a Float32Array, or skip that and use `drawPrint`.

## Measured correctness (`__spike.tests.all()`: 19/19 pass on the RX 580, about 2 s total)

| Check | Expected | Measured |
|---|---|---|
| Grey card at sunny-16 (f/16, 1/125, ISO 100, 4000 cd/m²) | X 1.0658 | **1.0654** |
| cos⁴ corner/centre (50 mm on 35 mm) | 0.714 | 0.719 |
| Linearity, 1/125 vs 1/250 | 2.000 | 2.000 |
| Leaf efficiency at 1/500, ramp 1.5 ms, f/2 (wide open) | 0.750 | 0.7501 |
| Leaf efficiency at 1/500, f/16 | 1.625 | 1.625 |
| Leaf image X ratio, f/16 vs f/2 | 0.0338 | 0.0338 |
| Mechanical vignetting (equal-circle lens area), corner | 0.628 | 0.641 |
| Row banding, focal-plane 1/2000 with vignetting (high-passed row CV) | 0 | 0.0006 |
| FOV: ±15° points, 50 mm on 36×24 | 762.17 px | 762.32 px |
| FOV: ±15° points, 28 mm on 6×6 | 274.38 px | 274.50 px |
| DOF blur disc: point at 1 m, focus 4 m, f/1.4, 50 mm | 38.58 px | 38.90 px (38.65 without pre-blur) |
| DOF blur disc: point at 8 m, focus 2 m, f/2, 6 blades | 13.68 px | 14.15 px (13.94 without pre-blur) |
| Focal-plane skew: bar at 20 m/s, 1/4000, 12 ms travel | 55.17 px | 55.12 px |
| Leaf skew under the same conditions | 0 | 0 |
| Motion blur FWHM: bar at 2 m/s, 5 m, 1/30 | 19.15 px | 18 (pixel quantised) |
| Flash GN 24 at 3 m, f/8, 1/60 | X 0.9669 | 0.9668 |
| Flash above X-sync: lit band (1/1000, 12 ms slit) | 0.0616 | 0.0616 |
| Flash with leaf at 1/500: corner/centre = cos³ (whole frame lit) | 0.7865 | 0.7862 |
| Double exposure, X(a+b)/X(a) | 2.000 | 2.000 |

Visually verified (`shots/spike-photo-render-*.png`):

- banana pinwheel blades from the slit (`pinwheel`)
- Lartigue lean: a sheared car with elliptical wheels (`lartigue`)
- a panned car against a streaked yard (`pan`)
- into-the-sun 6-ray star with ghosts and glow (`sun`)
- the sun just out of frame veiling the image (`offsun-*`)
- barrel distortion, vignetting and lateral CA on the chart (`zoom`, `zoom-corner`)
- Petzval swirl and cat's-eyes in the bokeh-field diagnostic (`diag-*`)
- dusk fairy-light bokeh (`bokeh-*`)
- dusk fill flash at 1/60 vs the black band at 1/1000 (`flash-*`)
- the curtain-sweep progressive preview (`progress`), the zones view (`zones`), the GPU print
  (`gpuprint`), the phone layout plus tap-to-focus (`mobile*`), and the full control panel
  (`panel-*`)

## Performance

| Where | Case | Wall time |
|---|---|---|
| SwiftShader (headless) | 32 renders, 768 px, yard | 4.5 s |
| SwiftShader | 96 renders, 1280 px, yard | 18 s |
| **RX 580 (D3D11, `--gpu`)** | 24 spp, focal-plane 1/250, 1024 px (96 renders, shadowEvery 4) | **0.4 s** |
| RX 580 | 24 spp leaf, 1024 px, time-sliced at 12 ms | 0.56 to 0.79 s |
| RX 580 | 64 spp leaf, 1536 px | 1.0 s |
| RX 580 | 64 spp focal-plane 1/250, 1536 px (256 renders) | 1.2 to 1.6 s |
| RX 580 | 64 leaf sub-frames at 1024, synchronous | 443 to 700 ms with a shadow refresh every sub-frame, **147 ms CPU / 255 ms wall without** |
| RX 580 + **4× CPU throttle** (phone-CPU proxy) | 24 spp leaf, 1024 | 0.8 to 1.6 s |
| ″ | 24 spp focal-plane, 1024 (96 renders) | 1.7 s |
| ″ | 64 spp focal-plane, 1536 (256 renders) | 4.5 s |
| RX 580 | First capture, shader compile | +0.4 s (use `warmup()`) |

- Per sub-frame in the yard (about 60 draw calls plus a 2048² shadow map): about 2.3 ms without
  the shadow pass and about 7 ms with it. **The shadow pass is about two thirds of the cost.**
  `shadowEvery: 4` with the 'blocked' order (time-coherent blocks) looks identical in the yard.
- Focal-plane renders are scissored, so fill cost is small, but each still pays the full three.js
  CPU submission. Fast speeds with long travel are therefore CPU-bound.
- Post (resolve, Airy, flare chain, probe, composite) takes about 5 to 10 ms. Readback of a
  1536-px RGBA32F image takes 0.1 to 0.2 s (0.6 s in SwiftShader), and `drawPrint` avoids it.
- **Mid-range phone estimate** (Adreno 640 / Mali-G76; three.js CPU about 3 to 4× slower, fill
  about 6 to 8× slower than the RX 580): 24 spp leaf at 1024 px with `shadowEvery: 4` takes about
  0.6 to 1.2 s; focal-plane 1/250 (96 renders) takes about 2 to 3 s; 64 spp at 1536 takes 5 s or
  more (desktop only). That is acceptable behind the "tank agitation" or "shutter lamp" beat in the
  design docs. Render-target memory is about 50 MB at 1024×683 (scene RGBA32F + depth, accumulator,
  2× RGBA16F post, RGBA32F out, small chain) and about 105 MB at 1536.

**Quality knobs (cheapest first):** `samples` (linear), `longEdge` (fill), `shadowEvery`,
`maxRenders` (focal-plane CPU), `smoothBokeh` (12 taps per pixel per sub-frame; worth it below
about 64 spp), `flare` and `glareProbe` (one chain plus one 384-px render; cheap), `grain` (cheap),
and the lens warp (field curvature or longitudinal CA turns 1 fetch into 3, times taps).

Presets:

- phone: 24 spp, 1024 px, `shadowEvery: 4`, `maxRenders: 6×`
- desktop: 64 spp, 1536 px, `shadowEvery: 2`, `maxRenders: 8×`
- tests: 4 spp, 512 px

## Gotchas found

1. **Thin slits starve rows of pupil samples.** At 1/2000 with 12 ms travel, row a only sees bins
   inside its 0.5 ms window, giving R·t/span + 1 samples. Fixes that are in: the ratio estimator,
   the analytic rim fraction (no banding), R2-ordered pupil points (any contiguous run is well
   spread), and a pre-blur scaled by the per-row count. Defocused areas are still noisier in that
   regime. Raising `maxRenders` is the real fix and it is CPU-bound. Do **not** coarsen time bins
   beyond the slit time to buy pupil samples: fast movers turn into stepped double images.
2. **Accumulation DOF leaves N copies of small bright things.** The Gaussian pre-blur fixes normal
   content. Blown highlights (fairy lights at 9 EV over, swirl-stretched discs) keep slightly
   speckled rims below about 128 spp.
3. **Leaf Monte Carlo noise.** Coupling time bins to pupil points gave ±10% exposure noise at 64
   samples. It is fixed by importance-sampling time inside each pupil point's open window plus a
   dense effective-time integral.
4. **Float precision.** The sun is about 1e9 cd/m², which overflows half floats. The scene target is
   RGBA32F (needs `EXT_color_buffer_float`). The accumulator is RGBA32F only with `EXT_float_blend`;
   otherwise it is RGBA16F prescaled by 1/(4·spp). Post targets are RGBA16F prescaled by 1/256. RGBA32F
   sampling uses manual bilinear when `OES_texture_float_linear` is missing (common on phones).
5. three.js applies tone mapping and output colour space only to the canvas, so render targets get
   linear radiance for free. A custom sky `ShaderMaterial` needs the `tonemapping_fragment` and
   `colorspace_fragment` includes to look right in the live view.
6. Render-target scissor is `rt.scissor` / `rt.scissorTest`, copied at `setRenderTarget`. Set it
   before binding.
7. **Never toggle `light.visible` or `scene.environment` between sub-frames**, because that changes
   shader programs (light counts and defines). Toggle `intensity` and `scene.environmentIntensity`
   instead (as the yard's flash does).
8. Mechanical-vignetting brightness must come from the analytic rim fraction; per-sample pass/fail
   only shapes bokeh.
9. A point flash on a flat wall falls off as cos³ (not a lens effect). The tests know this.
10. Dev-server dependency re-optimisation (`504 Outdated Optimize Dep`) reloads or breaks pages
    mid-test. The shared server wedged at about 14:48 (`node_modules/.vite/deps` missing,
    `deps_temp_*` stuck). From then on I verified with a production build of only this spike into
    the scratchpad, loaded over `file://` by a harness copy launched with
    `--allow-file-access-from-files` (same steps and eval API). That also proves the spike builds
    cleanly with Vite 8.

## Recommendations for the real implementation

- Lift `core/` into `src/shared/photo/` unchanged. Games own the `PhotoScene` (`setTime`,
  `setFlash`) and the UI.
- Lens Bench's ray tracer (`LensProfile`) should **drive `CameraSpec.lens` and `aperture.mask`**:
  k1/k2 from chief-ray heights, `lateralCA`, `longitudinalCA`, `fieldCurvature` (Petzval), the
  vignetting rim, the drawn stop as `mask`, and coating as `veilingGlare`/`ghosts`.
- **Physics worlds**: at shutter press, freeze the live loop, step Rapier forward through the span
  at a fixed dt with `MotionRecorder.record()`, render, then resume from the end state (the demo
  ball does exactly this). Analytic props pose directly in `setTime`.
- **Hand shake and panning** come through `poseAt` (the demo has pan °/s and an 8 to 13 Hz
  tremor). Lens Bench's damped-oscillator camera should simply supply `poseAt`.
- Hand the latent to darkroom/photochem as H = X·hPerUnit with `grain: false` if the chemistry adds
  grain in density space. `film.ts` is only a display stand-in.
- Double exposure ("forgot to wind on") = `keepPreGrain` + `baseTarget` (in the demo). A slit-scan
  back = focal-plane with seconds of `curtainTravel`, 'chronological' order and a high
  `maxRenders`.
- **To make phones comfortable**: merge static meshes (draw calls dominate CPU); use
  `shadowEvery: 4..8` or bake static shadows; keep `longEdge` ≤ 1024; call `warmup()` at load; show
  `drawPrint` immediately and read back lazily. For thin slits, consider per-band sub-frustum
  culling or an LOD scene for band renders.
- Possible upgrades: velocity-buffer motion pre-blur (removes strobing on fast long-exposure movers
  at low spp); aperture-shaped ghosts (sample the pupil mask); flash shadows (a cube shadow map
  costs 6 renders per flash sample, so maybe one shared map); an anisotropic pre-blur for
  swirl-stretched bokeh.
- The design docs' tag criteria ("CoC ≤ c at 2.5 m and ∞", "blade curvature ≥ 20°", "rider
  blur < 3 px", "≥ 6 star points") can all be computed from `meta.optics`, the plan and the latent,
  so no second render is needed.

## Test hooks (window.__spike)

`spec()`, `set(partialSpec)`, `scene({sunElevation, sunAzimuth, pinwheelRps, carSpeed, carPhase, ball, freeze})`,
`motion(panDegPerS, shakeDeg)`, `look(dYawDeg, dPitchDeg)`, `preset('yard'|'pinwheel'|'chart'|'bokeh'|'sun'|'car'|'lartigue')`,
`lens('modern'|'triplet'|'petzval'|'zoom'|'toy')`, `mask('heart'|'star'|'donut'|'slot'|'none')`,
`flash(on, gn, duration, 'front'|'rear')`, `multi(on)`,
`shoot({samples, longEdge, sliceMs, seed, smoothBokeh, grain, flare, glareProbe}) → summary`,
`diag('bokeh', {samples, longEdge, focus})`, `bench([{samples, longEdge, shutterType, shadowEvery}])`,
`view(mode, printStops)`, `inspect(on, [u0,v0,u1,v1])` (print fills the viewport for screenshots),
`gpuPrint(ms)`, `probe(u, v)` (latent X), `meter()`, `step(frames)`, `last()`,
`tests.{all, calibration, fov, coc, skew, motion, flash}()`, plus `photo`, `yard`, `camera`, `THREE`.

```
node scripts/shoot.mjs spikes/photo-render/ --gpu --timeout 300000 --steps '[{"eval":"window.__spike.tests.all().then(r=>JSON.stringify(r.map(x=>[x.name,x.pass,x.expected,x.measured])))"}]'
node scripts/shoot.mjs spikes/photo-render/ --gpu --steps '[{"eval":"window.__spike.preset(\"pinwheel\")"},{"eval":"window.__spike.shoot({samples:48,longEdge:1280})"},{"eval":"window.__spike.inspect(true)"}]' --out shots/x.png
```
