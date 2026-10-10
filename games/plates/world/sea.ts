// games/plates/world/sea.ts — the wave scheduler (GDD §5.1). Emits {t:'wave'} on the bus.
import type { Bus } from '../contracts'

export interface Sea { update(dt: number): void; frozen: boolean; wave(strength?: number): void }

export function createSea(bus: Bus, rng: () => number): Sea {
  let next = 6 + 5 * rng(), count = 0
  const sea: Sea = {
    frozen: false,
    wave(strength?: number) {
      count++
      const s = strength ?? (count % 4 === 0 ? 1.4 : 0.6 + 0.4 * rng())
      const a = rng() * Math.PI * 2
      bus.emit({ t: 'wave', strength: s, dirX: Math.cos(a), dirZ: Math.sin(a) })
    },
    update(dt: number) {
      if (sea.frozen) return
      next -= dt
      if (next <= 0) { next = 9 + 5 * rng(); sea.wave() }
    },
  }
  return sea
}
