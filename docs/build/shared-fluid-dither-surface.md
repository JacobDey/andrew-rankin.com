# Build report: shared-fluid-dither-surface (done)

All three modules are landed in the order asked (dither, fluid, surface). Each follows the section 4 signatures, type-checks clean for src/shared/{dither,fluid,surface}, has a README.md and a dev page with a passing selftest(). Deviations are listed in the report. A scratch Vite build of the three dev pages succeeds. The barrels are three-free, the surface worker bundles on its own, and there is no Math.random or spikes/ import in my paths. I wrote no docs/build note, since the brief names none.

## Works

- @shared/dither (barrel, three-free): bayerMatrix(2|4|8|16), bayer8, ign, generateBlueNoise (void-and-cluster, cached per size/seed/sigma), getThresholdMap for 'bayer' | 'bluenoise' | 'cluster' | 'bayer-ign', PALETTES with all 18 names (plates 7.1 values for bone/ruby/canary/prussian, latent* from latent 7.1), resolvePalette, hexToRgb, LUMA, ditherImage (CPU 1-bit ImageData) and DITHER_GLSL (bayer8, ign, bayerIgn, thresholdLookup, paletteDissolve and friends).
- @shared/dither/three: OneBitPass (spike API unchanged, incl. setPalette Bayer dissolve, AnchorTracker, readBits), thresholdTexture, applySurfaceDither(material, o), DevelopingPrintMaterial, AnchorTracker, applyLineId. Dev page /src/shared/dither/dev/ renders the cabin in bone, ruby and latentTerminal with outlines, a palette sweep, a pattern switcher and a CPU gradient. selftest passes: blue noise 64 and 128 are permutations, Bayer 2/4/8/16 rank-complete, bayer8 equals the matrix, a render-target readback is 100% ink-or-light in three palettes, and ditherImage coverage matches tone.
- @shared/fluid: TrayFluid facade (tilt as tangents, setAccel, floor/setFloor plate, fixed 1/240 substeps capped at 8, ux/uy cell velocities, spill/wallImpact/kinetic/slaps report, sleep after 1 s below 1e-6 J, impulse, poke, addVolume, takeVolume, refill, snapshot/restore), TrayBody (spring-damper, hold, release with landed speed, autoRock), ScalarField, sloshFrequency, wallSlapToGain. ShallowWater, TrayRig, FluidTray, PaperChem and the latent helpers are also exported (ported). selftest passes: volume drift 4e-8 over 60 s with no spill, first slosh half-period 1.057 s vs 1.049 s from sloshFrequency, a tilt past atan(2h0/L) uncovers the high end, snapshot/restore bit-exact, sleep after 4 s, plate-floor volume drift 6e-8, poke/impulse conserve volume.
- @shared/surface: types.ts (texturedle 11.2 block A verbatim plus additions), kit with every 6.1 primitive and combinator, palette/tint, stroke-font glyphs, baker (pass 1 coarse cavity/convexity, pass 2 layer stack, pass 3 AO, contact fields for marble/burlap/lens, snag map, loose, 512-px audio heightfield, CPU mips), bake.worker + bake-client (inline fallback), runtime (contactAt, materialAt, residueAt, snagAt, abradeBatch, polishBatch, takeLoose, editHeight, markLooseDirty, onDirty, carryFrom), thumbnail, bakeMaps, listRecipes, getRecipe, POOL, WALK. Recipes 001-010 plus poster-peeling-paint are registered (the poster has pool:false).
- Surface selftest (15 checks) passes in the browser: the mailbox thumbnail is 75% green with 14.5% orange and its stains run along +x, every recipe bakes without NaN, D is never below H and normals are unit, the snag map is sane, the lid falls toward +x, abrasion reveals lower layers, carryFrom keeps a scrubbed patch visible from 5:1 to 4:1, same seed gives the same bake, and bakeMaps returns the right sizes. Contact sheet shot: shots/surface/dev-01.png. Fluid: shots/fluid/dev-02.png. Dither: shots/dither/dev-01.png and dev-02-latent.png.
- Each module has README.md (API, deviations, measured numbers) and a dev page at /src/shared/<module>/dev/index.html that installs window.__game through @shared/core/testapi and calls markReady().

## Missing

- Recipes 011-036 (SHOULD) are not written; WALK contains only the 10 registered ids, while WALK_PLAN is the full 30-day id list.
- Surface performance target not clearly met: mailbox 512^2 bakes in 0.55-2.4 s and 1024^2 in about 2.2 s on this heavily loaded machine (targets 1.0 s and 1.5 s). Low-frequency fields are cached, but a row-split across 2-4 workers is the next step if it must be hit.
- Fluid performance: 48x36, 4 substeps per 1/60 s frame costs 0.7-0.8 ms per frame in Node under load (target 0.6 ms on a quiet desktop); momentum is about 60% of it.
- Blue noise 128 takes about 75 ms headless (doc says 40 ms); 64 takes about 20 ms. generateBlueNoise default sigma is 1.5 per the doc, where the spike used 1.9.
- Surface: the snag map and orm.r AO are not recomputed after abrasion or height edits. Secret hooks exist only for 001, 002, 003 and 007; the others depend on cloth/stat events that a hook cannot see.
- FluidTray (spike facade) is exported but not wired to TrayFluid and keeps its own frame (origin front-left, y away from the viewer).

## Known bugs

- At the default autoRock (6 / 2.5 degrees at 0.48 / 0.64 Hz) the tray spills (about 100 mL in 6 s) because it drives both fundamental modes. This matches the GDD's 'players eventually spill'. A 0.5 Hz rock at 6 degrees on x alone saturates at 41-42 mm against the 45 mm lip and does not spill; it spills from about 8 degrees. The spec's 'a 0.5 Hz rock at resonance spills' therefore holds at 8 degrees, not at the default amplitude.
- Surface recipe 004: the midrib is at x = +8 mm rather than the table's +12, so it enters the frame at 2:1, per the landmark rule.
- Dither: bayer-ign threshold maps tile IGN every `size` px (IGN is not periodic); harmless at 64 or larger.
- Surface timings in the selftest are noisy because other agents load the machine (the same mailbox 512 bake measured 0.54 s and 2.4 s in two runs).
- The shared Vite dev server can reload a dev page mid-eval when other agents edit files (it happened once; retrying with --wait 8000 worked).

## API deviations

- dither: applySurfaceDither accepts (material, o) with o.uniforms optional and defaulting to the most recently created OneBitPass (new setSharedSurfaceUniforms/getSharedSurfaceUniforms). The spike's (material, pass.surface, o) form still works.
- dither: getThresholdMap caches blue noise in localStorage under ar:dither:bn:<size>:<seed> (a derived cache, skipped under ?embed=poster, ?fresh=1, ?test=1 or persist=false), not through @shared/storage. The spike's ar1b: key is gone.
- dither: PALETTES.lamp is kept as an alias of canary's colours; bone/ruby/canary/prussian use the plates.md 7.1 hexes (bone is #191613/#E9E1CF, not the spike's).
- dither: ditherImage output is w x h with the cell option grouping thresholds. Float32Array input is 0..1, Uint8ClampedArray is 0..255.
- fluid: refill(depth) sets a flat free surface at `depth` above the base floor, so liquid is thinner over a plate; setFloor keeps volume and the surface. +tanY lowers the +y side (toward the viewer). poke(x, y, strength): strength 1 = 1 mm centre displacement. TrayBody.step().landed is the tray edge speed in m/s. FluidSnapshot has an optional extra `ext` field for bit-exact replay.
- fluid: the solver is the spike's staggered shallow-water solver (linear damping 0.8), not the GDD's pipe model; I added per-cell floor support and a tracer toggle to ShallowWater.
- surface: additive members on RecipeKit (cache, memo, rng, blend, solid), SurfaceRuntime.fields() and SurfaceBake.nLayers; additive exports bakeSync, setBakeMode, shadeMaps, createKit, WALK_PLAN, hasRecipe. layerT is layer-major (layer * res^2 + texel); heightMips[k] is level k + 1; the 'loose' dirty rect is in physRes cells, the others in bake texels.
- surface: cracks({curl}) returns negative mm of lift near plate edges. takeLoose returns the mean um actually taken per cell in the disc. WALK holds only registered recipes.

## Requests

- Game agents should import @shared/dither (pure) and @shared/dither/three separately; do not import the three entry from hub-safe code.
- vite.config.ts needs no change: the surface worker bundles as its own chunk (a scratch build of the three dev pages gave a 50 KB worker). Scratch config is in the session scratchpad if useful.
- Texturedle agents: SurfaceRuntime.fields().blisterMask is how a secretHook reads the recipe's masks. Dirty rects are in bake texels except 'loose', which is in physRes cells. Contact fields are not refreshed for bakes made with BakeOptions.maps.
- shared-platform/orchestrator: src/shared/core/index.ts and the testapi exist now. My dev pages import '@shared/core/testapi' directly. The surface module imports '@shared/core/noise' and '@shared/core/rng' directly (not the barrel) so the worker stays free of DOM modules; please keep those two files free of DOM imports.
- If surface bake speed matters for the integration review, a follow-up task could add a 2-4 worker row split in bake-client (the texel loop is 85-90% of the time).
