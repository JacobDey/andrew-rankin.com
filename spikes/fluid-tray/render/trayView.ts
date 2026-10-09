/**
 * three.js view of a FluidTray: bench, tray body, paper, liquid surface, bubbles, droplets, the jug and
 * the pour/drain streams, lit by one point light (the safelight, or the room light).
 *
 * Scene graph:
 *   scene
 *    └─ tilt (Object3D, three.js y-up world; rotated by the rig's tilt, lifted so the low edge rests on the bench)
 *        └─ frame (tray coords: x along the long side, y away from the viewer, z up; origin = front-left floor corner)
 *            ├─ floor, paper, liquid, bubbles, droplets, tray walls
 *
 * Call sync() once per rendered frame (uploads textures, moves things), then render().
 */
import * as THREE from 'three'
import type { FluidTray } from '../core/fluidTray.ts'
import {
  BUBBLE_FRAG,
  DROP_FRAG,
  LIQUID_FRAG,
  LIQUID_VERT,
  POINTS_VERT,
  STREAM_FRAG,
  STREAM_VERT,
  UNDER_FRAG,
  UNDER_VERT,
} from './shaders.ts'

export type Lighting = 'safe' | 'room'

export interface TrayViewOptions {
  /** Max device pixel ratio. */
  maxDpr?: number
}

const WALL = 0.009
const BASE = 0.006
const RIM_VIS = 0.042

export class TrayView {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.02, 10)
  readonly tilt = new THREE.Object3D()
  readonly frame = new THREE.Object3D()
  readonly jug = new THREE.Group()
  portrait = false

  private tray: FluidTray
  private fluidTex: THREE.DataTexture
  private fluidData: Float32Array
  private paperTex: THREE.DataTexture
  private light = new THREE.PointLight(0xffffff, 1, 0, 2)
  private ambient = new THREE.AmbientLight(0xffffff, 0.2)
  private shared: Record<string, THREE.IUniform>
  private liquidMat: THREE.ShaderMaterial
  private bubbleGeo = new THREE.BufferGeometry()
  private bubblePos: Float32Array
  private bubbleSize: Float32Array
  private dropGeo = new THREE.BufferGeometry()
  private dropPos: Float32Array
  private dropSize: Float32Array
  private pourStream: THREE.Mesh
  private drainStream: THREE.Mesh
  private streamMats: THREE.ShaderMaterial[] = []
  private pointMats: THREE.ShaderMaterial[] = []
  private shadow: THREE.Mesh
  private jugTilt = 0
  private jugPos = new THREE.Vector3()
  private jugHome = new THREE.Vector3()
  private time = 0
  private raycaster = new THREE.Raycaster()
  private lightingMode: Lighting = 'safe'
  private maxDpr: number

  constructor(canvas: HTMLCanvasElement, tray: FluidTray, o: TrayViewOptions = {}) {
    this.tray = tray
    this.maxDpr = o.maxDpr ?? 2
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.scene.background = new THREE.Color(0x070302)

    const f = tray.fluid
    this.fluidData = new Float32Array((f.nx + 1) * (f.ny + 1) * 4)
    this.fluidTex = new THREE.DataTexture(this.fluidData, f.nx + 1, f.ny + 1, THREE.RGBAFormat, THREE.FloatType)
    this.fluidTex.magFilter = THREE.NearestFilter
    this.fluidTex.minFilter = THREE.NearestFilter
    this.fluidTex.needsUpdate = true
    const pp = tray.paper
    this.paperTex = new THREE.DataTexture(pp.rgba, pp.resX, pp.resY, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.paperTex.magFilter = THREE.LinearFilter
    this.paperTex.minFilter = THREE.LinearFilter
    this.paperTex.wrapS = THREE.ClampToEdgeWrapping
    this.paperTex.wrapT = THREE.ClampToEdgeWrapping
    this.paperTex.needsUpdate = true

    this.shared = {
      uFluid: { value: this.fluidTex },
      uGrid: { value: new THREE.Vector2(f.nx + 1, f.ny + 1) },
      uDx: { value: f.dx },
      uLightPos: { value: new THREE.Vector3() },
      uLightColor: { value: new THREE.Color() },
      uLightPower: { value: 1 },
      uAmbient: { value: new THREE.Color() },
    }

    this.scene.add(this.light, this.ambient)
    this.scene.add(this.tilt)
    this.tilt.add(this.frame)
    // tray coords -> three: (x, y, z) -> (x - W/2, z, H/2 - y)
    this.frame.rotation.x = -Math.PI / 2
    this.frame.position.set(-tray.trayW / 2, 0, tray.trayH / 2)

    this.buildBench()
    this.buildTray()
    this.buildUnder()
    this.liquidMat = this.buildLiquid()
    this.bubblePos = new Float32Array(pp.kin.maxBubbles * 3)
    this.bubbleSize = new Float32Array(pp.kin.maxBubbles)
    this.dropPos = new Float32Array(tray.maxDroplets * 3)
    this.dropSize = new Float32Array(tray.maxDroplets)
    this.buildPoints()
    this.pourStream = this.buildStream()
    this.drainStream = this.buildStream()
    this.buildJug()
    this.shadow = this.buildShadow()
    this.setLighting('safe')
  }

  // ------------------------------------------------------------------ building

  private uniforms(extra: Record<string, THREE.IUniform>): Record<string, THREE.IUniform> {
    return { ...this.shared, ...extra }
  }

  private buildBench(): void {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 512
    const g = c.getContext('2d')!
    g.fillStyle = '#4a3a2e'
    g.fillRect(0, 0, 512, 512)
    // lazy wood grain
    for (let i = 0; i < 220; i++) {
      const y = Math.random() * 512
      g.strokeStyle = `rgba(${20 + Math.random() * 30},${12 + Math.random() * 18},${8},${0.08 + Math.random() * 0.18})`
      g.lineWidth = 1 + Math.random() * 3
      g.beginPath()
      g.moveTo(0, y)
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + (Math.random() - 0.5) * 2)
      g.stroke()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(3, 2)
    const bench = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 3),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72, metalness: 0 }),
    )
    bench.rotation.x = -Math.PI / 2
    this.scene.add(bench)
  }

  private buildShadow(): THREE.Mesh {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64)
    grd.addColorStop(0, 'rgba(0,0,0,0.85)')
    grd.addColorStop(0.6, 'rgba(0,0,0,0.5)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(c)
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(this.tray.trayW + 0.12, this.tray.trayH + 0.12),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0x000000 }),
    )
    m.rotation.x = -Math.PI / 2
    m.position.y = 0.0008
    this.scene.add(m)
    return m
  }

  private buildTray(): void {
    const { trayW: W, trayH: H } = this.tray
    const mat = new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.38, metalness: 0 })
    const rr = (s: THREE.Shape | THREE.Path, x0: number, y0: number, x1: number, y1: number, r: number) => {
      s.moveTo(x0 + r, y0)
      s.lineTo(x1 - r, y0)
      s.quadraticCurveTo(x1, y0, x1, y0 + r)
      s.lineTo(x1, y1 - r)
      s.quadraticCurveTo(x1, y1, x1 - r, y1)
      s.lineTo(x0 + r, y1)
      s.quadraticCurveTo(x0, y1, x0, y1 - r)
      s.lineTo(x0, y0 + r)
      s.quadraticCurveTo(x0, y0, x0 + r, y0)
    }
    const shape = new THREE.Shape()
    rr(shape, -WALL, -WALL, W + WALL, H + WALL, 0.016)
    const hole = new THREE.Path()
    rr(hole, 0, 0, W, H, 0.006)
    shape.holes.push(hole)
    const walls = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: RIM_VIS + BASE - 0.002,
        bevelEnabled: true,
        bevelSize: 0.0025,
        bevelThickness: 0.002,
        bevelSegments: 2,
        curveSegments: 6,
      }),
      mat,
    )
    walls.position.z = -BASE
    this.frame.add(walls)
    const baseShape = new THREE.Shape()
    rr(baseShape, -WALL, -WALL, W + WALL, H + WALL, 0.016)
    const base = new THREE.Mesh(new THREE.ExtrudeGeometry(baseShape, { depth: BASE, bevelEnabled: false, curveSegments: 6 }), mat)
    base.position.z = -BASE - 0.0002
    this.frame.add(base)
    // corner spout: a small lip that sticks out at the spout corner
    const sc = this.tray.spoutCorner
    const sx = sc[1] === '1' ? W + WALL : -WALL
    const sy = sc[3] === '1' ? H + WALL : -WALL
    const ox = sc[1] === '1' ? 1 : -1
    const oy = sc[3] === '1' ? 1 : -1
    const spout = new THREE.Shape()
    spout.moveTo(sx - ox * 0.03, sy)
    spout.lineTo(sx + ox * 0.012, sy + oy * 0.012)
    spout.lineTo(sx, sy - oy * 0.03)
    spout.lineTo(sx - ox * 0.03, sy)
    const lip = new THREE.Mesh(new THREE.ExtrudeGeometry(spout, { depth: 0.004, bevelEnabled: false }), mat)
    lip.position.z = RIM_VIS - 0.008
    this.frame.add(lip)
    // masking-tape label on the front wall
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    const g = c.getContext('2d')!
    g.fillStyle = '#d9cfae'
    g.fillRect(0, 0, 256, 96)
    g.fillStyle = 'rgba(120,100,60,0.25)'
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 96, 2, 2)
    g.fillStyle = '#1a1410'
    g.font = 'bold 64px "Marker Felt", "Comic Sans MS", cursive'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('DEV', 128, 52)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.026), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }))
    // front wall outer face is at y = -WALL (- bevel), facing -y
    label.position.set(W * 0.22, -WALL - 0.0028, 0.018)
    label.rotation.x = Math.PI / 2
    label.rotation.z = 0.03
    this.frame.add(label)
  }

  private buildUnder(): void {
    const { trayW: W, trayH: H, paper } = this.tray
    const common = {
      uPaper: { value: this.paperTex },
      uPaperRect: { value: new THREE.Vector4(paper.x, paper.y, paper.w, paper.h) },
      uRefract: { value: 3.0 },
      uCaustic: { value: 1.8 },
      uSigmaFresh: { value: new THREE.Vector3(6, 10, 22) },
      uSigmaSpent: { value: new THREE.Vector3(30, 48, 80) },
      uDmax: { value: 2.0 },
    }
    const floorGeo = new THREE.PlaneGeometry(W, H, 1, 1)
    floorGeo.translate(W / 2, H / 2, 0)
    const floorMat = new THREE.ShaderMaterial({
      vertexShader: UNDER_VERT,
      fragmentShader: UNDER_FRAG,
      uniforms: this.uniforms({ ...common, uAlbedo: { value: new THREE.Color(0.82, 0.8, 0.76) } }),
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.position.z = 0.00005
    this.frame.add(floor)
    const paperGeo = new THREE.PlaneGeometry(paper.w, paper.h, 1, 1)
    paperGeo.translate(paper.x + paper.w / 2, paper.y + paper.h / 2, 0)
    const paperMat = new THREE.ShaderMaterial({
      vertexShader: UNDER_VERT,
      fragmentShader: UNDER_FRAG,
      defines: { IS_PAPER: 1 },
      uniforms: this.uniforms({ ...common, uAlbedo: { value: new THREE.Color(0.93, 0.92, 0.88) } }),
    })
    const sheet = new THREE.Mesh(paperGeo, paperMat)
    sheet.position.z = 0.0003
    this.frame.add(sheet)
  }

  private buildLiquid(): THREE.ShaderMaterial {
    const f = this.tray.fluid
    const vx = f.nx + 1
    const vy = f.ny + 1
    const pos = new Float32Array(vx * vy * 3)
    for (let j = 0; j < vy; j++)
      for (let i = 0; i < vx; i++) {
        const q = (j * vx + i) * 3
        pos[q] = i * f.dx
        pos[q + 1] = j * f.dx
        pos[q + 2] = 0
      }
    const idx = new Uint32Array(f.nx * f.ny * 6)
    let k = 0
    for (let j = 0; j < f.ny; j++)
      for (let i = 0; i < f.nx; i++) {
        const a = j * vx + i
        idx[k++] = a
        idx[k++] = a + 1
        idx[k++] = a + vx
        idx[k++] = a + 1
        idx[k++] = a + vx + 1
        idx[k++] = a + vx
      }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(this.tray.trayW / 2, this.tray.trayH / 2, 0.02), 0.3)
    const mat = new THREE.ShaderMaterial({
      vertexShader: LIQUID_VERT,
      fragmentShader: LIQUID_FRAG,
      uniforms: this.uniforms({
        uNormalGain: { value: 1.6 },
        uTintFresh: { value: new THREE.Color(1.0, 0.93, 0.72) },
        uTintSpent: { value: new THREE.Color(0.55, 0.36, 0.14) },
        uBulbRadiance: { value: 260 },
      }),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = 2
    mesh.frustumCulled = false
    this.frame.add(mesh)
    return mat
  }

  private buildPoints(): void {
    const mk = (geo: THREE.BufferGeometry, pos: Float32Array, size: Float32Array, frag: string, order: number) => {
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage))
      geo.setDrawRange(0, 0)
      const mat = new THREE.ShaderMaterial({
        vertexShader: POINTS_VERT,
        fragmentShader: frag,
        uniforms: this.uniforms({ uScale: { value: 800 } }),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      this.pointMats.push(mat)
      const pts = new THREE.Points(geo, mat)
      pts.frustumCulled = false
      pts.renderOrder = order
      this.frame.add(pts)
    }
    mk(this.bubbleGeo, this.bubblePos, this.bubbleSize, BUBBLE_FRAG, 3)
    mk(this.dropGeo, this.dropPos, this.dropSize, DROP_FRAG, 4)
  }

  private buildStream(): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(1, 0.8, 1, 10, 1, true)
    geo.translate(0, 0.5, 0) // base at origin, grows along +y
    const mat = new THREE.ShaderMaterial({
      vertexShader: STREAM_VERT,
      fragmentShader: STREAM_FRAG,
      uniforms: this.uniforms({ uTime: { value: 0 }, uOpacity: { value: 1 } }),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    this.streamMats.push(mat)
    const m = new THREE.Mesh(geo, mat)
    m.visible = false
    m.renderOrder = 5
    m.frustumCulled = false
    this.scene.add(m)
    return m
  }

  private buildJug(): void {
    // a 1 L graduate: lathe body, rim, handle, spout notch
    const mat = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.25, metalness: 0, side: THREE.DoubleSide })
    const prof: THREE.Vector2[] = []
    const R = 0.034
    const Hh = 0.095
    prof.push(new THREE.Vector2(0.0, 0))
    prof.push(new THREE.Vector2(R * 0.92, 0))
    prof.push(new THREE.Vector2(R, 0.006))
    prof.push(new THREE.Vector2(R * 1.06, Hh))
    prof.push(new THREE.Vector2(R * 1.1, Hh + 0.003))
    prof.push(new THREE.Vector2(R * 1.02, Hh + 0.003))
    prof.push(new THREE.Vector2(R * 0.98, Hh - 0.002))
    prof.push(new THREE.Vector2(R * 0.9, 0.008))
    prof.push(new THREE.Vector2(0.0, 0.008))
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), mat)
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 16, Math.PI), mat)
    handle.rotation.z = -Math.PI / 2
    handle.position.set(-R * 1.05, Hh * 0.55, 0)
    const spout = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.022, 10, 1, true), mat)
    spout.rotation.z = -Math.PI / 2 - 0.5
    spout.position.set(R * 1.12, Hh - 0.004, 0)
    // graduation marks
    const marks = new THREE.Group()
    for (let i = 1; i <= 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0015, 0.001), new THREE.MeshStandardMaterial({ color: 0x2a1a10 }))
      m.position.set(0, (Hh * i) / 5, R * 1.02 + 0.0005 * i)
      marks.add(m)
    }
    // the jug's local origin is at its spout tip so tilting pivots there
    const inner = new THREE.Group()
    inner.add(body, handle, spout, marks)
    inner.position.set(-R * 1.2, -Hh, 0)
    this.jug.add(inner)
    this.jug.userData.spoutTip = new THREE.Vector3(0, 0, 0)
    this.scene.add(this.jug)
  }

  // ------------------------------------------------------------------ lighting / layout

  setLighting(mode: Lighting): void {
    this.lightingMode = mode
    const lp = this.shared.uLightPos.value as THREE.Vector3
    const lc = this.shared.uLightColor.value as THREE.Color
    const amb = this.shared.uAmbient.value as THREE.Color
    if (mode === 'safe') {
      lp.set(-0.34, 0.78, -0.42)
      lc.setRGB(1.0, 0.3, 0.07)
      this.shared.uLightPower.value = 0.85
      amb.setRGB(0.07, 0.025, 0.008)
      this.scene.background = new THREE.Color(0x070302)
    } else {
      lp.set(0.15, 1.3, 0.35)
      lc.setRGB(1.0, 0.97, 0.9)
      this.shared.uLightPower.value = 3.6
      amb.setRGB(0.55, 0.56, 0.6)
      this.scene.background = new THREE.Color(0x2a2c30)
    }
    this.light.position.copy(lp)
    this.light.color.copy(lc)
    this.light.intensity = this.shared.uLightPower.value as number
    this.ambient.color.copy(amb)
    this.ambient.intensity = 1
  }

  get lighting(): Lighting {
    return this.lightingMode
  }

  resize(w: number, h: number): void {
    const dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    this.camera.aspect = aspect
    this.portrait = aspect < 0.9
    this.camera.fov = this.portrait ? 40 : 34
    // frame the tray (plus a little bench) at ~58 deg elevation
    const halfW = (this.portrait ? this.tray.trayH : this.tray.trayW) / 2 + 0.06
    const halfD = (this.portrait ? this.tray.trayW : this.tray.trayH) / 2 + 0.07
    const vfov = (this.camera.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
    const elev = (58 * Math.PI) / 180
    const dW = halfW / Math.tan(hfov / 2)
    const dD = (halfD * Math.sin(elev)) / Math.tan(vfov / 2) + halfD * Math.cos(elev)
    const d = Math.max(dW, dD) * 1.02
    const yaw = this.portrait ? Math.PI / 2 : 0
    const target = new THREE.Vector3(0, 0, this.portrait ? 0 : 0.012)
    this.camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(elev) * d,
      target.y + Math.sin(elev) * d,
      target.z + Math.cos(yaw) * Math.cos(elev) * d,
    )
    this.camera.lookAt(target)
    this.camera.updateProjectionMatrix()
    const scale = (h * dpr) / (2 * Math.tan(vfov / 2))
    for (const m of this.pointMats) m.uniforms.uScale.value = scale
    // park the jug at the screen-right far corner of the bench
    const { trayW: W, trayH: H } = this.tray
    if (this.portrait) this.jugHome.set(W / 2 + 0.03, 0, -H / 2 - 0.07)
    else this.jugHome.set(W / 2 + 0.07, 0, -0.04)
  }

  // ------------------------------------------------------------------ per frame

  /** Tray-frame point (m) -> world. */
  trayToWorld(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    return this.frame.localToWorld(out.set(x, y, z))
  }

  /** Screen NDC -> tray coords on the liquid plane (z = 6 mm), or null. */
  pickTray(ndcX: number, ndcY: number): { x: number; y: number } | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(this.frame.getWorldQuaternion(new THREE.Quaternion()))
    const p = this.trayToWorld(0, 0, 0.006)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p)
    const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3())
    if (!hit) return null
    const l = this.frame.worldToLocal(hit)
    return { x: l.x, y: l.y }
  }

  /** Is the jug under this NDC point? */
  pickJug(ndcX: number, ndcY: number): boolean {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    const box = new THREE.Box3().setFromObject(this.jug).expandByScalar(0.02)
    return this.raycaster.ray.intersectsBox(box)
  }

  /** Screen drag (CSS px) -> a direction on the bench in tray coords (unit-ish). Accounts for camera yaw. */
  screenToTrayDir(dxPx: number, dyPx: number): { x: number; y: number } {
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    const fwd = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 2).negate()
    right.y = 0
    fwd.y = 0
    right.normalize()
    fwd.normalize()
    const wx = right.x * dxPx - fwd.x * dyPx
    const wz = right.z * dxPx - fwd.z * dyPx
    // world (x, z) -> tray (x, y) with y = -z
    return { x: wx, y: -wz }
  }

  sync(dt: number): void {
    this.time += dt
    const tray = this.tray
    const f = tray.fluid
    // ---- tray pose: rotate by the rig, then lift so the lowest bottom corner rests on the bench
    const r = tray.rig
    this.tilt.rotation.set(-r.ay, 0, -r.ax, 'XZY')
    this.tilt.position.set(r.px, 0, -r.py)
    this.tilt.updateMatrixWorld(true)
    let minY = Infinity
    const v = new THREE.Vector3()
    for (const [x, y] of [[-WALL, -WALL], [tray.trayW + WALL, -WALL], [-WALL, tray.trayH + WALL], [tray.trayW + WALL, tray.trayH + WALL]]) {
      this.frame.localToWorld(v.set(x, y, -BASE))
      if (v.y < minY) minY = v.y
    }
    this.tilt.position.y -= minY
    this.tilt.updateMatrixWorld(true)
    this.shadow.position.x = r.px
    this.shadow.position.z = -r.py
    // ---- fluid texture
    // corner field: mean of the (up to) 4 cells touching each corner
    const d = this.fluidData
    const h = f.h
    const s = f.s
    const sp = f.speed
    const nx = f.nx
    const ny = f.ny
    for (let j = 0, q = 0; j <= ny; j++) {
      const j0 = j > 0 ? j - 1 : 0
      const j1 = j < ny ? j : ny - 1
      for (let i = 0; i <= nx; i++, q += 4) {
        const i0 = i > 0 ? i - 1 : 0
        const i1 = i < nx ? i : nx - 1
        const a = j0 * nx + i0
        const b = j0 * nx + i1
        const c = j1 * nx + i0
        const e = j1 * nx + i1
        d[q] = 0.25 * (h[a] + h[b] + h[c] + h[e])
        d[q + 1] = 0.25 * (s[a] + s[b] + s[c] + s[e])
        d[q + 2] = 0.25 * (sp[a] + sp[b] + sp[c] + sp[e])
      }
    }
    this.fluidTex.needsUpdate = true
    // ---- paper texture (only when the chemistry ticked)
    if (tray.paper.dirty) {
      this.paperTex.needsUpdate = true
      tray.paper.dirty = false
    }
    // ---- bubbles
    const bub = tray.paper.bubbles
    for (let i = 0; i < bub.length; i++) {
      const b = bub[i]
      this.bubblePos[i * 3] = b.x
      this.bubblePos[i * 3 + 1] = b.y
      this.bubblePos[i * 3 + 2] = 0.0004 + b.r * 0.5
      this.bubbleSize[i] = b.r * 2.2
    }
    this.bubbleGeo.setDrawRange(0, bub.length)
    this.bubbleGeo.attributes.position.needsUpdate = true
    this.bubbleGeo.attributes.aSize.needsUpdate = true
    // ---- droplets
    const dr = tray.drops
    for (let i = 0; i < tray.dropCount; i++) {
      this.dropPos[i * 3] = dr[i * 7]
      this.dropPos[i * 3 + 1] = dr[i * 7 + 1]
      this.dropPos[i * 3 + 2] = dr[i * 7 + 2]
      this.dropSize[i] = 0.0026
    }
    this.dropGeo.setDrawRange(0, tray.dropCount)
    this.dropGeo.attributes.position.needsUpdate = true
    this.dropGeo.attributes.aSize.needsUpdate = true
    // ---- jug + pour stream
    this.syncJug(dt)
    // ---- drain stream from the spout
    this.syncDrain()
    for (const m of this.streamMats) m.uniforms.uTime.value = this.time
  }

  private syncJug(dt: number): void {
    const p = this.tray.pourState
    const pouring = p.rate > 0
    const targetTilt = pouring ? 1.15 : 0
    this.jugTilt += (targetTilt - this.jugTilt) * Math.min(1, dt * 9)
    // where the stream lands (world), at the liquid surface
    const land = this.trayToWorld(p.x, p.y, this.tray.fluid.sampleH(p.x, p.y))
    const above = land.clone().add(new THREE.Vector3(0, 0.11, 0))
    const want = pouring || this.jugTilt > 0.05 ? above : this.jugHome.clone().add(new THREE.Vector3(0.034 * 1.2, 0.095, 0))
    this.jugPos.lerp(want, Math.min(1, dt * (pouring ? 10 : 6)))
    if (this.jugPos.lengthSq() === 0) this.jugPos.copy(want)
    this.jug.position.copy(this.jugPos)
    // tip toward the camera-right so the stream falls from the spout tip
    this.jug.rotation.set(0, this.portrait ? Math.PI / 2 : 0, -this.jugTilt)
    const show = pouring && this.jugTilt > 0.6
    this.pourStream.visible = show
    if (show) {
      const top = this.jug.position.clone()
      const len = Math.max(0.01, top.y - land.y)
      this.pourStream.position.set(top.x, land.y, top.z)
      const rad = 0.0016 + Math.sqrt(p.rate / 1.6e-4) * 0.0022
      this.pourStream.scale.set(rad, len, rad)
      this.pourStream.rotation.set(0, 0, 0)
    }
  }

  private syncDrain(): void {
    const f = this.tray.fluid
    // find the strongest outflow edge
    let best = 0
    let bx = 0
    let by = 0
    let nxn = 0
    let nyn = 0
    for (let j = 0; j < f.ny; j++) {
      if (f.outL[j] > best) { best = f.outL[j]; bx = 0; by = (j + 0.5) * f.dx; nxn = -1; nyn = 0 }
      if (f.outR[j] > best) { best = f.outR[j]; bx = f.width; by = (j + 0.5) * f.dx; nxn = 1; nyn = 0 }
    }
    for (let i = 0; i < f.nx; i++) {
      if (f.outB[i] > best) { best = f.outB[i]; bx = (i + 0.5) * f.dx; by = 0; nxn = 0; nyn = -1 }
      if (f.outT[i] > best) { best = f.outT[i]; bx = (i + 0.5) * f.dx; by = f.height; nxn = 0; nyn = 1 }
    }
    // total across all edges for the stream width
    let total = 0
    for (let j = 0; j < f.ny; j++) total += f.outL[j] + f.outR[j]
    for (let i = 0; i < f.nx; i++) total += f.outB[i] + f.outT[i]
    const show = total > 2e-6
    this.drainStream.visible = show
    if (!show) return
    const lipZ = Math.max(f.sampleH(bx, by), 0.02)
    const start = this.trayToWorld(bx + nxn * (WALL + 0.012), by + nyn * (WALL + 0.012), lipZ)
    const len = Math.max(0.005, start.y)
    this.drainStream.position.set(start.x, 0, start.z)
    const rad = 0.0015 + Math.sqrt(total / 1.6e-4) * 0.0028
    this.drainStream.scale.set(rad, len, rad)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  /** Debug: gravity direction implied by the rendered pose, in tray frame (should match rig.gravity()). */
  renderedGravity(): [number, number, number] {
    this.frame.updateMatrixWorld(true)
    const q = this.frame.getWorldQuaternion(new THREE.Quaternion()).invert()
    const g = new THREE.Vector3(0, -9.81, 0).applyQuaternion(q)
    return [g.x, g.y, g.z]
  }
}
