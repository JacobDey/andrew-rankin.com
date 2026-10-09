# Texturedle: Game Design Document (final)

**Slug:** `texturedle` · **URL:** `/games/texturedle/` · **Frame:** ▸01 · **Accent:** rust (`--ar-game-texturedle` `#A84B22` / lit `#EA8A5F`)
**Sources:** `concepts/texturedle-toy.md`, `concepts/texturedle-game.md`, `concepts/texturedle-craft.md`, `art-direction.md`, `hub.md`. This document supersedes all three concepts. If it disagrees with a concept doc, this document wins. If it disagrees with `art-direction.md` or `hub.md` about chrome, those docs win.
**Copy rules:** UI strings are Canadian English (colour, centre, grey), sentence case, with no exclamation marks (art-direction §2).

---

## 1. Title, subtitle, pitch

# TEXTUREDLE
### *One surface a day, much too close.*
Hub tagline and registry title stay as in `hub.md` §10. In-game strapline: **Tilt it. Roll it. Rub it. Name it.**
About-sheet credit: *An idea by Andrew Rankin, dictated over a sink of dishes.*

**Pitch.** Each day you get a macro photograph of an ordinary surface, taken at five times life size. It isn't a flat image: it's a dense 3D heightfield you can handle. Tilt the stage five degrees and the raking light doubles or halves every shadow. Drop a 3 mm glass marble and listen to the thing's body ring. Wipe it with a lens cloth and see what colour comes away. Scrub it with burlap until the paint gives and the layer underneath shows through. Every probe writes a plain-language note, and you get six guesses to name the surface. Each wrong guess racks the bellows back one real macro step (5:1, 4:1, 3:1, 2:1, 1:1, 1:2), so the hint system is honest macro optics: the field of view widens, depth of field deepens, and features you couldn't see come into the frame. Day 1 is Andrew's **rusty mailbox**. Touching is free and unlimited. Only guesses cost anything.

---

## 2. Experience goals and hooks

### 2.1 Goals (in priority order)
1. **Toy first.** The bench is fun before any game shows up. No menu, no tutorial wall; the surface is live on load.
2. **Every probe is evidence.** Each sense answers a different question. Tilt and lamp show relief and gloss. The marble reports form, bounce and the body's ring. The lens cloth reports fine friction and what rubs off. The burlap reports snags and what lies under the top layer. Recipes must be authored so this holds.
3. **Photographic truth.** Every number on screen is computed from real macro formulas. The marble is always 3 mm. The scale bar is always right. A photographer should grin at the readout.
4. **A miss is a reveal.** A wrong guess widens the view and brings in new structure, so failing gives you more to play with.
5. **Change how people touch the world.** The field card always names the Tell, so players start reading real surfaces.

### 2.2 Hooks
- **10 seconds.** The page opens on the stage. The frame racks from blur to sharp macro rust in 1.2 s. The lamp sweeps once, wheeling the shadows. The marble drops in from above, goes *tonk-nnng* on the hollow steel lid, bounces three times, then drifts off the crown and runs along the stamped rib's gutter. A faint coach line appears: *Drag the surface to tilt it.* The first drag tips the stage, rust grit shivers into the pits, and the far edge goes soft (real tilt-shift).
- **1 minute.** The lens cloth squeaks over chalky green paint and comes away rust-orange. Burlap judders, snags on a flake with a *tick*, leaves a fibre behind, then scrubs through green to red primer to bright grey steel. The notes fill with five or six stamped chips. You make a first guess, the iris closes, the readout rolls from 5:1 to 4:1, and the frame opens wider.
- **10 minutes.** You solve it. The camera pulls all the way back to the mailbox on its post at dusk, the shutter fires, and a museum-label field card slides in with the Tell, the chemistry and whether you found the Secret. Then **Keep touching**: the specimen stays a toy forever. You go hunting for the Secret (throw the marble hard enough to pop a rust blister), roll the marble round the crown, and share a spoiler-free grid. Tomorrow's teaser names a habitat: *Tomorrow: something from the garden.*

---

## 3. Core loop and progression

### 3.1 Daily loop (3–6 minutes)
1. **Land.** The specimen for today's day number loads at **5:1**.
2. **Probe** (free, unlimited). Tilt, lamp, marble, lens cloth, burlap, tap. Each new fact stamps an **evidence chip** into the Field Notes (§5.9).
3. **Guess.** Pick an Atlas entry from an autocomplete box. Invalid text costs nothing: the input shakes and says *Not in the Atlas.*
4. **Feedback.** Five tiles flip (Family, Habitat, Hardness, Grain, Wear; §3.3).
5. **Rack out** (on a miss). Iris closes, bellows breathe, readouts roll to the next ratio, the iris opens on a wider bake. Toast: *Not cork. Racking out to 4:1.*
6. **Reveal** (on a solve, or after the sixth miss). A 3.5 s pull-back to a small diorama of the object, a shutter click, then the **field card**.
7. **Keep touching.** The specimen becomes a slide on the **Light Table** and is playable in **Free Touch** forever.

### 3.2 The ratio ladder (fixed table; every HUD number comes from here)
Full-frame sensor 36 × 24 mm, marked aperture f/8, circle of confusion c = 0.03 mm.
Formulas: FOV = 36/m × 24/m; N_eff = N(1+m); total DoF = 2Nc(1+m)/m²; bellows EV = 2·log₂(1+m); macro time scale s = √(6.6·FOV_w / 9810); readout fps = 30/s.

| idx | ratio | m | FOV (mm) | N_eff | DoF (mm) | +EV | time scale s | readout | scale bar | score title |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 5:1 | 5 | 7.2 × 4.8 | f/48 | 0.115 | 5.2 | 0.0696 | 430 fps | 1 mm | Fingertip Oracle |
| 1 | 4:1 | 4 | 9 × 6 | f/40 | 0.150 | 4.6 | 0.0778 | 390 fps | 2 mm | Loupe Legend |
| 2 | 3:1 | 3 | 12 × 8 | f/32 | 0.213 | 4.0 | 0.0899 | 330 fps | 2 mm | Sharp Eye |
| 3 | 2:1 | 2 | 18 × 12 | f/24 | 0.360 | 3.2 | 0.110 | 270 fps | 5 mm | Close Enough |
| 4 | 1:1 | 1 | 36 × 24 | f/16 | 0.960 | 2.0 | 0.156 | 190 fps | 1 cm | Arm's Length |
| 5 | 1:2 | 0.5 | 72 × 48 | f/12 | 2.88 | 1.2 | 0.220 | 140 fps | 2 cm | Squinter |
| — | miss | | | | | | | | | Back to the Drawer |

(Correction to the craft concept: DoF at 1:2 is 2.88 mm, not 5.8 mm.)

**Rule of landmarks.** Materials are functions of real millimetre coordinates. A landmark (rivet, seam, numeral) is simply part of the field, placed outside the 5:1 frame, so it comes into view on its own as the frame widens. Each recipe has at most one landmark per ratio, and only at 2:1 or wider. The central 7.2 × 7.2 mm must contain the **Tell**.

### 3.3 Atlas and feedback tiles
Every valid guess is an **Atlas** entry (MUST 150, SHOULD 300). Each has five attributes, and those are the tiles:

| Tile | Values | Near (◐) means |
|---|---|---|
| **Family** | Metal · Wood & Bark · Stone & Earth · Textile · Animal · Polymer · Paper & Card · Plant & Food | sibling: Metal–Stone, Textile–Animal, Wood–Paper, Wood–Plant, Polymer–Textile |
| **Habitat** | Kitchen · Wardrobe · Home · Workshop & Studio · Street & Yard · Garden · Wild · Play & Sport | adjacent on graph: Kitchen–Home, Wardrobe–Home, Home–Workshop, Home–Play, Workshop–Street, Street–Garden, Garden–Wild, Kitchen–Garden, Play–Street |
| **Hardness** ↑↓ | 1 Fluffy · 2 Soft · 3 Yielding · 4 Firm · 5 Hard | off by one |
| **Grain** ↑↓ | 1 Glassy (<10 µm) · 2 Fine (<0.3 mm) · 3 Medium (0.3–1.5 mm) · 4 Coarse (1.5–5 mm) · 5 Rugged (>5 mm or jagged) | off by one |
| **Wear** ↑↓ | 1 New · 2 Used · 3 Worn · 4 Weathered · 5 Ruined | off by one |

Tile states: **● hit** (exact), **◐ near**, **○ miss**. Ordinal tiles always show ↑ or ↓ when not exact (↑ means the answer is higher). Shape plus colour, never colour alone.

**Uniqueness lint (MUST):** no two Atlas entries may share all five values. Five hits always means solved. If two nouns collide, merge them into one entry with both as aliases: *we grade the surface, not the noun*. The lint runs as `__game.lintAtlas()` and in the smoke test.

**Narrowing (easy mode, default on):** autocomplete lists entries consistent with all feedback so far first and greys out the rest (still selectable). **Hard mode:** no greying, and every hit tile must be kept in later guesses (Wordle rule); the share header gets `*`.

### 3.4 Scoring, streak, collection
- **Score** is the ratio you solved at (table above). Probes never count against you.
- **Streak** shows as a film frame counter: `FRAME 12/36`. Consecutive solved days. 36 completes the roll (SHOULD: a contact-sheet image of all 36).
- **Light Table** (SHOULD): each played day is a 35 mm slide in a card mount stamped `001 · MAILBOX · 09 OCT 26`. Solved slides are clear, missed slides are fogged (an orange light-leak gradient), and a ✨ pin marks a found Secret. Tap a slide to open **Free Touch** (all ratios selectable, no guessing).
- **Secrets:** each specimen has exactly one hidden interaction (§6). The count found shows in stats.
- **Share text** (MUST; `navigator.share` where available, else copy to clipboard with the toast *Copied.*). Spoiler-free: tiles and probes only, never the answer or a colour name.
  ```
  TEXTUREDLE No.001 · 2/6 · 4:1 Loupe Legend
  🟨🟩🟩🟨🟩
  🟩🟩🟩🟩🟩
  👁 🔮 🧣 🪢 ✨ · andrew-rankin.com/games/texturedle
  ```
  Tiles: 🟩 hit, 🟨 near, ⬛ miss (high-contrast setting: 🟦 🟧 ⬛). Probe glyphs appear only if used: 👁 tilt/lamp, 🔮 marble, 🧣 lens cloth, 🪢 burlap, ✨ Secret found. A loss shows `X/6 · Back to the Drawer`. Hard mode adds `*` after the score. "Solved by eye" (no probe used) earns the brag line `👁 Eyes only`.
- **Hub progress note:** after each finish write `localStorage['ar:texturedle:hub'] = {"note":"Solved today at 3:1","at":<ms>}` (≤ 28 chars; on a loss write `"Today's got away"`).

### 3.5 Daily schedule
- `EPOCH = '2026-10-09'` (the launch date; change it to the actual production launch day in `game/daily.ts`). Day number = whole local days since EPOCH + 1, computed once at load.
- Days 1–30 follow the **Nettle Lane walk** (§6.2), a fixed order. After that, a deterministic shuffle of all pool recipes (`mulberry32(hash('texturedle'+cycle))`) that never repeats a recipe within 20 days. Repeat appearances use `seedSalt + cycle` so blisters and cracks move.
- If fewer recipes exist than days so far (an MVP with 10 recipes), the walk falls through to the shuffle early. Andrew's mailbox is always Day 1.
- **Archive** (SHOULD): play any past day. Results are recorded but don't touch the streak.

---

## 4. Interactions and input mapping

**Principle: touch the thing to move the thing; touch the world to tilt the world.** There are no tool modes. A press on the marble grabs the marble, a press on a cloth grabs the cloth, a press on the bezel swings the lamp, and a press on bare surface tilts the stage.

**Andrew's "camera can tilt 5°"** is implemented as the specimen stage tilting ±5° under a fixed camera and a fixed lamp. Optically that's the same as tilting the camera (parallax, focus plane sweep, light angle), and it also tips gravity so the marble rolls.

| Action | Mouse / keyboard | Touch | Notes |
|---|---|---|---|
| **Tilt** | LMB-drag on bare surface or right-drag anywhere (1° per 30 px from press point); **WASD / arrows** ramp toward ±5° at 20°/s while held | one-finger drag on bare surface (1° per 30 px) | Radial clamp 5°. On release the stage springs back to level with slight overshoot (§5.3). **T** toggles tilt lock (keeps the current tilt). |
| **Phone tilt** (opt-in) | — | Settings → *Hold like a loupe* (calls `DeviceOrientationEvent.requestPermission()` on iOS) | 5:1 reduction (25° of phone gives 5° of stage), low-pass α = 0.15, calibrated to the pose at enable time. Two-finger double-tap recalibrates. |
| **Tap the object** | **Space** | double-tap bare surface | Knuckle tap: excites the body modes at low gain, loose grains hop. Counts as body evidence. |
| **Shake** | Space ×3 within 600 ms | phone `devicemotion` > 15 m/s², or 3 tilt reversals within 600 ms | Loose material jumps; hollow bodies ring. |
| **Marble: take / place** | press on the dish and drag into the frame; click the dish to drop at frame centre; **M** drops at the hover point | drag from the dish; tap the dish | While held it hovers **2 mm** above the contact surface with a soft contact shadow. |
| **Marble: drop / throw** | release / flick and release | release / flick | Throw velocity = mean of the last 60 ms of pointer samples, converted to sim speed (§5.1), capped at 400 mm/s. |
| **Cloth: take** | drag a swatch from the tray into the frame | same | Spawns flat under the pointer; the grabbed particle is the swatch centre. Tap a swatch to lay it at frame centre. |
| **Cloth: drag** | LMB-drag on the cloth; pen pressure scales press 0.3–2× | finger drag; `Touch.force` scales press where available | **A second finger pins** the cloth where it lands (stretch it taut). Desktop: Shift+click pins (SHOULD). |
| **Cloth: keyboard strokes** | **C** = lens-cloth stroke, **B** = burlap scrub, through the hover point | — | 1.2 s scripted strokes (the same code path as `__game.dragCloth`), so keyboard-only players can probe everything. |
| **Cloth: flip** (SHOULD) | double-click the cloth or **F** | double-tap the cloth | Peels over in 500 ms to show residue and rubbing. |
| **Lamp azimuth** | drag the bezel ring; **Q/E** = ∓15° per press (hold for 60°/s) | drag the bezel ring | A ratchet tick every 5°. |
| **Lamp mode** | **L** cycles Rake → Ring (→ Cross-pol, STRETCH) | tap the lamp icon on the bezel | |
| **Focus** | wheel = manual focus (0.01 mm per notch × DoF/0.115); **[ ]** nudge; **G** returns to AF | drag the focus ring (right edge of the viewer) | AF follows the active probe, else the hover point, else the centre. Any manual input pauses AF for 4 s. |
| **Focus peaking** (SHOULD) | **P** | settings toggle | |
| **Return probes** | **R** | long-press the tray | Marble rolls back to the dish; cloths fold back. |
| **Guess** | **Enter** focuses the guess box; type; ↑↓ choose; Enter submits | tap the box, type, tap a suggestion, **Guess** | Game keys are ignored while `shouldGameIgnoreKey(e)` is true. |
| **Help / settings** | **?** / shell actions | shell actions | Shell help table is generated from this section. |

**Hit-testing order** on pointerdown inside the viewer: bezel ring (outside the frame rect, within 28 px) → marble (distance ≤ max(1.3·r, 22 px)) → cloths (nearest particle within one particle spacing, or 18 px) → bare surface. A pointer may hold one object. Two pointers on bare surface do nothing new (no pinch zoom: zooming would bypass the ladder).

---

## 5. Simulation models

All physics is custom TypeScript: deterministic, fixed-step, renderer-independent, with no `Math.random` (seeded `mulberry32` only). **Rapier is not used.** Sphere-on-heightfield, XPBD cloth and a sandpile automaton fit this problem better than a general rigid-body engine.

### 5.1 Units and macro time
- Units: **mm, s, mg**. Physics runs in **real units** (g = 9810 mm/s²) on a slowed clock: each wall frame advances sim time by `s · dt_wall` (s from §3.2). This is high-speed macro footage. At 5:1, one wall second is 0.07 sim seconds.
- Check: at a full 5° tilt, a rolling sphere accelerates at 5/7 · 9810 · sin 5° = 611 mm/s², crossing the 7.2 mm frame in 0.154 s of sim time, or **2.2 s wall**. Every ratio gives the same ~2.2 s crossing on screen.
- **Audio uses sim-time velocities directly**, so rolling and scraping sound at real speed while the picture is slow ("we slow time, never sound").
- Pointer speeds convert as `v_sim = v_wall / s`. A finger moving 7 mm/s across the 5:1 frame is a 100 mm/s real wipe.
- Marble substep h = 0.25 ms sim; substeps per frame = ceil(s·dt_wall / h), capped at 32. Cloth runs in wall time (§5.5). Tilt runs in wall time.

### 5.2 Contact fields (the core trick)
Each probe of radius r touches the **dilated heightfield** (the height of the sphere's lowest point when resting at p):

```
D_r(p) = max over |q−p| < r of [ H(q) + sqrt(r² − |q−p|²) ] − r
contact normal n = normalize(−∂D/∂x, −∂D/∂y, 1)
```

Pits narrower than the probe are bridged, wide pits trap it, sharp peaks become domes. Each probe therefore feels a different scale of the same surface, from one function.

| Probe | r (mm) | Field resolution | What it feels |
|---|---|---|---|
| Marble (3 mm glass) | 1.5 | cell = r/6, res clamped to 64–256 | curvature, ribs, blisters, pits ≥ 1 mm |
| Burlap (yarn) | 0.45 | cell = r/6, clamped 64–256 | flakes, edges, weave-scale bumps |
| Lens cloth (microfibre) | 0.08 | cell = r/6, clamped 64–256 | grain, pores, scratches |

Computation (in the bake worker): max-pool H down to the field cell size, then brute-force dilation with a precomputed disc kernel (≤ 13 cells radius; cost ≤ 256²·π·13² ≈ 35 M ops worst case, typically < 8 M). Queries use bilinear D and central-difference gradients. When abrasion changes H, the worker-free runtime recomputes D only inside the dirty rect plus r.

**Snag map** (burlap field resolution): `S = hardness_top · clamp((−∇²H_σ − κ0)/κ1, 0, 1)`, where H_σ is H smoothed with a 0.1 mm Gaussian, κ0 = 3 mm⁻¹ and κ1 = 8 mm⁻¹. Sharp, hard peaks snag.

### 5.3 Stage tilt
- Input gives a target θ_t = (θx, θy) in degrees, radially clamped to 5°. θx > 0 means the +x edge goes down.
- Spring (wall time): `θ'' = 120·(θ_t − θ) − 15.3·θ'` (ζ ≈ 0.7). Released input sets θ_t = 0 unless tilt lock is on.
- Gravity in plate space: `g_p = 9810 · (sin θx, sin θy, −cos θx · cos θy)`.
- **Nudge:** when |θ''| > 400°/s², loose grains get `v_z += 0.002·|θ''|` (mm/s sim) and a grounded marble gets the matching lateral kick `Δv = −0.02·θ''_rad·r_lever` with r_lever = 30 mm.
- Lamp and camera stay fixed in world space, so tilt changes the light angle and the focus plane (§5.8).

### 5.4 Marble
Solid soda-lime glass: r = 1.5 mm, ρ = 2.5 mg/mm³, m = 35 mg. State: centre c, velocity v, orientation quaternion q.

```
grounded:  a = 5/7·(g_p − (g_p·n)n)  −  c_rr(mat) · |g_p·n| · v̂_t
airborne:  a = g_p
integrate (semi-implicit Euler, h = 0.25 ms sim):  v += a·h ; c += v·h
contact:   z_g = D_1.5(c.xy) + r ;  n = normal at c.xy
  if c.z < z_g:
     v_n = v·n
     if v_n < −15 mm/s:  v −= (1 + e(mat))·v_n·n ; emit Impact{speed: |v_n|, x, y, mat} ; airborne
     else:               v −= v_n·n ; grounded
     c.z = z_g
  grounded only while c.z − z_g < 0.01 mm  (crests launch it naturally)
spin (visual):  ω = (n × v)/r when grounded; q integrates ω
cap |v| ≤ 400 mm/s
```

- `mat` is the top layer at c.xy (§5.6). e is restitution, c_rr rolling resistance.
- **Soft materials** (`soft.sinkMm > 0`): z_g is lowered by `sinkMm · min(1, load)` where load = |g_p·n|/9810, and c_rr is multiplied by 3. A pit-print stays in the field for `recoverS` seconds of sim time (moss, cork).
- **Held:** a critically damped spring (ω = 40 rad/s wall) pulls c toward (pointer.xy, D + r + 2 mm). Release from hover reaches the surface at √(2·9810·2) ≈ 198 mm/s, a three-to-five bounce rhythm with intervals in ratio e.
- **Off edge:** when |x| > W/2 + r or |y| > H/2 + r (the visible frame), the marble falls out of view (*plink… tonk*, panned to that side) and reappears in the dish after 1.2 s wall.
- **Ceiling recipes** (`orientation: 'ceiling'`): gravity points away from the surface. A released marble falls toward the lens and out of frame, growing and blurring as it goes. That is the Tell.
- **Dirt:** rolling over loose material blends the loose colour into the marble's tint (`dirt += 0.02·L_µm·|v|·h`, capped at 0.6). Wiping it with the lens cloth cleans it (SHOULD).
- **Ball lens** (render, §7.3): resting on the surface, the object sits inside the focal length, so the image is upright and magnified. Held at hover height, the object is beyond focus, so the image flips. Both fall out of real refraction; nothing is faked.

### 5.5 Cloths (XPBD)
Two swatches: a **lens cloth** (pale blue-grey microfibre, the fine cloth) and **burlap** cut from a light-stand sandbag (the rough cloth).

**Sizing convention:** a swatch is always cut to the stage: side L_s = 0.45 × the frame's short side. What a probe *feels* (yarn radius, thickness, friction) stays in true millimetres. The outline doesn't. The cloth simulates in **swatch units** (side = 1) so stiffness is the same at every ratio; contact queries convert with `x_mm = x_u · L_s`.

| | Lens cloth | Burlap |
|---|---|---|
| Grid (high / low tier) | 20² / 14² | 14² / 10² |
| Constraints | stretch (α = 0), shear (α = 1e-4), bend across 2 (α = 5e-4) | stretch 0, shear 1e-6, bend 2e-6 (stiff) |
| Thickness t (true mm) | 0.05 | 0.40 |
| Contact field | D_0.08 | D_0.45 |
| μ_cloth | 0.25 | 0.70 |
| Press depth (true mm) | 0.03 | 0.12 |
| Archard K (µm per 0.3 frame-widths slid) | 0.5 | 20 |
| Residue pickup k_pick | 0.5 | 0.15 |

**Solver** (wall time, 8 substeps per frame × 1 iteration, h = dt/8):
```
x* = x + h·v + h²·(0, 0, −2)               // light gravity, swatch units
for each constraint C:  Δλ = (−C − α̃λ) / (Σ w_i|∇C_i|² + α̃),  α̃ = α/h² ;  x_i += w_i ∇C_i Δλ
grabbed particle: kinematic → (pointer.xy, D(xy) + t − press)
palm pressure on neighbours: z_i −= h²·40·exp(−d²/(2·0.25²))
collision:  d_pen = D(x_i) + t − z_i ;  if d_pen > 0: z_i += d_pen
friction (Müller PBD), μ_s,k = sqrt(μ_cloth · μ_s,k(layer)):
   Δt = tangential (x_i − x_prev,i)
   if |Δt| < μ_s·d_pen:  x_i −= Δt            (static)
   else:                 x_i −= Δt·min(1, μ_k·d_pen/|Δt|)   (kinetic)
v = (x − x_prev)/h ;  v *= exp(−4h)
```
Clamp per-substep displacement to 0.5 particle spacings (stops tunnelling on bark and coir).

**Stick-slip falls out of this naturally.** A particle that turns kinetic after ≥ 3 static substeps emits a slip with energy μ_k·d_pen·|Δt|. Per frame the bench reports `slipCount` and `slipPower` (audio squeak and micro-judder). On grippy surfaces wrinkles bunch ahead of the drag; on gloss the cloth glides flat.

**Snags (burlap only):** an unpinned particle in contact where S > 0.3 gets a zero-length pin (α = 1e-6). The pin breaks when the particle is more than `(0.02 + 0.08·S)` swatch units from it. On break: emit `SnagRelease`, leave a **fibre** on the surface (a short curved line, max 32 kept), play a tick, and let the cloth lurch.

**Abrasion (Archard, frame-normalised so effort is the same at every ratio):** each contacting particle each substep removes
`Δ_µm = K · p · (|Δs_mm| / (0.3·W_mm)) / hardness_top` from the top layer in a disc of radius 0.6 × particle spacing (mm). p = palm weight (0–1) × press scale. The bench batches all wear splats for a frame and calls `runtime.abradeBatch()` once (§11.4). When a layer reaches zero the next layer shows, and `LayerRevealed` fires.

**Polish (lens cloth):** for layers with `polish > 0`: `roughness −= polish · p · |Δs|/(0.3W)`, floored at `roughnessMin`. Leather and brass buff up visibly.

**Residue:** each cloth owns a 64² RGBA residue canvas. A contact picks up `Δr = k_pick · src · |Δs|/(0.3W) · (1 − r_sat)`, where `src` is loose material L (taken from the field) or the top layer's `residue.rate` (crocking dye, chalked paint). Colour is the loose or residue rgb. Burlap's darker weave hides it.

**Frottage (SHOULD):** the lens cloth's underside canvas (128²) darkens `∝ p·|Δs|` only where the contact field let it touch, which gives a graphite-style rubbing of the high points. It's shown on flip and becomes the share image (§7.6).

### 5.6 Material stack and loose layer
Every texel has a **layer stack** (bottom → top) with per-texel remaining thickness. The **top layer** (the highest with thickness > 0) supplies all physics constants:

```ts
MaterialPhys = { hardness 0..1, muS, muK, restitution, rollResist, metalness, roughness,
                 roughnessMin?, polish?, residue?: {rgb, rate, kind}, soft?: {sinkMm, recoverS} }
```

**Loose layer L(x, y)** (µm, at physics resolution 256² high / 128² low) holds rust scale, dust, chalk, crumbs, sand. Each recipe sets its colour, grain kind and angle of repose φ.
- **Sandpile automaton** (30 Hz wall, double-buffered, fixed neighbour order): for each 4-neighbour, `slope = Δ(H+L)/dx + tan(θ along that direction)`. If slope > tan φ, move `min(L, 0.25·(slope − tan φ)·dx)` downhill. Avalanches therefore happen only where slopes were already near critical, so a tilt draws the relief in grit.
- **Visible grains:** an instanced pool (2000 high / 600 low) spawned by impacts (count ∝ energy), burlap scrubbing (flakes coloured by the removed layer) and avalanches (where the transfer is large). A grain stays at rest while the local slope is below φ, slides with `a = g(sinθ − μ_k cosθ)` (sim time) when it isn't, and merges back into L after 3 s at rest.
- **Pile (SHOULD):** recipes with `pile` (moss, flock, corduroy) store a pile direction per physics cell. Any contact rotates it toward the probe's velocity (`p ← normalize(p + 0.3·v̂)`), and the shader's sheen follows it. You can draw in velvet with the marble.

### 5.7 Body (the knock)
Every recipe has a body: a modal bank of 0–6 modes `{f Hz, T60 s, gain}`. An impact or tap excites it with a half-sine whose width comes from the struck layer's hardness (0.1 ms steel to 3 ms rubber). Each mode's gain is scaled by `|cos(π·k·x/Lx)|`, so striking different spots changes the timbre, as on a real plate. Detune each strike by ±3 %. Presets: `hollow-sheet`, `solid-stone`, `board`, `pane`, `ceramic`, `tube`, `rubber-ball`, `fruit`, `soft` (no modes). A recipe can override modes.

### 5.8 Light and optics
- **Lamp:** directional, **5600 K (`#FFF1E4`)**, elevation 15° in world space, azimuth default 135° (upper left, so bumps read as bumps). Tilting ±5° along the lamp axis moves the effective elevation between 10° and 20°. Shadow length goes as cot ε, from 5.7 to 2.7, so **tilt doubles or halves every shadow**.
- **Ring mode:** an on-axis soft light (no cast shadows) that shows true colour. **Fill:** hemisphere at 0.12, slightly cool (`#C8D4E6`).
- **Self-shadowing:** a heightfield ray-march toward the lamp in plate space: 16 steps (high) / 8 (low), step = 1.5 texels × 1.25ⁱ, soft penumbra `vis = min(vis, clamp(8·(z_ray − h)/t, 0, 1))`.
- **Depth of field (physical):** subject-side blur diameter `b = m·|Δz| / (N·(1+m))`. Screen blur in px = b / (mm per px). It's applied as a mip LOD bias of log₂(1 + blur_px) on the albedo, ORM and height samples, so there's no full-screen pass. At 5:1, 0.2 mm off focus gives 21 µm, about 3–4 px. Only a ribbon is razor-sharp; the rest is soft but readable.
- **Scheimpflug for free:** the focus plane is camera-fixed and the surface tilts, so tilting sweeps the sharp ribbon diagonally across the frame (7.2·sin 5° = 0.63 mm across 5:1, about 5 DoF widths).
- **Autofocus:** spring on focus depth (ω = 18 rad/s, ζ = 0.45). It hunts a little (overshoot, settle) and a focus-ring detent tick plays every 0.02 mm of travel.
- **Diffraction note** (for the about sheet): at f/48 the Airy disc is 2.44·λ·N_eff ≈ 64 µm on the sensor, or 13 µm on the subject. That's why ~7 µm/texel at 5:1 is the honest resolution limit.
- **Sensor dust (SHOULD):** one soft grey blob fixed in screen space, opacity ∝ (N_eff − 16)/32, so it shows at 5:1 and is gone by 1:1. Tap it: *Sensor dust. At f/48 it was always going to show.* A bulb-blower *pff* clears it (Secret-style badge "Blower", not counted as the specimen Secret).

### 5.9 Evidence: from events to Field Notes
The bench emits raw events and running stats. `game/notes.ts` turns them into **chips** using fixed thresholds on recipe parameters, so every player gets the same notes. Notes **describe, never name**. Each chip lands once with a rubber-stamp *thunk* and a caption.

| Chip id | Sense | Trigger | Text template (examples) |
|---|---|---|---|
| `bounce.lively` / `.some` / `.dead` | marble | first impact ≥ 60 mm/s; e ≥ 0.55 / 0.25–0.55 / < 0.25 | *Lively bounce* · *Some bounce* · *Lands dead* |
| `body.<preset>` | marble or tap | impact ≥ 60 mm/s or a tap | *Hollow metal ring ≈ 210 Hz* · *Dull stony tick* · *Woody knock* · *Bright clink* · *Muffled, no ring* · *Rubbery boing* |
| `roll.rattle` / `.glide` / `.crawl` | marble | 0.6 s rolling; rms of n-jitter > 0.25 rad / < 0.05 rad; c_rr > 0.2 | *Rattles over bumps* · *Glides smoothly* · *Crawls and drags* |
| `roll.drift` | marble | |θ| < 0.5° for 1.5 s and the marble accelerates > 30 % of full-tilt | *Drifts {right/left/up/down} when level: it curves* |
| `roll.channel` | marble | velocity within 15° of recipe `aniso.dir` for 80 % of 1 s | *Runs along grooves* |
| `roll.trapped` | marble | settles in a local min of D more than 0.2·r deep | *Settles in pits* |
| `roll.sinks` | marble | soft material | *Sinks in, then springs back* |
| `ceiling` | marble | ceiling recipe release | *The marble won't stay on it* |
| `lens.residue` | lens cloth | residue alpha > 0.15 | *Lens cloth comes away {colour name}, {powdery/greasy/wet/dyed/flaky/linty}* |
| `lens.clean` | lens cloth | 3 frame-widths wiped, residue < 0.03 | *Lens cloth stays clean* |
| `lens.glide` / `.grip` | lens cloth | median μ_k,eff < 0.25 / > 0.6 | *Glides* · *Grips and squeaks* |
| `lens.polish` | lens cloth | roughness drop > 0.1 | *Wiped area turns glossier* |
| `sing` | any cloth/marble | recipe `periodicMm` present and probe speed along the period normal > 20 mm/s sim | *Hums at ≈ {v/p} Hz when rubbed across* |
| `burlap.snag` / `.nosnag` | burlap | ≥ 1 snag / 3 frame-widths without | *Snags on sharp edges ×{n}* · *Never snags* |
| `burlap.layers` | burlap | each LayerRevealed (chip updates) | *Scrubs through: green → red → grey metal* |
| `burlap.sheds` | burlap | loose or flakes removed > threshold | *Sheds {colour} grit* |
| `pile.trails` | any | pile recipe, pile rotation > 60° somewhere | *Strokes leave light and dark trails* |
| `light.sheen` | tilt/lamp | lamp moved ≥ 20° or tilt ≥ 3°; classify dominant top layer | *Dull sheen* · *Glossy highlight* · *Metal glints* · *Streaked highlight* · *Sparkles* |
| `light.relief` | tilt/lamp | same trigger; (Hmax − Hmin)/FOV_w | *Shallow relief* · *Deep relief* · *Very deep relief* |
| `grit.slides` | tilt | avalanche volume > threshold | *Grit slides when tilted* |
| `stains.oneway` | lamp (ring mode) | recipe has `streakDirDeg` | *Stains all run one way* |

Colour names come from a fixed 24-name CIELAB palette (rust orange, burnt orange, brick red, pink, cherry red, mustard, straw, cream, chalk white, ash grey, slate grey, soot black, tan, mud brown, chocolate, olive, leaf green, moss green, teal, verdigris, indigo, navy, violet, silver), nearest by ΔE. Every audio clue has a chip, and every residue chip names its colour, so deaf and colour-blind players get every clue.

---

## 6. Content

### 6.1 Recipe grammar (`src/shared/surface/`)
A recipe is a TypeScript module. Its `build(k)` returns pure field functions of **specimen millimetres** (origin at the specimen centre, +x right, +y up). The baker evaluates them on any grid, at any ratio. Heights are µm unless noted. Form is in mm.

**Field primitives** (`fields.ts`, all seeded from `k.seed` plus a salt):
`fbm({scale, oct, gain, lac, warp?})`, `ridged({scale, oct})`, `worley({cell, jitter, out: 'f1'|'f2'|'edge'|'id'})`, `stripes({period, angleDeg, profile: 'sine'|'tri'|'square'|'wale', warp?})`, `weave({warp, weft, kind: 'plain'|'twill3x1'|'loop', yarnRelief})`, `hexDomes({cell, radius, height, profile})`, `cracks({cell, width, depth, curl})`, `blobs({cell, r: [a, b], density, height})`, `scratches({n, len, width, depth, arcAbout?})` (precomputed segments + spatial hash), `grooves({centre, pitch, depth, melody?})`, `ring({centre, r, width})`, `glyph({text, at, size, stroke})` (an original single-stroke engraver font in `glyphs.ts`: digits, A–Z, a few symbols), `streak({src, dirDeg, lenMm, samples: 6})` (max of src upstream with decay), `cavity()` and `convexity()` (from the pass-1 coarse bake), plus combinators `add, sub, mul, max, min, mix, smooth, clamp, scale, rotate, warp`.
**Colour:** `palette([[t, hex], …], field)`, `tint(base, field, amt)`. Colours are authored as sRGB hex and converted to linear.

**Composition per texel:**
```
H_mm = form(x,y) + (substrate.relief + Σ_k thickness_k + top.relief) / 1000
albedo/roughness/metalness = top layer's, blended toward the layer below when top thickness < 8 µm (thin paint is translucent)
ORM.r = cavity (AO); ORM.a = anisotropy strength; albedo.a = pile/sheen mask
```
**Bake passes:** (1) a coarse 128² relief pass to build cavity/convexity maps; (2) full-resolution layers; (3) contact fields, snag map, loose initial state, the audio heightfield (512², high-passed at 1 mm), and CPU mips of H. Bake square side = 1.06 × the frame's long side, so either orientation fits without re-baking.

**Every recipe must have:** an Atlas id, a Tell visible at 5:1, one Secret with a detector hook, at most one landmark per ratio (2:1 or wider), a body, a reveal prop, and a card (name, mock binomial, ≤ 90-word caption, EXIF strip). No brands, no real people, no copyrighted text.

### 6.2 Day 1 in full: the rusty mailbox
**Where we are:** on the arched lid of a galvanized steel mailbox at the end of a drive, 6 mm off the crown. Form: cylinder R = 120 mm, axis along y, crown at x = −6 mm, so `h = −(x+6)²/(2R)`. Centre slope 2.9°, so **the marble drifts right on a level stage**. At 5:1 the frame's slope runs 1.1°–4.6°, so you can balance it with tilt. At 1:2 the slopes reach 17° and it runs off both sides of a crown ridge you can now see.

| # | Layer (bottom → top) | Thickness / relief | Look | Physics |
|---|---|---|---|---|
| 0 | Galvanized steel | substrate; mill striations along y, 2 µm, 50–200 µm wavelength; zinc **spangle** = Voronoi 2–8 mm, ±6 % albedo, faint dendrite fbm | `#A7ABAE`, metal 1, rough 0.35, aniso 0.4 along y | hardness 0.9, μ 0.40/0.30, e 0.55, c_rr 0.004 |
| 1 | White rust (zinc carbonate) | 15 µm, only where 0.45 < rustFront < 0.55 (a crusty halo) | `#D9D6CC`, rough 0.95 | hardness 0.2, residue chalk white powder 0.6 |
| 2 | Red-oxide primer | 25 µm | `#8E3B2A`, rough 0.7 | hardness 0.4, μ 0.5/0.4, e 0.4 |
| 3 | Green enamel, UV-chalked | 60 µm; orange-peel waviness 1–3 mm wavelength, 3 µm; **craquelure** (worley edge, cell 0.4–0.9 mm, 15 µm wide, 40 µm deep) within 1.2 mm of blisters | `#3E5B44` lifting to `#6E8470` on up-facing areas; rough 0.55 | hardness 0.35, μ 0.35/0.30, e 0.45, c_rr 0.006, residue pale-green chalk 0.15, polish 0.2 |
| 4 | Rust scale and tubercles | where rustFront > 0.55: fbm(0.3 mm, 4 oct) mounds 200–400 µm; **pits** worley f1 cell 0.6 mm, 100–250 µm deep where hash < 0.3 | oxide mix: lepidocrocite `#C1652F`, goethite `#9C6A2E`, hematite `#7A3324`, magnetite flecks `#2A2522`; rough 0.9 | hardness 0.25, μ 0.85/0.60, e 0.2, c_rr 0.03, residue rust orange powder 0.8 |

- `rustFront = fbm(2.5 mm, 4 oct) + 0.6·convexity() + 0.4·scratchMask − 0.15`.
- **Blisters:** worley sites, cell 2.2 mm, radius 0.3–1.0 mm, domes 80–150 µm where 0.2 < rustFront < 0.55. The enamel is intact *over* the dome (rust pushes paint up), with filiform worm-tracks at the edges.
- **Scratches:** 6 slightly curved, 20–40 µm deep, 30–80 µm wide, cutting the enamel to primer or steel; rust nucleates along them.
- **Streaks:** albedo-only tear-drop stains `streak(rustFront, dir 0° (+x, downhill), 4 mm)`, multiplied toward `#8A4B2A` at 35 %. They run the same way the marble drifts, which is a coherent clue.
- **Loose:** rust flakes, `#A0522D`, φ = 38°, grain `flake`, initial 0–40 µm in cavities near open rust.
- **Rib:** a stamped stiffening rib along x at y = +2.4 mm, cosine profile 1.5 mm wide and 0.4 mm high. The marble likes to run in its gutter.
- **Contaminants:** dust specks 10–50 µm; one grass-seed husk (3 × 0.8 mm straw ellipse at (+2.6, −1.6)).
- **Landmarks:** 2:1 the crown ridge comes into frame at x = −6; 1:1 a domed flag-pivot rivet at (−12, −8), 2.5 mm radius, 1.2 mm high; 1:2 the edge of a hand-painted white numeral **7** (`glyph`, 22 mm tall, at (+22…+34, +8…+30)).
- **Body:** `hollow-sheet`: 212 / 337 / 529 / 811 / 1240 Hz, T60 1.4 / 1.1 / 0.9 / 0.7 / 0.6 s (× 0.8 rust damping), gains 1 / .7 / .5 / .35 / .25, plus a 30 ms **latch rattle** (noise AM at 90 Hz) after impacts above 0.3 µJ. *Every drop goes tonk-nnng.*
- **Tell:** the lens cloth comes away rust-orange; burlap scrubs green → red → grey metal; hollow ring.
- **Secret:** *Pop a blister.* An impact ≥ 250 mm/s (sim) on a blister cell (a drop from hover is 198 mm/s, so it takes a throw) cracks the enamel shell (enamel thickness → 0 within the blister radius), puffs 40 rust-dust grains, and peels one curl of green paint that tumbles downhill as a large flake. Sound: dry crack + pop.
- **Atlas:** Metal · Street & Yard · Hard (5) · Coarse (4) · Weathered (4). Aliases: rusty mailbox, rusted mailbox, mailbox, mail box, letterbox, letter box, post box, old mailbox, rusty letterbox.
- **Reveal:** a bespoke mailbox (box + half-cylinder lid + post + red flag up + door) at the end of a gravel drive at dusk, low warm sun. The specimen spot on the lid uses the baked albedo as a decal. An 18 % grey card leans on the post.
- **Card:**
  > **No. 001 · Rusty mailbox, lid**
  > *Ferrum rubiginosum, var. capsa epistularis*
  > Galvanized steel under green enamel, on the curve of a lid that has shed a few thousand rainstorms. The zinc went first, spending itself to protect the steel, and that white crust is the evidence. Then the iron did what iron has always wanted to do. The orange is lepidocrocite and the brown is goethite: rust is a family, not a colour. It takes up several times the room of the metal it eats, which is why it lifts paint into blisters instead of just staining it.
  > `5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 7-frame stack @ 60 µm · raking 15°`

### 6.3 The Nettle Lane walk: days 1–30
The first month is a slow walk from the road into one house, told only through surfaces. Nobody is seen or named. Day 30 is a basement darkroom sink, and its card says *Somebody still uses this room →* with a link to `/games/darkroom/`. A small tooled **sparrow** recurs (the knocker, the strap, the sink): the house's mark.

Attributes are F (Family) · Hab (Habitat) · Hd · Gr · Wr. Bodies use §5.7 presets. "L" = loose layer. Landmark ratio in brackets.

| Day | Specimen | F · Hab · Hd/Gr/Wr | Recipe (form; layers bottom → top; L) | Body · residue | Tell (5:1) | Secret | Prop |
|---|---|---|---|---|---|---|---|
| 1 | **Rusty mailbox** | Metal · Street · 5/4/4 | §6.2 | hollow-sheet · rust orange | orange cloth; green→red→grey; ring | pop a blister | mailbox |
| 2 | **Packing bubbles** (the parcel in the box) | Polymer · Home · 3/4/1 | plane; cardboard (fluted, `#A27B4E`); PE film 60 µm with hexDomes cell 11 mm, r 4.75, h 3.5 mm, rough 0.15, milky 15 % over cardboard | soft-air "thup" 180 Hz 60 ms · none | marble bounces lively off a glossy dome and rolls into the valley | burlap snag or ≥ 300 mm/s hit **pops** a bubble (dome → crumpled crater, pop) | drape on parcel |
| 3 | **Dried mud rut** | Stone · Street · 4/4/4 | concave cylinder R 400; clay `#5A4632`; silt crust with cracks cell 9 mm, 0.3–0.8 mm wide, 1 mm deep, plates curl +0.2 mm at edges; tread chevrons [1:1]; L silt `#A08A6A` φ 35° | solid-stone thud · tan powder | plate edges crumble; tan dust; marble ticks into a crack and stays | hard throw cracks a new crack line | mat (rut) |
| 4 | **Laurel hedge leaf** | Plant · Garden · 3/2/1 | cylinder R 60 (leaf curl); cuticle wax rough 0.25 `#2F5A2A`→`#4E7A35`; vein network (ridged worley, midrib at x = +12 [2:1]); stomata dots | soft · faint green wet | marble runs down vein channels; waxy glossy highlight | a dew bead appears after tilting > 4° for 2 s and rolls down the midrib | leaf on hedge |
| 5 | **Moss on the fence post** | Plant · Garden · 2/3/1 | plane; grey weathered wood; moss cushion: blobs cell 0.4 mm leaf-stars 0.2–0.6 mm on a 2–4 mm envelope, `#4F6B2A`–`#8DA642`, yellow tips; red sporophyte stalks [2:1]; soft sink 0.3 mm; pile | soft (no ring) · green, wet | marble sinks and stops dead; green wet smear | a stroke against the pile, then tilt: a water droplet beads up and rolls | mat on post |
| 6 | **Oak bark** | Wood · Garden · 5/5/4 | cylinder R 250 axis y; ridged fbm stretched 4:1 along y, furrows 8–15 mm apart, 4 mm deep; corky micro-fbm; lichen crust (flat pale `#A9B39A`) on top; L bark crumbs | board, low 140 Hz short · brown crumb | marble trapped in furrows; huge shadows | a springtail sprite hops when the marble lands within 3 mm | trunk |
| 7 | **House brick** | Stone · Street · 5/3/4 | plane (wall); fired clay `#9A4A33` with sand inclusions (worley 0.2–1 mm), air pits 0.3–1.5 mm; efflorescence white bloom (patchy); mortar joint at y > +7 mm recessed 3 mm [2:1]; L red dust φ 34° | solid-stone · brick red, gritty | burlap sheds red grit; dead stony tick; matte | a throw into the mortar dislodges a crumb (crater + particle) | wall |
| 8 | **Porch boards** | Wood · Home · 4/3/4 | plane; UV-grey wood `#8D8A82`, grain lines along x 1–5 mm with raised latewood 0.2 mm, checks along grain; old brown stain left in grooves; nail head [1:1]; board gap [1:2]; aniso along x | board 110/260/480 Hz T60 0.25 · grey fibres | marble channels along the grain; burlap catches splinters | burlap lifts a long splinter (a raised sliver detaches as a flake) | porch |
| 9 | **Coir doormat** | Textile · Home · 4/5/2 | plane; bristle tufts worley cell 2.5 mm × high-freq fibre fbm, tips 1–3 mm relief, `#B08A55` with dark dirty tips; L sand φ 33° | soft rustle · brown fibres + sand | chaotic bounces; rugged; sand on cloth | a shake makes sand rain out of the mat | mat at door |
| 10 | **Brass door knocker** | Metal · Home · 5/2/3 | cylinder R 12 (the ring); polished brass `#D8B25C` rough 0.2; brown tarnish film; verdigris `#4FA08A` in cavities (powdery); bright worn polish where hands grab; tooled sparrow [2:1] | solid brass clank 900/2400/4100 Hz T60 0.8 · **soot black** (tarnish) | lens cloth comes away black; bright spots glint | polishing one spot for 3 s turns it into a mirror with a softbox catchlight | knocker on door |
| 11 | **Flocked wallpaper** (hallway) | Paper · Home · 2/2/2 | plane (wall); cream paper fibres; original scroll motif (polar sines); burgundy flock 0.4 mm pile on the motif; seam [1:1]; L house dust | wall thud · grey dust | strokes leave light/dark trails in the flock | scrubbing the seam lifts it to an older paper underneath | wall |
| 12 | **Denim jacket** | Textile · Wardrobe · 3/2/3 | plane + soft folds (2 mm amp, 10 mm period); twill3x1 wale 0.6 mm, indigo warp `#2E4A7A` ring-dyed, white weft `#E8E2D0`; faded whiskers; periodic 0.6 mm | soft · **indigo dye** (crocking) | indigo on the lens cloth; diagonal twill; hums | burlap snags and pulls one white weft thread loose | drape on hook |
| 13 | **Corduroy armchair** | Textile · Home · 3/4/2 | plane; 11-wale stripes 2.3 mm `wale` profile; mustard `#B8892E` pile; bald shiny wale tops; aniso along y; periodic 2.3 mm | soft cushion · mustard lint | marble channels down the wales and won't cross; 26 Hz buzz | brushing against the nap leaves dark stripes that stay | armchair |
| 14 | **Vinyl record** | Polymer · Home · 5/2/2 | plane; `grooves` centred 120 mm away, pitch 0.1 mm, V 0.04 mm, gloss black rough 0.08; dust specks; fingerprint oil whorl (rough ↑); periodic 0.1 mm | pane tock · grey dust | cloth sings a clear ~600 Hz note; radial sheen | one groove carries a hidden 6-note tune: roll the marble along it and the contact synth plays it | record on turntable |
| 15 | **Cork board** | Wood · Home · 3/2/2 | plane; agglomerate pieces (worley 2–5 mm, tone ±), cells 30–50 µm, lenticel slots 0.5–2 mm; pinholes 0.6 mm [2:1]; soft sink 0.1 | soft dead thud, e 0.1 · tan crumbs | zero bounce; squeaky lens cloth | drop the marble into a pinhole and it sticks | board on wall |
| 16 | **Orange peel** | Plant · Kitchen · 3/3/1 | sphere R 38; oil-gland pits worley f1 cell 0.8–1.4 mm, 0.15 mm deep; `#E8862A`; waxy rough 0.25; stem scar [1:2] | fruit "puk" · greasy sheen | marble wobbles in dimples; oily cloth | hold the burlap still for 1.5 s: a glinting mist of oil droplets sprays | orange in bowl |
| 17 | **Strawberry** | Plant · Kitchen · 2/3/1 | sphere R 14 (edges show at 1:1); achene pits hex 2.5 mm, 0.4 mm deep, yellow seeds; wet red `#C8202A` rough 0.2; fine hairs | fruit · pink, wet | seeds sit in pits; pink wet cloth | the marble knocks a seed loose | strawberry |
| 18 | **Toast** | Plant · Kitchen · 4/3/2 | plane; crumb holes worley 0.2–2 mm; Maillard palette `#E8C88A`→`#6A3A18`; crust [1:1]; butter smear (low rough, yellow); L crumbs | dry crackle knock · crumbs, greasy | crumbs flake off; coarse holes | swinging the lamp over the butter makes it flash | slice on plate |
| 19 | **Cast-iron pan** | Metal · Kitchen · 5/2/3 | plane; as-cast sand texture 0.1–0.3 mm; polymerized seasoning satin black `#1E1C1A` rough 0.45; worn shiny spots; a little rust in one scratch | heavy clank 380/1100 Hz T60 0.6 · faint black, greasy | heavy clank; satin black; grey-black on cloth | burlap finds a bright speck of raw iron under the seasoning | pan on stove |
| 20 | **Terry tea towel** | Textile · Kitchen · 2/3/2 | plane; `weave loop` loops ~1 mm tall at 1.2 mm; white with a red stripe [1:1] | soft · white lint | loops catch the marble and the burlap | burlap snags a loop and pulls it out into a long thread | towel on rail |
| 21 | **Chalkboard** | Stone · Home · 5/2/2 | plane (wall); slate black `#22262A` fine grain 20 µm; chalk haze as L (white, φ 40°); half-erased digits `3 + 4 =` [1:1] | board · chalk white powder | lens cloth wipes the haze to deep black; chalk on cloth | after wiping the whole frame, a ghost of a chalk cat remains in the pores | board on wall |
| 22 | **Basketball** | Polymer · Play · 4/3/3 | sphere R 120; pebbles worley f1 domes cell 1.6 mm 0.3 mm; orange-brown `#C2602A` matte, worn shiny tops; black channel seam 4 mm wide 1.5 mm deep [1:1] | rubber-ball boing 140/290 Hz, e 0.75 · grey grime | lively bounce; uniform pebbles | a shake makes the whole ball boing | ball in hall |
| 23 | **Golf ball** | Polymer · Play · 5/4/2 | sphere R 21.35; dimples 3.8 mm, 0.25 mm deep (hex on sphere); urethane white rough 0.3; scuffs; printed numeral "3" [1:1] | hard tock 2.4 kHz, e 0.8 · none | marble settles into a dimple | tilt in circles until the marble orbits inside one dimple three times | ball on tee |
| 24 | **Hook-and-loop strip** (camera bag) | Polymer · Wardrobe · 4/2/2 | plane; nylon J-hooks 0.3 mm on a 0.6 mm grid, black; snag S high everywhere | soft · none | the cloth *sticks*; flick to free it | yank the burlap free fast for a long *rrrrip* (snag cascade) | bag flap |
| 25 | **Leather camera strap** | Animal · Workshop · 3/2/3 | plane + slight bend; full-grain pores 0.1–0.2 mm in clusters; grain wrinkle network 30 µm; tan `#9A6234` darker at edges; crease [2:1]; saddle stitching [1:1]; polish 0.3 | soft "thup" · faint tan | lens cloth buffs it glossy; fine pores | polishing 4 s reveals a tooled sparrow | strap on camera |
| 26 | **Brushed aluminium light stand** | Metal · Workshop · 5/2/2 | cylinder R 12 (tube edge at 1:1); brush scratches 5 µm along x; satin anodized; dings; tape residue patch [1:1] (sticky: μ ×2) | tube ring 1.8/4.9 kHz T60 1.2 · grey smudge | streaked highlight; marble glides along the brush | the sticky tape residue grabs the lens cloth and won't let go | light stand |
| 27 | **Coarse sandpaper** | Paper · Workshop · 5/3/2 | plane; garnet grit peaks (blobs 0.27 mm, faceted, glitter) `#8A4A2E`; resin bond; torn edge showing backing [1:1]; L abrasive dust; snag high for both cloths | paper tick · lint left on surface | marble screeches; glitter; burlap frays | vigorous lens-cloth rubbing tears a tiny hole in the cloth | sheet on bench |
| 28 | **Popcorn ceiling** (stairwell) | Stone · Home · 4/4/3 | plane, `orientation: 'ceiling'`; vermiculite blobs 1–5 mm clustered, 1–3 mm relief, `#E8E3D6` with yellowed patches; cobweb strand; L crumbs φ 45° | plaster dull · white crumbly | **the marble won't stay on it**; crumbs fall toward you | the cobweb glints only when the lamp is within 10° of perpendicular to it | ceiling (look up) |
| 29 | **Contact-sheet paper, coffee ring** | Paper · Workshop · 4/1/2 | plane; glossy baryta, 50 µm undulation; printed frame rows and edge text `SURVEY 100` [1:1]; coffee ring (dark edge 0.5 mm); fingerprint whorl (rough ↑) | paper tick · faint brown | mirror softbox catchlight; silent glide; fingerprint | wiping off the fingerprint reveals frame number `12A` | sheet on desk |
| 30 | **Darkroom sink** | Metal · Workshop · 5/1/3 | plane; brushed stainless `#B9BCBF` along x; mineral water-spot rings; **fixer crystals** (white faceted blobs 0.2–1 mm, glitter); brown developer stain; drain grate [1:2]; L crystal powder | hollow-sheet 160/420/880 Hz T60 1.6 · white crystal powder | hollow ring; white crystals; streaked highlight | roll the marble into the drain at 1:2 (it gurgles away) | sink, card links to Darkroom |

**Extras (SHOULD 31–36, for after the walk):** birch bark (Wood · Wild · 4/3/4; lenticel dashes, white betulin powder), granite with lichen (Stone · Wild · 5/4/4; mica flashes at one lamp angle), window frost (Stone · Home · 5/2/1; fern dendrites, the lens cloth wipes a clear melt streak), knurled steel knob (Metal · Workshop · 5/3/2; 0.85 mm knurl, growl), sourdough crust (Plant · Kitchen · 4/4/2; blisters, flour transfer), cold-press cyanotype paper (Paper · Workshop · 4/3/1; Prussian-blue fibres, links to Darkroom).

**Poster recipe (never in the pool):** `poster-peeling-paint`: peeling white paint over weathered wood, matching the hub's procedural preview (`hub.md` §4.3). The Atlas may list "peeling painted wood" as a guess, but the schedule must never choose it as an answer.

### 6.4 Atlas seed list (WP-D authors attributes and aliases; MUST 150 including all 36 above)
- **Metal:** rusty car door, galvanized bucket, copper pot, chrome tap, tin can, chain-link fence, steel wool, corrugated roof, cheese grater, coin, anchor chain, radiator, wrought-iron gate, bike chain, aluminium foil, key, cutlery, nail head.
- **Wood & Bark:** birch bark, pine bark, driftwood, plywood, chipboard, pine cone, wicker basket, bamboo, tree stump, cutting board, wooden spoon, peeling painted wood, picket fence, pencil, matchbox wood.
- **Stone & Earth:** granite, sandstone, concrete sidewalk, gravel, beach sand, terracotta pot, porcelain plate, marble countertop, slate roof, pumice, asphalt, window frost, snow, salt crust, glass bottle, crackle-glaze mug, plaster wall, grout.
- **Textile:** velvet, wool sweater, felt, lace, canvas, fleece, carpet, tweed, silk scarf, nylon rope, mesh bag, sequin fabric, knitted hat, quilted jacket, burlap sack, linen napkin.
- **Animal:** suede shoe, sheepskin, snakeskin, feather, dog fur, horsehair brush, eggshell, seashell, moth wing, honeycomb wax, natural sponge, fish scales, bone.
- **Polymer:** rubber glove, yoga mat, phone case, garden hose, toy brick, plastic bag, foam peanut, tire tread, shower curtain, kitchen sponge, bath mat, rubber band, balloon, bubble wrap (alias of packing bubbles).
- **Paper & Card:** cardboard box, corrugated cardboard, paper bag, newspaper, egg carton, paper towel, envelope, tissue, playing card, sticky note, receipt, book cloth, watercolour paper.
- **Plant & Food:** avocado skin, lemon, cabbage leaf, pineapple, potato, walnut shell, tortilla chip, cheese rind, chocolate bar, cracker, rice cake, kiwi, peach, lettuce, coffee beans, dry pasta, cucumber, apple, onion skin.

---

## 7. Art direction, UI and audio

### 7.1 Two worlds on one page
The **chrome** (shell bar, dialogs, toasts, loader, settings, help) follows `art-direction.md` exactly and follows the theme (`scheme: 'auto'`). The **bench** is an in-world instrument that stays dark in both themes: "the specimen bench at night". It sits on `--ar-bg` like a device on the light table (light theme) or in the safelit room (dark theme). The **Field Notes** and **Guesses** are photo-paper `.ar-panel`s: notes literally on paper.

**Bench tokens** (scoped to `.tx-bench`, fixed in both themes): `--tx-flock #0D0D0F` (black flocking paper), `--tx-anodized #1C1D20`, `--tx-anodized-edge #2E3035` (1 px machined chamfer), `--tx-engrave #E8E4DA`, accent `--game-accent-lit` (`#EA8A5F`) for the engraved magnification scale and the active tool.
**Tile tokens:** light theme hit `#3F7A3A`, near `#A8780F`, miss `#8A8077`; dark theme hit `#8DD27E`, near `#E9B949`, miss `#4A443D`. A high-contrast setting switches hit/near to blue `#2F6FD0` and orange `#E07B22`. Glyph text sits on tiles at ≥ 4.5:1.
**Type:** site families only. Engraved labels use Archivo at `font-stretch: 75%`, uppercase, 0.16 em tracking (edge-print style). Readouts use IBM Plex Mono 500 with tabular, slashed zeros; digits roll like an odometer on rack-out. Field cards use Fraunces (roman for the name, italic for the binomial).
**Render look:** macro realism. AgX tone mapping, linear workflow. A tiny procedural PMREM environment (a black room, one gridded rectangular softbox, a thin strip light) rotates with the lamp azimuth, so glossy paint and the marble show a **softbox catchlight**. Vignette −0.6 EV at the corners and a whisper of sensor noise in the shadows, both inside the plate shader. Light is always upper-left by default.

### 7.2 Screens and layout
`#stage.ar-stage` sits below the shell. `mountShell` is called with `helpOnFirstVisit: false` (coach marks teach instead), and actions: **Light table** (SHOULD), **Share** (after finishing), **Settings**, **How to play**.

**Play screen, desktop (≥ 1024 px):** three columns.
- *Tray* (96 px, anodized): the marble in a felt dish, the folded lens cloth, the folded burlap. DOM elements, CSS-drawn, 44 px+ targets.
- *Viewer* (flexible, 3:2): the WebGL canvas framed by a machined **bezel ring** with the lamp icon at its azimuth; corner crop marks; scale bar bottom-left; captions bottom-right; the focus ring as a ribbed vertical strip on the right edge; coach lines centred low. Under the viewer, the **readout strip** on film black: `5:1 · f/8 (EFF f/48) · DOF 0.12 MM · FOV 7.2 × 4.8 MM · +5.2 EV · 430 FPS · TILT 2.1° · LAMP 135°`.
- *Side panel* (340 px): **Field Notes** paper card (chips as stamped labels with sense icons; empty state *Touch it to take notes.*), then the **Turret** (six ratio pips with the current one lit in accent), then **Guesses** (6 rows × 5 tiles plus the guessed name), then the guess input pinned at the bottom with a **Guess** button.

**Tablet (640–1023 px):** viewer full width at top, tray as a row under its left edge, Notes and Guesses side by side below.
**Phone (< 640 px), portrait:** viewer full width with a **2:3 frame** (the FOV axes swap; the bake square covers both), max 58 dvh. The tray overlays the bottom bezel as three 48 px objects. Notes become a single horizontally scrolling chip row. Guess tiles are 30 px. The input is pinned to the bottom with safe-area padding, and the layout follows `visualViewport` resizes while the keyboard is open. Readout shortened: `5:1 · ƒ/48 · DOF 0.12 · 430 FPS`.

**Feedback beat:** tiles flip one by one, 120 ms apart (a slide-mount click each); 300 ms pause; then for a miss the **iris** (an SVG overlay with 9 rounded blades) closes over 300 ms, the bake swaps, the readout rolls (400 ms), and the iris opens one step wider over 300 ms with a focus-breathing hunt. Under reduced motion: tiles appear at once and a 150 ms crossfade replaces the iris.

**Reveal screen:** a separate Three.js scene. The camera dollies 3.5 s (ease-in-out cubic) from the specimen-equivalent pose to a 3/4 view of the prop. On arrival a leaf-shutter *tk…tk* plays with a 40 ms white flash (≤ 50 % opacity, within the photosensitivity rules). Then the **field card** (paper) slides up: number, name, binomial, caption, EXIF strip, **Tell**, **Secret** (found ✨ or *There's one more thing it can do.*), score line (*Solved at 3:1 · Sharp Eye*), buttons **Share** (primary), **Keep touching**, **Light table**, and *Tomorrow: something from the {next habitat}.*

**Light Table (SHOULD):** a backlit grid of slide mounts (thumbnail = CPU-lit 5:1 render from `thumbnail()`, so nothing needs storing). Tap a slide for Free Touch. Empty state: *Nothing on the table yet. Surfaces keep; come back tomorrow.*

**Settings dialog** (`.ar-dialog`): Captions, Haptics, Hold like a loupe (gyro), Hard mode (applies tomorrow if today has guesses), Tile colours (standard / high contrast), Room tone, Quality (auto / high / low), **Start fresh** (clears texturedle keys only).

### 7.3 Marble look (the ball lens)
A sphere mesh with an analytic fragment shader: ray-sphere hit → Schlick Fresnel (n = 1.5, F0 = 0.04) → reflection into the softbox environment → refraction in, chord to the exit point, refraction out (total internal reflection falls back to the environment) → intersect the plane z = local surface height → sample the plate's albedo, ORM and height there and shade with the lamp (no shadows) → multiply by a faint green glass tint `exp(−0.05·path_mm)`. Plus a sharp lamp highlight. On the plate: a contact AO blob, and a **long shadow** cast away from the lamp (length r·cot ε) with an elongated **caustic** in its throat along the light's travel direction. In Ring mode, a bright caustic dot sits right under the marble inside a ring shadow. The screenshot moment: *a tiny glass planet with the world inside it, on rust.*

### 7.4 Microcopy
Loader: *Warming the lamp…* / *Stopping down…* / *Cleaning the sensor (mostly)…*. Wrong guess: *Not cork. Racking out to 4:1.* Solve: *Specimen confirmed. Frame 12 exposed.* Loss: *Released at 1:2. Today's surface was…* Invalid: *Not in the Atlas.* Coach lines (§9). All within the art-direction length rules.

### 7.5 Procedural audio
Everything connects to the shared context (`getAudio()` from `src/shared/audio`) through a game bus: `voices → convolver send (small-room IR, stereo noise × e^(−t/0.05), RT60 0.35 s, wet 0.18) → texturedle bus (0.9) → shared master`. Nothing plays before the first gesture. Chrome buttons use the shared `uiSound` palette. World sounds are below.

| Voice | Recipe |
|---|---|
| **Contact synth** (AudioWorklet, `contact-worklet.js`) | Receives the 512² high-passed audio heightfield once per bake (transferred). The bench posts contacts at 60 Hz: `{id, x, y, vx, vy (sim mm/s), load}`. Per sample the position advances by v/fs. Catmull-Rom height sample → second difference `h[n] − 2h[n−1] + h[n−2]` → gain ∝ √|v| · load → one-pole low-pass at `clamp(|v|/(2π·0.3 mm), 200, 8000)` Hz, plus band-limited noise × the recipe's micro-roughness to fill in sub-texel detail. **You hear the real texture:** rust crunches, gloss is nearly silent, and periodic textures *sing* at f = v/pitch automatically (corduroy buzz, the record's whine, the hidden tune on Day 14). |
| **Impact** | Half-sine excitation (width from hardness) into the recipe's modal bank (§5.7), rendered straight into a Float32 AudioBuffer (≤ 1.5 s, 5 modes), stereo-panned by x. Marble glass ticks on top: partials ×1, ×2.32, ×4.25 of 5.1 kHz, 40 ms decay. Latch rattle where defined. |
| **Cloth friction** | Looping shared noise → band-pass (lens 2.5–4 kHz, Q 1.2; burlap 0.6–1.2 kHz) × √slipPower × speed, plus contact-synth voices for each held cloth's centroid. |
| **Squeak** | Per slip burst: a 12 ms exponential sine sweep 1.2 → 0.8 kHz, gain ∝ slip energy, rate-limited to 30/s. |
| **Snag** | A 2 ms high-passed (3 kHz) noise click + a 2.2 kHz "thread ping" decaying over 80 ms. |
| **Pop** | 8 ms noise burst + a 350 Hz resonance decaying over 50 ms. |
| **Rig foley** | Focus detents (2 ms noise → band-pass 1.8 kHz, Q 8); bellows breath (low-passed noise swelling over 500 ms) + 9 iris-blade ticks; lamp ratchet every 5°; tile flips (slide-mount click). |
| **Solve sting** (no music) | Leaf shutter *tk…tk* 5 ms apart, then the marble dropping back into its glass dish and bouncing with restitution 0.78 (first interval 180 ms, each tick quieter): *tink, tink, tink-tink-tinktink*. |
| **Room** (toggle, default on) | Pink noise at −48 dB, low-passed at 400 Hz, plus a single drip from a tap into a sink every 11 ± 3 s (1.4 → 0.7 kHz pitch drop over 60 ms), a nod to the dishes. |

**Captions** (on by default when the OS asks for reduced motion, otherwise off; a setting) show bracketed lines bottom-right for 1.5 s: *[hollow metal ring, latch rattles]*, *[gritty crackle]*, *[low buzz, rising with speed]*.
**Haptics** (touch only, tied to the sound preference): impact 4–30 ms ∝ energy, snag 8 ms, shake 20 ms.
**Fallback** without AudioWorklet: pre-rendered noise buffers through BiquadFilter chains with gain and centre frequency driven by local roughness and speed.

---

## 8. Save states and persistence

- **Key:** `localStorage['ar:texturedle:save']`, JSON, versioned. Every read and write is wrapped in try/catch (private mode just doesn't persist). Also `ar:texturedle:hub` (§3.4).
```ts
interface SaveV1 {
  v: 1;
  firstSeen: string;                       // ISO date
  settings: { captions: boolean; haptics: boolean; gyro: boolean; hard: boolean;
              tiles: 'standard' | 'contrast'; roomTone: boolean; quality: 'auto' | 'high' | 'low' };
  onboarding: { beats: number };           // bitmask of completed coach beats
  days: Record<number, DayRecord>;         // keyed by day number
  stats: { played: number; solved: number; histogram: number[];   // 7 bins: ratios 0..5 + miss
           streak: number; bestStreak: number; lastSolvedDay: number; secrets: string[]; blower: boolean };
}
interface DayRecord {
  recipeId: string; status: 'playing' | 'solved' | 'lost'; mode: 'normal' | 'hard';
  guesses: string[];                       // Atlas ids, in order
  ratioIndex: number;                      // current or final
  evidence: string[];                      // chip ids, in stamp order
  probes: { tilt: boolean; marble: boolean; lens: boolean; burlap: boolean };
  secret: boolean; finishedAt?: string; archive?: boolean;
}
```
- **When to write:** after every guess, every new chip, every settings change, and on `visibilitychange → hidden` / `pagehide`. A toast *Back where you left it.* shows when a load resumes a day in progress.
- **Not saved:** physics state (abrasion, loose, cloth residue). Reloading mid-day restores guesses, ratio and notes over a fresh bake. That's deliberate: the surface "rests" overnight.
- **Rubbing images** (SHOULD) go to IndexedDB `andrew-rankin` / store `texturedle` (via `src/shared/storage` if it exists), keyed `rubbing:<day>`.
- `?reset=1` clears texturedle keys (tests). `?embed=poster` neither reads nor writes saves.

---

## 9. Onboarding

There's no tutorial wall and no separate tutorial specimen: it all happens on today's specimen, so Andrew's mailbox is the first thing anyone sees.

1. **Intro (every load, skippable by any input):** frame racks from blur to sharp (1.2 s), the lamp sweeps 90° → 135°, the marble drops from above at the centre. First visit only: it lands with full sound once audio is unlocked; otherwise it's silent and the first tap replays the ring.
2. **Coach beats** (first visit only). Each appears only after **6 s without input**, is one line, sits low in the viewer next to a pulsing target, and fades the moment you act:
   - *Drag the surface to tilt it.* (ghost-hand mime; done at ≥ 2° of tilt)
   - *Pick up the marble.* (dish pulses; done on a drop)
   - *Wipe it with the lens cloth.* (done after 1 frame-width of wiping)
   - *Scrub it with the burlap.* (done after 1 frame-width of scrubbing)
   - *What is this? Name it below.* (guess box glows; shown after ≥ 3 chips or 60 s)
   On phones, beat 1 also offers a chip **Hold like a loupe** (the gyro permission prompt).
3. **First chip** pulses once and stamps with a *thunk*. **First feedback row:** a one-line legend under the grid, *● right · ◐ close · ○ no · ↑ more / ↓ less*. Long-pressing or hovering any tile explains it.
4. **How to play** (shell help, opened on demand): intro *Name today's surface in six guesses. Touching is free; every miss racks the lens back and shows more.*, the controls table from §4, and four tips (the marble is a magnifier; tilt doubles the shadows; every sound has a caption; the field card always names the Tell).

---

## 10. Scope tiers

**MUST (shippable MVP, one build round):**
- Bake pipeline in a worker (1024² high / 512² low), contact fields, snag map, CPU mips, runtime with abrasion and dirty rects, carrying edits across ratios.
- Recipes for **days 1–10** plus `poster-peeling-paint`. Atlas ≥ 150 entries with all 36 named specimens, uniqueness lint passing.
- Stage tilt (pointer, keys), lamp swing, Rake/Ring, heightfield shadows, physical DoF via mip bias, AF.
- Marble: drop, throw, bounce, roll, off-edge return, ball-lens shader, shadow and caustic.
- Both cloths (XPBD) with friction, stick-slip, residue, burlap snags and abrasion through layers. Keyboard strokes C/B.
- Loose layer automaton + grain particles. Tap/shake.
- Audio: contact synth (with fallback), modal impacts, cloth friction, squeak, snag, pop, foley, solve sting. Captions.
- Daily loop: six-ratio ladder, five tiles, autocomplete with easy-mode greying, iris transition, readout and scale bar, Field Notes chips (§5.9), reveal with the **bespoke mailbox** plus a generic **panel** prop for everything else, field card, spoiler-free share text, save/streak, hub note, coach beats.
- Shell integration, `?embed=poster` + `poster()`, `window.__game` (§13), the shared no-WebGL2 card, quality auto-tier, phone layout.

**SHOULD:**
- Recipes for days 11–30 + extras 31–36; Atlas 300.
- Prop archetypes: sheet-box, panel, slab, drape, sphere, disc, mat, cylinder.
- Light Table + Free Touch + Archive; Hard mode; high-contrast tiles.
- Cloth flip + frottage + the rubbing share image (`navigator.share` with a file, else download).
- Pile direction (moss, flock, corduroy); anisotropic GGX; glint star sprites; focus peaking; sensor dust; gyro tilt; second-finger pins; marble dirt and cleaning.
- Canvas2D bench when WebGL2 is missing (CPU-lit relief recomputed on lamp/tilt change at 15 Hz, sprite marble, flat cloth mesh, the same physics).
- Bake split across 2–4 workers; progressive 256² preview while the full bake runs.

**STRETCH:**
- **Lights Out Sundays** (lamp off; solve by sound, haptics and the flipped cloth).
- **Drawer Dive** (endless, four choices, three cracked lenses).
- **Send a Specimen** (URL hash `recipeId + seed + ratio`).
- **Make a Specimen** from an imported PNG (luminance → heightfield, pick a physics preset, share a 64² hash).
- Cross-pol lamp with a polarizer dial (Malus, I = I₀cos²θ), longitudinal chromatic aberration (magenta in front, green behind), a light-in-the-lamp-cone dust-mote layer, the tablecloth trick (marble on the lens cloth, yank).
- **Macro shot → Darkroom**: save the current frame as a negative into `src/shared/filmcan` if that module exists.
- The 36-frame contact sheet when a roll completes; the luminance histogram HUD.

**Cut order if time runs short:** Lights Out → rubbing image → anisotropic GGX → extra props (use the panel) → Canvas2D bench (keep the card) → cloth flip → pile → grain particles (keep the L field).
**Never cut:** contact fields; marble bounce and body ring; cloth friction and residue; burlap abrasion through layers; lamp swing with heightfield shadows; the ratio ladder with real numbers; evidence chips; the five-tile feedback; the mailbox reveal.

---

## 11. Tech plan

### 11.1 Files
```
games/texturedle/
  index.html              D  page per art-direction §11 (data-game="texturedle", theme boot, #stage)
  main.ts                 D  boot, shell, quality detection, wiring, main loop
  contracts.ts            I0 frozen types for sim/render/game (re-exports @shared/surface types)
  style.css               D
  game/  daily.ts state.ts guess.ts atlas.ts atlas-lint.ts notes.ts save.ts share.ts onboarding.ts    D
  ui/    hud.ts tray.ts notes-panel.ts guess-panel.ts turret.ts iris.ts field-card.ts light-table.ts settings.ts coach.ts   D
  input/ input.ts gyro.ts                                                                         D
  debug/ test-api.ts inspector.ts (?debug=bake|library overlays)                                 D
  test/  smoke.steps.json smoke.mobile.steps.json                                                D
  sim/   timebase.ts tilt.ts marble.ts cloth.ts loose.ts grains.ts bench.ts stats.ts mock-surface.ts   B
  audio/ engine.ts contact-worklet.js modal.ts voices.ts captions.ts                               B
  render/ renderer.ts plate.ts plate.glsl.ts marble.ts marble.glsl.ts cloth.ts grains.ts env.ts optics.ts
          fallback2d.ts mock-bake.ts reveal/diorama.ts reveal/props.ts reveal/mailbox.ts         C
src/shared/surface/                                                                               A
  index.ts types.ts noise.ts fields.ts colour.ts glyphs.ts baker.ts bake.worker.ts bake-client.ts
  contact.ts runtime.ts thumbnail.ts recipes/index.ts recipes/r001-rusty-mailbox.ts … recipes/r036-*.ts
  recipes/poster-peeling-paint.ts
```

**Why `src/shared/surface/` is shared:** the recipes are pure functions of real millimetres, so any game can bake any surface at any scale. Studio's backyard and Lens Bench's props can use the **actual Day-1 mailbox** (`bakeSurface(getRecipe('rusty-mailbox'), {sizeMm: 300, res: 512})`). A player who solved No. 001 will recognize it through another game's lens. The noise library (`mulberry32`, `hash2`, `valueNoise2`, `simplex2`, `worley2`, `fbm2`) is generally useful too. WP-A owns the folder; other teams import only from `@shared/surface` (`index.ts`), and the public API freezes at integration. If another team has already created `src/shared/noise/`, `noise.ts` re-exports it instead of duplicating it.
Texturedle **consumes** but never edits `src/shared/ui/*`, `src/shared/audio/*`, `src/shared/games.ts` (hub team). If those modules aren't in yet, code against the documented API in `hub.md` §9 and art-direction §10, with local shims in `ui/shims.ts` that the integrator deletes.

### 11.2 Key interfaces (frozen at I0)
```ts
// ---------- src/shared/surface/types.ts (A) ----------
export type RGB = [number, number, number];                 // linear 0..1
export type Field = (x: number, y: number) => number;        // specimen mm
export type ProbeKind = 'marble' | 'lens' | 'burlap';
export type PropKind = 'mailbox' | 'sheet-box' | 'panel' | 'slab' | 'drape' | 'sphere' | 'disc' | 'mat' | 'cylinder';
export interface RecipeKit { seed: number; /* every §6.1 primitive and combinator, plus */ convexity(): Field; cavity(): Field; hex(s: string): RGB }
export interface BenchEventLike { t: string; x?: number; y?: number; speed?: number; by?: string; layer?: number }  // structural subset of BenchEvent
export interface SecretHit { id: string; x: number; y: number }                // D marks the day's secret found, B/C play the effect
export interface MaterialPhys {
  hardness: number; muS: number; muK: number; restitution: number; rollResist: number;
  metalness: number; roughness: number; roughnessMin?: number; polish?: number;
  residue?: { rgb: RGB; rate: number; kind: 'powder' | 'grease' | 'wet' | 'dye' | 'flake' | 'lint' };
  soft?: { sinkMm: number; recoverS: number };
}
export interface LayerSpec { name: string; colourName: string; phys: MaterialPhys;
  thicknessUm: Field; reliefUm?: Field; albedo: (x: number, y: number, out: RGB) => RGB; roughness?: Field }
export type FormSpec = { kind: 'plane' } | { kind: 'cylinder'; radiusMm: number; axisDeg: number; crownOffsetMm: [number, number]; concave?: boolean }
                     | { kind: 'sphere'; radiusMm: number; edge: 'void' };
export interface BodySpec { preset: 'hollow-sheet'|'solid-stone'|'board'|'pane'|'ceramic'|'tube'|'rubber-ball'|'fruit'|'soft';
  modes?: Array<[fHz: number, t60: number, gain: number]>; rattle?: boolean }
export interface SurfaceRecipe {
  id: string; no: number; atlasId: string; name: string; binomial: string;
  orientation: 'floor' | 'wall' | 'ceiling'; form: FormSpec; body: BodySpec;
  aniso?: { dirDeg: number; strength: number }; periodicMm?: number[]; streakDirDeg?: number;
  loose?: { rgb: RGB; reposeDeg: number; grain: 'dust' | 'sand' | 'flake' | 'crumb' };
  pile?: { dirDeg: number };
  tell: string; secret: { id: string; text: string };
  card: { title: string; caption: string; exif: string };
  reveal: { prop: PropKind; scene: 'drive' | 'yard' | 'garden' | 'hall' | 'kitchen' | 'studio' | 'darkroom' };
  pool: boolean;                                              // false for the poster recipe
  build(k: RecipeKit): { substrate: LayerSpec; layers: LayerSpec[]; looseInitUm?: Field; blisterMask?: Field };
  secretHook?(e: BenchEventLike, rt: SurfaceRuntime): SecretHit | null;   // main thread
}
export interface ContactField { res: number; cellMm: number; radiusMm: number; data: Float32Array }
export interface SurfaceBake {
  recipeId: string; ratio: number; seed: number;
  sizeMm: number; res: number; mmPerTexel: number;           // square bake
  height: Float32Array; heightMips: Float32Array[];          // mm, includes form
  albedo: Uint8Array; orm: Uint8Array;                       // RGBA8 each
  topLayer: Uint8Array; layerT: Uint16Array;                 // µm per layer, nLayers × res²
  physRes: number; loose: Float32Array | null;               // µm
  contact: Record<ProbeKind, ContactField>; snag: Float32Array;
  audioRes: number; audioHeight: Float32Array;               // high-passed mm
  phys: MaterialPhys[];                                      // per layer index
  ms: number;
}
export interface TexRect { x0: number; y0: number; x1: number; y1: number }   // texels
export interface ContactSample { d: number; nx: number; ny: number; nz: number; layer: number }
export interface SurfaceRuntime {
  readonly bake: SurfaceBake; readonly recipe: SurfaceRecipe;
  contactAt(p: ProbeKind, x: number, y: number, out: ContactSample): ContactSample;
  materialAt(x: number, y: number): MaterialPhys;
  residueAt(x: number, y: number): { rgb: RGB; rate: number; kind: string } | null;
  snagAt(x: number, y: number): number;
  abradeBatch(splats: Float32Array, n: number): { revealed: number[]; removed: RGB[] };  // x,y,rMm,depthUm
  polishBatch(splats: Float32Array, n: number): void;
  takeLoose(x: number, y: number, rMm: number, um: number): number;
  editHeight(x: number, y: number, rMm: number, fn: (h: number, d: number) => number): void; // pops, cracks
  markLooseDirty(r: TexRect): void;
  onDirty(cb: (r: TexRect, what: 'height' | 'albedo' | 'orm' | 'loose') => void): () => void;
}
export function bakeSurface(recipe: SurfaceRecipe, opts: { ratio: number; res: number; physRes: number; seed?: number; sizeMm?: number }): Promise<SurfaceBake>;
export function createRuntime(bake: SurfaceBake, recipe: SurfaceRecipe, carryFrom?: SurfaceRuntime): SurfaceRuntime;
export function thumbnail(recipeId: string, px: number, lampAzDeg?: number): Promise<ImageData>;
export function getRecipe(id: string): SurfaceRecipe; export const POOL: readonly string[]; export const WALK: readonly string[];

// ---------- games/texturedle/contracts.ts (I0) ----------
export interface RatioSpec { label: string; m: number; fovMm: [number, number]; nEff: number; dofMm: number;
  ev: number; timeScale: number; fps: number; scaleBarMm: number; title: string }
export const RATIOS: readonly RatioSpec[];                   // exactly §3.2
export type Vec2 = { x: number; y: number };
export type ClothKind = 'lens' | 'burlap';
export interface MarbleState { where: 'dish' | 'held' | 'plate' | 'falling' | 'returning';
  pos: [number, number, number]; vel: [number, number, number]; quat: [number, number, number, number]; grounded: boolean; dirt: number }
export interface ClothState { kind: ClothKind; where: 'tray' | 'held' | 'plate'; n: number; swatchMm: number;
  pos: Float32Array; flipped: boolean; residue: Uint8ClampedArray; rubbing: Uint8ClampedArray; fibres: Float32Array }
export interface BenchState { tilt: Vec2; tiltVel: Vec2; marble: MarbleState; cloths: Record<ClothKind, ClothState>;
  grains: { count: number; data: Float32Array /* x,y,z,size,r,g,b,rot */ }; simTime: number }
export type BenchEvent =
  | { t: 'impact'; x: number; y: number; speed: number; energyUJ: number; layer: number; by: 'marble' | 'tap' }
  | { t: 'slip'; cloth: ClothKind; count: number; power: number }
  | { t: 'snag'; x: number; y: number } | { t: 'snagRelease'; x: number; y: number; s: number }
  | { t: 'layerRevealed'; layer: number; x: number; y: number; by: ClothKind }
  | { t: 'residue'; cloth: ClothKind; rgb: RGB; alpha: number; kind: string }
  | { t: 'avalanche'; volume: number } | { t: 'offEdge'; side: 'l' | 'r' | 't' | 'b' }
  | { t: 'shake' } | { t: 'settled'; x: number; y: number; inPit: boolean } | { t: 'pop'; x: number; y: number };
export interface ProbeStats { tiltMax: number; lampSwept: number; bounces: number; maxImpact: number; rollJitterRms: number;
  levelDrift: Vec2 | null; channelFrac: number; wiped: Record<ClothKind, number>; slipMuK: Record<ClothKind, number>;
  snags: number; layersRevealed: number[]; residue: Record<ClothKind, { rgb: RGB; alpha: number; kind: string }>;
  pileTurned: number; avalanche: number; polishDrop: number }
export interface AudioContacts { marble: { x: number; y: number; vx: number; vy: number; load: number } | null;
  cloths: Array<{ kind: ClothKind; x: number; y: number; vx: number; vy: number; load: number; slipPower: number }> }
export interface Bench {
  setSurface(rt: SurfaceRuntime, ratio: RatioSpec, keepMarble: boolean): void;
  setTiltTarget(deg: Vec2): void; tap(x: number, y: number): void; shake(): void;
  marbleGrab(x: number, y: number): boolean; marbleMove(x: number, y: number): void;
  marbleRelease(vxWall: number, vyWall: number): void; marbleDrop(x: number, y: number, hMm: number): void;
  clothGrab(k: ClothKind, x: number, y: number, press?: number): boolean; clothMove(x: number, y: number, press?: number): void;
  clothPin(x: number, y: number): void; clothRelease(): void; clothFlip(k: ClothKind): void; resetProbes(): void;
  step(dtWall: number): void;                                // fixed 1/60 accumulator inside
  readonly state: BenchState; readonly stats: ProbeStats;
  drainEvents(out: BenchEvent[]): BenchEvent[]; contacts(): AudioContacts;
}
export function createBench(seed: number): Bench;
export interface ViewState { ratio: RatioSpec; portrait: boolean; tilt: Vec2;
  lamp: { azDeg: number; elDeg: number; mode: 'rake' | 'ring' }; focus: { zMm: number; peaking: boolean };
  bench: BenchState; reducedMotion: boolean; timeWall: number; dust: boolean }
export interface FrameHit { x: number; y: number; inside: boolean; bezelDeg: number | null; focusRing: boolean }
export interface Renderer {
  readonly kind: 'webgl2' | 'canvas2d';
  setSurface(rt: SurfaceRuntime): void;                      // subscribes to rt.onDirty
  render(view: ViewState): void;
  clientToFrame(cx: number, cy: number): FrameHit; frameToClient(x: number, y: number): { cx: number; cy: number };
  mmPerPx(): number; setQuality(q: 'high' | 'low'): void; resize(): void;
  playReveal(recipe: SurfaceRecipe, opts: { reducedMotion: boolean }): Promise<void>; endReveal(): void;
  snapshot(): Promise<Blob>; stats(): { ms: number; calls: number; tris: number }; dispose(): void;
}
export function createRenderer(canvas: HTMLCanvasElement, opts: { quality: 'high' | 'low'; force2d?: boolean }): Renderer;
export interface AudioEngine { unlock(): Promise<void>; setSurface(rt: SurfaceRuntime): void;
  update(c: AudioContacts): void; event(e: BenchEvent): void; ui(name: 'iris' | 'detent' | 'ratchet' | 'tile' | 'stamp' | 'shutter' | 'dish' | 'thunk'): void;
  setRoomTone(on: boolean): void; onCaption(cb: (text: string) => void): () => void }
export function createAudio(): AudioEngine;
```

### 11.3 Main loop (D wires it)
```
frame(tWall):
  input.poll()                        → bench.* calls, tilt target, lamp, focus
  bench.step(dt)                      (B)
  events = bench.drainEvents()
  notes.ingest(events, bench.stats, recipe, view) → new chips → ui + save   (D)
  recipe.secretHook?.(e, rt) for each e → secret                          (A hook, D handles)
  audio.update(bench.contacts()); events.forEach(audio.event)             (B)
  focus spring update; renderer.render(view)                              (C)
  perf sampler → auto tier
```

### 11.4 Render pipeline (C)
1. **Uploads:** for dirty rects, `texSubImage2D` the albedo/ORM sub-rect (via `renderer.properties.get(tex).__webglTexture`; if that proves brittle, a full re-upload throttled to 8 Hz) and regenerate mips at ≤ 10 Hz. The height texture is **R16F with CPU mips** (`DataTexture.mipmaps`), so it never needs float render targets. Loose L uploads as an R16F physics-res texture when dirty.
2. **Plate:** a 256² (low: 128²) grid over the bake square, displaced in the vertex shader by `textureLod(height, uv, 0) + L`. The fragment shader: LOD = log₂(1 + blur_px) from §5.8; normals from height central differences at 2^LOD texels; GGX specular + Lambert diffuse, metalness workflow; heightfield shadow march; cavity AO; loose colour blend `smoothstep(0, 20 µm, L)`; marble contact AO, shadow and caustic as analytic terms (uniforms); focus peaking (SHOULD); vignette and noise.
3. **Marble** (§7.3), then **cloths** (two-sided; `MeshPhysicalMaterial` sheen for the lens cloth; procedural weave canvas maps; residue canvas multiplied in; per-frame normals from sim positions), then **grains** (`InstancedMesh` of flattened prisms with per-instance colour).
4. Output: `renderer.toneMapping = AgXToneMapping`, sRGB. No post passes in MUST.
5. **Camera:** perspective, 20° vertical FOV, top-down, distance chosen so the frame rect fills the viewer. The stage group rotates by the tilt; camera and lamp stay fixed.
6. **Reveal:** a separate scene and camera, built lazily on first reveal (props from primitives plus the specimen decal; dusk sky gradient shader; low warm sun at 8°; a ground disc).

### 11.5 Performance budget
| | Desktop (high) | Mid phone (low) |
|---|---|---|
| Frame target | 60 fps | 60 fps target, 30 fps floor |
| Physics (marble + 2 cloths + loose) | ≤ 2.5 ms | ≤ 4 ms |
| GPU render | ≤ 8 ms | ≤ 14 ms |
| Bake (worker) | ≤ 1.2 s at 1024² | ≤ 1.0 s at 512² |
| Rack-out swap (next ratio pre-baked) | ≤ 100 ms | ≤ 150 ms |
| JS heap | ≤ 120 MB | ≤ 70 MB |
| First sharp frame (cable / 4G) | ≤ 2.5 s | ≤ 4 s |
| Texturedle chunk (gzip, excluding three) | ≤ 180 KB | same |

**Prefetch:** as soon as a ratio becomes active, bake ratio + 1 in the background. Keep at most two bakes alive.
**Auto tier:** start from a guess (`hardwareConcurrency ≤ 4`, `deviceMemory ≤ 4`, iOS, small screen, or a SwiftShader renderer string → low). Drop to low when p75 frame time > 22 ms over 2 s. Never auto-raise mid-session. **Low tier:** 512² bake, 128² physics, 128² plate mesh, 8 shadow steps, cloth 14²/10², 600 grains, DPR 1. **High:** DPR min(devicePixelRatio, 2).

### 11.6 Mobile plan
`touch-action: none` and `overscroll-behavior: none` on the stage (from shared `base.css`); Pointer Events throughout, with multi-pointer for pins; portrait 2:3 frame; tray overlay; 44 px targets; `enterkeyhint="go"`, `autocomplete="off"`, `autocapitalize="none"` on the guess input; layout follows `visualViewport` while the keyboard is open; gyro opt-in; pause sim and audio on `visibilitychange`; iOS defaults to the low tier (texture-memory safety).

---

## 12. Build split

Four packages with disjoint file ownership. **I0 (integrator, ~15 min, before anyone starts):** commit `src/shared/surface/types.ts` and `games/texturedle/contracts.ts` verbatim from §11.2, plus stubs for every exported function (no-op or throwing) so every package type-checks alone. Contract changes after I0 are **additive only** (new optional fields); anything breaking goes through the integrator.

**WP-A · Surface & library** (owns `src/shared/surface/**`)
- `noise.ts`, `fields.ts` (all §6.1 primitives), `colour.ts` (sRGB↔linear, Lab, the 24 names), `glyphs.ts`.
- `baker.ts` (3 passes, pure), `bake.worker.ts`, `bake-client.ts` (worker, cache, prefetch, transferables), `contact.ts` (dilation, snag map, sampling), `runtime.ts` (sampling, abrade/polish batches, loose take, height edits, dirty rects, `carryFrom` resampling of layer thickness and L by area-mean), `thumbnail.ts`.
- Recipes 001–010 + poster (MUST), 011–036 (SHOULD), `recipes/index.ts` with `WALK`, `POOL`.
- **Done when:** the mailbox bakes at 1024² in ≤ 1.5 s on desktop; `thumbnail('rusty-mailbox', 256)` reads as green paint with rust blisters and orange streaks; carrying edits 5:1 → 4:1 keeps a scrubbed patch visible.

**WP-B · Bench physics & audio** (owns `games/texturedle/sim/**`, `games/texturedle/audio/**`)
- Timebase, tilt spring, marble, cloth XPBD (friction, slips, snags, abrasion/residue/polish batching, flip), loose automaton, grains, stats, events. `mock-surface.ts` (analytic sine relief + a two-layer stack) for testing before WP-A lands.
- Audio engine on the shared context, `contact-worklet.js` (plain JS, loaded with `audioWorklet.addModule(new URL('./contact-worklet.js', import.meta.url))`), modal bank, voices, captions, fallback path.
- **Done when:** `advance()`-driven runs are bit-identical across two runs; cloth stays stable dragged fast over the mock's 1 mm bumps; the burlap removes the mock's top layer in about 3 strokes; impacts ring.

**WP-C · Render & optics** (owns `games/texturedle/render/**`)
- WebGL2 renderer, plate and marble shaders, cloth meshes, grains, softbox env, optics (DoF bias, Scheimpflug, AF uniforms), dirty-rect uploads, quality tiers, reveal diorama (bespoke mailbox + panel MUST; other archetypes SHOULD), `snapshot()`, Canvas2D fallback (SHOULD). `mock-bake.ts` for testing before WP-A lands.
- **Done when:** the mock bake renders at 60 fps on desktop; tilt visibly changes shadow length; the marble shows an upright magnified image resting and an inverted one at hover height; the reveal plays in 3.5 s.

**WP-D · Game, UI, input, persistence, tests** (owns `games/texturedle/index.html`, `main.ts`, `style.css`, `game/**`, `ui/**`, `input/**`, `debug/**`, `test/**`)
- Page and shell, loop wiring, state machine, daily schedule, Atlas (150 → 300) + lint + guess matching (normalize; exact alias match; Damerau-Levenshtein ≤ 2 offers *Did you mean …?*), feedback and hard mode, notes engine (§5.9 table), HUD, readout, turret, iris, tray, panels, field card, share, save, hub note, coach beats, input router + gyro, settings, `window.__game`, smoke steps, `?debug=bake|library` inspector (shows maps and a thumbnail contact sheet of every recipe for art review).
- **Done when:** the whole loop plays with stubs (fake chips, a flat renderer) and the smoke test passes against stubs.

**Integration (I1–I5, integrator + all four):**
- **I1** D wires the real A baker and C renderer: a static lit mailbox with lamp and tilt.
- **I2** Add B: input → bench → renderer, plus the notes engine.
- **I3** Add audio and captions; first-gesture unlock.
- **I4** Reveal, field card, share, save; run the smoke test on desktop and mobile; fix.
- **I5** Tuning pass on the mailbox, with these targets: drift to the edge from the centre in 4–6 s wall at level; 3–5 visible bounces from hover; the burlap scrubs to grey steel in 3–4 back-and-forth strokes; 1–3 snags per scrub on rust and none on enamel; the lens cloth turns clearly orange in one pass over open rust; the hollow ring is audible over room tone at default volume; ≥ 55 fps on a mid laptop.

---

## 13. `window.__game` and the smoke test

### 13.1 Test API (`debug/test-api.ts`)
Coordinates are **frame mm** (origin at the frame centre, +x right, +y up).
```ts
interface TexturedleTestAPI {
  ready: boolean;                          // hub contract: true after the first sharp frame
  whenReady(): Promise<void>;
  version: string;
  poster(): Promise<void>;                 // hub contract: poster recipe, 5:1, lamp 135°, marble at (1.2, −0.6), no UI
  setDay(n: number): Promise<void>; loadRecipe(id: string, ratio?: number): Promise<void>; setRatio(i: number): Promise<void>;
  pause(): void; resume(): void; advance(frames: number): void;    // fixed 1/60 wall steps; renders once at the end
  setTilt(xDeg: number, yDeg: number): void; setLamp(azDeg: number, mode?: 'rake' | 'ring'): void; setFocus(zMm: number | 'auto'): void;
  dropMarble(x: number, y: number, hMm?: number): void; throwMarble(x: number, y: number, vxSim: number, vySim: number): void;
  dragCloth(kind: 'lens' | 'burlap', path: Array<[number, number]>, ms: number, press?: number): Promise<void>;  // runs physics synchronously
  flipCloth(kind: 'lens' | 'burlap'): void; tap(x?: number, y?: number): void; shake(): void; resetProbes(): void;
  guess(text: string): { ok: boolean; tiles?: string; solved?: boolean; reason?: string };
  whenIdle(): Promise<void>;               // resolves after the tile, iris or reveal animations finish
  reveal(): Promise<void>;
  toScreen(x: number, y: number): [number, number];
  state(): { day: number; recipeId: string; ratioIndex: number; status: string; guesses: string[]; evidence: string[];
             bench: { tilt: Vec2; marble: MarbleState['where']; marblePos: number[]; snags: number; layersRevealed: number[] };
             perf: { fps: number; tier: string; bakeMs: number }; errors: string[] };
  lintAtlas(): string[];                   // [] when clean
  resetSave(): void;
}
```
**URL flags:** `?test=1` (no intro, no idle animation, audio muted, DPR 1, physics advances only through `advance()`, ratio pre-bake disabled for determinism), `?day=N`, `?recipe=id`, `?ratio=k`, `?quality=low|high`, `?renderer=2d`, `?reset=1`, `?embed=poster` (hub contract), `?debug=bake|library`, plus the shared `?theme=` and `?motion=reduce`.
`body[data-tx-ready]` is set alongside `__game.ready`.

### 13.2 Smoke test (`games/texturedle/test/smoke.steps.json`, run with `scripts/shoot.mjs`)
```
node scripts/shoot.mjs "/games/texturedle/?test=1&reset=1&day=1" --steps games/texturedle/test/smoke.steps.json --out shots/tx-final.png
```
| # | Step | Expected visual / assertion |
|---|---|---|
| 1 | `waitFor body[data-tx-ready]` (30 s) | — |
| 2 | `shot shots/tx-01-land.png` | Dark bench; 3:2 frame of green chalky paint with orange rust blisters and streaks running right, lit from the upper left; readout `5:1 … 430 FPS`; scale bar `1 mm`; tray with marble and two swatches; 6 empty guess rows; notes empty state. |
| 3 | `eval __game.setTilt(5,0); __game.advance(60)` → `shot tx-02-tilt.png` | Shadows visibly shorter on one side vs. 01; the right edge slightly soft. |
| 4 | `eval __game.dropMarble(0,0,2); __game.advance(120)` → `shot tx-03-marble.png` | A glass bead ~40 % of frame width with a magnified upright view of the rust inside, a long shadow and a caustic toward the lower right. `state().evidence` includes `body.hollow-sheet` and a `bounce.*` chip. |
| 5 | `eval await __game.dragCloth('lens', [[-3,1],[3,1],[-3,0],[3,0]], 1500)` → `shot tx-04-lens.png` | Pale lens cloth on the plate with orange residue; chip `lens.residue` names rust orange. |
| 6 | `eval await __game.dragCloth('burlap', [[-2,-1],[2,-1],[-2,-1],[2,-1],[-2,-1],[2,-1]], 2500, 1)` → `shot tx-05-burlap.png` | A bright grey patch through green and red; `state().bench.layersRevealed` includes the primer and steel layer indices; chip `burlap.layers`. |
| 7 | `eval __game.guess('brick')`, `eval await __game.whenIdle()` → `shot tx-06-miss.png` | Row 1 shows tiles (Family ◐, Habitat ●, Hardness ●, Grain ◐↑, Wear ●); readout `4:1`; scale bar `2 mm`; a wider field. `state().ratioIndex === 1`. |
| 8 | `eval __game.guess('rusty mailbox')`, `eval await __game.whenIdle()` → `shot tx-07-reveal.png` | Diorama: green arched mailbox on a post at dusk with the flag up; field card `No. 001 · Rusty mailbox, lid`, *Solved at 4:1 · Loupe Legend*. `state().status === 'solved'`. |
| 9 | Second run without `reset` → `shot tx-08-resume.png` | Opens on the solved card / Keep touching (persistence). |
| 10 | `--mobile` run of steps 1–4 → `tx-09-mobile.png` | Portrait 2:3 frame; tray along the bottom bezel; chip row; guess input visible above the fold. |
| 11 | `?embed=poster`, `eval await __game.poster()` → `tx-10-poster.png` | Peeling paint over weathered wood, marble, scale bar; no shell, no panels. |
| 12 | `--eval "__game.lintAtlas()"` | `[]` |
| — | Every run | Exit 0: no page errors, no failed requests, `state().errors` empty. |

Determinism check (B): after step 4, record `state().bench.marblePos` as a golden on the first green build. Later runs must match within 0.01 mm.

---

## 14. Risks and fallbacks

| Risk | Mitigation / fallback |
|---|---|
| Bake too slow on low-end phones | 512² bakes on low tier; split rows across 2–4 workers (SHOULD); show a 256² preview first and swap in the full bake; pre-bake the next ratio while the player probes. |
| Recipes read as "noise soup" | Each recipe gets an art check on the `?debug=library` thumbnail contact sheet against its written description; the Tell must be legible in the 5:1 thumbnail. Layer stacks follow real processes (curvature → wear, cavities → grime, gravity → streaks). |
| Cloth explodes or tunnels on deep relief (bark, coir) | Collide against the smooth dilated field, clamp per-substep displacement, use 8 small substeps; a `rigidSwatch` flag falls back to a lagging rigid quad that still feeds friction, residue and abrasion. |
| Float textures and mips | Height uses R16F (filterable in WebGL2) with CPU-built mips, so no float render targets or `generateMipmap` on float. RGBA8 maps use GPU mips. |
| SwiftShader too slow for screenshots | `?test=1` forces DPR 1 and no pre-bake; `advance()` renders once; bakes at 512² under SwiftShader (detected from the renderer string). |
| AudioWorklet missing, iOS silent switch, autoplay | Buffer/biquad fallback; unlock on first gesture through the shared context; every sound clue also has a chip and caption. |
| Gyro permission friction (iOS) | Opt-in only, from an explicit tap; pointer tilt always works. |
| Feedback disputes ("a pan isn't Kitchen") | Uniqueness lint; generous aliases; tile meanings in How to play; habitat graph documented; the Atlas is data, so fixes ship without code. |
| Too hard | Five tiles narrow fast; easy-mode greying is on by default; 1:2 always shows landmarks; Monday-easy ordering in the walk (bubbles on Day 2). |
| Spoilers | Share text and image show tiles and probes only; the poster uses a non-pool recipe; no answer in URLs (only `?day=`). |
| Day boundary / time zones | Local midnight, computed once per load; a day finished after midnight still counts for the day it was loaded. |
| Shared chrome not ready | Code against the documented shell/audio APIs with local shims, swap at integration. |
| Determinism drift across browsers | Fixed steps, seeded RNG, no `Math.random`; dailies depend only on the bake (CPU, deterministic), not on GPU output. |
| Scope creep | §10 cut order. Never-cut list protects the toy. |
| IP | All specimens, names, copy, fonts (OFL via Fontsource), sounds and models are original or procedural. No brands, liveries or real people. The film stock is the invented SURVEY 100 (in-world) on the site's RANKIN 400 roll. |
