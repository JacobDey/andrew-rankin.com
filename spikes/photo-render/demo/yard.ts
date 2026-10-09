// Demo scene: a small, luminance-calibrated back yard. Radiance is in cd/m^2 (see core/spec.ts).
// Sun + sky from a tiny clear-sky model, a picket fence with fairy lights, primitive trees, a shed,
// a spinning pinwheel (rolling-shutter bait), a bouncing beach ball (physics-stepped + MotionRecorder),
// a toy car on a loop (motion blur / panning), a chrome gazing ball (bokeh glints) and a test chart.

import * as THREE from 'three'
import { MotionRecorder } from '../core/motion.ts'
import type { PhotoScene, CameraPose } from '../core/PhotoRenderer.ts'

const DEG = Math.PI / 180
const SUN_SOLID_ANGLE = 6.8e-5 // sr, 0.53 deg disc

export interface SunState {
  elevation: number // deg
  azimuth: number // deg, 0 = from +z (behind the default camera), 90 = from +x
  /** direct normal illuminance, lux */
  directLux: number
  /** approx horizontal sky illuminance, lux */
  skyLux: number
  color: THREE.Color
  dir: THREE.Vector3 // towards the sun
}

export interface YardParams {
  pinwheelRps: number
  carSpeed: number // m/s
  ball: boolean
}

function linear(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b)
}

/** a linear colour with the given hue, scaled so its luminance Y equals L (cd/m^2) */
function lum(r: number, g: number, b: number, L: number): THREE.Color {
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return new THREE.Color().setRGB((r / Y) * L, (g / Y) * L, (b / Y) * L)
}

/** clear-sky sun model: Kasten-Young air mass, per-channel extinction (reddens at low sun) */
export function sunModel(elevationDeg: number, azimuthDeg: number): SunState {
  const e = elevationDeg
  const dir = new THREE.Vector3(
    Math.cos(e * DEG) * Math.sin(azimuthDeg * DEG),
    Math.sin(e * DEG),
    Math.cos(e * DEG) * Math.cos(azimuthDeg * DEG),
  )
  let directLux = 0
  const color = new THREE.Color(1, 1, 1)
  if (e > -1) {
    const ee = Math.max(e, 0.01)
    const m = 1 / (Math.sin(ee * DEG) + 0.50572 * Math.pow(ee + 6.07995, -1.6364))
    const tr = Math.pow(0.88, m)
    const tg = Math.pow(0.8, m)
    const tb = Math.pow(0.66, m)
    const Y = 0.2126 * tr + 0.7152 * tg + 0.0722 * tb
    directLux = 128000 * Y * (e < 0 ? Math.max(0, 1 + e) : 1)
    color.setRGB(tr / Y, tg / Y, tb / Y)
  }
  // horizontal sky illuminance: ~16 klx with a high sun; twilight falls ~ a decade per 2.2 deg
  const skyLux = e > 0 ? 1200 + 15000 * Math.pow(Math.sin(e * DEG), 0.75) : 1200 * Math.pow(10, e / 2.2)
  return { elevation: e, azimuth: azimuthDeg, directLux, skyLux, color, dir }
}

// ------------------------------------------------------------------ procedural textures

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function grassTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g) => {
    const img = g.createImageData(256, 256)
    let s = 1234567
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const k = (y * 256 + x) * 4
        const blade = rnd()
        const stripe = Math.sin((x / 256) * Math.PI * 2) * 0.06
        const v = 0.75 + 0.5 * blade * blade + stripe
        img.data[k] = 70 * v
        img.data[k + 1] = 112 * v
        img.data[k + 2] = 40 * v
        img.data[k + 3] = 255
      }
    g.putImageData(img, 0, 0)
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1050, 1050)
  return t
}

function chartTexture(): THREE.CanvasTexture {
  return canvasTex(1024, 768, (g) => {
    // board: 18% grey everywhere (sRGB 118 ~ 0.18 linear)
    g.fillStyle = 'rgb(118,118,118)'
    g.fillRect(0, 0, 1024, 768)
    // Siemens star (left)
    const cx = 300
    const cy = 384
    const R = 250
    g.fillStyle = 'rgb(242,242,242)'
    g.beginPath()
    g.arc(cx, cy, R, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgb(20,20,20)'
    const n = 36
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2
      const a1 = ((i + 0.5) / n) * Math.PI * 2
      g.beginPath()
      g.moveTo(cx, cy)
      g.arc(cx, cy, R, a0, a1)
      g.closePath()
      g.fill()
    }
    // patches (right): white, grey 18 (blank), black, then RGBCMY
    const patches: [string, number, number][] = [
      ['rgb(242,242,242)', 600, 60], ['rgb(118,118,118)', 760, 60], ['rgb(20,20,20)', 600, 220],
      ['rgb(52,52,52)', 760, 220], ['rgb(190,40,40)', 600, 400], ['rgb(50,150,60)', 760, 400],
      ['rgb(40,70,180)', 600, 560], ['rgb(220,190,40)', 760, 560],
    ]
    for (const [c, x, y] of patches) {
      g.fillStyle = c
      g.fillRect(x, y, 140, 140)
    }
    g.fillStyle = 'rgb(20,20,20)'
    g.font = 'bold 28px monospace'
    g.fillText('18% GREY', 760, 240 + 150)
  })
}

function beachBallTexture(): THREE.CanvasTexture {
  return canvasTex(512, 256, (g) => {
    const cols = ['#e8e3d6', '#d93a2b', '#e8e3d6', '#2f6fcf', '#e8e3d6', '#f0c22c']
    for (let i = 0; i < 6; i++) {
      g.fillStyle = cols[i]
      g.fillRect((i * 512) / 6, 0, 512 / 6 + 1, 256)
    }
    g.fillStyle = '#f4f1ea'
    g.fillRect(0, 0, 512, 18)
    g.fillRect(0, 238, 512, 18)
  })
}

function clapboardTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#e6dfcf'
    g.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = 'rgba(80,70,50,0.35)'
      g.fillRect(0, y + 28, 256, 4)
      g.fillStyle = 'rgba(255,255,255,0.25)'
      g.fillRect(0, y, 256, 3)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 1.4)
  return t
}

// ------------------------------------------------------------------ sky

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.99999; // far plane
}
`
const SKY_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;    // cd/m^2 linear rgb
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uAureole;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c;
  if (h >= 0.0) {
    float t = pow(1.0 - h, 3.0);
    c = mix(uZenith, uHorizon, t);
    float cosA = clamp(dot(d, uSunDir), -1.0, 1.0);
    float ang = acos(cosA);
    c += uAureole * (exp(-ang / 0.06) * 3.0 + exp(-ang / 0.35));
  } else {
    c = mix(uGround * 1.2, uGround, clamp(-h * 6.0, 0.0, 1.0));
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function makeSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uAureole: { value: new THREE.Color() },
    },
    side: THREE.BackSide,
    depthWrite: false,
  })
}

// ------------------------------------------------------------------ the yard

export class Yard {
  readonly scene = new THREE.Scene()
  readonly params: YardParams = { pinwheelRps: 3, carSpeed: 5, ball: true }
  time = 0
  sun: SunState
  readonly focusables: THREE.Object3D[] = []
  readonly photoScene: PhotoScene

  private readonly sunLight: THREE.DirectionalLight
  private readonly sunDisc: THREE.Mesh
  private readonly skyMat = makeSkyMaterial()
  private readonly sky: THREE.Mesh
  private readonly bulbMat: THREE.MeshBasicMaterial
  private envRT: THREE.WebGLRenderTarget | null = null
  private readonly pmrem: THREE.PMREMGenerator

  /** hot-shoe flash: always in the scene (intensity 0) so toggling never changes shader programs */
  readonly flash = new THREE.PointLight(0xfff4e8, 0, 0, 2)
  /** ISO-100 guide number, metres */
  flashGN = 32
  /** pulse length, s (used to turn the GN into candela for the pulse) */
  flashDuration = 1 / 1000
  private flashSaved: { sun: number; env: number; bulb: THREE.Color; sky: boolean; disc: boolean } | null = null

  private readonly pinwheel = new THREE.Group()
  private pinPhase0 = 0
  private pinT0 = 0
  private pinRps = 3

  private readonly car = new THREE.Group()
  private readonly wheels: THREE.Object3D[] = []
  private carPhase0 = 0
  private carT0 = 0
  private carSpeed = 5
  private readonly carCenter = new THREE.Vector3(0.5, 0, -2.8)
  private readonly carRadius = 3.4

  readonly ball: THREE.Mesh
  private ballY = 1.2
  private ballVy = 0
  private ballSpin = 0
  private readonly ballX = -1.1
  private readonly ballZ = 0.6
  private readonly ballR = 0.18
  private readonly recorder: MotionRecorder
  private exposing = false

  constructor(renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer)
    const s = this.scene

    // sky dome + sun disc
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.skyMat)
    this.sky.frustumCulled = false
    this.sky.renderOrder = -10
    s.add(this.sky)
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(700 * Math.tan(0.2665 * DEG), 24, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }))
    s.add(this.sunDisc)

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.set(2048, 2048)
    const sc = this.sunLight.shadow.camera
    sc.left = -15
    sc.right = 15
    sc.top = 15
    sc.bottom = -15
    sc.near = 1
    sc.far = 90
    this.sunLight.shadow.bias = -0.0004
    this.sunLight.shadow.normalBias = 0.03
    this.sunLight.target.position.set(0, 0, -3)
    s.add(this.sunLight, this.sunLight.target)

    // ground
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1400, 64),
      new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95, metalness: 0, color: linear(0.62, 0.62, 0.62) }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    s.add(ground)
    this.focusables.push(ground)

    // path stones
    const stoneMat = new THREE.MeshStandardMaterial({ color: linear(0.32, 0.3, 0.27), roughness: 0.9 })
    const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 12), stoneMat, 9)
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Matrix4().makeTranslation(-0.2 + Math.sin(i * 0.9) * 0.25, 0.02, 3.5 - i * 0.75)
      stones.setMatrixAt(i, m)
    }
    stones.receiveShadow = true
    stones.castShadow = true
    s.add(stones)
    this.focusables.push(stones)

    this.buildFence()
    this.buildTrees()
    this.buildShed()
    this.buildPinwheel()
    this.buildCar()
    this.buildChart()
    this.buildGazingBall()
    this.bulbMat = this.buildFairyLights()

    // beach ball (physics-stepped; recorded for exposures)
    const ballTex = beachBallTexture()
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(this.ballR, 32, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35 }))
    this.ball.castShadow = true
    this.ball.position.set(this.ballX, this.ballY, this.ballZ)
    s.add(this.ball)
    this.focusables.push(this.ball)
    this.recorder = new MotionRecorder([this.ball])

    this.sun = sunModel(38, 35)
    this.setSun(38, 35)
    s.add(this.flash)

    this.photoScene = {
      scene: this.scene,
      setTime: (t: number) => this.poseAt(t),
      setFlash: (on: boolean, eye: CameraPose) => this.setFlash(on, eye),
    }
    this.poseAt(0)
  }

  // ---------------------------------------------------------------- builders

  private buildFence(): void {
    const shape = new THREE.Shape()
    const w = 0.085
    const h = 1.05
    shape.moveTo(-w / 2, 0)
    shape.lineTo(w / 2, 0)
    shape.lineTo(w / 2, h)
    shape.lineTo(0, h + 0.07)
    shape.lineTo(-w / 2, h)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false })
    const mat = new THREE.MeshStandardMaterial({ color: linear(0.72, 0.7, 0.64), roughness: 0.8 })
    const count = 150
    const pickets = new THREE.InstancedMesh(geo, mat, count)
    const col = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const x = -10.5 + i * 0.145
      const m = new THREE.Matrix4().makeRotationZ((Math.sin(i * 12.9898) * 0.5) * 0.02).setPosition(x, 0, -5.6)
      pickets.setMatrixAt(i, m)
      const v = 0.92 + 0.08 * Math.sin(i * 78.233)
      pickets.setColorAt(i, col.setRGB(v, v, v * 0.98))
    }
    pickets.castShadow = true
    pickets.receiveShadow = true
    this.scene.add(pickets)
    this.focusables.push(pickets)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(21.8, 0.08, 0.04), mat)
    rail.position.set(0.3, 0.3, -5.63)
    const rail2 = rail.clone()
    rail2.position.y = 0.85
    rail.castShadow = rail2.castShadow = true
    rail.receiveShadow = rail2.receiveShadow = true
    this.scene.add(rail, rail2)
  }

  private buildTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: linear(0.12, 0.08, 0.05), roughness: 0.95 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true })
    const trees: [number, number, number][] = [
      [-7.5, -9, 1.0], [6.5, -11.5, 1.25], [-2.5, -15, 1.4], [10.5, -7.5, 0.9], [-12, -6, 1.1], [14, -16, 1.6],
    ]
    const blobGeo = new THREE.IcosahedronGeometry(1, 1)
    const blobs = new THREE.InstancedMesh(blobGeo, leafMat, trees.length * 9)
    let bi = 0
    const col = new THREE.Color()
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (const [x, z, sc] of trees) {
      const h = 2.6 * sc
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * sc, 0.2 * sc, h, 10), trunkMat)
      trunk.position.set(x, h / 2, z)
      trunk.castShadow = true
      trunk.receiveShadow = true
      this.scene.add(trunk)
      this.focusables.push(trunk)
      for (let k = 0; k < 9; k++) {
        const r = (0.9 + rnd() * 0.7) * sc
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(x + (rnd() - 0.5) * 2.2 * sc, h + (rnd() - 0.2) * 1.6 * sc, z + (rnd() - 0.5) * 2.2 * sc),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)),
          new THREE.Vector3(r, r * (0.8 + rnd() * 0.3), r),
        )
        blobs.setMatrixAt(bi, m)
        const g = 0.045 + rnd() * 0.04
        blobs.setColorAt(bi, col.setRGB(g * 0.55, g * 1.0 + 0.01, g * 0.35))
        bi++
      }
    }
    blobs.castShadow = true
    blobs.receiveShadow = true
    this.scene.add(blobs)
    this.focusables.push(blobs)
  }

  private buildShed(): void {
    const wallMat = new THREE.MeshStandardMaterial({ map: clapboardTexture(), roughness: 0.85 })
    const shed = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3), wallMat)
    shed.position.set(-6.2, 1.3, -8.4)
    shed.castShadow = true
    shed.receiveShadow = true
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.9, 1.3, 4, 1), new THREE.MeshStandardMaterial({ color: linear(0.07, 0.05, 0.05), roughness: 0.7 }))
    roof.position.set(-6.2, 3.25, -8.4)
    roof.rotation.y = Math.PI / 4
    roof.scale.set(1, 1, 0.76)
    roof.castShadow = true
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshStandardMaterial({ color: linear(0.02, 0.025, 0.03), roughness: 0.04, metalness: 0.0 }))
    glass.position.set(-5.6, 1.5, -6.89)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.95, 0.04), new THREE.MeshStandardMaterial({ color: linear(0.6, 0.6, 0.58), roughness: 0.6 }))
    frame.position.set(-5.6, 1.5, -6.91)
    this.scene.add(shed, roof, frame, glass)
    this.focusables.push(shed, roof, glass)
  }

  private buildPinwheel(): void {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 1.25, 8), new THREE.MeshStandardMaterial({ color: linear(0.35, 0.25, 0.12), roughness: 0.7 }))
    stick.position.set(1.25, 0.625, 1.3)
    stick.castShadow = true
    this.scene.add(stick)
    const colors = [0xd93a2b, 0xf0c22c, 0x2f6fcf, 0x39a85a]
    const R = 0.24
    for (let i = 0; i < 4; i++) {
      const g = new THREE.BufferGeometry()
      // a folded paper vane: triangle from hub to tip with one curled corner
      const v = new Float32Array([0, 0, 0, R, 0, 0.0, R * 0.95, R * 0.75, 0.06, 0, 0, 0, R * 0.95, R * 0.75, 0.06, 0.0, R * 0.42, 0.02])
      g.setAttribute('position', new THREE.BufferAttribute(v, 3))
      g.computeVertexNormals()
      const vane = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.55, side: THREE.DoubleSide }))
      vane.rotation.z = (i * Math.PI) / 2
      vane.castShadow = true
      this.pinwheel.add(vane)
      this.focusables.push(vane)
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3 }))
    this.pinwheel.add(hub)
    this.pinwheel.position.set(1.25, 1.25, 1.33)
    this.pinwheel.rotation.y = -0.25
    this.scene.add(this.pinwheel)
  }

  private buildCar(): void {
    const paint = new THREE.MeshStandardMaterial({ color: 0xc8261c, roughness: 0.3, metalness: 0.1 })
    const dark = new THREE.MeshStandardMaterial({ color: linear(0.02, 0.02, 0.02), roughness: 0.6 })
    const chrome = new THREE.MeshStandardMaterial({ color: linear(0.9, 0.9, 0.9), roughness: 0.15, metalness: 1 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.46), paint)
    body.position.y = 0.2
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.4), paint)
    cabin.position.set(-0.05, 0.4, 0)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.01, 0.04, 0.12), new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.4 }))
    stripe.position.y = 0.31
    const number = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.47, 20), new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.4 }))
    number.rotation.x = Math.PI / 2
    number.position.set(0.12, 0.2, 0)
    this.car.add(body, cabin, stripe, number)
    for (const [x, z] of [[0.33, 0.25], [-0.33, 0.25], [0.33, -0.25], [-0.33, -0.25]] as [number, number][]) {
      const w = new THREE.Group()
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 20), dark)
      tyre.rotation.x = Math.PI / 2
      const hubcap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.085), chrome)
      const hubcap2 = hubcap.clone()
      hubcap2.rotation.z = Math.PI / 2
      w.add(tyre, hubcap, hubcap2)
      w.position.set(x, 0.11, z)
      this.car.add(w)
      this.wheels.push(w)
    }
    this.car.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        this.focusables.push(o)
      }
    })
    this.scene.add(this.car)
  }

  private buildChart(): void {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.48), new THREE.MeshStandardMaterial({ map: chartTexture(), roughness: 0.97 }))
    board.position.set(-2.3, 0.95, 1.4)
    board.rotation.set(-0.12, 0.35, 0)
    board.receiveShadow = true
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.5, 0.015), new THREE.MeshStandardMaterial({ color: linear(0.05, 0.05, 0.05) }))
    back.position.copy(board.position)
    back.rotation.copy(board.rotation)
    back.translateZ(-0.01)
    back.castShadow = true
    const legMat = new THREE.MeshStandardMaterial({ color: linear(0.2, 0.13, 0.07), roughness: 0.8 })
    for (const dx of [-0.22, 0.22]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6), legMat)
      leg.position.set(-2.3 + dx * Math.cos(0.35), 0.47, 1.4 - dx * Math.sin(0.35) - 0.03)
      leg.castShadow = true
      this.scene.add(leg)
    }
    this.scene.add(board, back)
    this.focusables.push(board, back)
  }

  private buildGazingBall(): void {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 48, 24), new THREE.MeshStandardMaterial({ color: linear(0.95, 0.95, 0.95), metalness: 1, roughness: 0.02 }))
    ball.position.set(2.8, 0.98, -2.2)
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.82, 16), new THREE.MeshStandardMaterial({ color: linear(0.5, 0.48, 0.44), roughness: 0.9 }))
    ped.position.set(2.8, 0.41, -2.2)
    ball.castShadow = ped.castShadow = true
    ped.receiveShadow = true
    this.scene.add(ball, ped)
    this.focusables.push(ball, ped)
  }

  private buildFairyLights(): THREE.MeshBasicMaterial {
    // a string of bulbs along the fence top, sagging between posts
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const n = 44
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 10, 6), mat, n)
    const wirePts: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      const x = -9 + (i / (n - 1)) * 18
      const span = 1.8
      const u = ((x + 9) % span) / span
      const y = 1.32 - 0.14 * 4 * u * (1 - u)
      bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y - 0.03, -5.5))
      wirePts.push(new THREE.Vector3(x, y, -5.5))
    }
    this.scene.add(bulbs)
    const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wirePts), new THREE.LineBasicMaterial({ color: 0x050505 }))
    this.scene.add(wire)
    return mat
  }

  // ---------------------------------------------------------------- lighting

  /** Set the sun and rebuild the sky + image-based light. Radiance in cd/m^2. */
  setSun(elevationDeg: number, azimuthDeg: number): void {
    const sun = sunModel(elevationDeg, azimuthDeg)
    this.sun = sun
    this.sunLight.intensity = sun.directLux
    this.sunLight.color.copy(sun.color)
    this.sunLight.visible = sun.directLux > 1
    this.sunLight.position.copy(this.sunLight.target.position).addScaledVector(sun.dir, 40)
    this.sunDisc.position.copy(sun.dir).multiplyScalar(700)
    const Lsun = sun.directLux / SUN_SOLID_ANGLE
    ;(this.sunDisc.material as THREE.MeshBasicMaterial).color.copy(sun.color).multiplyScalar(Lsun)
    this.sunDisc.visible = sun.elevation > -0.3

    // sky luminances chosen so the cos-weighted dome integrates to ~skyLux on a horizontal plane
    const Lavg = sun.skyLux / Math.PI
    const warm = THREE.MathUtils.clamp(1 - sun.elevation / 25, 0, 1)
    const night = THREE.MathUtils.clamp(-sun.elevation / 6, 0, 1)
    const zen = lum(0.16 + 0.1 * night, 0.36 + 0.05 * night, 1.0, Lavg * 0.75)
    const hor = lum(0.78 + 0.5 * warm, 0.88 + 0.1 * warm, 1.0 - 0.3 * warm, Lavg * 1.4)
    const groundAlbedo = 0.13
    const Eground = sun.directLux * Math.max(0, Math.sin(sun.elevation * DEG)) + sun.skyLux
    const gnd = lum(0.55, 0.75, 0.35, (groundAlbedo * Eground) / Math.PI)
    const aur = sun.color.clone().multiplyScalar(Lavg * 0.5 * Math.min(1, sun.directLux / 20000 + 0.05))
    const u = this.skyMat.uniforms
    u.uSunDir.value.copy(sun.dir)
    u.uZenith.value.copy(zen)
    u.uHorizon.value.copy(hor)
    u.uGround.value.copy(gnd)
    u.uAureole.value.copy(aur)

    // fairy lights: a warm 1/2 W bulb ~ 25 kcd/m^2 through its diffuser
    this.bulbMat.color.copy(linear(1.0, 0.72, 0.42)).multiplyScalar(25000 / 0.79)

    // image-based sky + ground bounce for every PBR material (replaces a hemisphere light)
    const envScene = new THREE.Scene()
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.skyMat)
    envScene.add(envSky)
    const prev = this.envRT
    this.envRT = this.pmrem.fromScene(envScene, 0, 0.1, 200)
    this.scene.environment = this.envRT.texture
    prev?.dispose()
    envSky.geometry.dispose()
  }

  /**
   * Flash-only lighting for flash sub-frames: ambient (sun, sky IBL, sky dome, emissive bulbs) off,
   * the flash at the hot shoe. A guide number GN (ISO 100, m) means a mid-grey at d metres is
   * correctly exposed at f/(GN/d): I * tau = 4 q K GN^2 / (T * 0.18 * 100) = 2.006 GN^2 cd*s.
   */
  setFlash(on: boolean, eye: CameraPose): void {
    if (on) {
      this.flashSaved = {
        sun: this.sunLight.intensity,
        env: this.scene.environmentIntensity,
        bulb: this.bulbMat.color.clone(),
        sky: this.sky.visible,
        disc: this.sunDisc.visible,
      }
      this.sunLight.intensity = 0
      this.scene.environmentIntensity = 0
      this.bulbMat.color.setRGB(0, 0, 0)
      this.sky.visible = false
      this.sunDisc.visible = false
      const up = new THREE.Vector3(0, 0.09, 0).applyQuaternion(eye.quaternion)
      this.flash.position.copy(eye.position).add(up)
      this.flash.intensity = (2.006 * this.flashGN * this.flashGN) / this.flashDuration
    } else if (this.flashSaved) {
      this.sunLight.intensity = this.flashSaved.sun
      this.scene.environmentIntensity = this.flashSaved.env
      this.bulbMat.color.copy(this.flashSaved.bulb)
      this.sky.visible = this.flashSaved.sky
      this.sunDisc.visible = this.flashSaved.disc
      this.flash.intensity = 0
      this.flashSaved = null
    }
  }

  /** luminance of a sunlit 18% grey card facing the sun, cd/m^2 (for the HUD) */
  greyCardLuminance(): number {
    return (0.18 * (this.sun.directLux + this.sun.skyLux * 0.5)) / Math.PI
  }

  // ---------------------------------------------------------------- motion

  setPinwheelRps(rps: number): void {
    this.pinPhase0 = this.pinwheelAngle(this.time)
    this.pinT0 = this.time
    this.pinRps = rps
    this.params.pinwheelRps = rps
  }
  setCarSpeed(v: number): void {
    this.carPhase0 = this.carAngle(this.time)
    this.carT0 = this.time
    this.carSpeed = v
    this.params.carSpeed = v
  }
  /** place the car at loop angle a (radians; pi/2 = closest to the default camera, heading -x) now */
  setCarPhase(a: number): void {
    this.carPhase0 = a
    this.carT0 = this.time
    this.poseAt(this.time)
  }
  private pinwheelAngle(t: number): number {
    return this.pinPhase0 + 2 * Math.PI * this.pinRps * (t - this.pinT0)
  }
  private carAngle(t: number): number {
    return this.carPhase0 + (this.carSpeed / this.carRadius) * (t - this.carT0)
  }

  /** Pose everything at absolute time t (deterministic; used by the photo renderer per sub-frame). */
  poseAt(t: number): void {
    this.pinwheel.rotation.z = -this.pinwheelAngle(t)
    const a = this.carAngle(t)
    this.car.position.set(this.carCenter.x + Math.cos(a) * this.carRadius, 0, this.carCenter.z + Math.sin(a) * this.carRadius * 0.62)
    // heading: tangent of the ellipse
    const dx = -Math.sin(a) * this.carRadius
    const dz = Math.cos(a) * this.carRadius * 0.62
    this.car.rotation.y = Math.atan2(-dz, dx)
    const wheelAng = (this.carSpeed * (t - this.carT0)) / 0.11 + this.carPhase0 * 30
    for (const w of this.wheels) w.rotation.z = -wheelAng
    if (this.exposing && this.recorder.length) this.recorder.poseAt(t)
    else {
      this.ball.position.set(this.ballX, this.ballY, this.ballZ)
      this.ball.rotation.set(0.4, this.ballSpin, 0.2)
    }
    this.ball.visible = this.params.ball
  }

  /** One physics step for the ball (semi-implicit Euler, elastic-ish bounce that keeps a 1.4 m apex). */
  private stepBall(dt: number): void {
    this.ballVy -= 9.81 * dt
    this.ballY += this.ballVy * dt
    this.ballSpin += dt * 3.0
    if (this.ballY < this.ballR) {
      this.ballY = this.ballR + (this.ballR - this.ballY)
      // restitution, then top up so it keeps bouncing to ~1.4 m (a kid keeps throwing it)
      const apexV = Math.sqrt(2 * 9.81 * (1.4 - this.ballR))
      this.ballVy = Math.max(Math.abs(this.ballVy) * 0.8, apexV)
    }
  }

  /** Advance the live world by dt seconds. */
  update(dt: number): void {
    const h = 1 / 480
    let rem = dt
    while (rem > 1e-9) {
      const s = Math.min(h, rem)
      this.stepBall(s)
      rem -= s
    }
    this.time += dt
    this.poseAt(this.time)
  }

  /**
   * Shutter pressed: simulate the ball forward through the exposure span, recording a pose every step,
   * so the photo renderer can pose the world at any sub-frame instant. Call endExposure() after.
   */
  beginExposure(span: number): void {
    this.recorder.clear()
    const h = 1 / 480
    let t = this.time
    const end = this.time + span + h
    const record = () => {
      this.ball.position.set(this.ballX, this.ballY, this.ballZ)
      this.ball.rotation.set(0.4, this.ballSpin, 0.2)
      this.ball.updateMatrix()
      this.recorder.record(t)
    }
    record()
    while (t < end) {
      this.stepBall(h)
      t += h
      record()
    }
    this.exposing = true
  }

  /** Shutter closed: the world continues from the end of the exposure. */
  endExposure(span: number): void {
    this.exposing = false
    this.time += span
    this.poseAt(this.time)
  }
}
