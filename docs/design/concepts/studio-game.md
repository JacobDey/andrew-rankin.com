# SHUTTERHOUSE: the physics-toy photo studio

*Game 6, slug `studio`. Concept through the **game design** lens. This is the capstone that reuses shared photochem (Darkroom) and optics (Lensbench).*

**Title:** SHUTTERHOUSE
**Subtitle:** *build the camera · rig the yard · print the proof*
(Fallback for a plain hub: **The Studio**. Name for the finale and the daily: **The Golden Minute**.)

---

## 1. The one-sentence game

The yard is full of physics toys that do something for a fraction of a second. You have to **build a camera** that can catch that moment, **rig the yard** so the moment happens where the camera is looking, and **develop the film** to find out whether you caught it.

## 2. Pillars

1. **The photo is proof of a physical event.** The sim knows the ground truth for every frame: where the balloon was in its burst, how fast the dog was moving, and where the focus plane sat. Briefs are physical claims ("the water still holds the balloon's shape"), and the film either proves them or doesn't.
2. **Rig it, don't twitch.** No brief needs reflexes. Anything fast can be caught with a tripwire, a sound trigger or a delay knob. That makes the hard shots engineering puzzles, and engineering works fine on a phone.
3. **Delayed truth.** The viewfinder shows framing and depth of field. Only film shows motion, exposure and luck. The walk from the yard to the darkroom is the drumroll.
4. **The house is the menu.** There's no title screen, only a cutaway dollhouse. Every system lives in a room, and every reward is something physical: it arrives in the mailbox, goes on the bench, or gets added to the yard.

## 3. The house and how you move through it

**Opinion: no first-person walking.** WASD and touch joysticks would cost a build agent a day and make phones miserable. The house is a **cutaway dollhouse diorama** in one Three.js scene: the darkroom (left, red-lit), the workshop (center, a bench under a window that looks onto the yard), the yard (right, the largest space), and a hallway gallery wall connecting them. Tap a room to dolly the camera in. Inside a room, drag to orbit within limits and pinch to zoom. **You carry things between rooms**: a film can, a coated sheet, a box from the mailbox. They show up as an item on the cursor or finger, which makes the loop between rooms something you can feel in your hands.

## 4. The core loop

| Step | Room | Verb | Time | Physics/toy payload |
|---|---|---|---|---|
| **Brief** | Hallway | Pull a letter from the mailbox slot | 5 s | Handwritten one-liner plus a tiny sketch of the target shot |
| **Design** | Workshop | Snap parts onto a body; read the optics card | 30-90 s | Shared `optics` module: focal length, aperture, shutter type, film ISO, weight |
| **Rig** | Yard | Place tripod, props and trigger; set delay; dry-fire | 1-3 min | Rapier props, toys and triggers |
| **Shoot** | Yard | Arm the shutter, start the toy, wait | 2-20 s | Frames render via sub-frame accumulation across the real shutter interval |
| **Develop** | Darkroom | Load reel in the dark, invert tank, fix; contact sheet | 30-60 s | Shared `photochem`: dev time, push/pull, fog |
| **Mark** | Darkroom | Critic's grease pencil marks the contact sheet | 5 s | Measured from sim ground truth |
| **Reward** | Yard | A package arrives at the rusty mailbox | 5 s | It falls out with physics; you shake it open |

A good session is **one roll, about 10-15 minutes**: 3-4 briefs attempted on 8-12 frames.

## 5. Film is the tension

- **Frames are the currency.** A roll has 8 (medium format) or 12 (35 mm) frames. You decide whether to spend them on one hard brief or spread them across several. Running out of film ends a roll, not the game. Film costs stamps (see §11), which are cheap, so scarcity creates focus without causing frustration.
- **Dry-fire is free and unlimited.** Without film, the shutter clacks and the viewfinder shows composition, a focus-peaking shimmer and a **light-meter needle**. You can practice your timing as much as you like. What you can't preview is motion blur and the exact moment, which are what the brief asks for.
- **The darkroom is a second chance.** Underexposed by a stop? **Push** the roll (longer development, more grain, more contrast). Overexposed? **Pull** it. This is the one real decision in the darkroom, and it connects the rooms: a mistake made in the yard can be rescued in the darkroom. Push and pull apply to the whole roll, so one frame's rescue changes all the others. That trade-off is the real one.
- **Light discipline carries over from Darkroom.** Opening the camera back in daylight fogs the roll, which shows on the contact sheet as orange bleed from the film edge. It happens once, it's funny, and it never softlocks you.

## 6. Rig, don't twitch: the trigger kit

Triggers are the main source of puzzles. Each arrives as a mail-order part:

| Trigger | Fires when | Good for |
|---|---|---|
| **Cable release** | You press it | Still lifes, pans (hold to drag) |
| **Self-timer** | 2 s / 10 s after press | Long exposures, getting yourself in shot (a coat on a stick) |
| **Tripwire** | A body crosses a string you stretch between two stakes | Dog jumps, rolling balls |
| **Clap mic** | A sound passes a threshold (burst, crash, splash) | Balloon pops, domino crashes |
| **Light gate** | A beam between two posts is broken | Falling droplets, thrown objects |
| **Pressure plate** | A mass lands on it | Trampoline, seesaw catapult |

Every trigger has a **delay knob in milliseconds** (0-500, detented at 5 ms) and a little sag in the cable. Briefs come down to: *the event happens at T; your trigger sees T minus something; dial the difference.* The Replay (§10) shows you the number you got wrong. That is the whole loop of high-speed photography, made physical.

## 7. Onboarding: the first five minutes, no text walls

All text is on masking tape or postcards and is never longer than one line.

1. **0:00.** The dollhouse zooms into the yard. A **shoebox pinhole camera** sits taped to a stump, pointing at the rusty mailbox (Texture-dle Specimen #1). Its one control is a black tape flap with a tag: *"open · count to 8 · close"*. Drag the flap open. A soft ticking counts the seconds. Close it.
2. **0:20.** The shoebox now has a glowing seam: it holds an exposed **paper negative**. Pick it up and the cursor carries it. The darkroom door glows red.
3. **0:40.** In the darkroom, the room light is already off and three trays are waiting. Drop the paper in the first tray. A negative mailbox blooms in. Tongs drag it on to the next tray.
4. **1:20.** A contact-printing frame sits under the enlarger lamp. Lay the negative on fresh paper and press the lamp. Develop it again. **Your first photo is a slightly ghostly mailbox**, with a translucent streak where Dot, the scruffy yard terrier, trotted through during the 8 seconds.
5. **2:00.** The critic's pencil circles the streak: *"who's this?"* That's lesson one, with no words spent on it: **long exposures erase or ghost anything that moves.**
6. **2:30.** A letter drops through the hallway slot: *"Can you get a picture of the yard WITHOUT the dog? He will not sit."* Dot runs laps forever. The solution is a 60-second exposure, which makes him vanish. The pinhole is now a tool, not a tutorial.
7. **~5:00.** A package lands in the mailbox, containing **a lens and a leaf shutter**. The workshop bench lights up, and Roll II begins.

The single-shot paper-negative cycle in Roll I is **deliberate friction**. It teaches the house by making you walk the loop three times. Then the first 8-frame roll arrives as relief. Upgrading from paper to film is the first real progression beat.

## 8. Campaign: six rolls, 22 shots

| # | Shot | Teaches | Twist |
|---|---|---|---|
| **I. Shoebox** (pinhole, paper negatives) ||||
| 1 | *First Light* | The house loop | Dot ghosts through |
| 2 | *No Dogs* | Long exposure erases motion | Dot never stops |
| 3 | *Fern on the Line* | Cyanotype photogram in the sun | **The yard is the enlarger.** Coat in the darkroom, carry it out, pin it on the clothesline with ferns, watch it turn blue-grey, rinse |
| **II. The Bench** (lens + leaf shutter, 8-frame roll) ||||
| 4 | *Fetch* | Fast shutter freezes motion | A tennis-ball launcher; Dot at 6 m/s |
| 5 | *Silk* | Slow shutter plus tripod | Sprinkler arcs become ribbons. Handheld shake ruins it, and that teaches the 1/focal-length rule |
| 6 | *Pan* | Follow-drag during exposure | Sharp Dot, streaked fence. Your drag speed is measured |
| 7 | *Dusk* | ISO, push processing | Not enough light for the shutter speed the brief needs. Shoot underexposed and push in the darkroom |
| **III. Glass** (lens swaps, bellows, tilt) ||||
| 8 | *One Flower* | Shallow depth of field at f/1.8 | Sunflower against a busy fence; bokeh discs |
| 9 | *Near and Far* | Hyperfocal distance | Mailbox at 1 m and treehouse at 30 m both sharp |
| 10 | *Tiny Yard* | Tilt lens from the roof | The yard looks like a model (the Scheimpflug idea from Texture-dle) |
| 11 | *The Lean* | Focal-plane shutter distortion | A toy car on a loop track. The slit travels and the car leans. The brief asks for the lean |
| 12 | *Rust, Up Close* | Macro with bellows | An ant crossing the mailbox's rust tubercles |
| **IV. Rigging** (triggers) ||||
| 13 | *Pop* | Clap mic plus delay | Water balloon on the clothesline. The target is the skin gone and the water still balloon-shaped |
| 14 | *Crown* | Light gate | A drip from the birdbath faucet makes a crown splash |
| 15 | *The Seventh Domino* | Delay as arithmetic | Exactly domino 7 at 45° |
| 16 | *Raking Light* | Low-angle light shows texture | A letter from the county evidence clerk: a footprint in the garden bed is invisible under flat noon light. Hold a flashlight at a low angle and it appears (nod to Latent) |
| **V. Night** (flash and long exposure) ||||
| 17 | *Pendulum* | Light painting | A flashlight on a string swings over a camera pointing up and draws harmonograph loops. Seed the swing yourself |
| 18 | *Fireflies* | Long exposure plus dark sky | Procedural firefly paths. A brief for 30 or more streaks |
| 19 | *Second Curtain* | Rear-sync flash | Dot runs in the dark: a trail, then a sharp dog at the end of it |
| 20 | *Two Moons* | Double exposure | Don't advance the film. Moon over the mailbox, at a size it never really appears |
| **VI. The Golden Minute** ||||
| 21 | *Everything at Once* | Contraption chaining | One frame where Dot is in the air, the balloon is bursting, the domino crown is falling and the sprinkler is silk. One trigger starts a Rube Goldberg chain built from all your yard toys. The real capstone |
| 22 | *Open House* | Curation | Hang 9 frames in the hallway gallery, scored only on variety of technique. Can't be failed. Ends with the dollhouse at dusk, every window lit |

## 9. Scoring: grease pencil on the contact sheet

This matches the critique in Darkroom (Safelight). The **contact sheet is the scorecard**, and the critic marks it the way photographers really do:

- **✗ Miss.** Brief conditions not met.
- **✓ Got it.** Conditions met.
- **○ Keeper.** At least 80% quality.
- **◎ Cover.** At least 92% quality and no flaw flags. The frame gets a red double circle and a star.

**Conditions** are boolean checks against sim ground truth recorded during the shutter interval. Examples: `balloon.burstPhase ∈ [0.15, 0.35]`, `dot.airborne`, `domino[6].angle ∈ 40-50°`.

**Quality** is a weighted mix of measured values:

- **Subject sharpness**: motion blur in pixels, plus defocus circle of confusion in pixels, plus shake.
- **Exposure**: the density of the subject's zone against the target, within ±⅓ stop for Cover.
- **Framing**: subject coverage and a rule-of-thirds or centering bonus. Clipping the subject is a flaw.
- **Craft**: a bonus for detected intent, such as a pan (low subject blur with high background blur), bokeh, or tilt.

The critic leaves up to three pencil notes in the margin, and each one names its own fix: *"Dot 14 px soft: faster or pan"*, *"focus 3.2 m, dog 1.4 m"*, *"35 ms late"*.

## 10. Failure as forensics: the Replay

Every frame stores a **shot record**: camera spec, settings, trigger log and sim seed. Rapier stepped at a fixed rate is deterministic. Tap a frame on the contact sheet to open **Replay**. It's a god's-eye view of the yard over the 2 seconds around the exposure, with the camera's view frustum drawn as a translucent cone and a timeline underneath. The timeline has a **yellow bar for the shutter interval** and a **red tick for the event**: *"balloon burst at 412 ms · shutter opened 447 ms."* You can see the gap. Missed shots become informative instead of disappointing, and Replay doubles as the test harness.

## 11. Progression: the mailbox catalog and a yard that grows

- **Stamps.** Shots earn stamps: ✓ = 1, ○ = 2, ◎ = 3. Accidental completions count too.
- **The catalog** is a dog-eared booklet in the workshop drawer from *Ferrous & Frame Supply*, a fictional company. It **never shows more than four items**. Picking one replaces it with the next item in that track, so the choices are curated with no grind. There are three tracks:
  - **Glass**: lenses, bellows, tilt adapter, close-up filters.
  - **Guts**: shutters, triggers, flash, film stocks from ISO 25 to 3200, including one "1-bit plate" stock that renders in the Plates dither.
  - **Yard**: trampoline, domino crate, sprinkler, water-balloon bucket, loop track, pendulum post, firefly jar, kite.
- **Delivery is the reward animation.** You hear the mail truck, then a box thunks into the rusty mailbox. Pull the door (physics hinge) and the box tumbles onto the grass. Shake it and it pops open. New toys appear **in the yard** at the spot you choose, so the sandbox visibly fills up from a bare lawn to a backyard carnival. That growth is the progression bar.
- **Camera constraints are puzzles.** Parts have weight. A heavy 300 mm lens handheld follows the 1/focal-length shake rule. A focal-plane shutter maxes out at 1/4000 but leans. A leaf shutter syncs with flash at any speed but tops out at 1/500. Many briefs leave the player to discover that the camera they need doesn't exist yet and has to be assembled from the parts they own.

## 12. The toy stays a toy

- **The house is never locked.** Every owned part and toy is usable at any time. Briefs are letters on the hallway corkboard, not gates.
- **Every photo is checked against every brief**, including locked ones. Take a great pan in free play and a letter arrives: *"Saw your dog picture. Could you do it on purpose?"* That brief is now ✓. This is the **accidental-discovery** pattern shared with Darkroom's notebook, so free play advances the game.
- **Free Roll.** A tin labeled *"bulk film"* in the darkroom gives an unlimited roll and quick-lab development (it skips the tank, with no push or pull). It's for people who only want to throw balls at dominoes and take photos.
- **Yard blueprints (save states).** Pin the current yard layout to the shed wall as a hand-drawn blueprint card: prop positions, trigger wiring and camera placement. Load it to rebuild the yard instantly. Blueprints serialize to a URL hash so they can be shared.

## 13. Daily and replay hooks

- **The Golden Minute (daily).** The date seeds the yard layout, the weather (wind affects the kite, laundry and balloon drift; cloud cover affects exposure), **one event** and **one fixed camera** (*"Today: 135 mm · f/4 · max 1/250 · ISO 200"*). You get 3 frames and no Replay until you've developed. The score is your best mark plus quality %.
- **Camera of the Week.** A deliberately bad camera, such as a magnifying-glass lens with a 1/30 shutter, plus one brief. The question is whether you can still get a ◎ by rigging.
- **Real light (optional).** A toggle syncs yard time to the player's local clock using the same rough solar model as Darkroom. Golden hour in the game matches golden hour outside.

## 14. Sharing

**Share string:**

```
SHUTTERHOUSE · Golden Minute #37 · ◎
▢ ✓ ◎
135mm f/4 1/250 · clap mic +38ms · pushed +1
```

**Share card PNG:** your contact-sheet strip with the critic's grease-pencil marks, the chosen frame enlarged beside it, and an edge-print rebate line with the day number and settings in an original procedural rebate font.

**Shoot with my camera:** a camera build serializes to roughly 60 bytes in the URL hash (`/games/studio/#cam=…`). Opening the link puts that camera on the workshop bench with a tag: *"on loan from a friend"*. Sharing a camera build gets people to share the site, not only screenshots.

## 15. Pacing

- **0-5 min:** paper negatives, walk the house three times, first magic moment at 2:00.
- **Roll II (~15 min):** the shutter-speed toy, fast and physical; Dot carries it.
- **Roll III:** slow and contemplative, all glass and viewfinder.
- **Roll IV:** the puzzle peak: delay arithmetic, Replay, "35 ms late, one more try."
- **Roll V:** atmosphere: crickets, fireflies, the flash pop.
- **Roll VI:** payoff: everything you own fires at once, then a quiet gallery.

**Compression rules:** shutter events always run in real time, slowed to ¼ speed during Replay. Long exposures over 10 seconds show a sped-up sky with a visible "time-lapse" ring on the cursor. Tank development is a 20-second inversion toy, and the fixer is skippable after the first roll. Moving between rooms takes under 1 second.

## 16. Cross-game hooks

- **Shared modules.** `src/shared/optics` (Lensbench) holds the camera spec schema, so a Lensbench design loads straight onto the workshop bench. `src/shared/photochem` (Darkroom) handles development and push/pull. `src/shared/filmcan` lets you **send any roll to Safelight** for full darkroom treatment: enlarger, dodging, toning.
- **The rusty mailbox** is Texture-dle's first specimen, using the same `src/shared/materials` recipe. *Rust, Up Close* is a macro tour of it.
- **Plates:** the "1-bit plate" film stock. **Latent:** the evidence-clerk letters, plus raking light as a forensic technique.

## 17. Scope tiers (2-4 agents, 1-2 hours)

- **Must:** dollhouse with three rooms and tap navigation; yard with Rapier and 5 toys (ball launcher, Dot as a simple procedural capsule-dog, balloon, dominoes, sprinkler); workshop with 4 lenses, 2 shutters and ISO; **accumulation renderer** (jitter over the aperture disk for depth of field, time samples across the shutter for motion blur, 16-32 subframes); cable release, tripwire and clap mic with delay; quick tank development, contact sheet and grease-pencil marks; Rolls I-II plus *Pop*; the daily with share string; IndexedDB autosave.
- **Should:** Replay; catalog and mailbox delivery; Rolls III-IV; push/pull; blueprints; camera hash links.
- **Stretch:** focal-plane lean (render in horizontal bands at staggered times); night roll with flash; *Everything at Once*; real-light sync; filmcan export to Safelight.

## 18. `window.__game`

`loadShot(id)`, `loadDaily(seed)`, `setCamera(spec)`, `setTime(h)`, `setWeather(w)`, `placeProp(type, pos, rot)`, `armTrigger({type, delayMs})`, `startToy(id)`, `fire()`, `advance(ms)`, `develop({push})`, `scoreFrame(i) -> {conditions, quality, mark, notes}`, `replay(i) -> {eventMs, shutterMs[2]}`, `getShareString()`, `goRoom(name)`. Every shot ships with a **scripted reference solution** that must reach ◎ in headless Playwright, so each brief is regression-tested for solvability. Because the sim is deterministic, the screenshot harness gets the same frame every run.
