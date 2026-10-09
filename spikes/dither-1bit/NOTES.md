# Spike: `dither-1bit`: Obra-Dinn-style 1-bit rendering for three.js

Page: `http://127.0.0.1:5173/spikes/dither-1bit/` (`?clean` hides the UI for screenshots).
Status: **works, measured, ready to lift.** Every technique here is an original implementation.

## TL;DR

- `OneBitPass` replaces `renderer.render(scene, camera)` with the following chain, all at an internal 640x360-class resolution:
  lit scene → normals from depth → tone + stabilised threshold + 1 px outlines → integer nearest upscale with a 2-colour palette.
  The post chain costs **0.14-0.44 ms on an RX 580** (RX 580 is the desktop test GPU), measured up to a 3840x2400 canvas.
- **Swimming is solved.** On a pure camera rotation, bits that change on the same surface point:
  - screen-space dither: **42.8%**
  - sphere-mapped dither: **0.08%**

  With the sphere centred on an **anchor point** (`AnchorTracker`, uses the depth buffer), a 1-5 cm lean or sway also stays at **0.1%** (screen-space: 45%).
  While walking it re-anchors every 20 cm with a 4-frame Bayer dissolve: **5.0%** at 1 m/s (screen-space 26%).

  The one real limit: away from the anchor axis texels stretch, worst at the frame edges (cos²). Bigger turns therefore re-anchor every few degrees with a dissolve; see Stabilisation.
- **A developing photograph reads clearly in 1-bit.** With the print filling the view, the Pearson r between the blurred 1-bit image and the continuous tone is **0.989**, MAE 0.023 (plain 0.5 threshold: r 0.875, MAE 0.128).
  The caption "No. 7 CAUL ROCK NOV. 1879" (serif, about 19 px tall in the internal buffer) stays readable from about 70% development through over-development (`shots/spike-dither-1bit-develop.png`).
- Blue noise is generated at runtime with **void-and-cluster**:
  - 64x64 in 26 ms in Chrome (40 ms cold in Node), 128x128 in ~0.25 s
  - cached in memory and in localStorage
  - deterministic per seed
  - low-frequency energy 0.07% of total, against 7.3% for white noise
- Extras the games asked for in `docs/design`:
  - surface-anchored "grain on the paper" that develops grain by grain
  - artist **seam lines** (line IDs packed in scene alpha, no extra pass)
  - blue-sensitive and orthochromatic luminance
  - 11 palettes from the design docs, with a 3-frame Bayer palette dissolve

## Files

```
core/                       <- lift this into src/shared/onebit/ (pure TS + three, no DOM except localStorage cache)
  OneBitPass.ts             the post-process class (render targets, uniforms, size, readback, profiling)
  shaders.ts                GLSL: geom (normals from depth), composite (tone/threshold/outlines), blit (palette)
  noise.ts                  void-and-cluster blue noise, Bayer, clustered-dot; cached threshold maps
  anchor.ts                 AnchorTracker: automatic sphere-dither anchoring (travel + texel-stretch triggers, dissolves)
  palettes.ts               PALETTES (design-doc colours), LUMA weights (eye / blue-sensitive plate / ortho)
  developingPrint.ts        DevelopingPrintMaterial: image comes up shadows-first; optional grain on paper
  surfaceDither.ts          applySurfaceDither(): any material thresholds itself in UV space (grain stuck to glass)
  lineId.ts                 applyLineId(): seam lines from per-material or per-vertex IDs
  analysis.ts               test metrics: captureFrame, swimMismatch (reprojection), legibility, projectRect
  index.ts                  re-exports
demo/                       demo-only: ship cabin built from primitives, station camera rig, procedural photo
main.ts, index.html, style.css   demo page + window.__spike test hooks
```

## Core API

```ts
import { OneBitPass, AnchorTracker, DevelopingPrintMaterial, applyLineId, applySurfaceDither, PALETTES, LUMA } from './core'

const pass = new OneBitPass(renderer, {
  palette: 'bone',                 // PaletteName | { ink: '#141210', light: '#E6DFCB' }
  pixelScale: 'auto',              // integer upscale, or 'auto' -> nearest integer giving ~targetLongSide px
  targetLongSide: 640,             // 640 = 640x360 at 16:9; portrait phones get e.g. 293x633 @4x
  ditherMode: 'sphere',            // 'sphere' | 'world' | 'screen' | 'none'
  pattern: 'bluenoise',            // 'bluenoise' | 'bayer' | 'cluster'
  noiseSize: 64, noiseSeed: 1,
  outline: { enabled: true, color: 'auto', creaseAngle: 35, depthAbsolute: 0.012, depthTolerance: 0.004,
             maxDistance: 30, autoThreshold: 0.18, ids: true },
  tone: { exposure: 1.6, whitePoint: 6, gamma: 1.4, contrast: 1.5, bias: 0, luma: LUMA.rec709 },
  hdr: true,                       // RGBA16F scene buffer when EXT_color_buffer_(half_)float exists
  world: { texel: 0.0015, lodBias: 0.25 },
})

// per frame, after camera moves:
anchor.update(pass, camera)        // const anchor = new AnchorTracker({ maxDistance: 0.2, maxStretch: 1.2, dissolveFrames: 4 })
pass.render(scene, camera)         // or pass.render(scene, camera, someRenderTarget)

// after resize (pass reads renderer.getDrawingBufferSize itself):
pass.syncSize(); camera.aspect = pass.aspect; camera.updateProjectionMatrix()
```

| Method / field | Notes |
|---|---|
| `render(scene, camera, target = null)` | Full chain. Restores the renderer's target, autoClear and clear alpha. |
| `setPalette(p, frames = 0)` | `frames > 0` gives a Bayer cross-dissolve over N rendered frames (plates-craft §4). |
| `setDitherMode(m)`, `setPattern(p)`, `setPixelScale(s, targetLongSide?)` | Cheap: uniforms only. A pattern change re-uploads a 4 KB texture. |
| `setOutline(partial)`, `setTone(partial)`, `setWorld({texel, lodBias})` | Uniforms only. |
| `setDitherAnchor(q, pos = null, dissolveFrames = 0)` | Sphere-mode anchor. `pos` set: the sphere is centred on that point (translation-stable). `AnchorTracker` drives it for you. |
| `setScreenOffset(x, y)` | Screen mode only: deliberate "boil" by whole pixels. |
| `width`, `height`, `scale`, `aspect` | Internal buffer size, the integer upscale, and the aspect to give the camera. |
| `debugView` | `'final' \| 'tone' \| 'edges' \| 'normals' \| 'split'` (`split` = 1-bit left, continuous tone right at `split`). |
| `surface` | Shared uniforms (`tNoise`, tone, luma) for materials that dither themselves. |
| `readBits(): { width, height, rgba }` | Synchronous readback. R = bit, G = outline, B = pre-dither tone. Tests, share-card PNGs, "legibility measured, not scripted" (latent-game §2). |
| `targets` | `{ scene, geom, bits }` render targets (for example, show `bits` on a CRT mesh). |
| `profile = true` → `timings` | CPU-side per-stage ms with a forced GPU sync after each stage (costs a stall: debugging only). |
| `dispose()` | Releases everything the pass created. |

```ts
// Developing print (darkroom, plates, latent). R(p) = T^p: shadows first, over-development keeps darkening.
const m = new DevelopingPrintMaterial({ image: tex /* sRGB */, paper: '#f2ede2', negative: false,
  grain: { uniforms: pass.surface, cells: [400, 300], maxFootprint: 1, seed: 3 } })   // grain optional
m.develop = 0..2; m.chemFog = 0..1; m.setImage(tex); m.grain?.uSdMaxFoot.value = 0 /* grain off */

applySurfaceDither(anyLitMaterial, pass.surface, { cells: [744, 960], maxFootprint: 1, seed })  // plates grain field
applyLineId(material, { id: 7 })                 // seam outline around this material
applyLineId(material, { attribute: 'lineId' })   // per-vertex IDs (merged static meshes: see demo/cabin.ts Merger)
generateBlueNoise({ size: 64, sigma: 1.9, seed: 1 }) -> Float32Array ranks (0,1)
getThresholdMap('bluenoise' | 'bayer' | 'cluster', size, seed) -> Uint8Array (cached)
```

## Pipeline

| Pass | Res | Reads | Writes | Work per px |
|---|---|---|---|---|
| 1 scene | internal | the game's scene | RGBA16F colour (SRGB8_A8 fallback) + 32-bit depth texture | the game's materials |
| 2 geom | internal | depth | RGBA8: octahedral view normal (RG) + 16-bit log depth (BA) | 9 depth taps |
| 3 composite | internal | colour, geom, threshold map | RGBA8: R bit, G outline, B tone | 1 colour + 5 geom + 2 alpha + 1 noise tap |
| 4 blit | canvas | bits (+geom for the debug view) | canvas | 1 tap, palette mix, Bayer dissolve |

- **Normals come from depth, so there is no normal pass or MRT.** For each axis, the shader takes the side whose two samples best extrapolate to the centre in 1/z, which is linear on planes (Turánszki's method).
  That gives exact face normals right up to creases and silhouettes, which is what crease detection needs.
- **Silhouettes:**
  - Extend the pixel's plane (P, n) along each neighbour's ray.
  - If a neighbour lies behind that plane by more than `max(0.012 m, 0.004 * distance)`, this pixel is the near side of a depth step.
  - The result is a 1 px line on the object. Floors at grazing angles never sprout lines.
  - A world-space tolerance stops 4 cm steps flickering in and out. An earlier relative 1/z second-difference test produced dashed lines at about 3 m.
- **Creases:** a one-sided normal test against the right and up neighbours on connected surfaces, above 35° (plates-craft §4: "engraving, not comic book"), which keeps lines 1 px wide.
- **Seams:** the line ID in scene alpha changes between connected neighbours. Alpha = 1 - n/256 with n in 1..63; surface-dithered texels carry the same ID shifted down by 0.5.
- **Line colour `auto`:** ink lines on lit surfaces and light lines where tone < 0.18. This is what makes shadowed geometry readable.
- **Tone:** exposure → extended Reinhard (white point 6) → gamma 1.4 → contrast 1.5.
  Physically lit rooms span 100:1 between lantern and far wall; without the shoulder the paper next to the flame clipped solid and the print vanished.

## Stabilisation: what was tried, with numbers

Metric (`analysis.swimMismatch`):
- Reproject every pixel of frame B into frame A through depth and both camera poses.
- Keep mid-tone pixels (0.12-0.88) that land within `tol` px of a pixel centre on the same surface, excluding outlines.
- Count how often the bit differs.

0% means the pattern is glued to the world. Random re-thresholding scores about 45%.

| Motion | screen | sphere (camera-centred) | **sphere (anchor point)** | world (triplanar) |
|---|---|---|---|---|
| yaw 3 px (integer) | 42.8% | 0.08% | **0.08%** | 6.2% |
| yaw 2.4 px + pitch 1.3 px | 41.2% | 0.07% | **0.07%** | 7.5% |
| dolly 1 cm (lean / sway) | 44.9% | 44.3% | **0.11%** | 4.6% |
| dolly 5 cm | 43.2% | | **0.09%** | 4.7% |
| walk 1 m/s, 30 frames, tol 0.05 | 26.2% | 26.8% | **5.0%** (incl. 2 re-anchors) | 2.3% |
| walk 0.6 m/s + turn 12°/s | 49.4% | 24.4% | **4.4%** (1 re-anchor) | 2.5% |

- **Sphere mode (default)** projects the direction to each pixel's surface point onto a cube face aligned with an anchor orientation.
  - Perspective projection is itself a gnomonic projection, so when the camera faces the anchor the texels are exactly the screen grid (1:1). The blue noise stays pristine.
  - Rotating the camera moves the pattern with the world, but the face is not 1:1 away from the anchor. At screen angle α after a turn θ the texel scale is cos²(α+θ)/cos²(α), so the **frame edges** stretch first.
    - With this demo's 88° horizontal FOV, a 4° turn already gives 1.15x at the left edge, which visibly clumps (`shots/spike-dither-1bit-stretch.png`).
    - A 50° FOV tolerates about 8°.
    - `AnchorTracker` measures this every frame: the Jacobian of the camera-to-anchor homography at the 4 corners and 4 edge midpoints. It re-anchors (with a dissolve) when the stretch exceeds `maxStretch` (1.2).
    - The trade-off: a lower bound gives more frequent dissolves (a shimmer) while turning; a higher bound gives clumping at the edges. Narrower FOVs make both better.
  - The forward cube face covers rays up to ~78° off-axis, so wide and ultrawide FOVs (hfov > 90°) have no face seam while at rest.
  - Odd internal sizes get a half-texel shift so pixel centres never sit on texel edges. Set `camera.aspect = pass.aspect` so the grid is exactly 1:1.
- **The anchor point** is this spike's addition beyond plain sphere mapping.
  - Centre the sphere on a fixed point A (not the camera) and use depth to get each pixel's world position. The direction A→P never changes for a static scene, so the pattern is glued under translation as well.
  - The cost is density drift: a surface at depth D is magnified about 1 + travel/D. At 28 cm of travel the lens board at 0.5 m visibly clumps, so `AnchorTracker` re-anchors after 0.2 m (or `0.25 * depthHint`), or when rotation stretches texels past `maxStretch`.
  - Re-anchoring uses a 4-frame 4x4-Bayer dissolve between the old and new anchors, one lookup per pixel. Background pixels (no depth) fall back to the view ray.
- **World mode** is a triplanar texture with power-of-two octaves picked from the pixel footprint.
  - Octaves are cross-faded with `blendUniform`: the CDF of the sum of two uniforms, so blending keeps tone exact instead of pulling thresholds to 0.5.
  - Footprint uses Euclidean distance, not view depth, which makes the octave choice rotation-invariant (6.9% → 6.2%).
  - It works, but texels are 1-2 px: it reads as film grain, coarser than sphere mode (see the gallery). Seams appear where the triplanar axis switches.
  - LOD bias trades the two: -0.5 gives 9.9% / 7.5% swim (finer), +0.5 gives 5.1% / 4.0% (coarser).
- Some of the world and walk residual is a measurement floor: with texels near 1 px, sub-pixel reprojection crosses texel edges. At `tol` 0.2 the floor is about 10%, at 0.05 about 2%.

## The developing photograph

- `DevelopingPrintMaterial`:
  - target reflectance T = image luminance; R(p) = T^p (first-order kinetics)
  - shadows come up first, p = 1 is normal development, p = 2 is crushed but still readable
  - fog greys the sheet in proportion to development
  - negative mode uses T = 1 - L
- Legibility (`legibilityTest`) compares blurred bits with blurred pre-dither tone (5x5 box) over the print's screen rect:

| View | blue noise (sphere) | world | screen | Bayer | halftone | **no dither (0.5)** | grain on paper |
|---|---|---|---|---|---|---|---|
| Loupe (print about 500 px wide) | **r 0.989**, MAE 0.023 | 0.977 | 0.988 | 0.986 | 0.967 | 0.875, MAE 0.128 | 0.988 |
| Tray (print about 200 px, oblique) | **r 0.947**, MAE 0.052 | 0.939 | 0.946 | | | 0.853 | (inactive: grain < 1 px) |

- **Grain on paper** (`surfaceDither`):
  - The material thresholds its own lit colour against the threshold map in UV-cell space and subtracts 0.5 from alpha (keeping its line ID); the composite then only applies 0.5 and outlines there.
  - It is only active while one grain covers at least 1 screen pixel (`fwidth`); smaller grains fall back to the global dither, so the far view never aliases.
  - Each grain has a fixed threshold, so developing flips grains one by one, in place ("every pixel is a silver grain", plates-craft §0).
  - Threshold-map tiles are hash-offset per tile so 400 cells don't show the 64-px repeat.
- PNG import (button or drag-and-drop) swaps the image on the print, the drying line and the negatives.

## Performance

Measured with `__spike.bench(n)`:
- per-stage numbers force a GPU sync after each stage
- `rawMs` = N frames with one sync at the end (throughput)
- `postOnly` = the post chain on an empty scene

Demo scene: about 37-41k tris, 13 merged static draws plus about 50 dynamic meshes, 4 lights.

| | internal | scene+shadows | geom | composite | blit | **total (synced)** | rawMs | post only |
|---|---|---|---|---|---|---|---|---|
| SwiftShader (headless default), high, 1280x800 | 640x400 @2 | 84 | 5.4 | 27 | 15 | **132 ms** | 133 | 40 |
| SwiftShader, mid | 640x400 @2 | 33 | 5.7 | 26 | 15 | **79 ms** | 74 | 39 |
| SwiftShader, low | 427x267 @3 | 10 | 3.0 | 12 | 14 | **39 ms** | 37 | 25 |
| RX 580 (ANGLE D3D11, `--gpu`), high, 1280x800 | 640x400 @2 | 4.9 | 1.1 | 1.0 | 0.8 | 7.9 ms | **1.84** | **0.20** |
| RX 580, mid | 640x400 @2 | 2.4 | 0.7 | 0.7 | 0.7 | 4.4 ms | **1.52** | 0.37 |
| RX 580, low | 427x267 @3 | 2.3 | 1.0 | 0.6 | 0.7 | 4.6 ms | **0.61** | 0.14 |
| RX 580, 3840x2400 canvas (DPR 3), mid | 640x400 @6 | 2.6 | 0.7 | 0.7 | 1.0 | 5.0 ms | **1.16** | 0.44 |
| RX 580, phone canvas 1170x2532 (DPR 3), mid | 293x633 @4 | 3.2 | 1.0 | 1.0 | 1.0 | 6.2 ms | **1.8** | 0.23 |
| RX 580, phone canvas 1170x2532, low | 234x507 @5 | 1.8 | 1.0 | 1.0 | 1.1 | 4.9 ms | **0.41** | 0.22 |

The synced per-stage numbers include about 0.4 ms of readPixels stall per stage. Use `rawMs` and `postOnly` for budgets.

Bundle: the demo builds to 807 KB JS (210 KB gzip), almost all of it three. `core/` is 75 KB of TS source (25 KB gzip, comments included).

**Mid-range phone estimate** (Adreno 6xx / Mali-G5x/G6x, roughly 8-12x slower than an RX 580 in fill and ALU):
- post chain 2-3 ms at DPR 3
- frame total about 4-6 ms on `low`, 15-20 ms on `mid` (the point-light cube shadow is the cost)

Recommendation: phones default to **`low`** (no point shadows), or `mid` with a 256 px cube shadow updated every 2nd frame (implemented). Desktop `high`.

**Quality knobs, cheapest first:**
- `targetLongSide` (640 → 480)
- shadows off, or a cube map of 256 px updated every N frames (`renderer.shadowMap.autoUpdate = false` + `needsUpdate`)
- `outline.enabled`
- `hdr: false` (SRGB8 scene buffer; loses highlight headroom)
- renderer pixel ratio cap: the blit is the only full-res pass
- merge statics per material (the demo has 13 static draws instead of ~400)

## Gotchas found along the way

1. **Sub-pixel gaps onto the void become dashed lines.** Plank gaps of 5-8 mm with nothing behind them flicker as dashed silhouettes. Abut the planks and put a skin behind walls. Use line IDs for the seams instead.
2. **Point-light shadows of thin rods are huge.** A 4 mm lantern-cage rod 6 cm from the light throws a 5 cm wedge across the print. A real flame (about 2 cm) would wash it out. Turn small occluders near the light off for shadows (or give them penumbra).
3. **Inverse-square lighting needs the tone shoulder.** With a plain clip, everything within about 1 m of the lantern goes solid white, including the print being developed.
4. **`Material.fog` is three's flag.** Don't name a uniform getter `fog` on a material subclass (hence `chemFog`).
5. **Alpha is a channel the pass owns.** Transparent materials blend into it.
   - Use `CustomBlending` with `blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor` so they keep the destination alpha (demo: developer liquid).
   - The pass forces clear alpha to 1.
6. **Camera aspect must be `pass.aspect`.** The internal size is `ceil(buffer / scale)`, so it can differ from CSS aspect by a pixel; a mismatch breaks the 1:1 sphere grid (duplicated columns).
7. **Shader compile is slow** on first frame (about 5-8 s in SwiftShader; noticeable on phones too). Call `renderer.compile(scene, camera)` (or `compileAsync`) behind the loading strip.
8. **The blue-noise cache key is versioned** (`ar1b:bn:v2:*`). Bump it if the generator changes or old devices keep stale maps. 128x128 takes about 0.25 s: run it in a worker or ship the bytes.
9. **Flicker sparkle is a non-issue.** The ±6% lantern flicker flips 0.06% of pixels per frame (0.03-0.05% if quantised to 12 Hz).
10. **Teleports must `snap()`.** Dissolving from an anchor metres away showed its grazing, stretched texels as diagonal streaks for 4 frames. The tracker now snaps on jumps (> 3x the travel limit or > 2x the angle backstop); call `snap()` on cuts.
11. **Wide FOV + sphere mode.** The edge stretch grows fast with FOV (see Stabilisation). Prefer ≤ 60-70° horizontal FOV for station games, or accept more frequent dissolves.
12. **Surface grain and line IDs share alpha.** Grain subtracts 0.5 from alpha, so the material's line ID survives. Otherwise the grain's level-of-detail boundary was drawn as a seam (a "^" line across the print).
13. **Headless harness quirks:**
    - Vite dep re-optimisation by other spikes reloads pages mid-run.
    - Wait for `body[data-ready]` and freeze the sim: frozen means only `__spike.step()` renders, so screenshots never race the loop.
    - From 14:16 the shared dev server's optimizer stalled (only an empty `node_modules/.vite/deps_temp_*`; every page got 504 "Outdated Optimize Dep"). The final numbers and shots therefore come from a `vite build` of this folder served statically. The code is identical.
    - Parallel spikes share the session scratchpad: use a unique subfolder.
14. **The first rAF timestamp can precede `performance.now()`.** Clamp dt to ≥ 0 (it drove `sim.t` negative).

## Recommendations for the real games

- **Put `core/` in `src/shared/onebit/`** unchanged. Keep `analysis.ts` as a test-only import.
- **plates:**
  - Sphere mode + `AnchorTracker`. Station sway of ±5° and the stereoscope's few-cm parallax stay glued with no dissolves.
  - Keep the horizontal FOV ≤ ~65° so ±5° stays under 1.15x stretch at the frame edges; this demo's 88° reaches 1.17x.
  - Ordered Bayer for "the present" and blue-noise **grain on the plate** (`applySurfaceDither` with `cells: [744, 960]`) for "the past". The grammar in plates-craft §0 maps directly onto `pattern` + `surfaceDither`.
  - `LUMA.plate` for plate exposures.
  - Ruby palette in the darkroom with `setPalette('ruby', 3)` on the door.
  - The loupe is a second camera close on the plate: grain becomes active automatically.
- **latent:**
  - The same pass with `amber` / `safelight` palettes.
  - Measure "legibility" of evidence with `readBits()` + `legibility()` against a detail mask (latent-game §2: legibility measured, not scripted). The metric already exists here.
  - Halftone (`cluster`) suits newsprint.
- **darkroom:**
  - The developing model (`R = T^p`) and the PNG import path transfer directly.
  - If darkroom is not 1-bit, still reuse `DevelopingPrintMaterial` without grain.
- **studio (walkable):**
  - Sphere + `AnchorTracker` (re-anchor every 0.2 m with dissolves) rather than world mode: same stability, cleaner pattern.
  - Pass `depthHint` from the nearest interactable.
- **Lines:**
  - Use line IDs for authored seams (deck planks, clothing hems, labels).
  - Group multi-part props under one ID (`Merger.begin()/end()` in `demo/cabin.ts`) so their internal joints don't line.
  - Consider `outline.maxDistance` near 8 m for busy floors.
- **Not done (worth a follow-up):**
  - GPU timer queries (`EXT_disjoint_timer_query_webgl2`) for real per-stage GPU ms
  - temporal hysteresis (keep last bit unless tone crosses ±ε) for static stations with animated lights
  - a CSS `image-rendering: pixelated` present path to skip the full-res blit on phones (only valid with integer device-pixel scaling)
  - a proper "fractal" dot-size LOD for world mode

## Test hooks: `window.__spike`

`freeze(on)`, `step(n, dt)`, `station(i)` (0 Cabin, 1 Tray, 2 Camera, 3 Plates, 4 Loupe), `look(yawDeg, pitchDeg)`, `set({mode, pattern, palette, scale, outline, seams, view, luma, grain, quality, develop, exposure, gamma, contrast, white})`, `setCentre('point'|'camera')`, `setDpr(r)`, `develop(p)`, `storm()`, `swimTest({kind:'rotate'|'translate', px, pitchPx, dist, modes})`, `walkTest({frames, speed, turn, tol, modes})`, `legibilityTest({station, develop, modes, patterns})`, `flickerTest({amp, quantHz})`, `bench(n)`, `noiseTimings`, `state()`, plus `pass`, `renderer`, `camera`, `cabin`, `rig`.

```
node scripts/shoot.mjs "spikes/dither-1bit/?clean" --gpu --steps '[{"waitFor":"body[data-ready]","ms":60000},{"eval":"__spike.freeze(true)"},{"eval":"JSON.stringify(__spike.swimTest({kind:\"rotate\",px:3}))"}]'
```

Controls: drag or touch-drag to look (1:1 finger tracking, inertia), 1-5 for stations, WASD to walk, arrows to nudge, Space to develop, Q for a storm (lantern swing + roll), and drop a PNG onto the canvas.

## Screenshots

- `shots/spike-dither-1bit.png`: desktop with controls
- `-mobile.png`: 390x844 touch
- `-gallery.png`: palettes, patterns, world mode, blue-sensitive emulsion
- `-develop.png`: development sequence p = 0.15 / 0.4 / 0.7 / 1.0 / 1.8 at the loupe
- `-edges.png`: outline-only view
- `-split.png`: 1-bit / continuous tone split
- `-stretch.png`: edge texel stretch at a 4° look offset (left) vs after re-anchoring (right)
- `-stations.png`: the five stations
