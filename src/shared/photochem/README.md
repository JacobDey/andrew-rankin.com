# @shared/photochem

Pure TypeScript photographic chemistry: silver gelatin paper, cyanotype, negative film, light and spectra, baths, plus the film and paper primitives the camera games compose. No DOM, no three, hub-safe. Ported from `spikes/photochem/core` and optimised. Contract: `docs/architecture.md` §4.5. Equations and sources: `spikes/photochem/NOTES.md` (the model is unchanged except where listed under "Model changes").

```ts
import { SilverSheet, CyanoSheet, paper, lightBands, makeDeveloper, vcGradeFilter } from '@shared/photochem'
const sheet = new SilverSheet(paper('vcPearl'), 256, 320, { simScale: 0.5 })
sheet.expose(lightBands('enlarger', 1.5), 12, { mask: negativeTransmission, filter: vcGradeFilter(2) })
sheet.process(makeDeveloper(), dt, { contact: trayContact, agitation: 0.7 })
sheet.render(rgba)            // RGBA8; alpha = wetness
```

## What is exported

Everything in the spike's `core/index.ts` with the same names and signatures (bands, colour, curves, kinetics, paper, baths, `SilverSheet`, `FilmFrame`, `CyanoSheet`, image helpers, printing, snapshot codec, GLSL strings), plus:

| | |
|---|---|
| `SilverSheet(model, w, h, opts?: number \| { areaM2?, simScale?: 1 \| 0.5 })` | `simScale` 0.5 runs every field at ceil(w/2) x ceil(h/2) and upsamples bilinearly (in linear light) in `render()`. `w`, `h` stay the output size; `sw`, `sh`, `n` are the simulation size and `f` fields have `n` entries. |
| `SilverSheet.stats(): SilverStats` | `meanD`, `dmax`, `borderD` (outer 4%), `coverage` (fraction the developer touched), `evenness` (mean local std of density, i.e. mottling), `fixedFraction`, `wetMean`, plus the spike's `meanDensity`, `halideLeft`, `residualHypo`, `retainedSilver`, `fog`, `wet`. Samples about 4k pixels, so it is cheap. |
| `SilverSheet.render(out, illum?, { opaque? })` | Alpha is wetness (0..255) as the architecture asks; `{ opaque: true }` writes 255 for `putImageData`. |
| `version` | Bumped by every mutating call on `SilverSheet` and `CyanoSheet`; skip `render()` when it has not changed. |
| `CyanoSheet(w, h, { simScale? })`, `process(bath, dt, { contact?, h2o2? })` | `h2o2` is a per-pixel local peroxide strength (added to the bath's own): feed the tray's peroxide field and the oxidation front follows it. `stats()` also returns `meanD`, `dmax`, `borderD`, `coverage`, `evenness`. `render(out, illum?, { opaque? })` as above. |
| `mixSensitizer(mlA, mlB)` | `{ ratio, ratioAB, speed, dmax, beakerHex }` per darkroom §5.8. Pass `ratioAB` to `coat()`. |
| `peroxideBath(local)` | Water blended toward `CYANO_BATHS.peroxide` by 0..1 (strengths above 1 are allowed). |
| `NegCurve`, `logisticDensity`, `x0ForMidGrey`, `devRateTemp`, `devAmount`, `selwynSigma` | Lens Bench §5.10 and Sunny 16 §5.10 as written in the architecture. |
| `grainField(w, h, seed, { clumpPx?, octaves? })` | Zero mean, unit variance, deterministic, anchored to pixel coordinates. |
| `bromideDrag(D, w, h, { strength, lengthPx, threshold, axis })`, `halation(H, w, h, channels, { threshold, sigmaPx, gain, tint? })` | In place. Drag: `b(i) = b(i-1) e^(-1/L) + 0.08 max(0, D(i-1) - threshold)`, `D(i) -= strength * b(i)`. Halation: `H += gain * tint * blur(max(H - threshold, 0))`, alpha of a 4-channel array is left alone. |
| `PaperCurve`, `paperDensity`, `gradedPaperCurve(grade, 'studio' \| 'latent')`, `densityLUT` | Sunny 16 §5.12 and Latent §5.6 tables. In the `'latent'` preset `xp = log10(E)` and `xMid = log10(Eg)`. In `'studio'`, `xp = log10(t/t_ref) - D_neg + log10(G_size)`. |
| `selftest(): Check[]`, `bench()` | 114 checks (below) and timings in ms at 256 x 320 (min of several runs). |

## Performance (256 x 320, desktop, min of runs)

| | budget | measured (Node 22 / headless Chromium, busy machine) |
|---|---|---|
| `SilverSheet.expose` (masked) | 2 ms | 1.4 to 1.8 |
| `SilverSheet.process` (developing) | 2.5 ms | 1.7 to 2.8 |
| `SilverSheet.render` | 4 ms | 3.2 to 4.5 |
| `CyanoSheet.process` | 2 ms | 0.7 to 1.3 |
| same at `simScale: 0.5` | | process 0.7, expose 0.3, cyano process 0.1; render 2.8 (dominated by the output upsample) |

The spike measured 4 to 7 ms per step and 17 ms per render. The gains come from: log-spaced lookup tables for the H&D curves and reciprocity (`fast.ts`, indexed from the float32 bits, no `Math.log` per pixel), 10^-x and softmin tables, the exp-free small-step development update, bath-coupling exponentials cached while the contact value does not change, one division instead of two in the autocatalytic step, skipping pixels that are out of the liquid, skipping tint/second-image/toning/ageing fields that were never touched, and typed-array loops with everything hoisted. `bench()` takes the minimum of repeated runs because the numbers on a shared machine are noisy.

Determinism: identical inputs give bit-identical fields (checked in `selftest`). Tables are built from `Math.log`, `Math.exp`, `Math.pow` at module load or first use, so "same pixels" holds per browser engine, as architecture §3.3 asks.

## Model changes against the spike (all small, all covered by the self-test)

- Still-tray exchange time constant 1/(0.15 + a) became 1/(0.10 + a) so a still tray finishes about 30% later than a rocked one (darkroom §5.11 asks for +25 to 40%); fresh agitated development is unchanged (shadows visible 8 s, half at 37 s, 95% at 68 s).
- `develop()` marks a pixel wet only where liquid touched it (the spike set every pixel wet).
- Peroxide and Prussian-white rates in `CyanoSheet.process` are additive in `h2o2` instead of switching form at `h2o2 > 0`, so a local concentration blends smoothly with plain water. At strength 1 the numbers are the spike's to within 1%.
- Curves, reciprocity and the sRGB-independent colour maths go through tables (parity checks: curve table within 2e-3 D, reciprocity within 0.3%).
- The spike's `NegCurve` type (digital-negative presets) is renamed `DigitalNegCurve`; `NegCurve` is now the film-curve interface required by §4.5.
- Imports inside this folder keep their `.ts` extensions so `node src/shared/photochem/dev/run-selftest.ts` works without a bundler (the root tsconfig allows it).

## Test

```
node src/shared/photochem/dev/run-selftest.ts [--bench]          # Node 22.18+, about 0.5 s
node scripts/shoot.mjs "/src/shared/photochem/dev/index.html?test=1" --eval "JSON.stringify(__game.selftest())"
node scripts/shoot.mjs /src/shared/photochem/dev/ --wait 6000 --out shots/photochem/dev-01.png   # wedge, cyanotype, film + print
```

`selftest()` runs the spike's 72 checks, the darkroom §5.11 targets that are unit-free (development timing, still vs rocked, safelight, room light, mailbox print, grade ratio, fixing time, Sabattier reversal, cyanotype bronzing, peroxide), table and half-resolution parity, determinism, and the camera primitives (Pan 400 x0 = 0.718, Selwyn 0.032, studio grade 2 prints a 0.25 negative at 1.68 and a 1.5 negative at 0.10, grain statistics, drag, halation, mixing).

Not covered: the Mackie-line dip (needs the tray flow field), the 3 cm/s peroxide front speed (a fluid property), and the GPU develop pass (the spike's `glsl.ts` strings are exported unchanged and are not tuned to the changes above).
