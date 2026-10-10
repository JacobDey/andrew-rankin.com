// Room manager: the dollhouse overview, the yard orbit and the fixed stations (workshop, hall, darkroom), with
// 600 ms dolly transitions (200 ms fade under reduced motion, instant on the test profile). §4.2–4.8.
import * as THREE from 'three'
import { Audio } from '@shared/audio'
import { onGameKey, type GestureEvent } from '@shared/core'
import type { RoomId } from './contracts'
import type { Engine } from './engine'
import type { Input } from './input'

export interface OrbitView { kind: 'orbit'; target: THREE.Vector3; yaw: number; pitch: number; radius: number; rMin: number; rMax: number; pMin: number; pMax: number; fov: number }
export interface StationView { kind: 'station'; pos: THREE.Vector3; target: THREE.Vector3; fov: number; yawLimitDeg: number; pitchMinDeg: number; pitchMaxDeg: number }
export type RoomView = OrbitView | StationView

export interface RoomModule {
  id: RoomId
  view: RoomView
  ambientLux(): number | null
  enter(from: RoomId): void
  exit(to: RoomId): void
  update(dt: number): void
  onPointer?(e: GestureEvent, ray: THREE.Ray): boolean | void
}

export interface Rooms {
  current: RoomId
  go(id: RoomId, o?: { instant?: boolean }): Promise<void>
  register(r: RoomModule): void
  get(id: RoomId): RoomModule | undefined
  onChange(cb: (to: RoomId, from: RoomId) => void): () => void
  /** temporarily freeze the camera controller (finder) */
  locked: boolean
  orbit(): OrbitView | null
  setView(v: Partial<OrbitView> | Partial<StationView>): void
  /** look-around offset for stations, radians */
  look: { yaw: number; pitch: number }
  transitioning: boolean
}

const D2R = Math.PI / 180

export function createRooms(e: Engine, input: Input, fade: HTMLElement): Rooms {
  const rooms = new Map<RoomId, RoomModule>()
  const cbs = new Set<(to: RoomId, from: RoomId) => void>()
  let spin = 0 // overview inertia, rad/s
  let ratchetAcc = 0
  const look = { yaw: 0, pitch: 0 }
  let tr: { t: number; dur: number; fromPos: THREE.Vector3; fromQuat: THREE.Quaternion; fromFov: number; fade: boolean } | null = null

  const poseOf = (v: RoomView, outPos: THREE.Vector3, outQuat: THREE.Quaternion): void => {
    const m = new THREE.Matrix4()
    if (v.kind === 'orbit') {
      const cp = Math.cos(v.pitch)
      outPos.set(Math.sin(v.yaw) * cp, Math.sin(v.pitch), Math.cos(v.yaw) * cp).multiplyScalar(v.radius).add(v.target)
      m.lookAt(outPos, v.target, UP)
      outQuat.setFromRotationMatrix(m)
    } else {
      outPos.copy(v.pos)
      const dir = v.target.clone().sub(v.pos).normalize()
      const yaw0 = Math.atan2(dir.x, dir.z)
      const pitch0 = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))
      const yaw = yaw0 + look.yaw
      const pitch = THREE.MathUtils.clamp(pitch0 + look.pitch, -1.5, 1.5)
      const tgt = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).add(v.pos)
      m.lookAt(v.pos, tgt, UP)
      outQuat.setFromRotationMatrix(m)
    }
  }
  const UP = new THREE.Vector3(0, 1, 0)
  const tp = new THREE.Vector3()
  const tq = new THREE.Quaternion()

  const api: Rooms = {
    current: 'overview',
    locked: false,
    look,
    transitioning: false,
    register(r) {
      rooms.set(r.id, r)
    },
    get: (id) => rooms.get(id),
    onChange(cb) {
      cbs.add(cb)
      return () => cbs.delete(cb)
    },
    orbit() {
      const r = rooms.get(api.current)
      return r && r.view.kind === 'orbit' ? r.view : null
    },
    setView(v) {
      const r = rooms.get(api.current)
      if (!r) return
      Object.assign(r.view, v)
    },
    async go(id, o = {}) {
      const to = rooms.get(id)
      if (!to) return
      const from = api.current
      const prev = rooms.get(from)
      if (from !== id) prev?.exit(id)
      look.yaw = 0
      look.pitch = 0
      api.current = id
      e.room = id
      to.enter(from)
      e.ambientLux = to.ambientLux()
      const instant = o.instant || !e.quality.transitions
      if (instant) {
        tr = null
        api.transitioning = false
        apply(0)
        e.snapExposure()
      } else {
        tr = { t: 0, dur: e.reducedMotion ? 0.2 : 0.6, fromPos: e.eye.position.clone(), fromQuat: e.eye.quaternion.clone(), fromFov: e.eye.fov, fade: e.reducedMotion }
        api.transitioning = true
      }
      if (from !== id) {
        for (const cb of cbs) cb(id, from)
        e.bus.emit('room', { from, to: id })
      }
      if (!instant) await new Promise<void>((res) => setTimeout(res, (e.reducedMotion ? 200 : 600) + 30))
    },
  }

  function apply(dt: number): void {
    const r = rooms.get(api.current)
    if (!r) return
    poseOf(r.view, tp, tq)
    // portrait phones: widen the vertical field so the diorama and the stations still fit across
    const k = Math.max(1, 0.75 / Math.max(0.2, e.eye.aspect))
    const fov = (2 * Math.atan(Math.tan((r.view.fov * Math.PI) / 360) * k) * 180) / Math.PI
    if (tr) {
      tr.t += dt
      const u = Math.min(1, tr.t / tr.dur)
      const s = u * u * (3 - 2 * u)
      if (tr.fade) {
        fade.style.opacity = String(1 - Math.abs(u * 2 - 1))
        if (u >= 0.5) {
          e.eye.position.copy(tp)
          e.eye.quaternion.copy(tq)
          e.eye.fov = fov
        }
      } else {
        e.eye.position.lerpVectors(tr.fromPos, tp, s)
        e.eye.quaternion.slerpQuaternions(tr.fromQuat, tq, s)
        e.eye.fov = tr.fromFov + (fov - tr.fromFov) * s
      }
      if (u >= 1) {
        tr = null
        api.transitioning = false
        fade.style.opacity = '0'
      }
    } else {
      e.eye.position.copy(tp)
      e.eye.quaternion.copy(tq)
      e.eye.fov = fov
    }
    e.eye.updateProjectionMatrix()
    e.eye.updateMatrixWorld()
  }

  // overview inertia + per-room update + camera
  e.onFrame((dt) => {
    const r = rooms.get(api.current)
    if (r && r.view.kind === 'orbit' && api.current === 'overview' && !api.locked && Math.abs(spin) > 1e-4) {
      r.view.yaw += spin * dt
      ratchet(spin * dt)
      spin *= Math.exp(-2.5 * dt)
    }
    for (const rm of rooms.values()) rm.update(dt)
    if (!api.locked) apply(dt)
  }, 10)

  function ratchet(d: number): void {
    ratchetAcc += d
    if (Math.abs(ratchetAcc) > 15 * D2R) {
      ratchetAcc = 0
      Audio.play('ui.tick', {})
    }
  }

  // fallback gestures: orbit / look / zoom
  let pinchR0 = 0
  input.fallback = (ge, ray) => {
    const r = rooms.get(api.current)
    if (!r || api.locked) return
    if (r.onPointer && r.onPointer(ge, ray)) return true
    const v = r.view
    const k = 0.006
    if (ge.kind === 'drag' && ge.pointers <= 1) {
      if (v.kind === 'orbit') {
        v.yaw -= ge.dx * k
        v.pitch = THREE.MathUtils.clamp(v.pitch + ge.dy * k, v.pMin, v.pMax)
        if (api.current === 'overview') ratchet(-ge.dx * k)
      } else {
        look.yaw = THREE.MathUtils.clamp(look.yaw + ge.dx * k * 0.6, -v.yawLimitDeg * D2R, v.yawLimitDeg * D2R)
        look.pitch = THREE.MathUtils.clamp(look.pitch + ge.dy * k * 0.6, v.pitchMinDeg * D2R, v.pitchMaxDeg * D2R)
      }
      return true
    }
    if (ge.kind === 'dragEnd' && v.kind === 'orbit' && api.current === 'overview') {
      spin = THREE.MathUtils.clamp(-ge.vx * k, -4, 4)
      return true
    }
    if (ge.kind === 'dragStart') {
      spin = 0
      return true
    }
    if (ge.kind === 'wheel' && v.kind === 'orbit') {
      v.radius = THREE.MathUtils.clamp(v.radius * Math.exp(ge.deltaY * 0.0012), v.rMin, v.rMax)
      return true
    }
    if (ge.kind === 'pinch' && v.kind === 'orbit') {
      if (!pinchR0) pinchR0 = v.radius
      v.radius = THREE.MathUtils.clamp(pinchR0 / Math.max(0.2, ge.scale), v.rMin, v.rMax)
      return true
    }
    if (ge.kind === 'up') pinchR0 = 0
    return
  }

  onGameKey((ev) => {
    const r = rooms.get(api.current)
    if (!r || api.locked) return
    const v = r.view
    const step = 0.08
    if (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight' || ev.code === 'ArrowUp' || ev.code === 'ArrowDown') {
      const dx = ev.code === 'ArrowLeft' ? -1 : ev.code === 'ArrowRight' ? 1 : 0
      const dy = ev.code === 'ArrowUp' ? 1 : ev.code === 'ArrowDown' ? -1 : 0
      if (v.kind === 'orbit') {
        v.yaw -= dx * step
        v.pitch = THREE.MathUtils.clamp(v.pitch + dy * step * 0.6, v.pMin, v.pMax)
      } else {
        look.yaw = THREE.MathUtils.clamp(look.yaw - dx * step, -v.yawLimitDeg * D2R, v.yawLimitDeg * D2R)
        look.pitch = THREE.MathUtils.clamp(look.pitch + dy * step, v.pitchMinDeg * D2R, v.pitchMaxDeg * D2R)
      }
      ev.preventDefault()
    } else if ((ev.key === '+' || ev.key === '=' || ev.key === '-') && v.kind === 'orbit') {
      v.radius = THREE.MathUtils.clamp(v.radius * (ev.key === '-' ? 1.12 : 1 / 1.12), v.rMin, v.rMax)
    }
  })

  return api
}
