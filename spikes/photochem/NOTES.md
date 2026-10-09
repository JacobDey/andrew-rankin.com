# photochem spike: notes

A pure-TypeScript photochemistry model for the darkroom games (darkroom, plates, latent, lensbench, studio). It covers silver gelatin paper (graded and variable-contrast), negative film and plates, and classic cyanotype, from light to "years later". It also has a working demo page, a 72-check self-test, and a GLSL port of the per-texel development step that matches the CPU code to float precision.

- **Demo:** http://127.0.0.1:5173/spikes/photochem/ (tabs: Silver print · Cyanotype · Film · Curves · Self-test; `#cyano` etc. deep-link)
- **Core:** `spikes/photochem/core/` has no DOM, no WebGL and no dependencies. It runs unchanged in the browser, a worker, and Node 22.18+ (type stripping). Lift it to `src/shared/photochem/` as-is.
- **Status:** `tsc` strict is clean. Self-test 72/72 in Node and in headless Chromium. GPU parity holds to max error 5e-7. Upload, dodge/burn painting, live development and save/load were exercised in the harness.

---

## 1. Files

```
spikes/photochem/
  core/                    reusable, pure TS (≈3 400 lines)
    bands.ts               5-band spectral model: lights, emulsion sensitivities, filters, rgb→bands
    curve.ts               H&D curve family + ISO R / ISO P / ISO film speed / contrast index
    kinetics.ts            exact development step, Q10, reciprocity η(I), hashes
    paper.ts               paper models (VC two-emulsion, graded), surface floor, calibrated filter table
    baths.ts               developer / stop / fixer / wash / HCA / toner / air state + rate laws
    silver.ts              SilverSheet: per-pixel latent → develop → stop → fix → wash → tone → age → colour
    film.ts                FilmFrame + film stocks: ISO placement, time-gamma, push/pull, grain, latent ageing
    cyanotype.ts           CyanoSheet: stoichiometric cyanotype chemistry, wet baths, toning, fading, colour
    printing.ts            enlarger illuminance, auto grade/time ("a printer's first guess")
    image.ts               PNG→linear, resample, digital-negative desk, procedural scenes (rusty mailbox, fern, wedge, hake-brush coat)
    snapshot.ts            save-state codec (JSON header + uint16 fields)
    glsl.ts                GLSL ES 3.00 ports: curve, devStep, reciprocity, develop pass (MRT), colour
    index.ts               barrel
  selftest.ts              72 numeric checks against photographic facts (pure; Node + browser)
  main.ts, demo/*.ts       demo page (tabs, plots, pointer painting, live development, GPU parity, bench)
  tools/calibrate.ts       solves the VC dichroic table + graded gammas against ISO targets
  tools/run-selftest.ts    node spikes/photochem/tools/run-selftest.ts
  tools/dump.mjs           renders a pipeline contact sheet to PNG with no browser
  tools/bench.ts           Node micro-benchmark of the hot loops
  tools/explore-vc-components.ts   record of the VC component-shape exploration (see §4.4)
  tsconfig.json            standalone strict config (see Gotchas: the root one fails on TS 7)
```

Run:

```bash
node spikes/photochem/tools/run-selftest.ts          # 72/72, ~40-90 ms
node spikes/photochem/tools/calibrate.ts             # re-solve tables after changing emulsions
node spikes/photochem/tools/dump.mjs silver '{"grade":4}' shots/x.png
node scripts/shoot.mjs "spikes/photochem/#tests" --eval "JSON.stringify(window.__spike.gpuParity())"
npx tsc -p spikes/photochem/tsconfig.json --noEmit
```

`window.__spike`: `show(tab)`, `silver.run()/set({...})/live()/save()/load()`, `cyano.run()/set()/live()`, `film.run()`, `curves.refresh()`, `selfTest()`, `gpuParity()`, `perf(w,h)`, `stepDev(n)` (advance the live silver development by n simulated seconds and return ms per step), `state()`, and `core` (the whole module).

---

## 2. Core API (signatures)

### Light and spectra (`bands.ts`)
```ts
type Bands = [uv, blue, green, amber, red]                 // W/m² per band (365/450/540/590/650 nm)
lightBands(src: LightId | LightSource, level?: number): Bands   // level in lux, or W/m² UVA for 'uvBox'
sunBands(cloud = 1, elevation = 1): Bands                  // UV attenuates as cloud^0.6
LIGHTS: tungstenA, enlarger, room, roomLED, safelightAmber, safelightRed, safelightSodium,
        safelightGreen, rubyLantern, dialLamp, uvBox, sun  // each { shape, unit, level, hex, note }
SENSITIVITY: paperGraded, vcHard, vcSoft, filmPan, filmOrtho, filmBlue, cyanotype
makeSpectral(sens, reference = 'tungstenA'): Spectral      // 1 lux of reference → 1 effective lux
actinic(sp, light, filter?): number                        // effective lux on that emulsion
dichroicFilter(yellowCC, magentaCC, cyanCC = 0): Bands
rgbToBands([r,g,b]): Bands                                 // linear sRGB (luminance = lux) → bands
luxOf(bands), blackbody(K), CAMERA_FILTERS (yellow8, orange21, red25, green11, uvBlock)
```

### Curves and kinetics (`curve.ts`, `kinetics.ts`)
```ts
interface Curve { gamma, logH0, toe, dmax, shoulder, solarize?, solarizeAt? }
curveDensity(c, log10H), curveDensityH(c, H), curveGradient(c, x), logHAtDensity(c | f, D)
isoRange(f, dmaxNet), isoPaperSpeed(f), isoFilmSpeed(f), contrastIndex(f), averageGradient(f, d1, d2)
devStep(p, R, a, b, dt): number                 // exact step of dp/dt = R(a + b p)(1 - p)
devTimeBetween(p0, p1, R, a, b): number
reciprocityEfficiency(r: Reciprocity, I): number; reciprocityFromTimes(Hn, tc, p, tHigh?, pHigh?)
reciprocityCorrectedTime(r, tMetered, H): number
q10(Q10, tempC), relax(x, target, tau, dt), hash01(x, y, seed), hashGauss(x, y, seed)
```

### Paper (`paper.ts`)
```ts
paper(id: 'vcPearl'|'vcGlossy'|'vcMatte'|'vcFiber'|'warmFiber'|'bromide', grade?): PaperModel
makePaper(spec: PaperSpec): PaperModel           // { kind, grade?, base: rc|fb, surface, tone }
vcGradeFilter(grade: -1(00)..5, fractional ok): Bands; VC_FILTER_TABLE; gradeLabel(g)
componentGains(model, light, filter?): { hard, soft }
printCurve(model, filter?, light?): (log10 H) => observed net density
paperMetrics(model, filter?): { isoR, isoP, logH06, dmax }
silverDensity(model, Hhard, Hsoft), observedNet(surface, dInt)
```

### Baths (`baths.ts`): plain JSON state, so they go straight into save games
```ts
makeDeveloper('paperMQ'|'filmMQBorax'|'pyro'|'caffenol', { dilution, tempC, volumeL, silverG, restrainerGL, ageH, ... })
developerRates(b): { paper, film, fog, dmaxFactor, warmth, activity, bromideGL, liquid: RGB }
consumeDeveloper(b, gramsAg)
makeStop('acetic'|'citric'|'water'); stopAcidity(s); stopTau(s); stopIndicatorColour(s)
makeFixer('rapid'|'hypo'); fixerRates(f): { rate, silverGL, retention, exhausted, etch }
makeWash(flow 0..1, tempC); { kind: 'hca' }; makeToner('selenium'|'bleach'|'sulfide'|'farmer'); AIR
```

### Silver print (`silver.ts`)
```ts
new SilverSheet(model | spec, w, h, areaM2 = 0.0516 /* 8x10 */)
sheet.expose(light: Bands, seconds, { filter?, mask?: ArrayLike<number> /* per-pixel transmission */ })
sheet.exposeRGB(rgbLux: ArrayLike<number> /* 3/px */, seconds, filter?)    // paper negatives, coloured light
sheet.enter(bath)                                   // once per transfer: carry-over accounting
sheet.process(bath, dt, { contact?: ArrayLike<number>, agitation?: 0..1, diffuse?: boolean }): StepReport
sheet.age(years, { tempC, rh, displayLux, hoursPerDay })
sheet.yearsToDiscolour(): { years, cause: 'residual hypo'|'tired fixer'|'unfixed halide'|'nothing' }
sheet.render(rgba: Uint8ClampedArray, illum: RGB = [1,1,1])  // illum = safelight tint × level
sheet.reflectance(i), sheet.silverDensity(i), sheet.observedDensity(i), sheet.stats()
sheet.toBytes(): Uint8Array; SilverSheet.fromBytes(bytes)
sheet.f.<field>: Float32Array        // 24 SoA fields, documented in SILVER_FIELDS
```
The typical frame loop for the darkroom game:
```ts
sheet.expose(lightBands('enlarger', enlargerLux(fStop)), dt, { mask: negT × handShadow, filter: vcGradeFilter(g) })
sheet.expose(lightBands('safelightAmber'), dt)         // always on: fog is just unintended exposure
sheet.process(devTray, dt, { contact: trayContactMask, agitation: rockSpeed })
sheet.render(out, safelightOn ? SAFE_VIEW : [1,1,1])
```

### Film (`film.ts`)
```ts
makeFilm('nj100'|'nj400'|'ortho25'|'varrow400'|'dryPlate' | spec): FilmModel   // { curve, pNormal, k, Hm, recip, rgbWeights(filter?) }
new FilmFrame(model | id, w, h, formatMM = 36)
frame.exposeRGB(rgbLux, seconds, filter?); frame.expose(light, seconds, { mask, filter })
frame.ageLatent(years, storeTempC)              // latent regression + radiation/thermal fog
frame.process(bath, dt, { agitation, contact })  // developer / stop / fixer / wash / air
frame.densities(out?, grain = true, seed): Float32Array   // gross density, film-space grain
frame.printMask(out?, callierQ = 1): Float32Array          // enlarger transmission for SilverSheet.expose
frame.render(rgba, { grain, lightbox })                    // light-box view: base tint, pink AH dye, milky unfixed haze, pyro stain
pushPull(model, stops, bath?, agitation?): { minutes, gamma, shadowEI, possible }
filmProgress(model, rate, seconds), agitationFactor(a)
```

### Cyanotype (`cyanotype.ts`)
```ts
new CyanoSheet(w, h)
cy.coat(amount: number | ArrayLike<number>, { ratioAB = 1, sensitizerAgeH = 0 })   // amounts in standard coats; streaks survive
cy.dry(dt, airflow 0..1, rh = 50)
cy.expose(light: Bands, seconds, { mask })      // sub-steps internally; printing-out is visible live
cy.process(CYANO_BATHS.water|hardTap|vinegar|citric|peroxide|soda|tea|coffee | custom, dt, { contact }): { yellowOut }
cy.rest(hours, { luxHours, airflow })           // overnight deepening; light fades, dark regenerates
cy.ageYears(years, buffered = true)
cy.render(rgba, illum?), cy.reflectance(i), cy.visualDensity(i), cy.stats(), toBytes()/fromBytes()
```

### Prep and printing (`image.ts`, `printing.ts`)
```ts
fromRGBA8(imageData.data, w, h): LinearImage; resample(img, w, h); luminanceOf(img, mix?)
digitalNegative(lum, w, h, { curve: 'silver'|'cyanotype'|'linear', range, dmin, flip, autoLevels }): Float32Array (density)
transmission(density), stepWedge(w, h, 21, 0.15), mailboxScene(w, h), fernMask(w, h), brushCoatMask(w, h)
enlargerLux(fNumber = 8, magnification = 7, lamp = 1): number
autoPrint(model, negDensities, lux): { grade, seconds, filter, negRange }
```

---

## 3. Units and conventions

- **Light** is band irradiance in W/m² per band. `lightBands(id, lux)` scales a preset shape to an illuminance using CIE V(λ) at the band centres (683 lm/W). UV sources are specified in W/m² of UVA instead.
- **Effective exposure H** is in *reference lux·s*: each emulsion is normalised so 1 lux of its reference light gives 1 effective lux (paper uses 2856 K tungsten, as ISO 6846 does; film uses daylight, as ISO 6 does). Paper and film data sheets use these units, so data-sheet numbers drop straight in.
- **Densities** in the sheets are intrinsic (silver) reflection densities. *Observed* density goes through the surface floor (§4.5). Film densities are gross transmission densities.
- **Time** is seconds everywhere except film `devMinutes` and cyanotype `rest(hours)`.
- Every `process`/`expose` call is **frame-rate independent**: one 30 s call matches 1 800 calls at 1/60 s to 3e-4 in p (checked by the self-test).

---

## 4. The model, equation by equation

Each subsection gives the equation, the rationale, and whether a number comes from published practice ("data") or was tuned to match a documented behaviour ("tuned"). Sources are in §10.

### 4.1 Five-band spectral model
```
E_eff = norm_e · Σ_b S_e[b] · L[b] · T_filter[b]          norm_e = 1 / (S_e · L_ref(1 lux))
```
One mechanism covers enlarger exposure, safelight fog, a peeled-off dial lamp, room-light disasters, ortho film's red-blindness, camera filters and the cyanotype's UV-only response. The amber band sits on the sodium D line, so a sodium safelight is one band. Light shapes: the enlarger and the ISO paper reference are Planck spectra (3200 K and 2856 K, UV glass-filtered). Sun is a 5500 K blackbody plus 45 W/m² UVA at 100 klux (data: clear summer noon UVA is about 40-60 W/m²). The UV box is 40 W/m² (data: BL-tube exposure units are 3-10 mW/cm²). Safelight leak values are tuned (§4.7).

### 4.2 Reciprocity failure as an intensity efficiency
```
η(I) = (1 + (Ic/I)²)^(-p/2) · (1 + (I/Ih)²)^(-q/2)          dH = η(I) · I · dt   (per pixel, per frame)
```
For I << Ic this is Schwarzschild's law, H ∝ I^(1+p)·t, which gives the familiar t_corrected = t^(1+p) rule. Above Ic it is 1 to second order. The formulation is per-intensity rather than per-time so exposures can be integrated through clouds, dodging hands and flickering lamps. Film: Ic = 10·Hm / 1 s, p = 0.27, giving 8 s metered → 14.1 s (data: the t^1.3 rule of thumb). HIRF q = 0.3 at 1e-4 s, so 1/16 000 s loses about 0.27 stop. Paper: Ic = H(0.6)/30 s, p = 0.15, so long print exposures lose a little speed and gain a little contrast (a real effect). At safelight intensities η is 0.3-0.6, which matters for §4.7. **Cyanotype has no reciprocity failure**: ferric citrate photoreduction is a one-photon process.

### 4.3 Characteristic curves
```
lin = γ (x − logH0)        x = log10 H
toe = t · softplus(lin / t)
D   = softmin(toe, Dmax; s) = min − s·log1p(exp(−|toe − Dmax| / s))
D  -= sol · softplus(3 (x − x_sol)) / 3          (optional solarisation, used by the dry plate)
```
Every parameter has a photographic meaning: γ is exactly the straight-line slope, `logH0` is the inertia point, and t and s are toe and shoulder softness in density units. The curve is smooth, monotone without solarisation, costs two exp and two log, and ports to GLSL line for line. ISO metrics follow the standards: paper R = 100·(log H at 0.9·Dmax − log H at 0.04), ISO P = 1000/H(0.6); film S = 0.8/Hm at 0.10 above base+fog, checked by the ΔD = 0.80 over 1.3 log H condition.

### 4.4 Variable-contrast paper: two emulsions, and the filter drawer is the grade
```
H_hard += η·actinic(vcHard, L, F)·dt     H_soft += η·actinic(vcSoft, L, F)·dt
D_int   = softmin(p·[curve_hard(H_hard) + curve_soft(H_soft)], Dmax_int · dcap; 0.12)
```
The hard component is blue-sensitive (γ 4.3, short toe). The soft component is green-sensitised (γ 1.32, long toe). Densities add, then saturate, because there is only so much silver. A yellow filter cuts blue and gives the soft grades. A magenta filter cuts green and gives the hard grades. **Split-grade printing needs no code**: two exposures through two filters simply add to the two latent channels. The dichroic Y/M settings per grade were **solved** by `tools/calibrate.ts`: for each grade, two unknowns (Y, M) meet two targets, ISO R and constant speed. Grades 00 to 3½ hit ISO P 500 and grades 4 to 5 hit ISO P 250, which is the Ilford Multigrade convention that grades 00-3½ share one exposure and 4-5 need double.

| grade | Y | M | ISO R | ISO P |
|---|---|---|---|---|
| 00 | 152 | 11 | 180 | 500 |
| 0 | 110 | 12 | 160 | 500 |
| 1 | 62 | 15 | 130 | 500 |
| 2 | 34 | 18 | 110 | 500 |
| 3 | 14 | 31 | 90 | 500 |
| 3½ | 11 | 46 | 80 | 500 |
| 4 | 38 | 92 | 70 | 250 |
| 5 | 33 | 147 | 50 | 250 |

Unfiltered paper behaves like grade 2 (R ≈ 100), as real VC paper does. **Known shape caveat:** at the soft and middle grades, an additive two-emulsion model gives a dog-leg curve: gentle highlights, then a steeper upper section where the blue component joins in. That is the qualitative behaviour printers describe for VC paper, but the model exaggerates it. With the original γ 5.6 hard component the slope jump at grade 2 was 4.8×. Re-shaping the hard component (γ 4.3, toe 0.04) cut it to about 2.5-3.8×. A third, mid-contrast component does not help when it is green-sensitive (it caps the softest grades at R ≈ 120), as `tools/explore-vc-components.ts` records. If the game shows curves, it can keep the two latent channels for physics and plot a per-grade fit.

Graded paper is one blue-sensitive emulsion. Its γ per grade was solved for R = 160/130/110/90/70/50 (γ = 1.50, 1.84, 2.18, 2.66, 3.42, 4.79), and the curve is placed so ISO P = 250…100.

### 4.5 Surface floor, Dmax, wet prints, dry-down
```
reflectance_c = (1 − s) · white_c · 10^(−D_int · tint_c − stains_c) + s       s = mix(s_dry, s_wet, wet)
s_dry: glossy 10^-2.2, pearl 10^-2.05, matte 10^-1.62  → visible Dmax 2.12 / 1.99 / 1.60 (data: ~2.1 glossy, ~1.6 matte)
s_wet = 10^-2.3        (a water film is glossy: prints look richer wet)
dry-down: D *= 1 + k·(1 − wet)·4u(1 − u),  u = D/Dmax_int,  k = 0.07 RC / 0.12 FB
```
The first-surface reflection is what limits Dmax physically. One parameter gives three behaviours: the glossy/pearl/matte difference, the "it looked better wet" lesson, and a shoulder that the intrinsic curve does not need. Dry-down follows the commonly quoted 5-10% midtone darkening, larger on fibre.

### 4.6 Development kinetics (paper)
```
dp/dt = R · c · (seed(F) + p)(1 − p)          F = min(1, D∞/Dmax),  seed = 0.012 + 0.018·F
R     = developerRates(bath).paper · paperRate (RC 0.1/s, FB 0.05/s)
```
This autocatalytic law gives an induction period that is shorter for more exposure. Shadows show at about 8 s, midtones by about 30 s, highlights at 45-60 s, and the print is done by 75-90 s (the design-doc targets; checked: shadows 8.0 s, highlights net 0.06 at 45 s). It integrates **exactly** over any dt with the closed form `(a+bp)/(1−p) = K·exp((a+b)Rt)`, so it is stable at 1/60 s or 30 s. Film uses the same law with a small autocatalytic term, which is effectively first-order Sheppard-Nietz kinetics: D(t) = (1 − e^(−kt))·D∞ (§4.12).

The **local developer** `c` relaxes toward the bath where liquid touches, with τ = 1/(0.15 + agitation): a still tray is about 6.7 s, rocking about 1 s. It is depleted by 0.5 per unit of density developed. Where there is no contact it keeps working on carried-over developer and decays with τ = 25 s. That gives you, with no special cases: the image only comes up where the wave touched (the design doc's centrepiece), a print lifted out keeps developing a little, still trays under-develop dense areas, and `diffuse: true` (a 3×3 blur of `c` per step) spreads exhaustion sideways for bromide drag and Mackie lines. **Chemical fog** grows at `fog · c` after 25 reference-seconds, with Q10 = 3.5, so it climbs faster with heat than the image does.

### 4.7 Safelights (tuned to the design doc, with LIRF)
Unwrapped VC paper under the amber safelight (2.5 lux at the bench) gains a just-visible ΔD 0.04 in **4.1 min**; pre-flashed paper (the coin test) in **87 s**. The design doc targets were 4 min and 90 s. Under red it takes 2.5 h. Graded paper under amber takes 2.8 h (pre-flashed 29 min). Room light (400 lux) does it in 0.4 ms. A sodium safelight at 5 lux takes about 2 min for VC: bright to the eye, but not free. The tuned numbers are the amber-band sensitivities (VC soft 2.6e-4, hard 3e-5, graded 3e-5 relative to peak) and the safelights' green leaks (amber 3e-5, red 1e-6). Fog is accumulated as ordinary exposure, so it bites the highlights first, which is what real safelight fog does.

### 4.8 Developer chemistry (`developerRates`)
```
strength   = (1 + workingDilution) / (1 + dilution)
rate       = activity0 · strength^0.7 · Q10^((T−20)/10) · exhaustion · aerial · 1/(1 + Br/2 g/L) · HQ(T)
exhaustion = (1 − silverDeveloped / (capacity · volume · strength))^1.3        capacity 0.9 g Ag/L for paper MQ
aerial     = exp(−hours / trayLife)                                          10 h paper MQ, 1.2 h pyro, 0.7 h coffee
fog        = fogRate · fogQ10^((T−20)/10) · strength^0.7 · √activity / (1 + Br/0.35 g/L) · (1 + 0.08 · fixer mL/L)
HQ(T)      = 0.55 + 0.45·smoothstep(9, 17, T);  Dmax × (0.78 + 0.22·smoothstep)   (cold hydroquinone: soft, weak blacks)
dmaxFactor × min(1, 0.62 + 0.38·√activity); warmth = 1.2(1 − activity)          (tired developer: brown-black, weak Dmax)
```
- Q10 = 2.5 gives the 9-10% per °C of the published time/temperature charts (checked: 24/20 °C = 1.44×).
- The 0.7 dilution exponent reproduces stock vs 1+1 (NJ400: 5.9 → 9.6 min; data: D-76 1+1 runs about 1.6× stock).
- Bromide restrains fog about 6× harder than image, which is why a few drops rescue a fogged plate (the Plates game's mechanic).
- Released bromide is 0.74 g per g of Ag (the AgBr mass ratio).
- Fixer carried in on dirty tongs raises fog (dichroic-fog territory).

### 4.9 Stop, fix, wash
```
stop:  c decays with τ = 2 s (fresh acid) … 12 s (water / exhausted); development continues on what is left
       acidity = 1 − carriedDev / (0.12 L per L);   indicator yellow → purple below ~0.2
fix:   x(t) = x0 · exp(−rate·t / fixTau);   fixTau RC 9 s (clears in 36 s), FB 30 s (about 2 min)
       rate = strength^0.8 · 1.4^((T−20)/10) · (hypo ? 0.5 : 1) · alkalinity / (1 + (Ag g/L / 3)^1.5)
       → clearing time doubles at 3 g/L, the classic discard rule; retention = smoothstep(0.8, 4, Ag g/L)
       over-fixing in rapid fixer etches ~0.0006 D/s after 4× clearing time (bleached highlights)
wash:  r(t) = r0 · exp(−t / τ),  τ RC 30 s, FB 720 s (200 s after hypo clear), ×(1 + 3(1 − flow)), Q10 1.6
       → RC 4 min: 5e-5; FB 10 min: 0.43 (not enough); FB 60 min: 6.7e-3 (archival-ish)
```
Fixing is diffusion-limited complexation, so a first-order clearance. Insoluble argentothiosulfate complexes form in a loaded bath and are not washed out (τ × 25). That is why tired fixer stains years later even after a good wash.

### 4.10 Sabattier, toners, reducers
- **Light during development** goes to a second latent image: `H2 += η·I·dt·x·10^(−(0.55 + 1.0)·D_now)·(1 − D_now/Dmax)`. The terms are optical screening by developed silver (one pass is about 0.55 of reflection density), desensitisation of halide next to developed silver by development products, and the grains already used up. H2 develops on its own track p2. A dim flash (1-8 lux·s) at 45-60 s gives a partial tone reversal: highlights end up darker than midtones (checked: +0.23). A 400-lux room light for any length of time just blackens the sheet, which is also true. Use `diffuse` for Mackie lines.
- **Selenium** (1+9): cooler, purple-brown tint, Dmax +10%, about 2.5 min time constant. **Sepia**: a rehalogenating bleach (τ 25 s) to faint AgBr, then sulfide (τ 15 s) to brown Ag₂S. **Farmer's reducer** (ferricyanide + hypo, the same jar B as the cyanotype): subtractive about 0.25 D/min, which clears highlights first. Daub it with the `contact` mask.

### 4.11 Ageing (the joke, done honestly)
```
stain += 0.02·r·k + 0.05·ag·k        fade: D *= exp(−0.015·r·k)        k = years · 2^((T−20)/10) · RH/50
printout += PO_K · 3e-4 · displayLux·s · x                                 (unfixed halide goes lilac)
```
Logbook outputs from the demo: rinse-only RC "starts to yellow in about 17 years (residual hypo)"; a 30 s wash, about 45 years; a 4 g/L fixer, about 4 years (tired fixer); a 5 s fix, "about 5 months (unfixed halide)"; a 4 min wash, "a few thousand years". `sheet.yearsToDiscolour()` returns the number and the cause.

### 4.12 Film and plates
- **ISO placement.** `makeFilm` bisects development progress p and the curve offset so that net D = 0.10 at Hm = 0.8/ISO *and* ΔD = 0.80 over the next 1.3 log H (the ISO 6 condition). It then sets the rate constant so the stock's published time in the reference developer reaches exactly that p. Checked: NJ100/400/Ortho 25 land on 100/400/25.
- **Time-gamma.** γ(t) = γ∞·p(t) with γ∞ about 1.3-1.5 (pan) and 1.5 (ortho). Pushing raises mid-tones and highlights; the shadows barely move. The honest number `pushPull().shadowEI` says +2 stops buys about 0.28 stop of real shadow speed. The push/pull chart puts a tone 6 stops above the speed point back where it belongs: +1 → +24% time, +2 → +84% (data: Tri-X/D-76 style charts give roughly +25-40% and +60-90%; the design docs' "+40% / +60%" is a rule of thumb and can override).
- **Time/temperature.** 9.6 min at 20 °C in 1+1 and 3.1 min at 27 °C in stock. This matches the latent and studio docs' 9:30.
- **Grain.** σ_D = grain/1000 · √D_net · (48 µm / pixel µm) · (p/p_n)^0.7. It is anchored in film space with a two-octave hash, so it never swims, enlarges like a real enlarger, and coarsens with push.
- **Latent ageing (the Latent game's 24-year cold store).** Regression has a half-life of 30 years at 20 °C, doubling per 10 °C colder. Uniform fog exposure grows as (0.02 radiation + 0.01·2^((T−20)/10) thermal)·(ISO/100)·Hm per year, so fast film goes off first. Restrainers in the developer suppress that fog more than the image.
- **Spectral.** Ortho 25 renders red as black (red/green response 0.11 vs 0.76 for pan). The dry plate is blue-only with solarisation, giving the "black sun" of a burning lamp. `rgbToBands` is coarse but keeps the familiar filter effects (a red filter darkens a blue sky).
- **Printing.** `printMask(Callier Q)` gives 10^-(base + Q(D − base)): a diffuser head is Q = 1, a condenser about 1.3.

### 4.13 Cyanotype (stoichiometric)
```
coat:   fe3 = 2.2·a·2A/(A+B),  fcy = 1.0·a·2B/(A+B)          a = coats (classic 25% FAC at ~15% Fe : 10% K3Fe(CN)6 ≈ 2.2 : 1 molar)
UV:     d fe2 = Φ · I_uv · (1 − 10^(−A_tot)) · A_fe3/A_tot · (1 − 0.5·wet) · dt      A = 0.35 fe3 + 0.1 fcy + 0.25 pb + 0.15 pw
fast:   r1 = min(fe2, fcy):  pb += r1, fcy −= r1           (Prussian blue precipitates where it forms → prints out)
        r2 = min(fe2, pb):   pb −= r2, pw += r2            (excess Fe(II) reduces PB to Prussian white = bronzing)
wash:   fe3, fcy, fe2 leave with τ = 50 s/(0.35 + 0.65·flow) → yellow plumes (returned as yellowOut)
        pw → pb with τ 90 s (60 acid, 0.6 s H2O2), losing 35% (25%, 10%) to solution → reversal of overexposed shadows
        ox → 1 with τ 2 h water, 30 min mild acid, 4 min citric, 0.5 s H2O2 (the "blue pop")
        hydrolysis stain 0.00025·fe3·(pH − 5.5)/1.5 per s (a vinegar splash keeps highlights clean)
alkali: pb → Fe(OH)3 at 0.0008·(pH − 7.5)³ /s           (washing soda pH 11 bleaches in ~30 s; hard tap water slowly)
tannin: tea soaks into the paper (τ 90 s, beige base); Fe(OH)3 + tannin → iron tannate (brown); alkali darkens it to black;
        tannin on remaining pb shifts it toward aubergine
rest:   ox deepens with τ 8 h (overnight); light fades pb → pw, darkness regenerates it (the real reversible fading)
```
The classic recipe is ferricyanide-limited. Once about 45% of the iron is reduced, the extra Fe(II) reduces the blue it just made. That single fact gives the grey-olive "bronzing" printers use as the exposure-done signal, and the partial reversal of overexposed shadows after washing (checked: 45 min under the UV box makes the clearest step 0.23 *lighter* than the next). The A:B ratio, coat thickness (self-masking gives a long tonal scale and more Dmax for double coats) and the slow fog of mixed sensitizer all come from the same equations. Φ = 4.6e-5 was tuned so a 40 W/m² UV box solidly prints a clear area in about 12 min with no bronzing yet, and bronzes by 30 min (design doc: UV 8-15 min, sun 10-20 min, overcast up to 60). Clear sun in 12 min is about the same; overcast runs at about 0.53× the speed. The colour constants come from the art direction: Prussian #003153, cyan-mid #2E5C8A, sensitizer lemon to chartreuse. The tone recipes tested are tea → aubergine-black, soda → straw, soda → tea → brown, tea → soda → black-brown, and coffee.

### 4.14 Colour
All colorants are linear-RGB channel densities, combined by Beer-Lambert over the paper white plus the surface floor (§4.5), then sRGB-encoded through a 4096-entry LUT. Silver tints: neutral, warm-tone [0.88, 1, 1.12], exhausted-developer warmth [0.84, 1, 1.2], selenium, sepia, lilac print-out, yellow stain. `render(out, illum)` multiplies in linear light, so `SAFE_VIEW = [0.62, 0.27, 0.035]` shows the tray the way it looks under amber. The film light box shows the base tint, pink anti-halation dye until washed, milky unfixed halide, and pyro/coffee stain.

---

## 5. GPU path (de-risked)

`glsl.ts` holds `GLSL_LIB` (curve, devStep, reciprocity), `SILVER_DEVELOP_FRAG` (one dt of development, 3 MRT outputs) and `GLSL_SILVER_COLOR`. Texture packing:

```
uLatent  (Hh, Hs, H2h, H2s)       exposure pass
uTarget  (d1, d2, dcap, warm)     recompute pass after exposure (curve sums); develop pass updates dcap/warm
uDev     (p1, p2, c, tau)
uProc    (x, r, wet, cf)
uContact (contact)                from the tray heightfield
```
**Parity, measured in headless Chromium (SwiftShader, `EXT_color_buffer_float` present):**

| check | max error |
|---|---|
| curve | 4.8e-7 |
| devStep | 1.5e-7 |
| reciprocity | 1.8e-7 |
| develop pass p1 | 1.2e-7 |
| develop pass c | 2.4e-7 |
| develop pass cf | 1.9e-9 |

The develop pass took **1.2 ms at 256×320 and 4.8 ms at 512×640 on SwiftShader** (software, CPU), so a real GPU will be far below 1 ms (estimates in §6). `gpuParity()` reruns this on any device. Without `EXT_color_buffer_float`, pack into RGBA8 at half resolution, as the darkroom-toy doc already plans.

---

## 6. Performance

Machine: Ryzen 5 5600G (12 threads). It was **heavily contended**: about 50 node/chrome processes from parallel agents, CPU at 76-100%. Quiet-run figures first, contended ranges in brackets.

| operation (CPU, JS) | Node ns/px | Chromium ns/px | ms @ 256×320 | ms @ 512×640 |
|---|---|---|---|---|
| develop step (exact kinetics + exchange + fog) | 55 [80-360] | 73 [140-240] | 6 | 24 |
| expose (2 components + reciprocity, per call) | 220 | 114 [160-220] | 9 | 37 |
| recompute D∞ after exposure (lazy, once) | 240 | n/a | 20 | 79 |
| render to sRGB | 240 | 203 [430-1180] | 17 | 67 |
| cyanotype expose (8 s of UV, sub-stepped) | n/a | 57 [100-145] | 5 | 19 |
| cyanotype render | n/a | 165 [330-440] | 14 | 54 |

Whole pipelines in the browser (contended):

| pipeline | time | where it goes |
|---|---|---|
| silver at 320×256 | 0.7-1.6 s | shoot on film, develop the film 9.6 min, enlarge, 90 s in the tray at 1 s steps, fix, wash, dry |
| silver at 640×512 | about 7 s | 4.1 s of that is development at 0.5 s sub-steps |
| cyanotype at 640×512 | 1.4 s | |
| Film tab (7 rolls shot, developed and auto-printed at 240×192) | 7.5 s | |

Live development (develop + render per simulated second) ran at 20-50 ms at 320×256.

**Real-hardware estimates:**
- **Desktop GPU** (the GLSL develop pass is about 60 ALU ops and 48 bytes read/written per texel): under 0.1 ms per step at 512×640 on a 5600G-class iGPU.
- **Mid-range phone** (Adreno 6xx / Mali-G57) with RGBA16F: 0.3-1 ms per step at 256×320. It is bandwidth-bound at about 4 MB per step, so 60 Hz chemistry is comfortable.
- **Phone CPU fallback** (JS about 3-4× slower than desktop): develop plus render at 160×200 is about 10-15 ms per frame. Render at 30 Hz, or keep chemistry on the GPU.
- **Cyanotype** has fewer, smoother fields: CPU at 256×320 is fine on desktop. On phones, step exposure at 10 Hz (it is a minutes-long process) and render on change.

---

## 7. Quality knobs (mobile)

| knob | default | phone suggestion | effect |
|---|---|---|---|
| sheet resolution | 512×640 desktop | 256×320 GPU / 160×200 CPU | linear in cost |
| `MAX_STEP` (silver.ts) | 0.5 s | keep | sub-steps only while developer is live; 1 s is still within 1e-3 |
| `diffuse` | off | off | lateral exhaustion (+1 blur pass per step) |
| render rate | every frame | every 2nd frame during development | render is the costliest CPU op |
| field set | 24 fields | drop toning/ageing fields (se, bl, sf, stain, fade, ag) on GPU | 6 → 4 textures |
| film grain | on | on (cheap hash) | `densities(…, grain=false)` |
| cyanotype sub-step quantum | 0.02 of fe3 per sub-step | 0.05 | fewer sub-steps for long sun exposures |
| float targets | RGBA32F (parity) | RGBA16F | 16F is ample for p, c, D (all within 0..~4) |

---

## 8. Gotchas

- **`npm run check` is broken under TypeScript 7** (repo-wide, not this spike): the root `tsconfig.json` uses `baseUrl`, and TS 7 rejects it (TS5102 and TS5090 on `paths`). The fix is to drop `baseUrl` and use `"paths": { "@shared/*": ["./src/shared/*"] }`. The spike's own tsconfig is standalone for this reason.
- **Room light is brutal.** 400 lux on VC paper reaches visible fog in 0.4 ms. A Sabattier flash has to be dim (1-8 lux·s, e.g. `lightBands('roomLED', 1)` for 4 s) or the print just goes black. That is physically true, so give the game a dim "flash" lamp.
- **The enlarger is dim.** Easel illuminance is about 1.5 lux at f/8 for 35 mm → 8×10 (`enlargerLux`). Grade-2 prints come out at 10-20 s, as in real life. Don't feed 400 lux.
- **Light during development** goes to the second latent image. That is how Sabattier works, and it also means the safelight keeps fogging highlights while you rock the tray, as it should.
- **Call `sheet.enter(bath)` once per transfer** if you want carry-over: developer weakens the stop, fix on the tongs fogs the developer. `process` alone works without it.
- **`process()` with a huge dt** while developer is live sub-steps at 0.5 s. A 10-minute wash after development is still cheap, because sub-stepping stops once `c` has decayed.
- **Effective units differ by emulsion reference** (paper: tungsten; film: daylight). Use `actinic()`; don't mix raw band dot products across emulsions.
- **VC curve dog-leg** at soft and middle grades (§4.4). Physically motivated but exaggerated. Don't use the plotted curves as a contrast UI without smoothing.
- **Push/pull anchor.** `pushPull(…, anchorStops = 6)` is a design choice. The docs' "+40% per stop" rule is not self-consistent with "+60% for two stops", so pick one per game.
- **Safelight numbers depend on LIRF.** A naive "dose = lux × seconds" calculation will disagree with the model by 2-3× at safelight intensities. That is intended.
- **Save sizes.** About 1.8 MB (silver) and 1.3 MB (cyanotype) at 320×256 before gzip, about 0.6-0.8 MB gzipped. Base64 in localStorage works at this size but not at 512×640. Use IndexedDB plus `CompressionStream('gzip')` in the game. The demo's save/load guards every storage call.
- **Headless harness `clickText` is a case-insensitive substring match.** "Cyanotype" matched the page subtitle. Drive tabs with `window.__spike.show(id)` or `#hash`.
- **Node type stripping** needs `import type` for type-only imports and `.ts` extensions in import paths. Every core file follows both rules (`erasableSyntaxOnly` + `verbatimModuleSyntax` are on).

---

## 9. Recommendations for the real implementation

1. **Move `core/` to `src/shared/photochem/` unchanged.** Wire `selftest.ts` into CI (`node …/run-selftest.ts` needs no bundler and runs in under 0.1 s), so tuning one game cannot silently break another game's physics.
2. **Darkroom (game 2).** Run the paper fields on the GPU with `glsl.ts` and the packing in §5, feeding `uContact` from the tray heightfield. Keep `SilverSheet` as the reference, the low-res fallback, and the save/load format (GPU readback → `toBytes`). Exposure and recompute passes are straightforward ports of `deposit()` and `recompute()`; add them next. The cyanotype can stay on the CPU (minutes-long process, few fields) and upload a texture when it changes.
3. **Plates / Latent (games 3-4).** Use `FilmFrame` with `dryPlate` + `pyro` (Plates) and `varrow400` + `ageLatent(24, 4)` (Latent), then threshold `densities()` against each game's seeded grain field for the 1-bit look, so the dither *is* the emulsion. Pushed rolls 9-10: `pushPull(m, 2)`. Restrainer rescue: `makeDeveloper('pyro', { restrainerGL })`.
4. **Lensbench / Studio (games 5-6).** The capture stays linear (lux at the film plane): `FilmFrame.exposeRGB(rgbLux, shutter, filter)` → tank development → `printMask()` → `SilverSheet` or `autoPrint()` for contact sheets. Paper negatives in the oatmeal-can pinhole: `SilverSheet(paper('bromide')).exposeRGB(...)`. The `filmcan` format proposed in the docs can be `FilmFrame` fields plus stock id plus the processing log.
5. **Not modelled yet** (extension points):
   - colour negative/slide (C-41/E-6) and an IR band (add a sixth band; `Bands` is the only place to change)
   - spectral negatives: pyro stain and colour negatives printing differently on the two VC components (needs per-component masks in `expose`)
   - surge marks and bromide-drag *flow* (needs the tray velocity field as an input to `c` exchange)
   - fixer-only dichroic fog
   - colour of developer oxidation products on paper (only the liquid colour is modelled)
6. **Tuning surface.** Every "tuned" constant is a named export near the top of its module: `PHI`, `VC_*_CURVE`, `SURFACE_FLOOR`, `DEVELOPERS`, `SENSITIVITY`, `LIGHTS`. Change the emulsion shapes, then rerun `tools/calibrate.ts` and paste the table.

---

## 10. Sources and rationale

- ISO 6846 (black-and-white printing papers: ISO speed P and range R). ISO 6 (B&W camera negative film speed: 0.10 above base+fog, ΔD 0.80 over 1.30 log H). ISO 18917 (residual thiosulfate) for the idea of an archival wash target.
- Mees & James (eds.), *The Theory of the Photographic Process*: characteristic curves, Sheppard-Nietz development kinetics and time-gamma, Schwarzschild/Kron reciprocity, the Callier coefficient, the Sabattier effect and Mackie lines, latent-image regression.
- G. Haist, *Modern Photographic Processing*: development rate vs temperature and dilution, bromide restraint, fixing kinetics, silver-thiosulfate complex retention, washing.
- Ilford Multigrade technical information: two-emulsion VC principle, ISO R per filter, filters 00-3½ at equal exposure and 4-5 doubled, about grade 2 unfiltered, 902-type safelight guidance, Rapid Fixer and Multigrade developer capacities. Kodak time/temperature charts and D-76 dilution data. The design docs' own darkroom numbers (`docs/design/concepts/darkroom-craft.md`, `darkroom-toy.md`, `lensbench-craft.md`, `studio-craft.md`, `latent-craft.md`, `plates-craft.md`).
- Ctein, *Post Exposure*: VC paper behaviour, split-grade printing, dry-down, print permanence.
- Mike Ware, *Cyanotype: the history, science and art of photographic printing in Prussian blue* (Science Museum): classic Herschel recipe, the ferricyanide-limited stoichiometry, Prussian white and bronzing, solarisation-like reversal, peroxide oxidation, reversible light fading.
- Christopher James, *The Book of Alternative Photographic Processes*: cyanotype toning (washing soda bleach, tea and tannin, re-darkening in alkali), coating and exposure practice.
- CIE 1924 photopic luminous efficiency V(λ) for the band-to-lux conversion. Planck's law for the tungsten and daylight shapes.

Numbers marked "data" above are typical published values, from memory of the sources above; numbers marked "tuned" were fitted so the self-test reproduces the documented behaviour. The self-test (`selftest.ts`) is the executable statement of every claim in this file.
