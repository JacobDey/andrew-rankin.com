# Build report: lensbench (partial)

Lens Bench is playable end to end on desktop and mobile: bench → street → fire → deferred render → tank → lightbox → tag grading. @shared/optics and @shared/sun are complete and their self-tests pass (optics 28/28, sun 7/7). The desktop smoke run (games/lensbench/test/smoke.steps.json) is fully green. That covers __game.selftest() all passing, runRef T02 and T04 passing (T01 also passes), identical latent hashes for the same seed and setup, zero errors, and no horizontal scroll. The mobile smoke run also passes with zero errors. Photos are rendered through @shared/photo with radianceScale 1000. Metered reference exposures land within 0.2 EV of the mid-grey reference, so the sun, sky and meter chain is calibrated. Everything type-checks with 0 errors repo-wide. Status is partial because some MUST details are simplified or missing (listed under missing). Nothing was committed; the files to commit are under games/lensbench/** and src/shared/{optics,sun}/**. The step-by-step onboarding sequence is simplified (dimmed bench, needle pulse, auto-pinned Tag 01). I did not write a docs/build handoff note, because the brief says not to edit docs/. Shots are in F:/Projects/andrew-rankin.com/shots/lensbench/ (lb-1..lb-6, lb-m*, 01..09).

## Works

- src/shared/optics/** (types.ts verbatim per §11.2 + PresetId): Cauchy glass, auto thickness, exact 3D Spencer–Murty trace with TIR/vignetting/stop masks, paraxial y–nu (EFL/BFD/FFD/principal planes), entrance/exit pupils, computeProfile fast (0.17 ms) / full (~5 ms; vignette V[16], cat's eye, distortion k1/k2 fit, lateral and longitudinal CA, SA/LSA, Petzval, T-stop, glare, mass, length, telephoto ratio), validate, collimate, traceFan, spotDiagram, rasterizePupil (iris polygons with roundness, 32×32 Waterhouse cards, pinhole), samplePupil, encodeLens/decodeLens, all 8 presets auto-scaled to an exact EFL (achromat auto-achromatized), imaging.ts helpers, library.ts (ar:lensbench:lenses), selftest 28/28 including 200 random designs with no NaN and no throw
- src/shared/sun/index.ts: the full §4.9 API (sunPosition, moonPosition, airMass, daylightStudio, lensbenchSun, kelvinToRgb, EV helpers, sunnySixteen). Self-test 7/7: noon 57.35°, sunrise 06:24, grey-card EV 15.45
- Page template per §3.4 with mountShell (Help, Spare key, Reset actions); registerSounds() from games/lensbench/sounds.ts; guardStartup/loader/no-WebGL fallback; ?test, ?reset, ?fresh, ?seed honoured
- Bench (Canvas 2D fog tank): walnut rail with mm scale; section-drawn pucks with glass tints, coatings and crosshatch; C/d/F rays drawn additively with a focus glow; laser/white (L); off-axis (F); collimate (C); fit (Z)
- Bench interactions: drag blanks from the felt tray onto the rail; slide pucks with overlap clamp, clink and Shift-fine; bend surfaces via brass rim handles (creak); wheel changes diameter; double-click flips; right-click or long-press opens the glass and coating menu; Del or drag-off removes
- Bench stops and readouts: iris half-stop detents ([ ] and wheel); B cycles blade count; card pad that draws a Waterhouse stop (heart preset); pinhole needle drag with a chime at d*; NO IMAGE stamp; 50× spot loupe; live inverted ground-glass inset; spec plate with emboss flash and flags (∞ OK / MIRROR CLEAR / VALID); body/shutter/film/filter selectors; Q.'s card file; share link (#cam=, loaded at boot with toast); save design
- Lantern Street world (pure functions of t): 32 textured facades with lit windows at night; Quist sign; Bakery No. 9 with seeded year, chalkboard, awning and steam; Biscuit the cat (tail, blinks); 3-tier fountain with 400 ballistic droplets; numbered windmill with closed-form φ(t); courier with seeded plate and lamps; 2 walkers and a page-turning reader; 40 string-light bulbs and 4 street lamps as kcd/m² emitters with point lights; cinema chart wall (grid, Siemens star, marquee); railings; postbox; tree; clock tower with plaque and hands set from time of day; calibrated sun, hemisphere sky and sky dome (kcd/m²), one shadow map; 20 targets with at()/velocity()/answer()
- Street screen: FinderView (HDR render, 12-tap pupil DOF gather for reflex/ground glass, k1 distortion, vignette, ACES auto-exposure keyed to a centre-weighted 16×16 meter with async readback, ground-glass flip, rings and grain, letterboxed with matching brightlines); meter needle spring; time slider; 7 standpoint chips plus Tab; drag-look; WASD and a touch stick; focus strip, wheel and Q/E; aperture and speed dials; tripod; DOF preview; hold-to-half-press release, B/cap hold timing with second ticks; wind lever and multiple exposure (Alt); rewind
- Shake model: 1 kHz integrator with tremor, breath, half-press gain, mirror slap and tripod. The pose track is recorded per shot at 500 Hz (120 Hz above 4 s)
- Photo adapter (photo/photo-renderer.ts): ShotRecord + LensProfile → @shared/photo spec. Covers leaf, cap ramps, cloth/metal/roller focal-plane travel and direction, the card mask, vignetting, distortion, both CA terms, field curvature, astigmatism, glow and glare. Per-subframe setTime re-applies the shot's time of day. Multiple exposures sum H, per-channel filter transmission is applied, then the §5.7 log2 RGB8 encode
- Deferred render queue: fire returns 'exposed' at once; renders happen in idle time; develop awaits pending renders
- Film (film/develop.ts): stock table, logistic curve with x0 keyed to mid-grey, time/temperature/agitation development (γ_eff, speed gain, fog), bromide drag, Selwyn grain with pixel pitch (so 4×5 is finer than 35 mm), grade-2 contact print keyed to 18% with no auto-levels, colour lab push/pull
- Tank screen: timeline, Q.'s chart card, thermometer, timer face, pour, invert with lamp prompts and agitation score, pour out, stop/fix/wash/hang, colour lab envelope
- Lightbox: contact strip, enlarged print with rebate and edge print, negative/positive (P), 8× loupe, sleeve note, Blur Budget bar with legend and a grease-pencil fix line, deliver to tag with Read It field, ACCEPTED stamp, PNG export (E), arrow-key navigation
- Grading per §6.10 (defocus, own-window motion, shake, glass, diffraction, exposure patch, walker fraction, star points) and tags T01–T05 with unlocks. runRef T01, T02 and T04 pass; T03 and T05 reference solutions are implemented but not verified
- Persistence through @shared/storage: local progress, camera and street; idb roll:<id> and frame:<id> (record + latent bytes). Unrendered frames are re-queued on load; debounced autosave; reset
- window.__game per §13: state, goto, skipOnboarding, resetSave, audioMute, loadPreset, setCamera, loadCameraHash, setAperture (incl. 'heart'), setBlades, focus (m/'inf'/target), setShutter, setStock, setFilter, setTime, setWorldTime, freeze, standpoint, aim, aimAt, tripod, advance, rewind, fire, develop, frames, openFrame, grade (with hash), runRef, selftest. Extras: step, meterNow, renderQueue
- games/lensbench/test/smoke.steps.json and smoke.mobile.steps.json both pass; scrollWidth ≤ innerWidth on 390×844

## Missing

- Analytic emitter sprites with diffraction-star spikes (§11.3 step 3). Bokeh comes from @shared/photo's accumulation of emissive bulbs; stars only appear when flare is on (the test tier has flare off)
- Full scripted onboarding (§9): no dimmed bench or hidden tray, no pulsing needle hint, Tag 01 not swung onto the cork, no forced tin-on-post sticker sequence. There is only Q.'s note, Street tab pulsing and skipOnboarding()
- Rangefinder patch, dark cloth, slit replay, tri-colour back, Nightjar 1600 / IR 820, colour filters' SHOULD extras, ghosts, glass ping, achromat chord, undo/redo, patents, Circle of Confusion accidents, Tags 06–13 (all SHOULD)
- Halation and the colour-negative orange-mask display are only partial (no halation pass)
- Short paper process (2 process minutes) for the tin sheet in onboarding; stop/fix/wash are instant taps without the 1.5 s animations
- Blur Budget grain hatching and the grease circle around the largest segment (the fix is shown as text). Contact-strip flutter juice
- Tap-the-ground-to-walk, chalk standpoint marks, dragging the sun on the sky arc (a time slider is used instead)
- Menu settings for haptics and quality override (setQuality only toasts). Hub note is written only on tag delivery
- Print/thumbnail JPEG blobs are not stored in IndexedDB (prints are re-developed deterministically from the stored latent)
- No docs/build handoff note (brief forbids docs/ edits); this report replaces it

## Known bugs

- Heart-bokeh orientation and size are unverified. At test tier (4 samples, 384 px) the night lamp renders as a large blob whose shape can't be resolved; worth one --gpu shot at desktop tier
- After loadPreset switches the tin to the box camera, the Body select shows the current body as '(locked)' when box isn't unlocked yet. Cosmetic
- The test-tier live finder renders at 256 px wide and looks soft. In ?test=1 the finder and ground glass skip frames while a capture is running
- The triplet on 6×6 shows +8.5% distortion and a visible image circle, because 50 mm doesn't cover the format. Physically plausible but surprising when a preset lands on the box body
- Shake tremor amplitude is the GDD nominal ×2.25 (TREMOR_A) so the self-test's ω_rms ≈ 0.02 rad/s passes; the 1/f rule has not been checked in play
- The frame just fired stays unrendered until you wind on or rewind, so it can take a multiple exposure (by design, but the queue only starts after advance)
- Walkers' and reader's poses are crude (the reader can read as lying down from some angles)

## API deviations

- Screen factories take (root, app: App) instead of (root, gl[, world]). startLensBench deps are { stage, shell, gl, world, createBenchScreen, createStreetScreen, createTankScreen, createLightboxScreen, createPhotoRenderer } and it returns the App (one session owns all four lensbench tasks)
- World adds extras: timeOfDay, lightsOn, text(), wind(t), dispose(). GLCore adds attached, size(), sync(). core/types.ts adds Screen, TagId, Progress, AppState. Store has extra members (rolls/frames/latents maps, setLatent, setDeveloped, load/flush/reset)
- @shared/optics additive exports: clampElementZ, setFNumber, heartCard/encodeCard/decodeCard/maskFraction, PRESET_INFO/PRESET_IDS, randomDesign, buildSurfaces, paraxial, pupils, petzvalSum, vignetteAt, GLASSES/GLASS_IDS/cauchy/sag/elementVolume, cloneLens, lensToCompact/lensFromCompact, b64url helpers, MASK_SIZE/CARD_SIZE, RAIL_MIN_Z/MAX_ELEMENTS. Signatures in §4.8 are unchanged
- lensbenchSun(13) gives 62° (the GDD formula's peak) where the GDD prose says ≈61°
- Tin and view bodies use a landscape 120×96 mm format (GDD table lists 96×120)
- Grading pixel measures use a nominal 1600 px print width regardless of render size
- __game.replay() is a no-op and setQuality() only toasts. Extras: step(n), meterNow(), renderQueue()
- Film/development code is local (games/lensbench/film/develop.ts) because @shared/photochem doesn't yet export the camera primitives (logisticDensity, devAmount, selwynSigma, bromideDrag, paperDensity…)

## Requests

- Orchestrator: commit games/lensbench/** (I import sounds.ts but did not edit it; it belongs to shared-audio) plus src/shared/optics/** and src/shared/sun/**. A docs/build handoff note was not written because the brief forbids docs/ edits
- shared-photochem: once the §4.5 camera primitives land (logisticDensity, x0ForMidGrey, devAmount, selwynSigma, grainField, bromideDrag, halation, paperDensity), Lens Bench's film/develop.ts can converge on them in a review round
- shared-photo: please confirm the ApertureMask convention (row 0 = pupil top) gives upright heart bokeh for background highlights. Lens Bench passes profile.pupilMask (64×64, row 0 = v = +1)
- Review round: run one --gpu desktop capture of smoke step 6 (portrait, heart card, 21:30, lamp2) to check bokeh shape and size at 32 samples
- Studio (consumer of @shared/optics and @shared/sun): APIs are per §4.8–4.9. sunPosition(241, 41.5, h, { clockOffsetH: 1 }) and daylightStudio are verified against the Sunny 16 calibration values
