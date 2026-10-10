// Typed event bus (darkroom.md §11.4).
import type { LightId, Place, TrayId } from './types'

export interface DarkroomEvents {
  light: { id: LightId; on: boolean }
  guard: { open: boolean }
  chain: Record<string, never>
  trayLand: { tray: TrayId; speed: number }
  slosh: { tray: TrayId; kinetic: number; impact: number; x: number }
  spill: { tray: TrayId; ml: number }
  drip: { x: number; z: number; intoTray: boolean }
  paperGrab: { id: string }
  paperDrop: { id: string; place: Place }
  dunk: { id: string }
  timerTick: { remaining: number }
  timerBell: Record<string, never>
  exposure: { on: boolean }
  pour: { bottle: 'A' | 'B'; rate: number }
  brush: { speed: number; load: number }
  dryer: { on: boolean }
  uv: { on: boolean }
  tap: { on: boolean }
  peroxide: { tray: TrayId }
  bloom: { id: string }
  discover: { id: string; title: string; line: string }
  fog: { paperId: string }
  printHung: { paperId: string }
  saved: { slot: string }
  loaded: { slot: string }
  note: { id: string }
}

type Handler<T> = (e: T) => void
export class Bus<E extends object> {
  private m = new Map<keyof E, Set<Handler<never>>>()
  on<K extends keyof E>(k: K, fn: Handler<E[K]>): () => void {
    let s = this.m.get(k)
    if (!s) { s = new Set(); this.m.set(k, s) }
    s.add(fn as Handler<never>)
    return () => s.delete(fn as Handler<never>)
  }
  emit<K extends keyof E>(k: K, e: E[K]): void {
    const s = this.m.get(k)
    if (!s) return
    for (const fn of s) {
      try { (fn as Handler<E[K]>)(e) } catch (err) { console.debug('[darkroom] handler', String(k), err) }
    }
  }
  clear(): void { this.m.clear() }
}

export type DarkroomBus = Bus<DarkroomEvents>
export const createBus = (): DarkroomBus => new Bus<DarkroomEvents>()
