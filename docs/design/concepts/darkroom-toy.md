# Darkroom — concept through the TACTILE PHYSICS TOY lens

**Proposed title:** **Silver & Iron**
**Subtitle:** *a darkroom you can slosh*
(Alternates: "Wet Work", "Safelight". Slug stays `darkroom`.)

**One-line pitch:** a single long bench under a red bulb where every surface is wet, every light is a hazard, and the image appears *only where the liquid actually touched the paper*. You don't press "Develop". You rock a tray.

**Design rule for this lens:** no button does chemistry. Every chemical event is caused by a physical act: tilt, pour, poke, drip, brush, blow, flip, peek. The UI is the room.

---

## 1. The room (one continuous bench)

A fixed 3/4 overhead camera (35 degree pitch, slight orthographic feel, FOV 30) looks down a bench that scrolls left/right. Desktop shows about three stations at once; phones in portrait show one station full-screen with a thin "bench strip" minimap at the bottom you swipe along.

Left to right:

1. **Light table**: photo prep for imported PNGs, plus the transparency "printer".
2. **Enlarger + easel**: column, head crank, focus knob, contrast-filter drawer, dial timer.
3. **Three trays**: developer (faint straw), stop (pale amber), fixer (clear). 11x14 inch trays, 1.2 cm of liquid.
4. **Sink + wash tray**: a tap you turn, running water, a dish sponge (homage to where these notes were dictated).
5. **Cyanotype corner**: bottle A, bottle B, a graduated beaker, hake brush, glass rod, hairdryer, clothesline.
6. **Window sill**: a roller blind you pull up to let the sun in. Clouds drift. Also a UV box with a lid.

On the wall: the **room-light switch under a flip-up guard**, the **safelight with a pull chain**, and the **clothesline gallery** where finished prints hang and sway.

---

## 2. The 10-second / 1-minute / 10-minute fun

**10 seconds.** No menu. The page opens in the dark, the safelight already on, and *someone left a print in the developer*: a pre-exposed sheet (a dish rack in a window, a rusty mailbox nodding to Texture-dle) lies dry-side-up, half-submerged. The only thing that glows is a hint: the tray rim pulses faintly. You grab the rim, tip it, and a wave rolls across the paper. Where the wave passes, shadows bloom out of white. Your first interaction *is* development. Most people will rock it five more times before they read anything.

**1 minute.** You find the switches. Pull the safelight chain (clack, hum). Flip the guard on the room light, hit the switch, and the screen whites out (you were dark-adapted). The print in the tray goes to black in 2 seconds with a sad descending tone. Undo with the rewind dial. Then make a real print: slide a built-in negative into the enlarger, crank the head, tap the timer, and **dodge with your own hand**: the cursor casts a soft hand-shaped shadow on the easel during the exposure. Drop it in the developer and watch your dodge appear.

**10 minutes.** Full cyanotype from your own PNG. Drop the file on the light table, flip the INVERT toggle, bend the curve wire, print a transparency. Pour A and B into the beaker (watch them go yellow-green), brush-coat a sheet (your streaks will survive into the final print), blow-dry it, clamp it under glass with the negative, blow dust off with a rubber bulb, carry it to the sill, pull the blind, wait out a passing cloud, peek through the split-back, wash out the yellow, dribble peroxide and get the *blue pop*, tone it in tea, pin it to the line. Save state.

---

## 3. Input mappings

| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Tilt a tray | Press on a tray rim and drag. That edge lifts and the tray pivots on the opposite edge. Angle = drag distance x 0.12 deg/px, max 10 deg (30 deg to pour). | One finger drag on rim. **Or**: two fingers anywhere on the tray tilt it in 2D like a trackpad. |
| Rock | Release: the tray drops back on a spring-damper and bounces. Hold **R** to auto-rock at 0.5 Hz. | Release. Optional **"Phone is the tray"** gyro mode (DeviceOrientation, behind an explicit permission tap on iOS). |
| Jolt | Fast flick on the tray body slides it up to 2 cm (fictitious force sloshes everything). | Same. |
| Tongs: grab paper | Press-hold on paper (120 ms). The cursor becomes tongs and the sheet lifts 3 cm and drips. Drag to move, release over a tray to drop it in. | Same. Second finger drag up/down raises/lowers. |
| Dunk | Quick click on paper in liquid pushes it under, sending a ring wave out. | Tap. |
| Finger | Right-drag, or toggle hand tool (**H**). Pokes liquid (ripple impulse), touches paper (fingerprint if your finger is wet with chemistry). | Long-press then drag with hand tool selected. |
| Room light | Click the guard (flips up, spring snap), then the switch. **L** does both with a 300 ms delay. | Tap, tap. |
| Safelight | Drag the pull-chain down and release (it bounces). | Same. |
| Enlarger | Drag the crank (height = print size), scroll or drag the focus knob, slide the filter drawer, tap the timer dial. | Same, knobs take circular drags. |
| Dodge / burn | During exposure, **hovering** casts a hand shadow; holding the button closes it to a fist (smaller occluder). **D** swaps to a wire dodging wand, **B** to a burning card with a hole. | Finger held over the easel; the shadow is offset 60 px above the fingertip so the finger never hides the result. |
| Pour a bottle | Grab the bottle and drag sideways to tilt. | Same. |
| Brush coat | Drag. Speed and dwell set the deposit. | Same; pressure on supported devices. |
| Hairdryer / blower bulb | Hold to blow (dryer). Click-hold to squeeze the bulb, release to puff. | Same. |
| Rewind dial | **Z** or drag the dial on the bench clock: scrub back up to 30 s. | Drag the dial. |
| Stations | **A/D**, arrow keys, edge-drag on empty bench, **1-6**. | Swipe on the bench strip. |

---

## 4. Physics models

### 4.1 Liquid: virtual-pipes shallow water, in tray space

Each tray is a 64x48 heightfield (dx = 6.25 mm over a 40x30 cm tray). Water depth h, four outflow fluxes per cell (the "virtual pipes" model: conservative, unconditionally positive, cheap).

Effective gravity in the tray frame includes tilt and the tray's own acceleration:

```
g_eff = R_tray^T * (0, 0, -9.81) - a_tray      // a_tray from drag/jolt, low-passed
bed potential   b(x,y) = -(g_eff.x * x + g_eff.y * y) / |g_eff.z|
head            H = h + b
flux update     f_i <- max(0, f_i * (1 - 0.9*dt) + dt * A * |g_eff.z| * (H_c - H_n) / dx)
clamp           K = min(1, h * dx^2 / (sum f_i * dt));  f_i *= K
depth update    h <- h + dt * (sum f_in - sum f_out) / dx^2
```

- Base depth 12 mm, wave speed c = sqrt(g*h) = 0.34 m/s, so a wave crosses the tray in about 1.2 s. That's a slow, satisfying slosh, not a jitter.
- dt = 4 ms, 4 substeps per 60 Hz frame (CFL: dx/c = 18 ms, so safe). 3,072 cells x 3 trays on CPU is trivial. A fragment-shader ping-pong version is optional.
- Damping 0.9/s on flux plus a small wall reflection loss (0.85), so a single rock rings for 3 to 4 seconds.
- **Velocity** u per cell is the net flux divided by (h*dx). It drives paper drift, agitation (see 4.3) and sound.
- **Overflow and pouring.** If a wall cell's H exceeds the rim height (20 mm), outflow becomes a particle stream. Tilt past 25 deg and the tray actually pours; volume is conserved. Spill lands on a 32x24 **bench puddle field** with high friction and a persistent **stain map** saved with the game. The bench gets lived-in.
- **Splashes.** When the wall impact energy (rho * h * u^2) passes a threshold, emit up to 200 ballistic droplets. They make dots on the bench, on dry paper (spotting!), and a drip sound when they land.
- **Rendering.** The heightfield mesh is displaced in the vertex shader, normals come from central differences, and Beer–Lambert absorption tints by depth (`color = under * exp(-sigma * h)`). The safelight's red reflects as long specular glints on the waves, and caustic lines on the tray floor come from the normal map. Most of the "wet" feeling comes from those red glints.

### 4.2 Tray body: spring-damper

```
theta'' = -k*(theta - theta_rest) - c*theta' + tau_user / I
k = 140 s^-2, c = 6 s^-1   (about 1.9 Hz, slightly underdamped)
```

Dropping a lifted corner gives one small bounce and a big slosh. A soft **clunk** plays on the first contact (volume proportional to impact speed).

### 4.3 Paper: floating sheet plus per-texel fields

The sheet is a rigid 2D body in the tray plane (position, rotation). Fluid drag F = 0.8 * (u_fluid - v_paper) * area, and buoyancy falls as the sheet wets (wetness w goes 0 to 1 with tau = 3 s). A dry sheet floats with its corners curled up, so the **corners don't develop unless you dunk or rock**. That's a real darkroom annoyance, and here it becomes a reason to play.

Per-texel fields (print resolution 512x640 desktop, 256x320 mobile, stored as RGBA16F ping-pong textures, updated in a fragment shader):

- `E`: accumulated latent exposure (lux-seconds, spectrally weighted)
- `c`: local developer concentration at the emulsion (boundary layer)
- `n`: development nuclei, and `p`: development progress
- `x`: remaining unfixed halide (sensitivity), plus `r` residual fixer

**Contact mask.** A texel is in contact if the liquid depth above it (sampled from the tray heightfield) is greater than 0.5 mm. No contact means no chemistry. This is the heart of the toy.

**Agitation is rewarded mechanically.** A depletion boundary layer:

```
dc/dt = -0.4 * dp/dt  +  m * |u| * (c_bulk - c)       m = 9 m^-1
```

A still tray depletes the developer next to dense areas, which gives mottling and streaks ("bromide drag") downstream of shadows. Rocking replenishes it. Nobody has to explain agitation: you see it.

**Autocatalytic development** (gives a natural induction period: shadows show first at about 8 s, full density by 60 to 90 s):

```
dn/dt = k1 * c * contact * S(E)                  k1 = 0.05
dp/dt = k2 * c * contact * (n + 0.02) * (1 - p)  k2 = 0.9
S(E)  = 1 / (1 + exp(-gamma * (log10 E - log10 E0)))   // H&D shoulder/toe
D     = Dmin + (Dmax - Dmin) * p * S(E)           Dmax = 2.1, Dmin = 0.05
gamma = 1.6 ... 5.5 from the filter drawer (grades 00 to 5)
k     *= 2^((T - 20) / 10)                         // tray temperature, default 20 C
```

**Stop:** contact with the stop tray sets c to 0 within 0.5 s. Carried-over developer (drip count when you lift the sheet) weakens the stop and gives a little sound cue. **Fix:** dx/dt = -x / 12 s on contact. Light after x < 0.05 does nothing. **Unfixed silver** keeps darkening slowly under room light (print-out), and **under-washed fixer** (r > 0.2) yellows the print **in real calendar time** on reload. Your saved underfixed print really will have turned yellow by next week.

### 4.4 Light: four sources, one shadow map

Every light accumulates `E += I_source * S_paper(spectrum) * occlusion * dt` per texel.

| Source | Relative sensitivity (silver / cyanotype) | Play role |
|---|---|---|
| Room light | 1.0 / 0.02 | Instant doom (silver fogs to black in about 2 s) |
| Safelight (amber) | 0.0018 / 0 | "Safe" for about 3 min of open-air time, then gradual grey fog |
| Enlarger (white, through negative) | 1.0, falls off with head height^2 | Printing |
| Sun / UV box | 0.6 / 1.0 | Cyanotype; clouds modulate the sun with drifting Perlin noise |

Occlusion is a single 512x512 shadow map from each active light. Occluders include the **hand/wand/card**, tongs, Rapier objects resting on paper, other sheets, the tray rim, and **dust specks** on the negative. Hand-shadow softness comes from occluder height above the easel (penumbra = h * aperture / throw), so lifting your "hand" (scroll wheel) feathers the dodge. That's real dodging technique, learned by feel.

**Hidden safelight test:** put the brass coin from the drawer on a sheet, leave it under the safelight 5 min, develop. A faint coin ghost proves the fog model. It's an Easter egg darkroom people will recognise.

### 4.5 Emergent "accidents" that are actually art

- **Sabattier (pseudo-solarization):** flip the room light for 0.5 to 1.5 s when the sheet is between p = 0.25 and 0.6. The second exposure E2 adds density mostly where D is still low, so tones partially reverse. Mackie lines come from `D -= 0.35 * max(0, blur(D, 6px) - D)` at the bright side of edges. Most players will discover this by accident. When that happens, the gallery tag reads *"Happy accident."*
- **Photograms:** Rapier props (fork, spoon, key, paperclip, leaf, a scrap of fine lace that nods to Texture-dle's cloth) can be thrown onto paper under the enlarger. Their actual resting pose is their shadow. Throwing a fork at the easel is a legitimate art technique here.
- **Chemigram mode:** take a finger or the brush to the trays and *paint* developer or fixer onto paper in room light. Resist-painting with chemistry is a real experimental technique and an endless toy.
- **Fingerprints:** your finger has a state (clean / dev / stop / fix). Touch dry paper with a developer finger and a procedurally whorled print turns dark later. The sink sponge cleans it. Tiny, funny, true.

### 4.6 Cyanotype chemistry

Sensitizer: A = ferric ammonium citrate (green-yellow), B = potassium ferricyanide (amber-orange). The beaker colour lerps by ratio and the target is 1:1. **Pouring** is real: stream rate `Q = Q_max * max(0, sin(theta - theta_lip(fill)))`, where theta_lip shrinks as the bottle fills, so a full bottle glugs early. The stream is a particle ribbon with a "glug" oscillation at 4 Hz when theta is just past the lip.

**Coating:** paper holds a thin-film field `wet` (deposited by the brush, diffusing at D = 2 mm^2/s, soaking into `s` with tau = 4 s). The brush stamps a 1D bristle-noise profile across its width, so **streaks and pooled edges survive into the final blue**. The glass rod deposits a smooth bead, and the foam brush something in between. Over-wet pools bronze later.

**Drying:** `wet` evaporates at `e * (1 + 6 * airflow)`. The hairdryer's cone pushes film (rivulets!) and makes the sheet cockle (vertex noise proportional to wetness). Exposing while damp gives muddy, weak blues.

**Exposure (print-out, visible live):**

```
dq/dt = k_uv * I_uv * occl * neg_transmission * (1 - q) * s_dry     k_uv tuned: 40 s full sun to q = 0.9
```

Exposed areas shift visibly from lemon to slate to bronze **while you watch**. The contact frame is **split-back**: drag one hinge open to peek at half the sheet without moving the negative. Peeking is the only progress bar.

**Wash:** free sensitizer `s_free = s * (1 - q)` leaves on water contact (from the tap stream particles or the wash tray heightfield), releasing **yellow-green dye clouds** into the water (a dye field advected by the fluid u). Wash water slowly turns yellow, and you can tip it into the sink. Blue `B = q * s` starts mid-blue.

**Peroxide:** a few drops from the dropper produce an instant radial **bloom to deep Prussian blue** from each drop's landing point (oxidation front speed 3 cm/s). This is the money shot: tactile, fast, gorgeous.

**Toning:** a tea tray (tannin) shifts hue toward violet-black or brown over 60 s. A washing-soda tray first *bleaches* blue toward pale straw; a tea bath afterwards gives sepia (classic bleach-and-tone). Both are just more trays to slosh. The same liquid sim, new colour constants.

---

## 5. Photo prep, made physical

The light table shows your PNG as a backlit sheet. The controls are objects, not panels:

- A big **INVERT** toggle (clack). The image flips with a 120 ms tween.
- A **curve wire**: a springy bent wire over a ruled grid. Drag any point and neighbours follow with spring tension (a 1D chain of 9 nodes, k = 40). The image updates live.
- A **grayscale/channel dial** (R, G, B, luminance) with detents.
- A **"print transparency"** lever. A chunky printer feeds out the negative with a stepper-motor whir. It becomes a physical object you can carry to the enlarger (to print your PNG on silver paper) or to the contact frame.
- **Dust:** 3 to 12 specks land on the glass whenever the frame is opened. The **rubber bulb blower** (click-hold to squeeze, release to puff) pushes them with an impulse proportional to squeeze time (0.2 to 0.6 s). Leftover specks become white dots in the print, which teaches you to check.

---

## 6. Juice

**Sound (all WebAudio, synthesized):**

- *Slosh:* band-passed brown noise, gain proportional to wall-impact energy, centre frequency 300 to 900 Hz that drops with depth, stereo-panned by impact x.
- *Drip:* sine plus a pitch glide (1,400 to 650 Hz in 35 ms) and a tiny noise click. Pitch randomised by 10%.
- *Switch:* 8 ms noise burst plus a 2.2 kHz resonant ping. *Guard flip:* low thunk plus a spring "boing" at 180 Hz.
- *Safelight:* faint 120 Hz hum plus harmonic, which fades in as your eyes adapt. *Enlarger:* fan hiss while on.
- *Dial timer:* mechanical tick per second, a soft ratchet when you wind it, and a bell ding (two inharmonic partials) at zero.
- *Tap:* pink noise through a 2 kHz bandpass, with gurgle bursts when the tray fills.
- *Peroxide bloom:* soft rising shimmer, a very quiet glass harmonic. The only "magic" sound in the game, reserved for that one moment.
- *Paper:* crinkle granules on grab, and a wet "slap" on drop.
- Android: `navigator.vibrate(8)` on clicks, 15 to 25 ms on splashes and drops.

**Visual:**

- **Dark adaptation:** a global exposure that eases toward the scene light level with tau = 4 s going dark and 0.25 s going bright. Turning on the room light after a dark session whites out with bloom, then settles. In true darkness (all lights off) you see almost nothing and must work by sound, rim glints and memory for a moment. That's eerie and good.
- The image **emerges in time with the physics**: shadows first, highlights last, unevenly wherever the liquid didn't reach.
- Drips trail from lifted paper (rate proportional to wetness, slowing like a real drain: 1/t). Dye clouds in the wash tray. Bubbles when pouring. Cockle warp on wet paper.
- Prints on the clothesline are 6x8 verlet cloth patches with pins. Bump them and they swing.

---

## 7. Save states and the rewind dial

- **Rewind dial (the toy version of save states):** a ring buffer of every per-texel field (quantised to 8-bit, 256x320) plus tray heightfields, chemistry levels and light states, captured once a second for 30 s (about 10 MB). Scrub the dial on the bench clock to go back. It makes "what if I flip the light now?" consequence-free and *encourages* experimentation.
- **Save slots:** in IndexedDB. Each slot is shown as a Polaroid-style thumbnail pinned to a corkboard by the door: the whole bench, all sheets mid-process, stain map, gallery. Autosave every 20 s plus on `visibilitychange`.
- Gallery prints export as PNG at full print resolution.

---

## 8. Performance and fallbacks

- Liquid sim on CPU (3 to 5 small grids), chemistry fields on GPU (RGBA16F, `EXT_color_buffer_float`). Without float targets, fall back to RGBA8 with packed fields at half resolution.
- Only the paper(s) in the active station update at full rate; off-screen sheets tick at 4 Hz.
- No WebGL2: a top-down Canvas2D bench with the same CPU liquid sim (48x32), print fields at 192x240, and simpler shading. Every verb still works.
- Target 60 fps on a mid-range phone at DPR capped to 2.

## 9. `window.__game` (test API)

```ts
__game = {
  ready: Promise<void>,
  station(id: 'prep'|'enlarger'|'trays'|'sink'|'cyano'|'sill'),
  lights(s: {room?: boolean, safe?: boolean, enlarger?: boolean, uv?: boolean}),
  tilt(tray: 'dev'|'stop'|'fix'|'wash', ax: number, ay: number),
  step(seconds: number),               // deterministic fixed-step advance
  demo(name: 'first-print'|'sabattier'|'cyanotype'|'photogram'),
  loadPNG(dataUrl: string),
  stats(): {meanDensity: number, coverage: number, fog: number, blue: number},
  save(slot: number), load(slot: number), rewind(seconds: number),
}
```

`demo()` drives scripted, seeded sequences, so Playwright can screenshot each wow moment: the bloom in the tray, the Sabattier print, the peroxide pop and a photogram.

---

## 10. What makes it shareable

1. "The image only appears where the water touched it", shown in a 5-second clip of a wave rolling across paper.
2. Dodging with your own hand-shadow.
3. Flipping the light by accident and getting a solarized print you didn't know was possible.
4. Throwing a fork at a sheet of paper and getting a beautiful photogram.
5. The peroxide bloom to Prussian blue, on *your* photo, with *your* brush streaks.
