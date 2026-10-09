# Texturedle: Game Design Concept

**Lens:** game design (loop, progression, onboarding, scoring, pacing)
**Slug:** `texturedle` · `/games/texturedle/`

## Title

**TEXTUREDLE**: *One surface a day, much too close.*

Alternate subtitles: "Touch first. Guess later." / "What is your finger on?"

The look: museum specimen meets microscope. Each daily puzzle is a **specimen**, the zoom levels are **objectives** on a brass nosepiece turret, a **scale bar** like the ones on micrographs sits in the corner, and the finished surfaces go into a **Cabinet** of glass-topped drawers.

---

## 1. The one-sentence game

You get six guesses to name a real-world surface you are seeing at 40× magnification. You can touch it as much as you like with a marble, a silk cloth and a burlap cloth, and you can rock the stage ±5°. Every wrong guess turns the turret to a lower objective (40× → 20× → 10× → 4× → 2× → 1×), so more of the surface comes into view. When you solve it, or run out, the camera pulls all the way back to show the object in a small scene.

**The design principle: guesses cost you something, touching never does.** The toy stays free and unlimited, and the scarce resource is your nerve to commit to an answer.

---

## 2. Core loop (one daily, about 3–6 minutes)

1. **Land.** There is no menu. The page opens on the stage at 40×, already live, rocking very slowly so the raking light rolls across the relief. The marble and the two cloths sit in a tray beside the stage.
2. **Probe.** Tilt, roll, wipe, scrub. Each tool tells you about a different physical property (§3). Everything you find is written into the **Field Notes** automatically, in plain words.
3. **Guess.** Type into an autocomplete box, or tap through the Cabinet drawers on a phone. A guess fills in a row of **five feedback tiles** (§4).
4. **Turn the turret.** A miss rotates the nosepiece with a heavy brass *clunk*, and the lens breathes in and out of focus as it settles. The scale bar redraws (`1 mm` becomes `2 mm`) and the view widens. New structure shows up, and the probes behave differently at the new scale. **Failing gives you more to play with.**
5. **Reveal.** On a solve, or after the sixth miss, the camera pulls back for 3–4 seconds through the remaining objectives to a small diorama of the object (a mailbox on a post at dusk), and a shutter click freezes the frame. A museum-label **Field Card** then slides in with the name, the **Tell** (the giveaway clue), the Secret if you found it, and a two-line wall-label caption.
6. **Keep touching.** The specimen goes into your Cabinet and stays playable as a toy forever.

---

## 3. The probes: each sense answers a different question

The toy turns into a game when every tool tells you something the others can't. The material recipes have to be written so that this is true.

| Probe | Input | What it reveals | Physical params it reads |
|---|---|---|---|
| **Tilt (±5°)** | Gyro on phones (opt-in toggle), two-finger drag, right-drag, or arrow keys on desktop | Relief depth (shadows lengthen), gloss vs. matte (the highlight slides), anisotropy (brushed metal streaks), wet vs. dry | height amplitude, roughness, anisotropy, wetness |
| **Marble** | Drag it out of the tray and drop it. It rolls down the tilt. | Friction (glides or crawls), bumpiness (rattle, and the sound pitch follows the roughness spectrum), pits and channels (where it settles), give (dents, sinks, bounces), curvature (*drifts even when the stage is flat*) | μ, restitution, hardness/deformability, curvature, gravity sign |
| **Silk** (fine cloth) | Drag to wipe | Fine-scale friction (glides or drags), **residue** (the swatch picks up color: rust orange, indigo, chalk white, citrus oil sheen), polishing (leather buffs to a shine, dust wipes off) | microfriction, residue color/amount, polishability |
| **Burlap** (rough cloth) | Drag to scrub | **Snags** (the cloth catches, stretches, then springs free with a *zip* and leaves lint behind), **abrasion** (flaking layers lift off to show what's underneath), nap reversal (velvet and corduroy keep the strokes) | snag threshold, abradable layer stack, nap |

The cloths are swatches tied to your pointer by a spring, not full cloth simulations. **Drag lag is the feedback:** on glass the swatch keeps up with your finger, and on burlap-against-bark it trails behind and jerks. On Android, snags and marble rattle also trigger `navigator.vibrate` pulses.

**Field Notes play the role of Wordle's keyboard.** They are the record of what you already know. Entries come from the recipe parameters using fixed thresholds, so they are the same for every player:

> Marble: rattles, then stops in pits · Drifts toward the left edge even when level
> Silk: comes away **orange-brown, powdery**
> Burlap: snags · **green flakes lift → red layer → grey metal**
> Tilt: dull sheen; bare spots glint

The notes describe and never name, and they teach the vocabulary you need to reason with. They also make the game playable by ear: notes plus synthesized audio carry nearly the whole puzzle, which is an accessibility bonus.

---

## 4. Guessing and feedback: five tiles, like five letters

All valid guesses come from the **Atlas**, a list of about 300 surfaces. Each Atlas entry has five attributes, and those five attributes are the tiles:

| Tile | Values | Yellow means |
|---|---|---|
| **Family** | Metal · Wood & Bark · Stone & Ceramic · Textile · Hide & Hair · Polymer · Paper & Card · Plant & Food | sibling family (Metal↔Stone "mineral", Textile↔Hide "fiber", Wood↔Paper "plant-made", Plant&Food↔Wood "grown") |
| **Habitat** | Kitchen & Pantry · Wardrobe · Home · Workshop · Street & Yard · Wild · Play & Sport · Creature | adjacent habitat on a fixed graph (Kitchen–Home, Street–Workshop, Street–Wild, Wild–Creature, Wardrobe–Home, Play–Home) |
| **Hardness** ↑↓ | 1 Fluffy · 2 Soft · 3 Yielding · 4 Firm · 5 Hard | one step off (an arrow shows which way) |
| **Grain** ↑↓ | 1 Glassy · 2 Fine · 3 Medium · 4 Coarse · 5 Craggy | one step off |
| **Wear** ↑↓ | 1 New · 2 Used · 3 Worn · 4 Weathered · 5 Ruined | one step off |

**The Atlas uniqueness rule (enforced by a lint):** no two Atlas entries may share all five values, so five green tiles always means you have solved it. If two nouns collide (say "rusty mailbox" and "rusty bin"), they are merged into one specimen and both nouns are accepted. *We grade the surface, not the noun.* Aliases are accepted generously ("mail box", "letterbox", "post box").

**Narrowing:** each guess's arrows tighten brackets on the Hardness, Grain and Wear sliders in the Field Notes, the way Globle narrows. Cabinet drawers that can't contain the answer any more grey out and close (*easy mode on by default*; Hard Mode turns this off).

**Phone input:** typing is a pain on phones, so the guess button opens the **Cabinet browser**: tap Family, then Habitat, then pick a specimen. Because it is the same tree the feedback uses, browsing it teaches the system.

### Worked example: Specimen #1, Rusty Mailbox
Atlas values: Metal · Street & Yard · Hard(5) · Coarse(4) · Weathered(4).

```
#1 BRICK          ⬛Stone🟨  🟩Street  🟩Hard  🟩Coarse  🟨Worn ↑      → turret to 20×
#2 RUSTY CAR DOOR 🟩Metal   🟨Workshop 🟩Hard  🟨Medium↑ 🟩Weathered   → turret to 10×
#3 RUSTY MAILBOX  🟩🟩🟩🟩🟩  "Solved at 10×"
```
(Stone shows yellow for Family because Stone and Metal are mineral siblings.)

---

## 5. Specimen #1 in detail: the Rusty Mailbox

This is Andrew's opening puzzle, so it has to be the best one. The recipe is a layer stack, and every layer has a gameplay job:

1. **Steel substrate** (grey, fine rolling marks). It glints when tilt exposes it.
2. **Red-oxide primer.**
3. **Faded green enamel** (chalky, dull sheen).
4. **Rust blisters:** raised domes where rust pushes up under the paint. The marble rattles over them.
5. **Rust scale and pitting:** crumbly orange-brown that leaves residue on silk. The marble stops in the pits.
6. **Vertical rust runs:** streaks under gravity that show which way is "down" on the object.
7. **Curvature:** this patch is on the barrel top, so the marble always drifts toward one edge on a level stage.

- **The Tell:** the silk comes away orange. Burlap lifts green chips to show red, then grey. (A Tell must be detectable at 40×. That is a rule for every specimen.)
- **Landmarks by objective:** at 4× a pressed seam line and one domed rivet appear, at 2× the rolled lip of the door edge, and at 1× the edge of a hand-painted house number (a generic "7").
- **The Secret:** roll the marble hard over a blister and it pops. The paint shell cracks, a puff of rust dust drifts out as particles, and a curl of green paint peels off as a little physics flake that tumbles down the tilt.
- **The reveal diorama:** a mailbox on a post, low sun, with one flag up.

---

## 6. Scoring and sharing

**Score = the objective you solved at.** Each objective has a title, shown on the Field Card and the stats screen:

| 40× | 20× | 10× | 4× | 2× | 1× | miss |
|---|---|---|---|---|---|---|
| Fingertip Oracle | Loupe Legend | Sharp Eye | Close Enough | Arm's Length | Squinter | Back to the Drawer |

**Probes never count against you.** The share string records how you solved it, without scoring it:

```
Texturedle #1 · 10× Sharp Eye
⬛🟩🟩🟩🟨
🟩🟨🟩🟨🟩
🟩🟩🟩🟩🟩
👁🔮🧣  · andrew-rankin.com/games/texturedle
```
Sense glyphs: 👁 tilt · 🔮 marble · 🧣 silk · 🪢 burlap · 🖤 Rubbing mode · ✨ Secret found. The two flex badges are *"👁 Eyes only"* (solved without touching anything) and *"🖤 Blind"* (§7).

**Share image: a contact sheet.** It fits a photography site. A canvas renders a 6-frame strip, one frame per objective you reached, with the solving frame **circled in red grease pencil** the way photographers mark contact sheets. Frames you never reached are unexposed black. It is spoiler-safe because only the 40× frame shows texture and the rest are blurred. It goes through `navigator.share` or a download.

**Stats:** a histogram by objective, current and best streak, Cabinet completion, and Secrets found.

---

## 7. Modes and difficulty

- **Daily** (the main mode). A new specimen at local midnight, numbered from launch day. The patch position, rotation and blister placement are all seeded from the day number, so everyone sees exactly the same specimen and share grids can be compared.
- **Hard Mode:** drawers don't auto-close, and any green tile you have found must stay in every later guess (Wordle-style).
- **Rubbing Mode** (🖤, the expert flex). The surface is **pitch black**. A sheet of paper lies over it, and the silk becomes a graphite stick: every stroke makes a frottage rubbing of the relief, and the marble leaves a faint glowing trail whose brightness tracks friction. Audio stays on. It makes beautiful screenshots, and touch and sound alone carry the puzzle.
- **Drawer Dive** (endless, for quick phone sessions). Random specimens, **4 multiple-choice options**, three cracked lenses and you're out. It only draws from recipes that exist and doubles as practice for learning Tells.
- **Archive.** Every past daily, replayable. All content is procedural and deterministic, so this costs nothing.

**Weekly difficulty ramp** (NYT crossword style): Monday is obvious household (sponge, corduroy), Tuesday fabric, Wednesday wild, Thursday *processes* (rust, peeling paint, dried mud), Friday food, Saturday devious (popcorn ceiling), and Sunday a **Field Trip**: a themed outdoor specimen with an extra landmark. Occasional theme weeks: *Kitchen Week*, *Rust Belt*, *Things in Your Pocket*.

---

## 8. Onboarding: no text walls

**Specimen #0 is "packing bubbles"**, an ungraded tutorial chosen because it makes you *do everything*:

1. The stage rocks on its own, and a ghost-hand icon mimes a tilt. On phones a one-tap "Use motion" chip appears; on iOS this is where the permission prompt shows.
2. The marble in the tray pulses. Drag it out and it rolls into a valley between bubbles. Roll it fast and it **bounces** off a bubble.
3. The silk swatch pulses. Wipe with it and the bubbles squeak.
4. The burlap pulses. Scrub with it and a bubble **pops** with a synthesized pop (the heightfield gets edited in place). This is the first delight, and it teaches that surfaces react and change.
5. The guess bar glows: "What is this?" Whatever you type, the specimen reveals itself in a good-natured way, the turret demonstration plays once (every objective in sequence), and then the Field Card appears.

The rest is taught by idle hints: one-line ghost hints appear only after 8 s without input and fade the moment you act. Field Notes appear the first time a probe produces a fact, with a single pulse. The first time feedback tiles appear, a long-press on a tile shows its meaning. Nothing longer than one line anywhere.

---

## 9. Pacing a session

| Time | Beat | Design intent |
|---|---|---|
| 0:00 | Stage is live on load | Toy first, game second |
| 0:00–1:30 | Free probing, notes fill in | Curiosity; the Tell shows up if you try every probe |
| ~1:30 | First guess | A commitment moment, with real tension |
| per miss | Turret *clunk*, scale bar redraws, a landmark may appear | **A miss is a reveal**, so failing re-energizes the toy |
| solve | 3–4 s pull-back to the diorama, then the shutter click | The payoff shot always plays, even on a loss |
| after | Field Card → share → "Keep touching" | The toy stays open, and Secrets reward lingering |

**Losing:** after six misses the pull-back still plays in full, because the reveal is the reward. The specimen goes into the Cabinet behind **cracked glass**. Solving it later in the Archive "re-glazes" it. A loss turns into a collection goal instead of a dead end. The screen ends with a teaser: *"Tomorrow: something from the Kitchen."*

---

## 10. Progression: the Cabinet

- Every specimen you meet gets a drawer: polished glass if solved, cracked if missed, a ✨ pin if you found its Secret. Opening a drawer drops you into **Free Touch**: no guessing, every objective unlocked, the full toy.
- **Secrets** are the long-tail hook. Every specimen has exactly one hidden interaction, and the count of Secrets found appears in your stats. People will trade hints about them, which is the shareable part.
- **Tell mastery:** the Field Card always names the Tell, so experienced players start reading the world around them and get faster. The meta-goal is to **make people touch their actual surroundings differently.** A post-game line occasionally nudges toward that: *"Find something today that would fool you."*

---

## 11. Launch library: 24 dailies with Tells and Secrets

The Atlas needs only attributes (≈300 entries, cheap). Dailies need full recipes. **Launch with about 40 recipes (6 weeks) built from a layered grammar** (base material + process layers: paint, rust, wear, dirt, moss, oil, frost) so the recipes recombine instead of each being built from scratch.

| # | Specimen | Tell | Secret |
|---|---|---|---|
| 0 | Packing bubbles | bubbles bounce the marble | burlap pops them |
| 1 | Rusty mailbox | orange silk; green→red→grey flakes | marble pops a rust blister |
| 2 | Corduroy | marble tracks down the wales and won't cross them | brushing against the nap darkens stripes |
| 3 | Orange peel | marble wobbles in dimples; oily sheen on silk | long-press sprays a mist of citrus-oil droplets |
| 4 | Velvet | cloth strokes stay as light/dark trails | you can write your name in it |
| 5 | Cork board | dead thud, zero bounce | old pinholes at 4× |
| 6 | Denim | diagonal twill; **indigo rubs off on silk** | a frayed white weft thread pulls loose |
| 7 | Worn leather | silk buffs it glossier where wiped | a crease line from a fold appears at 2× |
| 8 | Tree bark | marble gets trapped in furrows | a springtail hops when the marble comes near |
| 9 | Moss | marble sinks and the surface springs back slowly; green residue | a droplet of dew rolls down the tilt |
| 10 | Brick | burlap sheds red dust; mortar edge at 4× | a mortar crumb dislodges |
| 11 | Coarse sandpaper | burlap frays and leaves lint; marble screeches | silk tears a tiny hole |
| 12 | Brushed steel sink | streaked highlight under tilt; marble glides along the brush direction | water spots that wipe away |
| 13 | Terrycloth towel | loops catch the marble and burlap | a loop pulls out into a long thread |
| 14 | Peeling painted door | layers of history: four paint colors | under the last layer, a scrap of old patterned wallpaper |
| 15 | Dried mud | polygonal cracks; edges crumble | a hard roll cracks a new plate |
| 16 | Hook-and-loop strip | the cloth *sticks*; flick to free it | the *rrrrip* |
| 17 | Strawberry | seeds sit in pits; silk comes away pink and wet | the marble knocks a seed loose |
| 18 | Toast | crumbs flake off; uneven browning | a butter smear shines under tilt |
| 19 | Basketball | uniform pebble grain; channel seam at 4× | the marble bounces very high |
| 20 | Chalkboard | silk wipes the chalk haze off to deep black | a ghost of half-erased arithmetic |
| 21 | Fresh snow | marble ploughs a trench; sparkle under tilt | silk comes away wet |
| 22 | Golf ball | perfect regular dimples | the marble orbits inside one dimple |
| 23 | **Popcorn ceiling** (a Saturday) | burlap knocks crumbs loose, and **they fall toward you** | **the marble won't stay down: it's a ceiling** |

Authoring rule: **every daily needs a Tell visible at 40×, a Secret, and at most one landmark per objective, 4× or below.**

---

## 12. Static-only viral hooks (stretch, in priority order)

1. **Send a Specimen.** A URL hash encodes `recipeId + seed + objective`, so you can dare a friend with any Cabinet specimen at any magnification. No backend needed.
2. **Make a Specimen from your photo.** Import a PNG and approximate a heightfield from its luminance, pick a physics preset (metal, wood, fabric…), and name it. The 64×64 heightmap plus the parameters fit in a base64 URL hash (~4 KB), so it can be shared statically.
3. **A cross-collection Easter egg.** Put the material recipes in `src/shared/materials/` so **Studio's backyard has the actual rusty mailbox** from Specimen #1, and Lensbench scenes can use Cabinet surfaces. A player who solved #1 recognizes it through the lens.

---

## 13. Notes for the build team (from the game-design side)

- Expose `window.__game` with `{ setDay(n), setObjective(k), guess(text), dropMarble(x,y), wipe(tool, path[]), tilt(x,y), reveal(), state() }` so Playwright can capture every objective, a solve and a loss.
- **Scope priority:** daily loop + 6 objectives + 3 probes + Field Notes + tiles + share text + ~20 recipes **>** Cabinet/Free Touch **>** contact-sheet image **>** Rubbing Mode **>** Drawer Dive **>** Send/Make a Specimen.
- **Cut first:** reveal dioramas. Fall back to about 10 archetype meshes (box, barrel-top mailbox, ball, slab/wall, plank, drape, fruit, cylinder…) with the recipe's material mapped on and a single light. The pull-back still lands.
- Respect `prefers-reduced-motion`: no idle rocking, and a cut instead of the turret spin. Use a high-contrast tile palette (orange/blue) for colorblind players.
