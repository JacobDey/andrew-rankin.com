# LENS BENCH: build the camera the photo needs

*Game 5, slug `lensbench`. Concept through the **game design** lens.*

**Title:** LENS BENCH
**Subtitle:** *build the camera the photo needs*
**Hub blurb:** "Grind glass, bend light, then go out and prove it."
(Alternates: **Circle of Confusion**, or **Ferrule Bay Camera Works** if the hub wants a place name.)

---

## 1. The game in one sentence

A client pins a note to your workshop door asking for a photo. You build the camera that can take it on an optical bench, carry it out into a little seaside town, spend a few precious frames, develop the roll, and deliver the print, or a better accident.

**The twist that makes it a game: every level is an inverse problem.** The photo is the question and the camera is your answer. The game never asks "what do these settings do?" It asks "what machine makes *this* picture possible?"

## 2. Pillars

1. **Problem before part.** No part is introduced until the player has just ruined a photo for lack of it. The lens arrives after a blurry pinhole print. The tripod arrives after a shaky one. The flint element arrives after a fringed one.
2. **Show the ray, not the rule.** The bench draws live red/green/blue rays through your glass, and the blur spot is visible before you shoot. Numbers (f/8, 1/250, ISO 400) fade onto dials only after the player has felt what they mean.
3. **The print is the verdict, and the verdict explains itself.** Grading is analytic. The sim knows the true distance, speed and position of every subject, so a failed print always says *why*, in grease pencil, on the print.
4. **Mistakes have a buyer.** The town has a Curator who only pays for accidents. Weird experiments are never wasted, which keeps the toy alive inside the game.

## 3. Core loop (~5 minutes)

| Stage | Time | What the player does | What it teaches |
|---|---|---|---|
| **Door** | 10 s | Pick a note: a client doodle, a ≤8-word ask, the budget, the frame count | Goal framing |
| **Bench** | 1-3 min | Drag glass onto the rail, bend surfaces, set the stop, choose body, shutter and film. Watch rays and the blur spot | Optics |
| **Field** | 1-2 min | Hop between chalk-X standpoints, aim, focus, hold to steady, fire, wind on | Exposure, timing, motion |
| **Tank** | 30 s | Pour, invert to agitate, choose push/pull, pull the strip, hold it to the window | Development and the reveal |
| **Wall** | 20 s | Pin a frame to the client's note, get the verdict and stamps, unlock a part | Reward and diagnosis |

**Film is scarce on purpose.** A brief gives you 4-12 frames. Every press of the shutter costs something, so each shot is a decision and not a spray. You don't see results until the Tank. Undeveloped film is the game's suspense engine.

**The Tank is a loading screen made of fun.** The physically-motivated renderer (aperture and time subframe accumulation for DOF, motion blur, long exposure and slit shutters) is expensive. It runs in the background while the player agitates the tank. On slow phones the agitation just goes on longer, so the timer *is* the progress bar.

**One roll, one development.** Push or pull applies to the whole roll, as it does in reality. If you shot a bright midday frame and a dusk frame on the same roll, the Tank asks you to pick a compromise. It is a real strategy layer that costs almost no code.

## 4. Information is the progression

Most camera games hand you a perfect preview. LENS BENCH makes **what you can see before the shutter fires** the main thing you unlock:

| Viewfinder tier | You see | Unlocked by |
|---|---|---|
| **None** (pinhole shoebox) | A sight line drawn on the box lid | Start |
| **Wire frame finder** | Framing only. No focus, no depth of field | Ch.1 |
| **Rangefinder patch** | Framing plus a split-image focus patch (a double image that merges when focused) | Ch.2 |
| **Ground glass / reflex** | The true image, upside-down on view cameras. Stop-down preview shows DOF | Ch.3 |
| **Selenium meter → TTL needle** | Exposure guidance. Before this, only the Sunny-16 sticker on the camera back | Ch.1 → Ch.3 |

Early frames are acts of faith and the developed print is your teacher. By the late game the player has earned the right to see everything, and the challenges shift from "guess right" to "build something that can physically do it."

## 5. Onboarding: the first three minutes, with no wall of text

1. **0:00.** A workbench, a shoebox and a sewing pin glowing faintly. The note on the door is a doodle of a lighthouse, an arrow and a shoebox. The only text is *"Odile wants her lighthouse."*
2. **0:10.** Drag the pin into the box and a hole appears. Drag further and it widens. Faint rays fan through the hole onto the back wall.
3. **0:20.** Tap the lid open. **The inside of the box shows the live, upside-down lighthouse (a camera obscura).** Widen the hole and it gets brighter and blurrier. Shrink it and it gets sharper, then *blurrier again* as diffraction takes over. A soft chime marks the true optimum (≈1.9·√(f·λ), about 0.55 mm for a 150 mm box). This is the first "aha", and nobody explained anything.
4. **0:50.** Walk out the door to the Field. The box sits on a fence post. Hold the tape flap open and a tick sounds per (compressed) second. Release after about ten ticks.
5. **1:20.** Tank: the paper negative blooms in a tray (white sky goes black). Flip it into a contact print and the positive appears.
6. **1:50.** Odile's note gets a pinned print, a hand-drawn smile and the stamp **ACCEPTED**. A single meniscus lens slides onto the bench. Her next note says *"Can you read the year above my door?"* That teaches focus, and introduces the game's best verb (section 9).

**Teaching rules:** one new verb per commission; labels appear after first use; the client doodle states the goal; the reject print explains the failure.

## 6. Ferrule Bay: every prop is a test target

The Field is one small fictional harbor town at a fixed scale, explored via ~7 **standpoints** (chalk X's and tripod marks) with a few meters of nudge for distance tuning. Standpoints keep distances authored, puzzles fair and mobile controls simple. Each prop exists to exercise one physical phenomenon:

| Prop | Phenomenon it tests |
|---|---|
| Red-and-white **lighthouse** on the headland; sweeping beam at night | Distance and telephoto; beam fans in long exposure; orthochromatic film renders its red stripes black |
| **Picket fence** receding along the shore path | Depth of field, made visible post by post |
| **Brick wall** with a painted test chart (the old cinema) | Distortion (barrel/pincushion), sharpness to the corners, lateral color |
| **Gull** on a bollard; flies when you linger | Freezing motion, reaction timing |
| **Pier carousel** | Slow-shutter motion blur with a sharp center post (tripod) |
| **Soapbox racer** on the pier road (every 40 s) | Panning; focal-plane "leaning" distortion |
| **Windmill** with numbered blades | Very fast shutter; slit-shutter "banana blades" |
| **Town square** with wandering townsfolk | Long exposure makes walkers vanish and loiterers become ghosts |
| **Bakery window** (sugar crystals on a bun) | Macro, magnification, bellows-factor light loss |
| **Moored boats** beyond the breakwater | Resolution at a distance (reading names) |
| **Sun** (time of day per brief) | Flare, exposure, golden hour vs. night |

## 7. What the player builds (the parts drawer)

- **Bodies/formats:** Shoebox (paper negative, 1 sheet) → Box camera → Folding bellows (6×6, 12 frames) → 35 mm body (36 frames, **film-advance lever**) → Mirror-box reflex (needs long back focus) → 4×5 view camera (one sheet per load; **shift** movements; tilt is stretch).
- **Glass:** element shapes (biconvex, plano, meniscus, biconcave) with draggable curvature, in **Crown** (low dispersion) or **Flint** (high dispersion, high index). Coating is unlocked later and cuts flare.
- **Stops:** lens cap (you time it), Waterhouse plates (**draw your own aperture shape on a 9×9 grid**, which gives custom bokeh shapes because the renderer samples the aperture mask directly), then an iris with blade count.
- **Shutters:** cap → leaf (whole frame at once, max 1/500) → cloth focal-plane slit (1/1000, traverses in ~1/30 s, so it bends fast things).
- **Film:** Orthochromatic 25 (red-blind) → Panchromatic 100/400 → Color 160 → High-speed 1600 (heavy grain). Stock names are fictional: *Tidewater 25, Halcyon 100, Brickyard 400, Lanternlight 160, Nightjar 1600*.
- **Accessories:** tripod (no shake; slow to reposition), cable release, ND filter, red filter, extension tube/bellows, lens hood.

**Weight is physics, not a stat bar.** A heavy camera has more inertia, so it shakes less but lags when panning. A long telephoto barrel is visibly long on the 3D camera in your hands. **Hold-to-steady:** press and hold the shutter to "hold your breath". Shake drops for about 2 s and then grows, so you release to fire. The 1/focal-length rule emerges from this without being stated. Optional **Real Hands** mode on phones feeds gyro jitter into shake, so your own steadiness counts.

**No wallet, no grind.** Parts unlock through commissions. Each brief has its own **budget** (glass costs points, bodies cost points), and the budget is a puzzle constraint, not an economy.

## 8. The campaign: 15 commissions in 4 chapters

| # | Client: ask | Physics taught | Unlock / patent |
|---|---|---|---|
| **Ch.1 SHOEBOX** | | | |
| 1 | Odile (keeper): "My lighthouse." | Pinhole size, exposure by counting | Meniscus lens |
| 2 | Odile: "Read the year above my door." | Focus by rail distance (thin lens), leaf shutter | Leaf shutter, wire finder |
| 3 | Mags (birder): "The gull, sharp, before it flies." | Shutter vs. aperture vs. ISO trade | Film stocks, selenium meter |
| 4 | Lantern Society: "Prove the square is haunted." | Long exposure, ND, tripod: walkers vanish and the man on the bench becomes a ghost | Tripod, ND |
| **Ch.2 BRASS** | | | |
| 5 | Bettany (painter): "The white fence, no rainbow edges." On color film, with only a single element in the drawer | Chromatic aberration | **Patent: Achromatic Doublet** (crown + flint, φ₁/V₁+φ₂/V₂≈0) |
| 6 | Fitch (estate agent): "Straight walls, please." Brick wall chart | Stop position: front stop → barrel, rear stop → pincushion, symmetric → cancels | **Patent: Symmetric**, view camera + shift |
| 7 | Carousel owner: "Me sharp, the fair a dream." | DOF: focal length, aperture, focus on the eye | Waterhouse stops (draw your bokeh) |
| 8 | Harbor master: "The name on the far boat?" Barrel ≤ 160 mm, focal ≥ 300 mm | Telephoto ratio < 1 requires + front / − rear | **Patent: Telephoto**, rangefinder |
| **Ch.3 SPEED** | | | |
| 9 | Racing club: "The racer sharp, the pier a streak." | Panning at 1/30; inertia | Focal-plane shutter |
| 10 | **The Curator:** "I want the car *leaning*." | Slit-shutter traversal distortion | Reflex body (mirror box) |
| 11 | Racing club, furious: "Now *without* the lean." | Same artifact, now unwanted: switch to leaf or turn the camera 90° | — |
| 12 | Miller: "Read the number on the blade, at full tilt." | Very fast shutter, slit bending | TTL meter |
| **Ch.4 PRECISION** | | | |
| 13 | Baker: "One sugar crystal." | Magnification, razor DOF, bellows factor (1+m)² | Extension bellows |
| 14 | Fitch again: "Wide, on the new mirror camera." 24 mm focal with 40 mm of mirror clearance | Back focus > focal requires − front / + rear | **Patent: Retrofocus** |
| 15 | **Regatta Night (finale)** | One camera, one 12-frame roll, a live evening clock: lighthouse lighting at 19:40, race at 19:50, fireworks at 20:00 (bulb mode). No return to the bench | Mastery |

**The finale is a performance.** Everything before it was preparation. You design one kit to satisfy four clients across golden hour, dusk and night, then make one development choice for the whole roll. It is the pacing peak and the natural "credits" moment.

**The Patent Office.** When a design meets a hidden optical criterion (e.g., two elements with longitudinal color under 0.05 mm), the game grants a **patent** in the player's own name. It is a blueprint card showing the ray diagram, the player's chosen name for the lens, and the first print taken with it. Patented lenses go into your lens case as reusable assemblies. The player *reinvents* history's lens forms by solving constraints and is never handed a recipe.

## 9. "Read It": the game's signature verb

Several commissions (and the daily) hide **procedurally generated text** in the scene: a boat name built from fictional syllables (KESTRA, OLLAMEER), a racer's plate (FB-37K), a blade number, a chalkboard price, the year over a door. The brief says *"What does it say?"* You must take a photo sharp enough to read it, then **type the answer**.

- **The player's own eyes are the judge.** We don't need fuzzy image matching, and the answer check is exact.
- It is impossible to fake. The print renders at a fixed film resolution, and with the wrong lens the letters are 3 px of mush. The loupe zooms into real pixels and grain, not a re-render. The Field view itself can't resolve the text, because standpoints keep you far away.
- It unifies every phenomenon into one legible goal. Defocus, motion, shake, chromatic smear, diffraction and grain all make letters unreadable, and each in its own recognizable way.

## 10. Grading: analytic, readable, honest

Because the sim knows true geometry, every criterion is computed from the lens **fingerprint** (focal length, blur spot per field angle, chromatic shift, distortion coefficient, falloff, T-stop) and the shot record (time, aim, motion, shake trace):

- **Framing:** subject bbox fraction and centering.
- **Sharpness at subject:** total blur in px = √(defocus² + glass² + motion² + shake² + diffraction²).
- **Softness at background tag**, **exposure error in stops (after push/pull)**, **% distortion at edge**, **lateral color in px**, **artifact detectors** (lean angle, ghost dwell fraction, double exposure flag, non-round bokeh size).

**Each commission:** one *must-have* (pass/fail) plus three brass **stamps**: *Under Budget* (≤ par cost), *First Frame* (the delivered frame was the first one shot), and one commission-specific stamp ("Hand-held", "Ortho film only", "No meter"). Opus-Magnum-style **par lines** for Cost / Weight / Frames come from the designers' reference solutions. These are clearly marked "Bench par", never fake player data.

**The Blur Budget (the core diagnostic UI).** Tap any print and a five-segment bar appears: defocus, motion, shake, glass and diffraction, with grain as a texture. The biggest segment is circled in grease pencil with a terse fix: *"motion 11 px → ~1/500"*. This one widget replaces every tutorial paragraph about the exposure triangle.

## 11. Failure is a product

- **No game over.** Failed frames still develop and go into the **Reject Bin** with their diagnosis. After two failed deliveries the client sends a doodle hint. After three, the Bench Notebook ghosts the key part onto the rail.
- **The Curator's Catalogue of Accidents:** 12 silhouetted "happy accidents" bought by the Ferrule Bay Museum of Accidents: *Leaning Racer, Banana Blades, Ghost of the Square, Heart Bokeh, Lighthouse Fan, Double Exposure* (forgot to flick the wind lever!), *Light Leak* (opened the camera back mid-roll), *Polygon Flare, Swirl* (uncorrected field curvature), *Orthochromatic Lighthouse* (red stripes gone black), *Firework Scribble* (hand-held bulb), *Shadow Selfie* (sun at your back, your own long shadow in the frame). Discovering them is the secret meta-game and the main reason toy-players stay.
- **Rule flips:** commissions 10/11 make the same artifact wanted and then unwanted. The player learns the artifact is a *tool*.

## 12. Daily: The Daily Read

Seeded by date, same for everyone:

- **Target:** one of ~12 hidden-text locations.
- **Conditions:** time of day, fog density, wind (moves gulls, flags and windmill speed).
- **Constraint card:** "primes only, 3 elements, ISO 100", "budget 40", "leaf shutter only". **Pinhole Sunday** is a weekly treat.
- **4 frames, 3 guesses.** Streak is stored locally.

Share text (no backend needed):

```
LENS BENCH · Daily Read #041 · "The Far Boat"
3 elements · 1/1000 · f/5.6 · ISO 400
frames ■■□□   guesses ■□□   ★★☆
```

## 13. Sharing

1. **Print export:** a PNG with a film rebate. The edge markings carry the stock name, frame number and date (e.g., `BRICKYARD 400 ▸ 14A`).
2. **Patent card:** a blueprint PNG with the ray diagram, the player's name for the lens, and the sample print.
3. **Camera URL:** the full camera design encoded in the hash (`/games/lensbench/#cam=…`). "Try my lens" works with zero backend, and the friend's bench loads your exact glass.
4. **Custom bokeh** (draw a heart, shoot night harbor lights) is the obvious viral screenshot.

## 14. Pacing and session shapes

- **Drive-by visitor (3 min):** camera obscura wow → first pinhole print → ACCEPTED. They leave having made something.
- **Normal session (20 min):** one chapter, 3-4 commissions, one patent, probably one Curator accident.
- **Completionist (2-3 h):** 15 commissions, 4 patents, 12 accidents, all stamps, daily streak.
- **Rhythm per chapter:** a new body or verb, then a puzzle using it, then a Curator twist, then a design challenge with a patent.

## 15. Keeping the toy

The title screen has **two doors**. **"Take commissions"** is the campaign. **"Just let me build"** opens a fully stocked drawer, free time-of-day, every standpoint, and no stamps. Campaign players also get a free Bench and Field after Ch.1 with whatever they've unlocked. The Curator ensures sandbox play still feeds collection progress. Commissions are never separate levels. They are constraints laid on the same bench and the same bay.

## 16. Scope cut lines (for a 2-4 agent team)

- **MVP (must ship):** 2D ray bench (sequential spherical-surface trace × 3 wavelengths × 3 field angles → fingerprint), pinhole + single lens + doublet, leaf shutter, 3 film stocks, Field with 5 standpoints (lighthouse, fence, gull, square, boats), accumulation renderer, Tank, Wall, commissions 1-8, Blur Budget, Read It, Daily Read, print export.
- **Ship target:** commissions 9-15, focal-plane shutter, Curator (8+ accidents), patents + camera URL, Real Hands.
- **Stretch:** tilt (Scheimpflug), polarizer, flare model beyond a simple ghost sprite, all 12 accidents.
- **Suggested split:** A = optics core + bench UI (`src/shared/optics/`, so Studio can reuse it); B = Ferrule Bay scene + photo renderer; C = game layer (notes, grading, Tank, Wall, Daily, share); D = 3D camera assembly, audio (each shutter type sounds different, so you *hear* 1/2 s vs 1/500), polish.
- **`window.__game` for CI:** `loadCommission(id)`, `setDesign(json)`, `goto(stage)`, `aim(standpoint, yaw, pitch, focusM)`, `shoot()`, `develop({push})`, `grade(frame)` (returns every criterion with measured values), `daily(seed)`, `state()`. **Every commission ships with a reference solution JSON, and CI proves it passes.** This guarantees solvability through the review rounds.

## 17. Boundaries with sibling games

LENS BENCH is the **optics puzzle game**. Its development step is a 30-second daylight tank, not the full darkroom (that's `darkroom`). Its world is a puzzle range, not a life sim (that's `studio`). Cross-game delight: patented lenses are saved under a shared key, so **Studio's camera room can offer "lenses you patented at the Bench"**, and Studio can open a Bench camera URL.
