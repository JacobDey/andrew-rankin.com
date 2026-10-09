# Art direction: Roll 01

The shared look, sound and feel of the Andrew-Rankin.com chrome. It covers every pixel that is **not** inside a game's own world: the header, menus, back-to-hub, buttons, dialogs, toasts, loaders, error cards, typography, colour tokens, motion and UI sound. Each game keeps its own in-game look (see section 12).

> **The rule of thumb: the chrome is the film, and the game is the picture.**
> Everything shared looks like the physical stuff of photography (film rebate, sprocket holes, edge printing, photo paper, grease pencil, the light table, the safelight). Every game is one exposure on that roll and can look like anything.

Companion doc: `docs/design/hub.md` covers the landing page, the shared game shell component, the game registry and the thumbnail strategy.

---

## 1. The idea: one roll of film

The collection is **Roll 01**: six exposures on a fictional film stock called **RANKIN 400**. The hub is the roll's contact sheet. Each game page is one frame enlarged. Each item in the vocabulary below has exactly one job. Don't add others; restraint is what keeps the metaphor charming.

| Material | Job in the chrome | Where it appears |
|---|---|---|
| **Film rebate** (near-black film edge) | Shared header bar, toasts, loaders, the hub's strips | `.ar-shell`, `.ar-toast`, loader, hub sheet |
| **Sprocket holes** (perforations) | Brand signature. One row along the bottom edge of the header, plus the strips on the hub | Shell, hub, loader, favicon |
| **Edge printing** (tiny condensed caps) | Metadata: frame numbers, game codes, status | Shell frame code, hub strips, help dialog header |
| **Photo paper** (warm off-white) | Surfaces people read: panels, dialogs, help, cards | `.ar-panel`, `.ar-dialog` |
| **Grease pencil** (waxy red/yellow handwriting) | Human annotation: highlight, encouragement, jokes. Never controls. | Hub circles and notes, celebratory moments |
| **Light table** (warm backlit glow) | The light-theme page background | Hub, light-scheme game pages |
| **Safelight** (amber-red glow in the dark) | The dark-theme accent and ambient glow | Dark scheme everywhere |
| **Loupe** | Magnifying and inspecting | Hub only. Games may reuse the idea. |

The fake stock name **RANKIN 400** is the brand. It appears in edge printing and nowhere else as a "logo". Andrew's name in full ("Andrew Rankin") is the wordmark.

---

## 2. Voice and copy rules

- **Language:** Canadian English (colour, centre, grey, metre, favourite; "-ize" verbs). Use sentence case everywhere except edge printing, which is ALL CAPS.
- **Tone:** warm, concrete, a little dry. Describe what your hands do, not what the software does. Write "Rock the tray", not "Agitate the developer solution".
- **Lengths:** buttons 1–2 words. Toasts 7 words or fewer. Grease-pencil notes 6 words or fewer. Help sections 3 sentences or fewer each.
- **Frame codes:** write `▸02` (U+25B8 + two digits) in edge printing and `02` elsewhere. Game numbers are always two digits.
- **No exclamation marks** in UI text. Grease pencil may have one, because handwriting is allowed to be excited.
- **Stock phrases.** Use these instead of inventing synonyms, so the collection sounds like one place:

| Situation | Text |
|---|---|
| Back to hub | **Contact sheet** (aria-label: "Back to the contact sheet") |
| Generic loading | **Winding on…** (games may swap in their own: "Mixing chemistry…", "Warming up the enlarger…") |
| Saved | **Saved to the drawer.** |
| Loaded | **Back where you left it.** |
| Reset or clear | **Start fresh** (button) / **Tray emptied.** (toast) |
| Generic error | **The film jammed.** + a sentence + **Reload** |
| No WebGL2 | See §7.9 |
| Help button | **How to play** (tooltip and aria-label), shown as `?` |
| Sound toggle | **Sound on** / **Sound off** |
| Theme toggle | **Lights on** (light theme) / **Lights off** (dark theme) |

---

## 3. Typography

Four families. All four are Google Fonts. We **self-host them through Fontsource**: the same font files, bundled by Vite, so there's no third-party request, Playwright screenshots stay deterministic offline, and the files get fingerprinted for caching.

| Role | Family | Weights / axes used | Fontsource import | CSS family name |
|---|---|---|---|---|
| **Display**: wordmark, game titles, dialog titles | **Fraunces** (variable) | wght 300–900, opsz 9–144, SOFT, WONK; italic | `@fontsource-variable/fraunces/full.css` + `@fontsource-variable/fraunces/full-italic.css` | `'Fraunces Variable'` |
| **UI**: body, buttons, labels, edge printing | **Archivo** (variable) | wght 400–800, wdth 62–125 | `@fontsource-variable/archivo/wdth.css` | `'Archivo Variable'` |
| **Mono**: readouts, timers, timecodes, `<kbd>` | **IBM Plex Mono** | 400, 500, 600 | `@fontsource/ibm-plex-mono/400.css`, `500.css`, `600.css` | `'IBM Plex Mono'` |
| **Hand**: grease pencil only | **Caveat** (variable) | wght 400–700 | `@fontsource-variable/caveat` | `'Caveat Variable'` |

Install: `npm i @fontsource-variable/fraunces @fontsource-variable/archivo @fontsource-variable/caveat @fontsource/ibm-plex-mono`. Fontsource's axis file names (`full.css`, `wdth.css`, `full-italic.css`) have changed between versions, so check each package's `package.json` `exports` or file list and use the file that includes the axes listed above. All imports live in one module, `src/shared/ui/fonts.ts`, and every page imports that module.

**Equivalent Google Fonts URL** (fallback only, for example if a Fontsource package is missing):

```
https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Caveat:wght@400..700&family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap
```

The stacks in §4 list both the Fontsource names and the plain Google names, so either loading path works.

### Type roles (exact settings)

| Style | Family | Size token | Weight | Other |
|---|---|---|---|---|
| Wordmark (hub H1) | Fraunces | `--ar-text-display` | 640 | `font-variation-settings: 'SOFT' 30, 'WONK' 1`, tracking `-0.03em`, leading `0.9` |
| Page/game title (shell H1) | Fraunces | 1.125rem (18px) | 600 | `'SOFT' 50`, tracking `-0.01em` |
| Section title (H2) | Fraunces | `--ar-text-2xl` | 560 | tracking `-0.02em`, leading `1.05` |
| Card/frame title | Fraunces | `--ar-text-xl` | 600 | leading `1.1` |
| Tagline / kicker phrase | Fraunces *italic* | `--ar-text-xl` | 400 | `'SOFT' 100` |
| Body | Archivo | `--ar-text-md` (16px) | 400 | `font-stretch: 100%`, leading `1.55`, max `62ch` |
| Small body | Archivo | `--ar-text-sm` | 400 | leading `1.5` |
| Button / label | Archivo | 0.8125rem (13px) | 650 | `font-stretch: 87.5%`, UPPERCASE, tracking `0.06em` |
| **Edge print** | Archivo | 0.6875rem (11px) minimum | 700 | `font-stretch: 75%`, UPPERCASE, tracking `0.16em`, `font-variant-numeric: tabular-nums` |
| Readout / timer | Plex Mono | context | 500 | `tabular-nums`, `slashed-zero` |
| Grease pencil | Caveat | 20px minimum | 600–700 | rotated −4° to +3°. Never longer than six words. Never body copy, never controls. |

Rules:
- Fraunces never goes below 16px. Below that, use Archivo.
- Edge print is the only ALL-CAPS-plus-wide-tracking style. Don't fake it with other families.
- Numbers that change (timers, counters, exposure readouts) are always tabular, in either Plex Mono or Archivo with `tabular-nums`.
- Load order: Archivo first (UI), then Fraunces, then the rest. `font-display: swap` is Fontsource's default. Size the shell title box with a fixed height so a font swap can't shift layout.
- Games may add **one** in-world typeface of their own (for example a period serif for Plates, or a terminal face for Latent Image) for diegetic text only. Chrome text always uses the four families above.

---

## 4. Colour

Two moods: **Light table** (light theme, warm backlit paper) and **Darkroom** (dark theme, near-black with an amber-red safelight). The **film** colours (rebate, edge print, exposed black) are the same in both themes. Film is film.

- **Primary accent:** *grease red* in light mode, *safelight* in dark mode. Use it for primary buttons, the active state and the hub's kicker line.
- **Focus:** *cyanotype blue*. It's deliberately a different hue from the accent, so the focus ring never reads as an error or a selection.
- **Game accents:** one hue per game, used for that game's frame number, CTA and accent dot (§4.3). Each has a theme-aware value, plus a `-lit` value that is always safe on film black.

All pairs below were checked against WCAG 2.2 (ratios in §4.4).

### 4.1 The token block (exact; this is `src/shared/ui/tokens.css`)

```css
/* =====================================================================
   Andrew-Rankin.com: design tokens v1 (src/shared/ui/tokens.css)
   Import before any other CSS on every page.
   ===================================================================== */
:root {
  color-scheme: light;

  /* ---- Families ---- */
  --ar-font-display: 'Fraunces Variable', 'Fraunces', ui-serif, Georgia, 'Times New Roman', serif;
  --ar-font-ui: 'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --ar-font-mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  --ar-font-hand: 'Caveat Variable', 'Caveat', 'Segoe Print', 'Bradley Hand', cursive;

  /* ---- Weights & widths ---- */
  --ar-w-regular: 400;
  --ar-w-medium: 500;
  --ar-w-semibold: 600;
  --ar-w-label: 650;
  --ar-w-bold: 700;
  --ar-w-display: 640;
  --ar-stretch-body: 100%;
  --ar-stretch-label: 87.5%;
  --ar-stretch-edge: 75%;

  /* ---- Type scale ---- */
  --ar-text-2xs: 0.6875rem;                                   /* 11px edge print floor */
  --ar-text-xs: 0.75rem;                                      /* 12 */
  --ar-text-sm: 0.875rem;                                     /* 14 */
  --ar-text-md: 1rem;                                         /* 16 body */
  --ar-text-lg: 1.1875rem;                                    /* 19 */
  --ar-text-xl: clamp(1.375rem, 1.2rem + 0.75vw, 1.75rem);    /* 22 to 28 */
  --ar-text-2xl: clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem);      /* 28 to 40 */
  --ar-text-3xl: clamp(2.25rem, 1.6rem + 3vw, 4rem);          /* 36 to 64 */
  --ar-text-display: clamp(3rem, 1.9rem + 5.6vw, 7.5rem);     /* 48 to 120 */
  --ar-leading-tight: 1.05;
  --ar-leading-snug: 1.25;
  --ar-leading-body: 1.55;
  --ar-tracking-display: -0.03em;
  --ar-tracking-label: 0.06em;
  --ar-tracking-edge: 0.16em;

  /* ---- Space (4px base) ---- */
  --ar-space-1: 4px;
  --ar-space-2: 8px;
  --ar-space-3: 12px;
  --ar-space-4: 16px;
  --ar-space-5: 24px;
  --ar-space-6: 32px;
  --ar-space-7: 48px;
  --ar-space-8: 64px;
  --ar-space-9: 96px;
  --ar-space-10: 128px;
  --ar-gutter: clamp(16px, 4vw, 40px);   /* page side padding; 16px minimum on phones */
  --ar-maxw: 1200px;                      /* hub content width */
  --ar-measure: 62ch;                     /* body text line length */
  --ar-tap: 44px;                         /* minimum touch target */

  /* ---- Radii ---- */
  --ar-radius-xs: 2px;     /* film frame corners, kbd */
  --ar-radius-sm: 4px;     /* buttons, inputs: camera-button squared */
  --ar-radius-md: 8px;     /* panels, menus */
  --ar-radius-lg: 14px;    /* dialogs */
  --ar-radius-round: 999px;

  /* ---- Shell geometry ---- */
  --ar-shell-h: 52px;                     /* 44px content band + 8px perforation band */
  --ar-shell-perf-h: 8px;
  --ar-shell-total: calc(var(--ar-shell-h) + env(safe-area-inset-top, 0px));

  /* ---- Layers ---- */
  --ar-z-stage: 0;
  --ar-z-hud: 10;
  --ar-z-shell: 100;
  --ar-z-popover: 200;
  --ar-z-toast: 300;
  --ar-z-loupe: 400;                      /* hub only; dialogs use the top layer */

  /* ---- Motion (see section 9) ---- */
  --ar-dur-press: 90ms;
  --ar-dur-quick: 160ms;
  --ar-dur-base: 240ms;
  --ar-dur-slow: 420ms;
  --ar-dur-draw: 480ms;                   /* grease pencil stroke */
  --ar-dur-develop: 900ms;                /* image coming up in the tray */
  --ar-ease-out: cubic-bezier(0.16, 0.84, 0.3, 1);
  --ar-ease-in: cubic-bezier(0.5, 0, 0.75, 0);
  --ar-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ar-ease-develop: cubic-bezier(0.35, 0, 0.15, 1);
  --ar-ease-settle: linear(0, 0.14 6%, 0.72 13%, 0.94 17%, 1.02 20%, 1.04 23%, 1.03 27%, 1 36%, 1);  /* 4% overshoot, then rest */
  --ar-motion-scale: 1;                   /* multiply every travel distance by this */

  /* ---- FILM: identical in both themes ---- */
  --ar-film: #121110;              /* rebate: shell bar, toasts, strips */
  --ar-film-2: #22201D;            /* hover/raised on film */
  --ar-film-3: #2E2B27;            /* pressed on film, separators */
  --ar-exposed: #0B0A09;           /* contact-sheet black between strips */
  --ar-on-film: #EDE4D3;           /* text on film 14.9:1 */
  --ar-on-film-2: #A99F90;         /* secondary text on film 7.2:1 */
  --ar-on-film-3: #7A7064;         /* decorative edge print only (4.1:1); never essential text */
  --ar-edge-print: #D9CFBF;        /* edge print on rebate 12.2:1 */
  --ar-focus-on-film: #8CB2FF;     /* focus ring on film 9.4:1 */
  --ar-grease-red-lit: #FF5D49;    /* grease on black 6.7:1 */
  --ar-grease-yellow: #F2C443;     /* grease on black 12.0:1 */
  --ar-grease-white: #F4EFE6;
  --ar-graphite: #5A544D;          /* pencil on paper 7.0:1 */
  --ar-tape: rgb(236 222 186 / 0.86);   /* masking tape */

  /* ---- Game accents, LIT variants (always safe on film/exposed black) ---- */
  --ar-game-texturedle-lit: #EA8A5F;
  --ar-game-darkroom-lit:   #86ABF0;
  --ar-game-plates-lit:     #E6DFCB;
  --ar-game-latent-lit:     #E9B04A;
  --ar-game-lensbench-lit:  #AE97F2;
  --ar-game-studio-lit:     #78CB97;

  /* =================== LIGHT THEME: "Light table" =================== */
  --ar-bg: #F3EDE2;                /* page; the light table at rest */
  --ar-glow: #FFFBF2;              /* light-table hot centre (radial) */
  --ar-glow-halo: rgb(255 249 232 / 0.95);
  --ar-surface: #FBF8F2;           /* paper: panels, dialogs */
  --ar-surface-2: #EAE3D6;         /* wells, inputs, inactive tracks */
  --ar-ink: #1B1815;               /* text 15.2:1 on bg */
  --ar-ink-2: #4A433C;             /* secondary 8.4:1 */
  --ar-ink-3: #6B6359;             /* tertiary/meta 5.1:1 (4.6:1 on surface-2) */
  --ar-line: #D8CFC1;              /* hairlines, decorative only */
  --ar-line-strong: #8A7F70;       /* input borders, control outlines 3.4:1 */
  --ar-accent: #BE3A22;            /* grease red; text-safe 4.7:1 on bg */
  --ar-accent-hover: #A3301B;
  --ar-on-accent: #FFF8EE;         /* 5.2:1 */
  --ar-accent-wash: rgb(190 58 34 / 0.10);
  --ar-grease-red: #D23A2A;        /* grease on paper 4.5:1 */
  --ar-focus: #1F57B8;             /* cyanotype; 5.8:1 on bg */
  --ar-success: #2D7445;
  --ar-warning: #8F5E00;
  --ar-danger: #B3261E;
  --ar-selection: rgb(31 87 184 / 0.22);
  --ar-scrim: rgb(18 17 16 / 0.48);
  --ar-shadow-1: 0 1px 2px rgb(27 24 21 / 0.12), 0 1px 1px rgb(27 24 21 / 0.06);
  --ar-shadow-2: 0 8px 20px -6px rgb(27 24 21 / 0.22), 0 2px 4px rgb(27 24 21 / 0.08);
  --ar-shadow-3: 0 28px 56px -16px rgb(27 24 21 / 0.34), 0 10px 20px -10px rgb(27 24 21 / 0.2);
  --ar-grain-opacity: 0.05;
  --ar-grain-blend: multiply;

  --ar-game-texturedle: #A84B22;   /* rust        5.4:1 on surface */
  --ar-game-darkroom:   #1F4F99;   /* cyanotype   7.5:1 */
  --ar-game-plates:     #2E2C28;   /* silver/ink 13.2:1 */
  --ar-game-latent:     #8A5E00;   /* evidence amber 5.4:1 */
  --ar-game-lensbench:  #5B3FA6;   /* lens-coating violet 7.3:1 */
  --ar-game-studio:     #2C7547;   /* backyard green 5.3:1 */
}

/* =================== DARK THEME: "Darkroom" ===================
   Same block twice: once for the OS preference (unless forced light),
   once for an explicit data-theme="dark". Keep them identical. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --ar-bg: #110F0D;
    --ar-glow: #2B140B;              /* safelight warmth (radial, top) */
    --ar-glow-halo: rgb(255 92 48 / 0.16);
    --ar-surface: #1B1815;
    --ar-surface-2: #26221D;
    --ar-ink: #F1E9DC;
    --ar-ink-2: #C4BAAB;
    --ar-ink-3: #9A9083;
    --ar-line: #38312A;
    --ar-line-strong: #6E6357;
    --ar-accent: #FF7148;            /* safelight */
    --ar-accent-hover: #FF8C69;
    --ar-on-accent: #1A0904;
    --ar-accent-wash: rgb(255 113 72 / 0.14);
    --ar-grease-red: #FF5D49;
    --ar-focus: #8CB2FF;
    --ar-success: #72C792;
    --ar-warning: #E8AE45;
    --ar-danger: #FF7A6E;
    --ar-selection: rgb(140 178 255 / 0.28);
    --ar-scrim: rgb(0 0 0 / 0.62);
    --ar-shadow-1: 0 1px 2px rgb(0 0 0 / 0.5);
    --ar-shadow-2: 0 8px 20px -6px rgb(0 0 0 / 0.6), 0 2px 4px rgb(0 0 0 / 0.4);
    --ar-shadow-3: 0 28px 56px -16px rgb(0 0 0 / 0.75), 0 10px 20px -10px rgb(0 0 0 / 0.5);
    --ar-grain-opacity: 0.07;
    --ar-grain-blend: screen;
    --ar-game-texturedle: var(--ar-game-texturedle-lit);
    --ar-game-darkroom: var(--ar-game-darkroom-lit);
    --ar-game-plates: var(--ar-game-plates-lit);
    --ar-game-latent: var(--ar-game-latent-lit);
    --ar-game-lensbench: var(--ar-game-lensbench-lit);
    --ar-game-studio: var(--ar-game-studio-lit);
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --ar-bg: #110F0D;
  --ar-glow: #2B140B;
  --ar-glow-halo: rgb(255 92 48 / 0.16);
  --ar-surface: #1B1815;
  --ar-surface-2: #26221D;
  --ar-ink: #F1E9DC;
  --ar-ink-2: #C4BAAB;
  --ar-ink-3: #9A9083;
  --ar-line: #38312A;
  --ar-line-strong: #6E6357;
  --ar-accent: #FF7148;
  --ar-accent-hover: #FF8C69;
  --ar-on-accent: #1A0904;
  --ar-accent-wash: rgb(255 113 72 / 0.14);
  --ar-grease-red: #FF5D49;
  --ar-focus: #8CB2FF;
  --ar-success: #72C792;
  --ar-warning: #E8AE45;
  --ar-danger: #FF7A6E;
  --ar-selection: rgb(140 178 255 / 0.28);
  --ar-scrim: rgb(0 0 0 / 0.62);
  --ar-shadow-1: 0 1px 2px rgb(0 0 0 / 0.5);
  --ar-shadow-2: 0 8px 20px -6px rgb(0 0 0 / 0.6), 0 2px 4px rgb(0 0 0 / 0.4);
  --ar-shadow-3: 0 28px 56px -16px rgb(0 0 0 / 0.75), 0 10px 20px -10px rgb(0 0 0 / 0.5);
  --ar-grain-opacity: 0.07;
  --ar-grain-blend: screen;
  --ar-game-texturedle: var(--ar-game-texturedle-lit);
  --ar-game-darkroom: var(--ar-game-darkroom-lit);
  --ar-game-plates: var(--ar-game-plates-lit);
  --ar-game-latent: var(--ar-game-latent-lit);
  --ar-game-lensbench: var(--ar-game-lensbench-lit);
  --ar-game-studio: var(--ar-game-studio-lit);
}

/* ---- Per-page game accent: every page sets <html data-game="slug"> ---- */
[data-game="texturedle"] { --game-accent: var(--ar-game-texturedle); --game-accent-lit: var(--ar-game-texturedle-lit); }
[data-game="darkroom"]   { --game-accent: var(--ar-game-darkroom);   --game-accent-lit: var(--ar-game-darkroom-lit); }
[data-game="plates"]     { --game-accent: var(--ar-game-plates);     --game-accent-lit: var(--ar-game-plates-lit); }
[data-game="latent"]     { --game-accent: var(--ar-game-latent);     --game-accent-lit: var(--ar-game-latent-lit); }
[data-game="lensbench"]  { --game-accent: var(--ar-game-lensbench);  --game-accent-lit: var(--ar-game-lensbench-lit); }
[data-game="studio"]     { --game-accent: var(--ar-game-studio);     --game-accent-lit: var(--ar-game-studio-lit); }
[data-game="hub"]        { --game-accent: var(--ar-accent);          --game-accent-lit: var(--ar-grease-red-lit); }

/* ---- Reduced motion collapses all chrome motion through the tokens ---- */
@media (prefers-reduced-motion: reduce) {
  :root {
    --ar-dur-press: 1ms;
    --ar-dur-quick: 120ms;
    --ar-dur-base: 120ms;
    --ar-dur-slow: 120ms;
    --ar-dur-draw: 1ms;
    --ar-dur-develop: 160ms;
    --ar-ease-settle: ease-out;
    --ar-motion-scale: 0;
  }
}

/* ---- More contrast: drop textures, strengthen rules ---- */
@media (prefers-contrast: more) {
  :root { --ar-line: var(--ar-line-strong); --ar-grain-opacity: 0; --ar-ink-3: var(--ar-ink-2); }
}
```

### 4.2 Usage rules

- **Page background** = `--ar-bg`, plus the light-table glow on the hub: `radial-gradient(120% 80% at 50% 35%, var(--ar-glow), var(--ar-bg) 70%)`. Game pages use flat `--ar-bg` under the stage.
- **Text** = `--ar-ink`. Use `--ar-ink-2` for secondary and `--ar-ink-3` for meta and placeholder text. Never put text in `--ar-line` colours.
- **Accent** is rare. Use it at most for one primary button per view, the active state, and small kickers. Never use it as a background behind paragraphs.
- **Game accent** marks things that belong to a game: its frame number, its CTA, its dot in the shell. On film or exposed black always use `--game-accent-lit`. On paper use `--game-accent`.
- **Status colours** (success/warning/danger) appear only in toasts, validation text and icons. Always pair them with an icon or word, never colour alone.
- **Film colours never change with the theme.** The shell bar is film-black on a light page too. That's intentional: it's the brand.

### 4.3 Game accents (meaning)

| Slug | Hue | Light | Lit (dark/film) | Why |
|---|---|---|---|---|
| texturedle | rust | `#A84B22` | `#EA8A5F` | a rusty-mailbox orange |
| darkroom | cyanotype blue | `#1F4F99` | `#86ABF0` | Prussian blue blooming in the wash |
| plates | silver / bone | `#2E2C28` | `#E6DFCB` | 1-bit: ink and bone, no hue on purpose |
| latent | evidence amber | `#8A5E00` | `#E9B04A` | evidence tags and sodium streetlights |
| lensbench | coating violet | `#5B3FA6` | `#AE97F2` | the purple sheen on coated lens glass |
| studio | backyard green | `#2C7547` | `#78CB97` | the lawn outside the studio door |

### 4.4 Verified contrast (WCAG 2.2, computed)

| Pair | Light | Dark |
|---|---|---|
| ink / bg | 15.2 | 15.9 |
| ink-2 / bg | 8.4 | 10.0 |
| ink-3 / bg · surface · surface-2 | 5.1 · 5.6 · 4.6 | 6.1 · 5.6 · 5.0 |
| line-strong / bg · surface (UI boundary, ≥3 needed) | 3.4 · 3.7 | 3.3 · 3.0 |
| accent / bg (text) | 4.7 | 7.0 |
| on-accent / accent | 5.2 | 7.1 |
| focus / bg | 5.8 | 9.0 |
| on-film · on-film-2 · edge-print / film | 14.9 · 7.2 · 12.2 | same |
| focus-on-film / film | 9.4 | same |
| grease-red-lit · grease-yellow / exposed | 6.7 · 12.0 | same |
| game accents / surface (light) | 5.3–13.2 | 7.0–13.3 (lit) |
| game lit accents / film | 7.5–14.2 | same |

---

## 5. Light and dark

- **Default:** follow the OS (`prefers-color-scheme`). The shell's **Lights** toggle switches to an explicit theme, stored in `localStorage['ar:theme']` as `'light' | 'dark'`. The hub footer has "Match my system", which removes the key.
- **Applying:** set `document.documentElement.dataset.theme`. To avoid a flash of the wrong theme, every page's `<head>` includes this inline boot script **before** any CSS or module:

```html
<script>
  (function () {
    var d = document.documentElement, lock = d.getAttribute('data-scheme-lock'), t = null;
    try { t = localStorage.getItem('ar:theme'); } catch (e) {}
    var q = /[?&]theme=(light|dark)\b/.exec(location.search);   // test/screenshot override, not persisted
    if (q) t = q[1];
    if (lock === 'light' || lock === 'dark') t = lock;
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
    if (/[?&]motion=reduce\b/.test(location.search)) d.setAttribute('data-motion', 'reduce');
  })();
</script>
```

`data-motion="reduce"` (a test override) must behave exactly like `prefers-reduced-motion: reduce`. In CSS, repeat the reduced-motion token block under `:root[data-motion="reduce"]`. In TS, use the shared `prefersReducedMotion()` helper from `src/shared/ui/theme.ts`, which checks both.

- **Scheme locks:** a game whose world is inherently dark locks its chrome dark with `<html data-scheme-lock="dark">`. The shell then hides the Lights toggle. Recommended locks: **darkroom: dark**, **plates: dark**, **latent: dark**. **texturedle, lensbench, studio: auto.** (A game lead can change this in the registry; see `hub.md` §10.)
- **Theme switching motion:** never animate `background-color` on `body`. On the hub only, crossfade the glow layer over `--ar-dur-slow` (lights going off and on). Elsewhere the switch is instant.
- `color-scheme` is set by the tokens, so native controls (scrollbars, date pickers, the file input) follow the theme.

---

## 6. Surfaces and materials

### 6.1 Film strip (shell bar, toasts, loaders)
- Fill `--ar-film`. Perforations are **cut out with a mask**, so whatever is behind shows through the holes.
- **Perforation spec at chrome scale:** holes 8×5px, corner radius 1.5px, pitch 16px, one row whose centre sits 4px above the bottom edge. They start at x=4px from the left edge.
- Mask implementation. Put it on a dedicated background child (`.ar-film-bg`), never on an element whose children include popovers:

```css
.ar-film-bg {
  position: absolute; inset: 0; background: var(--ar-film); pointer-events: none;
  --perf: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='8'%3E%3Crect x='4' y='1.5' width='8' height='5' rx='1.5'/%3E%3C/svg%3E");
  -webkit-mask: linear-gradient(#000 0 0), var(--perf) left bottom / 16px 8px repeat-x;
  -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0), var(--perf) left bottom / 16px 8px repeat-x;
          mask-composite: exclude;
}
```

- **Hub strips** use real 35mm proportions instead (`hub.md` §3).

### 6.2 Paper (panels, dialogs, cards)
- Fill `--ar-surface`, 1px `--ar-line` border, radius `--ar-radius-md` (panels) or `--ar-radius-lg` (dialogs), shadow `--ar-shadow-2` (panels) or `--ar-shadow-3` (dialogs).
- Paper grain: one shared procedural noise tile (§6.4) at `--ar-grain-opacity`.
- **Taped variant** (`.ar-panel--taped`) for notes pinned to the light table: a 64×18px strip of `--ar-tape` across the top edge, rotated −3°, with irregular torn ends from a `clip-path` polygon. Use it on the hub only, at most twice per screen.

### 6.3 Grease pencil
- Strokes: `stroke-width: 3.5px` (scale 3–5px with the drawing), `stroke-linecap: round`, `stroke-linejoin: round`, opacity 0.92, colour `--ar-grease-red` (on paper) or `--ar-grease-red-lit` / `--ar-grease-yellow` / `--ar-grease-white` (on black).
- **Waxy texture:** one shared SVG filter, defined once per page in a hidden `<svg>`:

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="ar-grease" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feComponentTransfer in="n" result="holes"><feFuncA type="discrete" tableValues="1 1 1 0.55 1 1 0.7 1"/></feComponentTransfer>
    <feComposite in="d" in2="holes" operator="in"/>
  </filter>
</svg>
```

- **Hand-drawn shapes come from code, not image files.** `src/shared/ui/grease.ts` exports `circlePath(rect, seed)`, `underlinePath(w, seed)`, `checkPath(seed)`, `arrowPath(from, to, seed)`, `starPath(r, seed)` and `cropMarksPath(rect, seed)`. Each returns an SVG `d` string from a seeded RNG (mulberry32), so marks stay the same across reloads. **Circle algorithm:** ellipse radii = half the rect size + 6–10% padding. Start angle random. Sweep 2π + 0.35–0.6 rad of overshoot. Radius wobble = two low-frequency sines (amplitude 2–5px, frequencies 2 and 3 per turn, random phase). Whole-shape rotation ±3°. Sample every 8° and convert to cubic Béziers with Catmull-Rom.
- **Drawing animation:** `stroke-dasharray: L; stroke-dashoffset: L → 0` over `--ar-dur-draw` with `--ar-ease-in-out`. Grease marks **draw**. They never fade in. Erasing is a quick 120ms fade.
- Handwritten text: Caveat 600, `--ar-grease-*` colour, rotated −4°…+3°, with the same filter. Six words or fewer.

### 6.4 Grain
`src/shared/ui/grain.ts` generates a 192×192 greyscale noise tile once (canvas, seeded), converts it to a blob URL, and sets `--ar-grain` on `:root`. `body::before { position: fixed; inset: 0; background: var(--ar-grain); opacity: var(--ar-grain-opacity); mix-blend-mode: var(--ar-grain-blend); pointer-events: none; z-index: var(--ar-z-toast); }`. Games may switch it off with `<html data-grain="off">` when they render their own grain.

### 6.5 Glow
- **Light table halo** (hub sheet): `box-shadow: 0 0 0 1px rgb(255 251 242 / .7), 0 0 64px 12px var(--ar-glow-halo);`, which reads as the backlight spilling past the edges of the sheet.
- **Safelight** (dark): `radial-gradient(70% 45% at 50% -5%, var(--ar-glow), transparent 70%)` fixed behind content.
- Glows are ambient. No pulsing except the one-time power-on flicker on the hub (`hub.md` §7).

---

## 7. Chrome components

All live in `src/shared/ui/` (`base.css` plus small TS helpers). Class prefix: `ar-`.

### 7.1 Buttons (`.ar-btn`)
| Variant | Fill / text | Use |
|---|---|---|
| `--primary` | `--ar-accent` / `--ar-on-accent` | the single main action ("Play", "Develop", "Got it") |
| `--secondary` | transparent, 1.5px `--ar-line-strong` border / `--ar-ink` | everything else |
| `--ghost` | transparent / `--ar-ink-2`, hover `--ar-accent-wash` | toolbars, low emphasis |
| `--on-film` | transparent / `--ar-on-film`, hover `--ar-film-2`, pressed `--ar-film-3` | inside the shell and on film |
| `--icon` | square, min 44×44, 20px icon | icon-only; must have `aria-label` + tooltip |

Sizes: `sm` 32px height (desktop toolbars only; 44px hit area via `::after` inset −6px), `md` 40px (default), `lg` 48px. Horizontal padding 14px (md). Label style per §3 (Archivo 650, 87.5% width, uppercase, 0.06em tracking). Radius `--ar-radius-sm`.

```css
.ar-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:40px; padding:0 14px;
  font: var(--ar-w-label) 0.8125rem/1 var(--ar-font-ui); font-stretch: var(--ar-stretch-label);
  letter-spacing: var(--ar-tracking-label); text-transform: uppercase; border-radius: var(--ar-radius-sm);
  border: 1.5px solid transparent; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
  transition: background-color var(--ar-dur-quick) var(--ar-ease-out), color var(--ar-dur-quick) var(--ar-ease-out),
              translate var(--ar-dur-press) var(--ar-ease-out), box-shadow var(--ar-dur-press) var(--ar-ease-out); }
.ar-btn:active:not(:disabled) { translate: 0 calc(1px * var(--ar-motion-scale)); box-shadow: inset 0 2px 0 rgb(0 0 0 / .14); }
.ar-btn:disabled, .ar-btn[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
.ar-btn--primary { background: var(--ar-accent); color: var(--ar-on-accent); }
.ar-btn--primary:hover { background: var(--ar-accent-hover); }
.ar-btn--secondary { background: transparent; color: var(--ar-ink); border-color: var(--ar-line-strong); }
.ar-btn--secondary:hover { background: var(--ar-accent-wash); }
.ar-btn--ghost { background: transparent; color: var(--ar-ink-2); }
.ar-btn--ghost:hover { background: var(--ar-accent-wash); color: var(--ar-ink); }
.ar-btn--on-film { background: transparent; color: var(--ar-on-film); }
.ar-btn--on-film:hover { background: var(--ar-film-2); }
.ar-btn--on-film:active { background: var(--ar-film-3); }
.ar-btn--icon { min-width: var(--ar-tap); min-height: var(--ar-tap); padding: 0; }
.ar-btn--icon svg { width: 20px; height: 20px; }
```

Feel: buttons **press** (1px down, inset shadow, `--ar-dur-press`) like a camera button and release over 140ms. No scale bounce, no ripple.

### 7.2 Toggle (`.ar-switch`) and segmented control (`.ar-seg`)
- Switch: a 36×20 track (`--ar-surface-2`, 1.5px `--ar-line-strong` border) with a 14px knob. On state: track `--game-accent`, knob `--ar-surface`. The knob moves with `--ar-ease-settle` over `--ar-dur-base`. `role="switch"` + `aria-checked`. Sound: `switch`.
- Segmented: 1.5px `--ar-line-strong` outline, segments 36px tall, selected segment filled `--ar-ink` with `--ar-surface` text (inverted, like a selected film-speed dial). `role="radiogroup"`.

### 7.3 Range (`input[type=range].ar-range`)
Track 4px `--ar-surface-2` with 1px `--ar-line-strong` outline. Filled part `--game-accent`, painted with a background gradient from `--fill: <percent>` (set by a tiny helper). Thumb is an 18px circle, `--ar-ink` fill, 3px `--ar-surface` ring, `--ar-shadow-1`. Hit area 44px tall. Optional tick marks (`.ar-range--detent`) are drawn under the track every N steps as 1×6px `--ar-line-strong` lines, like click-stops on an aperture ring. Pressing the thumb grows it to 22px over `--ar-dur-press`. Values show in Plex Mono next to the slider (for example `f/5.6`, `1/125`, `0:42`).

### 7.4 Panel (`.ar-panel`)
Paper surface per §6.2, padding 16px (mobile) or 20px. Headers inside a panel use edge print (11px, `--ar-ink-3`) as a label above a Fraunces 600 title.

### 7.5 Dialog: the datasheet (`.ar-dialog`)
Native `<dialog>` (top layer, focus trapping, Esc closes). Width `min(560px, 100vw - 32px)`, max-height `min(80dvh, 720px)`, scrolling body.
- **Header band:** a film strip (`--ar-film`, perforation row along the bottom per §6.1), 40px tall, with edge print in `--ar-edge-print`: `RANKIN 400 · DATASHEET · ▸02 DARKROOM`. Close button `--on-film --icon` on the right.
- **Body:** paper. Fraunces 600 title, Archivo body. The **controls table** has columns *Action · Mouse · Touch · Keys*. Keys render as `<kbd>`. On mobile it collapses to one row per action, showing only Touch and Keys.
- **Footer:** one primary button ("Got it").
- Open: backdrop `--ar-scrim` fades in over `--ar-dur-base`. The dialog rises `12px × --ar-motion-scale` and fades in over `--ar-dur-base` with `--ar-ease-out`. Close is 160ms. Sound: `paper` on open, `paper-out` on close.

### 7.6 Toast (`.ar-toast`)
Bottom centre, `bottom: calc(16px + env(safe-area-inset-bottom))`. A film-black pill (radius 6px) with a perforation row along its **top** edge (holes 6×4, pitch 12). Text Archivo 500 14px `--ar-on-film`, with a leading 8px dot in `--game-accent-lit` (status colours for success/error). Max width `min(420px, 100vw - 32px)`. Lives 2600ms (errors 5000ms or until dismissed). Only one at a time; a new toast replaces the old one. Enter: develop in (§9.1) plus a `8px × motion-scale` rise. Announced through a shared `aria-live="polite"` region (`role="status"`).

### 7.7 Tooltip, menu, kbd
- **Tooltip:** a film-black label (`--ar-on-film`, Archivo 500 12px, padding 4px 8px, radius 4px). It shows after 500ms of hover or immediately on keyboard focus, and includes the shortcut, e.g. `How to play  ?`. Never on touch.
- **Menu** (the shell's "More"): a paper popover (`popover` attribute + anchor positioning with a JS fallback). Items 44px tall, icon + label, `role="menu"` / `menuitem` / `menuitemcheckbox`. Arrow keys move, Esc closes and returns focus.
- **`<kbd>`:** Plex Mono 500 12px, padding 1px 6px, `--ar-surface` fill, 1px `--ar-line-strong` border with a 2px bottom border, radius 4px.

### 7.8 Loader (`src/shared/ui/loader.ts`)
`const l = showLoader(stageEl, { label: 'Mixing chemistry…' }); l.progress(0.4); l.done();`
- A full-stage cover in `--ar-film`. In the centre, a 240×28px **strip of perforations** (two rows) slides left continuously at 48px/s. This is film winding on. Below it, the label in edge print (`--ar-edge-print`), and a frame counter in Plex Mono `▸ 07` mapping `progress` 0..1 onto frames 00..36.
- `done()`: the cover dissolves away over `--ar-dur-develop` with `--ar-ease-develop` (the picture "comes up").
- Reduced motion: the strip doesn't move; only the counter changes.
- Stays invisible for the first 250ms, so fast loads never flash a loader.

### 7.9 No-WebGL2 and error cards (`src/shared/ui/fallback.ts`)
A paper card centred on the stage. The header band is film, with edge print `▸02 · NO SIGNAL`.
- **No WebGL2.** Title: *This one needs a graphics boost.* Body: *{Title} runs on WebGL 2, which this browser has switched off or doesn't support. A recent Chrome, Edge, Firefox or Safari will work, or try turning on hardware acceleration in your browser settings.* Buttons: **Contact sheet** (primary), **Try anyway** (secondary; reloads with `?force=1`).
- **Crash during start-up.** Title: *The film jammed.* Body: *Something went wrong while {Title} was loading. Reloading usually unjams it.* Buttons: **Reload** (primary), **Contact sheet**. Add a `<details>` with the error message, for the curious.

---

## 8. Iconography and brand mark

- **Style:** 24×24 grid, rendered at 20px. `fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round`. No filled glyphs except the mute slash. Dots are zero-length round-capped segments (`M6 12h0`).
- **Set** (`src/shared/ui/icons.ts`, exported as SVG strings keyed by name). Path data is a starting point; refine freely, but keep the grid and stroke.

| Name | Meaning | Path(s) |
|---|---|---|
| `back` | back to hub | `M19 12H5` `M11 6l-6 6 6 6` |
| `sheet` | contact sheet | `<rect x="3" y="5" width="18" height="14" rx="1.5"/>` `M3 8.5h18M3 15.5h18` `M6.5 6.75h0M10.5 6.75h0M14.5 6.75h0M18.5 6.75h0M6.5 17.25h0M10.5 17.25h0M14.5 17.25h0M18.5 17.25h0` |
| `help` | how to play | `<circle cx="12" cy="12" r="9"/>` `M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.7v.4` `M12 17h0` |
| `sound` | sound on | `M4 9.5h3.5L12 6v12l-4.5-3.5H4z` `M15.5 9a4.2 4.2 0 0 1 0 6` `M18 6.5a7.6 7.6 0 0 1 0 11` |
| `sound-off` | sound off | `M4 9.5h3.5L12 6v12l-4.5-3.5H4z` `M16 9.5l5 5M21 9.5l-5 5` |
| `lights` | light table (to light theme) | `M9 18h6M10 21h4` `M12 3a6 6 0 0 0-3.6 10.8c.6.5.6 1.2.6 2.2h6c0-1 0-1.7.6-2.2A6 6 0 0 0 12 3z` |
| `safelight` | darkroom (to dark theme) | the same bulb plus `M12 7v3` (filament), with stroke in `--ar-accent` |
| `fullscreen` | fullscreen | `M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5` |
| `more` | overflow | `M5 12h0M12 12h0M19 12h0` (stroke-width 2.5) |
| `close` | close | `M6 6l12 12M18 6 6 18` |
| `save` | save (film canister) | `<rect x="5" y="7" width="11" height="13" rx="1.5"/>` `M8 4.5h5V7H8z` `M16 10h4v6h-4` |
| `load` | open save | `M4 7h6l2 2h8v10H4z` |
| `reset` | start fresh (rewind) | `M4 12a8 8 0 1 0 2.4-5.7` `M4 4v4h4` |
| `download` | save image (print) | `M12 4v10` `M8 10l4 4 4-4` `M4 16v4h16v-4` |
| `loupe` | magnify | `M7 20h10l-1.6-8H8.6z` `<ellipse cx="12" cy="9.5" rx="5" ry="2.5"/>` |
| `import` | import PNG | `M12 20V10` `M8 14l4-4 4 4` `M4 8V4h16v4` |

- **Favicon** (`public/favicon.svg`; also the shell's hub-mode brand mark at 24px):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#121110"/>
  <g fill="#F3EDE2">
    <rect x="4" y="2.5" width="4" height="3" rx="1"/><rect x="14" y="2.5" width="4" height="3" rx="1"/><rect x="24" y="2.5" width="4" height="3" rx="1"/>
    <rect x="4" y="26.5" width="4" height="3" rx="1"/><rect x="14" y="26.5" width="4" height="3" rx="1"/><rect x="24" y="26.5" width="4" height="3" rx="1"/>
  </g>
  <rect x="4" y="8" width="24" height="16" rx="1.5" fill="#EAE3D6"/>
  <path d="M7.2 16.6c-.3-4 4.2-6.6 9.4-6.4 5 .2 8.6 2.6 8.2 5.8-.4 3.4-4.8 5.4-9.6 5.2-4.6-.2-8.4-2.2-7.6-5.4.4-1.6 2-2.8 3.6-3.4" fill="none" stroke="#D23A2A" stroke-width="2.2" stroke-linecap="round"/>
</svg>
```

Also generate `public/apple-touch-icon.png` (180×180, the same art on `#121110` with no transparency) with the poster script (`hub.md` §11). `<meta name="theme-color" content="#121110">` on every page matches the shell bar.

---

## 9. Motion principles

Six principles, in order of priority:

1. **Develop, don't pop.** Images and frames come up the way a print comes up in the tray. Opacity goes 0→1 while `filter` goes from `brightness(1.7) contrast(0.45)` to normal, over `--ar-dur-develop` with `--ar-ease-develop`. In the dark theme they come up from black instead: `brightness(0.15) contrast(1.4)` to normal. Text never "develops". Text uses a plain 160ms fade.
2. **Mechanical, not bouncy.** Controls move like camera parts: short travel, damped, detented. The most overshoot allowed is `--ar-ease-settle` (4%). No elastic, no wobble, no rubber-band scale.
3. **Paper has weight.** Panels and dialogs rise `12px × --ar-motion-scale` and fade in over `--ar-dur-base`. They leave faster (160ms), sinking `4px` as they go.
4. **Hand-drawn things draw.** Grease marks animate along their stroke (§6.3). Underlines draw left to right. Nothing hand-drawn fades in.
5. **Idle is slow.** Ambient loops (previews, glows, the loader strip) run with periods of 4s or longer, and nothing in the chrome blinks faster than 1Hz.
6. **Light is a reward.** Glows, flares and flashes are feedback for moments that earned them (a solve, a finished print, a saved state). They are never decoration.

**Photosensitivity (binding on games too):** at most **3 flashes in any 1-second window**. A full-screen flash (camera flash, flashbulb, lightning) lasts 120ms or less and peaks at 70% white overlay or less. Saturated red flashes are capped at 25% of the screen area. Under `prefers-reduced-motion`, swap flashes for a 200ms soft brighten (overlay at 30% or less).

**Reduced motion:** the token overrides in §4.1 collapse the chrome automatically. In addition: hub previews show their still hero frame, the loupe follows the pointer with no easing lag, view transitions are turned off, and the loader strip stops. Games must read `matchMedia('(prefers-reduced-motion: reduce)')` and tone down camera shake, sloshing exaggeration and auto-motion. Physics may keep running, because the player is driving it.

**Page transitions:** cross-document View Transitions (`@view-transition { navigation: auto; }`). The shell bar stays still (`view-transition-name: ar-shell`). A hub frame grows into the game stage (`view-transition-name: frame-<slug>`; details in `hub.md` §8.4). Duration `--ar-dur-slow` with `--ar-ease-out`. Off under reduced motion.

---

## 10. Sound UI palette

Every sound is synthesized with WebAudio at runtime. There are no audio files.

### 10.1 Architecture (`src/shared/audio/`)
- `getAudio(): { ctx: AudioContext, master: GainNode, ui: GainNode } | null` creates **one** shared AudioContext lazily, on the first `pointerdown` / `keydown` / `touchend`. It's null before any user gesture. Games **must** reuse this context instead of creating their own (iOS limits contexts, and the global mute must apply). Connect game audio to `master` (or a game sub-bus feeding it).
- Graph: `ui (gain 0.55) → master (gain = volume × !muted) → DynamicsCompressor (threshold −18dB, knee 12, ratio 4, attack 3ms, release 150ms) → destination`.
- Preferences: `localStorage['ar:sound']` = `'on' | 'off'` (default **on**) and `localStorage['ar:volume']` = `0..1` (default **0.7**). A `window` event `ar:soundchange` fires on change. `sound.muted`, `sound.setMuted(b)` and `sound.onChange(cb)` are exported.
- Mute ramps `master.gain` over 60ms, so muting never clicks.
- `uiSound(name, { gain?, detune? })` plays a palette sound. Every play randomizes pitch ±4% and gain ±1.5dB, so repeats don't sound robotic. `tick` is rate-limited to one per 45ms.
- One shared 1-second white-noise `AudioBuffer`, generated once, feeds all noise-based sounds.

### 10.2 The palette (exact recipes)

Times are seconds. Gains are peak linear values into the `ui` bus. Envelopes use `setValueAtTime` then `exponentialRampToValueAtTime(0.0001, …)`.

| Name | Plays on | Recipe |
|---|---|---|
| `tick` | hover or focus on a frame or menu item, slider detents | noise 0.006s → bandpass 3500Hz Q1.2; gain 0.08, 0.5ms attack, 6ms exponential decay |
| `shutter` | primary button press, opening a game from the hub | **A** at t0: noise 0.012 → highpass 2000Hz; gain 0.35, decay 0.010. **B** at t0+0.038: noise 0.018 → bandpass 900Hz Q0.8, gain 0.25, decay 0.016, **plus** sine 140Hz gain 0.2, decay 0.04. A focal-plane "ka-chick". |
| `advance` | back to contact sheet, next/previous | 4 clicks 0.024s apart: each noise 0.005 → bandpass (2400, 2250, 2100, 1950 Hz) Q3; gains 0.15 × 0.8ⁿ. A film-advance ratchet. |
| `switch` | toggles (sound, lights, switches) | noise 0.004 → highpass 3000Hz gain 0.2, **plus** sine 90Hz gain 0.15, decay 0.025 |
| `paper` | dialog or panel open | noise 0.22 → bandpass, centre ramping 1200→3200Hz linearly, Q0.6; gain env 0→0.07 in 0.04, hold, →0 by 0.22 |
| `paper-out` | dialog or panel close | as `paper` but 0.16 long and centre 3200→1400Hz |
| `canister` | save | sine 220→110Hz exponential sweep over 0.05, gain 0.25, decay 0.07, **plus** noise 0.003 → highpass 4000Hz gain 0.12 at t0. The pop of a film-can lid. |
| `bell` | success: solved, print finished | the darkroom timer bell: f₀ = 1318.5Hz (E6) sines with partials ×1, ×2.76, ×5.40, gains 0.22 / 0.09 / 0.04, decays 0.9 / 0.4 / 0.2s |
| `thunk` | error or not allowed | sine 110Hz decay 0.08 gain 0.2, then sine 98Hz at t0+0.09 decay 0.08 gain 0.18, both through lowpass 600Hz |
| `develop` | hub frame activation (once per frame per visit), image reveal | noise 0.5 → lowpass sweeping 400→1800Hz, gain env 0→0.05 in 0.12 then →0 by 0.5; plus a 3Hz LFO on gain (depth 0.3). A gentle tray-slosh. |

Rules:
- UI sounds are **quiet and short**. Nothing in the palette is longer than 1s, and none is louder than −12dBFS after the compressor.
- **No sound before the first gesture**, and no sound on page load.
- Never encode information in sound alone.
- Games use the palette for their chrome (buttons, menus, saves) and their own synthesized sounds for the world. A game's world sounds should share the palette's honesty: physical sources, no musical stingers for UI.

### 10.3 Haptics
On touch input only: `navigator.vibrate?.(10)` on `shutter`, `6` on `switch` and slider detents. This is tied to the sound preference (the toggle is "Sound & haptics" in its aria-description). iOS ignores it, which is fine.

---

## 11. Page integration checklist (every game page)

`games/<slug>/index.html`:

```html
<!doctype html>
<html lang="en-CA" data-game="darkroom" data-scheme-lock="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Darkroom · Andrew Rankin</title>
  <meta name="description" content="(registry blurb, ≤ 160 chars)" />
  <meta name="theme-color" content="#121110" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta property="og:title" content="Darkroom · Andrew Rankin" />
  <meta property="og:description" content="(registry blurb)" />
  <meta property="og:image" content="/og/darkroom.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <script>/* theme boot from §5, verbatim */</script>
  <script type="module" src="./main.ts"></script>
</head>
<body>
  <main id="stage" class="ar-stage" tabindex="-1"></main>
</body>
</html>
```

`main.ts` starts with:

```ts
import '@shared/ui/fonts';
import '@shared/ui/tokens.css';
import '@shared/ui/base.css';
import { mountShell } from '@shared/ui/shell';
const shell = mountShell({ slug: 'darkroom', /* actions, help… see hub.md §9 */ });
```

- **Stage CSS** (in `base.css`): `.ar-stage { position: fixed; inset: var(--ar-shell-total) 0 0 0; overflow: hidden; background: var(--ar-bg); touch-action: none; overscroll-behavior: none; }`. The stage is `100dvh` minus the shell. Games that want full-bleed under an auto-hiding shell use `shell.setAutoHide(true)` and `.ar-stage--under-shell` (inset 0).
- `body` gets `overscroll-behavior: none` on game pages. The hub scrolls normally.
- **Storage namespacing:** `localStorage` keys are `ar:<slug>:<key>`. The IndexedDB database is `andrew-rankin`, with one object store per slug (`<slug>`), opened through `src/shared/storage` if it exists. Global keys are `ar:theme`, `ar:sound`, `ar:volume`, and `ar:<slug>:hub` (the hub progress note; `hub.md` §8.5).
- Keyboard: games ignore key events when `shouldGameIgnoreKey(e)` (exported by the shell) is true. It's true when the event target is an input or textarea, inside the shell, inside a dialog or inside a menu.
- Errors: wrap game start-up in `try { … } catch (e) { showCrashCard(stage, e) }`, and check WebGL2 with `hasWebGL2()` before creating a renderer. Both helpers come from `src/shared/ui/fallback.ts`.

---

## 12. In-game looks: freedom and the boundary

**Free:** everything inside `#stage`, including the game's palette, rendering style, in-world typography (one extra face), HUD styling of diegetic objects, cursor, and world sounds.

**Shared (non-negotiable):**
- The shell bar (`hub.md` §9) is on every game page, auto-hidden at most, never removed.
- Non-diegetic UI (settings, help, save/load dialogs, toasts, loaders, error cards, confirmation prompts) uses the chrome components and tokens above.
- Focus visibility, 44px touch targets, the photosensitivity limits, reduced-motion behaviour and the shared audio context.
- No real people, brands or copyrighted text, in the chrome or the world.

**Suggested in-game signatures** (not binding; meant to keep the six frames reading as one roll, and used by the hub previews):

| Game | Signature |
|---|---|
| Texturedle | Macro realism: raking warm light, shallow focus, tactile relief. The specimen-and-microscope dressing from its concept. |
| Darkroom | Wet and warm under the safelight. Cyanotype Prussian blue as the reward colour. Enamel trays, masking-tape labels. |
| Plates | Strict 1-bit dither on a two-tone palette (bone `#E6DFCB` on ink `#141210`, plus a safelight variant). No gradients anywhere. |
| Latent Image | 1-bit or near-1-bit archive and darkroom, with an amber evidence-tag accent. Records-room paper textures. |
| Lens Bench | Drafting-table clarity: ray lines in spectral colour, glass with violet/green coating sheen, a walnut optical rail. |
| The Studio | A cosy cutaway diorama. Three rooms colour-keyed red (darkroom), warm wood (workshop), green (yard). |

---

## 13. Do / don't

- **Do** use the film bar for anything global and paper for anything you read.
- **Do** keep the grease pencil human: a few marks, slightly wonky, warm.
- **Do** let the games be loud. The chrome stays quiet so they can.
- **Don't** put grease pencil on controls, error messages or legal or accessibility text.
- **Don't** add new accent hues to the chrome. Game hues stay inside their own games and their hub frames.
- **Don't** use skeuomorphic chrome metal, gradients on buttons, or glossy highlights. The materials are matte: film, paper, wax.
- **Don't** fetch anything from third-party origins at runtime: no font CDNs (fonts are self-hosted), no analytics scripts in the chrome, no remote images.
