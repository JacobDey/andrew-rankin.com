# Lens Bench: concept through the TACTILE PHYSICS TOY lens

**Proposed title:** **Circle of Confusion**
**Subtitle:** *loose glass, real light, one backyard*
(Alternates: "Loose Glass", "Ground Glass". Slug stays `lensbench`.)

**One-line pitch:** an optics workbench where lenses are glass pucks you slide, squeeze and flick. A fog-filled light box shows every ray bending in real time, the image forms live on a ground-glass screen, and when you carry the result into a backyard full of spinning, splashing, glowing "phenomenon machines", every photo is computed from the glass you actually built.

**Design rule for this lens:** there are no sliders for physics. Focal length is never a number you type. It *falls out of* where you put the glass and how fat you squeezed it. Every spec on the camera's spec plate is derived from a physical act, and the photo inherits every flaw you built in, on purpose or not.

---

## 1. Four places, one continuous object

The camera is one persistent object that travels with you. The navigation is a strip of four tabs drawn as places, not menus:

1. **The Bench.** A walnut optical rail inside a glass "fog tank". A comb of 15 laser rays (toggle to white light) enters from the left and lights a vertical sheet of haze, so the 2D meridional ray trace is drawn *in the 3D scene* as glowing lines in smoke, the way a real optics teaching lab looks. Glass pucks sit in a felt tray below. At the right end of the rail stands a **ground-glass screen** showing the live image from the backyard, upside down and mirrored, as on a real view camera.
2. **The Body.** The same rail, but now you snap on a body: a format gate, a shutter, a film back, a grip or a tripod collar. Center-of-mass marker, live mass readout. A badly balanced camera **tips over on the bench** (Rapier rigid body, thunk, a sad wobble).
3. **The Yard.** A small golden-hour backyard (section 6) where you hand-hold or tripod the camera you built.
4. **The Tank & Loupe.** A daylight developing tank you invert by hand, then a light table and contact sheet you sweep a loupe across.

## 2. The 10-second / 1-minute / 10-minute fun

**10 seconds: poke a hole in the dark.** The page opens on a closed wooden box in a dim room, with a square of daylight leaking under a door. One affordance pulses: a cardboard patch on the box's front. Tap it and a needle pokes a hole. The back of the box (a ground-glass rectangle facing you) fills with a faint, *upside-down* image of the backyard: the pinwheel spinning, the sheets moving. Tap again and the hole gets bigger: brighter but blurrier (the pinhole equation, live). Then the felt tray slides in with one glass puck. Drag it over the hole and it **snaps** in with a glassy *tock*: the image goes bright and sharp. You just invented the camera. Nobody reads a word.

**1 minute: break it beautifully.** Slide the puck along the rail and watch the focus point sweep across the fog sheet while the ground glass blurs and sharpens. Grab the puck's rim and **squeeze it fatter**: rays bend harder and the focal point leaps toward you. Flip on white light and a rainbow fringe opens at the focus (chromatic aberration you can *see* in smoke). Drop a second, flint puck behind it and the rainbow collapses back to white with a satisfying "chord resolve" sound. You've built an achromat. Pinch the iris shut and the fog cone narrows. Tap the shutter: the contact sheet spits out a first frame with real vignetting and a soft glow.

**10 minutes: build a weird camera and go hunting.** Assemble a 3-element lens. Draw a **heart-shaped aperture** with your finger. Choose a cloth focal-plane shutter and ISO 400. Carry it to the Yard at dusk. Shoot the string lights (heart bokeh), the box fan (rolling-shutter bent blades), the sprinkler at 1/1000 (frozen beads) versus 1/15 (silk), and fireflies on a tripod at 8 s. Advance the film with a thumb swipe. Forget to advance once and get a ghostly double exposure. Then invert the tank, sweep the loupe over the grain, and export a spec card. Along the way the **Field Notebook** stamps each phenomenon you caught (section 8).

## 3. Interaction catalog and input mapping

| Action | Mouse / keyboard | Touch | Feel |
|---|---|---|---|
| Slide element on rail | drag puck | 1-finger drag | felt friction; clink on collision |
| Fine slide (x0.1) | Shift + drag | 2-finger drag | rail ticks every 1 mm |
| Squeeze / bulge a surface | drag either rim handle up/down | drag rim handle | glass "creak" whose pitch rises with curvature |
| Flip element | double-click | double-tap | 180 degree spin animation, *whoosh* |
| Change glass type | right-click → glass swatches | long-press | puck re-tints: crown clear, flint faintly yellow, lanthanum faintly brown |
| Flick glass (it rings) | click face | tap face | inharmonic ping (section 4.8) |
| Fingerprint the glass | hold on face 1 s | hold 1 s | a whorl smudge appears |
| Wipe it | scrub back and forth fast | scrub | cloth swish; smudge fades per stroke |
| Breathe on it | hold B | hold breath button | fog film evaporates over 4 s |
| Focus | wheel over barrel, or drag barrel sideways | horizontal drag on barrel | helicoid visibly extends; detent at infinity |
| Aperture | wheel over iris | pinch on iris | blades *shhk*; click-stops at full stops |
| Draw aperture | "pencil" on iris, draw a closed stroke | finger draw | stroke snaps closed, cuts into black card |
| Shutter speed | drag dial | rotate drag | detent tick + 8 ms vibrate per stop |
| Half-press (meter) | hold mouse on release | touch-and-hold release | meter needle swings with spring overshoot |
| Fire | release mouse | lift finger | shutter sound timed to real exposure |
| Bulb / lens-cap exposure | hold Space for the duration | hold release | duration = hold time |
| Advance film | drag lever right→left, or F | thumb swipe on lever | ratchet clicks, frame counter rolls |
| Double exposure | Alt + fire without advancing | 2-finger tap on release | warning lamp, accepted |
| Dark cloth (full-screen ground glass) | C | swipe down from top | cloth drapes, screen edges go black |
| Yard walk / look | WASD + mouse drag | left thumb stick + right drag | camera bob scales with camera mass |
| Hold breath (steady) | hold Shift | hold 2nd finger | tremor drops 60% for 3 s, then rises (section 4.5) |
| Throw ball / push swing | click on object | flick on object | Rapier impulse = flick velocity |

Every drag uses a critically damped spring follower (`x += (target - x) * (1 - exp(-dt * 18))`), so pucks have mass and lag a hair behind your finger. Collisions between pucks are rigid (elements can't overlap), with a clink scaled by closing speed.

## 4. Physics models

### 4.1 Glass

Each element: clear diameter D, front/back curvatures c1, c2 (c = 1/R), center thickness t, glass (n_d, V_d, density rho). The glass palette uses generic names: Crown (1.517, 64.2, 2.5 g/cc), Light Flint (1.581, 40.8, 3.2), Flint (1.620, 36.4, 3.6), Dense Flint (1.717, 29.5, 4.5), Lanthanum Crown (1.713, 53.8, 3.9), Fluorite-ish (1.434, 94.9, 3.2). Dispersion uses Cauchy fitted to the Abbe number:

`B = (n_d - 1) / (V_d * (1/lF^2 - 1/lC^2))`, `A = n_d - B/ld^2`, `n(l) = A + B/l^2`, with lF = 0.4861, ld = 0.5876, lC = 0.6563 um.

The rim handles drive c1 and c2 directly. Edge thickness `t_e = t - sag(c1) + sag(c2)` must stay ≥ 0.5 mm. When it would go negative the puck refuses to squeeze further and *creaks* (the edge goes knife-sharp and glints).

### 4.2 The trace (CPU, every pointer move)

Sequential exact meridional trace through spherical surfaces: intersect the ray with the sphere, then apply vector Snell, `t = eta*i + (eta*cos_i - sqrt(1 - eta^2*(1 - cos_i^2))) * n`. If the radicand goes negative, total internal reflection kills the ray, and in the fog it flashes red and reflects. Rays: 15 in the drawn fan × 3 wavelengths (656/588/486 nm) for the display, plus an off-screen analysis set. Cost: under 0.2 ms.

The paraxial `y-nu` trace (`n'u' = nu - y*phi`, `phi = c(n' - n)`, `y_next = y + t*u'`) gives EFL, back focal distance, and entrance/exit pupil positions. **Petzval sum** `P = sum(phi_i / (n_i * n'_i))`.

### 4.3 Lens Profile: the contract between the bench and the photo

Whenever the design settles (no drag for 150 ms), the analysis trace builds this struct. Everything downstream reads only this:

```ts
interface LensProfile {
  efl: number; bfd: number;              // mm
  fNumber: number; tStop: number;        // tStop includes surface losses
  pupilMask: Float32Array;               // 64x64 aperture shape (drawn or bladed)
  distortion: [number, number];          // k1, k2 fitted from chief-ray heights at 0..1 field
  lateralCA: [number, number, number];   // per-channel image scale (R,G,B)
  longCA: [number, number, number];      // per-channel focus shift, mm
  sphericalHalo: number;                 // marginal-paraxial focus gap → glow radius
  fieldCurvature: number;                // from Petzval; drives swirl
  vignette: Float32Array;                // 16 samples: fraction of pupil rays surviving vs field
  catsEye: Float32Array;                 // 16 samples: pupil clip offset vs field (cat's-eye bokeh)
  ghosts: { pos: number; size: number; tint: [number,number,number]; amp: number }[];
  massGrams: number; lengthMm: number;
  smudge: Float32Array | null;           // 32x32 haze mask from fingerprints/breath
}
```

- **Vignetting** is not `cos^4` alone. It is `cos^4(theta)` × the fraction of a 12×12 pupil ray grid that survives every element's clear aperture at that field angle. A long lens with small rear elements *naturally* vignettes and gives **cat's-eye bokeh** at the corners, because the pupil shape clip is stored per field position.
- **Swirl:** a strong Petzval sum plus a tangential/sagittal astigmatic split stretches each bokeh kernel tangentially as a function of radius: `stretch(r) = 1 + k_swirl * r^2 * |P|`. Build a fat single-element portrait lens wide open and the background swirls. This is the most shareable accident in the game.
- **Ghosts:** for every pair of surfaces (i, j), a ghost sits on the line through the sun's image and frame center at `pos = m_ij` (from a 2-bounce paraxial trace), with amplitude `R_i * R_j` where `R = 0.04` uncoated and `0.004` coated (a coat-it button turns the puck faintly purple-green). Six elements, uncoated: 66 ghosts, and the sun shot becomes a cathedral of rings. You *see* the cost of complexity.
- **T-stop:** `T = N / sqrt(prod(1 - R_s))` over all air-glass surfaces. For a drawn aperture, `N_eff = efl / sqrt(4A/pi)` where A is the mask area. Your heart has a real f-number, printed on the spec plate (`f/3.7♥`).

### 4.4 Exposure and film

The scene renders linear HDR radiance, calibrated so a sunlit 18% card reads EV 15 at ISO 100 ("sunny 16" holds). Film-plane illuminance is `E = K * L * cos^4(theta) * V(theta) / T^2`. Exposure is `H = E * t_eff`, with reciprocity failure `t_eff = t^0.8` for t > 1 s (firefly exposures come out darker than the meter promised, as on real film).

Characteristic curve (logistic H&D) in `x = log10(H * ISO / H_ref)`:
`D(x) = Dmin + (Dmax - Dmin) / (1 + exp(-4*gamma*(x - x0) / (Dmax - Dmin)))`, with gamma = 0.65 (normal development), Dmin = 0.15, Dmax = 2.4. The negative is stored as density, the print as `10^-D` inverted through a paper curve. **Halation:** highlights above D = 1.8 get a wide 24 px blur added back into red only, a toggle on the film box labeled "no backing layer".

**Grain:** clumped multi-octave noise in density space, `sigma_D = G(ISO) * sqrt(D) / sqrt(pixelArea_um2)`, with G doubling every two stops of ISO. Under the loupe at ISO 1600 it looks like sand. At ISO 25 it looks like nothing at all.

### 4.5 The camera as a body in a hand

Mass comes from the build: each element weighs `rho * V`, with V from the cylinder plus spherical caps (`V_cap = pi*h^2*(3R - h)/3`, `h = sag`). Barrels weigh 1.2 g per mm of length per 10 mm of diameter (brass). Bodies weigh 180 to 900 g. The moment of inertia about the grip is `I = I_body + sum(m_i * r_i^2)`.

Handheld pitch/yaw are each a damped oscillator:
`I * theta'' = -k * theta - c * theta' + tau_tremor(t) + tau_breath(t) + J * delta(t - t_slap)`
with k = 1.6 N·m/rad, c = 0.06 N·m·s/rad, tau_tremor = band-passed noise (8-12 Hz, 0.003 N·m RMS), tau_breath = a 0.25 Hz sine. Holding your breath drops the tremor 60% for 3 s, then raises it 40% (gasping). A reflex body adds **mirror slap** (J = 0.0015 N·m·s, 8 ms before the shutter opens). A "lock mirror" lever removes it.

Image smear on film is `efl * delta_theta` over the open window, so the **1/focal-length rule emerges on its own**: a 600 mm lens shakes like a flagpole, a heavy body steadies a short lens, and the tripod (k → large) kills tremor but keeps the mirror slap and wind. The yard view bobs with the same simulated theta, so you *feel* the heavy lens before you shoot.

**Tipping on the bench:** if the combined center of mass is more than 15 mm ahead of the body's foot and there's no tripod collar, the assembly tips nose-down (Rapier, about 0.4 s), with a thunk and a skittering element.

### 4.6 Shutters (time is a spatial dimension)

| Type | Model | Signature |
|---|---|---|
| Leaf | global; blades open/close in 1.5 ms ramps; at 1/500 the blades never fully open, so the effective aperture shrinks | tiny *tick* |
| Cloth focal-plane | horizontal slit, curtain travel T_c = 12 ms; column x opens at `T_c*x/W` for t | *clack…clack*, two sounds separated by the real exposure |
| Metal focal-plane | vertical, T_c = 3.6 ms | sharp *tchk* |
| Slit-scan back | vertical slit, T_c user-set from 0.05 to 8 s | a motor whir for the whole sweep: people stretch, the swing smears into ribbons |
| Lens cap | no shutter; your hold time; a 90 ms ramp each end | the "pop" of a cap |

Rendering: K subframes at times tau_k across `T_c + t`. Each pixel accumulates the weight `|[tau_k, tau_k + dtau] ∩ [t0(x,y), t0(x,y) + t]|`, with K = clamp(ceil((T_c + t) / dt_motion), 4, 48) (8 on phones). Then the image is **flipped as film is**: curtains move "up" across the final print, so rolling-shutter skew leans the correct way.

The photo render is time-sliced across animation frames, and it is never instant. A minimum of 400 ms is shown as the shutter "still open" (a red lamp on the body), so the computation *is* the exposure.

### 4.7 Burning glass (the irresistible misuse)

In the Yard, any loose element can be pulled out and held as a magnifier. The sun's image diameter is `efl * 0.0093`. Concentration is `C = (D / (efl * 0.0093))^2 * T`, and the leaf temperature integrates `dT/dt = (a*C*S - h*(T - T_amb)) / c_A` with S = 1000 W/m², ignition at 230 °C. You get a growing char decal, a glowing rim, curling smoke particles, and a crackle. The bench lamp never works: "only the sun is bright enough". **Sun-burnt curtain:** point a cloth-shutter camera at the sun with the lens on for more than 3 s without firing, and a smoke wisp curls out of the body. Every later frame then has a **light-leak pinhole flare** until you replace the curtain in the Body room. This really happens to rangefinders, and it is the best kind of consequence.

### 4.8 Glass ping

Flexural first mode of a free disc: `f ∝ (t / (D/2)^2) * sqrt(E / rho)`. Real lenses ring ultrasonic, so the tooltip says "pitch-shifted down three octaves so you can hear it". Synthesis: three sine partials at ratios 1 : 1.73 : 2.33 with exponential decays of 1.2 s, 0.6 s and 0.3 s, plus a 2 ms noise click. Fat flint rings low and dull. A thin crown meniscus rings like a wine glass. People *will* flick every puck.

### 4.9 Smudge and breath

A fingerprint writes a whorl into the 32×32 smudge mask at the touch point in element coordinates. The photo adds veiling glare: `img += alpha * blur(img, 40px) * smudgeDirectional`, streaked along the last wipe direction. Breath sets `haze = h0 * exp(-t / 4 s)`, with sparkle on point lights: the classic soft-focus portrait trick, discoverable with no hint.

### 4.10 Development (a 30-second ritual, not a second game)

Wind the film onto the reel: a drag, auto-assisted. Pour developer with the pitcher-tilt gesture. The timer starts. The density gain follows `D(t) = D_inf(x) * (1 - exp(-t/tau))`, `tau = 6 min * 2^(-(Temp - 20)/6)`. Every 30 s the tank lamp blinks: flick up/down to invert it (optional DeviceMotion "shake the phone" once permission is granted). Skip agitation and you get **bromide drag**: density deficits streak downstream of dense areas in the direction the tank sat. Push or pull = leave it longer or shorter, which scales gamma ×1.25 or ×0.8. Fix, rinse, and the strip unrolls onto the light table. The negative can be sent to `/games/darkroom/` through shared IndexedDB (`arc.negatives`) for printing there.

## 5. Rendering pipeline

**Live ground glass** (every frame): scene at 512 px (384 on phones), a DoF gather with 12 taps inside `pupilMask`, distortion and lateral CA as a UV remap, vignette, no subframes, no grain. Upside down and mirrored until you flip the loupe.

**Photo:** scene at up to 1600 px into an RGBA16F target. K subframes. Per-pixel CoC from depth: `c = (efl^2 / N) * |s - s_f| / (s * (s_f - efl))`, converted to pixels by format width. Per-channel focus via longCA. The 48-tap Poisson gather samples *through the pupilMask texture*, rotated and stretched by catsEye/swirl at that field position. Then the spherical-halo glow, ghosts, smudge veil, film curve, halation and grain. Everything after the scene render is a stack of fullscreen passes, testable under SwiftShader at 512 px.

**Formats** are physical gates: half-frame 18×24, 35 mm 24×36, square 56×56, 4×5 in. A bigger gate means a bigger body on the bench, shallower DoF at the same framing, and longer lenses needed. A 4×5 gets a draggable bellows and a **front standard you can tilt** (Scheimpflug: the focal plane hinges, and you can get a tilt-shift miniature of the yard).

## 6. The Yard: every prop is a phenomenon machine

A 30 m lot, low-poly, painterly, with a draggable sun (drag it across the sky to set the time of day from noon to night).

| Prop | Physics | Teaches |
|---|---|---|
| Box fan on a post, speed knob, "blow" by holding on it | omega up to 40 rad/s | rolling-shutter bent blades, motion blur |
| Oscillating sprinkler | 600 particle droplets, ballistic | freeze vs silk |
| Pergola string lights (40 bulbs) | point emitters, HDR 2000× | bokeh shape, cat's-eye, swirl |
| Swing with a stuffed bear, push to swing | `theta'' = -(g/L) sin(theta) - b*theta'` | panning, slit-scan smears |
| Rubber ball (throw it) | Rapier, restitution 0.8 | freeze a bounce at the apex |
| Clothesline sheets | Verlet cloth 12×16 | soft motion |
| Picket fence + brick shed wall | straight lines | barrel/pincushion distortion |
| Star-chart target pinned to the shed | radial spokes | resolution, spherical glow (inspect with the loupe) |
| **Rusty mailbox** | (a nod to Texture-dle) | texture, macro focus at minimum distance |
| Fireflies (dusk and later) | wander noise, 0.5 Hz blink | long exposure, reciprocity |
| Sun | disc 0.53°, HDR 50000× | ghosts, burning glass, curtain burn |

## 7. Juice catalog

- **Sound** (all WebAudio): shutter = filtered noise bursts plus a body resonance (bandpass at 180 Hz for the body, at 900 Hz for leaf). The two curtain clacks are scheduled at the *real* start and end times, so 1/2 s sounds like *clack … clack*. Film advance = 6 ratchet clicks plus a sprocket purr. Iris = a granular *shhk*. Rail = a felt rub whose loudness tracks velocity. Squeeze creak = a resonant filter sweep. Achromat "resolve" = a two-note chord that goes consonant when the longitudinal CA spread < 0.05 mm.
- **Visual:** the fog sheet brightens where rays converge (additive blending), so focus *looks hot*. A caustic spot from the bench lamp crawls across the felt as you move glass. The meter needle is a spring (`zeta = 0.35`, overshoot). The frame counter is a rolling drum. The contact sheet pops out of the body with a paper flutter. The spec plate stamps each new value with a tiny embossing animation.
- **Haptics:** `navigator.vibrate(8)` per detent, 20 ms on fire, a long rumble for slit-scan.

## 8. The Field Notebook (soft goals)

Twelve stamps, each auto-detected from photo metadata (the photo stores the scene state, LensProfile and shutter timing): pinhole image, bokeh shape (non-circular aperture, point lights out of focus), cat's-eye corners, swirl, bent fan blades (fan in frame and `omega * T_c > 0.6 rad`), slit-scan stretch, frozen droplets (`t < 1/1000`), firefly trails, sun ghosts (≥ 6), burn mark, double exposure, breath haze. Each stamp's notebook page shows *your* photo next to the ray diagram that caused it. That's the stealth physics lesson.

## 9. Saves and sharing

- Camera designs live in localStorage (small JSON). Negatives go to IndexedDB as 8-bit density PNG blobs plus a metadata JSON.
- **URL-hash camera** (`#cam=<base64url JSON>`, under 600 chars): send a friend your heart-aperture swirl lens and they open it on their own bench. This is the main viral loop on static hosting.
- **Spec card export:** a 1200×1500 PNG with the photo, the lens cross-section drawn as in the fog tank, and the spec plate (`52.4 mm f/2.8 · 3 elements · cloth FP 1/125 · ISO 400 · 742 g`).
- Preset recipes, all named generically: Box Meniscus, Achromat, Triplet, Swirl Portrait (Petzval-type), Symmetric Six (double-Gauss type), Long Tele, and Pinhole.

## 10. Build notes for the team

**Test API:** `window.__game = { ready, state(), place('bench'|'body'|'yard'|'tank'), loadPreset(name), setLens(spec), setBody({format, shutter, speed, iso}), setAperture(nOrMask), focus(mm), aim({pos, target}), setSunTime(h), fire({seed}) → Promise<PhotoMeta>, develop({minutes, agitate}), photos(), profile() }`. Every random draw (tremor, grain, sprinkler) is seeded per shot, so Playwright screenshots are deterministic.

**Perf tiers:** with no WebGL2, the bench still works (ray trace drawn on a 2D canvas), the ground glass shows a static pre-render, and photos are shot at 512 px with K = 4. The Rapier load is lazy and only happens when the Body or Yard opens.

**Split for 2-4 agents:**
- (A) the optics core: `trace.ts`, `profile.ts`, glass, presets, and unit tests against known EFLs.
- (B) the photo pipeline: the post passes, subframe shutter, film, grain.
- (C) the Bench and Body interactions, the fog-tank visuals and all WebAudio.
- (D) the Yard props, the tank, the contact sheet, the notebook and sharing.

**MVP cut line:** the pinhole open, a bench with ≤ 4 elements, LensProfile, the live ground glass, leaf + cloth focal-plane shutters, the Yard with the fan, the string lights and the sprinkler, film, grain, the contact sheet, the URL share. Stretch: slit-scan, burning glass, curtain burn, tank chemistry, bellows tilt, ghosts, smudge.
