# The hub (`/`) and the 404 page

Spec: `docs/design/hub.md` (with `art-direction.md`). Owned paths: `index.html`, `404.html`, `src/hub/**`, `public/posters/**`, `public/og/**`.

## How it is put together

- **`index.html` is complete static HTML**: intro, the six frames with captions, the dictation card and the footer all read and navigate without JavaScript. The frame markup between `<!--frames-->` and `<!--/frames-->` is generated from the registry (`src/shared/games.ts`) because `vite.config.ts` is frozen. After a registry change, run
  `node --experimental-strip-types src/hub/dev/render-frames.mjs`, then check `__game.lintRegistry()` returns `[]`. At runtime `syncRegistry()` patches any drift, so visitors never see stale copy.
- `main.ts` enhances it: the shell in hub mode, previews, black-and-white to colour on attention (hover, focus, or the scroll-centre frame on touch), grease marks (`grease.ts`), the dictation-card annotations (`dictation.ts`), the loupe (`loupe.ts`), sounds, prefetch fallback, progress notes, the safelight egg (dark theme, ≥1024 px) and the debug API.
- `previews/`: six procedural 2D-canvas storyboards (`types.ts` is the hub.md §4.2 contract), the shared finish (`kit.ts`), and one rAF `runner.ts` (idle 10 fps at ⅓ speed, active 30 fps, off-screen and hidden-tab pauses, DPR by state, adaptive degrade on p90 > 6 ms). No WebGL, no three.
- `og.ts`: `?og=<slug|hub>` (1200×630 card) and `?poster=<slug>` (1200×800 procedural hero still). `public/posters/*.jpg` and `public/og/*.jpg` are stand-ins made from these until `scripts/posters.mjs` (R3) captures the real games.
- `404.html` + `notfound.ts`: “Frame not found.” with a fogged frame.

## Debug API (`window.__game`, hub.md §15)

`state()` → `{ theme, active, loupe, cols, previews: { degrade, p90, draws, ready }, checks }` · `activate(slug | null)` · `freeze(t | null)` · `loupeAt(x, y)` (`-1, -1` hides) · `setTheme('light' | 'dark' | null)` · `safelight(on)` · `lintRegistry()` · `bench(n?)` (ms per draw, per preview) · `previewHash(slug, t)`. `ready` = fonts loaded and all six previews initialized.

URL: `?t=<s>` (freeze every preview; also draws every grease mark at once), `?theme=`, `?motion=reduce`, `?loupe=x,y`, `?og=<slug|hub>`, `?poster=<slug>`.

## Shots

```
node scripts/shoot.mjs "/?t=4" --size 1440x900 --out shots/hub/desktop.png
node scripts/shoot.mjs "/?t=4" --mobile --full --out shots/hub/mobile-full.png
node scripts/shoot.mjs "/?t=4" --size 1440x900 --steps src/hub/test/smoke.steps.json --out shots/hub/smoke.png
node scripts/shoot.mjs "/?t=4" --mobile --steps src/hub/test/smoke.mobile.steps.json --out shots/hub/smoke-mobile.png
node scripts/shoot.mjs "/?og=hub" --size 1200x630 --out public/og/hub.jpg
node scripts/shoot.mjs "/?poster=darkroom" --size 1200x800 --out public/posters/darkroom.jpg
node scripts/shoot.mjs /404.html --out shots/hub/404.png
```
