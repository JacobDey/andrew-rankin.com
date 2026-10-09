# DARKROOM: Craft, Authenticity & Vibe (concept)

Lens: art direction, audio, fiction and tone, photographic truth. Slug `darkroom`.

## Title

**DARKROOM: Silver & Iron**
Tagline: *Turn off the lights. Rock the tray. Wait for it.*

"Silver" is gelatin-silver printing. "Iron" is cyanotype (ferric salts to Prussian blue). The two halves of the toy are named for their metals, the way a printer would talk.

## Pillars

1. **Darkness is the main material.** Light is the mechanic, so it is also the look: one amber bulb, a wet surface, your hands.
2. **Truth is the delight.** Every number, smell and failure is real or near-real. A working printer should laugh three times in five minutes.
3. **Quiet, warm, nocturnal.** 1 a.m., a basement, the radio on. No score, no fail screen, no hurry.

## Fiction and tone

**Setting.** *Lantern Street Community Darkroom, Basement Unit B.* It is a shared darkroom under a camera-repair shop that has closed. You have the last key. The previous keyholder, **O.**, never appears on screen. She left the bench in good order, and she taped notes to everything: masking tape, red grease pencil, signed "— O."

**The notes are the tutorial.** No popups: each station has 2–4 tape notes in O.'s voice (dry, kind, slightly bossy; all copy original):

- Fix tongs: *"FIX TONGS NEVER TOUCH DEV. I mean it. — O."*
- Ferricyanide jar: *"Ferri-CYANIDE. Not cyanide. It's fine. Don't add strong acid and heat it — then it's not fine."* A wink at the "cyanide chemistry" in Andrew's dictation, and the warning is true.
- Cyanotype table: *"Coat in lamplight. Dry in the dark. Expose in the sun. Forgive in the wash."*
- Door: *"If you can smell vinegar, you're doing fine."*

**The negative box.** A shoebox holds O.'s last roll: 12 procedural frames (fire escape with laundry, cat on a radiator, pear on a sill, bus shelter at night, hands around a mug, the darkroom door…). Frame 12 is a self-portrait in a dark window; grease pencil on the sleeve says *"your turn."* That is the whole story: ambient, unplotted, a feeling of inheritance. Plotted mysteries belong to `plates` and `latent`.

**Smell captions.** Optional italic subtitles caption sounds *and* smells: *[drip]*, *[fan hum]*, *[vinegar]*, *[sulfur, faint]*. Accessibility and a running joke.

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

- **Trays.** Ribbed plastic with a corner spout: white (DEV), red (STOP), gray (FIX). Under the safelight they look identical, so each carries a masking-tape label in grease pencil, as real printers do.
- **Liquid.** Heightfield with Fresnel and the bulb's reflection. Submerged paper is darker and glossier; the waterline leaves a darker damp meniscus band; dry corners curl (RC curls toward the emulsion).
- **Paper.** RC "pearl" gets a fine normal-map stipple; fiber gets a soft cockle. Wet means higher specular, lower albedo.
- **Bench.** Stainless sink, pegboard, a clothesline with spring clothespins and dripping prints, a towel that darkens each time you dry your hands, bamboo dev tongs and steel fix tongs.
- **Enlarger.** Column, swing-out red filter, four-blade easel, grain focuser. The beam is visible in the air with **dust motes**: the only cool-white light in the dark.

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
| Tongs, switches | Bamboo knock (two damped sines), steel FM click; pull-chain as granular bead rattle. |
| Fluorescent start | *tink…tink*, then 120 Hz buzz with harmonics fading in. |
| Enlarger | Lamp *thunk*, faint fan; focus knob = clicks spaced by knob velocity. |
| Darkroom timer | Mechanical tick per second; at zero a bell of inharmonic partials (1, 2.76, 5.40, 8.93), long decay. |
| UV box / window | Fan + faint 15 kHz whine; outside, wind noise and FM-chirp birds. |
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

1. **Stocks** (the classic 1842 recipe). **A:** 25 g ferric ammonium citrate (green) per 100 ml water. **B:** 10 g potassium ferricyanide per 100 ml. Stock A **grows mold** after many in-game days, a real nuisance.
2. **Mix** A+B 1:1 just before use; the working sensitizer lasts a few hours.
3. **Coat** under tungsten or dim light with a hake brush or glass rod, about 2 ml per 8×10. Two coats go deeper. Cold-press paper shows brush marks (a feature).
4. **Dry in the dark** (~20 min), or with the hair dryer (loud, satisfying).
5. **Expose** in a **split-back** contact frame: open one half to peek without losing registration. UV 365 nm about 8–15 min; sun 10–20 min at summer noon, up to 60 min overcast, integrated live as clouds pass. The coat goes yellow-green → blue-gray → **deep shadows "bronze"** (gray-olive, reversing). Bronzing is how real printers know exposure is done.
6. **Wash** about 5 min. Unexposed salts bleed off as yellow plumes and the blue deepens. A splash of vinegar keeps highlights crisp; alkaline water bleeds the blue.
7. **Peroxide.** A capful of 3% H₂O₂ per liter gives the final Prussian blue instantly (Wow 2). Without it, the blue deepens over 24 in-game hours.
8. **Toning.** Bleach in dilute washing soda to pale yellow, then tea, coffee or tannin for ~20 min: browns through aubergine-black.

The chemistry, written in the logbook in O.'s hand: UV reduces Fe³⁺ citrate to Fe²⁺. Fe²⁺ plus ferricyanide makes insoluble Fe₄[Fe(CN)₆]₃, which is Prussian blue. Unexposed ferric salt is soluble and washes away.

**Easter egg: cyanotypes fade and recover.** Leave a finished cyanotype in the sun window and it fades slightly. Put it in the dark for a day and it regenerates. This is true: the photoreduction of Prussian blue is reversible.

**Easter egg: one chemical in both rooms.** Potassium ferricyanide (jar B) mixed with fixer is the classic **ferricyanide reducer**, which bleaches silver. Daub it on a silver print's highlights with a brush to brighten eyes and skies. Printers will grin at the crossover.

### Photo prep: the digital negative desk

A light table beside a small grayscale monitor takes an imported PNG to a transparency: **grayscale** (R/G/B channel mixer) → **invert** → **flip horizontally** (ink side faces the emulsion in contact printing; a tape note explains) → **curve** (presets "cyanotype", "silver contact") → optional **UV-blocking tint** (real digital-negative printers colorize because some inks barely block UV) → print on the inkjet (carriage *zzzt-zzzt*; the sheet slides out with a wet-ink sheen for 3 s).

**Calibration:** print a 21-step wedge (0.15 density per step), note which step first reaches full Prussian blue, and the desk suggests a curve. It's a real workflow, and the few who use it will love it.

### Small truths that earn a smile

- **Fingerprints.** If you touch unprocessed paper with dev-wet fingers you leave a dark print. Fix-wet fingers leave a *white* one. The towel exists for this.
- **Tong contamination.** Dip the fix tongs in developer and the developer weakens and stains. O.'s note was right.
- **The paper box.** Opening the paper box with the room light on fogs the top sheets. Nothing looks wrong until you develop them. The box warns *OPEN ONLY IN DARKROOM* (invented brand: **Nightjar Photographic: Vari-Grade RC Pearl**).
- **Air bubbles.** Paper slid in face-up can trap bubbles, which leave pale underdeveloped spots. The right method is to slide it in face-down, then flip.
- **Pulling early.** Pulling a print at 30 s gives muddy highlights. Real "development by inspection" means you wait.
- **Filed-out carrier.** Choose the filed carrier and the print gets a rough black border with the film's edge printing (`NJ 400 ▸ 12A`), a mark of full-frame honesty.
- **Unfixed prints go lavender.** An unfixed print brought into room light slowly turns lavender-gray (real print-out darkening of silver halide).

## Three wow moments (the screenshots)

### 1. The meniscus bloom
Drop exposed paper in the developer and rock the tray. The image develops **only where the liquid has touched**: a crescent of picture chases the wave across the sheet while the dry corner stays blank. Because silver arrives shadows-first, the wave's leading edge carries only blacks and midtones fill in behind it, with the bulb's reflection streaking over it all. **This is also the title screen.** The game opens in black: drip, fan, a pull-chain. The first print you see developing is the word **DARKROOM**, rising out of the paper as the wave passes.

### 2. Peroxide plume
A finished cyanotype rests in the wash, pale and greenish. Tip the brown bottle: the peroxide enters as a visible eddy (dye advected by the tray's velocity field), and **deep Prussian blue spreads outward from where it lands**, denim to midnight in about two seconds, while the last yellow sensitizer still trails off the edge. Blue, yellow and a white rag border in one frame: the shot people post.

### 3. The beam
Full dark, enlarger on. A cone of cool light full of drifting dust falls on the easel, where the *negative* image glows reversed. Your cursor becomes a hand inside the beam and dodges a face; its soft shadow wobbles on the paper while the timer ticks and the lume hands crawl. It's the only light in the room that isn't amber. A free-camera photo mode lets you frame it.

### Honorable mentions
- **Sabattier flash.** Tap the room light for one second at 40 s into development. The print partially reverses, and Mackie lines appear along the edges. It is a real effect and an accident many printers have had. When it happens, the logbook writes *"solarized?"* in the margin.
- **The coin test.** A pre-flashed sheet goes under the safelight with four coins, uncovered one at a time over 1, 2, 4 and 8 min. If coin outlines show when you develop it, the safelight is fogging. If the radio's tape is peeled, the 8-min coin shows.
- **The door.** Open the blackout curtain mid-print and a wedge of hallway light crosses the floor and the paper. The resulting fog is wedge-shaped, so you know exactly what you did.

## Share card

"Take it upstairs" exports a PNG of the dry print on a gray scanner bed: paper texture, slight curl, the logbook line in grease pencil in the margin (`Gr 3½ · f/8 · 14s · Dev 90s @ 20°C`). Cyanotype cards show the rag deckle and brush strokes past the image edge. This card is how the game gets shared, so it must look gallery-good.

## Notes for the synthesizer (priorities)

- **Must have:** the spectral fog model (it makes every light honest), the meniscus bloom, peroxide plume, tape-note tutorial, auto logbook with saves, room-light/safelight regimes with dark adaptation, the procedural room tone, slosh and timer sounds, the share card.
- **Should have:** VC two-emulsion contrast, dry-down, fingerprints, split-back frame, bronzing cue, 21-step wedge, the radio.
- **Cut first:** the sepia two-step, the radio station 3, the mold, the fade/recover cycle (a cheap timer, but last).
- **Phones:** tilting the device (DeviceOrientation, with a permission button on iOS) rocks the active tray. `navigator.vibrate(8)` fires on slosh peaks where supported. Reduced-motion mode damps the waves.
