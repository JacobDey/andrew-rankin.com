# Materials spike: procedural macro-surface library

A GPU material generator for **34 real-world surfaces**, seeded and deterministic across GPUs, tileable, physically scaled in millimetres, with a gallery and inspector demo. The core (`core/`) is written so it can be copied to `src/shared/materials/` unchanged. It touches the DOM only through the `THREE.WebGLRenderer` you pass in.

Page: `http://127.0.0.1:5173/spikes/materials/` (`?big=1` gives larger cards, `?only=id,id` filters, `?open=id` opens the inspector, `?gallery=0` skips the gallery, `?seed=7`, `?thumb=256`, `?bake=2048`, `?spin=0`).
Final screenshot: `shots/spike-materials.png`.

## What was built

| Path | What it is |
|---|---|
| `core/index.ts` | Public API (re-exports everything below) |
| `core/generator.ts` | `MaterialGenerator`: field passes, surface pass, derive pass, readback, program cache, render-target pools |
| `core/glsl/toolkit.ts` | Shared GLSL ES 3.00 toolkit: integer hashing; value, gradient, simplex, Worley and Voronoi noise; fbm, ridged and billow fractals; domain warp; hex lattice; `isoLine`, `dome`, `psin`/`pcos`; `Surface` struct and `coat()` |
| `core/glsl/preprocess.ts` | `hex(#RRGGBB)` → exact linear `vec3` constants, computed in JS |
| `core/recipes/*.ts` | 34 recipes (18 single-pass, 16 split into field passes) |
| `core/catalog.ts` | Metadata: names, aliases, difficulty, Texturedle Atlas attributes, mm scales, physics hints, museum label. `lintCatalog()` |
| `core/guess.ts` | Guess matching: normalization, aliases, plurals, British spellings, typo and transposition tolerance |
| `core/view.ts` | `createMacroViewMaterial()` (raking light, ray-marched heightfield shadows, GGX, studio softbox reflections, parallax tilt, channel debug views) and `applyMapsToStandardMaterial()` |
| `main.ts`, `index.html`, `style.css` | Gallery (lit macro tile plus 3D sphere per material) and inspector (lamp, tilt, channels, rack-in with region re-bakes, guess box) |
| `spike-hooks.ts` | `window.__spike` test and measurement hooks |
| `tools/*.mjs` | `measure.mjs` (bench, determinism, periodicity, seams, view), `compile-ab.mjs` (first-use cost A/B), `diffmap.mjs` (where two GPUs disagree), `build.mjs` (production build of just this spike) |
| `results/*.json` | Raw measurement output |

## Core API

```ts
import { generateMaterial, getGenerator, CATALOG, getMaterialInfo, matchGuess, resolveGuess,
         createMacroViewMaterial, applyMapsToStandardMaterial, registerMaterial } from '@shared/materials'

generateMaterial(renderer: THREE.WebGLRenderer, id: string, opts?: GenerateOptions): Promise<MaterialMaps>
getGenerator(renderer): MaterialGenerator          // one per renderer: caches programs and pooled targets
gen.precompile(id: string, zoom?: boolean): Promise<number>   // compile ahead of time (e.g. behind a loader)
gen.trim(): void                                   // free pooled scratch targets (low-memory devices)
gen.dispose(): void

interface GenerateOptions {
  size?: number                 // px, square; default 1024. Use powers of two (see Determinism)
  seed?: number                 // uint32; default 1
  region?: { x, y, w }          // tile-UV window; default {0,0,1} = one seamless tile
  detail?: 'auto'|'base'|'zoom' // 'zoom' adds up to 4 fractal octaves where resolvable; auto = region.w < 1
  readback?: boolean            // fill heightData (Float32Array, mm) for physics
  readbackAlbedo?: boolean      // fill albedoData (RGBA8 sRGB) for 2D-canvas uses / share cards
  mipmaps?: boolean             // default true
  anisotropy?: number           // default 4
  finish?: boolean              // block until GPU done (benchmarks only)
}

interface MaterialMaps {
  id, info: MaterialInfo, size, seed, region, texelMm
  albedo:  Texture   // SRGB8_A8: rgb albedo, A = loose material (rust dust, grit) 0..1
  normal:  Texture   // RGBA8 tangent-space, OpenGL/three convention (+Y = +V); A = height / reliefMm
  orm:     Texture   // RGBA8 glTF ORM: R = AO, G = roughness, B = metalness, A = top-layer code
  roughness: Texture // same object as orm (three reads roughness from G, metalness from B)
  height:  Texture   // RGBA16F: R = height in mm, G = curvature 1/mm (+ convex), B = AO, A = loose
  heightData?: Float32Array; heightRange?: [min, max]; albedoData?: Uint8Array
  timings: { compileMs, gpuMs, readbackMs, totalMs }
  dispose(): void
}

createMacroViewMaterial(maps | null, { shadowSteps?, parallax?, exposure?, vignette? }): MacroViewMaterial
  .setMaps(maps) .setLight(azimuthDeg, elevationDeg, intensity?) .setTilt(uDeg, vDeg)
  .setMode('lit'|'albedo'|'height'|'normal'|'roughness'|'ao'|'metalness'|'curvature'|'loose')
  .setWindow(offsetU, offsetV, scale)
applyMapsToStandardMaterial(mat: MeshStandardMaterial, maps, repeat?: [u, v])  // textures are shared

CATALOG: readonly MaterialInfo[]; getMaterialInfo(id); allMaterials(); lintCatalog()
registerMaterial(info: MaterialInfo, recipe: RecipeDef)   // add a game-specific surface at runtime
resolveGuess(text, list?, minScore = 0.6): { id, score, matched }[]   // ranked
matchGuess(text, targetId): { correct, score, matched, best }
```

`MaterialInfo` holds `id`, `name`, `aliases`, `difficulty` (1–5), the Texturedle Atlas tiles (`family`, `habitat`, `hardness`, `grain`, `wear`; unique per entry, enforced by `lintCatalog`), `tileMm`, `reliefMm`, `physics` (`muS`, `muK`, `restitution`, `rolling`, `residue` hex, `residueAmount`, `body` sound preset) and a one-fact museum `label`.

Typical use:

```ts
const maps = await generateMaterial(renderer, 'rusty-mailbox', { size: 1024, seed: dayNumber, readback: true })
plane.material = createMacroViewMaterial(maps)          // Texturedle specimen view
applyMapsToStandardMaterial(prop.material, maps, [3, 2]) // Studio / Lensbench props
physics.setHeightfield(maps.heightData!, maps.size, maps.texelMm)   // mm units throughout
// rack in: same features, finer texels and extra octaves
const zoomed = await generateMaterial(renderer, 'rusty-mailbox', { size: 1024, seed: dayNumber, region: { x: 0.375, y: 0.25, w: 0.125 } })
```

## Pipeline

1. **Field passes** (multi-pass recipes only). Each `field(uv)` program writes an RGBA32F target. Field *i* can read fields 0..i-1 (for example, a domain warp computed once).
2. **Surface pass.** `surface(uv)` returns `{height mm, albedo, rough, metal, loose, layer}` through MRT into RGBA32F plus RGBA16F (pooled). It reads fields with an exact `texelFetch` at its own pixel: `F0()..F3()`.
3. **Derive pass.** Sobel normals in real units, curvature at a fixed radius in mm, 8×6 horizon AO with radii in mm (scaled by `reliefMm`). It writes four owned outputs (albedo sRGB, normal, ORM, height16F) with mips.
4. **Optional readback.** `readRenderTargetPixelsAsync` (PBO + fence, non-blocking). Render state is restored *before* any await, so a render loop can keep drawing.

Recipes work in **tile UV** (one tile = `info.tileMm`). Every lattice function takes an integer period, and recipes ask for `nc(featureMm)` cells per tile. Everything wraps, and a region bake of part of a tile shows exactly the same features at a higher texel density.

## Writing recipes (rules learned the hard way)

- Use `hex(#RRGGBB)` for colours, `MM(mm)` for distances and `nc(mm)` for "cells of this size per tile"; heights are in millimetres. `+V` is "up" on the object (rust runs go −V).
- **Periodicity:** any periodic function must complete whole cycles per tile. Use `psin(TAU * k * uv)` with integer `k` (denim and burlap initially had 2.4 and 3.2 cycles per thread, which made seams). Shears like `uv.x + uv.y` must use integer coefficients that are multiples of the period. Anything derived from absolute `uv * uTileMm` (rather than a cell-relative vector) breaks tiling.
- **Never call `sin`, `cos` or `atan`.** Use `psin` and `pcos` (exact `fract` range reduction plus a polynomial, error about 0.001). Built-in trig differs between vendors (D3D11 only guarantees about 8×10⁻⁴), and through thin-line thresholds that produced whole-texture differences (frost: 3% of texels off by up to 11/255).
- **Budget per program: about 25 noise-call equivalents.** gnoise = 1, fbm(k) = k, Worley = 3, full `voronoi()` (with border distance) = 8–10. Above that, split the recipe into `{ fields: [...], surface }` (see Compile cost). Writing the split is mechanical; `RUSTY_MAILBOX_SINGLE` and `RUSTY_MAILBOX` show the before and after.
- `isoLine` and `aastep` use derivatives: call them only from uniform control flow (they work fine in field passes).
- No data-dependent `break` inside loops (see Gotchas).
- Thin features should go through `isoLine(f, widthMm)` or `detail(featureUv)`, so they fade by coverage instead of aliasing at small bake sizes.

## Measured performance

Hardware: AMD Radeon RX 580 through ANGLE/D3D11 (Chrome headless `--enable-gpu`), and SwiftShader (the default headless harness), on a shared, loaded machine (other agents were running), so treat these as upper bounds.

| | median | p90 | max |
|---|---|---|---|
| RX 580, 1024² bake, warm (all passes + mips, GPU-fenced) | **8.6 ms** | 12.6 | 15.1 (oak) |
| RX 580, 2048² bake, warm | **32 ms** | 70 | 89 (oak) |
| RX 580, 1024² **zoom** variant, warm | 12.5 ms | 18.7 | 27.5 (mailbox) |
| RX 580, **first use** (compile + link + first 1024² bake) | **0.44 s** | 0.73 s | 1.4 s |
| SwiftShader, 512² bake, warm | 190 ms | 283 | 341 |
| SwiftShader, first use at 512² | 330 ms | 480 | 640 |
| SwiftShader, whole gallery (34 × 512², bake + 2 renders + readback) | **17.8 s** | | |
| Macro view frame, RX 580, 1560×1080, 0 / 12 / 24 / 48 shadow steps | 1.18 / 1.67 / 1.72 / 2.27 ms | | |
| Macro view frame, SwiftShader, 920×800, 24 steps | 328 ms | | |

Per-material numbers are in `results/bench-*.json`.

**Phone estimates.** A mid-range phone GPU (Adreno 6xx / Mali-G57 class) is roughly 20–40× slower than an RX 580:

- Bakes: about 2–4 ms per material at 256², 15–25 ms at 512², 150–350 ms at 1024².
- Macro view: about 25–40 ms per frame at 24 steps at full phone resolution. Use 12 steps at 0.75× render scale, which is about 12–20 ms.
- First use: Android GLES drivers compile these small programs in roughly 100–400 ms. iOS is similar.

Memory per 1024² material (owned): about 27 MB with mips. Transient pools: about 24 MB (surface pass) plus 16 MB per field target. At 2048², multiply by 4. Call `trim()` after baking.

Bundle: the core is 155 KB of source (47 KB gzipped, mostly GLSL strings and comments). The demo bundle is 677 KB / 178 KB gzipped including three.js.

## Determinism (same seed ⇒ same surface)

Measured SwiftShader (CPU) against the RX 580 (D3D11/FXC): two unrelated compiler stacks.

- **All 34 materials:** albedo within ±1/255, height within 1 µm (the quantization step). That holds for full-tile bakes (`results/determinism-128.json`) and for racked-in zoom-variant region bakes (`results/determinism-zoom-128.json`).
- How it works: integer-only hashing (lowbias32) of wrapped integer lattice coordinates; integer-only wrapping (`uint % uint`); uv derived from `gl_FragCoord` times power-of-two steps (exact); colour constants computed in JS; fields stored as exact float32.
- Keep sizes and region origins **dyadic** (powers of two; the inspector snaps rack-in regions to w = 2⁻ᵏ and origins to w/8) so uv arithmetic stays exact.
- Not bit-exact by construction: float interpolation can differ in the last bit, so a texel whose value sits exactly on a hard threshold can flip. In practice that is ±1/255, as measured above.
- **Iterative simulation is not deterministic across GPUs.** Reaction–diffusion, erosion or any ping-pong loop amplifies last-bit differences into visibly different patterns. That is why reaction–diffusion was left out of the shared library. Use it only for decoration that never needs to match between players.
- Physics on `heightData` sees ≤1 µm differences between devices: identical for gameplay, but don't expect bitwise-identical marble trajectories.

## Tiling

Exact test: bake region `{0.5, 0.5, 1}` and compare it with the `{0,0,1}` bake rolled by half a tile. **All 34 match** (height ≤ 0.27 µm, albedo ≤ 1/255; `results/periodicity-128.json`). This also proves region bakes are consistent with full-tile bakes. The simpler edge-difference "seam ratio" is biased whenever a tile edge lands on a periodic feature (a thread gap or a mortar line), so don't use it as a gate.

## Compile cost (the big finding)

On Windows Chrome (ANGLE → HLSL → FXC), shader compile time is **strongly superlinear in program size**.

Synthetic recipe, gnoise calls (+1/8 as many Voronoi) → first use:

| calls | first use |
|---|---|
| 8 | 0.8 s |
| 16 | 2.1 s |
| 32 | 5.5 s |
| 64 | 18.5 s |
| 128 | 90 s |

Per primitive, roughly: gnoise 45 ms, Worley 70–180 ms, fbm(4) 150–350 ms, full Voronoi 190–880 ms.

The first single-pass rusty mailbox (about 60 noise calls) took **9–10 s** to first pixel. Fixes, all interleaved-A/B measured in one browser session:

1. Cheaper hash (lowbias32 per corner instead of pcg3d, wraps hoisted per axis): about 2× faster compile and 1.5–2× faster bakes.
2. **Splitting heavy recipes into field passes:** mailbox 4.1 s → 0.57 s, cracked mud 1.77 → 0.27 s, granite 1.33 → 0.30 s. Small programs compile superlinearly cheaper, and ANGLE can build them in parallel. All 34 recipes are now ≤ ~0.8 s first use on this machine (most 0.2–0.5 s).
3. Tried and rejected:
   - opaque (uniform) loop bounds: within ±15%
   - dynamic octave loops: bakes 2× slower, compile no better
   - arithmetic gradients instead of a constant table: compile slower

`tools/compile-ab.mjs` exists so recipe authors can check a change against this budget.

## Gotchas

- **ANGLE/D3D11 miscompiled one big shader.** In single-pass galvanized, a `smoothstep` of the Voronoi border distance read a wrong value in ~19% of texels on the GPU (up to 187/255). The same expression written at the end of the same shader was correct, and every workaround inside the big shader failed. Splitting the Voronoi into a field pass fixed it. That is another reason to keep programs small.
- **A data-dependent `break` inside an unrolled fractal loop** (`if (i >= oct && pxl > 0.65) break`) **lost the WebGL context** (GPU reset) for burlap's zoom variant at 1024² only. Use constant-bound loops and fade instead. The generator now throws a clear error when the context is lost, instead of silently returning empty maps.
- Float render targets: these need `EXT_color_buffer_float` (WebGL2; about 97%+ of devices). Without it the generator throws. A RGBA16F or 16-bit-packed RGBA8 fallback is described but not implemented.
- RGBA32F is not filterable without `OES_texture_float_linear`. The pipeline only `texelFetch`es float targets, and the sampled height map is RGBA16F (always filterable).
- `readRenderTargetPixelsAsync` awaits a fence. Restore render target and state before awaiting; the first version let the inspector's rAF loop draw into the material's own MRT target.
- Metals look black under a lone raking light with an orthographic camera: they need something to reflect. The macro view uses a per-pixel ~20° lens view vector and a procedural softbox and strip-light studio.
- Vinyl is physically right but reads dark from straight above: 45° groove walls mirror the horizon. Flat glossy lands catch the softbox. In-game, let the lamp swing.
- Shared dev server: Vite's dependency optimizer (shared by all the parallel agents) full-reloads open pages and was wedged for about 40 minutes (504 "Outdated Optimize Dep", no `node_modules/.vite/deps`). `tools/build.mjs` plus `measure.mjs --dist` bypass it: a production build served through Playwright request interception, with no server. The shared server may still need a restart.
- Three.js `RawShaderMaterial` uniforms of GLSL type `uint` work (`uniform1ui`). Gradient-table indexing uses the top 4 hash bits.

## Quality knobs (phones)

| Knob | Desktop | Phone |
|---|---|---|
| Bake size | 1024 (2048 hero zoom) | 512 (1024 zoom) |
| Zoom detail (`detail: 'zoom'`) | on for region bakes | on (≈1.4× bake cost) |
| Macro view `shadowSteps` | 24 | 12 (0 = off, 30% cheaper) |
| Macro view render scale (DPR cap) | 1.5 | 0.75–1 |
| Parallax iterations | 4 | 2 (or `parallax: false`) |
| AO in derive pass | 8 dir × 6 radii | fine as is (one-off cost) |
| Gallery thumbnails | 512 | 256 |

## Recommendations for the real implementation

1. Lift `core/` to `src/shared/materials/` as-is. Keep `tools/` next to it as the regression suite (determinism, periodicity, compile budget).
2. **Cache bakes in IndexedDB**, keyed by `(id, seed, size, region, toolkitVersion)`. Cold start then happens once per device, and later visits load PNG/KTX2 in milliseconds. Hub previews (no WebGL) can use `readbackAlbedo` exports.
3. Precompile the day's material(s) behind the loader with `gen.precompile(id, zoom)`. Texturedle should bake each magnification step as a dyadic region at 1024 (512 on phones) with `detail: 'zoom'`.
4. Gate CI on: `measure.mjs determinism` (SwiftShader vs one hardware GPU), `measure.mjs periodicity`, and `compile-ab.mjs` first use < 1 s per material on Windows/ANGLE.
5. Texturedle physics wants per-texel μ, residue, layer and hardness. The maps already carry `loose` (albedo.a), `layer` (orm.a) and curvature (height.g). Map `layer` codes to per-layer physics through the catalog. Abrasion means editing the height and `layer` textures with `texSubImage2D`, plus a matching CPU edit of `heightData`.
6. To grow the Atlas toward ~300 entries, use `registerMaterial()` and the layered grammar (`coat()`, curvature-driven wear) instead of new files for every noun. Keep each program within budget.

## Reproduce

```bash
node spikes/materials/tools/build.mjs <outDir>                                 # optional: bypass the dev server
node spikes/materials/tools/measure.mjs bench --gpu [--dist <outDir>] --size 1024 --reps 3 [--detail zoom]
node spikes/materials/tools/measure.mjs determinism [--zoom] --dist <outDir> --size 128   # SwiftShader vs --gpu
node spikes/materials/tools/measure.mjs periodicity --dist <outDir> --size 128
node spikes/materials/tools/measure.mjs view --gpu --dist <outDir> --w 1920 --h 1080
node spikes/materials/tools/compile-ab.mjs --gpu --dist <outDir> [--ids a,b] [--recipe name=file.ts:EXPORT] [--synthetic 8,16,32]
node spikes/materials/tools/diffmap.mjs <id> --dist <outDir>                    # ASCII map of device disagreement
node scripts/shoot.mjs spikes/materials/ --steps '[{"waitFor":"body[data-ready=\"1\"]","ms":200000}]'
```

`window.__spike` hooks:

- state: `ready`, `caps`, `catalog`, `timings`, `current()`
- inspector: `open(id)`, `close()`, `setLight`, `setTilt`, `setMode`, `setRing`, `setZoom(z, u, v)` (returns the bake promise), `frames(n)`, `waitBaked()`
- measurement: `bench`, `seams`, `periodicity`, `fingerprint`, `fingerprintData`, `viewBench`, `compileProbe`, `passSources`
- matching and catalog: `match`, `resolve`, `lint`, `registerTest`, `splitEquivalence`

## Weak spots / next steps

- Visual quality is good for a guessing game, not photoreal everywhere. Weakest: vinyl (dark from straight above), corduroy (reads slightly like dowels under hard raking light), oak bark (heavy black furrow shadows). Strongest: mailbox, brick, leaf, cracked mud, golf ball, toy brick, burlap, birch, marble, moss, peeling paint.
- Zoom detail adds fractal octaves only. Voronoi-based micro features (grains, pores) don't gain sub-structure at 5:1; hero recipes should add explicit micro layers gated by `detail()`.
- No anisotropic BRDF, so brushed aluminum's streak highlight is approximated by roughness and normal streaks.
- No offscreen or worker baking yet. `OffscreenCanvas` plus a worker renderer would remove main-thread stalls during the GL link, at the cost of a second GL context (textures can't be shared, so you'd ship ImageBitmaps).
- Texturedle's "mm-space re-bake per magnification" is supported through dyadic regions; non-dyadic magnifications (5:1, 3:1) work too but are only ±1-ULP deterministic, not exact.
