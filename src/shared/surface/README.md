# @shared/surface

Macro surfaces as pure functions of real millimetres, baked on the CPU in a worker (architecture section 4.11, texturedle.md 6.1 and 11.2). Hub-safe: no three, no DOM beyond `Worker` / `ImageData`.

```ts
import { bakeSurface, createRuntime, getRecipe, thumbnail, bakeMaps, POOL, WALK } from '@shared/surface'

const recipe = getRecipe('rusty-mailbox')
const bake = await bakeSurface(recipe, { ratio: 5, res: 1024, physRes: 256, seed: 1 })   // worker; sizeMm defaults to 1.06 * 36 / ratio
const rt = createRuntime(bake, recipe, previousRuntimeOrUndefined)                         // carryFrom keeps wear across ratios
rt.contactAt('marble', x, y, sample)  // { d, nx, ny, nz, layer }
const img = await thumbnail('rusty-mailbox', 256)                                          // ImageData, 2:1 frame, lamp 135 deg
const maps = await bakeMaps('rusty-mailbox', { sizeMm: 300, res: 512 })                    // albedo / normal / orm / height for a 3D prop
```

Dev page: `/src/shared/surface/dev/index.html` (library contact sheet, 5:1 close view, lamp slider). `__game.selftest()` (async), `__game.bench()`, `__game.sheet()`.

## Contents

- Types: `types.ts` is texturedle.md 11.2 block (A) verbatim plus the additions below. `RecipeKit` is spelled out with every 6.1 primitive and combinator.
- Recipes: 001 rusty-mailbox, 002 packing-bubbles, 003 dried-mud-rut, 004 laurel-leaf, 005 moss-fence-post, 006 oak-bark, 007 house-brick, 008 porch-boards, 009 coir-doormat, 010 brass-knocker, and `poster-peeling-paint` (`pool: false`). `listRecipes()`, `POOL` (answer pool), `WALK` (the 30-day plan restricted to registered recipes; `WALK_PLAN` is the full plan). Recipes 011-036 register in `recipes/index.ts` as they land.
- Bake (baker.ts): pass 1 a coarse 128^2 relief pass builds the `cavity()` / `convexity()` maps (and resets every `k.cache`); pass 2 evaluates the layer stack per texel (`H = form + (substrate relief + sum of thickness + top relief) / 1000`; top layer = highest with thickness > 0.5 um; a top layer thinner than 8 um is translucent over the one below); pass 3 AO, contact fields (marble r 1.5, burlap 0.45, lens 0.08 mm; cell = r/6, resolution 64..256), snag map, loose layer, audio heightfield (<= 512^2, high-passed at 1 mm), CPU height mips.
- Layout: texel (i, j) is centred at `-size/2 + (i + 0.5) * size/res`; row 0 is the bottom (+y up), like a GPU texture. `layerT` is layer-major: `layerT[layer * res^2 + texel]`, layer 0 = substrate. `heightMips[k]` is level k + 1.
- Runtime: `contactAt` (bilinear D, central-difference gradient), `materialAt`, `residueAt`, `snagAt`, `abradeBatch` (splat = x, y, rMm, depthUm; fractional wear accumulates per texel and whole micrometres come off the stack; returns the layers revealed and the colours removed), `polishBatch` (x, y, rMm, amount), `takeLoose` (returns the mean um actually taken per cell), `editHeight`, `markLooseDirty`, `onDirty`. Dirty rectangles are in bake texels, except `'loose'`, which is in `physRes` cells. Contact fields refresh inside the dirty rect plus the probe radius. `carryFrom` copies removed thickness, height edits and loose from the earlier runtime (same recipe and seed) wherever the new extent overlaps it.

## Additions and deviations

- Additive: `RecipeKit.cache(f, cellMm)`, `.memo(f)`, `.rng(salt)`, `.blend`, `.solid`; `SurfaceRuntime.fields()` (the lazily built recipe, so `secretHook` can read `blisterMask`); `SurfaceBake.nLayers`; `BakeOptions.maps` (render maps only); `bakeSync`, `setBakeMode('inline')`, `shadeMaps`, `createKit`, `WALK_PLAN`, `hasRecipe`.
- `cracks({ ..., curl })` returns crack depth (0..depth, in the caller's units) and **negative** values (mm of lift) near plate edges. `blobs`, `hexDomes` return heights in the unit you pass. `scratches` returns a 0..1 mask.
- Moss (005), laurel (004): the leaf midrib is at x = +8 mm (not +12) so it enters the frame at 2:1; the sporophyte stalks of 005 start outside |x|,|y| > 4 mm.
- Not done: the snag map is not recomputed after abrasion; AO (`orm.r`) is not recomputed after edits; secret hooks exist only where an event can decide them (001, 002, 003, 007); `letterbox` / other SHOULD recipes are not written.
- `thumbnail()` shades on the CPU (raking lamp, 10-step heightfield shadow, cavity AO, GGX-ish highlight); it is a preview, not the game's renderer.

## Measured (headless Chromium / Node on a machine loaded by other agents)

- Mailbox bake with worker: 512^2 about 0.55 s, 1024^2 about 2.2 s (target 1.5 s; Node, loaded). The texel loop dominates; low-frequency fields are cached on coarse grids (`k.cache`). A row-split across 2-4 workers would give about 3x if the target must be hit on slow machines.
- All recipes at 128^2: 60-270 ms each. Selftest (15 checks) passes in the browser.
