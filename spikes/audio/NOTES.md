# Spike: procedural audio kit (`spikes/audio/`)

A WebAudio synth engine plus a library of **69 synthesized sounds** (48 one-shots, 21 continuous loops) covering all six games. There are no samples. The demo page has a card per sound, with parameter sliders, an offline-rendered spectrogram and level stats. It also has a live scope, six composed scenes, a drag pad for the continuous sounds (mouse and touch) and a CPU benchmark.

Page: http://127.0.0.1:5173/spikes/audio/ (add `?nothumbs` to skip the offline thumbnail renders).

```
core/                 ← lift this folder to src/shared/audio/ almost as-is
  index.ts            public entry: `Audio` singleton (all sounds registered), art-direction compat layer
  engine.ts           AudioEngine: shared context, buses, prefs, iOS unlock, voices, loops, heartbeat
  synth.ts            Synth helpers (noise, envelopes, burst/tone/modal), GrainStream, k-rate biquads
  types.ts            SoundDef / LoopHandle / Voice / options types
  analysis.ts         offline render, level and spectrogram analysis, scene benchmark (dev/test only)
  sounds/             packs: ui, liquid(+paper), darkroom, camera, surface, ambience, police, sea
main.ts, scenes.ts, index.html, demo.css   ← the demo page only
tsconfig.json         standalone strict config for this spike (see the TS 7 gotcha below)
```

## API

```ts
import { Audio, getAudio, sound, uiSound } from '@shared/audio'   // = spikes/audio/core

Audio.arm(opts?)        // call once at startup: the first pointer/touch/key gesture creates and unlocks the context
Audio.init(opts?): Promise<boolean>  // or call this inside your own gesture handler (idempotent)
Audio.configure({ quality: 'auto'|'low'|'high', session: 'ambient'|'playback', latencyHint, suspendWhenHidden })
Audio.ready / Audio.context / Audio.now() / Audio.onReady(cb)

// one-shots: params override defaults. Reserved keys: gain (linear), pan (-1..1), when (s from now), detune (cents)
Audio.play(id: string, params?: Params): Voice | null      // null if locked, muted, rate-limited or the id is unknown
  voice.end / voice.stop(fade?)

// loops: a handle comes back immediately, even before unlock (the loop starts once audio unlocks)
const h = Audio.loop(id: string, params?: Params, { volume?, fadeIn? }?): LoopHandle
  h.set(name, value)   // calling it every frame is fine: coalesced to ~80 Hz and smoothed by the recipe
  h.setMany({...}); h.get(name)   // param value, or a live readout: yard.wind 'gust', sea.waves 'swell', timer.clock 'beat'
  h.volume(v, ramp?); h.stop(fade = 0.25); h.playing; h.stopped
Audio.stopAll(fade?)

// prefs (persisted to localStorage 'ar:sound' = on|off and 'ar:volume' = 0..1; event 'ar:soundchange'; syncs across tabs)
Audio.muted / Audio.setMuted(b) / Audio.volume / Audio.setVolume(v) / Audio.onChange(cb)

// global
Audio.setQuality('low'|'high'); Audio.setMuffle(hz)  // 600 = head under the dark cloth (world buses only, not UI)
Audio.setRoom({ rt60, wet } | null)                  // generated small-room convolver; skipped on low quality
Audio.duck('amb', -12, 0.02, 0.4, 0.3)               // e.g. the radio ducking under a shutter
Audio.bus('ui'|'sfx'|'amb'); Audio.getAudio(); Audio.analyser(); Audio.stats()
Audio.register(defs); Audio.def(id); Audio.list()

// docs/design/art-direction.md §10.1 compatibility
getAudio() → { ctx, master, ui } | null;  sound.muted / sound.setMuted / sound.onChange;  uiSound('tick', { gain, detune })
```

Graph: `ui (0.55) → master (volume × !muted, 60 ms ramp) → compressor (-18 dB, knee 12, 4:1, 3 ms/150 ms) → out`. World audio runs `sfx, amb → world → muffle low-pass (k-rate) → master`, with an optional `world → send → convolver → muffle` reverb. This follows art direction §10.1 and the 10 palette recipes in §10.2 (`ui.tick`, `ui.shutter`, `ui.advance`, `ui.switch`, `ui.paper`, `ui.paperOut`, `ui.canister`, `ui.bell`, `ui.thunk`, `ui.develop`), with `ui.hover` and `ui.click` added. One-shots randomize pitch by ±3–4% and gain by ±1.5 dB per play.

### Writing a recipe

```ts
const thing: OneShotDef = { kind: 'oneshot', id: 'x.thing', label, group, games, params: { force: { min: 0, max: 1, default: 0.6 } },
  maxVoices?, minInterval?, vary?, bus?,
  play(s: Synth, out: AudioNode, t: number, p: Params): number /* time when silent */ }
const bed: LoopDef = { kind: 'loop', ..., preview?: { dur, auto(t, d) => Params },
  start(s, out, t, p): LoopVoice /* { set(name, v, t), tick?(from, to), read?(name, now), stop?(t) } */ }
```

- `Synth` helpers: `burst` (filtered noise), `tone` (oscillator with glide), `modal` (inharmonic partials), `perc`, `ahr`, `shape`, `noise`, `osc`, `filter` (k-rate automatically), `gain`, `panner`, `buffer`, `play`, `stream` and `gate`.
- `GrainStream` (`s.stream(src, out)`) renders Poisson or regular grains into one gain curve, using `setValueCurveAtTime` in 40 ms chunks. Hundreds of clicks per second cost one gain node. It drives crackle, ratchets, bumps, crickets and the Geiger counter. Feed it noise for crackle or an oscillator for chirps, and set `rate`, `amp`, `ampVar`, `decay`, `regular`, or a custom `shape`.
- `s.gate(src, out, t, dur, write)` is the one-shot version: write a whole envelope in JS and apply it with one curve (used by the printer head and the creaks).
- Every source created in `start()` is tracked, then stopped and disconnected by the engine on `stop()`. Sources a loop creates in `tick()` must end by themselves.
- The heartbeat is a 25 ms `setInterval` with a 120 ms look-ahead. It runs only while something is sounding and also reaps finished voices.

## The catalogue (ids)

- **UI (12):** `ui.tick` `ui.hover` `ui.click` `ui.shutter` `ui.advance` `ui.switch` `ui.paper` `ui.paperOut` `ui.canister` `ui.bell` `ui.thunk` `ui.develop`
- **Liquid and paper:**
  - loops: `liquid.slosh` (energy, depth, size, laps, pan), `liquid.pour` (flow, fill, glug)
  - one-shots: `liquid.lap`, `liquid.drip` (Minnaert size, liquid or bench), `paper.flop` (wet, size, force), `paper.peel` (dur, wet), `paper.crinkle`
- **Darkroom:**
  - loops: `timer.clock` (rate, pitch; a pocket watch is rate 4–5 with pitch 1.6), `enlarger.hum` (lamp, fan, 50/60 Hz mains), `safelight.buzz` (level, buzz)
  - one-shots: `timer.tick`, `timer.beep`, `timer.bell` (f, strikes, decay), `timer.wind`, `enlarger.switch`, `safelight.chain`, `roomlight.start`
- **Camera:**
  - shutters: `shutter.leaf` and `shutter.focal` (cloth or metal curtain, SLR mirror). Both take the exposure **in seconds**: the two clicks are separated by the real exposure, and the slow-speed escapement buzzes from 1/8 s.
  - film: `film.advance` (clicks, stroke), `film.click` (one detent for drag-driven levers), the `film.rewind` loop (speed, slack), `film.leaderSnap`
  - lens and body loops: `bellows` (signed dV/dt), `focus.ring` (velocity, grease)
  - other one-shots: `aperture.detent`, `selftimer`, `flash.charge`, `flash.pop`
  - `geiger` loop (rate)
- **Surface and touch:**
  - `impact` (glass, steel, wood, enamel, ceramic, tin, cloth × force × size)
  - `marble.clack` (velocity × surface)
  - `marble.roll` loop (speed, roughness, hardness, hollow, contact). Hollow adds the tin-mailbox resonance, and a spin wobble tracks speed.
  - `cloth.rustle` loop (speed, roughness: fine microfibre to rough burlap)
- **Ambience loops:**
  - `room.tone` (air, mains hum, HVAC rumble, fan)
  - `yard.wind` (strength, gustiness; `get('gust')`)
  - `yard.birds` (four made-up FM species), `yard.sprinkler` (impact sprinkler with return ratchet)
  - `yard.crickets` (Dolbear's law from °F), `yard.cicadas`, `yard.chimes` (feed it the wind's gust)
- **Precinct (1990s):**
  - keys: `kbd.key` (buckling spring, up and heavy variants), `typewriter.key`, `typewriter.bell`, `typewriter.return`
  - terminal and hardware: `terminal.beep` (ok, error, alert), `terminal.seek`, `crt.degauss`, the `crt.whine` loop (15,734 Hz, off on low quality), `printer.dotmatrix`
  - `radio.chatter` (squelch, formant babble, hard-cut tail)
- **Sea and wood:**
  - loops: `sea.waves` (swell, distance; `get('swell')`), `ship.hull` (self-playing creaks and groans)
  - one-shots: `sea.wavehit`, `ship.creak` (tension, dur, size; also hinges, the swing rope and the furnace hatch), `bell.fog`, `glass.chord` (12 glass-harmonica chords, one per plate)

How to drive the continuous sounds from a simulation:
- **Slosh:** set `energy` to the RMS surface velocity or √KE (0..1). Set `laps: 0`, then fire `liquid.lap` with `{ intensity, pan }` on each real wall hit.
- **Marble:** set `speed` to |v|/vmax. Set `roughness` to the local heightfield gradient variance under the contact. Set `contact` to 0 while airborne. Fire `marble.clack` on impacts above a threshold.
- **Cloth and bellows:** set `speed` and `rate` from the drag speed and the volume change rate.
- **Other parameters:** set `pan` from screen x. Sync visuals with `get('gust')` and `get('swell')`.

## Verification (headless, SwiftShader box shared with 3+ other browsers)

- **Offline render:** all 69 sounds render with no NaN, no clipping and no errors, in **2.7–3.0 s total** including the FFT spectrograms (`__spike.results()`). Levels at default params after balancing:
  - one-shots peak at −6 to −30 dBFS (the UI palette sits at its spec'd quiet levels)
  - loops sit at −13 to −35 dBFS RMS
  - outliers are deliberate: `crt.whine` at −48 dB, `safelight.buzz` faint
- **Live smoke test (realtime AudioContext at 48 kHz; base latency 10 ms, output 40 ms):**
  - every one-shot played: 48/48, none dropped
  - every loop started, had all its params set, and stopped: 21/21
  - zero console errors
  - the scope shows output (Backyard, noon at −19 dBFS; Darkroom at −21 dBFS)
- **Mobile touch run:**
  - a `loop()` handle created before unlock started after a touch `tap`
  - mute wrote `ar:sound=off` and **suspended the context**; unmute resumed it
  - volume persisted
- **Main-thread cost:**
  - `play()` averages **0.54 ms**; the worst are `sea.wavehit` at 2.1 ms and `film.advance` at 1.5 ms. The timer resolution is 0.1 ms.
  - a heartbeat tick costs **0.06–0.10 ms per 25 ms** (≈0.3% of the main thread with 5 loops)
- **Audio-thread cost:** this uses an offline render with just-in-time 100 ms scheduling (like the live heartbeat), best of 3, normalized to a reference of 20 "filtered-noise voices". One reference voice costs about **0.06–0.1% of a core** on this box.
  - Single loops cost **3–14 voice-equivalents**, about 4 of which is the shared compressor floor. The heaviest are `liquid.pour` (bubbles and cavity), `liquid.slosh` and `room.tone`.

  | Scene (5 s) | High quality | Low quality |
  |---|---|---|
  | Darkroom at night (5 loops + drips, flops, laps) | 21 voice-eq | 15 |
  | Backyard, noon (wind, birds, cicadas, sprinkler, chimes) | ~20 (60 ms per 4 s ≈ 1.5% core) | 22 |
  | Backyard, night | 12 | 9 |
  | Precinct, 1994 (typing at 3–12 keys/s) | 10 | 12 |
  | Lighthouse storm | 20 | 18 |
  | Texture bench | 18 | 11 |
  | **Everything at once** (21 loops + every one-shot every 0.5–3 s, ~2,400 nodes per 5 s) | **144 voice-eq ≈ 9–11% of a core** | – |

  Low-quality numbers are within the noise of high on this box. Low mostly matters on phones because it drops nodes.
- **Real-hardware estimate:**
  - Desktop Chrome: one voice ≈ 0.03–0.05% of a core, so a busy game scene costs **≤1% of a core** and the everything-at-once stress test 5–7%.
  - Mid-range phone (3–4× slower): **2–4% of a core per scene**. Budget **≤25 voice-equivalents** per scene on phones, which is any one game's scene. The stress test, at about 25% of a core, is not a real use case.

## Quality knobs

- `quality: 'low'` is picked automatically on ≤4 cores. It:
  - drops secondary layers: slosh surface hiss, pour cavity, cloth swish, marble hollow resonators, the 3rd creak resonator, wind leaves and whistle, the second cicada voice, crickets 4→2, bird FM and the CRT whine
  - caps modal partials at 3
  - roughly halves grain rates
  - disables the room reverb
  - lowers the voice cap from 48 to 24
- Per-id `maxVoices` steals the oldest voice. Per-id `minInterval` rate-limits; `ui.tick` is limited to one per 45 ms, as in the art direction.
- `latencyHint`: `'interactive'` is the default. Use `'balanced'` or `'playback'` on weak phones if you hear dropouts; it trades latency for buffer headroom.
- `suspendWhenHidden` (default on) and mute both suspend the context, so the audio thread uses no CPU in those states.
- Loop count is the main lever. A game should run 3–6 beds and fire the rest as one-shots.

## Gotchas found (several measured)

1. **Biquad automation is a-rate by default, and `setTargetAtTime` never ends.** Chrome then recomputes filter coefficients *per sample* for as long as the filter exists. Measured: a continuously automated biquad costs **3–4× a static one**, and even one finished `setTargetAtTime` costs about 1.5×. Setting `automationRate = 'k-rate'` on `frequency` and `Q` brings it back to the static cost (380 ms vs 1,335 ms in the test). `Synth.filter()` and the muffle filter now do this, and StereoPanner `pan` is also k-rate. Keep oscillator frequencies a-rate, because chirps would zipper.
2. **`setValueCurveAtTime` with a start time in the past is clamped to `currentTime`.** That made a chunk overlap the next one and throw `NotSupportedError`; it happened live for `paper.crinkle` when the main thread was busy. `GrainStream.fill` now jumps ahead to `currentTime + 3 ms`.
3. **Negative start times throw.** A jittered tick at t=0 did this. `burst`, `tone` and `modal` now clamp to 0.
4. **The first sound at a new sample rate built three 3-second noise buffers inside `play()`**, a 3.8 ms hitch. The buffers are now warmed in a `setTimeout` right after unlock. They are shared across contexts per sample rate; the spec allows that.
5. **JS-built excitation buffers are slow.** The per-sample creak buffer took 8–17 ms per play. Writing the pulses into a gain curve (`s.gate`) brought it to about 1 ms.
6. **iOS:**
   - Only `touchend`/`click`/`pointerup` count as activation for touch (not `pointerdown`), so the engine listens to all of them and retries.
   - The engine handles the `'interrupted'` state (calls, Siri) by re-arming for the next gesture.
   - `navigator.audioSession.type` defaults to `'ambient'`, which respects the silent switch and mixes with music. Use `'playback'` to play through the switch.
   - It uses one shared context, because iOS limits how many a page can have.
   - Known Safari bug: the sample rate can go wrong after Bluetooth route changes. If reports come in, recreate the context.
7. **Offline benchmarks that pre-schedule everything overstate cost by 1.6× or more** for event-heavy scenes, because every future node sits in the graph from t=0 (Backyard: 99 ms vs 60 ms). Use the JIT bench (the default).
8. **This headless box is very noisy.** Single benchmark runs varied 3–10×. Always use best-of-N and normalize to `benchReference`.
9. **Repo-level problems, outside this spike:**
   - TypeScript 7.0.2 removed `baseUrl`, so the root `tsconfig.json` fails with TS5102/TS5090 and `npm run check` is probably broken. The fix is `paths: {"@shared/*": ["./src/shared/*"]}` with no `baseUrl`. This spike type-checks with its own `tsconfig.json`.
   - The shared Vite server full-reloads pages while other agents edit, which kills long harness `--eval`s. Retry, or use the `?nothumbs` flag and short evals.
10. **All recipes were tuned by spectrogram and level statistics, not by ear.** A listening pass is still needed (see below).

## Recommendations for the real implementation

- Move `core/` to `src/shared/audio/` unchanged. `index.ts` already exports the art-direction API (`getAudio`, `sound`, `uiSound`) and uses its storage keys and event. Keep `analysis.ts` dev-only.
- Bundle size, measured with rolldown: `core/index.ts` with all packs is **73 KB minified, 23 KB gzipped**. A good share of that is the `desc` and `label` strings, which only the demo needs. To shrink it, register per game with `new AudioEngine().register([...ui, ...darkroom, ...liquid])`, or strip `desc` in production. Keep **one** engine per page; the `Audio` singleton is the default.
- **A human listening pass with the demo page is the most valuable next step.** Adjust defaults and gains in the defs. Each card shows peak, RMS, duration, node count and spectral centroid, so changes stay measurable.
- Add a CI smoke test: Playwright opens `/spikes/audio/?…` (or a test page), runs `__spike.results()`, and asserts no NaN, peak < 0 dBFS and peak > −45 dBFS.
- Two small features are still open:
  - **captions:** the darkroom and studio "smell captions". Add `caption` to defs and an `onPlay` event.
  - **haptics:** art direction §10.3. Add `vibrate` per id on touch input, gated by the sound preference.
- Game hooks:
  - lensbench: duck the radio with `Audio.duck('amb', …)` on a shutter.
  - studio: `setMuffle(600)` under the dark cloth.
  - studio: drive chimes, leaves and the swing from `wind.get('gust')`.
  - plates: bob the tower view with `sea.get('swell')`.
  - Let timers and games keep their own clocks. Do not use `Audio.now()` for game logic, because it freezes while muted or hidden.

## Test hooks (`window.__spike`)

- **Setup and state:** `init()`, `ready()`, `stats()`, `level()` (output dBFS from the analyser).
- **Playing sounds:**
  - `play(id, params)`
  - `loop(id, params)`, `set(id, name, v)`, `get(id, name)`, `stop(id)`
  - `scene(name, on)`, `scenes()`
  - `pad(i)` selects a drag-pad target
- **Offline analysis:**
  - `thumbsDone()`
  - `results()`: a per-sound table of peak/RMS dB, duration, nodes, centroid, NaN and render ms
  - `render(id, params, q)`
- **Benchmarks:**
  - `profile(dur, q)`: each loop measured against the reference
  - `benchOne(name, dur, q)`
  - `bench(dur, q)`: every scene plus the stress test, as text in the Scenes panel
  - `lib`: `{ Synth, GrainStream, benchReference, benchScene }`

Screenshots: `shots/spike-audio*.png`. The mobile ones are `shots/spike-audio-mobile*.png`.
