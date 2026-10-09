# Spike: backyard-physics

A walkable, sunny 1950s backyard full of Rapier physics toys, built as liftable modules for
`studio` (the backyard room) and `lensbench` (the Yard). Page: `/spikes/backyard-physics/`.

**Verdict: de-risked.** Rapier 0.21 (compat build) runs in Vite 8 dev and in a production
build with zero config. The whole yard, with 93 dynamic bodies (9 awake at rest, 39 during a
domino cascade), costs 0.9–2.0 ms per 60 Hz physics step on a desktop CPU. Snapshot/restore
replays are deterministic, even with cloth, droplets and wind feeding forces into the world.

![hero](../../shots/spike-backyard-physics.png)

More screenshots in `shots/`: `spike-bp-orbit.png` (whole yard), `spike-bp-domino-mid.png`,
`spike-bp-swing.png`, `spike-bp-camera-snap.png` (finder and polaroid),
`spike-bp-rainbow2.png`, `spike-bp-t0640.png`, `spike-bp-t1906.png`, `spike-bp-t2036.png`
(dawn, golden hour, night), `spike-bp-mobile-stick.png`, `spike-bp-mobile-night.png`, and
`spike-bp-cloth-ball-*.png` (Verlet and Rapier cloth catching the ball).

## What's in the yard

| Toy | How it's built |
|---|---|
| Lawn | Ground slab collider; mowing stripes, a wet/dry map (sprinkler darkens and glosses the grass, the sun dries it) and 26k instanced grass tufts that sway in the shared wind field |
| Picket fence, house, garage, patio | Static colliders, procedural canvas textures, windows with curtains |
| Maple | Trunk and swing branch colliders. Wind-swayed leaf cards cast dappled shadows |
| Tire swing | 8 capsule rope links on spherical impulse joints, a 7 kg tyre made of a ring of 12 balls, and a rope-joint length cap. Grabbable, pushable, and the wind moves it |
| Domino run | 40 dominoes in an S-curve on the patio, instanced (1 draw call), asleep until touched |
| Tumble tower | A 12-layer giant Jenga (36 blocks), instanced. You can pull blocks out with the grabber |
| Ball | CCD, restitution 0.72, angular damping standing in for rolling resistance |
| Wheelbarrow | A compound frame (tray, handles, legs) plus a wheel on a revolute joint. Lift the handles and it rolls |
| Sprinkler | A grabbable sled. Its rocking tube of 18 jets sprays ballistic droplets (drag, wind) that wet the lawn. Droplets 40.6–42.4° from the antisolar point are tinted, which makes a physically placed rainbow (plus the secondary bow and Alexander's dark band) |
| Laundry line | Two T-posts, a sagging line, and three pegged cloths in the wind (Verlet by default, Rapier soft body optional). The ball, the tyre, the gnome and your chest all push the sheets |
| Garden gnome | Bottom-heavy compound collider, 3 kg, built from primitives |
| Rusty mailbox "16" | Fixed post. Spring-loaded door and a raisable flag, both on revolute joints with limits |
| Picnic table | 57 kg, so the grabber's force cap makes it drag and lag |
| Box camera | Carry it, raise it to your eye (the view becomes the physical lens pose, wobble and all, behind a square 6×6 finder), and snap a 512² photo |
| Sun and sky | Solar position at 41.5° N in late August (studio-craft numbers), a blackbody sun colour, the atmospheric `Sky` with clouds, stars and a night glow, a porch light that comes on at dusk, and exposure that adapts like an eye |

Controls: WASD/arrows, Shift to run, Space to jump, drag to look (or L for pointer lock),
press-drag a prop to grab and fling it, tap a prop to carry it, F to throw, G to drop, wheel
or pinch to change the hold distance, E to raise the camera, C to snap, O for orbit view,
V for the sprinkler, T to skip an hour, P to pause. On touch, a floating joystick appears
under the left thumb (left 40% of the screen), the rest of the screen drag-looks, and there
are Jump/Run buttons.

URL knobs: `?q=low|medium|high`, `?cloth=rapier`, `?rope=multibody`, `?grab=joint`,
`?t=18.5` (clock time), `?paused`.

## Files and core API

Everything under `core/` is DOM-free except `input.ts` and the canvas textures. Lift it into
`src/shared/` as is, for example: `physics/{physics-world,grabber,instanced,merge-static}.ts`,
`input.ts`, `player.ts`, `wind.ts`, `sun.ts`, `cloth.ts`, `sprinkler.ts`,
`backyard/{backyard,env,textures,props/*}.ts`.

```ts
// core/physics-world.ts
loadRapier(): Promise<Rapier>                      // lazy import + init, cached
PhysicsWorld.create({ gravity?, hz = 60, maxSubSteps = 4, solverIterations = 4 }): Promise<PhysicsWorld>
pw.R                                               // the Rapier namespace (RigidBodyDesc, ColliderDesc, JointData…)
pw.add(desc, colliders[], object3D?, { tag?, grabbable?, data? }): BodyBinding
pw.addStatic(colliders[], x, y, z, quat?): RigidBody
pw.update(frameDt): steps        // accumulator → fixed steps → interpolated Object3D poses
pw.stepOnce(); pw.syncVisuals(alpha); pw.interpolatedPose(binding, outPos, outQuat?)
pw.onBeforeStep(fn, label) / pw.onAfterStep(fn, label) → unsubscribe   // timed per label
pw.raycast(origin, dir, maxDist, { excludeBody?, groups?, predicate?, solid? }): RayHit | null
pw.snapshot(): WorldSnapshot; pw.restore(snap); pw.registerState(key, { save, load }); pw.onRestore(fn)
pw.hash(); pw.stats(); pw.profile(n); pw.hookTimings(); pw.findByTag(tag); pw.bindingOf(body)
Layer = { STATIC, PROP, PLAYER, ROPE, HELD, TRIGGER, ALL };  groups(membership, filter)

// core/grabber.ts
new Grabber(pw, { mode: 'spring' | 'joint', stiffness = 400, dampingRatio = 0.75, maxForceBase = 25,
                  liftFactor = 2, reach = 4.5, minHold, maxHold, throwSpeedCap = 12,
                  heldAngularDamping = 3, heldIgnores = Layer.PLAYER, canGrab? })
g.probe(origin, dir, exclude?) · g.grab(origin, dir, exclude?) · g.grabBinding(b, worldPoint?, dist?, pose?)
g.aim(origin, dir, frameDt)          // every frame, from mouse, touch or screen centre
g.setHandOverride(p | null) · g.setHoldDistance(d) · g.nudgeHoldDistance(dd) · g.setPose(HoldPose | null)
g.release(fling = true) · g.throw(dir, speed) · g.held · g.heldBody
HoldPose = { orientation: Quaternion, stiffness = 120, damping = 18 }   // e.g. a camera kept level

// core/player.ts and core/input.ts
new Player(pw, spawn, yaw, { radius, height, eyeHeight, walkSpeed, runSpeed, jumpSpeed, mass, ignore(c) })
player.applyInput(frameInput) · applyToCamera(cam, alpha?) · setMode('walk' | 'orbit') · zoom(d) · teleport(...)
new InputController(canvas, { press(x, y, type) → 'grab' | 'look', drag, release, hover, key, pinch })
input.consume(): { moveX, moveZ, run, jump, lookYaw, lookPitch } · input.buttons.{run, jump}

// core/backyard.ts: the reusable scene
createBackyard(pw, scene, { quality, cloth?: 'verlet' | 'rapier', swingJoints?: 'impulse' | 'multibody',
                            timeOfDay = 16, mergeStatic = true, without?: { swing?, dominoes?, … } }): Backyard
yard.update(frameDt) · yard.setTimeOfDay(clockHours) · yard.resize(heightPx, fov) · yard.water = 0..1
yard.props.{ ball, swing, dominoes, tower, wheelbarrow, gnome, sprinkler, table, mailbox, camera, laundry }
yard.clothSpheres (add your own) · yard.sun / hemi / porch / sky / wind / wet · yard.sunState · yard.info()

// Leaf modules
new WindField({ heading, speed, gustiness, gustScale, turbulence }) · wind.sample(x, y, z, out) · wind.gust(x, z) · WIND_GLSL
new VerletCloth(origin, right, down, { width, height, nx, ny, mass, iterations, damping, drag, bend, thickness, groundY, substeps })
new RapierSoftCloth(pw, origin, right, down, opts, pinnedHandles)  // same ClothSim interface
new Sprinkler({ capacity, jets, speed, period, sweep, fan, drag, rate, groundY, onLand, size }) · s.step(dt, nozzleMatrix, wind, water)
sunState(solarHours, lat = 41.5, decl = 9.5) → { dir, elevation, azimuth, color, intensity, skyIntensity, ev100, kelvin }
new InstancedBodies(geo, mat, count).add(color?) → proxy (bind it) · .sync()
mergeStatic(root, excludeSet) · mergePropChildren(prop)
autoQuality(search?) · QUALITY.{ high, medium, low }
```

Test hooks (`window.__spike`): `state()`, `step(n)`, `frames(n)`, `setTime(h)`, `teleport()`,
`look()`, `orbit()`, `grabAt(x, y)`, `pickUpTag(tag)`, `throwHeld()`, `raise()`, `snap()`,
`throwBall()`, `pushSwing()`, `knockDomino()`, `profile(n)`, `bench(n)`, `renderBench(n)`,
`ropeBench(joints, steps, push)`, `snapshotBench()`, `determinism(n)`.

Tools: `node spikes/backyard-physics/build-check.mjs [--serve 600]` runs a production build
through Vite's JS API (`configFile: false`, so the repo config is untouched), prints chunk
sizes and serves the build on :4321. `node spikes/backyard-physics/perf.mjs [--q medium]
[--mobile] [--cpu 4]` measures on hardware GL with optional CPU throttling.

## Wasm loading (Vite 8)

`@dimforge/rapier3d-compat` inlines the wasm as base64 inside the JS, so it needs no plugin,
no top-level await and no `assetsInclude`, and it works in `vite dev` and `vite build` as is.
`loadRapier()` uses a dynamic `import()`, so Rapier is a separate lazy chunk: **4.23 MB
(1.60 MB gzip)**. The app chunk is 659 KB (175 KB gzip, mostly three.js). Init (decode,
compile, instantiate) takes 190–430 ms. The raw `.wasm` would be 3.08 MB (1.17 MB gzip) with
streaming compile via the non-compat `@dimforge/rapier3d` and `vite-plugin-wasm`. That saves
about 430 KB gzip but needs a change to `vite.config.ts`, which is a team decision.

## Measured performance

Machine: Ryzen 5 5600G (6 cores / 12 threads), Radeon RX 580, Chromium (Playwright). The
machine was shared with other agents. The figures below were taken at moderate load; at 90%
CPU load (8 parallel headless browsers) step times spiked 10–50×, so re-measure on a quiet
machine before tuning budgets. "Phone proxy" means CDP 4× CPU throttling at a
390×844 viewport with DPR 3 (the canvas is capped at 1.5×). Only the CPU side is
representative there, because the GPU is still the RX 580.

| | Desktop, high | Phone proxy, medium | Phone proxy, low |
|---|---|---|---|
| Physics per step, idle (9 awake) | 0.9–1.2 ms (world 0.1–0.2, cloth 0.56–0.84) | 2.8 ms | 1.7 ms |
| Physics per step, active (39 awake) | 2.0 ms (world 0.7, cloth 1.05) | 6.7 ms (world 3.5) | 4.3 ms |
| Frame rate (rAF) | 60 (vsync), p95 16.7 ms | 40.6 avg, p95 33 ms | 50.8 |
| CPU per frame | 3.0–4.9 ms | 10.2 ms | 8.4 ms |
| Draw calls (with shadow pass) | 157 (424 before merging) | ~110 | 35 |
| Triangles | 277k (234k of them grass) | 113k | 13k |
| Scene build | 185–350 ms | ~1.0 s | ~1.0 s |

- **Headless SwiftShader** (the default harness): 10–28 fps at 1280×800 on high. This is
  software rasterising and tells you nothing about real GPUs.
- **Rope A/B** (300 steps after a 30 N·s push): multibody joints cost 0.58 ms per step while
  swinging and never stretch, but the links **ignore impulses**. Impulse joints cost
  0.09–0.13 ms and stretch 11.5 cm; adding a rope-joint cap brings that down to 3.3 cm.
  Impulse joints plus the cap are the default.
- **Cloth A/B** (581 particles, all three cloths): VerletCloth costs 0.8 ms per step;
  RapierSoftCloth costs 3.0 ms (2.2–2.6 in `world.step`). Both stay stable at 2–4% stretch.
  Rapier's two-way coupling is stronger (a 9.8 m/s ball drops to 4.5 m/s, against 6.7 m/s
  with Verlet).
- **Grab tracking** (spring mode, fast 0.6 rad pans): a 0.4 kg ball stays within 2 cm of the
  hand. A 21 kg wheelbarrow lags 0.6–0.9 m and the 57 kg table 0.9–1.3 m (the force cap, by
  design). Joint mode lags 0.4 m even on the ball and has no cap, so spring mode is the default.
- **Snapshot**: 336–368 KB; 0.7–3 ms to take and 0.8–4.4 ms to restore. Replaying 300 steps
  of an active yard (dominoes, swing, ball, cloth, droplets) after a restore gives an
  identical hash.

**Real-hardware estimate.** A mid-range phone (Pixel 6a, iPhone 11 or Galaxy A54 class) on
medium should run at 45–60 fps: about 10 ms CPU per frame from the throttled runs, plus an
estimated 8–12 ms of GPU for 113k triangles, about 110 draws and a 1024 shadow map at
DPR 1.5. Thermal throttling will pull that to 30–45 fps after a few minutes. Low should hold
60. An integrated laptop GPU on high should hold 60 at 1080p.

## Quality knobs (`core/quality.ts`)

`pixelRatio` (2 / 1.5 / 1), `shadowMapSize` (2048 / 1024 / off), `antialias`, `grassTufts`
(26k / 9k / 0), `sprinklerDroplets` (1600 / 700 / 350), `clothGrid` (22×16 / 16×12 / 12×9),
`clothIterations` (8 / 6 / 4), `clothEvery` (1 / 2 / 2, meaning the cloth runs at 30 Hz with
interpolation), `maxSubSteps` (4 / 3 / 2), `solverIterations` (4 / 4 / 3), `leaves`
(2600 / 1400 / 700), `skyShader` (the low preset uses a gradient dome), `clouds`. Touch
devices default to medium.

## Gotchas found (each cost real time)

1. **Raycasts return null before the first `world.step()`.** The query BVH is built during
   the step. `createBackyard` steps once after building.
2. **Don't create bodies asleep (`RigidBodyDesc.setSleeping(true)`).** They have no contact
   manifolds when first woken and sink several centimetres into the floor, which knocks over
   a domino run by itself. Create them awake, step once, then call `body.sleep()`
   (`sleepAll()` in `blocks.ts`).
3. **Multibody joint links ignore `applyImpulse` and `setLinvel`**: only `addForce` moves
   them. The grabber, wind and throws all use impulses, so ropes use impulse joints plus a
   `JointData.rope` length cap.
4. **Never keep `RigidBody` objects across `World.restoreSnapshot`.** They point into the
   freed world ("null pointer passed to rust"). Keep bindings or handles instead.
   `PhysicsWorld.restore` re-points every binding, and `onRestore` lets owners rebuild their
   character controllers.
5. **A Rapier snapshot alone does not make a replay.** Anything outside Rapier that pushes on
   bodies (the wind clock, cloth particles, sprinkler RNG, player vertical speed) has to
   round-trip too, through `pw.registerState()`. With that in place, replays match bit for bit.
6. **`SoftBodyDesc.cloth` numbers particles column-major** (`i * nv + j`), and its rest
   positions are centred. `RapierSoftCloth` permutes to row-major. Before this was found the
   cloth stretched 9×.
7. **`addForce` is persistent** until `resetForces`. For a transient push, apply
   `F * dt` as an impulse every step.
8. **Sample noise fields coarsely in hot loops.** Wind per cloth triangle cost 4 ms per step
   and wind per droplet cost 2 ms. A 3×3 grid per cloth and one sample per spray brought both
   under 0.1 ms.
9. **Idle character controller**: skipping `computeColliderMovement` while grounded and idle
   saves 0.1–0.8 ms per step.
10. **A held prop must stop colliding with the player capsule** (the grabber drops `PLAYER`
    from its filter while it's held). Without this, a camera raised to the eye gets shoved
    and tumbles.
11. **three r186 removed `PCFSoftShadowMap`**. It falls back to PCF and logs a warning.
12. **Without an environment map, metallic glass renders black.** Use non-metal translucent
    glass with something behind it (curtains).
13. **Draw calls**: `mergeStatic` plus `mergePropChildren` took the yard from 424 to 157
    calls. Every caster is drawn again in the shadow pass.
14. **Test harness**: while other agents edit shared files, the dev server sometimes
    full-reloads pages or returns 504 for `.vite/deps/three.js` (in the middle of a dependency
    re-optimisation). Testing against `build-check.mjs --serve` avoids both. `step(n)` is safe
    before a screenshot; long synchronous `frames(n)` runs under SwiftShader can time it out.

## Holding a camera prop (for lensbench and studio)

It's implemented here: `props/misc.ts` provides `createBoxCamera`, and `main.ts` handles
`snap`, `setRaised` and `lensPose`.

- **Grab as a pose, not a point.** `grabber.grabBinding(cam, undefined, d, pose)` holds the
  prop at its centre of mass. Each frame, `setHandOverride(cameraSpaceOffset → world)` places
  it at the hip, or at the eye when raised, and `pose.orientation = camera.quaternion` keeps
  it facing the view. Both are springs, so the prop's real mass and inertia set the handheld
  lag and wobble. Heavier cameras sway less but lag behind pans, which is the
  lensbench-game.md "weight is physics" rule for free. Add the studio-toy.md tremor
  (band-passed 8–12 Hz torque noise) and breath torque inside `poseStep`. Breath-hold scales
  them down.
- **Raised view = the lens.** While raised, render from
  `interpolatedPose(cam) * lensOffset` instead of the eye. The prop is hidden, and a CSS
  finder square is matched to the photo's field of view. What you frame is exactly what the
  physics put there.
- **Shutter integration** (studio-toy.md 5.1): pause the loop and, for each of K substeps,
  call `pw.stepOnce()` then `syncVisuals(1)`, then render the lens pose into an RGBA16F
  accumulation target. The world really advances by the shutter time. Freeze shadow maps
  between substeps (`renderer.shadowMap.autoUpdate = false`, then set `needsUpdate` once per
  substep) or K sub-renders will cost K shadow passes. For a rolling shutter, give each row
  band its own substep window.
- **Tripod**: attach the camera with a `JointData.fixed` to a dynamic tripod body (so a bump
  shows in the photo), or to a kinematic one.
- **Photo out**: `snap()` (render a 512² MSAA target, `readRenderTargetPixels`, flip and
  vignette in JS, JPEG `toDataURL`) takes 16–22 ms on the RX 580. **The first call took about
  1 s** while the render-target shader variants compiled (a render target skips tone mapping
  and the output transform, so every material needs a new program). `main.ts` now pre-warms
  with `setRenderTarget(photoRT); compileAsync(scene, lensCam)` 400 ms after the first frame,
  which brings the first snap down to about 100 ms. Store linear data for `photochem`
  instead of sRGB if development has to stay physical.

## Reusing the backyard in lensbench and studio

- `createBackyard(pw, scene, { quality, without: {...} })` is one call. It registers its
  fixed-step work as labelled hooks (`wind`, `laundry`, `sprinkler`, `swing-wind`,
  `wetness`), registers its snapshot state, merges static meshes, and returns handles to
  every toy. The host owns the renderer, camera, PhysicsWorld, Player and Grabber, so a game
  can drop the Player and drive its own camera rig.
- **lensbench Yard** needs the box fan, string lights and pinwheel (the rolling-shutter
  targets) as new files in `props/`. Sun, wind, sprinkler, laundry and the ball are already
  there. Its `fire({seed})` maps onto `pw.snapshot()` and `pw.restore()` plus the seeded
  sprinkler.
- **studio**: the mailbox already has its door and flag hinges for postcards. Clothesline
  prints are `LaundryItem`s with developed photos as `map`. "The Seventh Domino" can read
  `props.dominoes[6]`. Replay keeps a snapshot every 0.5 s plus the input log (≈0.7 MB/s; a
  snapshot every frame would be 22 MB/s). `wet` is the doc's lawn-wet. The star sphere is
  tilted to the celestial pole at 41.5° N, so rotating it gives star trails. `sun.ts` and
  `wind.ts` (with its GLSL twin) belong in `src/shared/` because darkroom, studio and
  lensbench all need them.

## Recommendations for the real implementation

1. Keep **spring-mode grabbing** (it uses the effective-mass matrix at the grab point and a
   force cap), **impulse joints with a rope cap** for ropes, and **VerletCloth** for laundry.
   Use RapierSoftCloth only for a hero cloth that has to push back hard, such as the dark
   cloth over a view camera, and budget about 3× for it.
2. **Phone physics budget**: at most 40 awake bodies, at most 330 cloth particles at 30 Hz,
   at most 700 droplets, `maxSubSteps` 3. Past that, the simulation slows down (dropped time
   is counted in `stats()`) rather than spiralling. Add a quality governor that drops a level
   if frame p95 stays above 22 ms for 3 s.
3. Lazy-load Rapier only on pages that need it. Decide compat versus non-compat when
   `vite.config` is next touched.
4. Shareable replays across devices need `@dimforge/rapier3d-deterministic-compat`. The
   regular compat build is only proven deterministic within the same browser and machine.
5. Per-droplet rainbows are sparse with about 1500 drops; this spike enlarges in-band drops.
   For a full arc, splat droplet density into a low-resolution buffer and shade the bow per
   pixel by angle.
6. Next steps: grass LOD (re-scatter tufts in a ring around the camera instead of across the
   whole yard), an environment map (PMREM of the sky, refreshed when the sun moves by more
   than 2°) for the metals, and the sun drag gesture from studio-toy.md in place of the slider.
