import type { MaterialPhys, RGB } from '../types'
import { hexToLinear } from '../colour'

/** MaterialPhys with sensible defaults; only hardness is required. */
export const phys = (p: Partial<MaterialPhys> & { hardness: number }): MaterialPhys => ({
  muS: 0.5, muK: 0.4, restitution: 0.4, rollResist: 0.01, metalness: 0, roughness: 0.6, ...p,
})
export const rgb = (hex: string): RGB => hexToLinear(hex)
export const DEG = Math.PI / 180

import type { AlbedoFn, SurfaceRuntime } from '../types'

/** A constant colour as an AlbedoFn from a linear RGB triple. */
export const flat = (c: RGB): AlbedoFn => (_x, _y, o) => { o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; return o }

/** Height (mm) of the live surface at (x, y), nearest texel. */
export function heightAt(rt: SurfaceRuntime, x: number, y: number): number {
  const b = rt.bake
  const i = Math.min(b.res - 1, Math.max(0, Math.floor((x / b.sizeMm + 0.5) * b.res)))
  const j = Math.min(b.res - 1, Math.max(0, Math.floor((y / b.sizeMm + 0.5) * b.res)))
  return b.height[j * b.res + i]
}

export const SMOOTH = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
