// Rapier wrapper: one world for the house (studio.md §5.3). Fixed steps come from the SimClock; dynamic meshes
// are interpolated between the last two physics states. Contact-force events above 2 N·s play impacts and emit
// noise for the sparrows.
import * as THREE from 'three'
import type RAPIER_NS from '@dimforge/rapier3d-compat'
import type { Engine } from './engine'
import type { ImpactMaterial } from './contracts'
import { Audio } from '@shared/audio'

export type Rapier = typeof RAPIER_NS

export interface PhysBody {
  body: RAPIER_NS.RigidBody
  mesh: THREE.Object3D
  mass: number
  grabbable: boolean
  material: ImpactMaterial
  name: string
  radius: number
  prevPos: THREE.Vector3
  prevQuat: THREE.Quaternion
  /** optional hook after each physics step (e.g. landing detection) */
  onStep?: (dt: number) => void
}

export interface Physics {
  R: Rapier
  world: RAPIER_NS.World
  bodies: PhysBody[]
  add(mesh: THREE.Object3D, desc: RAPIER_NS.RigidBodyDesc, colliders: RAPIER_NS.ColliderDesc[], o?: { grabbable?: boolean; material?: ImpactMaterial; name?: string; radius?: number }): PhysBody
  fixed(colliders: RAPIER_NS.ColliderDesc[], pos?: [number, number, number], quat?: THREE.Quaternion): RAPIER_NS.RigidBody
  byCollider(handle: number): PhysBody | undefined
  raycast(o: THREE.Vector3, d: THREE.Vector3, max: number, excludeBody?: RAPIER_NS.RigidBody | null): { body: PhysBody | null; point: THREE.Vector3; dist: number; colliderHandle: number } | null
  awake(): number
  sync(): void
}

const MATERIAL_INDEX: Record<ImpactMaterial, number> = { grass: 0, wood: 1, metal: 2, glass: 3, rubber: 4, cloth: 5 }

export async function loadRapier(): Promise<Rapier> {
  const mod = await import('@dimforge/rapier3d-compat')
  const R = (mod as unknown as { default: Rapier }).default ?? (mod as unknown as Rapier)
  await R.init()
  return R
}

export function createPhysics(e: Engine, R: Rapier): Physics {
  const world = new R.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = 1 / e.quality.physicsHz
  world.integrationParameters.numSolverIterations = 4
  const events = new R.EventQueue(true)
  const bodies: PhysBody[] = []
  const byCollider = new Map<number, PhysBody>()
  const lastImpact = new Map<PhysBody, number>()

  const p: Physics = {
    R, world, bodies,
    add(mesh, desc, colliders, o = {}) {
      const body = world.createRigidBody(desc)
      const pb: PhysBody = {
        body, mesh, mass: 0, grabbable: o.grabbable ?? false, material: o.material ?? 'wood', name: o.name ?? mesh.name,
        radius: o.radius ?? 0.2, prevPos: new THREE.Vector3(), prevQuat: new THREE.Quaternion(),
      }
      for (const cd of colliders) {
        cd.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
        cd.setContactForceEventThreshold(20)
        const c = world.createCollider(cd, body)
        byCollider.set(c.handle, pb)
      }
      pb.mass = body.mass()
      const t = body.translation()
      const r = body.rotation()
      pb.prevPos.set(t.x, t.y, t.z)
      pb.prevQuat.set(r.x, r.y, r.z, r.w)
      mesh.position.copy(pb.prevPos)
      mesh.quaternion.copy(pb.prevQuat)
      bodies.push(pb)
      return pb
    },
    fixed(colliders, pos = [0, 0, 0], quat) {
      const d = R.RigidBodyDesc.fixed().setTranslation(pos[0], pos[1], pos[2])
      if (quat) d.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      const b = world.createRigidBody(d)
      for (const cd of colliders) world.createCollider(cd, b)
      return b
    },
    byCollider: (h) => byCollider.get(h),
    raycast(o, d, max, excludeBody) {
      const ray = new R.Ray({ x: o.x, y: o.y, z: o.z }, { x: d.x, y: d.y, z: d.z })
      const hit = world.castRay(ray, max, true, undefined, undefined, undefined, excludeBody ?? undefined)
      if (!hit) return null
      const dist = hit.timeOfImpact
      return { body: byCollider.get(hit.collider.handle) ?? null, point: o.clone().addScaledVector(d, dist), dist, colliderHandle: hit.collider.handle }
    },
    awake() {
      let n = 0
      for (const b of bodies) if (b.body.isDynamic() && !b.body.isSleeping()) n++
      return n
    },
    sync() {
      const a = Math.min(1, Math.max(0, (e.sim as unknown as { alpha: number }).alpha ?? 1))
      for (const b of bodies) {
        if (b.body.isFixed()) continue
        const t = b.body.translation()
        const r = b.body.rotation()
        b.mesh.position.set(t.x, t.y, t.z).lerp(b.prevPos, 1 - a)
        tmpQ.set(r.x, r.y, r.z, r.w)
        b.mesh.quaternion.copy(b.prevQuat).slerp(tmpQ, a)
      }
    },
  }
  const tmpQ = new THREE.Quaternion()
  const tmpV = new THREE.Vector3()

  e.sim.add({
    step(dt) {
      for (const b of bodies) {
        const t = b.body.translation()
        const r = b.body.rotation()
        b.prevPos.set(t.x, t.y, t.z)
        b.prevQuat.set(r.x, r.y, r.z, r.w)
      }
      world.timestep = dt
      world.step(events)
      for (const b of bodies) b.onStep?.(dt)
      events.drainContactForceEvents((ev) => {
        const a = byCollider.get(ev.collider1())
        const c = byCollider.get(ev.collider2())
        const pb = a && c ? (a.mass < c.mass ? a : c) : (a ?? c)
        if (!pb) return
        const impulse = ev.totalForceMagnitude() * dt
        if (impulse < 0.35) return
        const now = e.sim.t
        if (now - (lastImpact.get(pb) ?? -1) < 0.08) return
        lastImpact.set(pb, now)
        const other = pb === a ? c : a
        const mat = other && other.mass < pb.mass * 4 ? pb.material : pb.material
        const tr = pb.body.translation()
        tmpV.set(tr.x, tr.y, tr.z)
        Audio.play('studio.impact', { material: MATERIAL_INDEX[mat], impulse, mass: pb.mass })
        e.bus.emit('noise', { pos: tmpV.clone(), loudness: Math.min(1.5, impulse / 3) })
      })
    },
  }, 0)
  e.sim.onPose(() => p.sync())
  return p
}
