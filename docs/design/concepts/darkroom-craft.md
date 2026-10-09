# DARKROOM: Craft, Authenticity & Vibe (concept)

Lens: art direction, audio, fiction and tone, photographic truth. Slug `darkroom`.

## Title

**DARKROOM: Silver & Iron**
Tagline: *Turn off the lights. Rock the tray. Wait for it.*

"Silver" is gelatin-silver printing. "Iron" is cyanotype (ferric salts to Prussian blue). The two halves of the toy are named for their metals, the way a printer would talk.

## Pillars

1. **Darkness is the main material.** The light in the room is the core mechanic, and how the game looks should follow from that. Most of the time you see one amber bulb, a wet surface and your own hands.
2. **Truth is the delight.** Every number, smell and failure is real or close to real. A working printer should laugh at least three times in five minutes.
3. **Quiet, warm, nocturnal.** It should feel like 1 a.m. in a basement with the radio on. There is no score, no fail screen and no hurry.

## Fiction and tone

**Setting.** *Lantern Street Community Darkroom, Basement Unit B.* It is a shared darkroom under a camera-repair shop that has closed. You have the last key. The previous keyholder, **O.**, never appears on screen. She left the bench in good order, and she taped notes to everything: masking tape, red grease pencil, signed "— O."

**The notes are the tutorial.** There are no popups. Each station has 2–4 tape notes. The tutorial voice is O.'s voice: dry, kind, slightly bossy. All copy is original. Examples:

- On the fix tongs: *"FIX TONGS NEVER TOUCH DEV. I mean it. — O."*
- On the safelight: *"Coin test this every spring. Trust nothing that glows."*
- On the ferricyanide jar: *"Ferri-CYANIDE. Not cyanide. It's fine. Don't add strong acid and heat it — then it's not fine."* This line is a wink at the "cyanide chemistry" in Andrew's dictation, and the warning itself is true.
- On the cyanotype table: *"Coat in lamplight. Dry in the dark. Expose in the sun. Forgive in the wash."*
- On the door: *"If you can smell vinegar, you're doing fine."*

**The negative box.** A shoebox on the shelf holds strips of O.'s last roll, 12 frames rendered procedurally (see Art direction). The frames are a fire escape with laundry, a cat on a radiator, a pear on a sill, a bus shelter at night, two hands holding a mug, a lighthouse, the darkroom door, and so on. Frame 12 is a self-portrait in a dark window, with grease pencil on the sleeve: *"your turn."* That is the whole story. It is ambient and has no plot. The plotted mysteries belong to `plates` and `latent`. Here the story is only a feeling of inheritance.

**Captions for smells.** Sounds and smells both get optional captions in a small italic subtitle line: *[drip]*, *[fan hum]*, *[vinegar]*, *[sulfur, faint]* (fixer), *[wet paper]*. This serves accessibility and is also a running joke.

## Art direction

### The four light regimes

| Regime | Look | Implementation note |
|---|---|---|
| **Black** (all off) | Pure dark. Over about 8 s the scene "dark-adapts": exposure ramps from 0 to 0.15, and the luminous timer hands and the radio dial show first. | A single exposure uniform with an eased ramp. Ends the darkness gag. |
| **Safelight** | Monochrome amber world. Blacks are lifted to warm umber, never #000. A soft bloom around the bulb only. Liquid surfaces carry the bulb as a long specular streak. | Render through a 1D amber LUT. Nearly free: one dominant light. |
| **Room light** | Fluorescent tubes at 4000K, slightly green. They start with two 80 ms flickers, a *tink-tink*, then a buzz. Exposure overshoots (a squint) for 600 ms and settles. Colors exist again, and only now can you tell the red tray from the white one. | Fog is computed honestly at the same moment, so the first flicker already exposes the paper. |
| **UV / Sun** | The UV box is violet (#6E3BFF). Papers with optical brighteners fluoresce pale blue; cotton rag stays dull cream (true). The window/sun station is warm 5500K and moving cloud shadows cross the table. | Fluorescence is an emissive term gated by UV irradiance × a paper `oba` flag. |

### Palette

| Token | Hex | Use |
|---|---|---|
| safelight | `#FF9A3C` | bulb, highlights |
| amber-shadow | `#3A1C0A` | ambient fill under safelight |
| floor-black | `#0B0705` | deepest value, never pure black |
| paper-white (RC) | `#F4F2EC` | silver print base |
| silver Dmax | `#161412` | neutral black; warm-tone variant `#1E1813` |
| selenium | `#2A1E26` | purple-brown shift |
| sepia | `#6B4A2E` | bleach/redevelop |
| rag-cream | `#F1EBDD` | cotton watercolor paper |
| sensitizer | `#C2BE48` | wet yellow-green coat |
| exposed-unwashed | `#5E6B4E` | olive-gray during UV |
| bronzed | `#77705F` | overexposed shadows "reversing" |
| prussian | `#003153` | final cyanotype Dmax |
| cyan-mid | `#2E5C8A` | cyanotype midtone |
| tape | `#E6D6A3` | masking tape UI |
| grease-red | `#C8322A` | grease pencil, crop marks |
| lume | `#9CFF8A` | luminous timer paint |
| stop-fresh / stop-spent | `#E8C547` / `#6A3D8F` | indicator stop bath |
| dev-spent | `#7A5A2A` | oxidized developer ("tea") |

### Materials

- **Trays.** Molded plastic with ribbed bottoms and a pour spout in one corner. They are white (DEV), red (STOP) and gray (FIX). Under the safelight they look identical, so each has a strip of masking tape with its job in grease pencil. That is what real printers do.
- **Liquid.** A heightfield surface with Fresnel and a reflection of the bulb. Paper under the liquid is darker and glossier. At the waterline the paper shows a darker damp band (the meniscus), and dry corners curl slightly. RC paper curls toward the emulsion.
- **Paper.** Fiber texture comes from noise. RC "pearl" gets a fine stipple in the normal map; fiber gets a soft cockle. Wet paper has higher specular and lower albedo.
- **Bench.** Stainless sink, pegboard, a wooden clothesline with spring clothespins, and drips falling from the prints. A towel hangs on a hook and gets darker each time you dry your hands. Bamboo tongs have rubber tips; the fix tongs are stainless.
- **Enlarger.** A column, a red filter swing-out under the lens, a four-blade easel and a grain focuser. The beam is visible in the air with **dust motes** (a cheap particle cone), and it's the only cool-white light in the dark.

### Typography and UI

There is almost no HUD. UI lives on objects: tape labels, a logbook, and the timer face. All fonts are self-hosted via `@fontsource` (OFL/Apache), with no runtime fetches:

- **Permanent Marker** for grease pencil (tape notes, tray labels, logbook margins).
- **IBM Plex Mono** for readouts (timer digits, chemistry gauges, logbook data).
- **Fraunces** (soft, wonky optical sizes) for the title and logbook headings.
- **Saira Stencil One** for stenciled jugs: `DEV 1+2`, `FIX`, `HYPO CLEAR`, `A — FAC 25%`, `B — FERRI 10%`.

**The logbook** writes itself, like a real printer's notebook. Each print gets an entry:
`No. 014 — Gr 3½ · f/8 · 14s (+4s burn, sky) · Dev 90s @ 20.5°C · Stop 15s · Fix 2m · Wash 4m · RC Pearl 8×10`
A cyanotype entry:
`No. 015 — Cyanotype, Classic A+B 1:1 · Rag HP 300gsm · 2 coats · UV 365nm 11m · Wash 5m + H₂O₂ · tea-toned 20m`
The logbook doubles as the save-state browser. Each save is a page with a thumbnail of the bench taped in.

### Post-processing

- Film grain at **24 fps, not 60**, with 2–3% luminance only. Grain that changes at 24 fps reads as film.
- Vignette on all regimes. A slight chromatic softness toward the edges in Safelight only.
- Bloom is restricted to emissive objects (bulb, lume, UV tubes, OBA glow).
- **No** depth-of-field except in the grain focuser and in the "share card" render.
- The no-WebGL2 fallback is a 2D top-down bench in the same palette. The tape notes are the same.

## Procedural audio (WebAudio, all synthesized)

| Sound | Recipe |
|---|---|
| Room tone | Brown noise, low-passed at 300 Hz, plus a 60/120 Hz mains hum at -40 dB. The extractor fan is band-passed noise with slow 0.3 Hz AM. |
| Tap drip | Random interval of 4–11 s. A noise burst through a resonant bandpass with a pitch drop of 1.8→0.9 kHz over 60 ms ("plink"). |
| Slosh | Band-passed noise. Gain and cutoff are driven by the RMS surface velocity of each tray, and peaks trigger short "lap" transients against the tray wall. |
| Pour | A comb filter whose resonance rises as the jug empties ("glug"). |
| Paper into liquid | A soft low thump plus a short hiss. Paper slapping the bench is a dry transient. |
| Tongs | Bamboo is a short wooden knock (two damped sines). Steel is an FM click. |
| Light switch / pull chain | A plastic click, or a bead-chain rattle (granular clicks). |
| Fluorescent start | *tink…tink* (two sharp clicks), then 120 Hz buzz with harmonics fading in. |
| Enlarger | A lamp *thunk* and a faint fan. The focus knob is a ratchet of clicks spaced by knob velocity. |
| Darkroom timer | A mechanical tick each second. At zero, a bell made from inharmonic partials (1, 2.76, 5.40, 8.93) with long decay. |
| UV box | Fan plus a faint 15 kHz capacitor whine (rolled off on phones). |
| Window/sun | Wind noise and procedural birds (FM chirps with randomized sweeps). |
| **The radio** | A shelf radio with a tuning knob. Between stations is static. Station 1 is late-night jazz: a walking bass, brushes on noise and FM e-piano ii–V–I voicings, all through a 300–3000 Hz "tiny speaker" bandpass. Station 2 is ambient drone. Station 3 is beeps under static, a nod to the darker games next door. |

There is one more radio detail: the radio's **dial lamp** is a tiny tungsten bulb with black tape over it. If you peel the tape off, the lamp fogs paper left nearby, very slowly. Every printer has taped over a standby LED.

## Photographic authenticity

### Light and fog: one spectral model for everything

Every light has irradiance in 5 bands. Every emulsion has a sensitivity in the same 5 bands. Fog is not a special case. It is simply exposure you didn't intend.

| Source | UV | Blue | Green | Amber | Red | Notes |
|---|---|---|---|---|---|---|
| Room fluorescent | 0.03 | 1.0 | 1.0 | 0.8 | 0.6 | about 400 lux at the bench |
| Safelight (amber) | 0 | 0 | 0.0005 | 1.0 | 0.3 | a 15 W bulb at 1.2 m |
| Enlarger (halogen) | 0.01 | 0.35 | 0.7 | 0.9 | 1.0 | modulated by the negative and the filter |
| UV box (365 nm) | 1.0 | 0.05 | 0 | 0 | 0 | |
| Sun (window) | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | ×cloud factor, enormous |
| Door crack | 2% of room | | | | | a wedge-shaped fog |

| Emulsion | UV | Blue | Green | Amber | Red |
|---|---|---|---|---|---|
| VC silver: **hard** emulsion | 1.0 | 1.0 | 0.02 | 0.001 | 0 |
| VC silver: **soft** emulsion | 0.6 | 0.4 | 1.0 | 0.002 | 0 |
| Cyanotype | 1.0 | 0.08 | 0 | 0 | 0 |

**Variable contrast emerges on its own.** Real VC paper has a blue-sensitive high-contrast emulsion and a green-sensitive low-contrast one. A magenta filter (which cuts green) raises the contrast and a yellow filter (which cuts blue) lowers it. With the two-emulsion model, the filter drawer *is* the grade, and split-grade printing (grade 00 for the highlights, grade 5 for the shadows) works without any special code.

The **safe time** is tuned so unwrapped VC paper shows a just-visible highlight veil (ΔD ≈ 0.04) after about 4 minutes under the safelight. Paper that has been pre-flashed reaches it in about 90 s, which is why the coin test uses pre-flashed paper.

### Silver gelatin: the numbers

| Step | Real-world number | Visible tell |
|---|---|---|
| Enlarger | 50 mm lens for 35 mm, 80 mm for 6×6. Focus wide open, print at f/8–f/11. Exposure ∝ (M+1)². | The grain snaps into focus in the focuser. |
| Test strip | 5 bands at 2 s steps, or ⅓-stop f-stop timing. Grade 2 about 10–20 s at f/8 for 8×10. | The logbook records which band you chose. |
| Developer | Metol-hydroquinone, 1+2, 20°C. RC 60 s, fiber 2–3 min. Rate ≈ ×1.1 per °C. Fog rises above 24°C. | Shadows appear at about 8–12 s, midtones by 30 s, highlights by 45–60 s. Fresh developer is clear; exhausted developer turns tea-brown. |
| Stop | About 2% acetic acid, 10–15 s. **Indicator stop**: yellow when fresh, purple when spent. | *[vinegar]* |
| Fix | Rapid (ammonium thiosulfate) at paper dilution. RC 60 s, fiber 2–3 min. | **The lights may go on after 30 s in fix**, which is the real rule. |
| Wash | RC 2–4 min. Fiber 60 min, or 10 min hypo-clear plus 20 min. | |
| Dry | RC air-dries in about 10–15 min. **Dry-down:** prints darken about 5–10% in the midtones as they dry, more on fiber. | A wet print that looks perfect dries slightly too dark. That is the classic lesson. |
| Tone | Selenium 1+9, 2–5 min: cooler and purpler, with deeper Dmax. Sepia: bleach, then redevelop to brown. | *[sulfur]* during sepia |
| Paper curve | ISO R range is about 160 (grade 0) down to about 55 (grade 5). Dmax about 2.1 glossy RC, about 1.6 matte. Base+fog about 0.07. | |

### Cyanotype: the full iron workflow

1. **Stock solutions.** **A:** 25 g ferric ammonium citrate (green) in 100 ml water. **B:** 10 g potassium ferricyanide in 100 ml water. This is the classic 1842 recipe. Stock A **grows mold** if left for many in-game days, which is a real nuisance.
2. **Mix** A and B 1:1 just before use. The working sensitizer lasts a few hours.
3. **Coat** under tungsten or dim light with a hake brush or a glass rod, about 2 ml per 8×10. One coat is pale and two coats are deeper. Hot-press paper is smooth; cold-press is textured and shows brush marks (a feature).
4. **Dry in the dark**, about 20 min, or with the hair dryer (a loud, satisfying noise).
5. **Expose** in a contact frame with a **split back**. You can open one half to peek without losing registration, which practitioners love. UV box 365 nm for about 8–15 min. Sun for about 10–20 min (summer noon) up to 60 min (overcast); exposure integrates live while clouds pass. The coat goes yellow-green, then blue-gray, and finally the **deep shadows "bronze"** (go gray-olive and reverse). That bronzing is how real printers know exposure is done.
6. **Wash** about 5 min. The yellow unexposed salts bleed out as visible yellow plumes and the blue deepens. A splash of vinegar in the water keeps the highlights crisp. Alkaline water bleeds the blue.
7. **Peroxide.** A capful of 3% H₂O₂ per liter oxidizes the image instantly to its final Prussian blue (see Wow 2). Without peroxide, the blue still deepens, but slowly, over 24 in-game hours.
8. **Toning.** Bleach in dilute washing soda until the image goes pale yellow. Then tone in tea, coffee or tannin for about 20 min, which gives browns through to aubergine-black.

The chemistry, written in the logbook in O.'s hand: UV reduces Fe³⁺ citrate to Fe²⁺. Fe²⁺ plus ferricyanide makes insoluble Fe₄[Fe(CN)₆]₃, which is Prussian blue. Unexposed ferric salt is soluble and washes away.

**Easter egg: cyanotypes fade and recover.** Leave a finished cyanotype in the sun window and it fades slightly. Put it in the dark for a day and it regenerates. This is true: the photoreduction of Prussian blue is reversible.

**Easter egg: one chemical in both rooms.** Potassium ferricyanide (jar B) mixed with fixer is the classic **ferricyanide reducer**, which bleaches silver. Daub it on a silver print's highlights with a brush to brighten eyes and skies. Printers will grin at the crossover.

### Photo prep: the digital negative desk

This is a light table beside a small grayscale monitor. It takes an imported PNG to a transparency:

1. Grayscale (channel mixer: R/G/B weights).
2. **Invert.**
3. **Flip horizontally.** The ink side faces the emulsion in contact printing; a tape note explains why.
4. Curve, with presets for "cyanotype" and "silver contact".
5. Optionally a **UV-blocking tint**. Real digital-negative printers colorize the negative because some inks barely block UV.
6. Print the transparency on the inkjet. There is a sound for it (a carriage *zzzt-zzzt*), and the sheet slides out with an ink-wet sheen for 3 s.

**Calibration** is a 21-step wedge with 0.15 density per step. Print it, see which step first reaches full Prussian blue, and the desk suggests a curve. This is a real workflow and gives deep satisfaction to the few who use it.

### Small truths that earn a smile

- **Fingerprints.** If you touch unprocessed paper with dev-wet fingers you leave a dark print. Fix-wet fingers leave a *white* one. The towel exists for this.
- **Tong contamination.** Dip the fix tongs in developer and the developer weakens and stains. O.'s note was right.
- **The paper box.** Opening the paper box with the room light on fogs the top sheets. Nothing looks wrong until you develop them. The box warns *OPEN ONLY IN DARKROOM* (invented brand: **Nightjar Photographic: Vari-Grade RC Pearl**).
- **Air bubbles.** Paper slid in face-up can trap bubbles, which leave pale underdeveloped spots. The right method is to slide it in face-down, then flip.
- **Pulling early.** Pulling a print at 30 s gives muddy highlights. Real "development by inspection" means you wait.
- **Filed-out carrier.** Choose the filed carrier and the print gets a rough black border with the film's edge printing (`NJ 400 ▸ 12A`), a mark of full-frame honesty.
- **Unfixed prints go lavender.** An unfixed print brought into room light slowly turns lavender-gray. This is real print-out darkening of silver halide.
- **The coin test**, as a craft ritual (see Honorable mentions).

## Three wow moments (the screenshots)

### 1. The meniscus bloom
Drop exposed paper into the developer and rock the tray. The image develops **only where the liquid has touched it**: a crescent of picture follows the wave across the sheet, and the dry corner stays blank cream. Because the image arrives shadows-first, the leading edge of the wave carries only blacks and the trailing part carries midtones. In the amber light the bulb's reflection runs across the wet surface. **This is the title screen too.** The game opens in black, with the drip, the fan and a pull-chain. The first print you see developing is the title, **DARKROOM**, rising out of the paper in the tray as the wave passes.

### 2. Peroxide plume
A finished cyanotype rests in the wash tray, pale and slightly greenish blue. Tip the brown bottle. A capful of peroxide enters as a visible eddy (a dye advected by the tray's velocity field), and **deep Prussian blue spreads outward from where it lands**, turning the print from denim to midnight in about two seconds. Meanwhile the last yellow sensitizer still trails off the paper's edge. Blue, yellow and a white rag border in one frame: this is the shot people post.

### 3. The beam
The room is fully dark. The enlarger is on. A cone of cool light filled with drifting dust falls onto the easel, where the *negative* image glows reversed. Your hand (the cursor becomes a hand when it enters the beam) dodges a face, and its soft shadow wobbles on the paper while the timer ticks and the lume hands crawl. It is the only color temperature in the room that isn't amber. A free-camera "photo mode" lets you frame it.

### Honorable mentions
- **Sabattier flash.** Tap the room light for one second at 40 s into development. The print partially reverses, and Mackie lines appear along the edges. It is a real effect and an accident many printers have had. When it happens, the logbook writes *"solarized?"* in the margin.
- **The coin test.** A pre-flashed sheet goes under the safelight with four coins, uncovered one at a time over 1, 2, 4 and 8 min. If coin outlines show when you develop it, the safelight is fogging. If the radio's tape is peeled, the 8-min coin shows.
- **The door.** Open the blackout curtain mid-print and a wedge of hallway light crosses the floor and the paper. The resulting fog is wedge-shaped, so you know exactly what you did.

## Share card

"Take it upstairs" renders the dry print on a neutral gray scanner bed. It shows the paper texture, a slight curl and a grease-pencil caption from the logbook line (`Gr 3½ · f/8 · 14s · Dev 90s @ 20°C`) in the margin, and exports a PNG. A cyanotype card shows the rag deckle and the brush strokes past the image edge. The card is the game's sharing mechanism, so it should look gallery-good.

## Notes for the synthesizer (priorities)

- **Must have:** the spectral fog model (it makes every light honest), the meniscus bloom, peroxide plume, tape-note tutorial, auto logbook with saves, room-light/safelight regimes with dark adaptation, the procedural room tone, slosh and timer sounds, the share card.
- **Should have:** VC two-emulsion contrast, dry-down, fingerprints, split-back frame, bronzing cue, 21-step wedge, the radio.
- **Cut first:** the sepia two-step, the radio station 3, the mold, the fade/recover cycle (a cheap timer, but last).
- **Phones:** tilting the device (DeviceOrientation, with a permission button on iOS) rocks the active tray. `navigator.vibrate(8)` fires on slosh peaks where supported. Reduced-motion mode damps the waves.
