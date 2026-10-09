# Spike: fluid-tray

A developing tray you can rock, pour into and tip out. The liquid is a shallow-water heightfield on the CPU.
A sheet of exposed paper on the floor develops only where liquid covers it, at a rate set by how well the
liquid is being moved around. The test print comes up out of white while you rock. Rendered with three.js
under a red safelight, with an optional room light.

Page: `http://127.0.0.1:5173/spikes/fluid-tray/`. Add `?q=high|medium|low` to pick a quality,
`?scene=tilt|bloom|rock30|still30|half|pour|drain|drop|bubbles|room` for a scripted setup that holds still
for a screenshot (`&run=1` keeps it running), and `&maps=1` to show the coverage, development and freshness
maps.

Screenshots are in `shots/spike-fluid-tray*.png`. The best ones are `-rock30` vs `-still30`, `-bloom`,
`-pour`, `-tilt`, `-room` and `-mobile`.

## What's here

| File | Role | DOM / three? |
|---|---|---|
| `core/shallowWater.ts` | `ShallowWater`: a staggered-grid shallow-water solver in the tray frame. Handles wet and dry cells, keeps mass exact, carries a tracer, and has a rim and spout weir | pure TS |
| `core/trayRig.ts` | `TrayRig`: the tray as a body. You hold it on a spring, let go and it falls under gravity torque, clunks and bounces on the bench, and a jolt slides it | pure TS |
| `core/paperChem.ts` | `PaperChem`: per-texel coverage, wetness, boundary-layer developer, nuclei, progress and density, plus air bubbles and convection mottle | pure TS |
| `core/fluidTray.ts` | `FluidTray`: the facade. It composes the three above and adds pour, drain/spill accounting, splash droplets, wall-slap events and snapshots. Fixed timestep, seeded | pure TS |
| `core/latent.ts` | Turns an image into paper sensitivity `S`, plus a test pattern that needs no DOM | pure TS |
| `core/rng.ts` | mulberry32 | pure TS |
| `render/trayView.ts`, `render/shaders.ts` | three.js view: bench, tray, paper, liquid, bubbles, droplets, jug, pour and drain streams, lighting, picking, screen-to-tray mapping | three |
| `demo/testChart.ts` | Canvas test print (rusty mailbox, Siemens star, step wedge, edge printing) and PNG import | DOM |
| `demo/audio.ts` | WebAudio slosh bed driven by kinetic energy, wall laps, bench clunk, jug glug | DOM |
| `main.ts`, `index.html` | Input (mouse, touch, keys, device tilt), HUD, maps, quality presets, scenes, `window.__spike` | DOM |

The core runs in Node with no build step: `node --experimental-strip-types` (imports use `.ts` extensions).
The tests below were run that way.

## Core API

```ts
import { FluidTray } from './core/fluidTray.ts'
const tray = new FluidTray({ nx: 128, advect: true, fixedDt: 1/120, chemHz: 30,
                             paper: { resX: 240, resY: 192 }, spoutCorner: 'x1y0', seed: 7 })
tray.paper.setLatent(S)            // Float32Array resX*resY, 0..1 = how black it will go; row 0 = front edge
tray.fill(520, 'flat' | 'left')    // mL; 'left' = a dam-break block in the left third
tray.update(frameDt)               // real-time: whole fixed steps, capped (slow-motion instead of a death spiral)
tray.advance(seconds)              // exact, uncapped, for tests

tray.tilt(x, y)                    // HOLD the tray at this tilt (rad). +x lowers the right side, +y the far side
tray.release()                     // let go: it drops onto the bench with a clunk and a bounce
tray.jolt(vx, vy)                  // shove it along the bench (m/s)
tray.pour(ml, { x?, y?, rate?, fresh? })  // metered pour (mL, mL/s); fresh = tracer 0..1
tray.setPour(rateMLs, x, y, fresh?)       // continuous pour that the jug UI drives; 0 stops it
tray.poke(x, y, strength?, dvx?, dvy?)    // finger in the liquid: radial push plus drag
tray.resetPaper()

tray.coverageMap      // Float32Array resX*resY, 0..1: liquid deep enough here right now (and no bubble)
tray.developmentMap   // Float32Array resX*resY, 0..1: density = progress * S (times Dmax gives optical density)
tray.paper.rgba       // Uint8Array RGBA (density, wet, coverage, developer), ready to upload; paper.dirty flags change
tray.fluid.h / .s / .speed / .agitation   // cell fields: depth (m), freshness, |u|, low-passed agitation
tray.stats()          // volumeML, pouredML, drainedML, spilledML, coverage, density, freshness, bubbles, tiltDeg, kinetic, ...
tray.events           // per update: clunks[] (edge m/s), slaps[] {x,y,e}, drips  -> audio and haptics
tray.snapshot() / tray.restore(s)   // deep copy of typed arrays; replays bit-exactly
```

Lower level:

- `ShallowWater`: `step(dt)`, `addVolume(x,y,r,m3,tracer)`, `addImpulse(x,y,r,radial,dvx,dvy)`,
  `setSpout(corner, lip, len)`, `sampleH(x,y)`, `sampleCell(field,x,y)`, `computeDerived(dt)`,
  `diffuseTracer(dt)`, `volume()`, `kineticEnergy()`.
- `TrayRig`: `hold`, `release`, `setTilt` (for direct gyro control), `jolt`, `step`, `gravity()` →
  `{gx, gy, gz}` in the tray frame.
- `PaperChem`: `step(dt, fluid, rng)`, `setLatent`, `addBubble`, `summary()`, `kin` (all the constants).
- `TrayView`: `new TrayView(canvas, tray, {maxDpr})`, `sync(dt)`, `render()`, `resize(w,h)`,
  `setLighting('safe'|'room')`, `pickTray(ndcX, ndcY)`, `pickJug(...)`, `screenToTrayDir(dxPx, dyPx)`
  (camera-yaw aware, so portrait works), `renderedGravity()`.
- `window.__spike`: `step(frames, dt)`, `advance(s)`, `state()`, `pause()`, `tilt(xDeg, yDeg)`,
  `release()`, `pour(ml)`, `setPour()`, `rock()`, `tip()`, `jolt()`, `poke()`, `light()`, `maps()`,
  `quality()`, `fill()`, `newSheet()`, `snapshot()` / `restore()`, `coverage()` / `development()` (3x3
  region means), `gravityCheck()`, `bench(n)`. `body[data-ready]` appears after the first frame.

**Frame.** Tray coords are x along the long side, y away from the viewer, z up, with the origin at the
front-left inside floor corner. Units are metres. In three.js, `frame` is a child of `tilt` with
`rotation.x = -PI/2`, so meshes are built directly in tray coords. Tilt is applied as
`tilt.rotation.set(-ay, 0, -ax, 'XZY')`. `gravityCheck()` confirms that the rendered pose and the core's
gravity agree to 4 decimals.

## Model in one screen

**Liquid** (0.36 x 0.27 m inside floor, 128x96 cells of 2.8 mm). Each substep:

1. **Momentum**, one fused pass per face:
   - semi-Lagrangian advection, but only where both cells and the departure cell are deeper than 1.5 mm;
   - eddy viscosity of 1e-4 m²/s;
   - gravity and pressure gradient (`-gz ∂h/∂x + gx`);
   - drag of `0.4 + 3ν/h²` (thin films cling, deep water sloshes).
2. **Continuity**: upwind fluxes. A per-cell outflow limiter means depth can never go negative and mass is
   exact. A weir `q = 0.55·√g·head^1.5` handles the rim (45 mm) and the spout (24 mm lip, 4 cm each side of
   the front-right corner). The tracer is moved with the same fluxes.
3. **Breaking**: any surface slope above 0.8 relaxes conservatively. Bores stay sharp but don't ring.

Gravity is rotated into the tray frame from the rig's tilt, minus the slide acceleration. Tilting therefore
just changes `(gx, gy, gz)`. Substeps are split so that `(|u| + √(gh))·dt/dx ≤ 0.7`.

**Paper.** Per texel, sampled bilinearly from the fluid with separable tables. Doc-speed kinetics: shadows at
about 10 s, full density at about 60 s.

```
cov  = smoothstep(0.6 mm, 1.4 mm, h) * (1 - bubble)
dc/dt = (m0*mottle(x,y) + m1*sqrt(agitation)) * cov * (c_bulk - c) - kc*S*dp/dt   // boundary layer
dn/dt = k1*c*act*S;   dp/dt = k2*c*act*(n + n0)*(1 - p);   act = max(cov, 0.3*wet)
D = p*S;   by-products lower the liquid's freshness tracer under dense areas (bromide drag, carried by the flow)
```

`sqrt(agitation)` is laminar boundary-layer mass transfer: any real flow nearly saturates the exchange. That
makes a rocked tray even, and only still or starved areas lag. `mottle` is fixed value noise (convection
cells), which only matters when you don't rock. Bubbles get trapped when a fast front sweeps dry paper or when
you pour onto barely-wet paper. They drift with the flow, pop under agitation (about 1 s) or slowly when the
tray is still (about 50 s), and leave pale spots.

## Verified (Node, deterministic)

| Check | Result |
|---|---|
| Mass: 650 mL dam-break, rock, drop, still, +200 mL pour, tip out | in = tray + drained + spilled + droplets, to 3 decimals of a mL |
| Snapshot, run 2 s, restore, run again | bit-identical (max dh = 0, max dD = 0); about 0.4 MB at 96x72 |
| Rendered pose vs core gravity (6°, 3° hold) | (1.024, 0.5134, -9.7429) in both |
| Tip to the spout corner, 4 s | 706 mL out of the spout, 123 mL over the rim, 21 mL film left |
| Auto-rock (0.25 Hz, 3°/2.2°), 30 s | no slop (0.05 mL). At 0.42 Hz it slops: that's the across-tray resonance (see Gotchas) |
| Mouse drag 120,-70 px | tilt (5.45°, 3.18°); release drops it to 0 |
| Jug drag | pours 170 mL/s at the pointer's spot in the tray; stops on release |

Agitation matters the way a printer would expect. This is a uniform mid-grey sheet after 25 s, 520 mL,
inner 80% of the sheet:

| Agitation | mean density | unevenness (CV) |
|---|---|---|
| still | 0.26 | 8.4% (mottled) |
| one 4° tip every 10 s ("lazy") | 0.46 | 2.1% |
| gentle continuous rock 2°/1.5° | **0.48** | **2.1%** |
| steeper rock 4°/3° (uncovers the edges each cycle) | 0.43 | 4.3% |
| rock with only 220 mL (half the floor dry each cycle) | 0.28 | 7.8% |

In `-still30` vs `-rock30` the still print is mottled, muddy and about 22% developed, with a "ghost" of the
image in the tray's freshness map. The rocked one is clean, with deep blacks, about 37% developed.

## Performance

The machine was at **100% CPU on all 12 threads** from other agents throughout, so every number below is
inflated, by about 1.5-2x judging by earlier, quieter runs. Headless Chrome, `__spike.bench(300)`, rocking,
production build:

| Preset | grid / paper / chem Hz / advect / DPR | liquid ms/frame | substeps/frame | chemistry ms/frame |
|---|---|---|---|---|
| high (desktop default) | 128x96 / 240x192 / 30 / yes / 2 | 6.9 | ~8.7 | 1.8 (3.6 per tick) |
| medium | 96x72 / 180x144 / 20 / yes / 1.5 | 2.6 | ~6.7 | 0.6 |
| low (touch default) | 72x54 / 160x128 / 20 / no / 1.5 | 0.55 | ~3.3 | 0.28 |

Other costs:

- Texture upload and sync: about 0.1-0.3 ms.
- SwiftShader draw: 15-45 ms per frame. This is meaningless for a real GPU.
- Draw calls: about 15.
- The floor and paper shader does 5 bilinear corner samples (20 `texelFetch`) per fragment, plus one additive
  liquid pass.
- Bundle: 627 KB (three included), about 160 KB gzipped.

Estimates for real hardware:

| Device | high | medium | low |
|---|---|---|---|
| Uncontended desktop | about 3.5-4.5 ms CPU | 1.3 ms | 0.3 ms |
| Mid-range phone (3-4x slower JS) | 12-18 ms, too heavy | 5-8 ms, marginal | 1.5-2.5 ms CPU, plus 1-3 ms GPU at DPR 1.5. Fine at 60 fps |

**Quality knobs**, cheapest first:

- `nx` (cost scales with cells × substeps, so going 128 → 64 is about 8x cheaper);
- `advect` (off is linear SWE: no bores, needs fewer substeps);
- `chemHz` and paper resolution;
- `maxDpr`;
- `maxStepsPerUpdate` (slow motion instead of dropped frames);
- normal and caustic gains in the shaders.

## Gotchas (each cost real time)

- **The CFL condition must use `|u| + c`, not `c`.** The forward-backward C-grid is stable to `c·dt/dx < 0.707`
  on paper. Coupled with semi-Lagrangian momentum, a strong rock periodically grew a ±1 mm checkerboard in
  the deep end, with `c` alone at 0.6. Using `(|u|+c) ≤ 0.7` fixed it. Measured deep checker RMS went from
  0.6-0.9 mm to 0.03-0.06 mm. It costs about 1.8x the substeps.
- **Don't advect across wet/dry fronts.** The backtrace pulls pool velocity into the film and film velocity
  into the pool, and the front piles into a ringing cliff. Skip advection where any involved cell is
  shallower than 1.5 mm.
- **Bores need a breaking model.** A first-order scheme rings behind a hydraulic jump. The slope relaxation is
  cheap, conservative and looks right.
- **Biharmonic smoothing of h plus eddy viscosity on u goes unstable.** Each is fine alone. Use only the eddy
  viscosity.
- **Rendering:**
  - Upload **corner-averaged** heights ((nx+1)x(ny+1), 2x2 box). This kills residual Nyquist noise and puts
    a texel exactly on each vertex.
  - Compute surface normals over **±2 cells**. The bulb glint is a lobe with exponent 7000, and it turns
    every 3-cell wobble into a woven grid.
  - Clamp the fake-refraction offset to 1.8 mm. Otherwise a steep front smears the floor's ribs into zebra
    stripes.
- **Coverage threshold.** A receding film is about 0.3-0.45 mm thick (viscous drainage). If coverage starts
  below that, "uncovered" paper keeps developing at full rate.
- **Resonance.** Half a litre sloshes at about 0.32 Hz along the tray and 0.43 Hz across it. An auto-rock
  near either slops liquid over the 24 mm spout lip. The demo rocks at 0.25 Hz. Players can still find the
  resonance on purpose, and that's physics.
- **Headless harness:**
  - A single `--eval` running for more than about 30 s gets the page reloaded by the dev server (the
    websocket times out), so break long runs into chunks.
  - The shared dev server's dependency optimizer got stuck mid-run (504 "Outdated Optimize Dep" on
    `three`). I verified from a production build served statically instead: `vite build --config <scratch>`
    with `root` set to this folder.
  - `?scene=` presets plus `body[data-ready]` make every screenshot one deterministic page load.

## Recommendations for the real thing

1. **Lift `core/` as-is** into `src/shared/liquid/`: `ShallowWater`, `TrayRig`, `FluidTray`. Move
   `PaperChem` into a shared photochem module, or reconcile it with the `photochem` spike. The interface
   between them is only "per-texel coverage, agitation and bulk freshness in; by-products out".
2. **Run the sim in a Worker.**
   - It's pure TS with typed arrays.
   - Post `{tilt, pour, poke}` in.
   - Transfer `h`, `s` and `speed` (or the packed corner field) and `paper.rgba` out each frame, double
     buffered.
   - Main-thread cost drops to the upload, about 0.2 ms.
   - For phones, do this before trying anything else.
3. **Move paper chemistry to the GPU** once prints go to 512x640 (RGBA16F ping-pong; the fragment math is
   above, and the bubble mask becomes a small instanced draw). Read back only 3x3 or 16x16 summaries for
   scoring. Keep the CPU version as the deterministic reference and the save-state source of truth.
4. **Floating or moving paper** (tongs, dunk, curl): replace the separable sampling tables with per-texel
   transformed sampling. Feed paper drag from `fluid.uc`/`vc`. A paper with corners curled up is just
   coverage times a curl mask.
5. **Darkroom trays:** three trays at medium (96x72) cost about the same as one at high. Off-screen trays can
   tick at 4 Hz.
6. **Save states and the rewind ring:** `snapshot()` is exact. For a 30 s ring buffer, quantize h and s to
   16 bit and the paper fields to 8 bit, as the darkroom doc suggests.
7. **Use the events.** `clunks`, `slaps` and `drips` already drive audio. `navigator.vibrate(8)` on slaps
   is a one-liner. `stats().kinetic` is a good slosh-loudness signal.
8. **Spout and sink:** the drain stream currently falls to the bench. In the game, aim it at a bottle or the
   sink and count `drainedML` as recovered developer.
9. **Not done:**
   - tray-wall waterline and inner-wall tint (the liquid surface is additive and tints only what is under it);
   - spill puddles on the bench;
   - temperature;
   - a GPU solver;
   - a typed iOS gyro permission flow. It's there as "Phone is the tray", but I couldn't test it headless.
