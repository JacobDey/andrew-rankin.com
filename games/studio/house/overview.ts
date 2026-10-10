// The dollhouse overview (studio.md §4.3, §6.1): spin the diorama with inertia, zoom 22–45 m, tap a room tag
// or a room to dive in. The roof lifts while the overview is up.
import * as THREE from 'three'
import type { Engine } from '../core/engine'
import type { RoomModule, OrbitView, Rooms } from '../core/rooms'
import type { Hud } from '../hud/hud'
import { placeTag } from '../hud/hud'
import type { House } from './architecture'

const D2R = Math.PI / 180

export function createOverview(e: Engine, house: House, hud: Hud, rooms: () => Rooms): RoomModule {
  const view: OrbitView = { kind: 'orbit', target: new THREE.Vector3(-0.5, -0.4, 2.5), yaw: 200 * D2R, pitch: 32 * D2R, radius: 34, rMin: 22, rMax: 45, pMin: 8 * D2R, pMax: 70 * D2R, fov: 45 }
  const v = new THREE.Vector3()
  const ids = ['yard', 'workshop', 'hall', 'darkroom'] as const
  for (const id of ids) hud.tags[id].addEventListener('click', () => void rooms().go(id))
  // tapping the diorama itself: pick the room by the hit point
  const zones: { id: (typeof ids)[number]; box: THREE.Box3 }[] = [
    { id: 'darkroom', box: new THREE.Box3(new THREE.Vector3(-5.2, -3, -8.2), new THREE.Vector3(0.2, -0.2, -2.8)) },
    { id: 'workshop', box: new THREE.Box3(new THREE.Vector3(-12.2, -0.2, -8.2), new THREE.Vector3(-6, 3, 0.1)) },
    { id: 'hall', box: new THREE.Box3(new THREE.Vector3(-6, -0.2, -8.2), new THREE.Vector3(2.2, 3, 0.1)) },
    { id: 'yard', box: new THREE.Box3(new THREE.Vector3(-12.5, -0.5, 0.1), new THREE.Vector3(14.5, 8, 16.5)) },
  ]
  const ray = new THREE.Raycaster()
  return {
    id: 'overview',
    view,
    ambientLux: () => null,
    enter() {
      const south = e.scene.getObjectByName('south-ground')
      if (south) south.visible = false
      house.setRoofLifted(true)
      house.basementGlow.visible = true
      hud.setRoom('overview')
    },
    exit() {
      const south = e.scene.getObjectByName('south-ground')
      if (south) south.visible = true
      house.setRoofLifted(false)
      house.basementGlow.visible = false
    },
    update() {
      if (e.room !== 'overview') return
      const w = e.stage.clientWidth
      const h = e.stage.clientHeight
      for (const id of ids) {
        v.copy(house.anchors[id]).project(e.eye)
        placeTag(hud.tags[id], (v.x * 0.5 + 0.5) * w, (1 - (v.y * 0.5 + 0.5)) * h, v.z < 1)
      }
      // the basement glow reads at a constant brightness on screen whatever the exposure
      ;(house.basementGlow.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.23, 0.11).multiplyScalar(0.45 / Math.max(1e-6, e.exposure))
    },
    onPointer(ge, r) {
      if (ge.kind !== 'tap') return
      ray.ray.copy(r)
      const hits = ray.intersectObjects(e.scene.children, true)
      for (const hit of hits) {
        if (hit.object.name === 'sky' || !hit.object.visible) continue
        for (const z of zones) if (z.box.containsPoint(hit.point)) {
          void rooms().go(z.id)
          return true
        }
        break
      }
      return
    },
  }
}
