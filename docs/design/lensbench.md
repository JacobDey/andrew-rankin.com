# LENS BENCH — Game Design Document

Game 5 · slug `lensbench` · URL `/games/lensbench/` · status: **FINAL for build round 1** · 2026-10-09
Sources: `concepts/lensbench-toy.md` (T), `lensbench-game.md` (G), `lensbench-craft.md` (C). Where this doc and a concept disagree, this doc wins.

### Decisions that settle the concept conflicts

1. **Where we are.** The game takes place *upstairs at Quist Camera Repair & Custom Optics on Lantern Street* (from C). Darkroom's basement is downstairs and its keyholder O. was Q.'s neighbour. The scene is **one street block**, not a backyard (Studio owns the backyard) and not a lighthouse (Plates owns that).
2. **What kind of game.** It is a toy first, with a thin goal layer on top. The bench is free from second one. Goals are **repair tags** (C) graded by **analytic measurement** (G). We keep the **Read It** verb and the **Blur Budget** (G) and cut the economy, the budgets and the 15-commission campaign. "Q.'s spare key" unlocks every drawer at any time.
3. **What the bench looks like.** It is a 2D-canvas **fog tank**: glowing rays in haze (T), drawn in the three **Fraunhofer colours** C/d/F (C). You work with your hands first and the numbers follow: you drag glass, and real units update live.
4. **The world is a pure function of time.** Every moving thing exposes `pose(t)`. We use **no Rapier**. That lets a photo be re-evaluated at any sub-millisecond instant, keeps it deterministic, and saves 1.5 MB of wasm.
5. **Photos are rendered late.** Pressing the shutter stores a `ShotRecord` immediately, with no hitch. The expensive render runs in idle time and finishes during the Tank (G). Undeveloped film really is unrendered film.
6. **The photo pipeline** combines four techniques:
   - time-subframe accumulation (C), which handles motion, shake, panning and every shutter type;
   - a pupil-shaped gather for depth of field (T);
   - **energy-conserving analytic bokeh sprites** for point emitters (new; this is where the hero shots come from);
   - lens passes driven by `LensProfile` (T).
7. **Development is a ~30-second tank** (T) running a real time/temperature/agitation model. Colour film goes to the lab in an envelope (C).
8. **Moved to STRETCH:** body tipping, the changing bag, burning glass, curtain burn, the thoriated element, slit-scan, Scheimpflug tilt, the Daily Read, the radio.

---

## 1. Title, subtitle, pitch

**LENS BENCH**
*Build the camera the photo needs.*
Hub blurb: **"Grind glass, bend light, then go out and prove it."**

**Pitch.** Q. has retired and left you his upstairs workshop on Lantern Street: a walnut optical rail in a haze-filled glass tank, drawers of glass blanks, shutters, film, and a cork strip of unfinished repair tags from the neighbours.

You slide glass pucks onto the rail and squeeze their curves, and you watch red, yellow and blue rays bend through the haze to a focus that is visibly smeared by the physics you built. Focal length, f-number, mass, distortion, chromatic error and vignetting all *fall out of the glass*. Nobody types them in.

Then you carry the camera downstairs onto the street. The baker's cat, a fountain, a windmill on the roof, a courier who passes every forty seconds, and string lights at dusk are all waiting to be photographed. Each frame is computed from your lens, your shutter's real timing and your shaking hands. You don't see it until you invert the tank and lay the strip on the lightbox. Every flaw is yours, every accident is collectible, and the print always tells you why it came out the way it did.

---

## 2. Experience goals and hooks

**Goals**
- **Wonder at old truths.** The upside-down image on ground glass, a pinhole that sharpens and then blurs again, and a second piece of glass that cancels the rainbow fringe.
- **Agency through physics.** Every artifact in a photo has a cause you can poke on the bench.
- **Tactile pleasure.** Detents, ratchets, the gap between two curtain clacks, and glass that rings when you flick it.
- **Suspense, then a verdict.** Film hides the result until development. The Blur Budget turns a failure into a lesson in one glance.
- **Shareability.** Heart-shaped bokeh, banana-bent windmill blades, ghost walkers in the square, a lens link a friend can open on their own bench.

**10 seconds: poke a hole in the dark.** The first visit opens on a dim bench. A biscuit tin sits on the rail with a ground-glass back. A needle glows in a pincushion. Drag the needle into the tin and a faint, **upside-down, live** Lantern Street appears on the ground glass, with the fountain moving. Drag again and the hole widens: the image gets brighter, then blurrier. Shrink it and it sharpens, then goes soft again. A chime marks the optimum. Nobody has read a word.

**1 minute: break it beautifully.** A crown glass puck slides out of the tray. Drop it on the rail and it **snaps** in with a glassy *tock*: the image goes bright and sharp. Drag the puck along the rail and the focus point sweeps through the haze while the ground glass blurs and sharpens. Grab its rim and squeeze it fatter, and the rays bend harder. Flip to white light and a rainbow opens at the focus. (A flint puck closes that rainbow later, as a reward.) Pinch the iris and the cone in the haze narrows.

**10 minutes: build a weird camera and go hunting.** Assemble a 3-element portrait lens, cut a **heart** into a Waterhouse card, load Pan 400 into the rangefinder and walk out at dusk. Shoot the string lights (heart bokeh), the windmill with the cloth focal-plane shutter (bent blades), the fountain at 1/1000 and at 1/2 s, and the square on a tripod for 8 s (the walkers vanish). Rewind, develop, and sweep the loupe over the grain. Pin one frame to Biscuit's tag and get the grease-pencil tick.

---

## 3. Core loop and progression

```
BENCH (build/adjust, 30 s–5 min) → STREET (aim, focus, expose, advance; 1–4 min)
   ↑                                         ↓ rewind
LIGHTBOX (inspect, loupe, Blur Budget, deliver to tag) ← TANK (develop roll, 30 s)
```

- **The four places** are tabs, drawn as places rather than menus: Bench · Street · Tank · Lightbox. The camera you're carrying is one persistent object.
- **Film.** A roll has a fixed capacity (§6.4). Firing costs a frame, and so does advancing. You can rewind early. Several exposed rolls can queue for the Tank. Push and pull apply to the whole roll (G).
- **Progression is drawers.** Each repair tag you complete unlocks one parts drawer (§6.8). **Patents** (SHOULD) are granted when a design meets a hidden optical criterion: you reinvent the achromat, the telephoto and so on, and the patented lens goes into your card file under a name you choose. **The Circle of Confusion** (SHOULD) is Q.'s notebook of 12 happy accidents, each auto-detected from shot data. It is the toy-player's collection.
- **Sandbox.** The menu has *Q.'s spare key* from the first second. It unlocks everything and turns tags into optional reading. Tags still grade, and accidents still collect.
- **Session shapes.** A drive-by (3 min) gets the pinhole, the street, the tank, and ACCEPTED on Tag 01. A normal session (20 min) is 3–4 tags, one patent and two accidents. A completionist plays 13 tags, 5 patents and 12 accidents in roughly 2 hours.

---

## 4. Interactions and input mapping

Every drag uses a critically damped follower, `x += (target − x)·(1 − exp(−18·dt))`, so parts have weight. Hit targets are at least 44 px on touch. Pointer Events are used everywhere, with `touch-action: none` on the canvases.

### 4.1 Global

| Action | Mouse/keyboard | Touch |
|---|---|---|
| Go to place | click tab, or keys `1` `2` `3` `4` | tap tab |
| Menu (sound, haptics, quality, spare key, reset) | `Esc` | ☰ |
| Mute | `M` | menu |
| Help / Q.'s notes | `?` | ⓘ |

### 4.2 Bench

| Action | Mouse/keyboard | Touch | Feedback |
|---|---|---|---|
| Add an element/stop | drag a blank from the tray onto the rail | same | snaps to the rail with a *tock* |
| Remove | drag it off the rail into the tray, or select + `Del` | drag off | felt *thup* |
| Slide along the rail | drag the puck body | 1-finger drag | felt rub whose loudness tracks speed; clink on contact (elements can't overlap) |
| Fine slide (×0.1) | `Shift`+drag | 2-finger drag | 1 mm rail ticks |
| Bend the front/back surface | drag the left/right rim handle up or down | same | creak whose pitch rises with \|c\| |
| Change diameter | wheel over the puck | pinch on the puck | tick every 2 mm |
| Flip the element | double-click | double-tap | 180° spin |
| Change glass | right-click → glass swatches | long-press 400 ms | the puck re-tints |
| Coating (SHOULD) | the swatch menu | same | thin-film hue on the faces |
| Flick the glass (SHOULD) | click a face without dragging | tap a face | ping (§7.3) |
| Aperture | wheel over the iris, or `[` `]` | pinch the iris | half-stop detents, *shhk* |
| Blade count | `B` cycles 0/5/6/8/9 | iris menu | — |
| Draw a Waterhouse card | iris menu → "Cut card", draw a closed stroke on a 256² pad | finger draw | the stroke snaps closed and fills |
| Pinhole size | drag the needle into the plate; drag again to widen; or wheel | drag | needle click; chime at the optimum |
| Light mode | `L` toggles laser (d) and white (C/d/F) | toggle | — |
| Off-axis rays | `F` | toggle | — |
| Collimate ∞ | `C` | button | the group slides; a clunk |
| Zoom/pan the rail | wheel / drag on empty space; `Z` fits | pinch / drag empty | — |
| Undo / redo (SHOULD) | `Ctrl+Z` / `Ctrl+Shift+Z` | ↶ ↷ | — |
| Body / shutter / film / filter | selector chips on the spec column | bottom sheet | the drawer slides |
| Save design / share link | buttons | same | stamp *thunk* |

### 4.3 Street

| Action | Mouse/keyboard | Touch |
|---|---|---|
| Look | drag on the view (no pointer lock) | right-half drag |
| Walk | `WASD`/arrows | left-half virtual stick, or tap the ground to walk there |
| Jump to a standpoint | `Tab` cycles; click a chalk X or a chip | tap a chip |
| Focus | wheel, or `Q`/`E` (`Shift` = fine); drag the focus strip | drag the focus strip |
| Aperture | `[` `]`; aperture dial | dial drag |
| Shutter speed | `,` `.`; speed dial | dial drag |
| Half-press (meter + steady breath) | hold `Space` or hold the mouse on the release | touch-and-hold the release |
| Fire | release `Space`/the mouse | lift the finger |
| Bulb/Cap exposure | in B: press opens, release closes | same |
| Advance film | `F`, or drag the lever right→left | thumb swipe on the lever |
| Multiple exposure (fire without advancing) | `Alt` + fire | 2-finger tap on the release |
| Tripod | `T` (2 s set-up animation) | button |
| DOF preview (reflex/ground glass) | hold `V` | hold the ◐ button |
| Dark cloth (view/tin; SHOULD) | `C` | swipe down from the top |
| Time of day | drag the sun on the sky arc in the HUD | same |
| Rewind the roll | `R` (confirm) | ⟲ |

### 4.4 Tank and Lightbox

| Action | Mouse/keyboard | Touch |
|---|---|---|
| Pour / next step | click the jug, `Enter` | tap |
| Invert (agitate) | drag the tank up and down, or `Space`/`↑` | flick up/down |
| Temperature | drag the thermometer | same |
| Pour out (ends development; this is the push/pull choice) | click the drain | tap |
| Next/previous frame | `←` `→` | swipe |
| Negative ⇄ positive | `P` | toggle |
| Loupe | hold `L` + move, or drag the loupe disc | drag the loupe |
| Select a Blur Budget target | click a target pip on the print | tap |
| Deliver to tag / type a Read It answer | the tag panel | same |
| Export the print | `E` | share button |
| Slit replay (SHOULD) | ▶ on the print | same |

**Haptics:** `navigator.vibrate(8)` per detent, 20 ms on fire, `[30,40,30]` on ACCEPTED, all behind a setting.

---

## 5. Simulation models

**Units.** Rail coordinates are in millimetres along the optical axis. Light travels in +z and the **film plane sits at z = 0**, so elements have negative z. The world is in metres, and luminance is in cd/m² (rendered as kcd/m²). Exposure is in lux·s.

### 5.1 Glass and dispersion

| id | Name (6-digit code) | n_d | V_d | ρ g/cm³ | Tint |
|---|---|---|---|---|---|
| crown | Crown 517642 | 1.5168 | 64.2 | 2.51 | clear |
| lightFlint | Light Flint 581409 | 1.5814 | 40.9 | 3.22 | faint grey |
| flint | Flint 620364 | 1.6200 | 36.4 | 3.58 | faint yellow |
| denseFlint | Dense Flint 805254 | 1.8052 | 25.4 | 5.18 | yellow |
| lanthanumCrown | Lanthanum Crown 713538 | 1.7130 | 53.8 | 3.80 | faint brown |
| fluorite | Fluorite-type 434950 | 1.4339 | 95.0 | 3.18 | violet glint |

Dispersion uses a Cauchy fit through n_d and V_d, with λ in µm, `λ_C = 0.6563` (R), `λ_d = 0.5876` (G), `λ_F = 0.4861` (B):
`B = (n_d − 1) / (V_d · (λ_F⁻² − λ_C⁻²))`, `A = n_d − B/λ_d²`, `n(λ) = A + B/λ²`. Check: crown gives A = 1.50459, B = 0.004216.

### 5.2 Element geometry

- An element has a front vertex at `z`, curvatures `c1` and `c2` (1/mm; positive means the centre of curvature is at +z), a diameter `D`, glass and coating (0/1/2).
- Sag: `sag(c, r) = c·r² / (1 + √(1 − c²r²))`. The constraint `|c|·D/2 ≤ 0.95` stops a surface going past a near-hemisphere.
- **Auto thickness** (the player never sets it): `t = max(1.2, sag(c1, D/2) − sag(c2, D/2) + 0.8)` mm. Squeezing a positive lens makes it visibly fatter.
- **No overlap.** For neighbouring surfaces (back of element *i*, front of element *i+1*) at `r = min(D_i, D_{i+1})/2`, require `z_back + sag_back(r) + 0.1 ≤ z_front + sag_front(r)`. Equal curvatures at contact are allowed, which gives a **cemented** pair. A drag that would violate this clamps, and a clink plays.
- **Maximum 6 elements plus one stop.** The rail runs from z = −400 to z = 0, and the view-camera bellows extends it to −650.

### 5.3 Ray tracing (`trace.ts`)

**Exact 3D sequential trace** (Spencer–Murty form). For a ray `P + s·d` (with `|d| = 1`) at a surface whose vertex is at the local origin:
`F = c(P·P) − 2P_z`, `G = d_z − c(P·d)`, `s = F / (G + √(G² − cF))`.
- If `G² − cF < 0`, the ray misses and is blocked.
- At the hit point Q: if `Q_x² + Q_y² > (D/2)²`, the ray is vignetted.
- The normal is `N = normalize(−cQ_x, −cQ_y, 1 − cQ_z)`.
- Refraction, with `μ = n₁/n₂` and `cosI = d·N`: `k = 1 − μ²(1 − cosI²)`. If `k < 0`, the ray is totally internally reflected: it stops and is drawn as a red flash. Otherwise `d' = μd + (√k − μ·cosI)·N`.
- The stop is a plane at `stop.z`. A ray passes if it lies inside the circle/polygon, or inside the card mask sampled at `(x, y)/r_stop`.

**Paraxial y–nu trace**, per wavelength: `n'u' = nu − yφ` with `φ = c(n' − n)`, then transfer `y ← y + t·u'`.
- **EFL** = `−y₁/u'_last` for an input ray with `u₀ = 0` and `y₁ = 1`.
- **BFD** = `−y_last/u'_last`. The rear principal plane is at `z_P2 = z_last + BFD − EFL`.
- **FFD** comes from the reverse trace.
- **Entrance pupil (EP):** trace a paraxial ray backwards from the stop centre through the preceding surfaces. Its object-space axis crossing is `EP.z`, and the ratio of marginal heights gives the EP diameter. The exit pupil (XP) works the same way going forward.
- `N = EFL / D_EP`. For a card, `N_eff = EFL / √(4A_EP/π)`, where A_EP is the card's open area mapped to the EP. A heart card prints a real number on the spec plate (`f/3.7♥`).
- **T-stop:** `T = N/√τ` with `τ = Π(1 − R_s)` over the air–glass surfaces. R is 0.04 uncoated, 0.012 for single coating and 0.004 for multi-coating.
- **Petzval sum:** `P = Σ φ_k / (n_k·n'_k)` in 1/mm.

**Pinhole** (zero elements, `stop.kind = 'pinhole'`): `EFL = −stop.z`, `N = EFL/d`. The blur diameter on film, independent of depth, is
`b(d) = √(d² + (3.61·λ·EFL/d)²)` with λ = 0.00055 mm.
This minimum sits at `d* = 1.9·√(λ·EFL)` (Rayleigh's pinhole rule). For the tin (EFL 100 mm), that gives `d* = 0.446 mm`, which is f/224. The chime plays when `|d − d*|/d* < 8%`.

### 5.4 LensProfile: the single contract between glass and photo

Computed by `computeProfile(design, format)`:
- the **fast** pass (paraxial + fan) runs on every pointer move, in under 0.5 ms;
- the **full** pass runs 150 ms after the design settles, or on pointer-up, in under 5 ms.

What the full pass derives:

- **Vignetting `V[16]`.** For 16 field angles `θ_i = θ_max·i/15`, where `θ_max = atan(halfDiag/EFL)`, launch a 24×24 grid of parallel rays at θ_i over 1.6× the EP and centred on the paraxial chief-ray pupil point. `V_i` = rays surviving all apertures and the stop at θ_i ÷ rays surviving at θ = 0, clamped to [0, 1]. `cos⁴θ` is applied separately in the renderer.
- **Cat's eye `catsEye[16]`.** Solve for `d_i` such that the area of two unit circles offset by d_i, `(2·acos(d/2) − (d/2)√(4 − d²))/π`, equals `min(1, V_i)` (bisection, 20 iterations). The bokeh kernel at field radius r keeps a pupil sample u only if `|u − d(r)·r̂| ≤ 1`.
- **Distortion.** Trace real chief rays at 0.25, 0.5, 0.75 and 1.0 of θ_max to the paraxial image plane (∞ focus) to get h_j, and compare with `h0_j = EFL·tanθ_j`. Least-squares fit `h = h0·(1 + k1·ρ² + k2·ρ⁴)` with `ρ = h0/h0_max`. Edge distortion is `k1 + k2`, reported as a percentage.
- **Lateral CA.** Take chief-ray heights at 0.7 field for C and F against d: `lateralCA = [h_C/h_d, 1, h_F/h_d]`, applied as a per-channel radial image scale.
- **Longitudinal CA.** `longCA = [BFD_C − BFD_d, 0, BFD_F − BFD_d]`, in mm.
- **Spherical.** The real marginal ray (EP edge, on-axis, d-line) crosses the axis at `z_m`. `LSA = z_m − z_paraxial`. The glow blur diameter at best focus is `b_SA = 0.5·|LSA|/N`, in mm.
- **Field curvature.** Image-surface sag at film height h is `Δv_p(h) = −0.5·P·h²`.
- **Swirl.** The bokeh kernel is stretched tangentially by `1 + 1.5·|P·EFL|·ρ²`.
- **Ghosts (SHOULD).** For each surface pair (i < j), capped at 15 pairs, run a two-bounce paraxial trace (reflect at j, then at i, then continue to the image) to get position factor `m_ij` (the ghost centre sits at `centre + m_ij·(sunImage − centre)`), size from the defocus of the bounced marginal ray, and amplitude `R_i·R_j`. Ghost tints are grey uncoated, amber/magenta single-coated and green/violet multi-coated. **Veiling glare** is `g = 0.012·n_uncoatedSurfaces + 0.002·n_coated`, capped at 0.08.
- **Mass and length.** Element volume is the cylinder plus spherical caps, `V_cap = π·h²(3R − h)/3` with h = |sag|, so mass = ρ·V. Brass barrel mass is `1.2 g × (length/mm) × (D_max/10 mm)`. `lengthMm` = front vertex to film. `telephotoRatio = lengthMm/EFL`.

### 5.5 Imaging helpers (`imaging.ts`): one source of truth for renderers and grading

These use thin-lens equivalents about the principal planes.
- Focus extension `ext ≥ 0` moves the whole lens group by −ext. The design is always **collimated** at ext = 0 (∞ on film). Q. collimates automatically whenever you leave the bench, with a toast showing the shift.
- Distance from extension: `s(ext) = f·(f + ext)/ext`.
- Extension from distance: `ext(s) = f²/(s − f)`.
- Magnification `m = ext/f`. Working f-number `N_w = N·(1 + m/p)`, with pupil magnification `p = D_XP/D_EP`.
- **Signed circle of confusion** for an object at s, field height h, channel k:
  `v(s) = f·s/(s − f)`, `v_f = f + ext`,
  `c = (f/N)·(v(s) + Δv_p(h) + longCA_k − v_f)/v(s)`, in mm.
  To pixels: `c_px = |c|·W_px/W_mm`.
- Acceptable CoC is `c₀ = diag/1500` (0.029 mm for 24×36, 0.053 for 6×6, 0.102 for 4×5). Hyperfocal distance is `H = f²/(N·c₀) + f`.
- **Diffraction:** Airy disc diameter `2.44·λ·N_w`, with Gaussian `σ = 0.42·λ·N_w`.
- **Field of view:** `2·atan((W/2)/(f + ext))`, so focus breathing comes out naturally.
- **Film illuminance:** `E = (π/4)·τ·L·cos⁴θ·V(θ) / N_w²`, with L in cd/m² and E in lux.

### 5.6 Light, sky and calibration

The street runs **east–west**, so golden-hour light rakes along it.
- **Sun:** `elev(h) = 62°·sin(π(h − 6)/14)` for h in [6, 20]. At night (h in [20, 30), wrapping past midnight) it is `elev = −30°·sin(π(h − 20)/10)`, so 21:00 is −9° (twilight) and 22:00 is −18° (night). Azimuth runs linearly from 70° at 06:00 to 290° at 20:00.
- **Air mass (Kasten–Young):** `AM = 1/(sin e + 0.50572·(e° + 6.07995)^−1.6364)`.
- **Direct normal illuminance:** `E_n = 128 klux · exp(−0.2·AM)`, zero below the horizon, with a smooth fade from 0° to 2°. The sun's colour warms from (1, 0.98, 0.95) at 30° toward (1, 0.62, 0.32) at 2°.
- **Sky:** horizon luminance `L_h = 8·s(e)` and zenith `L_z = 4·s(e)` kcd/m², with `s(e) = clamp(sin(e + 3°)/sin 60°, 0.0005, 1)^0.9`. The zenith colour is (0.45, 0.6, 1.0) and the horizon colour goes from (0.9, 0.85, 0.8) to (1.0, 0.6, 0.35) when e < 10°.
- **Aureole:** `+40·s(e)·exp(−γ/0.08)` kcd/m², where γ is the angle from the sun.
- Ambient light is a HemisphereLight with `E_sky ≈ π·mean(L_sky)`. The night floor is 0.0005 kcd/m².
- The **sun disc** is 0.53° wide, with luminance clamped to 60 000 kcd/m² in the render target. Glare and ghosts use the analytic sun.
- **Calibration rule.** Three's physically-correct lights output `ρ/π·E`. Feed lux ÷ 1000, so a Lambert pixel equals luminance in kcd/m². The self-test renders an 18% grey card facing the sun at 13:00 (elevation ≈ 61°, E ≈ 104 klux plus sky) and asserts `L = 0.18·E/π` within ±5%, where E is the analytic sun plus sky illuminance on the card (≈ 107 klux, so ≈ 6.1 kcd/m²). Tune `LIGHT_SCALE` until it passes.
- **Meter:** `EV100 = log2(L·100/12.5)`. For a grey card in that sun it reads EV 15.6, so sunny-16 is honest to within a stop, and Q.'s note says so.
- **Lights on** below elevation 4°: string-light bulbs at **3 cd** (colour 1, 0.72, 0.42), street lamps at **150 cd** (1, 0.66, 0.36), the courier's bike lamp at **20 cd** forward, his tail lamp at 2 cd red, and lit windows at 0.05 kcd/m².

### 5.7 Exposure and the meter

- **Mid-grey reference:** `H_ref(S) = (π/4)·K/S = 9.82/S` lux·s, with K = 12.5. A meter-correct exposure lands mid-grey here.
- **Latent encoding** is fixed and independent of stock: store `log2(H/H0)` with `H0 = 0.1` lux·s over **−10…+10 EV** as RGB8, `byte = clamp(round((log2(H/H0) + 10)·12.75), 0, 255)`, a step of 0.078 EV.
- **Meter needle:** the live view's 16×16 mip gives a centre-weighted mean of log L (weights 3:1 inside the central 50%), read with async readback every 250 ms. Deflection is `EV_meter − EV_set`, clamped to ±3, using a spring with ζ = 0.35 and f_n = 3 Hz.
  `EV_set = log2(N_w²/t) − log2(S/100) + filterStops`.
- Meter types: **selenium handheld** (box and rangefinder) ignores bellows and filters, which is a lesson. **TTL** (reflex) includes them. The tin and view camera have **no meter**, only Q.'s sticker: *"Sun: f/16 at 1/ISO. Shade: 3 stops more. Count Mississippis."*
- **Reciprocity:** if the open time `t > 1` s, `H ← H·t^(p−1)` (p per stock, §6.4).
- **Bellows factor** comes out of N_w automatically.

### 5.8 Shutters: time is a spatial dimension

Each print pixel (u, v) in [0,1]², viewed upright, opens at `t0(u, v)` for duration t. The subframe weight is
`w = |[τ_k, τ_k + Δτ] ∩ [t0, t0 + t]|` in seconds, times the leaf/cap ramp factor.

| id | Name | Speeds | Model | Sound |
|---|---|---|---|---|
| cap | Lens cap | B only | t0 = 0. Linear 90 ms ramps at each end | cap *pop* + *pop* |
| leaf | Leaf (in the lens) | 1 s – 1/500, B | Global. Area ramp `min(1, (min(τ, t+τ_o−τ)/τ_o)²)`, `τ_o = 1.5 ms·(r_stop/12 mm)`; efficiency loss comes out naturally at f/2 1/500 | two 4 ms clicks (3.8 kHz) separated by t |
| clothFP | Cloth focal-plane, horizontal | 1 s – 1/1000, B | T_c = **18 ms**. `t0 = T_c·(1 − u)` (columns expose right→left) | soft *thup*…*thup*, gap t + 18 ms |
| metalFP | Metal focal-plane, vertical | 1 s – 1/4000, B | T_c = **6.5 ms**. `t0 = T_c·(1 − v)` (rows bottom→top); mirror slap on reflex | mirror thump + crisp tick |
| rollerFP | Roller-blind (1910s-type), vertical | 1/10 – 1/1000 | T_c = **120 ms**. Same as metalFP. **This is the leaning-courier shutter** | a long cloth *zzzip* lasting T_c |
| tricolour (SHOULD) | Tri-colour back | as leaf | three leaf exposures at τ = 0, 1.5, 3.0 s, each written to only R, G or B | three clicks with motor clunks |

The slow-speed escapement buzz (180 Hz square wave through a bandpass) plays under the gap for 1/8 s to 1 s.

### 5.9 Handheld shake: the camera as a body in a hand

- **Moment of inertia** about the grip pivot (film plane − 20 mm): `I = m_body·(0.045 m)² + Σ m_i·r_i²` in kg·m², using element and barrel masses at their z centres.
- **Per axis (yaw, pitch):** `I·θ'' = −k·θ − c·θ' + g(t)·τ_tremor(t) + τ_breath(t) + J·δ(t − t_mirror)`, integrated with fixed-step semi-implicit Euler at **1 kHz** and seeded per shot.
- **Handheld:** k = 1.6 N·m/rad, ζ = 0.3, `c = 2ζ·√(k·I)`.
- **Tripod:** k = 60, ζ = 0.05, tremor gain 0.
- **Tremor:** `τ_tremor = A·Σ_{j=1..6} a_j·sin(2π·f_j·t + φ_j)`, with f_j drawn uniformly from 8–12 Hz, a_j normalised to RMS 1, and **A = 0.0014 N·m**. This is calibrated so a 600 g body with a 50 mm lens gives ω_rms ≈ 0.02 rad/s; the self-test asserts ±30%. With that, the 1/focal-length rule comes out of the model without being coded.
- **Breath:** `τ_breath = 0.002·sin(2π·0.25·t)` N·m on pitch.
- **Half-press (holding your breath):** `g = 0.4` for 2.5 s, rising linearly to 1.4 by 5 s; breath ×0.1 while held.
- **Mirror slap** (reflex, mirror not locked): `J = 4×10⁻⁵ N·m·s`, 8 ms before the shutter opens.
- **Pose track.** During the open window, the `ShotRecord` stores `yaw, pitch = userAim(t) + θ(t)` at 500 Hz (120 Hz if t > 4 s). Panning is real: user drags during the exposure are recorded.
- The finder shows the true θ, not exaggerated. With a 300 mm lens you see it.

### 5.10 Film, development and print

| Stock | ISO | Spectral weights R,G,B (IR) | γ | Dmin | Dmax | G (µm) | p | Normal dev |
|---|---|---|---|---|---|---|---|---|
| Lantern Ortho 25 | 25 | 0, .35, .65 | .75 | .12 | 2.6 | .30 | .80 | 6:00 |
| Lantern Pan 100 | 100 | .27, .55, .18 | .62 | .15 | 2.5 | .38 | .88 | 8:00 |
| Lantern Pan 400 | 400 | .27, .55, .18 | .65 | .22 | 2.4 | .72 | .85 | 9:30 |
| Nightjar 1600 (SHOULD) | 1600 | .30, .52, .18 | .60 | .30 | 2.2 | 1.20 | .85 | 11:00, halation |
| Daylight Colour 200 | 200 | per channel | .55 | mask .25/.65/.95 | +2.0 | .60 | .90 | lab |
| Infrared 820 (SHOULD) | 50 | IR render only | .70 | .18 | 2.3 | .80 | .85 | 10:00, halation |

**Characteristic curve.** With `x = log10(H·S_eff/9.82)` (0 at mid-grey) and `ΔD = Dmax − Dmin`:
`D(x) = Dmin + ΔD / (1 + exp(−4γ(x − x0)/ΔD))`, where `x0 = (ΔD/4γ)·ln(ΔD/0.65 − 1)` so that `D(0) = Dmin + 0.65`. For Pan 400, x0 = 0.718.

**Development** (one setting per roll):
- Rate: `r_T = 1.1^(T − 20)`. Agitation factor: `0.85 + 0.15a`. Development amount: `E = t_dev·r_T·agit` in minutes, against normal `E_N`.
- Contrast: `γ_eff = γ·g(E)/g(E_N)` with `g(E) = 1 − exp(−E/(0.8·E_N))`. A 1.5× push gives γ ×1.19; a 0.7× pull gives ×0.82.
- Speed gain: `0.6·log2(E/E_N)` stops, folded into S_eff. Fog: `Dmin += 0.04·max(0, E/E_N − 1)`.
- **MQ fine-grain** developer: rate 1, grain ×1.
- **Kitchen (coffee) developer** (SHOULD): rate 0.75, grain ×1.15, γ ×0.95, base stain (0.95, 0.88, 0.78).
- **Bromide drag** when `a < 0.5`. Working down each column (print y, because the tank stands upright):
  `b(y) = b(y−1)·e^(−1/40 px) + 0.08·max(0, D(y−1) − 1.2)`, then `D ← D − (0.5 − a)·0.6·b`.
- **Grain (Selwyn):** `σ_D = G·grainMul·√max(D − Dmin, 0.03) / a_px`, where `a_px` is the pixel pitch on the film in µm (`W_mm·1000/W_px`). The noise is `n = 0.75·white + 0.25·box3(white)`, renormalised and seeded per frame. Pan 400 on 35 mm at 1600 px gives σ ≈ 0.032. The same stock on 4×5 is invisible, and the player discovers why large format existed.
- **Halation** (stock flag), applied in exposure space before encoding: `H += 0.12·blur_σ(max(H − 8·H_ref, 0))` with `σ = 18 px·W/1600`. Colour stock tints it (1, 0.35, 0.2).
- **Print.** A fixed grade-2 contact print with paper `γ_p = 1.7`, `D_p ∈ [0.06, 2.05]`, and paper log exposure `x_p = k − D_neg`. k is keyed so the stock's normally developed mid-grey density prints at reflectance 0.18. **There is no auto-levels.** A thin negative prints muddy, honestly.
- **Colour negative:** each channel is printed with its own key and the mask is removed. The lab offers push and pull (±1, ±2) as envelope checkboxes.
- **Display:** sRGB encode of reflectance ÷ 0.9.

**Tank timing.** Process time is compressed: **1 real second = 20 process seconds**, so 9:30 takes 28.5 s. The agitation lamp blinks every process minute (3 s real). Agitation score `a` = prompts answered within 1.5 s ÷ total prompts. Stop, fix and wash are one tap each, with 1.5 s animations.

### 5.11 World motion (each item a pure function of world time t in seconds)

- **Wind:** `W(t) = 0.55 + 0.25·sin(2πt/37 + 1) + 0.2·sin(2πt/11.3 + 2.7)`.
- **Windmill:** `ω = 4 + 30·W` rad/s. The blade angle has a closed form, `φ(t) = 20.5t − 30·[0.25·(37/2π)·cos(2πt/37 + 1) + 0.2·(11.3/2π)·cos(2πt/11.3 + 2.7)]`.
- **Courier:** `x = −60 + 6·((t + 7) mod 40)` along `z = +2.6`. Wheel angle is `x/0.34`. The body bobs `0.03·sin(2πx/1.9)`.
- **Fountain droplets** (4 jets × 100). Droplet i has period T = 1.2 s and phase `φ_i = hash(i)·T`. Birth is `b = floor((t − φ_i)/T)·T + φ_i`, age `a = t − b`, position `p = p0 + v0·a + ½·g·a²`, with `|v0| = 3.2·(0.9 + 0.2·hash)` m/s at 70° elevation. A droplet is hidden once below the basin rim.
- **Walkers:** W1 walks an ellipse around the fountain (a = 6 m, b = 4 m) at 1.3 m/s. W2 ping-pongs along the north pavement from x = −30 to +30 at 1.4 m/s. Limbs swing as `sin(2π·1.8·t)`. The **reader** sits still and turns a page every 23 s.
- **Cat:** tail angle `0.5·sin(2πt/2.3) + 0.2·sin(2πt/0.9)`; blinks every 4.7 s for 150 ms.
- **Bakery steam:** 24 puffs, phase i/24, rising 0.4 m/s, 3 s life.
- **String lights:** sway `0.05·W·sin(2πt/3.1 + 0.3i)` m. The tree sways the same way.
- **Clock hands** read the time-of-day setting.

---

## 6. Content

### 6.1 Bench parts (tray blanks)

- **Glass blanks** (default shapes; pick any glass): biconvex (c1 = +0.02, c2 = −0.02, D 30), plano-convex (+0.03, 0, D 30), positive meniscus (+0.035, +0.012, D 30), biconcave (−0.025, +0.025, D 24), negative meniscus (+0.012, +0.035, D 24). D can be changed from 8 to 80 mm in 2 mm steps.
- **Stops:**
  - Iris: blades 0/5/6/8/9, roundness 0–1; f-number in half-stop detents f/1.4 to f/64.
  - Waterhouse card: drawn shape.
  - Pinhole plate: needle gauge 0.2/0.3/0.45/0.6/1.0 mm, or continuous by drag in the onboarding.
- **Filters:** ND×8, ND×64 (MUST); yellow ×2, orange ×3, red ×8, green ×4 (SHOULD); deep red for IR (SHOULD). Filter factors scale E per channel using these transmissions: yellow (.95, .85, .12), orange (.95, .45, .03), red (.9, .08, .01), green (.1, .8, .2).

### 6.2 Bodies

| id | Name | Format (mm) | Finder | Frames/load | Mass g | ext range mm | Mirror clearance | Default shutter |
|---|---|---|---|---|---|---|---|---|
| tin | Biscuit tin | 96×120 | sight line (street) / ground glass (bench) | 1 sheet | 150 | 0–40 (telescoping lid) | — | cap |
| box | Box camera | 56×56 | frame finder | 12 | 450 | 0–6 | — | leaf |
| rangefinder | Rangefinder 35 | 24×36 | frame + distance readout (patch SHOULD) | 24 | 590 | 0–8 | — | clothFP |
| reflex | Mirror reflex 35 | 24×36 | reflex ground glass, upright, TTL | 24 | 780 | 0–10 | rear vertex and stop ≥ 38 mm from film (or lock the mirror up: no finder, no slap) | metalFP |
| view | 4×5 view camera | 96×120 | ground glass, inverted + mirrored, dark cloth | 1 sheet (12 in a box) | 2600 | 0–250 bellows | — | leaf |

The CoC is diag/1500. Any shutter fits any body (it's a toy), with the default pre-selected.

### 6.3 Presets (Q.'s card file)

All presets are authored as thin-lens group targets. The loader converts them to elements and then **auto-scales** every length (z, t, 1/c) by `f_nominal/f_actual` so the EFL comes out exact. The self-test asserts EFL within 1%.

| Preset | Recipe | Notes |
|---|---|---|
| Pinhole tin | tin body, pinhole 0.45 mm at z = −100 | onboarding |
| Landscape meniscus (1812-type) | crown, c1 = −0.030, c2 = −0.0493, D 30; front stop 15 mm ahead, f/11; f 100 | barrel distortion, soft wide open |
| Achromat doublet | crown equiconvex c = ±0.02233, D 25, cemented to a flint with c3 = −0.02233, c4 = −0.00122; f 100 (φ₁ = φ·V₁/(V₁ − V₂)) | patent target |
| Portrait (1840-type) | front achromat f 150 + rear air-spaced flint (−) and crown (+) pair 50 mm behind; f 100, f/3.6 | **swirl**, field curvature |
| Triplet (1893-type) | lanthanum crown (+0.045/−0.0025, D 22) · 4 mm · flint (−0.036/+0.040, D 18) · stop +1.5 · 4 mm · lanthanum crown (+0.012/−0.048, D 20); f 50, f/3.5 | sharp all-rounder |
| Telephoto group | positive achromat f₁ = 120, negative f₂ = −60, gap 80 → f ≈ 360, scaled to f 250 (length ≈ 139 mm) | patent target |
| Retrofocus wide | negative f₁ = −40, gap 40, positive f₂ = +30 → f 24, BFD 48 | patent target, clears the mirror |
| Double-Gauss (STRETCH) | 6 elements, f/2 | — |

Presets after Pinhole and Meniscus unlock through tags or patents (all of them with the spare key).

### 6.4 Rolls

A roll holds `body.frames`. Changing film stock forces a rewind. The tin and view camera load one sheet per "roll". IndexedDB keeps the newest 60 frames.

### 6.5 Lantern Street: layout and prop recipes

**Layout.** x runs along the street (west −45 → east +45), z across it (north facades at z = −7, south at +7), y up. The street widens into the **square** between x = −8 and +8 (to z = ±10). Cobbles and pavements use canvas textures.

| Prop | Position | Procedural recipe | Phenomenon / target |
|---|---|---|---|
| Facades | 2 rows of 8 buildings, widths 6–10 m, heights 7–13 m | box + roof wedge, merged per material. 512² canvas texture per facade: brick or plaster tone, window grid, lintels; seeded | context, shadows, streak background (`facadeBehindCourier`) |
| Quist shop | south, x −24, 2 storeys | gilt window sign `QUIST · CAMERA REPAIR · CUSTOM OPTICS` (glyph 0.16 m); upstairs window = standpoint *window* | `shopSign` (Tag 13) |
| Bakery No. 9 | north, x −12 | striped awning; transom `EST. {year}` (glyph 0.11 m at y 3.1); A-frame chalkboard `RYE {price}` (glyph 0.06 m); steam puffs | `bakeryYear`, `chalkboard` |
| Biscuit the cat | sill at (−10.2, 1.15, −6.6) | ellipsoid body, sphere head, cone ears, 6-segment tail; amber eyes with catchlight decals | `catEye`, `catWall` (wall point 2.4 m behind, inside the shop) |
| Fountain | (0, 0, 0) | 3 tiers, basin r 2.2 m; 400 instanced droplets (albedo 0.6) | freeze vs silk; `fountain` |
| Windmill | south roof (20, 15, 9) hub | 6 blades 2.2 m long, numbered 1–6 at r = 1.4 m (glyph 0.4 m); tail vane | banana blades; `windmill`, `bladeNumber` (the blade nearest 12 o'clock) |
| Courier Pip | street, z +2.6 | bicycle (two torus wheels, 16 box spokes), capsule rider; rear plate `{AA}-{nn}{A}` (glyph 0.07 m); lamps at night | panning, lean, light trails; `courier`, `courierPlate` |
| Walkers ×2 + reader | §5.11 | capsule people, 4 limbs; reader on a bench at (3, 0, −5.2) | ghosts of the square; `walker1`, `walker2`, `reader` |
| String lights | 4 zigzag catenaries x −20…+20, y 6, sag 0.6 | 40 bulb emitters + tiny meshes | bokeh, cat's eye, swirl |
| Street lamps ×4 | x −30, −10, 10, 30, alternating sides, 4.5 m | post + lantern head emitter | diffraction stars; `lamp2` (x −10) |
| Chart wall (the Lyric cinema) | north, x 28–36, y 1–4 | painted 4×3 m chart: 0.1 m grid lines every 0.5 m, Siemens star (r 0.9 m), 3 text rows; marquee `{title}` (glyph 0.25 m) | distortion, CA, sharpness; `chart` |
| Railings | south edge x −8…+30, z +6 | black posts Ø 0.04 m every 1.2 m, 1 m tall, white top rail | DOF ladder, colour fringes; `railing` |
| Pillar postbox | (−4, 0, −5.8) | cylinder r 0.25 m, h 1.5 m, red (.55, .04, .03), no insignia | ortho goes black; `postbox` |
| Tree | (6, 0, 6) | trunk + 3 icospheres, albedo (.08, .16, .05), **IR albedo .85** | Wood effect; `tree` |
| Clock tower | (80, 0, 0), 24 m | 4 faces Ø 3 m at y 18; hands; plaque `{NAME} & SONS · {year}` (glyph 0.18 m) | telephoto; `clockPlaque` |
| Neon `OPEN LATE` (SHOULD) | bakery | emissive tubes 2 kcd/m² | halation |
| Brass letterbox with rust (SHOULD) | shop door | uses `src/shared/materials` rust if it exists, otherwise its own | a nod to Texture-dle, macro |

Every material has an `irAlbedo` vertex attribute: foliage 0.85, brick 0.35, sky 0.05, skin 0.6, paint 0.4. **Read It strings** are generated from `textSeed` (stored in the save; the Daily Read STRETCH would use a date seed). Years fall in 1890–1960; names come from fictional syllable tables (KESTRA, OLLAMEER, VANTOLL…).

### 6.6 Standpoints (eye height 1.6 m; free walking is clamped to the street)

| id | Position | Default aim | Used by |
|---|---|---|---|
| window | (−24, 6.0, 6.6) | north-east, toward the fountain | bench ground glass, overview |
| shopStep | (−24, 1.6, 5.8) | east along the street | T01 |
| bakery | (−11, 1.6, −3.5) | north, bakery door at 3.4 m | T02, T03 |
| fountain | (−6, 1.6, 2) | east, fountain at 6 m | T04, T05 |
| across | (−24, 1.6, −5.5) | south, shop window at 12.5 m | T13 |
| farEnd | (40, 1.6, 0) | east, clock at ≈ 43 m | T08 |
| chart | (32, 1.6, 0) | north, chart at 7 m | T07, T12 |

### 6.7 Repair tags

A tag passes when **every** must-pass measure holds (§6.10). "READ IT" means the typed answer matches (case- and punctuation-insensitive) **and** the frame resolves the text: glyph ≥ 8 px and total blur ≤ 0.35 × glyph px.

| # | From | Ask (manila tag) | Teaches | Must-pass | Unlocks |
|---|---|---|---|---|---|
| **01** | Q. | "Any picture of the street. No glass, no lies." | pinhole, exposure | frame median exposure within ±2 EV of H_ref | crown blanks, leaf shutter, box body, Pan 100 |
| **02** | Ada, Bakery No. 9 | "What year is over my door? I've forgotten." | focus | READ IT `bakeryYear` | Pan 400, iris, rangefinder |
| **03** | Mrs. Halloran | "Biscuit's eyes. The rest can go soft." | shallow DOF | `catEye` blur ≤ 1.0 c₀px; `catWall` defocus ≥ 6 c₀px; cat head ≥ 12% of frame height | flint, Waterhouse card |
| **04** | The Lantern Society | "Prove the square is haunted." | long exposure, ND, tripod | open time ≥ 4 s; walker exposure fraction ≤ 0.25 (both); `reader` total blur ≤ 2 c₀px; reader within ±1.5 EV | tripod, ND×8, ND×64 |
| **05** | Juno, lamplighter | "Stars on my lamps, please." | diffraction stars | time ≥ 21:00; `lamp2` in frame, defocus ≤ 1 c₀px; star points ≥ 6 (n blades even → n, odd → 2n, with N_w ≥ 8) | Colour 200, coatings |
| 06 | Rook, sign-painter | "My new railings, on colour film. No rainbow edges." | achromat | colour stock; `railing` lateral CA ≤ 1.5 px; \|c_R − c_B\| ≤ 1.5 px; defocus ≤ 1 c₀px | **Patent: Achromat**, lanthanum crown |
| 07 | Mr. Fennimore, letting agent | "Straight walls. The whole cinema front." | distortion | chart ≥ 70% of frame width; \|edge distortion\| ≤ 0.5% | **Patent: Symmetric**, view camera |
| 08 | Teodor, clock-keeper | "Read my clock's plaque from the far end. Q.'s long barrel is only 160 mm." | telephoto | READ IT `clockPlaque` from ≥ 38 m; lengthMm ≤ 160 | **Patent: Telephoto**, roller-blind |
| 09 | Pip, courier | "Me sharp, the street a streak." | panning | courier motion + shake ≤ 3 px; facade streak ≥ 40 px | metal FP, reflex |
| 10 | The Miller | "Why do your photos bend my blades? Do it on purpose." | focal-plane skew | windmill bend ≥ 20° | Nightjar 1600, fluorite |
| 11 | The Miller | "Now read the blade number at full tilt. Straight, mind." | fast shutter | READ IT `bladeNumber`; ω ≥ 25 rad/s at exposure; bend ≤ 5° | tri-colour back |
| 12 | Sol, projectionist | "Wide, from the doorway, on the mirror camera." | retrofocus | reflex with the mirror active; horizontal FOV ≥ 70° | **Patent: Retrofocus**, IR 820 |
| 13 | Q. (his last) | "Upside down is the right way up." | large format | view body; standpoint *across*; `shopSign` legible; within ±1 EV | Q.'s letter (credits), spare key |

**Reference solutions** (stored as JSON and replayed by CI; §13):
- T01: tin, shopStep, 13:00, cap 6 s.
- T02: box + meniscus, Pan 100, bakery, focus 3.4 m (ext 3.03), f/11, 1/125.
- T03: rangefinder + Portrait, Pan 400, 1.5 m from the cat, f/3.6, 1/250. Defocus is about 42 c₀.
- T04: Triplet, tripod, ND×64, f/22, B 4.2 s, 17:30.
- T05: Triplet, 6 blades, f/11, 22:00, fountain → lamp2, tripod, 2 s.

On each failure the client sends one line in grease pencil from the Blur Budget fix. After three failures, Q.'s notebook ghosts the key part onto the rail.

### 6.8 Patents (SHOULD)

Criteria are checked on every full profile. The patent card shows the ray diagram, the player's chosen name (≤ 24 characters) and the first print taken with it.

| Patent | Criterion |
|---|---|
| Achromat | ≥ 2 glasses with ΔV ≥ 15; \|longCA_R − longCA_B\| ≤ EFL/1500 |
| Symmetric | stop between elements; \|edge distortion\| ≤ 0.3% at ≥ 25° half-field |
| Telephoto | telephotoRatio ≤ 0.8 |
| Retrofocus | BFD ≥ 1.25·EFL and EFL ≤ 35 |
| Anastigmat | ≥ 3 elements; \|P·EFL\| ≤ 0.25; edge spot ≤ 1.5 c₀ at f/8 |

### 6.9 The Circle of Confusion: Q.'s 12 happy accidents (SHOULD)

| # | Name | Detector |
|---|---|---|
| A1 | No Glass, No Lies | any pinhole frame |
| A2 | Shaped Bokeh | card stop and an emitter sprite with CoC ≥ 24 px |
| A3 | Cat's Eye | an emitter at ρ > 0.7 with V < 0.6 and CoC ≥ 16 px |
| A4 | The Swirl | \|P·EFL\| ≥ 0.8, N ≤ 2.8, ≥ 10 defocused emitters |
| A5 | Banana Blades | windmill bend ≥ 20° |
| A6 | Leaning Courier | lean ≥ 8° |
| A7 | Ghosts of the Square | a walker exposure fraction in 0.05–0.4 |
| A8 | Light Trails | an emitter path ≥ 80 px |
| A9 | Double Exposure | a frame with 2 or more shots |
| A10 | The Red Postbox Went Black | ortho stock with the postbox in frame |
| A11 | The Sulk | N_w ≥ 32 on 35 mm, with diffraction the largest blur term |
| A12 | Flare Cathedral | sun within frame + 5°, ≥ 6 ghosts, uncoated |

Bonus A13 (Tri-colour ghosts) and A14 (Wood effect) appear only once those parts exist.

### 6.10 Grading measures

These are analytic, from `ShotRecord`, `LensProfile` and world targets. Project each target at mid-exposure through the shot camera, including focus breathing and k1. Then compute in pixels:

- **defocus** = `cocPx` at the target depth and field.
- **motion** = the projected displacement of the target over **its own** open window [t0(u,v), t0 + t], using the user-aim track without θ, so a correct pan cancels subject motion.
- **shake** = the displacement of a static point at the target's position caused by θ alone.
- **glass** = `√(b_SA_px² + fieldCurv_px² + latCA_spread_px²)`.
- **diffraction** = `2.44·λ·N_w` in px.
- **total** = the root sum of squares of the above.

Further measures:
- **Exposure** at a target: the median of the 5×5 latent patch → `log2(H/H_ref)`.
- **Lean** (vertical-travel shutters) = `atan(v_x·T_c/H_px)`.
- **Bend** = `ω·T_c·(extent/frameDim along travel)` in degrees.
- **Walker exposure fraction** = `min(1, 0.45 m/(v·t_open))`.
- **Star points** as in Tag 05.

**Blur Budget UI.** A stacked bar shows defocus, motion, shake, glass and diffraction, scaled to that tag's threshold, with grain shown as hatching. The largest segment is circled in grease pencil with a fix written in its words, for example `motion 11 px → ~1/500`, `focus on the cat: 1.5 m, or stop down to f/9`, `shake → tripod or ≥ 1/250`.

### 6.11 Q.'s margin notes (shown the first time each part is used)

- Pinhole: *"No glass, no lies. Everything is a little soft and nothing is wrong."*
- Focal-plane shutter: *"The curtain is a slit running for a bus. Anything faster than the bus gets bent."*
- Exposure: *"Bright sun: f/16, one over your film speed. The rest is arguing."*
- Stopping down past f/22: *"Smaller hole, softer picture. Light is a wave and it sulks in tight spaces."*
- Flint: *"Crown bends red and blue apart. Flint bends them apart more. Put them back to back and they argue themselves straight."*
- Tripod: *"Your heart beats nine times a second in your fingers. The tripod has no heart."*
- Ortho: *"Blind to red. Load it under the safelight and paint your lips black."*
- Roller-blind: *"Slow curtain, fast world. Lean into it."*

---

## 7. Art direction, UI and audio

**Site alignment.** Follow `docs/design/art-direction.md` once it lands. Until then use the hub tokens (`--bg #14110f`, `--ink #f1e9dc`, `--red #d8432c`, monospace). Fonts are **system stacks only**, with no new dependencies:
- engraving: `"Arial Narrow", "Roboto Condensed", sans-serif`, caps, +4% tracking;
- tags: `"Courier New", monospace`;
- Q.'s hand: `"Segoe Print", "Bradley Hand", "Chalkboard SE", cursive`;
- readouts: `ui-monospace, Consolas, monospace` with `font-variant-numeric: tabular-nums`.

**Palette tokens** (CSS on `:root` in `lensbench.css`):

| Token | Value |
|---|---|
| walnut | `#4A2E1C` |
| baize | `#2F4A3A` |
| brass | `#B8893A`, highlight `#E2C27A` |
| anodize | `#17181A` |
| engrave | `#EDE8DC`, feet `#E8772E` |
| fog | `#0B0D10` |
| ray-C | `#FF4A3D` |
| ray-d | `#FFD04A` |
| ray-F | `#4AA8FF` |
| patent-paper / patent-ink | `#F2EDE0` / `#1C2230` |
| tag-manila | `#E9D7A6` |
| grease | `#C2262E` |
| lightbox | `#F4F1EA` |

**Bench** (all 2D canvas, DPR ≤ 2). It's a dim workshop lit by a warm lamp from the right. A window at the top-left shows the street's actual sky colour for the current time.
- The **fog tank** is a dark glass box with faint haze noise. Rays are drawn twice, with `globalCompositeOperation = 'lighter'`: once 6 px wide at 8% alpha, once 1.5 px at 70%. Where rays converge the haze glows hot, so you can *see* focus. Rays continue faintly past the film.
- **Pucks** are drawn as true sections: a filled path built from both sags, with a glass gradient, a rim glint and crosshatching per glass type in section view.
- The rail is walnut with procedural sine-warped grain and a millimetre scale. The body is drawn at z = 0: tin, box, rangefinder, the reflex body with its mirror at 45° and a red clearance zone when violated, or view-camera bellows.
- **Ground-glass inset** above the film plane: the live WebGL view, with Fresnel rings, grain and a hot spot.
- **Blur-spot loupe** at the bottom-right of the tank: a 96 px circle showing the spot diagram at the film (on-axis and 0.7 field) at 50×, with dots in C/d/F.

**Street.** Low-poly, flat-shaded Lambert, golden-hour default (17:30), long blue shadows (one shadow map). Live tonemapping is ACES. Facades are warm plaster and brick, with blue skylight in the shade.

**Finder overlays:**
- **sight:** a thin wire frame on a wide, sharp view;
- **frame:** brightlines at 0.85× magnification, no DOF;
- **rangefinder:** brightlines plus a central patch (SHOULD) showing a horizontally offset copy whose shift is `clamp(k·(1/s_patch − 1/s_f), ±60 px)`;
- **reflex:** full image with DOF, a microprism collar, brightness `∝ (2.8/N_open)²` (wide open, unless DOF preview is held);
- **groundglass:** inverted and mirrored, brightness `∝ clamp((5.6/N_w)², 0.02, 1)`, Fresnel rings, a hot spot, and corner falloff.

**Tank.** A steel sink and a black tank with a red lid. Process steps run across the top as a timeline (Load → Developer → Develop → Stop → Fix → Wash → Hang). Q.'s time/temperature chart card is on the left, and the thermometer and a mechanical timer face are on the right.

**Lightbox.** A 5000 K glow. Strips sit in glassine sleeves with sleeve notes in Q.'s hand (`f/5.6 · 1/250 · Lantern Pan 400 · Triplet 50 mm · MQ 9:30 @ 20 °C`) and edge print (`LANTERN PAN 400 ◄ 14 ◄ 14A`). There's an 8× loupe disc and grease-pencil picks.

### 7.1 Screen layouts

- **Bench, desktop 1280×800:**
  - top bar (48 px): place tabs | roll status (`Pan 400 · 7/24 · 1 roll to develop`) | menu;
  - cork strip (40 px) of tags;
  - the fog tank (left 72%, 58% tall);
  - spec column on the right (28%): an engraved plate showing EFL, f/ (T/), BFD, length, mass, FOV, focus scale with DOF index lines, and flags (∞ OK, MIRROR CLEAR, VALID), then the body/shutter/film/filter chips, presets, save and share;
  - the felt parts tray along the bottom (≈ 28%), with locked drawers padlocked and showing a tag hint.
- **Bench, phone 390×844:**
  - top bar of icons (44 px);
  - tank canvas 390×300 with a 120×80 ground-glass inset;
  - a 2-line spec strip, expandable;
  - a horizontal tray (110 px);
  - selectors in a bottom sheet.
- **Street:**
  - a full-bleed finder;
  - top: meter-needle arc, sun/time arc, tripod, back-to-bench;
  - left: standpoint chips (on phone, a virtual stick in the bottom-left);
  - bottom deck: focus strip with distance marks and DOF brackets, aperture dial, speed dial, film badge;
  - bottom-right: a 72 px release button with a rolling frame-counter drum and the advance lever beside it.
- **Tank:** centred, controls large enough for thumbs.
- **Lightbox:** the strip along the top. The selected print is enlarged in the centre with the loupe. The side panel (a bottom sheet on phone) holds the sleeve note, the Blur Budget, deliver-to-tag with the Read It field, and export and replay buttons.

### 7.2 Juice

- Pucks squash 3% on snap.
- The spec plate *stamps* each changed value with an emboss flash.
- The meter needle overshoots.
- The contact strip flutters onto the lightbox.
- ACCEPTED is a red rubber stamp, rotated −8°, with a dust puff.
- The caustic spot from the bench lamp crawls across the felt as glass moves (SHOULD).

### 7.3 Procedural audio (WebAudio only)

Chain: master `DynamicsCompressor` → destination. The bench bus has a generated room IR (decaying noise, RT60 0.4 s). The street bus has one 120 ms slap echo at −18 dB. Under the dark cloth, everything is low-passed to 600 Hz.

| Sound | Recipe |
|---|---|
| Leaf | two 4 ms bandpassed noise clicks at 3.8 kHz, **scheduled t apart** |
| Cloth FP | two lowpassed (1.5 kHz) *thups* plus flutter, gap t + 18 ms |
| Metal FP + mirror | 60 Hz sine thump with a 2 kHz ring decaying over 90 ms, then a tick |
| Roller-blind | a T_c-long ratchety cloth zip (noise through an AM comb) |
| Escapement (1/8–1 s) | 180 Hz square → bandpass, ±10% jitter, under the gap |
| Advance | 7 noise ticks rising in pitch + a counter thunk |
| Rewind | a friction zip that goes slack at the end |
| Detents | 6 kHz ticks, 3 ms |
| Rail rub / focus | brown noise whose gain tracks velocity |
| Creak | a resonant bandpass sweep whose Q tracks \|c\| |
| Glass ping (SHOULD) | partials 1 : 1.73 : 2.33, decays 1.2/0.6/0.3 s, plus a 2 ms click. Fundamental `f0 = 2200·(t/D²·100)·√(E/ρ)/√(70/2.5)` Hz, clamped to 300–3000 ("pitch-shifted down three octaves") |
| Achromat resolve (SHOULD) | a two-note chord that turns consonant when the longCA spread drops below EFL/1500 |
| Needle / chime | a click / a 1.2 kHz + 1.8 kHz sine bell |
| Tank | pour (filtered noise, rising pitch), glug on inversion, timer tick, a *ding* at the end |
| Street bed | wind = pink noise with gain from the **same W(t)** that drives the windmill; FM bird chirps; fountain (bandpassed noise ∝ 1/distance); courier bell and freewheel ticks Doppler-shifted; a clock bell on the quarter hour |

The AudioContext starts on the first pointerdown. Mute is persisted.

---

## 8. Save states and persistence

- **localStorage** (each entry is JSON, versioned `v:1`, and wrapped in try/catch):
  - `lensbench:v1:progress` → `{ onboarded, spareKey, unlocked: PartId[], tags: Record<TagId, {done, frameId, attempts}>, patents: Patent[], accidents: Record<AccidentId, frameId>, textSeed, settings: {audio, haptics, quality, reduceMotion} }`
  - `lensbench:v1:camera` → the current `CameraSpec` plus ext, N and t
  - `lensbench:v1:street` → `{ timeOfDay, standpoint, pos, yaw, pitch, tripod }`
  - `lensbench:v1:designs` → up to 50 named `CameraSpec`s (Q.'s card file: the **save states** for cameras)
  - shared, SHOULD: `arc:optics:lenses:v1` → `[{ name, design: LensDesign, patent? }]`, so Studio's workshop can offer "lenses you designed at the Bench"
- **IndexedDB** `lensbench`, version 1:
  - store `rolls` (key `id`): `RollRecord`
  - store `frames` (key `id`): `{ record: FrameRecord, latent: Blob (PNG of RGB8 log-exposure), print?: Blob (JPEG q .9), thumb?: Blob (256 px) }`
- **Write policy.** A `ShotRecord` is persisted **at fire**. The latent is written once it renders. The print is written after development. Frames left unrendered at reload are re-queued, since rendering is deterministic from the `ShotRecord`. Autosave runs on every store change (debounced 500 ms) and on `visibilitychange`.
- **Fallbacks.** If IndexedDB fails (Safari private mode), keep everything in memory and show a dismissible note: *"Film won't survive a reload in this window."* Corrupt JSON is quarantined to `…:corrupt` and replaced with defaults.
- **Share** (MUST): `#cam=<base64url(compact JSON)>`. Lengths are rounded to 0.01 mm and curvatures to 1e-5, typically under 600 characters. When a hash is present at load, the camera goes onto the bench with a toast, *"A friend's camera is on your bench."* Your previous camera is auto-saved to designs first. Locked parts in a shared camera are usable (the toy wins).
- **Darkroom crossover** (STRETCH): "Carry to the basement" writes `{ latent PNG, stock, meta }` through `src/shared/filmcan` if that module exists. There are no build-time imports from other teams in MUST.

---

## 9. Onboarding (first visit; skippable via menu or `__game.skipOnboarding()`)

1. **0:00.** The bench is dimmed and the tray hidden. The biscuit tin sits on the rail with its back as ground glass, black. The needle in the pincushion pulses. Q.'s note fades in: *"No glass, no lies. — Q."*
2. **0:05.** Drag the needle into the tin. *Click*: a 0.2 mm hole appears. Rays fan into the haze and the ground glass shows a **dim, upside-down, live street**.
3. **0:15.** A hint arrow appears on the needle (drag it again). The hole widens through 0.3, 0.45, 0.6 and 1.0 mm. Brightness goes as d² and blur follows §5.3. At 0.45 mm, the **chime** plays.
4. **0:30.** Tag 01 swings onto the cork strip. The Street tab pulses.
5. **0:40.** Street, at shopStep. The tin sits on a post (tripod forced). Q.'s sticker reads *"Sun: count six."* Hold the release: a soft tick every second. Release after about six.
6. **1:00.** The Tank pulses with a *"1 sheet"* badge. Pour, then invert when the lamp blinks (twice; the paper is a short process of 2 process minutes), then pour out and fix. About 20 s.
7. **1:25.** Lightbox: the negative, with a black sky. "Flip" turns it positive. The tag panel is open: deliver, ACCEPTED stamp, grease tick.
8. **1:45.** The crown drawer slides open, the **meniscus puck** is in your hand, and Tag 02 pins itself. From here, labels appear only after first use and tags explain themselves.

**Teaching rules.** One new verb per tag. Readouts fade in after the first time you touch a control. Every failure is diagnosed by the Blur Budget. Nothing modal is longer than 12 words.

---

## 10. Scope tiers

**MUST (MVP, one build round):**
- **Optics core:** §5.1–5.5 (6 glasses, ≤ 6 elements, iris/card/pinhole, full profile without ghosts); presets: Pinhole, Meniscus, Achromat, Portrait, Triplet, Telephoto, Retrofocus; self-test.
- **Bench:** canvas rail, rays (laser and white), all §4.2 MUST interactions, ground-glass inset, blur-spot loupe, spec plate, body/shutter/film/filter selection, collimate, card drawing.
- **Street:** world with every §6.5 prop except neon and letterbox; sun/time; shadows; standpoints and walking; finders (sight, frame, reflex, groundglass); meter; shake; half-press; tripod; advance and multiple exposure; B and cap.
- **Photo:** subframe accumulation with all shutters except tricolour; pupil-gather DOF with long CA; emitter sprites with stars; distortion, lateral CA, vignette and cat's eye; SA glow; diffraction; halation; latent encode; deferred render queue.
- **Film:** Ortho 25, Pan 100, Pan 400, Colour 200; curve, grain, reciprocity, development model, bromide drag, print; tank (MQ); colour lab envelope.
- **Lightbox:** strip, enlarge, negative/positive, loupe, Blur Budget, deliver, Read It, print PNG export with rebate.
- **Tags** 01–05 with grading and reference solutions.
- **Saves and share:** §8 MUST items.
- **Audio:** shutters, advance, detents, rub, creak, needle, chime, tank, street bed.
- **Onboarding;** `__game`; quality tiers.

**SHOULD:**
- Tags 06–13; patents; Circle of Confusion notebook.
- Rangefinder patch; dark-cloth full-screen; **slit replay** (re-renders the scene live at τ in slow motion, ×1/200, with the final print revealed behind the advancing slit band; saveable as a WebM through `MediaRecorder` where supported).
- Tri-colour back; Nightjar 1600; IR 820 with the Wood effect; colour filters; ghosts and veiling glare with coatings; glass ping; achromat chord; undo/redo.
- Kitchen developer; instant pack back (a fast loop: auto-develops in 20 s on the Street); spec card export (patent-sheet drawing + photo + plate); contact-sheet export; `arc:optics:lenses:v1`; neon; letterbox; develop in a Worker.

**STRETCH:**
- Daily Read (date seed, 4 frames, 3 guesses, share text).
- Scheimpflug tilt and shift; slit-scan back; burning glass; curtain burn; thoriated element with Geiger ticks and UV lamp.
- Changing bag by feel with reel kinks; opening the back mid-roll; flash with an X-sync black band; DeviceMotion "Real Hands" and shake-to-agitate.
- filmcan export to Darkroom; 3D camera turntable; Double-Gauss; the shop radio light report.

---

## 11. Tech plan

### 11.1 Files (owner work package in brackets)

```
src/shared/optics/            [A]  shared: Studio loads LensDesign; pure TS, no three.js
  index.ts types.ts glass.ts trace.ts paraxial.ts profile.ts imaging.ts
  mask.ts presets.ts codec.ts selftest.ts
games/lensbench/
  index.html main.ts lensbench.css                         [D]
  core/ types.ts store.ts gl.ts quality.ts rng.ts clock.ts  [D]
  audio/ audio.ts                                           [A]
  bench/ bench-screen.ts rail-view.ts rays-view.ts pucks.ts iris.ts tray.ts
         specplate.ts body-draw.ts bench.css                [A]
  street/world/ world.ts layout.ts sky.ts materials.ts textures.ts text.ts
         emitters.ts targets.ts props/{facades,shop,bakery,cat,fountain,windmill,
         courier,people,lights,chartwall,railings,postbox,tree,clocktower}.ts   [B]
  street/ street-screen.ts controls.ts finder.ts finder-shaders.ts meter.ts
          shake.ts shot.ts street.css                       [B]
  photo/ photo-renderer.ts shutter.ts accumulate.ts dof.ts sprites.ts
         lens-pass.ts flare.ts encode.ts replay.ts shaders.ts   [C]
  film/  stocks.ts curve.ts develop.ts grain.ts print.ts    [C]
  shop/  tank-screen.ts lightbox-screen.ts loupe.ts blur-budget.ts tags.ts
         grade.ts notebook.ts onboarding.ts save.ts share.ts export.ts
         test-api.ts shop.css                               [D]
  ref/   tag-solutions.json                                 [D]
```

**Why `src/shared/optics` is shared.** Studio's GDD expects to load a Lens Bench design onto its workshop bench, and later games may reuse the pupil mask and the CoC math. It is pure TypeScript with no DOM and no three.js, so any game can import it from `@shared/optics`. Lens Bench owns it, and other teams treat it as read-only. Film code stays local (`games/lensbench/film/`) until Darkroom's `src/shared/photochem` exists. Converging on it is a review-round task, not a build-time dependency.

### 11.2 Key interfaces (types.ts files are written first, verbatim from here)

```ts
// src/shared/optics/types.ts
export type GlassId = 'crown'|'lightFlint'|'flint'|'denseFlint'|'lanthanumCrown'|'fluorite'
export type Ch = 0 | 1 | 2                                  // R=C 656nm, G=d 588nm, B=F 486nm
export interface ElementSpec { id: string; z: number; t: number; c1: number; c2: number;
  diameter: number; glass: GlassId; coating: 0 | 1 | 2 }
export interface StopSpec { z: number; kind: 'iris' | 'card' | 'pinhole'; diameter: number;
  blades: 0 | 5 | 6 | 8 | 9; roundness: number; card?: string /* 32x32 1-bit base64 */ }
export interface LensDesign { v: 1; elements: ElementSpec[]; stop: StopSpec }
export interface RayPath { pts: Float32Array /* z,y pairs */; ch: Ch; fate: 'film'|'vignetted'|'tir'|'miss' }
export interface Ghost { m: number; sizeMm: number; amp: number; tint: [number, number, number] }
export interface LensProfile {
  valid: boolean; issues: string[]; pinhole: boolean
  efl: number; bfd: number; ffd: number; p1z: number; p2z: number
  ep: { z: number; d: number }; xp: { z: number; d: number }; pupilMag: number
  fNumber: number; tStop: number; transmission: number
  pupilMask: Uint8Array /* 64x64 */; maskArea: number; blades: number
  distortion: { k1: number; k2: number; edgePct: number }
  lateralCA: [number, number, number]; longCA: [number, number, number]
  lsa: number; saBlurMm: number; petzval: number; pinholeBlurMm: number
  vignette: Float32Array; catsEye: Float32Array /* 16 each, field 0..1 of half-diagonal */
  ghosts: Ghost[]; glare: number
  massG: number; lengthMm: number; frontZ: number; rearZ: number; telephotoRatio: number
  format: { w: number; h: number }; fieldHalfDiagRad: number
}
// src/shared/optics/index.ts (signatures)
export function indexAt(g: GlassId, lambdaUm: number): number
export function autoThickness(e: ElementSpec): number
export function validate(d: LensDesign): { ok: boolean; issues: string[]; clampZ?: number }
export function traceFan(d: LensDesign, o: { fieldRad: number; rays: number; chs: Ch[]; toZ: number }): RayPath[]
export function spotDiagram(d: LensDesign, fieldRad: number, ch: Ch, grid?: number): Float32Array
export function computeProfile(d: LensDesign, format: { w: number; h: number }, q?: 'fast' | 'full'): LensProfile
export function collimate(d: LensDesign): { design: LensDesign; shiftMm: number }
export function rasterizePupil(s: StopSpec, size?: number): Uint8Array
export function samplePupil(mask: Uint8Array, size: number, n: number, seed: number): Float32Array
export function encodeLens(d: LensDesign): string
export function decodeLens(s: string): LensDesign | null
export function loadPreset(id: PresetId): LensDesign
// imaging.ts: focusDistanceM, extForDistance, magnification, workingN, cocMm(p, ext, sM, fieldR01, ch),
//             hyperfocalM, airyMm, fovDeg, filmIlluminance, pinholeOptimum
```

```ts
// games/lensbench/core/types.ts
export type Place = 'bench' | 'street' | 'tank' | 'lightbox'
export type QualityTier = 'desktop' | 'phone' | 'test'
export type BodyId = 'tin' | 'box' | 'rangefinder' | 'reflex' | 'view'
export type ShutterId = 'cap' | 'leaf' | 'clothFP' | 'metalFP' | 'rollerFP' | 'tricolour'
export type StockId = 'ortho25' | 'pan100' | 'pan400' | 'nightjar1600' | 'colour200' | 'ir820'
export type FilterId = 'none' | 'nd8' | 'nd64' | 'yellow' | 'orange' | 'red' | 'green' | 'deepRed'
export type StandpointId = 'window'|'shopStep'|'bakery'|'fountain'|'across'|'farEnd'|'chart'
export type TargetId = 'bakeryYear'|'chalkboard'|'catEye'|'catWall'|'fountain'|'reader'|'walker1'
  |'walker2'|'lamp2'|'railing'|'chart'|'clockPlaque'|'courier'|'courierPlate'|'windmill'
  |'bladeNumber'|'postbox'|'tree'|'shopSign'|'facadeBehindCourier'
export interface CameraSpec { v: 1; name: string; lens: LensDesign; body: BodyId;
  shutter: ShutterId; stock: StockId; filter: FilterId }
export interface ShotRecord {
  id: string; seed: number; camera: CameraSpec; ext: number; fNumber: number
  shutterS: number /* set speed, or actual hold for B/cap */; worldT0: number; timeOfDay: number
  pos: [number, number, number]; trackHz: number; track: Float32Array /* yaw,pitch rad pairs */
  aimNoShake: Float32Array /* same layout, without θ: for grading */
  tripod: boolean; mirrorLocked: boolean; textSeed: number
}
export interface FrameRecord { id: string; rollId: string; index: number; shots: ShotRecord[]
  status: 'exposed' | 'rendered' | 'developed'; meta?: FrameMeta }
export interface RollRecord { id: string; stock: StockId; body: BodyId; capacity: number
  frames: string[]; state: 'loaded' | 'rewound' | 'developed'; dev?: DevParams }
export interface DevParams { developer: 'mq' | 'coffee' | 'lab'; minutes: number; tempC: number
  agitation: number; pushStops?: number }
export interface FrameMeta { exposureEV: number; accidents: string[]; w: number; h: number }
export interface LatentImage { w: number; h: number; data: Uint8Array /* RGB8, §5.7 */
  formatMm: [number, number]; ir: boolean }
export interface DevelopedFrame { w: number; h: number; negative: ImageData; positive: ImageData }
```

```ts
// street/world/world.ts [B]
export interface Emitter { x: number; y: number; z: number; cd: [number, number, number]; kind: 'bulb'|'lamp'|'bike'|'tail' }
export interface TargetDef { id: TargetId; at(t: number, out: THREE.Vector3): THREE.Vector3
  velocity(t: number, out: THREE.Vector3): THREE.Vector3; sizeM: number; glyphM?: number
  answer?(textSeed: number): string }
export interface World {
  scene: THREE.Scene; standpoints: Record<StandpointId, { pos: [number, number, number]; yawDeg: number; pitchDeg: number }>
  targets: Record<TargetId, TargetDef>
  setTimeOfDay(h: number): void; setTextSeed(s: number): void; setIR(on: boolean): void
  setEmitterMeshes(on: boolean): void          // photo renderer hides them and draws sprites
  update(t: number): void                       // pure: same t → identical poses
  emitters(t: number, out: Emitter[]): number
  sun(): { dir: THREE.Vector3; elevDeg: number; normalLux: number; skyLux: number; color: [number, number, number] }
  windmillOmega(t: number): number; clampWalk(p: THREE.Vector3): void
}
export function createWorld(q: QualityTier): Promise<World>

// core/gl.ts [D]
export interface GLCore { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement
  caps: { webgl2: boolean; floatRT: boolean }; quality: QualityTier
  attachTo(el: HTMLElement | null): void /* positions the single GL canvas over el */ }

// street/finder.ts [B]
export interface Finder { render(dt: number): void; meterEV(): number
  setView(v: { pos: [number, number, number]; yaw: number; pitch: number }): void }
// photo/photo-renderer.ts [C]
export interface PhotoRenderer { render(f: FrameRecord, onProgress?: (p: number) => void): Promise<LatentImage>; busy(): boolean }
export function createPhotoRenderer(gl: GLCore, world: World): PhotoRenderer
// film/develop.ts [C]: pure, no DOM except ImageData
export function developFrame(l: LatentImage, stock: StockId, dev: DevParams, seed: number): DevelopedFrame
export function normalDev(stock: StockId): number
// audio/audio.ts [A]: every method a no-op until unlock()
export const sfx: { unlock(): void; mute(on: boolean): void; shutter(k: ShutterId, t: number, mirror: boolean): void
  advance(): void; rewind(): void; detent(): void; rub(vel: number): void; clink(v: number): void
  creak(c: number): void; ping(f0: number): void; needle(): void; chime(): void; pour(): void
  glug(): void; tick(): void; bell(): void; stamp(): void; place(p: Place): void; streetBed(w: number, fountainGain: number): void }
// core/store.ts [D]
export const store: { get(): AppState; set(p: Partial<AppState>): void; on(k: keyof AppState | '*', fn: () => void): () => void
  fire(shot: ShotRecord, multiple: boolean): FrameRecord; advance(): void; rewind(): RollRecord | null }
```

### 11.3 Render pipeline

There is one `THREE.WebGLRenderer` and one canvas, owned by `core/gl.ts`. Screens call `attachTo(placeholder)`. `antialias: false` (the passes do their own filtering), `powerPreference: 'high-performance'`, and `outputColorSpace` stays linear for render targets.

**Live finder** (B), every frame:
1. `world.update(t)`.
2. Render to an RGBA16F RT: 512 px wide on desktop, 384 on phone, 256 in test. Shadows are on, and emitters draw as small additive sprites.
3. **DOF-lite:** a gather with 12 taps (8 on phone) from `samplePupil`, using `cocMm` uniforms (f, N, ext, P, longCA at G only), clamped to a 16 px radius. Pinhole uses a constant radius.
4. Distortion UV remap + lateral CA + `cos⁴·V` vignette.
5. ACES tonemap with auto exposure keyed to the meter EV, times the finder brightness.
6. Finder overlay shader (flip for groundglass), then out to the canvas.

**Photo** (C), queued, time-sliced at ≤ 8 ms of GPU work per animation frame, using `setTimeout(0)` slicing while the tab is hidden. For each `ShotRecord` in the frame:

1. **Time sampling.** `span = T_c + t + ramps`. K is `clamp(ceil(4·span/max(t, T_c/8)), K_min, K_max)` (desktop 8–48, phone 4–16, test 4). Subframe times are stratified and seeded-jittered: `τ_k = (k + ξ_k)·span/K`.
2. **Per subframe:**
   - `world.update(worldT0 + τ_k)`; set the camera from the track (yaw, pitch at τ_k), FOV `2·atan(H/2/(f + ext))`, and IR mode if the stock is IR;
   - render the scene with emitter meshes off to a 16F colour RT plus a depth texture;
   - **accumulate** pass (additive blend into RGBA16F): `H += (π/4)·τ·L·1000/N_w² · w_shutter(u, v, τ_k, Δτ) · filter_ch`;
   - for the subframe nearest mid-exposure, keep depth for the DOF step.
3. **Emitter sprites.** Use M time samples per emitter (desktop 64, phone 24, test 8) to an instanced quad buffer. Each sprite:
   - sits at the emitter's projected position;
   - takes its size from `cocMm` (minimum = the larger of the Airy spot and 1.2 px);
   - takes its shape from the `pupilMask` texture, rotated and stretched by swirl and clipped by the cat's-eye circle;
   - **conserves energy:** it deposits `Φ·Δt/a_spot` with `Φ = I·(π·D_EP²/4)/s²·τ`;
   - is occlusion-tested against the kept depth (0.2 m tolerance);
   - adds diffraction spikes (count per §6.7, length `∝ √Φ·N/16`) when blades > 0 and N ≥ 5.6;
   - is weighted per pixel by the same shutter window.
   Sprites write to a separate buffer `S`.
4. **DOF gather** on `H` (from 3 fetches per tap):
   - per-pixel signed CoC from the kept depth for R, G and B (longCA plus Petzval at that field);
   - taps from `samplePupil` (desktop 48, phone 24, test 12), rotated by field angle, stretched by swirl, and rejected outside the cat's-eye;
   - scatter-as-gather weighting (a tap counts if its own CoC reaches the pixel);
   - radius clamped to 48 px, with larger blurs sampled from a mip LOD of `log2(r/48)`.
   Then `H ← gathered + S`.
5. **Lens pass:**
   - distortion remap `r' = r(1 + k1ρ² + k2ρ⁴)` per channel scaled by lateralCA;
   - multiply by `cos⁴θ·V(ρ)`;
   - SA glow `+ saFrac·blur(H, b_SA_px)`, with `saFrac = clamp(b_SA/c₀·0.08, 0, 0.35)`;
   - diffraction Gaussian (separable, when σ_px > 0.3);
   - ghosts and veiling glare (SHOULD);
   - halation (stock flag).
6. **Multiple exposures** sum their H before encoding. Reciprocity scales by `t^(p−1)`.
7. **Encode** to RGB8 log2(H/H0) in an RGBA8 RT, read back (`readRenderTargetPixelsAsync`), and resolve the `LatentImage`.

**Development** is CPU and pure. It runs in row chunks (≤ 6 ms per slice, or in a Worker as SHOULD): curve, grain, drag, print. The output is ImageData, which becomes a canvas and then PNG/JPEG blobs.

**Fallbacks.**
- No `EXT_color_buffer_float` (no 16F RT): K = 1, render straight into RGBA8 with exposure pre-scaled into the log encode, and show a quiet "simple film" badge.
- No WebGL2: the bench works fully (it's Canvas2D). The ground glass shows a painted placeholder, the Street shows a static illustrated card explaining that a newer browser is needed, and the Tank and Lightbox work for any frames already stored.

### 11.4 Performance budget

| Item | Desktop | Phone | Test (SwiftShader) |
|---|---|---|---|
| Live finder | ≤ 6 ms GPU @ 512 px | ≤ 9 ms @ 384 px | 256 px, 20 fps fine |
| Bench redraw | ≤ 3 ms/frame; trace ≤ 0.5 ms/move | ≤ 5 ms | — |
| Full profile | ≤ 5 ms after settle | ≤ 12 ms | — |
| Scene | ≤ 150 draw calls, ≤ 60k tris, 1 shadow map 2048 | shadow 1024, pixel ratio 1 | shadow 512 |
| Photo | 1600 px long side, K ≤ 48, 48 taps, ≤ 2 s | 1024 px, K ≤ 16, 24 taps, ≤ 4 s | 512 px, K = 4, 12 taps, ≤ 15 s |
| Develop | ≤ 80 ms per frame (chunked) | ≤ 200 ms | — |
| Memory | ≤ 300 MB | ≤ 180 MB | — |
| Bundle | ≤ 300 kB JS gzipped excluding three | — | — |

Quality is auto-detected:
- `test` if `navigator.webdriver` is set or the URL has `?q=test`;
- `phone` if `(pointer: coarse)` and the shorter screen side is under 900 px;
- otherwise `desktop`.

The player can override it in the menu.

### 11.5 Mobile plan

- Portrait-first layouts (§7.1); landscape also works.
- Pinch, long-press and double-tap mappings per §4, with hit areas of at least 44 px.
- The Street has a virtual stick on the left and look-drag on the right.
- The release is a 72 px thumb button, and half-press is its hold.
- Haptics as listed.
- Renders are time-sliced so the UI never blocks for more than 16 ms.
- The page uses `100dvh` and safe-area insets. Nothing scrolls horizontally, and the smoke test asserts `scrollWidth ≤ innerWidth`.

---

## 12. Build split

Four parallel packages with disjoint files. **Minute 0–15:** D commits `core/types.ts`, the `store` skeleton, `gl.ts`, the `main.ts` router with empty screens, and the `test-api` skeleton. A commits `src/shared/optics/types.ts`, a thin-lens `computeProfile` stub, and no-op `sfx`. B commits a `createWorld` stub (ground, one box, one emitter). C commits a `PhotoRenderer` stub returning a flat mid-grey latent. Everyone codes against the signatures in §11.2. Changing a shared signature requires a note in `games/lensbench/CONTRACTS.md` (D owns it) and pinging the consumer.

| WP | Owns | Delivers | Consumes |
|---|---|---|---|
| **A: Glass** | `src/shared/optics/**`, `bench/**`, `audio/**` | optics core + self-test (preset EFLs within 1%; achromat longCA spread < EFL/1500; meniscus edge distortion −1…−4%; pinhole d* = 0.446 mm); the Bench screen with all interactions; spec plate; presets UI; card drawing; the whole sound library | `store` (camera, ext, N), `GLCore.attachTo` for the inset, `Finder` for the ground glass |
| **B: Street** | `street/**` | the world (every prop per §6.5 with pure motion; sky and sun calibration test; targets and answers), the live finder and overlays, controls, standpoints, walking, the meter, shake (§5.9), building the `ShotRecord` and calling `store.fire` | optics `imaging`, `samplePupil`; `sfx` |
| **C: Film** | `photo/**`, `film/**` | the photo renderer (§11.3 steps 1–7, all shutters), latent encode, `developFrame`, stocks, grain, print, halation, slit replay (SHOULD) | `World`, `LensProfile`, `ShotRecord`, `GLCore` |
| **D: Shop** | `index.html`, `main.ts`, `lensbench.css`, `core/**`, `shop/**`, `ref/**`, `CONTRACTS.md` | shell and router, store, saves and IndexedDB, the render queue driver, Tank, Lightbox, loupe, Blur Budget, tags and grading (§6.7, §6.10), onboarding, share and export, `window.__game`, reference solutions, notebook and patents (SHOULD) | everything through its interfaces |

**Integration step** (D leads; then any agent fixes in its own package):
1. `npm run check` is clean.
2. `npm run build` passes.
3. `__game.selftest()` is all green: optics, sky calibration, shake ω_rms, a deterministic latent hash for a fixed shot, develop monotonicity (more exposure never gives less density).
4. `__game.runRef('T01'…'T05')` all pass.
5. Run the smoke script (§13) at desktop and mobile; compare against the expected visuals.
6. Profile phone-tier timings with Chrome CPU ×4 throttle.
7. Fix-forward in owner files only.

---

## 13. `window.__game` and the smoke test

```ts
window.__game = {
  ready: boolean, version: '1',
  state(): { place, camera: CameraSpec, profile: {efl, fNumber, bfd, lengthMm, massG, valid, distortionPct},
             ext, focusM, shutterS, timeOfDay, worldT, standpoint, tripod,
             roll: {stock, used, capacity} | null, frames: number, undeveloped: number, tags: Record<string, boolean> },
  goto(p: Place): Promise<void>,
  setQuality(q: QualityTier): void, skipOnboarding(): void, resetSave(): Promise<void>, audioMute(on: boolean): void,
  loadPreset(id: string): void, setCamera(patch: Partial<CameraSpec>): void, loadCameraHash(h: string): void,
  setAperture(n: number | 'heart'): void, setBlades(n: 0|5|6|8|9): void, focus(m: number | 'inf' | TargetId): void,
  setShutter(s: number | 'B'): void, setStock(s: StockId): void, setFilter(f: FilterId): void,
  setTime(hours: number): void, setWorldTime(t: number): void, freeze(on: boolean): void,
  standpoint(id: StandpointId): void, aim(yawDeg: number, pitchDeg: number): void, aimAt(t: TargetId): void,
  tripod(on: boolean): void, advance(): void, rewind(): void,
  fire(o?: { seed?: number; holdMs?: number; multiple?: boolean; panYawDegPerS?: number }): Promise<{ id: string; status: string }>,
  develop(o?: Partial<DevParams>): Promise<string[]>,     // develops the oldest rewound roll; awaits renders
  frames(): { id: string; status: string; meta?: FrameMeta }[],
  openFrame(id: string): void, replay(id: string, t01: number): void,
  grade(id: string, tag?: string): { pass: boolean; measures: Record<string, { value: number; pass: boolean }>; budget: Record<string, number> },
  runRef(tagId: string): Promise<{ pass: boolean; report: unknown }>,
  selftest(): Promise<{ pass: boolean; results: { name: string; pass: boolean; got: unknown; want: unknown }[] }>,
}
```

Every random draw (tremor phases, jitter, grain, textSeed when given) is seeded. When ready, the page sets `document.body.dataset.ready = '1'`.

**Smoke script** `games/lensbench/smoke.steps.json` (owned by D), run as
`node scripts/shoot.mjs /games/lensbench/ --steps games/lensbench/smoke.steps.json --timeout 240000`, then again with `--mobile`.

| Step | Action | Expected |
|---|---|---|
| 1 | `waitFor body[data-ready='1']` → shot `lb-1-onboard.png` | Dim walnut bench, biscuit tin on the rail, pulsing needle, Q.'s note. Not black; no console errors. |
| 2 | eval `skipOnboarding(); loadPreset('triplet')`, wait 500 → shot `lb-2-bench.png` | Three section-drawn pucks; C/d/F rays converging in haze to the film line; spec plate reads ≈ `50 mm f/3.5`; ground-glass inset shows the street (non-uniform pixels) |
| 3 | eval `selftest()` | `pass: true` |
| 4 | eval `goto('street')`, `setTime(17.5)`, `standpoint('fountain')`, `aimAt('fountain')`, wait 800 → shot `lb-3-street.png` | Golden low-poly street, long shadows, fountain droplets, finder brightlines, meter arc, release button |
| 5 | eval `setAperture(16); setShutter(0.5); tripod(true); fire({seed:7})` | resolves `{status:'exposed'}` within 1 s (deferred render) |
| 6 | eval `setTime(21.5); loadPreset('portrait'); setAperture('heart'); aimAt('lamp2'); focus(1.5); advance(); fire({seed:8})` | exposed |
| 7 | eval `rewind(); goto('tank'); develop({minutes:9.5,tempC:20,agitation:1})` → shot `lb-4-tank.png` mid-way (wait 1500) | Tank, timeline, timer face |
| 8 | eval `goto('lightbox'); openFrame(frames()[1].id)`, wait 800 → shot `lb-5-heart.png` | Night print with **heart-shaped warm bokeh** from the string lights and lamps; grain; sleeve note; Blur Budget bar |
| 9 | eval `openFrame(frames()[0].id)` → shot `lb-6-silk.png` | Fountain water smoothed into silk; sharp basin |
| 10 | eval `runRef('T02')` and `runRef('T04')` | both `pass: true` |
| 11 | eval `fire` twice with `{seed:3}` on identical setups, compare latent hashes (`grade` exposes `hash`) | identical |
| 12 | mobile run: shots at steps 2, 4 and 8, plus eval `document.documentElement.scrollWidth <= innerWidth` | true; layouts per §7.1 |

The run fails on any page error, failed request, or `selftest` failure.

---

## 14. Risks and fallbacks

| Risk | Mitigation |
|---|---|
| SwiftShader too slow for subframes | The `test` tier (512 px, K = 4, 12 taps, M = 8); `fire()` returns at exposure and `develop()` awaits renders with a 60 s timeout |
| No float render targets on some phones | The RGBA8 single-subframe path (§11.3); the bench and film model are unaffected |
| Optics edge cases (TIR, misses, negative EFL, NaN) | Every function returns finite numbers or `valid: false` with issues. The renderer keeps the **last valid profile** and the spec plate shows `NO IMAGE` stamped in red. The self-test covers every preset and 200 random designs (no NaN, no throw) |
| Accumulation looks dotty on long exposures | Emitters use M = 64 independent time samples. K scales with span. A final 1 px blur only when K < 8 |
| Gather DOF halos at depth edges | Scatter-as-gather weighting; hero bokeh comes from analytic sprites; CoC clamp and mip sampling for huge blurs |
| Too nerdy for drive-by players | Pinhole onboarding with no text, presets, auto-collimate, auto thickness, the Blur Budget's plain fixes, and the spare key |
| Scene build time | Primitives only, facades from one generator, props split MUST/SHOULD; B owns both world and finder, so it can trade polish for coverage |
| Determinism breaks (`Math.random` in a sim path) | `core/rng.ts` (mulberry32) only. Review grep: `Math.random` is forbidden outside UI juice. The hash comparison in smoke step 11 |
| Read It guessing (years are 100 options) | 3 answer attempts per frame. The answer only counts with a resolving frame. textSeed is per save |
| Main-thread jank (develop, readback) | Chunked CPU develop, async readback, 8 ms GPU slices; a Worker as SHOULD |
| IndexedDB quota or private mode | Cap of 60 frames; JPEG prints; in-memory fallback with a notice |
| Audio autoplay | Unlock on first gesture; every `sfx` call is a safe no-op before that |
| Cross-team shared modules not ready | MUST imports nothing from other teams. filmcan, photochem and materials are review-round or STRETCH adapters |
| Integration drift between packages | Types written verbatim first; `CONTRACTS.md` change log; stubs at minute 15; D runs the integration checklist (§12) |
| Truth vs fun conflicts (e.g. tiny real shake) | Physics stays true in photos. Only HUD juice may exaggerate, and the finder never does |
