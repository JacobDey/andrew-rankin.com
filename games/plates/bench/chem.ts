// games/plates/bench/chem.ts — plate chemistry fields and rates (GDD §5.6).
import * as THREE from 'three'
import { SIM_W, SIM_H, F_AGE, K_DEV, S_SLOPE, type PlateChem, type PlateId, type Bath, type LightState } from '../contracts'
import type { PipeFluid } from './fluid'

export const PLATE_SIZE_M: [number, number] = [0.1715, 0.0826]    // 6¾ × 3¼ in
const U0 = 0.02, R = 1.0      // GDD starts u0 at 0.05 m/s; our pipe flow runs slower, so 0.02 gives ~40 s of good rocking ≈ P 40

export function newChem(id: PlateId): PlateChem {
  const n = SIM_W * SIM_H
  return { id, P: new Float32Array(n), H: new Float32Array(n).fill(1), F: new Float32Array(n).fill(F_AGE), B: new Float32Array(n), cDev: 0, fixed: false }
}

/** Sample points of each chem cell in tray-local metres (plate centred in the tray, image top = far side). */
const CELL_XZ: Float32Array = (() => {
  const a = new Float32Array(SIM_W * SIM_H * 2)
  for (let j = 0; j < SIM_H; j++) for (let i = 0; i < SIM_W; i++) {
    const k = (j * SIM_W + i) * 2
    a[k] = ((i + 0.5) / SIM_W - 0.5) * PLATE_SIZE_M[0]
    a[k + 1] = ((j + 0.5) / SIM_H - 0.5) * PLATE_SIZE_M[1]
  }
  return a
})()

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
const vel = { x: 0, z: 0 }

/**
 * Advance one plate by dt game-seconds. `bath` null = in the air (hand, bench, rack, table).
 * Returns true when a field changed (so the GPU copy needs an upload).
 */
export function stepChem(c: PlateChem, bath: Bath | null, fluid: PipeFluid | null, dt: number, light: LightState, onTable: boolean): boolean {
  const n = SIM_W * SIM_H
  let changed = false
  // fog from light (fixed plates ignore light)
  if (!c.fixed) {
    const fogRate = 3.0 * light.whiteI + 0.02 * (onTable ? light.canaryI : 0) + 0.0004 * light.rubyI
    if (fogRate > 0) { for (let k = 0; k < n; k++) c.F[k] += c.H[k] * fogRate * dt; changed = true }
  }
  if (bath === 'dev' && fluid && !c.fixed) {
    let wet = 0
    for (let k = 0; k < n; k++) {
      const x = CELL_XZ[2 * k], z = CELL_XZ[2 * k + 1]
      const dmm = fluid.depthAt(x, z) * 1000
      const w = smooth(0.3, 1.0, dmm)
      fluid.velAt(x, z, vel)
      const A = 0.35 + 0.65 * Math.min(1, Math.hypot(vel.x, vel.z) / U0)
      c.P[k] += R * w * A * dt
      wet += w
    }
    if (wet / n > 0.5) c.cDev = 1
    changed = true
  } else if (bath === 'water' && fluid) {
    if (c.cDev > 1e-4 && !c.fixed) {
      for (let k = 0; k < n; k++) {
        const dmm = fluid.depthAt(CELL_XZ[2 * k], CELL_XZ[2 * k + 1]) * 1000
        c.P[k] += R * c.cDev * smooth(0.3, 1.0, dmm) * 0.35 * dt
      }
      changed = true
    }
    c.cDev *= Math.exp(-dt / 0.6)
  } else if (bath === 'hypo' && fluid) {
    c.cDev = 0
    let hmax = 0
    for (let k = 0; k < n; k++) {
      if (c.H[k] <= 0) continue
      const x = CELL_XZ[2 * k], z = CELL_XZ[2 * k + 1]
      const w = smooth(0.3, 1.0, fluid.depthAt(x, z) * 1000)
      fluid.velAt(x, z, vel)
      const rate = 0.26 + 0.39 * Math.min(1, Math.hypot(vel.x, vel.z) / U0)
      c.H[k] = Math.max(0, c.H[k] - c.H[k] * rate * w * dt * 1.0 - (c.H[k] < 0.015 ? 0.002 * dt : 0))
      if (c.H[k] > hmax) hmax = c.H[k]
    }
    changed = true
    if (!c.fixed && hmax < 0.02) c.fixed = true
  } else if (bath === null) {
    if (c.cDev > 1e-4 && !c.fixed) {
      for (let k = 0; k < n; k++) c.P[k] += R * c.cDev * 0.35 * dt
      changed = true
    }
    c.cDev *= Math.exp(-dt / 4)
  }
  return changed
}

export function maxH(c: PlateChem): number { let m = 0; for (let k = 0; k < c.H.length; k++) if (c.H[k] > m) m = c.H[k]; return m }
export function meanOf(a: Float32Array): number { let s = 0; for (let k = 0; k < a.length; k++) s += a[k]; return s / a.length }

/** Density for a constant L (wedge squares). */
export function densityL(P: number, F: number, L: number): number { return 1 - Math.exp(-K_DEV * P * (Math.pow(2, S_SLOPE * L) + F)) }

/** GPU copy: RGBA16F R=P G=H B=F A=B. */
export function chemTexture(): { tex: THREE.DataTexture; data: Uint16Array } {
  const data = new Uint16Array(SIM_W * SIM_H * 4)
  const tex = new THREE.DataTexture(data, SIM_W, SIM_H, THREE.RGBAFormat, THREE.HalfFloatType)
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return { tex, data }
}
export function uploadChem(c: PlateChem, data: Uint16Array, tex: THREE.DataTexture): void {
  const h = THREE.DataUtils.toHalfFloat
  for (let k = 0, j = 0; k < c.P.length; k++, j += 4) { data[j] = h(c.P[k]); data[j + 1] = h(c.H[k]); data[j + 2] = h(c.F[k]); data[j + 3] = h(c.B[k]) }
  tex.needsUpdate = true
}
