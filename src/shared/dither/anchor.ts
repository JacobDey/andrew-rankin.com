import * as THREE from 'three'
import type { OneBitPass } from './OneBitPass'

/**
 * Automatic sphere-dither anchoring.
 *
 * Keeps the dither sphere centred on a fixed point and orientation (so the pattern is
 * glued to the world) until either
 *   - the camera has travelled more than `maxDistance` (0.2 m), or
 *   - turning has stretched texels anywhere in the frame by more than `maxStretch`
 *     (1.2x either way). Off the anchor axis a gnomonic face scales by
 *     cos^2(a + t) / cos^2(a), so with an 88 deg horizontal FOV even a 5 deg turn gives
 *     +-17% at the frame edges, while a 50 deg FOV tolerates ~8 deg.
 * Then it re-anchors on the camera with a short Bayer dissolve, which restores
 * texel:pixel = 1:1 without a visible pop.
 *
 *   const anchor = new AnchorTracker()
 *   // each frame, after moving the camera:
 *   anchor.update(pass, camera)
 *   // on a cut / teleport:
 *   anchor.snap(pass, camera)
 *
 * Station games (plates, latent): small sway never re-anchors, so the room is perfectly
 * stable; a bigger look-around dissolves every few degrees. Walking games (studio): one
 * dissolve per `maxDistance` (at 1 m/s, one 4-frame dissolve every ~12 frames).
 */
export interface AnchorTrackerOptions {
  /** Re-anchor after this much travel (m). Texels on a surface at depth D are magnified
   *  by ~1 + travel/D, so keep this <= ~0.25 x the nearest depth you care about. */
  maxDistance?: number
  /** Typical subject distance (m). When set, travel limit = min(maxDistance, 0.25 * depthHint). */
  depthHint?: number
  /** Re-anchor when texels stretch or shrink by more than this anywhere in the frame. */
  maxStretch?: number
  /** Hard backstop on rotation from the anchor (degrees). */
  maxAngleDeg?: number
  /** Dissolve length in frames (0 = pop). */
  dissolveFrames?: number
  /** false = centre the sphere on the camera (rotation-only stability, no depth needed). */
  positional?: boolean
}

export class AnchorTracker {
  readonly quaternion = new THREE.Quaternion()
  readonly position = new THREE.Vector3()
  opts: Required<AnchorTrackerOptions>
  /** Re-anchors so far (for tests / HUD). */
  count = 0
  private has = false
  private camQ = new THREE.Quaternion()
  private camP = new THREE.Vector3()

  constructor(opts: AnchorTrackerOptions = {}) {
    this.opts = { maxDistance: 0.2, depthHint: 0, maxStretch: 1.2, maxAngleDeg: 30, dissolveFrames: 4, positional: true, ...opts }
  }

  /** Anchor exactly on the camera, no dissolve. */
  snap(pass: OneBitPass, camera: THREE.Camera): void {
    camera.updateMatrixWorld()
    camera.getWorldQuaternion(this.quaternion)
    camera.getWorldPosition(this.position)
    this.has = true
    pass.setDitherAnchor(this.quaternion, this.opts.positional ? this.position : null, 0)
  }

  /** Call once per frame. Returns true when it re-anchored. */
  update(pass: OneBitPass, camera: THREE.Camera): boolean {
    camera.updateMatrixWorld()
    camera.getWorldQuaternion(this.camQ)
    camera.getWorldPosition(this.camP)
    if (!this.has) { this.snap(pass, camera); return true }
    const limit = this.opts.depthHint > 0 ? Math.min(this.opts.maxDistance, 0.25 * this.opts.depthHint) : this.opts.maxDistance
    const dist = this.camP.distanceTo(this.position)
    const angle = this.camQ.angleTo(this.quaternion)
    const far = this.opts.positional && dist > limit
    const turned = angle > THREE.MathUtils.degToRad(this.opts.maxAngleDeg)
    this.lastStretch = this.stretch(camera)
    const stretched = this.lastStretch > this.opts.maxStretch
    if (!far && !turned && !stretched) return false
    // A jump (cut, teleport: > 3x the travel limit or > 2x the angle backstop) snaps:
    // dissolving from an anchor metres away would show its grazing texels for a few frames.
    const jump = (this.opts.positional && dist > 3 * limit) || angle > 2 * THREE.MathUtils.degToRad(this.opts.maxAngleDeg)
    this.quaternion.copy(this.camQ)
    this.position.copy(this.camP)
    this.count++
    this.lastStretch = 1
    pass.setDitherAnchor(this.quaternion, this.opts.positional ? this.position : null, jump ? 0 : this.opts.dissolveFrames)
    return true
  }

  /** Last measured worst-case texel stretch (1 = perfect). */
  lastStretch = 1
  private rel = new THREE.Quaternion()
  private v = new THREE.Vector3()

  /**
   * Worst linear texel:pixel stretch (>= 1, either direction) over the frame's corners
   * and edge midpoints for the current anchor orientation (rotation only; translation
   * is covered by maxDistance). Pure JS, 9 points x 4 projections per call.
   */
  stretch(camera: THREE.Camera): number {
    const P = camera.projectionMatrix.elements
    const tx = 1 / P[0]
    const ty = 1 / P[5]
    this.rel.copy(this.quaternion).invert().multiply(this.camQ)
    const e = 1e-3
    const face = (x: number, y: number, out: [number, number]): boolean => {
      this.v.set(x, y, -1).applyQuaternion(this.rel)
      const z = -this.v.z
      if (z < 0.2 * Math.max(Math.abs(this.v.x), Math.abs(this.v.y))) return false
      out[0] = this.v.x / z
      out[1] = this.v.y / z
      return true
    }
    const a: [number, number] = [0, 0]
    const b: [number, number] = [0, 0]
    let worst = 1
    for (const sx of [-1, 0, 1]) {
      for (const sy of [-1, 0, 1]) {
        const x = sx * tx
        const y = sy * ty
        for (const [dx, dy] of [[e, 0], [0, e]] as const) {
          if (!face(x - dx, y - dy, a) || !face(x + dx, y + dy, b)) return Infinity
          const s = Math.hypot(b[0] - a[0], b[1] - a[1]) / (2 * e)
          worst = Math.max(worst, s, 1 / s)
        }
      }
    }
    return worst
  }
}
