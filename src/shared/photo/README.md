# @shared/photo

The physically motivated still-photo renderer for Lens Bench and Sunny 16 (three.js, WebGL2). Ported from `spikes/photo-render/core` with the additions of `docs/architecture.md` §4.10. Never imported by the hub or by games that do not take photographs: it pulls in three.

```ts
import { PhotoRenderer, resolveSpec, develop, type PhotoSpec } from '@shared/photo'

const photo = new PhotoRenderer(renderer)                     // shares the game's WebGLRenderer
await photo.warmup(photoScene)                                // compile everything behind the loader
const shot = await photo.capture(photoScene, spec, {          // PhotoScene: { scene, setTime?, setFlash? }
  pose: camera, samples: 32, longEdge: 1024, radianceScale: 1000, tilt: { deg: 4 },
})
shot.latent        // Float32Array RGBA, TOP row first, X units (1 = what the meter promised a mid grey)
shot.meta          // optics, exposure (hPerUnit = lux·s per X), sampling, timing, stats
```

## Exports

Everything the spike's `core/index.ts` exported, with the same names and signatures: `CameraSpec` (also exported as **`PhotoSpec`**; game code uses `PhotoSpec`), `FORMATS`, `defaultSpec`, `resolveSpec`, `computeOptics`, `blurCircleMm`, `luminanceToEV100`, `ev100ToLuminance`, `hPerUnit`, `xPerNit`, `reciprocityFactor`, `meteredShutter`, `METER_K`, `EXPOSURE_Q`, `formatShutter`, `formatFNumber`, `formatDistance`, the sampling helpers and `planShutter`, the film/LUT develop helpers (`develop`, `buildPrintLUT`, curves), `MotionRecorder`, `PhotoRenderer`, `latentStats`, and the types `PhotoScene`, `SubFrameInfo`, `CameraPose`, `CaptureOptions`, `CaptureProgress`, `CaptureResult`, `CaptureMeta`, `LatentStats`, `PhotoCaps`. Additions (all additive; nothing the spike offered changed):

| | |
|---|---|
| `CaptureOptions.radianceScale` | cd/m² per rendered unit (1 or 1000). Applies to the scene, the glare probe, emitters and flash. |
| `CaptureOptions.tilt: { deg }` | Front-standard tilt about camera x (Scheimpflug). The plane of sharp focus contains the hinge at `f / sin α` below the lens and the point `focusDistance` along the axis. Implemented with the rank-1 projection update `M_a = M0 - (M0 a) πᵀ / (πᵀ a)` on the x, y and w rows; the depth row stays the central camera's so depth testing stays monotonic (a literal full update collapses depth to a constant). The pupil lies on the tilted lens plane. The depth-aware pre-blur uses the per-pixel focus-plane distance. `0` (default) is the ordinary sheared-frustum path, bit-identical to the spike. |
| `CaptureOptions.shutterProfile: ShutterProfile` | `{ span, open(u, v, tRel, dt) }`: fraction of each time bin a print pixel (`u` left to right, `v` top to bottom) is open. Evaluated on a 64 x 64 grid per sub-frame, so edges are about 1/64 of the frame soft. Overrides `shutterType` timing. |
| `CaptureOptions.spectral` | 3 x 3 matrix, rendered RGB to film channels. Default identity for colour film, pan weights (0.30, 0.59, 0.11) for `film.color: false`. Also applied to the glare probe. |
| `CaptureOptions.layers` | camera layer mask (default `1`: layer 0 only). |
| `CaptureOptions.emitters(time, out) => count` | Analytic point sources (`PhotoEmitter { x, y, z, rgb }`, luminous intensity in scene units). Each is drawn once per sub-frame straight into the accumulator as a disc in the **shape of the aperture** (polygon, rounded blades or the drawn mask), sized to the point's blur circle, with the energy `I (v/d)²`: conserved at any defocus. Fill `out[i] = {...}` and return how many. Minimum disc radius 1.5 output pixels. |
| `PhotoRenderer.begin(scene, spec, opts): Exposure` | Incremental exposure: `addSample({ time, tRel, pose?, weightS? })` renders one sub-frame through the next pupil point, `drawGhost(target?, viewport?, opacity?)` shows the accumulation so far at low opacity over the live finder (unexposed areas transparent), `finish({ readback? })` develops and returns the same `CaptureResult`, `abort()` releases the renderer. `samples`, `exposedSeconds` are live. Treated as a box shutter that is open for the sum of `weightS` (curtain/leaf timing, flash and `shutterProfile` do not apply); reciprocity uses the total. Sub-frame `k` uses exactly the pupil point, jitter and random pair that `capture({ samples: N, order: 'chronological' })` uses, so 30 `addSample` calls match `capture(30)` (self-test: pixel for pixel to 0.0%). More than `expectedSamples` calls are fine (the plan extends). |
| `PhotoRenderer.caps` | `PhotoCaps` (already a property in the spike). |
| `encodeLog2 / decodeLog2 / bytesToPNG / pngToBytes` | Studio's LogH8 latent: 8-bit log2 with a fixed 4 x 4 Bayer dither, 1 or 3 channels (1 packs into R), lossless PNG via `OffscreenCanvas` or a canvas, colour management off so bytes round-trip exactly. |
| `FinderPreview(renderer, { longEdge, taps, maxCocPx })` | `render(scene, camera, spec, o?)`: one scene render to a float target, a depth-based circle-of-confusion gather (8 to 16 taps, interleaved-gradient rotated, near-field halo and soft near edges), a filmic tonemap, written to `o.target` (default the canvas) at `o.viewport`. `meterEV100()` is a centre-weighted reading refreshed every 250 ms (the first reading is synchronous). `exposureEV100` defaults to the spec's own aperture, shutter and ISO. |
| `photoSpecFromProfile(p: LensProfile, base?)` | Type-only bridge from `@shared/optics`: EFL, N, pupil mask to aperture mask, distortion k1/k2, lateral and longitudinal CA, Petzval to field curvature, swirl to astigmatism, the cat's-eye offsets (fitted slope) to `vignetting`, transmission, veiling glare, ghosts, SA blur to glow. |
| `selftest(opts?): Promise<Check[]>` | See below. Needs WebGL2; builds an offscreen renderer if none is passed. |

## Deviations from the spike

- `seed` defaults to 1 instead of `Math.random()` (architecture §3.3: no `Math.random` in render paths). Pass a seed per shot for different grain.
- Internally `capture()` is now `prepare()` (everything up to the first sub-frame, returning closures) plus a driver loop plus `finalize()`; `begin()` drives the same closures one sub-frame at a time. Output of `capture()` without the new options is unchanged (all 21 spike checks pass at the same numbers).
- `sampling.ts` gained `orderSubframes` (the ordering step of `planShutter`, now shared with the shutter-profile plan).
- Imports inside this folder keep `.ts` extensions (the root tsconfig allows them).

## Performance

Measured on the headless test tier (SwiftShader, software): a 448 px capture of the fountain yard at 6 samples takes 0.5 to 1.2 s; the whole self-test (about 90 captures at 192 to 768 px) takes a few minutes. Desktop and phone numbers are the spike's (its NOTES.md): 24 samples, 1024 px, leaf shutter 0.4 to 0.8 s on an RX 580; focal-plane 1/250 about 0.4 s with `shadowEvery: 4`; roughly 3 to 4 x slower on a throttled phone-class CPU. The added code costs: tilt is one 4 x 4 matrix update per sub-frame; a shutter profile uploads a 4 KB texture per sub-frame; each emitter is one scissored draw per sub-frame; the finder is one scene render and one gather pass.

## Tests

```
node scripts/shoot.mjs "/src/shared/photo/dev/index.html?test=1" --timeout 580000 \
  --eval "__game.selftest(['calibration','geometry']).then(r=>JSON.stringify(r))"
node scripts/shoot.mjs /src/shared/photo/dev/ --timeout 300000 --size 1500x1100 --full \
  --eval "__game.demo('all').then(r=>JSON.stringify(r))" --out shots/photo/dev-all.png
```

Groups: `calibration` (grey card at Sunny 16, cos⁴, linearity, leaf efficiency, mechanical vignetting, row banding), `geometry` (blur discs, FOV), `motion` (curtain skew, leaf no-skew, motion blur), `flash` (GN rule, X-sync band, cos³, double exposure), `determinism` (same seed gives the same latent hash), `additions` (radianceScale, tilt, shutter profile, spectral and layers, emitters, incremental exposure, log2 and PNG round trips), `finder`, `bridge` (builds a `portrait` lens profile from `@shared/optics`). 49 checks, all passing in headless Chromium. Demos: `fountain-fast`, `fountain-slow`, `bokeh-heart` (spheres, then analytic emitters), `windmill`, `tilt`, `incremental`, plus `__game.finder()`.

## Known limits

- **`smoothBokeh` is not energy-conserving at large defocus.** The depth-aware pre-blur (inherited from the spike) drops about 15% of the energy of a small bright object at a 12 px blur disc (self-test: sphere through the pre-blur against the exact emitter). The exact route is `smoothBokeh: false` with 128+ samples, or `emitters` for point sources.
- **Float fallbacks.** RGBA16F accumulation and the half-float scene target are in (one `console.warn`). The RGBA8 single-sample path for devices with no renderable float or half-float format is **not implemented**.
- **`shutterProfile` is normalised per image.** Like the focal-plane path, the ratio estimator assumes every pixel receives the same total open time (the profile's mean). Spatially varying total exposure (a vignetting blade) is not reproduced.
- Emitters have no cat's-eye clipping; very small blur circles are clamped to 1.5 px.
- The finder's gather is a preview: it does not reproduce bokeh shape, and the highlights of small bright lights are not energy-weighted.
- The tilt path assumes `focusDistance` is finite (an infinite focus distance silently uses the ordinary path).
