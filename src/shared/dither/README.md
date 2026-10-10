# @shared/dither

1-bit dither primitives and the Obra-Dinn-style post pass. Ported from `spikes/dither-1bit/core` (architecture §4.7).

- `@shared/dither` (barrel, **three-free**): `bayerMatrix(2|4|8|16)`, `bayer8(x, y)`, `ign(x, y)`, `generateBlueNoise({ size, seed, sigma })`, `getThresholdMap(pattern, size, seed, persist)`, `PALETTES`, `resolvePalette`, `hexToRgb`, `LUMA`, `ditherImage(lum, w, h, o)`, `DITHER_GLSL`.
- `@shared/dither/three`: `OneBitPass`, `thresholdTexture(pattern, size, seed)`, `applySurfaceDither`, `DevelopingPrintMaterial`, `AnchorTracker`, `applyLineId`, `setSharedSurfaceUniforms`.
- Dev page: `/src/shared/dither/dev/index.html` (cabin scene, palette sweep, CPU gradient). `__game.selftest()`, `__game.step(n)`, `__game.bench()`.

## Patterns

`'bayer' | 'bluenoise' | 'cluster' | 'bayer-ign'`. Threshold maps are byte arrays, value `(rank + 0.5) / N`; shaders recover `(b + 0.5) / 256`. `'bayer-ign'` = `0.5 * bayer8 + 0.5 * IGN`, evaluated over the tile (IGN is analytic, so the tile repeats every `size` px).

## OneBitPass (unchanged from the spike)

```ts
const pass = new OneBitPass(renderer, { palette: 'latentTerminal', pattern: 'bayer-ign', pixelScale: 4, ditherMode: 'screen' })
pass.syncSize(); camera.aspect = pass.aspect
pass.render(scene, camera)            // or render(scene, camera, renderTarget)
pass.setPalette('ruby', 48)           // 48-frame Bayer dissolve (0.8 s at 60 fps), plates.md 7.1 palette sweep
```

Latent: `pattern: 'bayer-ign'`, `ditherMode: 'screen'`, integer `pixelScale` = the cell size, palettes `latentTerminal`, `latentLightTable`, `latentSafelight`, `latentWhite`, `latentLine`, `latentClipping`. Plates: `ditherMode: 'sphere'` + `AnchorTracker`, palettes `ruby`, `canary`, `bone`, `prussian`.

## Deviations from the spike / the doc

- `applySurfaceDither(material, o)` takes the shared uniforms from `o.uniforms` or, if omitted, from the **most recently created `OneBitPass`** (the pass registers `pass.surface` in its constructor). The spike's 3-argument form `(material, pass.surface, o)` still works.
- `generateBlueNoise` default sigma is **1.5** (doc) where the spike used 1.9; results are cached in memory per `(size, seed, sigma, density)` and the returned array is shared (read-only). Timings in headless Chromium: 64 -> ~20 ms, 128 -> ~75 ms (the doc's 40 ms at 128 is not met; call it once at load).
- `getThresholdMap` caches blue noise in `localStorage` under `ar:dither:bn:<size>:<seed>` (a derived cache; skipped under `?embed=poster`, `?fresh=1`, `?test=1` or `persist = false`). The spike's `ar1b:` key is gone.
- `PALETTES`: `bone`, `ruby`, `canary`, `prussian` use the **plates.md 7.1** values (bone is `#191613`/`#E9E1CF`, not the spike's); `lamp` is kept as an alias of `canary`'s colours; the six `latent*` palettes come from latent.md 7.1.
- `ditherImage` output is `w x h` (one output pixel per input pixel); `cell` groups output pixels so each `cell x cell` block shares one threshold. `Float32Array` input is 0..1, `Uint8ClampedArray` is 0..255. Blue noise uses a 64x64 map, seed from `o.seed`.
- `DITHER_GLSL` declares global functions `bayer8`, `ign`, `bayerIgn`, `thresholdLookup`, `ditherBit`, `paletteBit`, `paletteDissolve`, `paletteMapped`; do not redeclare them in the same shader.
- `spikes/dither-1bit/core/analysis.ts` is included (`analysis.ts`, not exported by the barrels; import it relatively only in dev pages: `swimMismatch`, `legibility`, `captureFrame`).
- `mulberry32` is a local copy of the reference implementation (identical sequence to `@shared/core`), so the barrel has no dependency on core.
