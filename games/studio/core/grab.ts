// The spring hand (studio.md §5.3): F = m·(k(x_hand − x) − c·v), k = 400 s⁻², c = 30 s⁻¹,
// |F| ≤ 25 N + 2·m·g. Hand target = a point on the view ray at the carry distance, never below
// ground + radius. Throw: v = mean pointer-world velocity over the last 80 ms, capped at 12 m/s.
import * as THREE from 'three'
import type { Engine } from './engine'
import type { PhysBody } from './physics'

export interface Grab {
  held: PhysBody | null
  start(pb: PhysBody, point: THREE.Vector3, ray: THREE.Ray): void
  move(ray: THREE.Ray): void
  setDistance(d: number): void
  nudge(dd: number): void
  end(throwIt?: boolean): void
  poke(pb: PhysBody, point: THREE.Vector3, dir: THREE.Vector3): void
}

export function createGrab(e: Engine): Grab {
  let held: PhysBody | null = null
  let dist = 2
  const hand = new THREE.Vector3()
  const localOff = new THREE.Vector3()
  const hist: { t: number; p: THREE.Vector3 }[] = []
  const tmp = new THREE.Vector3()
  const tmpV = new THREE.Vector3()
  let lastRay: THREE.Ray | null = null
  const setHand = (ray: THREE.Ray) => {
    lastRay = ray.clone()
    hand.copy(ray.origin).addScaledVector(ray.direction, dist)
    if (held) hand.y = Math.max(hand.y, held.radius + 0.02)
    hist.push({ t: performance.now(), p: hand.clone() })
    while (hist.length > 12) hist.shift()
  }
  e.sim.add({
    step() {
      if (!held) return
      const b = held.body
      const m = held.mass
      const t = b.translation()
      const v = b.linvel()
      tmp.set(t.x, t.y, t.z).add(localOff)
      const k = 400
      const c = 30
      tmpV.set(hand.x - tmp.x, hand.y - tmp.y, hand.z - tmp.z).multiplyScalar(k).addScaledVector(new THREE.Vector3(v.x, v.y, v.z), -c).multiplyScalar(m)
      const cap = 25 + 2 * m * 9.81
      if (tmpV.length() > cap) tmpV.setLength(cap)
      b.resetForces(true)
      b.addForce({ x: tmpV.x, y: tmpV.y, z: tmpV.z }, true)
      const w = b.angvel()
      b.setAngvel({ x: w.x * 0.9, y: w.y * 0.9, z: w.z * 0.9 }, true)
    },
  }, -1)
  return {
    get held() {
      return held
    },
    start(pb, point, ray) {
      held = pb
      dist = THREE.MathUtils.clamp(point.distanceTo(ray.origin), 0.6, 6)
      const t = pb.body.translation()
      localOff.set(0, 0, 0)
      void t
      pb.body.wakeUp()
      hist.length = 0
      setHand(ray)
    },
    move(ray) {
      if (held) setHand(ray)
    },
    setDistance(d) {
      dist = THREE.MathUtils.clamp(d, 0.6, 6)
      if (lastRay) setHand(lastRay)
    },
    nudge(dd) {
      dist = THREE.MathUtils.clamp(dist + dd, 0.6, 6)
      if (lastRay) setHand(lastRay)
    },
    end(throwIt = true) {
      if (!held) return
      const b = held.body
      b.resetForces(true)
      if (throwIt && hist.length >= 2) {
        const now = performance.now()
        const recent = hist.filter((h) => now - h.t <= 80)
        const a = recent.length >= 2 ? recent[0] : hist[hist.length - 2]
        const z = hist[hist.length - 1]
        const dt = Math.max(0.016, (z.t - a.t) / 1000)
        const v = z.p.clone().sub(a.p).multiplyScalar(1 / dt)
        if (v.length() > 12) v.setLength(12)
        if (v.length() > 0.5) b.setLinvel({ x: v.x, y: v.y, z: v.z }, true)
      }
      held = null
    },
    poke(pb, _point, dir) {
      const J = Math.min(1.5, 4 * pb.mass)
      pb.body.applyImpulse({ x: dir.x * J, y: dir.y * J + J * 0.25, z: dir.z * J }, true)
    },
  }
}
