// Marble rendering: glass (transmission + an orange cat's-eye swirl so you can
// see it roll) or a polished steel BB (cheap: no transmission pass).

import * as THREE from 'three'
import type { Marble } from '../core/marble'

export type MarbleKind = 'glass' | 'steel'

export class MarbleView {
  readonly group = new THREE.Group()
  private ball: THREE.Mesh
  private swirl: THREE.Mesh
  private glassMat: THREE.MeshPhysicalMaterial
  private steelMat: THREE.MeshStandardMaterial
  kind: MarbleKind = 'glass'

  constructor() {
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#eef7f2'),
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      thickness: 6,
      ior: 1.5,
      attenuationColor: new THREE.Color('#cfe8dc'),
      attenuationDistance: 30,
      specularIntensity: 1,
      clearcoat: 0.3,
      envMapIntensity: 1.2,
    })
    this.steelMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9ccd0'), metalness: 1, roughness: 0.08, envMapIntensity: 1.4 })
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), this.glassMat)
    // cat's-eye: a twisted ribbon inside the glass
    const rib = new THREE.PlaneGeometry(1.5, 0.42, 48, 4)
    const pos = rib.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const a = x * 2.2
      const w = y * (1 - Math.abs(x / 0.75) ** 2 * 0.7)
      pos.setXYZ(i, x, w * Math.cos(a), w * Math.sin(a))
    }
    rib.computeVertexNormals()
    this.swirl = new THREE.Mesh(
      rib,
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8772e'), emissive: new THREE.Color('#5a1e05'), roughness: 0.35, side: THREE.DoubleSide }),
    )
    this.ball.add(this.swirl)
    this.group.add(this.ball)
  }

  setKind(kind: MarbleKind, radius: number): void {
    this.kind = kind
    this.ball.material = kind === 'glass' ? this.glassMat : this.steelMat
    this.swirl.visible = kind === 'glass'
    this.glassMat.thickness = radius * 1.5
    this.ball.scale.setScalar(radius)
  }

  update(m: Marble, visible: boolean): void {
    this.group.visible = visible
    this.ball.position.set(m.x, m.y, m.z)
    this.ball.quaternion.set(m.q[0], m.q[1], m.q[2], m.q[3])
  }
}
