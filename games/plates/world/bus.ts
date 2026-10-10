// games/plates/world/bus.ts — the typed event bus of contracts.ts.
import type { Bus, GameEvent } from '../contracts'

export function createBus(): Bus {
  const subs = new Map<string, Set<(e: GameEvent) => void>>()
  return {
    on(t, fn) {
      let s = subs.get(t)
      if (!s) { s = new Set(); subs.set(t, s) }
      const f = fn as (e: GameEvent) => void
      s.add(f)
      return () => { s?.delete(f) }
    },
    emit(e) {
      const s = subs.get(e.t)
      if (!s) return
      for (const fn of [...s]) { try { fn(e) } catch (err) { console.debug('[plates] bus handler', err) } }
    },
  }
}
