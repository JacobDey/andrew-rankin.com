# @shared/fluid

Tray shallow-water liquid. Pure TypeScript (no three, no DOM, no `@shared/*` imports). Architecture section 4.6.

```ts
import { TrayFluid, TrayBody, ScalarField, sloshFrequency, wallSlapToGain } from '@shared/fluid'

const fluid = new TrayFluid({ nx: 48, ny: 36, dx: 0.0075, depth: 0.012, lip: 0.045, damping: 0.8 })   // Darkroom preset
const body = new TrayBody(); body.autoRock(true)
// per frame:
const r = body.step(dt)                                  // { ax, ay, landed }
fluid.setTilt(Math.tan(body.tiltX), Math.tan(body.tiltY)); fluid.setAccel(r.ax, r.ay)
const rep = fluid.step(dt)                               // { spill, wallImpact, kinetic, substeps, slaps[] }
```

- `TrayFluid`, `TrayBody`, `ScalarField`, `sloshFrequency`, `wallSlapToGain`: exactly the section 4.6 signatures.
- Spike-level classes are exported too, unchanged except where noted: `ShallowWater` (staggered solver), `TrayRig`, `FluidTray` + `PaperChem` + `latent*` helpers (the spike's whole facade, for anyone who wants it). `fluid.solver` exposes the `ShallowWater` of a `TrayFluid`.
- Dev page: `/src/shared/fluid/dev/index.html` (top view + cross-section, auto-rock, poke on click, pour, plate floor, dye). `__game.selftest()`, `__game.bench()`, `__game.step(n)`.

## How it behaves

- Tray-local frame: origin at the centre, +x right, +y toward the viewer, metres. `h` is index `j*nx + i`, `j` increasing with +y.
- Tilt: `setTilt(tanX, tanY)`; +tanX lowers the +x side (liquid runs to +x), **+tanY lowers the +y side** (liquid runs toward the viewer). `setAccel(ax, ay)`: a tray accelerating to +x pushes the liquid to -x (fictitious force).
- Fixed 1/240 s substeps, at most 8 per `step()`; time beyond that is dropped (the sim slows, never spirals). The solver may split a substep further for CFL.
- `floor(x, y)` / `setFloor(fn)`: extra floor height. `h` is depth above the local floor, the free surface is `h + floor`; `surfaceAt` returns it. `refill(depth)` sets a **flat free surface at `depth` above the base floor** (so liquid is thinner over a plate). `setFloor` keeps the free surface where it can and conserves volume (a plate displaces liquid and raises the level a little). `lip` is measured from the base floor.
- Sleep: if kinetic energy < 1e-6 J for 1 s the tray sleeps (`sleeping`, `step()` is a no-op returning zeros, velocities zeroed). Any `setTilt` change, `setAccel` change, impulse, poke, pour, take, floor change, refill or `wake()` wakes it.
- `poke(x, y, strength)`: zero-net-volume ring ripple; `strength` 1 = 1 mm centre displacement (capped at half the local depth), radius max(2 dx, 6 mm). `impulse` subtracts its volume evenly from the wet cells. `addVolume(x, y, r, m3)` pours (can overflow the lip and spill); `takeVolume` removes from the cell and its neighbours and returns what it got.
- `slaps`: one event per wall per step when the wall impact crosses a threshold (u_n about 0.24 m/s at h 12 mm); `e` is in the same unit as `wallImpact` (rho h u_n^2 dx, J proxy). `wallSlapToGain(e) = 1 - exp(-e / 0.03)`.
- `TrayBody.step` returns `landed` = tray edge speed (m/s, angular speed times 0.2 m) on the first return through rest after `release()`.
- `ScalarField.step(dt, D, decay)`: use the frame dt. The total is renormalised after the advection step (semi-Lagrangian is not conservative), clamped to +/-25% per step. `add(x, y, r, amount)`: `amount` is the increment at the centre, `r` the 1/e radius.
- Snapshots: `snapshot()` carries extra optional `ext` (face velocities, accumulators, sleep state, floor) so `restore()` replays bit-exactly. A snapshot without `ext` (hand-made) restores approximately.

## Deviations and measured numbers

- The solver is the spike's (forward-backward staggered grid with wet/dry fronts, semi-Lagrangian advection, wave breaking), not the GDD's pipe model; tuned damping = 0.8 1/s linear. Added: per-cell floor (`ShallowWater.bed`), a `trackTracer` flag (off in `TrayFluid`), and the weir/relax code reads the floor.
- Measured (Node, this machine under heavy load from other agents): volume drift 4e-8 over 60 s; first slosh half-period 1.057 s vs 1.049 s from `sloshFrequency`; tilt 1.3x `atan(2h0/L)` leaves the high end at 0.01 mm and 0.8x keeps 2.6 mm; sleep 4.0 s after a 4 mm bump; plate preset volume drift 6e-8.
- **Resonance.** The 0.5 Hz rock spills at 8 degrees (about 140 mL in 20 s). At 6 degrees on x alone the wave saturates at 41-42 mm against a 45 mm lip (frequency hardening shifts the resonance up: it needs about 0.62 Hz to spill at 6 degrees). The *default* `autoRock` (6 / 2.5 degrees at 0.48 / 0.64 Hz) drives both fundamental modes and does spill (about 100 mL in 6 s, 300 mL in 30 s), as the GDD's "players eventually spill" intends; games that want a calm auto-rock should pass lower amplitudes.
- **Performance.** 48x36, 4 substeps per 1/60 s frame with advection: about 0.7-0.8 ms per frame in Node under load (the doc target is 0.6 ms on a quiet desktop); momentum is 60% of it. `advect: false` is cheaper. A sleeping tray costs nothing.
- `FluidTray` keeps its spike quirks (frame origin at the front-left corner, y away from the viewer); it is not wired to `TrayFluid`.
