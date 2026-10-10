# Build report: shared-photochem-photo (done)

Both modules are written, type-check clean, and pass their self-tests in Node and headless Chromium. Games can import `@shared/photochem` and `@shared/photo` now.

**@shared/photochem** is the spike port with optimized loops, `simScale: 0.5`, the camera-game primitives and 114 self-test checks.
- Speed went from about 4 to 7 ms per develop step and 17 ms per render to the figures below.
- `simScale: 0.5` runs `SilverSheet` and `CyanoSheet` at half resolution.
- Added primitives: `mixSensitizer`, `peroxideBath`, `logisticDensity`, `x0ForMidGrey`, `devRateTemp`, `devAmount`, `selwynSigma`, `grainField`, `bromideDrag`, `halation`, `paperDensity`, `gradedPaperCurve`, `densityLUT`.
- The self-test is the spike's 72 checks plus the darkroom §5.11 targets that don't depend on tray flow, table-vs-exact parity, determinism and the new primitives.

**@shared/photo** is the spike port with the §4.10 additions: `radianceScale`, `tilt`, `shutterProfile`, `spectral`, `layers`, `emitters`, `begin()`/`Exposure`, `FinderPreview`, `encodeLog2`/`decodeLog2`/`bytesToPNG`/`pngToBytes`, `photoSpecFromProfile` and the `PhotoSpec` alias.
- `selftest()` is async and passes 49/49 in headless Chromium.
- It covers the spike's closed-form optics checks, determinism, and each addition.
- The §4.10 acceptance shots (fountain frozen and silk, heart-aperture bokeh, windmill, tilt, incremental) all render on the dev page.

Dev pages are at `/src/shared/photochem/dev/` and `/src/shared/photo/dev/`, and both folders have a README.md. Screenshots are under `shots/photochem/` and `shots/photo/`.

Not done: the RGBA8 single-sample float fallback in photo, and any speed-up of `FilmFrame.densities`/`render`/`printMask`. I did not write `docs/build/*.md` because docs/ is not mine; use this report.

## Works

- photochem: node src/shared/photochem/dev/run-selftest.ts gives 114/114 (spike 72 + darkroom §5.11 behaviours, table-vs-exact parity, simScale parity, determinism, camera primitives); same 114/114 in headless Chromium via __game.selftest(); __game.errors() empty
- photochem timings at 256x320 (min of runs, Node, loaded machine): SilverSheet.expose (masked) 1.4-1.8 ms (budget 2), process 1.7-2.8 ms (budget 2.5), render 3.2-4.5 ms (budget 4, spike was 17), CyanoSheet.process 0.7-1.3 ms (budget 2); simScale 0.5: process 0.7, expose 0.3, cyano process 0.1; bench() available on the dev page and in the Node runner (--bench)
- photochem determinism: identical inputs give bit-identical fields (checked by hashing fields)
- photochem dev page: wedge print developing under a scripted rock then stop/fix/wash, cyanotype coat to peroxide drop to rest, Nightjar 400 negative and its auto print; __game.demo/selftest/bench/advance/state
- photochem new API: SilverSheet opts {areaM2, simScale}, SilverStats (meanD, dmax, borderD, coverage, evenness, fixedFraction, wetMean + spike fields), render alpha = wetness with {opaque} option, version counter, CyanoSheet {simScale} and process {contact, h2o2 per-pixel peroxide field}, CyanoStats, mixSensitizer, peroxideBath, NegCurve and film/paper primitives from §4.5
- photo: 49/49 self-test checks pass in headless Chromium: spike closed-form checks (grey card X 1.0654 vs 1.0658, cos4, linearity, leaf efficiency, cat's-eye vignetting, blur discs, FOV, focal-plane skew, motion blur, flash GN/X-sync/cos3, double exposure) all unchanged after the refactor, plus the new features
- photo tilt: Scheimpflug via rank-1 projection (depth row kept central); ground dots 2.0/2.1/2.4 px sharp with tilt vs 9.0/2.1/9.2 px without; visual demo shows crisp posts and checks with tilt, soft near and far without
- photo begin()/Exposure: 30 addSample calls match capture(samples 30, chronological) pixel for pixel (mean abs diff 0.0000); 4 s exposure is 60.2x the 1/15 s one with reciprocity off; drawGhost, finish, abort; plan extends past expectedSamples
- photo emitters: heart-shaped aperture discs for string lights, energy within 1.3% of an exact (non-smoothed) emissive sphere, same centroid
- photo shutterProfile (rectangular profile matches a leaf shutter within 2%; rolling slit skews like a curtain), spectral (colour/mono/ortho), layers, radianceScale 1000 equals the nits scene within 0.3%
- photo FinderPreview: float scene render, depth-aware CoC gather with near-field halo, filmic tonemap, centre-weighted meter reading 14.9658 EV100 for a 4000 nit wall (also with radianceScale 1000), flip options, target/viewport
- photo encodeLog2/decodeLog2 worst error 0.077 stops over a -10..6.6 stop range; PNG round trip byte-exact for 1 and 3 channels
- photo photoSpecFromProfile fed a real @shared/optics 'portrait' profile through computeProfile and then captured a photo with it
- tsc clean for both paths: npx tsc --noEmit -p tsconfig.json | grep -E '^src/shared/(photochem|photo)/' prints nothing

## Missing

- photo: RGBA8 single-sample fallback for devices with no renderable float or half-float target (architecture §4.10 mentions it); only the RGBA16F accumulation and half-float scene fallbacks exist, with one console.warn
- photochem: FilmFrame.densities/render/printMask are not optimized (about 14 ms for 384x256 on a quiet machine, 3 to 4x that for Lens Bench's 768x512); not on the §4.5 budget list but Lens Bench will feel it
- photochem: Mackie-line dip and the 3 cm/s peroxide front speed from darkroom §5.11 are not checked (they need the tray flow field); the GPU develop-pass GLSL (glsl.ts) is exported unchanged and was not retuned for the model changes below
- No docs/build/shared-photochem-photo.md handoff note (docs/ is not an owned path); this report is the content
- A real-GPU/phone benchmark: all timings are from this Windows box (Node and SwiftShader Chromium) under heavy load from other agents

## Known bugs

- photo: smoothBokeh (inherited spike pre-blur) is not energy-conserving at large defocus: about 15% energy lost for a small bright object at a 12 px blur disc (found by comparing it with the exact emitter). Use emitters for point sources, or smoothBokeh:false with 128+ samples
- photo: shutterProfile uses the same ratio estimator as the focal-plane path, so every pixel is assumed to get the profile's mean open time; per-pixel exposure differences from the profile are not reproduced, and its edges are about 1/64 of the frame soft (64x64 coverage grid)
- photo: emitters have no cat's-eye clipping and blur circles are clamped to a 1.5 px minimum radius; Exposure (begin) ignores curtain/leaf timing, flash and shutterProfile (box shutter for the summed weightS)
- photo: tilt is ignored when focusDistance is Infinity; FinderPreview's gather is a preview approximation (no bokeh shape, small bright lights not energy-weighted)
- photochem: render() measured 4.2-4.8 ms in Node on this loaded machine against a 4 ms budget (3.2 ms in Chromium); process 2.8 ms in Chromium against 2.5. simScale 0.5 is the margin: process 0.7 ms
- Long browser self-tests can die with 'Execution context was destroyed' when Vite full-reloads the page because other agents edited files it imports; re-running succeeds

## API deviations

- photochem: the spike's type NegCurve (digital-negative preset 'linear'|'silver'|'cyanotype') is renamed DigitalNegCurve; NegCurve is now the §4.5 film-curve interface {gamma, dMin, dMax, x0}
- photochem: SilverSheet.stats() returns the §4.5 names (meanD, dmax, borderD, coverage, evenness, fixedFraction, wetMean) plus all spike fields. evenness = mean local std of density (mottling), coverage = fraction the developer touched; both are my definitions of the terms the architecture leaves open
- photochem: SilverSheet.render/CyanoSheet.render write alpha = wetness (as §4.5 says); the spike wrote 255. A third argument {opaque:true} restores 255 for putImageData
- photochem: SilverSheet has w,h (output) and sw,sh,n (simulation size, f fields have n entries); mask/contact inputs accept either output (w*h) or simulation resolution; observedDensity(i)/reflectance(i) take output indices
- photochem: model changes, all covered by the self-test: still-tray exchange constant 1/(0.15+a) became 1/(0.10+a) so a still tray finishes about 30% later (darkroom §5.11 wants +25..40%); develop() marks only touched pixels wet; CyanoSheet peroxide/Prussian-white rates are additive in h2o2 so peroxideBath(local) blends smoothly; curves and reciprocity read from log-spaced tables (0.2% / 0.002 D parity)
- photochem: imports inside the folder keep .ts extensions so Node 22 can run the self-test without a bundler (root tsconfig allows it); the barrel is index.ts -> api.ts (+ selftest/bench) to avoid an import cycle
- photo: selftest() is async (Promise<Check[]>, optional {renderer, only, log}) because it needs WebGL2 captures; the §4.10 text did not say sync or async
- photo: seed defaults to 1 instead of Math.random() (architecture §3.3 / R9 bans Math.random in render paths); callers pass a seed per shot for different grain
- photo: begin() Exposure treats the exposure as a box shutter of summed weightS; sampling.ts gained an exported orderSubframes helper; shutterProfile v runs top to bottom (v=0 at the top of the upright print)
- photo: the §4.10 text says 'PhotoSpec'; it is the same type as the spike's CameraSpec (both names exported)

## Requests

- orchestrator: the games should pass simScale: 0.5 on phones (SilverSheet/CyanoSheet) and prefer render() only when sheet.version changed; budgets are met at simScale 1 on a quiet desktop but only just under load
- orchestrator/architecture: update §4.5 to say NegCurve is the film-curve interface (spike's digital-negative NegCurve is now DigitalNegCurve) and to list the stats field definitions; update §4.10 to say selftest() is async and begin() is a box shutter
- darkroom-sim: use CyanoSheet.process(bath, dt, { contact, h2o2: perPixelPeroxideField }) for the peroxide drop; mixSensitizer(mlA, mlB).ratioAB goes to coat({ratioAB}); the §5.11 Mackie-dip and front-speed targets need your own tray-level checks
- lensbench-integrate / studio-camera: pass radianceScale: 1000 and a per-shot seed; use photoSpecFromProfile(profile, base) then resolveSpec; use emitters for hero point lights (smoothBokeh loses energy at large defocus); capture long exposures with begin()/addSample and drawGhost over the finder
- shared-platform (@shared/core): nothing needed; the dev pages use installGameApi, markReady and flags from @shared/core as it is now on disk
- orchestrator: consider whether the Vite dev server can avoid full page reloads while agents run long browser self-tests (they intermittently fail with 'Execution context was destroyed' and must be re-run)
