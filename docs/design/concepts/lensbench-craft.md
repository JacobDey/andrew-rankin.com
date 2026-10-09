# LENS BENCH: Craft, Authenticity & Vibe (concept)

Lens: art direction, audio, fiction and tone, photographic truth. Slug `lensbench`.

## Title

**LENS BENCH: Repairs & Custom Optics, Upstairs**
Subtitle on the hub card: *Grind the glass. Cut the shutter. Walk it outside. Wait for the light.*

Alternates: *Lens Bench: Glass, Brass & Daylight* · *Lens Bench: A Camera from Nothing*.

"Upstairs" is a deliberate hook. The `darkroom` craft concept puts its darkroom in the basement of a closed camera-repair shop on Lantern Street. **This game is that shop.** You build the camera upstairs, shoot the street outside the window, and (optionally) carry the film downstairs to the Darkroom through the shared `filmcan`.

## Pillars

1. **The numbers are real, and they're the toy.** Every slider is a real quantity with real units: mm, f-stops, seconds, ISO, °C, minutes. The fun is discovering that the rules photographers repeat (sunny 16, hyperfocal, X-sync) actually *work* in here.
2. **Hands before menus.** You turn a ring, you don't pick it from a dropdown. Detents click. Levers ratchet. Bellows squeak. The UI is a workbench, not a form.
3. **Warm, patient, a bit funny.** Late afternoon, sawdust in the window light, a shop radio. Failure is never punished. It is *photographed*, and the failures are often the best frames.

## Fiction and tone

**Setting.** *Quist Camera Repair & Custom Optics, est. 1958, 2nd floor, Lantern Street.* The sign on the door says `CLOSED — BACK WHEN THE LIGHT IS GOOD`. The repairman, **Q.**, is gone (retired, not dead; the tone is warm). He left his bench, his parts drawers, a stack of unfinished repair tags, and a notebook. In the darkroom game, O. signs her notes "— O."; Q. signs his "— Q." They were neighbours for thirty years. One of his notes reads *"O. says the basement is hers. The light is mine."*

**Q.'s voice** is dry, precise and fond. Original margin notes, one per concept:

- Pinhole box: *"No glass, no lies. Everything is a little soft and nothing is wrong."*
- Focal-plane shutter: *"The curtain is a slit running for a bus. Anything faster than the bus gets bent."*
- Exposure: *"Bright sun: f/16, one over your film speed. The rest is arguing."*
- Rangefinder lens cap: *"It will let you shoot with the cap on. It won't tell you. Neither will I."*
- Thoriated element: *"Yellow? It's old and warm, like me. A week under the UV lamp. Don't lick it."*
- Stopping down past f/16: *"Smaller hole, softer picture. Light is a wave and it sulks in tight spaces."*

**Repair tags are the goals.** Manila tags on string, typed carbon copies, each one a neighbour's request. A tag gets a grease-pencil tick when the photo meets a *physical* criterion that the renderer measures (not a vibe check). Each tag pays out a **parts drawer**: new glass, a shutter, a film back.

| Tag | Request (original copy) | What it teaches | Pass criterion (measured) |
|---|---|---|---|
| 01 | Bakery, No. 9: *"The loaves, steam and all, before seven."* | Exposure in low light | Midtones land within ±1 EV on the film curve |
| 02 | Clock tower: *"Everything sharp. The bench to the bell."* | Hyperfocal focus | Circle of confusion ≤ c at both 2.5 m and ∞ |
| 03 | Courier: *"Me going fast, but me sharp."* | Panning | Rider blur < 3 px, background streak > 40 px |
| 04 | Fountain: *"Make the water look like silk."* | Slow shutter, ND, reciprocity | t ≥ ½ s, highlights not blocked |
| 05 | Windmill owner: *"Why do your photos make my blades bendy? Do it on purpose."* | Focal-plane skew | Blade curvature ≥ 20° |
| 06 | The cat (owner, via note): *"Her eyes. The rest can go soft."* | Shallow depth of field | Eye in focus, background blur disc > 6× c |
| 07 | Lamplighter: *"Stars on the street lamps, please."* | Diffraction stars, blade count | ≥ 6 star points visible on a lamp |
| 08 | Q.'s last tag, in his hand: *"Upside down is the right way up."* | Large format, the dark cloth | A 4×5 sheet of the shop window, from across the street |

**Diegetic hints: the shop radio.** A Bakelite-style mantel radio murmurs a procedurally written **light report** every in-game ten minutes: *"Lantern Street light. Clear, sun at twenty-two degrees. EV fourteen in the open, twelve in the shade. Wind light from the west. Courier due every forty seconds."* It's both the hint system and the weather API. Text is synthesized speech-like burble with subtitles, not TTS.

## Art direction

### The five spaces

| Space | Look |
|---|---|
| **The Bench** (build) | Top-down three-quarter view of a walnut bench with green baize, brass and black anodized parts. Key light is a cool north window on the left (6500K) and fill is a warm articulated lamp on the right (2700K), so every part shows two colour temperatures, which is how a real workshop photographs. The window shows the Yard's actual sky at the current time of day. Clicking it takes you outside. |
| **The Drawing** (optics) | A lens cross-section drawn like an old patent sheet: cream paper, blue-black ink, glass in section hatching (crown at 45°, flint crosshatched, rare-earth dotted). Rays are traced live in **three Fraunhofer colours**: C-line red 656.3 nm, d-line yellow 587.6 nm, F-line blue 486.1 nm. Those are the actual lines used to define Abbe numbers. When colours don't meet at the focus, that is chromatic aberration, and you can see it. |
| **The Finder** | A different overlay for each camera type (see Wow 1). Ground glass grain, Fresnel rings, a split-image prism, a microprism collar, rangefinder bright-lines with parallax. |
| **The Yard** | Lantern Street at golden hour. Low-poly and flat-shaded with baked AO, but **luminance-calibrated** (see Authenticity). Blue skylight in the shadows, warm key light. |
| **The Tank & Lightbox** (develop) | The changing bag is total black. The daylight tank sits on a steel sink. The lightbox is a 5000K glow with strips of negatives in glassine sleeves, an 8× loupe and a red grease pencil. |

### Palette

| Token | Hex | Use |
|---|---|---|
| walnut | `#4A2E1C` | bench top |
| baize | `#2F4A3A` | work mat |
| brass | `#B8893A` / hi `#E2C27A` | barrels, screws, bellows corners |
| anodize | `#17181A` | lens barrels, bodies |
| leatherette | `#1F1D1B` | body covering (pebble-grain normal map) |
| bellows-red | `#5A1E1A` | oxblood leather bellows |
| engrave-white | `#EDE8DC` | metre scale, f-numbers |
| engrave-orange | `#E8772E` | feet scale (real lenses colour feet and metres differently) |
| dof-22 / 16 / 11 / 8 | `#D9433A` `#E7C640` `#4F9FD9` `#6CBF5B` | colour-paired depth-of-field index lines, as on real barrels |
| patent-paper | `#F2EDE0` | Drawing background |
| patent-ink | `#1C2230` | lines |
| ray-C / ray-d / ray-F | `#C8372D` `#D9A21B` `#2F6DB5` | Fraunhofer rays |
| golden-key | `#FFB86B` | Yard sun |
| sky-shadow | `#4B5A7A` | skylight fill in shade |
| ground-glass | `#CFCBC0` at 20–40% | finder image base |
| c41-mask | `#C8783A` | orange base of colour negatives |
| bw-base | `#E6E3DA` | base + fog of B&W negatives |
| tag-manila | `#E9D7A6` | repair tags |
| grease-red | `#C2262E` | picks on contact sheets |

### Materials

- **Glass** elements are true refraction shaders with an IOR read from the glass code. Coated surfaces show a thin-film reflection hue: **uncoated** is clear and grey, **single-coated** is amber/magenta, **multi-coated** is green/violet. These are the real colours you see looking into a lens.
- **Thoriated glass** (one vintage drawer part) is tinted `#E8C35A`. It **fades back toward clear** if you leave it under the bench's UV lamp; time passes on the save clock. That is a real fix.
- **Bellows** fold geometry is procedural: a square-section accordion that squeaks on extension (see Audio).
- **Engraving** uses a single SDF text atlas plus normal-mapped grooves, so engraved type catches the lamp when a ring turns.

### Typography

Bundled at build via `@fontsource` (OFL; no runtime fetch):

- **Engravings and scales:** Barlow Semi Condensed, 600, all caps, tracking +4%.
- **Tags and Q.'s typed sheets:** Courier Prime.
- **Q.'s handwriting:** Caveat, used sparingly (notes, ticks, sleeve annotations).
- **Readouts:** IBM Plex Mono with tabular numerals for EV, mm and seconds.

The system stack is the fallback for everything.

### Post-processing (live views only; the photo pipeline is separate)

The Bench gets ACES-ish tonemapping, mild bloom on brass highlights, and dust motes in the window shaft (instanced quads that drift on curl noise). The Yard gets the same tonemapper plus long blue shadows. Do not use SSAO; baked AO is cheaper on phones.

## Photographic authenticity

### Optics (computed, not faked)

- **Glass is chosen by six-digit glass code** (nd, Vd), the industry's generic naming: crown `517642`, light flint `581409`, flint `620364`, dense flint `805254`, lanthanum crown `713538`. These are no brand names but real numbers.
- **Designs** are cards in Q.'s file, with generic names and years so photographers recognise the shapes: *Landscape meniscus (1812-type)*, *Achromat doublet*, *Portrait (1840-type)*, *Triplet (1893-type)*, *Four-element triplet derivative*, *Double-Gauss*, *Retrofocus wide*, *Telephoto group*, *Mirror (catadioptric)*.
- **The 2D ray trace is real Snell refraction** through spherical surfaces, about 9 rays × 3 wavelengths, recomputed on every drag. It yields EFL, back focus, f-number, Petzval sum, longitudinal CA and spherical aberration. Those coefficients **drive the photo shader**, so the drawing and the photo can never disagree.
- **Circle of confusion by format:** 0.030 mm (24×36), 0.050 mm (6×6), 0.10 mm (4×5).
- **Hyperfocal** is H = f²/(N·c) + f. The DOF scale on the barrel is drawn from this formula, so it is correct for any focal length you build.
- **Diffraction:** Airy disc ≈ 2.44·λ·N, which is ≈ 1.34 µm × N at 550 nm. At f/22 that is 29.5 µm and eats the 35 mm CoC, so Q.'s "it sulks" note is true.
- **Pinhole:** the optimum diameter is d = 1.9·√(f·λ). A 50 mm box wants about 0.31 mm, and the bench's needle-gauge drawer offers 0.2, 0.3 and 0.5.
- **Diffraction stars:** an even blade count gives that many points; an odd count gives twice as many. A 5-blade lens makes 10-point stars, which is the classic photographer's surprise (Tag 07).
- **Bokeh** is the aperture polygon: 5 straight blades make pentagons, 9 rounded blades make circles. Near the frame edge it turns to **cat's-eye** (mechanical vignetting). The mirror lens gives **donut** bokeh.
- **Vignetting** is cos⁴θ plus mechanical vignetting, and it is worst wide open.
- **Distortion** uses Brown–Conrady k₁: barrel for retrofocus, pincushion for telephoto.
- **Bellows factor:** close focus needs (v/f)² more exposure, so at 1:1 you lose two stops. The light meter does *not* know about this.
- **Large format front tilt (Scheimpflug)** of up to ±10° turns Lantern Street into a model village.
- **Flare:** coating state sets the veiling-glare floor (uncoated about 4%, multi-coated about 0.3%) and the ghost tint.

### Exposure (calibrated scene)

- The Yard stores luminance in **cd/m²**. A sunlit grey card is ≈ 4000 cd/m², so EV₁₀₀ = log₂(L·100/K) with K = 12.5 gives **≈ 15**, and sunny 16 is *literally* correct at noon. Shade sits at EV 12–13, dusk streets at EV 7, and the neon sign at EV 9.
- Focal-plane exposure is **H = q·L·t / N²** with q ≈ 0.65.
- A **selenium-cell handheld meter** has a swinging needle (spring-damped and slightly sticky) and a circular calculator dial. Reading it is a skill: point it at the sky and you underexpose.

### Shutters (each one's quirk is the point)

| Shutter | Range | Quirk the renderer models |
|---|---|---|
| **Leaf** (in the lens) | 1 s – 1/500 | Flash syncs at every speed. No skew. **Shutter efficiency:** at f/2 and 1/500 the opening and closing blades add about ⅓ stop |
| **Horizontal cloth focal-plane** | 1 s – 1/1000 | Curtain travel ≈ 18 ms across 36 mm, X-sync 1/50. **Horizontal lean** on moving subjects |
| **Vertical metal focal-plane** | 1 s – 1/4000 | Travel ≈ 6.5 ms, X-sync 1/250. Wheels become ovals; the propeller becomes a banana |
| **Tri-colour back** (a 1900s-style 3-shot back) | three exposures through R/G/B filters, 1.5 s apart | Anything moving separates into rainbow ghosts (Wow 3) |
| **Dark slide + lens cap** (large format) | B, T, "count Mississippi" | Reciprocity matters. Tag 08 |

**Flash** is a flashbulb-style, single-use part. Fire it faster than X-sync and the photo gets the real **black band** where the second curtain had already covered the film.

### Film (original names, honest behaviour)

| Stock | Real behaviour modelled |
|---|---|
| **Lantern Pan 100** | Fine grain, long toe, panchromatic |
| **Lantern Pan 400** | Visible grain; pushes to 1600 with +60% dev time |
| **Ortho 25** | **Blind to red**: the red postbox renders black, lips go dark, and you can load it under a red safelight |
| **Daylight Colour 200** (C-41) | Orange-mask negative; ±3 stops latitude over, 1 under |
| **Slide 64** (E-6) | Positive, ±½ stop latitude, saturated, unforgiving |
| **Tungsten 64T** | A blue cast in daylight unless you add the amber 85-type filter |
| **Infrared 820** + deep-red filter | **Wood effect**: foliage glows snow-white, sky goes black. Every Yard material carries an `irAlbedo` channel; leaves are 0.85 |
| **Halation-prone cine stock** | No anti-halation layer, so red halos form around lamps and the neon |

- **Grain:** RMS granularity ∝ √(ISO/100), divided by the format's width ratio. The same stock looks 4× finer on 4×5 than on 35 mm, which is why people bothered with large format.
- **Reciprocity** (Schwarzschild, p ≈ 0.85 for t > 1 s): a metered 8 s exposure wants about 14 s. The tag-04 fountain teaches this.
- **Filters** are named by colour and factor: yellow (1 stop), orange (1½), red (3, the dramatic sky), green (2, lighter foliage), ND ×8 and ×64.

### The photo pipeline (one loop, real effects)

Pressing the shutter triggers an **offline exposure render**: N subframes (64 on desktop, 24 on phones, 4 under `__game.debug.fast`), each with a **time sample** and an **aperture sample** drawn inside the blade polygon. Each pixel row accepts only the subframes in which the shutter slit uncovered that row.

One loop gives motion blur, focal-plane skew, flash black-bands and true polygonal bokeh for free. The coefficients from the ray trace then add lateral CA (per-channel scale), distortion, vignetting and spherical-aberration glow wide open. Then comes the **film pass**:

luminance → H (lux·s) → characteristic curve → density → grain → halation → **negative**

The development step bends that curve afterwards.

### Developing (B&W by hand; colour by envelope)

The tactile path is a **daylight tank** (the Darkroom game owns trays and paper, so the two games don't repeat each other):

1. **Rewind.** The crank tension drops audibly when the leader leaves the take-up spool, and you stop there so the tongue stays out.
2. **Changing bag.** The screen goes fully black, and you work by sound and Android haptics (`navigator.vibrate`). Feed film onto the spiral reel. Drag too fast and it **kinks**, which prints real **crescent marks** on those frames.
3. **Developer.** Pick *MQ-borax fine grain* (metol, hydroquinone, sulfite, borax: the classic general-purpose recipe) or *Kitchen developer* (instant coffee + washing soda + vitamin C, a real hack). The smell caption reads *[coffee]*.
4. **Time and temperature.** The base is 9:30 at 20 °C. A time/temperature chart on the wall scales it about 9% per °C.
5. **Agitation.** Four inversions in the first 30 s, then four every minute (tilt the phone or drag). Too little gives **bromide drag** streaks; too violent gives **surge marks** at the sprocket holes.
6. **Stop** with water or 2% acetic (*[vinegar]*), **fix** for 5 min in thiosulfate rapid fixer (clearing time × 2), wash by **fill-and-invert 5 / 10 / 20**, add one drop of wetting agent, then hang with a weighted bottom clip. Use the squeegee and you risk a scratch down the whole roll.
7. **Colour** goes in a lab envelope marked *C-41 · 37.8 °C ± 0.15*. Q.'s bench can't hold that temperature, and real home C-41 is famously fussy. E-6 slides come back mounted.

**Opening the back mid-roll** fogs the last three frames you shot with a hot orange-red streak (for colour), which is the most photographer-recognisable failure in existence. Shooting with the **lens cap on** is possible only on rangefinder builds. On an SLR the finder goes black and you'd notice.

## Procedural audio

The master chain is `DynamicsCompressor` → convolver. The **Bench** uses a generated small-room IR (RT60 ≈ 0.4 s). The **Yard** has no reverb, only a single slap echo off the facades (120 ms, −18 dB). Everything is synthesized; there are no samples.

| Sound | Recipe |
|---|---|
| **Leaf shutter** | Two tiny clicks (bandpassed noise at 3.8 kHz, 4 ms), **separated by the actual exposure time**. At 1/8 s you can hear the gap, as photographers really do when they test speeds by ear |
| **Cloth focal-plane** | A soft "thup" and a second "thup" separated by exposure + 18 ms travel. Lowpassed at 1.5 kHz, with a cloth flutter |
| **Metal focal-plane + mirror** | Mirror slap (60 Hz sine thump + 2 kHz ring decaying in 90 ms), then a crisp metal tick |
| **Slow-speed escapement** (1 s – 1/8) | A gear-train buzz under the gap: a 180 Hz square through a bandpass with ±10% amplitude jitter. The famous buzz |
| **Self-timer** | A 10 s escapement whirr whose pitch slowly falls as the spring unwinds |
| **Film advance** | A ratchet of 7 noise ticks rising in pitch, then a thunk as the frame counter turns |
| **Rewind** | A long zip of friction that **goes slack** when the leader leaves the spool |
| **Aperture ring** | Half-stop detents: short 6 kHz ticks. Cine-style declicked rings are silent with a grease hush |
| **Focus helicoid** | Velocity-driven brown noise, very quiet. Damped grease feels expensive |
| **Bellows** | A leather creak (granular noise grains, 30–80 ms) on extension |
| **Dark cloth** | Throwing it over your head **low-passes the whole Yard to 600 Hz**, so you're under there |
| **Glass grinding** | Gritty looped noise whose pitch tracks lap speed, finer as you change grit 220 → 600 → rouge |
| **Thoriated element** | A Geiger counter on the bench ticks faster when you pick it up (Poisson clicks). It's mildly funny and true |
| **Tank** | Inversion glug (lowpassed noise with a pitch bend), a mechanical darkroom timer tick, and a *ding* bell |
| **Yard** | FM birds, wind (pink noise whose gusts are **the same signal that moves the leaves**, so the blur you see matches what you hear), fountain, a church bell on the quarter hour, and the courier's freewheel tick Doppler-shifted as he passes |

There is no music score, only the radio. Its light report fades in under a low wash of procedurally voiced chords and **ducks for 400 ms whenever a shutter fires**.

## Three wow moments (screenshot bait)

### Wow 1: Under the dark cloth

Tag 08, or any time you build a large-format or pinhole box. Drag the dark cloth over your head: the screen goes black except for a glowing **ground-glass rectangle** showing Lantern Street **upside down and mirrored**. It's dim, with hot-spot falloff toward the corners, Fresnel rings, and the grain of the glass. A loupe slides in to magnify, and the audio is muffled under the cloth.

Focusing the bellows makes the image snap into crispness. Tilting the front standard swings the plane of focus diagonally across the street. Your first pinhole box does the same thing, much dimmer, and Q.'s note says *"No glass, no lies."*

People screenshot the upside-down street because it's the true, centuries-old magic of a camera, shown honestly.

### Wow 2: The slit replay

After any focal-plane shot, the developed frame has a ▶ button. It replays the exposure **in slow motion as the slit itself**: a thin bright band crawls down the frame, painting the image row by row while the scene keeps moving behind it.

On the rooftop windmill (Tag 05) you *watch* the straight blades get painted into curved bananas. On the courier you watch the wheels lean. Fire a flash above X-sync and you see exactly why the black band appears. It costs nothing to build, because it re-plays the subframes the photo already rendered. This is the single best explanation of rolling and focal-plane shutters ever put in a browser, and it loops as a GIF-like clip you can save.

### Wow 3: Tri-colour ghosts

The tri-colour back (an unlock from the late tags) takes three B&W exposures through red, green and blue filters 1.5 s apart and combines them. Everything **still** comes out in perfect, rich, slightly uncanny colour. Everything that **moved** splits into floating rainbow ghosts: the fountain's water turns into prismatic silk, the cat becomes a cyan-magenta blur, and the courier leaves a red, a green and a blue copy of himself down the street.

The look is real (that's how colour photographs were first made), and nobody expects it.

**Runner-up smiles:** swapping in Infrared 820 and watching the tree turn snow-white; Ortho 25 rendering the red postbox pitch black; 10-point stars from a 5-blade lens; the coffee developer.

## Sharing

- **Sleeve card PNG.** Each kept frame exports as the print *plus* its glassine sleeve, annotated in Q.'s hand: `f/5.6 · 1/250 · Lantern Pan 400 · yellow · Triplet 75 mm · MQ 9:30 @ 20°C`. The rebate shows original edge print: `LANTERN 400 SAFETY FILM ◄ 14 ◄ 14A`.
- **Contact sheet.** The full roll lies on the lightbox with red grease-pencil picks (✕ and crop marks) and exports as one image. This is the default "look what I made" artifact.
- **Camera passport.** A camera design serializes into the URL fragment (`#cam=…`), so builds share with no backend. The baseplate is engraved with a serial derived from the hash, so two people with the same build have the same serial number.
- **Down to the Darkroom.** "Carry to basement" writes the negatives to `src/shared/filmcan`; Darkroom can enlarge them.

## Test hooks for `window.__game` (craft-relevant)

Expose `setTimeOfDay(h)`, `loadCamera(passport)`, `shoot({subframes})`, `develop({dev, minutes, tempC, agitation})`, `setFinderMode('groundglass'|'rangefinder'|'slr'|'tlr')`, `slitReplay(t01)` and `audioMute(true)`. Each wow moment can then be captured headlessly at a fixed time and pose.
