/**
 * Static backyard environment builders: lawn (mowing stripes + wet map), instanced grass,
 * picket fence, the house and garage, the patio, the maple (with swing branch), background
 * trees and the sky. Each builder adds visuals to a Group and fixed colliders to the world.
 */
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  Quaternion,
  RedFormat,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
  Vector3,
  type IUniform,
  type Material,
} from 'three'
import type { RigidBody } from '@dimforge/rapier3d-compat'
import { Sky } from 'three/addons/objects/Sky.js'
import { Layer, groups, type PhysicsWorld } from './physics-world'
import { barkTexture, clapboardTexture, concreteTexture, lawnTexture, picketTexture } from './textures'
import { WIND_GLSL, type WindField } from './wind'

export interface YardBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export const YARD: YardBounds = { minX: -12, maxX: 12, minZ: -8.5, maxZ: 10 }
export const PATIO = { minX: -9, maxX: -2, minZ: -8.5, maxZ: -4.6, top: 0.1 }

const SG = () => groups(Layer.STATIC, Layer.ALL)

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

/** Shared wind uniforms for every swaying shader. Update `uWindTime` each frame. */
export function windUniforms(wind: WindField): Record<string, IUniform> {
  return {
    uWindTime: { value: 0 },
    uWindDir: { value: new Vector2(wind.dir.x, wind.dir.z) },
    uWindSpeed: { value: wind.speed },
    uWindGust: { value: wind.gustiness },
    uWindScale: { value: wind.gustScale },
  }
}

// =========================================================================== wetness

/** A low-res wet/dry map over the yard: sprinkler droplets deposit, the sun dries it. */
export class WetnessMap {
  readonly texture: DataTexture
  readonly w: number
  readonly h: number
  private data: Float32Array
  private bytes: Uint8Array
  private dirty = false

  constructor(readonly bounds: YardBounds, w = 96, h = 74) {
    this.w = w
    this.h = h
    this.data = new Float32Array(w * h)
    this.bytes = new Uint8Array(w * h)
    this.texture = new DataTexture(this.bytes, w, h, RedFormat, UnsignedByteType)
    this.texture.magFilter = LinearFilter
    this.texture.minFilter = LinearFilter
    this.texture.needsUpdate = true
  }

  deposit(x: number, z: number, amount = 0.02): void {
    const b = this.bounds
    const u = (x - b.minX) / (b.maxX - b.minX)
    const v = (z - b.minZ) / (b.maxZ - b.minZ)
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return
    const i = (v * this.h | 0) * this.w + (u * this.w | 0)
    this.data[i] = Math.min(1, this.data[i] + amount)
    this.dirty = true
  }

  /** Evaporation. `rate` = fraction per second at full sun. */
  dry(dt: number, rate: number): void {
    const k = Math.exp(-rate * dt)
    const d = this.data
    let any = false
    for (let i = 0; i < d.length; i++) {
      if (d[i] > 0.001) {
        d[i] *= k
        any = true
      } else d[i] = 0
    }
    if (any) this.dirty = true
  }

  /** Upload to the GPU if changed (call at most a few times a second). */
  flush(): void {
    if (!this.dirty) return
    for (let i = 0; i < this.data.length; i++) this.bytes[i] = (this.data[i] * 255) | 0
    this.texture.needsUpdate = true
    this.dirty = false
  }

  at(x: number, z: number): number {
    const b = this.bounds
    const u = (x - b.minX) / (b.maxX - b.minX)
    const v = (z - b.minZ) / (b.maxZ - b.minZ)
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0
    return this.data[(v * this.h | 0) * this.w + (u * this.w | 0)]
  }
}

// =========================================================================== ground

export function createGround(pw: PhysicsWorld, parent: Group, wet: WetnessMap): Mesh {
  const R = pw.R
  const size = 220
  const map = lawnTexture()
  map.repeat.set(size / 3.2, size / 3.2)
  const mat = new MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 })
  const b = wet.bounds
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = { value: wet.texture }
    sh.uniforms.uYard = { value: new Vector3(b.minX, b.minZ, 0).set(b.minX, b.minZ, 0) }
    sh.uniforms.uYardSize = { value: new Vector2(b.maxX - b.minX, b.maxZ - b.minZ) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
uniform sampler2D uWet;
uniform vec3 uYard;
uniform vec2 uYardSize;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
vec2 yuv = (vWPos.xz - uYard.xy) / uYardSize;
float inYard = step(0.0, yuv.x) * step(yuv.x, 1.0) * step(0.0, yuv.y) * step(yuv.y, 1.0);
// Mowing stripes, north-south passes 0.9 m wide.
float stripe = step(0.5, fract((vWPos.x + 12.0) / 1.8));
diffuseColor.rgb *= mix(1.0, mix(0.9, 1.08, stripe), inYard);
// Beyond the fence: a touch drier, less kept.
diffuseColor.rgb = mix(diffuseColor.rgb * vec3(1.05, 1.0, 0.85), diffuseColor.rgb, inYard);
float wet = texture2D(uWet, yuv).r * inYard;
diffuseColor.rgb *= mix(1.0, 0.62, wet);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.32, wet);`,
      )
  }
  const geo = new PlaneGeometry(size, size, 1, 1)
  geo.rotateX(-Math.PI / 2)
  const m = new Mesh(geo, mat)
  m.receiveShadow = true
  parent.add(m)
  // A thick slab is more robust than a halfspace for fast props (no tunnelling at the edge).
  pw.addStatic([R.ColliderDesc.cuboid(size / 2, 1, size / 2).setFriction(0.9).setRestitution(0.1).setCollisionGroups(SG())], 0, -1, 0)
  return m
}

// =========================================================================== grass

function tuftGeometry(): BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  let v = 0
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI + 0.3 * b
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const w = 0.012
    const h = 0.1 + b * 0.015
    const lean = 0.025 * (b - 1)
    const pts: [number, number, number][] = [
      [-w, 0, 0], [w, 0, 0], [-w * 0.6, h * 0.55, lean * 0.4], [w * 0.6, h * 0.55, lean * 0.4], [0, h, lean],
    ]
    for (const [x, y, z] of pts) {
      // rotate around Y
      pos.push(x * ca - z * sa, y, x * sa + z * ca)
      const t = y / h
      col.push(0.72 + 0.4 * t, 0.78 + 0.34 * t, 0.66 + 0.3 * t)
    }
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2, v + 2, v + 3, v + 4)
    v += 5
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  // Up-facing normals: blades light like the lawn they grow from (no dark backsides).
  const n = new Float32Array((pos.length / 3) * 3)
  for (let i = 0; i < n.length; i += 3) n[i + 1] = 1
  g.setAttribute('normal', new BufferAttribute(n, 3))
  g.setIndex(idx)
  return g
}

export function createGrass(parent: Group, count: number, uniforms: Record<string, IUniform>, avoid: (x: number, z: number) => boolean): InstancedMesh | null {
  if (count <= 0) return null
  const mat = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}`)
      .replace(
        'mvPosition = modelViewMatrix * mvPosition;',
        `{
  float hgt = clamp(position.y / 0.13, 0.0, 1.0);
  vec2 xz = mvPosition.xz;
  float g = windGust(xz);
  float flutter = sin(uWindTime * 4.0 + xz.x * 2.3 + xz.y * 1.9) * 0.35;
  vec2 sway = uWindDir * (g + flutter) * uWindSpeed * 0.018 * hgt * hgt;
  mvPosition.xz += sway;
  mvPosition.y -= dot(sway, sway) * 2.0;
}
mvPosition = modelViewMatrix * mvPosition;`,
      )
  }
  const inst = new InstancedMesh(tuftGeometry(), mat, count)
  const r = seeded(4242)
  const m = new Matrix4()
  const q = new Quaternion()
  const s = new Vector3()
  const p = new Vector3()
  const c = new Color()
  const up = new Vector3(0, 1, 0)
  let n = 0
  let guard = 0
  while (n < count && guard++ < count * 4) {
    const x = YARD.minX + 0.15 + r() * (YARD.maxX - YARD.minX - 0.3)
    const z = YARD.minZ + 0.15 + r() * (YARD.maxZ - YARD.minZ - 0.3)
    if (avoid(x, z)) continue
    q.setFromAxisAngle(up, r() * Math.PI * 2)
    // Mown lawn: 5-9 cm tufts.
    const sc = 0.65 + r() * 0.5
    s.set(sc, sc * (0.45 + r() * 0.3), sc)
    p.set(x, 0, z)
    m.compose(p, q, s)
    inst.setMatrixAt(n, m)
    // Late-August lawn: a little tired, some straw.
    c.setHSL(0.19 + r() * 0.07, 0.32 + r() * 0.16, 0.34 + r() * 0.12)
    inst.setColorAt(n, c)
    n++
  }
  inst.count = n
  inst.receiveShadow = true
  inst.castShadow = false
  inst.frustumCulled = false
  parent.add(inst)
  return inst
}

// =========================================================================== fence

function picketGeometry(w: number, h: number, t: number): BufferGeometry {
  const g = new BoxGeometry(w, h, t)
  // Point the top: pull the top-centre... cheap trick: scale the top vertices inward on X.
  const pos = g.getAttribute('position') as BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > h / 2 - 1e-4) pos.setX(i, pos.getX(i) * 0.08)
  }
  g.translate(0, h / 2, 0)
  g.computeVertexNormals()
  return g
}

export function createFence(pw: PhysicsWorld, parent: Group): void {
  const R = pw.R
  const H = 1.1
  const pw_ = 0.085
  const step = 0.15
  const tex = picketTexture()
  const mat = new MeshStandardMaterial({ map: tex, roughness: 0.85 })
  // Sides: west (x=minX), south (z=maxZ), east (x=maxX), and two short runs by the house/garage.
  const runs: [Vector3, Vector3][] = [
    [new Vector3(YARD.minX, 0, YARD.minZ), new Vector3(YARD.minX, 0, YARD.maxZ)],
    [new Vector3(YARD.minX, 0, YARD.maxZ), new Vector3(YARD.maxX, 0, YARD.maxZ)],
    [new Vector3(YARD.maxX, 0, YARD.maxZ), new Vector3(YARD.maxX, 0, YARD.minZ)],
    [new Vector3(4.2, 0, YARD.minZ), new Vector3(5.6, 0, YARD.minZ)],
  ]
  let total = 0
  for (const [a, b] of runs) total += Math.floor(a.distanceTo(b) / step) + 1
  const pickets = new InstancedMesh(picketGeometry(pw_, H, 0.022), mat, total)
  const rails = new Group()
  const railMat = new MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.8 })
  const postMat = new MeshStandardMaterial({ color: 0xe4ddca, roughness: 0.8 })
  const o = new Object3D()
  let n = 0
  for (const [a, b] of runs) {
    const len = a.distanceTo(b)
    const dir = new Vector3().subVectors(b, a).normalize()
    const yaw = Math.atan2(dir.x, dir.z)
    const k = Math.floor(len / step) + 1
    let seed = n * 7 + 3
    for (let i = 0; i < k; i++) {
      seed = (seed * 16807) % 2147483647
      const jitter = (seed / 2147483647 - 0.5) * 0.05
      o.position.copy(a).addScaledVector(dir, i * step)
      o.position.y = -0.05 + jitter * 0.4
      o.rotation.set(jitter * 0.15, yaw + Math.PI / 2, 0)
      o.scale.set(1, 1 + jitter, 1)
      o.updateMatrix()
      pickets.setMatrixAt(n++, o.matrix)
    }
    // Rails on the inside face, and posts every 2.4 m.
    const mid = new Vector3().addVectors(a, b).multiplyScalar(0.5)
    const inward = new Vector3(-dir.z, 0, dir.x).multiplyScalar(0.035)
    for (const y of [0.28, 0.82]) {
      const rail = new Mesh(new BoxGeometry(0.05, 0.08, len), railMat)
      rail.position.copy(mid).add(inward).setY(y)
      rail.rotation.y = yaw
      rail.castShadow = true
      rail.receiveShadow = true
      rails.add(rail)
    }
    for (let d = 0; d <= len + 0.01; d += 2.4) {
      const post = new Mesh(new BoxGeometry(0.09, 1.2, 0.09), postMat)
      post.position.copy(a).addScaledVector(dir, Math.min(d, len)).add(inward.clone().multiplyScalar(2)).setY(0.6)
      post.castShadow = true
      rails.add(post)
    }
    // One collider per run.
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
    pw.addStatic([R.ColliderDesc.cuboid(0.06, H / 2 + 0.2, len / 2).setCollisionGroups(SG())], mid.x, H / 2 + 0.2, mid.z, q)
  }
  pickets.count = n
  pickets.castShadow = true
  pickets.receiveShadow = true
  parent.add(pickets, rails)
}

// =========================================================================== buildings

function gableRoof(width: number, depth: number, rise: number, over: number, mat: Material): Mesh {
  // Ridge along X. Two sloped quads + two gable triangles.
  const w = width / 2 + over
  const d = depth / 2 + over
  const v = [
    [-w, 0, -d], [w, 0, -d], [w, rise, 0], [-w, rise, 0],
    [-w, rise, 0], [w, rise, 0], [w, 0, d], [-w, 0, d],
  ]
  const pos: number[] = []
  const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c)
  tri(v[0], v[3], v[1]); tri(v[1], v[3], v[2])
  tri(v[4], v[7], v[5]); tri(v[5], v[7], v[6])
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  const uv: number[] = []
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 0.5, pos[i + 2] * 0.5 + pos[i + 1] * 0.5)
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  const m = new Mesh(g, mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function gableEnds(width: number, depth: number, rise: number, mat: Material): Mesh {
  const d = depth / 2
  const w = width / 2
  const pos = [
    -w, 0, -d, -w, 0, d, -w, rise, 0,
    w, 0, d, w, 0, -d, w, rise, 0,
  ]
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 1, 0.5, 0, 0, 2, 0, 1, 0.5], 2))
  g.computeVertexNormals()
  const m = new Mesh(g, mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

let winMats: { curtain: Material; room: Material } | undefined

function windowMesh(w: number, h: number, frame: Material, glass: Material, mullions = true): Group {
  const g = new Group()
  const t = 0.05
  // Curtains a hand's width behind the glass, so windows read as rooms, not holes.
  winMats ??= {
    curtain: new MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.9 }),
    room: new MeshStandardMaterial({ color: 0x3a3631, roughness: 1 }),
  }
  for (const sx of [-1, 1]) {
    const c = new Mesh(new PlaneGeometry(w * 0.32, h * 0.96), winMats.curtain)
    c.position.set(sx * w * 0.33, 0, -0.08)
    g.add(c)
  }
  const room = new Mesh(new PlaneGeometry(w, h), winMats.room)
  room.position.z = -0.12
  g.add(room)
  const glassM = new Mesh(new PlaneGeometry(w, h), glass)
  g.add(glassM)
  const add = (bw: number, bh: number, x: number, y: number) => {
    const m = new Mesh(new BoxGeometry(bw, bh, t), frame)
    m.position.set(x, y, 0.02)
    m.castShadow = true
    g.add(m)
  }
  add(w + 0.12, 0.07, 0, h / 2 + 0.03)
  add(w + 0.2, 0.06, 0, -h / 2 - 0.03)
  add(0.07, h, -w / 2 - 0.03, 0)
  add(0.07, h, w / 2 + 0.03, 0)
  if (mullions) {
    add(0.035, h, 0, 0)
    add(w, 0.035, 0, 0)
  }
  return g
}

export function createHouse(pw: PhysicsWorld, parent: Group): { porchLightPos: Vector3; door: Vector3 } {
  const R = pw.R
  const clap = clapboardTexture()
  const W = 16.4
  const D = 8.5
  const H = 3.1
  const cx = -3.8
  const cz = YARD.minZ - D / 2
  const wallTex = clap.clone()
  wallTex.repeat.set(W / 3, H / 3)
  wallTex.needsUpdate = true
  const wall = new MeshStandardMaterial({ map: wallTex, roughness: 0.85 })
  const house = new Mesh(new BoxGeometry(W, H, D), wall)
  house.position.set(cx, H / 2 + 0.25, cz)
  house.castShadow = true
  house.receiveShadow = true
  parent.add(house)
  // Foundation
  const found = new Mesh(new BoxGeometry(W + 0.1, 0.3, D + 0.1), new MeshStandardMaterial({ color: 0x9a948a, roughness: 0.95 }))
  found.position.set(cx, 0.15, cz)
  found.receiveShadow = true
  parent.add(found)
  const shingle = new MeshStandardMaterial({ color: 0x4a4644, roughness: 0.9 })
  const roof = gableRoof(W, D, 2.4, 0.45, shingle)
  roof.position.set(cx, H + 0.25, cz)
  parent.add(roof)
  const ends = gableEnds(W, D, 2.4, wall)
  ends.position.set(cx, H + 0.25, cz)
  parent.add(ends)
  // Windows + back door on the yard side (z = YARD.minZ).
  const frame = new MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.6 })
  // Without an environment map metallic glass renders black; fake the sky reflection instead.
  const glass = new MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.38 })
  const face = YARD.minZ + 0.005
  for (const x of [-10.5, -8.2, -1.2, 1.6]) {
    const win = windowMesh(1.1, 1.25, frame, glass)
    win.position.set(x, 1.85, face)
    parent.add(win)
  }
  // Kitchen window over the sink
  const kw = windowMesh(1.5, 0.9, frame, glass)
  kw.position.set(-3.6, 2.0, face)
  parent.add(kw)
  // Back door
  const doorX = -5.6
  const door = new Mesh(new BoxGeometry(0.95, 2.05, 0.06), new MeshStandardMaterial({ color: 0x3e5f73, roughness: 0.55 }))
  door.position.set(doorX, 0.25 + 1.025, face + 0.01)
  door.castShadow = true
  parent.add(door)
  const doorWin = windowMesh(0.5, 0.6, frame, glass, false)
  doorWin.position.set(doorX, 1.75, face + 0.05)
  parent.add(doorWin)
  // Porch lamp
  const lamp = new Mesh(new CylinderGeometry(0.07, 0.09, 0.2, 10), new MeshStandardMaterial({ color: 0xfff1c9, emissive: 0x000000, roughness: 0.4 }))
  lamp.name = 'porch-lamp'
  lamp.userData.noMerge = true // its emissive follows the time of day
  lamp.position.set(doorX + 0.85, 2.35, face + 0.1)
  parent.add(lamp)
  pw.addStatic([R.ColliderDesc.cuboid(W / 2, (H + 2.6) / 2, D / 2).setCollisionGroups(SG())], cx, (H + 2.6) / 2, cz)

  // Detached garage (the workshop) on the north-east.
  const GW = 6.2
  const GD = 6.6
  const GH = 2.8
  const gx = 9
  const gz = YARD.minZ - GD / 2 - 0.2
  const gTex = clap.clone()
  gTex.repeat.set(GW / 3, GH / 3)
  gTex.needsUpdate = true
  const gWall = new MeshStandardMaterial({ map: gTex, roughness: 0.85, color: 0xe8e0cc })
  const garage = new Mesh(new BoxGeometry(GW, GH, GD), gWall)
  garage.position.set(gx, GH / 2 + 0.1, gz)
  garage.castShadow = true
  garage.receiveShadow = true
  parent.add(garage)
  const groof = gableRoof(GD, GW, 1.6, 0.35, shingle)
  groof.rotation.y = Math.PI / 2
  groof.position.set(gx, GH + 0.1, gz)
  parent.add(groof)
  const gends = gableEnds(GD, GW, 1.6, gWall)
  gends.rotation.y = Math.PI / 2
  gends.position.set(gx, GH + 0.1, gz)
  parent.add(gends)
  const gwin = windowMesh(1.2, 0.8, frame, glass)
  gwin.position.set(gx + 0.6, 1.6, gz + GD / 2 + 0.005)
  parent.add(gwin)
  const sideDoor = new Mesh(new BoxGeometry(0.9, 2.0, 0.06), new MeshStandardMaterial({ color: 0x7a3324, roughness: 0.7 }))
  sideDoor.position.set(gx - 1.7, 1.1, gz + GD / 2 + 0.01)
  parent.add(sideDoor)
  pw.addStatic([R.ColliderDesc.cuboid(GW / 2, (GH + 1.6) / 2, GD / 2).setCollisionGroups(SG())], gx, (GH + 1.6) / 2, gz)

  return { porchLightPos: new Vector3(doorX + 0.85, 2.2, face + 0.4), door: new Vector3(doorX, 0, face) }
}

export function createPatio(pw: PhysicsWorld, parent: Group): void {
  const R = pw.R
  const w = PATIO.maxX - PATIO.minX
  const d = PATIO.maxZ - PATIO.minZ
  const tex = concreteTexture()
  tex.repeat.set(w / 1.2, d / 1.2)
  const slab = new Mesh(new BoxGeometry(w, PATIO.top, d), new MeshStandardMaterial({ map: tex, roughness: 0.9 }))
  slab.position.set((PATIO.minX + PATIO.maxX) / 2, PATIO.top / 2, (PATIO.minZ + PATIO.maxZ) / 2)
  slab.receiveShadow = true
  parent.add(slab)
  pw.addStatic(
    [R.ColliderDesc.cuboid(w / 2, PATIO.top / 2, d / 2).setFriction(0.8).setCollisionGroups(SG())],
    slab.position.x, slab.position.y, slab.position.z,
  )
}

// =========================================================================== tree

function leafTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const x = c.getContext('2d')!
  const r = seeded(17)
  for (let i = 0; i < 9; i++) {
    const cx = 20 + r() * 88
    const cy = 20 + r() * 88
    const s = 13 + r() * 10
    const hue = 85 + r() * 30
    x.fillStyle = `hsl(${hue}, ${45 + r() * 20}%, ${28 + r() * 16}%)`
    x.save()
    x.translate(cx, cy)
    x.rotate(r() * Math.PI * 2)
    // Five-lobed maple-ish leaf
    x.beginPath()
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2
      const rr = k % 2 === 0 ? s : s * 0.55
      x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    x.closePath()
    x.fill()
    x.restore()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export interface Tree {
  body: RigidBody
  /** World point under the swing branch where a rope can be tied. */
  swingAnchor: Vector3
  leaves: InstancedMesh
}

export function createMaple(pw: PhysicsWorld, parent: Group, base: Vector3, leafCount: number, uniforms: Record<string, IUniform>): Tree {
  const R = pw.R
  const bark = barkTexture()
  bark.repeat.set(2, 3)
  const barkMat = new MeshStandardMaterial({ map: bark, roughness: 0.95 })
  const g = new Group()
  g.position.copy(base)
  parent.add(g)
  const limb = (from: Vector3, to: Vector3, r0: number, r1: number) => {
    const len = from.distanceTo(to)
    const m = new Mesh(new CylinderGeometry(r1, r0, len, 12, 1), barkMat)
    m.position.copy(from).add(to).multiplyScalar(0.5)
    m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize())
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  const fork = new Vector3(0, 2.7, 0)
  limb(new Vector3(0, -0.1, 0), fork, 0.32, 0.24)
  // Root flare
  const flare = new Mesh(new CylinderGeometry(0.3, 0.48, 0.3, 12), barkMat)
  flare.position.y = 0.12
  flare.castShadow = true
  g.add(flare)
  // The swing branch: out to the west, nearly level.
  const swingEnd = new Vector3(-3.1, 3.55, 0.1)
  limb(fork, new Vector3(-1.6, 3.3, 0.05), 0.2, 0.15)
  limb(new Vector3(-1.6, 3.3, 0.05), swingEnd, 0.15, 0.08)
  const ups: Vector3[] = [new Vector3(0.9, 5.2, -0.6), new Vector3(0.2, 5.8, 0.8), new Vector3(1.6, 4.6, 0.9), new Vector3(-0.6, 5.0, -0.9)]
  for (const u of ups) limb(fork, u, 0.2, 0.08)

  // Crown: dark inner blobs (shadow mass) + swaying leaf cards around them.
  const blobMat = new MeshLambertMaterial({ color: 0x2f4f22 })
  const centers = [
    new Vector3(0.4, 5.2, 0), new Vector3(-1.6, 4.6, 0.2), new Vector3(1.6, 4.7, 0.4), new Vector3(0.3, 6.1, 0.4),
    new Vector3(-0.6, 5.3, -1.1), new Vector3(1.0, 5.3, 1.3), new Vector3(-2.6, 4.3, 0.0),
  ]
  const radii = [1.8, 1.4, 1.4, 1.3, 1.3, 1.3, 1.0]
  for (let i = 0; i < centers.length; i++) {
    const geo = new IcosahedronGeometry(radii[i] * 0.78, 1)
    const blob = new Mesh(geo, blobMat)
    blob.position.copy(centers[i])
    blob.castShadow = true
    blob.receiveShadow = true
    g.add(blob)
  }
  const leafMat = new MeshLambertMaterial({ map: leafTexture(), alphaTest: 0.5, side: DoubleSide })
  leafMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}`)
      .replace(
        'mvPosition = modelViewMatrix * mvPosition;',
        `{
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  vec3 wp = (modelMatrix * vec4(ip, 1.0)).xyz;
  float g = windGust(wp.xz);
  float f = sin(uWindTime * 5.0 + wp.x * 3.1 + wp.y * 2.7 + wp.z * 1.3);
  mvPosition.xz += uWindDir * g * uWindSpeed * 0.02 * (0.5 + 0.5 * f);
  mvPosition.y += f * 0.02 * g;
}
mvPosition = modelViewMatrix * mvPosition;`,
      )
  }
  const leaves = new InstancedMesh(new PlaneGeometry(0.55, 0.55), leafMat, Math.max(1, leafCount))
  const r = seeded(99)
  const o = new Object3D()
  const c = new Color()
  for (let i = 0; i < leafCount; i++) {
    const k = Math.floor(r() * centers.length)
    const dir = new Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize()
    const rr = radii[k] * (0.75 + r() * 0.35)
    o.position.copy(centers[k]).addScaledVector(dir, rr)
    o.lookAt(o.position.clone().add(dir).add(new Vector3(0, 0.6, 0)))
    o.rotateZ(r() * Math.PI * 2)
    o.scale.setScalar(0.8 + r() * 0.6)
    o.updateMatrix()
    leaves.setMatrixAt(i, o.matrix)
    c.setHSL(0.24 + r() * 0.06, 0.5, 0.75 + r() * 0.35)
    leaves.setColorAt(i, c)
  }
  leaves.count = leafCount
  leaves.castShadow = true
  leaves.receiveShadow = true
  leaves.frustumCulled = false
  g.add(leaves)

  // Physics: trunk capsule and the swing branch (ropes don't collide with STATIC).
  const body = pw.addStatic(
    [
      R.ColliderDesc.capsule(1.35, 0.3).setTranslation(0, 1.35 + 0.3, 0).setCollisionGroups(SG()),
      // Axis rises ~15 deg toward -X: Rz(1.30) maps +Y to (-0.96, 0.27, 0).
      R.ColliderDesc.capsule(1.5, 0.13)
        .setTranslation(-1.55, 3.12, 0.05)
        .setRotation({ x: 0, y: 0, z: Math.sin(0.65), w: Math.cos(0.65) })
        .setCollisionGroups(SG()),
    ],
    base.x, base.y, base.z,
  )
  const swingAnchor = new Vector3(base.x - 2.35, base.y + 3.36, base.z + 0.08)
  return { body, swingAnchor, leaves }
}

/** Neighbourhood backdrop: trees and hedges beyond the fence. Visual only. */
export function createBackdrop(parent: Group): void {
  const r = seeded(555)
  const trunk = new MeshLambertMaterial({ color: 0x4b3b2d })
  const greens = [0x35562a, 0x2c4a26, 0x46632f, 0x3b5a35].map((c) => new MeshLambertMaterial({ color: c }))
  const crownGeo = new IcosahedronGeometry(1, 1)
  const coneGeo = new ConeGeometry(1, 1, 8)
  const trunkGeo = new CylinderGeometry(0.15, 0.22, 1, 6)
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2
    const d = 22 + r() * 40
    const x = Math.cos(a) * d * 1.1
    const z = Math.sin(a) * d
    if (z < -12 && x > -14 && x < 14) continue // keep the house roofline clear
    const h = 5 + r() * 7
    const t = new Mesh(trunkGeo, trunk)
    t.scale.set(1, h * 0.4, 1)
    t.position.set(x, h * 0.2, z)
    parent.add(t)
    const conifer = r() < 0.3
    const crown = new Mesh(conifer ? coneGeo : crownGeo, greens[i % greens.length])
    if (conifer) {
      crown.scale.set(h * 0.25, h * 0.9, h * 0.25)
      crown.position.set(x, h * 0.55, z)
    } else {
      crown.scale.set(h * 0.33, h * 0.3, h * 0.33)
      crown.position.set(x, h * 0.65, z)
    }
    crown.castShadow = d < 30
    parent.add(crown)
  }
  // Hedge just past the south fence
  const hedge = new Mesh(new BoxGeometry(30, 1.6, 1.2), greens[1])
  hedge.position.set(0, 0.8, YARD.maxZ + 1.4)
  hedge.castShadow = true
  hedge.receiveShadow = true
  parent.add(hedge)
  // Neighbour houses (low boxes with roofs), beyond the east and west fences.
  const sidingTex = clapboardTexture()
  const roofMat = new MeshLambertMaterial({ color: 0x5b4b45 })
  const winMat = new MeshLambertMaterial({ color: 0x4a5560 })
  const tints = [0xcfd8cf, 0xe6d3b3, 0xc9d3dc, 0xe8dfcf]
  let ti = 0
  for (const [x, z, w, d] of [[-25, -4, 11, 9], [26, 2, 9, 10], [-6, 31, 12, 8], [15, 33, 9, 9]] as const) {
    const t = sidingTex.clone()
    t.repeat.set(w / 3, 1)
    t.needsUpdate = true
    const h = new Mesh(new BoxGeometry(w, 3, d), new MeshLambertMaterial({ map: t, color: tints[ti++ % tints.length] }))
    h.position.set(x, 1.5, z)
    h.castShadow = true
    parent.add(h)
    const rf = gableRoof(w, d, 2, 0.3, roofMat)
    rf.position.set(x, 3, z)
    parent.add(rf)
    const ends = gableEnds(w, d, 2, h.material as Material)
    ends.position.set(x, 3, z)
    parent.add(ends)
    // A few windows on the faces we can see from the yard.
    for (let k = -1; k <= 1; k += 2) {
      for (const face of [-1, 1]) {
        const win = new Mesh(new PlaneGeometry(1.1, 1.0), winMat)
        win.position.set(x + k * w * 0.25, 1.7, z + face * (d / 2 + 0.01))
        if (face < 0) win.rotation.y = Math.PI
        parent.add(win)
        const sw = new Mesh(new PlaneGeometry(1.0, 1.1), winMat)
        sw.position.set(x + face * (w / 2 + 0.01), 1.7, z + k * d * 0.25)
        sw.rotation.y = face * Math.PI / 2
        parent.add(sw)
      }
    }
  }
}

// =========================================================================== sky

export interface SkyRig {
  object: Mesh
  setSun(dir: Vector3, elevation: number, time: number): void
  horizonColor: Color
}

export function createSky(parent: Group, useShader: boolean, clouds: boolean): SkyRig {
  if (useShader) {
    const sky = new Sky()
    sky.scale.setScalar(900)
    const u = sky.material.uniforms
    u.turbidity.value = 3.2
    u.rayleigh.value = 1.2
    u.mieCoefficient.value = 0.005
    u.mieDirectionalG.value = 0.82
    u.cloudCoverage.value = clouds ? 0.32 : 0
    u.cloudDensity.value = 0.35
    u.cloudElevation.value = 0.55
    parent.add(sky)
    const horizon = new Color()
    return {
      object: sky,
      horizonColor: horizon,
      setSun(dir, elevation, time) {
        u.sunPosition.value.copy(dir)
        // Redder, hazier skies near the horizon.
        const low = 1 - Math.min(1, Math.max(0, elevation / 0.35))
        u.rayleigh.value = 1.2 + low * 1.6
        u.turbidity.value = 3.2 + low * 4
        u.time.value = time
        const day = Math.max(0, Math.min(1, (elevation + 0.1) / 0.4))
        horizon.setRGB(0.55 + 0.35 * day + low * 0.25 * day, 0.62 + 0.25 * day, 0.75 + 0.2 * day).multiplyScalar(0.15 + 0.85 * day)
      },
    }
  }
  // Cheap gradient dome.
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: new Color(0x5b8fd1) }, uHorizon: { value: new Color(0xcfe3f2) }, uSun: { value: new Vector3(0, 1, 0) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSun; varying vec3 vDir;
      void main(){ float h = max(vDir.y, 0.0); vec3 c = mix(uHorizon, uTop, pow(h, 0.6));
      float s = max(dot(normalize(vDir), normalize(uSun)), 0.0); c += vec3(1.0,0.85,0.6) * pow(s, 64.0) * 0.6;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  })
  const dome = new Mesh(new SphereGeometry(900, 24, 12), mat)
  parent.add(dome)
  const horizon = new Color()
  return {
    object: dome,
    horizonColor: horizon,
    setSun(dir, elevation) {
      ;(mat.uniforms.uSun.value as Vector3).copy(dir)
      const day = Math.max(0, Math.min(1, (elevation + 0.1) / 0.4))
      const low = 1 - Math.min(1, Math.max(0, elevation / 0.35))
      ;(mat.uniforms.uTop.value as Color).setRGB(0.36 * day + 0.02, 0.56 * day + 0.03, 0.82 * day + 0.08)
      ;(mat.uniforms.uHorizon.value as Color).setRGB(0.81 * day + low * 0.3 * day + 0.03, 0.89 * day + 0.03, 0.95 * day + 0.06)
      horizon.copy(mat.uniforms.uHorizon.value as Color)
    },
  }
}

// =========================================================================== night sky

export interface NightSky {
  setNight(n: number): void
}

/**
 * Stars + a deep-blue night glow over the (black) atmospheric sky. Additive, so it vanishes
 * by day. Stars sit on a sphere that can be rotated about the celestial pole for star trails.
 */
export function createNightSky(parent: Group, count: number): NightSky {
  const r = seeded(2718)
  const pos = new Float32Array(count * 3)
  const mag = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    // Uniform on the upper hemisphere (+ a little below the horizon for rotation).
    const u = r() * 2 - 0.25
    const z = Math.min(1, Math.max(-0.25, u * 0.5 + 0.25))
    const t = r() * Math.PI * 2
    const s = Math.sqrt(1 - z * z)
    pos[i * 3] = Math.cos(t) * s * 800
    pos[i * 3 + 1] = z * 800
    pos[i * 3 + 2] = Math.sin(t) * s * 800
    mag[i] = Math.pow(r(), 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('aMag', new BufferAttribute(mag, 1))
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uNight: { value: 0 } },
    vertexShader: `attribute float aMag; uniform float uNight; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = 1.0 + aMag * 2.2; vA = uNight * (0.25 + 0.75 * aMag) * smoothstep(-0.02, 0.15, normalize(position).y); }`,
    fragmentShader: `varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d));
      gl_FragColor = vec4(vec3(0.9, 0.93, 1.0) * a * vA, 1.0); }`,
  })
  const stars = new Group()
  const points = new Points(g, mat)
  points.frustumCulled = false
  points.renderOrder = -1
  stars.add(points)
  // Celestial pole at 41.5 deg up, due north (-Z): tilt the star sphere so it can spin about it.
  stars.rotation.x = -(90 - 41.5) * Math.PI / 180
  parent.add(stars)
  const glowMat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    transparent: true,
    blending: AdditiveBlending,
    uniforms: { uNight: { value: 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uNight; varying vec3 vD;
      void main(){ float h = clamp(vD.y, 0.0, 1.0);
      vec3 c = mix(vec3(0.05, 0.08, 0.16), vec3(0.012, 0.02, 0.05), pow(h, 0.5));
      gl_FragColor = vec4(c * uNight, 1.0); }`,
  })
  const glow = new Mesh(new SphereGeometry(850, 24, 12), glowMat)
  glow.renderOrder = -2
  parent.add(glow)
  return {
    setNight(n: number) {
      mat.uniforms.uNight.value = n
      glowMat.uniforms.uNight.value = n
      points.visible = glow.visible = n > 0.01
    },
  }
}
