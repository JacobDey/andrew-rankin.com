// MotionRecorder: lets a physics-driven world (Rapier etc.) be posed at any instant inside an exposure.
//
// Pattern for a game: at shutter press, freeze the live loop, step the physics forward through the
// shutter span at a fixed dt, record() after each step, then hand recorder.poseAt to the PhotoScene's
// setTime. Analytic motion (spinning props, clock hands) can skip this and pose directly.

import * as THREE from 'three'

const STRIDE = 10 // px py pz qx qy qz qw sx sy sz

export class MotionRecorder {
  readonly objects: THREE.Object3D[]
  private times: number[] = []
  private frames: Float32Array[] = []
  private readonly qa = new THREE.Quaternion()
  private readonly qb = new THREE.Quaternion()

  constructor(objects: THREE.Object3D[]) {
    this.objects = objects
  }

  clear(): void {
    this.times = []
    this.frames = []
  }

  /** Snapshot the current local transforms of every tracked object at time t (call in increasing t). */
  record(t: number): void {
    const f = new Float32Array(this.objects.length * STRIDE)
    this.objects.forEach((o, i) => {
      const k = i * STRIDE
      f[k] = o.position.x
      f[k + 1] = o.position.y
      f[k + 2] = o.position.z
      f[k + 3] = o.quaternion.x
      f[k + 4] = o.quaternion.y
      f[k + 5] = o.quaternion.z
      f[k + 6] = o.quaternion.w
      f[k + 7] = o.scale.x
      f[k + 8] = o.scale.y
      f[k + 9] = o.scale.z
    })
    if (this.times.length && t <= this.times[this.times.length - 1]) {
      // replace a duplicate timestamp
      this.frames[this.frames.length - 1] = f
      return
    }
    this.times.push(t)
    this.frames.push(f)
  }

  get range(): [number, number] {
    return this.times.length ? [this.times[0], this.times[this.times.length - 1]] : [0, 0]
  }

  get length(): number {
    return this.times.length
  }

  /** Apply the interpolated pose at time t (clamped to the recorded range). Lerp positions/scales, slerp rotations. */
  poseAt(t: number): void {
    const n = this.times.length
    if (!n) return
    let i1 = 0
    if (t <= this.times[0]) i1 = 0
    else if (t >= this.times[n - 1]) i1 = n - 1
    else {
      let lo = 0
      let hi = n - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (this.times[mid] <= t) lo = mid
        else hi = mid
      }
      i1 = hi
    }
    const i0 = Math.max(0, i1 - 1)
    const t0 = this.times[i0]
    const t1 = this.times[i1]
    const a = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1
    const f0 = this.frames[i0]
    const f1 = this.frames[i1]
    this.objects.forEach((o, i) => {
      const k = i * STRIDE
      o.position.set(lerp(f0[k], f1[k], a), lerp(f0[k + 1], f1[k + 1], a), lerp(f0[k + 2], f1[k + 2], a))
      this.qa.set(f0[k + 3], f0[k + 4], f0[k + 5], f0[k + 6])
      this.qb.set(f1[k + 3], f1[k + 4], f1[k + 5], f1[k + 6])
      o.quaternion.slerpQuaternions(this.qa, this.qb, a)
      o.scale.set(lerp(f0[k + 7], f1[k + 7], a), lerp(f0[k + 8], f1[k + 8], a), lerp(f0[k + 9], f1[k + 9], a))
    })
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
