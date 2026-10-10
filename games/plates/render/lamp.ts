// games/plates/render/lamp.ts — Ottilie's darkroom lamp on its hook: two-axis pendulum, wick, the
// ruby window that slides out (GDD §5.2), its SpotLight, and the brass maker plate (story §7.12).
import * as THREE from 'three'
import { ROOM } from '../contracts'
import { roomMat, labelTexture } from './materials'

export interface Lamp {
  group: THREE.Group
  light: THREE.SpotLight
  wick: number
  windowIn: boolean
  readonly swing: number
  bump(strength?: number): void
  kick(wx: number, wz: number): void
  setWick(w: number): void
  setWindow(inLamp: boolean): void
  update(dt: number, freeze: boolean): void
  intensity(): number
  pickables(): THREE.Object3D[]
  worldPos(): THREE.Vector3
}

export function createLamp(shadowSize: number): Lamp {
  const pivot = new THREE.Group(); pivot.position.set(ROOM.lampHook[0], ROOM.lampHook[1], ROOM.lampHook[2])
  const swingX = new THREE.Group(), swingZ = new THREE.Group()
  pivot.add(swingX); swingX.add(swingZ)
  const L = ROOM.lampRod
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, L, 6), roomMat(0.3)); rod.position.y = -L / 2; swingZ.add(rod)
  const body = new THREE.Group(); body.position.y = -L - 0.18; swingZ.add(body)
  const tin = roomMat(0.06)
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.3), tin); box.castShadow = false; box.userData = { kind: 'lamp' }; body.add(box)
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 10), tin); chimney.position.y = 0.22; chimney.userData = { kind: 'lamp' }; body.add(chimney)
  // the window faces −x (toward the trays)
  const paneMatIn = roomMat(0.02), paneMatOut = roomMat(1.0, { emissive: 1.0 })
  const opening = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.3), paneMatOut); opening.rotation.y = -Math.PI / 2; opening.position.set(-0.1005, 0, 0); body.add(opening)
  const pane = new THREE.Group(); pane.position.set(-0.104, 0, 0); body.add(pane)
  const paneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.305, 0.254), paneMatIn); paneMesh.userData = { kind: 'lampTab' }; pane.add(paneMesh)
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.06), roomMat(0.5)); tab.position.y = 0.17; tab.userData = { kind: 'lampTab' }; pane.add(tab)
  // brass maker plate on the side
  const maker = labelTexture(256, 64, (x) => { x.fillStyle = '#999'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#111'; x.font = 'bold 14px Georgia, serif'; x.textAlign = 'center'; x.fillText('DARK-ROOM LAMP · JAPANNED', 128, 28); x.fillText('WINDOW 10 × 12 IN.', 128, 50) })
  const mp = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), roomMat(0.5, { map: maker })); mp.position.set(0, -0.1, 0.1505); body.add(mp)
  // brass wick key (right side)
  const key = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10), roomMat(0.5)); key.rotation.x = Math.PI / 2; key.position.set(0.05, -0.15, 0.165); key.userData = { kind: 'wick' }; body.add(key)
  // light
  const light = new THREE.SpotLight(0xffffff, 3, 4, 70 * Math.PI / 180 / 2 * 1.3, 0.6, 2)
  light.position.set(-0.1, 0, 0)
  const target = new THREE.Object3D(); target.position.set(-1, -0.7, 0); body.add(target)
  light.target = target
  light.castShadow = true; light.shadow.mapSize.set(shadowSize, shadowSize); light.shadow.bias = -0.003; light.shadow.normalBias = 0.03
  light.shadow.camera.near = 0.05; light.shadow.camera.far = 4
  body.add(light)
  // pendulum state (rad, rad/s)
  let ax = 0, az = 0, vx = 0, vz = 0, t = 0
  const lamp: Lamp = {
    group: pivot, light, wick: 0.6, windowIn: true,
    get swing() { return Math.hypot(vx, vz) },
    bump(s = 1) { vz += 0.35 * s; vx += 0.12 * s },
    kick(wx, wz) { vx += wx; vz += wz },
    setWick(w) { lamp.wick = Math.max(0.2, Math.min(1, w)) },
    setWindow(inLamp) { lamp.windowIn = inLamp; pane.visible = inLamp },
    update(dt, freeze) {
      t += dt
      if (freeze) { ax = az = vx = vz = 0 } else {
        const sub = Math.max(1, Math.ceil(dt * 240)), h = dt / sub, g = 9.81, c = 0.4
        for (let s = 0; s < sub; s++) {
          vx += (-(g / L) * Math.sin(ax) - c * vx) * h; vz += (-(g / L) * Math.sin(az) - c * vz) * h
          ax += vx * h; az += vz * h
        }
      }
      swingX.rotation.x = ax; swingZ.rotation.z = az
      const pink = freeze ? 0 : 0.5 * Math.sin(t * 2.3) + 0.3 * Math.sin(t * 5.1 + 1) + 0.2 * Math.sin(t * 11.7 + 2)
      const I0 = lamp.windowIn ? 6 : 15
      light.intensity = I0 * lamp.wick * lamp.wick * (1 + 0.06 * pink)
    },
    intensity() { return light.intensity },
    pickables() { return [box, chimney, paneMesh, tab, key] },
    worldPos() { return body.getWorldPosition(new THREE.Vector3()) },
  }
  return lamp
}
