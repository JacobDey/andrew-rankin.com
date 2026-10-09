# Plates — concept through the TACTILE PHYSICS TOY lens

**Title proposal: RUBY SECTOR**
*Subtitle: The Skerrow Plates, 1886. Fourteen glass negatives. Develop what the lens saw.*
(Fallback title: *The Skerrow Plates*.)

**One line:** a storm-rocked darkroom in a dead lighthouse, drawn in 1-bit dither under a ruby lamp, where every way of finding a clue is something you physically do to the glass: rock it, flash it, tilt it, back it with velvet, smash it and rebuild it.

**Shared code:** the liquid and tray physics are the same virtual-pipes module the Darkroom concept uses. Put it in `src/shared/fluid/` and write it once. What Plates adds is the glass, the depth, the lamp and the sea.

---

## 0. The story (all original, kept short; the deduction lens will flesh it out)

**Skerrow Light** is a rock lighthouse on Mallen Skerry. In November 1886 the (fictional) Coast Lights Commission sends a photographer, **Honora Vail**, to record the fitting of a new lens. She shoots on the new *gelatin dry plates*. These are historically right for the story: unlike wet collodion, a dry plate holds its latent image for months. On the night of the 14th the brig *Annet Lowe* runs onto the reef and eleven men drown. That is the reef the light's **ruby sector** (a red pane that warns ships off the danger arc) was meant to guard. By morning one keeper is dead, the lens fitter is gone and Honora has vanished.

You are **her apprentice**. A year later you row out to the decommissioned tower and find her darkroom in the old coal store, plus a sealed tin of 14 exposed plates in the oil store.

**Cast (9):** Elias Brannock (Principal Keeper), Mercy Brannock (his wife), Joss Brannock (their son, 15), Cuthbert Lyle (Assistant Keeper, in debt to a salvage ring ashore), Aurelio Sant (lens fitter), Pell (relief boatman stranded by the weather), Silas Orme (the brig's mate, who washed up alive), Honora herself, and **Tallow**, the lighthouse cat. Tallow is somewhere on every plate, as a hidden collectible.

**The truth:** At dusk Lyle took the ruby sector pane out, so the reef read as safe white water. Joss saw him do it and Lyle threatened him. Sant drowned on the rocks trying to warn the brig with a hand lantern. Orme recognised Lyle as the ring's contact. On the stair, Mercy pushed Lyle to save her son, and the keeper's log says he "fell". Honora worked it all out from her own plates. She hid the tin, left on Pell's boat, and let the Commission record her as missing.

**The twist is a toy.** Lyle hid the stolen ruby pane where nobody would look for red glass: in the ruby chimney of Honora's darkroom lantern. **The lamp you have worked under the whole game is the missing evidence.** The final clue is to lift the chimney off your own safelight, lay it on the light table and read the Commission etch: `C.L.C. — SKERROW — SECTOR III`.

---

## 1. The room: one bench, five stations, one sea

The darkroom is a single long bench under a low curved ceiling (the inside of the tower wall). The camera has fixed station views. Swipe or drag-pan, or press `1`–`5`, to dolly between them (0.6 s ease-in-out). Each view sways ±5° with the cursor or gyro, the same "head tilt" as Texturedle, which gives free parallax on the dither.

1. **Chemistry shelf:** brown bottles, a brass beam balance, a glass graduate, a stirring rod.
2. **Three trays:** DEVELOPER (pyro), WATER, HYPO (enamel trays, 30×24 cm). The plate tin and the tongs sit here too.
3. **Light table:** frosted glass lit from below, a black velvet cloth, a brass loupe.
4. **Drying line:** a cord strung between two nails, with clothespins. **This is the save-state UI.**
5. **The Tower Section:** a framed cross-section drawing of the lighthouse with pins and thread. This is the deduction board.

Above the trays hangs **the ruby lantern** on a hook, and in the curved wall there is **a porthole onto the storm**.

### The sea is a co-player
Every 9–14 s (random) a big wave hits the rock. The tower flexes, as real rock towers do. That one event drives every physics object:

- The camera gets a 1.5 px shake that decays (τ = 0.25 s).
- Every tray gets a lateral pseudo-acceleration pulse of 0.4 m/s² for 120 ms, so the liquid sloshes **on its own**.
- The lantern gets a swing impulse, so **dithered shadows sweep the room.** This is the money shot of the game.
- The prints on the drying line sway, and loose bottles chatter. Sound: a sub-bass thump at 38 Hz, then a long filtered-noise hiss.

`Reduced motion` turns the shake off and drops the impulses to 25%.

---

## 2. The 10-second / 1-minute / 10-minute fun

- **10 s:** The plate is already in the developer. You grab the tray rim and rock it. Ruby-lit liquid slops across the glass with sparkling 1-bit specular glints, and a **face blooms out of nothing**, highlights first, like a ghost arriving. Then a wave hits the tower and the whole room swings.
- **1 min:** The full plate cycle. Tongs lift the plate (it drips), dunk it, rock it, and you watch it go too dark. You yank it into the water, then the hypo, and watch the milky halide **clear in a wave** from wherever the liquid flows. Now the plate is safe, so you **lift the ruby chimney: the palette dissolves from ruby to bone-white.** At the light table you tilt the glass and see past the man in the doorway. You slide the velvet under half the plate and that half turns positive.
- **10 min:** Mix a softer developer to save a face lost in shadow. Pop a deliberate white-light flash mid-development (Sabattier) to make glowing outlines pull a limping figure out of a 20-second dusk blur. Rebuild a plate that arrived in seven shards. Pin figures to floors on the Tower Section with thread. Hunt Tallow. Then make a photogram of your own keys and lace on a blank plate and export it as a share card.

---

## 3. Input mappings

| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Pan station | drag empty wall, `A`/`D`, `1`–`5` | swipe on empty wall |
| Rock tray | drag a tray rim (direction = tilt axis). `Space` auto-rocks corner to corner | one-finger drag on rim. Optional "Tilt with phone" (DeviceOrientation, behind a permission button) |
| Poke liquid | click (ripple), hold-drag (finger wake) | tap / drag in the liquid |
| Tongs | press on a plate to grip, drag to carry, release to drop, flick-release to throw. Right-click flips the plate | press-hold to grip, flick to throw, two-finger tap flips |
| Lantern | tap lantern = bump-swing. Wick knob: drag in a circle (or vertical drag). Chimney: drag up to lift (white light) | same. Circular gesture for the wick |
| Light table | drag the plate to tilt ±12° (`Q`/`E`/`W`/`S`). Wheel = loupe power | one-finger drag tilts, pinch on loupe = power |
| Velvet | drag any edge or corner particle | same, multi-touch can grab two corners |
| Loupe | drag it | drag it |
| Metronome (timer) | flick the arm to start, drag the sliding weight to set the tempo | same |
| Save | drag a blank print from the box onto the line | same |
| Restore | double-click a pinned print. `Z` = last auto-pin | double-tap |
| Story-only shortcut | double-click a plate: the tongs auto-carry it to the next tray and auto-rock | double-tap |

Grip feel: the tongs follow the pointer through a spring (k = 400 s⁻², ζ = 0.7). The plate hangs from the grip point as a damped pendulum (L = 6 cm, c = 1.2). The lag is the heft.

---

## 4. Physics models

### 4.1 Tray liquid (shared virtual-pipes heightfield)
- Grid 64×48 at l = 5 mm. Depth starts at 8 mm. Floor height b = x·sinθx + y·sinθy (tray tilt), plus the plate's 2 mm thickness where it lies.
- Each step:
  - `F_i→n ← max(0, λF + Δt·g·A·(H_i − H_n)/l)`, where A = l², λ = 0.995 and H = b + d.
  - Scale the outflow by `K = min(1, d·l² / (ΣF_out·Δt))`.
  - `d += Δt(ΣF_in − ΣF_out)/l²`.
- Run 4 substeps at Δt = 1/240. The CFL limit `l/√(gd)` ≈ 18 ms, so this is safe.
- Tray acceleration adds an effective head term `H += (a·x)/g`. This is how the sea and the tray clack inject energy.
- Real slosh period at 8 mm depth is about 2.1 s. Keep it real, because it feels right.
- **Spill:** volume above the rim (25 mm) becomes drip particles that leave a permanent dithered stain on the bench. The stain map is saved.
- Flow speed `|u|` = net flux / (l·d̄). It feeds the development and fixing models.
- A tray sleeps when its kinetic energy is below ε. Only the tray you are touching runs at full rate. The others run at ¼ rate.

### 4.2 Tray body
- Tilt follows the drag target, clamped to ±9°: `θ'' = k(θ* − θ) − cθ'`, with k = 120 s⁻² and ζ = 0.55.
- On release, θ* = 0. On the zero crossing the tray **clacks** at volume ∝ |θ'| and fires a fluid impulse.

### 4.3 The deep plate (Plates' signature object)
Honora's (fictional) "deep" emulsion records **four depth layers** k = 0..3. At load, each story plate is rendered from a posed low-poly 3D tableau into depth-sliced latent maps `E_k(x,y)` (256×192, R8).

Development per texel (GPU ping-pong, WebGL2):
```
w      = smoothstep(0.3mm, 1.0mm, depth)            // wet coverage: dry spots don't develop
R(T)   = 2^((T-18)/6)                               // temperature, room starts at 14 °C
dP_k   = w · a · R(T) / (1 + κ·b) / τ_k · dt        // τ_k = 6 s · 1.9^k  → 6, 11, 22, 41 s
D      = Σ_k α_k · E_k^γ · (1 − e^(−P_k)) + D_fog
da/dt  = −β·dD/dt + ρ·(|u|/u0)·(1 − a) + ∇²a       // fresh developer arrives with flow
db/dt  = +β_b·dD/dt − ρ·(|u|/u0)·b, advected by u   // bromide by-product
```
Parameters: κ = 3, β = 0.8, ρ = 1.5, u0 = 0.05 m/s, γ (contrast) = 0.8–1.6, set by your developer mix.

What this gives you for free:
- **Development depth is a slider you control with time and agitation.** Pull the plate early and you only see the foreground. Leave it in and the background arrives, but the front layer blocks up and goes dense.
- **Bromide drag:** if you always rock the same way, streaks trail downstream of dense areas. That is a real artifact. Rocking to alternating corners fixes it, so good technique emerges without a tutorial.
- **Air bells:** tilt too hard and part of the plate goes dry, leaving a pale blotch.

**Viewing (light-table shader):**
- Each layer samples at `uv_k = uv + tan(tilt)·z_k`, with z = [0, .02, .05, .09].
- Transmittance is `T = Π 10^(−D_k(uv_k))`.
- Tilting the glass slides the layers apart, so **you can look past the man in the doorway.** Over-developing the front layer walls the back off, which is the trade-off.

### 4.4 Light, fog and the Sabattier flash
- The lantern is a pendulum: `θ'' = −(g/L)·sinθ − cθ'`, L = 0.25 m, c = 0.4. One point light casts one shadow map, so the swing moves every shadow.
- Wick w ∈ [0,1], and flame intensity is w² × flicker (1/f noise, ±8%).
- **Fog on unfixed plates:** `dF/dt = I_white·1.0 + I_ruby·0.015·w²`. A bright ruby lamp lets you see more but fogs slowly. That is a real trade-off, kept small.
- **White light** comes from lifting the chimney or opening the door (the door throws a wedge of light, and fog follows that wedge).
- **Sabattier flash:** a short white flash *during* development adds `ΔE_k = F·e^(−3D)` to all layers. Undeveloped areas fog and partially reverse.
  - Mackie lines glow where the bromide gradient is high: `line = clamp(|∇b|·12)`. They become thin bright outlines on hidden edges.
  - **This is a real 1860s effect and a deduction tool.** It is how you pull the limping figure out of the black on plate 5.

### 4.5 Fixing
- The plate starts milky. Halide H = 1 renders as a bright, cloudy, additive dither.
- `dH/dt = −k_f · w · (0.3 + |u|/u0)`. It clears in about 6 s with agitation and about 15 s still.
- **The clearing front visibly chases the flow.**
- Once H < 0.02 everywhere, the plate is light-safe. Light no longer fogs it, and the game says so with a soft "tink" and a 1-pixel glint run around the edge.

### 4.6 Glass: carry, drip, throw, shatter, rebuild
- **Lift-off suction:** you need an extra 0.15 s of pull, then a *schlurp* and a sheet drains off. Drip rate is `12·e^(−t/1.5)` drops/s.
- Drops follow gravity. In a tray they make a ripple. On the bench they leave a wet spot that evaporates over 20 s (lerp the dither threshold).
- **Shatter:** an impact over 1.8 m/s, or a throw. Voronoi fracture with 5–9 seeds clustered around the impact point plus 3 radial cracks. The shards keep their UVs (image intact) and become Rapier rigid bodies.
- **Rebuild:** on the light table, drag and rotate the shards. They snap when within 4 mm and 6° of their true pose (*tink*, and a rising pentatonic note per snap). Cracks render as 1-px paper-colored lines.
- **Plate 10 arrives broken** (the tin was dented), so rebuilding is a required puzzle that teaches the toy.

### 4.7 Velvet (ambrotype positive)
- A thin glass negative seen against black looks **positive**. That is how 1850s ambrotypes worked, and here it is a cloth.
- The velvet is Verlet cloth: 20×14 particles, structural and shear constraints, 8 iterations, gravity, collision with the bench and plate box.
- The cloth renders a coverage mask under the plate. Where velvet sits behind the glass, show the reflectance `1 − T` (positive). Elsewhere, show the backlit `T` (negative).
- **Draping half a velvet across a plate and seeing a split positive and negative image is the screenshot people share.** Plate 12's key detail (Mercy's ring on the hand at Lyle's back) only reads as a positive.

### 4.8 Beam balance and mixing (the 10-minute layer; pre-mixed bottles exist)
- Spoon powder: about 300 2D grain particles fall into the pan.
- Balance: `Iθ'' = (m_L − m_R)·g·a·cosθ − m_beam·g·d·sinθ − cθ'`. It rings for about 4 s, and the needle reads grams.
- Stir in the graduate: the vortex depth tracks the rod speed, and the dissolved concentration diffuses (2D Fick with stirring advection) as a dither cloud thinning to clear.
- Recipe effects:
  - **Pyro** sets speed (a scalar on R).
  - **Bromide** sets restraint (lower fog, higher γ).
  - **Too little bromide** gives a grey veil of fog.
- Soft developer (γ 0.8) saves Joss's face in the shadows on plate 7. Hard developer (γ 1.6) reads the chalk mark on the sector pane on plate 2.
- **Local reducer (stretch):** Farmer's reducer is from 1883, so it is period-correct, and it uses ferricyanide (a wink at the cyanotype game). A cotton swab paints `dD/dt = −k_r·brush·D` to dig a detail out of dense areas.

### 4.9 Drying line = save states
- The cord is a Verlet rope (24 nodes, slight sag). Each print hangs by a clothespin constraint. Flick a print and it swings. Waves sway them all.
- **Each pinned print is one save state.** Its thumbnail is that moment, dithered.
- 6 manual slots, plus **auto-pins before anything irreversible:** white light with unfixed plates, any throw, any shatter.
- Design principle: **destruction is free to try and cheap to undo.** People will throw the plates, and the game should let them, then hand them back.
- Restore is an 8-frame threshold-sweep dissolve, with the sound of a reel spun backwards (reversed noise burst).
- Save format (IndexedDB) holds:
  - per-plate P_k, D, H and F (R8/R16 arrays);
  - shard poses;
  - the stain map;
  - chemistry, tray volumes and the board pins.

---

## 5. How each clue is gated by a toy verb

| Plate | Moment | The physical act that reveals it |
|---|---|---|
| 2 "The New Lens" | Sant and Elias at the lens | Hard developer plus full depth plus a tilt: the chalk "III" on the ruby pane sits on layer 2 |
| 3 "Supper" | Keepers at table | Tilt to look *under* the table: Lyle's bandaged shin (layer 1) |
| 4 "Cracked Lamp" | Honora's own ruby lamp | Loupe at 4× on the crack in her chimney |
| 5 "Dusk, 20 s" | A ghost carries a red pane along the gallery | Sabattier flash: Mackie outlines show the uneven limp-blur |
| 7 "The Stair, 6 pm" | Lyle's hand on Joss's collar | Soft developer or reducer: the face is lost in a dense shadow otherwise |
| 9 "Magnesium, 11:20" | Rescue on the rock | Develop deep (layer 3): Sant's lantern in the surf, far behind |
| 10 "Dented" | Orme ashore | Rebuild 7 shards: Orme's tin token marked with the ring's sign |
| 12 "The Fall" | Lyle on the stair | Velvet positive: Mercy's ring on the pushing hand |
| 14 "Self-portrait" | Honora under the lantern | **Take the chimney off your own lantern** and read its etch on the light table |

The other five plates (1, 6, 8, 11, 13) are quieter moments that carry names, faces and Tallow.

**The Tower Section (deduction board):** for each plate, push a brass pin onto the floor where each figure stood. Tug thread off a spool (Verlet, it sags and catches on other pins) to that figure's name card, then pick a fate verb card.

- A plate **"fixes"** when every figure on it is right. Its pin heads turn from ruby to bone, with a struck-bell chord.
- Wrong guesses cost nothing. Every plate has at least two figures, so blind guessing is slow.

---

## 6. Rendering, palettes and juice

**1-bit look:**
- Render at an internal height of 360 px on phones and 540 px on desktop, then nearest-upscale.
- Luminance goes against a procedurally generated 64×64 blue-noise threshold (void-and-cluster at load, under 60 ms). The threshold is offset by camera yaw/pitch so the dither doesn't crawl while the camera sways.
- Depth and normal Sobel outlines are drawn in ink.
- Liquid specular is computed at full strength and then dithered, so a slosh turns into **sparkle**: crawling glints that read as wetness in two colors.

**Palettes (crossfade = threshold sweep):**
- **Ruby** (safelight): `#140403 / #c8442c`.
- **Bone** (white light): `#191613 / #e9e1cf`.
- **Storm** (porthole): `#0b0f14 / #8fa3a8`.
- **Unlockable "emulsions",** one per fixed plate:
  - Albumen `#2a1a0e / #e6cfa3`;
  - Platinum `#1e1e1c / #d9d6cc`;
  - **Cyanotype** `#0e2a4a / #e8eef2`, a nod to game 2.

**Sound (all WebAudio, synthesized):**
- **Slosh:** brown noise through a bandpass. Centre 300→900 Hz with fluid kinetic energy, gain ∝ √KE.
- **Drip:** a Minnaert bubble ping (`f ≈ 3.26/r`, r = 1–3 mm, so 1–3 kHz), a 40 ms upward chirp, then a 60 ms decay.
- **Glass:** modal synthesis, free-bar partials ×1, 2.76, 5.40, 8.93 at about 2.1 kHz base, decay 0.4 s. Shatter = 30 randomized glass grains plus noise.
- **Tray clack:** a two-mode enamel thunk at 180 and 470 Hz.
- **Metronome:** wood tock. **Lantern flame:** a soft 1/f crackle.
- **Wave hit:** 38 Hz thump, a hiss, and the bottles chattering.

**Haptics:** `navigator.vibrate` (Android only) for the clack (8 ms), a snap (12 ms) and a shatter (40-20-40).

**Particles:** dithered drips, a puff of powder from the spoon, a glint run when a plate is fixed. A dust mote swarm hangs in the lantern cone. It is only visible under white light, and the wave hits stir it.

---

## 7. Sandbox: photograms, PNG import, share card

- **Scrap tin:** 6 blank plates, refilled from a shelf.
- **Objects box:** keys, lace doily, gull feather, fork, sea shell, the keeper's spectacles. These are Rapier bodies you drop onto a blank plate.
- **Make a photogram:** lift the chimney for N metronome beats. Object coverage comes from an overhead orthographic depth pass, so lace gives a pattern. That coverage becomes `E_0`. Then develop as normal.
- **Import PNG:** drop a PNG or use the file input. Luminance becomes `E_0`, and blurred band-passes fake `E_1..3` so tilt still parallaxes.
- **Export:** a 1-bit PNG of the plate as viewed (current palette, tilt and velvet), framed with a period caption: `Plate — developed at Skerrow Light`. Sharing your own keys as a 19th-century ambrotype is the viral loop.

---

## 8. Performance, fallback, test API

- **Performance:** the fluid runs on the CPU (64×48 × 4 substeps for one active tray, under 1 ms). Development runs on the GPU at 256×192. On CPU fallback it runs at 128×96. Cloth runs only while it is touched or settling.
- **No WebGL2:** fall back to a Canvas2D top-down "contact" mode. The trays, plate, dither, development, velvet mask and drying line still work. The 3D room and tilt parallax become a 2-layer offset.
- **Test API:** `window.__game` exposes:
  - `setStation(n)`, `setTilt(x,y)`, `rock(seconds)`, `poke(u,v)`;
  - `loadPlate(id)`, `develop(id, s)`, `fix(id)`, `setLight('ruby'|'white'|'dark')`;
  - `setVelvet(0..1)`, `shatter(id)`, `solveShards(id)`, `wave()`, `freezeSea(true)`;
  - `state()`, and `ready(): Promise` for screenshots.
  - `freezeSea` exists so automated screenshots are deterministic.
