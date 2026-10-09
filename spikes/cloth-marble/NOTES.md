# Spike: cloth-marble (Texturedle probe physics)

**Page:** `http://127.0.0.1:5173/spikes/cloth-marble/` · **Status:** working, verified in headless Chromium on SwiftShader and on a hardware GPU (`--gpu`, AMD RX 580).

A 48 × 48 mm macro plate of procedural **rusty mailbox metal**, lit by a raking lamp, with three probes. A **glass marble** (or steel BB) rolls, bounces and rattles under the plate tilt. A **fine silk/microfiber cloth** and a **rough burlap swatch** drape over the relief, catch on it and stick-slip on it. Dragging any of them by mouse or touch works. The fine cloth shows grain and flake edges. The burlap shows only the big forms, such as the stamped rib.

Shots:
- `shots/spike-cloth-marble.png` (desktop) and `shots/spike-cloth-marble-mobile.png` (phone).
- `shots/spike-cm-compare.png`: bare plate, then fine cloth, then rough cloth over the same rust patch. This is the key result.
- `shots/spike-cm-drag-silk*.png`: wrinkles ahead of the finger, plus a friction debug view (green = stuck, orange = sliding, red = snagged).
- `shots/spike-cm-drag-burlap.png`: burlap layered on top of the silk.
- `shots/spike-cm-input-*.png`: real mouse and touch input.

All physics is custom TypeScript in `core/`, with no DOM and no three.js, so the game can lift it as-is. It is deterministic under fixed substeps. Rapier is not used, which matches `docs/design/concepts/texturedle-toy.md` §3.

## Run / controls
- **Query params:**
  - `?q=high|low` (default: auto, low when `pointer: coarse`)
  - `?marble=glass|steel`
  - `?R=120` sets the arch radius. The design doc uses 120. The default here is 180, so that 5° of tilt can bring the marble back from most of the frame.
  - `?seed=N`
  - `?inline` bakes on the main thread.
  - `?live` keeps the loop running under automation.
  - Per-knob overrides: `res, seg, shadow, fineN, fineIt, roughN, roughIt, subdiv, dpr, occ, fineField`.
- **Pointer (mouse and touch are the same):**
  - Press on the marble to lift it (it hovers 6 mm). Release with a flick to throw it.
  - Press on a cloth to grab it with a fingertip patch and drag.
  - Press on bare plate and drag to tilt, at 1° per 30 px, clamped to ±5°. The tilt springs back when you let go unless **Lock tilt** is on.
  - On touch devices, a **Gyro** button enables device tilt at 5:1 (25° of phone tilt gives 5°), calibrated to the first reading. On iOS it requests permission.
- **Keys:**
  - Arrows / WASD: tilt
  - Space: drop marble
  - G: glass / steel
  - L: lock tilt
  - D: friction debug
  - M: sound
  - H: HUD
  - R: reset
- **Headless.** Under `navigator.webdriver`, the page settles 2.5 s of simulation and then **pauses**, so screenshots are instant. Tests drive time with `__spike.step(n)`. Wait for `body[data-ready]`:
  `node scripts/shoot.mjs spikes/cloth-marble/ --gpu --wait 500 --steps '[{"waitFor":"body[data-ready]","ms":120000}]' --out shots/x.png`
- **`window.__spike`** (also `window.__spikeReady`):
  - Time and state: `step(n)`, `pause()`, `resume()`, `state()`, `bench(frames, renders)`, `bakeMs`
  - Probes: `setTilt(axDeg, ayDeg, hold)`, `dropMarble(x,y,h)`, `throwMarble(x,y,vx,vy)`, `hideMarble()`, `placeCloth(id,x,y,angle)`, `dragCloth(id, [[x,y],…], frames, release)`
  - Coordinates and debugging: `toScreen(x,y)`, `pick(cx,cy)`, `view()`, `debug(on)`, `shadowDebug(on)`
  - Look-dev: `clothUniforms(id)`, `lighting`
  - All coordinates are plate millimetres.
- **Typecheck:** `npx tsc --noEmit -p spikes/cloth-marble/tsconfig.json` (strict, noUnused*). It is clean.

## Files
```
core/            pure TS (lift into src/shared/probe/ or games/texturedle/physics/)
  noise.ts       hash, gradient/value noise, fbm, ridged, worley, rng (allocation-free)
  heightfield.ts HeightField (bilinear + Catmull-Rom sampling, gradients, dilate, maxPool, blur), ScalarField
  surface.ts     SurfaceRecipe -> bakeSurface() -> SurfaceBake (transferable) -> probeSurface() (physics view)
  mailbox.ts     Day-1 recipe: arch form, stamped rib + gutters, enamel w/ craquelure + scuffs, Worley
                 rust blisters w/ flaked crowns, pits, scale, scratches (fresh/rusted), run-off streaks
  recipes.ts     id -> recipe registry;  bake.ts / bake.worker.ts: bake in a Web Worker (inline fallback)
  tilt.ts        clamped tilt target + damped spring + plate-space gravity
  marble.ts      Marble (rolling/bouncing sphere on a SupportFn)
  cloth.ts       Cloth (XPBD sheet) + ClothLayer (cloth-on-cloth height grid)
  world.ts       ProbeWorld: owns fields, tilt, marble, cloths; fixed 240 Hz substeps; events; support()
  events.ts      ProbeEvent types (impact/tick/wall/slip/snag/snagRelease)
render/          three.js 0.186 (ShaderMaterials, Z-up plate space)
  glsl.ts        shared lighting: heightfield+cloth cone-traced shadow march, analytic marble
                 shadow/AO/caustic, GGX, softbox
  surface.ts     bake -> textures (R16F height, RG16F normals, sRGB albedo+AO, material), plate mesh
  cloth.ts       ClothView: GPU conform + weave; Occluder: cloth-height render target for shadows
  marble.ts      glass (transmission + cat's-eye swirl) / steel BB
audio.ts         demo WebAudio synth driven by events (roll noise, glass ticks, mailbox body modes, cloth hiss/scritch)
main.ts          demo: quality presets, input, HUD, toolbar, gyro, GPU timer, __spike hooks
```

## Core API (signatures)
```ts
// surface
bakeSurface(recipe: SurfaceRecipe, o: { res; size; seed; physRes; probes: {r; res}[] }): SurfaceBake
bakeAsync(recipeId: string, o: BakeOptions, params?: Record<string, number>, inline?: boolean): Promise<SurfaceBake>
probeSurface(b: SurfaceBake): ProbeSurface   // { height: HeightField, mu, rest, crr, snag, grain: ScalarField, contact(r): HeightField }
rustyMailbox(p?: Partial<{ formRadius; ribHeight; ribHalfWidth; rustiness; scratches }>): SurfaceRecipe
interface SurfaceRecipe { id; name; prepare(seed, sizeX, sizeY): (x, y, out: Texel) => void }
// Texel: h (mm), r,g,b (sRGB), rough, metal, mu (1.1..1.6), rest, crr, hardness, tag

// HeightField: texel centres at x0+(i+.5)dx, row 0 = bottom => uv = ((x-x0)/sizeX, (y-y0)/sizeY), same on the GPU
new HeightField(nx, ny, sizeX, sizeY, data?, x0?, y0?)
.sample(x, y): number                         // bilinear
.sampleGrad(x, y, out): {h, gx, gy}           // bilinear h + blended central-diff gradient (cloth)
.sampleCubic(x, y, out): {h, gx, gy}          // Catmull-Rom, C1 (rolling bodies)
.normal(x, y, out?)  .dilate(r, nx?, ny?)  .maxPool(nx, ny)  .averagePool(nx, ny)  .blur(mm, passes)  .range()  .invalidate()

// world (what a game uses)
const world = new ProbeWorld(surface, GLASS_MARBLE | STEEL_BB | Partial<MarbleParams>, { gravity: 185, hz: 240, maxSubsteps: 8, tilt })
world.update(frameDt): substeps                // accumulator; or world.advance(frames) for deterministic tests
world.tilt.setTarget(axRad, ayRad) / .release() / .snap(ax, ay) ; world.g (plate-space gravity)
world.setBounds({x0,y0,x1,y1} | null)          // marble walls (the visible frame)
world.dropMarble(x, y, lift) / throwMarble(x, y, vx, vy) / setMarble(params) ; world.marble.grab(x,y)/moveTo/release(vx,vy)
world.addCloth(id, Partial<ClothParams>, feel?: {crr, rest, mu}): Cloth ; removeCloth(id) ; cloth(id) ; clothField(id)
world.drainEvents(): ProbeEvent[]              // {type, source, x, y, strength, t, tag?}
world.support(x, y, r, out): Support           // max(bare D_r + r, any cloth) incl. support velocity, rest, crr, mu
world.perf, world.state()

// cloth
cloth.place(cx, cy, field, angle?, lift?) ; cloth.pick(x, y, maxDist): k ; cloth.grab(k) ; moveGrab(x, y) ; releaseGrab()
cloth.x (Float64 xyz), .v, .contact (0..1 pressure memory), .stuck, .pinned, .stats {contacts, stuck, slip, slipEvents, snags, speed, asleep}
cloth.version (bumps when particles change; re-upload when it differs) ; packPositions(f32) / packNormals(f32)
// marble
marble.{x,y,z,vx,vy,vz,q (xyzw), grounded, held, rollSpeed, grain, tag, on, bounces, ticks}
```

## How it works
- **Contact fields (the core trick).**
  - Each probe of radius r touches `D_r(p) = max_{|q-p|<r}[H(q)+√(r²-|q-p|²)] - r` (`HeightField.dilate`).
  - The bake precomputes four fields:
    - marble D₄ at 128²
    - BB D₁.₅ at 192²
    - burlap D₀.₆ at 256²
    - silk D₀.₀₈ at 512² (≈ max-pooled H)
  - Pits narrower than the probe are bridged and peaks become domes, so each probe feels its own scale with zero per-step cost.
- **Marble.**
  - Semi-implicit Euler at 240 Hz on `support()`.
  - When grounded: `a = (g·n)n + 5/7 (g−(g·n)n) − c_rr|g·n| v̂_rel`.
  - Collision with normal speed below −8 mm/s bounces with the texel's restitution and emits `impact`. A smaller kink emits `tick` (rattle).
  - Crests launch the marble naturally.
  - On a moving cloth, support-velocity coupling applies the 2/7 rule, limited by friction. This makes the **tablecloth trick** work:
    | Pull speed | Marble moves (cloth moves 10 mm) |
    |---|---|
    | 8 mm/s | 9.5 mm (rides along) |
    | 40 mm/s | 4.6 mm |
    | 150 mm/s | 0.6 mm (falls off) |
  - Rattle check, rusty row vs painted row at 40 mm/s:
    | Probe | Ticks/mm, rust | Ticks/mm, paint | Speed after, rust | Speed after, paint |
    |---|---|---|---|---|
    | Glass marble | 0.08 | 0.03 | 29 mm/s | 36 mm/s |
    | Steel BB | 0.17 | 0.07 | — | — |
- **Cloth (XPBD).**
  - Constraints: stretch + shear + skip-one bend distance constraints. Each 60 Hz frame runs 4 substeps × 1–2 iterations.
  - **Fingertip patch.** All particles within `fingerRadius` (rest distance) of the grabbed particle move kinematically with the pointer, plus Gaussian palm pressure around them.
  - **Two-sided long-range tethers** from the finger. The max length stops rubber stretching. The min length (`compressLimit` 0.85 silk, 0.9 burlap) makes a push slide the far side after some wrinkling. Without it the silk crumpled into rope folds.
  - **Collision** is a linearised projection onto `D_r + thickness`.
  - **Müller PBD Coulomb friction:** μ_k = μ_cloth × μ(texel), with a static/kinetic ratio. Stick→slip transitions become `slip` events.
  - **Burlap snags** catch on max-pooled sharp-peak × hardness texels. They are rate-limited at 0.8 per mm slid and at most 3 at once. A snag tears free past 0.9 spacing × strength and emits `snag`/`snagRelease`.
  - **Cloth-on-cloth layering** uses a 192² max-height grid per sheet, rebuilt when the sheet moves. A sheet collides with another only where it is above that sheet's mid-thickness.
  - **The marble is a sphere collider** for the cloths and presses down where it rests. Cloths **sleep** after 30 still frames.
- **Rendering.**
  - **GPU conform.** The sim grid (64² / 24²) is a float texture. A denser grid (4× subdivision, or 6 vertices per burlap yarn) interpolates it, then sets `z = max(z_sim, D_r(xy)+t)` and takes the field normal where it touches.
    - The sim never needs to be dense for the look.
    - Fine cloth gets grain from D₀.₀₈. Burlap gets only big forms from D₀.₆.
    - Burlap yarn relief is vertex-displaced plain weave, with holes discarded.
  - **Occluder pass.** An orthographic top-down render target (512² half-float) stores `R = h+5 mm` and `G = coverage`. Plate and cloth shaders march toward the lamp against `max(H, occluder)`, cone-sampling occluder mips by distance to get soft penumbrae.
  - **Plate shader:**
    - precomputed RG16F normals
    - GGX plus a softbox reflection
    - 20-step soft heightfield shadow
    - analytic marble shadow, AO and glass caustic
    - AgX tone mapping

## Measured performance
**Physics, per 60 Hz frame (4 × 240 Hz substeps).** Node 22 V8 (the same engine as Chrome) on a Ryzen 5 5600G, min of 8 reps. The machine was shared with other agents, so read these as upper-ish bounds.

| config | awake, idle drape (ms) | dragging (ms) |
|---|---|---|
| marble only (glass r = 4) | 0.01 | 0.01 |
| fine 64², 1 iter (23.9k constraints) | 2.6 | 2.7 |
| fine 64², 2 iter | 4.5 | 4.9 |
| fine 48², 1 iter | 1.65 | 1.72 |
| fine 40², 1 iter | 1.13 | 1.21 |
| fine 32², 1 iter | 0.77 | 0.80 |
| rough 24², 2 iter | 0.69 | 0.78 |
| rough 18², 2 iter | 0.37 | 0.42 |
| **HIGH** (fine 64 + rough 24 + glass) | 4.2 | 4.5 |
| **LOW** (fine 40 + rough 18 + steel) | 1.7 | 1.9 |

- Settled cloths sleep, so idle physics costs about 0.01 ms.
- In headless Chrome under heavier contention, `bench()` gave HIGH 9.7 ms (fine 7.1, rough 1.9, marble 0.13) and LOW 5.0 ms.

**Bake (Web Worker):**

| Resolution | Wall time | Texel loop | Notes |
|---|---|---|---|
| 512² | 0.7–1.4 s | 0.5–0.75 s | Node, quiet machine: 0.85 s |
| 1024² | 2.3–3.7 s | 2.5–3.1 s | |

The rest of the bake is small: AO/normals 0.1–0.35 s and the four contact fields 0.06–0.2 s.

**GPU** (EXT_disjoint_timer_query_webgl2 on an RX 580 through ANGLE/D3D11, 1280×800, DPR 1):

| Config | GPU time |
|---|---|
| HIGH, glass marble (half-res transmission) | 5.4 ms (6.7 ms at full-res transmission) |
| HIGH, steel BB | 3.3 ms |
| HIGH, shadow steps 0 | 2.9 ms (so the 20-step march costs about 3.7 ms) |
| LOW, 1280×800 | 2.0 ms |
| LOW, phone viewport 585×1266 (DPR 1.5) | 1.3–1.6 ms |

In SwiftShader a frame takes roughly 1–10 s. That is for correctness checks only.

CPU render submit is 0.3–2 ms. Draw calls are 4 (LOW) to 9 (HIGH, which includes the transmission pass). Triangles are 122k (LOW) to 883k (HIGH).

**Estimates on real hardware:**
- **Desktop with a dGPU or Apple M-series:** HIGH runs at 60 fps. Physics is 3–5 ms only while both cloths move, and GPU time is 3–6 ms at 1080p.
- **Intel/AMD iGPU:** expect about 3× the RX 580 GPU time. Use DPR 1 there, or LOW with `shadow=12`.
- **Mid-range phone** (Snapdragon 7-gen / Tensor class): JS is about 3–4× slower and the GPU about 8–10× slower than this rig.
  - LOW physics: 2–4 ms typical (one cloth active), 6–7 ms worst case (both cloths plus the marble).
  - LOW GPU: about 12–16 ms.
  - So 30 fps holds easily and 60 fps is reachable with `dpr=1&shadow=8`.
  - A 512² bake takes about 2–4 s, so it needs the loading copy, or see the recommendations below.

## Quality knobs
| knob | HIGH | LOW | effect |
|---|---|---|---|
| `res` bake/texture res | 1024 | 512 | bake time ∝ res²; detail 47 vs 94 µm/texel |
| `fineField` silk contact-field res | 512 | 256 | silk conform detail |
| `seg` plate mesh | 384 | 192 | silhouette/displacement only (normals carry the detail) |
| `shadow` march steps | 20 | 10 | ~3.7 ms of HIGH's GPU time |
| `fineN`/`fineIt` silk sim | 64/1 | 40/1 | dominant CPU cost (∝ n² × iters) |
| `roughN`/`roughIt` burlap sim | 24/2 | 18/2 | |
| `subdiv` cloth render grid / sim spacing | 4 | 3 | vertex cost (conform does 13 texel fetches per vertex) |
| `occ` occluder RT | 512 | 256 | cloth shadow sharpness |
| `dpr` cap | 2 | 1.5 | fill rate |
| marble | glass (transmission) | steel BB | glass = an extra (half-res) scene pass |

## Gotchas found (and fixed)
1. **Bilinear contact fields have slope kinks at texel borders, which read as fake rattle.** The marble uses C1 Catmull-Rom `sampleCubic`. Cloth uses bilinear, which is fine there.
2. **Low-iteration PBD cloth is rubbery and compressible far from the grab point.** Single-particle grabs smear, and pushing crumples the cloth into rope folds. Fixed with the kinematic fingertip patch, max+min tethers and only 1–2 iterations; adding iterations does not fix it.
3. **Layer grids update once per frame, but their push lands inside one substep.** That launched a burlap corner 5 mm into the air. A "velocity-free" fix (shifting x0) made the velocity perpetual. The working fix caps upward velocity from layer contacts at 15 mm/s.
4. **Snag pins fighting the collision projection created fake velocity, so the sheet never slept.** Pinned particles now get v = 0. Overlapping sheets also woke each other forever. Now only a sheet that actually moves (`lastMove > 2e-4 mm`) or is grabbed wakes its neighbours.
5. **Uploads must key on `cloth.version`, not on "is awake".** A sheet that moved and fell asleep within one multi-frame `step()` kept its stale pose on the GPU.
6. **Cloth self-shadowing from its own yarn relief darkened the lit side of ridges.** Rays now start past the relief (t₀ = 0.3 mm). Part of the diffuse also uses the drape's form normal (`uForm` 0.7 for burlap), so big forms read through the weave.
7. **Half floats.** An R16F height has a 0.002 mm ulp at a height of 2–4 mm, so normals computed in the shader from it band. Normals are precomputed from Float32 on the CPU and stored as RG16F. Mipmapping a half-float render target needs `EXT_color_buffer_(half_)float`. The code checks for it and turns cloth shadows off if it is missing.
8. **The occluder render target staircased cloth shadows.** Fixed by cone-tracing its mips by ray distance. The coverage channel keeps averaged mips from sinking toward the cleared −5 mm.
9. **The glass `transmission` pass re-renders the whole expensive plate.** `renderer.transmissionResolutionScale = 0.5` saves about 1.3 ms. On phones, use the steel BB.
10. **Pointer `pointermove` is rAF-coalesced.** A "last 80 ms" window often held one sample, so throws came out as zero velocity. The code now uses the last ≥ 2 samples within 100 ms.
11. **The marble rides about r above the plate, so perspective pushes it past the frame edge.** Walls are scaled by `1 − 2r/dist`.
12. **Macro-time gravity (185 mm/s²) also drives the cloth,** but drape comes from compliance, not gravity. XPBD compliance values depend on dt (α̃ = α/dt²), so retune them if `hz` changes.
13. **No cloth self-collision.** Deep folds can interpenetrate. That is acceptable top-down, so it was left out.
14. **Environment.**
    - Edits to the root `index.html` force a full reload of every Vite page, which is the Vite client's rule.
    - At about 14:16 a dependency re-optimisation left `/node_modules/.vite/deps` returning 504 for roughly 40 minutes.
    - I tested against a standalone `vite build` of this folder, served through Playwright request routing with no extra server, and with the HMR client stubbed. In SwiftShader, continuous rendering makes `page.screenshot` time out; that is why the page auto-pauses.

## Recommendations for the real implementation
- **Keep the custom physics.** The marble is about free; cloth is the whole budget. Ship the silk at 48²/1-iteration on desktop and 32–40² on phones, and the burlap at 18–24². The look comes from GPU conform, not sim density. Only simulate the sheet being touched; sleeping handles the rest.
- **Run physics in a Worker on phones.** Transfer about 50 KB of particle state per frame, or use SharedArrayBuffer, which needs COOP/COEP headers in `vercel.json`. Keep `ProbeWorld` the single source of truth. It already has no DOM.
- **Bake.**
  - Split the texel loop across 2–4 workers by rows; it is 85–90% of the time.
  - Or port recipes to fragment shaders and read back only the physics fields.
  - Show a 256² preview first.
  - Cache each day's bake in IndexedDB.
  - Re-bake per magnification step as the craft doc says. `bakeSurface` takes any extent.
- **Sound.** Events are deliberately sparse: D₄ is smooth, and that is physically right. For "rust chatters", walk the raw H under the contact at audio rate in an AudioWorklet, as in the toy doc §4. The marble exposes `rollSpeed`, `grain` and `tag`. Cloth gives `stats.slip`, `slipEvents` and snag events. `audio.ts` is only a demo of the hooks.
- **Frottage, residue and abrasion are not built.** The hooks exist:
  - `cloth.contact[]` is per-particle pressure memory, already uploaded in the sim texture's `.w`.
  - Per-particle stuck/slip state is available.
  - `HeightField.invalidate()` is there for edits, plus a dirty-rect re-dilate.
- **Unify the form with the design.** The doc's arch R = 120 mm makes the marble leave the crown at zero tilt; this spike defaults to 180 for play (`?R=120` gives the design value). Pick per day. The rib gutter does steer the marble.
- **Add a frame-time governor.** If p75 frame time exceeds 22 ms, drop `shadow`, then `dpr`, then `fineN`. Detect tiers with `pointer: coarse` as here, plus that governor.
