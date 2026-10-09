# SUNNY 16: Game Design Document

**Game 06 · slug `studio` · `/games/studio/`** · Final GDD v1 (2026-10-09)
Synthesized from `concepts/studio-toy.md` (*Bulb House*), `concepts/studio-game.md` (*Shutterhouse*) and `concepts/studio-craft.md` (*Sunny 16*). It obeys `art-direction.md` (chrome, tokens, copy rules, audio context, photosensitivity) and `hub.md` (shell, registry, `__game.poster`, storage keys). All in-game copy uses Canadian spelling, sentence case, and no exclamation marks. Grease-pencil notes are 6 words or fewer, and toasts are 7 words or fewer.

---

## 0. Decisions at a glance

The three concepts disagreed. This table records how each conflict was settled, and every later section follows it.

| Question | Concepts proposed | **Decision** | Why |
|---|---|---|---|
| Title | Bulb House / Shutterhouse / Sunny 16 | **Sunny 16** (registry title change, §1) | Photographers smile at it, and everyone else hears a warm summer word. The house number on the rusty mailbox is 16. |
| Moving around | First-person walk + WASD (toy) / dollhouse only (game) / tap-to-walk (craft) | **Cutaway dollhouse + fixed room stations + an orbit camera in the yard.** No avatar, no joystick, no WASD. | Joysticks are miserable on phones and cost a build agent a day. In a diorama, "the house is the menu" for free. |
| Goals | Pure sandbox (toy) / 22 scored briefs (game) / postcards with no scores (craft) | **Sandbox first, plus postcards from O.** (8 MUST, 6 SHOULD). Each postcard is a predicate checked against simulation ground truth. Nothing can fail and no number grades the player. O.'s grease-pencil reply either marks ✓/★ or names the one thing that missed ("water still moving · 14 px"). | It's a toy that still teaches. The game concept's measured feedback is the best idea it had. |
| Time of day | Drag the sun (toy) / 1 s = 1 game-minute (craft) | **The day clock is frozen unless you drag the sun**, or a long exposure runs time-lapse. | Shadows that creep while you compose are annoying. The sun as a grabbable toy is the best 10-second hook. |
| Truth of the photo | All agree | **Every photo is integrated from the live simulation across the real shutter interval.** The eye view and the camera view follow different rules (§7.1). | This is the core of the game. |
| Darkroom depth | Full Darkroom reuse / a quick tank | **A compact darkroom of its own**: tank, light box, contact sheet, enlarger and one rocking tray. The chemistry *math* is shared. Dodging, burning and cyanotype brushing stay in the Darkroom game (Game 02). | Six teams build in parallel, so an interactive bench can't be shared. Math can. |
| Triggers | Six-trigger kit (game) | MUST: **self-timer + cable release**. SHOULD: tripwire. STRETCH: clap mic, light gate. | Self-timer plus cable release already lets you rig without twitching. |
| Film scarcity | Frames as currency (game) | **Film is unlimited.** Rolls still hold 1, 6 or 8 frames, so unloading and developing keep their rhythm. | Toy first. |
| Dot the terrier | Game concept only | **MUST**: a simple kinematic dog. | He teaches "long exposures erase motion" without a word, and he's the charm. |
| Squash and pulse affordances | Toy: 1.04× pulse and squash. Craft: physics honesty. | **No mesh deformation, ever.** Grabbables show an outline glow on hover or press. Weight is carried by sound and timing. | Photos are evidence. A squashed ball would show up in them. |
| Daily, Replay, camera links | Game concept | Camera hash links SHOULD. Daily "Golden Minute" and Replay STRETCH. | Scope. |

---

## 1. Title, subtitle, pitch

# Sunny 16
### *A house that takes pictures.*

**Registry proposal** (`src/shared/games.ts`, studio entry; the kicker `▸06 · NOTE 6 · THE WHOLE STUDIO` and the credit line stay as they are):
- `title: 'Sunny 16'`
- `tagline: 'A house that takes pictures.'`
- `blurb` (42 words): *"A little summer house that takes pictures. Build a camera in the garage, set it up in a backyard full of physics toys, then carry the roll down to the basement darkroom to find out what you caught. Everything you print stays."*
- `description`: *"A physics-toy photo studio in a little house: build a camera, play in the backyard, shoot, and develop the roll in the basement."*
- `meta: ['Sandbox', 'Physics', '3 rooms']`. `scheme: 'auto'`.

**Pitch.** Sunny 16 is a small clapboard house at the end of summer, shown as a cutaway dollhouse you can spin in your hands. On the left is a garage workshop where you snap cameras together from an oatmeal can, a bellows, a leaf shutter and a sewing needle. Under the kitchen is a basement darkroom glowing red. Out back is a yard full of physics toys: a tire swing, an impact sprinkler that throws a real 42° rainbow, a lantern on a Y-string that draws Lissajous loops in the dark, a whirligig, sparrows that scatter at a loud shutter, and Dot, a terrier who will not sit. You can grab the sun and fling the day around. Nothing in a photograph is a filter. Shake, blur, depth of field, rolling-shutter lean and moonlight that prints like daylight all come from the simulation during the real shutter interval. You don't see the picture until you've carried the roll downstairs, rocked the tank and watched the print come up in the tray. The owner, O., is away for the summer. She leaves postcards asking for one picture at a time, and every print you make stays in the house.

---

## 2. Experience goals and hooks

### 2.1 Goals (in priority order)
1. **Every photo has a cause you can poke.** Nothing in the photo pipeline is cosmetic. When a photo surprises you, you can walk back outside and find out why.
2. **The yard is fun with the camera put away.** Fling the sun, push the swing, throw the ball for Dot, find the rainbow.
3. **Delayed truth.** The finder shows framing and depth of field. Only film shows motion, exposure and luck. The trip downstairs is the drumroll.
4. **The house fills up with your work.** The fridge, the binder and (SHOULD) the clothesline and gallery are the save file and the reward.
5. **Real photography learned by hand.** Sunny 16, long exposures erase moving things, the 1/focal-length shake rule, depth of field, reciprocity, push processing and pinhole optimum all come up, and none of them gets a lecture.

### 2.2 The hooks
- **10 seconds.** The roof lifts off the dollhouse with a wooden *tock* and the view dives into the yard at 16:40. The swing is still moving, the sprinkler is ticking, and Dot is running laps. A slow ring pulses on the **sun**. Drag it and every shadow in the yard wheels around, the sky goes amber, and the cicadas give way to crickets. Fling it and the day races. Nobody has asked you to take a photo yet.
- **1 minute.** On a stump sits an oatmeal-can pinhole camera with a tape note: *open · count to 15 · close.* Hold the tape flap open and a soft tick counts the seconds. The can now holds an exposed sheet, and the basement door glows. Downstairs the room is red. Rock the tank, then lay the negative on paper under the lamp, slide it into the tray and rock it. **The yard comes up out of white paper, with a translucent ghost of Dot smeared across it.** O.'s first postcard is already in the mailbox: *"Dot will not sit. Could you photograph the yard without him in it?"*
- **10 minutes.** You've worked it out: drag the sun toward evening, poke a smaller pinhole, and leave the can open for a minute. Dot vanishes. A package arrives with a box camera and a leaf shutter. Now you're racking focus through a waist-level finder that shows the world mirror-reversed, freezing sprinkler drops at 1/500, blurring them into silk at 1/4 on the tripod, and pushing the lantern at dusk to draw loops on a 20-second Bulb exposure. The fridge has four prints on it and you're arguing with yourself about which one to mail.

---

## 3. Core loop and progression

### 3.1 The loop
```
 WORKSHOP ──build/load──▶ YARD ──play/rig/shoot──▶ (unload: roll into pocket)
     ▲                                                     │
     │ packages (new parts)                                ▼
 MAILBOX ◀──answer postcard── HALL (fridge) ◀──print── DARKROOM (develop, contact, enlarge)
```
| Step | Room | Real time | What the player does |
|---|---|---|---|
| Build | Workshop | 20–90 s | Snap body + lens + shutter, poke the pinhole, load film. The optics card shows f, f/N, shutter range, ISO, mass and the sunny-16 suggestion. |
| Play / rig | Yard | open-ended | Move the tripod, set the time with the sun, start toys. |
| Shoot | Yard | 1 s–15 s each | Finder, focus, meter, fire, wind on. You never see a preview of the result. |
| Develop | Darkroom | ~45 s | Load the tank, set the temperature, pour, invert on the lamp cue, pour out, fix and wash. The strip goes up on the light box. |
| Print | Darkroom | ~30 s per print | Contact sheet or enlargement: lamp time + paper grade, then rock the tray, fix and hang. |
| Keep | Hall / yard | 10 s | Pin prints on the fridge, or mail one to O. from the yard mailbox. |
| Reward | Mailbox | 6 s | The mail truck sound, a thunk, the flag drops. O.'s reply card, and maybe a package that tumbles out with physics. |

A satisfying session is **one roll: about 10–15 minutes, with 2–3 postcards attempted.**

### 3.2 Progression = O.'s postcards
- Postcards arrive one at a time, and **at most two are open** at once. A new one arrives 8 s after you answer one (mail-truck sound, flag drops).
- **Answering:** tap the mailbox, drag a print onto an open postcard, raise the flag. The answer is checked immediately and revealed 6 s later on O.'s reply card. If the predicate holds, the card gets a grease **✓**, or a **★** when the quality rule (§5.13) also holds. A package is delivered and the next postcard follows. If it misses, the print comes back with one grease note naming the worst-failing measure, for example *"water still moving · 14 px"*, *"focus 3 m, swing 1 m"*, *"two stops dark"*, *"Dot is still here"*. Nothing is lost.
- **Accidental completion:** every new print is checked against **all** postcards, including ones not yet issued. If it already satisfies an open postcard, it gets a small grease ✓ in the corner. If it satisfies a future one, that postcard arrives pre-answered: *"Saw your swing picture. Exactly what I'd have asked for."*
- **Nothing is ever locked away.** Every owned part works in every room. The house never gates anything.

| # | Postcard (O.'s hand) | Predicate on `ShotRecord` (§5.13) | Unlocks | Tier |
|---|---|---|---|---|
| P1 | "Welcome to the house. Make one picture, any picture, and put it on the fridge." | any print pinned to the fridge | Box camera, Meniscus 75, Leaf shutter, Nightjar 100 | MUST |
| P2 | "Dot will not sit. Could you photograph the yard without him in it?" | `dot.pathCoverage ≥ 0.5 && dot.visibility < 0.12` | Nightjar 400, Gravity-drop shutter (+ Marble Tin if SHOULD shipped) | MUST |
| P3 | "Stop the water." | `sprinkler.dropBlurPx ≤ 3 && sprinkler.sprayCoverage ≥ 0.05` | Field camera, Plasmat 150, front tilt | MUST |
| P4 | "Now turn the water into silk." | `sprinkler.dropBlurPx ≥ 40 && shakePx ≤ 1.5` | Nightjar Colour 200, Portrait 120 | MUST |
| P5 | "Swing the lantern after dark and let it draw." | `lantern.trailPx ≥ 1500 && sunElevDeg < 2` | Lantern gels (red, green) | MUST |
| P6 | "Photograph something falling." | some dynamic prop with `vyMid ≤ −2 m/s && blurPx ≤ 4 && inFrame ≥ 0.9` | Bucket of 6 balls, crate | MUST |
| P7 | "Get closer to the mailbox than anyone ever has." | `mailbox.coverage ≥ 0.6 && mailbox.defocusPx ≤ 3` | +2 close-up lens; the print gets the Texturedle "Specimen 01" stamp | MUST |
| P8 | "The swing, right at the very top." | `swing.angleAbs ≥ 0.3 rad && swing.omegaAbs ≤ 0.1 rad/s && swing.blurPx ≤ 3` | Final card "The house is yours." | MUST |
| P9 | "The sparrows, leaving." | `≥ 3 sparrows flying && inFrame && blurPx ≤ 6` | Long lens (Tele 300) | SHOULD |
| P10 | "Make the whole yard look like a model." | `abs(tilt) ≥ 3° && N ≤ 8 && one subject sharp (≤2 px) && another within ±30 % distance soft (≥10 px)` | Dark cloth, loupe | SHOULD |
| P11 | "Moonlight, please." | `sunElevDeg < −12 && abs(overStops) ≤ 1.3` | Star chart card (Polaris marked) | SHOULD |
| P12 | "Bend the whirligig." | focal-plane shutter `&& whirligig.leanDeg ≥ 15` | — | SHOULD |
| P13 | "There's a rainbow in the sprinkler. Find it." | `sprinkler.rainbowPx ≥ 400` | — | SHOULD |
| P14 | "Dot, in the air." | `dot.airborneFrac ≥ 0.8 && dot.blurPx ≤ 5` | Tripwire kit | SHOULD |

Each postcard has a 2-line hint that appears as a tape note in the workshop after two misses. Example for P2: *"Later light, smaller hole. — O."*

**Starting kit:** Oatmeal-can pinhole (with needle and lens cap), Nightjar Ortho 25 sheets, tripod, the yard toys, and 1 rubber ball, a bucket and a watering can.

**Hub progress note:** after each print, write `localStorage['ar:studio:hub'] = {"note":"<n> prints on the fridge","at":<ms>}`. When the fridge is empty, write `"<n> photos developed"` instead. Either note is 28 characters or fewer.

---

## 4. Interactions and input mapping

### 4.1 Gesture disambiguation (all rooms)
- A **tap/click** is a press and release within 180 ms and 6 px. It pokes, presses or selects.
- A **drag** begins when the pointer moves more than 6 px after pressing. If the press started on a grabbable, it grabs. If it started on empty space, it orbits or looks.
- A **hold** is a press longer than 450 ms without moving. It does the long-press action (move tripod here, loupe).
- **Two fingers:** a pinch zooms or sets carry distance, and a twist rotates the held object.
- Every interactive object shows an **outline glow** (inverted hull on layer 1, `--game-accent-lit` at 60%) on hover or press. Objects never scale or squash (§0).
- Keys are ignored when `shouldGameIgnoreKey(e)` is true. Every action also has a pointer/touch path, so no key is ever required.

### 4.2 Global and shell
| Action | Mouse / keyboard | Touch |
|---|---|---|
| House overview | **Tab**, or shell action **House** | Shell **House**, or a two-finger pinch-in (fingers closing) outside the finder |
| Enter a room | Click its floor or doorway in the overview; click a door hotspot inside | Tap |
| Raise / lower camera (finder) | **C**, or the round camera button (bottom-right) | Camera thumb button (64 px, bottom-right, above the safe area) |
| Back / close panel | **Esc** | ✕ on the panel, or swipe down from the panel's top edge |
| Help | `?` (shell) | `?` |
| Shell actions | House (`Tab`), Save print (`download` icon, enabled when a print is open), Start fresh (in More, with confirmation) | same |

### 4.3 Overview (the dollhouse)
| Action | Mouse | Touch | Keys |
|---|---|---|---|
| Spin the diorama | Drag. Inertia: ω decays at 2.5 s⁻¹, and a ratchet tick sounds every 15° | Drag | ←/→ |
| Zoom | Wheel (radius 22–45 m) | Pinch | +/− |
| Dive into a room | Click a room (600 ms dolly through its doorway) | Tap | 1 yard, 2 workshop, 3 hall, 4 darkroom |
| Grab the sun | Drag the sun disc (works here too) | same | [ / ] |

### 4.4 Yard: hands mode (orbit)
| Action | Mouse | Touch | Keys |
|---|---|---|---|
| Orbit | Drag on empty space (target (0,1,8), radius 4–24 m, pitch 6°–75°) | One-finger drag | arrow keys |
| Zoom | Wheel | Pinch | +/− |
| Poke | Click: impulse `J = min(1.5, 4·m)` N·s along the view ray at the hit point | Tap | — |
| Grab and carry | Drag starting on a grabbable (spring hand, §5.3) | same | — |
| Carry distance / height | Wheel while holding (0.6–6 m along the ray; never below ground + radius) | Second finger vertical drag | R / F |
| Rotate held object | Q / E, or right-drag | Two-finger twist | Q / E |
| Throw | Release while moving. Velocity = mean pointer-world velocity over the last 80 ms, capped at 12 m/s | Flick and release | — |
| Drag the sun | Drag the sun disc (constrained to its arc). Release with velocity to fling: ω' = −1.8·ω (game-hours/s) | same | [ / ] = ±15 min, Shift+[ / ] = ±1 h |
| Time scrubber | Click the time chip (top-left, `16:40`) to open a horizontal scrubber, 04:30–23:30 | Tap chip | T |
| Slide the tripod | Drag a tripod leg: it slides on the lawn and can't be lifted | same | — |
| Send tripod here | Double-click the lawn (the tripod hops over in 400 ms, legs folding) | Long-press the lawn 450 ms | — |
| Aim the tripod head | Drag the pan handle (yaw ±180°, pitch −89°…+89°; yaw 0 faces +z, north) | same | — |
| **Cable release** (tripod only) | Press-hold the bulb button (bottom-centre, appears only when the camera is on the tripod): release = fire (Bulb: open while held) | same | **B** (hold for Bulb) |
| Self-timer | Long-press the cable-release bulb. A 10 s escapement buzz, then it fires | same | **L** |
| Push the swing / lantern / whirligig | Poke, or grab and release | same | — |
| Lantern knot | Drag the brass knot up or down the Y-string. Detents at the 2:1, 3:2, 4:3 and 5:3 ratios | same | — |
| Sprinkler tap | Click the spigot to toggle the water | Tap | — |
| Call Dot | Click Dot: he sits for 3 s | Tap | — |
| Mailbox | Click the door (spring hinge), then drag the flag up | same | — |

### 4.5 Yard: finder mode
The finder takes over the stage (§7.2). **Handheld:** the eye stands beside the tripod at 1.55 m and you aim freely, with shake (§5.8). **On tripod:** you aim the tripod head through a fluid-damped follow (τ = 0.25 s), with no tremor.

| Action | Mouse | Touch | Keys |
|---|---|---|---|
| Aim | Drag anywhere on the image (pointer lock optional: the "steady grip" setting) | One-finger drag on the image | arrow keys |
| Focus | Wheel, or drag the focus strip on the right edge (distance scale in metres). Click the image = focus at that point's raycast distance | Vertical drag on the focus strip. Tap the image = focus there | W / S |
| Aperture | Drag or wheel the aperture dial (bottom-left, detented at each stop) | Drag | Z (close) / X (open) |
| Shutter speed | Drag or wheel the shutter dial (bottom-centre: B 1 2 4 8 15 30 60 125 250 500) | Drag | `,` slower / `.` faster |
| Half-press (meter lock) | Hold **Space** or press-hold the shutter button | Press-hold the shutter button (bottom-right) | Space (hold) |
| Fire | Release Space or the button. **A fast stab** (press under 80 ms) adds a jolt of 1.5× | Release | — |
| Bulb / lens cap | With the dial at B, or a lens-cap shutter: open while held. Slide the thumb onto the **lock notch** (drag 40 px up from the button) to keep it open hands-free | same | Hold Space; Shift+Space locks |
| Wind on | **R**, or scroll down over the advance lever, or drag the lever through its arc. The counter rolls like an odometer | Swipe the lever arc (top-right) | R |
| Hold breath | Hold **Shift**: tremor ×0.4 for 4 s, then ×1.6 for 3 s (gasping) | Rest a second finger anywhere off the controls | Shift |
| Loupe (3×) | Hold **L** or hold on the image 450 ms (field camera only, dark cloth) | Hold on the image | L |
| Front tilt (field camera) | Drag the tilt knob (−10°…+10°, detents at 0 and ±5°) | Drag | G / H |
| Swap handheld / tripod | Click the tripod icon on the finder bezel | Tap | V |
| Unload roll / sheet | Bezel button **Unload**. The exposed roll goes into the pocket (the HUD can icon) | Tap | U |
| Exit finder | **Esc**, right-click, or the camera button | Camera button, or swipe down from the top edge | Esc / C |

### 4.6 Workshop (station: the bench; look-around yaw ±180°, pitch −50°…+15°)
| Action | Mouse | Touch | Keys |
|---|---|---|---|
| Look around | Drag on empty space | Drag | arrow keys |
| Open a parts drawer | Click the drawer: it slides out 25 cm with a wooden rumble | Tap | 1–5 |
| Take a part | Drag it out of the drawer onto the bench. Parts are Rapier bodies, so they tumble and roll | same | — |
| Mount a part | Drop it within 4 cm of a glowing mount. It snaps in (§5.6) with a *thock* | same | — |
| Remove a part | Drag it more than 6 cm away from its mount (0.4 N·s break-away) | same | — |
| Turn the camera | Drag the turntable rim | same | Q / E |
| Poke the pinhole | Press-hold the needle on the foil. Diameter grows with hold time (§5.6). The magnifier shows the hole and the live blur | same | — |
| Load film | Drag a film box from the film drawer onto the camera back. The back closes with a latch | same | — |
| Optics card | Always shown, clipped to the bench lamp (§7.2) | same | — |
| Save build | Drag the finished camera onto the shelf (up to 6 builds) | same | — |
| To the yard | Click the side door (the active camera goes onto the tripod) | Tap | Tab, then 1 |

### 4.7 Darkroom (station: the bench; fixed view with small look-around ±20°)
| Action | Mouse | Touch | Keys |
|---|---|---|---|
| Room light switch | Click the switch. With the light on, any open paper fogs | Tap | — |
| Load the tank | Click the tank with a roll in your pocket. The screen goes black for 1.5 s, you hear fabric rustle, then a click (the changing bag is STRETCH) | Tap | — |
| Water-bath temperature | Drag the bath dial (16–28 °C). The thermometer needle follows with a 2 s lag | Drag | — |
| Pour developer | Drag the jug over the tank and tilt it. The pour rate follows the tilt | same | — |
| Invert the tank | Drag the tank up and over (its rotation follows the pointer arc), or flick it. A small lamp blinks every 3 s as the cue | same | Space |
| Pour out / fix / wash | Drag the tank to the sink; drag the fixer jug; click the tap | same | — |
| Light box | The strip hangs automatically after the wash. Drag the loupe along it: frames show positive inside the loupe circle | same | — |
| Contact sheet | Drag the strip onto paper on the easel, click the glass (it drops with a clink), press-hold the lamp (seconds counter) | same | Hold Space |
| Enlarge | Click a frame on the strip, then drag the enlarger head up or down (print size), turn the paper grade dial (0–5), press-hold the lamp, or set the timer and press once | same | Space |
| Rock the tray | Drag the near edge of the tray up and down (tilt ±10°). On phones, optional device tilt (STRETCH) | same | ↑ / ↓ |
| To the fix tray, then the line | Drag the print with tongs | same | — |

### 4.8 Hall and kitchen (station; look-around ±180°)
| Action | Mouse | Touch |
|---|---|---|
| Pin a print | Drag it from the print box (on the counter) onto the fridge. It snaps under a magnet, 8 slots | same |
| View a print | Click it on the fridge: the paper viewer opens with the logbook line, **Save print** (PNG), **Copy caption**, and **Unpin** | Tap |
| Binder | Click the binder on the table: every roll's contact sheet, newest first | Tap |
| Doors | Back door → yard (the screen door slaps), garage door → workshop, basement door → darkroom (the stairs fade the light step by step) | Tap |

---

## 5. Simulation models

### 5.1 Clocks and determinism
- **SimClock** drives all world simulation: Rapier, toys, creatures and particles. Every simulated thing implements `step(dt, t)` and registers with a fixed order (physics first, then toys, then creatures). `advance(dt)` is the only way world time moves. The capture path calls it with sub-steps (§5.9).
- Physics uses a fixed step of **1/120 s on high, 1/60 s on low and test**, with an accumulator and at most 4 steps per frame. Analytic toys take `t` directly.
- **DayClock** (in game-hours) is separate. It is frozen unless the player drags the sun, uses the scrubber, or a long exposure runs time-lapse (§5.9). Date: **29 August** (day-of-year 241), latitude **41.5° N**. Clock = local solar time + 1:00 (summer time).
- **Seeded RNG:** mulberry32 streams per subsystem (`rng('dot')`, `rng('sparrows')`, …) from `__game.seed(n)` (default seed 16). Noise uses seeded value noise / fbm. Same seed + same inputs + same machine gives the same frames.

### 5.2 Sun, sky, light and exposure (`src/shared/sun`, owned by Studio)
**Solar position.**
`δ = 23.44° · sin(360°/365 · (284 + n))` → n = 241 gives δ = +8.9°.
Hour angle `h = 15° · (clock − 1 − 12)`.
`sin(el) = sin φ sin δ + cos φ cos δ cos h`.
`az = atan2(sin h, cos h sin φ − tan δ cos φ) + 180°` (0° = north, clockwise). World: +x east, +y up, +z north.
Check values: solar noon (13:00) el = 57.4°, sunrise ≈ 06:24, sunset ≈ 19:36.

**Illuminance** (lux; the renderer works in kilolux, §11.4):
- Air mass (Kasten–Young): `m = 1 / (sin el + 0.50572 (el + 6.07995°)^−1.6364)`.
- Direct normal sun: `E_sun = 127 000 · exp(−0.21 m)` for el > −0.83°, else 0. That gives 99 klx at noon, 39 klx at 10° and ~2 klx at 2°.
- Sky (horizontal): `E_sky = 800 + 15 000 · sin(el)^0.5` for el > 0. Below the horizon, `E_sky = 800 · 10^(0.395 · el)` (el in degrees: 3.4 lx at −6°, 0.015 lx at −12°).
- Moon: always full in this summer. Direction = −sun direction rotated 15° toward the zenith. `E_moon = 0.25 lx · max(0, sin el_moon)^0.6`. Colour = sun colour at 4100 K (it is reflected sunlight).
- Floor: 0.002 lx (starlight).
- **Colour temperature:** `K_sun = 1900 + 4600 · max(0, sin el)^0.45`. Sky tint comes from three's `Sky` (Preetham) shader with turbidity 3.5 and rayleigh 1.8, rescaled so its zenith luminance matches E_sky/π. Below −4° it crossfades to a gradient night dome (`#1B2740` → `#05070D`) plus stars.

**Exposure value.** Reflected-light meter: `EV100 = log2(L · 100 / 12.5)` with L in cd/m². In full sun an 18 % card reads EV 15.4. Moonlit landscape reads EV −3.1. Settings match when `log2(N²/t) = EV100 + log2(ISO/100)`.

The `sun` module exports pure math, so Darkroom's cyanotype window and Lens Bench's yard can use it too (§11.2).

### 5.3 Rigid bodies and the hand
- **Rapier 3D compat** (`@dimforge/rapier3d-compat`, `await RAPIER.init()`). One world for the whole house. Gravity is −9.81. Sleeping is on. At most 120 awake bodies.
- **Grab spring** on the held body, applied each physics step:
  `F = m · (k (x_hand − x) − c v)` with **k = 400 s⁻², c = 30 s⁻¹**, clamped to `|F| ≤ 25 N + 2·m·g`.
  Orientation uses the same spring (k_r = 120, c_r = 18) toward the pickup orientation plus the Q/E yaw offset. A 0.25 kg ball snaps to the hand. A 9 kg tire lags and droops, so you *feel* the mass.
- **Hand target** = a point on the view ray at the carry distance, held at least `radius + 0.02 m` above the ground.
- **Throw:** on release, set `v = clamp(v_pointerWorld, 12 m/s)` and `ω ← 0.5 × twist rate`.
- **Impacts:** a contact-force event above 2 N·s plays an impact sound with gain ∝ impulse and pitch ∝ 1/√m (material table §7.3). It also emits `bus.noise(pos, loudness)`, which the sparrows listen to.
- Interior workshop parts live in the same world on the bench, which is a fixed collider. A marble can roll off the bench and bounce on the slab.

### 5.4 Wind (one field drives audio and physics)
`w(t) = 1.5 + 1.2 · fbm(0.15 t)` m/s, direction 250° (from the WSW), ±15° drift by `fbm(0.05 t)`.
Gusts travel across the yard at 4 m/s: `w(x, t) = w(t − (x · d̂)/4)`.
The wind drives the whirligig, the chimes, the maple leaf sway (vertex shader amplitude ∝ w), sprinkler drop drift, and (SHOULD) the clothesline. The audio wind bed's gain follows `w` at the listener.

### 5.5 Yard toys and creatures
**Tire swing** (MUST). Anchor at (−4.2, 3.0, 10) on a maple limb. The tire is a dynamic body (9 kg, compound of 8 capsules around a 0.36 m radius ring), hung by a spherical joint with its local anchor 2.4 m above the tire centre. Period `T = 2π√(L/g) = 3.11 s`. linearDamping 0.01, angularDamping 0.05. The rope is drawn as a straight tapered cylinder plus three chain stubs. A **creak** plays at each turnaround (|ω| at a local minimum and amplitude > 0.1 rad), pitched by tension `T_r = m(g cos θ + L ω²)`. Things can sit in the tire.

**Impact sprinkler + rainbow** (MUST). Base at (3, 0, 7), nozzle 0.3 m up, elevation 27°, `v0 = 9.5 m/s ± 6 %`, direction jitter ±2.5°.
The arm steps 10° every 0.42 s across a 180° sector from az 270° through 0° to 90° (it sprays north over the lawn, never toward the house: 18 *tsk*s), then returns in 1.2 s with 18 fast clicks. The spigot click toggles the water.
**Drops are analytic GPU particles** (pool 1024 high / 512 low / 256 test, emission 350/s). Each drop stores its emit time `te`, `p0`, `v0` and the wind `wd` sampled at emission. In the vertex shader, with τ = t − te and linear drag k = 0.35 s⁻¹:
`v(τ) = wd + (v0 − wd) e^{−kτ} + g(1 − e^{−kτ})/k`
`p(τ) = p0 + wd τ + (v0 − wd)(1 − e^{−kτ})/k + g(τ/k − (1 − e^{−kτ})/k²)`
A drop dies when y < 0. This is deterministic, CPU-free, and exact at any capture sub-step time. Each drop is a 1–3 mm sprite, sized for screen at minimum 1.5 px.
**Rainbow:** per drop, compute the angle α between the eye→drop ray and the antisolar direction (−sunDir). If α ∈ [40.6°, 42.4°], tint by hue: red at 42.4°, violet at 40.6°, intensity 1.0. A secondary bow at [50.2°, 53.6°] is reversed, at intensity 0.43. Alexander's band between them gets drop brightness ×0.6. Outside the bows, drops show only a specular glint, `0.08 · E_sun` when facing the sun. Brightness scales with E_sun, so the rainbow appears only with the sun low and behind you. You have to *find* it with the sun drag.

**Y-string (Blackburn) lantern** (MUST; the poster image). An A-frame (an old swing-set) at x 5–7, z = 12, crossbar 3.6 m high. Two anchors 0.9 m apart. The lantern hangs 2.0 m below the crossbar (`L_total = 2.0 m`). A brass knot slides along the Y, setting `L_lower ∈ [0.3, 1.8] m`.
Analytic, independent damped oscillators in lantern-local x (across the frame plane) and y (along it):
`x'' = −(g/L_total) x − 2γ x'`, `y'' = −(g/L_lower) y − 2γ y'`, with **γ = 0.03 s⁻¹** and amplitude capped at 0.6 m.
Period ratio `T_x/T_y = √(L_total/L_lower)`. Knot detents at L_lower/L_total = 0.25 (2:1), 0.444 (3:2), 0.5625 (4:3), 0.36 (5:3).
A push (poke, or grab and release) sets the velocity, so a drag-release sets both position and velocity.
The lantern is an emissive sphere (r 0.05 m, radiance P_lamp = 8 in renderer units, `#FFD9A0`, or a gel tint) plus a `PointLight` (2 cd, decay 2) that lights the grass.
A chalk "worm's-eye" X on the lawn below at (6, 0, 12) suggests a tripod at 0.4 m pointing straight up.
**Calibration target:** a 20 s Bulb at f/8 on ISO 100 with the sun at −8° gives trail negative density ≥ 1.2 (near-white on the print).

**Whirligig** (MUST). On the fence post at (13.5, 1.3, 10). Four blades, r 0.25 m.
`ω' = (6 rad/m · w − ω) / 0.6 s`. A poke adds +15 rad/s, capped at 40.
It's the rolling-shutter test target (SHOULD) and makes a soft rattle.

**Wind chimes** (MUST, mostly audio). Five tubes on the porch eave at (0.5, 2.4, 0.4), each a small pendulum driven by the wind. A strike happens when the clapper's relative speed exceeds 0.15 m/s (§7.3).

**Props** (MUST): a rubber ball (r 0.10 m, 0.25 kg, restitution 0.75), a galvanized bucket (0.8 kg), a watering can (0.6 kg) and a wooden crate (2 kg, from P6). P6 also adds 6 balls in the bucket.

**Dot the terrier** (MUST). A procedural low-poly terrier, 0.6 m long and 0.4 m at the shoulder. Wiry `#B9A07A` coat with a `#3A2E25` saddle. Built from a body capsule, a box head with flop ears, 4 two-segment legs and a tail.
He's a Rapier **kinematic** body, so he knocks balls and (SHOULD) dominoes but nothing knocks him.
- **Lap:** a closed Catmull-Rom loop through (−2,3) (6,2.5) (10,7) (8,13) (1,14.5) (−6,13.5) (−9,7) (−5,3.5), about 45 m, at 3.5 m/s. 25 % of laps include a 2–4 s sniff stop at a seeded point.
- **Fetch:** when a thrown ball lands within the yard, he runs to it at 6 m/s. If the ball is airborne between 0.3 and 1.2 m high within 1.2 m of him, he **jumps**: a ballistic arc with 0.5 s airtime, `airborne = true`. He carries the ball back to the tripod and drops it.
- **Sit:** click him and he sits for 3 s, then resumes.
- Gait: trot, with legs on a sine at stride frequency `f = v / 0.55 m`.
- Sounds: a short bark (formant burst) when the ball lands, and panting while carrying.

**Sparrows** (MUST, simple). Five kinematic birds with a two-pose flap.
- **Perch:** on the feeder at (8.5, 1.6, 5) and the fence. They hop on the lawn within 3 m of the feeder.
- **Flee** when any of these happens:
  - shutter loudness ÷ d² > 0.02, with loudness: lens cap 0, leaf 0.15, gravity drop 0.9, cloth focal plane 0.6;
  - Dot comes within 2.5 m;
  - an impact noise above 0.3 lands within 1.5 m;
  - the finder or tripod comes within 2.5 m of the feeder.
- Fleeing birds fly at 7 m/s to the maple canopy and return after a seeded 20–40 s. Each flee plays 12 FM chirps staggered over 300 ms plus a flutter.
- So a quiet leaf shutter doesn't scare them and the gravity drop does. Nothing in the UI says so.

**SHOULD toys:**
- **Dominoes:** garden blocks 0.30 × 0.15 × 0.05 m, 0.9 kg, on the patio. Drag a path on the patio with the domino crate selected to place up to 40 at 0.18 m spacing.
- **Kiddie pool:** at (2.5, 0, 11.5), r 0.9. A 64×64 (32×32 low) wave-equation heightfield, c = 0.6 m/s, damping 0.8 s⁻¹. Caustics on the floor come from the normal map along the sun direction. A splash crown is a particle burst for impacts faster than 2 m/s.
- **Clothesline:** poles at (−11,0,3) and (−5,0,3), 2 m high. Two verlet sheets, 16×12 nodes, 6 constraint iterations, wind-driven. Prints can be pegged here (they flutter, and you can photograph them).
- **Night set:**
  - Stars: 600 points (300 low), magnitudes 0–4.5, rotating about Polaris (az 0°, el 41.5°) at 15°/game-hour.
  - Fireflies: 40 (20 low), each a J-shaped swoop flash of 0.4 s every 5.5 s ± 1.0 s, colour `#D8FF5A`.
  - Eye-view Purkinje grade (§7.1).

### 5.6 Camera build → spec (optics)
A **CameraBuild** = body + lens + shutter + film (+ accessories). `deriveSpec(build)` produces a **CameraSpec** (§11.3). The thin-lens model, with every length in mm:
- **Focus:** the focus control sets the subject distance `s`. Extension `v = f·s/(s − f)`, clamped to the body's range [v_min, v_max]. Near focus `s_min = f·v_max/(v_max − f)`.
- **Field of view** breathes with extension: `FOV_h = 2·atan(W/(2v))`, `FOV_v = 2·atan(H/(2v))`.
- **Effective f-number** includes the bellows factor: `N_eff = N · v/f`. The finder meter is through-the-lens and accounts for it.
- **Aperture diameter** `A = f/N`. Shape: round, or a B-blade polygon.
- **Defocus blur on film** for a subject at distance `d`: `v_d = f·d/(d − f)`, `b = A·|v − v_d| / v_d`.
- **Depth-of-field scale** (drawn on the lens barrel): circle of confusion c = 0.03 mm (35mm), 0.05 mm (6×6), 0.1 mm (4×5). Hyperfocal `Hf = f²/(N·c) + f`.
- **Pinhole:** no lens, `f` = body depth. Blur diameter `b = √(d² + (2.44 λ f / d)²)` with λ = 550 nm. The sweet spot is `d* = √(2.44 λ f) = 0.37 mm` at f = 100 mm, which is f/270. The needle sets `d = 0.15 + 0.45·(1 − e^{−t_hold/0.9 s})` mm. Holding more than 2.5 s adds raggedness r ∈ [0, 1], which becomes 4–6 diffraction star spikes on highlights.
- **Image circle** IC: outside the IC (distance from frame centre), the image falls off over 8 % of the IC radius to black. This is how a small lens on a big format makes a porthole image.
- **Mass** = body + lens + shutter + film (§6.2). It feeds the shake model (§5.8).
- **Front tilt** α (field camera). The plane of sharp focus Π contains the hinge line `J = f / sin α` below the lens centre (parallel to the camera's x axis) and the point at distance `s` along the optical axis. With α = 0, Π is the plane at distance `s` parallel to the film. At α = 5° and f = 150 mm, J = 1.72 m: the lawn, toe to fence, comes into focus at f/8. This is Andrew's "tilt 5 degrees" made literal.

### 5.7 Shutters
| Shutter | Model | Exposure profile | Loudness | Jolt |
|---|---|---|---|---|
| **Lens cap** | Exposure = hold time (real seconds; time-lapse above 15 s, §5.9) | rectangle | 0 | the cap pull adds Δθ 0.02° |
| **Leaf** (salvaged) | Dial: B, 1 … 1/500 s. Actual times: 1/500 → 1/370, 1/250 → 1/215, the rest nominal. 1.5 ms open and close ramps | trapezoid | 0.15 | 0.01° |
| **Gravity drop** (guillotine) | A plate with a 20 mm slot falls from height h ∈ [5, 40] cm (5 cm ratchet notches). `v = √(2gh)`, `t = (20 mm + A)/v · (1 + N(0, 0.05))`. At h = 40 cm with A = 6.8 mm: 1/104 s. At 5 cm: 1/37 s | triangle-ish: ramp = A/v at each end | 0.9 | landing jolt 0.05° **after** the exposure (inside it if t > 30 ms) |
| **Cloth focal-plane** (SHOULD; Tin-plate 35 body) | Dial 1 … 1/1000 s. Curtain travel `T_c = 12 ms` top to bottom. Row y opens at `t_o(y) = T_c·y/H` and closes at `t_o(y) + t` | per-row rectangle | 0.6 | 0.02° |
| **Self-timer** | Any non-cap shutter: 10 s escapement, then fire | — | 0.1 (buzz) | none on a tripod |

**Double exposure:** firing without winding on adds the new exposure onto the same latent frame (§5.10).
**Sheet film** (field camera, oatmeal can): "wind on" means flipping the double-sided holder (2 sheets per holder, 3 holders = 6 frames). The can holds 1 sheet.

### 5.8 Handheld shake and the tripod
Handheld camera orientation = aim + shake. Each axis (pitch and yaw) runs independently:
```
θ(t) = A_t·n_bp(t; 8–12 Hz) + A_d·n_lp(t; 0.6 Hz) + A_b·sin(2π·0.25 t + φ) + Σ jolts
A_t = 0.020° · s,  A_d = 0.40° · s,  A_b = 0.10°,   s = clamp(√(0.6 kg / m_cam), 0.5, 2.0)
jolt: θ_j(t) = Δ · e^{−ζ ω t} sin(ω_d t) / sin(peak),  ω = 2π·6 Hz, ζ = 0.6
press jolt Δ = 0.03° (×1.5 for a stab press under 80 ms; 0 with cable release)
```
Here `n_bp` and `n_lp` are seeded value noise, band-passed and low-passed respectively, with unit RMS. Holding your breath multiplies A_t and A_b by 0.4 for 4 s, then A_t by 1.6 for 3 s.
**Calibration target:** with a 0.6 kg box camera, 75 mm lens on 6×6 at a 768 px long side, 1/15 s gives a median shakePx ≈ 2.5 and 1/125 s gives ≈ 0.4. The 1/focal-length rule emerges on its own.
**Tripod:** no tremor, drift or breath. Wind sway is `0.002° · w`. The tripod is itself a Rapier body (2.5 kg, three leg colliders). If Dot, a ball or the swing knocks it, its angular velocity is added to θ, so the knock is visible on film. **Reduced motion** scales the *displayed* finder sway by 0.3. Capture always uses the true values, and a small "steady" pip shows when sway is under 0.05°.

### 5.9 Capture: integrating the shutter interval
**One sample** = render the scene (layers 0 only; the player's own tripod and camera are on layer 2 and excluded) from a camera that has:
1. **The pose at sample time `t_i`**: the camera pose including shake θ(t_i).
2. **An aperture point `a_i`**, from a stratified Halton(2,3) sequence mapped into the unit disk and rejected to the B-blade polygon, then scaled to A/2 on the lens plane (tilted by α).
3. **The rank-1 projection update**, which makes everything on the focus plane Π land on the same film pixel for every aperture point. With `M₀` the central 4×4 clip matrix (projection × view), `π` Π's plane 4-vector (π·X = 0 on Π) and `a` the homogeneous aperture point:
   **`M_a = M₀ − (M₀ a) πᵀ / (πᵀ a)`**
   For X on Π, `M_a X = M₀ X`, and `M_a a = 0`, so `a` is the centre of projection. The same formula gives ordinary depth of field (Π parallel to the film) and Scheimpflug tilt (Π from §5.6). Place the sample camera at `a` with the central orientation (`matrixAutoUpdate = false`, `matrixWorld = T(a)·R`), and set `projectionMatrix = M_a · matrixWorld` (so projection × view = M_a) and `projectionMatrixInverse` to match. That keeps `cameraPosition` correct for specular and frustum culling consistent. Depth stays monotonic, because `w₀(a) ≈ 0` for points on the lens plane. Clamp near ≤ min(0.05 m, s/4).

**The fast path (t_span ≤ 1/8 s; t_span = t + T_c for focal plane).** Freeze the render loop for one frame. For `i = 0…K−1`: `sim.advance(t_span/K)` (Rapier `world.timestep` set to t_span/K), then render sample i into an **RGBA16F** sample target. Accumulate into the accumulation target with weight `w_i` (the shutter profile at t_i, normalized), using additive blending or ping-pong if float blending is missing. The world then simply continues: the shutter time really passed.
`K = 24 / 12 / 4` (high/low/test). Focal-plane: `K = 32 / 16 / 8`.
**Focal-plane shutter:** each sample is added only to rows whose window contains t_i. The per-row weight sum is kept in alpha and divided out at the end, which makes blades lean and balls egg-shaped.

**The live path (t > 1/8 s, Bulb, lens cap).** The game keeps running. Each rendered frame adds 1 sample (2 when frame time is under 10 ms) at the current sim time, with the next aperture point and weight `dt_sim`. The finder dims to 15 % and shows a faint ghost of the accumulation at 15 % opacity. A seconds ticker counts.
**Time-lapse:** when the exposure is longer than **15 s**, the DayClock rate becomes `t/15` game-seconds per sim-second (cap 480×), so the sky, sun, moon, stars and firefly blink cycle compress into 15 real seconds. Physics toys keep running at 1×. Each sample's weight is scaled by the rate. A visible time-lapse ring sweeps around the shutter button. **Dragging the sun during an open Bulb exposure is allowed**, and it bakes sun trails into the frame (caption: *"The sun was dragged."*).

**Optics post-pass** (one fullscreen shader, after accumulation; parameters come from the lens profile):
- Pinhole blur: a 12-tap disk of diameter b/pitch px, plus star spikes on highlights above 4× middle grey when raggedness r > 0.
- Spherical-aberration glow: `out = (1 − g)·img + g·blur(img, 1.5 % of diagonal)`. g = 0.10 (meniscus), 0.20 (magnifier), 0.25 (marble).
- Field softness: an extra blur of `k_edge · r_n²` px.
- Lateral chromatic aberration: R/B radial scale `1 ± c_ca`.
- Barrel distortion `k1`.
- Vignetting: `cos⁴(θ)` × the lens's mechanical vignette factor.
- Image-circle mask.
- (SHOULD) cat's-eye clip and swirl for the portrait lens.

**Exposure and encode pass:** see §5.10. The output goes to an RGBA8 target, which is read back with `readPixels` (RGBA/UNSIGNED_BYTE, universally supported).
**Hiding the latency:** the shutter sound plays at once (two clicks separated by the real exposure time). The finder blacks out, and the 800 ms film-advance animation covers the compute. Budget: under 250 ms on high and under 600 ms on low.

### 5.10 Exposure and the latent image
- Rendered linear radiance `P` (kcd/m², §11.4). Scene luminance `L = 1000·P`.
- Film-plane illuminance `E_f = q · L · cos⁴θ · V(θ) / N_eff²`, with q = 0.65.
- Raw integral `S = Σ L_i w_i Δt` (cd·s/m²). At close, `H = q·S/N_eff² · (t_eff/t)`.
- **Reciprocity:** `t_eff = t` for t ≤ 1 s, otherwise `t_eff = t^(1/p)`, with p = 1.31 (B&W) and 1.20 (colour). A metered 24 s needs 64 s. The moonlight shot at EV −3, f/8, ISO 400 needs about 10 minutes.
- **Spectral sensitivity** maps RGB radiance to film channels:
  - Panchromatic B&W: `0.2126 R + 0.7152 G + 0.0722 B`.
  - Ortho (red-blind): `0.00 R + 0.35 G + 0.65 B`. Tomatoes print black.
  - Colour: identity with 5 % crosstalk.
- **Relative log exposure:** `x = log10(H · ISO / 8.125)`, so x = 0 is correctly exposed middle grey.
- **Latent storage (LogH8):** `v = clamp((x + 3)/5, 0, 1)·255 + dither(±0.5)`. That covers −10 to +6.6 stops in 0.065-stop steps. It's stored as a PNG blob (1 channel for B&W packed into R, 3 for colour), 768/512/384 px on the long side. **The photo is not shown anywhere until it's developed.** The only feedback is the frame counter.
- **Double exposure:** decode, then `x = log10(10^x₁ + 10^x₂)`, then re-encode (CPU).

### 5.11 Development (darkroom tank)
**Chemistry clock:** 1 real second = 20 chemistry seconds. Nightjar 100: 7:00 at 20 °C (21 s real). Nightjar 400: 9:30 (28.5 s). Ortho 25: 5:00. Colour 200: 3:15 at a fixed 38 °C bath (9.75 s; the bath dial locks and the rate is 1).
**Temperature:** `rate = 1.1^(T − 20)`. The bath dial sets T, and the needle lags with τ = 2 s.
**Development ratio:** `ρ = ∫rate·dt_chem / t_nominal`. Pouring out early or late is pull or push.
**Liquid in the tank** (pendulum mode): `φ'' = −(g/r) sin(φ − φ_tank) − 1.5 φ'`, with r = 0.04 m (2.5 Hz). Agitation `a = |φ'|`, glug pitch from φ'. The cue lamp blinks every 3 s.
- `cueRatio` = cues answered with an inversion within ±1.2 s ÷ cues shown.
- **Bromide drag:** if cueRatio < 0.5, density deficits streak downstream of dense areas along the tank axis. `ΔD = −0.12·(1 − cueRatio)·expSmoothDown(max(D − 1.0, 0), 40 px)`.
- **Surge marks:** if a > 6 rad/s is sustained for more than 4 s, add +0.15 density in a 4 % band at both frame edges.

**Negative H&D curve** (logistic):
`D(x) = Dmin + (Dmax − Dmin) / (1 + exp(−4γ(x − x₀)/(Dmax − Dmin)))`
with Dmin = 0.15 + fog, Dmax = 2.4, γ = 0.65·ρ^0.5, and `x₀ = 0.875 − 0.36·log2(ρ)` (push buys about 0.6 stop of speed per stop of push). Fog = 0.05·max(0, ρ − 1). Middle grey lands at D = 0.75 for ρ = 1. Colour uses per-channel γ of 0.60, 0.62 and 0.65.
**Grain:** clumped 2-octave value noise in density space (1 px + 2 px).
`σ_D = G · ρ^0.5 · √(D + 0.05)`, with G = 0.006 (Ortho 25), 0.012 (N100), 0.024 (N400) and 0.018 (Colour 200).
**Fix (3 s pour) and wash.** The anti-halation **pink dye** (`#E8A0C0` overlay at 35 %) drains away over 4 s of wash, and stays if you skip it. Then the strip hangs on the light box. B&W negatives show as `10^−D` transmission, colour negatives on an orange base tint `(0.85, 0.55, 0.35)`. The loupe shows the positive.
Development runs on the CPU over Float32Arrays (about 40 ms per 768 px frame) when you pour out.

### 5.12 Printing
- **Paper exposure:** `x_p = log10(t_lamp/t_ref) − D_neg(x, y) + log10(G_size)`, with `t_ref = 8 s`. Enlarger height scale `G_size = (h_ref/h)²` (bigger print = dimmer).
- **Paper density:** `D_p = 0.05 + 2.05 / (1 + exp(−γ_g · (x_p − x_mid)))`, grade 0–5 → γ_g = 2.4, 3.2, 4.0, 5.0, 6.0, 7.2, and `x_mid = −0.75 + 0.656/γ_g`, so a middle-grey negative (D 0.75) printed for t_ref lands at print density 0.75 on every grade. At grade 2, negative D 0.25 prints at 1.68 (deep shadow) and D 1.5 at 0.10 (paper white).
- **Reflectance** `R = 10^−D_p`, multiplied by the paper base `(0.96, 0.95, 0.92)`, then sRGB. Colour prints work per channel with the same curve (no mask).
- **Auto-suggest:** the enlarger timer pre-sets the t that maps the negative's median density to paper zone V (it shows as a pencil mark on the dial). (SHOULD) test strip: 5 bands at 2, 4, 8, 16 and 32 s.
- **Tray development** (modal slosh):
  - Tray: L = 0.30 m long, liquid depth h = 0.02 m.
  - Modes `k = 1, 3` along the length plus 1 across the width. `ω_k = √(g κ tanh(κ h))` with `κ = kπ/L`, giving ω₁ = 4.6 rad/s.
  - Each mode relaxes toward the tilt equilibrium `c_k θ` with `c_k = 4L/(k²π²)`: `a_k'' = −ω_k²(a_k − c_k θ) − 2ζω_k a_k'`, ζ = 0.04.
  - The surface is `η = Σ a_k cos(kπx/L)`. Agitation `A = Σ|a_k'|`, normalized.
  - The image comes up as `D(t) = D_p · (1 − e^{−t/τ})`, with τ = 4 s while rocked. Unrocked, τ ×1.6 and the corners lag by +40 %.
  - Pull the print early and it's lighter. The image is shown as it develops.
  - The *develop* chime plays when density passes 50 %.
- **Contact sheets** lay out the roll: 8 frames of 6×6 in 2 rows of 4 on 8×10 paper. Sheet film is 1 per sheet. Prints are rendered at the frame's resolution.

### 5.13 Ground truth: the ShotRecord
At every sample, each registered **PhotoSubject** (§11.3) is projected with the central camera (no aperture jitter). The record stores:
- `inFrame`: the fraction of exposure weight with the centre projected inside the frame (± r_px).
- `visible`: the weight fraction with an unobstructed Rapier ray from the camera to the centre. Subjects without colliders count as visible.
- `blurPx`: the diagonal of the bounding box of projected centres over in-frame samples, plus camera shake.
- `defocusPx = b(d)/pitch` (§5.6), using distance to Π along the ray when tilted.
- `coverage = π r_px²/(W·H)`, or a subject-supplied projected-area estimate.
- `visibility` (the ghost metric): the maximum over an 8×6 image grid of the weight fraction during which the subject's projected centre was in that cell and visible.
- `pathCoverage` (Dot only): the fraction of his lap polyline that projects inside the frame.
- `state`: min, max and mid-exposure values of numeric state, any/all for booleans. Examples: `vy`, `airborne`, `omega`, `angle`, `flying`, `leanDeg`.

Subject-specific measures:
- Sprinkler: `dropBlurPx` (the median over 16 tracked drops alive at mid-exposure), `sprayCoverage` (the fraction of 16×12 cells containing ≥ 1 drop at mid), `rainbowPx`.
- Lantern and fireflies: `trailPx`, the projected path length while in frame and visible.

Shot-wide: `shakePx`, `exposure.evScene` (centre-weighted, from the finder meter), `exposure.overStops`, `sunElevDeg`, `dayHours`, spec summary, `doubleExposures`, `handheld`, and auto-caption tags.

**Quality ★ rule** (for the postcard's target subject): `blurPx ≤ 3 && defocusPx ≤ 3 && |overStops + 1.2·log2(ρ)| ≤ 1.3 && coverage ≥ 0.04 && inFrame ≥ 0.9`, where ρ is the roll's development ratio, so a pushed underexposure still earns ★. Postcards may override a term; P4 wants blur, for example.
**Auto-captions** (grease, 6 words or fewer, on the fridge and in the binder): "Forgot to wind." · "Shot through a marble." · "The sun was dragged." · "Dot was here." · "Handheld at 1/8." · "Moonlight." · "Pushed one stop." · "Upside down, on purpose." · "Through Q.'s bellows."

### 5.14 Camera obscura (SHOULD; the garage wow)
The workshop's north window has a blackout roller blind. Pull it down (spring roller: a tug-release snaps it up, a tug-hold keeps it down). **Poke** a hole (d = 3 mm), or **drag** to tear it bigger (up to 60 mm, with a tear sound pitched by speed).
Each frame (every second frame on low), render the yard from the hole position into a 256×160 target (160×100 on low). Flip both axes. Blur by `b = √(d² + (2.44 λ D/d)²)` with D = 5.2 m to the south wall. Project onto the wall with illuminance `E = L · (π d²/4) / D²`. With the lights off, the garage ambient drops to 0.002 lx and the eye adapts over τ = 4 s. **The swinging tire and the sprinkler play upside down across the pegboard.** STRETCH: pin paper to the wall and the garage takes the picture (an exposure of roughly 1 hour, time-lapsed).

---

## 6. Content list

### 6.1 The house (metres; origin at the back-door sill; +x east, +z north)
| Space | Extent | Contents |
|---|---|---|
| **Garage workshop** (left in the overview) | x −12…−6, z −8…0, slab floor | North window 1.6×1.0 at (−9, 1.5, 0). Bench under the window with turntable, vise and bench lamp. 5 parts drawers (bodies, lenses, shutters, film, accessories). Pegboard with marker outlines. Build shelf (6 slots). Side door to the yard. Fluorescent tubes (tink-tink start). |
| **Kitchen and hall** (centre) | x −6…2, z −8…0 | Fridge (8 magnet slots, film boxes on the door shelf), table with the contact-sheet binder, print box on the counter, key rack (cameo keys), framed lighthouse print (Plates cameo), back door + screen door at (−1, 0, 0), basement door. |
| **Basement darkroom** (under the kitchen; red glow in the cutaway) | x −5…0, z −7…−3, floor y −2.6 | Bench on the south wall: tank + water bath + thermometer, light box, contact easel, enlarger, dev tray + fix tray, sink, drying line, amber safelight, wall switch, wind-up timer. |
| **Yard** | x −12…14, z 0…16, plus side lawn x 2…14, z −8…0 | Lawn with mown stripes, patio slab (x −6…0, z 0…2.5), maple (−7, 0, 10) with the swing limb, sprinkler (3,0,7), A-frame lantern (6,0,12), feeder (8.5,1.6,5), whirligig (13.5,1.3,10), stump with pinhole can (1,0,3), picnic table (−1,0,12), chimes, rusty mailbox on a post inside the back gate (12,0,15.2), picket fence 1.2 m, neighbour rooftops and tree silhouettes beyond. |

**Dollhouse cutaway:** the front wall is sliced away, and the earth below the kitchen is cut in section (soil layers `#5A3E2A`/`#3B2A1E` with stones), exposing the red-lit basement. The roof lifts 3 m and fades to 0 over 400 ms (sound: *tock*). The overview camera starts at yaw 200°, pitch 32°, radius 32 m, so the garage is on the left, the house in the centre, and the yard on the right and behind.

### 6.2 Camera parts (all procedural meshes; chamfer everything with `RoundedBoxGeometry` radius 4–20 mm; lenses and cans are `LatheGeometry`)
| Part | Numbers | Mesh recipe | Tier |
|---|---|---|---|
| **Oatmeal-can pinhole** (body) | f = 100 mm, 4×5 sheet (96×120 mm image), 1 sheet, ships with a 0.45 mm hole (f/222), aim by 2 brass sight pins, 0.12 kg | Lathe cylinder r 65 mm h 180 mm, a printed-paper label texture ("ROLLED OATS", plaid), a black tape flap shutter | MUST |
| **Box camera** (body) | 6×6 (56×56), 8-frame roll, helicoid v ∈ [f, 1.08f] (75 mm: focus 1.0 m–∞), waist-level finder (mirror-reversed), 0.6 kg | Rounded box 110×120×140 mm in leatherette (Voronoi pebble normal), brass corners, a winding knob, a red frame window | MUST |
| **Field camera** (body) | 4×5, 3 double holders = 6 sheets, bellows v ∈ [60, 360] mm, front tilt ±10°, ground glass upside down and reversed, 1.8 kg | Mahogany front and rear standards, brass rails, red bellows (`#7E1F1A`, sine-folded extrusion that compresses with extension) | MUST |
| **Tin-plate 35** (body) | 24×36, 12 frames, cloth focal-plane shutter, rangefinder (upright), 0.75 kg | Rounded box 135×80×35 mm, a chrome top plate | SHOULD |
| **Marble Tin** (body + lens) | 24×24, 12 frames, marble D = 16 mm, n = 1.52: `f = nD/(4(n−1)) = 11.7 mm`, a 4 mm washer stop = f/2.9, fixed focus (Hf 2.36 m), k1 = −0.18, glow 0.25, edge blur 9·r_n² px, CA 0.4 %. 0.2 kg | A biscuit tin with a marble in a cork | SHOULD |
| **Pinhole foil + needle** | d 0.15–0.60 mm by hold | Brass shim disc, steel needle | MUST |
| **Meniscus 75** | f 75, f/11–f/32 (stop in front), IC 90 mm, glow 0.10, field softness 3 px, CA 0.2 %, round stop, 0.08 kg | A single curved glass element in a black cone | MUST |
| **Plasmat 150** | f 150, f/5.6–f/45, 6 blades, IC 180 mm, sharp, 0.35 kg | A chrome barrel with an engraved DoF scale | MUST |
| **Portrait 120** | f 120, f/3.6 fixed (Waterhouse slots f/3.6, f/5.6, f/8), IC 130 mm, glow 0.08. SHOULD: swirl `stretch = 1 + 0.6·r²` and cat's-eye | A long brass barrel | MUST (swirl SHOULD) |
| **Magnifier lens** | plano-convex f 150, f/4, glow 0.20, CA 0.6 % | A magnifying glass with its handle sawn off | SHOULD |
| **Tele 300** | f 300, f/5.6–f/32, 8 blades, 0.9 kg (shake ×) | A long black tube with a hood | SHOULD (P9) |
| **+2 close-up** | a dioptre +2 adds 1/0.5 m to the focus range (box camera to 0.4 m) | A slip-on ring | MUST (P7) |
| **Shutters** | §5.7 | Leaf: a chrome ring with a speed dial. Drop: a wooden frame with rails and a black plate. Cap: a felt cap | MUST (FP SHOULD) |
| **Tripod** | 2.5 kg, column 0.4–1.7 m, pan/tilt head | Three ash legs, a brass head, a spirit-level bubble (STRETCH: device tilt levels it) | MUST |
| **Films** (*Nightjar Photographic*, fictional) | Ortho 25 sheet, Nightjar 100 (roll and sheet), Nightjar 400 (roll and sheet), Colour 200 (roll and sheet). Edge print `NJ 100 ▸ 3 ▸ 3A` | Card boxes with procedural labels (a nightjar silhouette drawn with a path) | MUST |

**Lens Bench crossover (SHOULD):** "Q.'s drawer" lists lenses the player built in Lens Bench, via `@shared/optics` `listSavedLenses()`. Each maps a `LensProfile` (efl, fNumber, vignette, lateralCA, sphericalHalo → glow, distortion → k1) onto Studio's lens params.

### 6.3 Procedural textures (canvas, seeded; generated once at boot, ≤ 512² each, ≤ 24 MB total)
| Texture | Recipe |
|---|---|
| **Rusty mailbox** | Use `@shared/materials` `rustyMailbox()` if it exists. Fallback: weathered paint `#5E7F8C`; rust mask = fbm(4 octaves, scale 6) > 0.55; rust colour lerps `#7A3324`→`#C1652F` by a second fbm; 400 Poisson tubercle dots (r 1–4 px, `#4A1F15` with a highlight); downward drip streaks (vertical blur of the mask × 0.4); a chipped white stencil "16". Roughness 0.45 paint / 0.9 rust. Normal from the height. |
| Lawn | Base `#6E9E3A`, fbm patches toward `#2F4A22`, mown stripes in 1.2 m bands at ±6 % brightness, clover speckle. Shader-side: dappled maple shade comes from the shadow map |
| Clapboard | 0.12 m bands, a shadow lip, paint `#EDE6D6` peeling to `#B9B2A2` by an fbm mask |
| Wood (bench, tripod, standards) | Ring noise: `frac(r·18 + fbm·2)`, mahogany `#5A2A1B`, ash `#C8A97E` |
| Pegboard | `#B98A5A`, a hole grid at 25 mm, marker outlines `#222` around tool silhouettes |
| Linoleum | Checker `#D9D2C3`/`#6E7F7A`, wear fbm |
| Leatherette | Voronoi pebble normal, `#1C1B1A` |
| Brass | `#B08D3C`, a fingerprint-smudge roughness (low-frequency fbm 0.25–0.55) |
| Soil section | Horizontal strata + stones (Poisson ellipses) |
| Paper / print base | Warm white, sparse fibre noise, deckle optional |
| Postcard fronts | A procedural "hand-tinted" view: three-layer silhouettes (sea, cliffs, lighthouse / lake, pines / a desert mesa) in muted tints, different per card |

### 6.4 Tape notes (masking tape, Caveat, ≤ 6 words, signed "— O.")
- Pinhole can: *open · count to 15 · close*
- Box camera: *Sun? f/16 at 1/ISO.*
- Field camera ground glass: *Yes, it's upside down.*
- Tank: *Turn it when it blinks.*
- Darkroom switch: *Light on = fog.*
- Fridge: *Best ones go here. Be honest.*
- Bellows (SHOULD): *Q. made these. Shh.*
- Thermometer: *20° down here, all summer.*

Cameos (furniture only, never plot): the Lantern Street darkroom key (Darkroom), a framed lighthouse plate (Plates), a taped evidence box in the closet (Latent Image), Q.'s drawer (Lens Bench), and the mailbox and a marble in the junk drawer (Texturedle). If those games rename O., Q. or Lantern Street, update the strings in `house/copy.ts`.

---

## 7. Art direction, UI and audio

### 7.1 The look
**The eye-versus-camera rule:**
- **The eye view** (walking around) uses an ACES filmic tonemap, deep focus, bloom on the sun and speculars only (threshold at 4× middle grey, strength 0.35, off on low), and a subtle vignette. No grain, no depth of field, no motion blur.
  - Eye adaptation is analytic: `exposure = 0.18 / (0.18 · E_horiz_klx / π)`, clamped [1/20, 2000]. τ = 4 s going dark, 0.25 s going bright. Interiors use their room's ambient lux (workshop 300 lx with tubes on / 2 lx off, hall 200 lx, darkroom 0.5 lx amber).
  - Night **Purkinje grade:** when E < 3 lx, `sat = smoothstep(0.01, 3, E)` and the image is tinted toward `#1B2740`.
- **Photos** get none of that. Linear exposure H goes through film and paper curves only. **Moonlight prints as warm daylight with stars**, because film has no Purkinje shift. That's Wow #3 (SHOULD).

**Colour-keyed rooms** (art-direction §12): darkroom red, workshop warm wood, yard green. Studio accent `--ar-game-studio` (`#2C7547`) / lit `#78CB97`. In-world palette (craft): sky `#5B8FD1`→`#CFE3F2`, golden `#F2B66B`, lawn `#6E9E3A` / shade `#2F4A22`, clapboard `#EDE6D6`, rust `#C1652F`/`#7A3324`, brass `#B08D3C`, mahogany `#5A2A1B`, bellows `#7E1F1A`, leatherette `#1C1B1A`, safelight `#FF9A3C`, firefly `#D8FF5A`, night `#1B2740`.
**Materials:** chamfered low-poly everywhere, matte, no glossy plastic. The physics honesty rule applies: nothing squashes.
**Typography:** the site's four families only (no extra face). O.'s postcards use Caveat in fountain-pen ink `#1F2A44`. Tape notes use Caveat in graphite. Camera dials are Archivo at 62 % width, rendered into canvas textures with an inset "engraved" shadow. Readouts use IBM Plex Mono with tabular numerals.

### 7.2 Screens and layout
The page is the standard shell (`mountShell({ slug: 'studio', actions, help })`) over `#stage`. The stage is one `<canvas>` plus a DOM HUD layer (`.st-hud`, z `--ar-z-hud`). All touch targets are at least 44 px, and HUD controls respect `env(safe-area-inset-*)`.

1. **Overview:** a full-bleed diorama. Room labels are small edge-print tags floating over each room (`▸ WORKSHOP`, `▸ DARKROOM`, `▸ YARD`, `▸ KITCHEN`), which also serve as the tap targets on phones. The time chip sits top-left, and the pocket (film cans, rattling when you move) top-right.
2. **Yard (hands):** time chip top-left. Pocket top-right, under it the frame counter (`3/8` Plex Mono) for the active camera. Camera button bottom-right. **Cable-release bulb** bottom-centre, only when the camera is on the tripod. A tape-note slot bottom-left (one note at a time).
3. **Finder:** the image fills the largest centred rectangle at the format's aspect ratio. The bezel is drawn per body:
   - Pinhole: no image at all. A plain eye view with two brass sight pins and faint frame lines (the real experience).
   - Box camera: a waist-level hood, a Fresnel ring pattern, a mirror-reversed image, dim corners.
   - Field camera: the ground glass upside down and reversed, a grid, and a dark-cloth vignette. The audio low-passes at 600 Hz while you're under the cloth. An "Erect image" accessibility setting flips it upright.
   - (SHOULD) Rangefinder: upright, with a warm double-image patch.
   Controls: aperture dial bottom-left, shutter dial bottom-centre, shutter button bottom-right (72 px) with the Bulb lock notch above it, focus strip down the right edge (metres, with the DoF bracket drawn from the real Hf), meter needle on the left edge (−2…+2 stops, damped with 10 % overshoot), advance lever and counter top-right, exit top-left. The finder preview is a single render with a depth-based CoC gather (12-tap Poisson, max 12 px), so the depth of field you see is real.
4. **Workshop:** the 3D bench. The **optics card** is a paper panel clipped by the bench lamp (bottom-left on desktop, a collapsible sheet on phones): body, lens `75 mm f/11`, shutter `1/500–1 s, B`, film `NJ 100`, mass `0.64 kg`, near focus `1.0 m`, FOV `41°`, plus the pencil line *sunny 16: f/16 · 1/125*. For a pinhole it adds the live blur readout `d 0.37 mm · f/270 · blur 0.52 mm`.
5. **Darkroom:** a fixed red-lit bench. A wind-up timer on the wall shows chem time in Plex Mono. The cue lamp sits on the tank. Toggling the room light whites out with bloom, then settles (τ 0.25 s).
6. **Hall:** the fridge is the gallery. The print viewer is a paper `.ar-dialog` with the print (and a slight 3D curl drawn in CSS), the logbook line `Box · 75 mm f/11 · 1/500 · NJ 100 · 16:40 · dev 7:00 @ 20°`, and the buttons **Save print**, **Copy caption**, **Unpin**.
7. **Mailbox panel:** open postcards on the left (front image, back in Caveat), your prints as a thumbnail strip on the right. Drag one onto a card, then drag the flag up to send.
8. **Share card** (Save print exports this PNG at 1200×1500): fridge enamel `#F1EEE6`, the print rotated −2° under a procedural fruit magnet, a grease caption with settings, O.'s mark if any, and at the bottom an edge-print line `SUNNY 16 · RANKIN 400 ▸06`. Copy caption gives: `Sunny 16 · "Stop the water." ★ · Box 75mm f/11 1/500 · NJ 100`.
9. **Settings** (shell More): Erect image, Captions for sounds and smells, Steady grip (pointer lock), Quality (auto / high / low), Start fresh.
10. **Fallback** (no WebGL2): the shared card from `showNoWebGL()` (art-direction §7.9). SHOULD: under it, a Canvas2D blueprint section drawing of the house with a tiny pinhole toy (drag the sun, poke the hole, and an inverted image forms on the wall).

**Help content** (datasheet): intro *"A little house for making photographs. Build a camera in the garage, shoot the yard, print in the basement."* Controls rows: Spin house · Grab and throw · Drag the sun · Raise camera · Focus · Fire · Wind on · Rock the tray. Tips: *"Loud shutters scare the sparrows."* *"Long exposures erase moving things."* *"Later light, longer exposure."* *"Fire twice without winding."*

### 7.3 Procedural audio
Use the shared context from `getAudio()` (`src/shared/audio`). The Studio bus is `game (0.8) → master`. Chrome sounds use `uiSound()`. Nothing plays before the first gesture, and with `?embed=poster` there's no audio at all. The world mix is ducked 6 dB inside the darkroom, plus a 900 Hz low-pass on the yard beds (you're underground).

| Sound | Recipe |
|---|---|
| **Cicadas** (day bed) | Noise → bandpass 4.5–6 kHz (Q 6), AM at 70 Hz inside 3–8 s swells, 2–3 panned voices. Gain ∝ `smoothstep(5°, 40°, el)`, peaking around 14:00 |
| **Crickets** (night bed) | 4.5 kHz sine chirps of 3 pulses each. Rate from Dolbear: chirps/min `N = 40 + 4·(T_F − 50)` with T_F from a night temperature of 68 °F. Gain ∝ `1 − smoothstep(−6°, 2°, el)` |
| **Wind** | Noise → lowpass (300 + 400·w Hz), gain follows the gust envelope at the listener |
| **Wind chimes** | Per tube, free-free bar partials at 1 : 2.756 : 5.404 : 8.933 (gains 1, 0.35, 0.15, 0.06, decays 4, 2, 1, 0.5 s), tuned to D pentatonic (587, 659, 740, 880, 988 Hz) |
| **Impact sprinkler** | Each step: a *tsk* (noise 8 ms → highpass 3 kHz, plus a 2.8 kHz ping, decay 30 ms). Return: 18 clicks over 1.2 s. Spray hiss = noise → bandpass 6 kHz, gain ∝ water on and distance⁻¹ |
| **Shutters** | Leaf: one dry *tik* (noise 4 ms → bandpass 4 kHz), and a second, quieter *tik* after exactly t. Gravity drop: a wooden clatter (3 noise bursts → bandpass 1.2 kHz) plus a bounce at landing. Focal plane: two cloth transients spaced by T_c + t. Lens cap: a felt *fff* on pull and replace. **The gap between the two sounds is always the real exposure time.** |
| **Self-timer** | 30 Hz pulse train → resonant bandpass 900 Hz, 10 s, then the shutter |
| **Wind-on** | A ratchet of 9 clicks per stroke (noise 3 ms → bandpass 2.4→1.9 kHz), then a thunk at the stop |
| **Thock** (part snaps on) | Sine 120 Hz, 40 ms, plus a felt click (noise 5 ms → lowpass 1.5 kHz). Dust puff of 40 particles. `vibrate(6)` |
| **Bellows** | Noise → bandpass 400 Hz, gain ∝ \|dV/dt\| of the bellows volume |
| **Needle** | A tiny creak (noise → bandpass 3 kHz, AM at 40 Hz) while held |
| **Swing creak** | Stick-slip granular clicks (rate ∝ \|ω\|, 10–40 Hz) at turnarounds, pitched by tension |
| **Sparrows** | FM chirps (carrier 4–6 kHz, mod ratio 1.5, 60 ms) plus a wing flutter (noise AM at 18 Hz, 300 ms) |
| **Dot** | Bark: a formant burst (sawtooth 380 Hz → bandpasses at 700 and 1200 Hz, 90 ms). Panting: noise AM at 4 Hz |
| **Impacts** | Material table: grass (lowpass 300 Hz, dull), wood (bandpass 800 Hz), metal bucket (inharmonic partials 523, 1307, 2210 Hz, decay 0.6 s), glass (3 kHz ping) |
| **Screen door** | A spring *boing* (two detuned resonators at 190 and 196 Hz with a pitch drop), then a wooden slam |
| **Stairs** | 13 footstep thuds, with an amber-room tone fading in |
| **Tank** | Glug (noise → bandpass, centre = 200 + 300·\|φ'\| Hz), lid twist, fixer pour |
| **Tray** | Slosh: noise → lowpass 500–1500 Hz following A |
| **Enlarger lamp** | A 120 Hz hum while on |
| **Mail truck** | A distant engine (sawtooth 55 Hz → lowpass, Doppler), a door, then the box thunk |
| **Postcard reply** | `uiSound('bell')` for ★, `uiSound('develop')` for ✓ |

There's no music. The chimes are the only melody, and the wind plays them.

---

## 8. Save states and persistence
- **Storage:** IndexedDB database `andrew-rankin`, object store `studio`, opened through `src/shared/storage` if it exists, otherwise directly (WP1 writes a 60-line wrapper). Keys:
  - `house` → `HouseState` JSON (owned parts, postcards, builds, active build id, tutorial flags, day clock, tripod pose, prop poses, fridge slots, settings).
  - `roll:<id>` → `Roll` JSON.
  - `latent:<frameId>` → `{ record: ShotRecord, png: Blob }`.
  - `neg:<frameId>` → `{ png: Blob (D encoded ×100, 8-bit), params }`.
  - `print:<id>` → `{ meta: PrintMeta, image: Blob (WebP 0.92, PNG fallback) }`.
- **Autosave triggers:** after a shot, wind-on, unload, a finished development, a finished print, a part mounted, a postcard answered, and every 30 s for prop and tripod poses. Writes are debounced at 500 ms and go through a single queue.
- **Retention:** latents are deleted once developed (the negative replaces them). Up to 120 prints are kept at full size. Beyond that, the oldest prints that aren't on the fridge are kept as 256 px thumbnails. The binder keeps everything.
- **Fallback:** if IndexedDB fails (private mode), use an in-memory store, shell toast *"This house forgets when you leave."*, and keep only `house` in `localStorage['ar:studio:house']` (no blobs).
- **Save states (SHOULD) as yard blueprints:** 3 slots on the garage wall, each a cyanotype-blue card with a hand-drawn plan of the yard. A slot stores prop poses, the tripod pose, time, active build and the lantern knot. Tap a card to load it: props slide home over 600 ms (no teleporting).
- **Camera links (SHOULD):** `#cam=<base64url(CameraBuild)>` (about 40 bytes). On load, the camera appears on the bench with a tag: *"On loan from a friend."*
- **Load toast:** *"Back where you left it."* **Start fresh** (More menu, confirmation dialog) clears the store.
- **Poster mode** (`?embed=poster`) never reads or writes saves.

---

## 9. Onboarding (no text walls; first print within about 2 minutes)
Each step is gated by a flag in `house.tutorial`. Every step can be skipped by doing anything else, and the step's glow simply waits.
1. **0:00.** The overview, with the roof lifting (or instantly under reduced motion), dives into the yard at 16:40. A pulse ring sits on the sun (period 4 s, low contrast). The tape note on the stump reads *open · count to 15 · close*.
2. **The pinhole.** Tap the can and you go to its finder (no image, just the sight pins over the eye view). Press-hold the tape flap: a soft tick counts seconds. Release closes it. The can ships with a 0.45 mm hole (f/222, slightly larger than the sweet spot, which gives the needle a reason to exist). At 16:40 the scene is EV 14.7, so Ortho 25 meters 7.6 s, which reciprocity stretches to 15 s. The can's seam glows and the HUD pocket gains a sheet.
3. **The basement door glows** (outline glow on the hall door in the yard view, and the darkroom tag pulses in the overview).
4. **Darkroom.** The tank glows. Tap it (1.5 s fumble in the dark). The bath is already at 20°. The jug glows: drag it to pour. The cue lamp blinks: invert three times (the note says *Turn it when it blinks.*). Pour out, fix, wash (the pink drains). The sheet hangs on the light box: **a negative yard**. The loupe glows, so drag it over and see the positive inside the circle.
5. **Print.** The easel glows: drag the negative onto the paper, the glass drops, hold the lamp (the pencil mark shows 8 s). The tray glows: drag the paper in and rock it. **The yard comes up, with a ghost of Dot smeared across it.** The tongs carry the print to the fix tray, then the line.
6. **Hall.** The print appears in the print box. The fridge glows: pin it. **P1 is answered.** The mail-truck sound plays, and the mailbox flag in the yard drops: a package (box camera, meniscus, leaf shutter, Nightjar 100) plus postcard **P2** ("Dot will not sit…").
7. From here on, the only guidance is O.'s cards and one hint note after two misses.

The help datasheet opens once on first visit (`helpOnFirstVisit: true`), **after** step 1's dive, never over the loader.

---

## 10. Scope tiers

### MUST (MVP, shippable in one build round)
1. The shell, the dollhouse overview with roof lift and room dives, and 4 room stations (yard orbit, workshop, hall, darkroom) with door transitions (600 ms dolly, or 200 ms fade under reduced motion).
2. **Sun module**, sky (Preetham day, a night dome with a simple star field), sun drag with fling, the time chip and scrubber, analytic eye adaptation, a 2048/1024/512 shadow map.
3. Rapier world, the grab/poke/throw model, impact sounds and noise events.
4. Yard: lawn, maple, fence, house back, patio, A-frame, stump, feeder, mailbox. Toys: **tire swing, sprinkler + rainbow, Y-lantern, whirligig, chimes, ball + bucket + watering can**. Creatures: **Dot (lap, fetch, jump, sit)** and **sparrows (perch, flee, return)**. Wind field.
5. Workshop: drawers, Rapier parts, snap mounting, needle pinhole, film loading, optics card, build shelf. Content: 3 bodies (oatmeal can, box, field), 4 lenses (pinhole, Meniscus 75, Plasmat 150, Portrait 120 without swirl) + the +2 close-up, 3 shutters (cap, leaf, drop), 4 films, tripod.
6. Tripod placement and aiming; finder (handheld and tripod) with 3 bezel styles, focus strip, dials, meter, advance lever, cable release, self-timer, hold breath.
7. **Capture:** the fast path and the live path, the rank-1 projection (depth of field + tilt), time-lapse, the optics post-pass (pinhole, glow, CA, distortion, vignette, image circle), exposure and reciprocity, LogH8 latent, double exposure, ShotRecord measures.
8. Darkroom: tank (pendulum slosh, cue lamp, temperature, push/pull, drag/surge defects), fix and wash, light box with loupe, contact sheet, enlarger with grade and timer, tray modal slosh with live development, drying line, room light that fogs paper.
9. Hall: fridge (8), print box, binder, print viewer, share card PNG and caption; mailbox panel; postcards P1–P8 with predicates, replies, packages and the mail-truck sequence.
10. Persistence (§8) without blueprints; hub progress note.
11. Audio: everything in §7.3 except stairs and the mail truck's Doppler.
12. The onboarding sequence; `window.__game` (§13); quality profiles; the no-WebGL2 card.

### SHOULD
Tin-plate 35 + cloth focal-plane shutter + rolling lean (P12) · Marble Tin (P2 bonus) · Magnifier lens · Tele 300 (P9) · camera obscura (§5.14) · dominoes · kiddie pool + caustics · clothesline + pegged prints · night set (moon, stars rotating about Polaris, fireflies, Purkinje eye) and P11 · postcards P9–P14 · tripwire trigger with a delay knob (0–500 ms, 5 ms detents) · yard blueprints (3 save slots) · camera hash links · Q.'s drawer (Lens Bench import) · filmcan export "Send to Lantern Street" (Darkroom) · test strip · portrait swirl + cat's-eye · the eye/film side-by-side inset on the moonlight share card · rangefinder finder · captions for sounds and smells · Canvas2D fallback toy · stairs and mail-truck audio.

### STRETCH
Changing-bag loading by feel (two-thumb reel ratchet, kinks leave crescent marks) · light leaks with gaffer tape and a torch test · garden hose and a wet front element (drop bokeh, rub to wipe) · flash with guide numbers, capacitor whine and rear-curtain sync (within the photosensitivity limits) · oscilloscope shutter tester · opening the back mid-roll fogs it · clap mic and light gate triggers · the obscura taking a picture · cyanotype photograms at the picnic table · the Golden Minute daily · Replay timeline · soap bubbles with thin-film colour · revolving darkroom door · device-tilt tray rocking and tripod levelling.

**Cut order if MUST is at risk** (cut from the top): portrait lens → whirligig → chimes visual (keep the audio) → contact-sheet layout (print single frames only) → field camera tilt UI (keep the field camera) → sparrows.

---

## 11. Tech plan

### 11.1 Files (`games/studio/`; owner work package in brackets)
```
index.html                      [WP1] page per art-direction §11 (data-game="studio"), #stage
main.ts                         [WP1] boot: hasWebGL2, quality, fonts/tokens, mountShell, RAPIER.init, Engine, rooms, loop, __game
studio.css                      [WP1] HUD, finder bezels, panels (st- prefix; tokens only)
core/contracts.ts               [WP1, FROZEN at T+0 from §11.3]
core/engine.ts                  [WP1] renderer, scene, eye camera, loop, SimClock, DayClock, quality, layers
core/physics.ts                 [WP1] Rapier wrapper: bodies, mesh sync, raycast, contact events, fixed step
core/input.ts                   [WP1] pointer/touch/keys → gestures (§4.1) → InputBus; picking
core/grab.ts                    [WP1] spring hand, poke, throw, outline glow
core/rooms.ts                   [WP1] RoomManager, station look-around, transitions, overview camera
core/store.ts                   [WP1] IDB wrapper + memory fallback + autosave queue
core/bus.ts, core/rng.ts        [WP1] typed events; mulberry32 + value noise + fbm
core/audio.ts                   [WP1] Studio bus on getAudio(); voices: click, noiseBurst, resonator, fm, granular; beds
core/textures.ts                [WP1] shared procedural textures (§6.3) incl. rust fallback
house/architecture.ts           [WP1] walls, roof lift, cut section, doors, stairs, windows
house/hall.ts                   [WP1] hall room: fridge, print box, binder, viewer
house/mailbox.ts                [WP1] mailbox mesh + hinge/flag + panel + truck sequence
house/postcards.ts              [WP1] P1–P14 data, predicate eval, replies, unlocks
house/sharecard.ts              [WP1] share PNG + caption
house/onboarding.ts             [WP1] tutorial director (glows, notes, flags)
house/copy.ts                   [WP1] every in-game string (tape notes, postcards, captions)
hud/hud.ts, hud/settings.ts     [WP1]
api/test-api.ts                 [WP1] assembles __game from parts each WP registers
yard/yard.ts                    [WP2] RoomModule: orbit camera, assembly
yard/environment.ts             [WP2] lawn shader, maple (instanced leaf cards, wind sway), fence, patio, A-frame, stump, feeder, neighbours
yard/sky.ts                     [WP2] Sky + night dome + stars (+ moon SHOULD), sun light + shadow + hemisphere
yard/daylight.ts                [WP2] sun handle (drag/fling), time chip binding, eye-exposure target, Purkinje (SHOULD)
yard/wind.ts                    [WP2]
yard/toys/{swing,sprinkler,lantern,whirligig,chimes,props}.ts   [WP2]
yard/creatures/{dot,sparrows}.ts                               [WP2]
yard/subjects.ts                [WP2] PhotoSubject implementations + registry
yard/toys/{dominoes,pool,clothesline}.ts, yard/night/fireflies.ts   [WP2, SHOULD]
camera/parts.ts                 [WP3] catalog data (§6.2)
camera/spec.ts                  [WP3] deriveSpec(): §5.6 math
camera/optics-bridge.ts         [WP3] adapter to @shared/optics (local implementation first)
camera/meshes.ts                [WP3] procedural bodies/lenses/shutters/tripod
camera/workshop.ts              [WP3] RoomModule: bench, drawers, turntable, needle, optics card
camera/assembly.ts              [WP3] snap mounts
camera/tripod.ts                [WP3] tripod body in the yard, slide/hop/aim
camera/finder.ts                [WP3] finder mode, bezels, dials, preview render + CoC gather, meter
camera/shake.ts                 [WP3] §5.8
camera/shutters.ts              [WP3] profiles, timing, sounds, loudness → bus.noise
camera/capture.ts               [WP3] sampling, rank-1 projection, fast/live paths, focal plane, time-lapse
camera/postoptics.ts            [WP3] post-pass + exposure/encode shader
camera/latent.ts                [WP3] LogH8 encode/decode, double exposure
camera/measure.ts               [WP3] ShotRecord (§5.13)
camera/filmback.ts              [WP3] roll/sheet state, wind, unload → pocket
darkroom/darkroom.ts            [WP4] RoomModule: bench, safelight, switch, stations
darkroom/tank.ts                [WP4] slosh, cue lamp, temp, pour/fix/wash
darkroom/lightbox.ts            [WP4] strip, loupe
darkroom/enlarger.ts            [WP4] contact easel, enlarger head, grade, timer
darkroom/trays.ts               [WP4] modal slosh mesh, live print display
darkroom/chem-bridge.ts         [WP4] adapter to @shared/photochem (local implementation first)
darkroom/develop.ts             [WP4] negative compute (§5.11)
darkroom/printing.ts            [WP4] print compute (§5.12)
darkroom/dryline.ts             [WP4] hanging strip and prints → print box
test/smoke.json                 [WP1] shoot.mjs steps (§13.2)
```

### 11.2 Shared modules
| Module | Status | Studio's use | Rule |
|---|---|---|---|
| `src/shared/ui/*`, `src/shared/audio`, `src/shared/games.ts` | site chrome (hub team) | shell, toasts, dialogs, loader, fallback, audio context, registry | Use as specified. Studio edits only its own registry entry. |
| **`src/shared/sun/index.ts`** | **new, owned by Studio WP2** | §5.2 | Pure TS, no three.js import. Exports `sunPosition(dayOfYear, latDeg, clockHours)`, `moonPosition(...)`, `daylight(elevDeg)`, `kelvinToRgb(K)`, `ev100FromLuminance(L)`, `exposureMatches(N, t, iso, ev)`. Shared because Darkroom's cyanotype sun window and Lens Bench's yard need the same honest sun. |
| `src/shared/photochem` | Darkroom team (expected) | H&D curve, reciprocity, grain, paper curve, development rate | Studio imports it **only through `darkroom/chem-bridge.ts`**. The bridge starts with the local formulas of §5.10–5.12. Integration swaps the internals to shared exports if signatures fit, and if they don't, Studio keeps local. Nothing outside the bridge imports `@shared/photochem`. |
| `src/shared/optics` | Lens Bench team (expected) | `LensProfile`, saved lenses (SHOULD) | Same pattern via `camera/optics-bridge.ts`. |
| `src/shared/filmcan` | first team to need it | "Send roll to Lantern Street" (SHOULD) | Studio writes `{ slug: 'studio', frames: [{ png: Blob /* LogH8 */, iso, stock, w, h, record }] }`. If the module is absent, the feature is hidden. |
| `src/shared/materials` | Texturedle team (expected) | `rustyMailbox()` canvas recipe | Via `core/textures.ts`, with the local fallback recipe. |
| `src/shared/storage` | hub/infra (optional) | IDB open | If present, use it; otherwise use `core/store.ts` directly. |

### 11.3 `core/contracts.ts` (written verbatim by WP1 at T+0; changing it needs all WPs to agree)
```ts
import type * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

export type RoomId = 'overview' | 'yard' | 'workshop' | 'hall' | 'darkroom';
export type QualityName = 'high' | 'low' | 'test';
export interface Quality { name: QualityName; dprMax: number; shadow: number; captureLong: number;
  samples: number; samplesFP: number; drops: number; physicsHz: number; previewLong: number;
  bloom: boolean; transitions: boolean; }

export interface Steppable { step(dt: number, t: number): void }
export interface SimClock { readonly t: number; paused: boolean;
  add(s: Steppable, order: number): () => void; advance(dt: number): void }
export interface DayClock { hours: number; rate: number;          // game-seconds per sim-second; 0 = frozen
  set(h: number, source: 'drag' | 'scrub' | 'api' | 'timelapse'): void; onChange(cb: (h: number) => void): () => void }
export interface SunState { elevDeg: number; azDeg: number; dir: THREE.Vector3; sunLux: number; skyLux: number;
  moonDir: THREE.Vector3; moonLux: number; horizLux: number; kelvin: number }

export interface Bus {                                              // typed events
  on<K extends keyof Events>(k: K, cb: (e: Events[K]) => void): () => void;
  emit<K extends keyof Events>(k: K, e: Events[K]): void }
export interface Events {
  'noise': { pos: THREE.Vector3; loudness: number };               // shutter, impacts → sparrows
  'shot': { record: ShotRecord }; 'roll:unloaded': { rollId: string };
  'roll:developed': { rollId: string }; 'print:made': { printId: string };
  'postcard:answered': { id: string; mark: 'miss' | 'check' | 'star' }; 'part:unlocked': { partId: string };
  'room': { from: RoomId; to: RoomId }; 'sun': SunState }

export interface Physics { R: typeof RAPIER; world: RAPIER.World; hz: number;
  add(mesh: THREE.Object3D, body: RAPIER.RigidBodyDesc, colliders: RAPIER.ColliderDesc[],
      opts?: { grabbable?: boolean; material?: ImpactMaterial; subjectId?: string }): PhysBody;
  remove(b: PhysBody): void;
  raycast(o: THREE.Vector3, d: THREE.Vector3, max: number, exclude?: PhysBody): { body: PhysBody | null; point: THREE.Vector3; dist: number } | null;
  stepFixed(dt: number): void }
export interface PhysBody { body: RAPIER.RigidBody; mesh: THREE.Object3D; mass: number; grabbable: boolean; material: ImpactMaterial }
export type ImpactMaterial = 'grass' | 'wood' | 'metal' | 'glass' | 'rubber' | 'cloth';

export interface WorldPointer { kind: 'tap' | 'dragStart' | 'drag' | 'dragEnd' | 'hold' | 'wheel' | 'pinch' | 'twist';
  ndc: THREE.Vector2; ray: THREE.Ray; hit?: { object: THREE.Object3D; point: THREE.Vector3 };
  dx: number; dy: number; scale?: number; angle?: number; pointerType: 'mouse' | 'touch' | 'pen'; buttons: number }

export interface RoomModule { id: RoomId; root: THREE.Group;
  station: { pos: THREE.Vector3; target: THREE.Vector3; fov: number; yawLimitDeg: number; pitchMinDeg: number; pitchMaxDeg: number } | 'orbit';
  ambientLux(): number; enter(from: RoomId): void; exit(to: RoomId): void;
  update(dt: number): void;                               // visuals only; simulation goes through SimClock
  onPointer?(e: WorldPointer): boolean }                  // true = consumed

export interface Hud { note(text: string, ms?: number): void; toast(text: string): void;
  setFrames(left: number | null, total: number | null): void; setPocket(n: number): void;
  setCableRelease(visible: boolean): void; glow(target: THREE.Object3D | string | null): void }

export interface Store { getHouse(): HouseState; saveHouse(patch: Partial<HouseState>): void;
  put(key: string, value: unknown): Promise<void>; get<T>(key: string): Promise<T | undefined>;
  del(key: string): Promise<void>; keys(prefix: string): Promise<string[]> }

export interface Engine { renderer: THREE.WebGLRenderer; scene: THREE.Scene; eye: THREE.PerspectiveCamera;
  quality: Quality; physics: Physics; sim: SimClock; day: DayClock; sun(): SunState; bus: Bus; store: Store;
  hud: Hud; audio: AudioKit; rng(stream: string): () => number; rooms: { go(id: RoomId): Promise<void>; current: RoomId };
  registerRoom(r: RoomModule): void; registerTestApi(part: Partial<TestApi>): void }
// Layers: 0 world (eye + capture), 1 eye-only helpers (outlines, handles, sun ring), 2 self (own tripod/camera; eye only)

export interface AudioKit { bus: GainNode | null; click(o: { freq: number; q?: number; gain: number; ms: number; at?: number }): void;
  noise(o: { type: BiquadFilterType; freq: number; q?: number; gain: number; ms: number; at?: number; sweepTo?: number }): void;
  tone(o: { freq: number; gain: number; ms: number; type?: OscillatorType; at?: number; partials?: number[][] }): void;
  impact(material: ImpactMaterial, impulse: number, mass: number, pos?: THREE.Vector3): void; now(): number }

/* ---------- camera ---------- */
export type BodyId = 'oatcan' | 'box' | 'field' | 'tin35' | 'marbletin';
export type ShutterKind = 'cap' | 'leaf' | 'drop' | 'focalplane';
export type StockId = 'ortho25' | 'nj100' | 'nj400' | 'colour200';
export interface CameraBuild { v: 1; body: BodyId; lens: string; shutter: ShutterKind; stock: StockId | null;
  pinholeMm?: number; pinholeRagged?: number; dropHeightCm?: number; accessories: string[] }
export interface CameraSpec { build: CameraBuild; formatMm: [number, number]; frames: number; finder: 'pins' | 'waist' | 'ground' | 'range';
  f: number; nMin: number; nMax: number; blades: number; imageCircleMm: number; vRangeMm: [number, number];
  tiltMaxDeg: number; shutterSpeeds: number[] /* seconds; 0 = B */; loudness: number; massKg: number; iso: number;
  spectral: [number, number, number][]; post: { glow: number; edgeSoftPx: number; ca: number; k1: number; vignette: number; swirl: number } }
export interface CameraSettings { N: number; t: number /* s; 0 = B */; focusM: number; tiltDeg: number }

export interface PhotoSubject { id: string; tag: string; dynamic: boolean;
  center(out: THREE.Vector3): THREE.Vector3; radius: number; collider?: PhysBody;
  sample(): Record<string, number | boolean>;                          // state at the current sim time
  extra?(cam: THREE.Camera, frameW: number, frameH: number): Record<string, number> } // e.g. drops, trail
export interface SubjectRegistry { all(): PhotoSubject[]; get(id: string): PhotoSubject | undefined; add(s: PhotoSubject): void }

export interface SubjectMeasure { id: string; tag: string; inFrame: number; visible: number; blurPx: number; defocusPx: number;
  coverage: number; visibility: number; centerPx: [number, number]; distanceM: number;
  stateMin: Record<string, number>; stateMax: Record<string, number>; stateMid: Record<string, number | boolean>;
  anyTrue: Record<string, boolean>; extra: Record<string, number> }
export interface ShotRecord { id: string; rollId: string; frame: number; takenAt: number; dayHours: number; sunElevDeg: number;
  spec: { body: BodyId; lens: string; f: number; N: number; t: number; shutter: ShutterKind; stock: StockId; iso: number; formatMm: [number, number] };
  focusM: number; tiltDeg: number; handheld: boolean; shakePx: number; samples: number; timelapse: number;
  exposure: { evScene: number; overStops: number }; doubleExposures: number; subjects: SubjectMeasure[]; tags: string[] }

export interface Roll { id: string; stock: StockId; body: BodyId; frames: number; exposed: number[]; state: 'loaded' | 'unloaded' | 'developed'; createdAt: number }
export interface LatentFrame { frameId: string; rollId: string; index: number; w: number; h: number; channels: 1 | 3; png: Blob; record: ShotRecord }
export interface DevParams { tempC: number; chemSeconds: number; rho: number; cueRatio: number; surge: number; washed: boolean }
export interface PrintMeta { id: string; frameId: string; kind: 'contact' | 'enlargement'; lampS: number; grade: number; devS: number;
  w: number; h: number; caption: string; tags: string[]; record: ShotRecord; createdAt: number; place: 'box' | 'fridge' | 'line' | 'gallery' }

export interface HouseState { v: 1; seed: number; owned: string[]; builds: CameraBuild[]; activeBuild: number; rollInCamera: string | null;
  pocket: string[]; postcards: Record<string, { state: 'unissued' | 'open' | 'check' | 'star'; misses: number; printId?: string }>;
  fridge: (string | null)[]; tutorial: Record<string, boolean>; dayHours: number; tripod: { pos: [number, number, number]; yaw: number; pitch: number; height: number };
  props: Record<string, [number, number, number, number, number, number, number]>; settings: { erect: boolean; captions: boolean; steady: boolean; quality: 'auto' | QualityName } }

/* ---------- bridges ---------- */
export interface ChemBridge { negDensity(x: number, stock: StockId, rho: number, ch: 0 | 1 | 2): number;
  reciprocity(t: number, stock: StockId): number; grainSigma(stock: StockId, D: number, rho: number): number;
  paperDensity(xp: number, grade: number): number; devRate(tempC: number): number }
```
**WP-to-WP contracts:**
- **WP2 → WP3:** `yard.subjects: SubjectRegistry`. `yard.addToScene(obj)` (for the tripod). `yard.groundY(x, z)`. Dot's `pathPolyline`. The `noise` events.
- **WP3 → WP4:** `LatentFrame` records in the store under `latent:*`, and `Roll` under `roll:*`. The `roll:unloaded` event.
- **WP4 → WP1:** `print:<id>` records and the `print:made` event. `PrintMeta.record` carries the ShotRecord, so postcards evaluate prints without WP4 knowing about them.
- **WP3 → WP1:** the `shot` event and `CameraSpec` for the HUD and optics card.

### 11.4 Render pipeline
- **Units:** lights are in **kilolux**. A DirectionalLight with intensity `E_sun/1000`. A HemisphereLight whose intensity is chosen so a horizontal white Lambert card under sky alone renders `E_sky/(1000π)` (ground colour from lawn albedo); verify with `calib().ev100Noon`. Rendered linear value = luminance in kcd/m² (three's Lambert `albedo·E·cosθ/π`). An 18 % card in full sun renders as P ≈ 5.6.
- **Eye frame:** `sim.advance` → visual updates → shadow pass (sun; the camera frustum fits the yard 26×24 m; resolution 2048/1024/512; PCF; shadows off for interiors except the workshop window spot on high) → main pass (scene, ACES, sRGB output) → bloom (UnrealBloom at half resolution, high only) → DOM HUD.
- **Finder preview:** render at `previewLong` into a linear HalfFloat target with depth → CoC gather pass (thin-lens CoC from linearized depth) → tonemap with the finder exposure → composite through the bezel mask. The meter is a reduction pass to 1×1, center-weighted (Gaussian σ = 0.25 frame), writing `log2 L` packed into RGBA8. It's read back every 250 ms, asynchronously via a fence when available.
- **Capture:** §5.9. Targets: `sampleRT` (RGBA16F + depth, captureLong × aspect), `accumRT` (RGBA16F; ping-pong if `EXT_float_blend` is missing), `outRT` (RGBA8). Disable tonemapping for render-target passes (three applies tone mapping only to the default framebuffer). Exclude layers 1–2.
- **Darkroom compute:** CPU over Float32Arrays, chunked across 2 frames when the frame is larger than 512 px. Results go into a `CanvasTexture` (light box, tray) and `toBlob` for storage.
- **Draw-call hygiene:** instancing for pickets, leaf cards, drops, stars, fireflies and grass tufts. Merged static geometry per room. Rooms not visible are `visible = false` (except in the overview).

### 11.5 Performance budget and quality profiles
| Profile | DPR max | Shadow | Capture long side / K / K_FP | Drops | Physics | Preview | Bloom |
|---|---|---|---|---|---|---|---|
| **high** (desktop) | 2 | 2048 | 768 / 24 / 32 | 1024 | 120 Hz | 640 | yes |
| **low** (phones, ≤ 4 cores, Mali/Adreno ≤ 6xx) | 1.5 | 1024 | 512 / 12 / 16 | 512 | 60 Hz | 384 | no |
| **test** (SwiftShader, `?quality=test` or `__game.setQuality`) | 1 | 512 | 384 / 4 / 8 | 256 | 60 Hz | 256 | no; transitions instant |

**Budgets (high / low):** 60 / 30+ fps · ≤ 250 / 180 draw calls in the yard · ≤ 350k / 150k triangles · physics ≤ 2.5 / 4 ms · ≤ 120 awake bodies · capture hitch ≤ 250 / 600 ms · JS heap ≤ 250 / 180 MB · textures ≤ 24 / 16 MB · IDB per developed frame ≤ 250 KB · initial JS ≤ 900 KB gzip (Rapier wasm loads in parallel, inside the loader "Mixing chemistry…").
**Adaptive:** if the mean frame time is over 22 ms for 3 s, step down one level (shadow → bloom → DPR), with a single toast-free log line.

### 11.6 Mobile plan
- No joystick and no walking. Every verb is a tap, drag, hold, pinch or twist (§4). HUD controls are at least 44 px, with the shutter button at 72 px placed where the right thumb rests. The focus strip runs along the right edge in landscape, and moves above the shutter row in portrait.
- **Portrait works:** the finder letterboxes the format, and dials sit in a bottom tray. **Landscape is recommended** in a one-time tape note, never forced.
- `touch-action: none` on the stage. Gestures follow §4.1. A second-finger hold is breath (only off the controls).
- `navigator.vibrate` (tied to the sound preference) fires on the shutter (12), a part snapping on (6), the tank lid (8) and the tray reaching 50 % density (4).
- Low profile automatically on coarse pointer + small screen or `deviceMemory ≤ 4`. Capture runs at 512 px, K = 12.
- `visibilitychange` → pause the SimClock and the audio. A live exposure in progress closes at the moment of hiding (the frame keeps what it got).

---

## 12. Build split (4 parallel work packages)
**T+0 (first 10 minutes, WP1):** commit `core/contracts.ts` verbatim from §11.3, plus `core/bus.ts`, `core/rng.ts` and a **stub `Engine`** (`core/engine-stub.ts`: renderer + scene + orbit camera + fake SimClock and DayClock + a no-op store). Every WP can then run its room solo with `?solo=<room>` (main.ts routes `?solo` to a minimal harness).
File ownership is strictly disjoint (§11.1). Shared CSS lives only in `studio.css` (WP1). Other WPs add classes through a `css` string they hand to `hud.inject(css)`, or a co-located `*.css` file imported by their own module.

| WP | Scope (MUST, then SHOULD) | Depends on | Delivers |
|---|---|---|---|
| **WP1: House, shell and glue** | engine, physics wrapper, input, grab, rooms + overview + transitions, house architecture, hall/fridge/binder/viewer, mailbox + postcards + packages, share card, store, audio kit + beds, HUD, settings, onboarding director, `__game` assembly, fallback, quality, hub note · SHOULD: blueprints, camera links, captions | contracts only | a running house with doors; the other WPs' rooms mount via `registerRoom` |
| **WP2: Yard world** | `src/shared/sun`, sky/night, daylight + sun drag, environment, wind, swing, sprinkler + rainbow, lantern, whirligig, chimes, props, Dot, sparrows, subject registry · SHOULD: dominoes, pool, clothesline, fireflies, stars, moon, Purkinje | WP1 engine (stub at first) | `yard` RoomModule; `SubjectRegistry`; `__game.toy/setTime/throwBall/poke` parts |
| **WP3: Camera** | parts data, spec math, workshop room + assembly + needle + optics card, tripod, finder (bezels, dials, preview, meter), shake, shutters, capture (fast/live/time-lapse/rank-1), post-optics, latent, measure, filmback · SHOULD: Tin-plate 35 + focal plane, Marble Tin, magnifier, tele, obscura, Q.'s drawer, rangefinder | WP1 engine, WP2 subjects (mock registry until merged) | `workshop` RoomModule; finder mode; `LatentFrame`s; `__game.build/placeTripod/aim/settings/shoot/wind/unload` parts |
| **WP4: Darkroom and prints** | darkroom room, tank, light box + loupe, contact/enlarger, trays, chem bridge, develop, printing, drying line → print box · SHOULD: test strip, filmcan export | WP1 engine, WP3 latent format (use a synthetic LogH8 gradient until merged) | `darkroom` RoomModule; `print:*` records; `__game.develop/print` parts |

**Integration step (WP1 lead plus one reviewer, ~30 min):**
1. Merge order: WP1 → WP2 → WP3 → WP4. `main.ts` registers rooms in that order.
2. Swap mocks: WP3's mock subjects → WP2's registry. WP4's synthetic latents → real `latent:*`.
3. Run `npm run check` and `npm run build`, then the smoke test (§13.2) on desktop and mobile.
4. Run the four calibration checks in `__game.calib()` (§13.1). They must pass within tolerance.
5. Fix contract mismatches **in the bridges or adapters, never in `contracts.ts`**, unless all leads agree.
6. Flip the registry `status` to `'ready'` only after review.

---

## 13. Test API and smoke test

### 13.1 `window.__game`
```ts
interface TestApi {
  ready: boolean; version: string;
  poster(): Promise<void>;                 // hero: overview at 18:45, roof lifted, swing mid-arc, sprinkler on, lantern lit,
                                           // basement glowing red, seed 16, no HUD; resolves when stable (hub §11.1)
  seed(n: number): void; setQuality(q: QualityName): void;
  pause(): void; resume(): void; step(ms: number): void;   // advances SimClock deterministically (fixed steps)
  state(): { room: RoomId; day: number; sun: SunState; camera: CameraSpec | null; settings: CameraSettings;
             roll: Roll | null; pocket: number; postcards: Record<string, string>; prints: number; fps: number;
             drawCalls: number; tris: number; awakeBodies: number };
  goto(room: RoomId): Promise<void>;
  view(name: 'overview' | 'yard-wide' | 'yard-rainbow' | 'yard-lantern' | 'workshop' | 'darkroom' | 'hall'): void;
      // 'yard-rainbow' is computed: eye 1.6 m up, 7 m from the sprinkler, looking along (antisolar azimuth − 42°)
  setTime(h: number | `${number}:${number}`): void;
  toy(id: 'swing' | 'sprinkler' | 'lantern' | 'whirligig' | 'dot', action: string, arg?: unknown): void;
      // e.g. toy('swing','pull',0.5) toy('sprinkler','on') toy('lantern','knot',0.444) toy('lantern','push',[0.4,0.1]) toy('dot','sit')
  throwBall(from: [number, number, number], vel: [number, number, number]): void; poke(objectName: string): void;
  build(preset: 'pinhole' | 'box' | 'field' | 'portrait' | CameraBuild): CameraSpec;
  unlockAll(): void;                       // owns every part and opens every postcard
  placeTripod(pos: [number, number], yawDeg: number, pitchDeg: number, height?: number): void; aim(target: [number, number, number]): void;
  handheld(on: boolean): void; settings(s: Partial<CameraSettings>): void; finder(on: boolean): void;
  shoot(o?: { bulbSeconds?: number; noWind?: boolean }): Promise<ShotRecord>;
      // the live path is driven here by deterministic fixed sim steps (one sample per 1/30 s, at most 120, evenly spaced),
      // not by real frames, so a 20 s Bulb finishes in a few seconds headless
  wind(): void; unload(): string /* rollId */;
  develop(rollId?: string, o?: { tempC?: number; push?: number; cueRatio?: number }): Promise<{ frames: string[] }>;
  print(frameId: string, o?: { lampS?: number; grade?: number; kind?: 'contact' | 'enlargement' }): Promise<string /* printId */>;
  pin(printId: string, slot?: number): void; mail(printId: string, postcardId: string): Promise<'miss' | 'check' | 'star'>;
  photos(): { frames: ShotRecord[]; prints: PrintMeta[] }; printPixels(printId: string): Promise<{ w: number; h: number; mean: number; brightFrac: number }>;
  calib(): { sunNoonElev: number; ev100Noon: number; pinholeOptMm: number; dropT40cm: number; swingPeriod: number;
             noonEvOk: boolean; pinholeOk: boolean; dropOk: boolean; swingOk: boolean };   // §5 numbers vs expected
  resetSave(): Promise<void>;
}
```
`calib()` expects: noon elevation 57.4° ± 0.3, EV100 at noon on a grey card 15.4 ± 0.4, pinhole d* 0.37 mm ± 0.01 at f = 100, gravity drop at 40 cm with A = 6.8 mm about 9.6 ms ± 0.3 (no jitter), swing period 3.11 s ± 0.1 (measured over 3 swings).

### 13.2 Playwright smoke test (`node scripts/shoot.mjs /games/studio/?quality=test --steps games/studio/test/smoke.json`; also run once with `--mobile`)
| # | Steps | Expected |
|---|---|---|
| 1 | Load. Wait for `__game.ready` (≤ 30 s). `seed(16)`. | No `pageerror`. The first frame is the overview. **Shot `studio-01-overview.png`:** the cutaway house with the garage on the left, the kitchen centre, a red-lit basement below in a soil section, the yard right and behind with a maple, a swing and the A-frame. The shell bar is at the top. |
| 2 | `goto('yard')`, `setTime(17.5)`, `toy('swing','pull',0.5)`, `toy('sprinkler','on')`, `view('yard-wide')`, `step(1500)` | **Shot `studio-02-yard.png`:** long warm shadows toward the east, the tire off-centre mid-swing, a fan of sprinkler drops, Dot on the lawn, sparrows on the feeder. The HUD shows a time chip `17:30` and a camera button. |
| 3 | `setTime(19.0)`, `view('yard-rainbow')`, `step(500)` | **Shot `studio-03-rainbow.png`:** coloured drops forming a circular arc (red on the outside). `state().sun.elevDeg` between 3 and 12. |
| 4 | `unlockAll()`, `build('box')`, `placeTripod([3,-1],0,−5,1.3)`, `aim([3,1,7])`, `settings({N:11,t:1/500,focusM:8})`, `finder(true)` | **Shot `studio-04-finder.png`:** the waist-level bezel with a mirror-reversed sprinkler, dials, focus strip, meter needle. |
| 5 | `shoot()` → r1. `wind()`. `settings({t:1/4})`. `shoot()` → r2. `wind()` | `r1.subjects` has `sprinkler` with `extra.dropBlurPx ≤ 4`. `r2` has `dropBlurPx ≥ 30`. Each capture finishes in ≤ 5 s on SwiftShader. |
| 6 | `setTime(20.4)`, `toy('lantern','knot',0.444)`, `toy('lantern','push',[0.4,0.1])`, `placeTripod([6,12],0,89,0.4)`, `settings({N:8,focusM:1.2})`, `shoot({bulbSeconds:20})`, `wind()`, `unload()` | The record has a `lantern` measure with `extra.trailPx ≥ 1500` and `timelapse ≥ 1`. |
| 7 | `develop()` → frames, `print(frames[0])`, `print(frames[2])`, `goto('darkroom')`, `view('darkroom')` | **Shot `studio-05-darkroom.png`:** an amber-red room, a strip on the light box, a print in the tray or on the line. `printPixels(lanternPrint).brightFrac ≥ 0.01` (light trails) and `mean < 0.35` (dark background). The sprinkler print has `0.2 < mean < 0.8`. |
| 8 | `pin(p0, 0)`, `goto('hall')`, `view('hall')` | **Shot `studio-06-hall.png`:** a fridge with one print under a magnet. `localStorage['ar:studio:hub']` contains "on the fridge". |
| 9 | `mail(p0, 'P3')` | Returns `'check'` or `'star'`. The postcard state updates. |
| 10 | `goto('workshop')`, `view('workshop')` | **Shot `studio-07-workshop.png`:** the bench with the box camera assembled, the optics card visible, drawers. |
| 11 | Reload the page. Wait for ready. `photos()` | The prints persist (≥ 2), the fridge slot persists, the toast reads "Back where you left it." |
| 12 | `poster()` | **Shot `studio-poster.png`:** no HUD, golden hour, roof lifted, the basement glowing red, the lantern lit. Deterministic: two runs differ by under 1 % of pixels. |
| M | `--mobile`: steps 1, 2 and 4 | No horizontal overflow (`document.documentElement.scrollWidth ≤ 390`). The camera button and shutter button are ≥ 44 px and fully on-screen. The finder's dials don't overlap the image. |

The script fails on any `pageerror`, any 4xx/5xx request, or any `console.error` from `games/studio`.

---

## 14. Risks and fallbacks
| Risk | Likelihood | Mitigation / fallback |
|---|---|---|
| MUST is too big for one round | High | The cut order in §10. WP boundaries let one WP slip without blocking the others (mocks). The darkroom can ship with enlargements only. |
| The capture hitch is too long on phones | Medium | K drops to 8 adaptively when the last capture took more than 600 ms. Capture resolution steps 512 → 384. The hitch hides behind the advance animation. |
| No float render targets or float blending | Medium (old iOS/Android) | Ping-pong without blending in RGBA16F. If HalfFloat isn't renderable either: RGBA8 accumulation with pre-scaled weights and K ≤ 8, plus a toast-free log. |
| Rapier wasm fails to load | Low | Toys with an analytic fallback keep working (swing as an analytic pendulum, lantern, sprinkler, Dot kinematic). Grab is disabled with a note *"The yard is stiff today."* |
| Shared photochem/optics APIs differ or arrive late | High | Bridges with local implementations (§11.2). Studio never blocks on another team. |
| Rank-1 projection depth or clipping glitches | Medium | Clamp the near plane at 0.05 m. If artifacts show (test: the DoF calibration scene), fall back to the classic lens-shift (frustum shear) for untilted shots and disable tilt. |
| The upside-down ground glass confuses players | Medium | The tape note, the "Erect image" setting, and the box camera's waist-level finder (mirror only) comes first. |
| Long exposures feel slow | Medium | The time-lapse cap of 15 s real. The finder ghost shows progress. The cable release lets you play while the exposure runs. |
| IndexedDB is unavailable or over quota | Low | Memory store + toast (§8). Thumbnail downgrade at 120 prints. Catch `QuotaExceededError` and prune the oldest binder prints. |
| SwiftShader timeouts in CI | Medium | The `test` profile: K = 4, 384 px, no bloom, transitions instant. `step()` instead of real waits. |
| Determinism drift between runs | Medium | Fixed steps, seeded streams, no `Math.random` (lint rule: grep in review). Analytic particles. The poster tolerance is under 1 % of pixels. |
| Motion sickness from dollies and sway | Low | 600 ms eased dollies. Reduced motion → 200 ms fades, finder sway display ×0.3. |
| Photosensitivity (flash, safelight toggle) | Low | Flash is STRETCH and capped per art-direction §9. The darkroom light toggle ramps over 250 ms with no strobe. |
| Originality | Low | O., Q., Nightjar Photographic, Ferrous & Frame and every postcard are original. There are no real brands. Andrew's "tilt 5 degrees" appears only as physics. |
| Cross-game names change (O., Lantern Street) | Medium | All strings live in `house/copy.ts`, so renaming is a 5-minute job. |
