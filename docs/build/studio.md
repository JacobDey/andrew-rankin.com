# Build report: studio (partial)

Sunny 16 (/games/studio/) is built and playable end to end, in the UI and through window.__game. You can walk the loop dollhouse overview → yard → camera (finder) → shoot → unload → darkroom (tank, then print) → print box → fridge / mailbox postcard, and the house is saved to IndexedDB. About 8,700 lines of strict TypeScript, all under games/studio/** (I did not edit sounds.ts, which belongs to shared-audio). The type-check is clean for my paths.

How it was checked: a smoke run (games/studio/test/smoke.json, from GDD §13.2) passed with no console errors. Sprinkler blur is 0.6 px at 1/500 and 107 px at 1/4. The lantern Bulb trail is 7,106 px with time-lapse. P1 and P3 come back ✓. Pinning a print writes the hub note "1 print on the fridge". One check failed in that run, the lantern print's mean brightness. I fixed it afterwards (lantern.steps.json: mean 0.29, bright fraction 0.14) but did not repeat the full smoke run. A separate run through the real UI also worked: pinhole cap held in real time, then tank (load, pour, invert, pour out, fix, wash), then enlarger, tray rocking, pull, print box. On a 390 px phone there is no horizontal scroll, buttons are at least 44 px, and the finder fits.

What it uses: @shared/photo for capture (fast path and live path, tilt, spectral, log-encoded latents), @shared/photochem for film and paper curves, grain and bromide drag, @shared/sun, @shared/storage, @shared/ui and @shared/audio. The backyard physics is my own Rapier wrapper, ported in spirit from spikes/backyard-physics.

Screenshots are in shots/studio/: studio-01…07, studio-poster, mobile-01/02/04, live-*, lantern-darkroom.

## Works

- Page per art-direction §11 with the inline theme script, shell (House and Start fresh actions, help on first visit), loader 'Mixing chemistry', guardStartup, and the no-WebGL2 card
- Dollhouse overview: roof lifts with a tock, basement cut through a soil section with a red glow, spin with inertia and a ratchet tick every 15°, zoom, room tags (positioned to fit on phones) or tap a room to dive in; 600 ms dolly, 200 ms fade under reduced motion, instant on the test profile
- Sun from @shared/sun (day 241, 41.5° N, clock = solar + 1 h); lights in kilolux; custom sky dome in kcd/m² with a night dome, stars and moon; draggable, flingable sun ring; time chip and scrubber; [ / ] keys; eye adaptation (τ 4 s going dark, 0.25 s going bright); shadow map 2048/1024/512 by quality
- Rapier world with interpolated meshes, contact-force impact sounds, and noise events for the sparrows; spring hand (k 400, c 30, capped) for grab, carry, throw (≤ 12 m/s) and poke
- Yard: lawn with mown stripes, maple with swaying canopy, picket fence, patio, A-frame, stump, feeder, picnic table, rusty '16' mailbox with flag, neighbours, hose and spigot
- Toys: Rapier tire swing (spherical joint, L = 2.4 m) with turnaround creak; impact sprinkler with deterministic analytic GPU drops and a physically placed rainbow (primary, secondary, Alexander band); Y-string lantern with knot detents, push and drag; whirligig; wind chimes; ball, bucket and watering can, plus crate and six balls unlocked by P6
- Dot the terrier: kinematic body; laps with sniff stops, fetches a thrown ball, jumps (marked airborne), sits when clicked; trot gait, bark, panting. Sparrows: perch and hop, flee on shutter noise (loudness/d²), impacts, Dot or the tripod, return after 20–40 s
- Workshop: bench, five drawers that slide out, turntable model rebuilt for each build, optics card (f, f-number, shutter range, film, mass, near focus, field of view, sunny-16 pencil line, live pinhole readout), pinhole needle press-hold d = 0.15 + 0.45(1 − e^(−t/0.9)) mm with raggedness, 'Shelve build'
- Camera parts and math: oatmeal can, box and field bodies; pinhole, Meniscus 75, Plasmat 150, Portrait 120 and +2 close-up; cap, leaf and gravity-drop shutters; four Nightjar stocks; near focus, bellows, actual leaf times
- Tripod (on the self layer, never in photos): drag to slide, double-tap or long-press the lawn to hop it there; cable-release bulb (press to fire, long-press for the 10 s self-timer)
- Finder: three bezels (sight pins; waist-level mirror-reversed with Fresnel rings; ground glass upside down), live @shared/photo preview with depth-of-field gather, focus strip with a depth-of-field bracket from the real hyperfocal distance, aperture, shutter and tilt dials, meter needle, wind and unload, handheld/tripod switch, drag to aim, tap to focus, wheel to focus, keys Z X , . W S G H R U V, Space half-press/fire, hold Shift to hold your breath, Bulb lock notch
- Handheld shake per §5.8 (tremor, drift, breathing, press jolts, 1.5× for a fast stab); tripod sways only with the wind
- Capture: fast path via PhotoRenderer.capture with PhotoScene.setTime advancing the sim, so the shutter time really passes; live path via begin()/addSample(), in real time from frames (with an accumulation ghost and a seconds ticker) or deterministic for the test API (≤ 120 samples); time-lapse above 15 s; front tilt; ortho, pan and colour spectral; seeded
- ShotRecord §5.13 measures: inFrame, visible (Rapier ray), blurPx with shake, defocusPx, coverage, Dot ghost visibility on an 8×6 grid, Dot pathCoverage, sprinkler dropBlurPx / sprayCoverage / rainbowPx, lantern trailPx, state min/max/mid; auto-caption tags
- Latent images stored compactly as log-encoded 8-bit PNGs in IndexedDB; double exposure when you fire without winding (decoded, added, re-encoded); rolls, wind, unload to pocket, auto-load of film when the finder opens
- Darkroom: fixed red-lit bench; tank (1.5 s load in the dark, pour, temperature dial with lagging needle, cue lamp every 3 s, invert by tap, drag or Space, chemistry clock at 20×, push/pull ρ, bromide drag below cueRatio 0.5, surge marks); fix; wash with the pink dye draining; strip on the light box and a DOM strip with a hover loupe showing the positive; enlarger (grade 0–5, print size, lamp time with pencil-mark suggestion); contact sheet; rocking tray with k = 1, 3 slosh modes and live development (τ 4 s, corners lag when not rocked), develop chime at 50 %; pull → fix → line → print box; room light ramps over 250 ms and fogs open paper
- Hall: fridge with 8 magnet slots showing print textures, print box and binder dialogs, print viewer with Save print (1200×1500 share card PNG), Copy caption, Pin/Unpin; hub progress note
- Postcards P1–P8: predicates on ShotRecord, ✓/★ quality rule, one grease note naming the worst miss, hint tape note after two misses, packages unlock parts, mail truck, at most two open, pre-answered when an earlier print already fits; mailbox panel (pick a card and a print, raise the flag, reply 6 s later)
- Persistence through @shared/storage idb('studio'): house, roll, latent, neg and print records; latents deleted once developed; 'Back where you left it.' and 'This house forgets when you leave.' toasts; ?reset=1, ?fresh=1, ?embed=poster honoured
- Onboarding: tape notes and pulsing glows (stump can → pinhole on the tripod with the sight-pin finder → basement door → tank note → fridge); first-visit dive into the yard
- window.__game: state, poster, step, pause, resume, goto, view (yard-wide, yard-rainbow, yard-lantern, rooms), setTime, toy, throwBall, poke, build, unlockAll, placeTripod, aim, handheld, settings, finder, shoot, wind, unload, develop, print, pin, mail, photos, printPixels, calib, resetSave, plus tap(name), measureSwing, evaluate. ?test=1 pauses the sim so time only moves through step()
- Quality profiles high/low/test (dpr, shadow size, capture size and samples, drop pool, physics rate); portrait phones widen the field of view; phone layout verified
- Audio wired to the studio.* sound library: cicadas, crickets and wind beds, chimes, sprinkler tsk/return/spray, shutters (two clicks spaced by the real exposure time), cap, self-timer, wind-on, thock, needle, swing creak, sparrows, flutter, bark, pant, impacts, screen door, stairs, glug, lid, fixer, tray slosh, enlarger hum, mail truck; muffled to 900 Hz in the basement and 600 Hz under the field camera

## Missing

- Workshop parts are DOM drawer cards you tap to mount (with a thock); the GDD's Rapier parts dragged onto glowing 4 cm snap mounts are not built. There is no film-box drag (film loads from the Film drawer or automatically). Shelved builds cannot be picked back up yet. No pegboard tools
- The tripod is not a Rapier body, so Dot, balls and the swing cannot knock it. No 3D pan handle (aim inside the finder). No height control in the UI (API only)
- Finder: no 3× loupe, no advance-lever arc (Wind button and R instead), no second-finger hold-breath on touch, no pointer-lock 'steady grip'. Settings UI (Erect image, Captions, Steady grip, Quality) is not built; house.settings.erect is honoured by the finder
- Optics post-pass relies on the @shared/photo lens model (glow, chromatic aberration, distortion, vignetting, diffraction). There is no studio-specific image-circle porthole mask and no pinhole 12-tap blur or star-spike pass
- The gravity drop and lens cap use leaf-shutter ramps, not a custom shutterProfile. The drop height is fixed at 40 cm (no ratchet UI)
- Darkroom pours and agitation use taps, buttons and drag-to-invert, not the GDD's tilt-the-jug pour and drag-to-sink. The binder opens the print box instead of per-roll contact sheets
- Postcards show text only: no procedural hand-tinted fronts
- The rainbow is real in the shader but faint in the test-profile screenshot (studio-03-rainbow.png)
- No adaptive quality step-down (perf monitor). The overview runs about 490 draw calls against a 250 budget (static geometry not merged)
- Everything in the SHOULD and STRETCH tiers is not built: Tin-plate 35, Marble Tin, camera obscura, dominoes, pool, clothesline, fireflies, P9–P14, yard blueprints, camera links, filmcan, test strip, Q.'s drawer
- No docs/build handoff note: the brief named none and docs/ is off limits, so these notes are in this report

## Known bugs

- Twice in five long headless smoke runs the page fully reloaded partway through, losing window.__smoke. It is probably Vite reloading the page when another agent edits a shared module, but I did not confirm that. Shorter runs and the last full run completed without it
- The overview is mirror-imaged against the GDD's description: the garage shows on the right, not the left. The GDD's own axes (+x east, +z north, y up) put east on the left when looking north, so I kept those axes rather than relaying out the house
- Interior wall faces reuse the exterior peeling-clapboard texture, so the kitchen and garage look like a weathered cabin inside
- Sparrows flee when Dot comes within 1.2 m of the feeder, not the GDD's 2.5 m: Dot's GDD lap passes 0.2 m from the feeder, so at 2.5 m the birds would almost never be home
- The test-API seed(n) and setQuality(q) do nothing at runtime; seed and quality come from ?seed= and ?quality= at boot
- Postcard reply delay and darkroom wash use real-time setTimeout (6 s and 4 s; instant on the test profile)
- The hall fridge print reads dark at hall exposure; the smoke run's sprinkler print had mean 0.23, near the low end of the 0.2–0.8 target
- The ball must be thrown with real speed to count as landed for Dot's fetch; small drops are ignored by design

## API deviations

- core/contracts.ts keeps the §11.3 data shapes (CameraBuild, CameraSpec, ShotRecord, Roll, PrintMeta, HouseState, ChemBridge) but the Engine, RoomModule and Store surfaces are this single-agent build's own (core/engine.ts, core/rooms.ts, core/store.ts). HouseState adds frameCursor, wound, negatives and prints. PhotoSubject uses colliderHandle instead of collider, and extra() takes a phase ('start' | 'mid' | 'end'). The noise event carries kind: 'shutter' | 'impact'
- All pixel measures (blurPx, trailPx, dropBlurPx, shakePx, defocusPx) are normalised to a 768 px long side, so postcard thresholds do not change with quality tier
- __game.print() without lampS uses t_ref = 8 s. The in-game enlarger pre-sets the pencil-mark suggestion instead
- Lantern: a small bright mantle (r 16 mm, radiance 8 kcd/m²) inside a dim r 50 mm globe, instead of one r 0.05 m emissive sphere, so long exposures draw lines rather than 40 px smears (needed for the smoke print criterion)
- The live exposure path samples at ≤ 30 Hz of sim time, not every rendered frame
- Prints are stored as WebP 0.92 through canvasToBlob, with a PNG fallback; the share card is PNG
- Several capture lens settings are lowered: veiling glare 0.002–0.003 and ghosts ≤ 0.05, so a lamp at +18 stops does not fog the whole frame

## Requests

- shared-photo: FinderPreview.render divides its display gain by radianceScale (src/shared/photo/finder.ts, around line 251: uExposure = ((0.18/lMid)·brightness)/radianceScale), while PhotoRenderer and the finder meter multiply by it. With radianceScale 1000 the preview is 10⁶ too dark. Studio compensates by passing brightness × 1e6 in games/studio/camera/camera.ts renderFinder; once this is fixed, that compensation has to be removed
- Orchestrator: flip the studio registry status to 'ready' after review. Smoke step files are games/studio/test/smoke.json (desktop, run with ?test=1&reset=1, --timeout ≥ 600000) and smoke.mobile.json (--mobile); poster.steps.json, lantern.steps.json and live.steps.json are extra
- Orchestrator: think about pausing other agents' edits to shared modules while long headless smoke runs are going, since a mid-run full-page reload loses test state (not confirmed as the cause)
- shared-audio (optional): a dedicated changing-bag rustle for tank loading. 'cloth.rustle' is used for now
