// A tiny typed event bus. A GDD's own bus may stay as specified; this is the shared one.

export interface Bus<E extends Record<string, unknown>> {
  on<K extends keyof E>(k: K, fn: (e: E[K]) => void): () => void
  once<K extends keyof E>(k: K, fn: (e: E[K]) => void): () => void
  emit<K extends keyof E>(k: K, e: E[K]): void
  clear(): void
}

export function createBus<E extends Record<string, unknown>>(): Bus<E> {
  const map = new Map<keyof E, Set<(e: never) => void>>()
  const bus: Bus<E> = {
    on(k, fn) {
      let set = map.get(k)
      if (!set) map.set(k, (set = new Set()))
      const f = fn as (e: never) => void
      set.add(f)
      return () => {
        set?.delete(f)
      }
    },
    once(k, fn) {
      const off = bus.on(k, (e) => {
        off()
        fn(e)
      })
      return off
    },
    emit(k, e) {
      const set = map.get(k)
      if (!set || set.size === 0) return
      for (const fn of [...set]) (fn as (e: unknown) => void)(e)
    },
    clear() {
      map.clear()
    },
  }
  return bus
}
