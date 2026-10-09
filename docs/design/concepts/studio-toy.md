# The Studio: concept through the TACTILE PHYSICS TOY lens

**Proposed title:** **Bulb House**
**Subtitle:** *a whole photography studio you can poke, throw, and develop*
(The name works three ways: Bulb mode, where the shutter stays open as long as you hold it; the safelight bulb; and a house full of light. Alternates: "Open House", "Light Lock". The slug stays `studio`.)

**One-line pitch:** a small house with a workshop, a darkroom and a back garden. Every photo is *integrated from the physics*. Shake, spin, splash and rolling-shutter lean all come from the real simulated state during the real shutter interval, and you only see the picture once you've carried the film through a revolving door and developed it.

**Design rule for this lens:** the camera is a physical object, the shutter is a physical event, and the world keeps moving while it's open. There's no "photo filter" anywhere: every artifact in a picture has a cause you can poke.

---

## 1. The house

It's a single-storey dollhouse with an open back:

```
 [ BACKYARD  - lawn, swing tree, sprinkler, paddling pool, line, mailbox, feeder ]
        |  back door (screen door, spring hinge, slaps shut)
 [ WORKSHOP ] --hall/corkboard-- [ (revolving door) DARKROOM ]
   big window onto the yard          no windows, red bulb
```

- **Overview = cutaway diorama.** On load and on **Tab** or **pinch-out**, the roof lifts off (spring-animated, 400 ms, a wooden "tock"). Drag to spin the diorama on its lazy susan. It has inertia, with ω decaying at 2.5 s⁻¹ and a ratchet tick every 15 degrees. Tap a room to dive in, with a 600 ms dolly through the doorway. The world keeps simulating in the diorama, so you can watch the tiny tire swing going from above.
- **Inside: tap-to-walk plus drag-to-look.** First-person at 1.6 m eye height, on a flat navmesh made of three rectangles and a lawn polygon. Desktop also gets WASD with mouse-look (pointer lock only after a click on "walk mode"). Tapping a workbench **sits you down**: the camera eases to a fixed station framing, and back out with a swipe down or Esc. Benches are where fine manipulation happens, and walking is how you get between benches.
- **Two hands, always visible.** The *left hand* holds whatever camera you built, on a strap, so it never gets lost. The *right hand* grabs world objects. A pocket holds up to 3 film canisters, shown as little cylinders in the HUD corner that rattle when you walk.

---

## 2. The 10-second / 1-minute / 10-minute fun

**10 seconds.** You load into the backyard at about 4 pm, already holding a chunky starter box camera. The tire swing is still moving, the sprinkler is ticking across the lawn, and three sparrows sit on the feeder. A pulsing ring on the **sun** invites you to grab it. You drag it and every shadow in the yard wheels around. The sprinkler's rainbow slides into view as the sun drops behind you (real 42 degree geometry, see 5.5). If you fling it, the day races, the sky goes amber, then indigo, and fireflies come out. Nobody has asked you to take a photo yet.

**1 minute.** You raise the camera (**right-click hold** or the big thumb button). The viewfinder has a split-prism circle that splits and rejoins as you focus. Fire: you hear *click*, a gap exactly as long as the shutter speed, then *clack*, and the sparrows **scatter at the sound**. You take another without winding the lever, and the counter doesn't move: you've made a **double exposure**. Wander inside to the workshop window, pull the blackout blind (it's a roller with spring-back: tug and it snaps up, tug-hold and it stays down) and poke it with your finger. The darkened room becomes a **camera obscura**: the backyard, swing and all, plays upside down across the far wall.

**10 minutes.** Build your own camera from junk: a biscuit tin, a **glass marble as the lens** (a Texture-dle crossover), a **gravity drop shutter**, gaffer tape over the leaks. Carry it outside at dusk, plant the tripod, hang a lantern on the **Y-string pendulum**, set Bulb, push the lantern and hold the shutter for 20 seconds. Pocket the canister, spin through the revolving darkroom door, load the reel **by feel** inside a changing bag, invert the tank, hang the strip, enlarge, slosh the tray, and watch your glowing Lissajous rosette come up out of white paper. Pin it to the hallway corkboard, or drop it in the rusty mailbox and raise the flag to export it.

---

## 3. Input mappings

| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Walk | Click floor (walk to point); WASD | Tap floor; or the left-thumb virtual stick (appears where you put your thumb) |
| Look | Drag on empty space / pointer-lock mouse | One-finger drag on empty space |
| Grab / carry | Press-hold on object 100 ms; it lifts to the right hand | Same |
| Push distance | Scroll | Second finger drag up/down |
| Rotate held | Right-drag while holding, or Q/E | Two-finger twist |
| Throw | Release while moving; velocity = pointer world velocity over the last 80 ms | Flick and release |
| Poke / push | Quick click (impulse 1.5 N·s at hit point) | Quick tap |
| Raise camera | Hold right mouse button / **C** toggles | Big thumb button bottom-right |
| Focus | Scroll while raised | Vertical drag on a focus ring strip at the right edge |
| Half-press then fire | Hold **Space** or left button = half-press (meter + AF lock); **release fires** | Press-hold shutter button = half-press; release fires. A fast stab adds jolt, like a real one. |
| Bulb | Shutter stays open while held (set dial to B) | Same; the thumb can slide onto a "lock" notch for hands-free |
| Wind on | Scroll down while raised, or **R** (ratchet ticks) | Swipe the lever at the top-right in an arc |
| Hold breath | Hold **Shift**: sway drops 70% for 4 s, then rises 150% | Second finger anywhere on screen |
| Grab the sun | Drag the sun disc (constrained to its arc); release with velocity to fling | Same |
| Overview | Tab | Pinch out |

Every grab target gets a hover/press **outline breath** (a 1.04x scale pulse at 2 Hz), so poke-ability is legible without UI text.

---

## 4. The right hand: one grab model for everything

A held object is driven toward a hand target by a capped, mass-aware spring on a Rapier rigid body:

```
F = m * ( k*(x_hand - x) - c*v )        k = 400 s^-2, c = 2*0.75*sqrt(k) = 30 s^-1
|F| <= F_max = 25 N + 2*m*g              // heavy things lag and droop: you FEEL mass
torque: same spring on orientation (k_r = 120, c_r = 18) toward the "held" pose
```

- **Weight is visible.** A 0.3 kg box camera snaps to the hand. A 3.5 kg bellows 4x5 sags 12 cm and swings like a bucket, which is why it wants a tripod.
- **Throw** = release with v = clamp(v_pointer, 12 m/s); ω inherits 0.5x the twist rate.
- **Fragile things:** glass lens elements chip when impact speed exceeds 4 m/s. A chipped lens gets a permanent flare streak in every photo it takes, which counts as a "feature".

---

## 5. Physics models

### 5.1 Hand-held camera and *shutter integration* (the core)

Camera pitch and yaw each run a damped spring toward the aim, driven by tremor:

```
I*θ'' = -k*(θ - θ_aim) - c*θ' + τ_tremor(t) + τ_breath(t) + τ_events
I = m_cam * (0.09 m)^2,   k = 4.5 N·m/rad,   ζ = 0.55
τ_tremor : band-passed noise 8–12 Hz, amplitude 2.0e-4 N·m   → σθ ≈ 0.03° · sqrt(0.5 kg / m)
τ_breath : 0.25 Hz sine, 0.12° equivalent (Shift/second finger cuts it)
τ_events : shutter press jolt  Δω = 0.5°/s · stabSpeed;  mirror slap (SLR body) Δω = 1.1°/s at t=0;
           drop shutter impact Δω = 0.8°/s at plate landing (after exposure, unless shutter is slow)
```

On a tripod the spring is replaced by stiffness k = 900 and tremor = 0, but the tripod is itself a Rapier body. Plant it on the trampoline or bump it mid-exposure and you'll see the result.

**The shutter interval is simulated, not faked.** On fire:

- **t ≤ 1/8 s:** freeze the render loop for one frame and step the *whole world* (Rapier, cloth, particles, camera spring) through t_shutter in K substeps, `K = clamp(ceil(t_shutter * 480), 1, 24)` (12 on mobile). Each substep renders the scene from the camera's actual pose into an RGBA16F accumulation target, and the result is averaged. Then the world simply continues. The shutter time really passed, so a thrown ball in the photo is exactly where the physics put it.
- **t > 1/8 s and Bulb:** accumulate one sub-render per real frame (exposure = frame * dt / t_total) while the game keeps running. **You watch the exposure happen**: the viewfinder dims, a faint ghost of the accumulating frame shows at 15% opacity, and the shutter ticker counts seconds.
- **Focal-plane shutter (rolling).** Instead of averaging, row y samples only the substeps inside its slit window: `t_open(y) = (y/H) * T_travel, t_close(y) = t_open(y) + t_shutter`, with T_travel = 1/60 s for a cloth curtain and 1/250 s for metal. The pinwheel blades bend into commas, the swinging tire leans, and a fast-thrown ball turns into an egg (the classic "race car lean" look). It's two lines of shader on data you already have.

The raw accumulated frame then goes through the shared **optics** module (DOF, vignetting, aberration; 5.3) and the **photochem** module's film response (exposure = scene luminance x t / N², spread over the H&D curve). It's stored as a **latent negative** (16-bit luminance PNG, 768 px long side desktop, 512 mobile) in IndexedDB and stays invisible until developed. The only preview is the frame counter clicking over.

### 5.2 Shutters you build (each one is a toy)

| Shutter | Physics | Feel |
|---|---|---|
| **Lens cap** | Your hand. Exposure = time between the pull and the replace gestures. | Pinhole and cyanotype cameras; "seconds" exposures |
| **Gravity drop** (Victorian guillotine) | A plate with a slot of width w falls a height h before crossing the lens: `v = sqrt(2 g h)`, `t = (w + d_ap) / v`. Lift the plate higher for a faster shutter. w = 10 mm, h = 10 cm → about 1/130 s. | Cock by dragging the plate up its rails; a ratchet holds it; *fire* = it falls with a satisfying clatter and bounce |
| **Rubber band** | Stretch x on a spring sector: `v = x * sqrt(k/m)`. More stretch, faster, but bands snap after about 40 uses. | Stretch with a drag; twang sound pitched by x |
| **Leaf** (salvaged) | Fixed 1/30 to 1/250 dial, near-silent | Quiet: the sparrows don't flee |
| **Focal-plane cloth** | Rolling (5.1); loud | Freezes action, bends spinning things |

**Sound scares wildlife.** Shutter loudness (drop 0.9, SLR mirror 1.0, cloth 0.6, leaf 0.15, pinhole 0) times 1/distance² sets the sparrows' flee trigger. Quiet cameras get closer shots. Nothing in the UI says so: you notice that the leaf shutter didn't scare them.

### 5.3 The workshop: optics you can hold

Assembly happens on an **optical rail** bench. Parts are Rapier bodies in a parts crate (rummage by dragging them out, and they tumble). Within 4 cm of a mount point a part is pulled in by `F = -k_snap * (x - x_mount)`, k_snap = 900 s⁻², then locks with a "thock", a 6 ms vibration, and a dust puff. To pull it off, drag it past 6 cm (a 0.4 N·s break-away impulse).

- **Bodies:** biscuit tin (0.2 kg), shoebox (0.15 kg, leaks everywhere), wooden box (0.6 kg), bellows standard (1.4 kg; drag the front standard and the accordion compresses with leather creak; bellows extension = focus), and "brick" SLR body (0.9 kg, adds mirror slap and a real through-the-lens finder).
- **Pinhole by needle:** hold the needle against the foil. Hole diameter grows `d = 0.15 + 0.35 * (1 - e^(-t_hold/0.9 s))` mm; pushing harder (or a long touch) adds raggedness, which becomes **diffraction star spikes** around bright points. Sharpness is optimal near `d_opt = 1.9 * sqrt(f * λ)` (0.32 mm at f = 50 mm, λ = 550 nm). The blur radius `r = max(d/2, 1.22 * λ * f / d)` is shown live on the ground glass, so you *learn* the optimum by poking.
- **The marble lens:** a glass ball, `f = n*D / (4(n-1))`. A 16 mm marble with n = 1.52 gives f = 11.7 mm: a tiny wide image with massive spherical aberration. It's rendered as a center-sharp, radially growing blur (`r_blur ∝ r_img²`) plus a 25% veiling glow. It looks dreamy and is instantly recognisable. You can roll it off the bench, and it bounces on the floor.
- **Magnifying glass** (plano-convex, f = 150 mm): chromatic fringing as an RGB radial offset of 0.6% x r.
- **Water-filled jar:** a cylindrical lens that focuses only horizontally, so you get anamorphic stretch. Tip it and the water sloshes (a 1D slosh mode) and the image wobbles in your photos.
- **Light leaks:** each body has seam segments. Tear gaffer tape off the roll (drag = length, with a ripping-noise sweep; a quick sideways flick tears it) and press it onto seams. **Torch test:** switch off the workshop lamp, wave the torch over the body, and unsealed seams glow as pinpricks through a cutaway shader. Untaped seams add `leak_i * exposure_from_sun_direction` as orange edge-flare in every frame.
- **Ground glass:** the back of any assembled camera shows the live, **upside-down** image from the shared optics renderer (thin-lens CoC `c = A*|s - s_f|/s * f/(s_f - f)`, cos⁴ vignette, the aberrations above). Hover gives a 3x loupe. **Tilt the lens on the bellows** and the focus plane swings (Scheimpflug, implemented as a CoC computed against a tilted plane).

Total camera mass feeds 5.1 directly. The workshop is where you decide how your photos will *wobble*.

### 5.4 The camera-obscura room (the capstone moment)

The workshop window has a blackout roller blind. **Poke it** to make a hole, or **drag** to tear it larger (the hole is a mask texture, with a tear sound pitched by tear speed). The room renders the backyard from the hole's position into a texture, blurs it by the pinhole model (5.3) with d = hole size, scales brightness by d², and projects it inverted onto the wall opposite. The swing swings and the sprinkler sprays, all upside down, live.

Hold the magnifying glass up to the hole and the image becomes bright but blurry on the wall, because the wall is at the wrong distance. **Carry the white easel board and walk it back and forth until it's sharp**: focusing by walking. Then clip a sheet of photo paper (or cyanotype paper) to the board and wait. The room itself is the camera. The print goes to the darkroom like any other. It's a real technique and a hugely shareable image.

### 5.5 The backyard toy box

- **The sun** is draggable along a fixed arc (the time of day, 05:30 to 21:00) with flick inertia, `ω' = -1.8 s⁻¹ * ω`. Elevation drives everything: luminance `L = L0 * max(0.015, sin(elev))^0.7`, colour temperature `K = 1900 + 4600 * sin(elev)^0.45`, and shadow length. Fling it below the horizon and night arrives: stars rotate about the pole at 15 degrees/hour of *game* time, so a 2-minute Bulb at 60x time-lapse gives **star trails**.
- **Tire swing:** a rope of 8 capsule segments with spherical joints, and a tire built from 12 capsules. L = 2.4 m → T ≈ 3.1 s. The rope creaks at each turnaround (pitch from tension). You can sit things in it.
- **Y-string (Blackburn) pendulum** from the clothesline pole: a lantern hung from a Y-shaped cord. You **drag the knot** up and down to set the ratio `Tx/Ty = sqrt(L_total / L_lower)`. Push the lantern, shoot Bulb on the tripod, and you get Lissajous light curves. Light damping (0.04 s⁻¹) makes them spiral inward, which is where the beauty is. This is the game's poster image.
- **Sprinkler:** an oscillating arm (period 8 s), 1,500 ballistic droplets (`v0 = 7 m/s`, drag 0.4 s⁻¹). **Rainbow:** a droplet is tinted if the angle between the view ray and the antisolar direction lies in [40.6°, 42.4°] (violet to red). A secondary bow is drawn at [50.2°, 53.6°], reversed, at 43% intensity, with Alexander's dark band between them. It only appears when the sun is low and behind you, so it's something you have to *find* with the sun drag.
- **Garden hose:** a verlet rope of 24 nodes with a squeezable nozzle (hold = spray; distance from your pointer sets the cone). Spray the sheets, which get heavier, darker and slap. Fill the pool. **Spray the camera:** droplets stick to the front element as little refractive lenslets that show up as soft bokeh blobs in photos. Wipe them by **rubbing** the lens (a back-and-forth drag; each pass clears 35%). That one is real, funny, and it teaches the lesson.
- **Paddling pool:** the shared virtual-pipes heightfield (96x96, 48x48 mobile) with Beer-Lambert tint and **caustics** projected onto the pool floor from sun direction. Drop the marble in and watch the rings. Shoot from above at 1/1000 to freeze a splash crown (a particle burst on impacts above 2 m/s).
- **Clothesline:** two verlet sheets (24x18), wind gusts from Perlin noise. Your developed prints can be **pegged here to dry** (they flutter), and then photographed. Photographs of photographs are welcome.
- **Pinwheel and weathervane:** `ω' = (k_w * v_wind - ω) / 0.6 s`. They're test targets for the rolling shutter.
- **Sparrows:** 5 to 9 boids that perch, hop and feed. They flee when the player is within 3 m, when a throw lands nearby, or when the shutter-noise rule (5.2) triggers. They return after 20 to 40 s. A flock bursting off the feeder at 1/500 is the hardest and best shot in the yard.
- **Rusty mailbox** on a post: the outbox. Put a print inside, close the door, raise the flag (drag; spring-back if you don't commit) and the share card / PNG export comes out. Mail sent earlier comes back next visit as a "delivered" postmark on the print.

### 5.6 The darkroom: carrying photos in

- **Revolving darkroom door:** a 3-leaf cylinder, I = 18 kg·m², damping 3 N·m·s, with a soft detent to the nearest 120 degrees when |ω| < 0.5 rad/s (clunk). It's irresistible to spin, and it's light-tight at every angle. **Prop it with the broom** and a light wedge leaks in that fogs open paper from the floor side.
- **Changing bag (loading by feel):** the screen goes nearly black, showing only two faint hand silhouettes, a woven fabric texture, sound and haptics. Pop the canister (drag the lip; a click), feel for the film end (a wiggle drag; the leader crackles), and **ratchet the reel** with alternating left-right drags (each 20 degree stroke advances 4 cm with a tick; a wrong-way stroke kinks the film, giving a crescent mark on that frame). Drop it in the tank and twist the lid shut. Lazy path: hold the "fumble" button for 6 s and it gets done, with a 20% chance of one crescent.
- **Tank inversion:** grab the tank and flip it. The liquid inside is a pendulum mode `φ'' = -(g/r) sin(φ - φ_tank) - 1.5 φ'`, agitation `a = |φ'|`. Development uses the shared photochem boundary layer (`dc/dt = -0.4 dp/dt + m*a*(c_bulk - c)`). Under-agitating gives streaks; over-agitating (a > 6 rad/s sustained) gives **surge marks** by the sprocket holes. Your hands warm the tank by +0.4 C/min of holding, which speeds development (`k *= 2^((T-20)/10)`).
- **Film line:** the negative strip hangs from a peg as a ribbon verlet that swings and curls. A weighted clip on the bottom straightens it. Hold it to the light box and see the *negatives* for the first time, inverted.
- **Enlarger + trays:** these come straight from the Darkroom game's shared modules: enlarger, hand-shadow dodging, sloshing trays, autocatalytic development. Contact-sheet shortcut: lay the strip on paper, drop the glass sheet on top (a Rapier fall with a "clink"), flick the light.

---

## 6. Juice

| Event | Sound (all WebAudio-synthesized) | Visual / haptic |
|---|---|---|
| Fire shutter | Two transient clicks (noise burst through a 3 kHz resonator) **separated by the real shutter time** | Viewfinder blackout for the exposure; vibrate(12) |
| Wind lever | Ratchet tick per 12° of drag, a final "thunk" at stop | Counter digit rolls like an odometer |
| Snap part on | Low "thock" (120 Hz sine, 40 ms) plus a felt-dampened click | Dust puff (40 particles); vibrate(6) |
| Bellows | Leather creak = filtered noise, rate tied to extension velocity | Folds compress/fan |
| Tape tear | Noise sweep 800 Hz to 4 kHz over the drag length | Ragged tape edge mesh |
| Sun drag | A soft airy pad whose filter cutoff follows elevation; birdsong fades at dusk, crickets come in | Long shadows sweep; dust motes in the workshop sunbeam re-aim |
| Swing | Rope creak at turnarounds | — |
| Sparrows flee | 12 FM chirps staggered over 300 ms, plus a wing-flutter noise | Feathers (3 particles) |
| Revolving door | Rubber seal squeak, detent clunk | — |
| Tank inversion | Liquid glug (pitch from φ') | Bubbles behind the tank window |
| Print appears in tray | Subtle rising chord as density passes 50% of target | Shadows bloom out of white |

Global juice rules: every grab has a 1.04x squash on pickup; every drop has an impact sound with volume ∝ impulse and pitch ∝ 1/sqrt(mass); nothing silently teleports.

---

## 7. Accidents worth keeping (all emergent, none scripted)

- **Double exposure:** fire without winding. The second accumulation adds onto the same latent frame. It's the most common first "wow".
- **Opening the back in daylight:** fog creeps in from the opening edge, `E += I_sun * opening_angle * (1 - x/W)`. You get orange edge-burn on the last 3 frames, which is a lovely look.
- **Rolling-shutter lean, chipped-lens flare, wet-lens bokeh, marble glow, Lissajous rosettes, star trails, surge marks, reel-kink crescents.**
- **Recursive photos:** pegged prints, photographed, developed, pegged again.

The corkboard gallery in the hallway auto-tags prints by what caused them: *"Forgot to wind." "Shot through a marble." "The sun was dragged."*

---

## 8. Scope cut line (for a 2–4 agent team)

**Must ship (MVP):** cutaway overview with room dive-in; tap-to-walk; the grab model; one starter camera plus 3 workshop presets (pinhole tin, marble box, bellows) built with snap assembly; shutter integration (substep path plus Bulb path); latent film saved to IndexedDB; the sun drag; tire swing, sprinkler with rainbow, Y-pendulum lantern and sparrows; the revolving door; tank inversion; contact sheet and enlarger reusing the Darkroom game's modules; corkboard; mailbox export.
**Should:** focal-plane rolling shutter, pinhole needle, camera obscura room, hose and wet lens, pool caustics, clothesline prints.
**Stretch:** changing-bag feel loading, light-leak torch test, tilt-shift, star trails, jar lens.

## 9. Performance, fallback, test API

Rapier with at most 120 awake bodies (sleeping enabled), a 1024 shadow map on mobile, particles halved, and K ≤ 12. Without WebGL2: a 2D cutaway illustration with a Canvas2D pinhole-and-sun toy (drag the sun, poke the hole, watch the inverted image), plus a note.

`window.__game = { ready, room(), goto('yard'|'workshop'|'darkroom'|'overview'), setSun(hours), build(preset), shoot({shutter, aperture, bulbSeconds}), wind(), developAll(), photos(), step(n), pause(), seed(n) }`. Physics and noise are seeded so screenshots are deterministic.

## 10. Why it gets shared

Three images do the work: a **glowing Lissajous rosette** made by pushing a lantern, an **upside-down backyard filling a dark room**, and a **wobbly marble-lens photo of a tire swing with a sprinkler rainbow**. Each one is unmistakably *made by physics*, each one took your hands to make, and each one existed only as a secret on a film roll until you sloshed it out of a tray.
