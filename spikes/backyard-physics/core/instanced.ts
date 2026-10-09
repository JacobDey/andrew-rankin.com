/**
 * InstancedBodies: draw many identical physics props (dominoes, tower blocks) with ONE
 * InstancedMesh while each still has its own Rapier body and binding.
 *
 * Each instance gets an invisible proxy Object3D that the PhysicsWorld binding drives
 * (interpolated). `sync()` copies proxy transforms into the instance matrices; it skips
 * the upload when nothing moved (all asleep), which is the common case for a domino run.
 */
import { Color, InstancedMesh, Matrix4, Object3D, type BufferGeometry, type Material } from 'three'

export class InstancedBodies {
  readonly mesh: InstancedMesh
  readonly proxies: Object3D[] = []
  private last: Float32Array
  private m = new Matrix4()

  constructor(geometry: BufferGeometry, material: Material | Material[], count: number) {
    this.mesh = new InstancedMesh(geometry, material, count)
    this.mesh.count = 0
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    // Bodies move all over the yard; don't let a stale bounding sphere cull them.
    this.mesh.frustumCulled = false
    this.last = new Float32Array(count * 7)
  }

  /** Adds an instance; returns its proxy (bind this to the body). */
  add(color?: Color): Object3D {
    const i = this.mesh.count
    if (i >= this.mesh.instanceMatrix.count) throw new Error('InstancedBodies full')
    const p = new Object3D()
    p.matrixAutoUpdate = false
    this.proxies.push(p)
    this.mesh.count = i + 1
    if (color) this.mesh.setColorAt(i, color)
    return p
  }

  /** Copy proxy poses into the instance buffer. Returns true when something changed. */
  sync(): boolean {
    let dirty = false
    const L = this.last
    for (let i = 0; i < this.proxies.length; i++) {
      const p = this.proxies[i]
      const k = i * 7
      const pos = p.position
      const q = p.quaternion
      if (
        L[k] === pos.x && L[k + 1] === pos.y && L[k + 2] === pos.z &&
        L[k + 3] === q.x && L[k + 4] === q.y && L[k + 5] === q.z && L[k + 6] === q.w
      ) continue
      L[k] = pos.x; L[k + 1] = pos.y; L[k + 2] = pos.z
      L[k + 3] = q.x; L[k + 4] = q.y; L[k + 5] = q.z; L[k + 6] = q.w
      this.m.compose(pos, q, p.scale)
      this.mesh.setMatrixAt(i, this.m)
      dirty = true
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true
    return dirty
  }
}
