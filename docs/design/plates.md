# RUBY SECTOR: Game Design Document

*Game 3 of the Andrew Rankin Minigame Collection. Slug `plates`, served at `/games/plates/`. This GDD is synthesized from the three concepts in `docs/design/concepts/plates-{toy,game,craft}.md`. The story, every image and all final text are in **`plates-story.md`**, which is the answer key. Where the two documents disagree, the story bible wins on content and this GDD wins on systems.*

---

## 1. Title, subtitle, pitch

**RUBY SECTOR**
*The Gaunt Rock Plates, 1887*

**Hub card line:** *A lighthouse showed white where it should have shown red. Twelve undeveloped plates know why.*

**Pitch.** In October 1888 you row out to a lighthouse that is about to be put out for good. In its old coal store you find a darkroom, a dead photographer's lamp and a tin of twelve exposed glass plates that nobody has ever developed. Under a ruby safelight, drawn entirely in 1-bit dither, you rock each plate in a sloshing tray and watch a moment from the night of the wreck rise out of the silver. That night a lighthouse showed white over a reef, a ketch struck, and three men died. Each plate is a frozen stereoscopic tableau. How well you develop it decides what you can see in it. You can tilt it to look with one eye and then the other, lay it on black velvet to turn it positive, and sweep a loupe across the grain. From those images you name every soul, state how each one ended, and overturn an official Inquiry that ruined an innocent man. The last clue is not on any plate. The missing red glass of the lighthouse's danger sector has been hanging over your head all game, as the window of the lamp you work by.

**Why this title.** "Ruby" is the darkroom safelight, and the "sector" is the lighthouse's red danger arc. They are the same glass. In one room it means *safe* and in the other it means *danger*, and the story turns on moving it from one room to the other.

### Synthesis decisions (what we took, what we cut)

| From | Kept | Cut or changed |
|---|---|---|
| **toy** (Ruby Sector, Skerrow) | the title; the lighthouse; the twist that the evidence is in your own lamp; the sea as co-player (waves slosh the trays and swing the lamp); tray physics; drying line = save states; velvet split image; tongs heft; auto-pins before anything destructive | The "deep plate" fictional 4-layer emulsion becomes **real stereo plates** (authentic, cheaper). Throw/shatter becomes STRETCH. Sabattier becomes STRETCH. Beam balance and mixing are cut. The murder plot is replaced. |
| **game** (Halation) | the H&D **wedge** as the diegetic development gauge; clues placed in **tonal zones** (craft decides information); the two-witness fairness rule; **paired confirmation**; Wick as the hint cat; the tender lie at the centre; the Prussian-blue cyanotype coda; the sealed final letter | The mountain observatory setting, temperature and stove, frilling, the daily plate (STRETCH), timeline dating |
| **craft** (Caul Rock) | **"every pixel is a silver grain"** (the dither is anchored to the glass); Bayer dither for the present and blue-noise grain for the past; **blue-blindness** (red prints black) as clue grammar; long-exposure ghosting; light trails; magnesium; the Board voice and the Register voice; ruby, canary and bone palettes; fixing chords as the only music | Cyanide poisoning, ganseys, the gender-coded spectrum, varnish, the water budget, the IM Fell font dependency |

---

## 2. Experience goals and hooks

### Experience goals
1. **Tactile craft.** Rocking a tray should feel like holding a tray. The liquid has weight, the plate has heft, and the sea shoves everything.
2. **Revelation by your own hands.** A face rising out of nothing in the developer is the core emotional beat. It happens 14 times and should never get old.
3. **Looking harder.** Every feature passes one test: *does it make the player look harder at a photograph?*
4. **Fair, earned deduction.** Each answer is overdetermined by plates and documents. Nothing depends on authorial whim; the clue grammar is photographic physics.
5. **Quiet grief.** The tone is restrained, with no villains, no gore and no score music. The sea, the clock of your own work, and twelve chords.

### Pillars
- **The room is the UI.** No HUD meters and no timer. The wedge, the rack grades, the Register and the drying line do that work.
- **Destruction is free to try and cheap to undo.** Fogging, over-developing or pulling the lamp window are allowed. An auto-pin is taken first.
- **Two colours, always.** No grey and no third colour on screen at any moment, until the final Prussian blue.
- **Craft gates information, never progress.** Midtone clues survive any non-ruined plate, and redevelopment is always possible.

### Hooks
- **10 seconds.** The TRIAL plate is already in the developer under the swaying ruby lamp. You grab the tray rim and rock it. Dithered liquid slops across the glass, throwing 1-bit glints, and a test card and a sleeping black cat **bloom out of nothing**, highlights first. Then a wave hits the tower, the lamp swings, and every shadow in the room sweeps sideways.
- **1 minute.** You watch the eight wedge squares darken one by one and pull the plate at the eighth. Dripping, it goes into the water, then the hypo, where the milky halide clears in a wave that follows your rocking ("tink"). You carry it to the canary light table and drag the black velvet across, and the negative flips to positive under the cloth's edge. You put the loupe on the cat's tail: it is visible in the left eye and gone in the right.
- **10 minutes.** You have three plates and a family. A man's head is a laughing double ghost, and the Register says *"Davy would laugh."* You name him. Two keepers' rows stamp **EXAMINED**. The next plate shows a lamp with a cracked window, but the lamp over your head has no crack. You look up at it.

---

## 3. Core loop and progression

```
 TIN ──take plate──▶ DEVELOPER (rock, watch wedge) ──▶ WATER ──▶ HYPO (clear) ──▶ RACK
  ▲                                                                     │
  │                                                        CANARY LIGHT TABLE
  │                                       (negative / velvet / loupe / one eye / wiggle)
  │                                                                     │
  └──── next bundle ◀──── THE RETURN (name, fate, cite, stamp) ◀───────┘
                          DRYING LINE: pin / restore at any time
```

### Per-plate loop (4–7 minutes)
1. **Take** the plate from the opened bundle in the tin. It rises in the tongs, wrapped in black paper, and the paper falls away.
2. **Develop.** Drop it in DEVELOPER and rock. Watch the image and the wedge. The ideal is about 40 s of good agitation (§5.6). Under the ruby lamp you are reading a *negative*: highlights darken first.
3. **Stop.** Drag it into WATER, where development stops within about a second. It keeps developing slowly while it is in the air.
4. **Fix.** Drag it into HYPO and rock until the milk clears (about 6 s agitated, 15 s still). It "tinks", its fixing chord plays, and the plate is now light-safe.
5. **Rack.** It goes to its numbered rack slot automatically, or you can carry it there. The slot is pencilled with its grade.
6. **Inspect** on the canary light table. You can:
   - view it as a negative, or as a positive under velvet;
   - use the loupe (×2/×4/×8);
   - look with one eye (L/R);
   - wiggle between the eyes (wigglegram);
   - read Ottilie's Register page, which has just come unstuck.
7. **Deduce** in the Return:
   - New figure rows appear when a portrait plate is fixed.
   - Drag plates from the strip onto Findings.
   - Fill in Sector answers.

### Progression
- **Bundle gating.**
  - **Bundle I** (TRIAL and plates 1–3) is open at start.
  - **Bundle II** unwraps when every Bundle I plate is fixed, whatever its grade.
  - **Bundle III** follows in the same way.
  - **Bundle IV** (plate 13, from the camera) unlocks only after sealing.

  Gating is about pacing, not difficulty, and never depends on deduction.
- **Deduction confirmation** (truth table in story §8):
  - **Persons:** confirmed **in pairs**.
  - **Findings:** confirmed singly, but only with a valid plate citation.
  - **Sector:** confirmed as a set of four. The **Where** answer can only be filled in by physically reading the pane from your lamp.
- **The climax.** Slide the ruby window out of your lamp. The room crossfades **Ruby → Bone** and becomes white light; this is safe if all plates are fixed and fogs any that are not. Lay the glass on the light table and read `B.S.L. · GAUNT ROCK · SECTOR III`.
- **Sealing and endings.** Sealing is possible at any time:
  - **Incomplete:** ending C (returned for further inquiry; continue playing).
  - **Sector accounted for:** the player chooses **Name the hand** (ending A) or **"a person unknown"** (ending B).
  - Both A and B lead to Ottilie's second letter, then plate 13 from the camera, then all chords, then the cyanotype coda (SHOULD), then the final card.
- **Session length.** About 75 minutes. Saves persist, so it can be played across days.

---

## 4. Interactions and input mapping

General rules:
- One pointer abstraction covers mouse, pen and touch.
- **Tap:** less than 250 ms and less than 6 px of movement.
- **Long-press:** at least 450 ms.
- **Double-tap / double-click:** within 300 ms and 12 px.
- Every interaction also has a keyboard path.
- Touch targets are at least 44 CSS px.

### 4.1 Global

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Move between stations (Shelf / Trays / Table) | `A`/`D` or `←`/`→`; `1` `2` `3`; drag on empty wall; click the station dots | swipe on empty wall; tap the station dots |
| Head sway (cosmetic, ±2° yaw / ±1.5° pitch) | follows cursor position | idle drift 0.1 Hz ±0.5° (optional gyro: STRETCH) |
| Open / close the Return | `R` or `Tab`; click the book on the bench or the book icon | tap the book icon (bottom right) |
| Back / close overlay | `Esc`, right-click on empty space | the **‹** button top left; two-finger tap |
| Hurry the chemistry (×3 time) | hold `Shift`, or toggle in settings | hourglass toggle in settings |
| Mute | `M` | settings |
| Settings | `,` or the cog | the cog (top right of the drying-line band) |

### 4.2 Bench objects

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Open a bundle in the tin | click the bundle | tap |
| Take a plate | click a plate in an open bundle → it is in hand (tongs) | tap |
| Carry the held plate | the plate follows the pointer through a spring (§5.5); the pointer does not need to be held down | drag (press, then the plate follows the finger) |
| Drop into a tray / onto the rack / table / bench | click (mouse) on the target; the plate eases down | release over the target |
| Pick up a plate already in a tray | press on the plate and drag up past 30 px (needs a 0.15 s "suction" hold: SHOULD) | same |
| Auto-advance (dev → water → hypo → rack → table) | double-click a plate | double-tap |
| Flip a plate (emulsion side) | right-click while held | two-finger tap while held |
| Focus a tray (zoom) | click the tray rim; `Enter` | tap the rim |
| Rock a focused tray | drag anywhere on the tray except the plate: the tray tilts in the drag direction, ±9° max | one-finger drag |
| Auto-rock (corner to corner at about 2.2 s per cycle) | hold `Space` | long-press an empty tray area |
| Poke the liquid (ripple) | click on the liquid | tap on the liquid |
| Finger wake (SHOULD) | right-drag in the liquid | two-finger drag |

### 4.3 The lamp

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Bump the lamp (swing) | click the lamp body | tap |
| Wick up / down (brightness, §5.2) | drag the brass wick key vertically; `[` `]` | vertical drag on the key |
| Slide the ruby window out | drag the window's top tab upward at least 110 px; `L` then confirm with `L` | drag up |
| Carry the pane | the pane is now in hand; drop it on the light table or back in the lamp | same |
| Put the pane back | drop it onto the lamp front; `L` | same |

### 4.4 Light table (inspect overlay)

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Open a plate on the table | drop a fixed plate on the table; click a rack slot; click a plate thumbnail in the Return | tap |
| Velvet | drag the `VELVET` tab (left edge) across the plate; `V` toggles fully across / fully off | drag the tab |
| Eye: Left / Both / Right | `Q` / `W` / `E`; the eye buttons | eye buttons; in portrait, swipe left/right switches eye |
| Wiggle (alternate eyes, ~3 Hz) | `X`; the wiggle button | the wiggle button; double-tap the plate |
| Loupe | it follows the cursor while over the plate; wheel changes power ×2/×4/×8; `Z` toggles | the loupe sits on the table: drag it (lens offset 80 px above the finger); pinch changes power |
| Zoom / pan the plate | `+`/`-`, drag with the middle button or `Alt`-drag | two-finger pinch / pan |
| Tap Wick (collectible, SHOULD) | click the hotspot with the loupe on it at its minimum power | tap |
| Cite this plate | the **Cite** button opens the Return with this plate held for dropping | same |
| Read this plate's Register page | the **Register** button, or `G` | same |

### 4.5 The Return (book overlay)

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Change tab | click a tab; `1`–`4` while the book is open | tap |
| Choose name / fate / agent | click the field to open a picker list; arrow keys + `Enter` | tap the field, then tap an item |
| Cite a plate on a Finding | drag a thumbnail from the plate strip to the slot; or select the slot, then click a thumbnail | drag, or tap the slot then tap the thumbnail |
| Verdict | `Stands` / `Withdraw` buttons | same |
| Open a document | click it in the Documents tab | tap |
| Open a figure's plate | click the portrait | tap |
| Seal | `Seal the Return` → confirm | same |

### 4.6 Drying line (save pins, always visible as the top band)

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Pin now (save) | click an empty peg; `P` | tap an empty peg |
| Restore | double-click a print; `Ctrl+Z` restores the newest auto-pin | double-tap |
| Remove a print | drag it down off the line | long-press → *Take down?* |

---

## 5. Simulation models

All simulation uses SI units unless noted, with fixed sub-steps and seeded randomness (`ctx.rng(seed)`, a mulberry32 PRNG over a string hash). Every value below is a starting value; designers tune it in `tuning.ts`, owned by the module's work package.

### 5.1 The sea (wave scheduler, `world/sea.ts`)
- The time until the next wave is drawn as `9 + 5·u` seconds, with u ~ U(0,1).
- Strength is `s = 0.6 + 0.4·u`. Every 4th wave is **big**, with `s = 1.4`.
- Each wave also gets a random horizontal direction `(dirX, dirZ)`.
- Each wave emits `{t:'wave'}` on the bus. Effects scale with s:
  - **Camera shake.** Offset `1.5·s` px (internal pixels), decaying as `e^{−t/0.25}`, with noise at 18 Hz.
  - **Trays.** A lateral pseudo-acceleration of `0.4·s` m/s² for 120 ms along the wave direction (`WetBench.impulse`).
  - **Lamp.** Angular velocity `+= (0.15 + 0.15u)·s` rad/s about a random horizontal axis.
  - **Drying line.** Every print gets a sway impulse.
  - **Sound.** The `wave` sfx (§7.4).
- **Reduced motion:** shake off, every impulse ×0.25.
- `freezeSea(true)` (tests): no waves, no sway, no flicker, and the lamp sits at rest.

### 5.2 The lamp and the light (`render/lamp.ts`)
- **Swing.** The lamp is a two-axis pendulum hung from the hook at `ROOM.lampHook`, rod length L = 0.25 m:
  - `θ'' = −(g/L)·sin θ − c·θ'`, with c = 0.4 s⁻¹ and g = 9.81.
  - Semi-implicit Euler at 240 Hz.
  - The natural period is about 1.0 s.
  - A bump adds 0.35 rad/s.
- **Light source.** One `SpotLight` sits at the lamp window. It points along the window normal (toward −x, pitched 35° down), with angle 70°, penumbra 0.6, decay 2, distance 4 m. It casts shadows from a 512² map (256² on low quality), with bias −0.0015.
- **Intensity.** `I = I0 · w² · (1 + 0.06·pink(t))`:
  - w ∈ [0.2, 1] is the wick setting (default 0.6).
  - pink(t) is 1/f noise in [−1, 1].
  - I0 = 6 when the window is in (ruby) and 15 when it is out (white).
- **LightState.**
  - `rubyI = w²` when the window is in.
  - `whiteI = w²` when the window is out (and 0 otherwise).
  - `canaryI = 1` while an **unfixed** plate lies on the light table, otherwise 0.
- **Light in the 1-bit look.** The room renders luminance only (§7.1); the palette supplies the colour. When the window is pulled, the palette sweeps **Ruby → Bone** over 0.8 s (§7.1).

### 5.3 Tray body (`bench/tray.ts`)
- **Tray.** Interior 0.30 × 0.24 m, rim height 25 mm, liquid depth at rest 8 mm.
- **Tilt.** Two axes, θx and θz, each a spring-damper toward a target θ*:
  - `θ'' = k(θ* − θ) − cθ'`, with k = 120 s⁻² and c = 12 s⁻¹ (ζ ≈ 0.55).
  - The tilt is clamped to ±9°.
- **Drag mapping.** On pointer-down, record the screen point p0. Then `θ* = clamp((p − p0)·0.05°/px, ±9°)`. Screen axes are mapped to tray axes through the camera's yaw, so dragging "up the screen" lifts the near edge.
- **Release.** On release, θ* = 0. When θ crosses zero with |θ'| > 0.2 rad/s, play `clack` with gain ∝ |θ'| and add a fluid impulse.
- **Auto-rock.** θ* cycles through the corners (+6°,+6°) → (−6°,+6°) → (−6°,−6°) → (+6°,−6°), 0.55 s per corner. This is near resonance.
- **Wave impulse.** The wave acceleration enters the fluid as a head term (§5.4). It does not tilt the tray body.

### 5.4 Liquid: virtual-pipes heightfield (`bench/fluid.ts`)
**Grid.** 60 × 48 cells, cell size l = 5 mm. Each cell stores water depth d, and each cell has outflow fluxes F to its 4 neighbours.

**Floor height.** `b(x,z) = x·tan θx + z·tan θz`. Add **2 mm** under the plate footprint (plate thickness).

**Effective head.** `H = b + d + (a·r)/g`, where a is the tray's lateral acceleration (from waves and splashes) and r is the cell's position relative to the tray centre.

**Per substep** (Δt = 1/240 s, 4 substeps per frame at 60 fps):
```
F_{i→n} ← max(0, λ·F_{i→n} + Δt · g · A · (H_i − H_n) / l)      A = l², λ = 0.995
K_i     = min(1, d_i · l² / (Σ_n F_{i→n} · Δt))                   // prevent negative depth
F_{i→n} ← K_i · F_{i→n}
d_i    += Δt · (Σ F_in − Σ F_out) / l²
u_i     = ((F_{w→i} − F_{i→w} + F_{i→e} − F_{e→i}) / 2,  (same in z)) / (l · max(d̄, 0.5 mm))
```

**Stability and behaviour.**
- The CFL bound is `l/√(g·d) ≈ 18 ms`, so Δt = 4.2 ms is safe.
- The fundamental slosh period at 8 mm depth is about 2.1 s.
- Clamp d ≥ 0. Walls are reflective (zero flux through them).

**Spill (SHOULD).**
- Liquid that piles past the rim (H − b_rim > 25 mm at an edge cell) is removed.
- The removed volume becomes drip particles (§5.5).
- `liquid[bath]` (litres) is tracked. Below 70% of the start volume the tray reads "low", and wetness falls naturally.
- A full refill is a click on the bottle.

**Speed (sleep and rate).**
- The tray that is focused or holds a plate being developed runs at full rate.
- The others run at ¼ rate.
- A tray sleeps when Σd·|u|² < 1e−7 and nothing is touching it.

**Outputs.** Each tray exposes `depthAt(x, z)`, `speedAt(x, z)` and `kinetic()`, plus a `DataTexture` of d (R16F, 60×48) for the tray shader.

**Pokes.**
- **Tap ripple.** Subtract 1.5 mm from a Gaussian bump (σ = 6 mm). Redistribute the removed volume into a ring at radius 15 mm so total volume is conserved.
- **Plate drop.** 2 mm depression over the plate footprint, plus `plop` and 4–8 drips.

### 5.5 Carrying, drops, drips (`bench/carry.ts`, `bench/drips.ts`)
- **Carry spring.** The held plate's position x follows the cursor target x\* (a ray hit on a plane 12 cm above the bench):
  - `x'' = 400(x* − x) − 28x'`
  - That gives ζ = 0.7. The lag is what makes the plate feel heavy.
- **Swing.** `roll = clamp(−vx·0.15, ±25°)` and `pitch = clamp(vz·0.15, ±25°)`, each smoothed with τ = 0.08 s.
- **Drop targets.** A plate released over a tray interior, the rack, the light table or the bench snaps to that target over 0.25 s (ease-out). A release anywhere else returns the plate to the bench.
- **Drips (SHOULD).**
  - After leaving a liquid, drops fall at `12·e^{−t/1.5}` per second for 6 s.
  - A drop into a tray makes a ripple of −0.4 mm (σ = 3 mm) and a Minnaert ping.
  - A drop onto the bench leaves a wet decal: a darker Bayer level that fades over 20 s. It is not saved.

### 5.6 Plate chemistry (`bench/chem.ts`): the heart
**Encoding exposure.** Each plate has a precomputed **exposure map** of log2 exposure per plate pixel, made by WP3 (§5.8):
- The brightest diffuse white in a scene is L ≈ 0.
- Wedge step n has L = −(n−1), for n = 1…8.
- The unexposed rebate has L = −12.
- L is stored as a byte: `L = b/255·13 − 12`.

**Fields.** Each plate carries fields on a SIM_W × SIM_H = 128 × 64 grid (each cell ≈ 1.3 mm of glass):
- P: development progress, in effective seconds;
- H: undissolved halide, from 1 to 0;
- F: fog, as exposure-equivalent (1 = as bright as a highlight);
- B: bromide (SHOULD);
- plus one scalar per plate, cDev: developer carried on the plate, from 0 to 1.

**Per-cell inputs** (sampled bilinearly from the tray fluid at the cell's position in the tray):
- depth over the plate surface, d (mm);
- flow speed, |u|;
- wetness, `w = smoothstep(0.3, 1.0, d_mm)`;
- agitation, `A = 0.35 + 0.65·min(1, |u|/u0)`, with u0 = 0.05 m/s.

**Rates, per frame**, with dt in game seconds (×3 when Hurry is on):

| Where the plate is | cDev | dP/dt | dH/dt |
|---|---|---|---|
| DEVELOPER tray | → 1 instantly when w > 0.5 | `R · w · A / (1 + κ·B)` | 0 |
| WATER tray | `cDev·e^{−dt/0.6}` | `R · cDev · w · 0.35` | 0 |
| air (held / bench / rack before fixing) | `cDev·e^{−dt/4}` | `R · cDev · 0.35` | 0 |
| HYPO tray | 0 | 0 | `−H · (0.26 + 0.39·min(1, |u|/u0)) · w` |

Constants: R = 1.0 (normal pyro), κ = 3 (bromide restraint, SHOULD), u0 = 0.05 m/s.

**Fog.** `dF/dt = H · (3.0·whiteI + 0.02·canaryI + 0.0004·rubyI)`. Plates start with a year's age fog of **F0 = 0.015**.
- **White light** at full wick ruins an unfixed plate in about 0.3 s (F ≈ 1).
- **Ruby** at full wick adds F ≈ 0.12 over 5 minutes, a visible veil. This makes brightness a small trade-off.
- **Canary** fogs an unfixed plate left on the light table within about 30 s.

**Density** (computed on the GPU per pixel, §5.7; on the CPU for wedges and thumbnails):
```
S(L) = 2^(s·L)          s = 0.5   (sensitivity slope; "contrast")
D    = 1 − exp(−k · P · (S(L) + F))       k = 1/22
```
- D ∈ [0, 1) is the fraction of grains made developable.
- At P = 0 everything is clear. At the ideal P ≈ 40 s, the densities across the wedge are:

  | Step n | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
  |---|---|---|---|---|---|---|---|---|
  | D | 0.84 | 0.73 | 0.61 | 0.49 | 0.38 | 0.30 | 0.23 | **0.17** |

  Step 1 is not blocked and step 8 is visible.
- Under-developing (P < 27) loses the deep shadows: step 8 falls below D = 0.12 and reads as invisible (P = 25 gives 0.11). The Brilliant window is P ≈ 27–56 s.
- Over-developing (P > 56) blocks step 1 (D ≥ 0.92) and merges the highlights.

**Fixing.** "Clear" is H < 0.02 everywhere. That takes about 6 s with agitation and about 15 s still. Fixed plates ignore light.

**Bromide drag (SHOULD).**
- Bromide builds up where development is fast: `dB/dt = β·(dD̄/dt) − ρ·min(1, |u|/u0)·B`, with β = 4 and ρ = 1.5.
- It is advected semi-Lagrangian by u and diffused with a 1-cell blur every 4 frames.
- It restrains P locally (κ above).
- **Result:** rocking the same way every time drags streaks downstream of dense areas. Corner-to-corner rocking avoids it. Good technique emerges without any tutorial text.

**Grades** (`bench/grade.ts`). These are computed on the CPU from the mean D over each wedge square. Step n is *visible* if D_n ≥ 0.12 and *blocked* if D_n ≥ 0.92. F_mean is fog measured over the rebate.

| Grade | Condition (first match wins) |
|---|---|
| `fogged` | F_mean ≥ 0.35 |
| `streaked` (SHOULD) | the coefficient of variation of P over the image area > 0.15 |
| `dense` | blocked ≥ 2 |
| `thin` | visible ≤ 6 |
| `brilliant` | visible = 8 and blocked = 0 |
| `good` | otherwise |

**Clue readability rule** (used by hints, tests and the legibility pass; it does not gate the Return):
- **shadow**-zone hotspots read iff visible ≥ 8;
- **highlight**-zone hotspots read iff blocked = 0;
- **mid** reads unless the plate is fogged.

### 5.7 Grain and the 1-bit plate image (`render/plateGLSL.ts`, frozen, §11.4)
- **The grain field.** A 128 × 128 blue-noise threshold tile, generated by void-and-cluster at startup (σ = 1.5, about 30 ms), is offset per plate by a seeded texel offset. A plate texel is **silver** iff `D > T`. Because T is fixed to the glass, grains appear one at a time, never swim, and never un-develop.
- **Minified views** (tray, thumbnails): the noise lattice is coarsened to one cell per screen pixel (`texelsPerPx`). E is sampled at `lod = log2(texelsPerPx)` from its mipmaps, so the image stays anchored and free of aliasing.
- **Magnified views** (loupe): the true native grains are drawn as blocks.
- **Milk.** Undissolved halide is drawn as a second, decorrelated threshold on 0.85·H:
  - in the tray (reflection) it is light;
  - on the light table (transmission) it is ink.
- **Display mappings:**

| View | silver | clear glass | milk |
|---|---|---|---|
| Tray (white enamel under, reflected) | ink | light (× lamp lighting, dithered) | light |
| Light table, transmission (negative) | ink | light | ink |
| Light table, over velvet (positive) | light | ink | light |
| Rack / thumbnails | as transmission | | |

### 5.8 Exposure rendering of tableaux (`content/expose.ts`)
- **Actinic shading.** Materials carry an `act` value (blue-channel reflectance, 0–1; §6.6) and are rendered as `MeshLambertMaterial` grey `(act, act, act)`. Lights are set to actinic intensity. Rendering goes to a **HalfFloat** target, one eye per pass, at 480 × 424.
  - Sky is emissive at 1.2 (the UV bonus).
  - Red emitters (the ruby lamp window, red side lights) emit 0.
  - Oil flames emit 0.25 × visible (yellow light is weak to blue-sensitive plates). Their cores are hot points that clip.
- **Long exposures.** N sub-frames (`quality: full` → 12, `low` → 4) are accumulated additively with weight 1/N. Animated figures interpolate between pose keyframes over the exposure (t = (i+0.5)/N), so movers ghost and still figures stay sharp.
- **Light trails** (hand-lamp fans, the masthead light) are **authored geometry**: emissive tubes along the path, with emissive strength = trail brightness × the fraction of the exposure spent per unit length. They are not sampled through sub-frames, so there are no dotted trails.
- **Magnesium.** A point light with intensity 400 and inverse-square falloff, on for the whole exposure for p09 and p10.
- **Spray glow** (p08). A translucent additive cylinder shell (radii 6–40 m around the lantern, height ±15 m) whose emissive strength is an azimuth function: 1.0 in the white sectors, 0.02 in the red sector (70°–110°), and 1.0 in the slot (86°–94°), times rain noise.
- **Halation (SHOULD).** Where exposure exceeds 4 (L > 2), add a ring-blurred copy at radius 18 px with gain 0.06. This runs on the CPU over the readback.
- **Exposure scale.** `scale` (per plate) multiplies exposure so that the subject's diffuse whites land near L = 0. It is tuned by eye with the contact-sheet tool (§13).
- **Stereo.** Two parallel cameras 0.076 m apart. `convergencePx` is the horizontal shift (in px) that aligns the plate's subject plane between the eyes; it is used by the wiggle view.
- **Assembly.** WP3 reads back both eyes (`readRenderTargetPixelsAsync`) and computes `L = log2(max(Y·t·scale, 2^−12))`. It writes the eyes into the 1024 × 512 layout (§11.3). It writes the wedge squares as constants L = −(n−1), sets the rebate to L = −12, and then **scratches** the plate number into the rebate: 1-px strokes at L = −0.5, so they develop dark on the negative and read light on velvet.
- **Cache.** Results are cached in memory and in IndexedDB under key `exp:<id>:<CONTENT_VERSION>`.

### 5.9 Light-table viewing (`inspect/*`)
- **Velvet.**
  - **MUST:** the velvet is a rigid cloth edge. Its x-position follows the tab drag, and the edge shape is `x_edge(y) = x0 + 6px·sin(y/37 + t·0.3) + 3px·noise`. The plate shows as positive left of the edge.
  - **SHOULD:** a Verlet cloth of 20 × 14 particles, with structural and shear constraints, 8 iterations, gravity and bench collision. Its coverage is rasterized into a 256 × 128 mask texture.
- **Loupe.** A circle of radius `0.22·min(viewport)` showing the plate at power ×2/×4/×8 relative to the fitted view, with a brass rim. Under the loupe, `texelsPerPx < 1`, so true grain blocks are drawn.
- **Eyes and wiggle.**
  - **Both:** the two eye rectangles side by side, with the wedge strip beneath.
  - **L or R:** one eye, centred and larger.
  - **Wiggle:** alternate L and R every 167 ms, with R shifted by `convergencePx`. In Reduced motion the alternation slows to 1 Hz.
- **Lean (SHOULD).** Dragging horizontally in single-eye mode cross-dissolves L and R through a dithered threshold proportional to the drag. This is not a geometric morph, but in 1-bit it reads as parallax.

### 5.10 Drying line (`ui/dryingLine.ts`)
- **MUST:** a straight cord across the top band, with 6 manual pegs and 3 auto pegs. Prints hang and sway (`φ'' = −(g/0.06)·sin φ − 1.5φ'`), driven by wave impulses.
- **SHOULD:** a 24-node Verlet rope with sag, with clothespin constraints for the prints.

### 5.11 Broken plate (SHOULD, `inspect/shards.ts`)
- **The break.** p10 cracks into **6 authored pieces** when it is lifted from the hypo. The pieces come from a seeded Voronoi with 6 sites clustered around (0.62, 0.40) in plate UV, and the polygons are stored in its PlateMeta.
- **Reassembly** happens on the light table:
  - drag a piece to move it; rotate it with the wheel, `Q`/`E`, or a two-finger twist;
  - a piece snaps when it is within 4 mm and 6° of its true pose (a `tink`, then a rising pentatonic note);
  - cracks render as 1-px light lines.
- **Unassembled view.** Until the plate is assembled, the light table shows the scattered pieces, and the pieces render the plate's image correctly through their UVs.

---

## 6. Content list

### 6.1 Plates
Full staging is in story §6, and every plate's `PlateMeta.register` is the FINAL line given there. MVP needs **all 14**: the mystery is only complete with every plate. Detail tiers (§10) control set dressing and extras, never the clue content.

| id | No. | Title | Set / variant | Exposure | Bundle | Key clues (story §9) | Portraits |
|---|---|---|---|---|---|---|---|
| p00 | TRIAL | Trial of the Batch | darkroom1887 / arrival | 20 s day | I | (teaching) | |
| p01 | 1 | The Company at the Door | rock / day | 2 s | I | C01–C04, C08 | I–V |
| p02 | 2 | The Lens | lantern / day | 6 s | I | C05–C08 | |
| p03 | 3 | The Store-room by Day | darkroom1887 / cracked | 20 s | I | C09, C10 | |
| p04 | 4 | Dinner | kitchen / day | 8 s | II | C11–C13 | |
| p05 | 5 | The Tower from the Landing | rock / dayWind, 26° FOV | ½ s | II | C14, C15 | |
| p06 | 6 | The Lamp Mended | darkroom1887 / mended | 40 s | II | C16–C18 | |
| p07 | 7 | Lighting-up | lantern / dusk | 30 s | II | C19–C21 (eye R) | |
| p08 | 8 | The Light in the Gale | rock / nightGale | 40 s | III | C22–C24 | |
| p09 | 9 | Magnesium | rock / nightLanding | 3 s Mg | III | C25–C28 | VI, VII |
| p10 | 10 | The Last of the Ribbon | rock / nightLanding | 3 s Mg | III | C29–C32 | X |
| p11 | 11 | The Kitchen, Midnight | kitchen / night | 60 s lamp | III | C33–C37 | VIII, IX |
| p12 | 12 | The Watch Room, Three O'Clock | watch | 50 s lamp | III | C38–C40 | |
| p13 | — | In the Camera | darkroom1887 / mended | 12 s | IV | (resolution) | |

**Fixing chords** (MIDI notes, `PlateMeta.chord`): these are the game's only music, played in sequence at the end.

| Plate | Notes |
|---|---|
| p00 | 62 65 69 |
| p01 | 58 62 65 |
| p02 | 53 57 60 65 |
| p03 | 60 64 67 |
| p04 | 55 58 62 |
| p05 | 57 62 65 |
| p06 | 58 62 65 69 |
| p07 | 57 62 64 |
| p08 | 50 57 65 |
| p09 | 60 65 69 |
| p10 | 55 58 62 67 |
| p11 | 57 61 64 67 |
| p12 | 62 66 69 |
| p13 | 62 66 69 74 76 |

The sequence moves from D minor to D major at the end.

### 6.2 Sets (`content/sets/*.ts`)
Each set is a function `(variant) → { group, anchors }` built from primitives, `LatheGeometry` and `ExtrudeGeometry`. Budget: under 15k triangles per set.

- **`rock`** (exterior). Origin at the tower axis, platform level, y = 0.
  - **Tower.** Granite tapers from r = 3.2 m at y = 0 to r = 2.6 m at y = 17, with 0.45 m courses. The door faces +z: 1.0 × 2.0 m, with three 0.2 m steps down to +z.
  - **Gallery.** Floor at y = 17.2; rail at r = 3.1 m, 1.0 m high.
  - **Lantern.**
    - r = 1.75 m, from y = 17.2 to 20.4; the glazing has 12 sides with diagonal astragals.
    - The dome rises to a ventilator ball.
    - The **sector frame** faces +x (east): panes I, II, III at azimuths −8°, 0°, +8°, at y = 18.45–18.75. The panes are 0.25 × 0.30 m and the `paneIII` variant sets present or empty.
  - **Cottages.** A row with gables at x ∈ [−14, −6], z ∈ [−3, 3], 3.2 m high. The kitchen window is at (−6, 1.4, 1.0), facing +x.
  - **Landing.**
    - Steps run from (2.5, 0, 3.6) down to sea level (y = −6) toward an iron stage at (16, −5.5, 8): 6 × 3 m with stanchions every 1.5 m.
    - A derrick stands at the stage's north end.
  - **Reef.**
    - **The Teeth:** a black rock cluster at (68, −6, 12) ± 10 m.
    - **Outer rocks:** at (36, −6, 20).
  - **Sea.** A 200 × 200 m plane, 128² vertices, displaced by summed Gerstner waves. Actinic value 0.22, with foam at 0.95 where steepness exceeds 0.6.
  - **Sky.** An emissive dome: 1.2 in day variants, 0.25 at dusk, 0 at night.
  - **Ketch** (night variants). A 17 m hull heeled 25° on the Teeth, heading NW. It has two masts (in p09 the mainmast is an animated keyframe falling 0° → 70° over the exposure), a binnacle lamp, and a masthead light.
- **`lantern`** (interior). Origin at the lantern floor centre.
  - **Lens drum.** Stacked rings r = 0.55 at y = 0.6–1.9 on a pedestal r = 0.35, y 0–0.6. The lamp sits inside at y = 1.2.
  - **Glazing.** The same as `rock`. The sector frame is at azimuth 0° (+x), r = 1.73.
  - **Gallery door** at azimuth 180° (−x).
  - **Floor hatch** at (−0.9, 0, 0.6), 0.6 × 0.6 m, with a ladder.
  - **Brass number plates** under the panes, with canvas-drawn engraved numerals.
- **`watch`** (the room under the lantern). A 3.2 m round room containing:
  - a desk at the wall (0, 0, −1.2);
  - a log book that is a separate prop, with a canvas page texture drawn from the log text (story §7.8 and plate 12 staging);
  - a clock on the wall above the desk;
  - a barometer;
  - a ladder up to the hatch;
  - an oil lamp on the desk.
- **`kitchen`.** A 4 × 3.5 m stone-floored room containing:
  - the table (2.0 × 0.9) with 6 chairs;
  - the range on the back wall, with a kettle;
  - a settle on the right wall;
  - a window on the left wall (reflective, for the p11 reflection: an environment quad of Ottilie with her tripod, `act` 0.3, behind the glass);
  - the clock and the duty slate on the back wall;
  - the inner door at the back right;
  - a cask prop.
- **`darkroom1887`.** Built from **`ROOM` constants in `contracts.ts`**, the same layout as the 1888 room (§11.3), dressed for 1887:
  - Ottilie's bottles;
  - the test card on the wall;
  - the plate box;
  - the dustpan;
  - the door (open / a hand open);
  - the lamp, with variants arrival / cracked (on the bench, with crack lines) / mended (on the hook).

### 6.3 Figures (`content/kit/figure.ts`, `cast.ts`)
**Build.** One parametric low-poly human (about 1.2k triangles) made from:
- head: a sphere, r 0.11, scaled by build;
- neck;
- torso: a tapered box, 0.36 × 0.55 × 0.22;
- pelvis;
- upper and lower arms: capsules, r 0.045, length 0.30 / 0.27;
- hands: boxes;
- legs: capsules, r 0.07, length 0.45 / 0.45;
- feet.

**Variants.**
- Skirts are cones (hem r 0.35).
- Long coats are tapered cylinders.
- Hair, beards, caps, the bowler, the scarf and the bandage are attachable meshes.
- Eyes are two small spheres: dark (act 0.05) by default, or milky (act 0.9) for Amos.

**Scale.** Height scales the skeleton, and build scales the torso and limbs.

**Cast parameters:**

| Soul | Height | Build | Clothing (actinic values) | Accessories |
|---|---|---|---|---|
| amos | 1.75 | 1.1 | jacket 0.08 with buttons 0.6; beard 0.7; cap 0.08 with band 0.85 | spectacles, magnifier, apron (p02, 0.85) |
| keturah | 1.62 | 1.0 | dress 0.10; apron 0.85; shawl check 0.3/0.6 | keys 0.5, bun |
| nell | 1.40 | 0.8 | dress 0.15; pinafore 0.80; plait 0.2 | scarf 0.04 (removable), nightgown 0.85 (p11) |
| saul | 1.82 | 1.25 | jacket 0.07; beard 0.07; cap 0.08 (no band) | anchor-tattoo hand texture, pipe |
| davy | 1.70 | 0.85 | cardigan 0.6; trousers 0.12; curly hair 0.15 | cap pushed back, concertina (bellows 0.8 and 0.1 stripes) |
| hosken | 1.70 | 1.3 | reefer coat 0.06; beard fringe 0.7 | bowler 0.05 |
| abery | 1.78 | 1.05 | jacket 0.09 with brass buttons 0.7 (spec) | moustache, bandage 0.9 and sling 0.9 (p11) |
| rype | 1.90 | 1.1 | sweater: dot texture 0.08 / 0.85 with a yoke band | fair hair 0.75 |
| shilling | 1.45 | 0.75 | oilskin 0.55 (high spec) | bare head |
| ottilie | 1.68 | 0.85 | dress 0.08; collar 0.85; hair 0.1 | tripod (reflection), shawl (p13) |
| wick | — | — | cat: 0.05 body, 0.9 bib and tail-tip | poses: sit, sleep-curl, walk |

### 6.4 Pose library (`content/kit/poses.ts`)
Each pose is a set of Euler angles in degrees, plus optional keyframe pairs for motion. **Required poses:**

| Pose | Used by | Pose | Used by |
|---|---|---|---|
| `stand` | many | `standArmsFolded` | saul p01 |
| `standHandOnShoulder` | amos p01 | `holdCat` (left-arm cradle) | nell p01 |
| `sitStep` and `laughHeadBack` (motion) | davy p01 | `peerMagnifier` | amos p02, p12 |
| `handOnGlass` (left) | nell p02 | `sitChinInHands` | nell p03 |
| `sitGrace` | amos p04 | `sitEat` | saul p04 |
| `sitTurned` | davy p04 | `walkCarryPot` (motion over 1 m) | keturah p04 |
| `wipeGlass` | saul p05 | `coilRope` (motion) | davy p05 |
| `holdPlateUp` | nell p06 | `lightLamp` | amos p07 |
| `peekHatch` (head and shoulders, one hand) | nell p07 | `swingLamp` (motion ±35°) | saul p08 |
| `armsFullBlankets` | keturah p09 | `lanternHigh` | amos p09 |
| `haulLine` | saul p09 | `handOverHand` (in water) | abery p09 |
| `kneelReach` | davy p09 | `inWaterReachUp` | shilling p09 |
| `clingSpar` | rype p09 | `atWheel` | hosken p09 |
| `crawlReach` | saul p10 | `lieClingStanchion` | shilling p10 |
| `lieOnSteps` | abery p10 | `kneelWrap` | keturah p10 |
| `standLanternLow` | amos p10 | `sleepWrapped` | shilling p11 |
| `sitSling` | abery p11 | `pourFromCask` (motion) | keturah p11 |
| `headInHands` | saul p11 | `lieUnderSheet` | rype p11 |
| `standDoorway` (sway) | nell p11 | `writeClose` | amos p12 |
| `sitLampInLap` | ottilie p13 | `sleepOnShoulder` | nell p13 |

### 6.5 Props (`content/kit/props.ts`): recipe → actinic value
- **Darkroom lamp.** A japanned tin box, 0.30 × 0.36 × 0.20 (0.06). The window, 0.254 × 0.305, is 0.02, or emits 0 when lit; the crack variant adds 0.9 crack lines on a canvas texture; the etch band is 0.5 frosted text on a canvas texture. Brass maker plate, 0.3.
- **Test card.** Canvas 512², drawn procedurally (story §6 TRIAL).
- **Plate box.** Wood, 0.45.
- **Dustpan.** 0.15, with 3 glass slivers at 0.9 spec.
- **Coal bin.** 0.10.
- **Tin.** 0.12.
- **Concertina.** A box with striped canvas bellows.
- **Hand-lamp.** Tin, with a flame emitter.
- **Storm-lantern.**
- **Cask.** A lathe barrel at 0.4 with iron hoops at 0.1, and a stencil canvas reading `BRANDY · ANNICK ROSE`.
- **Tin cup with N.**
- **Clock.** A canvas face; its hands are parameters.
- **Duty slate.** 0.08, with chalk text at 0.9.
- **Log book.** Page canvas 1024 × 768, handwriting drawn with an italic serif plus per-glyph jitter (±1 px, ±3°) at 0.85 paper / 0.1 ink.
- **Magnifier.** Brass ring with glass.
- **Rope and line.** A tube along a catenary.
- **Spar.** A cylinder.
- **Blankets.** Lumpy boxes at 0.7.
- **Door for the body.**
- **Sheet.** 0.85.
- **Scarf.** A folded box with knit texture at 0.04.
- **Bowler (floating).**
- **Cap on stanchion.**
- **Canvas over the hatch.** 0.3.
- **Ketch.** See §6.2.
- **Derrick.** Iron, 0.08.
- **Stanchions.**
- **Tripod.**
- **Stereo camera** (p13 and the 1888 room). A mahogany box at 0.3 with two brass lenses at 0.35.

### 6.6 Procedural textures (`content/kit/materials.ts`, canvas or `DataTexture`, generated once)
| Texture | Recipe | Actinic |
|---|---|---|
| granite | fbm value noise, 4 octaves, plus sparse dark speckles; course lines every 0.45 m | 0.30 ± 0.08 |
| whitewash | 0.88 plus vertical streak noise | 0.80–0.92 |
| deal wood | sin(x·40 + fbm·6) grain | 0.40–0.50 |
| slate | 0.10 plus fine noise | 0.08–0.14 |
| knit (scarf / sweater) | 4 × 6 px V-stitch tile; dot pattern every 6 px for Rype | per §6.3 |
| check shawl | two-tone 8 px check | 0.3 / 0.6 |
| skin | flat | 0.32 |
| sea foam | threshold on fbm × steepness | 0.95 |
| rain (night) | thin vertical streak sprites, accumulated | 0.4 × light |

**The present-day room** (WP1) uses ordinary luminance greys, not actinic values: whitewash 0.8, wood 0.45, enamel 0.9, brass 0.5, glass 0.6, cloth 0.1.

### 6.7 Documents
All final text is in story §7 and §12–13. WP4 transcribes it verbatim into `story/text.ts`.

### 6.8 The 1888 room (WP1, `render/room.ts`)
The room objects, positioned per `ROOM` (§11.3):
- curved back wall;
- vault;
- bench;
- shelf with 7 bottles (PYRO, BROMIDE, HYPO, FARMER'S, plus 3 unlabelled);
- the tin (from WP2);
- three trays (from WP2);
- the lamp on its hook (WP1 owns the lamp object, including the pane and the maker plate);
- the canary light table: an emissive opal top, 0.45 × 0.35;
- velvet folded beside the light table;
- loupe;
- the 14-slot rack (from WP2);
- the Return book;
- the drying-line cord;
- door;
- coal bin;
- Ottilie's covered stereo camera on its tripod in the corner;
- Wick (SHOULD, as the hint cat).

---

## 7. Art direction, UI, audio

### 7.1 The look

The game has two visual grammars:

- **The present** (the 1888 room) uses **ordered 8×8 Bayer** dither with ink outlines, like an engraving.
- **The past** (anything inside a plate) uses **stochastic grain fixed to the glass** with no outlines, like a photograph.

A glance always tells you whether you are looking at the world or at a picture of it.

**Room pipeline** (`render/postfx.ts`):
1. Render the scene to an internal target at height **450 px** (desktop, when the viewport is ≥ 900 CSS px tall) or **360 px** (otherwise). Width is `height × aspect`, capped at 960. The target has a depth texture.
2. Each material writes three channels:
   - **R:** luminance (Lambert shading of its grey value).
   - **G:** pre-dithered flag. Plate and tray-interior shaders set G = 1 and write 0 or 1 into R themselves.
   - **B:** material id / 255, used for edges.
3. A post shader, drawn into a second internal target, does the following:
   - **Tone:** `v = pow(clamp(R·exposure), 1/2.2)`, with exposure 1.6 under ruby and 1.0 under bone.
   - **Threshold:** `v > bayer8(px + camOffset)`. camOffset is the camera yaw and pitch converted to pixels, `(yaw·f_px, pitch·f_px) mod 8`, which stops the dither swimming while the head sways.
   - **Edges:** an edge is drawn where the linear-depth Sobel `|∇z|/z > 0.08` or the material id differs from a 4-neighbour. The edge colour is **light** when the local luminance is below 0.3 and **ink** otherwise ("bone lines in the dark").
   - **Flagged pixels** (G = 1) pass through untouched.
4. Blit to the canvas with nearest filtering at integer scale where possible (CSS `image-rendering: pixelated`). Shake is a sub-texel offset of the blit.
5. **Palette map:** ink and light are uniforms. A palette transition is a threshold sweep: a pixel uses the new palette where `bayer8 < t`, over 0.8 s, which gives a "three-frame dissolve" feel.

**Palettes** (never more than two colours on screen):

| Name | Ink | Light | Where |
|---|---|---|---|
| **Ruby** | `#160505` | `#c9361f` | The room under the safelight (default) |
| **Canary** | `#1a1206` | `#f2b654` | The light table, the Return, documents |
| **Bone** | `#191613` | `#e9e1cf` | The title screen; the room and table once the pane is out; the endings |
| **Prussian** | `#13396a` | `#e8eef2` | The cyanotype coda only |

Chrome (the drying-line band, the book icon, the station dots) follows the current room palette. If the art-direction doc later sets a site-wide frame, that frame lives outside the canvas.

### 7.2 Screens

1. **Title.** Bone palette, full-screen canvas. A dithered tower in a storm, the lantern showing a dark wedge, `RUBY SECTOR` in large thresholded type, and a `Begin` button. The fog-bell sound plays on `Begin`, which also unlocks audio.
2. **Bench.** A full-viewport canvas with an overlay layout:
   - **Top band** (12% height desktop, 9% phone): the drying line, with prints and pegs. The cog is at the right end.
   - **Bottom centre:** station dots and labels (`Shelf · Trays · Table`). When a tray is focused, a **‹** appears.
   - **Bottom right:** the book icon. A small red-wax dot on it marks new rows or stamps.
   - **Hand cursor:** a dithered tongs sprite while carrying a plate (desktop).
   - **Pencil warnings** fade in near the hazard and fade out after 3 s.
3. **Light table** (overlay, Canary). The plate is fitted to the viewport with 8% margins, the stereo pair side by side over the wedge strip.
   - **Left edge:** the `VELVET` tab.
   - **Bottom bar:** `‹ Back` · eye buttons `L | Both | R` · `Wiggle` · `Loupe` · `Register` · `Cite`.
   - **Corner:** the plate's title in small caps, its date and time in italic, and its grade pencilled.
   - **Portrait phones:** one eye at a time, full width, with the wedge strip below and the eye dots shown as a pager.
4. **The Return** (overlay, Canary, DOM). A two-page spread on desktop (≥ 900 px wide); a single page with top tabs on phones.
   - **Persons:** 10 rows. Each has a 3× nearest-scaled 1-bit portrait crop (72 × 72 CSS px), the name picker, the part picker, and an agent picker where the fate takes one.
   - **Findings:** the Inquiry's printed text with a verdict toggle and a citation slot. A **plate strip** at the foot holds the thumbnails of all fixed plates. These are the player's own developments.
   - **The Sector:** four questions.
   - **Documents:** a list of paper items that open in the reader.
   - **Seal:** the button in the corner.
   - **Stamps:** a slight rotation (±4°), a thunk, and an ink-bleed edge.
5. **Document reader.** A single sheet on a dark ground, at most 640 px wide. Printed documents use small caps; hands use italic. Click outside to close.
6. **Endings.** Letter sheets (Bone), Ottilie's letter, the plate 13 sequence, the cyanotype coda (Prussian), and the final card.

### 7.3 Type and text rendering
- **No font dependency.** In-world text (labels, chalk, the log page, the etch) is drawn to canvas with the system serif stack at low resolution, then thresholded. This makes it 1-bit and slightly ink-spread for free.
- **DOM text** uses `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`:
  - Board text uses `font-variant: small-caps; letter-spacing: .04em`.
  - Ottilie's hand is italic.
  - Amos's hand is italic at 1.25× size with a −4° skew.
- **Minimum size:** body text is at least 16 CSS px, and every text pairing reaches contrast of at least 4.5:1. Canary ink on Canary light is about 10:1. In Ruby, the book is never shown: the book always uses Canary or Bone.

### 7.4 Procedural audio (`audio/*`, WebAudio, no samples)
- **Engine.** One `AudioContext`, unlocked on the first gesture. Master gain → a soft limiter (DynamicsCompressor). Noise buffers (white, pink, brown, 4 s, looped) are generated once.
- **Sea bed.** Brown noise → lowpass at 300 Hz → gain LFO at a random 9–13 s period between 0.15 and 0.35.
- **Wave strike.** Layered, with every gain multiplied by the wave's strength s:
  - a sine thump at 38 Hz (gain envelope 0 → 0.9 in 10 ms, decay τ = 0.5 s);
  - bandpassed noise at 600 Hz, Q 0.7, decay 2 s;
  - a stone creak 0.3 s later (noise impulses at 40/s through a 180 Hz, Q = 30 resonator, for 0.6 s);
  - bottle chatter (6–10 ticks of 2–4 kHz partials, 15 ms each, over 0.4 s).
- **Slosh.** Brown noise → bandpass with centre `300 + 600·√KE_n` Hz → gain `0.5·√KE_n`, where KE_n is tray kinetic energy normalized to 0..1 and smoothed with τ = 60 ms.
- **Drip / plop.** A Minnaert bubble: a sine at f = 3.26/r Hz (r = 1–3 mm, so 1.1–3.3 kHz) chirping up 20% over 40 ms, then decaying in 60 ms. A plop is the same at r = 6 mm plus a noise splash.
- **Glass clink.** Modal synthesis with partials ×1, 2.76, 5.40, 8.93 on a 2.1 kHz base, decays 0.4/0.3/0.2/0.1 s, base randomized ±4%. `tink` (plate fixed) is the same at 3.2 kHz, quieter.
- **Tray clack.** Two decaying sines at 180 Hz and 470 Hz (τ 80 ms) with a click.
- **Lamp.** Swing: a creak (narrow 900 Hz resonator excited ∝ |θ'|). Wick: a ratchet tick every 0.05 of travel. Flame: a quiet 1/f crackle.
- **Fixing chord.** Glass-harmonica voices: each note is the sum of a sine and its octave at 0.3, with a 0.6 s attack, sustained 2.5 s, released over 1.5 s. Slow beating comes from a ±0.7 Hz detune. Notes come from `PlateMeta.chord`.
- **Grain fizz (SHOULD).** Very quiet high-passed (6 kHz) noise ticks, Poisson-distributed at a rate ∝ dD̄/dt × area. You hear the image arrive.
- **Paper and stamps.** `paper` is noise through a 2 kHz bandpass, 120 ms. `stamp` is a 70 Hz thud plus a slap. `pen` is scratchy noise bursts while typing or picking.
- **Palette change.** When the pane comes out, a rising airy tone: noise through a 400 → 1600 Hz bandpass sweep over 0.8 s.
- **Fog** (white light on unfixed glass). A sharp `tink`, then a 0.5 s white-noise swell.
- **Mix.** Sea −18 dB, slosh −12 dB, events −6 dB, chords −8 dB. Mute is persisted.

### 7.5 Haptics (Android only, `navigator.vibrate`)
| Event | Pattern |
|---|---|
| clack | 8 ms |
| plate snap / drop | 12 ms |
| wave (big) | 30 ms |
| stamp | 20-30-20 ms |

---

## 8. Save states and persistence

- **Storage.** IndexedDB database `ar-plates`, version 1. If IndexedDB fails (private mode), everything falls back to in-memory storage, and a pencil note on the drying line reads *"(saves will not outlive this tab)"*.

  | Store | Contents |
  |---|---|
  | `kv` | `settings`; `progress` (bundles open, Register pages unstuck, Wick found, pane read, sealed, ending); `return` (`ReturnModel.serialize()`); `bench` (the live `WetSnapshot` plus lamp state); `meta` (save version, `CONTENT_VERSION`) |
  | `pins` | up to 9 entries: `{ index, createdAt, auto, thumb: PNG dataURL 64×48, snap: WetSnapshot, lamp: {windowIn, wick} }` |
  | `exp` | exposure-map cache: `exp:<id>:<CONTENT_VERSION>` → `Uint8Array` |

- **WetSnapshot** (contracts, §11.3).
  - Per plate: P as Uint16 (0.01 s steps), H, F and B as Uint8, cDev, and fixed.
  - Placements.
  - Liquid volumes.
  - Plates still in the tin are omitted; they are deterministic.
  - A typical pin is 40 KB per plate in play, about 0.6 MB worst case.
- **What a pin rolls back.** Physical darkroom state only: plate chemistry and positions, the lamp window and wick, and tray volumes.
- **What a pin never rolls back.** The Return, opened bundles, Register pages, Wick finds and the pane being read. Deduction is never lost. If a plate's bundle was opened after the pin was made, restoring that pin puts the plate back in the tin, undeveloped.
- **Auto-pins** (3, rolling, oldest replaced). Taken:
  - when a plate first goes into DEVELOPER;
  - before white light reaches any unfixed plate (lamp window pulled);
  - before an unfixed plate is laid on the canary table;
  - every 3 minutes of active play.
- **Manual pins:** 6.
- **Restore.** An 8-frame threshold-sweep dissolve with a reversed-noise "reel spun backwards" sound (500 ms).
- **Autosave.** The `bench` snapshot is saved every 10 s, on `visibilitychange` → hidden, and on `pagehide`. The Return is saved on every edit.
- **Versioning.** If the saved `CONTENT_VERSION` differs, the exposure cache is dropped; the Return and progress are kept. If the save version differs, the save is wiped after confirmation.
- **Export / import (SHOULD).** Settings → `Save to file` / `Load from file` as JSON with base64-encoded arrays.

---

## 9. Onboarding (the first three minutes, almost no text)

1. **Title (Bone).** Wind and a fog bell. `Begin`.
2. **Arrival.** A black screen. Footsteps on a stone stair, and a door. The darkroom fades in under ruby: the palette tells you "ruby means safe" without words.
   - Two sheets lie on the bench: the Board's note and Ottilie's first letter. They open automatically, one after the other. A tap dismisses each, so about 20 s of reading.
   - The **TRIAL page of the Register** hangs on its nail and stays visible at the Shelf station. Its four rules are the entire written tutorial.
3. **The tin pulses** with an ink-outline shimmer every 1.5 s. Tap it: Bundle I unwraps with a paper sound, and the TRIAL plate rises in the tongs.
4. **DEVELOPER's rim shimmers.** Drop the plate in; the tray is focused automatically.
   - If the player has not rocked within 4 s, a **dithered ghost hand** demonstrates a corner-to-corner drag on the tray. It stops at the first real rock.
5. **The bloom.** Highlights rise, then the cat, then the wedge squares one by one.
   - A quiet pencil mark `8` on the tray rim fades in once the 6th square shows.
   - If the player leaves the plate past P = 56, the cat sinks into black. That is the lesson, and it costs nothing (an auto-pin exists).
6. **WATER, then HYPO,** each shimmering in turn. Watch the milk clear: tink and the TRIAL chord.
7. **Table.** The station dot pulses. Put the plate on the canary light table.
   - The VELVET tab wiggles. Drag it: the image goes positive.
   - The loupe is offered: hover or drag. The eye buttons pulse once. In the **L** eye the cat's white tail-tip is visible; in **R** it is gone.
8. **Drying line.** The first auto-pin print appears with a little swing and a pencilled `auto`. A ghost hand double-taps it once, the only demonstration of restore.
9. **The book icon** gets its red-wax dot. Opening the Return shows the Persons page with its printed instruction. Bundle I's three story plates are now in the tin.

The game never shows a modal tutorial or a "Next" button. Every shimmer stops after its first successful use and never returns; this is recorded in `progress.taught`.

---

## 10. Scope tiers

### MUST (MVP, shippable in one build round)

**Room**
- The 1-bit room with three stations, tray focus and post FX: Bayer dither, edges, palette, and camera-stable dither.
- Lamp with pendulum swing, wick, and the window pull (Ruby ↔ Bone).
- Wave scheduler: shake, tray impulses, lamp swing.

**Wet bench**
- Three trays with the virtual-pipes fluid, tilt dynamics and auto-rock.
- Tray shader with refraction offset, specular glints and the pre-dithered plate.
- Tin with bundles, the carry spring, double-click auto-advance, and the rack with grades.
- Chemistry: P, H, F, cDev, wetness and agitation. Wedge and grades. Fog from white, ruby and canary light.

**Plates**
- All 14 plates staged per story §6 and exposed: actinic shading, sub-frame accumulation, magnesium, authored trails, spray glow, stereo, the wedge and the rebate scratch.

**Light table**
- Negative, rigid velvet, loupe ×2/4/8, L/Both/R eyes, wiggle, Register page, Cite.

**The Return**
- Persons (pairs), Findings (citations), the Sector (including the pane read).
- Documents, sealing, endings A/B/C, Ottilie's letter, plate 13, the chord sequence, the final card.

**Saves and settings**
- Saves: IndexedDB, 6 manual + 3 auto pins, a straight drying line with sway, autosave.
- Settings: sound, reduced motion, hurry, start again.

**Audio**
- Sea, wave, slosh, plop, clink, tink, clack, chords, stamp, paper, palette.

**Shell and testing**
- Onboarding per §9.
- Mobile layouts (§11.7).
- No-WebGL2 notice page.
- `window.__game` (§13), the smoke script and the contact-sheet tool.

### SHOULD (second round)
- Bromide drag and streaked grades.
- Drips and spill, with bench wet decals.
- Verlet velvet cloth and Verlet drying-line rope.
- Halation.
- p10 shards puzzle.
- Wick: as a collectible (14 hotspots, counter) and as the 1888 hint cat (story §11).
- Lean-dissolve in single-eye mode.
- Grain fizz audio, haptics, and lift suction ("schlurp").
- Cyanotype coda (the Prussian-blue print).
- Share card: a 1-bit PNG of any plate, plus a "wedge barcode" contact sheet of all your wedges with a text summary.
- Save export / import.
- The 2D trial-plate toy in the no-WebGL2 fallback.
- **PNG import as a "spare plate"** (Andrew's note: "Import a PNG"):
  - A box of 3 spare plates on the shelf.
  - Choosing one opens the file input or drop zone.
  - Image luminance becomes `L = log2(0.004 + 0.996·lum)` in both eyes, with a 6 px shift in R for a faux stereo.
  - Develop, fix, velvet and export it like any plate.

### STRETCH
- **Photogram mode:** 2D procedural objects (keys, lace, feather, spectacles) laid on a spare plate under a pulled window, exposed for N seconds.
- Gyro tilt for head sway.
- Sabattier flash with Mackie lines.
- Throwing and shattering any plate (Rapier).
- Door opening into daylight.
- Restrainer and Farmer's reducer bottles (local brush reduction).
- **"Daily Plate":** a seeded random tableau and exposure with one question.
- New Game+ (underexposed set).
- Unlockable palettes: Albumen `#23160d/#eddcb9`, Platinum `#1e1e1c/#d9d6cc`.

---

## 11. Tech plan

Stack: Vite multi-page, TypeScript strict, `three` (r186, as pinned in `package.json`), and plain DOM/CSS. **Rapier is not used**: nothing here needs a rigid-body engine, so the bundle stays small. Every game file lives in `games/plates/`. The page is `games/plates/index.html`, which loads `./main.ts`.

### 11.1 File list and ownership (WP = work package, §12)

```
games/plates/
  index.html              WP1  canvas#stage, #ui root, <noscript>, meta viewport (user-scalable=no), theme-color
  main.ts                 WP1  WebGL2 check → fallback or App; URL params; window.__game install
  app.ts                  WP1  App: renderer, loop, state machine (title|bench|inspect|book|doc|ending), input routing, wiring
  contracts.ts            KICKOFF (verbatim §11.3), then integrator-only
  tuning.ts               KICKOFF: one exported const object per WP (WP-owned keys)
  style.css               WP1  layout, chrome, palette CSS vars, drying line, pencil notes
  stubs.ts                WP1  placeholder WetBench/PlateLibrary/LightTable/ReturnBook so WP1 runs alone
  render/
    plateGLSL.ts          KICKOFF (verbatim §11.4), then integrator-only
    postfx.ts             WP1  internal targets, 1-bit post shader, palette sweep, blit, shake
    palette.ts            WP1  palette table, transitions, CSS var sync
    dither.ts             WP1  bayer8, void-and-cluster blueNoise(128) → DataTexture (shared with WP2/WP4 via import)
    room.ts               WP1  1888 room geometry + anchors per ROOM
    lamp.ts               WP1  lamp object, pendulum, SpotLight, window/pane object, maker plate
    camera.ts             WP1  station rig, dolly, sway, tray focus
  world/sea.ts            WP1  wave scheduler → bus
  input/pointer.ts        WP1  unified pointer → BenchPointer (tap/dbl/long/drag), raycast helper
  input/keys.ts           WP1  key map (§4)
  audio/engine.ts         WP1  context, unlock, noise buffers, master/mute
  audio/sfx.ts            WP1  all voices (§7.4), listens to bus 'sfx' and domain events
  audio/sea.ts            WP1  sea bed, wave strike
  save/db.ts              WP1  IndexedDB kv/pins/exp with memory fallback
  save/pins.ts            WP1  pin/restore/autopin policy (§8), composes WetSnapshot + lamp
  ui/hud.ts               WP1  station dots, book icon, cog, pencil notes, ghost-hand hints
  ui/dryingLine.ts        WP1  top band canvas: pegs, prints, sway, interactions
  ui/title.ts             WP1  title screen
  ui/settings.ts          WP1  settings sheet
  ui/fallback.ts          WP1  no-WebGL2 page (MUST notice; SHOULD 2D trial toy)
  test/api.ts             WP1 (integrator completes) window.__game
  bench/
    wetBench.ts           WP2  implements WetBench
    tray.ts               WP2  tray body + bath + fluid instance + mesh
    fluid.ts              WP2  virtual pipes (§5.4)
    chem.ts               WP2  PlateChem fields + update (§5.6)
    grade.ts              WP2  wedge densities + grades + readability rule
    carry.ts              WP2  tongs spring, drop targets, auto-advance
    plateMesh.ts          WP2  plate object (bench/hand/rack) using PLATE_GLSL
    trayMaterial.ts       WP2  tray interior shader (enamel + liquid + plate)
    tin.ts                WP2  tin, bundle wrappers, unwrap animation
    rack.ts               WP2  14 slots, grade pencil labels
    thumbs.ts             WP2  offscreen render → ImageData thumbnails
    drips.ts              WP2  (SHOULD)
    testExposure.ts       WP2  procedural chart ExposureMap for self-testing before WP3 lands
  content/
    library.ts            WP3  implements PlateLibrary; IndexedDB exposure cache via save/db.ts
    plates.ts             WP3  14 PlateDef entries (data) + PlateMeta derivation
    expose.ts             WP3  tableau renderer (§5.8)
    sets/darkroom1887.ts  WP3   sets/lantern.ts  sets/watch.ts  sets/kitchen.ts  sets/rock.ts
    kit/figure.ts         WP3  parametric human + attachments
    kit/poses.ts          WP3  pose library (§6.4)
    kit/cast.ts           WP3  11 characters + Wick
    kit/props.ts          WP3  props (§6.5)
    kit/materials.ts      WP3  actinic materials + procedural textures (§6.6)
    kit/handwriting.ts    WP3  canvas text helpers (log page, slate, labels, etch)
    gallery.ts            WP3  ?gallery=1 contact sheet (all plates at P=40, velvet, both eyes)
  inspect/
    lightTable.ts         WP4  implements LightTable (ortho overlay pass)
    tableMaterial.ts      WP4  light table shader using PLATE_GLSL (neg/velvet/milk/loupe/eyes)
    velvet.ts             WP4  rigid edge (MUST) / Verlet cloth (SHOULD)
    loupe.ts              WP4
    stereo.ts             WP4  eye modes, wiggle, lean (SHOULD)
    pane.ts               WP4  the Sector III pane view: rendered glass + etch, paneRead trigger
    shards.ts             WP4  (SHOULD)
  story/
    text.ts               WP4  every FINAL string from plates-story.md §7, §12, §13
    truth.ts              WP4  answer key (story §8) + validators
    returnModel.ts        WP4  implements ReturnModel (pairs, citations, sector, seal)
  ui/
    book.ts  book.css     WP4  the Return overlay (DOM)
    documents.ts          WP4  reader
    ending.ts             WP4  endings A/B/C, Ottilie's letter, final card, chord sequence trigger
    epilogue.ts           WP4  (SHOULD) cyanotype coda
    share.ts              WP4  (SHOULD) share card export
scripts/smoke-plates.mjs  WP1 skeleton → integrator   (Playwright, §13)
```

### 11.2 Proposed shared modules (`src/shared/`)

Plates **does not block on any shared module** during the build round. It builds the pieces below locally, behind narrow interfaces. They are proposed for promotion at the cross-game integration pass:

| Module | Why share | Plates source |
|---|---|---|
| `src/shared/dither/` (Bayer matrices, void-and-cluster blue noise, two-tone palette helpers) | Latent (1-bit) and Darkroom (print dither) need the same primitives; one blue-noise tile cached per page | `render/dither.ts` |
| `src/shared/audio/` (context unlock, persisted mute, noise buffers, modal/Minnaert/thump voices) | Every game synthesizes sound; unlock and mute should behave identically site-wide | `audio/engine.ts`, part of `audio/sfx.ts` |
| `src/shared/fluid/` (virtual-pipes heightfield) | Darkroom's concept specifies the same tray model | `bench/fluid.ts`, `HeightfieldFluid` interface below |
| `src/shared/store/` (IndexedDB kv with memory fallback) | All games save | `save/db.ts` |

Rule: if `src/shared/<module>` already exists on `main` **when a WP starts** and matches the interface, use it. Otherwise build locally. Plates agents never write into `src/shared/` in this round.

```ts
// bench/fluid.ts — the shareable surface
export interface HeightfieldFluid {
  readonly nx: number; readonly nz: number; readonly cell: number   // 60, 48, 0.005
  setFloor(fn: (x: number, z: number) => number): void              // metres
  setAccel(ax: number, az: number): void                            // m/s², effective head term
  poke(x: number, z: number, depthM: number, sigmaM: number): void
  step(dt: number, substeps: number): void
  depthAt(x: number, z: number): number
  velAt(x: number, z: number, out: { x: number; z: number }): void
  kinetic(): number
  readonly depthTex: import('three').DataTexture                     // R16F nx×nz
}
```

### 11.3 `contracts.ts` (KICKOFF: write verbatim)

```ts
// games/plates/contracts.ts — FROZEN at kickoff. Only the integrator edits after WPs start.
import type * as THREE from 'three'

export const CONTENT_VERSION = 1
export const PLATE_W = 1024, PLATE_H = 512, SIM_W = 128, SIM_H = 64
export const EYE = { L: { x: 24, y: 24, w: 480, h: 424 }, R: { x: 520, y: 24, w: 480, h: 424 } } as const
export const WEDGE = { x0: 24, y: 460, size: 40, gap: 8, steps: 8 } as const   // step n: L = -(n-1)
export const REBATE_NUMBER = { x: 600, y: 462, h: 14 } as const                  // scratched "No. 7"
export const L_MIN = -12, L_SPAN = 13                                            // byte b: L = b/255*13-12
export const K_DEV = 1 / 22, S_SLOPE = 0.5, F_AGE = 0.015

/** 1888 room = 1887 darkroom set. Metres; origin floor centre; +x along bench to the right; +z toward viewer. */
export const ROOM = {
  x: [-2.0, 2.0], z: [-1.2, 1.4], vaultPeak: 2.5, backWallSagitta: 0.25,
  benchTop: 0.9, bench: { x: [-1.9, 1.9], z: [-1.2, -0.55] },
  shelf: { x: [-1.9, -0.8], y: 1.45, depth: 0.25 },
  tin: [-1.35, 0.9, -0.85], trays: { dev: [-0.36, 0.9, -0.85], water: [0, 0.9, -0.85], hypo: [0.36, 0.9, -0.85] },
  trayInterior: [0.30, 0.24], lampHook: [0.62, 1.95, -0.75], lampRod: 0.25,
  table: [1.3, 0.9, -0.85], tableTop: [0.45, 0.35], rack: [1.75, 0.9, -0.95], book: [1.05, 0.9, -0.62],
  line: { from: [-1.9, 2.05, -1.0], to: [1.9, 2.05, -1.0] }, door: { x: 2.0, z: 0.4, w: 0.8, h: 1.9 },
  coalBin: [-1.6, 0, 0.6], camera1887: [-1.7, 0, 0.9],
  stations: {
    shelf: { pos: [-1.3, 1.55, 0.55], look: [-1.3, 1.05, -0.9] },
    trays: { pos: [0, 1.75, 0.35], look: [0, 0.85, -0.85] },
    table: { pos: [1.3, 1.6, 0.3], look: [1.3, 0.9, -0.85] },
  },
  trayFocus: { dy: 0.55, dz: 0.40 },                               // camera = tray + (0, dy, dz), looks at tray
} as const

export type PlateId = 'p00'|'p01'|'p02'|'p03'|'p04'|'p05'|'p06'|'p07'|'p08'|'p09'|'p10'|'p11'|'p12'|'p13'
export const PLATE_IDS: PlateId[] = ['p00','p01','p02','p03','p04','p05','p06','p07','p08','p09','p10','p11','p12','p13']
export type SoulId = 'amos'|'keturah'|'nell'|'saul'|'davy'|'ottilie'|'hosken'|'abery'|'rype'|'shilling'
export type FateId = 'survived'|'rescuedBy'|'drowned'|'drownedSaving'|'mast'|'struckBy'|'cold'|'lost'
export type FindingId = 'f1'|'f2'|'f3'|'f4'|'f5'
export type Bath = 'dev'|'water'|'hypo'
export type Station = 'shelf'|'trays'|'table'
export type LightMode = 'ruby'|'white'|'dark'
export type PaletteName = 'ruby'|'canary'|'bone'|'prussian'
export type Grade = 'unfixed'|'brilliant'|'good'|'thin'|'dense'|'fogged'|'streaked'
export type Where =
  | { kind: 'tin' } | { kind: 'tray'; bath: Bath } | { kind: 'hand' } | { kind: 'bench' }
  | { kind: 'table' } | { kind: 'rack'; slot: number } | { kind: 'camera' }

export interface Hotspot { id: string; eye: 'L'|'R'|'both'; x: number; y: number; r: number
  zone: 'shadow'|'mid'|'highlight'; minPower?: 1|2|4|8; kind: 'clue'|'wick'|'face'; clue?: string }
export interface PortraitRect { soul: SoulId; fig: number; eye: 'L'|'R'; x: number; y: number; w: number; h: number }
export interface PlateMeta { id: PlateId; no: number | 'TRIAL'; title: string; date: string; time: string
  bundle: 1|2|3|4; register: string; souls: SoulId[]; portraits: PortraitRect[]; hotspots: Hotspot[]
  convergencePx: number; chord: number[]; shards?: [number, number][][] }
export interface ExposureMap { id: PlateId; L: Uint8Array }          // PLATE_W*PLATE_H, row 0 = top
export interface PlateLibrary { list(): PlateMeta[]; meta(id: PlateId): PlateMeta
  expose(id: PlateId, renderer: THREE.WebGLRenderer, quality: 'low'|'full'): Promise<ExposureMap> }

export interface PlateChem { id: PlateId; P: Float32Array; H: Float32Array; F: Float32Array; B: Float32Array; cDev: number; fixed: boolean }
export interface PlateGPU { E: THREE.DataTexture; chem: THREE.DataTexture; seed: THREE.Vector2 }
export interface WedgeReading { density: number[]; visible: number; blocked: number; fog: number; grade: Grade }
export interface WetSnapshot { v: 1; where: Partial<Record<PlateId, Where>>
  chem: Partial<Record<PlateId, { P: Uint16Array; H: Uint8Array; F: Uint8Array; B: Uint8Array; cDev: number; fixed: boolean }>>
  liquid: Record<Bath, number> }

export interface LightState { mode: LightMode; wick: number; windowIn: boolean; rubyI: number; whiteI: number; canaryI: number }
export type SfxName = 'clack'|'plop'|'drip'|'glass'|'tink'|'fixChord'|'stamp'|'pen'|'paper'|'fog'|'unwrap'|'palette'|'pin'|'restore'|'lampSwing'|'wick'|'snap'
export type GameEvent =
  | { t: 'wave'; strength: number; dirX: number; dirZ: number }
  | { t: 'plateMoved'; id: PlateId; to: Where }
  | { t: 'plateFixed'; id: PlateId; grade: Grade }
  | { t: 'fogged'; id: PlateId; amount: number }
  | { t: 'light'; light: LightState }
  | { t: 'station'; station: Station; tray: Bath | null }
  | { t: 'inspect'; id: PlateId | 'pane' | null }
  | { t: 'bundle'; n: 1|2|3|4 }
  | { t: 'stamp'; kind: 'persons'|'finding'|'sector'|'found'; ids: string[] }
  | { t: 'wick'; plate: PlateId }
  | { t: 'paneRead' }
  | { t: 'sealed'; complete: boolean; named: boolean | null }
  | { t: 'pin'; index: number } | { t: 'restore'; index: number }
  | { t: 'sfx'; name: SfxName; gain?: number; pan?: number; data?: number }
export interface Bus { on<T extends GameEvent['t']>(t: T, fn: (e: Extract<GameEvent, { t: T }>) => void): () => void; emit(e: GameEvent): void }

export interface Ctx { renderer: THREE.WebGLRenderer; bus: Bus; light: LightState; lib: PlateLibrary
  noise: THREE.DataTexture                      // 128² blue noise from render/dither.ts
  settings: { reducedMotion: boolean; hurry: boolean; muted: boolean; quality: 'low'|'full' }
  test: boolean; timeScale: number; rng(seed: string): () => number }

export interface BenchPointer { kind: 'down'|'move'|'up'|'tap'|'dbl'|'long'|'cancel'
  x: number; y: number; ndc: THREE.Vector2; ray: THREE.Ray; id: number; button: number; touches: number }

export interface WetBench {                      // WP2 → created by createWetBench(ctx, anchors)
  readonly group: THREE.Group
  update(dt: number): void
  pointer(p: BenchPointer): boolean
  place(id: PlateId, where: Where): void
  where(id: PlateId): Where
  openBundle(n: 1|2|3|4): Promise<void>
  chem(id: PlateId): PlateChem
  gpu(id: PlateId): PlateGPU | null
  setChem(id: PlateId, patch: { P?: number; H?: number; F?: number }): void   // uniform fill (tests)
  wedge(id: PlateId): WedgeReading
  impulse(ax: number, az: number, seconds: number): void
  rock(pattern: 'corners'|'lr'|'still' | null): void                           // auto-rock driver
  focusTarget(b: Bath): THREE.Object3D
  slosh(): number
  thumb(id: PlateId, w: number, h: number, mode: 'neg'|'pos'): ImageData
  snapshot(): WetSnapshot
  restore(s: WetSnapshot): void
}
export type BenchAnchors = Record<'tin'|'trays'|'rack'|'table'|'bench', THREE.Object3D>

export interface InspectOpts { velvet?: number; eye?: 'L'|'R'|'both'; wiggle?: boolean
  loupe?: { u: number; v: number; power: 2|4|8 } | null; zoom?: number; pan?: [number, number] }
export interface LightTable {                    // WP4 → createLightTable(ctx, bench)
  readonly isOpen: boolean; readonly showing: PlateId | 'pane' | null
  open(id: PlateId | 'pane'): void; close(): void; set(o: InspectOpts): void
  update(dt: number): void; render(): void; pointer(p: BenchPointer): boolean }

export interface PersonAnswer { name: SoulId | null; fate: FateId | null; agent: SoulId | null }
export interface ReturnStatus { persons: number; findings: number; sector: boolean; found: boolean; sealed: boolean; ending: 'A'|'B'|'C'|null }
export interface ReturnModel {
  visibleFigures(): number[]
  setPerson(fig: number, a: PersonAnswer): void
  setFinding(f: FindingId, verdict: 'stands'|'withdraw'|null, plate: PlateId | null): void
  setSector(q: 'when'|'who'|'why', v: string | null): void
  markFound(): void
  status(): ReturnStatus
  solveAll(): void                                // everything except 'found'
  seal(named: boolean | null): ReturnStatus
  serialize(): unknown; load(d: unknown): void }
export interface ReturnBook {                    // WP4 → createReturnBook(ctx, bench, table, root: HTMLElement)
  readonly isOpen: boolean; readonly model: ReturnModel
  open(page?: 'persons'|'findings'|'sector'|'documents'): void; close(): void
  onPlateFixed(id: PlateId): void }              // reveals figure rows + Register page
```

### 11.4 `render/plateGLSL.ts` (KICKOFF: write verbatim)

```ts
// games/plates/render/plateGLSL.ts — FROZEN. Used by WP2 (tray, plate mesh, thumbs) and WP4 (light table).
export const PLATE_GLSL = /* glsl */ `
uniform sampler2D uE;        // R8, linear + mipmaps: L = r*13.0 - 12.0
uniform sampler2D uChem;     // RGBA16F, linear: R=P G=H B=F A=B
uniform sampler2D uNoise;    // 128x128 R8 blue noise, nearest, repeat
uniform vec2  uNoiseSeed;    // per-plate texel offset
uniform float uK;            // K_DEV
uniform float uS;            // S_SLOPE
const vec2 PLATE_SIZE = vec2(1024.0, 512.0);
float plateL(vec2 uv, float lod) { return textureLod(uE, uv, lod).r * 13.0 - 12.0; }
float plateDensity(vec2 uv, float lod) {
  vec4 c = texture(uChem, uv);
  return 1.0 - exp(-uK * c.r * (exp2(uS * plateL(uv, lod)) + c.b));
}
float grainT(vec2 uv, float texelsPerPx, vec2 salt) {
  vec2 p = floor(uv * PLATE_SIZE / max(1.0, texelsPerPx)) + uNoiseSeed + salt;
  return texture(uNoise, (p + 0.5) / 128.0).r * 0.98 + 0.01;
}
float plateSilver(vec2 uv, float texelsPerPx) {
  return step(grainT(uv, texelsPerPx, vec2(0.0)), plateDensity(uv, log2(max(1.0, texelsPerPx))));
}
float plateMilk(vec2 uv, float texelsPerPx) {
  return step(grainT(uv, texelsPerPx, vec2(37.0, 61.0)), texture(uChem, uv).g * 0.85);
}
`
export function plateUniforms(gpu: { E: unknown; chem: unknown; seed: unknown }, noise: unknown) {
  return { uE: { value: gpu.E }, uChem: { value: gpu.chem }, uNoise: { value: noise },
           uNoiseSeed: { value: gpu.seed }, uK: { value: 1 / 22 }, uS: { value: 0.5 } }
}
```

`texelsPerPx` comes from `fwidth(uv * PLATE_SIZE)` (take the max of the two components) in the calling shader. E must be created with `generateMipmaps = true` and `minFilter = LinearMipmapLinearFilter`. chem uses `HalfFloatType`, written via `THREE.DataUtils.toHalfFloat`.

### 11.5 Render pipeline (per frame, `app.ts`)
1. `dt = min(clock.delta, 1/20) × timeScale`. Hurry multiplies timeScale by 3. The chemistry and fluid use dt; the camera, UI and lamp use real time.
2. Update, in order: `sea` → `lamp` (pendulum, light) → `bench.update(dt)` (fluid substeps, chemistry, carry, upload of chem textures only for plates whose fields changed) → `camera` (dolly, sway, shake).
3. If a full-screen overlay (inspect, book or document) is opaque, **skip the 3D room render** and keep the last frame as a dimmed backdrop. This saves the phone budget.
4. Otherwise render the room → internal target A (luminance, flag, id, depth) → post → internal target B (two-tone) → blit to the canvas.
5. If inspect is open: `lightTable.render()` draws a full-resolution orthographic quad into the default framebuffer at device pixel ratio ≤ 2.
6. The DOM overlays (book, documents, HUD, drying line) are composited by the browser.
7. **Exposure generation** happens off the hot path. When a bundle opens, `lib.expose()` runs for each plate in it, **one eye per frame**, while the unwrap animation plays. Results are cached; the TRIAL plate is exposed during the title screen.

### 11.6 Performance budget
| Item | Desktop | Phone (mid, 2021) |
|---|---|---|
| Frame | 60 fps (16.6 ms) | ≥ 30 fps (33 ms) |
| Room render | 640–960 × 450, < 150 draws, < 60k tris, shadow 512² | 360p, shadow 256², edges on |
| Fluid | 1 active tray full rate (4 × 60×48 substeps ≈ 0.3 ms), others ¼ rate or asleep | 3 substeps |
| Chemistry | ≤ 3 active plates × 8k cells ≈ 0.3 ms + half-float upload | same |
| Inspect pass | 1 quad at device resolution, ≈ 1 ms | DPR capped at 2 |
| Exposure generation | 14 plates × 2 eyes × 12 subframes, spread across frames | `low` = 4 subframes |
| Memory | E maps 512 KB each (≤ 14 → 7 MB) + GPU copies with mips; under 150 MB total | |
| JS bundle (gzipped) | < 350 KB including three | |

`q=low` is auto-selected when `navigator.hardwareConcurrency ≤ 4`, on mobile UA, or when frames average more than 40 ms over 3 s.

### 11.7 Mobile plan
- **Orientation.** Landscape is preferred, and portrait is fully supported.
  - **Portrait room:** each station uses vertical FOV 70°, with the camera pulled back 0.25 m.
  - **Portrait trays:** the Trays station shows the focused tray. A swipe moves between trays, and the three tray names show as a pager.
- **Touch handling.**
  - The canvas has `touch-action: none` and the page has `overscroll-behavior: none`.
  - Long-press does not open a context menu (`contextmenu` is prevented on the canvas).
  - Every on-canvas hotspot has a minimum hit radius of 22 CSS px, generous for pegs, tabs, lamp tab and wick key.
- **Inspect and book.**
  - Inspect in portrait shows one eye; tap the eye pager to switch.
  - The book is a single page with tabs on phones, and a pickers bottom-sheet replaces dropdowns.
- **Audio.** Audio unlocks on the first tap (`Begin`).
- **Viewport and resize.** Safe-area insets are applied to the top band and the bottom bar. On `resize` / `orientationchange`, the internal targets are rebuilt at most once per 250 ms.

### 11.8 Fallback (no WebGL2)
`main.ts` tests `canvas.getContext('webgl2')`. If that fails, it loads `ui/fallback.ts` and renders the following on a 2D canvas (Bone palette):
- a dithered illustration of the tower and lamp;
- the FINAL notice text (story §13);
- a link back to the hub.

**SHOULD:** below the notice sits a 2D trial-plate toy:
- the TRIAL chart is drawn procedurally into an exposure map;
- development uses the same chemistry on the CPU at 512 × 256;
- the plate is a single tilt-to-slosh rectangle with 1D fluid;
- it ends with a velvet split view.

---

## 12. Build split

The MUST and SHOULD work is split into **four work packages (WPs)** with disjoint file ownership (§11.1), which run in parallel after a 10-minute **kickoff**. If only 2–3 agents are available, merge **WP1 + WP4** (shell and deduction) and keep WP2 and WP3 separate. If only 2 are available, the second pairing is **WP2 + WP3**.

### Kickoff (integrator, about 10 min, before any WP starts)
1. Write `contracts.ts` (§11.3) and `render/plateGLSL.ts` (§11.4) **verbatim**.
2. Write `tuning.ts` with one empty exported object per WP: `export const T1 = {}, T2 = {}, T3 = {}, T4 = {}`.
3. Write a minimal `index.html` that imports `./main.ts`.
4. Run `npm run check` until it is green, then commit. From this point, contracts change only through the integrator, and every change is announced to all WPs.

### WP1: Shell, Room and Light
**Owns:** `index.html`, `main.ts`, `app.ts`, `style.css`, `stubs.ts`, `render/{postfx,palette,dither,room,lamp,camera}.ts`, `world/sea.ts`, `input/*`, `audio/*`, `save/*`, `ui/{hud,dryingLine,title,settings,fallback}.ts`, `test/api.ts`, `scripts/smoke-plates.mjs`.

**Delivers:**
- **Room and rendering:** the 1888 room with every anchor; three stations plus tray focus; the 1-bit post pipeline with all four palettes and sweeps.
- **Lamp:** pendulum, wick and window pull. The pane becomes a carried object (it emits `inspect:'pane'` when dropped on the table).
- **World and input:** the sea, the pointer and key routers, and the full audio set.
- **Saves:** pins and autosave (the composition and policy of §8).
- **UI shell:** the drying line, HUD, title, settings and fallback notice.
- **Test API:** `window.__game` complete against the contracts.
- **Stubs:** placeholder implementations so the shell runs before the other WPs land:
  - a WetBench that shows grey boxes;
  - a PlateLibrary that returns a gradient;
  - a LightTable that draws the gradient;
  - a ReturnBook that is an empty div.

**Self-test:** the smoke script steps 1, 8 and 10 pass against the stubs.

### WP2: Wet Bench
**Owns:** `bench/*`.

**Delivers:**
- **Factory:** `createWetBench(ctx, anchors): WetBench`.
- **Trays and fluid:** three trays with fluid and tilt, the tray shader (refraction, glints, plate), and auto-rock.
- **Plates and handling:** the tin and its bundles; carry and drop with auto-advance; the rack with grade labels.
- **Chemistry:** the full model of §5.6, including fog from `ctx.light`; wedge reading and grades.
- **Output:** thumbnails, and snapshot/restore.
- **SHOULD:** drips and spill, bromide drag, and lift suction.

**Self-test:** use `bench/testExposure.ts` for p00 until WP3 lands. A TRIAL plate developed with `rock(40 s, 'corners')` must grade `brilliant` or `good`. Left `still` for 40 s, it must grade `thin`. At P = 70 it must grade `dense`.

**Interfaces:**
- **Consumes:** `ctx.lib.expose()`, `ctx.light`, `ctx.noise` and `bus`.
- **Emits:** `plateMoved`, `plateFixed`, `fogged`, `bundle`, and `sfx` (clack, plop, glass, tink, fixChord, unwrap).

### WP3: Plates and Tableaux
**Owns:** `content/*`.

**Delivers:**
- **Factory:** `createPlateLibrary(): PlateLibrary`.
- **Content:** all 14 PlateDefs staged to story §6, with metadata (register, souls, portraits, hotspots, convergence, chord, and shards for p10).
- **Kit:** five sets, the figure kit with poses, the cast, props, actinic materials and textures.
- **Renderer:** the exposure renderer of §5.8 with low and full quality.
- **Gallery:** `?gallery=1`, a contact sheet that shows each plate developed at P = 40 under velvet, both eyes, with hotspots outlined when `&hot=1`.
- **Cache:** exposures are cached through `save/db.ts` if present, otherwise in memory.

**Self-test (the legibility pass):** for each hotspot, crop the gallery render and confirm by eye that the clue reads at its stated loupe power in its stated zone. Also check the `thin` and `dense` variants via `?gallery=1&P=24` and `&P=60`:
- shadow clues should vanish when thin;
- highlight clues should vanish when dense;
- mid clues should survive both.

Then verify plate 7's **eye-R-only** disocclusion and plate 5's pane size of at least 9 × 11 px.

**Interfaces:**
- **Consumes:** `contracts.ts`, plus `ROOM` for the darkroom1887 set.
- **Emits:** nothing; this WP is pure data and rendering.

### WP4: Light Table and the Return
**Owns:** `inspect/*`, `story/*`, `ui/{book.ts,book.css,documents,ending,epilogue,share}.ts`.

**Delivers:**
- **Factories:** `createLightTable(ctx, bench)` and `createReturnBook(ctx, bench, table, root)`.
- **Light table:**
  - negative and velvet, both through the frozen shader;
  - loupe;
  - eye modes and wiggle;
  - the Register page view;
  - the Cite flow;
  - **the pane view**: the glass rendered in 1-bit with the etch readable under the loupe. Reading it for at least 1 s, or with the loupe over the etch, emits `paneRead`, and `model.markFound()` follows.
- **Text:** every FINAL string from the story bible in `story/text.ts`, and the truth table plus validators in `story/truth.ts`.
- **The Return:** the model with pair, citation and sector logic, and the book UI with all four tabs and pickers.
- **Endings:** documents, endings A/B/C, Ottilie's second letter, triggering plate 13 (`bench.openBundle(4)`), the chord sequence (an `sfx` event per note), and the final card.
- **SHOULD:** Verlet velvet, lean, shards, Wick hits, hints (story §11), the cyanotype coda, and the share card.

**Self-test:** unit-style checks run via `__game` in the console:
- `solveAll()` → persons 10, findings 5, sector true minus found;
- `markFound()` → sector true;
- the pair rule: two correct rows give one stamp event of 2 ids; one correct row gives none;
- a citation with the wrong plate does not confirm.

**Interfaces:**
- **Consumes:** `bench.gpu`, `bench.thumb`, `bench.wedge`, `lib.meta`, and `bus`.
- **Emits:** `inspect`, `stamp`, `paneRead`, `sealed`, `wick`, and `sfx` (stamp, paper, pen).

### Integration (integrator plus WP1, about 30–45 min, then review rounds)
1. Replace the stubs in `app.ts` with the real factories, and pass `BenchAnchors` from `room.ts`.
2. **Input priority:**
   1. open document;
   2. book;
   3. light table;
   4. drying line;
   5. lamp (window tab, wick key, body);
   6. bench (`bench.pointer`);
   7. camera (station swipe).
3. **Light coupling.** `lamp.window` drives `ctx.light`, palettes and `bus.light`. While an unfixed plate is on the table, set `canaryI`.
4. **Pins.** `save/pins.ts` composes `bench.snapshot()` with the lamp state. Verify that restore round-trips by checking that `wedge()` values are identical.
5. **Story flow.**
   - `bus.plateFixed` → `book.onPlateFixed`, the Register page unsticks, and bundle gating advances (`bench.openBundle(n+1)` when every plate in bundle n is fixed).
   - `bus.sealed` → `ending.ts` → camera cloth → bundle 4.
6. **Onboarding (§9).** The ghost hands, shimmers and `progress.taught`.
7. **Verification.** Run `scripts/smoke-plates.mjs` on desktop and mobile, fix until green, then a 30-minute human-style playthrough with `?test=0`:
   - ten to fifteen minutes at normal speed;
   - the rest with Hurry.
8. **Content tuning** with the gallery: adjust `exposure.scale` per plate so the subject whites sit at L ≈ 0 and every clue obeys its zone.

---

## 13. `window.__game` test API and smoke test

### 13.1 URL parameters
| Parameter | Effect |
|---|---|
| `?test=1` | Skips the title and letters. Freezes the sea. Fixed seed `'test'`. Audio is muted. Waits for no user gesture. Exposure quality `low`. Forces `prefers-reduced-motion` behaviour for wiggle. |
| `?q=low` / `?q=full` | Forces the quality level. |
| `?reset=1` | Wipes the save first. |
| `?gallery=1[&P=40][&hot=1]` | WP3 contact sheet. |
| `?plate=p07&P=40&fix=1&inspect=1[&velvet=1][&eye=R]` | Direct setup for screenshots: opens bundles as needed, places the plate and applies the state. |
| `?solve=1` | Runs `solveAll()` after load. |

### 13.2 API (`test/api.ts`; every method is safe to call at any time and async where it animates)
```ts
interface PlatesTestAPI {
  version: string                                   // 'plates-1'
  meta(id: PlateId): PlateMeta                      // hotspots/portraits for targeting loupe & crops
  ready(): Promise<void>                            // first frame drawn + TRIAL exposure ready
  state(): { screen: string; station: Station; tray: Bath | null; palette: PaletteName; light: LightState
    plates: { id: PlateId; where: Where; P: number; Hmax: number; F: number; fixed: boolean; grade: Grade }[]
    bundles: number[]; book: ReturnStatus; pins: number; wick: number; paneRead: boolean; errors: string[] }
  freezeSea(on?: boolean): void;  wave(strength?: number): void
  setTimeScale(k: number): void                    // 1..20, multiplies chemistry & fluid time
  setStation(s: Station): Promise<void>;  focusTray(b: Bath | null): Promise<void>
  setLight(m: LightMode): void;  setWick(w: number): void
  openBundle(n: 1|2|3|4): Promise<void>
  place(id: PlateId, to: Bath | 'table'|'rack'|'tin'|'bench'): Promise<void>
  rock(seconds: number, pattern?: 'corners'|'lr'|'still'): Promise<void>   // runs at current timeScale
  develop(id: PlateId, P: number): void;  fix(id: PlateId): void;  fog(id: PlateId, F: number): void
  wedge(id: PlateId): WedgeReading
  readable(id: PlateId, hotspotId: string): boolean                        // §5.6 readability rule
  inspect(id: PlateId | 'pane' | null, o?: InspectOpts): Promise<void>
  openBook(page?: 'persons'|'findings'|'sector'|'documents'): void;  closeBook(): void
  answerPerson(fig: number, name: SoulId, fate: FateId, agent?: SoulId): void
  answerFinding(f: FindingId, v: 'stands'|'withdraw', plate: PlateId): void
  answerSector(q: 'when'|'who'|'why', v: string): void
  liftPane(): void;  replacePane(): void;  readPane(): Promise<void>
  solveAll(): void;  seal(named: boolean | null): Promise<ReturnStatus>
  pin(): number;  restore(i: number): Promise<void>;  resetSave(): Promise<void>
  fps(): number;  perf(): Record<string, number>     // ms per subsystem, last 60 frames
}
```

### 13.3 `scripts/smoke-plates.mjs` (Playwright, SwiftShader, run against `npm run dev`)
The script exits with code 1 on any page error, any failed assertion, or a timeout (180 s). Shots go to `shots/plates/`. A **two-colour check** runs on canvas screenshots: at least 99% of pixels must lie within ΔE < 6 of the active palette's ink or light colour, which tolerates antialiased DOM chrome.

| # | Step | Assert / expected visual |
|---|---|---|
| 1 | Load `/games/plates/?test=1&reset=1`; `await __game.ready()` | No errors. `01-bench.png`: a Ruby-and-black 1-bit darkroom. Three trays, the hanging lamp upper right, a bench edge outline in light lines, the drying-line band at the top, station dots, a book icon. Passes the two-colour check. |
| 2 | `setTimeScale(10)`; `openBundle(1)`; `place('p00','dev')`; `focusTray('dev')`; `rock(4,'corners')` | `wedge('p00').grade` ∈ {brilliant, good}. `02-tray.png`: a close tray, a plate showing the negative test card (dark rings and star, the dark cat shape) and the wedge squares graded dark-to-light, with liquid glints as scattered light pixels. |
| 3 | `place('p00','water')`; `rock(0.2)`; `place('p00','hypo')`; `rock(2,'corners')` | `state().plates[p00].fixed === true` and `Hmax < 0.02`. |
| 4 | `inspect('p00',{velvet:0.5})` | `03-velvet.png`: Canary palette, the stereo pair. Left half negative, right half positive; the cloth edge is a wavy vertical boundary. The test card is legible and the wedge strip shows 8 steps. Two-colour check. |
| 5 | `h = meta('p00').hotspots.find(h => h.kind==='wick')`; `inspect('p00',{eye:'L',loupe:{u:h.x/1024,v:h.y/512,power:4}})`, then the same with `eye:'R'` (the loupe at the matching R-eye position, `u + 496/1024`) | `04-loupeL.png` shows the cat's white tail-tip inside the loupe. `05-loupeR.png` does not. A pixel-diff of the loupe region > 2%. |
| 6 | `inspect(null)`; `openBook('persons')` | `06-book.png`: Canary paper, a "Persons" heading, 10 rows reading "(not yet seen upon a plate)". |
| 7 | For each of p01–p12: `openBundle` as needed; `develop(id,40)`; `fix(id)`. Then `solveAll()` | `book.persons === 10`, `findings === 5`, `sector === false`. `07-rack.png`: the rack with 13 fixed plates. |
| 8 | `liftPane()`; wait 1 s | `state().palette === 'bone'`. `08-bone.png`: the same room in bone and ink, the lamp's window empty. No plate is fogged (all fixed). |
| 9 | `readPane()` | `state().paneRead === true` and `book.sector === true`. `09-pane.png`: the dark glass with the light etched text `B.S.L. · GAUNT ROCK · SECTOR III` along its edge. |
| 10 | `seal(true)` | `ending === 'A'`. `10-letter.png`: the Board's letter in Bone. Then `openBundle(4)`, `develop('p13',40)`, `fix('p13')`, `inspect('p13',{velvet:1})` → `11-p13.png`: two figures seated, a lamp in the woman's lap, the cat. |
| 11 | Pins: `pin()`; `develop('p01',80)`; `restore(lastIndex)` | `wedge('p01')` equals the pre-pin reading to 3 decimal places. |
| 12 | Mobile run (390 × 844, touch): steps 1, 2 and 4 | `m01-bench.png` shows a single focused station in portrait. `m04-inspect.png` shows one eye full width with the eye pager. No horizontal scroll (`document.documentElement.scrollWidth <= 390`). |
| 13 | `perf()` logged | Informational only. Under SwiftShader, warn if room render > 50 ms. |

**Contact-sheet job** (for reviewers): `node scripts/shoot.mjs "/games/plates/?gallery=1&hot=1" --size 1600x2400 --full --out shots/plates/gallery.png`.

---

## 14. Risks and fallbacks

| Risk | Likelihood / impact | Mitigation | Fallback |
|---|---|---|---|
| **Clues unreadable in 1-bit grain** | High / critical | Clues are budgeted in pixels (story §6 gives sizes). Hotspots carry zones and loupe powers. The gallery legibility pass is WP3's definition of done. The loupe shows native grains. | Enlarge or move the prop toward the camera; raise its actinic contrast; as a last resort, add a Register line that points at it. |
| **14 tableaux take longer than the build window** | High / high | One kit, data-driven PlateDefs, compositions in story §6 that reuse 5 sets. Order of build: p01, p02, p05, p07, p09, p12 first (they carry the most clues), then the rest. | Plates may ship with fewer background extras (the cottage silhouette, Wick hotspots) but never without their listed clues. |
| **Exposure generation slow on SwiftShader / low phones** | Medium / medium | `low` quality (4 subframes); one eye per frame; IndexedDB cache; generation during the unwrap animation and the title. | Halve the eye resolution for generation (240 × 212, upsampled), with the hotspot crops still pixel-checked. |
| **Fluid instability or tunnelling at high tilt and wave impulses** | Medium / medium | Clamp the flux scale, d ≥ 0, ±9° tilt, 4 substeps, energy damping λ = 0.995. | Drop to a 30 × 24 grid; if needed, fall back to a damped 2-mode analytic slosh (`h = A·cos(kx)·cos(ωt)`) with agitation from |θ'|. |
| **Players never think of the lamp** | Medium / high (the climax) | "with my lamp" is in the first letter; plate 3 shows the cracked window against the player's intact one; `III` etch on p06; the maker plate gives the size; the Stores Return shows no spare; Wick hint 12 is the last resort. | After 6 minutes with only "Where" missing, the lamp ticks as it cools and its window gives a single glint every 20 s. |
| **Players over-rely on save pins and skip craft** | Low / low | Pins are pleasant, not required. The craft still decides what you see. | n/a |
| **Text-heavy documents fatigue players** | Medium / medium | Everything is short. Documents are optional except the two letters. The Register reveals one line per plate. | Collapse documents to excerpts with "read more". |
| **The two-colour rule is broken by antialiasing or UI** | Medium / low | Nearest filtering, palette-mapped chrome, and a two-colour check in the smoke test. | Tolerance in the check, and fix the offenders. |
| **IndexedDB unavailable (private mode, Safari quirks)** | Medium / low | Memory fallback with the pencil note. | — |
| **Audio blocked or no autoplay** | Low | Unlock on `Begin`; `?test=1` mutes. | — |
| **Three r186 API drift** (render-target `count`, `readRenderTargetPixelsAsync`, half-float upload) | Medium / medium | No MRT is used (the flag lives in the G channel). Readback has a synchronous fallback. Half floats go through `DataUtils.toHalfFloat`. | Use RGBA8 for chem with P/2 quantization (0–510 s) if half float misbehaves. |
| **Emotional subject matter** (a child's mistake, deaths) | — | No gore, no bodies' faces beyond a grey sheet and a cut; restraint in all writing; the mercy choice, where both outcomes are kind. | — |
| **Overlap with Latent (also 1-bit, also a darkroom)** | Medium / medium | Different era, genre and grammar. Plates is Obra-Dinn-style fates and stereo glass. Latent is a Barlow-style search through a film archive. Names checked (story §15). | Coordinate palettes: Plates owns Ruby, Canary and Bone. |
| **Parallel WPs editing the same file** | Medium / high | Disjoint ownership (§11.1). The contracts are frozen at kickoff. `tuning.ts` keys are prefixed per WP. | The integrator resolves conflicts; WPs never edit another WP's files. |
