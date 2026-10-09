# LATENT IMAGE: Game Design Document

*Game 4 · slug `latent` · URL `/games/latent/` · final synthesis of `concepts/latent-toy.md`, `latent-game.md` and `latent-craft.md`. The full plot, every frame and every line of text are in **`docs/design/latent-story.md`** (the story bible). This GDD covers how the game works and how to build it. Where the two disagree, the story bible wins on content and this document wins on mechanics.*

---

## 0. Synthesis decisions (what we kept, what we cut)

| Question | Decision | Source |
|---|---|---|
| Story | **The Kessane Hold** (Varrow, 1979 events, one night in 2003). A police photographer dies in an arson; her lover survives under her name and, 24 years later, uses a records regulation to put the evidence in front of a stranger. It is the most surprising and emotionally resonant of the three, and its clues are photographic (camera height, handwriting, kinks, push processing). | craft, rewritten |
| Search model | Barlow contract from the game lens: one or two words, **max 5 results, oldest first, total count shown**, full-text over every document. The 5-result cap is the most important rule in the game. | game |
| Fragments | Documents (text, searched) and **rolls of film** (images, developed and printed). Words found in photographs feed the search box; documents tell you what to look for in the photographs. | all three |
| The clue the player's hands discover | **Kink crescents.** You kink film yourself in the changing bag, then find a roll covered in the same crescents, developed by someone who had never loaded a reel. | toy |
| "Legibility is measured, not scripted" | Kept. A detail is LEGIBLE when the print's tones correlate with the detail's ground-truth signal. Creative technique works. | game |
| Six ways a detail hides | Kept, plus PUSHED (from craft's +2 rolls): BURIED, BLOWN, SMALL, MIRRORED, GHOST, PUSHED, OFFFRAME. | game + craft |
| Ending | Barlow-style choice, no verdict: **FILE** (with an envelope of up to 6 prints, whose facts write the epilogue) or **PURGE** (keep one print). | game + craft |
| Stations | Four screens: **Terminal**, **Light Table**, **Darkroom**, **Drying Line**. Each has its own two-tone palette. | game |
| Tactile set pieces kept | Pull-chain light switch, changing-bag rhythm loading, tank inversions with a rap, enlarger with focus, dodging hand with physical penumbra, tray slosh with real resonance, the bloom. | toy |
| Cut | Pneumatic tube and label maker (lovely, but slow per search; a STRETCH skin over the terminal). Furnace hinge. Temperature bath, benzotriazole, hypo clear, wetting agent. Seven nights (it is one night). Daily mode (STRETCH). Rapier. | — |
| Rapier | **Not used.** Nothing in this game needs rigid bodies. A Verlet chain, a pendulum, a shallow-water grid and spring-damped props cover every interaction. That saves 2 MB of WASM and a build risk. | decision |

---

## 1. Title, subtitle, pitch

**LATENT IMAGE**
*The Kessane Hold*
Hub card line: **Nothing is evidence until you develop it.**

**Pitch.** It is the last night of a police photo lab. Before dawn you must develop and index one carton: eleven rolls of film, ten of them never developed, held on a cold-store shelf since 1979 under the label *HOLD — R.K.* Search the records terminal one or two words at a time. It shows five results, never more. Load film in total darkness by feel, invert the tank, raise the enlarger, hold your hand in the light to pull a face out of a black doorway, and rock the developer tray until the image blooms out of 1-bit static. Every photograph holds a word you can search; every document tells you what to look for in the next photograph. The story is a corrupt fire investigator, a birdwatcher who photographed the wrong night, and two women, one of whom died and one of whom became her. At six you decide what happens to it all. Nobody tells you whether you were right.

---

## 2. Experience goals and hooks

### 2.1 Experience goals
1. **Your hands are the detective.** Every fact the player learns from an image arrives because they did something physical in the darkroom: dodge, burn, grade, enlarge, focus, flip, push, wait.
2. **Insight belongs to the player.** No keyword highlighting, no checkmarks, no notebook that fills itself. The game confirms craft (the LEGIBLE stamp) and never confirms interpretation.
3. **The turn.** The player starts out solving an arson and ends up understanding a grief. The story's big reversal ("she isn't the one who died") must come from the player putting two photographs side by side.
4. **A toy first.** Someone with no interest in the mystery should still happily spend ten minutes printing one frame.
5. **Quiet.** Rain, a compressor, the enlarger hum, no music. When a key image comes up in the tray, a sine cluster tuned to the enlarger's hum rises and stops with the timer bell.

### 2.2 Hooks
- **10 seconds.** A black screen and the word `PULL`. You drag a bead chain: *clunk*, and the room snaps into red 1-bit dither while the safelight swings on its cord, sweeping shadows across the bench. A print is already in the easel. A card in cursive says *start here*.
- **1 minute.** You slide the sheet into the developer and rock the tray; the liquid sloshes and climbs the far wall when you hit its resonance. Out of the static rises a chalk slate: `R.K. 16.2.79 ODGERS NEGS`. You walk to the amber terminal and type `ODGERS`. One result: a birdwatcher's letter about a lost film of night herons.
- **10 minutes.** You have loaded Roll 1 blind, kinked it twice, inverted the tank, hung the strips, and found Roll 6: a copy of a heron photograph with a car in the background, its plate drowned in the copy lamp's glare. You raise the enlarger to 9×, refocus until the grain snaps, swap in a grade-4 filter, and burn the glare through a card with a hole in it. In the developer, the plate is the last thing to appear: `KDL 417`. You search it. The car belongs to the detective who investigated the fire.

---

## 3. Core loop and progression

### 3.1 Loops
- **Micro (30–90 s): read → search → look.** Notice a word in a print, at the light table, or in a document. Search it. Read up to 5 results. Decide what to look at next.
- **Print loop (1–4 min).** Pick a frame at the light table, drag it to the carrier, compose (height, easel, focus), choose a grade, make a test strip, expose with dodging and burning, then develop, stop, fix and hang. A print is fixed when it hangs on the line; the LEGIBLE stamp thunks onto its back if a detail resolved.
- **Roll loop (2–4 min).** Take a cassette from the carton, load it in the changing bag, set the development time, pour, invert and rap, pour out. Strips hang to dry, then go to the light table. **Each roll is developed exactly once.** A latent image can't be redeveloped; the result is permanent, but every essential detail survives a wide window (story bible §10).
- **Session (60–100 min).** Four acts (story bible §10): the Hold, the Fire Squad, Who Held the Camera, R. Kessane. Then `CLOSE 03-0417`.

### 3.2 Progression and gates
- **Open from the start:** every document is searchable. All eleven rolls are in the carton. Nothing is locked behind a story flag.
- **Physical gates only:** a roll must be developed before its frames can be printed. PUSHED details need a push. SMALL details need magnification. MIRRORED details need the carrier flipped. That's it.
- **Clock:** a wall clock runs from 21:00 to 06:00 and advances with actions (search +1 min, develop a roll +20 min, print +6 min, phone call +2 min), plus 1 game-minute per real minute idle. At 05:59 it stops. Sgt Atwell calls once: *"Van's outside. Driver says he'll wait. Take your time."* There is no time pressure; the clock is mood and a stat on the share card.
- **Progress flags** (stages A–K, story bible §10) drive hints and the test API. They never block anything.

### 3.3 Failure
No game over and no wrong answers. Kinks, bubbles, streaks and fogged sheets are permanent but never fatal. Paper is unlimited (the counter on the share card is the only cost). The worst outcome is a PURGE with nothing understood, and that is a legitimate ending.

---

## 4. Interactions and input mapping

### 4.1 Global
| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Switch station | Click a glyph on the bottom **station rail**; keys `1` Terminal, `2` Light Table, `3` Darkroom, `4` Drying Line; `Tab`/`Shift+Tab` cycles | Tap a rail glyph; two-finger horizontal swipe |
| Pick up / carry / drop | LMB drag, release to drop | One-finger drag |
| Inspect object | Double-click | Double-tap |
| Back / close overlay | `Esc` or RMB on empty space | Tap the ✕ glyph, or swipe down on the overlay |
| Menu (save slots, settings, help) | `M` or the ≡ glyph top-right | ≡ glyph |
| Desk phone | Click the phone (Terminal and Darkroom both show it); `P` | Tap the phone |
| Mute | `0` toggles | Settings |

The **station rail** is a 44 px strip at the bottom: four 1-bit glyphs (a CRT, a loupe, a bulb, a clothes peg), plus the clock at the right.

### 4.2 Terminal (amber)
| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Type query | Any printable key types; `Backspace`; `Enter` searches | Tap the input line to focus a hidden `<input>` (OS keyboard); the on-screen line mirrors it; "SEARCH" key on the OS keyboard or tap `⏎` |
| Move through results | `↑`/`↓`, mouse hover | Tap a row |
| Open a document | `Enter` or click | Tap |
| Scroll a document | Wheel, `PgUp`/`PgDn`, `↑`/`↓` | Drag |
| Back to results | `Esc` | ✕ |
| Re-run a past search | Click its line on the receipt tape | Tap the tape line |
| Drag a word from a document into the query | Double-click a word | Long-press 350 ms on a word |

### 4.3 Light Table (cold white)
| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Take cassette from carton | Drag it to the **tank shelf** icon (sends it to the Darkroom) | Drag |
| Turn a cassette over to read its label and DX code | Double-click | Double-tap |
| Move strips | Drag a strip (it slides with friction, snaps to rows) | Drag |
| Loupe | The loupe follows the pointer when held (LMB on the loupe, or hold `Space`); wheel changes power 4×/8× | Drag the loupe; it renders 72 px above the finger |
| Scrub a long roll (Roll 11) | Hold the loupe over a strip and press `←`/`→` to step frame by frame | Drag the loupe along the strip |
| Send frame to enlarger | Click a frame then `E`, or drag the frame onto the enlarger glyph on the rail | Tap frame, tap "→ CARRIER" chip |
| Grease pencil (SHOULD) | Hold `Shift` and drag, or RMB drag | Tap the pencil to pick it up, then drag; tap the pencil again to put it down |
| Erase pencil | `Shift`+double-click a mark, or rub with the eraser tool | Eraser tool |

### 4.4 Darkroom (safelight; white light on the chain)
**Film (changing bag and tank, on the left shelf):**
| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Lights | Drag the pull-chain down ≥ 5 cm; `L` animates a yank | Drag the chain |
| Open the bag | Click the bag (the screen goes to **total black**) | Tap |
| Pop the cassette cap | Drag the opener up 30°, or press `Space` | Drag up |
| Pull the leader | Drag down 3 times | Drag down |
| Wind onto the reel | Alternate `←` and `→` (or `A`/`D`); or alternate drags on the left and right halves of the screen. 24 good strokes load 12 frames (Roll 11: 48 strokes) | Alternate taps or short swipes on the left and right halves |
| Close the tank | Circular drag ≥ 90° on the lid, or `Q` | Circular drag or two-finger rotate |
| Set dev time | Drag the timer dial (15 s detents, 4:00–16:00), or `↑`/`↓` | Drag the dial |
| Pour developer | Drag the jug onto the tank, or `Enter` | Drag |
| Invert | Drag the tank up and over the hinge (≥ 150° and back), or press `I` | Drag |
| Rap the tank | Click the tank or `R` | Tap |
| Pour out | Drag the tank to the sink, or `Enter` again | Drag |

**Printing (enlarger, easel, trays):**
| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Red focus filter in/out | Click the red filter swing arm; `F` | Tap |
| Flip carrier | Click the carrier; `X` | Tap |
| Head height (magnification) | Drag the head handle up/down; wheel over the column; `+`/`-` | Drag the handle; pinch on the column |
| Move the easel (crop) | Drag the projected image on the easel while the red filter is in | Drag |
| Focus | Circular drag on the knob; `Shift`+wheel; `,`/`.` | Circular drag or two-finger rotate on the knob |
| Grain focuser | `G` toggles a circular 8× inset of the projection (red filter in) | Tap the focuser |
| Grade | Click the filter drawer then a number; keys `Shift+0`…`Shift+5` | Tap drawer, tap number |
| Timer seconds | Drag the timer dial (1 s detents, 1–60 s); `↑`/`↓` | Drag the dial |
| Paper onto easel | Click the paper safe (a sheet slides out under safelight) | Tap |
| Test strip | Click `STRIP` on the timer: 5 bands at 1×, 2×, 3×, 4×, 5× the timer value, the card sliding by itself | Tap `STRIP` |
| Expose | `Space` (tap = run timer; hold > 300 ms = manual, release stops); the foot-switch button | Press the foot-switch button (hold = manual) |
| Dodge | While the lamp is on, the pointer over the easel is the dodging tool's shadow; wheel = tool height | Finger on the easel; pinch = height |
| Switch tool: wand / hand / card | RMB cycles; keys `Z` wand, `C` card (burn), `V` hand | Tool chips beside the easel |
| Paper into tray | Drag the sheet from the easel to `DEV` | Drag |
| Rock tray | Drag the tray's near lip: vertical drag pitches, horizontal rolls, ±8°; or hold `W`/`S` to pitch and `Q`/`E` to roll | Drag the lip; optional phone tilt (Settings, DeviceOrientation) |
| Move print between trays | Drag with the tongs (grab within 2 cm of an edge) | Drag |
| Hang print | Drag from `FIX` to the drying-line glyph, or `H` | Drag |
| Crumple a ruined print | Double-click it in a tray | Double-tap |

### 4.5 Drying Line (paper white)
| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Reorder prints | Drag a print along the line (pegs push neighbours) | Drag |
| Look closely | Double-click: a print fills the screen, loupe available | Double-tap |
| Turn print over (stamp + recipe) | RMB on a print, or `T` | Long-press |
| Into envelope / out | Drag a print onto the envelope (6 slots) / drag it back | Drag |
| Grease pencil on prints (SHOULD) | As at the light table | As at the light table |

### 4.6 Accessibility settings
- **Steady hands:** reels load cleanly (no kinks), trays auto-rock at resonance, tank auto-inverts, dodge tool holds still.
- **Lights in the bag:** faint outlines in the changing bag instead of total black.
- **Reduced motion:** no safelight swing, no screen shake, no flicker.
- **High contrast:** every palette becomes pure black/white; red ink becomes inverse video.
- **Screen reader:** an `aria-live` region mirrors terminal results and documents as plain text.
- **Text size:** terminal font ×1, ×1.5, ×2.

---

## 5. Simulation models

All simulations run on the **CPU in TypeScript** at small grid sizes. They are deterministic given a seed: every random draw comes from `mulberry32(seed)`, and the seed is stored in the save. The GPU is used only for drawing the stations, for rendering frame dioramas offscreen, and for the dither pass. This keeps SwiftShader screenshots identical run to run and makes the physics trivially testable.

### 5.1 Time
- Real time drives every simulation (`dt` clamped to 1/30 s).
- **Film development time is compressed:** 1 real second = 10 game seconds in the tank (8:00 nominal = 48 real s).
- **Print development is real time:** 60 s nominal in the tray.
- The wall clock is narrative only (§3.2).

### 5.2 Scene luminance (frame dioramas)
Each frame is a Three.js scene from the frame kit (§6.2) rendered offscreen once, to a **768 × 512** linear luminance map `L(x) ∈ [0, ∞)`.
- Materials: `MeshLambertMaterial` with greyscale `color`, plus `emissive` for lamps, neon and the light table. Lights: `PointLight`, `SpotLight`, `DirectionalLight`, plus one `HemisphereLight` at 0.05 for fill. No tone mapping; the render target is linear.
- **Encoding:** render to a `HalfFloatType` target, then run a quad pass that writes `v = clamp((log2(L) + 12) / 12, 0, 1)` into an RGBA8 target, and read back one channel to a `Uint8Array`. Decode with `L = 2^(12·v/255 − 12)`. 8 bits over 12 stops gives 0.047 EV steps, which is plenty, and night scenes keep their shadows. If the half-float target isn't renderable, render straight to RGBA8 with the same log encoding done in each material's `onBeforeCompile` (fallback path).
- **Insets:** a detail flagged SMALL gets an extra **256 px-wide render of its bbox** via `camera.setViewOffset`, at 4–8× the base density. The negative sampler uses the inset whenever the sample falls inside it.
- **Signal maps Δ:** for each detail, render the bbox twice at 64 px wide, once with the detail's objects visible and once with them hidden (or with their texture swapped to the blank variant), and store `Δ = L_on − L_off` (Float32). This is the legibility ground truth (§5.8).
- **Camera exposure:** `H(x) = L(x) · 2^EV`, with EV per frame (Ruth's brackets −1/0/+1; Mina's +2 rolls −2).
- **Lens:** a vignette `cos⁴` falloff at 0.85 strength (50 mm at f/5.6), plus a 0.6 px Gaussian (lens MTF) baked in at render time. **Halation** around L > 1.5 (flames, headlamps): add a 2-scale Gaussian glow, `L += 0.25·blur(L>1.5, 6 px) + 0.1·blur(L>1.5, 24 px)`.

### 5.3 Film: exposure and development (Varrow Pan 400)
Per roll, development produces a `DevResult` `{ r, agit, bubbles[], kinks[] }`. The negative is never stored as an image; it is evaluated on demand from `L` and `DevResult`.

**Development factor**
```
t_eff = t_dev · a                         t_dev = poured-out time (game s); nominal t_nom = 480 s
a     = 0.85 + 0.15·min(1, n/2) + 0.05·clamp((n − 4)/4, 0, 1)
        n = mean inversions per game-minute
r     = t_eff / t_nom
```

**Characteristic curve**
```
lH   = log10(max(H, 1e-5))
lH0  = −2.0 − 0.9 · log2(clamp(r, 0.5, 2.0))      speed point; push lowers the threshold
γ    = 0.62 · clamp(r, 0.5, 2.0)^0.45              contrast
u    = lH − lH0
Dimg = γ · τ · ln(1 + e^(u/τ)),  τ = 0.12           soft toe
Dimg = 2.4 · tanh(Dimg / 2.4)                       shoulder
Dneg = 0.08 (base) + Dfog + Dimg + Dgrain + Dmarks
Dfog = 0.10 + 0.25·max(0, r − 1.3)² + age           age = 0.06 (Rolls 1–10, cold store), 0.12 (Roll 11)
```
Worked check (designed against these numbers):
- A PUSHED detail at L 0.03 on a 0.01 surround, shot at −2 EV, gives **ΔD = 0.02 at r = 1.0** (lost in grain) and **ΔD = 0.31 at r = 1.6** (clear).
- A BURIED detail at L 0.03 on 0.01, shot at 0 EV, gives ΔD = 0.25 at r = 1.
- Developing at r = 0.7 raises the threshold by 0.46 log units, losing about 1.5 stops of shadow.

**Grain** (film-space, so it scales with magnification and never swims):
```
clump size g = 45 µm (r ≤ 1.2) → 60 µm (r ≥ 1.5), linear between
σD = 0.03 · (1 + 0.8·max(0, r − 1)) · sqrt(Dneg)
Dgrain(p) = σD · N(p/g) / max(1, f/g)          N = 2-octave value noise in negative mm (0.65·n(p/g) + 0.35·n(p/2g)), zero mean, unit variance
                                               f = sampling footprint in negative mm (§5.5), so grain averages out at low magnification
```

**Marks** (`Dmarks`):
- **Kink crescent:** an arc of radius 2 mm spanning 140°, 0.4 mm wide, +0.9 density, soft 0.1 mm edge. Prints white.
- **Air bubble:** a disc of radius 0.25–0.5 mm with Dimg forced to 0 inside (undeveloped). Prints black.
- **Bromide streaks:** if `n < 1` inversion per game-minute, density gradients: below every region with Dimg > 1.2, subtract 0.08·exp(−d/1.5 mm) along +y. Faint, pretty, wrong for evidence.

**Under/over:** r < 0.5 or > 2.0 is clamped. The fairness rule (story §10): every essential non-PUSHED detail survives r ∈ [0.7, 1.4], and every PUSHED detail needs r ≥ 1.35.

### 5.4 Changing bag (loading the reel)
- **State:** stroke count `k` (target 24 for 12 frames; 48 for Roll 11), last side, last stroke time.
- **Stroke:** a key press or a horizontal swipe ≥ 40 px on one half of the screen.
- **Clean stroke:** opposite side to the previous stroke and interval Δt ∈ [220, 650] ms. Advances the film 3 cm (`k += 1`), plays a *zip-tick*.
- **Risky stroke:** same side twice, or Δt < 150 ms. Kink with p = 0.35: a crackle, `navigator.vibrate(120)`, and a crescent recorded at film position `k`. Its frame index is `floor(k/2)` and its position inside the frame is drawn from the kink-safe zones (outside every detail bbox, at least 0.05 from it). A risky stroke still advances.
- **Slow stroke** (Δt > 650 ms): fine, no penalty, a softer tick.
- **Steady hands** setting: every stroke is clean.
- **Roll 7** already carries 14 crescents (story §5.9). The player's own crescents are stored per roll and drawn the same way: same shape, same density. That likeness is the clue.

### 5.5 Enlarger optics
Coordinates: the negative frame is 36 × 24 mm. The paper is 254 × 203 mm (10 × 8 in), simulated on a **320 × 256 cell grid**, 0.794 mm per cell.

**Magnification and crop**
```
M ∈ [2, 16]                      continuous; head height h = (1 + M) · 50 mm  (lens f = 50 mm)
negative footprint per cell  f = 0.794 / M  (mm)
easel offset (cx, cy)            negative-mm point under the paper centre, clamped so the frame stays partly on the paper
mapping: neg(x_paper) = (cx, cy) + (x_paper − paper_centre) / M,  then mirrored in x if flip
```
At M = 7, 36 mm projects to 252 mm and fills the paper. Above that you are cropping. Outside the frame edge (the carrier mask) transmittance is 0, so those cells receive no light and the border prints **white**. Filed-carrier fans can see the gate tooth at M ≤ 3.5.

**Sampling the negative:** the sampler uses a 4-level box mip of `L`, choosing the level from the footprint `f` (so tiny glyphs average away at low M), plus the 4× insets for SMALL details. Density is computed after sampling `L`, which is wrong in principle but invisible at 1 bit and 30× cheaper.

**Focus**
```
φ ∈ [0, 1] (knob)
φ*(M) = 0.15 + 0.7 · (log(M) − log 2) / (log 16 − log 2)
blur radius r_b = 18 · |φ − φ*| · (M / 4)   in cells; Gaussian σ = r_b / 2
```
Raising the head always throws focus out; you refocus after every height change. The grain-focuser inset shows the projection at 8× around the pointer; when `|φ − φ*| < 0.012` it plays a soft tick, and the grain visibly snaps.

**Projected transmittance** `T_proj(x) = 10^(−Dneg(neg(x)))` is recomputed (320×256, ~4 ms) only when frame, M, crop, focus, flip or the development result changes. It is then blurred by `r_b` with a separable Gaussian.

**Irradiance on the easel** (inverse square via head height):
```
I(x, t) = I0 · ((1 + 4) / (1 + M))² · T_proj(x) · (1 − S(x, t)),   I0 = 1.0 /s
```
At M = 4 a clear negative gives 1 unit per second. At M = 12 the same exposure needs 6.8× longer ((13/5)²), which the player learns from test strips without being told.

**Dodging and burning:** `S(x,t)` is the occluder's shadow. The tool sits at height `z ∈ [0.05, 0.6]` (fraction of the lens-to-paper distance; wheel or pinch). Shadow geometry:
```
projected radius   R = r_tool / (1 − z)
penumbra width     w = d_ap · z / (1 − z),     d_ap = 50 mm / 8 (f/8 aperture) = 6.25 mm
S(x) = smoothstep(R + w/2, R − w/2, |x − p(t)|)          wand: r_tool = 12 mm disc on a 0.8 mm wire (wire shadow SHOULD)
hand:  S = shadow of a hand-silhouette SDF (palm 40 mm, four 12 mm fingers), same R and w scaling
card (burn): S = 1 − smoothstep(R + w/2, R − w/2, |x − p(t)|),  r_tool = 10 mm hole, card covers the whole easel
```
Exposure integrates over time, so a hand held still leaves a hard halo and a hand wiggling at 2–4 Hz feathers the edge. Physics, not a filter.

**Exposure integral** (per cell, every frame while the lamp is on and the red filter is out):
`E(x) += I(x,t) · dt`

**Test strip:** a card slides across the paper in 5 steps (each step uncovers 1/5 of the width), so the bands receive 5T, 4T, 3T, 2T, 1T, where T is the timer value.

### 5.6 Paper: response, development, stop, fix, fog
**Latent target density** (graded paper, logistic in log exposure):
```
Δ  = log10(E / Eg)
D* = Dmax / (1 + exp(−κg · Δ)),     Dmax = 2.0
κg = {2.6, 3.3, 4.2, 5.3, 6.7, 8.5}[grade 0..5]
Eg = 0.9 · {1, 1, 1, 1, 1.25, 1.6}[grade]        so a negative midtone (T ≈ 0.11) at M = 4 lands mid-grey in ~8 s
```

**Development in the tray.** Real time; each cell carries `tDev` and `tInd`:
```
tInd(x) = clamp(6 · (Eg / max(E, 1e-4))^0.8, 2, 50) s      high exposure (shadows) starts first; highlights last
dtDev/dt = wet(x) · A(x) · act
D(x)    = D*(x) · (1 − exp(−k · max(0, tDev − tInd))),  k = 0.08 /s
A(x)    = 1 + 0.6 · min(|u(x)| / 0.08 m/s, 1)            agitation from the fluid velocity (§5.7)
wet(x)  = 1 if the fluid depth over that cell > 0.5 mm, else 0
act     = 1.0 fresh; −0.004 per print developed (floor 0.7); a fresh jug resets it (SHOULD)
```
So a dense shadow appears in about 3 s, a midtone in about 10 s, and a burned-in highlight detail at 0.2·Eg not until about 22 s, reaching full contrast near 60 s. **Pull early and the shadows stay open; wait and the highlights come in.** Both are legitimate techniques.

**Uneven development:** a sheet slid in at an angle, or tilted so a corner lifts out of the liquid, develops unevenly, because `wet(x)` is per cell.

**Stop:** in the STOP tray, `act` falls to 0 with τ = 0.4 s (a sour fizz).

**Fix:** in the FIX tray, `F` rises 0 → 1 over 8 s while wet. At F = 1 the print can hang. LEGIBLE is evaluated at F = 1.

**Fog** (white light while paper is out of the safe and F < 1):
- Undeveloped paper: `E += 40 · Eg · dt` everywhere. It develops black.
- Developing or developed paper: `D ← D + (Dmax − D)·(1 − exp(−3·(1 − F)·dt))`. It goes black in about 1 s, with a falling low-passed hiss. The print is marked `fogged`.

**Wet look:** while wet, displayed D is multiplied by 0.92 (prints look lighter wet under safelight). Dry prints on the line show true D.

**Display mapping** (print to station luminance before the dither pass):
`R = 10^(−D)`, `Ldisp = ((R − 0.01) / 0.99)^(1/2.2)`.

### 5.7 Tray fluid (virtual-pipe shallow water)
One grid per tray, CPU:
```
tray 32 × 24 cm, grid 32 × 24 cells, cell l = 0.01 m
rest depth h0 = 0.012 m, lip height 0.03 m
η = h + b,   bed b(x, y) = x·tan θx + y·tan θy   (tilt, |θ| ≤ 8°)
pipe flux  f ← max(0, 0.996·f + dt · l² · g · (η_i − η_j) / l)   for the 4 neighbours
scale each cell's total outflow so it never exceeds h·l²/dt
h += dt · (Σ f_in − Σ f_out) / l²
u = net flux / (l · h̄)                              cell velocity
dt = 1/120 s, 2 substeps per 60 fps frame
```
- **Resonance:** wave speed `c = √(g·h0) = 0.343 m/s`, so the fundamental slosh mode along the long axis is `f1 = c / 2L = 0.54 Hz`, a period of 1.87 s. Rocking once every ~1.9 s builds the wave. Rocking hard at resonance can spill: cells at the rim with `η > lip` lose volume `(η − lip)·l²` per step and spawn droplet particles, and a dithered puddle stain is added to the bench texture (permanent bench decor, saved).
- **Tilt input:** the tray's target angle comes from dragging its near lip, mapped as 1 px = 0.05°, clamped ±8°. The tray follows on a critically damped spring (ω = 8 rad/s), and when the angle returns to 0 with |ω| > 0.5 rad/s a ceramic *tok* plays. A tilt of 8° raises one end by 4.5 cm, more than the 1.2 cm depth, so **over-tilting lifts the print out of the developer**, and that end stops developing.
- **Paper in the tray:** the sheet lies on the tray floor and is dragged by the liquid: `v_paper += 0.6 · (ū − v_paper) · dt`, where ū is the mean fluid velocity over the covered cells. It is clamped to the tray walls.
- **Rendering:** the heightfield drives a 32×24 vertex mesh. Shading `n·l` for the safelight's specular, and the print texture under the liquid is refracted with UV offset `0.6·∇h`. Through the dither, this gives shimmering caustic speckle for free.
- **Slosh sound:** band-passed noise (300–900 Hz) with gain proportional to total kinetic energy `Σ ½ h |u|²`, plus a *lap* transient whenever a rim cell's dη/dt changes sign above 0.02 m/s.

### 5.8 Legibility (the LEGIBLE stamp)
Each detail `d` (story bible §5) has `bbox` (frame coords), `rho_d`, `mMin_d`, `pattern[]` and `factId`. A print is evaluated when it reaches F = 1:
1. **Sample grid:** 48 × n_y points across `bbox` in frame space (n_y keeps square samples). Map each through the inverse of the print's enlarger transform (M, crop, flip) to a paper position. Points off the paper or outside the frame mask are invalid. `coverage = valid / total`.
2. **Print signal** `P_k` = print reflectance `R` at that paper position, bilinear over a 1-cell box blur of the print grid.
3. **Ground truth** `Δ_k` = the detail's signal map sampled at the same frame points.
4. `ρ = Pearson(P, Δ)` over the valid points.
5. **Pass** if `coverage ≥ 0.9` ∧ `M ≥ mMin_d` ∧ (`flip` if MIRRORED) ∧ `ρ ≥ rho_d` ∧ not fogged.

Why it works:
- Low M means the paper grid undersamples the glyph, so ρ collapses.
- A burned-out highlight, a buried shadow or an unpushed shadow has P flat, so ρ ≈ 0.
- Mis-focus blurs P, so ρ drops.
- Grain adds noise to P, which drops ρ a little; that is exactly the "grain ceiling" feel.

**While the print is in the developer**, ρ is computed every 0.5 s for the frame's highest-value detail. It drives the **rising sine cluster** (§7.4): gain rises with `ρ/rho_d`, and on crossing the threshold it holds until the timer bell. It is a musical hint that you are getting close, never a visual one.

The stamp writes `{factId, rho, M, grade, seconds}` into the print record.

### 5.9 Search engine
- **Index:** built at load from `data/docs.ts`. Each document is tokenised over `id + type + body + margin`.
- **Tokeniser:**
  - Upper-case everything and normalise quotes (`'` `’` → `'`, drop `"`).
  - Split on whitespace and on `, ; : ( ) ! ? —`. Keep `.` `-` `/` `'` inside a token, and also index each part split on them (`79-0311/01` indexes `79-0311/01`, `79-0311`, `79`, `0311`, `01`).
  - Strip a trailing `'S`.
  - Strip a trailing `S` from tokens longer than 3 letters that don't end in `SS`.
- **Stopwords:** `THE A AN OF TO AND IN ON AT BY FOR IS WAS IT I SHE HE HER HIS NO NOT WITH AS FROM THAT THIS BE ARE HAD HAVE BUT OR SO WE YOU`, plus any token found in more than 25 documents.
- **Query:**
  - 1–2 tokens; two means AND. A query that tokenises to `KDL 417` matches documents containing both.
  - Results are sorted by ISO date ascending, ties by id. Show at most 5, plus the total count.
- **Read state:** a result row shows `•` if unread. Opening a document marks it read and adds `docsRead`.
- **Redactions** (`[[...]]`) render as █ blocks and are excluded from the index.
- **The tape:** every query appends `{clock, query, count}`.

### 5.10 Ending evaluation
Fact groups (from print stamps in the envelope):
```
ARSON       = any of KDL_TANNERY, KDL_NEG, CANS_TANNERY, CAN_TANNERY, HEEL_TANNERY
MURDER      = any of KDL_PLANT, HEEL_PLANT, STAIRWELL_FIRE
CORRUPTION  = any of ENVELOPE_LANTERN, CLAIM_PAID, GD_BRIEFCASE, KDL_LANTERN, HALE_FACE, HALE_SAW
HALE_LINK   = any KDL_* (the registry ties the plate to Hale) or HEEL_PARTY
IDENTITY    = any of HEIGHT_MARKS, HEIGHT_MARKS_2, WATCH_M, or (HORIZON_RUTH and HORIZON_MINA)
MINA        = any of MINA_1987, CURSIVE_LABEL
ATWELL_LINE = any print of Roll 7 F9 or F10
```
These select the clippings, the fax and the last lines exactly as in story bible §7.7. With PURGE, no facts are evaluated.

### 5.11 Small physics toys
- **Pull chain:** 12-bead Verlet, link 2.2 cm, g = 9.81, 8 constraint iterations, damping 0.995, top bead pinned.
  - Grab radius 24 px. The light toggles when the bottom bead goes > 5 cm below rest for > 40 ms (*clunk*, then a 300 ms latch).
  - A bead clink plays when bead speed crosses 0.6 m/s near the housing.
- **Safelight pendulum:** `θ'' = −(g/L)·sin θ − c·θ'`, L = 0.6 m, c = 0.25. Flick it with a drag or tap. It drives the single shadow-casting light, so shadows sweep the bench.
- **Tank inversion:** the tank angle follows the pointer on a spring (k = 30, ζ = 0.7). An inversion counts when the angle passes 150° and returns below 30° within 0.8–4 s. Each one plays a *glug* (3–6 sine pops, 120–260 Hz).
- **Strips and prints on lines:** a 1-D Verlet rope of 30 nodes. Pegs slide along the rope parameter with minimum spacing equal to the print width, so dragging one shoves its neighbours. Prints swing as pendulums (L = 0.2 m, c = 1.2). Sag grows with hung mass.

---

## 6. Content list (with procedural recipes)

There are no external assets anywhere. Every texture is drawn to a canvas at load, every mesh is built from primitives, every sound is synthesized, and every font is defined in code.

### 6.1 Rolls and frames
Full staging is in story bible §5. Summary for scheduling:

| Roll | Frames | Unique compositions | Templates used | Load-bearing details | Tier |
|---|---|---|---|---|---|
| 1 Holloway | 12 | 5 | slate, shopfront, interior, closeup | none | MUST |
| 2 Tannery | 12 | 5 | slate, yard, step, interior, closeup | HEEL_TANNERY ×2, CAN_TANNERY | MUST |
| 3 Tanner's Row | 12 | 5 | slate, alley, van, closeup | HORIZON_RUTH | MUST |
| 4 Party | 12 | 5 | slate, party, interior | HEEL_PARTY, RUTH_TALL | MUST |
| 5 Personal | 12 | 12 | plant, diner, bus, flat, dock, closeup | MINA_FACE, HEIGHT_MARKS, WATCH_M | MUST (F3, F4, F10–12); SHOULD (rest) |
| 6 Copy | 12 | 5 | slate, copystand | KDL_TANNERY, CANS_TANNERY | MUST |
| 7 Fire | 12 | 11 | slate, copystand (light table), plant, dock, street | KDL_NEG, STAIRWELL_FIRE, HEEL_PLANT, KDL_PLANT | MUST |
| 8 Lantern | 12 | 8 | street, diner, alley | ENVELOPE_LANTERN, HALE_FACE, KDL_LANTERN, HORIZON_MINA, GD_BRIEFCASE | MUST (F2–F5); SHOULD (F7) |
| 9 Corran | 12 | 5 | street, alley | CLAIM_PAID, HALE_SAW | MUST |
| 10 Wick Lane | 12 | 8 | flat | HEIGHT_MARKS_2, CURSIVE_LABEL | MUST |
| 11 Window | 36 | 1 template + F36 variant | window | MINA_1987 (+ OFFFRAME DX) | MUST |

Non-unique frames are brackets (EV variants) or parameter variants (camera jitter, rain, time). **The MVP needs about 60 unique compositions from 16 templates.** Every frame is a `FrameRecipe` in `data/rolls.ts`:
```ts
{ roll: 6, frame: 6, template: 'copystand', ev: 0, seed: 6061,
  cam: { pos: [0, 0.55, 0], look: [0, 0, 0], roll: 0, fovV: 27 },
  params: { print: 'heron14', glare: [0.62, 0.46, 0.09] },
  details: [{ id: 'KDL_TANNERY', bbox: [0.55, 0.42, 0.14, 0.08], rho: 0.5, mMin: 8,
              pattern: ['BLOWN', 'SMALL'], hide: ['plateText'], inset: true }] }
```
`hide` names the scene objects toggled off to render the Δ map.

### 6.2 Frame-kit templates (`frames/templates/*.ts`)
Each template is `(params, rng) => THREE.Scene`, built from shared kit parts (§6.3) in under 150 draw calls.

| Template | Recipe |
|---|---|
| `slate` | 0.30 × 0.22 m black slate (L 0.04) held by a kit hand at the left; chalk text drawn with `strokeFont('caps', chalk: true)` (stroke jitter 0.6 px, 30% dropout along strokes); background chosen by param (brick pier / charred timber / light-table glow) |
| `shopfront` | 6 m street box: pavement plane (concrete texture), kerb, shop facade (brick + painted fascia with `blockFont` lettering), window with crack-star texture (canvas radial lines), overcast hemisphere light |
| `yard` | Tannery yard: roofless brick shell (4 walls, window holes as gaps), scorched sign, puddle planes with reflection = flat bright material, outfall pipe cylinder |
| `step` | Concrete step slab, burned door; bootprint decals (canvas: tread pattern = chevrons + heel block; `heelCut: true` draws a 1.5 mm diagonal gap); grazing `SpotLight` at 12° elevation casting shadows from a 0.5 mm displacement mesh (or a pre-shaded normal-baked texture if shadows are too costly) |
| `interior` | Box room with props: counter, till, fuse board, ship's lamp; generic, param-driven |
| `closeup` | Tabletop plane, the 15 cm steel rule (canvas numerals), a subject decal; camera 0.5–0.6 m |
| `alley` | **Parametric one-point alley:** two brick walls 3 m apart, 40 m long, brick texture at exactly 75 mm/course in world units, a 5 cm white flood line at 1.52 m on both walls, a plaque mesh, an optional van or car, an end street with an emissive glow, an optional sodium `PointLight` at 20 m. Camera height is the parameter that matters |
| `party` | Canteen: back wall with paper chains (triangle strips), 11 figures in two rows, chairs, Hale's leg posed on Dot's chair rung, a table with cake |
| `plant` | Processing hall: a row of machine tanks, light tables (emissive), double doors at the far end; fire mode adds emissive flame quads (L 3–8) for halation |
| `dock` | Loading dock: 1.2 m concrete block, roller door, dock lamp (sodium point light), fuel can, soot bootprint decal, dock lane, car |
| `street` | Quay Road at night: wet road (dark, with smeared emissive reflections), diner facade with neon (`blockFont` on an emissive plane), first-floor office window, sodium lamps, rain streaks (thin vertical quads) |
| `diner` | Booth interior: window, table, napkin, counter mirror (a second camera renders the reflection into a texture, then UVs are flipped) |
| `bus` | Bus interior: seat rows, windows, destination blind (emissive `blockFont`), a sleeping figure, one moving street-lamp `PointLight` |
| `copystand` | Black baseboard, a glossy print plane whose texture is **another rendered frame** (the heron photos are rendered by the `yard` template from Odgers's position, then printed onto the plane), two lamps at 45°, a specular glare quad |
| `flat` | Kitchen and bedroom: door frame with pencil-mark decals (strokeFont caps and cursive), coat hook, bed, table, carton, window |
| `window` | Port Avel sash window: sill, jar with seasonal contents (simple lathe or sprite geometry), card, outside plane (harbour wall + rooftops + sea gradient, snow overlay by month); F36: a reflective pass composites the room-behind render at 0.35 opacity |

### 6.3 Kit parts (`frames/kit.ts`)
- **Figure(heightM, build, pose, outfit)**: capsule torso, sphere/box head, cylinder limbs, a hair mesh (bob, short, bald, cap). Poses: stand, sit, walk, point-up, lean-booth, sleep-slump, hold-camera. Outfits change only greyscale albedo and coat length. Under 400 triangles each.
- **Car(plate)**: a box saloon (body, cabin, wheels), rear plate drawn with `blockFont`, headlamp emissives (on/off).
- **Bootprint(heelCut)**, **FuelCan**, **Rule15cm**, **Watch(engraving)**, **Cassette(labelText, hand, dx)**, **Envelope(formText)**, **Slate(text)**.
- **Textures** (canvas, generated once, cached):
  - **Brick:** 75 mm course, 225 mm stretcher, 10 mm mortar; per-brick tone ±8%; soot gradient param.
  - **Concrete:** 3-octave value noise.
  - **Wood:** sine rings + noise.
  - **Paper:** fibre noise.
  - **Wet road:** dark, with sparse speculars.
  - **Paper chains**, **crack star**, **tread**.

### 6.4 Fonts (all in code, deterministic)
- **`termFont`:** an original 8 × 14 bitmap font, 95 ASCII glyphs stored as a hex string (≈ 1.4 KB), plus `█ • ─ │ ┌ ┐ └ ┘`. Double-height headers are drawn by scaling rows ×2.
- **`blockFont`:** a 5 × 7 grid font for caps and digits (signs, plates, stencils, the neon), rendered as filled rectangles with optional 1-unit serifs. Width ratio 0.7.
- **`strokeFont`:** an original single-stroke vector alphabet (A–Z, a–z, 0–9, `.,'"-—/+&`), each glyph a list of polylines on a 10-unit grid. Two hands share the skeleton:
  - **`caps`** (Ruth): upright, uniform pressure, no joins.
  - **`cursive`** (Mina): 15° slant, Catmull-Rom smoothing, a loop added to ascenders and descenders, entry and exit ligatures joining letters.
  
  Brush: width 1.0 ± 0.25 pressure noise, breaks where paper-tooth noise > 0.8, wax blobs at stroke ends. Used for chalk, pencil, marker, grease pencil and the technique cards.

### 6.5 Station props (procedural meshes)
CRT (bulged screen plane, bezel box), keyboard slab, phone (box + handset + cord as Verlet), carton with lid, cassettes, glassine sleeve, light table (emissive plane), loupe (torus + disc), enlarger (column cylinder, head box, bellows, lamp housing, red filter arm, carrier, focus knob, height handle), easel with blades, filter drawer, timer with dial, foot-switch, paper safe, three trays, tank, reel, jug, sink, changing bag (dark quilted plane), safelight on a cord, pull chain, drying line, pegs, envelope, fax machine (ending).

### 6.6 Text content
Story bible §6 (43 documents), §7 (all UI strings, cards, hints, endings). Builders transcribe verbatim into `data/docs.ts` and `data/text.ts`.

---

## 7. Art direction, UI layout, audio

### 7.1 Look
**Rule: 1-bit everywhere, two colours per space, plus one red that belongs to the player.** The whole canvas goes through a single dither pass that maps luminance to that space's ink/paper pair. The only colour outside the palette is grease-pencil red, `#C4202B`, used for what *the player* decides: pencil marks, the selected search row, the envelope slots. *The world is silver. Your judgement is red.*

| Space | Ink | Paper | Notes |
|---|---|---|---|
| Terminal | `#1A0E00` | `#FFB000` | CRT barrel k = 0.08, scanline every 2nd cell row at 85%, phosphor persistence 0.82 (SHOULD) |
| Light Table | `#0B0D10` | `#E8EEF2` | cold white |
| Darkroom, safelight | `#140302` | `#D8432B` | the default darkroom state |
| Darkroom, white light | `#121110` | `#EFE9DC` | 400 ms white blowout on switching |
| Changing bag | `#000000` | `#000000` | only the reel's luminous dot (`#7DFF9A`, 6%) and the haptic ticks |
| Drying Line | `#0B0B0C` | `#F1EDE3` | fibre paper |
| Ending clippings | `#111111` | `#EDEAE2` | halftone dots at 45° instead of the threshold dither |

**Dither:** `threshold = 0.5·bayer8(x, y) + 0.5·IGN(x, y)` (interleaved gradient noise, analytic and deterministic) with **cell = clamp(round(min(vw, vh) / 360), 2, 4) CSS px**. Station scenes render to a luminance target at `viewport / cell` and are upscaled with nearest filtering. Prints carry film grain from the negative, so two scales of texture read at once: the grain is the photograph, the dither is the room.

**Light:** one shadow-casting light per station at most (the swinging safelight in the darkroom, 1024² shadow map), plus unshadowed fill. In 1-bit, the safelight's swing sweeps shadow bands across the bench like a lighthouse.

**Motion:** springs everywhere (ζ ≈ 0.7). Nothing tweens linearly. Objects you drop settle with a tick.

### 7.2 Screens
**Desktop is landscape, laid out at 1280 × 800.** Each station fills the canvas above the 44 px rail.

- **Terminal:** the CRT fills the left 62%. Inside it: the query line at the top, a result list of 5 rows (`•  DATE  ID  TYPE`, the count above), and the document view replacing the list when opened. Right 38%: the **receipt tape** curling out of a slot and scrolling upward; below it the desk phone and the wall clock. The work order is pinned to the wall above the CRT; clicking it opens `WO 03-0417`.
- **Light Table:** a top-down glowing table filling the view. Top left, the carton (open) with 11 cassettes in two rows. The middle has room for 6 strips. Right: the loupe at rest, the grease pencil, the eraser. On a negative, a hovered frame shows its number (`R6 F6`) in tiny edge-print type.
- **Darkroom:** a 3/4 orthographic bench.
  - **Left third:** the film shelf (bag, tank, jug, wall chart, sink).
  - **Middle third:** the enlarger column, with the easel at its foot and the filter drawer, timer and foot-switch beside it.
  - **Right third:** the three trays (DEV, STOP, FIX) in a row toward the viewer, with the drying-line glyph above.
  - The safelight hangs top centre; the pull chain hangs from it.
  - Pan with a background drag or `A`/`D` if the viewport is narrow.
- **Drying Line:** a long line across the upper half with prints pegged on it. Below: the envelope (6 slots) on a desk at left, a trash bin at right, and the technique cards pinned on a corkboard.
- **Phone portrait (390 × 844):** every station becomes a vertical stack panned with one-finger drag on empty space.
  - **Terminal:** CRT on top (full width, 60% height); the tape is a collapsible strip beneath it.
  - **Darkroom:** three bench "panes" stacked vertically (film, enlarger, trays), with snap scrolling and the rail always visible.
  - The enlarger's easel is at least 300 CSS px wide so dodging with a finger is practical. The dodge shadow is centred **40 px above the touch point** so the finger doesn't cover it.

### 7.3 Procedural audio (WebAudio, no samples)
One `AudioContext`, unlocked on the first pointer or key event. Master → compressor → destination. Everything below is a small synth function in `audio/synth.ts`.

| Event | Synthesis |
|---|---|
| Key click | 4 ms noise burst → BPF 3.2 kHz (Q 2) + 140 Hz sine thunk, 30 ms decay, ±8% pitch |
| Search (disk seek) | 3–7 impulses through a 1.8 kHz resonator, 8–20 ms apart |
| Tape advance | 1.2 kHz buzz, 40 ms per line, then a short falling sweep |
| Chain clink / clunk | 3 inharmonic partials (2.1, 3.4, 5.6 kHz) 80 ms; clunk = 90 Hz sine + noise thump, 120 ms |
| Changing bag zip / tick / kink | Noise BPF centre tracking stroke speed (600 Hz–2 kHz); tick = 1 ms click; kink = 3 crackles (noise bursts 8 ms) |
| Tank glug / rap / lid | 3–6 sine pops 120–260 Hz; rap = 300 Hz thud + 2.8 kHz ring (τ 0.3 s); lid = filtered clunk |
| Timer tick / bell | Escapement 1 Hz; bell partials 1820 and 4470 Hz, 1.5 s decay |
| Enlarger lamp | 60 Hz + 120/180 Hz at −30 dB, fan noise LPF 400 Hz; relay clack on/off |
| Tray slosh / lap / tok | §5.7; tok = 900 Hz sine + 2.5 kHz partial, 60 ms |
| Drip plip | sine 900 → 500 Hz over 60 ms, ±15% |
| Fog hiss | white noise, LPF sweeping 6 kHz → 300 Hz over 0.6 s |
| LEGIBLE stamp | 70 Hz thump + paper slap (noise HPF 1 kHz, 20 ms) |
| Rising cluster | 4 sines at 60·{3, 4, 5, 7} Hz, slow attack proportional to ρ/rho_d; cut at the timer bell |
| Room | 40 Hz HVAC; cold-store compressor every ~240 s (relay + hum ramp 3 s); rain = pink noise HPF 2 kHz with sparse drop transients |
| Phone ring | two sines 440/480 Hz, 2 s on / 4 s off; voice = no voice, just text with a squelch tail |
| Fax | carrier whistle 1.1/2.1 kHz sweep, then stepped motor buzz |

No music. Mix target: everything quiet, transients −12 dBFS, room tone −36 dBFS.

---

## 8. Save states and persistence

- **Autosave** to slot 0 on every station change, roll developed, print hung and document opened (debounced 2 s).
- **Three manual slots** in the ≡ menu, presented as **cassette stickers** with the clock time and a thumbnail of the most recent print. Click to load; long-press or `Shift`-click to overwrite.
- **localStorage** key `latent.v1.slot{0..3}` holds JSON:
```ts
interface SaveV1 {
  v: 1; seed: number; clock: number /* game minutes since 21:00 */;
  flags: Record<StageId, boolean>; tape: TapeLine[]; docsRead: string[];
  rolls: Record<RollId, { developed: boolean; dev?: DevResult; kinks: Crescent[] }>;
  prints: PrintRecord[]; line: string[] /* print ids in order */; envelope: string[];
  spills: Spill[]; pencil: Record<string /* surface id */, Stroke[]>;
  settings: Settings; stats: { searches: number; sheets: number; calls: number };
  ending?: { disposition: 'FILE' | 'PURGE'; kept?: string; at: number };
}
```
- **IndexedDB** database `latent`, store `prints`: key = print id, value = the print's final density grid quantised to `Uint8Array(320*256)` (80 KB). Negatives are **not** stored: they are regenerated from the frame recipe + `DevResult`.
- Every read/write is wrapped in try/catch. With storage unavailable the game runs and shows a small "not saving" glyph on the rail.
- **Versioning:** `v` mismatch → offer "start fresh" (the old save is left untouched).
- **New game** in the menu clears slot 0 only.

---

## 9. Onboarding (no tutorial text boxes)

| Time | What happens | What it teaches |
|---|---|---|
| 0:00 | Black. `PULL` beside a bead chain. | You touch things here. |
| 0:05 | Pull: *clunk*, red dither floods in, the safelight swings. The enlarger has a sheet in the easel already, with the cursive card **"Start here…"** taped to the column. The DEV tray pulses once (a slosh). | Where to look. |
| 0:15 | Drag the sheet to DEV. If the player hasn't done it within 10 s, the sheet's corner lifts slightly (a peg-twitch). Rocking is taught by the wall card *wait for it* and by the slosh sound responding to the first nudge. | Rocking, waiting. |
| 0:40 | The slate blooms: `R.K. / 16.2.79 / ODGERS NEGS`. Drag it to STOP, then FIX (each tray's lip glows 1 frame in the dither when a print is held over it), then to the line. | The tray sequence. |
| 1:00 | The rail's terminal glyph blinks. The terminal boots with `HOLD` typed. Enter: six matches, five shown. The work order explains the job in one line. | Search, the 5 cap. |
| 1:30 | The player types something from the slate: `ODGERS`, `16.2.79` (returns nothing), `R.K.` (many). | Words come from images. |
| 3:00 | The light-table glyph blinks once: the carton, eleven cassettes, a sleeve already developed. A cassette dragged to the tank glyph goes to the darkroom shelf; the bag pulses. | Rolls and development. |
| 4:00 | Bag → black. The reel ticks left, right. The wall chart is readable after the lights come back. | Rhythm, the chart. |
| 6:00 | Strips on the light table, inverted. The loupe. A frame dragged to the carrier. The red filter in, focus, then the **test strip** chip blinks once. | Printing. |
| 10:00+ | Technique cards are pinned where they matter. A detail's pattern is its own tutorial: a black doorway is begging for the *wiggle* card. | Everything else, by need. |

The desk phone (Sgt Atwell) is visible from minute 0. On the first open, the phone rings once by itself at 2:30 if the player hasn't searched yet: *"Desk here. Kessane's not coming in; said you'd manage. Terminal's on the left. Ring if you're stuck."*

---

## 10. Scope tiers

### MUST (MVP, shippable after one build round)
- **Shell:**
  - Four stations and the rail.
  - Dither pass with every palette.
  - Unified pointer, keyboard and touch input, including pinch and two-finger rotate.
  - Audio core with the sounds marked in §7.3 for: key click, seek, clunk, zip/tick/kink, glug, rap, timer, lamp hum, slosh, tok, fog hiss, stamp, room tone.
  - Autosave plus load of slot 0.
- **Terminal:** full search over all 43 documents, the 5-result cap, the tape, document view, `CLOSE 03-0417`, and FILE/PURGE.
- **Frames:**
  - All 11 rolls exist.
  - All load-bearing compositions are built: Roll 5 F3, F4, F10–12; Roll 8 F2–F5; and everything marked MUST in §6.1.
  - Remaining frames may be bracket or parameter variants.
- **Film:** changing-bag rhythm with kinks, time dial, pour, inversions, rap, pour-out, the film model, and Roll 7 pre-developed with its 14 crescents.
- **Light Table:** carton, cassette labels (with the DX code on Roll 11), strips, loupe, and sending a frame to the carrier.
- **Enlarger:** magnification, crop, focus, grain focuser, flip, grades 0–5, timer, expose (tap and hold), test strip, dodge wand and burn card with physical penumbra.
- **Trays:** fluid with tilt and resonance, wet coverage, development with induction, stop, fix, white-light fog, and drag between trays.
- **Drying Line:** hang, reorder, turn over, and the envelope.
- **Legibility and the LEGIBLE stamp.** All endings with clippings, fax text and the last line.
- **Toys and settings:** pull chain and safelight pendulum. Desk phone hints (text). The steady-hands and lights-in-the-bag settings.
- **Fallbacks:** records-only mode when WebGL2 is missing.
- **Testing:** the `window.__game` API, `solve()`, and the smoke steps file.

### SHOULD
- Grease pencil (light table and line).
- The hand dodge tool.
- Contact-sheet printing (one sheet per roll at M = 1.2).
- The remaining Roll 5 frames and Roll 8 F7 (mirror).
- CRT barrel and phosphor persistence.
- Print drips and wet-sheet sag when lifted with tongs (11 × 9 PBD cloth, 4 iterations).
- Spills with permanent puddle decals.
- Manual save slots as cassette stickers.
- Phone tilt for the trays.
- Share-card PNG with the spoiler toggle.
- Reduced-motion, high-contrast and screen-reader mirror settings.
- The rising sine cluster.
- **Open Lab:** import a PNG with `<input type=file>` or drag-drop; it becomes the luminance map of a new roll `03-YOU` and can be developed (EV slider) and printed with every tool. This is Andrew's "import a PNG" in this game's terms.
- The 400 ms white-light blowout. Developer exhaustion.

### STRETCH
- The **pneumatic tube + label-maker** skin over the terminal (toy concept §2.2): embossing replaces typing, and a canister of five items replaces the result list.
- The furnace hinge for PURGE.
- Temperature bath, clip test, hypo clear.
- f-stop timing mode. Paper stocks (RC neutral, selenium).
- The coin test.
- **Night Desk** daily: one date-seeded frame built from the kit, one question, three sheets.

---

## 11. Tech plan

### 11.1 Files (`games/latent/`)
```
index.html                 canvas#gl, div#overlay (menu, hidden <input id=type>, aria-live #sr), noscript text
main.ts                    feature detect → boot() or recordsOnly(); creates App
style.css                  overlay + records-only styles (palette CSS variables)
core/
  types.ts                 all shared interfaces (below) — owned by WP-A, frozen at T+0:15
  bus.ts                   typed event bus
  state.ts                 SaveV1 store, getters, mutations, stage flags
  save.ts                  localStorage + IndexedDB, autosave debounce
  input.ts                 pointer/touch/keyboard → GamePointer, gestures (pinch, rotate, 2-finger swipe), circular-drag helper
  widgets.ts               Dial, Knob, DragHandle, Spring — reused by all stations
  clock.ts                 game clock
  rng.ts                   mulberry32, hash noise, value noise
  app.ts                   loop, station manager, resize, visibility pause
render/
  renderer.ts              THREE.WebGLRenderer setup, lumRT, inkRT, offscreen frame RT
  dither.ts                dither pass (Bayer + IGN), palettes, halftone mode (ending)
  crt.ts                   barrel + scanlines + persistence (SHOULD)
  ink.ts                   red overlay layer, grease-pencil stroke renderer
  fonts.ts                 termFont, blockFont, strokeFont ('caps' | 'cursive'), drawText helpers
audio/
  audio.ts                 context, unlock, buses (room, fx, ui), master compressor
  synth.ts                 every sound in §7.3 as a function
search/
  index.ts                 tokenizer, inverted index, query (§5.9)
data/
  docs.ts                  43 documents (story bible §6)
  text.ts                  all UI strings, cards, hints, endings (story bible §7)
  facts.ts                 FactId list, fact groups, ending rules (§5.10)
  rolls.ts                 RollMeta ×11, FrameRecipe ×156 with DetailSpec + solution recipes
frames/
  kit.ts                   figures, car, props
  textures.ts              brick, concrete, wood, paper, decals
  templates/*.ts           slate, shopfront, yard, step, interior, closeup, alley, party, plant, dock, street, diner, bus, copystand, flat, window
  frameRenderer.ts         recipe → FrameImage (L map, mips, insets, deltas)
  frameStore.ts            async queue, LRU cache, placeholder images
film/
  filmModel.ts             §5.3 equations (pure functions)
  negative.ts              createNegative(frame, dev, roll) → Negative
  changingBag.ts           §5.4 rhythm model + bag view
  tank.ts                  dial, pour, inversion, rap, pour-out → DevResult
stations/
  terminal.ts              CRT scene, result list, doc view, tape
  lightTable.ts            carton, strips, loupe, scrub, send to carrier
  filmShelf.ts             darkroom left third (bag + tank), mounted by darkroom.ts
  darkroom.ts              bench scene, safelight, chain mount, enlarger + trays mounts
  line.ts                  drying line, envelope, turn-over, inspect view
  chain.ts                 pull chain + pendulum
  phone.ts                 hints
  ending.ts                clippings, fax, kept print, share card
print/
  enlarger.ts              EnlargerState, mapping, T_proj, focus blur
  exposure.ts              dodge/burn shadow S, exposure integral, test strip
  paper.ts                 PaperSheet: E, D, tInd, tDev, F, fog; display mapping
  fluid.ts                 virtual-pipe grid (§5.7)
  trays.ts                 tray bodies, tilt spring, tongs, sheet drift, render mesh
  legibility.ts            §5.8 metric
debug/
  testApi.ts               window.__game
test/
  smoke.steps.json         steps for scripts/shoot.mjs
```

### 11.2 Shared-module proposals
None of these block the build. `latent` ships local copies with exactly these interfaces, and an integration lead promotes them after the other games land.
- **`src/shared/onebit/`**, used by `plates` (1-bit) and possibly the hub: `createDitherPass(renderer, {ink, paper, cell}) → {render(srcTex), setPalette()}`. Both games need the same Bayer+IGN threshold and palette tokens; one implementation keeps the collection visually coherent.
- **`src/shared/fluid/`**, used by `darkroom`, `plates` and `latent`: `createPipeFluid({nx, ny, cell, depth, lip}) → {step(dt, tiltX, tiltY), h, ux, uy, kinetic(), depthAt(x, y), velAt(x, y), impulse(x, y, dh)}`. Three games slosh trays.
- **`src/shared/audio/`**: `getAudio()` (unlock on first gesture, master compressor) and small voices (`click`, `noiseBurst`, `thud`, `bell`). Every game needs an unlock-safe WebAudio context.

### 11.3 Key interfaces (`core/types.ts`)
```ts
export type StationId = 'terminal' | 'lighttable' | 'darkroom' | 'line';
export type Pattern = 'BURIED' | 'BLOWN' | 'SMALL' | 'MIRRORED' | 'GHOST' | 'PUSHED' | 'OFFFRAME';
export type FactId = 'HEEL_TANNERY' | 'CAN_TANNERY' | 'HORIZON_RUTH' | 'HEEL_PARTY' | 'RUTH_TALL'
  | 'MINA_FACE' | 'HEIGHT_MARKS' | 'WATCH_M' | 'KDL_TANNERY' | 'CANS_TANNERY' | 'KDL_NEG'
  | 'STAIRWELL_FIRE' | 'HEEL_PLANT' | 'KDL_PLANT' | 'ENVELOPE_LANTERN' | 'HALE_FACE' | 'KDL_LANTERN'
  | 'HORIZON_MINA' | 'GD_BRIEFCASE' | 'CLAIM_PAID' | 'HALE_SAW' | 'HEIGHT_MARKS_2' | 'CURSIVE_LABEL' | 'MINA_1987';
export interface FrameRef { roll: number; frame: number }              // roll 1..11, frame 1..36
export type BBox = [x: number, y: number, w: number, h: number];          // frame coords, 0..1, positive orientation
export interface PrintOps { M: number; cx: number; cy: number; focus?: number /* default φ* */; flip: boolean;
  grade: 0|1|2|3|4|5; seconds: number;
  dodge?: { x: number; y: number; r: number; z: number; frac: number }[];   // paper mm, frac of exposure time held
  burn?:  { x: number; y: number; r: number; z: number; extraSeconds: number }[];
  devSeconds: number }
export interface DetailSpec { id: FactId; bbox: BBox; rho: number; mMin: number; pattern: Pattern[];
  hide: string[]; inset?: boolean; solution: PrintOps & { devR?: number } }
export interface FrameRecipe { roll: number; frame: number; template: string; ev: number; seed: number;
  cam: { pos: [number, number, number]; look: [number, number, number]; roll: number; fovV: number };
  params: Record<string, unknown>; details: DetailSpec[]; marks?: Crescent[] }
export interface RollMeta { id: number; property: string; label: string; hand: 'caps' | 'cursive' | 'none';
  frames: number; nominalEV: number; preDeveloped?: DevResult; dx?: boolean; ageFog: number }
export interface FrameImage { ref: FrameRef; w: 768; h: 512; lum: Uint8Array; mips: Float32Array[] /* 4 levels, decoded L */;
  insets: { bbox: BBox; w: number; h: number; L: Float32Array }[];
  deltas: Partial<Record<FactId, { w: number; h: number; d: Float32Array }>> }
export interface Crescent { frame: number; x: number; y: number; rot: number }
export interface Spot { frame: number; x: number; y: number; r: number }
export interface DevResult { tDev: number; inversionsPerMin: number; rapped: boolean; r: number; agit: number;
  bubbles: Spot[]; kinks: Crescent[] }
export interface Negative { ref: FrameRef; widthMm: 36; heightMm: 24;
  density(xMm: number, yMm: number, footprintMm: number): number }  // Dneg incl. grain & marks
export interface EnlargerState { ref: FrameRef | null; M: number; cx: number; cy: number; focus: number; flip: boolean;
  grade: 0|1|2|3|4|5; timer: number; redFilter: boolean; lampOn: boolean; tool: 'wand' | 'hand' | 'card'; toolZ: number }
export interface PrintRecord { id: string; ref: FrameRef; ops: PrintOps; legible: { fact: FactId; rho: number }[];
  fixed: boolean; fogged: boolean; at: number }
export interface GamePointer { id: number; x: number; y: number; type: 'down' | 'move' | 'up' | 'cancel';
  button: number; pointerType: 'mouse' | 'touch' | 'pen'; pressure: number; t: number }
export interface Station { id: StationId; scene: THREE.Scene; camera: THREE.OrthographicCamera; palette: PaletteId;
  enter(): void; exit(): void; update(dt: number): void;
  pointer(p: GamePointer): boolean; gesture(g: Gesture): boolean; key(e: KeyboardEvent): boolean; resize(w: number, h: number): void }
// Bus events
export interface Events { 'station': StationId; 'lights': boolean; 'search': { q: string; count: number };
  'doc:open': string; 'roll:developed': { roll: number; dev: DevResult }; 'carrier:load': FrameRef;
  'print:exposed': string; 'print:fixed': PrintRecord; 'print:legible': { id: string; fact: FactId };
  'print:hung': string; 'ending': { disposition: 'FILE' | 'PURGE' } }
```
Module APIs:
- `frameStore.get(ref): Promise<FrameImage>` (WP-B)
- `createNegative(img, dev, roll): Negative` (WP-C)
- `developRoll(roll, dev): void` (WP-C, writes state and emits `roll:developed`)
- `simulatePrint(neg, ops): Float32Array /* D grid */` (WP-D, the headless path used by `__game.print` and `solve()`)
- `evaluateLegibility(img, ops, D): {fact, rho, pass}[]` (WP-D)

### 11.4 Render pipeline (per frame)
1. `app.update(dt)`: input → active station → sims (fluid if active, paper if exposed or in a tray, chain, pendulum).
2. **FrameStore job:** at most one diorama render per frame (≈ 10–30 ms desktop), queued while a roll is in the tank so frames are ready when the strips come out.
3. The active station renders its scene to **`lumRT`** (RGBA8, `ceil(vw/cell) × ceil(vh/cell)`). Station materials are greyscale; prints and negatives are `DataTexture`s (R8, nearest) updated only when dirty.
4. Terminal only: `crt.ts` pass on `lumRT`.
5. **Dither pass** to the canvas: `out = lum > threshold ? paper : ink`, with nearest upscale, so cells stay crisp.
6. **Ink pass:** alpha-blend `inkRT` (full resolution, red strokes, selection marks) on top.
7. The DOM overlay sits above the canvas (menu, hidden input, aria-live).

Canvas DPR is fixed at 1 and the CSS `image-rendering: pixelated` keeps the dither crisp on high-DPI phones.

### 11.5 Performance budget (60 fps desktop, ≥ 45 fps mid-range phone)
| Item | Budget |
|---|---|
| Station scene draw | ≤ 150 draw calls, ≤ 4 ms GPU; one 1024² shadow map, darkroom only |
| Dither + ink | ≤ 1 ms |
| Fluid | 3 × 768 cells × 2 substeps ≤ 0.2 ms; trays sleep when kinetic energy < 1e-7 J and no sheet is wet |
| Paper sim | 320 × 256 cells: exposure ≤ 0.6 ms, development ≤ 0.8 ms; only the active sheet(s), max 3 |
| T_proj recompute | ≤ 8 ms on change; while dragging, at half resolution and ≤ 15 Hz |
| Legibility | ≤ 2 ms per detail (48 × n samples); during development, every 0.5 s for one detail |
| Frame generation | ≤ 30 ms desktop / ≤ 80 ms phone per frame; one per tick |
| Memory | FrameImage ≈ 0.4 MB (lum) + 1.1 MB (mips) + insets; LRU 24 frames ≈ 40 MB; JS heap < 150 MB |
| Bundle | Three.js (tree-shaken) + game ≤ 1.1 MB min, ≤ 350 KB gz |

### 11.6 Mobile plan
- `touch-action: none` on the canvas.
- `input.ts` recognises one-finger drag, pinch, two-finger rotate, two-finger swipe and long-press (350 ms).
- Typing goes through a hidden `<input>` with `autocapitalize=characters`, `enterkeyhint=search`.
- Portrait stacking per §7.2. Touch targets are ≥ 44 CSS px. The dodge shadow is offset 40 px above the touch point.
- `navigator.vibrate` on kinks, the stamp and the chain clunk (Android).
- Audio unlocks on the first touch, and the pull chain *is* the first touch.
- `visibilitychange` pauses sims and audio.
- Phone tilt for the trays is opt-in only (it calls the iOS `DeviceOrientationEvent.requestPermission()` flow from a tap).
- **Low-power mode** (auto when the first 120 frames average > 22 ms): fluid at 1 substep, paper grid 240 × 192, shadow map off (safelight swing becomes a moving gradient decal).

### 11.7 Degradation
- **No WebGL2:** records-only mode. A DOM amber terminal with the same search, documents and tape, plus a one-line notice: *"The darkroom needs WebGL2. The records are all here."*
- **No float render target:** log-encode in-material (§5.2).
- **No storage:** the game runs with a "not saving" glyph.
- **SwiftShader/headless:** `__game.setSetting('screenshotMode', true)` freezes the pendulum, rain and noise time, and uses frame resolution 512 × 341.

---

## 12. Build split (four work packages, disjoint file ownership)

| WP | Owner | Files (exclusive) | Delivers |
|---|---|---|---|
| **A: Shell, Terminal, Story** | Agent A | `index.html`, `main.ts`, `style.css`, `core/*`, `render/*`, `audio/*`, `search/*`, `data/docs.ts`, `data/text.ts`, `data/facts.ts`, `stations/terminal.ts`, `stations/phone.ts`, `stations/ending.ts`, `debug/testApi.ts`, `test/*` | App loop, station manager, input, dither, fonts, audio, save, the full terminal, hints, endings, `__game` aggregation |
| **B: Frames** | Agent B | `frames/*`, `data/rolls.ts` | Frame kit, 16 templates, every MUST composition, insets, Δ maps, `solution` recipes |
| **C: Film and Light Table** | Agent C | `film/*`, `stations/lightTable.ts`, `stations/filmShelf.ts` | Film model, negative sampler, changing bag, tank, light table and loupe |
| **D: Print, Darkroom, Line** | Agent D | `print/*`, `stations/darkroom.ts`, `stations/line.ts`, `stations/chain.ts` | Enlarger, exposure, dodge/burn, paper, fluid, trays, legibility, darkroom bench, drying line, chain and pendulum |

**Contracts and timeline**
- **T+0:15, A:** commits `core/types.ts` (§11.3, verbatim), `core/bus.ts`, `core/state.ts`, `core/input.ts` (stub OK) and `app.ts` with four empty stations, so all four packages compile from the start. **`types.ts` is frozen after this point**; any change needs a one-line note in the PR and an update to every user.
- **T+0:20, A:** `render/fonts.ts` (`strokeFont`, `blockFont`) is ready for B's signs and handwriting. Until then B uses `ctx.fillText` placeholders.
- **T+0:20, B:** `frameStore.get()` returns **placeholder FrameImages** (a gradient plus the frame number and a fake detail) for every ref, so C and D are never blocked on art. Real dioramas replace placeholders template by template. Critical-path order: alley → copystand → dock → flat → party → step → bus → window → the rest.
- **T+0:30, C:** `createNegative()` and `filmModel` are callable, plus a `PRESET_DEV` for Roll 7 and a "quick develop" function used by tests. D codes against the `Negative` interface from minute 0 with a stub that returns `0.3 + 1.2·(1 − L)`.
- **D** exposes `simulatePrint(neg, ops)` and `evaluateLegibility()` as pure functions; A's `__game.print()` and `solve()` call them.
- **Mounting:** `stations/darkroom.ts` (D) mounts `filmShelf` (C) as a `THREE.Group` with its own `update`/`pointer` handlers via `interface Mount { group; update(dt); pointer(p): boolean; key(e): boolean }`.
- **Shared widgets** (`core/widgets.ts`, A): `Dial`, `Knob`, `DragHandle` and `Spring` exist from T+0:30. C and D use them rather than writing their own.

**Integration step (A leads, about 30–45 min after the packages land)**
1. Wire the stations to the rail; run the full onboarding by hand on desktop and in the mobile emulator.
2. Run `__game.solve()`. Every detail's `solution` recipe must pass, and the **naive recipe** (M = 4 centred, grade 2, 8 s, no dodge/burn, 60 s development) must *fail* for every detail tagged BURIED, BLOWN, SMALL (with mMin > 4), MIRRORED or PUSHED. Tune the luminances in B's recipes first and the `rho` thresholds second.
3. Run the smoke script on desktop and mobile; fix console errors.
4. A lint script (`test/lint.ts`, run in the browser via `__game.lint()`) checks:
   - every document id is unique;
   - every word in the §6.3 vocabulary map returns the documented count;
   - every story-bible §8 deduction has two routes whose details all pass `solve()`;
   - no crescent overlaps a bbox.
5. Performance pass on a throttled-CPU (4×) profile.

**With three agents:** C's film files go to B, and `stations/lightTable.ts` goes to A. **With two:** A + C (shell, terminal, film, light table) and B + D (frames, print, darkroom, line).

---

## 13. `window.__game` test API and smoke test

```ts
window.__game = {
  version: 'latent-1',
  ready: Promise<void>,                                   // resolves after boot + first render
  state(): { station: StationId; clock: string; lights: boolean; stage: string; flags: Record<string, boolean>;
             rollsDeveloped: number[]; prints: number; legible: FactId[]; tape: number; fps: number; lowPower: boolean },
  layout(): Record<string, [x: number, y: number]>,       // CSS-px centres of key controls in the current station
  goto(s: StationId): void,
  lights(on: boolean): void,
  search(q: string): { count: number; shown: string[] },
  openDoc(id: string): void,
  developRoll(roll: number, o?: { minutes?: number; inversionsPerMin?: number; rap?: boolean; kinks?: number }): DevResult,
  frameReady(roll: number, frame: number): Promise<void>,
  load(roll: number, frame: number): void,                // into the carrier
  setEnlarger(p: Partial<EnlargerState>): void,
  expose(o: { seconds: number; dodge?: PrintOps['dodge']; burn?: PrintOps['burn'] }): void,   // integrates instantly
  develop(seconds: number, o?: { rock?: boolean }): void, // fast-forwards the tray sim deterministically
  stop(): void, fix(): void, hang(): string,
  print(roll: number, frame: number, ops?: PrintOps | 'solution' | 'naive'): Promise<{ id: string; legible: FactId[]; rho: Record<string, number> }>,
  envelope(ids: string[]): void,
  close(d: 'FILE' | 'PURGE', keep?: string): { clippings: string[]; fax: string; last: string },
  solve(): Promise<{ detail: FactId; frame: string; solution: number; naive: number; pass: boolean }[]>,
  lint(): string[],                                        // empty = OK
  seed(n: number): void, skipTo(stage: string): void,
  setSetting(k: string, v: unknown): void,                 // 'screenshotMode', 'steadyHands', 'reducedMotion', ...
}
```

**Smoke test** (`games/latent/test/smoke.steps.json`, run with `node scripts/shoot.mjs /games/latent/ --steps games/latent/test/smoke.steps.json --wait 3000`):
1. `{"eval":"__game.ready.then(()=>__game.setSetting('screenshotMode',true))"}` then `{"shot":"shots/latent-0-pull.png"}`. **Expect:** a near-black frame, the word `PULL` and a bead chain at top centre. No console errors.
2. `{"eval":"__game.lights(true)"}`, wait 600, shot `latent-1-darkroom.png`. **Expect:** red/black dither bench; enlarger centre with a white sheet in the easel; three trays at right; the cursive card on the column.
3. `{"eval":"__game.develop(60,{rock:true});__game.stop();__game.fix();__game.hang()"}`, `{"eval":"__game.goto('line')"}`, shot `latent-2-line.png`. **Expect:** paper-white palette; one print on the line showing a chalk slate with three legible lines.
4. `{"eval":"__game.goto('terminal');__game.search('HOLD')"}`, shot `latent-3-terminal.png`. **Expect:** amber CRT, `6 MATCHES — SHOWING 5 (OLDEST FIRST)`, five rows, the tape at right with one line. Eval result `count == 6`.
5. `{"eval":"__game.developRoll(6,{minutes:8});__game.frameReady(6,6)"}` then `{"eval":"__game.print(6,6,'solution')"}`. **Expect** in the eval output: `legible` includes `KDL_TANNERY`. Then `{"eval":"__game.goto('line')"}`, shot `latent-4-plate.png`: a print showing a car's plate reading `KDL 417`.
6. `{"eval":"__game.print(6,6,'naive')"}`. **Expect:** `legible` is empty.
7. `{"eval":"__game.goto('lighttable')"}`, shot `latent-5-lighttable.png`. **Expect:** cold-white table, the carton with 11 cassettes, Roll 6 strips in negative.
8. `{"eval":"__game.solve()"}`. **Expect:** every row `pass: true`.
9. `{"eval":"__game.lint()"}`. **Expect:** `[]`.
10. `{"eval":"__game.state()"}`. **Expect:** `fps > 8` under SwiftShader, `prints >= 3`.

**Mobile run:** `--mobile`, steps 1–4. **Expect:** portrait stacks, the rail visible at the bottom, terminal text at least 14 CSS px tall, no horizontal overflow.

---

## 14. Risks and fallbacks

| Risk | Likelihood | Mitigation / fallback |
|---|---|---|
| **Diorama volume** (≈ 60 compositions) is the biggest cost | High | Parametric templates; a critical-path order (§12); brackets and variants are free. Any composition not built ships as a **light-struck frame** (fogged edge, faint shapes). That is believable on 24-year-old film, and a placeholder never breaks a deduction because every deduction has two routes. |
| Legibility metric mis-tuned (too easy or impossible) | Medium | `solve()` with solution and naive recipes in CI; per-detail `rho` overrides; designers tune luminance first. Last resort: a rule-based fallback per detail (M ≥ mMin ∧ local RMS contrast ≥ 0.12 ∧ flip). |
| 1-bit text unreadable on small phones | Medium | The minimum cell is 2 CSS px; double-tapping a print opens a full-screen inspect view with the loupe; documents use `termFont` at ≥ 14 CSS px; the high-contrast setting. |
| Players stuck or overwhelmed by four stations | Medium | Atwell's three-tier hints by stage; the tutorial print and the `HOLD` search in the first minute; two routes everywhere; the vocabulary map; the steady-hands setting. |
| SwiftShader too slow for frame generation | Medium | `screenshotMode` lowers frame resolution; frames render lazily, one per tick; tests await `frameReady`. |
| Float render targets unavailable | Low | In-material log encoding (§5.2). |
| Touch dodging hides the print under the finger | Medium | Shadow offset 40 px; pinch for height; steady hands. |
| WebAudio autoplay blocked | Low | The first interaction (the pull chain) unlocks audio; until then everything is silent, not broken. |
| Storage blocked (private mode) | Low | In-memory state, the "not saving" glyph, no crash. |
| Tone: death, police corruption and a queer love story | — | Handled with restraint. No body is ever shown. The relationship is shown, never labelled or used for shock. Mina survives and has the last word. Choosing PURGE is never punished. |
| Overlap with `plates` (also 1-bit darkroom) | Medium | Different eras (1979/2003 vs Victorian), palettes (amber/red/white vs a single ink), core verb (search vs naming), and different props and sound. The shared dither module is a strength, not a sameness. |
| Scope creep from the toy concept (tube, label maker, furnace) | High | These are explicitly STRETCH. The MUST list is the contract for round one. |
| Story mistakes found late (a route that doesn't work) | Medium | `lint()` walks the §8 matrix against `solve()`; the story bible is the single source; text is transcribed, never paraphrased. |
