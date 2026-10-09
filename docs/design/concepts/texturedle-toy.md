# Texturedle: tactile physics toy lens

**Title:** TEXTUREDLE
**Subtitle:** *Tilt it. Roll it. Rub it. Name it.*
**Tagline (hub card):** "One surface a day, 36 millimetres wide."

> Lens: ignore the guessing for a moment. What on this bench is irresistible to poke, drag, tilt, shake or throw, and how does each poke turn into evidence?

---

## 1. Thesis: five rules

1. **Each probe sees a different scale of the surface.** The marble feels *form* (millimetre bumps, curvature). The rough cloth feels *edges* (sharp peaks, flakes, burrs). The fine cloth feels *grain* (sub-0.1 mm micro-relief and loose powder). The lamp and tilt show *relief and gloss*. All three probes come from one function, `dilate(H, radius)`, run at three radii (§3.2). This keeps the system small and makes it read as real.
2. **Touch the thing to move the thing. Touch the world to tilt the world.** The game has no tool modes. A press on the marble grabs the marble, a press on a cloth grabs the cloth, and a press on bare surface tilts the plate. You pick tools up from the tray as physical objects.
3. **Probing is free. Guessing costs.** Probes never run out, never cost hints and never time out. The only scarce resource is guesses. People should play with the toy for its own sake.
4. **We slow down time but never sound.** Motion runs in "macro time", about 1/7 speed, the way high-speed macro footage looks. The audio is rebuilt at real speed, so rolling and scraping sound right.
5. **Every poke leaves a mark.** Tracks in the pile, scrubbed patches, residue on the cloth, a fibre caught on a flake. When you finish, the surface records what you did to it.

## 2. The bench

- **Frame:** a 36 × 24 mm specimen at 1:1 magnification, exactly one 35 mm negative, which ties it to photography. On portrait phones the frame crops to 24 × 36. The height range is about 0–3 mm.
- **Plate:** a 256² displaced grid (128² on the low tier). A 1024² normal map is derived from height. Physics reads CPU-side `Float32Array` fields.
- **Lamp:** a warm 3200 K raking lamp at 14° elevation sits on a **bezel ring** around the frame. Drag the ring to swing its azimuth, and the shadows wheel round like a sundial. A toggle switches **Rake** (relief) to **Ring** (a flat ring light that shows true colour). This teaches the photographer's lesson that light shows different things depending on where it comes from.
- **Tray** (bottom on phones, left on desktop): the glass marble sits in a felt dish, and two folded swatches lie next to it, a white **silk** square and an undyed **burlap** square. You drag them onto the plate. A tap places the object at the centre.
- **Camera:** 20° FOV, almost top-down. The camera tilts with the plate (±5°), which adds parallax and makes the lamp graze harder (§3.6).

## 3. Physics models

All physics is custom TypeScript, renderer-independent and deterministic with a fixed dt. **We do not use Rapier here.** Sphere-on-heightfield, PBD cloth and grain on a heightfield are each about 300 lines and fit the problem better than a general rigid-body engine.

### 3.1 Units and macro time
Units are mm, s and g. The engine uses effective gravity `g_eff = 185 mm/s²`, which is real g (9810) × s² with s ≈ 1/7.3. At full 5° tilt, a rolling marble crosses the 36 mm frame in about 2.5 s: `a = 5/7 · g_eff · sin5° ≈ 11.5 mm/s²`. The audio voices multiply contact speed by `T = 7.3` (§4), which puts the sound back at real speed.

### 3.2 Contact fields (the core trick)
Each probe of radius *r* touches the **dilated heightfield**:

```
D_r(p) = max_{|q-p|<r} [ H(q) + sqrt(r² - |q-p|²) ]  - r
```

A probe's centre (or contact point) rides on `D_r`, and the contact normal is `normalize(-∂D/∂x, -∂D/∂y, 1)`. Pits narrower than the probe get bridged, wide pits trap it, and sharp peaks become rounded domes. Each field is computed in a Web Worker at a resolution matched to its radius, so the cost stays at roughly 10M samples or less:

| Probe | radius | field res | what it "feels" |
|---|---|---|---|
| Marble (8 mm glass) | 4.0 mm | 128² | curvature, ribs, blisters |
| Burlap (yarn) | 0.45 mm | 256² | flakes, edges, weave-scale bumps |
| Silk (filament) | 0.08 mm | 512² | grain, pores, scratches |

When abrasion changes H, the affected dirty rectangle is recomputed locally.

### 3.3 Plate tilt, nudge, shake
The tilt target `θ_t = (α, β)` is clamped to ±5°. The actual tilt follows a damped spring, `θ'' = 120(θ_t − θ) − 15.3 θ'` (ζ ≈ 0.7), and **springs back to level on release** with slight overshoot, like a pinball nudge. Gravity in plate space is `g_p = R(θ)ᵀ · (0, 0, −g_eff)`.
- **Nudge:** when `|θ''|` exceeds 400°/s², loose grains get `v_z += 0.002 · |θ''|` and the marble gets a matching lateral kick.
- **Shake:** three tilt reversals within 600 ms, or a phone `devicemotion` reading above 15 m/s², counts as "rapping the bench". Loose material hops, and hollow bodies ring (§4).

### 3.4 Marble
The marble is solid glass, r = 4 mm, m ≈ 0.67 g, integrated at 240 Hz with semi-implicit Euler.

```
grounded:  a = 5/7 · (g_p − (g_p·n) n)  −  c_rr(texel) · |g_p·n| · v̂
airborne:  a = g_p
after move: z_g = D_4(c.xy); if c.z < z_g:
   v_n = v·n
   if v_n < −8 mm/s:  v −= (1+e(texel))·v_n·n ; emit Impact(½ m v_n², x, y) ; airborne
   else:              v −= v_n·n ; grounded
   c.z = z_g
grounded only while c.z − z_g < 0.02 mm (crests launch the marble naturally)
ω = (n × v)/r when grounded; quaternion integrated for the visible swirl
```

- **Drop:** press on the marble (or drag it from the dish) and it **hovers 6 mm above the surface**. A soft contact shadow shows where it will land. On release it falls about 0.25 s and bounces with a decaying rhythm (`t_{k+1} = e·t_k`). Glass on tile goes *tik-tik-tiktiktik*; on velvet it lands with a thud and stays put.
- **Throw:** flick and release. Release velocity comes from the last 60 ms of pointer samples and is capped at 150 mm/s.
- **Leaving the frame:** a marble that rolls off the edge drops out of view (*plink… tonk*, panned to that side). It then rolls back into its dish from offscreen after 1.2 s.
- **Ball-lens render:** the marble shader refracts analytically through the sphere (n = 1.5, back focal length ≈ 2 mm) and samples the lit plate. The marble therefore shows an **inverted, magnified image of the texture beneath it**, so it works as a free loupe. It has a cat's-eye swirl (3D noise in object space), a Fresnel highlight of the lamp, and a faked caustic dot on the surface offset toward the lamp.
- **Dirty marble:** rolling through loose material blends residue colour into the marble's albedo. Roll it over the silk to polish it clean.

### 3.5 Cloths (XPBD)
| | Silk | Burlap |
|---|---|---|
| grid / size | 28² / 24 mm | 18² / 21 mm |
| stretch compliance | 1e-7 | 1e-8 |
| bend compliance | 1e-3 (drapes) | 5e-5 (stiff) |
| thickness t | 0.05 mm | 0.4 mm |
| contact field | D_0.08 | D_0.45 |
| μ_cloth | 0.25 | 0.7 |
| wear K (Archard) | 2e-4 | 4e-3 |

Each frame runs 4 substeps × 6 iterations. **Grab:** the particle nearest the pointer becomes kinematic. It is driven to the pointer xy at `z = C(xy) + t − press`, where press defaults to 0.15 mm and pen `pressure` maps it to 0.05–0.4 mm. Neighbours get palm pressure `P·exp(−d²/2σ²)` with σ = 2.5 mm.

**Collision:** `z_i ≥ C(x_i, y_i) + t`.

**Friction** uses Müller-style PBD Coulomb friction. With `μ = sqrt(μ_cloth · μ_material)`:
- If the tangential displacement is below `μ_s·d_pen`, the contact is static: zero it.
- Otherwise it slides: scale it by `min(1, μ_k·d_pen/|Δx_t|)`.

Each material sets μ_s/μ_k between 1.1 (glass) and 1.6 (rubber, rust). **Stick-slip comes out of this naturally.** The elastic cloth stores strain and then jumps, and each jump emits a `Slip(energy)` event that drives the audio and the micro-judder. On grippy surfaces, compression wrinkles bunch up ahead of the drag. On glass the cloth glides flat, so wrinkle height becomes a clue in itself.

**Second finger pins** while a cloth is held. That lets you stretch it taut, and a taut sheet tents over peaks like a sheet over furniture.

**Snags (burlap only):**
- Snag strength is `S = hardness · clamp((−∇²H_0.1mm − κ0)/κ1, 0, 1)`, so sharp, hard peaks snag.
- A burlap particle that crosses a texel with S > 0 is **pinned** by a distance constraint. The pin breaks when the constraint force exceeds `S·F0`.
- On release:
  - a rendered thread stretches from the cloth to the snag point, then snaps;
  - a **fibre is left behind** on the surface as debris;
  - you hear a *tick* and the cloth lurches.

**Abrasion (Archard wear law):**
- Material wears away as `ΔT_top = −K · p · |Δs| / hardness_top`.
- Each texel has a **layer stack**. As the top layer thins, albedo, roughness, metalness and height blend into the layer beneath. Burlap scrubs through the layers, while silk barely polishes.
- Changes update a dirty-rect `texSubImage2D` on the height/material textures.

**Residue:**
- Each cloth texel picks up `Δr = k_pick · L · |Δs| · (1 − r_sat)` of the loose-layer colour, and that amount is subtracted from L.
- The cloth's own 128² canvas gets splatted. On white silk the colour shows clearly; on burlap it reads as a stain.

**Flip (frottage):**
- Double-tap the cloth: it peels up from the grabbed corner and turns over like a page (500 ms).
- The underside shows two things:
  - the residue;
  - a **rubbing**, where every contact accumulated darkness `∝ p·|Δs|` only where the dilated field let it touch.

  Silk makes a crisp graphite-like rubbing of the micro-grain. Burlap makes a coarse one.
- Drag it back down to keep rubbing.

### 3.6 Loose layer and debris
L(x, y) holds loose material: rust scale, dust, sand, pollen, chalk, pile. Each material sets its grain colour and angle of repose φ.

- **Field rule** (30 Hz, sand-pile automaton): wherever the local slope of `H+L`, plus the tilt projected onto the gradient, exceeds `tan φ`, move `Δ = (slope − tan φ)·dx/4` of L downhill. Tilting creeps loose material into the pits, and an **avalanche happens only where slopes were already near critical**. The result is a contour map of the surface drawn in grit.
- **Visible grains:** every transfer, nudge, marble pass and cloth slip spawns instanced particles (2000-particle pool; flakes are flat tumbling prisms). A grain stays at rest until its slope exceeds φ, then slides with `a = g_eff (sinθ − μ_k cosθ)`. After 3 s at rest, grains merge back into L, which keeps the particle count bounded.
- **Pile materials** (velvet, suede, carpet, moss) store a pile-direction vector. Any probe passing over rotates the pile toward its own velocity. Brushed pile changes its sheen, so you can **draw on suede with the marble**.

### 3.7 Light and optics (the 5° tilt matters)
- **Self-shadowing:** each fragment marches toward the lamp through the height texture (24 steps, 8 on the low tier) with a soft penumbra. Shadow maps fail at grazing angles, so they are not used.
- **Why 5° is plenty:** at 14° lamp elevation, a ±5° tilt moves the effective elevation between 9° and 19°. Shadow length goes as `cot ε`, from 6.3 to 2.9, so **tilting the plate doubles or halves every shadow**. Small input, big visible change.
- **Depth of field:** real 1:1 macro at f/8 has about 1 mm of depth of field. A 5° tilt lifts the frame edges ±1.6 mm, so **tilt throws the edges out of focus** for real, a free tilt-shift effect. Implementation: CoC from |depth − focus|, a two-pass blur at half resolution, disabled on the low tier.
- **Autofocus:** focus follows the active probe, or the hover point when idle. It moves on a spring (ζ = 0.45, ω = 18 rad/s), so it **hunts a little**: overshoot, settle, the lens "breathing". Pinch or wheel zooms from 1:1 to 2:1 inside the frame and never shows more than the frame.
- **Glints:** where `N·H > 0.995` on metallic texels, a 4-point star-filter sprite appears. Swinging the lamp makes flakes and brushed metal sparkle.

## 4. Sound: one contact-synth AudioWorklet

The high-passed height field (256²) is transferred to the worklet once. Physics posts state at 60 Hz, and the worklet interpolates between updates.

- **Roll:** the worklet walks the real heightfield under the contact. The position advances `v·T/fs` per sample. The signal is the second difference `h[n] − 2h[n−1] + h[n−2]`, gain ∝ √|v|, followed by a one-pole low-pass at `f_c = clamp(|v|·T / (2π·a_c), 200, 8000)` with contact patch a_c ≈ 0.3 mm. **You hear the actual texture**: rust crunches, paint hisses and glass is nearly silent.
- **Impacts:** a half-sine excitation whose width comes from hardness (0.1 ms for steel up to 3 ms for rubber) feeds a **body modal bank**: 4–6 modes, each with frequency, T60 and gain, and ±3 % random detune. Mode gains follow `cos(πk·x/Lx)`, so **striking different spots changes the timbre**, as on a real plate. Body presets: hollow-sheet, solid-stone, board, pane, ceramic, soft (no modes).
- **Friction:** noise through a band-pass (silk 2.5–4 kHz *shhh*, burlap 600–1200 Hz *khhh*) × slip power. Each `Slip` event adds a 12 ms chirp (an exponential sweep from 1.2 to 0.8 kHz), which is the squeak. Snags add a dry click and a thread-snap "ping".
- **Room:** a quiet room tone and, every ~11 s, a single drip from a tap into a sink, a nod to the notes being dictated over the dishes. It can be turned off.
- **Fallback** without AudioWorklet: prerendered noise buffers through BiquadFilter chains, plus one-shot synthesized impact buffers.

## 5. Juice checklist
- **Haptics:** `navigator.vibrate` (Android only, iOS has none) for impacts (4–30 ms, scaled by energy), snag releases (8 ms) and shakes.
- **Impact:** a radial dust-puff ring, 0.6 px screen shake above an energy threshold (off under reduced motion), and a 40 ms bloom flick on the marble highlight.
- **Motes:** 100 dust sprites visible **only inside the lamp's cone**. They drift by Brownian motion and swirl through a curl-noise kick from cloth velocity, so yanking a cloth stirs the air.
- **Evidence stamps:** the first time each kind of evidence appears, a chip lands in the margin notebook with a rubber-stamp *thunk*: "Hollow metal ring ~410 Hz", "Orange-brown powder", "Snags ×3", "Green beneath". Audio clues are always captioned as chips, so deaf players get the hollow ring too, and residue chips name their colour for colourblind players.
- **The tablecloth trick works.** Put the marble on the silk and yank fast. Friction is capped at μN, so the marble stays where it was. Pull slowly and it rides along. Pulling it off fast earns a hidden notebook stamp.

## 6. Input map

| Action | Mouse / keys | Touch | Sensors |
|---|---|---|---|
| Tilt | drag on bare surface; right-drag anywhere; WASD/arrows | one-finger drag on bare surface (1° per 30 px) | **Phone tilt** (opt-in "level" button that calls `requestPermission` on iOS): 5:1 reduction, so 25° of phone tilt gives 5° of plate tilt; low-pass α = 0.15; two-finger double-tap re-zeros |
| Nudge / shake | double-tap Space | quick flick on bare surface | phone shake |
| Grab / drop / throw marble | LMB on marble or dish; release; flick | same | — |
| Drag cloth | LMB drag | finger drag; **second finger pins** | pen pressure → press depth |
| Flip cloth | double-click / F | double-tap | — |
| Lamp azimuth / mode | drag bezel; Q/E; L toggles Rake/Ring | drag bezel; tap lamp icon | — |
| Zoom | wheel | pinch (when no cloth is held) | — |
| Reset probes | R | long-press tray | — |

## 7. What the material library must provide to the probes

Each texel needs H, L, top-layer thickness T, the index of the layer underneath, and these values:
- μ_s and μ_k
- restitution e
- rolling resistance c_rr
- hardness
- snag S (derived)
- pile vector
- residue rgb
- angle of repose φ

Each material as a whole needs a body preset, metalness and roughness per layer, and an anisotropy direction.

## 8. Day 1: rusty mailbox, tuned for touch
- **Form:** a convex arch-top steel mailbox, radius 120 mm. That gives a 1.36 mm sagitta across the frame, so **the marble rolls off the crown at zero tilt**. Slopes under 5° exist only within ±10.5 mm of the crest, so you can just **balance it on the crown** with tilt and lose it anywhere else. The lesson the hand learns is "convex, big radius". One stamped stiffening rib, 1.5 mm wide and 0.4 mm high, crosses the frame diagonally, and the marble likes to run along its gutter.
- **Layers:**
  - faded dark-green enamel, 60 µm, cracked into craquelure around the blisters;
  - grey rolled steel underneath: metallic, with anisotropic mill streaks that glint as the lamp swings.
- **Rust:**
  - Worley-noise blisters, 1–4 mm across and 0.1–0.5 mm tall, with radially cracked paint on top;
  - dark pits 0.2 mm deep, which trap the marble if it's slow;
  - laminar scale in L: burnt-sienna residue, φ = 38°, high snag;
  - run-off streaks all in one direction, a clue that the surface stands vertical.
- **Body:** hollow sheet steel, modes ≈ 180 / 410 / 690 / 1040 / 1550 Hz, T60 0.4–1.4 s, slightly damped by the rust. **Every drop goes *tonk-nnng*.**
- **Friction:** silk on paint 0.35 / 0.30 (smooth glide); burlap on rust 0.8 / 0.55 (strong judder and squeak).
- **Story detail:** scrub the lower-left corner with burlap and the edge of a peeling white house-number decal appears. Burlap can snag its corner and peel it back.

## 9. The 10-second, 1-minute and 10-minute fun

**10 seconds.** No menu. The frame racks from blur into sharp macro rust (1.2 s), and the lamp makes one slow sweep, wheeling the shadows. The marble drops in from above: *tonk-nnng*, three bounces, then it rolls off the crown into the rib gutter. A faint glyph says "drag the world". The first drag tilts the plate, flakes shiver and trickle into pits, and the edges blur with the tilt.

**1 minute.** Silk squeaks across the paint, catches orange dust, and flips to show a rubbing of the craquelure. Burlap snags (*tick*, a fibre left behind), and a scrub chips the green away to bright steel. Shaking the phone makes the box ring and the grit dance. The tablecloth trick works. Six or so stamps fill the notebook, and you make your first guess.

**10 minutes** (after solving, the **Bench** sandbox opens):
- **The Drawer:** every past surface, replayable as a pure toy.
- **Marble bag:** a 3 mm steel BB (feels grain), the glass marble, a 12 mm clay ball (no bounce, leaves dents in soft materials) and a hollow celluloid ball (light, bouncy, blown off course by the cloth's air).
- **Roll the Course:** three chalk gates on today's surface, rolled through by tilt alone, against a par time. Yesterday's best run appears as a ghost marble.
- **The Quilt:** each day's flipped silk is saved as a patch, building a calendar quilt of residues and rubbings. It is the collectible, and it's shareable.
- **Macro shot:** freeze the current lamp, tilt and focus and save a PNG to a contact sheet. **It exports directly to Darkroom as a cyanotype negative**, which links two of the games.
- **Share string:** guesses plus probe stats: "#12 · 3/6 · 41 bounces · 2 snags · 1 tablecloth". Nothing in it spoils the answer.

**Weekly variant, "Lights Out" Sundays:** the lamp is off and the screen goes nearly black. You solve by sound, haptics and the residue you can see only on the flipped cloth. It's memorable, and the evidence chips keep it accessible.

## 10. Performance, fallbacks, test API
- **Budgets** on a mid-range phone: physics ≤ 3 ms, render ≤ 10 ms.
- **Low tier** kicks in automatically when the frame time p75 exceeds 22 ms over 2 s:
  - 128² mesh;
  - no depth of field;
  - 8 shadow steps;
  - silk at 18²;
  - 600 grains;
  - plain refraction instead of the ball lens.
- **No WebGL2:** a Canvas2D renderer with CPU-lit relief (Lambert from height, recomputed when the lamp moves) and the same physics, with the marble as a sprite.
- **`window.__game`:**

  ```ts
  load(id)
  pause()
  advance(frames)
  setTilt(a, b)
  setLamp(az, mode)
  dropMarble(x, y, h)
  throwMarble(x, y, vx, vy)
  dragCloth('silk' | 'burlap', path, ms)
  flipCloth(kind)
  shake()
  getState()     // returns { marble, tilt, evidence[], L_sum, snags }
  ready          // promise resolving after fields and first frame
  ```

  Physics is deterministic under `advance` for Playwright.

## 11. Cut order if time runs short
Cut in this order: depth of field → ball-lens refraction (switch to a steel bearing with reflections) → frottage flip (keep residue) → pile direction → Lights Out.

**Never cut:** the dilated contact fields, the marble's bounce and modal ring, cloth friction with stick-slip, burlap scrubbing through the layers, the lamp ring, and grit avalanching on tilt. These make it a toy.
