# Texturedle: craft, authenticity and vibe concept

**Lens:** art direction, procedural audio, fiction and tone, photographic truth.
**Slug:** `texturedle`, at `/games/texturedle/`

## Title

# TEXTUREDLE
### One surface a day, at five times life size.
*Tilt it. Roll a marble across it. Rub it with a cloth. Then name it.*

Credit line on the about sheet: *"An idea by Andrew Rankin, dictated over a sink of dishes."*

---

## 1. The core conceit: you are looking through a real macro rig

Most guessing games use an arbitrary zoom. This one uses a real lens. Each wrong guess **racks the bellows back** one step, so the hint system is the physics of macro photography. Every number on the HUD is computed for a full-frame sensor (36 × 24 mm) at a marked f/8, with circle of confusion c = 0.03 mm.

| Guess | Ratio | Field of view | Total DoF `2Nc(1+m)/m²` | Effective aperture `N(1+m)` | Bellows factor |
|---|---|---|---|---|---|
| 1 | **5:1** | 7.2 × 4.8 mm | 0.12 mm | f/48 | +5.2 EV |
| 2 | 4:1 | 9 × 6 mm | 0.15 mm | f/40 | +4.6 EV |
| 3 | 3:1 | 12 × 8 mm | 0.21 mm | f/32 | +4.0 EV |
| 4 | 2:1 | 18 × 12 mm | 0.36 mm | f/24 | +3.2 EV |
| 5 | 1:1 | 36 × 24 mm | 0.96 mm | f/16 | +2.0 EV |
| 6 | 1:2 | 72 × 48 mm | 5.8 mm | f/12 | +1.2 EV |
| reveal | ~1:10 | 360 mm | the whole object | | |

The bottom of the viewer shows a monospace readout strip, which a photographer will read and grin at:

```
5:1   f/8 (eff. f/48)   DoF 0.12 mm   FOV 7.2 × 4.8 mm   +5.2 EV
```

A **scale bar** in the lower-left corner ("1 mm", then "5 mm", then "1 cm") resizes at each step, like a micrograph. The marble stays at its physical size, so it shrinks on screen as you rack out. That one detail makes the world feel physical.

**Diffraction sets the texture budget.** At effective f/48 the Airy disk on the sensor is about 2.44 × 0.55 µm × 48 ≈ 64 µm, which is about 13 µm on the subject. Detail finer than ~10 µm would be blurred by real physics anyway. So **1024² texels over the 7.2 mm field (7 µm/texel)** is the honest maximum. Phones can drop to 512² and still look right. The physics and the performance budget agree.

**Engineering implication (important):** materials are **functions of real-world millimetre coordinates**, not bitmaps. At each magnification step we re-bake the height, albedo and roughness fields (in a worker) over the new field of view, at that step's texel density: 7 µm/px at 5:1, up to 70 µm/px at 1:2. Features stay consistent across zoom, memory stays flat, and a rust pit you saw at 5:1 is the same pit at 2:1.

---

## 2. Art direction: "the specimen bench at night"

The whole screen is a macro bench in a dark studio: black flocking paper (used in real studios to kill stray reflections), anodized graphite hardware, and engraved white numerals. The magnification scale is engraved in **orange**, the way real macro lenses colour-code their magnification ring.

### Palette (CSS tokens)

| Token | Hex | Use |
|---|---|---|
| `--flock` | `#0D0D0F` | page background (velvet/flocking black) |
| `--anodized` | `#1C1D20` | panels, tool tray |
| `--anodized-edge` | `#2E3035` | machined chamfer highlight (1 px top border) |
| `--engrave` | `#E8E4DA` | primary text, slightly warm "paint-filled engraving" |
| `--mag-orange` | `#E8772E` | magnification ratios, active tool |
| `--af-green` | `#8DD27E` | correct-attribute dot ("focus confirmed") |
| `--amber` | `#E9B949` | partial match |
| `--card` | `#F1ECE1` | specimen slide mounts, share card stock |
| `--ink` | `#1E1B17` | text on card |
| `--grey-18` | `#777777` | 18% grey card (sRGB 119 ≈ L\*50), used as the reveal backdrop and hub thumbnail matte |

Feedback never relies on colour alone. Every state also has a shape: ● confirmed, ◐ partial, ○ miss.

### Typography (bundled with `@fontsource`, OFL, no runtime downloads)
- **IBM Plex Sans Condensed**, uppercase, tracking +0.12em, for "engraved" labels on the rig (TEXTUREDLE wordmark, tool names, ratios).
- **IBM Plex Mono**, for all live readouts. Digits roll like an odometer when the bellows rack.
- **Fraunces** (variable, soft optical size), for specimen cards. Roman for common names, italic for the mock-Linnaean binomial.

### Scene lighting (Three.js)
- **Key:** a directional "raking" light at 20° elevation from the upper left (azimuth 135°), 5600 K (`#FFF1E4`). The upper-left placement is deliberate: human vision assumes light from above, so bumps read as bumps. Tilting the camera ±5° changes the light-to-surface angle, which is the whole point of Andrew's 5° tilt. Raking light is how conservators photograph brush strokes.
- **Fill:** a hemisphere light at 0.12, slightly cool.
- **Reflections:** a tiny procedural PMREM environment: a black room with one gridded rectangular softbox and a thin strip light. On glossy paint and on the marble you see a **softbox catchlight**, a rounded rectangle with a faint grid. Photographers recognise their own lighting in it.
- **Self-shadowing:** a 16-step heightfield shadow ray-march in the fragment shader, plus **AO and curvature maps baked at generation time**. Curvature drives wear (convex edges lose paint first) and grime (concave pits collect it). That is how real weathering works, and it makes every material look lived-in.
- **Tone mapping:** AgX, linear workflow, sRGB out. AgX keeps rust oranges from going neon.

### Lens character (post-processing kept cheap for phones)
- **Real focus plane.** Depth of field is computed in the material shader from |h − focusHeight| and turned into a mip bias. There is no full-screen DoF pass. At 5:1, a 0.12 mm DoF on 0.4 mm of rust relief means **only a ribbon of the surface is sharp**. That is correct, and it is gorgeous (see Wow #2).
- **Scheimpflug tilt.** The ±5° camera tilt also tilts the focus plane across the frame: 7.2 mm × sin 5° ≈ 0.63 mm of depth change, about five DoF-widths. Tilting therefore sweeps a sharp diagonal band across the subject. This is real tilt-shift optics, built from Andrew's tilt mechanic.
- **Longitudinal chromatic aberration ("bokeh fringing").** Out-of-focus highlights *in front of* the focus plane fringe magenta, and those *behind* it fringe green. Real macro lenses do exactly this. Implemented as a ±1 px R/B offset weighted by signed defocus.
- Close-focus **vignette** (−0.6 EV at the corners) and a whisper of sensor noise in the shadows.
- **Sensor dust spot (easter egg).** One soft grey blob stays fixed in screen space while the texture moves under it. At effective f/48 dust always shows. Tapping it gives: *"Sensor dust. At f/48 it was always going to show."* with a bulb-blower *pff* that clears it. This earns the "Blower" badge.

### HUD furniture
- Corner crop marks around a **3:2** frame (sensor aspect).
- A live **luminance histogram**, 64 bins, read back from a 64 × 64 downsampled target every 250 ms. Rust has a fat midtone hump, glossy enamel has a spike near black plus a highlight sliver. It is a quiet clue for people who read histograms.
- A **focus-peaking toggle** (red speckle on in-focus contours), the same feature mirrorless cameras have.
- **Lamp selector** (free and unlimited, part of the photographer's honest kit): **Raking** (default), **Ring** (flat, shows true colour), and **Cross-pol**. Cross-pol has a rotating polarizer dial: specular falls off by Malus's law, I = I₀cos²θ, and at 90° all glare is gone. Metals vs. dielectrics, gloss vs. matte: the dial teaches the difference in your hands.

### Transitions
- Wrong guess: a **9-blade iris** with rounded blades (SVG) closes, then the bellows "breathe" (audio), readouts roll, and the iris reopens one step wider. It uses a critically-damped spring, ~600 ms. Reduced-motion users get a 150 ms crossfade.
- Loading copy: *"Stopping down…"*, *"Warming the lamp…"*, *"Cleaning the sensor (mostly)…"*

---

## 3. The probes, made physical and photographic

Every tool is something that actually lives on a photographer's bench.

- **The marble:** a 2.5 mm clear glass bead "from the jar of marbles on the bench". At 5:1 it is a third of the frame; at 1:2 it is a speck. It is rendered with `MeshPhysicalMaterial` transmission (IOR 1.52). It rolls on a Rapier `HeightField` collider, catches in pits, and hops scratches. **It is also a real ball lens** (Wow #1).
- **Fine cloth:** a pale blue-grey microfiber **lens cloth**, with a tiny woven tag that says *WIPE GENTLY*. It is a 24 × 24 Verlet cloth that drapes tightly into fine relief.
- **Rough cloth:** **burlap** cut from a light-stand sandbag. It is stiffer (higher bend constraint) and loose-weave. It only bridges major features, and it **snags** on sharp edges with stick-slip tension.
- **Tilt ±5°:** drag the viewer edges on desktop or use arrow keys. On phones, tap "Hold like a loupe" to enable **gyroscope tilt**. iOS needs the DeviceOrientation permission tap. Tilt is clamped and calibrated to the phone's resting pose.

**Transfer (the best clue, and it's real):** cloth picks up what the surface sheds. Each cloth accumulates a stain texture in its own UV space. Rust leaves **orange powder**, chalked paint leaves pale grey, bread leaves flour, denim leaves indigo (textile labs call this **crocking**), birch bark leaves white betulin, moth wings leave tan scales, graphite leaves silver, and soot leaves black. Microfiber picks up more and shows it better; burlap hides it. The cloth slowly accumulates a **frottage**, a rubbing of the high points (Wow #3).

**Haptics:** on Android, `navigator.vibrate` gives 4 ms on marble ridge crossings and 8 ms on burlap snags. iOS fails silently.

---

## 4. Procedural audio: surfaces you can hear

Master chain: `DynamicsCompressor` → `Convolver` with a generated small-room impulse (exponentially decaying stereo noise, RT60 ≈ 0.35 s), "a small studio". All sounds are synthesized on demand; there are no samples.

### The Singing-Surface principle (headline audio idea)
Drag anything across a **periodic** texture at speed *v* over pitch *p* and it sings at **f = v / p**. This is real; it is how highway rumble strips and a fingernail on a comb work. Random textures hiss; periodic ones have a note.
- 11-wale corduroy (2.3 mm pitch) at 60 mm/s: a 26 Hz flutter-buzz.
- Diamond knurl (30 TPI ≈ 0.85 mm) at 60 mm/s: a 70 Hz growl.
- Record grooves (~0.1 mm pitch): a 600 Hz whine.
- Rust: a crackle with no pitch.

Implementation: sample the heightfield along the probe path into a ring buffer, find its dominant period with a cheap autocorrelation over the last 256 samples, and drive a band-passed sawtooth when periodicity confidence > 0.6, crossfading to filtered noise otherwise. Players learn to "play" surfaces, and it is a clue a sighted, colour-blind or deaf player can each get through some channel (see captions below).

### Voices
- **Marble roll:** pink noise → band-pass with centre at 400 Hz + 3 kHz × local roughness, gain ∝ speed. Ridge crossings fire **glass ticks**: modal synthesis, partials at ×1, ×2.32, ×4.25 of ~5.1 kHz, decay 40 ms. **Glossy enamel is nearly silent; rust chatters.** That contrast is a clue in itself.
- **The knock:** lift and drop the marble (flick upward on touch, right-click on desktop) and the *object's body* answers through a modal bank defined per recipe:
  - **Mailbox** (thin sheet-steel box): partials 212 / 337 / 529 / 811 / 1240 Hz, decays 0.6–1.4 s, plus a 30 ms **door-latch rattle** (amplitude-modulated noise). *Hollow* is the giveaway.
  - Stone: 80 ms thud with damped high partials. Wood: 2–3 warm partials, 0.12 s. Bread: a soft dead *puff*. Cast iron: heavy *clank*, 0.3 s.
- **Fine cloth:** high-passed noise (3–9 kHz), gain ∝ drag speed, AM by the Singing-Surface rate.
- **Burlap:** 0.8–2.5 kHz band noise with **stick-slip**. Tension integrates while the cloth is pinned on an edge; at threshold it releases a click plus a 40 ms scritch burst and a haptic tick.
- **Rig foley:** focus-ring detent ticks (2 ms noise burst into a 1.8 kHz resonator), bellows breath (low-passed noise, 500 ms swell), polarizer ratchet.
- **Solve sting (no music):** the shutter fires as a leaf-shutter *tk… tk* with the two clicks separated by the real exposure time (1/200 s = 5 ms, felt more than heard). Then the marble drops back into its glass dish and **bounces with restitution 0.78**: each interval is 0.78× the last, each tick quieter, *tink, tink, tink-tink-tinktink*. It is the most satisfying sound in the game and it is pure physics.
- **Captions** (on by default when the system's reduced-motion or captions settings suggest it, otherwise a toggle): *[hollow metallic ring, latch rattles]*, *[gritty crackle]*, *[low buzz, rising with speed]*.

---

## 5. Fiction and tone: The Nettle Lane Survey

**Voice:** a museum label written by someone who loves the thing. Deadpan, warm, one real fact per card, never twee.

**The walk (days 1–30, hand-curated):** the first month is a slow walk from the road into one house, told only through surfaces. Day 1 is the **mailbox at the end of the drive**. Then gravel, picket-fence paint, porch boards, a coir doormat, a brass door knocker's patina, hallway wallpaper, a kitchen cutting board, a cast-iron pan, a leather camera strap, a contact sheet's paper with a coffee ring... and on **Day 30, the stainless sink of a basement darkroom with crystallized fixer stains**. That card's back says *"Somebody still uses this room →"* and links to `/games/darkroom/`. Nobody is ever seen or named; the house tells you who lived there. After day 30 the library plays shuffled, and every 7th day "the mail comes": a paper or postcard surface.

**Collection screen, the Light Table:** each solved day becomes a **35 mm slide in a card mount** on a backlit light table. The mount is stamped `001 · MAILBOX · 09 OCT 26`. A loupe follows the cursor or finger and magnifies the slide (yes, a loupe over a loupe). Missed days are empty mounts with a pencilled date.

**Streaks as film:** the streak counter is a **frame counter**, `FRAME 12/36`. Finishing 36 consecutive days "finishes the roll". It develops into a **contact sheet**: 36 macro frames with edge printing in an invented stock, **SURVEY 100**, with frame numbers `12 ▸ 12A`, sprocket holes and a grease-pencil circle on your best frame. It is printable and shareable.

**Microcopy:**
- Wrong guess: *"Not cork. Racking out to 4:1."*
- Solve: *"Specimen confirmed. Frame 12 exposed."*
- Loss: *"Released at 1:2. Today's surface was…"*
- Empty light table: *"Nothing on the table yet. Surfaces keep; come back tomorrow."*

### Day 1 specimen card (final copy, draft)
> **No. 001 — Rusty mailbox, latch tab**
> *Ferrum rubiginosum, var. capsa epistularis*
>
> Galvanized steel under black enamel, at the corner of the door where a thumb has opened it a few thousand times. The paint failed at the edges first, as paint does. The zinc spent itself protecting the steel; that white crust is the evidence. Then the steel did what iron has always wanted to do. The orange is lepidocrocite and the brown is goethite: rust is a family, not a colour. It takes up several times the room of the metal it eats, which is why it lifts paint into blisters instead of just staining it.
>
> `5:1 · f/8 (eff. f/48) · 1/200 s · ISO 100 · 7-frame stack @ 60 µm · flash, raking 20°`

The stack numbers hold up: about 0.4 mm of relief at 0.12 mm DoF, stepped at roughly half a DoF, comes to 7 frames.

---

## 6. Day 1 recipe: rusty mailbox, in real units

The layers are listed bottom to top. All heights are in µm and features are in real mm.

1. **Substrate:** 24-gauge (0.6 mm) galvanized steel. **Spangle**: Voronoi zinc grains 2–8 mm with faint dendritic texture, ±6% albedo, visible only where paint is gone. Faint rolling striations along X, 2 µm amplitude, 50–200 µm wavelength. `#A7ABAE`, metalness 1, roughness 0.35.
2. **Primer:** zinc-phosphate grey `#8A8C87`, 25 µm.
3. **Topcoat:** black gloss enamel, 50 µm, with **orange-peel** waviness (the real paint-trade term): 1–3 mm wavelength, 3 µm amplitude. Roughness 0.15 → **chalked** by UV to 0.6, with albedo lifting `#2B2D30` → `#5B5E62` on up-facing areas.
4. **Wear:** a polished **thumb zone** around the latch (roughness 0.2, paint thinned to primer in a crescent). **Scratches** 20–40 µm deep and 30–80 µm wide, biased into arcs around the latch pivot, the way a hand actually moves.
5. **Corrosion:** rust nucleates at scratches and convex edges (curvature map). **Pits** go 100–250 µm deep. **Tubercles and scale** rise 200–400 µm, coloured by an oxide mix: lepidocrocite `#C1652F`, goethite `#9C6A2E`, hematite `#7A3324`, magnetite flecks `#2A2522`. Roughness 0.9, metalness 0. **Blisters** of 0.3–2 mm diameter push paint up 80–150 µm around rust fronts, with **filiform corrosion** (worm-track threads under the paint) at their edges. **White rust** (zinc carbonate, `#D9D6CC`, roughness 0.95) forms a crusty halo between rust and paint.
6. **Gravity:** rust **streaks run downward** from every bloom. They are albedo-only stains with slight roughness increase, plus the classic tear-drop tail.
7. **Contaminants:** dust motes of 10–50 µm, one **grass seed husk**, and one **spider-silk strand** (3 µm wide, invisible until raking light catches it at the right tilt; a secret for tilters).

---

## 7. Library sketch: recipes with physical "tells"

| Surface | Key scales (real) | Tilt / lamp tell | Marble / sound tell | Cloth tell |
|---|---|---|---|---|
| Orange peel | oil-gland pits 0.5–1.5 mm | waxy wet specular | soft, dead | oily sheen darkens cloth |
| Sandpaper P120 | grains ~125 µm, closed coat | glittering grit facets | loud crackle | microfiber **pills and leaves lint** |
| Corduroy, 11-wale | 2.3 mm ridges | nap sheen flips with direction | **marble channels along wales**; buzz | burlap drags in pitch |
| Vinyl record | grooves ~0.1 mm | radial anisotropic sheen | — | cloth **sings ~600 Hz** |
| Diamond knurl | 0.85 mm (30 TPI) | sharp facet glints | marble jitters; growl | burlap snags on every peak |
| Cork | cells 20–40 µm, lenticels 0.5–2 mm | matte | squeaky-dead thump | crumbs on cloth |
| Strawberry | achene pits ~1 mm (the "seeds" are the fruits) | wet gloss | soft | pink juice stain |
| Sourdough crust | blisters 0.5–3 mm | flour-dusted matte | papery crackle knock | **flour transfer** |
| Cast-iron pan | as-cast sand grain 0.1–0.3 mm | satin black polymer | heavy clank | faint black |
| Brushed aluminium | scratches ~5 µm, 1-D | **anisotropic streak highlight** | smooth hiss | grey smudge |
| Golf ball | dimples ~3.8 mm, ~0.25 mm deep | soft dimple shading | marble settles in a dimple | — |
| Birch bark | lenticel dashes 2–10 mm | papery curls | hollow tap | **white betulin powder** |
| Granite + lichen | grains 1–5 mm | **mica flashes at one tilt** | stony tick | green-grey dust |
| Moth wing | scales ~60 × 150 µm, shingled | iridescent shimmer | — | **tan scale dust** |
| Window frost | fern dendrites 0.2–5 mm | sparkle | marble **skates** | fine cloth **wipes a clear streak** (melt) |
| Denim, 3×1 twill | diagonal wale ~0.6 mm | twill sheen | low buzz | **indigo crocking** |
| Honeycomb wax | worker cells ~5.3 mm | waxy translucency | soft | sticky; cloth drags |
| Cold-press cyanotype | paper tooth 0.2–1 mm, Prussian-blue fibres | ring lamp shows true blue | papery | — *(Darkroom tie-in)* |
| Baryta photo paper | glossy, near-flat | mirror softbox catchlight | silent | fingerprint left behind |

Each recipe also stores a **knock body** (modal partials), a **transfer colour and amount**, and a **reveal prop**. The first 30 days get bespoke low-poly props; the rest get a specimen-card illustration.

---

## 8. Three wow moments (built to be screenshotted)

### Wow #1 — The marble is a lens
Roll the glass bead over the rust and it **magnifies and inverts** what's under it, with a bright caustic crescent on the far side. It's a true **ball lens**: EFL = nD / 4(n−1) = 1.52 × 2.5 / (4 × 0.52) ≈ 1.8 mm for a 2.5 mm bead (n = 1.52). That gives a real local magnifier, in the same spirit as the tiny glass spheres in the earliest single-lens microscopes, which the field-note pool mentions. Implementation: refraction in the marble's shader samples the cached albedo and height bake at the refracted ray's ground hit, plus a hand-tuned caustic sprite. The screenshot is **a tiny glass planet with the world upside-down inside it**, sitting on rust.

### Wow #2 — The focus slice
Drag the focus ring (or pinch on phones) and a **razor-thin ribbon of sharpness, 0.12 mm deep**, crawls over the terrain like an MRI slice, with **focus peaking** sparkling red along it. Tilt 5° and the ribbon swings diagonal (Scheimpflug). Rust tubercles become islands and pits become lakes: a live topographic map you are drawing with optics. Everything else melts into magenta-and-green-fringed blur. The screenshot is **a red contour line of perfect sharpness winding through orange fog**.

### Wow #3 — Your rubbing
Every drag of the fine cloth deposits a **frottage** of the high points plus the transfer stain. After you solve, the cloth lifts off, flips over, and *is your share card*: an abstract orange-and-grey rubbing on pale blue microfiber, stamped `TEXTUREDLE No. 001 · 3/6 · solved at 3:1 (12 mm)`. It is generated to a canvas PNG and sent with `navigator.share` with a file where supported, or download. Everyone's rubbing of the same day is different, because it's a record of *how you touched it*.

**Bonus, the reveal dolly:** on solve, a continuous camera pull-back from 5:1 to the whole mailbox on its post in late-afternoon grass. The marble rolls off the top edge and drops into the lawn. The 18% grey card and a 24-patch reference chart are leaning against the post, because a real product photographer would have put them there.

---

## 9. Share text (spoiler-free, monospace-friendly)

```
TEXTUREDLE No.001  3/6
[5:1 ○][4:1 ◐][3:1 ●]
solved at 12 mm · ● marble  ≈ cloth  ⟋ tilt
andrew-rankin.com/games/texturedle
```

Probes are recorded, not penalised. "Solved with tilt only" is the brag.

---

## 10. Small truths checklist (for review rounds)

- [ ] Every HUD number is computed from the formulas in §1, never hard-coded.
- [ ] The scale bar is correct at every ratio; the marble's on-screen size matches 2.5 mm at that scale.
- [ ] Light is from the upper left; the softbox catchlight is visible on gloss and on the marble.
- [ ] Magenta-in-front, green-behind fringing (not the reverse).
- [ ] Glossy paint is quiet under the marble; rust is loud.
- [ ] Each sound clue has a caption; each colour state has a shape.
- [ ] The Day 1 card's chemistry is correct: lepidocrocite orange, goethite brown, zinc white rust, rust volume expansion.
- [ ] No brands anywhere: no marble makers, no lens or film brands, no postal-service liveries. The film stock is the invented "SURVEY 100".
