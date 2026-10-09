/**
 * Cloth for laundry lines, flags, dark cloths and sheets.
 *
 *  - VerletCloth: pure TypeScript position-based cloth (structural + shear + bend constraints),
 *    quadratic aerodynamic drag per triangle (so it billows and flaps rather than drifts),
 *    ground contact, and two-way coupling with spheres from the physics world (a thrown ball
 *    gets caught by the sheet and the sheet swings away). No DOM, no Rapier dependency.
 *  - RapierSoftCloth: the same surface built with Rapier 0.21's SoftBodyDesc.cloth, so contacts
 *    with every collider are two-way for free. Experimental (see NOTES.md for the comparison).
 *
 * Both expose the same `ClothSim` interface and write into one indexed BufferGeometry.
 */
import type { RigidBody, SoftBody } from '@dimforge/rapier3d-compat'
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Vector3 } from 'three'
import type { PhysicsWorld } from './physics-world'
import type { WindField } from './wind'

export interface ClothSphere {
  /** Centre in world space (update before each step). */
  center: Vector3
  radius: number
  /** If set, the cloth pushes back on this body (two-way coupling). */
  body?: RigidBody | null
}

export interface ClothOptions {
  /** Size in metres along `right` and `down`. */
  width: number
  height: number
  /** Particles along width and height. */
  nx: number
  ny: number
  /** Total mass, kg. A dry cotton single sheet is ~0.5 kg. Default 0.5. */
  mass?: number
  /** Constraint iterations per step. Default 6. */
  iterations?: number
  /** Velocity damping per second. Default 0.4. */
  damping?: number
  /** Aerodynamic drag coefficient Cd (flat plate ~1.2). Default 1.2. */
  drag?: number
  /** Bending stiffness 0..1 (skip-one constraints). Default 0.08. */
  bend?: number
  /** Collision thickness, metres. Default 0.025. */
  thickness?: number
  /** Ground height for contact (or null to disable). Default 0. */
  groundY?: number | null
  /** Sub-steps per fixed step (more = stiffer, fewer tunnels). Default 1. */
  substeps?: number
}

export interface ClothSim {
  readonly geometry: BufferGeometry
  readonly nx: number
  readonly ny: number
  /** Particle index of grid cell (i along width, j along height). */
  index(i: number, j: number): number
  /** Pin a particle (to its current position, or to `p`). */
  pin(idx: number, p?: Vector3): void
  unpin(idx: number): void
  /** Move a pinned particle (e.g. a peg on a swaying line). */
  setPin(idx: number, p: Vector3): void
  /** Advance one fixed step. */
  step(dt: number, wind: WindField | null, spheres?: readonly ClothSphere[]): void
  /** Write render positions (interpolated by alpha) + normals into the geometry. */
  updateGeometry(alpha: number): void
  /** Current particle position. */
  particle(idx: number, out: Vector3): Vector3
  /** Pull a particle toward a point this step (finger poke / grab). */
  tug(idx: number, target: Vector3, strength: number): void
  /** Round-trip external state for PhysicsWorld snapshots. */
  saveState(): unknown
  loadState(s: unknown): void
  dispose(): void
}

const _w = new Vector3()
const _wv = [0, 0, 0]

/** Shared grid geometry builder (positions, uvs, triangle index). */
function buildGrid(nx: number, ny: number, positions: Float32Array): BufferGeometry {
  const g = new BufferGeometry()
  const pos = new BufferAttribute(new Float32Array(positions), 3)
  pos.setUsage(DynamicDrawUsage)
  g.setAttribute('position', pos)
  const nrm = new BufferAttribute(new Float32Array(nx * ny * 3), 3)
  nrm.setUsage(DynamicDrawUsage)
  g.setAttribute('normal', nrm)
  const uv = new Float32Array(nx * ny * 2)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      uv[(j * nx + i) * 2] = i / (nx - 1)
      uv[(j * nx + i) * 2 + 1] = 1 - j / (ny - 1)
    }
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  const idx: number[] = []
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i
      const b = a + 1
      const c = a + nx
      const d = c + 1
      // Alternate the diagonal so the cloth doesn't fold with a bias.
      if ((i + j) % 2 === 0) idx.push(a, c, b, b, c, d)
      else idx.push(a, c, d, a, d, b)
    }
  g.setIndex(idx)
  return g
}

/** Area-weighted vertex normals for an indexed grid, in place. */
function gridNormals(index: ArrayLike<number>, p: Float32Array, out: Float32Array): void {
  out.fill(0)
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3
    const b = index[t + 1] * 3
    const c = index[t + 2] * 3
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2]
    const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2]
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    out[a] += nx; out[a + 1] += ny; out[a + 2] += nz
    out[b] += nx; out[b + 1] += ny; out[b + 2] += nz
    out[c] += nx; out[c + 1] += ny; out[c + 2] += nz
  }
  for (let i = 0; i < out.length; i += 3) {
    const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1
    out[i] /= l; out[i + 1] /= l; out[i + 2] /= l
  }
}

// =========================================================================== VerletCloth

export class VerletCloth implements ClothSim {
  readonly geometry: BufferGeometry
  readonly nx: number
  readonly ny: number
  readonly n: number
  readonly pos: Float32Array
  readonly prev: Float32Array
  readonly invMass: Float32Array
  readonly opts: Required<ClothOptions>
  private renderPrev: Float32Array
  private acc: Float32Array
  private cA: Uint32Array
  private cB: Uint32Array
  private cRest: Float32Array
  private cK: Float32Array
  private pmass: number
  private tri: ArrayLike<number>
  private tugs: { idx: number; target: Vector3; k: number }[] = []
  private windGrid = new Float32Array(27)

  constructor(origin: Vector3, right: Vector3, down: Vector3, o: ClothOptions) {
    this.opts = {
      mass: 0.5, iterations: 6, damping: 0.4, drag: 1.2, bend: 0.08, thickness: 0.025,
      groundY: 0, substeps: 1, ...o,
    }
    const { nx, ny, width, height } = this.opts
    this.nx = nx
    this.ny = ny
    this.n = nx * ny
    this.pos = new Float32Array(this.n * 3)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 3
        const u = (i / (nx - 1)) * width
        const v = (j / (ny - 1)) * height
        this.pos[k] = origin.x + right.x * u + down.x * v
        this.pos[k + 1] = origin.y + right.y * u + down.y * v
        this.pos[k + 2] = origin.z + right.z * u + down.z * v
      }
    this.prev = new Float32Array(this.pos)
    this.renderPrev = new Float32Array(this.pos)
    this.acc = new Float32Array(this.n * 3)
    this.pmass = this.opts.mass / this.n
    this.invMass = new Float32Array(this.n).fill(1 / this.pmass)

    // Constraints: structural, shear, bend.
    const A: number[] = [], B: number[] = [], K: number[] = []
    const add = (a: number, b: number, k: number) => { A.push(a); B.push(b); K.push(k) }
    const id = (i: number, j: number) => j * nx + i
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        if (i < nx - 1) add(id(i, j), id(i + 1, j), 1)
        if (j < ny - 1) add(id(i, j), id(i, j + 1), 1)
        if (i < nx - 1 && j < ny - 1) {
          add(id(i, j), id(i + 1, j + 1), 0.6)
          add(id(i + 1, j), id(i, j + 1), 0.6)
        }
        if (this.opts.bend > 0) {
          if (i < nx - 2) add(id(i, j), id(i + 2, j), this.opts.bend)
          if (j < ny - 2) add(id(i, j), id(i, j + 2), this.opts.bend)
        }
      }
    this.cA = new Uint32Array(A)
    this.cB = new Uint32Array(B)
    this.cK = new Float32Array(K)
    this.cRest = new Float32Array(A.length)
    const p = this.pos
    for (let c = 0; c < A.length; c++) {
      const a = A[c] * 3, b = B[c] * 3
      this.cRest[c] = Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2])
    }
    this.geometry = buildGrid(nx, ny, this.pos)
    this.tri = (this.geometry.getIndex() as BufferAttribute).array
    gridNormals(this.tri, this.pos, (this.geometry.getAttribute('normal') as BufferAttribute).array as Float32Array)
  }

  index(i: number, j: number): number {
    return j * this.nx + i
  }

  pin(idx: number, p?: Vector3): void {
    this.invMass[idx] = 0
    if (p) this.setPin(idx, p)
  }

  unpin(idx: number): void {
    this.invMass[idx] = 1 / this.pmass
  }

  setPin(idx: number, p: Vector3): void {
    const k = idx * 3
    this.pos[k] = p.x; this.pos[k + 1] = p.y; this.pos[k + 2] = p.z
    this.prev[k] = p.x; this.prev[k + 1] = p.y; this.prev[k + 2] = p.z
  }

  particle(idx: number, out: Vector3): Vector3 {
    const k = idx * 3
    return out.set(this.pos[k], this.pos[k + 1], this.pos[k + 2])
  }

  tug(idx: number, target: Vector3, strength: number): void {
    this.tugs.push({ idx, target: target.clone(), k: strength })
  }

  step(dt: number, wind: WindField | null, spheres: readonly ClothSphere[] = []): void {
    this.renderPrev.set(this.pos)
    const sub = Math.max(1, this.opts.substeps | 0)
    const h = dt / sub
    for (let s = 0; s < sub; s++) this.substep(h, wind, spheres)
    this.tugs.length = 0
  }

  private substep(dt: number, wind: WindField | null, spheres: readonly ClothSphere[]): void {
    const { pos, prev, acc, invMass, n } = this
    const o = this.opts
    acc.fill(0)
    // --- aerodynamic force per triangle: F = 0.5 rho Cd A (n.v)|n.v| n
    if (wind) {
      const idx = this.tri
      const rhoCd = 0.5 * 1.2 * o.drag
      const inv3dt = 1 / (3 * dt)
      // Wind varies over ~9 m; a cloth is ~2 m. Sample a 3x3 grid once per substep and
      // interpolate (sampling per triangle cost 4 ms/step for 600 particles).
      const GX = this.nx, GY = this.ny
      const W = this.windGrid
      for (let gj = 0; gj < 3; gj++)
        for (let gi = 0; gi < 3; gi++) {
          const k = ((gj * (GY - 1)) >> 1) * GX + ((gi * (GX - 1)) >> 1)
          wind.sample(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], _w)
          const g = (gj * 3 + gi) * 3
          W[g] = _w.x; W[g + 1] = _w.y; W[g + 2] = _w.z
        }
      const flutterT = wind.time * 7.3
      const flutterA = wind.speed * wind.turbulence * 0.6
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
        const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2]
        const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2]
        let nx = e1y * e2z - e1z * e2y
        let ny = e1z * e2x - e1x * e2z
        let nz = e1x * e2y - e1y * e2x
        const len2 = Math.hypot(nx, ny, nz)
        if (len2 < 1e-9) continue
        const area = len2 * 0.5
        nx /= len2; ny /= len2; nz /= len2
        // Grid coordinates of the triangle's first vertex -> bilinear wind.
        const vi = idx[t]
        const u = ((vi % GX) / (GX - 1)) * 2
        const v = (((vi / GX) | 0) / (GY - 1)) * 2
        const i0 = Math.min(1, u | 0), j0 = Math.min(1, v | 0)
        const fu = u - i0, fv = v - j0
        const g00 = (j0 * 3 + i0) * 3, g10 = g00 + 3, g01 = g00 + 9, g11 = g00 + 12
        const flutter = Math.sin(flutterT + u * 4.1 + v * 2.9) * flutterA
        for (let q = 0; q < 3; q++) {
          const top = W[g00 + q] + (W[g10 + q] - W[g00 + q]) * fu
          const bot = W[g01 + q] + (W[g11 + q] - W[g01 + q]) * fu
          _wv[q] = top + (bot - top) * fv
        }
        _w.set(_wv[0] - wind.dir.z * flutter, _wv[1] + flutter * 0.3, _wv[2] + wind.dir.x * flutter)
        // Triangle velocity from Verlet history.
        const vx = (pos[a] - prev[a] + pos[b] - prev[b] + pos[c] - prev[c]) * inv3dt
        const vy = (pos[a + 1] - prev[a + 1] + pos[b + 1] - prev[b + 1] + pos[c + 1] - prev[c + 1]) * inv3dt
        const vz = (pos[a + 2] - prev[a + 2] + pos[b + 2] - prev[b + 2] + pos[c + 2] - prev[c + 2]) * inv3dt
        const rx = _w.x - vx, ry = _w.y - vy, rz = _w.z - vz
        const vn = rx * nx + ry * ny + rz * nz
        const f = (rhoCd * area * vn * Math.abs(vn)) / 3
        acc[a] += f * nx; acc[a + 1] += f * ny; acc[a + 2] += f * nz
        acc[b] += f * nx; acc[b + 1] += f * ny; acc[b + 2] += f * nz
        acc[c] += f * nx; acc[c + 1] += f * ny; acc[c + 2] += f * nz
      }
    }
    // --- integrate (Verlet)
    const keep = Math.max(0, 1 - o.damping * dt)
    const dt2 = dt * dt
    for (let i = 0; i < n; i++) {
      const w = invMass[i]
      if (w === 0) continue
      const k = i * 3
      const x = pos[k], y = pos[k + 1], z = pos[k + 2]
      pos[k] += (x - prev[k]) * keep + acc[k] * w * dt2
      pos[k + 1] += (y - prev[k + 1]) * keep + (acc[k + 1] * w - 9.81) * dt2
      pos[k + 2] += (z - prev[k + 2]) * keep + acc[k + 2] * w * dt2
      prev[k] = x; prev[k + 1] = y; prev[k + 2] = z
    }
    for (const t of this.tugs) {
      const k = t.idx * 3
      if (invMass[t.idx] === 0) continue
      pos[k] += (t.target.x - pos[k]) * t.k
      pos[k + 1] += (t.target.y - pos[k + 1]) * t.k
      pos[k + 2] += (t.target.z - pos[k + 2]) * t.k
    }
    // --- constraints
    const { cA, cB, cRest, cK } = this
    for (let it = 0; it < o.iterations; it++) {
      for (let c = 0; c < cA.length; c++) {
        const ia = cA[c], ib = cB[c]
        const wa = invMass[ia], wb = invMass[ib]
        const ws = wa + wb
        if (ws === 0) continue
        const a = ia * 3, b = ib * 3
        const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2]
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d < 1e-9) continue
        let diff = (d - cRest[c]) / (d * ws)
        // Structural edges are stiff (k = 1); shear (0.6) and skip-one bend (o.bend) are soft,
        // so the sheet folds and buckles freely but hardly stretches.
        diff *= cK[c]
        pos[a] += dx * diff * wa; pos[a + 1] += dy * diff * wa; pos[a + 2] += dz * diff * wa
        pos[b] -= dx * diff * wb; pos[b + 1] -= dy * diff * wb; pos[b + 2] -= dz * diff * wb
      }
    }
    // --- collisions: spheres (two-way) and ground
    const th = o.thickness
    for (const s of spheres) {
      const r = s.radius + th
      const r2 = r * r
      let jx = 0, jy = 0, jz = 0
      const cx = s.center.x, cy = s.center.y, cz = s.center.z
      for (let i = 0; i < n; i++) {
        if (invMass[i] === 0) continue
        const k = i * 3
        const dx = pos[k] - cx, dy = pos[k + 1] - cy, dz = pos[k + 2] - cz
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 >= r2 || d2 < 1e-12) continue
        const d = Math.sqrt(d2)
        const push = (r - d) / d
        const px = dx * push, py = dy * push, pz = dz * push
        pos[k] += px; pos[k + 1] += py; pos[k + 2] += pz
        // Momentum given to the particle comes out of the body.
        jx -= (px * this.pmass) / dt
        jy -= (py * this.pmass) / dt
        jz -= (pz * this.pmass) / dt
      }
      if (s.body && (jx !== 0 || jy !== 0 || jz !== 0)) {
        s.body.applyImpulse({ x: jx, y: jy, z: jz }, true)
      }
    }
    if (o.groundY !== null) {
      const gy = o.groundY + th
      for (let i = 0; i < n; i++) {
        const k = i * 3
        if (pos[k + 1] < gy) {
          pos[k + 1] = gy
          // Friction: kill most tangential motion on the lawn.
          prev[k] += (pos[k] - prev[k]) * 0.8
          prev[k + 2] += (pos[k + 2] - prev[k + 2]) * 0.8
        }
      }
    }
  }

  saveState(): unknown {
    return { pos: this.pos.slice(), prev: this.prev.slice(), inv: this.invMass.slice() }
  }

  loadState(s: unknown): void {
    const st = s as { pos: Float32Array; prev: Float32Array; inv: Float32Array }
    this.pos.set(st.pos)
    this.prev.set(st.prev)
    this.invMass.set(st.inv)
    this.renderPrev.set(st.pos)
  }

  updateGeometry(alpha: number): void {
    const attr = this.geometry.getAttribute('position') as BufferAttribute
    const out = attr.array as Float32Array
    const a = Math.min(1, Math.max(0, alpha))
    const p = this.pos, q = this.renderPrev
    for (let i = 0; i < out.length; i++) out[i] = q[i] + (p[i] - q[i]) * a
    attr.needsUpdate = true
    const nrm = this.geometry.getAttribute('normal') as BufferAttribute
    gridNormals(this.tri, out, nrm.array as Float32Array)
    nrm.needsUpdate = true
    this.geometry.computeBoundingSphere()
  }

  dispose(): void {
    this.geometry.dispose()
  }
}

// =========================================================================== RapierSoftCloth

/**
 * The same cloth on Rapier's soft-body solver (rapier3d-compat >= 0.21). Two-way contacts with
 * every collider come for free; wind is applied as per-particle impulses before each step.
 *
 * Gotcha: Rapier's `SoftBodyDesc.cloth` numbers particles COLUMN-major (i * nv + j), and its
 * rest positions are centred. This class keeps the ClothSim contract (row-major handles from
 * `index(i, j)`) and permutes internally.
 */
export class RapierSoftCloth implements ClothSim {
  readonly geometry: BufferGeometry
  readonly nx: number
  readonly ny: number
  soft: SoftBody
  private handle: number
  private pw: PhysicsWorld
  /** Row-major positions (geometry order). */
  private rm: Float32Array
  private renderPrev: Float32Array
  /** perm[rowMajor] = rapier particle index. */
  private perm: Uint32Array
  private tri: ArrayLike<number>
  private opts: Required<ClothOptions>
  private pmass: number
  private imp: Float32Array

  /** `pinned` are row-major handles (j * nx + i), as returned by index(). */
  constructor(pw: PhysicsWorld, origin: Vector3, right: Vector3, down: Vector3, o: ClothOptions, pinned: number[]) {
    this.opts = {
      mass: 0.5, iterations: 6, damping: 0.4, drag: 1.2, bend: 0.08, thickness: 0.025,
      groundY: 0, substeps: 1, ...o,
    }
    this.pw = pw
    this.nx = o.nx
    this.ny = o.ny
    const n = o.nx * o.ny
    this.perm = new Uint32Array(n)
    for (let j = 0; j < o.ny; j++) for (let i = 0; i < o.nx; i++) this.perm[j * o.nx + i] = i * o.ny + j
    const R = pw.R
    const du = right.clone().multiplyScalar(o.width / (o.nx - 1))
    const dv = down.clone().multiplyScalar(o.height / (o.ny - 1))
    const desc = R.SoftBodyDesc.cloth(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: du.x, y: du.y, z: du.z },
      { x: dv.x, y: dv.y, z: dv.z },
      o.nx,
      o.ny,
    )
      .setMass(this.opts.mass)
      .setPinnedParticles(pinned.map((h) => this.perm[h]))
    desc.linearDamping = this.opts.damping
    desc.particleRadius = this.opts.thickness
    desc.surfaceCollider = R.ColliderDesc.ball(0.01).setFriction(0.6)
    this.soft = pw.world.createSoftBody(desc)
    this.handle = this.soft.handle
    this.pmass = this.opts.mass / n
    this.rm = new Float32Array(n * 3)
    this.imp = new Float32Array(n * 3)
    this.readBack()
    this.renderPrev = new Float32Array(this.rm)
    this.geometry = buildGrid(o.nx, o.ny, this.rm)
    this.tri = (this.geometry.getIndex() as BufferAttribute).array
  }

  index(i: number, j: number): number {
    return j * this.nx + i
  }

  pin(idx: number, p?: Vector3): void {
    this.soft.setParticlePinned(this.perm[idx], true)
    if (p) this.setPin(idx, p)
  }

  unpin(idx: number): void {
    this.soft.setParticlePinned(this.perm[idx], false)
  }

  setPin(idx: number, p: Vector3): void {
    this.soft.setParticleKinematicTarget(this.perm[idx], { x: p.x, y: p.y, z: p.z })
  }

  particle(idx: number, out: Vector3): Vector3 {
    const k = idx * 3
    return out.set(this.rm[k], this.rm[k + 1], this.rm[k + 2])
  }

  tug(idx: number, target: Vector3, strength: number): void {
    const k = idx * 3
    const s = (strength * this.pmass) / this.pw.dt
    this.soft.applyParticleImpulse(
      this.perm[idx],
      { x: (target.x - this.rm[k]) * s, y: (target.y - this.rm[k + 1]) * s, z: (target.z - this.rm[k + 2]) * s },
      true,
    )
  }

  /** Call BEFORE world.step (it only applies wind); the world integrates the cloth. */
  step(dt: number, wind: WindField | null): void {
    this.renderPrev.set(this.rm)
    if (!wind) return
    const pos = this.rm
    const idx = this.tri
    const perm = this.perm
    const n = this.nx * this.ny
    const imp = this.imp
    imp.fill(0)
    const vel = this.soft.particleVelocities() // rapier order
    const rhoCd = 0.5 * 1.2 * this.opts.drag
    // One wind sample at the cloth centre is plenty (gusts are ~9 m long).
    const c = perm[(this.ny >> 1) * this.nx + (this.nx >> 1)] * 3
    const cur = this.soft.particlePositions()
    wind.sample(cur[c], cur[c + 1], cur[c + 2], _w)
    for (let t = 0; t < idx.length; t += 3) {
      const ia = idx[t], ib = idx[t + 1], ic = idx[t + 2]
      const a = ia * 3, b = ib * 3, cc = ic * 3
      const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2]
      const e2x = pos[cc] - pos[a], e2y = pos[cc + 1] - pos[a + 1], e2z = pos[cc + 2] - pos[a + 2]
      let nx = e1y * e2z - e1z * e2y
      let ny = e1z * e2x - e1x * e2z
      let nz = e1x * e2y - e1y * e2x
      const len2 = Math.hypot(nx, ny, nz)
      if (len2 < 1e-9) continue
      const area = len2 * 0.5
      nx /= len2; ny /= len2; nz /= len2
      const va = perm[ia] * 3, vb = perm[ib] * 3, vc = perm[ic] * 3
      const vx = (vel[va] + vel[vb] + vel[vc]) / 3
      const vy = (vel[va + 1] + vel[vb + 1] + vel[vc + 1]) / 3
      const vz = (vel[va + 2] + vel[vb + 2] + vel[vc + 2]) / 3
      const vn = (_w.x - vx) * nx + (_w.y - vy) * ny + (_w.z - vz) * nz
      const f = ((rhoCd * area * vn * Math.abs(vn)) / 3) * dt
      imp[a] += f * nx; imp[a + 1] += f * ny; imp[a + 2] += f * nz
      imp[b] += f * nx; imp[b + 1] += f * ny; imp[b + 2] += f * nz
      imp[cc] += f * nx; imp[cc + 1] += f * ny; imp[cc + 2] += f * nz
    }
    for (let i = 0; i < n; i++) {
      const k = i * 3
      if (imp[k] === 0 && imp[k + 1] === 0 && imp[k + 2] === 0) continue
      this.soft.applyParticleImpulse(perm[i], { x: imp[k], y: imp[k + 1], z: imp[k + 2] }, false)
    }
    this.soft.wakeUp()
  }

  saveState(): unknown {
    return null // the soft body lives inside the Rapier snapshot
  }

  loadState(): void {
    this.soft = this.pw.world.getSoftBody(this.handle)
    this.readBack()
    this.renderPrev.set(this.rm)
  }

  /** Call AFTER world.step to pull the new particle positions (permuted to row-major). */
  readBack(): void {
    const p = this.soft.particlePositions()
    const perm = this.perm
    const rm = this.rm
    for (let i = 0; i < perm.length; i++) {
      const s = perm[i] * 3
      rm[i * 3] = p[s]
      rm[i * 3 + 1] = p[s + 1]
      rm[i * 3 + 2] = p[s + 2]
    }
  }

  updateGeometry(alpha: number): void {
    const attr = this.geometry.getAttribute('position') as BufferAttribute
    const out = attr.array as Float32Array
    const a = Math.min(1, Math.max(0, alpha))
    const p = this.rm, q = this.renderPrev
    for (let i = 0; i < out.length; i++) out[i] = q[i] + (p[i] - q[i]) * a
    attr.needsUpdate = true
    const nrm = this.geometry.getAttribute('normal') as BufferAttribute
    gridNormals(this.tri, out, nrm.array as Float32Array)
    nrm.needsUpdate = true
    this.geometry.computeBoundingSphere()
  }

  dispose(): void {
    if (this.soft.isValid()) this.pw.world.removeSoftBody(this.soft)
    this.geometry.dispose()
  }
}
