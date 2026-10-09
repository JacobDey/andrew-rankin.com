# LATENT IMAGE: the tactile-toy pass

*Game 4, slug `latent`. Concept through the **tactile physics toy** lens.*

**Title:** LATENT IMAGE
**Subtitle:** *Case 71-114: the Quill exposures*
**Tagline (hub card):** *Nothing is evidence until you develop it.*

---

## 0. Thesis

Barlow's games are a search box and a pile of fragments. Obra Dinn is a 1-bit world you study until it gives in. LATENT IMAGE swaps every abstract UI verb in both for a **hand verb with physics behind it**:

| Genre verb | Our verb |
|---|---|
| Type a search query | **Emboss** a label-maker tape, feed it into a **pneumatic tube**, catch the canister, **twist** it open |
| "Show 5 results" | The canister **physically holds five things**. More results stay in Records. |
| Watch a clip | **Develop** a print. The image blooms in dither while you rock the tray. |
| Enhance! | **Raise the enlarger head, focus, dodge with your hand, burn through a card.** Grain and inverse-square light set the limits. |
| Note a keyword | **Circle it with a grease pencil** |
| Arrange a timeline | **Peg prints onto a sagging drying line** and slide them into order |
| Make the final choice | Push the envelope into the **tube to the DA**, or swing open the **furnace hatch** |

The tactile rule: **every clue in the case is gated by a darkroom technique, never by a puzzle UI.** If you can read it, it's because your hands got it out of the silver.

---

## 1. The bench (spatial layout)

The game is one long bench, seen from a fixed 3/4 orthographic camera. You pan left to right like reading a sentence, and the workflow runs the same way:

`RECORDS TUBE → CHANGING BAG + TANK → LIGHTBOX → ENLARGER → TRAYS (DEV · STOP · FIX) → DRYING LINE → FURNACE HATCH`

- **Pan:** drag empty background (inertial, friction 4/s), mouse wheel / trackpad horizontal, `A`/`D` or arrows, or tap one of the 1-bit station glyphs on a bottom rail. Each station has a soft snap point (spring k=40, ζ=0.9).
- **Render:** Three.js grayscale scene, then a single full-screen post pass that does 8×8 Bayer + blue-noise hybrid thresholding to **1 bit**. There are two palettes:
  - **SAFELIGHT** (lights off): `#140302` / `#d8432b`. Everything you do with paper happens in this palette.
  - **ROOM LIGHT** (lights on): `#121110` / `#efe9dc`. Lightbox, reading, arranging. This palette fogs any unfixed paper.
- Shadows come from the single swinging safelight (one shadow map, 1024²). In 1-bit dither, swinging shadows sweep across the bench like a lighthouse. It's the prettiest cheap thing in the game.

---

## 2. The toys

### 2.1 Pull-chain light switch (the first thing you touch)

The page loads **black**, apart from a dangling pull-chain and one word: `PULL`.

- **Model:** a 12-bead Verlet chain, link length 2.2 cm, gravity 9.81, 8 constraint iterations, damping 0.995. The top bead is pinned to the lamp housing.
- **Toggle:** grab any bead (mouse down / touch within 24 px). If the bottom bead goes **more than 5 cm below rest for more than 40 ms**, it toggles: a heavy *CLUNK*, then a 300 ms latch. Let go and the chain whips back and jangles. A clink sound plays whenever |v| of any bead crosses 0.6 m/s near the housing.
- **Safelight pendulum:** the lamp hangs on a cord, θ'' = −(g/L)·sin θ − c·θ', with L = 0.6 m and c = 0.25. A flick gives it a 1.55 s period. Tap or flick the lamp and every shadow on the bench sweeps.
- **Stakes = juice:** room light ON while any sheet has fixedness F < 1 adds fog: **dD/dt = 6·(1−F)** on every texel. The sheet goes black in about 0.2 s and plays a falling, low-passed hiss (white noise, LPF sweeping 6 kHz → 300 Hz over 0.6 s). It's the "oh no" moment, and players will do it on purpose once just to hear it. Ruined sheets can be crumpled (double-click / double-tap → the sheet becomes a crumpled-paper rigid body you can throw at the bin, with a soft paper *thup*).

### 2.2 Records: label maker + pneumatic tube (the search engine)

**Label maker (the query):**
- A chunky embossing wheel with 37 detents (A–Z, 0–9, `-`), 9.73° each. **Drag in a circle** (mouse or one finger) or **scroll the wheel** to rotate. Each detent gives a tick (2 ms click, band-passed 3.2 kHz). **Click the trigger / tap the handle** to emboss: *CHUNK* (low thump + plastic snap), and the tape advances 6 mm while the raised letter bulges white in the dither.
- **Fast path:** on desktop, typing on a physical keyboard spins the wheel to each letter automatically (a whirr, 80 ms/letter), so typists aren't slowed down. On touch, tapping the tape focuses a hidden `<input>` so the OS keyboard drives the same animation.
- **Cut lever:** pull down to snip. The strip flutters off: a 2D rigid body with high air drag (Cd·A tuned for a 1.2 s fall) and a slight tumble torque.
- **Query grammar:** one word, or two separated by a space (AND). 14 characters max, which is the tape length, so the limit is physical.

**Pneumatic tube (the results):**
- Drag the tape into the brass slot. It gets sucked in with a rising noise-sweep *FWOOOMP* (bandpass noise, center 400 Hz → 2 kHz, 0.5 s).
- After a 1.2–2.0 s round trip (a distant rattle pans left to right in stereo), a **canister** shoots down the return tube along a Bézier path. It hits the catch tray with restitution 0.35, spins and settles. Thunk volume scales with impact speed.
- **Twist open:** accumulate rotation ≥ 200° counter-clockwise (circular mouse drag, two-finger rotate on touch, or `Q` held). The cap pops on a spring and the contents **slide out onto the desk as Rapier rigid bodies**: film cassettes (cylinders that *roll*), negative sleeves, contact sheets, and typed case cards on onion-skin (witness statements, coroner notes, property logs).
- **Five-item cap:** the canister holds 5 items, sorted by accession number (oldest first). If there are more matches, the clerk's typed slip says `+7 MORE IN STACKS — BE SPECIFIC`. This is Her Story's result limit made physical.
- **Clerk personality:** ask for the same thing three times and the slip reads `AGAIN, TECH?` A word with no matches sends the canister back empty, rattling one paperclip.
- **Flicking:** release velocity = mean pointer velocity over the last 80 ms, clamped to 3 m/s. Cassettes roll and *clack* into the lightbox frame. Cards slide with μ = 0.4.

### 2.3 Changing bag (loading film blind)

Developing a roll starts with loading it onto a spiral reel **in total darkness**. The screen goes fully black except for two faint sleeve outlines. You play by sound and touch alone.

1. **Pry the cassette** with a bottle-opener lever (it pops at 30°, *tink*), then **pull the leader** out in drag strokes (film hiss).
2. **Ratchet onto the reel:** the two reel halves are twisted back and forth alternately. Desktop: alternate `←`/`→` (or drag up/down on the left and right halves of the screen). Touch: alternating left and right thumb swipes. Each good stroke advances 4 cm with a soft *zip-tick*.
3. **Rhythm model:** a stroke is clean if it alternates sides and the interval is 220–650 ms. A same-side double stroke or an interval under 150 ms gives a **kink chance p = 0.3**: a sharp crackle, plus a 120 ms `navigator.vibrate` on Android. Each kink is stamped as a **crescent mark** on the negative frame at that film position.
4. **Lid on:** twist the tank lid until it clicks. Now the lights can come on safely.

Kinks never cost a clue, because clue regions avoid kink-prone positions. But they set up the best clue in the game (§4, clue 6). After the first roll, a "Records pre-loaded this one" option skips the bag.

### 2.4 Developing tank (inversion agitation)

Drag the tank up and over: it follows the pointer around a base hinge (k=30, ζ=0.7). An inversion is ≥150° and back within 0.8–4 s, and plays a *glug* (3–6 sine bubble pops, 120–260 Hz). Time is compressed so 1 game-minute = 6 s, and the masking-tape recipe says `DEV 8 MIN · 4 INV / 30 S`. Agitation only shifts the negative's contrast γ_neg (0.55–0.75). Too few inversions leaves faint **bromide-drag streaks**, which are flavour, not failure.

### 2.5 Lightbox, loupe, grease pencil (noticing)

- Negatives lie on a glowing panel, **tonally inverted**.
- **Loupe:** a draggable glass disc with inertia (velocity lerp 0.25/frame), 4× magnification, barrel distortion r' = r(1 + 0.15r²). On touch it sits 60 px above your finger so the finger doesn't hide it.
- **Scissors:** drag across a strip between frames to cut it (*snip*: two noise bursts 40 ms apart). The cut piece becomes its own rigid body.
- **Grease pencil:** hold `Shift`/right-drag, or pick up the pencil and draw. The stroke renders as thick waxy dithered black. **Squeak sound:** band-passed noise at 2–4 kHz, amplitude ∝ pen speed, centre frequency jittering ±8%.
  - **Circling:** a closed loop (end within 20 px of start, or a self-intersection) that encloses ≥ 60% of a hidden word hotspot's bounding box marks the word as *noticed*. It's written in the margin in grease-pencil handwriting (a procedural glyph-wobble font) and can be **dragged straight onto the label maker** to auto-emboss.
  - There's no highlight and no glow on unnoticed hotspots. The player has to see the word first. Circling nothing just leaves a mark.
  - Typing a word you merely *suspect* also works. The circle is only a shortcut.

### 2.6 The enlarger ("enhance" with real optics)

This is the tool for actually reading the evidence. Every clue limit comes from optics:

- **Column height:** drag the head's handle up or down. It's counterweighted, with mass feel 4 kg and a friction lock on release. **Magnification M = 1.5× – 12×**, and the projected crop of the negative shrinks as M grows. Drag the easel to choose which part of the frame is projected.
- **Focus knob:** rotate (circular drag, wheel, two-finger rotate). Blur radius r_blur = 9 px · |φ − φ*(M)|, where φ*(M) moves as you change height, so you have to refocus after zooming, like the real thing. The **grain focuser** is a small periscope you can set on the easel: its view shows the negative's grain at 20×, and grain only "snaps" crisp at exact focus. A soft tick plays at |φ − φ*| < 0.02. That one isn't realistic; it's there for satisfaction.
- **Inverse-square light:** easel irradiance I = I₀ / M². Bigger enlargements need longer exposures. The game teaches this without saying anything.
- **Grain ceiling:** the negative has a fixed grain field in *negative* space (clumped noise, ~6 µm). Past each clue's designed M, grain clumps get bigger than the dither cell and the text dissolves into static. So "enhance" has a physical maximum, and you find it by pushing past it.
- **Contrast filters:** a drawer of six filter cards (grades 0–5). Drag one into the filter slot (*clunk*). It sets paper γ from 0.8 to 2.6.
- **Exposure:** twist the timer dial (detent per second, 1–60 s). Press `Space`, or press and hold the big foot-switch button, to expose. The lamp hum is 60 Hz plus the 120/180 Hz harmonics at low gain, and the timer ticks once per second.
- **Dodging (your hand):** while the lamp is on, holding the pointer over the easel puts a **hand or dodging wand** (a wire with a cardboard disc) into the light. Wheel or pinch moves it up and down between lens and paper (z from 0.05 H to 0.6 H). It casts a shadow with **penumbra width w = d_src · z / (H − z)**, so raising your hand softens the edge. **Wiggling feathers the edge**: the exposure integrates over time, so the real darkroom technique just works.
- **Burning:** right-click / long-press swaps to a **card with a hole**. Only a disc of light gets through, so you add exposure locally.
- **Exposure integral (per texel, GPU ping-pong, half-float 512²):**
  `E(x) += (I₀/M²) · T_neg(x) · (1 − S(x,t)) · dt`
  where T_neg is the negative's transmittance (thin negative = more light) and S is the hand or card occlusion mask.
- **Paper response (latent target):** `D*(x) = (1 − exp(−E/E₀))^γ`, where E₀ is chosen so the correct base exposure is about 8 s at M=4. Nothing shows yet. The image is latent until development.

### 2.7 The trays (slosh, bloom, drip)

Three trays (DEV, STOP, FIX) plus a wash sink. This is where the toy becomes irresistible.

**Fluid: virtual-pipe shallow water** (O'Brien–Hodgins style), one grid per tray:
- Grid 40×28 cells, cell size l = 1 cm (a 40×28 cm tray), rest depth 1.5 cm, lip height 3.5 cm, 4 substeps/frame (dt = 1/240 s).
- Pipe flux: `f_ij ← max(0, 0.998·f_ij + dt · A · g · Δη_ij / l)`, where η = h + b and A = l². The bed height b = x·tan θx + y·tan θy comes from **tray tilt**. Scale outflow so it never exceeds cell volume, then update h. Velocity u comes from the net flux.
- Wave speed c = √(gh) ≈ 0.38 m/s. **Fundamental slosh mode f₁ = c / 2L ≈ 0.47 Hz.** Rock at about one bump every 2.1 s and the wave **builds by resonance**. Players will find this, chase it, and eventually **spill**: cells at the lip with η > lip height emit droplet particles and lose volume, and a dithered puddle stain grows on the bench. Spilled developer is permanent bench decor.
- **Tilt input:** grab the tray's near lip. Vertical drag pitches it and horizontal drag rolls it, ±8°. On release it springs back critically damped (ω = 8 rad/s) with a ceramic *tok* when it lands. On touch, the same one-finger drag on the lip; an optional **"tilt with phone"** toggle uses DeviceOrientation (with the iOS `requestPermission` flow), low-pass filtered with α = 0.15.
- **Slosh sound:** bandpass noise (300–900 Hz) whose gain follows total fluid kinetic energy Σ½h|u|², plus a lap transient whenever the edge-cell η derivative changes sign above a threshold.

**Development (per texel, GPU):**
- `dD/dt = k · C(x) · wet(x) · A(x) · (D* − D)`, with k = 0.12 /s (real time).
- `wet(x)` = 1 if the fluid depth over that point of the paper is > 0.5 mm. **Unevenly covered paper develops unevenly**, so a corner that pokes out of the developer stays pale.
- `A(x) = 1 + 0.8 · min(|u(x)| / 0.1, 1)`. Agitation literally speeds up development where liquid moves.
- `C(x)` is local developer activity: `dC/dt = −0.4 · dD/dt + mixing`. Mixing is simply advection by the fluid grid, so a still tray makes faint **bromide drag** streaks below dense areas, and rocking erases them.
- **Order of appearance:** dense (dark) areas cross the dither threshold first and subtle light tones last. Detail you rescued by dodging blooms in the final seconds. Pull the print early and it isn't there. This is the heartbeat moment.
- **STOP** sets k → 0 within 0.5 s (a sour fizz). **FIX** raises F → 1 over 30 s. Until F = 1, room light is lethal (§2.1).

**Paper & tongs:**
- On contact, the paper is a 2D rigid body in the tray plane, dragged by the fluid: `F = 0.6 · (u_fluid − v_paper)` averaged over the covered cells. It drifts with your rocking.
- **Tongs:** press within 2 cm of a sheet edge to grab (*clack*: noise burst through a resonant BPF at 1.8 kHz, Q 8). Lifted out, the sheet becomes an **11×9 PBD cloth**: gravity, 4 iterations, bending stiffness 0.3, and wet mass ×1.4 so wet prints sag more.
- **Drips:** droplet emission rate λ = 6·w drops/s from the lowest cloth nodes. Wetness w decays at 0.15/s out of liquid. A drip falling into a tray injects a height impulse (a little ring) and a pitched *plip* (sine 900 → 500 Hz over 60 ms, random ±15%).
- **Drop it in:** releasing over a tray slaps the sheet down with a splash impulse proportional to fall speed. Tossing prints from tray to tray is satisfying and messy, which is right.

### 2.8 The drying line (the evidence board)

A **Verlet rope** of 40 nodes across 2.4 m. Prints hang from **clothespins** that slide along the rope parameter s with 1D collisions (minimum spacing = print width), so dragging one print shoves its neighbours. Prints swing as pendulums, and a flick ripples the whole line. **Catenary sag grows with the weight hung**: the more evidence you pin up, the more the line droops. Drop a print near the line and the pin snaps on (*tick-sprong*). **Left-to-right order is your timeline.** The deduction rules belong to the other lenses; this lens only makes arranging fun to do.

### 2.9 The ending: tube or furnace

The final evidence goes into a manila envelope you seal with a string-and-button closure (wind it with a circular drag: rope friction sound, 3 turns). Then you choose with your body:
- **Feed it into the pneumatic tube**, addressed `DISTRICT ATTORNEY`. Same *FWOOOMP*, and this time nothing comes back.
- **Or swing open the furnace hatch.** It's a heavy Rapier hinge with a damped closing spring. Fling it wide and it creaks shut over about 1.5 s, so you have one deliberate window to drag the envelope in. On touch, you can also hold it open with one finger and feed the envelope with another. A roar of low noise plays and the dither flickers orange-white at the room edges. If you hesitate, it slams shut (*BANG*, with a dust puff) and you have to open it again.
There's no menu. The verb is the vote.

---

## 3. Input mapping

| Verb | Mouse / keyboard | Touch |
|---|---|---|
| Pan bench | Drag background, wheel, A/D, ←/→ | One-finger drag on background, station rail |
| Grab / carry / throw | LMB drag, release to throw | Drag, release to throw |
| Tongs on paper | LMB near edge | Touch near edge (24 px slop) |
| Tilt tray | Drag tray lip | Drag tray lip, or phone tilt (opt-in) |
| Twist (canister, focus, reel, lid) | Circular drag, wheel, Q/E | Circular drag or two-finger rotate |
| Emboss / type | Type on keyboard; click trigger | Tap tape → OS keyboard; tap handle |
| Grease pencil | Shift + drag, or right-drag | Pick up pencil, then drag; 2-finger tap to drop it |
| Dodge height | Wheel | Pinch |
| Dodge ↔ burn | Right-click | Long-press 350 ms |
| Expose | Space (tap = timer, hold = manual) | Big foot-switch button |
| Lights | Drag chain; `L` = a yank animation | Drag chain |

Accessibility: a **"steady hands"** toggle (auto-agitate trays, skip the changing bag, loupe snaps to hotspots without giving them away), and a **reduced motion** toggle (no swing, no screen-space flicker).

---

## 4. The story, told through technique

**Setting:** Kessick Harbor, a fictional fishing town, the night of **11–12 March 1979**. You're the **night technician of the County Photographic Unit**. Evidence from closed cases older than seven years is incinerated at **06:00**. One box is on your bench: **Case 71-114**, the death of **Teodor Quill**, a pharmacist and obsessive amateur photographer. He was found in November 1971 in his locked basement darkroom, poisoned. The coroner ruled it an **accident with a cyanide-based intensifier** (an old photographic formula, and a wink at Andrew's "cyanide chemistry"). The detective of record, **Det. Sgt. Ruth Ambler**, logged **eleven rolls** from his darkroom as `UNDEVELOPED — NOT RELEVANT`, plus a twelfth that was already developed, and for some reason never let any of them be destroyed. Other names on the case: **Linus Petch** (Quill's shop assistant and a witness) and **Nell Quill** (his widow).

**What Quill was doing:** shooting the harbour from his upstairs window at exactly 2 a.m., every night, for a series he called *The Same Hour*. Without meaning to, he photographed **Pier 4** night after night, including the trawler ***Esther May*** unloading things that weren't fish, and a man there, **Cal Ambler**: Ruth's brother.

**Ambiguity (the Barlow part):** the evidence supports two readings. In one, Ruth killed Quill to protect Cal. In the other, she arrived after Cal did it, staged the accident, and has spent eight years keeping the rolls because she couldn't bring herself to burn them. The player's drying-line order and final verb are their verdict. The game never says which reading is right.

**Clue chain, each gated by a technique:**

| # | Keyword unlocked | Where it hides | Technique required |
|---|---|---|---|
| 1 | `QUILL` | Shop sign in the tutorial print | Just develop it, and rock the tray |
| 2 | `ESTHER MAY` | Hull lettering, far side of the harbour | Enlarge to 6–8×, **refocus** (illegible at 10×+: grain ceiling) |
| 3 | `KH-3118` | A plate washed out by headlight glare | **Burn in** the plate +7 s through the card |
| 4 | `PETCH` | A figure in a black doorway (the shop assistant, a witness who lied) | **Dodge** the doorway ~40% with your hand, then **don't pull early**. The face blooms last. |
| 5 | `0207` | Clock-tower hands in the background of the "accident night" frame | Enlarge the crop, use the grain focuser, and read the hands: 2:07, *after* Quill's stated time of death |
| 6 | `AMBLER` (Ruth) | **Roll 12**, the already-developed roll, covered in **crescent kink marks**. Quill's own log (a case card) says *"30 years, never kinked a roll."* | **Your hands already know.** You've made those crescents yourself in the changing bag. Someone panicked loading film in Quill's dark. Search `KINK` or `LOADED` and Records returns Ambler's own darkroom-training certificate, dated 1970: *"marginal — poor reel technique."* |

Clue 6 is the lens's centrepiece. **The player's physical clumsiness becomes evidence.** You recognise a stranger's mistakes because you made them.

---

## 5. The 10-second / 1-minute / 10-minute fun

- **10 seconds:** black screen, `PULL`. You yank the chain: *CLUNK*, and the red dithered room snaps in while the safelight swings its shadows across everything. Immediately: *FWOOOMP… rattle… THUNK*. A canister lands. You twist it, the cap pops, and a film cassette rolls across the bench and clacks into the lightbox. You haven't read a word yet and you're already playing.
- **1 minute:** the tutorial print (pre-exposed) goes into the developer with a slap. You rock the tray, find the resonance, and the wave climbs the far wall. The storefront blooms out of red static: `QUILL — DISPENSING CHEMIST`. You circle `QUILL` with a squeaky grease pencil, drag the word onto the label maker (*whirr-CHUNK* ×5), snip the tape and feed the tube. Five things come back, and one is a coroner's card that says *intensifier*.
- **10 minutes:** you load a roll blind and kink it twice. Then: inversions, the negatives on the lightbox, the loupe gliding over a black doorway, the enlarger raised to 6× and refocused with the grain focuser. Hand under the lamp, wiggling, 40% dodge on the doorway. Into the tray: rock, rock. The whole print is there and the doorway is still black. You hold your nerve. At 50 seconds, a face appears. You pull it with the tongs, it drips, and you peg it on the line. That's the moment people share.

---

## 6. Build notes (for the team)

- **Perf budget (mid phone):** fluid on the CPU (3 grids × 1,120 cells × 4 substeps, about 0.3 ms). Development and exposure on the GPU (two 512² half-float ping-pong targets per active sheet, max 3 active sheets). Paper cloth 99 nodes. Rapier only on the desk plane (≤ 40 bodies, sleeping on). One shadow map. One dither post pass. Target 60 fps desktop, 45+ on a mid-range phone.
- **Fallbacks:** with no float render targets, develop on the CPU at 256² in Uint8 (fine for a 1-bit display). With no WebGL2, a Canvas2D sprite renderer of the same bench, with the fluid shown as a heightmap shimmer.
- **Saves:** IndexedDB. Each print is a **1-bit bitmap** (512² = 32 KB) plus its exposure recipe. Saves also hold the line order, noticed words, kink positions, spill stains and the clock. Three slots are **evidence-locker drawers**: pull a handle to save or load (*roll-clank*).
- **Content:** every case photo is a procedural low-poly Three.js diorama rendered offscreen to a grayscale negative with grain. Clue words are canvas-font text in the diorama textures, each with a hotspot rect in negative space.
- **`window.__game` API:** `state()`, `pan(station)`, `pullChain()`, `search(words) → Promise<items[]>`, `openCanister()`, `setTilt(tx, ty)`, `rock(seconds)`, `expose({frame, M, focus, seconds, dodge?:[x,y,r,frac], burn?:[x,y,r,sec]})`, `develop(seconds)`, `fix()`, `hang(printId, s)`, `notice(word)`, `seed(n)`, `skipToClue(k)`, `lights(on)`. Every physics sim takes a seeded RNG so screenshots are deterministic under SwiftShader.

## 7. Cut order if time runs short

1. Furnace hinge (the ending falls back to two trays labeled DA and BURN).
2. Phone tilt.
3. Tank inversions (auto-agitate).
4. Changing bag (pre-loaded). **But keep kink marks on Roll 12 and the training-certificate card, and keep the changing bag as an optional "try it yourself" bench toy so clue 6 still lands.**
5. Never cut: the pull-chain, the pneumatic canister, tray slosh with resonance, the dodging hand, the grease pencil circle.
