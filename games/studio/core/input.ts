// Pointer/touch → gestures (§4.1: tap 180 ms / 6 px, hold 450 ms) → picking → pickables, then the room.
// Hover shows the outline glow on pickables (desktop); touch shows it while pressed.
import * as THREE from 'three'
import { createGestures, type GestureEvent, type Gestures } from '@shared/core'
import type { Engine, Pickable, PickEvent } from './engine'

export interface RoomPointer {
  (e: GestureEvent, ray: THREE.Ray): boolean | void
}

export interface Input {
  gestures: Gestures
  ray(nx: number, ny: number): THREE.Ray
  /** handler for gestures nobody picked (orbit/look); set by the room manager */
  fallback: RoomPointer | null
  /** a high-priority handler (finder mode, panels) */
  overlay: RoomPointer | null
  hovered: Pickable | null
  pick(nx: number, ny: number): { p: Pickable; point: THREE.Vector3 } | null
  setHoverCb(cb: (p: Pickable | null) => void): void
}

export function createInput(e: Engine): Input {
  const g = createGestures(e.canvas, { tapMs: 180, tapPx: 6, holdMs: 450 })
  const rc = new THREE.Raycaster()
  rc.layers.enableAll()
  const ndc = new THREE.Vector2()
  let captured: Pickable | null = null
  let downPick: { p: Pickable; point: THREE.Vector3 } | null = null
  let hoverCb: (p: Pickable | null) => void = () => {}

  const input: Input = {
    gestures: g,
    fallback: null,
    overlay: null,
    hovered: null,
    ray(nx, ny) {
      ndc.set(nx, ny)
      rc.setFromCamera(ndc, e.eye)
      return rc.ray.clone()
    },
    pick(nx, ny) {
      ndc.set(nx, ny)
      rc.setFromCamera(ndc, e.eye)
      const objs: THREE.Object3D[] = []
      const owners = new Map<THREE.Object3D, Pickable>()
      for (const p of e.pickables) {
        if (p.room !== 'any' && p.room !== e.room) continue
        if (!isShown(p.object)) continue
        objs.push(p.object)
        owners.set(p.object, p)
      }
      const hits = rc.intersectObjects(objs, true)
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object
        while (o && !owners.has(o)) o = o.parent
        if (o) return { p: owners.get(o)!, point: h.point.clone() }
      }
      return null
    },
    setHoverCb(cb) {
      hoverCb = cb
    },
  }

  const toPick = (kind: PickEvent['kind'], ge: GestureEvent, point: THREE.Vector3): PickEvent => ({
    kind, point, ray: input.ray(ge.nx, ge.ny), dx: ge.dx, dy: ge.dy, x: ge.x, y: ge.y, vx: ge.vx, vy: ge.vy, pointerType: ge.pointerType,
  })

  g.on((ge) => {
    if (input.overlay) {
      const r = input.overlay(ge, input.ray(ge.nx, ge.ny))
      if (r) return true
    }
    switch (ge.kind) {
      case 'hover': {
        if (ge.pointerType !== 'mouse') return
        const hit = input.pick(ge.nx, ge.ny)
        const p = hit?.p ?? null
        if (p !== input.hovered) {
          input.hovered = p
          hoverCb(p)
          e.canvas.style.cursor = p ? 'pointer' : ''
        }
        return
      }
      case 'down': {
        if (ge.pointers > 1) {
          downPick = null
          break
        }
        downPick = input.pick(ge.nx, ge.ny)
        if (downPick) {
          if (ge.pointerType !== 'mouse') hoverCb(downPick.p)
          downPick.p.on(toPick('down', ge, downPick.point))
        }
        break
      }
      case 'tap':
      case 'doubleTap':
      case 'hold': {
        const hit = downPick ?? input.pick(ge.nx, ge.ny)
        if (hit && hit.p.on(toPick(ge.kind, ge, hit.point))) return true
        break
      }
      case 'dragStart': {
        if (downPick && ge.pointers <= 1) {
          if (downPick.p.on(toPick('dragStart', ge, downPick.point))) {
            captured = downPick.p
            return true
          }
        }
        break
      }
      case 'drag': {
        if (captured) {
          captured.on(toPick('drag', ge, new THREE.Vector3()))
          return true
        }
        break
      }
      case 'dragEnd': {
        if (captured) {
          captured.on(toPick('dragEnd', ge, new THREE.Vector3()))
          captured = null
          return true
        }
        break
      }
      case 'up':
      case 'cancel': {
        if (downPick) {
          downPick.p.on(toPick('up', ge, downPick.point))
          if (ge.pointerType !== 'mouse') hoverCb(null)
        }
        if (captured && ge.kind === 'cancel') {
          captured.on(toPick('dragEnd', ge, new THREE.Vector3()))
          captured = null
        }
        downPick = null
        break
      }
      default:
        break
    }
    if (input.fallback) return input.fallback(ge, input.ray(ge.nx, ge.ny)) ?? undefined
    return
  })
  return input
}

function isShown(o: THREE.Object3D): boolean {
  let c: THREE.Object3D | null = o
  while (c) {
    if (!c.visible) return false
    c = c.parent
  }
  return true
}
