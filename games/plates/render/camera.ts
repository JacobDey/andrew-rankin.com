// games/plates/render/camera.ts — station rig (Shelf / Trays / Table), tray focus, head sway, shake.
import * as THREE from 'three'
import { ROOM, type Station, type Bath } from '../contracts'

export interface Rig {
  camera: THREE.PerspectiveCamera
  station: Station
  tray: Bath | null
  setStation(s: Station, instant?: boolean): void
  focusTray(b: Bath | null, instant?: boolean): void
  setAspect(a: number): void
  sway(nx: number, ny: number): void
  shake(px: number): void
  update(dt: number, reducedMotion: boolean): void
  settled(): boolean
  readonly shakeOffset: THREE.Vector2
  yawPitch(): [number, number]
}

export function createRig(): Rig {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 30)
  const pos = new THREE.Vector3(), look = new THREE.Vector3()
  const tPos = new THREE.Vector3(), tLook = new THREE.Vector3()
  let fovT = 50
  let aspect = 16 / 9, swayX = 0, swayY = 0, sx = 0, sy = 0, shakeAmp = 0, t = 0
  const shakeOffset = new THREE.Vector2()
  const target = (s: Station, b: Bath | null) => {
    if (b) {
      const tp = ROOM.trays[b]
      const portrait = aspect < 0.9
      tPos.set(tp[0], tp[1] + ROOM.trayFocus.dy + (portrait ? 0.12 : 0), tp[2] + ROOM.trayFocus.dz + (portrait ? 0.02 : 0))
      tLook.set(tp[0], tp[1], tp[2] - 0.02)
      return
    }
    const st = ROOM.stations[s]
    tPos.set(st.pos[0], st.pos[1], st.pos[2]); tLook.set(st.look[0], st.look[1], st.look[2])
    if (aspect < 0.9) {                        // portrait: pull back 0.25 m
      const dir = tPos.clone().sub(tLook).normalize()
      tPos.addScaledVector(dir, 0.25)
    }
  }
  const rig: Rig = {
    camera, station: 'trays', tray: null, shakeOffset,
    setStation(s, instant = false) { rig.station = s; rig.tray = null; target(s, null); fovT = aspect < 0.9 ? 70 : 50; if (instant) { pos.copy(tPos); look.copy(tLook); camera.fov = fovT; camera.updateProjectionMatrix() } },
    focusTray(b, instant = false) { rig.tray = b; if (b) rig.station = 'trays'; target(rig.station, b); fovT = b ? (aspect < 0.9 ? 46 : 28) : (aspect < 0.9 ? 70 : 50); if (instant) { pos.copy(tPos); look.copy(tLook); camera.fov = fovT; camera.updateProjectionMatrix() } },
    setAspect(a) { aspect = a; camera.aspect = a; fovT = rig.tray ? (a < 0.9 ? 46 : 28) : (a < 0.9 ? 70 : 50); camera.fov = fovT; camera.updateProjectionMatrix(); target(rig.station, rig.tray) },
    sway(nx, ny) { swayX = nx; swayY = ny },
    shake(px) { shakeAmp = Math.max(shakeAmp, px) },
    update(dt, reduced) {
      t += dt
      const k = 1 - Math.exp(-dt * 5)
      pos.lerp(tPos, k); look.lerp(tLook, k)
      if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov += (fovT - camera.fov) * k; camera.updateProjectionMatrix() }
      // head sway: follows the cursor (±2° yaw, ±1.5° pitch); reduced motion damps it
      const amp = reduced ? 0.3 : 1
      sx += (swayX - sx) * (1 - Math.exp(-dt * 3)); sy += (swayY - sy) * (1 - Math.exp(-dt * 3))
      camera.position.copy(pos)
      camera.lookAt(look)
      camera.rotateY(-sx * 2 * Math.PI / 180 * amp)
      camera.rotateX(sy * 1.5 * Math.PI / 180 * amp)
      // shake (internal pixels), e^{−t/0.25}, 18 Hz noise
      if (reduced) shakeAmp = 0
      shakeAmp *= Math.exp(-dt / 0.25)
      shakeOffset.set(Math.sin(t * 113) * shakeAmp * 0.7, Math.cos(t * 97) * shakeAmp * 0.7)
    },
    settled() { return pos.distanceTo(tPos) < 0.01 },
    yawPitch() { const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); return [e.y, e.x] },
  }
  target('trays', null); pos.copy(tPos); look.copy(tLook)
  return rig
}
