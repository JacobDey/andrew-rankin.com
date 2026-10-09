# LATENT IMAGE: the Arden Yard negatives

*Game 4, slug `latent`. Concept through the **game design** lens.*

**Title:** LATENT IMAGE
**Subtitle:** *the Arden Yard negatives*
**Tagline (hub card):** *Every photograph remembers who was holding the camera.*

---

## 1. The one-sentence game

It's 1996, and the police photo lab is being shut down; in seven nights every negative goes into the incinerator. You type words into the archive index, pull negative strips onto a light table, and print them in a 1-bit darkroom. Each print shows something nobody in 1979 bothered to look at, and that something becomes your next search word.

## 2. Pillars

1. **The print is the question; the index is the answer.** Captions are the searchable text and images hold the visual words. The game never marks a word as a keyword. A painted sign, a car number, or mirrored grease pencil only becomes a lead when the *player* reads it and types it.
2. **1-bit is the obstacle, not just the look.** Every hidden detail sits in a narrow tonal band. Dither at the wrong exposure or contrast grade and the detail disappears into black or white noise. Darkroom skill and detective skill are the same skill.
3. **Legibility is measured, not scripted.** A detail counts as read when the dithered print region correlates with that detail's ground-truth mask above a threshold. Creative routes work (pull the developer early, burn instead of grade up, crop tighter), so the toy stays a toy.
4. **Nothing on screen is decoration.** The lab work order on your desk at minute one is signed by the person the story ends on. Every tutorial card is in her handwriting. Replays should make players groan.

## 3. The story (original)

**Kestrel Bay, a fictional Pacific Northwest port.** All names are invented.

**1979, the official version.** Night watchman **Lyle Danser** is found dead in the yard of the **Arden Cannery** at 03:50, struck with a gaff hook. **Tobiah Wren**, 17, was seen nearby at 23:30. After a long interrogation by **Det. Sgt. August Penhallow**, he confesses. He recants and is convicted anyway. The ID-unit photographer on the scene is logged only as **"MQ."**

**What actually happened** (the player assembles it in layers):

| Layer | Truth | Where it hides |
|---|---|---|
| 1. Doubt | Danser's wristwatch stopped at **2:10**, though the official time of death is 23:40. The bloody tread on the office floor is a diamond pattern; Tobiah's sneakers are chevron. | Body frame (enlarge the wrist, grade 4); floor frame (burn in the shadow); booking frames |
| 2. Motive | Shed 4 held unlabeled crates of **Vesper Kings** cigarettes. Smuggled goods went out the back gate in a patrol car. Danser photographed it. | Burglary case 78-031; **Roll A**, undeveloped, from Danser's locker |
| 3. The car | The car is **Car 31**, which had a dead right headlamp. The patrolman is **Ptl. Bram Quell**, pictured at the 1979 Policemen's Picnic getting a safe-driving award beside Car 31. | Roll A: a blown-out highlight on the car door; burn it in to read "31". Picnic frames. Motor-pool repair log. |
| 4. The witness | MQ is **Mara Quell**, Bram's older sister. That night she was on the water tower across the road making a 6-minute long exposure for her private series *Night Rooms*. Her camera recorded the fight as **ghosts**: a figure in a patrol cap standing still long enough to register, the watchman's blur, and the one-eyed light trail of Car 31 leaving. | **Roll C**, "M.Q. PERSONAL, NOT EVIDENCE, DO NOT PRINT" |
| 5. The cover-up | Mara saw what her camera had seen, then shot the official scene. She cut frames 25-36 from her own scene roll (the gaff hook in its original place, tire tracks) and **misfiled them inside the Picnic file**, the one with her brother's award. She told Penhallow, and Penhallow got his confession. Bram died in a crash in 1985. | **Edge codes**: the scene roll's edge prints batch `K7-0379` and stops at frame 24. Search `K7` and the "PICNIC — EXTRAS" strip comes up. |
| 6. Now | The lab-closure order on your desk is signed **M. QUELL, DEPUTY COMMISSIONER**. She is burning the archive, and she also hired a night tech, taped technique cards on the wall, and left the canister where you'd find it. | Visible from frame one. Recontextualized by **Roll D**, which turns up in your in-tray late in the game. |

**Roll D** holds twelve frames shot in *this* lab *this week*: the tip cards going up on the wall, the property shelf, the picnic file. The last frame is a self-portrait in the darkroom mirror. Her note is written on the glass in grease pencil, so it reads backward until you **flip the negative** in the carrier: *"Print what's true. Then decide what to send. — M."*

The game never says whether she is confessing or still covering. The player's Box decides (section 9).

## 4. The four stations (one screen each, swipe or tab between them)

Each station has its own two-tone 1-bit palette, so the colour tells you where you are:

| Station | Palette | Verbs |
|---|---|---|
| **Index terminal** | amber phosphor on black | Type, search, scroll the result tape |
| **Light table** | cold white on black | Lay out strips, use the loupe, read edge codes, mark frames with grease pencil, cut a clip |
| **Darkroom** | safelight red on black | Enlarger (crop, zoom, focus, flip), exposure timer, contrast grade 0-5, dodge and burn by hand or card, trays with live development |
| **Corkboard and Box** | paper white on ink | Pin prints, string them to the lawyer's questions, seal the Box |

### Index rules (the Barlow contract, adapted)

- Search terms are single words or `TWO WORDS` (AND). The index searches **captions**, **case numbers**, **photographer initials**, **dates**, **edge codes**, and **property-room ledger lines**.
- **At most 5 result cards are shown**, in date order, with the total count displayed ("14 MATCHES — SHOWING 5"). Players have to *narrow* their searches; you can't skim the archive. This is the most important constraint in the game. Keep it.
- Captions are written in 1970s cop dialect: `DOA`, `SUBJ`, `VEH`, `NFA`, `SEE SUPPL.` Players learn the dialect, and the dialect is a tool. Searching `SUPPL` surfaces supplementary files.
- A few captions are **redacted** with typed X's. The words still exist in the image, so the darkroom is the only route.
- Your search history prints on a receipt tape that curls off the terminal. That tape *is* the run's stat line.

### What lives where (teaches players to use all four stations)

- **Edge codes, frame numbers, and missing frames** can only be read on the **negative** at the light table, because printing crops them off.
- **Shadow and highlight detail** can only be read on a **print**.
- **Reflections** read backward until you flip the negative.
- **Long-exposure ghosts** are faint on the negative. They need a high grade, a short exposure, and a dodge.

## 5. Core loop

**Minute to minute (30-90 s):**
type a word, get 5 cards, drag a strip to the light table, loupe the frames (they're inverted, which makes them hard to read and tempting to print), pick a frame and carry it to the darkroom, make a test strip, print, watch it **dither in** inside the developer tray, notice a word, and go back to the terminal.

**The bloom is the payoff.** Development is animated as a falling dither threshold: black pixels pepper in from the shadows toward the highlights in real time over about 40 s. You can **pull the print early**. An underdeveloped print opens up its shadows, which is a legitimate way to read a doorway that full development would bury. Every print is a small drama of *when to pull it*.

**Session loop (10-20 min):** follow a thread until it forks, pin the good prints, string them to a question on the corkboard, notice a contradiction, follow the other fork.

**Run loop (60-90 min):** 4 acts (section 7), Roll D, the Box, the headline.

## 6. Puzzle grammar: six ways a detail hides

Every clue frame is authored as one (or two) of these. Six patterns, learned once, cover the whole case and the daily mode.

| Pattern | Physical cause | Player fix | Example |
|---|---|---|---|
| **Buried** | Detail in deep shadow | Dodge, lower the grade, or pull development early | "SHED 4" painted on a dark door |
| **Blown** | Detail in a highlight | Burn in with a card, or raise the grade | "31" on a car door caught in a flashbulb |
| **Small** | Too few dither cells | Enlarge and crop, but grain grows with magnification, so find the sweet spot | Wristwatch at 2:10 |
| **Mirrored** | Seen in glass, chrome, or puddles | Flip the negative, then enlarge | Mara's mirror note; a reflected badge number in a hubcap |
| **Ghost** | Faint long-exposure density | High grade, short exposure, dodge the surround | Patrol-cap silhouette in *Night Room No. 9* |
| **Off-frame** | On the film, not the picture | Read it with the loupe at the light table | `K7-0379`, frames ending at 24 of 36 |

**The legibility stamp.** When a detail crosses the correlation threshold, a rubber **LEGIBLE** stamp thunks onto the print's back. It confirms you resolved *something* without saying what it means. It's the bridge from toy to game: concrete feedback on craft, no feedback on interpretation.

**Comparison prints.** Pin two prints side by side and a grease-pencil "=" or "≠" tool lets you mark matches (tread vs tread, cap vs cap). The game doesn't grade these marks. They're notes for you, and they show up on your share card.

## 7. Pacing: four acts, gated by discovery, never by time

| Act | ~Time | Key searches | Turn |
|---|---|---|---|
| **I. Doubt** | 0-15 min | `ARDEN` (pre-typed), `WREN`, `SHED`, `DANSER` | The watch says 2:10. The treads don't match. *The kid didn't do it.* |
| **II. Contraband** | 15-35 | `VESPER`, `LOCKER` leads to **Roll A**, then `31` and `PICNIC` | *A cop did it.* Bram Quell gets a face. |
| **III. The Witness** | 35-60 | `QUELL` returns *both* Quells; `NIGHT` leads to **Roll C**; `K7` finds the misfiled strip | *The photographer saw it, and hid it.* |
| **IV. The Order** | 60-80 | Roll D lands in your in-tray, triggered by Roll C plus the strip | *She's the one burning the archive, and she let you in.* |

The only hard gates are the three undeveloped rolls, which need the right ledger search. Everything else is open, and a sharp player can hit `QUELL` in minute five. That's fine. It reads as the photographer's surname, and its meaning only lands later. **Design rule: every critical fact has at least two independent routes**, so no ruined print, roll, or missed word can softlock the case.

### Undeveloped rolls: the one irreversible act

Old film loses its latent image over time. Developing a 17-year-old roll is a tank minigame: pour, invert to agitate (tilt the phone, or drag the tank), and set the time with a push dial (+0 to +3 stops). Too little and the frames come out ghost-thin. Too much and base fog swamps everything. **Clip test:** snip the first 3 frames off the leader and develop them alone. That's real technique and a free tutorial. You develop each roll **once**. A bad result is still printable, just harder (a narrower tonal window), so it's tension without a dead end. Three set pieces, three moments where the game holds its breath.

## 8. Onboarding without walls of text

- **Minute 0:** The desk under a lamp. Three objects: the lab-closure **work order** (one line plus a signature), a **letter from Hollis Akande, appellate counsel for Tobiah Wren**, which is four sentences ending *"anything from the Arden file, before it's gone,"* and the terminal with `ARDEN` already typed and a blinking cursor. Press Enter.
- **Minute 1:** Five cards. The first one wiggles. Drag it, and the light table lights up.
- **Minute 2:** A taped card on the enlarger, a drawing of a hand waving over a beam with no words, plus an arrow pointing at frame 7, where the door is pitch black. Print it once and you get a black door. Second try: hold your hand (or finger) in the beam over the door, and "SHED 4" swims up in the developer with a LEGIBLE thunk.
- **Minute 3:** Nothing tells you to search `SHED`. Players do it anyway. *That first unprompted search is the whole game in miniature.*
- Further technique cards (burn, grade, flip, push, clip test) are **pre-taped around the lab**, wordless, and they become noticeable when a frame needs them. They're all in the same looping handwriting as the "— M." on Roll D. The game never points this out.

**Hints that fit the world:** a wall phone rings through to **Dot, the night records clerk**. Hint tiers: (1) a station ("you checked the edges on those?"), (2) a frame, (3) a word. Every call is logged on your receipt tape.

## 9. Success, failure, and the Box

**No game over.** The only real loss is the incinerator: clock out on night 7 without sealing the Box and the epilogue is a single 1-bit frame of smoke over the precinct. *Nothing was kept.* Nights advance only when you choose to clock out, so pacing is yours. Clocking out saves the game and leaves a new item on your desk the next night: a ledger page, a phone message, or Roll D.

**The Box (the ending is an argument you build).** It's a shipping carton addressed to Akande, with **six print slots**. Only LEGIBLE prints fit. Each print carries hidden **fact IDs** for the details legible on it (for example `TOD_210`, `TREAD`, `COERCION`, `CAR31`, `BRAM`, `GHOST`, `MISFILE`, `MARA_ORDER`). Six slots can't hold everything, so **choosing is the final puzzle and the moral choice**:

| Facts in the Box | Headline (*Kestrel Bay Ledger*, front page, 1-bit) |
|---|---|
| Doubt only (TOD + TREAD) | **ARDEN CONVICTION GETS NEW HEARING** |
| + COERCION | **WREN CONFESSION THROWN OUT; PENHALLOW QUESTIONED** |
| + CAR31 + BRAM | **DEAD PATROLMAN TIED TO '79 CANNERY KILLING** |
| + GHOST + MISFILE | **POLICE PHOTOGRAPHER HID EVIDENCE, FILES SHOW** |
| + MARA_ORDER | **DEPUTY COMMISSIONER RESIGNS AS ARCHIVE BURNS** |
| Everything except Mara | **WREN FREED; "THE CAMERA SAW IT," SAYS LAWYER** (Mara keeps her job; one last frame, her desk light on late) |
| Mara's mirror self-portrait included | Secret headline: **"PRINT WHAT'S TRUE."** (an unsigned letter to the editor) |

Tobiah's outcome depends only on the strength of the doubt and coercion facts. Mara's fate depends on whether *you* name her. Neither is scored as right. The epilogue's last line is the count of negatives that burned the next morning.

## 10. Scoring and sharing

Barlow games don't score, but people share stats. The receipt tape becomes the share card:

```
LATENT IMAGE · Arden Yard
SEARCHES 41 · SHEETS 63 · LEGIBLE 19/24
CALLS TO DOT 1 · NIGHTS 3
HEADLINE ▮▮▮▮▮▮▮▮ ▮▮▮ ▮▮▮▮▮
```

- **The share image** is a generated 1-bit PNG of your Ledger front page, with a **spoiler-safe toggle** that redacts the headline into black bars. Redacted-headline screenshots work as social bait.
- **Printer's rank** comes from sheets per legible print: *Lab Rat, Night Tech, Printer, Master Printer*. It rewards craft separately from deduction.
- **Completion:** each case file you fully print fills a contact sheet in the lab binder. There are 18 case files, 4 of them optional side cases with their own one-line corkboard question, e.g. *"Who took the Bellmont Regatta cup?"* They give completionists 30 more minutes.

## 11. Daily and replay hooks

- **The Night Desk (daily).** One date-seeded procedural frame, one question (*"What's the name of the bar?"*), and **three sheets**. Frames are assembled from the same scene kit as the main case (storefront, car, alley, office, booking wall) with a hidden word placed using one of the six patterns, chosen by seed. Share: `LATENT · Night Desk #142 · read in 2 sheets · BURIED`. It teaches the grammar to players who never finish the story and pulls them back toward it.
- **Second-run cue:** after the ending, the work order on the desk gets a visible tint, so a replayer sees the signature on frame one. It's a small, cheap reward for knowing.
- **Open Lab (toy mode, always unlocked):** import any PNG and it becomes a negative filed as case `96-YOU`. **You type its caption, and then you can search for it.** Every darkroom tool works, with no case attached. This is the escape hatch that keeps the toy a toy, and it's where people will make the 1-bit portraits they share.

## 12. The toy inside the game

These stay physical and stay fun even when the story isn't moving:

- The enlarger focus knob snaps to grain-sharp. Zoom wheel or pinch-zoom on touch.
- Dodging with a real hand (a cursor hand, or your finger's touch point on mobile). Still hands leave hard halos and wiggling feathers them. Cards with holes for burning.
- Tray sloshing on tilt or drag. Uneven agitation leaves visible streaks in the dither, which are wrong for evidence but beautiful.
- The developer bloom, where the image peppers in from black.
- The LEGIBLE stamp thunk, the receipt tape curl, the strip snapping into the carrier.

The design test: **would a player with no interest in the mystery still spend 10 minutes printing one frame?** If not, the darkroom needs more feel before it needs more story.

## 13. Content budget (buildable by 2-4 agents)

- **~70 frames total, 24 of them critical**, built from **8 parameterized scene templates** (yard, office interior, booking wall, street, picnic lawn, shed interior, car close-up, mirror and darkroom). Each is rendered offscreen in Three.js with procedural props and canvas text, then stored as a grayscale "negative." 1-bit dither hides low-poly roughness, the way Obra Dinn does.
- **Frame recipe JSON:** `{id, case, roll, frameNo, edgeCode, caption, template, camera, props[], details:[{factId, bbox, mask, pattern, tonalWindow}]}`. Writers author recipes and the engine renders them, so story and engine work can run in parallel.
- **Lexicon file:** every caption in one data file, linted by a script that walks the clue graph from `ARDEN` and asserts every fact is reachable by at least 2 routes.
- **`window.__game`:** `search(q)`, `print(frameId, {exposure, grade, crop, flip, dodge[]})` returns `{legible: factId[]}`, `developRoll(id, push)`, `facts()`, `box(frameIds)` returns the headline, `setNight(n)`, `seedDaily(date)`. Headless tests can solve the whole case by script, which is also the softlock check.

## 14. Why it's different from game 3 (`plates`)

`plates` is Obra Dinn's *deduction ledger*: fixed scenes, naming identities. `latent` is Barlow's *search and assemble*: an open archive with no checkmarks, where the ending is an argument you make. They share the 1-bit dither engine and the darkroom core. They differ in palette (amber, white, and safelight red versus `plates`' single ink), in verbs (typing versus labeling), and in the question they ask. `plates` asks *who was this?* `latent` asks *what did the camera see that the photographer couldn't say?*
