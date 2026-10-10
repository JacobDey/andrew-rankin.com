# @shared/core

Pure TypeScript with DOM access; **no three** in the barrel (`import ... from '@shared/core'`). Three helpers live behind `@shared/core/gfx`. Owner: shared-platform. Spec: `docs/architecture.md` §4.1.

Files: `rng` `noise` `math` `bus` `loop` `flags` `quality` `gestures` `keys` `files` `idle` `testapi` (barrel `index.ts`) and `gfx` (three, not in the barrel).

## Use

```ts
import { flags, mulberry32, rngStream, createLoop, createGestures, detectTier, installGameApi, markReady } from '@shared/core'
import { createRenderer, fitRenderer, createRT } from '@shared/core/gfx'

const f = flags()                                  // ?test ?seed ?reset ?fresh ?embed ?quality|?q ?force ?theme ?debug ?mute
const rng = rngStream(f.seed ?? 1, 'sim')          // binding reference RNG; never Math.random in sim/render/content
const loop = createLoop({ fixedDt: 1 / 60 })
loop.onStep((dt) => world.step(dt)); loop.onFrame((_dt, alpha) => draw(alpha))
installGameApi('darkroom', 'darkroom@1', { state: () => world.snapshot(), advance: (n) => loop.advance(n) })
// ... after the first real frame:
markReady()
```

## API (all signatures as in §4.1)

- **rng**: `mulberry32` `hashString` (FNV-1a) `hash2i` `hash2` `hash3` `rngStream` `randRange` `randInt` `gauss` `pick` `shuffle`.
- **noise**: `valueNoise1/2` `gradientNoise2` `fbm1/2` `ridged2` `worley2` `bandNoise`.
- **math**: `clamp` `clamp01` `lerp` `invLerp` `remap` `smoothstep` `smootherstep` `fract` `mod` `degToRad` `radToDeg` `approxEq` `damp` `expDecay` `springStep` `catmullRom` `monotoneCubic` `median` `percentile`.
- **bus**: `createBus`. **loop**: `createLoop` (fixed step, `advance()` is deterministic and works while paused or stopped).
- **flags**: `flags()` `prefersReducedMotion()` `onReducedMotionChange()` `storageDisabled()`.
- **quality**: `deviceInfo` `probeGL` `detectTier` `dprCap` `createPerfMonitor`.
- **gestures**: `createGestures` (tap, doubleTap, hold, drag*, wheel, pinch, twist, twoFingerTap/Drag, hover) and `circularDrag`.
- **keys**: `shouldGameIgnoreKey` `onGameKey` `trackKeys`. **files**: `pickFile` `onFileDrop` `importImage` `ImportError` `canvasToBlob` `downloadBlob` `shareOrDownload` `copyText`.
- **idle**: `nextFrame` `idle` `sleep` `runSliced`. **testapi**: `installGameApi` `extendGameApi` `markReady` `captureErrors`.
- **gfx**: `createRenderer` `fitRenderer` `fullscreenTriangle` `createRT` `floatCaps` `readRTPixels` `dataTexture` `toHalfFloatArray` `disposeDeep` `snapshotCanvas`.

## Additions and deviations (all additive or clarifications)

- `testapi`: also exports `isGameReady()` and `whenGameReady()` (the shell uses them); `markReady()` additionally dispatches a `window` event `ar:ready`. `installGameApi` merges your object by property descriptor, so getters stay live. `captureErrors()` wraps `console.error` (still calls the original) and records `error`, `unhandledrejection` and `console.error` lines for `__game.errors()`.
- `flags`: `bool(name)` is true when the param is present and not `0|false|no|off` (so `?test` and `?test=1` both work). `?quality=` wins over `?q=`; an invalid value falls through. `_setFlagsForTests(search)` re-parses (test hook).
- `springStep` mutates and returns the same `Spring1` (no allocation); unconditionally stable (implicit damping, substeps above `dt*omega > 0.5`).
- `detectTier({ prefer })`: `prefer` is a **ceiling** (a game that tops out at `'medium'` passes `prefer: 'medium'`). Order otherwise as §4.1. `probeGL()` with no context uses a throwaway context and releases it.
- `createPerfMonitor`: time is the sum of the samples (not wall-clock); samples over 1000 ms are ignored (tab switches) and over 250 ms clamped. `onImprove` needs a full `windowS` with p75 under the threshold since it was armed or last fired.
- `createGestures`: a third finger is ignored; derived events (`tap`, `dragEnd`, `twoFingerTap`) come after `up`; `pinch`/`twist`/`twoFingerDrag` fire only when their value changed; `wheel` always calls `preventDefault` (the stage never scrolls; ctrl+wheel never zooms the page); `el.style.touchAction` is set to `none` and restored on `dispose()`. Pointer capture failures on synthetic pointers are swallowed (harness-friendly).
- `importImage` sniffs PNG, JPEG and WebP magic bytes before decoding, so other formats fail with the user-safe `ImportError` message even if the browser could decode them.
- `fitRenderer` also sets the canvas CSS to `width/height: 100%; display: block` and uses `setSize(w, h, false)`.
- `shareOrDownload`: a dismissed share sheet returns `'failed'`, so don't toast success.

## Acceptance

`/src/shared/core/dev/` (`__game.selftest()`, 47 checks: reference RNG values, fbm range, `loop.advance(60)` = 60 steps, flags, scripted PointerEvents for tap, drag, pinch, twist, wheel and priority, perf monitor, importImage, runSliced, test API) and `/src/shared/core/dev/gfx.html` (`__game.selftest()`, 16 checks: renderer, RT read-back sync and async, float and half-float, data textures, snapshot, disposal). Both pass.

```
node scripts/shoot.mjs /src/shared/core/dev/ --eval "__game.selftest().then(r => r.ok)"
node scripts/shoot.mjs /src/shared/core/dev/gfx.html --eval "__game.selftest().then(r => r.ok)"
```
