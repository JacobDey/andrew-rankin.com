# The Studio: craft, authenticity and vibe concept

Lens: art direction, procedural audio, fiction and tone, photographic truth, and three screenshot moments. Slug `studio`, at `/games/studio/`.

## Title

# SUNNY 16
### A house that takes pictures.
*Build a camera in the garage. Shoot the backyard. Print it in the basement. Everything you make stays.*

**Why this title.** The "sunny 16" rule is the first thing every photographer learns: on a clear day, at f/16, the shutter speed is 1/ISO. Photographers will smile at the title before they click. Non-photographers get a warm summer word and a number. The number **16** is also painted on the rusty mailbox at the end of the drive, so the house's address is the rule.

Hub card: *"A whole house for making photographs. The light is real, the chemistry is real, and the mailbox is the one from Texturedle."*

Alternates: *Open Shade*, *The House on Halide Lane*.

---

## 1. Thesis: the eye sees like a screen, the camera sees like a camera

Every other game in the collection has one bench. This one has a whole world, so the art direction rests on one rule that keeps it honest:

1. **Walking around, you see with your eyes.** Deep focus, display tonemapping, no motion blur, no grain, no bokeh. At night the view dims and turns blue-grey and colourless, as human vision really does in the dark (the Purkinje shift).
2. **Through the viewfinder, and on film, you see only what the optics and emulsion produce.** Depth of field comes from the aperture you built. Motion blur comes from the shutter you built. Tone comes from the film's H&D curve, not a tonemapper. The photograph is often *different* from what you saw, and that difference is the game.

The second rule produces the collection's most surprising truths for free. A 10-minute exposure under a full moon prints as **daylight with stars in it** (moonlight is reflected sunlight). A focal-plane shutter makes the spinning whirligig lean. Racking the bellows drops the backyard into butter.

**Physics honesty rule.** Nothing squashes, stretches or bounces cartoonishly. The world must be photographable as evidence, so weight lives in sound and timing, never in deformed meshes.

---

## 2. Fiction and tone

### The house
A 1950s clapboard house at the end of a short gravel drive, in an unnamed summer suburb at **41.5° N**. Its rooms:

- A **basement darkroom**, which is the `darkroom` game's bench, moved home.
- A **detached garage workshop**, which is the `lensbench` camera designer with sawdust on it.
- A **backyard** with a lawn, a maple, a clothesline, an impact sprinkler, a tire swing, a kiddie pool, a picnic table, wind chimes and a whirligig.
- A **kitchen and hall** that link the rooms and hold everything you have made.

This is the same house that `texturedle`'s first month walks into, surface by surface: mailbox, gravel, picket paint, porch boards, the darkroom sink. The Studio is where that walk arrives.

### The owner: O.
The house belongs to **O.**, the unseen keyholder whose masking-tape notes teach `darkroom`. She has gone away for the summer and left you the keys. Her voice stays dry, kind and slightly bossy. She writes in grease pencil on tape around the house and in fountain pen on postcards.

- Garage door: *"Close it all the way. ALL the way. Then look at the back wall. — O."* (This sets up Wow 1.)
- Fridge: *"Best print of the week goes here. Be honest. — O."*
- Changing bag: *"Hands in. Eyes closed. It's easier with your eyes closed, I promise."*
- Thermometer by the basement stairs: *"Down here it's 20°C all summer. That's why the darkroom is down here."*

### Postcards are the quest structure
Each in-game morning the rusty mailbox's flag is **down**, and a postcard waits inside. The front is a procedurally hand-tinted view of wherever O. is. The back carries one assignment in her hand:

- *"Photograph something that is falling."*
- *"Make a picture with no lens."*
- *"Stop the water."*
- *"Leave the shutter open from dusk until the bats come out."*
- *"Get closer to the mailbox than anyone ever has."* (a Texturedle crossover: a 1:1 macro of the latch, with the same oxide palette)
- *"Send me a blueprint of the camera you built."*

You answer by pinning a print to the reply card, putting it in the box and **raising the flag**. Next morning the flag is down and a new postcard is waiting. There are no scores, stars or fail states. O.'s next card sometimes reacts in one line: *"The swing one. Yes."*

### Cross-game furniture (cameos, never plot)
- `darkroom`: the Lantern Street darkroom key hangs on the hall key rack.
- `plates`: a framed albumen print of a lighthouse on a rock hangs in the hall.
- `latent`: a manila evidence box in the hall closet, taped shut, with a case number in marker.
- `texturedle`: the mailbox. A marble sits in the kitchen junk drawer.
- `lensbench`: the garage bench holds Q.'s spare parts drawers and a few of his unfinished repair tags. Q. is O.'s neighbour from Lantern Street in the `lensbench` craft concept. A tape note on the view camera reads: *"Q. made these bellows. Don't tell him they leak. — O."* There really is a pinhole leak at one fold. Rack the bellows past 200 mm in full sun and a faint fog streak appears on the negative.

### Captions for sounds and smells
Following `darkroom`, optional italic subtitles caption sounds and smells: *[cut grass]*, *[hot asphalt]*, *[sunscreen]*, *[chlorine]*, *[sawdust]*, *[machine oil]*, *[vinegar]*, *[flashbulb: hot plastic]*, *[rain on concrete]*.

---

## 3. World, sun and light: real numbers

**Date and place.** The last Saturday in August at 41.5° N. Sunrise is about 06:15, sunset about 19:30, and the sun peaks at about **58°** at solar noon. A shared `src/shared/sun` module computes solar position from declination and hour angle. `darkroom`'s window station needs the same module for cyanotype sun exposure.

**Time.** One real second equals one in-game minute (24 minutes per day). A **sundial** on the patio doubles as the time scrubber: drag its shadow to skip ahead. An open shutter keeps integrating while you scrub, which is how long exposures are played.

**Exposure values** (ISO 100, the classic table every meter maker printed). These drive scene luminance, so the meter, the film and the eye all agree.

| Condition | EV₁₀₀ | Notes |
|---|---|---|
| Bright sun, distinct shadows | 15 | Sunny 16: f/16 at 1/125 on Nightjar 100 |
| Hazy sun, soft shadows | 14 | |
| Cloud across the sun | 13 | Cumulus shadows sweep the lawn and the meter needle dips |
| Open shade, under the maple | 12 | |
| Golden hour, last 40 min | 12 → 10 | Warm 3000–3500 K, long shadows |
| Blue hour | 8 → 5 | |
| Porch light at 3 m | 4 | |
| Full-moon landscape | −3 | About 10 min at f/8 on Nightjar 400 after reciprocity |
| Starlight, Milky Way | −6 | |

**Reciprocity failure** applies past 1 s, using the classic film-maker formula `t_corrected = t_metered^1.31`. That is why the moon shot takes 10 minutes, not 2.

**The meter** is a handheld **selenium** cell: no battery, true to the period. The needle has real damping and overshoot, and it twitches when a cloud crosses. A white dome slides over the cell for incident readings. The calculator dial is a rotating cardboard wheel.

---

## 4. Art direction

### The three rooms, three light regimes

| Room | Key light | Look | Note |
|---|---|---|---|
| **Backyard** | One directional sun with real elevation, a hemisphere sky and grass bounce | Warm, airy late summer. Dappled maple shade. Heat shimmer over the driveway at noon | One shadow map fits the small yard. Shimmer is screen-space refraction and appears in long-lens photos, as it does in reality |
| **Garage** | North window, two fluorescent tubes, a clamp lamp on the bench | Cool and dusty. Window shafts with motes. Pegboard in raking light | Tubes start with *tink-tink* and a 120 Hz buzz, shared with `darkroom` |
| **Darkroom** | Amber safelight | Inherited wholesale from `darkroom` (palette, LUT, dark adaptation) | The stairs are a transition: daylight fades step by step |
| **Kitchen and hall** | Window light plus one pendant | Linoleum, magnets, the gallery wall | This is the save browser (§8) |
| **Night yard** | Moon, porch bulb, fireflies, the kitchen window | Purkinje shift for the eye: desaturated, blue-shifted, rod-dim | The camera does not apply the Purkinje shift (Wow 3) |

### Palette

| Token | Hex | Use |
|---|---|---|
| sky-zenith / sky-horizon | `#5B8FD1` / `#CFE3F2` | noon sky gradient |
| golden | `#F2B66B` | low sun, rim light |
| lawn / lawn-shade | `#6E9E3A` / `#2F4A22` | grass, dapple |
| lawn-wet | `#4E7A2A` | where the sprinkler has passed: darker and glossier |
| clapboard | `#EDE6D6` | house siding, peeling to `#B9B2A2` |
| mailbox rust | `#C1652F` / `#7A3324` | shared with Texturedle's oxide palette |
| tomato | `#D9412B` | the tomato plants (they turn black on ortho film) |
| pegboard | `#B98A5A` | garage wall |
| brass / mahogany | `#B08D3C` / `#5A2A1B` | field camera, lens barrels |
| bellows red | `#7E1F1A` | leather bellows |
| leatherette | `#1C1B1A` | camera bodies |
| blueprint | `#003153` | Prussian blue, shared with `darkroom` |
| blueprint line | `#E8F1F7` | drafting strokes |
| scope green | `#39FF6A` | phosphor trace on the shutter tester |
| neon ready | `#FF6A2B` | flash ready lamp |
| night-eye | `#1B2740` | Purkinje grade target |
| firefly | `#D8FF5A` | bioluminescence, about 560 nm |
| safelight / lume | `#FF9A3C` / `#9CFF8A` | shared with `darkroom` |

### Materials
- **Bevels everywhere.** Procedural low-poly survives close inspection when every edge is chamfered and catches a highlight. Wood uses ring-noise grain. Brass gets fingerprint-smudged roughness maps. Leatherette is a Voronoi pebble normal map.
- **The pegboard has outlines.** Each tool hangs inside its marker-drawn silhouette, as in real shops. Take the file and its outline stays.
- **Small-parts cabinet.** Clear drawers with tape labels: `M2 SCREWS`, `SHUTTER SPRINGS`, `FLOCK PAPER`, `GLASS 517/642`, `GLASS 620/364`. These are six-digit **glass codes** (n_d and Abbe number). Opticians will grin.
- **Water is the yard's hero material.** Drops 1–3 mm across. The lawn darkens and gains specular where wet, then dries over about 20 game-minutes. The kiddie pool throws caustics onto its own floor and onto the fence.

### Typography

All fonts are self-hosted through `@fontsource`. The shared set comes from `darkroom`; three are new.

| Use | Face |
|---|---|
| Titles, logbook headings | **Fraunces** (shared) |
| Readouts, meter dial, frame counter | **IBM Plex Mono** (shared) |
| Tape notes, contact-sheet circles | **Permanent Marker** (shared) |
| O.'s postcards | **Caveat**, in fountain-pen blue-black `#1F2A44` |
| Engraved camera dials and DoF scales | **Archivo Narrow**, rendered into canvas textures with an inset-shadow "engraving" |
| Blueprints | **Hershey Simplex**, the public-domain single-stroke plotter font, drawn as line geometry |

**Dials are real dials.** The shutter ring reads `B 1 2 4 8 15 30 60 125 250 500`, with `60` in red and a lightning bolt as the flash-sync speed. The lens barrel's **depth-of-field scale** is computed from the lens you actually built: paired colour ticks per f-stop, and hyperfocal distance `H = f²/(N·c) + f` with c = 0.03 mm.

### Viewfinders are the UI
Each camera type has its own finder overlay, and each teaches something real:

- **Waist-level finder.** Ground glass with a Fresnel ring pattern, a grid and dim corners. The image is **mirror-reversed**, so pan left and the world slides the "wrong" way.
- **View camera.** The image is upside down and reversed on the ground glass. Pull the **dark cloth** over your head: the screen edges go black, the yard audio muffles through a 600 Hz low-pass, and the loupe appears.
- **Rangefinder.** A warm-tinted double-image patch that you merge to focus.
- **Pinhole.** No finder at all. You aim along two brass sight pins on top of the can.

### Post-processing
- **Eye view:** filmic tonemap, gentle bloom on the sun and speculars only, and a subtle vignette. No grain, no DoF.
- **Photographs:** none of the above. The capture is stored as linear exposure H (lux-seconds), and grain, halation and tone are applied by the `photochem` development pipeline.
- **No-WebGL2 fallback:** a 2D architectural **section drawing** of the house (basement, ground floor, garage, yard) in blueprint style. Each room is a 2D bench in the same palette, and photos are taken from fixed painted vantage points.

---

## 5. Procedural audio (WebAudio, all synthesized)

| Sound | Recipe |
|---|---|
| **Cicadas** (day bed) | Band-passed noise at 4.5–6 kHz, AM-pulsed at about 70 Hz inside 3–8 s swells. Two or three voices, panned, peaking at 14:00 |
| **Crickets** (night bed) | 4.5 kHz sine chirps, 3 pulses each. The chirp rate follows **Dolbear's law**, `T(°F) = 50 + (N − 40)/4`, from the in-game temperature. You could calibrate your developer temperature by ear. One tape note says so |
| **Impact sprinkler** | A *tsk* (noise burst plus a 2.8 kHz ping) every 0.4 s as the arm swings, then a fast ratchet of 18 clicks on the return. Spray hiss follows water pressure |
| **Wind chimes** | Free-free tube partials at 1 : 2.756 : 5.404 : 8.933, tuned to a pentatonic set, struck by the shared wind field |
| **Wind** | Low-passed noise whose gust envelope also drives leaves, clothesline prints, the swing and the chimes. **The wind is the conductor**: one gust visibly and audibly travels across the yard |
| **Distant lawnmower** | A 2-stroke sawtooth near 50 Hz with jittered firing, slow gain drift and Doppler. It stops at 18:00, as a neighbour's would |
| **Screen door** | Spring *boing* (two detuned resonators), then a wooden slam |
| **Tire swing** | Rope creak through friction stick-slip: a granular click train whose rate follows angular velocity |
| **Shutters** | Leaf: a soft dry *tik*. Focal plane: two cloth transients spaced by the curtain travel time. SLR: mirror up, shutter, mirror return within 40 ms (*ka-chunk*) |
| **Self-timer** | Escapement buzz (a 30 Hz pulse train through a resonant body) for 10 s, then the shutter |
| **Film advance** | A ratchet of 9 clicks per stroke. Rewind is a crank with a rising whirr and, at the end, the leader snapping free |
| **Bellows** | Air wheeze whose gain is driven by `dV/dt` of the bellows volume: rack fast and it wheezes |
| **Flash** | Capacitor whine sweeping 3 → 9 kHz over 4 s, then the neon ready lamp ignites with a tiny click. Flashbulb: a muffled *pop* and a glass tick as it cools |
| **Darkroom** | Inherited from `darkroom`: drip, fan, slosh, timer bell |

There is no score. The only music is the chimes, and the wind plays them.

---

## 6. Photographic authenticity

### The capture pipeline (shared with `lensbench`)
1. **Thin-lens accumulation.** Each photo is 16–64 renders, jittered across the actual aperture polygon (a blade count from the build). Bokeh shape, DoF and focus falloff are real, not a blur filter. Mechanical vignetting clips the aperture by the barrel's front opening toward the frame edge, which makes the cat's-eye bokeh of a Petzval.
2. **Shutter as integration.** Accumulation samples are spread across the open time of the shutter. A focal-plane shutter gives each row band its own time window, so rolling distortion emerges by itself. A leaf shutter uses its real trapezoid open/close profile.
3. **Latent image** is a float texture of H (lux-seconds), weighted by the film's spectral sensitivity. Ortho film is red-blind, so tomatoes print black and lips go dark.
4. **Hide the latency inside the diegesis.** Accumulation runs while the film-advance animation plays, which takes 0.8 s anyway. Phones use 8 samples; SwiftShader uses `__game.shoot({samples: 4})`.

### Cameras you can build (garage)
| Build | Real numbers |
|---|---|
| **Oatmeal-can pinhole** | f = 100 mm. Rayleigh's optimum `d = 1.9·√(f·λ)` gives 0.45 mm at λ = 550 nm, which is **f/224**. Loaded with paper as a negative (about ISO 6, blue-sensitive): about 25 s in sun plus reciprocity, so roughly 45 s. Skies blow out and greens go dark, exactly as on real paper negatives |
| **Meniscus landscape lens** (the 1812 recipe) | A single crown element with the stop in front, f/14. A soft glow and gentle field curvature |
| **Achromatic doublet** | Crown 517/642 cemented to flint 620/364. The tape note reads: *"Two glasses, two colours, one focus."* |
| **Portrait lens** (the 1840 recipe) | f/3.6. Sharp centre, curved field, **swirling cat's-eye bokeh** in the maple leaves |
| **Triplet** (the 1893 recipe) | Three elements and six surfaces, f/4.5. The first lens a modern eye calls sharp |
| **Shutters** | Lens cap (count "one-thousand-one"). **Gravity drop shutter**: a 20 mm slit falling 30 cm gives v = √(2gh) = 2.4 m/s, about 1/125. Add the rubber band for 1/500, as Victorians did. Rapier simulates the drop, so friction makes it honestly inconsistent. Leaf shutter, 1–1/500. Cloth focal-plane shutter with 12 ms travel, which is why its flash sync is 1/60 |
| **View camera** | A 150 mm lens on red bellows with tilt. See the Scheimpflug moment below |

**Shutter tester.** A photodiode on the bench feeds a green-phosphor **oscilloscope** trace of each firing. Old leaf shutters run slow (the dial says 1/500, the trace says 1/310), and you can file the spring. Engineers will screenshot this.

### Film (invented brand, shared with `darkroom`)
**Nightjar Photographic.** Nightjar 100, Nightjar 400, and **Nightjar Ortho 25**, red-blind and developable by inspection under the safelight. Edge printing reads `NJ 400 ▸ 14 ▸ 14A`.

| Step | Real-world basis |
|---|---|
| **Loading the reel** | In the **changing bag**: hands in, screen black, audio and haptics only. You feel the reel's clip and the film's edge. Squeeze too hard and it **kinks**, leaving a dark crescent-moon mark on that frame of the negative. That mark is real and every film photographer has made it |
| **Developer** | Nightjar 400 in stock 1+1: 9:30 at 20°C. Time drops about 10% per °C above that. Mix chemistry in the 27°C garage instead of the basement and the negatives come out dense and grainy |
| **Agitation** | 30 s continuous, then 4 inversions every minute. Tank slosh audio comes from the shared liquid module |
| **Push** | +1 stop means about +40% development time, with grain and contrast rising |
| **Fix** | Twice the clearing time. Drop the film leader in first and watch it go clear |
| **Wash** | The anti-halation dye leaves a **magenta-pink cast** that drains away during the wash. Any pink left means "wash more" |
| **Dry** | Clip at the top, weighted clip at the bottom. Squeegee is optional, and it sometimes scratches |
| **Contact sheet** | The gallery itself: a sheet per roll, circled in red grease pencil |

### Flash
- **Guide numbers.** GN 32 (m, ISO 100), so f/8 at 4 m. At 1/16 power the flash lasts about **1/16,000 s**, and the flash duration, not the shutter, freezes the sprinkler drops.
- **Flashbulbs** peak about 20 ms after firing. Fire one on X sync at 1/250 and you get a **black frame**. Photographers know.

### Small truths
- Open the camera back mid-roll and the last frames fog; the first frames survive inside the cassette.
- A wet front element from the sprinkler puts soft drop-shaped blobs in the photo.
- Sun-dapples under the maple are **circles**, because every gap in the leaves is a pinhole. On the optional eclipse day they turn to crescents.
- Fireflies flash a J-shaped swoop every 5–6 s at 25°C, and the period follows temperature. On a long exposure they write small J's across the dark.
- **Polaris** sits exactly 41.5° up over the back fence, and the sky turns 15°/hour around it.
- **The blueprint loop.** The garage drafting sheet *is* a blueprint, and blueprints *were* cyanotypes. Print your camera's drawing as a transparency, contact-print it on cyanotype paper at the picnic table in real sun, and pin your own blueprint on the garage wall.
- **Photograms.** Fern, bike chain and lace doily laid on cyanotype paper at the picnic table. Passing clouds visibly slow the exposure.

---

## 7. Three wow moments (the screenshots)

### 1. The Garage Obscura
Close the garage door. Tape the window. Peel back a square of tape over a nail hole. Your eyes adapt over about 10 seconds (a compressed version of the real 10–15 minutes). Then **the backyard appears on the back wall: upside down, in colour, moving.** The sprinkler arcs, the swing drifts, and a cloud shadow crosses the lawn on the pegboard. Widen the hole and the image brightens and blurs. Tape a magnifying glass over it and it snaps sharp. Pin a sheet of paper to the wall and **the garage itself takes the picture**: at 6 m the optimal hole is 3.4 mm, about f/1750, so the exposure is about an hour. Scrub the sundial and the swing becomes a ghost.
*Implementation:* render the yard from the hole's position, flip it, and project it onto the wall with brightness ∝ hole area and blur ∝ hole diameter. One extra camera, no new systems. This is the moment the title promises: the house takes pictures.

### 2. Negatives against the sky
Pull the wet strip from the wash and hold it up to the kitchen window. **Your own photographs, reversed**, glow against the summer sky. Water beads run down the base and the last pink of the anti-halation dye fades. Edge printing and frame numbers sit beside your kinked crescent if you made one. Drag the loupe along the strip and every frame inverts to positive inside its circle. It is the most universal film moment there is, and the game rewards it with the real thing.

### 3. Moonlight is sunlight
At 23:00 the yard is what your eye gets: blue, grey, dim and colourless. Set the tripod and open the shutter on **B**. Scrub an hour off the sundial. The print comes up in the basement looking like **a warm afternoon with stars in the sky**: green lawn, tomato red, long arcs of star trails wheeling around Polaris above the fence, the kitchen window a glowing amber block, and firefly J's in the dark corners. Show the eye view and the print side by side on the share card. The true fact (moonlight is just reflected sunlight, and film has no Purkinje shift) is what makes the image surprising.

### Honourable mentions
- **Scheimpflug 5°.** A level 150 mm view camera at eye height with **5° of front tilt** has its hinge line `J = f / sin 5° = 1.72 m` below the lens, which is the lawn. The whole yard, toe to fence, comes into focus at f/8. Andrew's "tilt 5 degrees", made literal and true.
- **The leaning whirligig.** A 12 ms cloth focal-plane shutter at 1/1000 bends the spinning blades into sabres.
- **Stopping the water.** One-sixteenth-power flash on the sprinkler: every drop becomes a glass bead in mid-air.
- **Soap bubbles** with thin-film interference colour computed from film thickness, draining from magenta-green to gold to black just before they pop.

---

## 8. Everything you make stays (the house is the save file)

The house fills up with your work, and this is the persistence model and the share hook. Saves live in IndexedDB as small PNG blobs plus JSON.

- **The fridge**: up to 8 prints under fruit magnets. The **share card** is the fridge door. Prints sit slightly askew, with a magnet shadow and a grease-pencil caption: `NJ 400 · f/8 · 1/125 · triplet 105mm · 16:40`.
- **The clothesline**: the last 6 prints, swaying in the shared wind field.
- **The hall gallery**: framed favourites. Click a frame to read its logbook entry.
- **The contact-sheet binder** on the kitchen table: every roll ever shot.
- **The cameras** you build sit on the hall shelf and can be picked up from any room.
- **The mailbox**: postcards in a shoebox, newest on top.

---

## 9. Notes for the synthesizer

- **Must have:** the eye-versus-camera rule; the sun module with the EV table; linear-H capture with thin-lens accumulation; the pinhole build and one glass-lens build; one viewfinder style per camera; tank development with the time/temperature rule; the fridge and clothesline persistence; the Garage Obscura; the mailbox postcards; the cicada, sprinkler, chime, wind and shutter audio.
- **Should have:** moonlit star trails, the Scheimpflug tilt, flash with guide numbers and the whine, focal-plane rolling distortion, the changing bag with crescent kinks, the oscilloscope tester, Dolbear crickets, the blueprint loop, photograms.
- **Cut first:** the eclipse day, bubbles, the drop shutter's rubber band, the lawnmower, ortho film.
- **Shared modules this needs:** `photochem` (spectral sensitivity, H&D, development kinetics, paper), `optics` (prescriptions, DoF, pinhole), `filmcan` (the latent-roll format proposed in `lensbench-craft`, so a roll can move between games), `sun` (new, also used by `darkroom`), `liquid` (tank and tray slosh), `audio-kit` (noise beds, resonators, impact synths), `wind` (one field shared by audio and physics).
- **Phones:** the yard uses tap-to-walk on the lawn, not a virtual joystick. The changing bag is a perfect touch interaction: two thumbs in the bag, with `navigator.vibrate` pulses on the reel clips. Device tilt levels the tripod bubble.
- **Test API:** `__game.setTime('23:00')`, `__game.goto('garage')`, `__game.shoot({samples})`, `__game.develop(roll)`, `__game.state()`.
