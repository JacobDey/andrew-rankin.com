// A compact calibrated yard for the dev page: sun and sky in physical units (scene radiance in cd/m^2), a
// water fountain of ballistic droplets, a string of lights, a windmill and a checkered lawn. Everything is
// a pure function of time, so the photo renderer can pose it anywhere inside an exposure.

import * as THREE from 'three'
import type { PhotoScene } from '../PhotoRenderer.ts'
import type { ApertureMask } from '../spec.ts'

export interface YardOptions {
  /** 'day': sun and sky; 'dusk': dim sky, the string lights carry the picture */
  mood?: 'day' | 'dusk'
  /** thin marker posts along the lawn (for the tilt shots) */
  markers?: boolean
}

export interface Yard extends PhotoScene {
  windmill: THREE.Object3D
  lights: THREE.Mesh[]
  /** emitter positions for the string lights (world space, intensity in cd) */
  lightEmitters: { x: number; y: number; z: number; rgb: [number, number, number] }[]
  dispose(): void
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function checkerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  if (g) {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        g.fillStyle = (x + y) & 1 ? '#6f8f4e' : '#3d5a2c'
        g.fillRect(x * 16, y * 16, 16, 16)
      }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(60, 60)
  t.anisotropy = 8
  t.magFilter = THREE.NearestFilter // crisp checks, so defocus (not texture magnification) is what the eye sees
  return t
}

/** A heart-shaped Waterhouse stop (size x size, row 0 = top, > 0.5 open). */
export function heartMask(size = 64): ApertureMask {
  const data = new Uint8Array(size * size)
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const x = ((c + 0.5) / size) * 2 * 1.35 - 1.35
      const y = (1 - (r + 0.5) / size) * 2 * 1.3 - 1.05
      const a = x * x + y * y - 1
      data[r * size + c] = a * a * a - x * x * y * y * y <= 0 ? 255 : 0
    }
  return { size, data }
}

export function makeYard(o: YardOptions = {}): Yard {
  const mood = o.mood ?? 'day'
  const scene = new THREE.Scene()
  const tex = checkerTexture()
  scene.background = new THREE.Color().setRGB(mood === 'day' ? 9000 : 25, mood === 'day' ? 14000 : 40, mood === 'day' ? 24000 : 90)

  // light: lux in, cd/m^2 out (a Lambertian albedo rho under E lux renders as rho*E/pi)
  if (mood === 'day') {
    const sun = new THREE.DirectionalLight(0xfff4e0, 69813)
    sun.position.set(-8, 14, 6)
    scene.add(sun, sun.target)
    scene.add(new THREE.HemisphereLight(0xaac8ff, 0x445533, 11000))
  } else {
    scene.add(new THREE.HemisphereLight(0x6677aa, 0x221a10, 12))
  }

  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff }))
  lawn.rotation.x = -Math.PI / 2
  scene.add(lawn)

  // fountain: 360 ballistic droplets, fixed ring of launch velocities
  const R = rng(11)
  const N = 360
  const vel: THREE.Vector3[] = []
  const phase: number[] = []
  for (let i = 0; i < N; i++) {
    const az = R() * Math.PI * 2
    const el = 0.9 + R() * 0.45
    const sp = 4.2 + R() * 1.4
    vel.push(new THREE.Vector3(Math.cos(az) * Math.cos(el) * sp * 0.45, Math.sin(el) * sp, Math.sin(az) * Math.cos(el) * sp * 0.45))
    phase.push(R())
  }
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshLambertMaterial({ color: 0xe8f2ff }), N)
  drops.frustumCulled = false
  scene.add(drops)
  const m4 = new THREE.Matrix4()
  const life = 1.05
  const g = 9.81
  const fountainAt = new THREE.Vector3(0.4, 0.15, -4.2)
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.15, 24), new THREE.MeshLambertMaterial({ color: 0x777b80 }))
  basin.position.copy(fountainAt).add(new THREE.Vector3(0, -0.075, 0))
  scene.add(basin)

  // windmill: four blades turning at 4 rev/s on a post
  const windmill = new THREE.Group()
  const hub = new THREE.Group()
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.012), new THREE.MeshLambertMaterial({ color: i & 1 ? 0xd7352b : 0xf2f0ea }))
    blade.position.set(0, 0.31, 0)
    const arm = new THREE.Group()
    arm.rotation.z = (i * Math.PI) / 2
    arm.add(blade)
    hub.add(arm)
  }
  windmill.add(hub)
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.6, 8), new THREE.MeshLambertMaterial({ color: 0x6b4f2f }))
  post.position.set(0, -0.8, -0.03)
  windmill.add(post)
  windmill.position.set(-1.1, 1.6, -3.4)
  scene.add(windmill)

  // string lights on a catenary between two poles
  const lights: THREE.Mesh[] = []
  const lightEmitters: Yard['lightEmitters'] = []
  const bulbL = mood === 'day' ? 3e5 : 4e5
  const bulbGeo = new THREE.SphereGeometry(0.03, 10, 8)
  for (let i = 0; i < 22; i++) {
    const u = i / 21
    const x = -3.2 + u * 6.4
    const y = 2.55 - 0.7 * Math.sin(u * Math.PI)
    const col = new THREE.Color().setHSL((i * 0.083) % 1, 0.6, 0.62)
    const m = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: col.multiplyScalar(bulbL) }))
    m.position.set(x, y, -7.5 - 0.5 * Math.sin(u * 6))
    scene.add(m)
    lights.push(m)
    // intensity of a Lambertian sphere of luminance L and radius r: L * pi * r^2
    const I = bulbL * Math.PI * 0.03 * 0.03
    lightEmitters.push({ x: m.position.x, y: m.position.y, z: m.position.z, rgb: [col.r / bulbL * I, col.g / bulbL * I, col.b / bulbL * I] })
  }

  if (o.markers) {
    const postGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8)
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(postGeo, new THREE.MeshLambertMaterial({ color: i & 1 ? 0xd7352b : 0xf4f0e6 }))
      m.position.set(i & 1 ? 0.35 : -0.35, 0.25, -(1.9 + 0.3 * i) * 1)
      scene.add(m)
    }
  }

  // fence posts and a test wall give the lawn some scale
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), new THREE.MeshLambertMaterial({ color: 0xb8a58a }))
  wall.position.set(0, 3, -22)
  scene.add(wall)

  const setTime = (time: number): void => {
    // droplets
    for (let i = 0; i < N; i++) {
      const tau = (((time / life + phase[i]) % 1) + 1) % 1 * life
      const v = vel[i]
      m4.makeTranslation(
        fountainAt.x + v.x * tau,
        fountainAt.y + v.y * tau - 0.5 * g * tau * tau,
        fountainAt.z + v.z * tau,
      )
      drops.setMatrixAt(i, m4)
    }
    drops.instanceMatrix.needsUpdate = true
    hub.rotation.z = -time * Math.PI * 2 * 4
  }
  setTime(0)

  return {
    scene,
    setTime,
    windmill,
    lights,
    lightEmitters,
    dispose() {
      tex.dispose()
      scene.traverse((ob) => {
        const mesh = ob as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material | undefined
        if (mat) mat.dispose()
      })
    },
  }
}
