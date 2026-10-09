# Darkroom: Game Design Document

**Game 2 · slug `darkroom` · `/games/darkroom/` · frame `▸02`**
Synthesized from `concepts/darkroom-toy.md`, `darkroom-game.md` and `darkroom-craft.md`. It conforms to `art-direction.md` and `hub.md` (shell, registry, `__game` contract, shared audio and storage). Where this doc and a concept disagree, this doc wins.

**Decisions taken in synthesis (short version):**
1. **It's a toy first.** The bench is fully open from the first frame. The concepts' 16-job campaign shrinks to 8 optional corkboard briefs (SHOULD). Progression comes from the Notebook of happy accidents and the clothesline.
2. **The chemistry runs on the CPU** in typed arrays at 256×320 per sheet, not in GPU ping-pong shaders. It's deterministic, testable headless, works on SwiftShader and phones, and the 2D fallback gets it for free.
3. **Spectral light model, kept.** Every light is a 5-band vector and every emulsion has a 5-band sensitivity. Fog, variable-contrast filters and the silver/iron rule flip all fall out of one dot product.
4. **No Rapier.** All physics here is a heightfield, springs or 2D planar bodies. That saves about 2 MB of wasm and its start-up time.
5. **Controls are DOM "object widgets" pinned to 3D anchors**: switchplate, timer dial, filter drawer, prep deck. Liquids, paper, light and props are 3D. Hit-testing stays robust, and text stays crisp and accessible.
6. **Fiction:** the Lantern Street Community Darkroom, Basement Unit B, under the closed Quist Camera Repair (Lens Bench's shop). The unseen keyholder **O.** teaches through masking-tape notes, as in Studio. Paper and film brand: **Nightjar Photographic** (shared with Studio).
7. **Window and sun are SHOULD.** The UV box carries the MVP cyanotype.

---

## 1. Title, subtitle, pitch

**Darkroom**, subtitle ***Silver & Iron***. Hub tagline: *A darkroom you can slosh.*

**Pitch.** One long bench under an amber bulb, where every surface is wet, every light is a hazard and paper remembers every photon. You don't press "Develop". You rock a tray, and the picture appears **only where the liquid actually touched the paper**: shadows first, highlights last, with a pale crescent wherever the wave never reached. Print O.'s old negatives in silver, dodging with the shadow of your own hand. Or drop in your own PNG, turn it into a digital negative at the prep desk, mix ferric ammonium citrate with potassium ferricyanide (*ferri-cyanide, not cyanide*), brush-coat rag paper, expose it under UV, wash out the yellow and watch a single drop of peroxide bloom it into Prussian blue. Every mistake is a technique somebody named. The bench saves where you left it.

---

## 2. Experience goals and hooks

**Goals, in priority order**
1. **Tactile truth.** Every chemical event comes from a physical act: tilt, pour, dunk, brush, blow, flip, peek. No button does chemistry.
2. **Light is the mechanic and the look.** Dark adaptation, amber monochrome, a cool enlarger beam full of dust, the violet UV box. The image the player sees is lit the way the paper is exposed.
3. **Mistakes are techniques.** Fog, solarization, uneven development, bronzing: each is punished by physics and celebrated by the Notebook.
4. **Calm, nocturnal, honest.** 1 a.m. in a basement. No score pressure, no fail screens, just drips and the fan.

**10 seconds.** The stage is black. A faint lume dot glows on a pull-chain, and a tiny grease note reads *pull*. Pull it: *clack*, a 120 Hz hum, and the room fades up in amber (this first gesture also unlocks audio). A sheet lies in the developer tray with the liquid pooled at its near end, and the word **DARKROOM** is already blooming out of the wet half. The tray rim glints and a tape note says *rock me*. Drag the tray and a wave rolls over the dry half, carrying blacks on its leading edge. That first touch *is* development.

**1 minute.** The rest of the room arrives. Flip the guard on the room-light switch, hit it, and the fluorescent tubes *tink-tink*. Your eyes squint, and the print in the tray goes to black in a second. A tape note appears: *you too, huh.* The Notebook writes its first page. Take a practice sheet from O.'s envelope, rock it up, tong it through stop and fix, and clip it to the clothesline.

**10 minutes.** Load the rusty-mailbox negative in the enlarger, run a test strip, then print it and dodge the doorway with your hand's soft shadow. Or the iron path: import your own photo, invert it, bend the curve, print a transparency, pour A and B until the beaker looks like pond water, brush-coat (your streaks survive into the final blue), blow it dry, clamp it under glass in the UV box, wait for the shadows to bronze, wash out the yellow plumes, drop peroxide and watch the **blue bloom**. Pin the bench, then try tea toning on a branch.

---

## 3. Core loop and progression

**Micro loop (seconds):** tilt → slosh → density blooms where liquid touched → tilt again to cover the pale crescent.

**Silver loop (2–4 min):** safelight on → paper from the box → easel → negative, grade and time → expose (dodge/burn) → developer 60–90 s, rocking → stop 10 s → fix 30 s+ → lights may go on → wash → clothesline. A logbook entry writes itself.

**Iron loop (5–8 min, calmer):** mix A+B → coat → dry (wait or hairdryer) → contact frame + transparency, props or both → UV (or sun) until the shadows bronze → wash (yellow plumes) → peroxide pop → optionally tone → line.

**Progression. Nothing is gated except one emotional beat.**
- **The Notebook of happy accidents** (Logbook › Techniques): 13 MUST entries, 22 total (§6.5). Each is written in by a detector the first time the simulation sees its signature. Locked entries show as smudged thumbnails with a hint line.
- **The clothesline** keeps every print, good or bad. It's the visible history and the hub progress note (`ar:darkroom:hub` = `"4 prints on the line"`).
- **Corkboard briefs** (SHOULD, §6.6): 8 optional jobs, each scored against a simulated reference print, with Proof, Work Print and Exhibition grades.
- **The one gate:** after **8 Notebook entries**, O.'s shoebox gains frame 12, a self-portrait in a dark window. The sleeve says *your turn.*

---

## 4. Interactions and input mapping

### 4.1 Pointer model
Pointer Events everywhere, with `touch-action: none` on the stage. Each pointer-down raycasts against invisible **proxy boxes** (one `Box3` per interactable) and then the bench plane `y=0`. Pick priority: **carried item > widget > paper > prop > tool target > tray body > bench**.

- **Press-hold** = 140 ms without moving more than 6 px.
- **Drag** = moving more than 6 px.
- **Tap** = released before 140 ms without moving.

### 4.2 Master table

| Action | Mouse | Touch | Keys |
|---|---|---|---|
| Change station | Drag empty bench sideways (it snaps with inertia); click a station tab | Swipe the station strip or empty bench | `←` `→`, `1`–`6` |
| Tilt / rock a tray | Press on the tray body or rim (not on paper) and drag. The liquid is **pushed in the drag direction**, 0.06°/px, clamped to 10°. Release and it springs back and sloshes | One-finger drag on the tray, or two fingers anywhere on it (trackpad style) | Hold `W` `A` `S` `D` to tilt the active tray 6° |
| Auto-rock | Tape tab "ROCK" by each tray | Same | `R` (tray under the cursor, else the one holding paper) |
| Jolt | Fast flick (the tray also translates up to 2 cm) | Same | — |
| Pick up paper or a prop | Press-hold, or drag starting on it | Same | `Space` picks up/drops the hovered sheet |
| Move a carried item | Move | Drag | — |
| Drop | Release over a target (tray, easel, frame, line, bench, UV box, sill) | Lift finger | `Space` |
| Rotate a carried sheet | Wheel, or `Q` `E` (±15°) | Two-finger twist | `Q` `E` |
| Flip a sheet (emulsion up/down) | Right-click | Double-tap | `F` |
| Dunk | Click paper in liquid: pushes it under, flattens curl, sends out a ring wave | Tap | — |
| Room light | Click the guard (it flips up), then the switch | Tap, tap | `L` (guard + switch, 300 ms apart) |
| Safelight | Drag the pull-chain down, or click it | Tap | `K` |
| Enlarger focus lamp | Lamp switch on the head | Tap | `G` |
| Expose (timer) | Click the timer's START | Tap | `X` |
| Timer seconds | Drag the dial (1 s detents) or wheel over it | Circular drag | `+` `−` (±1 s), `Shift` ±5 s |
| Contrast grade | Slide the filter drawer (00 0 1 2 3 4 5) | Drag | `[` `]` |
| Test strip | Toggle on the timer: 5 bands × the dial's seconds | Tap | `T` |
| Dodge (hand) | During exposure, **hovering** over the easel casts a hand shadow; holding the button closes it to a fist; wheel raises/lowers the hand (softer/harder edge) | Finger on the easel; the shadow sits **60 px above the fingertip** so it is never hidden | `H` hand, `↑` `↓` height |
| Dodging wand / burn card | Pick from the tool tray. Wheel sets the burn hole radius | Tool tray | `J` wand, `B` card |
| Pour A or B | Drag the bottle sideways to tilt it (0.5°/px); release to right it. Click = one 1 ml glug | Same | — |
| Brush or rod | Pick the tool, click the beaker to load, drag across paper | Same | `C` cycles coating tools |
| Hairdryer | Pick it, hold the button to blow at the cursor | Hold | `V` (hold) |
| Contact frame | Click: open/close. Click a back half: peek (SHOULD) | Tap | `O` open/close |
| UV box lid | Click the lid (closing it turns the UV on) | Tap | `U` |
| Window blind (SHOULD) | Drag the cord down to raise it | Same | `Y` |
| Peroxide | Pick the dropper; each click over a tray drops one drop; hold = 4 drops/s | Tap / hold | `P` |
| Tap (sink) | Click the tap handle | Tap | `I` |
| Hang a print | Drop it on the clothesline | Same | `Enter` while carrying |
| Inspect a print | Click a print on the line | Tap | — |
| Fast-forward | Hold the bench clock (×8) | Hold | Hold `.` |
| Logbook | Shell action / bench notebook | Tap | `N` |
| Pin (save) | Shell action | Tap | `Ctrl+S` |
| Drop tool / close | — | Tap the tool again | `Esc` |

Rules: games call `shouldGameIgnoreKey(e)` first, as the shell requires. On desktop, tray tilt and drag-panning never compete, because panning only starts on empty bench. On touch, a vertical drag that starts on empty bench is ignored, so the page never scrolls. When a widget has keyboard focus, arrows adjust the widget instead of switching stations.

### 4.3 Accessibility
Every widget is a real focusable element with `aria-label`. `Tab` cycles the widgets of the current station. The help datasheet gets the table above as its `controls`. Reduced motion (from `prefers-reduced-motion` or `?motion=reduce`) halves slosh *display* amplitude (the simulation is unchanged), removes the flicker and squint (a 200 ms soft brighten instead) and disables camera inertia. Optional captions (logbook setting) caption sounds and smells: *[drip]*, *[fan hum]*, *[vinegar]*, *[sulfur, faint]*.

---

## 5. Simulation models

### 5.1 Units, world and layout (contract: `constants.ts`)
SI units throughout: metres, seconds, kilograms. Three.js is Y-up. The bench top is `y=0`, the back wall is the plane `z=0`, the bench front edge is `z=0.75` and `x` runs right. **Tray-local** coordinates put the origin at the tray centre, `+x` right and `+y` toward the viewer (+z world). **Paper UV** has `u` running right and `v` running down the image; the image top faces the wall when the sheet is unrotated.

| Station (focus x) | x range | Contents (centre x, z; size in m) |
|---|---|---|
| `prep` (0.60) | 0.0–1.2 | light table (0.45, 0.40; 0.50×0.40); printer + film recorder (0.98, 0.24); O.'s shoebox of negatives (0.98, 0.58); corkboard on the wall x 0.15–0.85, y 0.50–0.95; door just off-bench left |
| `enlarger` (1.80) | 1.2–2.4 | baseboard (1.75, 0.38; 0.50×0.45); easel paper area 0.203 (x) × 0.254 (z) centred (1.75, 0.40); column (1.75, 0.07); head y = 0.45; paper box (2.20, 0.52; 0.30×0.24); O.'s envelope (2.20, 0.22); found-objects tin (1.36, 0.24) |
| `trays` (3.10) | 2.4–3.8 | DEV (2.66, 0.40), STOP (3.10, 0.40), FIX (3.54, 0.40); outer 0.40×0.31, interior 0.36×0.27, lip 0.045; safelight bulb at (3.10, 1.05, 0.30); wall switch plate at (2.48, 0.55, 0) |
| `sink` (4.50) | 3.8–5.4 | sink basin x 4.0–4.8; WASH tray (4.40, 0.40) under the tap (4.40, 0.10, y 0.30); peroxide bottle + dropper (4.86, 0.20); TONE tray (5.08, 0.42; SHOULD); radio shelf (5.20, wall y 0.60; SHOULD) |
| `iron` (6.00) | 5.4–6.6 | bottle A (5.55, 0.14), bottle B (5.70, 0.14), beaker (5.86, 0.17); rag pad (5.62, 0.56); coating spot (6.02, 0.44); brush rest (6.34, 0.18); hairdryer (6.40, 0.58); contact frame home (6.30, 0.42; 0.28×0.33) |
| `window` (7.20) | 6.6–7.8 | UV box (6.92, 0.52; 0.40×0.34, with lid); window opening x 6.85–7.65, y 0.25–1.15; sunny sill x 6.85–7.65, z 0.05–0.40 (SHOULD) |

The clothesline runs along the wall at y 1.00 from x 0.5 to 7.6, with 13 clip slots 0.55 m apart.

**Camera presets.**
- Landscape: position `(fx, 1.30, 1.25)`, target `(fx, 0, 0.34)`, FOV 34°.
- Enlarger: position `(fx, 1.45, 1.05)`, target `(fx, 0, 0.40)`. The head fades to 25% opacity while a dodge tool hovers the easel.
- Portrait (aspect < 0.8): position `(fx, 1.05, 0.98)`, target `(fx, 0, 0.38)`, FOV 48°. Portrait uses **sub-focus points**: trays 2.66 / 3.10 / 3.54, sink 4.40 / 5.08.
- `fx` follows a critically damped spring, ω = 9 rad/s.

### 5.2 Tray liquid: virtual-pipes shallow water (`src/shared/fluid`)
Grid **48×36**, cell `dx = 0.0075 m` (interior 0.36×0.27). Rest depth `h0 = 0.012 m` (1.17 L). Gravity `g = 9.81`. Fixed substep `dt = 1/240 s`, with up to 8 substeps per frame through an accumulator. When a frame overruns, the simulation slows down rather than spiralling.

```
bed (tilt):      b(x,y) = -(x·tan θx + y·tan θy)          // drag direction is downhill
inertial:        φ(x,y) = (ax·x + ay·y) / g                // tray acceleration, from TrayBody
head:            H = h + b + φ
pipe flux (4 per cell, m³/s):
                 f ← max(0, f·e^(−λ·dt) + dt·g·dx·(H_c − H_n))      λ = 0.8 s⁻¹
outflow limit:   K = min(1, h·dx² / (Σf_out·dt));  f_out ← K·f_out
depth:           h ← h + dt·(Σf_in − Σf_out) / dx²
velocity:        u_x = ½(f_L→c − f_c→L + f_c→R − f_R→c) / (dx·max(h, 1e-4)), |u| ≤ 1 m/s
```

- Walls are closed, so reflection is total and λ does all the damping (a single rock rings for 3–4 s).
- Wave speed `c = √(g·h0) = 0.343 m/s`. Fundamental slosh modes: `f₁x = c/2Lx = 0.48 Hz`, `f₁y = 0.64 Hz`. **Rocking at about 0.5 Hz builds waves by resonance.** Players find it, chase it and eventually spill.
- Tilting past about 3.8° uncovers the high end (`(Lx/2)·tanθ > h0`). That uncovering is the meniscus crescent.
- **Spill:** a wall cell with `H > b_wall + lip (0.045)` loses `(H − lip)·dx²·4 s⁻¹` of volume, emitted as droplet particles. Spilled volume is gone. Each tray has a **Fill** jug (one click restores h0), so nothing softlocks. A bench stain map is SHOULD.
- **Impulse:** `impulse(x, y, r, dh)` adds a Gaussian bump and subtracts its mean, so volume is conserved. Used by dunks (+2 mm, r 2 cm), drips (+0.3 mm, r 0.6 cm) and peroxide drops.
- **Wall-impact energy** (for sound and splash): `Σ_wall ρ·h·u_n²·dx`, ρ = 1000.
- **Sleep:** if `KE = Σ ½ρ h|u|² dx² < 1e-6 J` and the tilt hasn't changed for 1 s, the tray stops stepping. Trays away from the camera's station step at ¼ rate.
- **Scalar fields** (dye, peroxide, tea) live on the same grid. Semi-Lagrangian advection by `u`, then diffusion (`D` in m²/s, 1 Jacobi step), then decay.

### 5.3 Tray body (spring-damper, `TrayBody`)
```
θ'' = k(θ_target − θ) − c·θ'          k = 140 s⁻², c = 9 s⁻¹   (ζ ≈ 0.38: one bounce)
o'' = k_t(o_target − o) − c_t·o'       k_t = 220, c_t = 18, |o| ≤ 0.02 m   (translation)
a_tray = o''  →  φ term above
```

- While held: `θ_target = clamp(0.06°/px · dragVector, 10°)` along tray axes, after projecting the screen drag onto the bench plane. `o_target = 0.1 · drag displacement in metres`, clamped.
- On release: `θ_target = 0`. On the first return through rest, emit `trayLand` with the impact speed.
- Auto-rock: `θx_target(t) = 6°·sin(2π·0.48·t)` and `θy_target = 2.5°·sin(2π·0.64·t + 1.1)`.
- Gyro tilt mode (SHOULD): `θ_target = 0.6 × device tilt`, low-passed with α = 0.15.

### 5.4 Paper as a body
**Sizes.** A sheet is 8×10 in (0.203 × 0.254 m) at **256×320** texels (desktop) or 160×200 (Low tier). A strip is 0.064 × 0.254 at 64×320.

**In a tray**, a sheet is a 2D rigid body in the tray plane: `(x, y, rot, vx, vy, ω)`.
```
v' = k_d·(ū − v);  ω' = k_d·(ω_f − ω)        k_d = 2.0 s⁻¹ floating, 0.6 s⁻¹ sunk (plus v·e^(−1.5dt) floor friction)
ū = mean fluid velocity under the sheet (9 sample points); ω_f = Σ r×(u−v) / Σ|r|²
```
Corners are clamped inside the tray interior with restitution 0.2.

**Wetness** `w` per texel: `w → 1` with τ = 1.0 s in contact, `w → 0` with τ = 25 s out of liquid.

**Curl.** A dry sheet floats with its edges lifted:
```
lift(u,v) = 0.004 m · (1 − w̄) · smoothstep(0.7, 1.0, max(|2u−1|, |2v−1|))²
```
A sheet counts as **sunk** when `w̄ > 0.7`. A dunk adds +0.35 to `w` under a 5 cm disc.

**Contact (the heart of the toy):**
```
contact(u,v) = smoothstep(0.0003, 0.0008, h_fluid(texel) − lift(u,v))      // 0.3–0.8 mm of liquid over the emulsion
```
`h_fluid` is evaluated on a 64×80 contact grid per sheet (bilinear from the fluid), then bilinearly upsampled to texels. Face-down sheets in liquid still count as in contact.

**Carried** sheets hover 3 cm above the bench. Drips fall at `6·w̄` drops per second (rate halves every 4 s) and land as tray impulses, sounds and puddle decals. In-air development continues at 0.35× while `c > 0` and `w > 0.3`: a dripping print keeps developing.

### 5.5 Light: one spectral model (`src/shared/photochem/spectral.ts`)
Bands are `[UV, Blue, Green, Amber, Red]`. Exposure rate per emulsion is `K_e · L · (I_src · S_e) · geom · occl · T_neg · x · mask`, in **EU/s** (exposure units; `E0 = 1` is a paper's speed point).

| Source | Spectrum I | Level L | Geometry |
|---|---|---|---|
| Room fluorescent | [0.001, 1.0, 1.0, 0.8, 0.6] | 6 | 1 everywhere |
| Safelight (amber) | [0, 0, 0.0005, 1.0, 0.3] | 0.32 | `(1.2/r)²`, r = bulb to sheet |
| Enlarger (halogen) | [0.01, 0.35, 0.7, 0.9, 1.0] | 1 | on the easel only; × filter × cos⁴ falloff (`1 − 0.12·ρ²`, ρ = normalized radius) |
| UV box (365 nm) | [1.0, 0.05, 0, 0, 0] | 1 | inside, lid closed; lid open leaks 0.1·(0.5/r)² into the room |
| Sun (SHOULD) | [1, 1, 1, 1, 1] | 1.33 × solar × cloud | sill: blind × solar × cloud(x,z,t). Elsewhere: 0.5 × blind (the room fills with daylight) |

| Emulsion | Sensitivity S | K |
|---|---|---|
| VC silver, hard (blue) | [1.0, 1.0, 0.02, 0.001, 0] | 1.067 |
| VC silver, soft (green) | [0.6, 0.4, 1.0, 0.002, 0] | 0.472 |
| Cyanotype | [1.0, 0.0005, 0, 0, 0] | 0.060 |

**Derived rates (unit tests must reproduce these within ±2%):**

| Source | hard EU/s | soft EU/s | cyanotype q-rate (s⁻¹) |
|---|---|---|---|
| Room light | 6.54 | 3.97 | 5.4e-4 |
| Safelight at 1.2 m | 3.5e-4 | 3.8e-4 | 0 |
| Enlarger through clear film, no filter | 0.40 | 0.40 | 6.1e-4 |
| UV box | 1.12 | 0.29 | 0.060 |
| Sun, noon, clear | 2.87 | 1.26 | 0.080 |

The contact frame multiplies whatever light reaches it by its transparency's `T` and by glass transmission (UV 0.85, visible 0.92), wherever the frame sits: on the easel (silver contact prints by enlarger light), in the UV box, or on the sill.

**Filter drawer** (multipliers on enlarger B and G): `00` [0.02, 0.85] · `0` [0.08, 0.80] · `1` [0.30, 0.75] · `2` [1, 1] (no filter) · `3` [0.75, 0.30] · `4` [0.65, 0.10] · `5` [0.60, 0.02]. Grade 2 is unfiltered. Higher grades need more time, as with real VC filters. **Split-grade printing works without any special code.**

The red swing filter (SHOULD) is [0, 0, 0, 0.05, 0.9]: safe for positioning paper.

### 5.6 Occluders (dodge, burn, props)
Occlusion is evaluated on a 128×160 grid per exposed sheet and sampled bilinearly. The transmission of a shape with signed distance `sdf` (metres, positive outside) is `T = smoothstep(−p/2, p/2, sdf)`. Shapes are scaled by `1/(1 − h/0.45)` for an occluder at height `h` under a lamp 0.45 m up.

| Occluder | Shape | Penumbra p |
|---|---|---|
| Open hand | palm ellipse 9×10 cm + 4 finger capsules (2×7 cm, splayed 12°) + thumb capsule | 4 mm + 25 mm·height01 (wheel; default 0.4) |
| Fist (button held) | ellipse 8×8 cm | same |
| Dodging wand | disc r = 1.5 cm + 1 mm wire to the sheet edge | same |
| Burn card | 30×24 cm card with a hole (r 1–5 cm, wheel) | same |
| Props (photogram, contact) | per-prop mask with partial transmission (§6.3) | 0.5 mm + 3 mm·thickness |

Exposure integrates over time, so a **moving hand feathers the edge naturally**. That's real dodging, learned by feel. The test-strip card is an occluder whose edge steps across the sheet at band boundaries. Ticks are split at the exact boundary times.

### 5.7 Silver gelatin chemistry (`src/shared/photochem/silver.ts`)
**Per-texel Float32 fields:** `Eh`, `Es` (latent exposure, EU), `A` (cached developable fraction), `d` (developed fraction), `c` (local developer activity), `x` (unfixed halide), `r` (residual fixer), `w` (wetness), `po` (print-out). The chemistry tick runs at **30 Hz** (`dt_c = 1/30 s`). Decays use exact exponentials, so fast-forward stays stable.

```
Exposure (per source):   dEh = dt·rate_h·T_neg·occl·x·mask   (same for Es)
self-mask:               mask = 10^(−0.9 · 2.05 · d)          // developed silver shields the emulsion (enables Sabattier)
face-down:               × 0.03;   in the closed box: 0

Developable fraction (Hill form of the logistic H&D curve; recompute A only when E changed > 0.5% or every 1 s):
  S_h = Eh^4.78 / (Eh^4.78 + 1)          // hard: grade-5 slope (g = 11)
  S_s = Es^1.65 / (Es^1.65 + 1)          // soft: grade-0 slope (g = 3.8)
  A   = 1 − (1 − S_h)(1 − S_s)
  A_eff = d + (A − d)·x                   // fixing freezes it

Development (autocatalytic, induction ∝ 1/exposure):
  dd/dt = k_dev · c² · contact · (d + 0.02·A_eff²) · (A_eff − d) / max(A_eff, 0.001)
  k_dev = 0.15 s⁻¹ · 1.1^(T − 20) · C_bulk     // T = 20 °C; C_bulk = tray strength (1 fresh)

Local developer (depletion, agitation, diffusion):
  dc/dt = −0.5 · 2.05 · dd/dt + (12·|u| + 0.15·(1 + 0.3·n(u,v)))·(C_bulk − c) + D_c ∇²c      D_c = 1.5 mm²/s
        // n = static seeded fbm per sheet (uneven boundary layer → mottle when still); still tray ≈ c 0.73 at peak, rocked ≈ 0.95
  stop contact: c ← c·e^(−dt/0.4);  fix contact: c ← c·e^(−dt/0.5);  in air: c ← c·e^(−0.02·dt)

Fix:    x ← x·e^(−contact_fix·dt/8)      (x < 0.05 after ~24 s: "30 s in fix, then lights")
        r ← 1 after 0.5 s of fix contact
Wash:   r ← r·e^(−contact_wash·dt·(1 + tap)/20)
Print-out: dpo/dt = 0.002 · x · (room + sun soft-rate)    // unfixed paper in light slowly goes lavender

Density:  D = 0.06 + 2.05·d + 0.35·po          (+ dry-down 0.06·sin(π·min(1, d/0.9))·(1 − w̄), SHOULD)
Albedo:   R = 10^−(D − 0.06);  rgb = lerp(#161412, #F4F2EC, R) in linear; po > 0.05 tints toward #8C7C99;
          wet: × 0.92;  alpha channel = w (drives gloss)
```

**Why it behaves:**
- Highlights have a tiny seed, so their induction is long. Shadows show at about 10 s, midtones reach half at about 30 s, highlights at about 40 s, and the print is complete by 60–75 s.
- A still tray depletes `c` beside dense areas, giving mottling and drag streaks. Rocking replenishes it.
- After a room-light flash during development, dense and midtone areas are both masked and depleted, so the new latent image there develops slowly while highlights develop fast. That's **partial reversal**. Diffusion of `c` gives light **Mackie lines** at edges.
- **Sabattier assist:** if tuning can't meet the target in §5.11, set `SABATTIER_ASSIST = true`. When a flash event (≥ 0.3 EU while mean `d/A` is between 0.15 and 0.85) is followed by fixing, apply `D −= 0.35·max(0, blur₆(D) − D)` once.
- **Exhaustion and oxidation (SHOULD):** `C_bulk −= 0.012·mean(D)·areaFraction` per print. Real-time oxidation in an open tray: `C_bulk *= 0.5^(hours/6)`. Spent developer tints toward `#7A5A2A`. The indicator stop turns `#E8C547` → `#6A3D8F` after 15 sheets. One click on the jug refreshes a tray.

**Pre-exposed sheets** (title sheet, practice envelope) start with `Eh = Es = 0.4 · T_neg · 10 s`: the reference print.

### 5.8 Cyanotype chemistry (`src/shared/photochem/cyano.ts`)
**Per-paper scalars:** `ratio = V_A/(V_A+V_B)` from the beaker, `speed = 0.6 + 0.8·ratio`, `dmax = clamp(1 − 2.5·|ratio − 0.5|, 0.3, 1)`.

**Per-texel fields:** `f` (surface film), `s` (absorbed sensitizer; 1 = one good coat = 0.004 ml/cm²), `m` (moisture), `q` (photoreduced fraction), `y` (free yellow sensitizer), `ox` (oxidation), `tb` (bleach) and `tt` (tea).

**Mixing.**
- Bottles hold 100 ml. Pour rate `Q = 8 ml/s · max(0, sin(θ − θ_lip))`, with `θ_lip = 20° + 70°·(1 − fill)`, so a full bottle glugs early. The stream glugs at 4 Hz.
- The beaker colour is `lerp(A #9DB83A, B #E09A2C, 1 − ratio)`. At 1:1 it reads as pond-water olive, `#C2BE48`.
- One sheet needs about 2 ml per coat.

**Coating.**
- Brush: 6 cm wide, 24 bristles, per-bristle load factors in [0.55, 1.25] (seeded per brush), load up to 2.0 ml.
- Deposit per frame: `ΔV = min(L, 0.9 ml/s · dt · √(L/2.0) · (0.4 + 0.6·e^(−speed/0.25)))`, spread across the swath by bristle profile × `(0.85 + 0.3·noise(along))`. **Streaks and pooled stroke ends survive into the final blue**, and strokes past the image area are the cyanotype look.
- Glass rod: smooth bead, uniform profile, 10 cm wide.
- Film: `f` diffuses (D = 2 mm²/s) and absorbs `ds = f·dt/4`. `m = min(1, m + 0.8·Δs)`.
- Drying: `df = −f·(1/4 + (1 + 6·air)/20)·dt`; `dm/dt = −m·(1 + 6·air)/90`. `air` is the hairdryer Gaussian, σ = 7 cm. Overcoat: `s` caps at 2.0 (pools bronze and stain).
- Wet paper cockles: vertex noise × `m` in the render.

**Exposure (print-out, visible live):**
```
dq/dt = 0.060·L·(I·S_c)·T_neg·occl·glass(0.85)·(1 − q)·(1 − 0.7·m)·speed·[s > 0.05]·10^(−0.2·s·q)
```
In the UV box through a clear transparency (T 0.89) and glass, `q` reaches about 0.89 at 60 s, and fully coated shadows bronze at about 75 s (compressed from about 10 min).

**Print-out colour** (dry, before wash): `#F1EBDD` rag → `#C2BE48` sensitizer (by `s`) → `#5E6B4E` olive at `q` ≈ 0.5 → `#4A5866` slate at 0.8 → **bronze `#77705F`** where `smoothstep(0.90, 0.98, q)·smoothstep(0.8, 1.2, s) > 0`. Bronzing in the shadows is the cue to pull it.

**Wash** (wash-tray contact):
- `y = s·(1 − q)` drains: `y ← y·e^(−dt·(1 + 10·|u| + tap)/5)`.
- The removed amount is injected into the tray **dye** field as yellow plumes, at the sheet's tray position (dye decays 0.03 s⁻¹ with the tap on).
- Bronze disappears.
- After wash, `Bv = dmax · s · q · (0.55 + 0.45·ox)`. Further UV does nothing.

**Oxidation:**
- Base `dox/dt = 0.004` in water and 0.0006 in air (real time while saved, SHOULD).
- **Peroxide:** each drop adds `P = 1.0` as a Gaussian (σ 1.5 cm) to the tray's peroxide field (D = 3e-4 m²/s, decay 1/30 s⁻¹), plus a +1 mm ripple.
- Paper: `dox/dt = 3.0·P_local·(1 − ox)`. The front advances about 3 cm/s, wobbling with the slosh: **denim to midnight in about 2 s**.

**Colour after wash:** `α = 1 − e^(−2.2·Bv)`, gradient `#F1EBDD` → `#2E5C8A` (α 0.55) → `#003153` (α 1).

**Toning (SHOULD, TONE tray):**
- Washing soda bleaches: `dtb/dt = 0.05·(1 − tb)`, `Bv ×= (1 − 0.7·tb)`, shifting toward pale straw.
- Tea: `dtt/dt = 0.02·(1 − tt)`. Unbleached and tea-toned, Prussian shifts toward violet-black `#2A2433`. Bleached and tea-toned gives brown-black `#3B2A22` and tan highlights `#D9C6A0`.

### 5.9 Photo prep (digital negatives, `content/prep.ts`)
**Input.** PNG, JPEG or WebP via the shell's Import action, a drop anywhere on the stage, or the binder. Decode with `createImageBitmap(file, {imageOrientation: 'from-image'})`. Centre-crop to 4:5 at 512×640 (desktop) or 320×400 (Low). Drag on the light table to shift the crop (SHOULD).

**Pipeline** (all live, under 15 ms at 512×640):
```
g  = channel ∈ {R, G, B, Lum}; Lum = (0.2126R'^2.2 + 0.7152G'^2.2 + 0.0722B'^2.2)^(1/2.2)
t  = curve( invert ? 1 − g : g )                 // displayed transparency value, 0 = black ink
t  = flipH ? mirror(t) : t                        // ink side to emulsion for contact printing
D_ink = 0.05 + range·(1 − t);  range = 1.6 (silver) | 2.0 (cyanotype, "UV-block tint" on)
T  = 10^(−D_ink)                                  // stored as the Negative's transmission map
```

**Curve.** Monotone cubic (Fritsch–Carlson) through 5 handles at x = 0, .25, .5, .75 and 1. Handles move on a spring (k = 40, ζ = 0.7) toward the dragged target, so the wire feels springy. Presets: Linear; *Silver contact* (0, .20, .48, .78, 1); *Cyanotype* (0, .34, .62, .84, 1).

**Outputs** (two levers):
1. **Inkjet transparency (8×10, `format: '8x10'`)** for the contact frame. It comes out of the printer with a wet-ink sheen for 3 s.
2. **Film recorder (`format: '35mm'`)** gives a strip for the enlarger. This is a real device, and it lets imported photos be enlarged.

**Defaults.** Invert ON, Lum, Linear, Flip ON for 8×10. Without an import, the desk offers O.'s sample images (the built-in negatives as positives).

### 5.10 Time and integration
- The **developer is always real time.** Fix (τ 8 s), wash (τ 20 s), drying (τ 90 s) and UV (about 60 s) are compressed constants, not a global time scale.
- Holding the clock (`.`) runs ×8: chemistry `dt` goes to 8/30 s, and only trays holding paper step their fluid (32 substeps). Fast-forward is disabled while a tray or tool is held.
- **Order per frame:** input → TrayBody → fluid substeps → paper bodies → chemistry ticks due (30 Hz) → detectors → albedo writes (dirty sheets) → render → audio params. `step(s)` in the test API runs the same loop headless with fixed 1/60 frames.

### 5.11 Model acceptance targets (`__game.selftest()` must report pass/fail)
| Metric | Target |
|---|---|
| Agitated fresh dev: A = 1 visible (D > 0.15) / A = 0.44 half-d / A = 0.066 half-d / 95% complete | 8–14 s / 25–35 s / 35–45 s / ≤ 75 s |
| Still tray vs rocked: completion slowdown; std dev of D in a flat mid patch | +25–40%; ≥ 0.05 |
| Safelight 240 s on white: ΔD | 0.03–0.06 |
| Room light 1 s, then developed: mean D | ≥ 1.8 |
| Mailbox negative, grade 2, 10 s, dev 90 s rocked: mean D / Dmax / border D | 0.6–0.9 / ≥ 1.95 / ≤ 0.10 |
| Grade 5 vs 00: log-exposure range ratio | ≥ 2.5 |
| UV 60 s through clear transparency: q / bronze onset | ≥ 0.88 / 70–90 s |
| Peroxide drop: ox 0 → 0.9 at drop centre / front speed | ≤ 2.5 s / 3 ± 1 cm/s |
| Fix: x < 0.05 | 25 ± 5 s of contact |
| Sabattier demo: reversal (highlight D − light-midtone D) / Mackie dip | ≥ +0.10 / ≥ 0.12 D |

---

## 6. Content

### 6.1 Props and their procedural recipes
Everything is built from Three.js primitives, Lathe/Extrude geometry and canvas textures (`render/textures.ts`, all seeded):

- **Bench:** laminate with fbm wear, scratch lines, and stain decals for spills (SHOULD). Stainless at the sink: anisotropic brushed noise.
- **Wall:** pegboard (hole grid 25 mm, painted `#5A5048`), cork (Voronoi speckle), masking tape (`--ar-tape` with torn ends), a grease-pencil arrow.
- **Trays:** rounded box with 3 floor ribs and a corner spout. DEV white, STOP red, FIX grey, WASH white. Under the safelight they look identical, so each carries a tape label in Caveat.
- **Enlarger:** box column + rack teeth, bellows (alternating dark/black segments), lamp housing with louvres, 50 mm lens barrel, four-blade easel.
- **Paper box:** "NIGHTJAR PHOTOGRAPHIC · VARI-GRADE RC PEARL · OPEN ONLY IN DARKROOM", with a hinged lid. O.'s envelope: kraft paper, *ALREADY EXPOSED*.
- **Bottles:** amber glass (lathe) with stencil labels `A · FAC 25%` and `B · FERRI 10%`. The beaker is a transparent lathe with 10 ml ruling and a liquid level mesh. Hake brush, glass rod, peroxide bottle (brown) with dropper, two-tone hairdryer.
- **Contact frame:** wood frame, glass (Fresnel), split back with two hinge flaps.
- **UV box:** a grey box with 6 violet tubes (`#6E3BFF` emissive), a lid and a dial.
- **Window (SHOULD):** sky gradient by solar elevation, procedural clouds (fbm, drifting 3 cm/s), roller blind with a cord.
- **Clothesline:** catenary line, spring clothespins. Prints hang as pendulums (verlet cloth is SHOULD).
- **Radio (SHOULD):** Bakelite box with a dial lamp (black tape over it, peelable; STRETCH).

### 6.2 O.'s negatives (`content/negatives.ts`)
Each negative is drawn as a grayscale **positive** on a 512×640 Canvas2D (seeded), blurred 0.6 px, with grain added (σ 0.015). It's converted with `T = 0.56·10^(−1.05·L)`, where L is the perceptual luminance in [0, 1]. Edge print on the 35 mm rebate reads `NJ 400 ▸ 07 ▸ 07A`.

| # | Name | Tier | Recipe (positive luminance) | Teaches |
|---|---|---|---|---|
| 0 | **Title sheet** | MUST | Frame 1, plus white stencil letters **DARKROOM** (Archivo 800, 75% width, 96 px) across the lower third on a black band | first bloom |
| 1 | Lantern St. mailbox | MUST | sky gradient 0.85→0.65; picket fence (0.8) with dark gaps; a box mailbox on a post (0.35) with rust blotches (fbm, ±0.15); flag up (0.9); shadowed doorway at right (0.12) | dodging the doorway |
| 2 | Pear on the sill | MUST | window mullions (0.95 glass, 0.2 frame); pear (radial shading 0.25→0.7, highlight 0.92); cast shadow ellipse 0.1 | soft grade |
| 3 | Dish rack in the window | MUST | backlit plates as tall ellipses (rims 0.95, faces 0.6); cups; drips as bright dots; dark counter 0.15. Andrew's sink. | hard grade, burning |
| 4 | Cat on a radiator | MUST | radiator fins (alternating 0.3/0.55 bands); curled cat silhouette 0.08 with face 0.18 | dodge the face |
| 5 | Bus shelter at night | MUST | black street 0.03; glowing shelter box 0.95 with a figure silhouette; rain streaks (lines, 0.5 alpha) | burn the glow |
| 6 | Fire escape, laundry | MUST | brick fbm 0.4±0.1; diagonal stair zigzag 0.1; shirts (rects with sag) 0.9 | contrast |
| 7–11 | Darkroom door, Fern, Pier and gulls, Bicycle, Kettle | SHOULD | similar shape grammar | — |
| 12 | Self-portrait in a dark window | gate | silhouette with a camera, reflected safelight dot; sleeve note *your turn* | — |

**Test card** (debug): a 21-step wedge (0.15 D steps) + a grey ramp + a resolution star.

### 6.3 Photogram props (`content/props.ts`)
2D masks at 256 px with height, thickness and transmission. They're tossed with 2D planar physics: release velocity, friction decel 0.85 m/s², rotation drag.

| Prop | Tier | Mask recipe |
|---|---|---|
| Fern frond | MUST | recursive pinnae (L-system, depth 3); T = 0.25 on leaflets, 0 on the rachis |
| Key | MUST | bow ring + shaft + bit teeth; T = 0, thickness 2 mm |
| Lace doily | MUST | radial rosette of circles and arcs, threads T = 0.05, holes 1.0 (Texturedle's cloth) |
| Fork, paperclip, maple leaf (veins T 0.15–0.35), coin | SHOULD | — |

### 6.4 O.'s tape notes (tutorial, in Caveat on `--ar-tape`)
Each appears when its station is first focused or its object is first touched. Tap to peel it away. They're stored in `ar:darkroom:notes`.

- **Chain:** *pull* · **Dev rim (first run):** *rock me* · **Dev:** *60–90 s. Wait for the highlights.*
- **Stop:** *10 s. Vinegar smell = fine.* · **Fix:** *30 s in fix, then lights.* · **Wash:** *2 min. Fixer left in goes yellow.*
- **Switch guard:** *Guard up, then switch. Think first.* · **Paper box:** *Open only in the dark.* · **Envelope:** *Already exposed. Practice.*
- **Enlarger:** *Test strip first. Always.* · **Easel:** *Your hand dodges best. Keep moving.*
- **Bottle B:** *Ferri-CYANIDE. Not cyanide. It's fine. Don't add acid and heat it.* · **Beaker:** *Equal parts. Like pond water.*
- **Brush:** *Coat in lamplight. Dry in the dark. Expose in the sun. Forgive in the wash.* · **UV box:** *Wait for bronze in the shadows.* · **Peroxide:** *One drop. Watch.*
- **Prep:** *Invert first. Flip for contact.* · **Corkboard:** *Pin the bench before anything brave.* · **Clothesline:** *Everything goes on the line. Especially the bad ones.*
- **One note from upstairs:** *Q. says the light is his. — O.*
- **Fog event (auto-tag on the print):** *you too, huh.*

### 6.5 The Notebook of happy accidents
| id | Entry | Detector (signature) | Tier |
|---|---|---|---|
| `first-light` | First Light | a silver sheet fixed (x̄ < 0.05) with Dmax > 1.0 | MUST |
| `lights-on` | Lights On | an unfixed silver sheet gains ΔEs > 2 EU in under 3 s outside the box | MUST |
| `safelight-creep` | Safelight Creep | ≥ 0.09 EU from the safelight alone, then developed | MUST |
| `test-strip` | Test Strip | a test-strip exposure developed and fixed | MUST |
| `dodge` | Dodging | hand or wand occlusion integral ≥ 0.5 s × 10% of the area during exposure | MUST |
| `burn` | Burning In | burn card used for ≥ 1 s | MUST |
| `split-grade` | Split Grade | one sheet exposed at two grades ≥ 3 apart | MUST |
| `sabattier` | Solarized? | a flash ≥ 0.3 EU while mean d/A ∈ [0.15, 0.85], then fixed | MUST |
| `photogram` | Photogram | exposure with ≥ 1 prop and no negative | MUST |
| `iron` | Iron & Sun | a cyanotype washed with mean Bv > 0.3 | MUST |
| `bronze` | Bronzing | at wash, ≥ 5% of texels with q > 0.95 and s > 0.8 | MUST |
| `peroxide` | Peroxide Pop | ox raised on ≥ 30% of a sheet in under 5 s | MUST |
| `own-light` | Your Own Light | any print from an imported negative | MUST |
| `drag` | Bromide Drag | still-tray development with evenness std ≥ 0.08 | SHOULD |
| `dry-down` | Dry-Down | a print dried after inspecting it wet under room light | SHOULD |
| `tea`, `bleach-back` | Tea Toning, Bleach-Back | tone fields > 0.5 | SHOULD |
| `under-fixed` | Yellowed | a print saved with r > 0.25 that has aged ≥ 1 real day | SHOULD |
| `lumen` | Print-Out | silver paper in the sun ≥ 30 s, fixed with no developer | STRETCH |
| `chemigram`, `fingerprint`, `coin-test`, `mirror` | — | see §10 | STRETCH |

When an entry is discovered: a pencil-scratch sound, a toast (*Notebook: Solarized?*) and a one-line entry in O.'s voice citing the moment (*"You flashed the light 38 s into development."*).

### 6.6 Corkboard briefs (SHOULD)
Each brief is a small target print and one line of client handwriting. The **target is generated by simulating a reference recipe** at 64×80 when the brief loads (no hand-authored art). The same recipe doubles as the brief's Playwright solvability test.

| # | Brief | Reference recipe | Scored on |
|---|---|---|---|
| 1 | *First Light* | title sheet, dev 90 s | fixed |
| 2 | *Lights Out* | mailbox, gr 2, 10 s | zone match, border fog ≤ 0.08 |
| 3 | *Test Strip* | find the time | within ±⅓ stop of 10 s |
| 4 | *Hard Sky* | dish rack, gr 4, 14 s | zone match |
| 5 | *Hold Still* | cat, 12 s, dodge the face 4 s | zone match in the face region |
| 6 | *Half a Litre* | the dev tray filled to 60% | evenness |
| 7 | *Blue Hour* | pear transparency, UV 60 s, peroxide | zone match (on blue α) |
| 8 | *Flash* | mailbox, flash 0.4 s at 30 s | reversal metric |

**Score** = `100·(1 − mean|ΔD₈ₓ₈|/0.6)`, with flags for Dmax < 1.8, border D > 0.1 and evenness. Grades: **Proof** ≥ 60, **Work Print** ≥ 80, **Exhibition** ≥ 92 with no flags. Three margin notes come from the worst measurements (*"blacks are muddy, tired developer?"*, *"drag marks bottom edge: rock it"*).

---

## 7. Art direction, UI and audio

### 7.1 Light regimes and post
The page is `data-scheme-lock="dark"` and `data-grain="off"` (we render our own grain).

**Dark adaptation.** Scene luminance `Lsum` = room 1.0 + sun 1.6·blind + enlarger 0.06 + UV 0.05 (lid open) or 0.01 (closed) + safelight 0.03. The target exposure is `X* = min(40, (Lsum + 0.0008)^(−0.75))`. `ln X` eases with τ = 4 s going darker and 0.25 s going brighter. `X` multiplies **every Three light intensity and emissive** (no HDR target needed). Total darkness ramps to `X = 40` over about 8 s: lume hands (`#9CFF8A`), glints and the chain dot appear.

**Post pass** (one fullscreen quad over an RGBA8 target):
- **Amber LUT:** `L = dot(rgb, [.6, .35, .05])` → ramp `#0B0705` (0) · `#3A1C0A` (.25) · `#B85A1E` (.6) · `#FF9A3C` (.85) · `#FFE0B8` (1). Blend = `√(safelight share of Lsum)`.
- Room light gets a 4000K green tint `(0.97, 1.0, 0.96)`.
- Vignette 0.25. Film grain at 24 fps, ±2.5% luminance. A slight edge softness under the safelight only.
- **Photosensitivity** (binding, art-direction §9): the fluorescent start is two flickers at 40% target brightness, 80 ms apart, then on; the squint overshoot is clamped so mean frame luminance stays ≤ 0.7 and settles within 600 ms; the visual light state changes at most every 350 ms, so ≤ 3 changes per second however fast `L` is pressed. Reduced motion: no flicker, a 200 ms soft brighten.
- **Glow:** additive radial sprites on the bulb, UV tubes, lume and enlarger head. No bloom pass.
- **Enlarger beam:** an additive cone plus 200 drifting dust motes, lit only inside the cone. It's the only cool-white light in the dark.

**Materials.**
- Props are Lambert, so lights are cheap. All lights stay in the scene permanently, and switching sets intensity to 0, so shaders never recompile.
- **Liquid shader:** heightfield vertices; normals by central differences; Fresnel (F0 0.02); Blinn-Phong specular (exp 180) from the safelight bulb and enlarger, giving long glints that streak across the waves; Beer-Lambert tint `1 − e^(−σh)` per chemistry (dev straw `#E9D9A0` σ 30, stop `#E8C547` σ 20, fix clear σ 4, wash plus a dye texture: yellow `#C9C24A` by dye, Prussian swirl by peroxide reaction); a damp darker meniscus band on paper at the waterline.
- **Paper shader:** albedo texture (RGBA8, `a` = wetness → gloss), curl and cockle vertex displacement, deckle alpha for rag paper, a Nightjar watermark on the back when face-down, and OBA fluorescence (silver RC only): `emissive += 0.25·UV_irradiance·#9FC8FF`.

### 7.2 Screens and UI layout
The shell bar sits on top (52 px). Its actions are **Pin** (`save`, Ctrl+S), **Logbook** (`load`, N), **Import** (`import`) and **Start fresh** (`reset`), plus the shell's own Help, Sound and Fullscreen. While a sheet is in a tray, `shell.setStatus('DEV · 0:42')` shows its time.

**The stage:**
- **Bench view:** full-bleed 3D.
- **Switchplate** (top-left, always visible): room switch with a flip guard, safelight chain, and a lume dot when dark. A DOM widget drawn as an object.
- **Station strip** (bottom centre): six tape tabs, `PREP · ENLARGER · TRAYS · SINK · IRON · WINDOW`. The current tab is circled in grease pencil.
- **Tool tray** (bottom-left; a horizontal row above the strip on phones): context tools for the station (hand/tongs, wand, card, brush, rod, dryer, dropper). The active tool is circled.
- **Anchored widgets.** DOM, projected from 3D anchors every frame; hidden when off-screen; docked into a collapsible bottom sheet on phones:
  - Enlarger: timer dial (120 px, lume hands, START, test-strip toggle), filter drawer, negative carrier, focus lamp switch.
  - PREP desk: channel dial, INVERT clack switch, FLIP, curve wire (240×160 canvas with 5 handles), two output levers.
  - Iron: bottle tilt affordance (drag targets on the bottles), beaker level readout in Plex Mono (`A 2.1 · B 2.0 ml`).
  - UV box: lid + dial.
- **Logbook** (`<dialog class="ar-dialog">`, datasheet header `RANKIN 400 · LOGBOOK · ▸02`, with notebook-page body styling). Three tabs:
  - **Prints:** auto entries such as `No. 014 — Gr 2 · f/8 · 10 s (+4 s burn) · Dev 75 s · Stop 10 s · Fix 45 s · Wash 2 m · RC Pearl 8×10`, with thumbnails and sibling-branch glyphs.
  - **Techniques:** the Notebook.
  - **Pins:** six Polaroid thumbnails of the bench, with Load and Overwrite.
- **Print inspector** (paper panel over a scrim): the print large, its logbook line, a log timeline strip (SHOULD), **Download PNG** (`download` icon), **Share card** (SHOULD), and Re-hang / Flat file.
- **Brief card** (SHOULD): a corkboard pop-out with the target thumbnail and one line.
- Toasts are chrome toasts: *Saved to the drawer.*, *Back where you left it.*, *Notebook: Bronzing*.

### 7.3 Procedural audio (world bus → `getAudio().master`)
| Sound | Recipe |
|---|---|
| Room tone | brown noise → LP 300 Hz, gain 0.025; mains sines 60/120 Hz at 0.004/0.002; fan: white → BP 420 Hz Q 0.7, gain 0.01, AM 0.3 Hz depth 0.25 |
| Safelight | on: filament tink (noise 4 ms → BP 5 kHz) + sines 120/240 Hz at 0.006/0.002, fade in 1.5 s |
| Pull-chain | 6–9 bead clicks (noise 3 ms → BP 3.2–4.5 kHz Q 4, 12–25 ms apart, decaying), then a clack (noise 6 ms → BP 1.8 kHz + sine 160 Hz 30 ms) |
| Guard / switch | guard: sine 95 Hz 60 ms + 180 Hz "boing" with 22 Hz vibrato, 250 ms. Switch: noise 8 ms → HP 2 kHz + 2.2 kHz ping (BP Q 30, 40 ms) |
| Fluorescent | two tinks 80 ms apart, then sawtooth 120 Hz → BP 240 Hz Q 2, gain ramp to 0.008 over 0.4 s, sustained |
| Slosh (per tray) | white → BP centre `300 + 600·min(1, KE/0.006 J)` Hz, Q 1.1, gain `0.25·√(KE/0.006)` ≤ 0.3, 50 ms smoothing, panned by tray x. **Lap:** wall-impact spikes → noise 60 ms → BP 700–1100 Hz |
| Tray land | sines 140 + 310 Hz, 90 ms, gain ∝ impact speed (≤ 0.25) |
| Drip | sine 1400 → 650 Hz over 35 ms, gain 0.07, ±10% pitch, + 2 ms click; into liquid adds a 300 Hz 20 ms plop |
| Paper | grab: 5–8 crinkle granules (BP 2.5–6 kHz) over 120 ms. Into liquid: LP 900 Hz noise thump + 90 Hz sine 40 ms, then 250 ms HP 4 kHz hiss |
| Timer | tick per second: noise 2 ms → BP 3 kHz Q 8 + sine 1.1 kHz 8 ms. Wind ratchet per detent. Bell: shared `bell` recipe with decays ×1.8 |
| Enlarger | lamp thunk (sine 70 Hz 50 ms); fan BP 900 Hz gain 0.012 while on |
| Pour | glug bursts at 4 Hz: sine sweep `f0 → 1.8·f0` over 40 ms with `f0 = 450 + 500·(1 − fill)` + BP 1.2 kHz noise; stream hiss BP 2.5 kHz ∝ Q |
| Brush | BP 3.5 kHz noise, gain ∝ speed × load (≤ 0.05) |
| Hairdryer | LP 2.5 kHz noise 0.08 + sawtooth 210 Hz → LP 800 Hz 0.01, 0.25 s spin-up |
| UV box | sine 100 Hz 0.004 + 15 kHz sine 0.0015 + fan |
| Tap | noise → BP 2 kHz Q 0.5 gain 0.06 + random 3–6 Hz gurgles (BP 300–600 Hz) |
| **Peroxide bloom** | the one "magic" sound: sines 880/1320/1975 Hz, ±4 cent shimmer, 0.4 s attack, 2.5 s decay, 0.02 each + HP 6 kHz fizz for 1.5 s |
| Notebook | pencil scratch: BP 4.5 kHz noise, 30–60 Hz random AM, 0.5 s |
| Radio (SHOULD) | static between stations; *late-night jazz* (walking bass sine plus brushes on noise plus FM e-piano ii–V–I, through a 300–3000 Hz "tiny speaker"); *drone* |

No sound plays before the first gesture. The chain pull **is** the first gesture. Haptics follow the sound preference: `vibrate(8)` on switches and tray landings, `15` on paper drops.

---

## 8. Save states and persistence

**Storage.** Use `src/shared/storage` if it exists. Otherwise `save/idb.ts` opens IndexedDB `andrew-rankin` **without a version**, checks for the `darkroom` store, and if it's missing closes and reopens at `version + 1` to create only that store, so it never fights other games. Keys inside the store:

| Key | Contents | Rolled back by a pin load? |
|---|---|---|
| `pin:1`…`pin:6`, `pin:auto` | bench snapshot + 256×160 JPEG thumbnail | — (they *are* the bench) |
| `print:<id>` | finished print: albedo PNG 512×640 (2× upscale of the fields), log, metadata, `parentPin` | **No: prints are outside time** |
| `binder:<id>` | imported image Blob (downscaled to ≤ 1600 px) + prep settings | No |
| `meta:notebook`, `meta:briefs` | discoveries, brief grades | No |

`localStorage`: `ar:darkroom:notes`, `ar:darkroom:settings` (captions, tilt mode, quality), `ar:darkroom:hub`.

**Snapshot format v1** (`World.serialize()` → `Snapshot`):
- JSON header: version, time, seed, focus, lights, timer, grade, negative id, beaker, bottles, brush load, frame state, prop poses, per-tray `{tilt, C_bulk, stopUses, tint fields}`.
- Paper metadata.
- Binary blobs per sheet:
  - silver: `Eh`, `Es` as Uint16 log-encoded (`(log10 E + 6)/9 · 65535`); `d` Uint16; `c`, `x`, `r`, `w`, `po` Uint8.
  - cyanotype: `s`, `q` Uint16; `f`, `m`, `y`, `ox`, `tb`, `tt` Uint8.
  - Fluid: `h` Uint16 (0–60 mm).
- Compressed with `CompressionStream('gzip')` when available. Typically 0.3–0.8 MB.

**Behaviour.**
- **Autosave** every 20 s and on `visibilitychange: hidden` / `pagehide`. On boot it silently restores `pin:auto` (toast: *Back where you left it.*). **Start fresh** clears only the bench (toast: *Tray emptied.*).
- **Pins:** Ctrl+S saves to the next free slot, or the slot chosen in Logbook › Pins. The thumbnail is `renderer.render()` followed immediately by `canvas.toBlob` in the same task.
- **Branching prints:** a print hung after loading a pin records `parentPin`. Siblings show a small fork glyph in the Prints tab. Save-scumming is experimentation, and the logbook celebrates it.
- **Real-time aging (SHOULD), applied on load from `Date.now() − savedAt`:** prints with `r > 0.25` gain a yellow stain `+0.08 D/day` (cap 0.4); cyanotypes' `ox → 1` over 24 h; open-tray developer oxidizes (§5.7).
- **Rewind dial (SHOULD):** a ring of 10 snapshots × 3 s (the active sheet only, at half resolution, Uint8) gives 30 s of undo. It's exposed as a drag on the bench clock and `Z`.
- `?embed=poster` and `?fresh=1` don't read or write saves.

---

## 9. Onboarding (first run; `ar:darkroom:firstRun` unset)

1. **0 s:** black stage, room tone muted, lume dot on the chain, and after 2 s a faint *pull* note. The help datasheet is **deferred** until after the first print (`helpOnFirstVisit: false`; it opens itself when First Light is written, once).
2. **First gesture → chain:** audio unlocks, the safelight comes on and the amber world fades up (τ 1.2 s, scripted).
3. **The title sheet is already in DEV.** The tray rests tilted 4° toward the viewer, so the liquid covers only the near 55% and **DARK** is half-developed there. *rock me* is taped to the rim, and the rim pulses (emissive 0.3 Hz).
4. **The player drags:** the wave crosses the dry half and the letters bloom behind it. If 8 s pass without a drag, a ghost hand demonstrates once (reduced motion: an arrow).
5. **At about 25 s** a note on STOP appears; tongs are implied by drag-to-move. FIX shows *30 s in fix, then lights.* The bench clock shows sheet time.
6. **After fixing**, the switchplate guard wobbles once. Lights on: the colour room, the print reads DARKROOM over the mailbox. *Everything goes on the line* appears at the clothesline. Hang it: Notebook *First Light*, then the help datasheet.
7. **If the player turns the room light on early:** the sheet fogs black, auto-tagged *you too, huh*, and Notebook *Lights On*. The envelope's tape pulses, and its three practice sheets (mailbox, pear, dish rack) repeat steps 3–6 without the title.
8. **After that:** station tape notes appear on first focus. The Corkboard (SHOULD) offers brief 2.

Returning players skip all of this.

---

## 10. Scope tiers

**MVP-0 spine** (must work by build minute ~45, shippable alone): trays station, title sheet, fluid + tilt, contact-only silver development, stop/fix/wash, room light and safelight with dark adaptation, the clothesline, autosave, `__game`, and the Canvas2D fallback for the trays.

**MUST (one build round)**
- All six stations rendered with camera pan. Switchplate, station strip, tool tray, anchored widgets, phone layout.
- Fluid (§5.2–5.3) for DEV, STOP, FIX and WASH, with auto-rock, dunk, slosh audio and spill.
- Silver: paper box (top-sheet fogging), envelope, the full exposure model with five sources (no sun), the enlarger with negatives 0–6, the timer, test strip, filter drawer (7 grades), hand/fist/wand/burn card, development, stop, fix, wash, print-out.
- Cyanotype: bottles + beaker, brush, drying + hairdryer, contact frame, UV box, print-out colours, wash plumes, peroxide bloom, 3 photogram props.
- PREP: import (button + drop), channel, invert, flip, 5-point curve, both outputs.
- Notebook (13), logbook print entries, inspector + PNG download, pins (6 + auto), binder, tape notes, the audio list minus the radio, `__game` + `selftest`, poster mode, the smoke script.

**SHOULD (review/fix rounds, in priority order)**
1. Window + sun (real local-time solar model via `src/shared/sun` if present, else a local fallback) + clouds, split-back peek, *great rule flip* note.
2. TONE tray (tea, washing soda).
3. Exhaustion, oxidation, indicator stop.
4. Corkboard briefs + scoring + margin notes.
5. Rewind dial.
6. Dry-down, bromide-drag advection of `c` by the fluid.
7. Head height, focus knob + grain focuser, aperture, red swing filter.
8. Negatives 7–11, more props.
9. Real-time aging.
10. Share card (scanner-bed PNG with a grease-pencil logbook line and the rag deckle).
11. Gyro tilt mode (iOS permission button).
12. Radio.
13. Verlet clothesline.
14. Bench stain map.
15. Captions.

**STRETCH**
- *Tonight's Negative* daily (date-seeded negative, one sheet, no pins, share string with a 6×4 block grid of your print).
- Chemigram (paint dev or fix with the brush in room light).
- Fingerprints and tong contamination.
- Door light leak.
- Radio-lamp tape.
- Coin safelight test.
- Lumen print.
- Ferricyanide reducer crossover (B + fix brushed on silver).
- Selenium/sepia.
- Cyanotype fade/recover.
- Photo mode.
- `?embed=preview` attract loop.
- Film-can import from Lens Bench and Studio (`src/shared/filmcan`).

**Cut:** temperature control UI, mold on stock A, the radio's third station, a free-roaming camera.

---

## 11. Tech plan

### 11.1 Files
```
games/darkroom/
  index.html            art-direction §11 template; <main id="stage">; hidden SVG grease filter; data-grain="off"
  main.ts               fonts/tokens/base imports, mountShell, hasWebGL2 → Game or fallback, crash card
  types.ts              CONTRACT (§11.3), written first, additive changes only
  events.ts             typed event bus + event map (§11.4)
  constants.ts          all tunables and tables of §5 and the §5.1 layout
  game.ts               loop, fixed step, quality tiers, wiring World/View/Input/UI/Audio/Save
  sim/  world.ts  trays.ts  paper.ts  light.ts  occluders.ts  enlarger.ts  iron.ts  coating.ts
        props2d.ts  discover.ts  rng.ts  selftest.ts
  content/  negatives.ts  prep.ts  props.ts  briefs.ts(SHOULD)
  render/   view.ts  camera.ts  post.ts  room.ts  stations.ts  liquid.ts  paperView.ts  lights.ts
            beam.ts  particles.ts  clothesline.ts  textures.ts  fallback2d.ts
  input/    pointer.ts  picking.ts  tools.ts  keys.ts  gyro.ts(SHOULD)
  ui/       hud.ts  widgets.ts  prepdesk.ts  notes.ts  logbook.ts  inspect.ts  darkroom.css
  audio/    world.ts  voices.ts
  save/     persist.ts  idb.ts  snapshot.ts  rewind.ts(SHOULD)
  debug.ts              window.__game
scripts/darkroom-smoke.mjs
```

**Proposed shared modules** (the Darkroom team authors the first two; Plates, Latent and Studio consume them):
- **`src/shared/fluid/`** (`index.ts`: `TrayFluid`, `TrayBody`, `ScalarField`). Pure TS with no Three.js or DOM. **Why shared:** Plates (tray, pyro), Latent (DEV/STOP/FIX) and Studio (darkroom trays, paddling pool at 96×96) all specify the same virtual-pipes model. Studio's concept calls it "liquid". One module, one tuning.
- **`src/shared/photochem/`**:
  - `spectral.ts`: bands, sources, emulsions, filters, `rate()`.
  - `silver.ts`: `silverStep`, `silverAlbedo`.
  - `cyano.ts`: `cyanoStep`, `cyanoAlbedo`.
  - `curves.ts`: Hill/H&D helpers, monotone cubic.

  **Why shared:** Studio's darkroom and Lens Bench's develop step need the same paper physics, and Latent and Plates can reuse `silverStep` with their own dither on top. Film development (push/pull, grain) goes in `photochem/film.ts`, **owned by Lens Bench/Studio**, not by this team.
- **Consumed only if present:** `src/shared/ui/*` and `src/shared/audio` (required by the art direction), `src/shared/storage`, `src/shared/sun` (Studio), `src/shared/filmcan` (Lens Bench). Each has a ≤ 30-line local fallback, so Darkroom never blocks on them.
- **No new npm dependencies.** Fonts come from the site-wide set (Caveat is the grease pencil; Plex Mono for readouts). Darkroom's one optional in-world face, for stencilled jug labels, is drawn with Archivo 800 at 75% width, so no extra face is needed.

### 11.2 Shared module signatures
```ts
// src/shared/fluid/index.ts
export interface TrayFluidOptions { nx: number; ny: number; dx: number; depth: number; lip: number; damping?: number }
export interface FluidStepReport { spill: number; wallImpact: number; kinetic: number }
export class TrayFluid {
  readonly nx: number; readonly ny: number; readonly dx: number;
  h: Float32Array; ux: Float32Array; uy: Float32Array;          // per cell
  sleeping: boolean;
  constructor(o: TrayFluidOptions);
  setTilt(tanX: number, tanY: number): void;
  setAccel(ax: number, ay: number): void;
  step(dt: number): FluidStepReport;
  impulse(x: number, y: number, radius: number, dh: number): void;     // tray-local metres
  depthAt(x: number, y: number): number;                                // bilinear
  velocityAt(x: number, y: number, out: { x: number; y: number }): void;
  surfaceAt(x: number, y: number): number;                              // h + b, for rendering
  volume(): number; refill(depth?: number): void;
}
export class TrayBody {
  tiltX: number; tiltY: number; offX: number; offY: number;            // rad, m
  hold(tx: number, ty: number, ox?: number, oy?: number): void; release(): void;
  autoRock(on: boolean): void;
  step(dt: number): { ax: number; ay: number; landed: number };
}
export class ScalarField {
  data: Float32Array; constructor(f: TrayFluid);
  add(x: number, y: number, r: number, amt: number): void;
  step(dt: number, diffusion: number, decay: number): void;
  sample(x: number, y: number): number;
}

// src/shared/photochem/silver.ts
export interface SilverFields { W: number; H: number; Eh: Float32Array; Es: Float32Array; A: Float32Array; d: Float32Array;
  c: Float32Array; x: Float32Array; r: Float32Array; w: Float32Array; po: Float32Array }
export interface SilverEnv {
  rateH: Float32Array | number; rateS: Float32Array | number;      // EU/s incl. geometry, T_neg, occlusion
  contact: Float32Array | number; bath: 'dev' | 'stop' | 'fix' | 'wash' | 'air';
  agitation: Float32Array | number;  bulk: number;  tempC: number; printOut: number;
}
export function createSilverFields(W: number, H: number): SilverFields;
export function silverStep(f: SilverFields, env: SilverEnv, dt: number): { changed: boolean; meanD: number };
export function silverAlbedo(f: SilverFields, out: Uint8ClampedArray): void;
// cyano.ts mirrors this: CyanoFields, CyanoEnv { uvRate, contact, bath: 'none'|'wash'|'tone-tea'|'tone-soda', peroxide, air, agitation, ratio }
```

### 11.3 Contract: `games/darkroom/types.ts` (key parts)
```ts
export type StationId = 'prep' | 'enlarger' | 'trays' | 'sink' | 'iron' | 'window';
export type TrayId = 'dev' | 'stop' | 'fix' | 'wash' | 'tone';
export type LightId = 'room' | 'safe' | 'enlarger' | 'uv' | 'blind';
export type Grade = '00' | '0' | '1' | '2' | '3' | '4' | '5';
export type ToolId = 'hand' | 'fist' | 'wand' | 'card' | 'brush' | 'rod' | 'dryer' | 'dropper';
export type Place =
  | { at: 'box' } | { at: 'envelope' } | { at: 'carried' } | { at: 'easel' } | { at: 'frame' } | { at: 'uvbox' } | { at: 'sill' }
  | { at: 'tray'; tray: TrayId } | { at: 'bench'; x: number; z: number } | { at: 'line'; slot: number };
export interface Negative { id: string; name: string; W: number; H: number; T: Float32Array;
  format: '35mm' | '8x10'; source: 'builtin' | 'import'; prep?: PrepSettings }
export interface PrepSettings { channel: 'r' | 'g' | 'b' | 'lum'; invert: boolean; flip: boolean; curve: number[]; uvTint: boolean }
export interface Paper {
  id: string; kind: 'silver' | 'cyano'; size: 'sheet' | 'strip'; place: Place; faceUp: boolean;
  body: { x: number; y: number; rot: number; vx: number; vy: number; w: number; sunk: boolean };  // tray-local or bench
  silver?: SilverFields; cyano?: CyanoFields; ratio?: number;
  albedo: Uint8ClampedArray; dirty: boolean;      // W*H*4, written by sim, uploaded by render
  log: PrintLog; flags: string[];                 // technique signatures
}
export interface Occluder { tool: 'hand' | 'fist' | 'wand' | 'card' | 'prop'; x: number; z: number; rot: number; height01: number; hole?: number }
export interface Commands {
  setLight(id: LightId, on: boolean | number): void; guard(open: boolean): void;
  holdTray(t: TrayId, tiltX: number, tiltY: number, offX?: number, offY?: number): void; releaseTray(t: TrayId): void;
  autoRock(t: TrayId, on: boolean): void; poke(t: TrayId, x: number, y: number, s: number): void; refill(t: TrayId): void;
  take(from: 'box-sheet' | 'box-strip' | 'envelope' | 'rag'): string | null;
  pick(id: string): boolean; carry(x: number, z: number, rot?: number): void; drop(): Place | null;
  dunk(id: string): void; flip(id: string): void; hang(id: string): void;
  loadNegative(id: string | null): void; setGrade(g: Grade): void; setTimer(s: number): void;
  startExposure(mode?: 'normal' | 'strip'): void; stopExposure(): void; setFocusLamp(on: boolean): void;
  setOccluder(o: Occluder | null): void;
  setBottleTilt(b: 'A' | 'B', rad: number): void; loadTool(t: 'brush' | 'rod'): void;
  stroke(paperId: string, u0: number, v0: number, u1: number, v1: number, dt: number): void;
  blow(x: number, z: number, on: boolean): void;
  frame(a: 'open' | 'close' | 'peekL' | 'peekR' | 'unpeek'): void; putInFrame(item: string): void;
  setUVLid(closed: boolean): void; setBlind(open01: number): void; tap(on: boolean): void;
  peroxide(t: TrayId, x: number, y: number): void; placeProp(id: string, x: number, z: number, rot: number, vx?: number, vz?: number): void;
  fastForward(on: boolean): void;
}
export interface WorldRead {
  time: number; lights: Record<LightId, number>; exposureX: number; trays: Record<TrayId, TrayState>;
  papers: Paper[]; carried: string | null; timer: TimerState; enlarger: EnlargerState; iron: IronState;
  props: PropState[]; discoveries: string[];
}
export interface World extends WorldRead { cmd: Commands; tick(dt: number): void;
  serialize(): Snapshot; deserialize(s: Snapshot): void; stats(paperId?: string): PrintStats }
export interface View { frame(dt: number, world: WorldRead): void; resize(): void;
  pick(cx: number, cy: number): Pick | null; benchPoint(cx: number, cy: number, y?: number): { x: number; z: number } | null;
  project(anchor: string | [number, number, number]): { x: number; y: number; visible: boolean };
  setFocus(station: StationId, sub?: number): void; thumbnail(): Promise<Blob>; setPoster(on: boolean): void }
```

### 11.4 Events (`events.ts`)
`light {id,on}` · `guard` · `chain` · `trayLand {tray,speed}` · `slosh {tray,kinetic,impact,x}` (every frame, for audio) · `spill` · `drip {x,z,intoTray}` · `paperGrab` · `paperDrop {place}` · `dunk` · `timerTick` · `timerBell` · `exposure {on}` · `pour {bottle,rate}` · `brush {speed,load}` · `dryer {on}` · `uv {on}` · `tap {on}` · `peroxide` · `bloom` · `discover {id,line}` · `fog {paperId}` · `printHung {paperId}` · `saved` · `loaded`.

### 11.5 Render pipeline
1. `WebGLRenderer({antialias: false, powerPreference: 'high-performance'})`. DPR is capped per tier. `outputColorSpace = SRGB`. No tone mapping (handled in post).
2. Static room geometry is merged per material with `BufferGeometryUtils.mergeGeometries`.
3. Per frame: update tray heightfield positions and normals (4 × 1,728 verts); upload dirty paper albedo textures (`DataTexture`, RGBA8, `needsUpdate`, at most 2 per frame); update dye/peroxide `DataTexture`s (48×36 R8); update particles (instanced points, ≤ 600).
4. Render the scene to an RGBA8 target, then the post quad (LUT, vignette, grain) to the canvas.
5. Widget projection: `project()` for each visible widget anchor; write CSS `translate`.
6. Render order: bench and props (opaque), papers, liquids (transparent, depthWrite false), beam and glows (additive).

### 11.6 Performance budget and quality tiers
| Budget | Desktop (High) | Mid phone (Med/Low) |
|---|---|---|
| Frame | 16.7 ms | 33 ms (60 when idle) |
| Fluid (active tray, 4 substeps) | ≤ 0.6 ms | ≤ 1.5 ms |
| Chemistry per active sheet per tick | ≤ 2 ms @256×320 | ≤ 2 ms @160×200 |
| Exposure + occlusion per tick | ≤ 1.5 ms | ≤ 1.5 ms |
| Render | ≤ 8 ms, ≤ 150 draws, ≤ 200k tris | ≤ 18 ms, ≤ 110 draws, ≤ 120k tris |
| JS (gzip) | ≤ 380 kB including three | same |
| Memory | ≤ 200 MB | ≤ 120 MB |
| Time to interactive | ≤ 2.5 s | ≤ 4 s |

- **Tiers:** High (DPR ≤ 2, 256×320, dust, grain), Med (DPR 1.5, 256×320, half motes), Low (DPR 1, 160×200, fluid 32×24, no grain). Drop a tier after 3 s above 22 ms mean frame time; rise after 10 s below 12 ms.
- **Sleep:** sheets that are dry, unlit and not in liquid skip chemistry entirely. At most 3 sheets tick at full rate; others tick at 4 Hz.
- **Escape hatch:** if chemistry exceeds its budget, `sim/paper.ts` is written as pure functions over typed arrays, so it can move to a Worker with transferable buffers.

### 11.7 Mobile plan
- Portrait sub-focus framing (one tray fills the width) and the bottom sheet for widgets.
- Every tap target ≥ 44 px. Tray rims get a 24 px invisible hit band.
- Two-finger trackpad tilt. Shadow offset 60 px above the finger.
- Gyro tilt mode (SHOULD, a permission button on iOS).
- `visibilitychange` pauses the loop and autosaves. Audio unlocks on `touchend`.
- Safe-area insets. DPR ≤ 1.5. The quality ladder starts at **Med** on `pointer: coarse`.
- **No-WebGL2:** the shared card; *Try anyway* (`?force=1`) launches `render/fallback2d.ts`, a top-down Canvas2D view of the TRAYS and SINK stations (other tabs disabled) with the same World, input and audio.

---

## 12. Build split (4 parallel packages)

**Minute 0 (WP-C):** commit `types.ts` and `events.ts` verbatim from §11.3–11.4. **By minute 15:** every package commits stubs of its exported interface, so everyone can run the page. **Any change to a contract is additive and is announced in `docs/design/darkroom-contract-log.md`.**

| Package | Owns (exclusive) | Delivers | Consumes |
|---|---|---|---|
| **WP-A · Wet Sim** | `src/shared/fluid/**`, `src/shared/photochem/**`, `games/darkroom/constants.ts`, `games/darkroom/sim/**` | `createWorld(seed, negatives): World`; the §5 models; `cmd.*`; detectors; `serialize`/`deserialize` of raw typed arrays; `selftest()` meeting §5.11 | `content/negatives.ts` (`getNegative(id)`, stub: gradient), `events.ts` |
| **WP-B · Room & Light** | `games/darkroom/render/**` | `createView(canvas, world): View` (§11.3); all procedural geometry and textures; the liquid and paper shaders; post/LUT and adaptation display; beam, particles, clothesline; `fallback2d.ts` implementing the same `View` | `WorldRead`, `constants.ts` layout, events (particles) |
| **WP-C · Hands & Bench (spine)** | `games/darkroom/{index.html, main.ts, game.ts, types.ts, events.ts}`, `input/**`, `ui/{hud,widgets,prepdesk,notes}.ts`, `ui/darkroom.css` | loop, tiers, shell mount + actions + help table; pointer, keyboard, touch and gestures → `cmd.*`; the switchplate, strip, tool tray and anchored widgets; the prep desk UI; tape notes; first-run flow (§9) | `World`, `View.pick/project/benchPoint/setFocus`, `content/prep.ts` |
| **WP-D · Paper Trail** | `games/darkroom/content/**`, `audio/**`, `save/**`, `ui/{logbook,inspect}.ts`, `debug.ts`, `scripts/darkroom-smoke.mjs` | negatives 0–6 + test card; the prep pipeline; props masks; all world audio (§7.3) driven by events; persistence (§8); the logbook and inspector; PNG export; `window.__game` (§13); the smoke script | `World` (`serialize`, `stats`, `cmd`), `View.thumbnail`, events |

**Integration (minutes 75–120, led by WP-C with all hands):**
1. Wire `game.ts` end to end, running MVP-0 first.
2. Run `node scripts/darkroom-smoke.mjs` and `__game.selftest()`, and fix failing targets in `constants.ts` only.
3. Pass at the phone viewport (390×844) and fix layout.
4. Do the poster mode and the hub note.
5. Lighthouse-style budget check with `__game.perf()`.

Review rounds then take SHOULD items in §10 order. Each item lives within one package's files.

---

## 13. `window.__game` and the smoke test

```ts
window.__game = {
  ready: boolean,                                  // hub contract: true after the first real frame
  whenReady(): Promise<void>,
  version: 'darkroom@1',
  mode(): 'webgl2' | 'canvas2d',
  poster(): Promise<void>,                         // hero: safelight only, title sheet at 6 s, wave mid-tray, no overlays
  pause(on: boolean): void,  seed(n: number): void,
  step(seconds: number): void,                     // deterministic: fixed 1/60 frames, renders once at the end
  station(id: StationId, sub?: number): void,
  lights(s: Partial<Record<LightId, boolean | number>>): void,
  tilt(tray: TrayId, degX: number, degY: number): void,  release(tray: TrayId): void,  rock(tray: TrayId, on: boolean): void,
  newSheet(kind: 'silver' | 'cyano' | 'title' | 'practice', place?: Place): string,
  place(id: string, where: Place): void,
  expose(o: { seconds: number; grade?: Grade; negative?: string; dodge?: { x: number; z: number; seconds: number }; strip?: boolean }): void,
  loadPNG(dataUrl: string, prep?: Partial<PrepSettings>): Promise<string>,       // returns negative id
  coat(id: string, o?: { ml?: number; tool?: 'brush' | 'rod'; ratio?: number }): void,
  peroxide(tray: TrayId, x?: number, y?: number): void,
  demo(name: 'title' | 'first-print' | 'enlarger' | 'sabattier' | 'cyanotype' | 'peroxide' | 'photogram' | 'fog'): Promise<void>,
  stats(id?: string): { meanD: number; dmax: number; borderD: number; coverage: number; evenness: number; blue: number; bronze: number },
  discoveries(): string[],
  selftest(): Record<string, { value: number; target: string; pass: boolean }>,
  save(slot: number | 'auto'): Promise<void>,  load(slot: number | 'auto'): Promise<void>,
  anchor(name: string): { x: number; y: number; visible: boolean },             // screen coords for real-pointer tests
  perf(): { fps: number; fluidMs: number; chemMs: number; renderMs: number; tier: string },
}
```
`demo()` runs seeded, scripted sequences through `cmd.*` and `step()`.

**`scripts/darkroom-smoke.mjs`** uses Playwright with the same flags as `shoot.mjs`. Base URL: `/games/darkroom/?seed=7&fresh=1&motion=reduce`. Fail on any `pageerror` or `console.error`.

| Step | Action | Expected / asserted |
|---|---|---|
| 1 | load, await `whenReady()` | `mode()` is `webgl2` (`canvas2d` is accepted with a warning). **01-dark.png**: near-black frame with a lume dot and a faint *pull*; mean luminance < 0.08 |
| 2 | real click at `anchor('chain')` | **02-safelight.png**: amber monochrome, three trays, the title sheet half-covered, *rock me* tape |
| 3 | `pause(true)`; real drag on the DEV tray from its centre 120 px right, held; `step(6)` | **03-meniscus.png**: letters dark on the wetted side only. `stats('title').coverage` ∈ [0.15, 0.85] |
| 4 | release; `rock('dev', true)`; `step(60)` | `meanD > 0.4` |
| 5 | `demo('first-print')` (stop, fix 30 s, lights on, hang) | **04-room.png**: the colour room with the print on the line. `discoveries()` includes `first-light` |
| 6 | `demo('fog')` | fog sheet `meanD ≥ 1.6`; includes `lights-on` |
| 7 | `demo('enlarger')` (mailbox, grade 2, 10 s, dodge 3 s) | **05-print.png**. `meanD` ∈ [0.6, 0.9], `borderD ≤ 0.10` |
| 8 | build a 256×320 test PNG in the page (gradient + circle + "ARK") → `loadPNG`; `demo('cyanotype')` | **06-washed.png**: pale blue with yellow plumes in the wash tray |
| 9 | `demo('peroxide')`; `step(0.6)` **07-bloom-mid.png**; `step(3)` **08-blue.png** | a radial blue front visible mid-bloom; final `blue > 0.5` |
| 10 | `save(1)`; reload with `?seed=7`; `load(1)` | `stats` equal within 2%; toast *Back where you left it.* |
| 11 | `selftest()` | every row passes (warn-only during build rounds, fail before release) |
| 12 | mobile 390×844: tap the chain, swipe the strip to TRAYS, one-finger drag on DEV | **09-mobile.png**; `document.documentElement.scrollWidth ≤ 390` |
| 13 | `poster()` at 1200×800 | **10-poster.png**: no overlays, the wave crossing DARKROOM |

All screenshots go to `shots/darkroom/`. `perf()` is printed at the end.

---

## 14. Risks and fallbacks

| Risk | Mitigation and fallback |
|---|---|
| CPU chemistry too slow on phones | Sleep rules, A caching, coarse contact/occlusion grids, Low tier at 160×200; Worker escape hatch (§11.6) |
| Development curve feels wrong or tuning drags on | Every constant lives in `constants.ts`, checked by `selftest()` targets; `SABATTIER_ASSIST` flag; reference recipes regenerate brief targets automatically |
| SwiftShader too slow for real-time tests | `pause` + `step()` determinism; screenshots after explicit steps; poster at fixed seed |
| Fluid instability or wild spills | Outflow limiting, a CFL margin of 5×, `|u| ≤ 1 m/s` clamp, max 8 substeps per frame; the Fill jug restores h0 |
| Gesture conflicts on touch (pan vs tilt vs pick) | Strict pick priority, a 140 ms hold to pick, pan only on empty bench/strip, two-finger tilt as an alternative |
| Players never find cyanotype or PREP | Station strip labels, O.'s tape notes, the Import shell action, hub blurb; drop-anywhere import jumps to PREP |
| Photosensitivity (room-light toggling) | 350 ms visual rate limit, flicker ≤ 40%, overshoot clamp, reduced-motion path (§7.1) |
| Autoplay and iOS audio | The chain pull is the unlock gesture; shared `getAudio()` only; everything works muted |
| IndexedDB unavailable (private mode) or version races | Probe-and-upgrade-only-our-store; in-memory fallback with a toast *Saves won't stick in this window.* |
| Large PNGs / HEIC / odd orientations | `createImageBitmap` with orientation; downscale ≤ 1600 px; unsupported → *The film jammed. That file wouldn't load.* |
| Shared modules not ready (`ui`, `audio`, `storage`, `sun`) | Local fallbacks of ≤ 30 lines behind the same names; swap when merged |
| Scope overrun | MVP-0 spine at minute 45; SHOULD list strictly ordered; sun, toning and briefs are optional by design |
| Readability under amber | DOM widgets and notes sit outside the LUT; captions; the switchplate's lume dot always shows |
| Originality | All characters (O., Q.), places (Lantern Street), brands (Nightjar, RANKIN 400) and copy are invented here; no real people, brands or text |
