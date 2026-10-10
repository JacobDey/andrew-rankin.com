// games/plates/render/palette.ts — the four two-colour palettes and CSS var sync (GDD §7.1).
import type { PaletteName } from '../contracts'

export interface Pal { ink: string; light: string }
export const PALETTES: Record<PaletteName, Pal> = {
  ruby: { ink: '#160505', light: '#c9361f' },
  canary: { ink: '#1a1206', light: '#f2b654' },
  bone: { ink: '#191613', light: '#e9e1cf' },
  prussian: { ink: '#13396a', light: '#e8eef2' },
}
export function hex3(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
export function hexRGB255(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Threshold-sweep palette transition state (0.8 s). */
export class PaletteSweep {
  from: PaletteName
  to: PaletteName
  t = 1
  constructor(p: PaletteName) { this.from = p; this.to = p }
  get current(): PaletteName { return this.t >= 0.5 ? this.to : this.from }
  set(p: PaletteName, instant = false): void {
    if (p === this.to && this.t >= 1) return
    this.from = this.t >= 1 ? this.to : this.current
    this.to = p
    this.t = instant ? 1 : 0
  }
  update(dt: number): void { if (this.t < 1) this.t = Math.min(1, this.t + dt / 0.8) }
}

/** Mirror the active palette into CSS vars on an element (chrome follows the room palette). */
export function syncCss(el: HTMLElement, p: PaletteName): void {
  const pal = PALETTES[p]
  el.style.setProperty('--pl-ink', pal.ink)
  el.style.setProperty('--pl-light', pal.light)
  el.dataset.palette = p
}
