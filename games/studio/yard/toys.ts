// Yard toys (studio.md §5.5): tire swing (Rapier), impact sprinkler with analytic GPU drops and a physically
// placed rainbow, the Y-string lantern, the whirligig, wind chimes, and the props (ball, bucket, watering can,
// crate). Each toy registers a PhotoSubject.
import * as THREE from 'three'
import { Audio } from '@shared/audio'
import type { Engine } from '../core/engine'
import type { PhysBody, Physics } from '../core/physics'
import type { PhotoSubject } from '../core/contracts'
import type { Wind } from './wind'
import { box, mat } from '../house/architecture'

const D2R = Math.PI / 180

export interface Swing { body: PhysBody; anchor: THREE.Vector3; L: number; pull(rad: number): void; angle(): number; omega(): number; subject: PhotoSubject }
export interface Sprinkler { on: boolean; set(on: boolean): void; root: THREE.Group; subject: PhotoSubject; points: THREE.Points; aliveAt(t: number): number }
export interface Lantern { root: THREE.Group; knot: number; setKnot(r: number): void; push(vx: number, vy: number): void; set(x: number, y: number, vx: number, vy: number): void; subject: PhotoSubject; ball: THREE.Mesh; gel: number; setGel(i: number): void; pos(out: THREE.Vector3): THREE.Vector3 }
export interface Whirligig { omega: number; poke(): void; subject: PhotoSubject; root: THREE.Group }
export interface Props { ball: PhysBody; bucket: PhysBody; can: PhysBody; extra: PhysBody[]; addCrateAndBalls(): void; subjects: PhotoSubject[] }

// -------------------------------------------------------------------------------- swing
export function createSwing(e: Engine, ph: Physics): Swing {
  const R = ph.R
  const anchor = new THREE.Vector3(-4.2, 3.0, 10)
  const L = 2.4
  const tire = new THREE.Group()
  tire.name = 'tire'
  const rubber = mat(0x1f1d1c, { rough: 0.85 })
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.11, 10, 24), rubber)
  torus.castShadow = true
  torus.receiveShadow = true
  tire.add(torus)
  e.scene.add(tire)
  const desc = R.RigidBodyDesc.dynamic().setTranslation(anchor.x, anchor.y - L, anchor.z).setLinearDamping(0.01).setAngularDamping(0.05).setCanSleep(false)
  const cols: ReturnType<typeof R.ColliderDesc.ball>[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    cols.push(R.ColliderDesc.ball(0.11).setTranslation(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0).setDensity(202).setRestitution(0.3))
  }
  const body = ph.add(tire, desc, cols, { grabbable: true, material: 'rubber', name: 'swing', radius: 0.47 })
  const fixed = ph.fixed([], [anchor.x, anchor.y, anchor.z])
  // the tire hangs from its top: local anchor 2.4 m above the tire centre is the limb
  ph.world.createImpulseJoint(R.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: L, z: 0 }), fixed, body.body, true)
  // rope
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 1, 6), mat(0xb59a6a, { rough: 1 }))
  rope.castShadow = true
  e.scene.add(rope)
  const top = new THREE.Vector3()
  const mid = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  e.onFrame(() => {
    top.set(0, 0.36, 0).applyQuaternion(tire.quaternion).add(tire.position)
    mid.addVectors(top, anchor).multiplyScalar(0.5)
    rope.position.copy(mid)
    const d = anchor.clone().sub(top)
    rope.scale.set(1, d.length(), 1)
    rope.quaternion.setFromUnitVectors(up, d.normalize())
  })
  const angle = () => {
    const t = body.body.translation()
    const dx = t.x - anchor.x
    const dz = t.z - anchor.z
    return Math.atan2(Math.hypot(dx, dz), anchor.y - t.y)
  }
  const omega = () => {
    const v = body.body.linvel()
    return Math.hypot(v.x, v.y, v.z) / L
  }
  // creak at turnarounds (|ω| local minimum with amplitude > 0.1 rad)
  let prevW = 0
  let prev2W = 0
  e.sim.add({
    step() {
      const w = omega()
      if (prev2W > prevW && w > prevW && angle() > 0.1) {
        const th = angle()
        const tension = (9 * (9.81 * Math.cos(th) + L * prevW * prevW)) / 120
        Audio.play('studio.swing-creak', { tension: Math.min(1, tension), omega: Math.abs(prevW) })
      }
      prev2W = prevW
      prevW = w
    },
  }, 5)
  const subject: PhotoSubject = {
    id: 'swing', tag: 'swing', dynamic: true, radius: 0.47,
    colliderHandle: body.body.collider(0).handle,
    center: (out) => out.copy(tire.position),
    sample: () => ({ angle: angle(), omega: omega(), angleAbs: angle(), omegaAbs: omega() }),
  }
  return {
    body, anchor, L, subject, angle, omega,
    pull(rad) {
      // swing out toward −x (west), released at rest
      const th = rad
      const pos = { x: anchor.x - Math.sin(th) * L, y: anchor.y - Math.cos(th) * L, z: anchor.z }
      body.body.setTranslation(pos, true)
      body.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      body.body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -th), true)
      body.prevPos.set(pos.x, pos.y, pos.z)
    },
  }
}

// -------------------------------------------------------------------------------- sprinkler
const DROP_VERT = /* glsl */ `
attribute float aTe;
attribute vec3 aV0;
attribute vec3 aWd;
uniform float uTime;
uniform float uViewH;
uniform vec3 uSunDir;
uniform float uSunL;
uniform float uSkyL;
varying vec3 vCol;
varying float vAlive;
const float K = 0.35;
const vec3 G = vec3(0.0, -9.81, 0.0);
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
void main() {
  float tau = uTime - aTe;
  float e = exp(-K * tau);
  vec3 p = position + aWd * tau + (aV0 - aWd) * (1.0 - e) / K + G * (tau / K - (1.0 - e) / (K * K));
  vAlive = (tau >= 0.0 && p.y > 0.0 && aTe > -1000.0) ? 1.0 : 0.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vAlive > 0.5 ? clamp(0.003 * projectionMatrix[1][1] * uViewH * 0.5 / max(0.05, gl_Position.w), 1.6, 6.0) : 0.0;
  vec3 v = normalize(p - cameraPosition);
  float a = degrees(acos(clamp(dot(v, -uSunDir), -1.0, 1.0)));
  vec3 col = vec3(0.85, 0.9, 0.95) * 0.12 * (uSunL + uSkyL);
  if (a > 40.6 && a < 42.4) { float u = (a - 40.6) / 1.8; col += hue(0.78 * (1.0 - u)) * uSunL * 0.3; }
  else if (a > 50.2 && a < 53.6) { float u = (a - 50.2) / 3.4; col += hue(0.78 * u) * uSunL * 0.13; }
  else if (a > 42.4 && a < 50.2) col *= 0.6;
  col += vec3(1.0) * uSunL * 0.12 * pow(max(dot(v, uSunDir), 0.0), 6.0);
  vCol = col;
}
`
const DROP_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vAlive;
void main() {
  if (vAlive < 0.5) discard;
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(vCol, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createSprinkler(e: Engine, ph: Physics, wind: Wind): Sprinkler {
  const N = e.quality.drops
  const base = new THREE.Vector3(3, 0, 7)
  const nozzleH = 0.3
  const root = new THREE.Group()
  root.name = 'sprinkler'
  root.position.copy(base)
  const brass = mat(0xb08d3c, { metal: 0.8, rough: 0.35 })
  const sled = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.06, 12), mat(0x3e6a3a, { metal: 0.3, rough: 0.6 }))
  sled.position.y = 0.03
  sled.castShadow = true
  root.add(sled)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 8), brass)
  stem.position.y = 0.17
  root.add(stem)
  const arm = new THREE.Group()
  arm.position.y = nozzleH
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.16, 8), brass)
  nozzle.rotation.x = Math.PI / 2 - 27 * D2R
  nozzle.position.z = 0.06
  arm.add(nozzle)
  const paddle = box(0.02, 0.05, 0.08, brass, 0, 0.03, 0.15, arm)
  paddle.castShadow = false
  root.add(arm)
  e.scene.add(root)
  ph.fixed([ph.R.ColliderDesc.cylinder(0.04, 0.18).setTranslation(0, 0.04, 0)], [base.x, base.y, base.z])
  // hose from the house to the sprinkler
  const hoseCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(1.6, 0.5, 0.1), new THREE.Vector3(1.8, 0.03, 1.2), new THREE.Vector3(2.4, 0.03, 4), new THREE.Vector3(2.7, 0.03, 6.2), new THREE.Vector3(2.85, 0.04, 6.85)])
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 40, 0.018, 6), mat(0x2c7547, { rough: 0.6 }))
  hose.castShadow = true
  e.scene.add(hose)
  const spigot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), brass)
  spigot.position.set(1.6, 0.55, 0.1)
  spigot.rotation.x = Math.PI / 2
  spigot.name = 'spigot'
  e.scene.add(spigot)

  // drops: CPU ring buffer of emission records; the GPU evaluates positions analytically
  const geo = new THREE.BufferGeometry()
  const p0 = new Float32Array(N * 3)
  const te = new Float32Array(N).fill(-1e6)
  const v0 = new Float32Array(N * 3)
  const wd = new Float32Array(N * 3)
  geo.setAttribute('position', new THREE.BufferAttribute(p0, 3))
  geo.setAttribute('aTe', new THREE.BufferAttribute(te, 1))
  geo.setAttribute('aV0', new THREE.BufferAttribute(v0, 3))
  geo.setAttribute('aWd', new THREE.BufferAttribute(wd, 3))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(base.x, 2, base.z + 3), 14)
  const uniforms = {
    uTime: { value: 0 }, uViewH: { value: 800 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunL: { value: 1 }, uSkyL: { value: 1 },
  }
  const pmat = new THREE.ShaderMaterial({ vertexShader: DROP_VERT, fragmentShader: DROP_FRAG, uniforms })
  const points = new THREE.Points(geo, pmat)
  points.frustumCulled = false
  points.name = 'drops'
  const vp = new THREE.Vector4()
  points.onBeforeRender = (r) => {
    r.getCurrentViewport(vp)
    uniforms.uViewH.value = vp.w
  }
  e.scene.add(points)

  const rng = e.rng('sprinkler')
  let head = 0
  let emitAcc = 0
  let on = false
  const SWEEP = 18 * 0.42
  const PERIOD = SWEEP + 1.2
  let lastStep = -1
  let returning = false
  const azAt = (t: number) => {
    const ph2 = ((t % PERIOD) + PERIOD) % PERIOD
    if (ph2 < SWEEP) return (270 + 10 * Math.floor(ph2 / 0.42)) % 360
    return (90 - 180 * ((ph2 - SWEEP) / 1.2) + 360) % 360
  }
  const wv = new THREE.Vector3()
  let tStart = 0
  e.sim.add({
    step(dt, t) {
      if (!on) return
      const tt = t - tStart
      const az = azAt(tt)
      const ph2 = ((tt % PERIOD) + PERIOD) % PERIOD
      const stepI = ph2 < SWEEP ? Math.floor(ph2 / 0.42) : -1
      if (stepI !== lastStep) {
        if (stepI >= 0) Audio.play('studio.sprinkler-tsk', {})
        lastStep = stepI
      }
      if (ph2 >= SWEEP && !returning) {
        returning = true
        Audio.play('studio.sprinkler-return', {})
      } else if (ph2 < SWEEP) returning = false
      emitAcc += 350 * dt
      while (emitAcc >= 1) {
        emitAcc -= 1
        const i = head
        head = (head + 1) % N
        const tEmit = t + rng() * dt
        const a = (az + (rng() * 2 - 1) * 2.5) * D2R
        const el = (27 + (rng() * 2 - 1) * 2.5) * D2R
        const sp = 9.5 * (1 + (rng() * 2 - 1) * 0.06)
        p0[i * 3] = base.x + Math.sin(a) * 0.08
        p0[i * 3 + 1] = base.y + nozzleH
        p0[i * 3 + 2] = base.z + Math.cos(a) * 0.08
        v0[i * 3] = Math.sin(a) * Math.cos(el) * sp
        v0[i * 3 + 1] = Math.sin(el) * sp
        v0[i * 3 + 2] = Math.cos(a) * Math.cos(el) * sp
        wind.vec(base.x, base.z, tEmit, wv)
        wd[i * 3] = wv.x
        wd[i * 3 + 1] = 0
        wd[i * 3 + 2] = wv.z
        te[i] = tEmit
      }
      ;(geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
      ;(geo.attributes.aTe as THREE.BufferAttribute).needsUpdate = true
      ;(geo.attributes.aV0 as THREE.BufferAttribute).needsUpdate = true
      ;(geo.attributes.aWd as THREE.BufferAttribute).needsUpdate = true
    },
  }, 10)
  let sprayLoop: ReturnType<typeof Audio.loop> | null = null
  e.sim.onPose((t) => {
    uniforms.uTime.value = t
    const s = e.sun()
    uniforms.uSunDir.value.copy(s.dir)
    uniforms.uSunL.value = s.sunLux / Math.PI / 1000
    uniforms.uSkyL.value = (s.skyLux + s.moonLux) / Math.PI / 1000
    arm.rotation.y = on ? azAt(t - tStart) * D2R : arm.rotation.y
  })

  // drop math on the CPU (measures): position of drop i at time t
  const K = 0.35
  const dropPos = (i: number, t: number, out: THREE.Vector3): boolean => {
    const tau = t - te[i]
    if (tau < 0) return false
    const ex = Math.exp(-K * tau)
    const a = (1 - ex) / K
    const gk = tau / K - (1 - ex) / (K * K)
    out.set(
      p0[i * 3] + wd[i * 3] * tau + (v0[i * 3] - wd[i * 3]) * a,
      p0[i * 3 + 1] + wd[i * 3 + 1] * tau + (v0[i * 3 + 1] - wd[i * 3 + 1]) * a - 9.81 * gk,
      p0[i * 3 + 2] + wd[i * 3 + 2] * tau + (v0[i * 3 + 2] - wd[i * 3 + 2]) * a,
    )
    return out.y > 0
  }
  const aliveAt = (t: number) => {
    let n = 0
    for (let i = 0; i < N; i++) if (dropPos(i, t, tmpA)) n++
    return n
  }
  const tmpA = new THREE.Vector3()
  const tmpB = new THREE.Vector3()
  const ndc = new THREE.Vector3()
  // measures (§5.13): dropBlurPx (median over 16 drops alive at mid), sprayCoverage (16×12 cells at mid), rainbowPx
  let mStart = 0
  let picked: number[] = []
  let coverage = 0
  let rainbowPx = 0
  const camStart = new THREE.Matrix4()
  const proj = (m: THREE.Matrix4, p: THREE.Vector3, W: number, H: number, out: THREE.Vector2): boolean => {
    ndc.copy(p).applyMatrix4(m)
    out.set((ndc.x * 0.5 + 0.5) * W, (1 - (ndc.y * 0.5 + 0.5)) * H)
    return ndc.z < 1 && ndc.z > -1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1
  }
  const pv = new THREE.Vector2()
  const pw = new THREE.Vector2()
  const subject: PhotoSubject = {
    id: 'sprinkler', tag: 'sprinkler', dynamic: true, radius: 0.3,
    center: (out) => out.set(base.x, 1.2, base.z + 2.5),
    sample: () => ({ on }),
    extra(cam, W, H, phase): Record<string, number> {
      const t = e.sim.t
      const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
      if (phase === 'start') {
        mStart = t
        camStart.copy(m)
        return {}
      }
      if (phase === 'mid') {
        picked = []
        const cells = new Uint8Array(16 * 12)
        let rb = 0
        const s = e.sun()
        const anti = s.dir.clone().negate()
        const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld)
        for (let i = 0; i < N; i++) {
          if (!dropPos(i, t, tmpA)) continue
          if (proj(m, tmpA, W, H, pv)) {
            const cx = Math.min(15, Math.floor((pv.x / W) * 16))
            const cy = Math.min(11, Math.floor((pv.y / H) * 12))
            cells[cy * 16 + cx] = 1
            if (picked.length < 16 && i % 3 === 0) picked.push(i)
            if (s.sunLux > 500) {
              const ang = Math.acos(THREE.MathUtils.clamp(tmpA.clone().sub(camPos).normalize().dot(anti), -1, 1)) / D2R
              if (ang > 40.6 && ang < 42.4) rb++
            }
          }
        }
        let c = 0
        for (const v of cells) c += v
        coverage = c / cells.length
        rainbowPx = rb * 4
        return {}
      }
      // end: blur of the picked drops between exposure start and end
      const blurs: number[] = []
      for (const i of picked) {
        const t0 = Math.max(mStart, te[i])
        if (!dropPos(i, t0, tmpA)) continue
        let t1 = t
        if (!dropPos(i, t1, tmpB)) {
          // died during the exposure: walk back to its landing
          let lo = t0
          let hi = t1
          for (let k = 0; k < 12; k++) {
            const mid = (lo + hi) / 2
            if (dropPos(i, mid, tmpB)) lo = mid
            else hi = mid
          }
          t1 = lo
          dropPos(i, t1, tmpB)
        }
        proj(camStart, tmpA, W, H, pv)
        proj(m, tmpB, W, H, pw)
        blurs.push(pv.distanceTo(pw))
      }
      blurs.sort((a, b) => a - b)
      const med = blurs.length ? blurs[Math.floor(blurs.length / 2)] : 0
      return { dropBlurPx: med, sprayCoverage: coverage, rainbowPx, drops: picked.length }
    },
  }
  return {
    get on() {
      return on
    },
    set(v: boolean) {
      if (v === on) return
      on = v
      if (on) {
        tStart = e.sim.t
        lastStep = -1
        sprayLoop = Audio.loop('studio.spray', { level: 0.5 })
      } else {
        sprayLoop?.stop(0.3)
        sprayLoop = null
      }
    },
    root, subject, points, aliveAt,
  }
}

// -------------------------------------------------------------------------------- lantern
export function createLantern(e: Engine): Lantern {
  const top = new THREE.Vector3(6, 3.6, 12)
  const Ltot = 2.0
  let Llow = 0.888 // 0.444 · L_total by default (3:2)
  const gamma = 0.03
  // state in lantern-local coords: x across the frame plane (world z), y along it (world x)
  const st = { x: 0, y: 0, vx: 0, vy: 0 }
  const root = new THREE.Group()
  root.name = 'lantern'
  e.scene.add(root)
  const GELS = [0xffd9a0, 0xff6a5a, 0x7dff8a]
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(GELS[0]).multiplyScalar(8) })
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), lampMat)
  ball.name = 'lantern-ball'
  root.add(ball)
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2622, wireframe: true }))
  ball.add(cage)
  const light = new THREE.PointLight(GELS[0], 0.002, 0, 2)
  ball.add(light)
  const strMat = new THREE.LineBasicMaterial({ color: 0xd8d0c0 })
  const strGeo = new THREE.BufferGeometry()
  const strPos = new Float32Array(4 * 3 * 2)
  strGeo.setAttribute('position', new THREE.BufferAttribute(strPos, 3))
  const strings = new THREE.LineSegments(strGeo, strMat)
  strings.frustumCulled = false
  root.add(strings)
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0xb08d3c, { metal: 0.8, rough: 0.3 }))
  knot.name = 'lantern-knot'
  root.add(knot)
  const anchors = [new THREE.Vector3(5.55, 3.6, 12), new THREE.Vector3(6.45, 3.6, 12)]
  const pos = (out: THREE.Vector3) => {
    const dx = st.y
    const dz = st.x
    const r2 = dx * dx + dz * dz
    return out.set(top.x + dx, top.y - Ltot + r2 / (2 * Ltot), top.z + dz)
  }
  const knotPos = new THREE.Vector3()
  const lp = new THREE.Vector3()
  const update = () => {
    pos(lp)
    ball.position.copy(lp)
    // knot hangs on the line from the crossbar midpoint to the lantern, L_lower above the lantern;
    // it only follows the lantern's along-frame (y) swing through its lower string
    knotPos.set(top.x + st.y * (1 - Llow / Ltot) * 0, top.y - (Ltot - Llow), top.z + st.x * (1 - Llow / Ltot))
    knot.position.copy(knotPos)
    let k = 0
    const put = (v: THREE.Vector3) => {
      strPos[k++] = v.x
      strPos[k++] = v.y
      strPos[k++] = v.z
    }
    put(anchors[0]); put(knotPos)
    put(anchors[1]); put(knotPos)
    put(knotPos); put(lp)
    put(lp); put(lp)
    strGeo.attributes.position.needsUpdate = true
    strGeo.computeBoundingSphere()
  }
  e.sim.add({
    step(dt) {
      const wx = Math.sqrt(9.81 / Ltot)
      const wy = Math.sqrt(9.81 / Llow)
      st.vx += (-(wx * wx) * st.x - 2 * gamma * st.vx) * dt
      st.vy += (-(wy * wy) * st.y - 2 * gamma * st.vy) * dt
      st.x += st.vx * dt
      st.y += st.vy * dt
      const r = Math.hypot(st.x, st.y)
      if (r > 0.6) {
        st.x *= 0.6 / r
        st.y *= 0.6 / r
      }
    },
  }, 12)
  e.sim.onPose(update)
  update()
  let gel = 0
  const subject: PhotoSubject = {
    id: 'lantern', tag: 'lantern', dynamic: true, radius: 0.06,
    center: (out) => pos(out),
    sample: () => ({ x: st.x, y: st.y }),
  }
  return {
    root, ball, subject,
    get knot() {
      return Llow / Ltot
    },
    setKnot(r) {
      const DET = [0.25, 0.36, 0.444, 0.5625]
      let v = Math.max(0.15, Math.min(0.9, r))
      for (const d of DET) if (Math.abs(v - d) < 0.02) v = d
      Llow = v * Ltot
      update()
    },
    push(vx, vy) {
      st.vx += vx
      st.vy += vy
    },
    set(x, y, vx, vy) {
      st.x = x
      st.y = y
      st.vx = vx
      st.vy = vy
      update()
    },
    get gel() {
      return gel
    },
    setGel(i) {
      gel = i % GELS.length
      lampMat.color.set(GELS[gel]).multiplyScalar(8)
      light.color.set(GELS[gel])
    },
    pos,
  }
}

// -------------------------------------------------------------------------------- whirligig
export function createWhirligig(e: Engine, wind: Wind): Whirligig {
  const root = new THREE.Group()
  root.name = 'whirligig'
  root.position.set(13.5, 1.3, 10)
  const post = box(0.09, 1.3, 0.09, mat(0xf2ede2), 0, -0.65, 0, root)
  post.castShadow = true
  const hub = new THREE.Group()
  hub.position.set(-0.08, 0.05, 0)
  hub.rotation.z = 0
  const bladeMat = mat(0xc1652f, { rough: 0.6 })
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.25, 0.07), bladeMat)
    b.position.y = 0.13
    const g = new THREE.Group()
    g.rotation.x = (i / 4) * Math.PI * 2
    b.rotation.y = 0.5
    b.castShadow = true
    g.add(b)
    hub.add(g)
  }
  const bird = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), mat(0x2c7547))
  bird.rotation.z = Math.PI / 2
  bird.position.x = 0.08
  root.add(bird)
  root.add(hub)
  e.scene.add(root)
  let omega = 0
  let angle = 0
  e.sim.add({
    step(dt, t) {
      const w = wind.speed(13.5, 10, t)
      omega += ((6 * w - omega) / 0.6) * dt
      angle += omega * dt
    },
  }, 13)
  e.sim.onPose(() => {
    hub.rotation.x = angle
  })
  const subject: PhotoSubject = {
    id: 'whirligig', tag: 'whirligig', dynamic: true, radius: 0.25,
    center: (out) => out.set(13.42, 1.35, 10),
    sample: () => ({ omega }),
  }
  return {
    root, subject,
    get omega() {
      return omega
    },
    poke() {
      omega = Math.min(40, omega + 15)
      Audio.play('studio.impact', { material: 1, impulse: 0.6, mass: 0.1 })
    },
  }
}

// -------------------------------------------------------------------------------- chimes
export function createChimes(e: Engine, wind: Wind): void {
  const root = new THREE.Group()
  root.position.set(0.5, 2.4, 0.4)
  const metal = mat(0xc9c4b8, { metal: 0.9, rough: 0.3 })
  const tubes: { g: THREE.Group; th: number; w: number }[] = []
  box(0.4, 0.02, 0.06, mat(0x6b4a2e), 0, 0, 0, root)
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group()
    g.position.set(-0.16 + i * 0.08, -0.02, 0)
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36 - i * 0.04, 6), metal)
    tube.position.y = -0.2 + i * 0.02
    tube.castShadow = true
    g.add(tube)
    root.add(g)
    tubes.push({ g, th: 0, w: 0 })
  }
  e.scene.add(root)
  const rng = e.rng('chimes')
  let clapper = 0
  let clapperW = 0
  e.sim.add({
    step(dt, t) {
      const w = wind.speed(0.5, 0.4, t)
      const force = 0.02 * w * w * (0.6 + 0.4 * Math.sin(t * 1.7 + rng() * 0.2))
      clapperW += (-9.81 / 0.3 * Math.sin(clapper) - 0.6 * clapperW + force * (rng() - 0.45) * 30) * dt
      clapper += clapperW * dt
      for (let i = 0; i < tubes.length; i++) {
        const tb = tubes[i]
        tb.w += (-9.81 / 0.25 * Math.sin(tb.th) - 0.8 * tb.w + force * (rng() - 0.5) * 20) * dt
        tb.th += tb.w * dt
        const rel = Math.abs(tb.w - clapperW) * 0.25
        if (rel > 0.15 && Math.abs(tb.th - clapper) < 0.02) {
          Audio.play('studio.chime', { tube: i })
          tb.w = -tb.w * 0.5
        }
      }
    },
  }, 14)
  e.sim.onPose(() => {
    for (const tb of tubes) tb.g.rotation.z = tb.th
  })
}

// -------------------------------------------------------------------------------- props
export function createProps(e: Engine, ph: Physics): Props {
  const R = ph.R
  const subjects: PhotoSubject[] = []
  const mk = (name: string, mesh: THREE.Object3D, pos: [number, number, number], cols: ReturnType<typeof R.ColliderDesc.ball>[], material: 'rubber' | 'metal' | 'wood', radius: number, ccd = false): PhysBody => {
    mesh.name = name
    mesh.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
    e.scene.add(mesh)
    const d = R.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2]).setCcdEnabled(ccd).setAngularDamping(0.4).setLinearDamping(0.05)
    const pb = ph.add(mesh, d, cols, { grabbable: true, material, name, radius })
    const lastV = { vy: 0 }
    subjects.push({
      id: name, tag: name.replace(/\d+$/, ''), dynamic: true, radius,
      colliderHandle: pb.body.collider(0).handle,
      center: (out) => out.copy(mesh.position),
      sample: () => {
        const v = pb.body.linvel()
        lastV.vy = v.y
        return { vy: v.y, speed: Math.hypot(v.x, v.y, v.z), airborne: mesh.position.y > radius + 0.05 }
      },
    })
    return pb
  }
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), mat(0xd23b2a, { rough: 0.5 }))
  const ball = mk('ball', ballMesh, [0.2, 0.3, 4.2], [R.ColliderDesc.ball(0.1).setMass(0.25).setRestitution(0.75).setFriction(0.8)], 'rubber', 0.1, true)
  // galvanized bucket
  const bucketMesh = new THREE.Group()
  const galv = mat(0xa8aca8, { metal: 0.85, rough: 0.4 })
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.28, 16, 1, true), galv)
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), galv)
  bottom.rotation.x = -Math.PI / 2
  bottom.position.y = -0.135
  bucketMesh.add(shell, bottom)
  ;(shell.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
  const bucket = mk('bucket', bucketMesh, [-2.2, 0.2, 2.0], [R.ColliderDesc.cylinder(0.14, 0.14).setMass(0.8).setRestitution(0.2)], 'metal', 0.16)
  // watering can
  const canMesh = new THREE.Group()
  const green = mat(0x3e6a3a, { metal: 0.5, rough: 0.5 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.24, 14), green)
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.3, 6), green)
  spout.position.set(0.17, 0.05, 0)
  spout.rotation.z = -0.9
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI), green)
  handle.position.y = 0.12
  canMesh.add(body, spout, handle)
  const can = mk('can', canMesh, [-3.6, 0.2, 1.6], [R.ColliderDesc.cylinder(0.12, 0.12).setMass(0.6).setRestitution(0.2)], 'metal', 0.15)
  const extra: PhysBody[] = []
  let crateAdded = false
  return {
    ball, bucket, can, extra, subjects,
    addCrateAndBalls() {
      if (crateAdded) return
      crateAdded = true
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), mat(0xb08a5a, { rough: 0.9 }))
      extra.push(mk('crate', crate, [-4.5, 0.3, 1.4], [R.ColliderDesc.cuboid(0.25, 0.175, 0.2).setMass(2).setRestitution(0.1)], 'wood', 0.3))
      const cols = [0xd23b2a, 0x2c6fb0, 0xe8c040, 0x2c7547, 0xf2ede2, 0x7e1f1a]
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), mat(cols[i], { rough: 0.5 }))
        extra.push(mk('ball' + (i + 2), m, [-2.2 + (i % 2) * 0.05, 0.5 + i * 0.22, 2.0], [R.ColliderDesc.ball(0.1).setMass(0.25).setRestitution(0.75)], 'rubber', 0.1, true))
      }
    },
  }
}
