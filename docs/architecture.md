# Architecture: Andrew-Rankin.com Minigame Collection

Version 1 · 2026-10-09 · written by the architect for the build round. Read-only for build tasks.

This is the contract between the ~30 agents that build the site in parallel. It fixes file ownership, the shared modules under `src/shared/` (with their full public APIs), cross-cutting conventions (storage keys, URL flags, `window.__game`, sound ids), the dependency graph, and the performance and mobile policy. The game designs themselves live in the GDDs; this document only overrides them where parallel work needs one answer.

**Sources:** `docs/design/art-direction.md`, `hub.md`, `texturedle.md`, `darkroom.md`, `plates.md` + `plates-story.md`, `latent.md` + `latent-story.md`, `lensbench.md`, `studio.md`, and the working prototypes in `spikes/`.

---

## 0. Precedence and how to use this document

1. **Orchestrator files are immutable for build tasks:** `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `vercel.json`, `scripts/**`, `.gitignore`, `README.md`. If you need a change there, write it as a request in your handoff note (§2.9). Standing requests are listed in §9.
2. **This document wins** on: file ownership, shared-module APIs and units, storage keys, the `window.__game` base contract, URL flags, sound ids, page template, test and screenshot conventions, and the performance/mobile policy.
3. **`art-direction.md` and `hub.md` win** on the chrome: shell, tokens, typography, copy rules, motion, sound palette, photosensitivity.
4. **Each GDD wins** on its own game's design, mechanics, numbers, content and scope tiers. **Story bibles win** on story content (they are answer keys; transcribe, never paraphrase).
5. When a GDD says "build it locally now, promote to shared later", or proposes a shared module with a different signature, **the shared module in §4 replaces it**. §5 lists every such override per game.
6. **Spikes** (`spikes/<name>/`) are working prototypes written alongside the GDDs: `audio`, `photochem`, `fluid-tray`, `dither-1bit`, `photo-render`, `materials`, `cloth-marble`, `backyard-physics`. They are reference code. **Port from them** (copy, adapt to the API here, make strict-TS clean, fix perf). Never import from `spikes/` in `src/` or `games/`, never edit them, and don't assume they will stay on disk after the build round.

---

## 1. Repository layout and ownership

```
index.html                         hub page                                   [hub]
404.html                           "Frame not found" (dev only until R2)      [hub]
public/favicon.svg                                                            [shared-platform]
src/hub/**                         hub code, previews, loupe                  [hub]
src/shared/core/**                 rng, noise, math, bus, loop, flags,        [shared-platform]
                                   quality, gestures, keys, files, idle,
                                   testapi; gfx.ts (three helpers)
src/shared/storage/**              IndexedDB/localStorage, save slots,        [shared-platform]
                                   hub notes, film can
src/shared/ui/**                   the chrome (art-direction + hub §9)        [shared-platform]
src/shared/games.ts                the registry (hub §10 + Appendix A)        [shared-platform]
src/shared/audio/**                engine + sound library                     [shared-audio]
src/shared/photochem/**            silver, cyanotype, film, paper, spectral   [shared-photochem]
src/shared/fluid/**                tray shallow-water + tray body             [shared-fluid-dither]
src/shared/dither/**               1-bit dither primitives + OneBitPass       [shared-fluid-dither]
src/shared/photo/**                physically based photo renderer (three)    [shared-photo]
src/shared/optics/**               exact lens optics (pure TS)                [lensbench-glass]
src/shared/sun/**                  sun/sky/exposure math (pure TS)            [lensbench-glass]
src/shared/surface/**              macro surface baker + recipes              [shared-surface]
games/<slug>/sounds.ts             that game's SoundDefs (not texturedle)     [shared-audio]
games/<slug>/index.html, main.ts,  page + wiring                              [<slug>-integrate]
  test/**, glue/**
games/<slug>/dev/<task>.*          the task's own harness pages               [that task]
games/<slug>/**                    everything else: see the per-game maps in §5
docs/build/<task-id>.md            each task's handoff note                   [that task]
docs/architecture.md               this file                                  [architect]
shots/                             screenshots (gitignored)                   [anyone, own subfolder]
```

Each game folder is self-contained: a game may import `three`, `three/addons/*`, `@dimforge/rapier3d-compat` (studio only), `@shared/*`, and its own files. **A game never imports from another game's folder.** Cross-game sharing goes through `@shared/*` only.

---

## 2. Working rules for every task

**2.1 Exclusive ownership.** You may create, edit and delete files only under the paths your task owns (listed in your brief and in §5). Never edit another task's file, even to fix a typo; write the problem in your handoff note instead. If you need something another task hasn't delivered yet, code against the documented API. For a temporary stand-in, put a stub inside your own folder (for example `games/plates/dev/fake-bench.ts`), never in theirs.

**2.2 Stub first, within 15 minutes.** Every task that *provides* an interface in this document (a shared module, a game contract file, a factory other tasks call) first writes the complete public surface as typed stubs: real signatures, trivial bodies that return safe defaults (or throw `Error('not yet: <name>')` only where a caller can't proceed). Commit-free; it just has to exist on disk so dependants type-check. Then fill it in. The signatures here are frozen. Additive changes (new optional parameters, fields or functions) are fine. Breaking changes are not: add a new function instead and note it in your handoff.

**2.3 Contract files are written verbatim.** Each game's contract file (listed in §5) is written by its owner, first thing, verbatim from the GDD section named there, with the §5 overrides applied. Others code against the GDD text until it lands.

**2.4 Type checking.** `npm run check` sees everyone's in-progress files. Filter for yours:
`npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "^(games/plates/bench|games/plates/dev/room)"`.
Your files must be error-free when you finish. No `// @ts-nocheck`, no `@ts-ignore` without a one-line reason, no blanket `any` (use `unknown` and narrow).

**2.5 One dev server.** A single Vite dev server serves the repo at `http://127.0.0.1:5173` (strict port). Check it first: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/`. If it is down, start `npm run dev` in the background; if the port is busy, it's already running. Vite serves every HTML file under the repo root in dev, so harness pages such as `/games/plates/dev/room.html` or `/src/shared/photochem/dev/index.html` work without any config change (they are not part of the production build).

**2.6 Screenshots are the acceptance evidence.**
```
node scripts/shoot.mjs "/games/plates/dev/room.html?test=1" --wait 4000 \
  --steps games/plates/dev/room.steps.json --out shots/plates/room-01.png
node scripts/shoot.mjs /src/shared/photochem/dev/ --eval "__game.selftest()"
```
At most 3 Chromium instances run at once (the script queues). Exit code 1 means a page error. Use `--timeout 180000` for heavy pages and `--mobile` for the 390×844 touch run. Shots go under `shots/<slug-or-module>/`. Headless runs use SwiftShader: expect 5–20 fps, so drive time through the deterministic `advance()`/`step()` APIs rather than real waits.

**2.7 Git hygiene.** Never run `git add -A`, `git commit -a`, `git stash`, `git checkout -- .`, `git reset --hard` or `git clean`: other agents' uncommitted work shares this working tree. If your harness instructions tell you to commit, stage only your owned paths.

**2.8 No new dependencies.** Available: `three@0.186`, `@dimforge/rapier3d-compat@0.21`, TypeScript 7 (strict), Vite 8, Playwright. Fontsource is requested (§9 R1); until it is installed, fonts fall back to the system stacks in the tokens.

**2.9 Handoff note.** Finish by writing `docs/build/<task-id>.md`: what works, what is stubbed, deviations from the docs and why, known bugs, the exact shoot commands that demonstrate your acceptance criteria, and requests for other tasks or the orchestrator. Keep it under 150 lines.

---

## 3. Conventions

### 3.1 TypeScript and modules
- TypeScript strict (TS 7), ES2022, `moduleResolution: bundler`, `isolatedModules`. Use `export type` / `import type` for type-only symbols.
- **Named exports only** (no default exports), except where three or Rapier require otherwise.
- Relative imports inside a game, without extensions (`./tray`). Shared code through the alias: `import { mulberry32 } from '@shared/core'`. Directory imports resolve to `index.ts`.
- **Hub-safe barrels.** These entry points must never import `three` (directly or transitively), so the hub stays under 70 KB: `@shared/core`, `@shared/storage`, `@shared/ui`, `@shared/games`, `@shared/audio`, `@shared/photochem`, `@shared/fluid`, `@shared/dither`, `@shared/optics`, `@shared/sun`, `@shared/surface`. Three-dependent code lives behind separate entry points: `@shared/core/gfx`, `@shared/dither/three`, and the whole of `@shared/photo`.
- three: `import * as THREE from 'three'`; addons from `'three/addons/<path>.js'`. Rapier: `const RAPIER = (await import('@dimforge/rapier3d-compat')).default; await RAPIER.init()` (studio only, inside its loader).
- Workers: `new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' })`. AudioWorklets: a plain `.js` file loaded with `ctx.audioWorklet.addModule(new URL('./x-worklet.js', import.meta.url))`.
- File names: use the names the GDD lists. New files: camelCase `.ts`.

### 3.2 Units and frames (unless a GDD says otherwise for its own internals)
- World: metres, seconds, kilograms; three.js Y-up. Angles: radians in code, degrees in UI and docs.
- Colour: linear RGB in maths and shaders; sRGB hex in data. `renderer.outputColorSpace = THREE.SRGBColorSpace`.
- Photometry: luminance in cd/m², illuminance in lux, exposure in lux·s. Lens Bench and Studio render scene radiance in **kcd/m²** (lights fed as lux/1000) and tell `@shared/photo` so with `radianceScale: 1000`.
- Optics: millimetres along the optical axis.
- Darkroom chemistry (`@shared/photochem`) runs in **physical real time**. Games compress slow processes (fix, wash, drying, UV) by scaling the `dt` they pass in, using constants in their own files. The developer stays real time.

### 3.3 Determinism
- No `Math.random()` in any simulation, render or content path. Use `@shared/core` `mulberry32` / `rngStream(seed, 'name')`. (`Math.random` is allowed only for UI juice that never reaches a photo, a save or a test.) Reviewers grep for it.
- Fixed-step simulation (`createLoop` in `@shared/core`, or the GDD's own fixed steps). Every game exposes a deterministic `advance()` / `step()` in `window.__game` that runs fixed steps synchronously and renders once.
- `?seed=N` overrides the default seed. Same seed + same inputs + same browser = same pixels (within the tolerances in each GDD).

### 3.4 Page template
Every game page (`games/<slug>/index.html`, owned by the integration task) follows art-direction §11 exactly: `lang="en-CA"`, `data-game="<slug>"`, `data-scheme-lock` per the registry (`dark` for darkroom, plates, latent), the theme boot script from art-direction §5 **verbatim and inline before any CSS or module**, `<main id="stage" class="ar-stage" tabindex="-1">`, and `<script type="module" src="./main.ts">`. Add `data-grain="off"` where the GDD renders its own grain (darkroom, plates, latent). Titles, descriptions and OG text come from Appendix A (the registry), copied by hand: there is no build-time injection (§9 R4).

Harness pages (`dev/*.html`) use the same template with `<title><Game> · dev · <task></title>`.

`main.ts` begins:
```ts
import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import { mountShell, guardStartup, hasWebGL2, showNoWebGL } from '@shared/ui'
```

### 3.5 CSS
- Chrome classes use the `ar-` prefix and live only in `src/shared/ui/`.
- Each game prefixes its classes: `tx-` texturedle, `dr-` darkroom, `pl-` plates, `li-` latent, `lb-` lens bench, `st-` studio, `hub-` hub. Game CSS may use the tokens (`--ar-*`, `--game-accent*`) and defines its own in-world tokens under its prefix.
- Never style `body`, `html` or `.ar-*` from game CSS. Game CSS files are imported by the module that needs them (`import './book.css'`).

### 3.6 URL flags (parsed once by `flags()` in `@shared/core`)

| Flag | Meaning | Who honours it |
|---|---|---|
| `?test=1` | Deterministic test mode: no intros or idle animation, audio muted, DPR 1, quality tier `test` unless `?quality=` given, time advances only through `advance()`/`step()` where the GDD says so | every game |
| `?seed=N` | Fixed seed for everything seeded | every game |
| `?reset=1` | Clear this game's saves before boot (`resetGame(slug)`) | every game |
| `?fresh=1` | Start fresh without deleting saves (don't read, don't write) | every game |
| `?embed=poster` | Hub poster mode: no shell (stage at inset 0), no audio, no saves read or written, no help-on-first-visit; `__game.poster()` composes the hero shot | every game |
| `?embed=preview` | Attract loop for the hub's live peek (STRETCH) | optional |
| `?quality=high\|medium\|low\|test` (alias `?q=`) | Force a quality tier | every game |
| `?force=1` | "Try anyway" without WebGL2 | every game |
| `?theme=light\|dark`, `?motion=reduce` | Theme and reduced-motion test overrides (art-direction §5) | chrome + games |
| `?debug=<name>` | Game-specific debug views (e.g. `bake`, `library`) | per GDD |
| `?mute=1` | Start muted (not persisted) | chrome |
| GDD-specific | e.g. texturedle `?day=`, plates `?gallery=1`, `?plate=`, studio `?quality=test` | per GDD |

### 3.7 `window.__game` base contract
Every page (each game, the hub, every harness page, every shared-module dev page) installs `window.__game` through `installGameApi()` from `@shared/core` (§4.1). The base members are:

```ts
interface GameApiBase {
  readonly slug: string             // 'darkroom', 'hub', 'shared:photochem', 'plates:dev:content'…
  readonly version: string          // e.g. 'darkroom@1'
  ready: boolean                    // true after the first real frame (hub contract, hub.md §11.1)
  whenReady(): Promise<void>
  state(): unknown                  // JSON-serializable snapshot for evals
  errors(): string[]                // uncaught errors + unhandled rejections + console.error lines since load
  poster?(): Promise<void>          // hero composition, no UI, no spoilers (hub.md §11.1)
}
```
`markReady()` sets `ready`, resolves `whenReady()`, sets `document.body.dataset.ready = '1'`, and posts `{ type: 'ar:ready' }` to `window.parent` when embedded. GDD test APIs are merged on top of this. **Overrides:** latent's `ready: Promise<void>` and plates' `ready(): Promise<void>` become `ready: boolean` + `whenReady()`. Texturedle's `body[data-tx-ready]` may also be set; `body[data-ready="1"]` is always set.

### 3.8 Storage keys (override every GDD key name)
All persistence goes through `@shared/storage` (§4.2): one IndexedDB database `andrew-rankin` with one object store per slug, and `localStorage` keys `ar:<slug>:<key>`. GDD key names map as follows:

| Game | localStorage (`ar:<slug>:…`) | IndexedDB store `<slug>` keys |
|---|---|---|
| global | `ar:theme`, `ar:sound`, `ar:volume` (chrome only) | — |
| hub | `ar:hub:loupe`; session `ar:hub:lit`, `ar:hub:last` | — |
| every game | `ar:<slug>:hub` (hub progress note, hub.md §8.5, via `writeHubNote`), `ar:<slug>:seenHelp` (shell) | — |
| texturedle | `save` (SaveV1), `settings` inside it | `rubbing:<day>` |
| darkroom | `notes`, `settings`, `firstRun` | `pin:1`…`pin:6`, `pin:auto` (via `createSlots`), `print:<id>`, `binder:<id>`, `meta:notebook`, `meta:briefs` |
| plates | `settings` | `kv:progress`, `kv:return`, `kv:bench`, `kv:meta`, `pin:<n>` (via `createSlots`), `exp:<plateId>:<CONTENT_VERSION>` (GDD's `ar-plates` database is replaced) |
| latent | `slot0`…`slot3` (SaveV1 JSON; GDD's `latent.v1.slot*`) | `print:<id>` (GDD's `latent` database is replaced) |
| lensbench | `progress`, `camera`, `street`, `designs`, `lenses` (GDD's `lensbench:v1:*` and `arc:optics:lenses:v1`) | `roll:<id>`, `frame:<id>` (GDD's `lensbench` database is replaced) |
| studio | `house` (fallback copy only) | `house`, `roll:<id>`, `latent:<frameId>`, `neg:<frameId>`, `print:<id>` |
| cross-game | — | store `filmcan` (STRETCH crossovers, §4.2) |

Every read and write is wrapped in try/catch inside `@shared/storage`. With storage unavailable (private mode) the stores fall back to memory and report `persistent: false`; games show their GDD's "saves won't stick" note.

### 3.9 Audio
- One `AudioContext` for the page, created and unlocked by `@shared/audio` on the first gesture (`Audio.arm()`; `mountShell` calls it). **No sound before a gesture, none on load, none in `?embed=poster`, none with `?test=1`.**
- Chrome uses `uiSound(name)` (art-direction §10.2). World sounds use `Audio.play(id, params)` / `Audio.loop(id, params)` with the ids in Appendix B. Each game's world SoundDefs live in `games/<slug>/sounds.ts` (owned by `shared-audio`), registered by calling `registerSounds()` from that file at boot. Texturedle is the exception: its contact synth and modal engine are part of its simulation and live in `games/texturedle/audio/**` (owned by `texturedle-sim`), connected to `getAudio().master`.
- Unknown ids are a silent no-op (`console.debug` once), so games never block on the audio task.
- Captions: a SoundDef may carry `caption`; `Audio.onCaption(cb)` fires when a captioned sound plays (rate-limited per id). Games with a captions setting display them.
- Haptics: `haptic(ms | pattern)` from `@shared/audio` (touch input only, tied to the sound preference, art-direction §10.3).

### 3.10 Console and errors
- Zero `console.error` and zero uncaught errors in normal operation: the screenshot harness treats them as failures. Use `console.debug` for diagnostics; `console.warn` only for real degradations (e.g. "no float render targets, using RGBA8 path"), once.
- Wrap start-up in `guardStartup(stage, start)` (shows the crash card). Check `hasWebGL2()` first and show `showNoWebGL()` (or the GDD's fallback, e.g. latent's records-only mode) unless `?force=1`.

### 3.11 Copy and content
Canadian English, sentence case, no exclamation marks in UI (art-direction §2). No real people, brands, logos or copyrighted text. Every texture, model, font glyph and sound is procedural. No network requests to other origins at runtime (no CDNs, no analytics).

### 3.12 Shared fiction (keep these consistent across games)
Lantern Street (Darkroom's basement community darkroom; Lens Bench's street and Quist's shop upstairs); **O.** (the unseen keyholder in Darkroom, the house owner in Sunny 16); **Q.** (Quist, Lens Bench; retired); **Nightjar Photographic** (fictional paper and film brand in Darkroom and Sunny 16); **RANKIN 400** (the site's film stock, chrome only); the rusty mailbox (Texturedle Day 1; house number 16 in Sunny 16). Plates (Gaunt Rock, 1887–88) and Latent Image (Varrow, 1979/2003) are self-contained worlds.

---

## 4. Shared modules

Every module below has: an owner task, its files, the full public API, behaviour notes, a performance budget, acceptance tests (run on its dev page `src/shared/<module>/dev/index.html`, which installs `window.__game` with at least `selftest()`), and its spike source. **Stub first (§2.2).**

Where a module is a port of a spike, its public API is the spike's `core/index.ts` export list **with the same names and signatures**, plus the additions and changes written here. Consumers may read the spike source for the exact signatures of ported names.

### 4.1 `@shared/core` (owner: shared-platform)

Pure TypeScript, DOM allowed, **no three in the barrel**. Files: `index.ts` (barrel), `rng.ts`, `noise.ts`, `math.ts`, `bus.ts`, `loop.ts`, `flags.ts`, `quality.ts`, `gestures.ts`, `keys.ts`, `files.ts`, `idle.ts`, `testapi.ts`, plus `gfx.ts` (three helpers, **not** re-exported by the barrel: import `@shared/core/gfx`).

**`rng.ts`**: write these first. The reference implementations are binding, so every game gets identical sequences.
```ts
export type Rng = () => number                              // uniform [0, 1)
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function hashString(s: string): number {               // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
export function hash2i(ix: number, iy: number, seed = 0): number {   // uint32
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}
export function hash2(ix: number, iy: number, seed = 0): number      // hash2i / 2^32, in [0, 1)
export function hash3(ix: number, iy: number, iz: number, seed = 0): number   // [0, 1)
export function rngStream(seed: number, stream: string): Rng          // mulberry32((seed ^ hashString(stream)) >>> 0)
export function randRange(r: Rng, a: number, b: number): number
export function randInt(r: Rng, a: number, bExclusive: number): number
export function gauss(r: Rng): number                                 // N(0,1), Box–Muller
export function pick<T>(r: Rng, arr: readonly T[]): T
export function shuffle<T>(r: Rng, arr: T[]): T[]                     // in place, Fisher–Yates
```

**`noise.ts`** (seeded, deterministic):
```ts
export function valueNoise1(t: number, seed?: number): number                       // [-1,1], C1
export function valueNoise2(x: number, y: number, seed?: number): number           // [-1,1], quintic fade
export function gradientNoise2(x: number, y: number, seed?: number): number         // Perlin-style [-1,1]
export interface FbmOptions { octaves?: number /*4*/; gain?: number /*0.5*/; lacunarity?: number /*2.03*/; seed?: number; basis?: 'value' | 'gradient' }
export function fbm1(t: number, o?: FbmOptions): number                             // ≈[-1,1]
export function fbm2(x: number, y: number, o?: FbmOptions): number                  // ≈[-1,1]
export function ridged2(x: number, y: number, o?: FbmOptions): number              // [0,1]
export interface WorleyHit { f1: number; f2: number; id: number; cx: number; cy: number }
export function worley2(x: number, y: number, o?: { jitter?: number /*0.9*/; seed?: number }, out?: WorleyHit): WorleyHit
export function bandNoise(t: number, loHz: number, hiHz: number, seed: number, partials?: number /*6*/): number   // unit-RMS sum of sines (tremor, shake)
```

**`math.ts`**: `clamp`, `clamp01`, `lerp`, `invLerp`, `remap`, `smoothstep(e0, e1, x)`, `smootherstep`, `fract`, `mod` (always positive), `degToRad`, `radToDeg`, `approxEq`, `damp(cur, target, lambda, dt)` (frame-rate independent), `expDecay(x, tau, dt)`, and:
```ts
export interface Spring1 { x: number; v: number }
export function springStep(s: Spring1, target: number, omega: number, zeta: number, dt: number): Spring1   // stable; substeps internally when dt·omega > 0.5
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number
export function monotoneCubic(xs: readonly number[], ys: readonly number[]): (x: number) => number          // Fritsch–Carlson
export function median(a: ArrayLike<number>): number
export function percentile(a: ArrayLike<number>, p: number): number
```

**`bus.ts`** (optional; a GDD's own bus may stay as specified):
```ts
export interface Bus<E extends Record<string, unknown>> {
  on<K extends keyof E>(k: K, fn: (e: E[K]) => void): () => void
  once<K extends keyof E>(k: K, fn: (e: E[K]) => void): () => void
  emit<K extends keyof E>(k: K, e: E[K]): void
  clear(): void
}
export function createBus<E extends Record<string, unknown>>(): Bus<E>
```

**`loop.ts`**:
```ts
export interface LoopOptions { fixedDt?: number /*1/60*/; maxSteps?: number /*4; the sim slows, never spirals*/; maxFrameDt?: number /*0.1 s*/; pauseWhenHidden?: boolean /*true*/; autoStart?: boolean /*true*/ }
export interface Loop {
  start(): void; stop(): void; readonly running: boolean
  setPaused(on: boolean): void; readonly paused: boolean          // paused = no fixed steps; onFrame still runs so UI keeps drawing
  readonly simTime: number; readonly frame: number
  onStep(fn: (dt: number, simTime: number) => void, order?: number): () => void                       // fixed steps, ascending order
  onFrame(fn: (dtReal: number, alpha: number, simTime: number) => void, order?: number): () => void  // once per rAF after steps
  advance(frames: number, dt?: number): void     // deterministic: `frames` fixed steps synchronously, then one onFrame; works while paused or stopped
  stats(): { fps: number; meanMs: number; p75Ms: number; p90Ms: number; stepsLastFrame: number }
}
export function createLoop(o?: LoopOptions): Loop
```

**`flags.ts`** (§3.6):
```ts
export type Tier = 'high' | 'medium' | 'low' | 'test'
export interface UrlFlags {
  readonly test: boolean; readonly seed: number | null; readonly reset: boolean; readonly fresh: boolean
  readonly embed: 'poster' | 'preview' | null; readonly quality: Tier | null; readonly force: boolean
  readonly theme: 'light' | 'dark' | null; readonly debug: string | null; readonly muted: boolean
  get(name: string): string | null; has(name: string): boolean; num(name: string, dflt: number): number; bool(name: string): boolean
}
export function flags(): UrlFlags                       // parsed once from location.search and cached
export function prefersReducedMotion(): boolean          // OS setting OR <html data-motion="reduce"> (art-direction §5)
export function onReducedMotionChange(cb: (on: boolean) => void): () => void
export function storageDisabled(): boolean               // embed=poster or fresh=1
```

**`quality.ts`**:
```ts
export interface DeviceInfo { coarsePointer: boolean; smallScreen: boolean /* min(screen w, h) < 900 */; cores: number; memoryGB: number | null; ios: boolean; android: boolean; webdriver: boolean; saveData: boolean }
export function deviceInfo(): DeviceInfo
export interface GLInfo { renderer: string; vendor: string; swiftshader: boolean; maxTextureSize: number; floatRT: boolean; halfFloatRT: boolean; floatBlend: boolean; floatLinear: boolean }
export function probeGL(gl?: WebGL2RenderingContext | null): GLInfo | null    // throwaway context if none given; cached
export function detectTier(o?: { gl?: WebGL2RenderingContext | null; prefer?: Tier }): Tier
//  order: flags().quality → (flags().test || webdriver || swiftshader) ? 'test'
//         → (ios || (coarse && small) || cores ≤ 4 || memory ≤ 4) ? 'low' → coarse ? 'medium' → 'high'
export function dprCap(tier: Tier): number               // high 2, medium 1.5, low 1, test 1
export interface PerfMonitor {
  sample(frameMs: number): void
  readonly meanMs: number; readonly p75Ms: number; readonly p90Ms: number
  onDegrade(cb: () => void, o?: { thresholdMs?: number /*22*/; windowS?: number /*3*/; cooldownS?: number /*5*/ }): () => void
  onImprove(cb: () => void, o?: { thresholdMs?: number /*12*/; windowS?: number /*10*/ }): () => void
}
export function createPerfMonitor(): PerfMonitor
```
Games map the shared tiers onto their GDD tiers (texturedle high/low; darkroom High/Med/Low; lensbench desktop/phone/test; studio high/low/test).

**`gestures.ts`** (Pointer Events; sets `touch-action: none` on the element):
```ts
export interface GestureOptions { tapMs?: number /*250*/; tapPx?: number /*6*/; holdMs?: number /*450*/; doubleMs?: number /*300*/; doublePx?: number /*12*/; preventContextMenu?: boolean /*true*/ }
export type GestureKind = 'down' | 'move' | 'up' | 'cancel' | 'hover' | 'tap' | 'doubleTap' | 'hold' | 'dragStart' | 'drag' | 'dragEnd'
  | 'wheel' | 'pinch' | 'twist' | 'twoFingerTap' | 'twoFingerDrag'
export interface GestureEvent {
  kind: GestureKind; id: number; t: number
  x: number; y: number                    // CSS px relative to the element
  nx: number; ny: number                  // NDC −1..1, y up
  dx: number; dy: number                  // since the previous event
  totalDx: number; totalDy: number; startX: number; startY: number
  vx: number; vy: number                  // px/s, mean over the last 80 ms (throws, flicks)
  scale: number; angle: number            // pinch scale and twist (rad) since the two-finger start
  deltaY: number                          // wheel, normalized to px
  pointerType: 'mouse' | 'pen' | 'touch'; button: number; buttons: number; pointers: number; pressure: number
  shift: boolean; alt: boolean; ctrl: boolean; meta: boolean
  native: Event
}
export interface Gestures {
  on(handler: (e: GestureEvent) => boolean | void, priority?: number): () => void   // higher priority first; returning true stops lower handlers
  setOptions(o: Partial<GestureOptions>): void
  readonly activePointers: number
  dispose(): void
}
export function createGestures(el: HTMLElement, o?: GestureOptions): Gestures
export function circularDrag(cx: number, cy: number): { update(x: number, y: number): number /* Δrad */; reset(): void }
```
Games set their GDD thresholds through the options (Sunny 16 tap 180 ms; Darkroom hold 140 ms; Plates long-press 450 ms…).

**`keys.ts`**:
```ts
export function shouldGameIgnoreKey(e: KeyboardEvent): boolean   // hub.md §9.5: input/textarea/select/[contenteditable], inside .ar-shell, dialog[open], [popover]
export function onGameKey(handler: (e: KeyboardEvent) => void, o?: { up?: boolean; target?: Window | HTMLElement }): () => void   // pre-filtered
export interface KeyState { isDown(code: string): boolean; readonly down: ReadonlySet<string>; dispose(): void }
export function trackKeys(target?: Window): KeyState             // cleared on blur
```

**`files.ts`** (PNG import, downloads, sharing):
```ts
export function pickFile(accept: string): Promise<File | null>
export function onFileDrop(el: HTMLElement, cb: (f: File) => void, o?: { accept?: string[] /* MIME prefixes, default ['image/'] */; hoverClass?: string }): () => void
export interface ImportedImage { image: ImageData; w: number; h: number; name: string; srcW: number; srcH: number }
export class ImportError extends Error {}                       // the message is user-safe copy
export function importImage(f: Blob, o?: { maxSide?: number /*1600*/; cropAspect?: number /* w/h, centre crop */; outW?: number; outH?: number }): Promise<ImportedImage>
//  createImageBitmap(f, { imageOrientation: 'from-image' }) → canvas → ImageData. PNG, JPEG, WebP. Anything else throws ImportError("That file wouldn't load.")
export function canvasToBlob(c: HTMLCanvasElement | OffscreenCanvas, type?: string, quality?: number): Promise<Blob>
export function downloadBlob(b: Blob, filename: string): void
export function shareOrDownload(o: { blob?: Blob; filename?: string; text?: string; title?: string; url?: string }): Promise<'shared' | 'copied' | 'downloaded' | 'failed'>
export function copyText(text: string): Promise<boolean>
```

**`idle.ts`**:
```ts
export function nextFrame(): Promise<number>
export function idle(timeoutMs?: number): Promise<void>                 // requestIdleCallback with a setTimeout fallback
export function sleep(ms: number): Promise<void>
export function runSliced<T>(job: Iterator<unknown, T, void>, o?: { sliceMs?: number /*8*/; signal?: AbortSignal; onProgress?: (steps: number) => void }): Promise<T>
//  calls job.next() until sliceMs elapses, yields to the next frame (setTimeout(0) while hidden), resolves with the return value
```

**`testapi.ts`** (§3.7):
```ts
export interface GameApiBase { readonly slug: string; readonly version: string; ready: boolean; whenReady(): Promise<void>; state(): unknown; errors(): string[]; poster?(): Promise<void> }
export function installGameApi<T extends object>(slug: string, version: string, api: T & { state(): unknown }): GameApiBase & T
export function extendGameApi(part: Record<string, unknown>): void       // merge more members in later (Sunny 16's registerTestApi)
export function markReady(): void
export function captureErrors(): void                                   // idempotent; installGameApi calls it
declare global { interface Window { __game?: GameApiBase & Record<string, unknown> } }
```

**`gfx.ts`** (three; import from `@shared/core/gfx`):
```ts
import type * as THREE from 'three'
export interface RendererOptions { tier: Tier; alpha?: boolean; antialias?: boolean; preserveDrawingBuffer?: boolean; powerPreference?: WebGLPowerPreference; dprCap?: number }
export function createRenderer(canvas: HTMLCanvasElement, o: RendererOptions): THREE.WebGLRenderer   // WebGL2; DPR = min(devicePixelRatio, dprCap(tier)); SRGB output; NoToneMapping
export function fitRenderer(renderer: THREE.WebGLRenderer, el: HTMLElement, onResize?: (cssW: number, cssH: number) => void): () => void   // ResizeObserver, debounced 100 ms
export function fullscreenTriangle(): THREE.BufferGeometry
export function createRT(w: number, h: number, o?: { type?: THREE.TextureDataType; format?: THREE.PixelFormat; depth?: boolean | 'texture'; filter?: 'nearest' | 'linear'; mipmaps?: boolean; samples?: number }): THREE.WebGLRenderTarget
export function floatCaps(renderer: THREE.WebGLRenderer): { floatRT: boolean; halfFloatRT: boolean; floatBlend: boolean; floatLinear: boolean }
export function readRTPixels(renderer: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget, o?: { async?: boolean }): Promise<Uint8Array | Float32Array>   // readRenderTargetPixelsAsync with a sync fallback
export function dataTexture(data: Uint8Array | Float32Array | Uint16Array, w: number, h: number, o: { format: 'r' | 'rg' | 'rgba'; type: 'u8' | 'f32' | 'f16'; filter?: 'nearest' | 'linear'; repeat?: boolean; mipmaps?: boolean }): THREE.DataTexture
export function toHalfFloatArray(f32: Float32Array): Uint16Array        // THREE.DataUtils.toHalfFloat
export function disposeDeep(obj: THREE.Object3D): void
export function snapshotCanvas(renderer: THREE.WebGLRenderer, draw: () => void, type?: string, quality?: number): Promise<Blob>   // draw, then toBlob in the same task
```

Acceptance: `/src/shared/core/dev/` runs `__game.selftest()`, all pass: the first three `mulberry32(42)` values match the reference; `hashString('texturedle')` is stable; `fbm2` stays within [−1.05, 1.05] over 10k samples; `loop.advance(60)` runs exactly 60 steps; flags parse; scripted PointerEvents produce tap, drag and pinch.

### 4.2 `@shared/storage` (owner: shared-platform)

```ts
import type { GameSlug } from '@shared/games'
export const DB_NAME = 'andrew-rankin'
export const DB_VERSION = 1
export const STORES = ['hub', 'texturedle', 'darkroom', 'plates', 'latent', 'lensbench', 'studio', 'filmcan'] as const
export type StoreName = (typeof STORES)[number]
// Every store is created in the single version-1 upgrade, so games never race to add stores.
// When storageDisabled() (embed=poster, fresh=1), every store is a throwaway memory store.

export interface KV {
  readonly persistent: boolean                                  // false = memory fallback
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>               // structured clone: Blobs, typed arrays, plain objects
  del(key: string): Promise<void>
  keys(prefix?: string): Promise<string[]>
  clear(prefix?: string): Promise<void>
}
export function idb(store: StoreName): KV
export interface LocalStore { readonly persistent: boolean; get<T>(key: string, dflt: T): T; set(key: string, value: unknown): void; del(key: string): void; keys(): string[]; clear(): void }
export function local(slug: StoreName): LocalStore              // JSON under 'ar:<slug>:<key>'
export function storageStatus(): Promise<{ idb: boolean; local: boolean }>
export function resetGame(slug: StoreName): Promise<void>       // clears ar:<slug>:* (except ar:<slug>:hub) and that idb store

export function writeHubNote(slug: GameSlug, note: string): void   // ≤ 28 chars (longer is truncated with '…'); writes {note, at: Date.now()} to 'ar:<slug>:hub'
export function readHubNote(slug: GameSlug): { note: string; at: number } | null

export interface SlotMeta { id: string; label: string; savedAt: number; auto: boolean; thumb?: Blob; extra?: Record<string, unknown> }
export interface SaveSlots<T> {
  list(): Promise<SlotMeta[]>                                    // manual slots by id, then autos newest first
  save(id: string, data: T, meta?: Partial<Omit<SlotMeta, 'id' | 'savedAt'>>): Promise<SlotMeta>
  autosave(data: T, meta?: Partial<SlotMeta>): Promise<SlotMeta> // rolling ring of `auto` slots
  load(id: string): Promise<{ meta: SlotMeta; data: T } | null>  // runs migrate() on a version mismatch; null if it returns null
  remove(id: string): Promise<void>
  nextFree(): Promise<string | null>
}
export function createSlots<T>(store: StoreName, o: { prefix?: string /*'slot'*/; manual: number; auto: number; version: number; migrate?: (old: unknown, fromVersion: number) => T | null }): SaveSlots<T>
//  keys: `${prefix}:${id}` → { v, data }, `${prefix}meta:${id}` → SlotMeta. Manual ids '1'…'n', auto ids 'auto:1'…'auto:k'.

export function debouncedSave(fn: () => void | Promise<void>, ms: number): { request(): void; flush(): Promise<void>; dispose(): void }   // also flushes on visibilitychange→hidden and pagehide
export function compressBytes(u8: Uint8Array): Promise<Uint8Array>      // gzip via CompressionStream when available, else stored (a 1-byte header says which)
export function decompressBytes(u8: Uint8Array): Promise<Uint8Array>
export function packTyped(fields: Record<string, ArrayBufferView | number | string | boolean | null | object>): Uint8Array   // one blob: JSON header + aligned typed arrays
export function unpackTyped(u8: Uint8Array): Record<string, unknown>

// Cross-game film can (STRETCH crossovers: Texturedle, Lens Bench, Sunny 16 → Darkroom)
export interface FilmCanItem { id: string; from: GameSlug; kind: 'latent' | 'negative' | 'positive'; createdAt: number; w: number; h: number; png: Blob; meta: Record<string, unknown> }
export const filmcan: {
  put(item: Omit<FilmCanItem, 'id' | 'createdAt'>): Promise<string>
  list(): Promise<Omit<FilmCanItem, 'png'>[]>
  get(id: string): Promise<FilmCanItem | null>
  remove(id: string): Promise<void>
}
```
Acceptance (`/src/shared/storage/dev/`): set/get/keys/del round-trips a Blob, a Float32Array and nested JSON; slots save, list, load and migrate; the memory fallback works when `indexedDB.open` throws (simulated); `packTyped`/`unpackTyped` round-trip bit-exactly; compression round-trips.

### 4.3 `@shared/ui` and `@shared/games` (owner: shared-platform)

The chrome exactly as `art-direction.md` §3–§11 and `hub.md` §9–§10 specify. Files (hub.md §9.1): `fonts.ts`, `tokens.css` (art-direction §4.1 verbatim, plus a `:root[data-motion="reduce"]` copy of the reduced-motion block and the `[data-embed="poster"]` rules below), `base.css`, `theme.ts`, `shell.ts`, `shell.css`, `help.ts`, `toast.ts`, `menu.ts`, `loader.ts`, `fallback.ts`, `icons.ts`, `grease.ts`, `grain.ts`, plus `dialog.ts`, `controls.ts` and `index.ts` (barrel). `src/shared/games.ts` is the registry (hub.md §10 types, Appendix A data).

**API: hub.md §9.2 verbatim** (`ShellAction`, `HelpContent`, `ShellOptions`, `Shell`, `mountShell`, `mountHubShell`, `shouldGameIgnoreKey`), plus:
```ts
// toast.ts
export function toast(text: string, o?: { kind?: 'info' | 'success' | 'error'; ms?: number }): void
export function announce(text: string): void
// loader.ts (art-direction §7.8)
export interface Loader { progress(p: number): void; label(text: string): void; done(): Promise<void> }
export function showLoader(stage: HTMLElement, o?: { label?: string; delayMs?: number /*250*/ }): Loader
// fallback.ts (art-direction §7.9)
export function hasWebGL2(): boolean
export function showNoWebGL(stage: HTMLElement, o?: { title?: string; extra?: HTMLElement }): void
export function showCrashCard(stage: HTMLElement, err: unknown, o?: { title?: string }): void
export function guardStartup(stage: HTMLElement, start: () => Promise<void> | void): Promise<void>
// theme.ts (art-direction §5)
export type Theme = 'light' | 'dark'
export function getTheme(): Theme
export function setTheme(t: Theme | null): void        // null = match the system (removes ar:theme)
export function onThemeChange(cb: (t: Theme) => void): () => void
export function schemeLock(): Theme | null
export { prefersReducedMotion } from '../core/flags'
export const THEME_BOOT_SCRIPT: string                 // the art-direction §5 inline script, for reference and tests
// dialog.ts (datasheet dialogs, art-direction §7.5)
export interface DialogAction { id: string; label: string; kind?: 'primary' | 'secondary' | 'ghost'; onSelect?: () => void | boolean /* false keeps it open */ }
export function openDialog(o: { edge: string /* e.g. 'LOGBOOK · ▸02' */; title: string; body: string | HTMLElement; actions?: DialogAction[]; dismissible?: boolean; wide?: boolean; onClose?: () => void }): { el: HTMLDialogElement; close(): void }
export function confirmDialog(message: string, o?: { title?: string; ok?: string; cancel?: string }): Promise<boolean>
// controls.ts (art-direction §7.2–7.3)
export function bindRange(input: HTMLInputElement, o?: { format?: (v: number) => string; detents?: readonly number[]; onDetent?: (v: number) => void }): () => void
export function createSwitch(o: { label: string; checked: boolean; onChange: (on: boolean) => void }): HTMLButtonElement
export function createSegmented<T extends string>(o: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }): HTMLElement & { setValue(v: T): void }
// menu.ts
export interface MenuItem { id: string; label: string; icon?: IconName; checked?: boolean; disabled?: boolean; onSelect(): void }
export function openMenu(anchor: HTMLElement, items: MenuItem[]): { close(): void }
// help.ts
export function openHelp(slug: GameSlug | 'hub', content: HelpContent): void
// icons.ts (art-direction §8)
export type IconName = 'back' | 'sheet' | 'help' | 'sound' | 'sound-off' | 'lights' | 'safelight' | 'fullscreen' | 'more' | 'close' | 'save' | 'load' | 'reset' | 'download' | 'loupe' | 'import'
export const ICONS: Record<IconName, string>              // inner SVG markup on the 24×24 grid
export function iconSvg(name: IconName, o?: { size?: number; title?: string; className?: string }): string
// grease.ts (art-direction §6.3; a string seed goes through hashString)
export interface Rect { x: number; y: number; w: number; h: number }
export function circlePath(rect: Rect, seed: number | string): string
export function underlinePath(w: number, seed: number | string): string
export function checkPath(seed: number | string): string
export function arrowPath(from: [number, number], to: [number, number], seed: number | string): string
export function starPath(r: number, seed: number | string): string
export function cropMarksPath(rect: Rect, seed: number | string): string
export function questionPath(size: number, seed: number | string): string
export function drawStroke(path: SVGPathElement, o?: { ms?: number }): Promise<void>   // dasharray draw; instant under reduced motion
export function ensureGreaseFilter(): void                                            // hidden <svg> with filter#ar-grease, once per page
// grain.ts
export function installGrain(): void                                                  // art-direction §6.4; skipped when <html data-grain="off">
```
`@shared/games` (`src/shared/games.ts`, pure data, no DOM, importable from `vite.config.ts`): `GameSlug`, `GreaseMark`, `GameInfo`, `SITE`, `GAMES`, `gameBySlug` exactly as hub.md §10, with the entries in Appendix A.

**Behaviour games rely on:**
- `mountShell()` reads the registry (title, frame number, accent, scheme), applies the scheme lock, calls `Audio.arm()`, installs grain (unless `data-grain="off"`) and the grease filter, publishes `--ar-shell-total`, and opens help once after the game calls `markReady()` when `helpOnFirstVisit` (default true). **In `?embed=poster` it sets `<html data-embed="poster">`, hides itself (`.ar-shell{display:none}`) and puts the stage at `inset: 0`.**
- `shouldGameIgnoreKey` is implemented in `@shared/core/keys` and re-exported here.
- Fonts: `fonts.ts` imports the Fontsource files listed in art-direction §3 **only once the packages are installed** (§9 R1). Until then it is an empty module and the token stacks fall back to system fonts. Never request Google Fonts.

Acceptance (`/src/shared/ui/dev/` is a fake game page calling `mountShell({ slug: 'darkroom', actions: [save, import, reset], help })`): the desktop shot shows the film-strip shell with perforations, `▸02` in the darkroom lit accent, the title, and Help, Sound and Fullscreen; plus a toast, the datasheet dialog with header `RANKIN 400 · DATASHEET · ▸02 DARKROOM`, the loader at 40% and the no-WebGL2 card (via `?view=` switches). The mobile shot shows the icon-only back button and actions folded into More. The `?embed=poster` shot has no shell. Light and dark themes are both correct. No console errors.

### 4.4 `@shared/audio` (owner: shared-audio)

A port of `spikes/audio/core` (engine, synth, analysis, sound library). Public API = the spike's `index.ts` exports (`Audio`, `AudioEngine`, `Synth`, `GrainStream`, helpers, all types, all sound arrays, `getAudio`, `sound`, `uiSound`) **plus**:
```ts
export type AudioGame = 'hub' | 'texturedle' | 'darkroom' | 'plates' | 'latent' | 'lensbench' | 'studio'
export type UiSoundName = 'tick' | 'shutter' | 'advance' | 'switch' | 'paper' | 'paper-out' | 'canister' | 'bell' | 'thunk' | 'develop'
export function uiSound(name: UiSoundName, opts?: { gain?: number; detune?: number }): Voice | null     // art-direction §10.2 recipes, exactly
export function getAudio(): { ctx: AudioContext; master: GainNode; ui: GainNode } | null                // art-direction §10.1 graph
export const sound: { readonly muted: boolean; setMuted(m: boolean): void; readonly volume: number; setVolume(v: number): void; onChange(cb: (p: SoundPrefs) => void): () => void }
export function haptic(pattern: number | number[]): void            // only after touch input, only when sound is on
// additions on AudioEngine:
//   has(id: string): boolean
//   onCaption(cb: (text: string, id: string) => void): () => void   // fires for defs with `caption`, at most once per id per 1.5 s
//   setMuffle(hz: number | null, ramp?: number): void                // null = off (Sunny 16 basement, Lens Bench dark cloth)
//   noise(color: 'white' | 'pink' | 'brown'): AudioBuffer | null     // shared looping noise buffers
// addition on both SoundDef kinds: caption?: string
```
Rules (art-direction §10): one context, created on the first `pointerdown`/`keydown`/`touchend` after `Audio.arm()`. Graph: `ui (0.55) → master (volume × !muted) → DynamicsCompressor (−18 dB, knee 12, ratio 4, 3 ms, 150 ms) → destination`, plus `sfx` and `amb` buses into master. Prefs: `ar:sound` (`'on' | 'off'`, default on) and `ar:volume` (0..1, default 0.7), with a `window` event `ar:soundchange`. Mute ramps over 60 ms. Suspend while hidden. `?test=1`, `?mute=1` and `?embed=poster` keep everything silent. `play()` never throws, and returns `null` when locked, muted, unknown or rate-limited.

**Game sound libraries.** `shared-audio` also writes `games/{darkroom,plates,latent,lensbench,studio}/sounds.ts`, each shaped like this:
```ts
import { Audio, type SoundDef } from '@shared/audio'
export const SOUNDS: SoundDef[]            // ids '<slug>.<name>' exactly as Appendix B, with the params listed there
export function registerSounds(): void     // Audio.register(SOUNDS); idempotent
```
They are built from each GDD's audio table (darkroom §7.3, plates §7.4, latent §7.3, lensbench §7.3, studio §7.3), reusing the generic library where it fits. Texturedle's sounds stay in `games/texturedle/audio/**` (texturedle-sim).

Acceptance (`/src/shared/audio/dev/`, a port of the spike demo listing every id with a play button): `__game.selftest()` renders each one-shot offline and checks finite samples; `ui.*` peaks ≤ −12 dBFS after the compressor and lasts ≤ 1 s; every Appendix B id is registered; every loop starts and stops without clicks (no sample jump > 0.2). No sound before a gesture.

### 4.5 `@shared/photochem` (owner: shared-photochem)

Pure TypeScript photographic chemistry (no DOM, no three), ported from `spikes/photochem/core`. Used by Darkroom (paper, cyanotype, spectral light), Sunny 16 and Lens Bench (film and paper curves, grain), and optionally Latent. It runs in **physical real time**: games compress slow processes by scaling the `dt` they pass in (§3.2).

Public API = the spike's `core/index.ts` exports with the same names and signatures (bands: `Bands`, `UV`…`RED`, `LIGHTS`, `LightId`, `lightBands`, `sunBands`, `SENSITIVITY`, `makeSpectral`, `actinic`, `dichroicFilter`, `CAMERA_FILTERS`, `rgbToBands`; colour helpers; curves; kinetics; paper: `PAPERS`, `paper()`, `makePaper`, `vcGradeFilter`, `VC_GRADES`, `gradeLabel`, `paperMetrics`; baths: `DEVELOPERS`, `makeDeveloper`, `makeStop`, `makeFixer`, `makeWash`, `makeToner`, `AIR`; `SilverSheet`; `CyanoSheet`, `CYANO_BATHS`; film: `FILM_STOCKS`, `makeFilm`, `FilmFrame`, `pushPull`; image: `LinearImage`, `fromRGBA8`, `resample`, `luminanceOf`, `digitalNegative`, `transmission`, `stepWedge`, `mailboxScene`, `fernMask`, `brushCoatMask`; printing: `enlargerLux`, `autoPrint`; the GLSL strings), with these guarantees and additions:

```ts
// --- The classes consumers rely on (spike semantics) ---
export class SilverSheet {
  constructor(model: PaperModel | PaperSpec, w: number, h: number, opts?: number | { areaM2?: number; simScale?: 1 | 0.5 })
  //  simScale 0.5 runs the chemistry fields at half resolution and upsamples bilinearly in render()
  readonly w: number; readonly h: number; readonly f: Record<SilverField, Float32Array>
  expose(light: Bands, seconds: number, opts?: { filter?: Bands; mask?: ArrayLike<number> | null }): void   // mask = per-pixel transmission (negative × occluders)
  enter(bath: SilverBath): void
  process(bath: SilverBath, dt: number, opts?: { contact?: ArrayLike<number> | null; agitation?: number; diffuse?: boolean }): StepReport
  render(out: Uint8ClampedArray, illum?: RGB): void          // RGBA8 sRGB; alpha = wetness (drives gloss)
  observedDensity(i: number): number
  stats(): SilverStats                                        // meanD, dmax, borderD (outer 4%), coverage, evenness, fixedFraction, wetMean, …
  toBytes(): Uint8Array; static fromBytes(b: Uint8Array): SilverSheet
}
export class CyanoSheet {
  constructor(w: number, h: number, opts?: { simScale?: 1 | 0.5 })
  coat(amount: number | ArrayLike<number>, opts?: CoatOpts): void       // per-pixel coats carry brush streaks
  dry(dt: number, airflow?: number, rh?: number): void
  expose(light: Bands, seconds: number, opts?: { mask?: ArrayLike<number> | null }): void
  process(bath: CyanoBath, dt: number, opts?: { contact?: ArrayLike<number> | null }): { yellowOut: number }   // yellowOut feeds the wash tray's dye plume
  render(out: Uint8ClampedArray, illum?: RGB): void
  stats(): { sensitizer: number; blue: number; bronze: number; oxidised: number; tannate: number }
  toBytes(): Uint8Array; static fromBytes(b: Uint8Array): CyanoSheet
}

// --- Additions ---
export function mixSensitizer(mlA: number, mlB: number): { ratio: number; ratioAB: number; speed: number; dmax: number; beakerHex: string }   // darkroom §5.8 beaker rules
export function peroxideBath(local: number): CyanoBath           // water blended toward peroxide by a local concentration 0..1 (from the tray scalar field)

// Film and paper primitives for the camera games (Lens Bench §5.10 and Sunny 16 §5.10–5.12 compose these with their own constants)
export interface NegCurve { gamma: number; dMin: number; dMax: number; x0: number }      // x = log10(H / H_mid)
export function logisticDensity(x: number, c: NegCurve): number                         // dMin + ΔD / (1 + exp(−4γ(x − x0)/ΔD))
export function x0ForMidGrey(gamma: number, dMin: number, dMax: number, aboveBase?: number /*0.65*/): number
export function devRateTemp(tempC: number, base?: number /*1.1*/): number               // base^(T − 20)
export function devAmount(minutes: number, tempC: number, agitation01: number): number  // minutes · rate(T) · (0.85 + 0.15a)
export function selwynSigma(G: number, dAboveBase: number, pixelPitchUm: number, mul?: number): number
export function grainField(w: number, h: number, seed: number, o?: { clumpPx?: number /*1*/; octaves?: 1 | 2 }): Float32Array   // zero-mean, unit-variance clumped value noise
export function bromideDrag(D: Float32Array, w: number, h: number, o: { strength: number; lengthPx: number; threshold: number; axis: 'x' | 'y' }): void   // in place
export function halation(H: Float32Array, w: number, h: number, channels: 1 | 3 | 4, o: { threshold: number; sigmaPx: number; gain: number; tint?: RGB }): void
export interface PaperCurve { gamma: number; dMin: number; dMax: number; xMid: number }
export function paperDensity(xp: number, p: PaperCurve): number                         // logistic paper curve
export function gradedPaperCurve(grade: 0 | 1 | 2 | 3 | 4 | 5, preset: 'studio' | 'latent'): PaperCurve   // sunny16 §5.12 and latent §5.6 tables
export function densityLUT(baseRGB: RGB, dMin: number, dMax: number, steps?: number /*1024*/): Uint8Array   // D → sRGB8 RGB, for fast rendering

// --- Test ---
export interface Check { group: string; name: string; value: string; expect: string; pass: boolean }
export function selftest(): Check[]          // the spike's checks + the unit-free behavioural targets of darkroom.md §5.11
export function bench(): Record<string, number>   // ms timings at 256×320
```
Performance (desktop Chrome, 256×320): `SilverSheet.process` ≤ 2.5 ms per call while developing, `expose` ≤ 2 ms, `render` ≤ 4 ms (use LUTs; no per-pixel `pow`/`exp` where a table works), `CyanoSheet.process` ≤ 2 ms. The spike measures about 7 ms per step and 70 ms per render, so **optimizing is part of this task**: skip untouched pixels, cache `recompute()`, offer `simScale: 0.5`, tight typed loops. Determinism: identical inputs give bit-identical fields.

Acceptance (`/src/shared/photochem/dev/`): a wedge print developing under a scripted rock, a cyanotype from coat to peroxide, a film negative and its print; `__game.selftest()` all pass; `__game.bench()` meets the timings above.

### 4.6 `@shared/fluid` (owner: shared-fluid-dither)

Pure TypeScript shallow-water tray liquid, ported from `spikes/fluid-tray/core` (`ShallowWater`, `TrayRig` and `FluidTray` stay exported under those names), with a **new facade** that Darkroom, Plates and Latent code against:

```ts
export interface TrayFluidOptions {
  nx: number; ny: number; dx: number         // cells and cell size (m); interior = nx·dx × ny·dx
  depth: number                              // rest depth (m)
  lip: number                                // rim height above the floor (m); liquid above it spills
  damping?: number                           // linear damping 1/s (ring-down); default 0.8
  advect?: boolean                           // nonlinear momentum advection; default true on high tier, false on low
  substepDt?: number                         // default 1/240 s
  maxSubsteps?: number                       // per step() call; default 8 (an overrun slows the sim, never spirals)
  floor?: ((x: number, y: number) => number) | null   // extra floor height (m), e.g. a 2 mm glass plate
}
export interface FluidStepReport { spill: number /* m³ */; wallImpact: number /* Σ ρ h u_n² dx, J proxy */; kinetic: number /* J */; substeps: number; slaps: { x: number; y: number; e: number }[] }
export interface FluidSnapshot { v: 1; nx: number; ny: number; h: Float32Array; ux: Float32Array; uy: Float32Array; tilt: [number, number] }
// Tray-local frame: origin at the tray centre, +x right, +y toward the viewer, metres.
export class TrayFluid {
  readonly nx: number; readonly ny: number; readonly dx: number; readonly width: number; readonly height: number
  readonly h: Float32Array                   // depth per cell, index j*nx + i
  readonly ux: Float32Array; readonly uy: Float32Array    // cell-centred velocity (m/s)
  sleeping: boolean
  constructor(o: TrayFluidOptions)
  setTilt(tanX: number, tanY: number): void   // +tanX lowers the +x side (liquid runs to +x)
  setAccel(ax: number, ay: number): void      // tray lateral acceleration (m/s²) → fictitious head term (waves, jolts)
  setFloor(fn: ((x: number, y: number) => number) | null): void
  step(dt: number): FluidStepReport           // frame dt; fixed internal substeps
  impulse(x: number, y: number, radius: number, dh: number): void   // volume-conserving Gaussian bump (dunk, drip)
  poke(x: number, y: number, strength: number): void                // volume-conserving ring ripple (tap the liquid)
  addVolume(x: number, y: number, radius: number, m3: number): void // pours
  takeVolume(x: number, y: number, m3: number): number
  depthAt(x: number, y: number): number                             // bilinear
  velocityAt(x: number, y: number, out: { x: number; y: number }): { x: number; y: number }
  speedAt(x: number, y: number): number
  surfaceAt(x: number, y: number): number                           // free surface (h + bed), for rendering
  volume(): number; kinetic(): number; refill(depth?: number): void; wake(): void
  snapshot(): FluidSnapshot; restore(s: FluidSnapshot): void
}
export interface TrayBodyOptions { k?: number /*140*/; c?: number /*9*/; kt?: number /*220*/; ct?: number /*18*/; maxTiltRad?: number /*10°*/; maxOffset?: number /*0.02 m*/ }
export class TrayBody {                       // darkroom.md §5.3
  tiltX: number; tiltY: number; offX: number; offY: number          // rad, m
  constructor(o?: TrayBodyOptions)
  hold(tiltX: number, tiltY: number, offX?: number, offY?: number): void
  release(): void
  autoRock(on: boolean, o?: { ampX?: number /*6°*/; ampY?: number /*2.5°*/; fx?: number /*0.48 Hz*/; fy?: number /*0.64 Hz*/; phase?: number }): void
  step(dt: number): { ax: number; ay: number; landed: number /* impact speed on the first return through rest, else 0 */ }
}
export class ScalarField {                    // dye, peroxide, tea, bromide; same grid as the fluid
  readonly data: Float32Array
  constructor(f: TrayFluid)
  add(x: number, y: number, r: number, amount: number): void
  step(dt: number, diffusion: number /* m²/s */, decay: number /* 1/s */): void   // semi-Lagrangian advection by the fluid, one Jacobi diffusion step, decay
  sample(x: number, y: number): number
}
export function sloshFrequency(lengthM: number, depthM: number, mode?: number): number   // mode·√(g h)/(2L)
export function wallSlapToGain(e: number): number                                        // perceptual 0..1, for audio
```
Game presets live in each game's code: Darkroom 48×36 cells, dx 7.5 mm, h₀ 12 mm, lip 45 mm, damping 0.8; Plates 60×48, dx 5 mm, h₀ 8 mm, lip 25 mm, plus its 2 mm plate floor; Latent 32×24, dx 10 mm, h₀ 12 mm, lip 30 mm.

Performance: 48×36 with 4 substeps ≤ 0.6 ms desktop, ≤ 1.5 ms phone; a sleeping tray costs almost nothing. Acceptance (`/src/shared/fluid/dev/`): a tray rocked by `TrayBody.autoRock` with the wave visualized; `selftest()`: volume conserved to 1e-6 (relative) over 60 s without spill; fundamental slosh period within 10% of `sloshFrequency`; a tilt beyond `atan(2h₀/L)` uncovers the high end (the crescent); a 0.5 Hz rock at resonance spills; snapshot/restore is bit-exact.

### 4.7 `@shared/dither` (owner: shared-fluid-dither)

Ported from `spikes/dither-1bit/core`. **The barrel `@shared/dither` is three-free** (CPU helpers, palettes, matrices, GLSL strings); three code lives at **`@shared/dither/three`** (file `src/shared/dither/three.ts`).
```ts
// @shared/dither (pure)
export type PatternName = 'bayer' | 'bluenoise' | 'cluster' | 'bayer-ign'
export function bayerMatrix(n?: 2 | 4 | 8 | 16): Float32Array            // values in [0,1)
export function bayer8(x: number, y: number): number                     // [0,1)
export function ign(x: number, y: number): number                        // interleaved gradient noise, [0,1)
export function generateBlueNoise(o?: { size?: 64 | 128; seed?: number; sigma?: number /*1.5*/ }): Float32Array   // void-and-cluster; cached per (size, seed); ≤ 40 ms at 128
export function getThresholdMap(pattern: PatternName, size?: number, seed?: number, persist?: boolean): Uint8Array   // 'bayer-ign' = 0.5·bayer8 + 0.5·IGN (latent §7.1)
export interface Palette { ink: string; light: string }
export const PALETTES: {                                                 // spike set + plates §7.1 + latent §7.1
  bone; albumen; ruby; canary; glass; nocturne; ambrotype; prussian; lamp; amber; safelight; mono;
  latentTerminal; latentLightTable; latentSafelight; latentWhite; latentLine; latentClipping
}
export type PaletteName = keyof typeof PALETTES
export function resolvePalette(p: PaletteName | Palette): Palette
export function hexToRgb(hex: string): [number, number, number]         // sRGB 0..1, no linearisation
export const LUMA: { rec709: readonly [number, number, number]; plate: readonly [number, number, number]; ortho: readonly [number, number, number] }
export function ditherImage(lum: Float32Array | Uint8ClampedArray, w: number, h: number, o: { palette: PaletteName | Palette; pattern?: PatternName; seed?: number; cell?: number; out?: ImageData }): ImageData   // CPU 1-bit for 2D canvases (thumbnails, share cards, fallbacks, hub previews)
export const DITHER_GLSL: string            // bayer8(), ign(), thresholdLookup(sampler2D, vec2, float size), palette helpers
// @shared/dither/three
export class OneBitPass { /* spike API unchanged: constructor(renderer, OneBitOptions); render(scene, camera, target?); setDitherMode; setPattern; setPalette(p, frames?); setPixelScale; setOutline; setTone; setWorld; setDitherAnchor; setScreenOffset; syncSize; readBits; dispose; readonly aspect */ }
export function thresholdTexture(pattern: PatternName, size?: number, seed?: number): THREE.DataTexture   // R8, nearest, repeat
export function applySurfaceDither(material: THREE.Material, o: SurfaceDitherOptions): SurfaceDitherHandle
export class DevelopingPrintMaterial extends THREE.MeshLambertMaterial { /* spike */ }
export class AnchorTracker { /* spike */ }
```
Acceptance (`/src/shared/dither/dev/`): the spike's cabin scene through `OneBitPass` in `bone`, `ruby` and `latentTerminal` with outlines; a palette sweep over 0.8 s; a CPU `ditherImage` of a gradient. `selftest()`: blue noise is a permutation (every rank 0..size²−1 appears once); the Bayer matrix is rank-complete; a readback passes the two-colour check (only ink and light values).

### 4.8 `@shared/optics` (owner: lensbench-glass)

Pure TypeScript exact lens optics. **API: lensbench.md §11.2, the blocks "`src/shared/optics/types.ts`" and "`src/shared/optics/index.ts` (signatures)", verbatim**, with `PresetId = 'pinhole' | 'meniscus' | 'achromat' | 'portrait' | 'triplet' | 'telephoto' | 'retrofocus' | 'doubleGauss'`, plus `imaging.ts` and `library.ts` written out here:
```ts
export function focusDistanceM(eflMm: number, extMm: number): number            // f(f+ext)/ext / 1000; ext 0 → Infinity
export function extForDistance(eflMm: number, sM: number): number               // f²/(s − f), mm
export function magnification(eflMm: number, extMm: number): number             // ext / f
export function workingN(N: number, m: number, pupilMag?: number /*1*/): number // N(1 + m/p)
export function cocMm(p: LensProfile, extMm: number, sM: number, fieldR01: number, ch: Ch): number   // signed, lensbench §5.5
export function cocPx(cocMmValue: number, formatWmm: number, imageWpx: number): number
export function acceptableCocMm(format: { w: number; h: number }): number      // diagonal / 1500
export function hyperfocalM(eflMm: number, N: number, c0Mm: number): number
export function airyMm(Nw: number, lambdaMm?: number /*0.00055*/): number       // 2.44 λ Nw
export function fovDeg(formatSideMm: number, eflMm: number, extMm: number): number
export function filmIlluminanceLux(L: number, Nw: number, tau: number, cos4: number, vignette: number): number   // (π/4) τ L cos⁴ V / Nw²
export function pinholeOptimum(eflMm: number, rule: 'rayleigh' | 'airy', lambdaMm?: number): { dMm: number; N: number }   // 1.9√(λf) (Lens Bench) or √(2.44λf) (Sunny 16)
export function pinholeBlurMm(dMm: number, eflMm: number, rule: 'rayleigh' | 'airy', lambdaMm?: number): number
// library.ts: saved designs, shared with Sunny 16's "Q.'s drawer"
export interface SavedLens { name: string; design: LensDesign; patent?: string; savedAt: number }
export function listSavedLenses(): SavedLens[]               // reads ar:lensbench:lenses (§3.8)
export function saveLens(l: Omit<SavedLens, 'savedAt'>): void
export function selftest(): { name: string; pass: boolean; got: unknown; want: unknown }[]   // lensbench §12 WP-A checks + 200 random designs (no NaN, no throw)
```
Every function returns finite numbers, or `valid: false` with `issues`. Performance: fast profile ≤ 0.5 ms, full ≤ 5 ms desktop.

### 4.9 `@shared/sun` (owner: lensbench-glass)

Pure TypeScript sun, sky and exposure maths for Sunny 16 (its §5.2 model), Lens Bench (its §5.6 model) and Darkroom's window (SHOULD).
```ts
export interface SunPos { elevDeg: number; azDeg: number /* 0 = north, clockwise */; dir: [number, number, number] /* unit vector toward the sun; world +x east, +y up, +z north */ }
export function solarDeclinationDeg(dayOfYear: number): number                          // 23.44° · sin(360/365 · (284 + n))
export function sunPosition(dayOfYear: number, latDeg: number, clockHours: number, o?: { clockOffsetH?: number /* clock = solar + offset; Sunny 16 uses 1 */ }): SunPos
export function moonPosition(sun: SunPos): SunPos                                       // Sunny 16 rule: −sun rotated 15° toward the zenith
export function airMass(elevDeg: number): number                                        // Kasten–Young
export interface Daylight { sunLux: number; skyLux: number; moonLux: number; horizLux: number; kelvin: number; sunRGB: [number, number, number] }
export function daylightStudio(sun: SunPos, moon?: SunPos): Daylight                     // sunny16 §5.2 formulas
export function lensbenchSun(hours: number): SunPos & { normalLux: number; skyHorizonKcd: number; skyZenithKcd: number; sunRGB: [number, number, number]; horizonRGB: [number, number, number] }   // lensbench §5.6 (street runs east–west)
export function kelvinToRgb(K: number): [number, number, number]                        // linear, max channel 1
export function ev100FromLuminance(L: number): number                                   // log2(L·100/12.5)
export function luminanceFromEv100(ev: number): number
export function exposureEv(N: number, t: number): number                                // log2(N²/t)
export function exposureMatches(N: number, t: number, iso: number, ev100: number, tolStops?: number): boolean
export function sunnySixteen(iso: number): { N: 16; t: number }
export function selftest(): { name: string; pass: boolean; got: number; want: string }[]   // Sunny 16 calib: noon elevation 57.4° ± 0.3 (day 241, 41.5° N, clock 13:00), sunrise ≈ 06:24, EV100 grey card in full sun 15.4 ± 0.4
```

### 4.10 `@shared/photo` (owner: shared-photo)

The physically motivated photo renderer for Lens Bench and Sunny 16: three.js, ported from `spikes/photo-render/core`. Everything a photograph shows comes from rendering the real scene across the real shutter interval through a real pupil. **Public API = the spike's `core/index.ts` exports with the same names and signatures** (`CameraSpec` and its parts, `FORMATS`, `defaultSpec`, `resolveSpec`, `computeOptics`, `blurCircleMm`, `luminanceToEV100`, `ev100ToLuminance`, `hPerUnit`, `xPerNit`, `reciprocityFactor`, `meteredShutter`, `METER_K`, `EXPOSURE_Q`, `formatShutter`, `formatFNumber`, `formatDistance`, sampling helpers, `planShutter`, the film/LUT develop helpers, `MotionRecorder`, `PhotoRenderer`, `latentStats`, and the types `PhotoScene`, `SubFrameInfo`, `CameraPose`, `CaptureOptions`, `CaptureProgress`, `CaptureResult`, `CaptureMeta`, `LatentStats`, `PhotoCaps`). To avoid clashing with the games' own `CameraSpec` types, the spike's `CameraSpec` is also exported as **`PhotoSpec`**, and game code uses `PhotoSpec`. **Additions:**

```ts
// CaptureOptions additions
interface CaptureOptions {
  radianceScale?: number                       // cd/m² per rendered unit: 1 (scene in nits) or 1000 (kcd/m², Lens Bench and Sunny 16)
  tilt?: { deg: number }                       // front-standard tilt about camera x (Scheimpflug) via the rank-1 projection of sunny16 §5.9; 0 = ordinary DOF
  shutterProfile?: ShutterProfile              // custom timing (gravity drop, roller blind, lens-cap ramps); overrides spec.shutterType timing
  spectral?: [[number, number, number], [number, number, number], [number, number, number]]   // rendered RGB → film channels (ortho, pan, colour crosstalk); default identity for colour film, pan weights for mono
  layers?: number                              // camera layer mask for capture (default: layer 0 only; Sunny 16 keeps its own tripod on layer 2)
  emitters?: (time: number, out: PhotoEmitter[]) => number   // optional analytic point sources drawn as energy-conserving pupil-shaped sprites (Lens Bench hero bokeh)
}
export interface ShutterProfile { span: number /* s, first opening to last closing */; open(u: number, v: number, tRel: number, dt: number): number /* fraction of [tRel, tRel+dt] for which print pixel (u, v ∈ [0,1], upright) is open */ }
export interface PhotoEmitter { x: number; y: number; z: number; rgb: [number, number, number] /* luminous intensity in scene units; × radianceScale = cd */ }

// Incremental exposure: Sunny 16's live path (Bulb, lens cap, anything over 1/8 s) and any per-frame accumulation
export interface Exposure {
  addSample(o: { time: number; tRel: number; pose?: CameraPose; weightS?: number /* seconds this sample stands for */ }): void   // renders one sub-frame now (the next pupil point)
  readonly samples: number; readonly exposedSeconds: number
  drawGhost(target?: THREE.WebGLRenderTarget | null, viewport?: { x: number; y: number; width: number; height: number }, opacity?: number): void   // finder ghost of the accumulation so far
  finish(o?: { readback?: boolean }): Promise<CaptureResult>
  abort(): void
}
// PhotoRenderer additions:
//   begin(scene: PhotoScene | THREE.Scene, spec: DeepPartial<PhotoSpec> | PhotoSpec, o: Omit<CaptureOptions, 'samples' | 'order'> & { expectedSamples?: number }): Exposure
//   readonly caps: PhotoCaps

// Latent encodings (store an undeveloped frame compactly)
export function encodeLog2(latentX: Float32Array /* RGBA, top row first, X units */, w: number, h: number, o: { channels: 1 | 3; minStops: number; maxStops: number; refX?: number /* X at 0 stops, default 1 */; spectral?: number[][] }): Uint8Array
export function decodeLog2(bytes: Uint8Array, w: number, h: number, o: { channels: 1 | 3; minStops: number; maxStops: number; refX?: number }): Float32Array   // X per channel
export function bytesToPNG(bytes: Uint8Array, w: number, h: number, channels: 1 | 3): Promise<Blob>
export function pngToBytes(blob: Blob, channels: 1 | 3): Promise<{ bytes: Uint8Array; w: number; h: number }>

// Live finder preview: one render + a depth-based CoC gather + tonemap, plus a centre-weighted meter
export class FinderPreview {
  constructor(renderer: THREE.WebGLRenderer, o: { longEdge: number; taps: number /* 8–16 */; maxCocPx: number })
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, spec: PhotoSpec, o?: { exposureEV100?: number; flipX?: boolean; flipY?: boolean; brightness?: number; target?: THREE.WebGLRenderTarget | null; viewport?: { x: number; y: number; width: number; height: number }; radianceScale?: number; layers?: number }): void
  meterEV100(): number                       // async readback every 250 ms; returns the latest value
  dispose(): void
}

// Bridge from @shared/optics (type-only import)
export function photoSpecFromProfile(p: LensProfile, base?: DeepPartial<PhotoSpec>): DeepPartial<PhotoSpec>   // EFL, N, pupil mask → aperture mask, distortion k1/k2, lateral and longitudinal CA, field curvature (Petzval), swirl → astigmatism, vignetting and cat's eye, glow from SA blur, ghosts and glare
```
Performance (capture): desktop 1024–1600 px long side, K ≤ 48 sub-frames, ≤ 2 s; phone 768–1024 px, K ≤ 16, ≤ 4 s; test tier 384–512 px, K = 4, ≤ 15 s under SwiftShader. Time-sliced (≤ 8–10 ms GPU per frame) unless the caller asks for a blocking capture. Float fallbacks: RGBA16F accumulation, ping-pong without float blending, and an RGBA8 single-sample path with one `console.warn`.

Acceptance (`/src/shared/photo/dev/`, a port of the spike demo yard): captures of a particle fountain at 1/1000 s (frozen) and 1/2 s (silk); string-light bokeh through a heart-shaped aperture mask; a 12 ms focal-plane shutter on a spinning windmill (bent blades); a tilted plane at `tilt: { deg: 5 }` sharp from near to far; an incremental `begin()` exposure of 30 `addSample` calls matching `capture()` with the same samples within 2% mean. `selftest()` includes the spike's tests and determinism (same seed → identical latent hash).

### 4.11 `@shared/surface` (owner: shared-surface)

Macro surfaces as pure functions of real millimetres, baked on the CPU in a worker. This is Texturedle's heart, and it also feeds Sunny 16 (the rusty mailbox texture) and Lens Bench (the shop letterbox, SHOULD). **API: texturedle.md §11.2 block "`src/shared/surface/types.ts` (A)" verbatim**, with the §6.1 recipe grammar and the files of §11.1 (`index.ts types.ts noise.ts fields.ts colour.ts glyphs.ts baker.ts bake.worker.ts bake-client.ts contact.ts runtime.ts thumbnail.ts recipes/**`). `noise.ts` re-exports `@shared/core` noise and adds only what the recipes need. **Additions** for props in other games:
```ts
export interface SurfaceMaps { sizeMm: number; res: number; albedo: Uint8Array /* RGBA8 sRGB */; normal: Uint8Array /* RGBA8 tangent space, OpenGL convention */; orm: Uint8Array /* R AO, G roughness, B metalness, A 255 */; height: Float32Array /* mm */ }
export function bakeMaps(recipeId: string, o: { sizeMm: number; res: number; seed?: number; ratio?: number }): Promise<SurfaceMaps>   // in the worker; for 3D props
export function listRecipes(): { id: string; no: number; name: string; pool: boolean }[]
```
Recipes 001–010 plus `poster-peeling-paint` are MUST; 011–036 are SHOULD. Performance: the mailbox at 1024² ≤ 1.5 s desktop in the worker, 512² ≤ 1.0 s phone. Acceptance (`/src/shared/surface/dev/`, a library contact sheet): `thumbnail('rusty-mailbox', 256)` reads as green chalky paint with rust blisters and orange streaks running right; every MUST recipe thumbnails without NaN; contact fields and the snag map are sane; `carryFrom` keeps a scrubbed patch visible from 5:1 to 4:1; bake timings are logged.

---

## 5. Games: ownership, contracts, app factories and overrides

### 5.0 The pattern every game follows
- **Contract file** (§2.3): written verbatim from the GDD by the game's *spine* task within 15 minutes.
- **App factory with injected dependencies.** The spine task owns the game loop / state machine as a factory that takes every other package's factory as a parameter. Its harness page (`dev/<task>.html`) calls it with fakes; the integration task's `main.ts` calls it with the real ones. So `main.ts` stays a short wiring file and integration is about plumbing and fixing seams.
- **Integration** (wave 3) owns `games/<slug>/index.html`, `main.ts`, `test/**` (smoke step files) and `glue/**` (adapters that reconcile interface mismatches without editing other tasks' files).
- **Sounds:** `games/<slug>/sounds.ts` belongs to `shared-audio` (not texturedle). The game's audio *wiring* (which event plays which id) belongs to the task named below.
- **Handoff notes:** every task also owns `docs/build/<task-id>.md`.
- **Harness pages:** every build task owns `games/<slug>/dev/<task-suffix>.html` and `games/<slug>/dev/<task-suffix>*.ts` (plus `*.steps.json`).

### 5.1 Texturedle (`texturedle`, frame ▸01)
| Task | Owns |
|---|---|
| shared-surface | `src/shared/surface/**` |
| texturedle-sim | `games/texturedle/sim/**`, `games/texturedle/audio/**`, `dev/sim.*` |
| texturedle-render | `games/texturedle/render/**`, `dev/render.*` |
| texturedle-game (spine) | `games/texturedle/contracts.ts`, `style.css`, `game/**`, `ui/**`, `input/**`, `debug/**`, `dev/game.*` |
| texturedle-integrate | `index.html`, `main.ts`, `test/**`, `glue/**` |

- **Contracts:** `games/texturedle/contracts.ts` = texturedle.md §11.2 block "`games/texturedle/contracts.ts` (I0)" verbatim, importing its surface types from `@shared/surface`. `src/shared/surface/types.ts` = the §11.2 surface block (owner shared-surface).
- **App factory** (`game/app.ts`, texturedle-game): `startTexturedle(deps: { stage: HTMLElement; shell: Shell; createBench: typeof createBench; createRenderer: typeof createRenderer; createAudio: typeof createAudio }): Promise<void>`. It runs the §11.3 main loop, owns the state machine, UI and `window.__game` (§13.1, via `debug/test-api.ts` and `installGameApi`). The surface functions are imported directly from `@shared/surface`.
- **Factories:** `createBench(seed)` in `sim/bench.ts`; `createAudio()` in `audio/engine.ts`; `createRenderer(canvas, opts)` in `render/renderer.ts` (signatures from contracts).
- **Overrides:** noise → `@shared/core`; save → `local('texturedle')` key `save` (§3.8); audio connects to `getAudio().master` (§3.9); shell from `@shared/ui` (the GDD's `ui/shims.ts` is allowed only in harnesses); share via `shareOrDownload`; quality via `detectTier` mapped to high/low. Spikes: `cloth-marble` (bake, marble, cloth, tilt, world, render, audio) and `materials` (catalog + guess matching → Atlas and guess code; GLSL recipes as look reference).

### 5.2 Darkroom (`darkroom`, frame ▸02, scheme dark)
| Task | Owns |
|---|---|
| darkroom-spine | `types.ts`, `events.ts`, `layout.ts`, `game.ts`, `input/**`, `ui/**`, `audio/**`, `save/**`, `debug.ts`, `dev/spine.*` |
| darkroom-view | `render/**`, `content/**`, `dev/view.*` |
| darkroom-sim (wave 2) | `constants.ts`, `sim/**`, `dev/sim.*` |
| darkroom-integrate | `index.html`, `main.ts`, `test/**`, `glue/**` |
| shared-audio | `sounds.ts` |

- **Contracts** (darkroom-spine, first 15 min): `types.ts` = darkroom.md §11.3 verbatim, except that `Paper.silver` / `Paper.cyano` are typed as `SilverSheet` / `CyanoSheet` from `@shared/photochem` (the GDD's `SilverFields`/`CyanoFields` are replaced); `events.ts` = §11.4; `layout.ts` = the §5.1 station table, clothesline and camera presets as typed constants (split out of the GDD's `constants.ts` so the view can start before the sim).
- **App factory** (`game.ts`, darkroom-spine): `startDarkroom(deps: { stage: HTMLElement; shell: Shell; createWorld: (seed: number, content: DarkroomContent) => World; createView: (canvas: HTMLCanvasElement, world: WorldRead, o: { tier: Tier; mode: 'webgl2' | 'canvas2d' }) => View; content: DarkroomContent }): Promise<void>`, where `DarkroomContent` (declared in `types.ts`) = `{ getNegative(id: string): Negative; listNegatives(): Negative[]; prep: PrepPipeline; props: PropMask[] }`, implemented in `content/index.ts` by darkroom-view.
- **Overrides:** darkroom.md §11.2 shared signatures (`TrayFluid`, `silverStep`, `cyanoStep`, …) are **replaced** by `@shared/fluid` and `@shared/photochem` (§4.5–4.6). Light and exposure use photochem's physical units (`LIGHTS`, `lightBands`, `actinic`, lux·s); the §5.5 EU table is guidance for relative strengths, and the **§5.11 targets remain binding** as darkroom-sim's `selftest()` (with the game's time-compression constants in `constants.ts`). IndexedDB via `idb('darkroom')` and `createSlots` (§3.8). `scripts/darkroom-smoke.mjs` becomes `games/darkroom/test/smoke.steps.json` run with `scripts/shoot.mjs`. Spikes: `fluid-tray`, `photochem` (behaviour), `audio` (darkroom sounds).

### 5.3 Plates: Ruby Sector (`plates`, frame ▸03, scheme dark)
| Task | Owns |
|---|---|
| plates-room-bench (spine) | `contracts.ts`, `tuning.ts`, `app.ts`, `style.css`, `stubs.ts`, `render/**` (incl. `plateGLSL.ts`, `postfx.ts`, `palette.ts`, `room.ts`, `lamp.ts`, `camera.ts`), `world/**`, `input/**`, `audio/**`, `save/**`, `ui/hud.ts`, `ui/dryingLine.ts`, `ui/title.ts`, `ui/settings.ts`, `ui/fallback.ts`, `bench/**`, `dev/room.*` |
| plates-content | `content/**` (incl. `content/tuning.ts`, `content/gallery.ts`), `dev/content.*` |
| plates-inspect | `inspect/**` (incl. `inspect/tuning.ts`), `story/**`, `ui/book.ts`, `ui/book.css`, `ui/documents.ts`, `ui/ending.ts`, `ui/epilogue.ts`, `ui/share.ts`, `dev/inspect.*` |
| plates-integrate | `index.html`, `main.ts`, `test/**` (incl. `test/api.ts`), `glue/**` |
| shared-audio | `sounds.ts` |

- **Contracts** (plates-room-bench, first 15 min): `contracts.ts` = plates.md §11.3 verbatim; `render/plateGLSL.ts` = §11.4 verbatim; `tuning.ts` = `export const T1 = {}, T2 = {}`. Content and inspect keep their tunables in their own `content/tuning.ts` and `inspect/tuning.ts`.
- **App factory** (`app.ts`): `createApp(deps: { stage: HTMLElement; shell: Shell; createWetBench: (ctx: Ctx, anchors: BenchAnchors) => WetBench; createPlateLibrary: () => PlateLibrary; createLightTable: (ctx: Ctx, bench: WetBench) => LightTable; createReturnBook: (ctx: Ctx, bench: WetBench, table: LightTable, root: HTMLElement) => ReturnBook }): Promise<PlatesApp>` with `PlatesApp` exposing everything `test/api.ts` needs (§13.2). `stubs.ts` provides the fallbacks of §12 WP1.
- **Overrides:** `render/dither.ts` → `@shared/dither` (`generateBlueNoise(128)` gives `Ctx.noise`; `OneBitPass` or `DITHER_GLSL` for the room post); `bench/fluid.ts` → `@shared/fluid` `TrayFluid` (plates preset §4.6; the plate's 2 mm via `setFloor`; R16F depth texture built in `bench/`); `audio/engine.ts` → `@shared/audio` (the plates `audio/` folder is the event→sound wiring); `save/db.ts` → `idb('plates')` and `createSlots('plates', { prefix: 'pin', manual: 6, auto: 3 })` (§3.8; the `ar-plates` database is dropped). `ready()` becomes `whenReady()` (§3.7). `scripts/smoke-plates.mjs` → `games/plates/test/smoke.steps.json`. **Registry title: Ruby Sector** (Appendix A). Spikes: `dither-1bit` (the 1-bit look), `fluid-tray`, `audio` (sea sounds).

### 5.4 Latent Image (`latent`, frame ▸04, scheme dark)
| Task | Owns |
|---|---|
| latent-shell (spine) | `style.css`, `core/types.ts`, `core/bus.ts`, `core/state.ts`, `core/save.ts`, `core/input.ts`, `core/widgets.ts`, `core/clock.ts`, `core/rng.ts`, `core/app.ts`, any other new `core/*` file, `render/**`, `audio/**`, `search/**`, `data/docs.ts`, `data/text.ts`, `data/facts.ts`, `stations/terminal.ts`, `stations/phone.ts`, `stations/ending.ts`, `dev/shell.*` |
| latent-frames | `frames/**`, `data/rolls.ts`, `dev/frames.*` |
| latent-lab | `film/**`, `print/**`, `stations/lightTable.ts`, `stations/filmShelf.ts`, `stations/darkroom.ts`, `stations/line.ts`, `stations/chain.ts`, `dev/lab.*` |
| latent-integrate | `index.html`, `main.ts`, `debug/**` (`testApi.ts`), `test/**`, `glue/**` |
| shared-audio | `sounds.ts` |

- **Contracts** (latent-shell, first 15 min): `core/types.ts` = latent.md §11.3 verbatim, `core/bus.ts`, and an early `render/fonts.ts` (`strokeFont`, `blockFont` working by minute 40, so latent-frames can letter signs and slates).
- **App factory** (`core/app.ts`): `createApp(deps: { stage: HTMLElement; shell: Shell; frameStore: FrameStore; createNegative: typeof createNegative; developRoll: typeof developRoll; simulatePrint: typeof simulatePrint; evaluateLegibility: typeof evaluateLegibility; stations: { terminal: StationFactory; lighttable: StationFactory; darkroom: StationFactory; line: StationFactory } }): Promise<LatentApp>`, where `StationFactory = (ctx: StationCtx) => Station` (declared in `core/types.ts` as an additive extension; `StationCtx` carries renderer, bus, state, widgets, audio wiring).
- **Overrides:** `render/dither.ts` uses `@shared/dither` (`getThresholdMap('bayer-ign')` or `OneBitPass` with `pattern: 'bayer-ign'` and integer `pixelScale` = the cell size; latent palettes in `PALETTES`); `print/fluid.ts` → `@shared/fluid` (latent preset); `core/rng.ts` re-exports `@shared/core`; saves via `local('latent')` keys `slot0`–`slot3` and `idb('latent')` key `print:<id>` (§3.8); `ready: Promise` becomes `ready: boolean` + `whenReady()`. Spikes: `dither-1bit`, `fluid-tray`, `audio` (police/terminal sounds). The latent GDD's three-agent fallback is used: film files and the light table join the print work in `latent-lab`.

### 5.5 Lens Bench (`lensbench`, frame ▸05)
| Task | Owns |
|---|---|
| lensbench-glass | `src/shared/optics/**`, `src/shared/sun/**`, `games/lensbench/bench/**`, `games/lensbench/audio/**`, `dev/bench.*` |
| lensbench-street | `core/types.ts`, `core/gl.ts`, `core/quality.ts`, `core/rng.ts`, `core/clock.ts`, `street/**`, `dev/street.*` |
| lensbench-shop (wave 2, spine) | `lensbench.css`, `core/store.ts`, `core/app.ts`, `shop/**`, `ref/**`, `photo/**`, `film/**`, `dev/shop.*` |
| lensbench-integrate | `index.html`, `main.ts`, `test/**`, `glue/**` |
| shared-photo | `src/shared/photo/**` |
| shared-audio | `sounds.ts` |

- **Contracts:** `core/types.ts` = lensbench.md §11.2 block "`games/lensbench/core/types.ts`" verbatim (owner lensbench-street, first 15 min, together with `core/gl.ts` `GLCore`); `src/shared/optics/types.ts` (owner lensbench-glass). The `World`, `Finder`, `PhotoRenderer`, `developFrame`, `sfx` and `store` signatures are the §11.2 ones.
- **App factory** (`core/app.ts`, lensbench-shop): `startLensBench(deps: { stage: HTMLElement; shell: Shell; gl: GLCore; createWorld: typeof createWorld; createBenchScreen: (root: HTMLElement, gl: GLCore) => Screen; createStreetScreen: (root: HTMLElement, gl: GLCore, world: World) => Screen; createPhotoRenderer: typeof createPhotoRenderer }): Promise<void>` with `Screen = { enter(): void; exit(): void; update(dt: number): void; dispose(): void }` (added to `core/types.ts` by lensbench-street).
- **Overrides:** `src/shared/optics` and `src/shared/sun` are built by lensbench-glass (the GDD's WP-A) as shared modules (§4.8–4.9); the **photo pipeline uses `@shared/photo`**: `photo/**` in Lens Bench is the adapter (ShotRecord → `PhotoScene` + `PhotoSpec` via `photoSpecFromProfile` + pose track → `capture`/`emitters`, the deferred render queue, latent encode with `encodeLog2(−10…+10 stops)`, slit replay SHOULD); film development composes `@shared/photochem` primitives with the §5.10 stock table in `film/stocks.ts`. Storage keys per §3.8 (`ar:lensbench:*`, `idb('lensbench')`). Smoke steps live at `games/lensbench/test/smoke.steps.json`. **Registry text updated to the street** (Appendix A). Spikes: `photo-render`, `audio` (camera sounds), `materials` (rust for the letterbox, SHOULD; prefer `@shared/surface` `bakeMaps('rusty-mailbox')`).

### 5.6 Sunny 16 (`studio`, frame ▸06)
| Task | Owns |
|---|---|
| studio-house (spine) | `studio.css`, `core/**` (contracts, engine, engine-stub, boot, physics, input, grab, rooms, store, bus, rng, audio, textures), `house/**`, `hud/**`, `api/**`, `dev/house.*` |
| studio-yard | `yard/**`, `dev/yard.*` |
| studio-darkroom | `darkroom/**`, `dev/darkroom.*` |
| studio-camera (wave 2) | `camera/**`, `dev/camera.*` |
| studio-integrate | `index.html`, `main.ts`, `test/**`, `glue/**` |
| shared-audio | `sounds.ts` |

- **Contracts** (studio-house, first 15 min): `core/contracts.ts` = studio.md §11.3 verbatim, plus `core/bus.ts`, `core/rng.ts` (re-exporting `@shared/core`) and `core/engine-stub.ts` (renderer + scene + orbit camera + fake clocks + no-op store) so every room can run solo in its own harness.
- **App factory** (`core/boot.ts`): `bootStudio(o: { stage: HTMLElement; shell: Shell; rooms: Array<(e: Engine) => RoomModule | Promise<RoomModule>>; parts?: Array<(e: Engine) => void | Promise<void>> }): Promise<Engine>` (loader, `RAPIER.init()`, engine, overview, loop, `__game` assembly via `registerTestApi`). The yard exports `createYard(e: Engine): Promise<YardModule>` (`YardModule extends RoomModule` with `subjects`, `addToScene`, `groundY`, `dot.pathPolyline`); the camera exports `createWorkshop(e, yard)` and `installCamera(e, yard)`; the darkroom exports `createDarkroom(e)`.
- **Overrides:** `src/shared/sun` is owned by lensbench-glass (not studio WP2); studio-yard consumes `@shared/sun` (`sunPosition(241, 41.5, h, { clockOffsetH: 1 })`, `daylightStudio`). The capture pipeline uses **`@shared/photo`**: `capture()` for the fast path, `begin()`/`addSample()` for the live path, `tilt` for front tilt, `shutterProfile` for the gravity drop and focal plane, `spectral` for ortho; `camera/capture.ts` keeps the ShotRecord measures (§5.13). `darkroom/chem-bridge.ts` composes `@shared/photochem` primitives with §5.10–5.12 constants (studio calibration targets stay binding). `camera/optics-bridge.ts` uses `@shared/optics` (Q.'s drawer, SHOULD). The rusty mailbox texture comes from `@shared/surface` `bakeMaps('rusty-mailbox', …)` with the §6.3 canvas recipe as fallback. Storage `idb('studio')` (§3.8). `?solo=<room>` harnesses are `dev/*.html` pages. **Registry title: Sunny 16** (Appendix A). Spikes: `backyard-physics` (Rapier world, grabber, input, yard props, wind, sun, sprinkler), `photo-render`, `audio` (yard and camera sounds).

### 5.7 Where integration finds each factory
| Game | Spine factory | Other factories (file → export) |
|---|---|---|
| texturedle | `game/app.ts` → `startTexturedle` | `sim/bench.ts` → `createBench`; `audio/engine.ts` → `createAudio`; `render/renderer.ts` → `createRenderer`; `@shared/surface` |
| darkroom | `game.ts` → `startDarkroom` | `sim/world.ts` → `createWorld`; `render/view.ts` → `createView`; `content/index.ts` → `content` (DarkroomContent) |
| plates | `app.ts` → `createApp` | `bench/wetBench.ts` → `createWetBench`; `content/library.ts` → `createPlateLibrary`; `inspect/lightTable.ts` → `createLightTable`; `ui/book.ts` → `createReturnBook`; `content/gallery.ts` → `mountGallery` (`?gallery=1`) |
| latent | `core/app.ts` → `createApp` | `frames/frameStore.ts` → `createFrameStore`; `film/index.ts` → `createNegative`, `developRoll`; `print/index.ts` → `simulatePrint`, `evaluateLegibility`; `stations/terminal.ts` → `createTerminalStation`; `stations/lightTable.ts` → `createLightTableStation`; `stations/darkroom.ts` → `createDarkroomStation`; `stations/line.ts` → `createLineStation` |
| lensbench | `core/app.ts` → `startLensBench` | `core/gl.ts` → `createGLCore`; `street/world/world.ts` → `createWorld`; `street/street-screen.ts` → `createStreetScreen`; `bench/bench-screen.ts` → `createBenchScreen`; `photo/photo-renderer.ts` → `createPhotoRenderer` |
| studio | `core/boot.ts` → `bootStudio` | `yard/yard.ts` → `createYard`; `camera/workshop.ts` → `createWorkshop`; `camera/index.ts` → `installCamera`; `darkroom/darkroom.ts` → `createDarkroom` |

Every factory module also exports its harness-free types. Each game registers its sounds by calling `registerSounds()` from `games/<slug>/sounds.ts` (integration does this in `main.ts`, except texturedle).

### 5.8 Hub (`/`)
Owns `index.html`, `404.html`, `src/hub/**`. Follows hub.md M1–M3 (M4 stretch). **Overrides:** with `vite.config.ts` frozen, the frame markup is written **statically into `index.html`** (generated by hand from Appendix A; a dev check `__game.lintRegistry()` compares the DOM with `GAMES` and returns `[]` when consistent). `src/hub/previews/kit.ts` uses `@shared/core` (mulberry32, noise) and `@shared/dither` (`bayer8`, three-free). `scripts/posters.mjs` and `404.html` in the build are orchestrator requests (§9 R2–R3); `?og=` mode is implemented by the hub now. The hub must not import three or rapier (verify in the build output). Keep `src/hub/placeholder.css` until every game page has been replaced (wave 3), then delete it.

---

## 6. Dependency graph

```
                         ┌──────────────── games/* and hub ────────────────┐
@shared/ui ──────────────┤ every page (shell, chrome)                       │
  ├─> @shared/core       │                                                  │
  ├─> @shared/storage ──>│ every game (saves), hub (progress notes)         │
  ├─> @shared/audio      │ every page                                       │
  └─> @shared/games      │ hub, shell                                       │
@shared/photochem ─> core│ darkroom (paper, cyanotype), studio + lensbench (film/paper primitives), latent (optional)
@shared/fluid ────> core │ darkroom, plates, latent
@shared/dither ───> core │ plates, latent, hub previews (pure part only)
@shared/optics ───> core │ lensbench, studio (Q.'s drawer), @shared/photo (types only)
@shared/sun ──────> core │ studio, lensbench, darkroom (window, SHOULD)
@shared/photo ──> three, core, optics(types) │ lensbench, studio
@shared/surface ──> core │ texturedle, studio (mailbox texture), lensbench (letterbox, SHOULD)
                         └──────────────────────────────────────────────────┘
```
No shared module imports a game. No game imports another game. `@shared/ui` imports `@shared/audio` (sound toggle, `uiSound`, `Audio.arm`), so `shared-audio` writes its stub surface in its first 15 minutes.

**Task waves.** Wave 1 starts at once: all shared modules, plus every game task that can do most of its work against stubs and the documented APIs (contracts, content, worlds, UIs). Wave 2 starts when its listed dependencies are finished: tasks whose core work needs a real shared module or a finished sibling (hub; darkroom-sim; lensbench-shop; studio-camera). Wave 3: one integration task per game. Appendix C lists every task.

---

## 7. Performance and mobile policy

### 7.1 Targets
| | Desktop (tier high) | Mid phone (tier low/medium) | Headless test (tier test, SwiftShader) |
|---|---|---|---|
| Frame rate | 60 fps (16.7 ms) | ≥ 30 fps (33 ms), 60 when idle | whatever it gets; tests use `advance()`/`step()` |
| DPR cap | 2 | 1.5 (medium), 1 (low) | 1 |
| Main-thread long tasks after first frame | none > 50 ms, except behind an explicit cover (loader, shutter blackout ≤ 250 ms desktop / 600 ms phone, iris, page transition) | same | n/a |
| First real frame (`markReady`) | ≤ 2.5 s on cable | ≤ 4 s on 4G | ≤ 30 s |
| JS heap | ≤ 250 MB (studio, lensbench), ≤ 150–200 MB others | ≤ 150 MB | — |

Per-game bundle budgets (gzip) from the GDDs: hub ≤ 70 KB JS, ≤ 20 KB CSS, no three; texturedle ≤ 180 KB excluding three; darkroom ≤ 380 KB including three; plates < 350 KB including three; latent ≤ 350 KB; lensbench ≤ 300 KB excluding three; studio ≤ 900 KB including Rapier. Vite splits `three` into a chunk shared by every game page; keep `@shared/photo`, Rapier and big data tables out of pages that don't use them (dynamic `import()` behind the loader where a GDD allows).

### 7.2 Rules
- **Quality tiers:** `detectTier()` at boot; map to the GDD's tiers; `?quality=` overrides. Adapt down with `createPerfMonitor().onDegrade` (p75 > 22 ms for 3 s) in the order the GDD gives; never thrash (cooldown), and never auto-raise mid-session unless the GDD says so.
- **Heavy work** goes into workers (surface bakes, optional chemistry) or `runSliced` chunks (exposure generation, development, captures). Never block input for more than one frame outside a cover.
- **One rAF loop per page**; pause simulation, audio and loops on `visibilitychange` → hidden; autosave on hidden and `pagehide`.
- **GPU hygiene:** reuse render targets; `disposeDeep` on room or screen teardown; at most one live WebGL context per page (the hub uses none; Lens Bench shares one canvas between screens).
- **Memory:** typed arrays for simulation fields; no per-frame allocations in hot loops (preallocate `out` params).
- **Network:** no runtime requests to other origins; everything is code.

### 7.3 Mobile and touch
- `touch-action: none` and `overscroll-behavior: none` on the stage (from `base.css`); Pointer Events only; `createGestures` for tap/drag/hold/pinch/twist.
- Touch targets ≥ 44 CSS px (`--ar-tap`); no hover-only affordances; long-press never opens the context menu on the stage.
- Layout from `100dvh`/`100svh` and `env(safe-area-inset-*)`; follow `visualViewport` while a soft keyboard is open (Texturedle guesses, Latent's terminal).
- Portrait is supported everywhere (the GDDs give portrait layouts); landscape may be recommended, never forced.
- Phones start at tier low or medium; iOS starts at low (texture memory).
- Device motion and orientation are opt-in only, behind a tap that calls `requestPermission()` on iOS.
- The smoke tests assert `document.documentElement.scrollWidth <= innerWidth` on a 390×844 phone viewport.

### 7.4 Accessibility and comfort (binding, art-direction §9)
- Photosensitivity: at most 3 flashes per second; full-screen flashes ≤ 120 ms and ≤ 70% white; saturated red flashes ≤ 25% of the screen; under reduced motion a 200 ms soft brighten (≤ 30%) instead.
- Reduced motion (`prefersReducedMotion()`): tone down camera shake, slosh exaggeration, sway, auto-motion and transitions. Physics may keep running.
- Focus is always visible; every game's DOM controls are keyboard-reachable; sound is never the only carrier of information (captions where GDDs specify).

---

## 8. Testing and screenshots

- **Every page exposes `window.__game`** (§3.7) and calls `markReady()` after its first real frame. Shared-module dev pages expose `selftest()` (and `bench()` where budgets apply).
- **Harness pages first.** Build tasks prove their work on their own `dev/` pages before integration exists. Integration tasks write `games/<slug>/test/smoke.steps.json` (desktop) and `smoke.mobile.steps.json` from the GDD's smoke table, and run:
  `node scripts/shoot.mjs "/games/<slug>/?test=1&reset=1" --steps games/<slug>/test/smoke.steps.json --timeout 240000 --out shots/<slug>/final.png`
- **Determinism checks** use `?test=1&seed=N` plus `advance()`/`step()`; compare hashes or numbers via `eval` steps rather than pixels where possible.
- **Two-colour checks** (Plates, Latent) run in the page: `__game.twoColourCheck()` reads back the canvas and returns the fraction of pixels within ΔE < 6 of the active palette's ink or light colour.
- **Exit criteria for any task:** the shoot run exits 0 (no page errors, no failed requests), `__game.errors()` is empty, the screenshots match the expectations written in the brief, and the task's own files type-check.
- **Review rounds** after wave 3 re-run every smoke file at desktop and mobile, compare against the GDD expectations, and file fixes against owners. Keep shot names stable: `shots/<slug>/<task>-NN-<what>.png`.

---

## 9. Requests to the orchestrator

| # | Request | Why | When |
|---|---|---|---|
| R1 | `npm i @fontsource-variable/fraunces @fontsource-variable/archivo @fontsource-variable/caveat @fontsource/ibm-plex-mono` | art-direction §3 self-hosted fonts; `@shared/ui/fonts.ts` enables its imports once these exist | before or during wave 1 |
| R2 | Add `404.html` to `rollupOptions.input` in `vite.config.ts` | hub.md §2.5 "Frame not found" page (the hub task writes `404.html`) | any time |
| R3 | Add `scripts/posters.mjs` and `"posters": "node scripts/posters.mjs"` per hub.md §11.2, then run it after wave 3 to produce `public/posters/*.jpg`, `public/og/*.jpg`, `public/apple-touch-icon.png` | social cards and `<noscript>` posters | after wave 3 |
| R4 | Optional: a `transformIndexHtml` plugin that fills each page's `<title>`/meta/OG from `src/shared/games.ts`, and the hub's `<!--frames-->` | hub.md §10 "static rendering"; until then pages carry hand-copied text | optional |
| R5 | Set `SITE.repoUrl` in `src/shared/games.ts` once the GitHub repo exists (ask shared-platform or edit in a review round) | hub footer source link | after repo creation |
| R6 | Keep one Vite dev server running at 127.0.0.1:5173 for the whole build | every task shoots against it | all waves |
| R7 | Keep `spikes/` on disk until wave 3 ends; never deploy it | it is the port source | all waves |
| R8 | After review, flip each game's registry `status` to `'ready'` (via shared-platform or a review task) | removes the hub's IN THE TRAY stamp | after review |
| R9 | Optional CI grep: `Math.random` must not appear in `games/*/{sim,bench,world,film,print,camera,yard,content,frames}/**` or `src/shared/{photochem,fluid,surface,optics,photo}/**` | determinism | review rounds |

---

## Appendix A: Registry entries (`src/shared/games.ts`)

`SITE` as hub.md §10 (`repoUrl: ''` until R5). `GAMES` (all `status: 'developing'` at launch of the build):

```ts
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
  { slug: 'plates', frame: 3, title: 'Ruby Sector', noteName: 'Darkroom, 1-bit',
    tagline: 'Twelve undeveloped plates know why.',
    blurb: "A lighthouse showed white where it should have shown red, and three men drowned. Develop a dead photographer's glass plates in a sloshing, one-bit darkroom, look with one eye and then the other, and work out who everyone was and what became of them.",
    description: "A one-bit darkroom mystery: develop a lighthouse photographer's glass plates and work out who everyone was and how each one ended.",
    meta: ['Mystery', '1-bit', 'Deduction'], greaseMark: 'crop', greaseNote: 'count the faces',
    edgeJoke: 'HANDLE GLASS BY THE EDGES', scheme: 'dark', accent: '#2E2C28', accentLit: '#E6DFCB', status: 'developing' },
  { slug: 'latent', frame: 4, title: 'Latent Image', noteName: 'Police story',
    tagline: 'Nothing is evidence until you develop it.',
    blurb: "An old case, a police photo archive and a search box. Type a word, pull up negatives and records in any order, and print what nobody bothered to look at. Each print gives you the next word. The story is in there. It just hasn't come up yet.",
    description: 'A police story told through an archive: search, print forgotten negatives, and develop the case in any order you like.',
    meta: ['Story', 'Search', 'Mystery'], greaseMark: 'arrow', greaseNote: 'print this one',
    edgeJoke: 'EXHIBIT ▸04A · DO NOT FOLD', scheme: 'dark', accent: '#8A5E00', accentLit: '#E9B04A', status: 'developing' },
  { slug: 'lensbench', frame: 5, title: 'Lens Bench', noteName: 'Camera designer',
    tagline: 'Build the glass. Shoot the street.',
    blurb: 'Slide lenses along an optical rail and watch real rays bend, focus and fringe. Choose an aperture and a shutter, bolt on a body, then carry your camera down to a small 3D street, take actual photographs with every flaw you built in, and develop the roll.',
    description: 'Design a camera from the glass up, watch real rays bend, then shoot and develop photos on a small 3D street.',
    meta: ['Toy', 'Optics', '3D'], greaseMark: 'underline', greaseNote: 'f/1.4 or bust',
    edgeJoke: 'CIRCLE OF CONFUSION ≤ 0.03', scheme: 'auto', accent: '#5B3FA6', accentLit: '#AE97F2', status: 'developing' },
  { slug: 'studio', frame: 6, title: 'Sunny 16', noteName: 'The whole studio',
    tagline: 'A house that takes pictures.',
    blurb: 'A little summer house that takes pictures. Build a camera in the garage, set it up in a backyard full of physics toys, then carry the roll down to the basement darkroom to find out what you caught. Everything you print stays.',
    description: 'A physics-toy photo studio in a little house: build a camera, play in the backyard, shoot, and develop the roll in the basement.',
    meta: ['Sandbox', 'Physics', '3 rooms'], greaseMark: 'star', greaseNote: "the friend's pick",
    edgeJoke: "FRIEND'S FRAME · NOT DICTATED", scheme: 'auto', accent: '#2C7547', accentLit: '#78CB97', status: 'developing',
    credit: "Frame 06 wasn't in the dictation. The friend holding the phone asked for it." },
]
```
Game page `<title>`: `{title} · Andrew Rankin`. The hub keeps Andrew's plain names in the kickers (`▸03 · NOTE 3 · DARKROOM, 1-BIT`), so renamed titles stay legible against the dictation card.

---

## Appendix B: Sound catalogue (ids for `Audio.play` / `Audio.loop`)

Params are numbers; `gain`, `pan` (−1..1) and `when` (s) are accepted by every id. (L) = loop. Recipes are in the cited GDD tables; `shared-audio` implements every id in `games/<slug>/sounds.ts`. Chrome sounds are `uiSound(...)`. Unknown ids are silent no-ops (§3.9).

**Generic library (from the spike, any game):** `room.tone` (L), `yard.wind` (L), `yard.birds` (L), `yard.sprinkler` (L), `yard.crickets` (L), `yard.cicadas` (L), `yard.chimes` (L), `shutter.leaf`, `shutter.focal`, `film.advance`, `film.click`, `film.rewind`, `bellows` (L), `focus.ring`, `aperture.detent`, `selftimer`, `flash.charge`, `flash.pop`, `geiger`, `timer.tick`, `timer.clock` (L), `timer.beep`, `timer.bell`, `timer.wind`, `enlarger.switch`, `enlarger.hum` (L), `safelight.buzz` (L), `safelight.chain`, `roomlight.start`, `liquid.slosh` (L), `liquid.lap`, `liquid.pour` (L), `liquid.drip`, `paper.flop`, `paper.peel`, `paper.crinkle`, `kbd.key`, `typewriter.key`, `typewriter.bell`, `typewriter.return`, `terminal.beep`, `terminal.seek`, `crt.degauss`, `crt.whine` (L), `printer.dotmatrix`, `radio.chatter` (L), `ship.creak`, `sea.wavehit`, `sea.waves` (L), `ship.hull` (L), `bell.fog`, `glass.chord`, `impact`, `marble.clack`, `marble.roll` (L), `cloth.rustle` (L), `ui.*`. Their params are in the spike defs.

**Darkroom** (darkroom.md §7.3): `darkroom.room-tone` (L) · `darkroom.safelight-on` · `darkroom.safelight-hum` (L) · `darkroom.pull-chain` {beads 6–9} · `darkroom.guard` · `darkroom.switch` · `darkroom.fluorescent-start` · `darkroom.fluorescent-hum` (L) · `darkroom.slosh` (L) {energy 0..1 = min(1, KE/0.006 J)} · `darkroom.lap` {intensity 0..1} · `darkroom.tray-land` {speed m/s} · `darkroom.drip` {intoLiquid 0|1} · `darkroom.paper-grab` · `darkroom.paper-dunk` · `darkroom.timer-tick` · `darkroom.timer-wind` · `darkroom.timer-bell` · `darkroom.enlarger-on` · `darkroom.enlarger-fan` (L) · `darkroom.pour` (L) {rate ml/s, fill 0..1} · `darkroom.brush` (L) {speed m/s, load 0..1} · `darkroom.hairdryer` (L) · `darkroom.uv-hum` (L) · `darkroom.tap` (L) · `darkroom.bloom` · `darkroom.pencil` · `darkroom.radio` (L, SHOULD) {station 0..2}. Captions: `[drip]`, `[fan hum]`, `[tap running]`, `[pencil scratch]`.

**Plates** (plates.md §7.4; names match `SfxName` in contracts): `plates.clack` {speed} · `plates.plop` · `plates.drip` {r mm 1–3} · `plates.glass` · `plates.tink` · `plates.fixChord` {n0, n1, n2, n3, n4 MIDI (0 = unused)} · `plates.stamp` · `plates.pen` · `plates.paper` · `plates.fog` · `plates.unwrap` · `plates.palette` · `plates.pin` · `plates.restore` · `plates.lampSwing` {speed rad/s} · `plates.wick` · `plates.snap` · `plates.wave` {strength 0.6–1.4} · `plates.sea` (L) · `plates.slosh` (L) {energy 0..1} · `plates.flame` (L) · `plates.fizz` (L, SHOULD) {rate} · `plates.fogBell` · `plates.arrival` (footsteps + door).

**Latent** (latent.md §7.3): `latent.key` · `latent.seek` {n 3–7} · `latent.tape` {lines} · `latent.chain-clink` · `latent.clunk` · `latent.bag-zip` (L) {speed 0..1} · `latent.bag-tick` · `latent.kink` · `latent.glug` · `latent.rap` · `latent.lid` · `latent.timer-tick` · `latent.timer-bell` · `latent.enlarger-hum` (L) · `latent.relay` · `latent.slosh` (L) {energy 0..1} · `latent.lap` · `latent.tok` · `latent.drip` · `latent.fog-hiss` · `latent.stamp` · `latent.cluster` (L) {rho01 0..1} · `latent.room` (L) {rain 0..1} · `latent.compressor` · `latent.phone-ring` (L) · `latent.squelch` · `latent.fax`.

**Lens Bench** (lensbench.md §7.3 and the `sfx` facade in §11.2): `lensbench.leaf` {t s} · `lensbench.cloth-fp` {t s} · `lensbench.metal-fp` {t s, mirror 0|1} · `lensbench.roller` {tc s} · `lensbench.cap` {open 0|1} · `lensbench.escapement` {dur s} · `lensbench.advance` · `lensbench.rewind` · `lensbench.detent` · `lensbench.rub` (L) {vel 0..1} · `lensbench.clink` {v 0..1} · `lensbench.creak` {c 0..1} · `lensbench.ping` {f0 Hz} · `lensbench.needle` · `lensbench.chime` · `lensbench.pour` · `lensbench.glug` · `lensbench.tick` · `lensbench.bell` · `lensbench.stamp` · `lensbench.street` (L) {wind 0..1, fountain 0..1} · `lensbench.courier-bell` · `lensbench.clock-bell` · `lensbench.achromat` (SHOULD) {consonance 0..1}.

**Sunny 16** (studio.md §7.3): `studio.cicadas` (L) {level 0..1} · `studio.crickets` (L) {tempF} · `studio.wind` (L) {w m/s} · `studio.chime` {tube 0–4} · `studio.sprinkler-tsk` · `studio.sprinkler-return` · `studio.spray` (L) {level 0..1} · `studio.leaf` {t s} · `studio.drop` {h m} · `studio.focal` {t s, tc s} · `studio.cap` {open 0|1} · `studio.selftimer` {dur s} · `studio.wind-on` · `studio.thock` · `studio.bellows` (L) {rate} · `studio.needle` (L) · `studio.swing-creak` {tension, omega} · `studio.sparrows` {n} · `studio.flutter` · `studio.bark` · `studio.pant` (L) · `studio.impact` {material 0 grass · 1 wood · 2 metal · 3 glass · 4 rubber · 5 cloth, impulse N·s, mass kg} · `studio.screen-door` · `studio.stairs` · `studio.glug` {rate} · `studio.lid` · `studio.fixer-pour` · `studio.tray-slosh` (L) {energy 0..1} · `studio.enlarger-hum` (L) · `studio.mail-truck`. Postcard replies use `uiSound('bell')` (★) and `uiSound('develop')` (✓).

**Texturedle** uses its own engine (`games/texturedle/audio/**`); it may use generic `marble.*`, `cloth.rustle`, `impact` and `ui.*`.

---

## Appendix C: Build plan (task list)

| Wave | Task id | Game | Depends on | Summary |
|---|---|---|---|---|
| 1 | shared-platform | shared | — | `@shared/core`, `@shared/storage`, `@shared/ui`, `@shared/games`, favicon |
| 1 | shared-audio | shared | — | `@shared/audio` port + the five game sound libraries |
| 1 | shared-photochem | shared | — | `@shared/photochem` port, optimized, with camera-game primitives |
| 1 | shared-fluid-dither | shared | — | `@shared/fluid` (TrayFluid facade) + `@shared/dither` |
| 1 | shared-photo | shared | — | `@shared/photo` port + incremental exposure, tilt, finder preview |
| 1 | shared-surface | shared | — | `@shared/surface` baker, contact fields, runtime, recipes 001–010 |
| 1 | texturedle-sim | texturedle | — | bench physics (tilt, marble, cloths, loose, grains) + contact audio |
| 1 | texturedle-render | texturedle | — | WebGL2 plate/marble/cloth renderer, optics, reveal diorama |
| 1 | texturedle-game | texturedle | — | contracts, daily loop, Atlas, notes, UI, input, save, share, test API |
| 1 | darkroom-spine | darkroom | — | contracts, game loop, input, widgets, prep desk UI, logbook, audio wiring, saves |
| 1 | darkroom-view | darkroom | — | the 3D bench, liquid/paper shaders, light regimes, negatives/prep/props content |
| 1 | plates-room-bench | plates | — | contracts, app, 1-bit room, lamp, sea, wet bench, chemistry, saves, HUD |
| 1 | plates-content | plates | — | 14 stereo tableaux, figure kit, exposure renderer, gallery |
| 1 | plates-inspect | plates | — | light table, velvet, loupe, stereo, the Return, story text, endings |
| 1 | latent-shell | latent | — | contracts, app, dither/CRT/fonts, terminal + search, 43 documents, endings |
| 1 | latent-frames | latent | — | frame kit, 16 templates, roll recipes, legibility ground truth |
| 1 | latent-lab | latent | — | film model, changing bag, tank, light table, enlarger, paper, trays, line |
| 1 | lensbench-glass | lensbench | — | `@shared/optics`, `@shared/sun`, the Bench screen, audio facade |
| 1 | lensbench-street | lensbench | — | contracts, GL core, Lantern Street world, finder, meter, shake, shots |
| 1 | studio-house | studio | — | contracts, engine, Rapier, input/grab, rooms, house, hall, mailbox, postcards |
| 1 | studio-yard | studio | — | yard world, sky/sun drag, toys, Dot, sparrows, photo subjects |
| 1 | studio-darkroom | studio | — | tank, light box, contact/enlarger, trays, development and printing |
| 2 | hub | hub | shared-platform, shared-audio | the contact sheet, previews, grease, loupe, `?og=` |
| 2 | darkroom-sim | darkroom | shared-photochem, shared-fluid-dither, darkroom-spine | the World: trays, paper, light, enlarger, iron, detectors, selftest |
| 2 | lensbench-shop | lensbench | shared-photo, shared-photochem, lensbench-glass, lensbench-street | store, saves, render queue, tank, lightbox, tags, grading, app |
| 2 | studio-camera | studio | shared-photo, studio-house, studio-yard | workshop, parts, finder, shake, shutters, capture, ShotRecord |
| 3 | texturedle-integrate | texturedle | shared-platform, shared-audio, shared-surface, texturedle-sim, texturedle-render, texturedle-game | page, wiring, smoke |
| 3 | darkroom-integrate | darkroom | shared-platform, shared-audio, darkroom-spine, darkroom-view, darkroom-sim | page, wiring, smoke |
| 3 | plates-integrate | plates | shared-platform, shared-audio, shared-fluid-dither, plates-room-bench, plates-content, plates-inspect | page, wiring, test API, smoke |
| 3 | latent-integrate | latent | shared-platform, shared-audio, shared-fluid-dither, latent-shell, latent-frames, latent-lab | page, wiring, test API, smoke |
| 3 | lensbench-integrate | lensbench | shared-platform, shared-audio, shared-photo, lensbench-glass, lensbench-street, lensbench-shop | page, wiring, smoke |
| 3 | studio-integrate | studio | shared-platform, shared-audio, shared-photo, studio-house, studio-yard, studio-camera, studio-darkroom | page, wiring, smoke |

---

## 10. Orchestrator status and how the build runs (2026-10-09, overrides §8–9 where they differ)

- **R1 done:** `@fontsource-variable/fraunces`, `@fontsource-variable/archivo`, `@fontsource-variable/caveat`, `@fontsource/ibm-plex-mono` are installed.
- **R2 done:** `vite.config.ts` adds `404.html` to the build inputs automatically when the file exists.
- **R5:** repo is https://github.com/JacobDey/andrew-rankin.com (public). Production: https://andrew-rankin.vercel.app (every push to `main` deploys).
- **R6 changed:** the build runs in parallel **cloud sessions**, not one shared machine. Each session runs its own dev server (`npm run dev`, port 5173) and its own screenshots (`node scripts/shoot.mjs …`, after `npx playwright install chromium`). If no browser is available in your environment, verify with `npm run build`, `npm run check` and logic self-tests instead, and say so in your PR.
- **Sessions and ownership:** one session per game (owns `games/<slug>/**` and every task of that game in Appendix C), one or two sessions for the shared modules (own the `src/shared/<module>/` trees listed in §4), one for the hub. Never edit paths another session owns; if you need a change there, put it under "Requests" in your PR description.
- **Shared modules land early, games consume them from `main`:** code against the §4 APIs. Until a module is on `main`, use a thin shim inside your own folder and delete it once the real module lands (`git fetch origin && git merge origin/main`).
- **Delivery:** branch from `main`, open a PR early, push often, keep `npm run build` green on every push (Vercel builds a preview for each PR). The orchestrator merges PRs into `main`.
- `spikes/` is committed for porting; it is never part of the production build.
