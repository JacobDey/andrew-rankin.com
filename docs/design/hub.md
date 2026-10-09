# The hub: Roll 01, a contact sheet

The landing page at `/`. It also defines three things every game depends on: the **shared game shell** (§9), the **game registry** (§10) and the **thumbnail strategy** (§11). Visual tokens, type, colour, motion and sound come from `docs/design/art-direction.md`. This doc uses them and doesn't restate them.

---

## 0. The concept in one paragraph

The hub is **a photographer's contact sheet lying on a glowing light table**. The six games are six exposures on one roll of a made-up film stock, **RANKIN 400**, cut into strips and contact-printed. The real details are there: sprocket holes, edge printing, frame numbers, a DX barcode, scissor-cut strip ends, and the black where light hit the paper around the strips. Someone has been at it with a **grease pencil**, circling frames and scribbling notes. At rest every frame is a **black-and-white** print with a slow, quiet loop of its game. Point at a frame (or scroll it to the middle of your phone) and it **develops into colour**, starts moving properly, and gets a fresh red grease-pencil circle. A **loupe** follows your cursor and magnifies whatever's under it, which is also how you find the tiny jokes printed along the film edges. Click a frame and it grows to fill the screen and becomes the game.

What's new beyond the original pitch:
1. **Black and white at rest, colour on attention.** This unifies six very different art styles into one sheet, and colour becomes the reward for looking.
2. **Loupe-only edge-print jokes.** Discovery rewards curiosity.
3. **A "darkroom" theme.** The light table switches off and an amber safelight comes on.
4. **View-transition "enlargement".** The frame physically becomes the game.
5. **Progress notes.** Games leave short grease-pencil tallies on their own frames ("3 prints in the drawer").

---

## 1. Page anatomy

Top to bottom:

1. **Shell bar** in hub mode (§9.6): a film strip with the brand mark, `RANKIN 400 · ROLL 01`, and the loupe, sound and lights toggles.
2. **Intro** on the light table: kicker, H1 wordmark, tagline, intro paragraph, interaction hint. On desktop the **dictation card** is taped beside it.
3. **The sheet:** paper with a white border. Inside it is the exposed-black area holding the strips. Each frame has its caption printed beneath it on the black.
4. **The dictation card** (tablet and mobile: after the sheet).
5. **Footer** on the light table: credits, preferences and the source link.

### 1.1 Desktop, 1024px and up (wireframe at 1440×900)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│▣ RANKIN 400 · ROLL 01                                      [loupe][♪][bulb]  │ ← shell, 52px
│· · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·│   (perforation row)
├──────────────────────────────────────────────────────────────────────────────┤
│   MINIGAME COLLECTION · ROLL 01                     ┌───tape───┐            │
│   Andrew Rankin                                     │ THE DICTATION         │
│   Six photographic toys, thought up at the          │ Andrew-Rankin.com     │
│   kitchen sink.                                     │ Minigame Collection   │
│   These started as a few sentences Andrew said…     │ 1. Texture-dle: …     │
│   Hover a frame to look closer. Click to play.      │ … (rotated 1.2°)      │
│                                                     └───────────────────────┘│
│  ┌──────────────────────── paper border ────────────────────────────────┐ PROOF│
│  │ Roll 01, the sink sessions (pencil)                                   │      │
│  │ ███████████████████████████████████████████████████████████████████ │      │
│  │ █ RANKIN 400 ▫▫▫▫▫▫▫▫ ▫▫▫▫▫▫▫▫ ▫▫▫▫▫▫▫▫ DO NOT WASH WITH DISHES     █ │      │
│  │ █ ┌──────────┐ ┌──────────┐ ┌──────────┐  ← strip 1 (frames 1–3)    █ │      │
│  │ █ │  frame 1 │ │  frame 2 │ │  frame 3 │                             █ │      │
│  │ █ └──────────┘ └──────────┘ └──────────┘                             █ │      │
│  │ █ ▫▫▫▫▫▫▫▫ 1  ▸1A ▫▫▫ 2  ▸2A ▫▫▫ 3  ▸3A                               █ │      │
│  │ █ ▸01 NOTE 1    ▸02 NOTE 2    ▸03 NOTE 3   ← captions on the black    █ │      │
│  │ █ Texturedle    Darkroom      Halation                                █ │      │
│  │ █ blurb…        blurb…        blurb…                                  █ │      │
│  │ █ PLAY ▸        PLAY ▸        PLAY ▸                                  █ │      │
│  │ █ (strip 2: frames 4–6, same structure)                               █ │      │
│  └───────────────────────────────────────────────────────────────────────┘      │
│   footer                                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

At 1440×900 the whole first strip and the top of its captions sit above the fold. Budget: shell 52 + intro ≈ 320 + sheet top border ≈ 60 + strip ≈ 330 = 762px.

### 1.2 Tablet, 640–1023px
(These viewport ranges are approximate. The real column switch is a container query on the sheet, §3.2.)
Single-column intro. The sheet has **2 frames per strip** (3 strips). The dictation card follows the sheet at full width, rotated −0.6°.

### 1.3 Phone, under 640px (wireframe at 390×844)

```
┌──────────────────────────────┐
│▣ RANKIN 400 · ROLL 01 [♪][☀] │ shell 52px (no loupe button)
├──────────────────────────────┤
│ MINIGAME COLLECTION · ROLL 01│
│ Andrew Rankin                │ 48px Fraunces
│ Six photographic toys,…      │
│ intro (≈6 lines)             │
│ Tap a frame to play. Press   │
│ and hold to look closer.     │
│┌────────────────────────────┐│ paper border 8px
││▓ RANKIN 400 ▫▫▫▫▫▫▫▫      ▓││ one frame per strip,
││▓ ┌────────────────────────┐▓││ both ends scissor-cut
││▓ │       frame 1          │▓││ frame ≈ 322×215
││▓ └────────────────────────┘▓││
││▓ ▫▫▫▫▫▫▫▫ 1     ▸1A        ▓││
││  ▸01 · NOTE 1 · TEXTURE-DLE ││
││  Texturedle                 ││
││  blurb…            PLAY ▸   ││
││  (frames 2–6 the same)      ││
│└────────────────────────────┘│
│ THE DICTATION (card)         │
│ footer                       │
└──────────────────────────────┘
```

The first frame starts at about y=430, so it's visible without scrolling on a 390×844 screen.

---

## 2. Copy deck (final unless noted)

Spelling is Canadian. The game titles, taglines and blurbs live in the registry (§10). **Game leads own their own title and blurb.** If a game's final design changes its premise, it updates its registry entry, and the hub picks it up automatically. Everything below is the launch copy.

### 2.1 Page-level
- `<title>`: **Andrew Rankin · Minigame Collection**
- Meta description (145 chars): **Six photography toys and games, dictated over a sink of dishes: a texture puzzle, two darkrooms, a police story, a lens bench and a whole studio.**
- Kicker (edge print, `--ar-accent`): **MINIGAME COLLECTION · ROLL 01**
- H1 (wordmark): **Andrew Rankin**
- Tagline (Fraunces italic): **Six photographic toys, thought up at the kitchen sink.**
- Intro (Archivo, 1.0625rem, max 58ch):
  > These started as a few sentences Andrew said out loud while washing the dishes. A friend tried to type them down word for word, which is why the notes are a little damp around the edges. This is that roll, developed: six frames, each an idea you can tilt, slosh, focus, expose and print. Look closer at any of them, then step inside.
- Interaction hint (Archivo 14px, `--ar-ink-3`). Fine pointer: **Hover a frame to look closer. Click to play.** Coarse pointer: **Tap a frame to play. Press and hold to look closer.** The static HTML ships the touch wording, and JS swaps in the pointer wording when `matchMedia('(pointer: fine)')` matches.

### 2.2 The dictation card (verbatim notes)
A `<figure>` styled as a phone-notes printout taped to the light table. Plex Mono 13px/1.55, `--ar-ink` on `--ar-surface`, with masking tape on top. Header in edge print: **THE DICTATION · TYPED AT THE SINK, MOSTLY VERBATIM**. Body, **exactly** as Andrew said it (keep the typos):

```
Andrew-Rankin.com

Minigame Collection

1. Texture-dle: zoomed-in photo with a dense 3d texture map. Camera can tilt 5 deg. a marble can be rolled across, and a fine cloth and a rougher cloth. a "rusty mailbox" texture to start
2. Darkroom: a simulated physics toy darkroom. Tactile liquid sloshing with reactive paper. Tactile adding/removing light. Cyanide chemistry cyanotype support. Import a PNG. To make a cyanotype. Photo prep. Simulated chemistry. You can do save states
3. Darkroom but it's styled like return of the obrah dinn
4. ^ this but it's a police story like a Sam Barlow game
5. Camera designer with optic/physics. Take it out to a simple web3d scene and take real photos and develop them.
```

Then, in a second "hand" (Caveat 600, `--ar-graphite`, slightly larger, as if added later):

```
6. a full physics-toy photography studio: darkroom, build-a-camera room, and a 'backyard' room to take photos
```

Grease-pencil annotations (red, `aria-hidden`, drawn over the text):
- Circle around **Cyanide**, with an arrow to the margin: **cyanotype!! (nobody was poisoned)**. For screen readers, add `<span class="visually-hidden">(he means cyanotype)</span>` after the word.
- **sp?** beside "obrah dinn".
- A bracket around item 6: **friend's request**.
- A tiny check mark beside each of items 1–6. Each check **draws itself** the first time the matching frame becomes active in this visit (cosmetic only).

Figcaption (Archivo 12px, `--ar-ink-3`): **Dictated by Andrew Rankin. Typed by a friend. Item 6 is the friend's.**

### 2.3 Per-game captions (registry defaults)

Caption structure under every frame:
1. **Kicker** (edge print): `▸0N · NOTE N · <NOTE NAME>`
2. **Title** (Fraunces 600)
3. **Tagline** (Fraunces italic, `--ar-on-film-2`; hidden under 400px wide)
4. **Blurb** (Archivo 15px/1.5, `#BDB3A4` on exposed black, 9.6:1)
5. **Meta** (Plex Mono 12px, `--ar-on-film-2`, items joined by ` · `) and the **CTA** `PLAY ▸` (Archivo label style, `--game-accent-lit`) right-aligned on the same line

| # | Kicker | Title | Tagline | Blurb | Meta | Grease mark + note |
|---|---|---|---|---|---|---|
| 01 | `▸01 · NOTE 1 · TEXTURE-DLE` | **Texturedle** | *One surface a day, much too close.* | A photograph taken far too close to something you've definitely touched. Tilt the camera five degrees, roll a marble across the grain, drag a fine cloth and a rough one over it, then name the surface before your guesses run out. | `PUZZLE · DAILY · ~5 MIN` | question mark + **too close?** |
| 02 | `▸02 · NOTE 2 · DARKROOM` | **Darkroom** | *A darkroom you can slosh.* | Bring your own picture. Drop in a PNG, prep it, then print it in silver under the safelight or in iron as a cyanotype, rocking the tray until the Prussian blue blooms. Every drop of chemistry is simulated, and the bench saves where you left it. | `TOY · CHEMISTRY · SAVES` | check + **cyanotype, not cyanide** |
| 03 | `▸03 · NOTE 3 · DARKROOM, 1-BIT` | **Halation** | *Old glass plates that saw everything.* | A crate of exposed glass plates that nobody ever developed. Bring each one up in a two-tone, one-bit darkroom, step inside the moment it froze, and work out who everyone was and what became of them. The better you develop, the more you can see. | `MYSTERY · 1-BIT · DEDUCTION` | crop marks + **count the faces** |
| 04 | `▸04 · NOTE 4 · POLICE STORY` | **Latent Image** | *Nothing is evidence until you develop it.* | An old case, a police photo archive and a search box. Type a word, pull up negatives and records in any order, and print what nobody bothered to look at. Each print gives you the next word. The story is in there. It just hasn't come up yet. | `STORY · SEARCH · MYSTERY` | arrow + **print this one** |
| 05 | `▸05 · NOTE 5 · CAMERA DESIGNER` | **Lens Bench** | *Build the glass. Shoot the yard.* | Slide lenses along an optical rail and watch real rays bend, focus and fringe. Choose an aperture and a shutter, bolt on a body, then carry your camera into a small 3D backyard, take actual photographs with every flaw you built in, and develop the roll. | `TOY · OPTICS · 3D` | underline + **f/1.4 or bust** |
| 06 | `▸06 · NOTE 6 · THE WHOLE STUDIO` | **The Studio** | *Build it, shoot it, print it.* | The whole studio in one little house. Build a camera in the workshop, rig the backyard so something wonderful happens in front of the lens, then carry the roll down to the darkroom to find out whether you caught it. Every room is a physics toy. | `SANDBOX · PHYSICS · 3 ROOMS` | star + **the friend's pick** |

Title notes:
- **Plates → "Halation."** Halation is the glow that spreads around bright highlights in old emulsions. The word belongs to the photography, not to any one story. It sits well next to "Latent Image" (both are darkroom terms) and survives whichever premise the Plates team settles on. The concept docs also suggest *The Caul Rock Plates*, *Ruby Sector* and *The Hollin Plates*. If the game ships with one of those, the registry title changes and the kicker keeps it legible as "the 1-bit darkroom". (Credit: "Halation" first appeared in `concepts/plates-game.md`.)
- Concept docs also float *Safelight* / *Silver & Iron* (Darkroom), *Circle of Confusion* (Lens Bench) and *Shutterhouse* (Studio). The hub works with any of them. The fixed kicker always shows Andrew's original plain name, so the link back to the dictation is never lost.
- **CTA:** `PLAY ▸` everywhere. Its accessible name comes from the card link (§12), so it reads "Texturedle, link". "Play" alone is never announced out of context.
- **The Studio credit** (shown under its blurb in Archivo 12px italic, `--ar-on-film-2`): *Frame 06 wasn't in the dictation. The friend holding the phone asked for it.*

### 2.4 Footer
Three short rows on the light table, Archivo 14px, `--ar-ink-2`:
1. **Ideas by Andrew Rankin, at the sink. Typed by a friend. Built with Claude.**
2. **No accounts. Your saves stay in this browser.** · [Source on GitHub] · [Match my system] · [Sound on/off]
3. Edge print, `--ar-ink-3`: **RANKIN 400 · ROLL 01 · 06 EXP. · 2026**
   Below it, in small type: *Halation and Latent Image tip their hats to the one-bit deduction of* Return of the Obra Dinn *and the archive-diving stories of Sam Barlow. Every story, character and picture here is original.*

The GitHub URL comes from `SITE.repoUrl` in the registry module. Leave out the link if it's empty.

### 2.5 404 (`/404.html`; a Vite page added to `rollupOptions.input`)
A film strip with a single **fogged** frame (an orange-to-black light-leak gradient) with a grease circle around it. Title: **Frame not found.** Body: **This part of the roll got fogged.** Button: **Contact sheet** (primary). Uses the shell in hub mode.

### 2.6 Social card text (OG)
- Hub: **Andrew Rankin · Minigame Collection**, with *Six photographic toys, thought up at the kitchen sink.*
- Games: **{Title} · Andrew Rankin**, with the tagline. Image specs are in §11.3.

---

## 3. The sheet: construction

### 3.1 Units and proportions (real 35mm, stylized)
Every frame **cell** is exactly one frame pitch of 35mm film. Inside a cell, everything is measured in `u`, where **1u = cell width ÷ 38**. Set this with container query units: give each cell `container-type: inline-size` and set `--u: calc(100cqw / 38)`.

| Part | Size (u) | Notes |
|---|---|---|
| Cell | 38 × 35 (plus caption below) | one frame pitch; cells sit side by side with **no gap**, so the strip reads as continuous |
| Image | 36 × 24 at x=1, y=5.5 | 3:2; corner radius 0.4u (the gate's soft corners) |
| Top rebate | y 0–5.5 | outer margin 0–1.9 (edge print), perforations 1.9–3.9, inner margin 3.9–5.5 (clean) |
| Bottom rebate | y 29.5–35 | inner 29.5–31.1 (clean), perforations 31.1–33.1, outer 33.1–35 (frame numbers) |
| Perforations | 8 per cell; 2.8 × 2.0, radius 0.5, pitch 4.75, first hole at x=0.975 | painted with a mask (not drawn holes), so the exposed black shows through |
| Edge print | font-size `max(9px, 1.25u)`, edge-print style | §3.3 |
| Frame gap | the 1u rebate on each side of the image | 2u between neighbouring images |

**Colours:** rebate `--ar-film` (#121110). Exposed sheet black `--ar-exposed` (#0B0A09), with a faint uneven-exposure radial `#15130F` at the centre fading to `#0B0A09` at the edges, plus `inset 0 0 24px rgb(0 0 0 / .6)` halation at the paper border. The rebate is a shade *lighter* than the exposed paper, as in a real contact print (base plus fog).

### 3.2 Layout with CSS grid
```
.sheet                        container-type: inline-size; container-name: sheet
  .sheet__paper               paper border: padding clamp(8px, 3.5cqw, 44px); bg --sheet-paper
    .sheet__head              pencil note + PROOF stamp (on the paper border)
    .sheet__exposed           exposed black; padding 3u-equivalent (16–28px)
      ol.sheet__frames        display:grid; grid-template-columns: repeat(var(--cols), 1fr); column-gap:0; row-gap: clamp(28px, 4vw, 48px)
        li.frame (×6)         container-type:inline-size; --u: calc(100cqw / 38)
          .frame__strip       aspect-ratio: 38 / 35; position:relative; background: var(--ar-film)
            .frame__perfs     ×2 (top/bottom), masked rows
            .frame__edge      edge-print spans (absolute, in u)
            .frame__dx        DX barcode (top-right, x 28–36u)
            .frame__image     absolute: left 1u, top 5.5u, width 36u, height 24u; holds <canvas> (+ poster <img> fallback)
            .frame__grease    <svg> overlay, overflow visible, inset −3u
          .frame__caption     padding: 2u 1u 0
```

- `--cols`: **3** at `@container sheet (min-width: 900px)`, **2** at 560–899px, **1** below 560px.
- `--sheet-paper` is `#F7F2E8` in the light theme and `#C9C0B2` in the dark theme (paper seen under dim light). Pencil and stamp ink on it: `--ar-graphite` (light) and `#2A2622` (dark), 8.3:1.
- **Strip ends:** the first cell of each row gets a scissor cut on its left edge: `clip-path: polygon(var(--cutL) 0, 100% 0, 100% 100%, 0 100%)`, where `--cutL` is between 0 and 0.8u, chosen per row by seed. The last cell of each row gets the mirror on its right edge. Use `:nth-child(3n+1)` / `:nth-child(3n)` at 3 columns, the 2-column equivalents at 2, and both ends on every cell at 1.
- **Strip offsets:** per row, nudge the strip vertically by 0–0.6u and rotate the **whole row's strips** by −0.25° to +0.25° (`rotate` on `.frame__strip` with the same value for every cell in the row, `transform-origin` at the row centre via a per-row custom property). This hand-laid wobble is turned off at 1 column and under reduced motion.
- **Perforation rows:** `.frame__perfs` is a 38u × 2u band with `background: var(--ar-exposed)` masked by a repeating SVG hole (`mask: url(perf.svg) 0.975u 0 / 4.75u 2u repeat-x`). Write the mask size in `calc()` with `--u`.

### 3.3 Edge printing (per cell)
All edge print is `aria-hidden="true"`, in the edge-print type style, colour `--ar-edge-print`.

| Where | Content |
|---|---|
| Top outer margin, x=3u | `RANKIN 400` on odd frames. On even frames, the game's **edge joke** in `--ar-on-film-3` (barely visible; it's for the loupe). |
| Top outer margin, x=28u | DX barcode: 32 bars, each 0.22u wide by 1.1u tall, set or unset from the bits of the slug's first four char codes. Colour `--ar-edge-print` at 0.7 opacity. |
| Bottom outer margin, x=1.5u | the frame number, `font-size: 1.6u` (larger, like real frame numbers) |
| Bottom outer margin, x=20.5u | `▸NA` (for example `▸2A`), 1.25u |
| Between images (in the 2u gap), vertical text | `RANKIN` in 0.7u type, `writing-mode: vertical-rl`, `--ar-on-film-3`. Loupe-only. |

**Edge jokes** (registry `edgeJoke`; all-caps edge print, 30 characters or fewer):
- 01: `TOO CLOSE TO FOCUS · 0.3 MM`
- 02: `DO NOT WASH WITH DISHES`
- 03: `HANDLE GLASS BY THE EDGES`
- 04: `EXHIBIT ▸04A · DO NOT FOLD`
- 05: `CIRCLE OF CONFUSION ≤ 0.03`
- 06: `FRIEND'S FRAME · NOT DICTATED`

### 3.4 Paper border furniture
- Top-left, in pencil (Caveat 600, 22px, `--ar-graphite`, rotated −1.5°): **Roll 01, the sink sessions**
- Top-right: a red rubber stamp **PROOF**. Archivo 800, `font-stretch: 75%`, 18px, tracking 0.2em, 2px border with 3px radius, colour `--ar-accent` at 0.85 opacity, rotated −6°. Inked unevenly with `mask-image` from the grain tile.
- Bottom-right, printed small (edge print, `--ar-ink-3`): **6 EXP. · CONTACT · GRADE 2**

---

## 4. Frames and previews

### 4.1 States
| State | When | Look |
|---|---|---|
| **idle** | default | Preview at 10fps and 1/3 speed, `filter: grayscale(1) contrast(1.06) brightness(0.96)`. Slow and quiet. |
| **active** | hover or focus-within (fine pointer); the scroll-centre frame (coarse pointer) | Colour (`grayscale(0)`) transitioning over `--ar-dur-develop` with `--ar-ease-develop`. 30fps at full speed. The grease circle draws. `tick` sound (pointer only, not scroll). Caption title gets a `--game-accent-lit` underline (2px, drawn left to right). |
| **pressed** | pointerdown on a frame | The image darkens 6% for `--ar-dur-press`. `shutter` sound plays on activation. |
| **developing** | `registry.status === 'developing'` | Preview runs as normal, plus a diagonal stamp **IN THE TRAY** (yellow grease, Caveat 700) across the image. The link still works. |
| **reduced motion** | OS setting or `?motion=reduce` | Hero still (`draw(heroT)`) and no loop. The active frame still turns to colour (a 160ms crossfade). The circle appears without drawing. |

Only **one** frame is active at a time. Pointer hover takes priority over scroll-centre. Scroll-centre activation uses an `IntersectionObserver` with `rootMargin: '-42% 0px -42% 0px'`, so the frame crossing the middle band of the viewport is active. If none crosses it, the last active frame stays active.

### 4.2 The preview contract (`src/hub/previews/<slug>.ts`)
Each preview is a small procedural **2D canvas** loop, made for the hub. It is a "photograph of the game", not a screenshot. Rules: no WebGL, no Three.js, no imports from `games/`, and the code only depends on `src/shared` helpers.

```ts
// src/hub/previews/types.ts
export interface PreviewEnv {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number; h: number;          // backing-store pixels (already × dpr)
  dpr: number;
  seed: number;                  // stable per slug
  accentLit: string;             // registry accentLit
}
export interface Preview {
  readonly period: number;       // seconds; the loop is seamless at t = period
  readonly heroT: number;        // the best single moment, used for stills and reduced motion
  init(env: PreviewEnv): void | Promise<void>;   // precompute; heavy work in idle chunks
  resize(env: PreviewEnv): void;                 // backing size changed
  draw(t: number): void;                         // a PURE function of t in [0, period): deterministic
  dispose?(): void;
}
```

- **Determinism:** `draw(t)` depends only on `t` and `seed`. That makes the loupe's mirror exact, and `?t=2.5` screenshots repeatable.
- **Shared helpers** (`src/hub/previews/kit.ts`): `mulberry32`, `valueNoise2D`, `fbm`, `bayer8` (8×8 ordered-dither matrix), `filmGrain(ctx, amount, t)` (the same procedural grain on every preview, so they read as one roll), `vignette(ctx, strength)`, `halation(ctx, threshold)`, and `easeInOut`.
- **Finish on every preview:** grain amount 0.06, vignette 0.25, and a soft highlight bloom. This is what makes six different worlds look like six frames from one roll.
- **Runner** (`src/hub/previews/runner.ts`): one `requestAnimationFrame` loop for all six. It draws each visible preview only when its interval is due (idle 100ms, active 33ms). It pauses frames that are off-screen (`IntersectionObserver`) and everything when `document.hidden`. Backing resolution is CSS size × min(dpr, 1.5) when idle and × min(dpr, 2) when active, and × 2.5 (capped at 1100px wide) while the **loupe** is over that frame. **Adaptive:** if the p90 frame cost of all previews goes over 6ms across 2 seconds, idle drops to 6fps and DPR drops to 1. If it still goes over, idle frames freeze on `heroT`.
- **Init:** previews initialize lazily in `requestIdleCallback` slices, in visible order. Until a preview is ready, its frame shows a "**developing**" placeholder: a flat `#1a1816` field that brightens to the preview's average tone over 900ms. It's never empty.

### 4.3 Storyboards (each loops seamlessly; never use a real puzzle answer)
| Game | Period | heroT | Storyboard |
|---|---|---|---|
| **Texturedle** | 8s | 2.6 | Extreme macro of **peeling paint over weathered wood**. *Not* a puzzle answer: if it ever joins the puzzle pool, pick another surface. Built from a height field (fbm plus cracks). The shading is a precomputed normal map lit by a raking warm light whose azimuth turns 360° over the period. The shadows wheel like a sundial. The camera "tilts" ±5° as a parallax offset of the height layers. A glass **marble** (a refraction-magnified disc plus specular and caustic) rolls along a slow Lissajous path and casts a soft shadow. At 5–6s a scale bar `1 mm` fades in, bottom-left, in Plex Mono. |
| **Darkroom** | 8s | 5.2 | Top-down enamel **tray** under a red safelight. Liquid shows as a moving highlight band and a refraction wobble, sloshing left and right twice per loop. In the tray is a **cyanotype of a fern** (a procedural branching frond as a photogram). It goes from pale yellow-green unexposed paper to deep Prussian blue as the wave passes. From 6.5s a white-light wash flattens it to the finished blue-and-white print, and it resets cleanly. |
| **Halation** | 7s | 4.0 | **Strict 1-bit** (bone `#E6DFCB` on ink `#141210`), even in colour mode, which here means the bone tint. A glass plate on a lightbox, a **negative** of an original tableau: three silhouettes in a doorway, a lantern and a ship's rail, all simple shapes. Over 0–2.5s the plate "develops" grain by grain (a stochastic threshold rising). At 3.5s it flips to **positive** (the velvet-backing trick). A thin magnifier ring drifts over one face at 4–6s. |
| **Latent Image** | 7s | 4.6 | 1-bit-ish archive under an amber lamp. A search field types **`WINDOW`** letter by letter (Plex Mono, caret blinking at 1Hz). A grid of six **negative strips** slides in with frame numbers. One strip lifts and a **print** comes up in a tray (dither threshold rising) showing blinds-shadow stripes across a desk. An amber evidence tag `▸04A` swings on a string. |
| **Lens Bench** | 8s | 3.0 | Side-view **optical bench** on drafting paper (a faint grid). Three lens elements (biconvex, biconcave, plano-convex) as crisp glass outlines with a violet coating edge. A comb of 11 rays enters from the left. **The rays are actually traced with Snell's law in 2D**, through spherical surfaces with n = 1.52 and 1.62, at three wavelengths with a small dispersion offset, so colour fringes appear at focus. The ray angle sweeps slowly. An **iris** between the elements closes from f/2 to f/8 and opens again, narrowing the bundle. The focal plane on the right is a ground-glass line where the bright spot sharpens. |
| **The Studio** | 8s | 5.5 | A flat **cutaway diorama** of a little house: workshop (warm wood, left), backyard (green, right, a swaying tree and a ball bouncing on a lawn), darkroom (red, below or left). A tiny camera on a tripod in the yard fires a **soft** flash at 3.0s (an overlay of 25% or less, within the photosensitivity rules). A dotted "film path" line runs from the camera through the house to the darkroom, where a print slides into a tray and comes up at 5–6.5s. |

Palettes come from the game accents (`accentLit`) and the in-game signatures (art-direction §12). **Phase 2 review:** once each game exists, the hub owner compares each preview with the real game and retunes palette and silhouette so they rhyme.

---

## 5. Grease-pencil layer

- **Per frame, the hover/active circle:** `circlePath(imageRect expanded by 1.5u, seed = slug + visitCount)`, so it is different on every visit and stable within one. `--ar-grease-red-lit`, 0.45u stroke (minimum 3px), filter `url(#ar-grease)`. It draws over `--ar-dur-draw` on activation and fades out over 120ms on deactivation.
- **Permanent mark and note** (registry `greaseMark` / `greaseNote`), drawn once when the frame first enters the viewport, in yellow (`--ar-grease-yellow`). Placement:
  - `question`: a large "?" over the top-left corner of the image, with the note to its right across the top rebate
  - `check`: a check mark on the top-right corner, with the note under it along the image's top edge
  - `crop`: four L-shaped crop brackets inset 2u into the image, with the note on the bottom rebate
  - `arrow`: a curved arrow from the caption area up into the image, with the note at its tail
  - `underline`: a double underline under the caption title, with the note to its right
  - `star`: a five-point star on the top-right corner of the image, with the note under it
  - Notes: Caveat 700, `max(18px, 2.3u)`, rotated by a seeded −4° to +3°. They may cross perforations and image edges, **never** caption text.
- **Progress notes** (§8.5) are a third layer in white grease, on the bottom rebate.
- The layer is all `aria-hidden` SVG, sized to the cell, with `overflow: visible`.

---

## 6. The loupe

### 6.1 Behaviour
| Input | Behaviour |
|---|---|
| **Fine pointer** (mouse, trackpad) | On by default (persisted as `ar:hub:loupe` = `on`/`off`; toggle in the shell). It appears when the pointer enters `.sheet__exposed` and hides when it leaves, on scroll (until the next move), and when the window loses focus. `cursor: none` over the sheet. The loupe centre is the hotspot: a 3px ring in `--ar-grease-yellow` at 0.5 opacity. Clicks pass through (`pointer-events: none`). |
| **Touch** | Press and hold a frame for 350ms (no movement over 8px) to open the loupe **100px above the finger** (clamped to the viewport). Drag to move it; release to close. A hold never navigates. The release that ends a loupe session is swallowed. `-webkit-touch-callout: none` and `user-select: none` on the sheet. A light haptic (10ms) on open. |
| **Keyboard** | No loupe. It's decorative. Everything it reveals is either duplicated in accessible text or a joke. |
| **Magnification** | 2.5× (desktop) and 2.25× (touch). Alt + wheel adjusts it between 1.5× and 4× in 0.25 steps. |
| **Size** | 200px diameter (desktop), 240px at 1600px+ viewports, 150px on touch |
| **Easing** | The loupe position follows the pointer with an exponential lerp (`k = 1 - exp(-dt/40ms)`), so it feels like a heavy object. No lag under reduced motion. |

### 6.2 Rendering technique: a DOM clone (crisp text, live canvases)
1. `.loupe` is a fixed, round, `overflow: hidden` element with `aria-hidden="true"`, `inert`, and `z-index: var(--ar-z-loupe)`.
2. Inside it, `.loupe__world` holds a **deep clone of `.sheet__exposed`**. Strip `id`s and set `inert`. It's sized to the original's rect, with `transform-origin: 0 0` and `transform: translate(tx, ty) scale(M)`. Set the scale once and update only the translate each frame, so the browser rasterizes the text at M× once and stays sharp. `tx = R − M·(px − rect.left)`, `ty = R − M·(py − rect.top)`, where (px, py) is the eased pointer in viewport coordinates and R is the loupe radius.
3. **Canvas mirroring:** each frame while the loupe is visible, for the previews whose image rect intersects the loupe's source circle (radius R/M), copy the original canvas into the clone canvas with `drawImage`. That's at most two per frame. The runner raises those previews to loupe resolution (§4.2).
4. **State mirroring:** the hub's `setActive(slug)`, `setProgress()` and grease reveals act on **both** trees through one function that loops over `[original, clone]`.
5. **Rebuild the clone** (debounced 150ms) on resize, theme change, font load (`document.fonts.ready`) and registry or progress changes.
6. **Visual dressing:**
   - Rim: `box-shadow: 0 0 0 5px #1A1816, 0 0 0 6px rgb(255 255 255 / .18), 0 18px 36px -8px rgb(0 0 0 / .5)`
   - Inner: an `::after` with `box-shadow: inset 0 0 0 1px rgb(255 255 255 / .22), inset 0 0 28px rgb(0 0 0 / .4)` and a specular arc `radial-gradient(60% 40% at 30% 18%, rgb(255 255 255 / .2), transparent 60%)`
   - A cast shadow on the sheet: a separate blurred ellipse (`filter: blur(10px)`, `rgb(0 0 0 / .35)`), offset (10px, 16px) and trailing the loupe by an extra 20ms of lerp
   - Content gets `filter: brightness(1.05) contrast(1.03)`, because a loupe gathers light.

---

## 7. Light table and theme

- **Light theme, "light table":** page background is the radial glow (art-direction §4.2), plus a 1px lighter "diffuser" grid every 96px (`rgb(255 255 255 / .35)`), which you'd only notice on second look. The sheet gets the **halo** (art-direction §6.5).
- **Power-on flicker:** on the first hub load per session (`sessionStorage['ar:hub:lit']`), only in the light theme and not under reduced motion. The glow layer's opacity steps 0 → .6 (40ms) → .1 (60ms) → .9 (50ms) → .4 (80ms) → 1 (300ms ease-out). The whole thing is under 600ms and low-contrast (1.13:1 swing), so it's photosensitivity-safe. No sound, since there's been no gesture yet.
- **Dark theme, "darkroom":** the table is off. A safelight glow comes from the top (art-direction §6.5). The sheet's paper border dims to `#C9C0B2`, and the halo becomes a faint amber rim (`0 0 48px 4px rgb(255 92 48 / .12)`). Toggling Lights on the hub crossfades the glow layers over `--ar-dur-slow`, while the `switch` sound plays.
- **Safelight Easter egg (stretch, M4):** in the dark theme only, a small pull-chain (SVG: 9 beads and a handle) hangs from the top-right of the intro area and swings ±3° (a 1.6s pendulum) when hovered. It's a `<button aria-pressed>` named "Safelight only". Pulling it puts a fixed overlay over the page (`background:#FF2A00; mix-blend-mode: multiply; pointer-events:none`) just below the loupe, so the whole page goes red-black and **the loupe becomes your white-light torch** (it sits above the overlay, untinted). Pull again to switch it off. Not persisted.

---

## 8. Interactions and navigation

### 8.1 Pointer
- Hover over a frame: it becomes active (§4.1), the circle draws, `tick` plays, and the browser prefetches (§8.3).
- Click: the `shutter` sound plays, and the view transition (§8.4) navigates to `/games/<slug>/`.

### 8.2 Keyboard
- Tab order: skip link → shell (brand, toggles) → each frame's card link in frame order → dictation card (not focusable unless it scrolls) → footer links.
- On a frame, focus has the same effect as hover. ←/→ (and ↑/↓ in one-column layouts) move focus between frame links: a small enhancement layered on normal Tab order, with no roving tabindex.

### 8.3 Prefetch
In `index.html`:

```html
<script type="speculationrules">
{ "prefetch": [ { "where": { "href_matches": "/games/*" }, "eagerness": "moderate" } ] }
</script>
```

Fallback where `HTMLScriptElement.supports?.('speculationrules')` is false: on `pointerenter`, `focus` or `touchstart` of a frame, add `<link rel="prefetch" href="/games/<slug>/">` once. Never prerender; the games are heavy.

### 8.4 View transition: "enlargement"
- Both pages opt in with `@view-transition { navigation: auto; }` (in `base.css`). It's off under reduced motion.
- The hub sets `view-transition-name: frame-<slug>` on each `.frame__image` (the six names are unique). Each game page sets the same name on its `#stage` (`[data-game="darkroom"] #stage { view-transition-name: frame-darkroom; }`, generated for all six in `base.css`). The shell bar is `ar-shell` on both pages, so it stays put.
- The result: the frame grows to fill the stage, landing on the game's black loader, and the game then develops in. Going back reverses it. Duration `--ar-dur-slow` with `--ar-ease-out`. `::view-transition-group(*) { animation-duration: var(--ar-dur-slow); animation-timing-function: var(--ar-ease-out); }`.
- On going back, the hub restores its scroll position (default browser behaviour) and re-activates the frame you came from (read `document.referrer` path, or `sessionStorage['ar:hub:last']` written on click).

### 8.5 Progress notes from games (optional contract)
A game may write `localStorage['ar:<slug>:hub']` = `{"note":"3 prints in the drawer","at":1760000000000}`. The note must be 28 characters or fewer, in sentence case. The hub shows it on that frame's bottom rebate in **white grease**, with a small tally mark, and adds it to the card's accessible description ("Your progress: 3 prints in the drawer"). If `at` is more than 60 days old, the note shows in pencil grey. Suggested notes: Texturedle "Solved today in 3", Darkroom "4 prints on the line", Halation "5 of 9 named", Latent Image "Night 3 of 7", Lens Bench "2 cameras built", Studio "11 photos developed". The hub never writes these keys.

---

## 9. The shared game shell (`src/shared/ui/shell.ts`)

Every game page mounts it. It's the film-strip header bar (art-direction §6.1). Built in plain DOM and CSS, no framework.

### 9.1 Files
```
src/shared/ui/
  fonts.ts          font imports (art-direction §3)
  tokens.css        token block (art-direction §4.1)
  base.css          reset, body, focus, buttons, switch, range, panel, dialog, toast, kbd, stage, view transitions
  theme.ts          getTheme / setTheme / onThemeChange / prefersReducedMotion / scheme lock
  shell.ts          mountShell(), shouldGameIgnoreKey()
  shell.css
  help.ts           datasheet dialog
  toast.ts          toast(), announce()
  menu.ts           overflow menu (popover)
  loader.ts         showLoader()
  fallback.ts       hasWebGL2(), showNoWebGL(), showCrashCard()
  icons.ts          SVG strings (art-direction §8)
  grease.ts         seeded hand-drawn paths (art-direction §6.3)
  grain.ts          paper grain tile
src/shared/audio/
  index.ts          getAudio(), sound prefs, uiSound() (art-direction §10)
src/shared/games.ts registry (§10). PURE DATA: no DOM, so vite.config.ts can import it.
```

### 9.2 API
```ts
import type { GameSlug } from '@shared/games';
import type { IconName } from './icons';

export interface ShellAction {
  id: string;
  label: string;                 // visible label (≤ 12 chars) and the base of its aria-label
  icon?: IconName;
  kind?: 'default' | 'primary' | 'toggle';
  pressed?: boolean;             // toggles only; sets aria-pressed
  disabled?: boolean;
  shortcut?: string;             // shown in the tooltip and the help table; the GAME handles the key
  priority?: number;             // 0 = most important; the highest numbers move to "More" first
  onSelect(): void;
}

export interface HelpContent {
  intro?: string;                // ≤ 2 sentences
  controls: Array<{ action: string; mouse?: string; touch?: string; keys?: string }>;
  tips?: string[];               // ≤ 4, one sentence each
}

export interface ShellOptions {
  slug: GameSlug;                // title, frame number, accent and scheme come from the registry
  actions?: ShellAction[];
  help?: HelpContent;
  helpOnFirstVisit?: boolean;    // default true: opens once, records ar:<slug>:seenHelp
  autoHide?: boolean | { idleMs: number };   // default false; idleMs default 2500
  fullscreen?: HTMLElement | null;           // default document.documentElement; null hides the button
  confirmLeave?: () => string | null;        // return a message to confirm on Back, or null to leave
  returnFocus?: () => void;      // called after a pointer-initiated action, e.g. () => stage.focus()
}

export interface Shell {
  readonly el: HTMLElement;
  readonly height: number;       // px including safe-area; also published as --ar-shell-total
  setStatus(text: string | null): void;           // visual only (timers etc.); not announced
  announce(text: string): void;                   // polite screen-reader announcement
  toast(text: string, opts?: { kind?: 'info' | 'success' | 'error'; ms?: number }): void;
  setActions(actions: ShellAction[]): void;
  updateAction(id: string, patch: Partial<ShellAction>): void;
  openHelp(): void;
  setAutoHide(on: boolean): void;
  reveal(): void;
  onSoundChange(cb: (muted: boolean) => void): () => void;
  destroy(): void;
}

export function mountShell(opts: ShellOptions): Shell;
export function mountHubShell(opts?: { onLoupeToggle?(on: boolean): void }): Shell;
export function shouldGameIgnoreKey(e: KeyboardEvent): boolean;
```

Typical use:

```ts
const shell = mountShell({
  slug: 'darkroom',
  actions: [
    { id: 'save', label: 'Save', icon: 'save', shortcut: 'Ctrl+S', priority: 1, onSelect: save },
    { id: 'import', label: 'Import', icon: 'import', priority: 2, onSelect: pickPng },
    { id: 'reset', label: 'Start fresh', icon: 'reset', priority: 3, onSelect: reset },
  ],
  help: {
    intro: 'Rock the tray to develop. Light is the enemy until the print is fixed.',
    controls: [
      { action: 'Tilt the tray', mouse: 'Drag a corner', touch: 'Drag, or tilt your phone', keys: 'W A S D' },
      { action: 'Room light', mouse: 'Click the switch', touch: 'Tap the switch', keys: 'L' },
    ],
  },
  returnFocus: () => stage.focus(),
});
shell.setStatus('DEVELOPING · 0:42');
```

### 9.3 DOM
```html
<header class="ar-shell" data-mode="game" role="banner">
  <div class="ar-film-bg" aria-hidden="true"></div>
  <a class="ar-shell__back ar-btn ar-btn--on-film" href="/" aria-label="Back to the contact sheet">
    <svg>…sheet…</svg><span class="ar-shell__back-label">Contact sheet</span>
  </a>
  <div class="ar-shell__id">
    <span class="ar-shell__frame" aria-hidden="true">▸02</span>
    <h1 class="ar-shell__title">Darkroom</h1>
  </div>
  <p class="ar-shell__status" aria-hidden="true"></p>
  <div class="ar-shell__actions" role="toolbar" aria-label="Game controls">
    <!-- action buttons, then: help, sound, lights (if not locked), fullscreen, more -->
  </div>
</header>
<div class="ar-live visually-hidden" role="status" aria-live="polite"></div>
```

The game page's **only `<h1>`** is the shell title.

### 9.4 Layout (content band 44px, perforation band 8px)
| Zone | Desktop (768px+) | Phone (under 768px) |
|---|---|---|
| Left | Back: `sheet` icon plus "Contact sheet" (Archivo label style) | icon only, 44×44 |
| Identity | `▸02` in edge print, `--game-accent-lit`. Title in Fraunces 600 18px, `--ar-on-film`. | title only, ellipsis-truncated |
| Status | centre, Plex Mono 500 13px, `--ar-on-film-2`, tabular. Hidden when null. | hidden unless no actions show; never pushes the title out |
| Actions | game actions as `--on-film` buttons (icon plus label at 1024px and up, icon only from 768px), then help `?`, sound, lights, fullscreen | help, sound, then **More ⋯** holding every game action plus lights and fullscreen |

- Overflow is automatic: actions are measured after layout, and the highest-`priority` ones move into More until the bar fits. A `ResizeObserver` re-runs this.
- Horizontal padding: `max(8px, env(safe-area-inset-left))` / `-right`. Top: `env(safe-area-inset-top)` added to the bar's height.
- An accent dot (6px, `--game-accent-lit`) sits before `▸02` at 768px and up.

### 9.5 Behaviour
- **Back:** a normal link (middle-click and new tab work). Plays `advance`. If `confirmLeave()` returns a message, the shell intercepts a plain left click and opens a small datasheet dialog with the message, **Stay** (primary) and **Leave**. Prefer autosave on `pagehide` over confirm prompts. Never use native `beforeunload` for in-app back.
- **Help:** `?` button. `Shift+/` opens it unless `shouldGameIgnoreKey` says otherwise. If `helpOnFirstVisit`, it opens once after the game's first `ready`. The datasheet header reads `RANKIN 400 · DATASHEET · ▸02 DARKROOM`.
- **Sound:** toggles the global mute (art-direction §10). The icon swaps between `sound` and `sound-off`. `aria-pressed` reflects the **muted** state, label "Mute sound".
- **Lights:** shown only when the registry scheme is `auto` and the page has no `data-scheme-lock`. It flips `ar:theme`. The icon swaps between `lights` and `safelight`.
- **Fullscreen:** shown only if `document.fullscreenEnabled` (so hidden on iPhone). It toggles `requestFullscreen` on the target. In fullscreen, the shell auto-hides.
- **Auto-hide:** when enabled, after `idleMs` with no pointer activity over the bar and no focus, menu or dialog open, the bar slides up by `--ar-shell-h − 8px` (`--ar-dur-base`), leaving only the **perforation row** showing as a peek tab. It reveals when the pointer is within 56px of the top, on a tap of the peek tab, on focus-within, or on `shell.reveal()`. Under reduced motion it changes instantly.
- **Keys:** the shell never calls `preventDefault` on keys outside itself. Games call `shouldGameIgnoreKey(e)` first. It returns true when the target is an `input`, `textarea`, `select` or `[contenteditable]`, or sits inside `.ar-shell`, `dialog[open]` or `[popover]`.
- **Focus return:** after a pointer-initiated shell action, call `opts.returnFocus?.()` so the game keeps keyboard control.
- **Theme lock:** `mountShell` applies the registry scheme. If it's `dark` or `light`, it sets `data-scheme-lock` and `data-theme` on `<html>` (the page should also have them in its HTML to avoid a flash).

### 9.6 Hub mode (`mountHubShell`)
- Left: the brand mark (favicon art, 24px), then edge print `RANKIN 400 · ROLL 01`. When the H1 scrolls out of view (an `IntersectionObserver`), **"Andrew Rankin"** in Fraunces 600 18px slides in beside the mark (opacity plus `8px × motion-scale` over `--ar-dur-base`). It's a link to `/` with `aria-current="page"`.
- Centre (1024px and up): edge print `06 EXP. · CONTACT SHEET`, in `--ar-on-film-3`.
- Right: **loupe** toggle (fine pointer only, `aria-pressed`, label "Loupe"), sound, lights.

### 9.7 Shell CSS essentials
```css
.ar-shell { position: fixed; inset: 0 0 auto 0; z-index: var(--ar-z-shell);
  height: var(--ar-shell-total); padding: env(safe-area-inset-top, 0px) max(8px, env(safe-area-inset-right)) var(--ar-shell-perf-h) max(8px, env(safe-area-inset-left));
  display: flex; align-items: center; gap: 8px; color: var(--ar-on-film); view-transition-name: ar-shell;
  transition: translate var(--ar-dur-base) var(--ar-ease-out); }
.ar-shell[data-hidden] { translate: 0 calc(-1 * (var(--ar-shell-total) - var(--ar-shell-perf-h))); }
.ar-shell > :not(.ar-film-bg) { position: relative; }            /* above the masked film */
.ar-shell :focus-visible { outline-color: var(--ar-focus-on-film); }
.ar-shell__title { font: var(--ar-w-semibold) 1.125rem/1 var(--ar-font-display); font-variation-settings: 'SOFT' 50;
  letter-spacing: -0.01em; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; height: 1.2em; }
.ar-shell__frame, .ar-shell .ar-edge { font: var(--ar-w-bold) var(--ar-text-2xs)/1 var(--ar-font-ui); font-stretch: var(--ar-stretch-edge);
  letter-spacing: var(--ar-tracking-edge); text-transform: uppercase; font-variant-numeric: tabular-nums; }
.ar-shell__frame { color: var(--game-accent-lit); }
.ar-shell__status { margin: 0 auto; font: var(--ar-w-medium) 0.8125rem/1 var(--ar-font-mono); color: var(--ar-on-film-2); font-variant-numeric: tabular-nums; }
.ar-shell__actions { margin-left: auto; display: flex; gap: 2px; }
```

---

## 10. Game registry (`src/shared/games.ts`)

The single source of truth for the hub, the shell, page metadata, posters and OG cards. Pure data, safe to import from `vite.config.ts`.

```ts
export type GameSlug = 'texturedle' | 'darkroom' | 'plates' | 'latent' | 'lensbench' | 'studio';
export type GreaseMark = 'question' | 'check' | 'crop' | 'arrow' | 'underline' | 'star';

export interface GameInfo {
  slug: GameSlug;
  frame: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;               // the game lead owns this
  noteName: string;            // Andrew's plain name, used in the kicker; fixed
  tagline: string;             // ≤ 60 chars
  blurb: string;               // 35–50 words; the hub caption
  description: string;         // ≤ 155 chars; <meta name=description> and OG
  meta: [string, string, string];
  greaseMark: GreaseMark;
  greaseNote: string;          // ≤ 6 words
  edgeJoke: string;            // ≤ 30 chars, all caps
  scheme: 'auto' | 'light' | 'dark';
  accent: string;              // mirrors --ar-game-<slug> (light value) for canvas use
  accentLit: string;           // mirrors --ar-game-<slug>-lit
  status: 'developing' | 'ready';
  credit?: string;
}

export const SITE = {
  title: 'Andrew Rankin · Minigame Collection',
  tagline: 'Six photographic toys, thought up at the kitchen sink.',
  stock: 'RANKIN 400',
  roll: 'ROLL 01',
  repoUrl: '',                 // fill in once the GitHub repo exists
};

export const GAMES: readonly GameInfo[] = [
  { slug: 'texturedle', frame: 1, title: 'Texturedle', noteName: 'Texture-dle',
    tagline: 'One surface a day, much too close.',
    blurb: "A photograph taken far too close to something you've definitely touched. Tilt the camera five degrees, roll a marble across the grain, drag a fine cloth and a rough one over it, then name the surface before your guesses run out.",
    description: 'A daily guessing game played by touch: tilt, roll a marble and drag cloth across an extreme close-up, then name the surface.',
    meta: ['Puzzle', 'Daily', '~5 min'], greaseMark: 'question', greaseNote: 'too close?',
    edgeJoke: 'TOO CLOSE TO FOCUS · 0.3 MM', scheme: 'auto', accent: '#A84B22', accentLit: '#EA8A5F', status: 'developing' },
  { slug: 'darkroom', frame: 2, title: 'Darkroom', noteName: 'Darkroom',
    tagline: 'A darkroom you can slosh.',
    blurb: 'Bring your own picture. Drop in a PNG, prep it, then print it in silver under the safelight or in iron as a cyanotype, rocking the tray until the Prussian blue blooms. Every drop of chemistry is simulated, and the bench saves where you left it.',
    description: 'A hands-in-the-tray darkroom toy: import a PNG, then print it in silver or as a cyanotype with simulated, sloshing chemistry.',
    meta: ['Toy', 'Chemistry', 'Saves'], greaseMark: 'check', greaseNote: 'cyanotype, not cyanide',
    edgeJoke: 'DO NOT WASH WITH DISHES', scheme: 'dark', accent: '#1F4F99', accentLit: '#86ABF0', status: 'developing' },
  { slug: 'plates', frame: 3, title: 'Halation', noteName: 'Darkroom, 1-bit',
    tagline: 'Old glass plates that saw everything.',
    blurb: 'A crate of exposed glass plates that nobody ever developed. Bring each one up in a two-tone, one-bit darkroom, step inside the moment it froze, and work out who everyone was and what became of them. The better you develop, the more you can see.',
    description: 'A one-bit darkroom mystery: develop old glass plates, step into the moments they froze, and work out who everyone was.',
    meta: ['Mystery', '1-bit', 'Deduction'], greaseMark: 'crop', greaseNote: 'count the faces',
    edgeJoke: 'HANDLE GLASS BY THE EDGES', scheme: 'dark', accent: '#2E2C28', accentLit: '#E6DFCB', status: 'developing' },
  { slug: 'latent', frame: 4, title: 'Latent Image', noteName: 'Police story',
    tagline: 'Nothing is evidence until you develop it.',
    blurb: "An old case, a police photo archive and a search box. Type a word, pull up negatives and records in any order, and print what nobody bothered to look at. Each print gives you the next word. The story is in there. It just hasn't come up yet.",
    description: 'A police story told through an archive: search, print forgotten negatives, and develop the case in any order you like.',
    meta: ['Story', 'Search', 'Mystery'], greaseMark: 'arrow', greaseNote: 'print this one',
    edgeJoke: 'EXHIBIT ▸04A · DO NOT FOLD', scheme: 'dark', accent: '#8A5E00', accentLit: '#E9B04A', status: 'developing' },
  { slug: 'lensbench', frame: 5, title: 'Lens Bench', noteName: 'Camera designer',
    tagline: 'Build the glass. Shoot the yard.',
    blurb: 'Slide lenses along an optical rail and watch real rays bend, focus and fringe. Choose an aperture and a shutter, bolt on a body, then carry your camera into a small 3D backyard, take actual photographs with every flaw you built in, and develop the roll.',
    description: 'Design a camera from the glass up, watch real rays bend, then shoot and develop photos in a small 3D backyard.',
    meta: ['Toy', 'Optics', '3D'], greaseMark: 'underline', greaseNote: 'f/1.4 or bust',
    edgeJoke: 'CIRCLE OF CONFUSION ≤ 0.03', scheme: 'auto', accent: '#5B3FA6', accentLit: '#AE97F2', status: 'developing' },
  { slug: 'studio', frame: 6, title: 'The Studio', noteName: 'The whole studio',
    tagline: 'Build it, shoot it, print it.',
    blurb: 'The whole studio in one little house. Build a camera in the workshop, rig the backyard so something wonderful happens in front of the lens, then carry the roll down to the darkroom to find out whether you caught it. Every room is a physics toy.',
    description: 'A physics-toy photo studio: build a camera, rig the backyard, shoot, and develop the roll in the darkroom.',
    meta: ['Sandbox', 'Physics', '3 rooms'], greaseMark: 'star', greaseNote: "the friend's pick",
    edgeJoke: "FRIEND'S FRAME · NOT DICTATED", scheme: 'auto', accent: '#2C7547', accentLit: '#78CB97', status: 'developing',
    credit: "Frame 06 wasn't in the dictation. The friend holding the phone asked for it." },
];
export const gameBySlug = (s: GameSlug) => GAMES.find((g) => g.slug === s)!;
```

Each game flips `status` to `'ready'` when it ships. That removes the IN THE TRAY stamp.

**Static rendering:** the hub's frame markup is generated **at build time** from `GAMES` by a small `transformIndexHtml` plugin in `vite.config.ts`, which replaces `<!--frames-->` in `index.html`. All copy is then in the HTML for SEO, no-JS visitors and instant paint. JavaScript only enhances it with previews, grease, the loupe and sound. The same plugin can fill `<title>`, description and OG tags in each `games/<slug>/index.html` from the registry, so the copy never drifts.

---

## 11. Thumbnail strategy

Three tiers, plus one optional extra:

| Tier | What | Who builds it | Used for |
|---|---|---|---|
| **1. Procedural preview loops** (§4.2–4.3) | Hub-owned 2D canvas "photographs" of each game, deterministic | the hub team | **The live frames on the contact sheet**, in both B&W and colour. They work before the games exist, weigh a few KB each, stay crisp in the loupe, and cost no WebGL contexts. |
| **2. Real posters** | A Playwright capture of each actual game in a hero composition | a script by the hub team; a hook by each game team | social/OG images, `<noscript>` and no-canvas fallback, and a phase-2 reference for tuning tier 1 |
| **3. OG cards** | A 1200×630 composition: the poster on a RANKIN 400 strip with edge print, title and tagline | the hub (`?og=<slug>` mode) plus the script | `og:image` for the hub and every game |
| *Optional extra: live peek* (M4 stretch, off by default) | The real game in an `<iframe>` inside the frame | hub plus games | desktop only. See §11.4. |

### 11.1 Game-side contract (additions to each game's `window.__game`)
- `__game.ready: boolean`. True once the first real frame has rendered. (Several concept docs already have it.)
- `__game.poster?(): Promise<void>`. Puts the game into its **hero composition**: fixed seed, a flattering camera, no UI overlays, nothing mid-transition, and **no spoilers** (Texturedle must not show a real puzzle answer; the mysteries must not show a solution). It resolves when the frame is stable.
- When the URL has `?embed=poster`, the page skips the help-on-first-visit, hides the shell (`.ar-shell { display:none }` and the stage at `inset: 0`), disables audio, and doesn't read or write saves.

### 11.2 `scripts/posters.mjs` (Playwright, run locally or in CI; outputs are committed)
For each slug:
1. Open `/games/<slug>/?embed=poster&motion=reduce` at 1200×800 with DPR 1 and `--use-angle=swiftshader` (the same flags as `shoot.mjs`).
2. Wait for `window.__game?.ready === true`, with a 30s timeout. On timeout, log it and skip that slug.
3. `await __game.poster?.()`, then wait 2 rAFs.
4. Screenshot `#stage` as JPEG, quality 84 → `public/posters/<slug>.jpg`, aiming for under 140KB.
5. Open `/?og=<slug>` at 1200×630 → `public/og/<slug>.jpg`.

Then `/?og=hub` → `public/og/hub.jpg` (the whole sheet, cropped), and the favicon art at 180×180 → `public/apple-touch-icon.png`. Add an npm script: `"posters": "node scripts/posters.mjs"`.

**`?og=` mode** on the hub: it renders only an OG composition at a fixed 1200×630 size. For a game: one frame enlarged on a strip, with the poster image as the frame content (or its procedural preview at `heroT` when no poster exists), and edge print `RANKIN 400 ▸0N`. Title in Fraunces 600 72px, tagline in Fraunces italic 32px, both on the exposed black. For the hub: the two-strip sheet with the wordmark. Sets `__game.ready` when done.

### 11.3 Image specs
- Posters: 1200×800 JPEG, quality 84, sRGB.
- OG: 1200×630 JPEG, quality 86.
- In `<noscript>` the hub shows `<img src="/posters/<slug>.jpg" loading="lazy" decoding="async" alt="">` inside the frame. The alt is empty because the card link carries the name.

### 11.4 Live peek (stretch, behind `HUB_FLAGS.livePeek = false`)
Only when **all** of these hold: fine pointer; `navigator.deviceMemory >= 4` (or undefined); not `saveData`; not reduced motion; hovered for over 700ms; and the game is `status: 'ready'` and supports `?embed=preview` (an attract mode: no shell, no audio, no saves, low DPR, no input capture, a deterministic loop). The hub then creates **one** iframe (`/games/<slug>/?embed=preview`, `loading="eager"`, `allow=""`, `tabindex="-1"`, `aria-hidden`) behind the preview canvas, and crossfades to it once the iframe posts `{type:'ar:ready'}`. It's removed 1.5s after the pointer leaves. There's never more than one at a time. The loupe shows the canvas preview, not the iframe.

---

## 12. Accessibility

- **Landmarks:** `header` (shell, banner), `main`, `footer` (contentinfo). Skip link **Skip to the games** (`.ar-skip`: visually hidden until focused, then a film-black pill at the top left).
- **Headings:** `h1` is the wordmark "Andrew Rankin". `h2` "Roll 01: six games" is visually hidden; the edge print shows it instead. Each frame title is an `h3`.
- **Card link pattern:** each frame is `<li><article aria-labelledby="t-<slug>" aria-describedby="b-<slug> p-<slug>">`. The **only link** is inside the `h3`: `<a href="/games/<slug>/" id="t-<slug>">Texturedle</a>`. Its `::after` stretches over the whole cell (strip plus caption) as the click and tap area. The visible `PLAY ▸` is `aria-hidden`. Focus styling uses `article:focus-within`: the grease circle, plus a 2px `--ar-focus-on-film` outline around the image, offset 3px.
- **Hidden from assistive tech:** canvases, perforations, edge print, DX bars, grease marks and notes, the loupe, the stamp and the pencil note. The dictation card is real text (`figure` > `blockquote` + `figcaption`), with its corrections given as visually hidden text.
- **Contrast:** every text pair meets 4.5:1, and large text 3:1 (art-direction §4.4). Blurbs on exposed black are 9.6:1.
- **Motion:** honour reduced motion (§4.1, §6.1, §7, §8.4). Nothing auto-plays sound. Nothing flashes.
- **Zoom and reflow:** works at 400% zoom (320 CSS px) with no horizontal scroll. The sheet drops to 1 column. Edge print may get tiny, since it's decorative.
- **Forced colours** (`@media (forced-colors: active)`): hide grain, glow, grease and perforations; frames get `1px solid CanvasText`; focus uses `Highlight`; previews stay (they're images).
- **Touch targets:** whole cards; shell buttons are 44×44 or larger.
- **Language:** `lang="en-CA"`.
- **Pass criteria:** axe-core shows no violations, the Tab order matches §8.2, and VoiceOver or NVDA reads each card as "Texturedle, heading level 3, link, *blurb*, Puzzle · Daily · ~5 min".

---

## 13. Mobile specifics
- One frame per strip, both ends cut, 16px page gutters, and an 8px paper border.
- Scroll-centre activation gives each frame its moment of colour as you scroll. That's the mobile version of hover.
- Press and hold for the loupe, raised above the finger, with haptics.
- No loupe button in the shell, and the hint text changes (§2.1).
- Use `100svh` for anything viewport-sized, so mobile browser bars never cut content.
- Avoid accidental navigation while scrolling: navigate on `click`, not `pointerup`, and treat any pointer movement over 10px as a scroll.
- The dictation card moves below the sheet. The footer stacks.
- Test at 360×740, 390×844 and 430×932, plus a 768×1024 tablet.

---

## 14. Performance
| Budget | Target |
|---|---|
| Hub JS (shell, hub, previews; gzip) | 70KB or less. **No `three` and no `rapier` in the hub bundle.** Check the build output. |
| Hub CSS (gzip) | 20KB or less |
| Fonts on the hub (woff2, latin) | 250KB or less. If Fraunces `full` puts it over, switch to `opsz` axes only and drop SOFT/WONK. |
| Images on first load | none (posters only under `<noscript>`) |
| LCP (Lighthouse mobile, Moto G-class, fast 4G) | 2.0s or less. The LCP element is the H1 or the intro text, which is in static HTML. |
| CLS | under 0.02 (the strips reserve space via `aspect-ratio`; the shell is fixed height) |
| INP | under 150ms |
| Preview cost | 6ms or less per frame for all previews at idle on a mid-range phone, with adaptive degrade (§4.2) |

Other rules: one rAF loop; `IntersectionObserver`-gated work; `document.hidden` pauses everything; no layout reads in the rAF loop except the cached sheet rect (refreshed on scroll or resize via a passive listener); and `content-visibility: auto` on the footer and dictation card.

---

## 15. Hub debug API (`window.__game` on `/`)
```ts
window.__game = {
  ready: boolean,                                  // fonts loaded + all previews initialized
  state(): { theme: 'light' | 'dark'; active: GameSlug | null; loupe: { on: boolean; x: number; y: number } | null; cols: 1 | 2 | 3 },
  activate(slug: GameSlug | null): void,
  freeze(t: number | null): void,                  // all previews draw at loop time t (deterministic shots)
  loupeAt(x: number, y: number): void,             // show the loupe at viewport coords; loupeAt(-1,-1) hides it
  setTheme(t: 'light' | 'dark' | null): void,
  safelight(on: boolean): void,
};
```

URL switches: `?t=<seconds>` (freeze), `?theme=light|dark`, `?motion=reduce`, `?og=<slug|hub>`, `?loupe=x,y`.

Screenshot set for review rounds:

```
node scripts/shoot.mjs "/?t=3" --out shots/hub-desktop.png --full
node scripts/shoot.mjs "/?t=3&theme=dark" --out shots/hub-desktop-dark.png --full
node scripts/shoot.mjs "/?t=3" --mobile --out shots/hub-mobile.png --full
node scripts/shoot.mjs "/?t=3&loupe=420,520" --out shots/hub-loupe.png
node scripts/shoot.mjs "/?t=3" --steps '[{"eval":"__game.activate(\"darkroom\")"},{"wait":1200},{"shot":"shots/hub-active.png"}]'
```

---

## 16. Build order for the hub team
1. **M1, static and correct** (no JS needed to read and navigate): tokens, base, fonts; the shell in hub mode; the registry plus the `transformIndexHtml` frame injection; sheet geometry, perforations, edge print, captions and paper furniture; the intro, the dictation card and the footer; all three layouts; accessibility. Previews show the "developing" placeholder.
2. **M2, alive:** the preview runner and the six storyboards; B&W-to-colour activation (hover, focus and scroll-centre); the grease layer (circles, permanent marks, the dictation checks); UI sounds; prefetch; view transitions; the debug API.
3. **M3, delight:** the loupe (desktop and touch); the power-on flicker; progress notes; the 404 page; `?og` mode plus `scripts/posters.mjs`.
4. **M4, stretch:** the safelight Easter egg; live peek.

Acceptance checklist: zero console errors in every screenshot run; the first strip is above the fold at 1440×900 and frame 1 at 390×844; Lighthouse accessibility ≥ 95; the budgets in §14 hold; the reduced-motion and forced-colours passes have been checked by eye; every game page mounts the shell and passes art-direction §11.
