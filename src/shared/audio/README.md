# @shared/audio

Procedural WebAudio engine and sound library: a port of `spikes/audio/core` with the §4.4 additions. No samples, no three. Owner: shared-audio. Spec: `docs/architecture.md` §3.9, §4.4, Appendix B; `docs/design/art-direction.md` §10.

Per-game world sounds live in `games/<slug>/sounds.ts` for darkroom, plates, latent, lensbench and studio (texturedle keeps its own engine in `games/texturedle/audio/`).

## Two entry points

| Import | What you get | Use it for |
|---|---|---|
| `@shared/audio/core` | the one shared `Audio` engine with only the 12 UI sounds registered, plus `uiSound` `sound` `getAudio` `haptic` | the hub and the shell (16 KB gz total with core, ui and storage) |
| `@shared/audio` | everything in `core`, **and** the generic library registered into the same engine, plus `Synth` `GrainStream` `alias` `noiseBed` … and all sound arrays | games |

Both resolve to the same singleton, so a page never has two engines. Importing the barrel registers the library as a side effect.

## Use

```ts
import { Audio, uiSound, sound, getAudio, haptic } from '@shared/audio'
import { registerSounds } from './sounds'      // games/<slug>/sounds.ts

registerSounds()                                // once at boot; idempotent
// mountShell() calls Audio.arm(): the first pointerdown, keydown or touchend creates and unlocks the context
uiSound('shutter')                              // chrome palette (art-direction §10.2)
Audio.play('darkroom.drip', { intoLiquid: 1, pan: -0.3 })       // one-shot; unknown ids are a silent no-op
const tray = Audio.loop('darkroom.slosh'); tray.set('energy', 0.4)   // loop handle valid before unlock
Audio.onCaption((text, id) => showCaption(text))                // [drip], [fan hum], [tap running], [pencil scratch]
```

Silence rules: nothing sounds before a gesture; `?test=1` and `?embed=poster` never create an `AudioContext` (hard silent; `play()` returns `null`, loops keep their params so `get()` works); `?mute=1` starts muted (not persisted until the player changes it).

## Engine API (additions marked +)

`Audio.arm init configure play loop stopAll register def list setQuality setRoom setMuffle(hz | null) duck bus analyser stats ready context now onReady muted setMuted volume setVolume onChange` and
`+ has(id) + onCaption(cb) + noise(color)`; `caption?: string` on every `SoundDef`.
Graph: `ui (0.55) -> master (volume x !muted, 60 ms ramp) -> compressor (-18 dB, knee 12, 4:1, 3 ms / 150 ms) -> destination`, plus `sfx` and `amb` buses through a world muffle into master. Prefs: `ar:sound` (`on|off`) and `ar:volume`, event `ar:soundchange`, cross-tab sync. `sound`, `getAudio()`, `uiSound(name, { gain, detune })` (names `tick shutter advance switch paper paper-out canister bell thunk develop`; `paper-out` maps to `ui.paperOut`), `haptic(ms | pattern)` (touch input only, only while sound is on; `shutter` fires 10, `switch` 6).

## Authoring kit (`@shared/audio`)

`alias(base, { id, games, params?, adapt? })` re-exposes a recipe under a new id with adapted params; `noiseBed({ ... map, am, layer, extra })` declares a filtered-noise loop whose filter, gain and pan follow params; `shot(def)` and `loopDef(def)` fill defaults; `modulate(s, param, hz, depth, t, end)` wires an LFO into an `AudioParam`. Helper recipes: `bell` `escapement` `bubble` `lap` `strike` `creak` `gearBuzz`.

## Appendix B coverage

All 188 ids are registered: the generic library (56 ids from the spike; `film.leaderSnap` is an extra), `darkroom.*` (27), `plates.*` (24), `latent.*` (27), `lensbench.*` (24) and `studio.*` (30), each with the params Appendix B lists (extra optional params are harmless). The dev page counts 201 registered sounds in total (148 one-shots, 53 loops). Recipes follow each GDD's audio table; where a GDD names a generic recipe the id is an `alias` of it (for example `darkroom.slosh`, `latent.lap`, `studio.cicadas` which takes `{ level }`, `studio.wind` which takes `{ w }` in m/s, `studio.crickets` which takes `{ tempF }`).

Notes for integrators:
- Shutters take the **real exposure in seconds** (`t`; focal planes also `tc`); the two sounds are always exactly that far apart (capped at 12 s).
- `darkroom.slosh` and `plates.slosh` take `energy` 0..1 (darkroom: `min(1, KE / 0.006 J)`); fire `*.lap` for real wall hits and set `laps: 0` on `darkroom.slosh`/`latent.slosh`.
- `latent.cluster` is silent at `rho01 = 0` and rises with `rho01`; `latent.room` also schedules the cold-store compressor about every 240 s by itself.
- `plates.fixChord` takes MIDI notes `n0..n4` (0 = unused).
- Postcard replies in Sunny 16 use `uiSound('bell')` and `uiSound('develop')`.
- Levels follow the GDDs (the numbers are small on purpose: room tone about -36 dBFS). The recipes were tuned by spectrogram and level, not by ear: a listening pass is the most valuable next step.

## Deviations

- `Audio` is exported by name only (the spike's default export is gone; conventions say named exports).
- The UI palette is split from the generic library so the hub bundle stays small (see the table above). `analysis.ts` (offline render, spectrograms, benchmarks) is dev and test only and is not exported from the barrel.
- A recipe that throws now logs one `console.warn` instead of `console.error`.

## Acceptance

`/src/shared/audio/dev/` lists every id with a play button; `__game.selftest()` checks: no `AudioContext` before a gesture; every Appendix B id is registered; each one-shot renders offline to finite, unclipped, non-silent samples; `ui.*` peaks stay at or below -12 dBFS after the master gain and a static model of the compressor and last 1 s or less; every loop renders finite, unclipped, non-silent audio and has no step above 0.2 at its start (after the engine's 80 ms fade-in) or end. Result: 0 failures over 201 sounds.

```
node scripts/shoot.mjs /src/shared/audio/dev/ --timeout 240000 --eval "__game.selftest().then(r => JSON.stringify({ ok: r.ok, counts: r.counts, failures: r.failures }))"
```
