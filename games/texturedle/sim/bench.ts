// The specimen bench (texturedle.md §5): stage tilt, the 3 mm glass marble,
// two XPBD cloths, the loose layer and visible grains. Deterministic,
// fixed-step, renderer-independent. Units: mm, s, mg. The marble runs in real
// units on a slowed clock (sim dt = s · wall dt, §5.1); cloths and tilt run in
// wall time. Coordinates are frame mm (origin at the frame centre, +y up).

import type {
  Bench, BenchEvent, BenchState, ProbeStats, AudioContacts, RatioSpec, ClothKind, ClothState, MarbleState, Vec2, RGB,
} from '../contracts'
import type { SurfaceRuntime, MaterialPhys } from '../glue/surface'
import { HeightField } from './heightfield'
import { Cloth, LENS, BURLAP, type ClothEnv, type ClothFrameOut } from './cloth'
import { mulberry32, type Rng } from './rng'

const G = 9810 // mm/s²
const R = 1.5 // marble radius, mm
const MASS_KG = 35e-6
const H_SIM = 0.00025 // marble substep, sim seconds
const DT = 1 / 60

export interface BenchExtras {
  setPortrait(p: boolean): void
  setQuality(q: 'high' | 'low'): void
  setLampSwept(deg: number): void
  frame(): { w: number; h: number; swatchMm: number }
  /** Is (x, y) frame mm on a cloth lying on the plate? */
  clothAt(x: number, y: number): ClothKind | null
  marbleAt(x: number, y: number, slackMm: number): boolean
  clothObj(k: ClothKind): Cloth
  readonly heldCloth: ClothKind | null
  readonly marbleHeld: boolean
  readonly looseVersion: number
  readonly loose: Float32Array | null
  readonly physRes: number
  readonly ceiling: boolean
  popAt(x: number, y: number): void
  frameNo: number
}

interface Grain { x: number; y: number; z: number; vx: number; vy: number; vz: number; size: number; r: number; g: number; b: number; rot: number; rest: number; alive: boolean }

export function createBench(seed: number): Bench & BenchExtras {
  const rng: Rng = mulberry32((seed ^ 0x7e57) >>> 0)
  let rt: SurfaceRuntime | null = null
  let ratio: RatioSpec | null = null
  let portrait = false
  let quality: 'high' | 'low' = 'high'
  let fieldM: HeightField | null = null
  let fieldB: HeightField | null = null
  let fieldL: HeightField | null = null
  let unsubDirty: (() => void) | null = null
  let W = 7.2, Hh = 4.8, Ls = 2.16
  let acc = 0
  let simTime = 0
  let frameNo = 0
  let ceiling = false

  // ---- tilt (degrees, wall time) ----
  const tilt = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, ax: 0, ay: 0 }
  // ---- marble ----
  const m = {
    where: 'dish' as MarbleState['where'], x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    q: [0, 0, 0, 1] as [number, number, number, number], grounded: false, dirt: 0,
    hx: 0, hy: 0, timer: 0, stillT: 0, settledSent: false, nEma: [0, 0, 1], jitAcc: 0, jitT: 0, rollT: 0,
    levelT: 0, accEma: 0, chanT: 0, chanIn: 0, lastImpactFrame: -99,
  }
  // ---- cloths ----
  const cloths: Record<ClothKind, Cloth> = { lens: new Cloth(LENS, 20), burlap: new Cloth(BURLAP, 14) }
  let held: ClothKind | null = null
  const clothOut: Record<ClothKind, ClothFrameOut> = {
    lens: { slipCount: 0, slipPower: 0, snags: [], contacts: 0, muSum: 0, cx: 0, cy: 0, vx: 0, vy: 0, load: 0, travel: 0 },
    burlap: { slipCount: 0, slipPower: 0, snags: [], contacts: 0, muSum: 0, cx: 0, cy: 0, vx: 0, vy: 0, load: 0, travel: 0 },
  }
  const wearAcc: Record<ClothKind, Float32Array> = { lens: new Float32Array(cloths.lens.N), burlap: new Float32Array(cloths.burlap.N) }
  const polishAcc = new Float32Array(cloths.lens.N)
  // ---- grains ----
  let grainCap = 2000
  const grains: Grain[] = []
  const grainData = new Float32Array(2000 * 8)
  let grainCount = 0
  // ---- loose ----
  let looseVersion = 0
  let looseAcc = 0
  let reposeTan = Math.tan((38 * Math.PI) / 180)
  let looseRgb: RGB = [0.35, 0.12, 0.05]
  let looseH: Float32Array | null = null // H at physRes (mm)

  const events: BenchEvent[] = []
  const stats: ProbeStats = {
    tiltMax: 0, lampSwept: 0, bounces: 0, maxImpact: 0, rollJitterRms: 0, levelDrift: null, channelFrac: 0,
    wiped: { lens: 0, burlap: 0 }, slipMuK: { lens: 0, burlap: 0 }, snags: 0, layersRevealed: [],
    residue: { lens: { rgb: [0, 0, 0], alpha: 0, kind: '' }, burlap: { rgb: [0, 0, 0], alpha: 0, kind: '' } },
    pileTurned: 0, avalanche: 0, polishDrop: 0,
  }
  const residueKind: Record<ClothKind, string> = { lens: '', burlap: '' }

  const mkClothState = (k: ClothKind): ClothState => ({
    kind: k, where: 'tray', n: cloths[k].n, swatchMm: Ls, pos: new Float32Array(cloths[k].N * 3), flipped: false,
    residue: cloths[k].residue, rubbing: cloths[k].rubbing, fibres: cloths[k].fibres,
  })
  const state: BenchState = {
    tilt: { x: 0, y: 0 }, tiltVel: { x: 0, y: 0 },
    marble: { where: 'dish', pos: [0, 0, 0], vel: [0, 0, 0], quat: [0, 0, 0, 1], grounded: false, dirt: 0 },
    cloths: { lens: mkClothState('lens'), burlap: mkClothState('burlap') },
    grains: { count: 0, data: grainData }, simTime: 0,
  }

  const ts = () => (ratio ? ratio.timeScale : 0.0696)
  const phys = (x: number, y: number): MaterialPhys => rt!.materialAt(x, y)

  // gravity in plate space (mm/s², sim time)
  const g = [0, 0, -G]
  function updateGravity(): void {
    const ax = (tilt.x * Math.PI) / 180, ay = (tilt.y * Math.PI) / 180
    g[0] = G * Math.sin(ax)
    g[1] = G * Math.sin(ay)
    g[2] = (ceiling ? 1 : -1) * G * Math.cos(ax) * Math.cos(ay)
  }

  const hs = { h: 0, gx: 0, gy: 0 }
  // marble support: centre height and normal
  const sup = { h: 0, nx: 0, ny: 0, nz: 1 }
  function support(x: number, y: number): typeof sup {
    fieldM!.sampleCubic(x, y, hs)
    const l = 1 / Math.sqrt(hs.gx * hs.gx + hs.gy * hs.gy + 1)
    sup.h = hs.h + R
    sup.nx = -hs.gx * l
    sup.ny = -hs.gy * l
    sup.nz = l
    const ph = phys(x, y)
    if (ph.soft) sup.h -= ph.soft.sinkMm * Math.min(1, Math.abs(g[2]) / G)
    return sup
  }

  function geometry(): void {
    if (!ratio) return
    W = portrait ? ratio.fovMm[1] : ratio.fovMm[0]
    Hh = portrait ? ratio.fovMm[0] : ratio.fovMm[1]
    Ls = 0.45 * Math.min(W, Hh)
    state.cloths.lens.swatchMm = Ls
    state.cloths.burlap.swatchMm = Ls
  }

  function wrapField(p: 'marble' | 'burlap' | 'lens'): HeightField {
    const f = rt!.bake.contact[p]
    const size = f.res * f.cellMm
    return new HeightField(f.res, f.res, size, size, f.data)
  }

  function clothEnv(k: ClothKind): ClothEnv {
    const field = k === 'lens' ? fieldL! : fieldB!
    return {
      Ls, frameW: W, field,
      mu: (x, y) => phys(x, y).muK,
      hardness: (x, y) => phys(x, y).hardness,
      residue: (x, y) => rt!.residueAt(x, y),
      loose: (x, y) => looseAt(x, y),
      snag: (x, y) => rt!.snagAt(x, y),
      sphere: m.where === 'plate' || m.where === 'held' ? [m.x, m.y, m.z, R] : null,
      looseRgb,
      rng,
    }
  }

  function looseAt(x: number, y: number): number {
    const L = rt?.bake.loose
    if (!L) return 0
    const P = rt!.bake.physRes, size = rt!.bake.sizeMm
    const i = Math.floor(((x + size / 2) / size) * P), j = Math.floor(((y + size / 2) / size) * P)
    if (i < 0 || j < 0 || i >= P || j >= P) return 0
    return L[j * P + i]
  }

  function buildLooseH(): void {
    const b = rt!.bake
    if (!b.loose) { looseH = null; return }
    const P = b.physRes
    looseH = new Float32Array(P * P)
    const f = b.res / P
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) looseH[j * P + i] = b.height[Math.floor((j + 0.5) * f) * b.res + Math.floor((i + 0.5) * f)]
  }

  function emitImpact(x: number, y: number, speed: number, by: 'marble' | 'tap'): void {
    const energyUJ = 0.5 * MASS_KG * (speed / 1000) ** 2 * 1e6
    const layer = rt ? rt.bake.topLayer[texIndex(x, y)] ?? 0 : 0
    events.push({ t: 'impact', x, y, speed, energyUJ, layer, by })
    if (by === 'marble') {
      stats.bounces++
      if (speed > stats.maxImpact) stats.maxImpact = speed
    }
    // loose material jumps: spawn grains from the loose layer
    const n = Math.min(40, Math.floor(energyUJ * 25 + (by === 'tap' ? 6 : 2)))
    const took = rt ? rt.takeLoose(x, y, 0.8, 4) : 0
    if (took > 0.5) for (let i = 0; i < n; i++) spawnGrain(x + (rng() - 0.5) * 1.2, y + (rng() - 0.5) * 1.2, looseRgb, 0.02 + rng() * 0.05, 40 + rng() * 120)
    hopGrains(x, y, 2, 30 + speed * 0.3)
  }

  function texIndex(x: number, y: number): number {
    const b = rt!.bake
    const i = Math.min(b.res - 1, Math.max(0, Math.floor((x + b.sizeMm / 2) / b.mmPerTexel)))
    const j = Math.min(b.res - 1, Math.max(0, Math.floor((y + b.sizeMm / 2) / b.mmPerTexel)))
    return j * b.res + i
  }

  function spawnGrain(x: number, y: number, rgb: RGB, size: number, vz: number): void {
    let gr: Grain | undefined
    for (const q of grains) if (!q.alive) { gr = q; break }
    if (!gr) {
      if (grains.length >= grainCap) return
      gr = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, r: 0, g: 0, b: 0, rot: 0, rest: 0, alive: false }
      grains.push(gr)
    }
    fieldL!.sampleGrad(x, y, hs)
    gr.x = x; gr.y = y; gr.z = hs.h + size * 0.5
    gr.vx = (rng() - 0.5) * 60; gr.vy = (rng() - 0.5) * 60; gr.vz = vz
    gr.size = size; gr.r = rgb[0]; gr.g = rgb[1]; gr.b = rgb[2]; gr.rot = rng() * 6.28; gr.rest = 0; gr.alive = true
  }

  function hopGrains(x: number, y: number, rad: number, vz: number): void {
    for (const q of grains) {
      if (!q.alive) continue
      if (rad > 0 && Math.hypot(q.x - x, q.y - y) > rad) continue
      q.vz += vz * (0.6 + rng() * 0.6)
      q.vx += (rng() - 0.5) * vz * 0.4
      q.vy += (rng() - 0.5) * vz * 0.4
      q.rest = 0
    }
  }

  function stepGrains(hSim: number, dtWall: number): void {
    let n = 0
    for (const q of grains) {
      if (!q.alive) continue
      fieldL!.sampleGrad(q.x, q.y, hs)
      const floor = hs.h + q.size * 0.4
      if (q.z > floor + 1e-4 || q.vz > 0) {
        q.vx += g[0] * hSim; q.vy += g[1] * hSim; q.vz += g[2] * hSim
        q.x += q.vx * hSim; q.y += q.vy * hSim; q.z += q.vz * hSim
        if (q.z < floor) { q.z = floor; q.vz = -q.vz * 0.2; q.vx *= 0.5; q.vy *= 0.5; if (Math.abs(q.vz) < 5) q.vz = 0 }
        q.rot += 3 * dtWall
        q.rest = 0
      } else {
        // slide where the local slope beats the angle of repose
        const sx = hs.gx - Math.tan((tilt.x * Math.PI) / 180), sy = hs.gy - Math.tan((tilt.y * Math.PI) / 180)
        const slope = Math.hypot(sx, sy)
        if (slope > reposeTan) {
          const a = G * (slope / Math.sqrt(1 + slope * slope)) * 0.5
          q.vx -= (sx / slope) * a * hSim; q.vy -= (sy / slope) * a * hSim
          q.x += q.vx * hSim; q.y += q.vy * hSim
          q.vx *= 0.98; q.vy *= 0.98
          q.rest = 0
        } else {
          q.vx = q.vy = 0
          q.rest += dtWall
        }
        q.z = floor
      }
      if (q.rest > 3 || Math.abs(q.x) > W * 0.75 || Math.abs(q.y) > Hh * 0.75) { q.alive = false; continue }
      if (n < 2000) {
        const o = n * 8
        grainData[o] = q.x; grainData[o + 1] = q.y; grainData[o + 2] = q.z; grainData[o + 3] = q.size
        grainData[o + 4] = q.r; grainData[o + 5] = q.g; grainData[o + 6] = q.b; grainData[o + 7] = q.rot
        n++
      }
    }
    grainCount = n
    state.grains.count = n
  }

  function stepLoose(): number {
    const b = rt!.bake
    const L = b.loose
    if (!L || !looseH) return 0
    const P = b.physRes
    const dx = b.sizeMm / P
    const tx = Math.tan((tilt.x * Math.PI) / 180), ty = Math.tan((tilt.y * Math.PI) / 180)
    let moved = 0
    // fixed neighbour order; transfers applied in place (deterministic)
    for (let j = 1; j < P - 1; j++) {
      for (let i = 1; i < P - 1; i++) {
        const k = j * P + i
        const l0 = L[k]
        if (l0 <= 0.01) continue
        const h0 = looseH[k] + l0 / 1000
        const nb = [k + 1, k - 1, k + P, k - P]
        const tl = [tx, -tx, ty, -ty]
        for (let q = 0; q < 4; q++) {
          const kk = nb[q]
          const slope = (h0 - (looseH[kk] + L[kk] / 1000)) / dx + tl[q]
          if (slope > reposeTan) {
            const mv = Math.min(L[k], 0.25 * (slope - reposeTan) * dx * 1000)
            if (mv <= 0) continue
            L[k] -= mv
            L[kk] += mv
            moved += mv
          }
        }
      }
    }
    if (moved > 0) looseVersion++
    return moved * dx * dx * 1e-3 // mm³-ish volume
  }

  function marbleStep(dtWall: number): void {
    if (!rt) return
    const s = ts()
    if (m.where === 'falling' || m.where === 'returning') {
      m.timer -= dtWall
      if (m.where === 'falling') { m.vz += (ceiling ? 1 : -1) * G * s * dtWall * 0.02; m.z += m.vz * s * dtWall }
      if (m.timer <= 0) { m.where = 'dish'; m.vx = m.vy = m.vz = 0 }
      return
    }
    if (m.where === 'dish') return
    if (m.where === 'held') {
      const sp = support(m.hx, m.hy)
      const tz = sp.h + 2
      const a = 1 - Math.exp(-40 * dtWall)
      const nx = m.x + (m.hx - m.x) * a, ny = m.y + (m.hy - m.y) * a, nz = m.z + (tz - m.z) * a
      m.vx = (nx - m.x) / (s * dtWall); m.vy = (ny - m.y) / (s * dtWall); m.vz = (nz - m.z) / (s * dtWall)
      m.x = nx; m.y = ny; m.z = nz
      m.grounded = false
      return
    }
    // on the plate
    const total = s * dtWall
    const nsub = Math.min(32, Math.max(1, Math.ceil(total / H_SIM)))
    const h = total / nsub
    let jitSum = 0, jitN = 0
    let accX = 0, accY = 0
    for (let it = 0; it < nsub; it++) {
      const sp = support(m.x, m.y)
      const ph = phys(m.x, m.y)
      const gap = m.z - sp.h
      m.grounded = m.grounded ? gap < 0.01 : gap < 0.005
      let ax = g[0], ay = g[1], az = g[2]
      if (m.grounded && !ceiling) {
        const gn = g[0] * sp.nx + g[1] * sp.ny + g[2] * sp.nz
        const gtx = g[0] - gn * sp.nx, gty = g[1] - gn * sp.ny, gtz = g[2] - gn * sp.nz
        ax = gn * sp.nx + (5 / 7) * gtx; ay = gn * sp.ny + (5 / 7) * gty; az = gn * sp.nz + (5 / 7) * gtz
        let vtx = m.vx, vty = m.vy, vtz = m.vz
        const vn = vtx * sp.nx + vty * sp.ny + vtz * sp.nz
        vtx -= vn * sp.nx; vty -= vn * sp.ny; vtz -= vn * sp.nz
        const vt = Math.sqrt(vtx * vtx + vty * vty + vtz * vtz)
        if (vt > 1e-6) {
          let dec = ph.rollResist * Math.abs(gn) * (ph.soft ? 3 : 1)
          if (dec * h > vt) dec = vt / h
          ax -= (dec * vtx) / vt; ay -= (dec * vty) / vt; az -= (dec * vtz) / vt
        }
        accX += ax; accY += ay
        // normal jitter (rattle) while rolling
        if (vt > 5) {
          const e = m.nEma
          const k = Math.min(1, h / 0.01)
          e[0] += (sp.nx - e[0]) * k; e[1] += (sp.ny - e[1]) * k; e[2] += (sp.nz - e[2]) * k
          const d = Math.hypot(sp.nx - e[0], sp.ny - e[1], sp.nz - e[2])
          jitSum += d * d; jitN++
        }
      }
      m.vx += ax * h; m.vy += ay * h; m.vz += az * h
      const sp2 = Math.hypot(m.vx, m.vy, m.vz)
      if (sp2 > 400) { const k = 400 / sp2; m.vx *= k; m.vy *= k; m.vz *= k }
      m.x += m.vx * h; m.y += m.vy * h; m.z += m.vz * h
      // ceiling: the marble falls toward the lens and out of frame
      if (ceiling && m.z > sp.h + 6) {
        m.where = 'falling'; m.timer = 1.2
        events.push({ t: 'offEdge', side: 'b' })
        return
      }
      // off the visible frame
      if (Math.abs(m.x) > W / 2 + R || Math.abs(m.y) > Hh / 2 + R) {
        const side = Math.abs(m.x) / W > Math.abs(m.y) / Hh ? (m.x > 0 ? 'r' : 'l') : (m.y > 0 ? 't' : 'b')
        events.push({ t: 'offEdge', side })
        m.where = 'falling'; m.timer = 1.2; m.vz = 0
        return
      }
      const sp3 = support(m.x, m.y)
      if (m.z < sp3.h) {
        const vn = m.vx * sp3.nx + m.vy * sp3.ny + m.vz * sp3.nz
        if (vn < -15) {
          const ph = phys(m.x, m.y)
          const e = ph.restitution
          m.vx -= (1 + e) * vn * sp3.nx; m.vy -= (1 + e) * vn * sp3.ny; m.vz -= (1 + e) * vn * sp3.nz
          // Coulomb friction at the impact: the sliding bead picks up spin (→ 5/7 of the tangential speed)
          {
            const vn2 = m.vx * sp3.nx + m.vy * sp3.ny + m.vz * sp3.nz
            const tx = m.vx - vn2 * sp3.nx, ty = m.vy - vn2 * sp3.ny, tz = m.vz - vn2 * sp3.nz
            const vt = Math.hypot(tx, ty, tz)
            if (vt > 1e-6) {
              const dv = Math.min(vt * (2 / 7), ph.muK * (1 + e) * -vn)
              const k = dv / vt
              m.vx -= tx * k; m.vy -= ty * k; m.vz -= tz * k
            }
          }
          m.grounded = false
          if (frameNo - m.lastImpactFrame > 0 || -vn > 40) emitImpact(m.x, m.y, -vn, 'marble')
          m.lastImpactFrame = frameNo
        } else if (vn < 0) {
          m.vx -= vn * sp3.nx; m.vy -= vn * sp3.ny; m.vz -= vn * sp3.nz
          m.grounded = true
        } else m.grounded = true
        m.z = sp3.h
      }
      // visible spin (ω = n × v / r)
      if (m.grounded) {
        const wx = (sp3.ny * m.vz - sp3.nz * m.vy) / R, wy = (sp3.nz * m.vx - sp3.nx * m.vz) / R, wz = (sp3.nx * m.vy - sp3.ny * m.vx) / R
        spin(h, wx, wy, wz)
      }
      // dirt from loose material
      if (m.grounded) {
        const lu = looseAt(m.x, m.y)
        if (lu > 0) m.dirt = Math.min(0.6, m.dirt + 0.02 * lu * 1e-3 * Math.hypot(m.vx, m.vy) * h * 50)
      }
    }
    // stats: jitter, drift, channel, settle
    const speed = Math.hypot(m.vx, m.vy)
    if (jitN > 0) {
      m.jitAcc += jitSum / jitN * dtWall
      m.jitT += dtWall
      if (m.jitT > 0.6) stats.rollJitterRms = Math.sqrt(m.jitAcc / m.jitT)
    }
    if (m.grounded && speed > 3) {
      m.rollT += dtWall
      const ad = rt.recipe.aniso?.dirDeg
      if (ad !== undefined) {
        const a = Math.atan2(m.vy, m.vx), d = (ad * Math.PI) / 180
        const diff = Math.abs(Math.atan2(Math.sin(2 * (a - d)), Math.cos(2 * (a - d)))) / 2
        m.chanT += dtWall
        if (diff < (15 * Math.PI) / 180) m.chanIn += dtWall
        if (m.chanT >= 1) { stats.channelFrac = Math.max(stats.channelFrac, m.chanIn / m.chanT); m.chanT = 0; m.chanIn = 0 }
      }
    }
    const level = Math.hypot(tilt.x, tilt.y) < 0.5
    if (m.grounded && level) {
      m.levelT += dtWall
      const a = Math.hypot(accX, accY) / nsub
      m.accEma += (a - m.accEma) * Math.min(1, dtWall * 4)
      if (m.levelT > 1.5 && m.accEma > 0.3 * 611 && !stats.levelDrift) {
        stats.levelDrift = { x: accX, y: accY }
      }
    } else { m.levelT = 0 }
    if (m.grounded && speed < 1.5) {
      m.stillT += dtWall
      if (m.stillT > 0.4 && !m.settledSent) {
        m.settledSent = true
        // a pit: the contact field rises all round
        const d0 = fieldM!.sample(m.x, m.y)
        let ring = 0
        for (let a = 0; a < 8; a++) ring += fieldM!.sample(m.x + Math.cos(a * 0.785) * R, m.y + Math.sin(a * 0.785) * R)
        events.push({ t: 'settled', x: m.x, y: m.y, inPit: ring / 8 - d0 > 0.2 * R * 0.3 })
      }
    } else { m.stillT = 0; if (speed > 6) m.settledSent = false }
  }

  function spin(h: number, wx: number, wy: number, wz: number): void {
    const q = m.q
    const hx = 0.5 * h * wx, hy = 0.5 * h * wy, hz = 0.5 * h * wz
    const x = q[0] + (hx * q[3] + hy * q[2] - hz * q[1])
    const y = q[1] + (hy * q[3] + hz * q[0] - hx * q[2])
    const z = q[2] + (hz * q[3] + hx * q[1] - hy * q[0])
    const w = q[3] - (hx * q[0] + hy * q[1] + hz * q[2])
    const l = 1 / Math.sqrt(x * x + y * y + z * z + w * w)
    q[0] = x * l; q[1] = y * l; q[2] = z * l; q[3] = w * l
  }

  const splats = new Float32Array(400 * 4)
  function flushWear(k: ClothKind, force: boolean): void {
    if (!rt) return
    const c = cloths[k]
    const acc = wearAcc[k]
    let n = 0
    const rMm = 0.6 * c.a * Ls * 1.6
    let any = false
    for (let i = 0; i < c.N; i++) if (acc[i] > (force ? 0.05 : 1.5)) { any = true; break }
    if (!any) return
    for (let i = 0; i < c.N && n < 400; i++) {
      const d = acc[i]
      if (d <= 0.05) continue
      splats[n * 4] = c.x[i * 3] * Ls
      splats[n * 4 + 1] = c.x[i * 3 + 1] * Ls
      splats[n * 4 + 2] = rMm
      splats[n * 4 + 3] = d
      acc[i] = 0
      n++
    }
    const res = rt.abradeBatch(splats, n)
    if (res.revealed.length) {
      let cx = 0, cy = 0
      c.centroid([cx, cy] as [number, number])
      for (const l of res.revealed) {
        if (!stats.layersRevealed.includes(l)) stats.layersRevealed.push(l)
        events.push({ t: 'layerRevealed', layer: l, x: splats[0], y: splats[1], by: k })
      }
    }
    // flakes coloured by what came off
    if (k === 'burlap' && res.removed.length) {
      const nf = Math.min(3, res.removed.length * 2)
      for (let i = 0; i < nf; i++) {
        const j = Math.floor(rng() * n)
        spawnGrain(splats[j * 4], splats[j * 4 + 1], res.removed[i % res.removed.length], 0.015 + rng() * 0.035, 20 + rng() * 40)
      }
    }
  }

  function flushPolish(): void {
    if (!rt) return
    const c = cloths.lens
    let n = 0
    let total = 0
    for (let i = 0; i < c.N && n < 400; i++) {
      const p = polishAcc[i]
      if (p < 0.02) continue
      splats[n * 4] = c.x[i * 3] * Ls; splats[n * 4 + 1] = c.x[i * 3 + 1] * Ls; splats[n * 4 + 2] = 0.6 * c.a * Ls * 1.6; splats[n * 4 + 3] = p
      total += p
      polishAcc[i] = 0
      n++
    }
    if (n > 0) {
      rt.polishBatch(splats, n)
      const ph = rt.materialAt(splats[0], splats[1])
      if (ph.polish) stats.polishDrop += (ph.polish * total) / n
    }
  }

  function stepFrame(): void {
    if (!rt || !ratio) return
    frameNo++
    const dt = DT
    // ---- tilt spring (wall time) ----
    const ax = 120 * (tilt.tx - tilt.x) - 15.3 * tilt.vx
    const ay = 120 * (tilt.ty - tilt.y) - 15.3 * tilt.vy
    tilt.vx += ax * dt; tilt.vy += ay * dt
    tilt.x += tilt.vx * dt; tilt.y += tilt.vy * dt
    const tl = Math.hypot(tilt.x, tilt.y)
    if (tl > 5.6) { tilt.x *= 5.6 / tl; tilt.y *= 5.6 / tl }
    tilt.ax = ax; tilt.ay = ay
    stats.tiltMax = Math.max(stats.tiltMax, Math.min(5, tl))
    updateGravity()
    // nudge
    const aMag = Math.hypot(ax, ay)
    if (aMag > 400) {
      hopGrains(0, 0, 0, 0.002 * aMag * 10)
      if (m.where === 'plate' && m.grounded) {
        m.vx += -0.02 * ((ax * Math.PI) / 180) * 30 * dt * 60 * 0.05
        m.vy += -0.02 * ((ay * Math.PI) / 180) * 30 * dt * 60 * 0.05
      }
    }
    // ---- marble ----
    marbleStep(dt)
    // ---- cloths ----
    const sub = 8
    for (const k of ['lens', 'burlap'] as ClothKind[]) {
      const c = cloths[k]
      if (c.where === 'tray') continue
      const out = clothOut[k]
      c.step(dt, sub, clothEnv(k), out)
      if (c.wearAny) {
        const acc2 = wearAcc[k]
        for (let i = 0; i < c.N; i++) acc2[i] += c.wear[i]
        if (k === 'lens') for (let i = 0; i < c.N; i++) polishAcc[i] += c.polish[i]
      }
      if (out.slipCount > 0) events.push({ t: 'slip', cloth: k, count: out.slipCount, power: out.slipPower })
      for (const sn of out.snags) {
        if (sn.t === 'snag') { stats.snags++; events.push({ t: 'snag', x: sn.x, y: sn.y }) }
        else events.push({ t: 'snagRelease', x: sn.x, y: sn.y, s: sn.s })
      }
      stats.wiped[k] = c.wipedMm / W
      stats.slipMuK[k] = c.muN > 0 ? c.muEff / c.muN : 0
      // residue
      const rs = stats.residue[k]
      const prev = rs.alpha
      c.residueSummary(rs)
      if (rs.alpha > 0.02) {
        const rr = rt.residueAt(out.cx, out.cy)
        if (rr && out.contacts > 0) residueKind[k] = rr.kind
        rs.kind = residueKind[k] || (rt.recipe.loose ? 'powder' : '')
      }
      if (Math.floor(rs.alpha * 20) !== Math.floor(prev * 20)) events.push({ t: 'residue', cloth: k, rgb: [rs.rgb[0], rs.rgb[1], rs.rgb[2]], alpha: rs.alpha, kind: rs.kind })
      // pick up loose material
      if (out.contacts > 0 && out.travel > 0) rt.takeLoose(out.cx, out.cy, Ls * 0.3, 2 * out.travel)
    }
    if (frameNo % 3 === 0) { flushWear('lens', false); flushWear('burlap', false); flushPolish() }
    // ---- loose automaton (30 Hz) + grains ----
    looseAcc += dt
    if (looseAcc >= 1 / 30) {
      looseAcc -= 1 / 30
      const v = stepLoose()
      if (v > 0) {
        stats.avalanche += v
        if (v > 1e-4) events.push({ t: 'avalanche', volume: v })
        rt.markLooseDirty({ x0: 0, y0: 0, x1: rt.bake.physRes - 1, y1: rt.bake.physRes - 1 })
        if (v > 5e-4) for (let i = 0; i < 3; i++) spawnGrain((rng() - 0.5) * W, (rng() - 0.5) * Hh, looseRgb, 0.02 + rng() * 0.03, 5)
      }
    }
    stepGrains(ts() * dt, dt)
    simTime += ts() * dt
    publish()
  }

  function publish(): void {
    state.tilt.x = tilt.x; state.tilt.y = tilt.y
    state.tiltVel.x = tilt.vx; state.tiltVel.y = tilt.vy
    const ms = state.marble
    ms.where = m.where
    ms.pos[0] = m.x; ms.pos[1] = m.y; ms.pos[2] = m.z
    ms.vel[0] = m.vx; ms.vel[1] = m.vy; ms.vel[2] = m.vz
    ms.quat[0] = m.q[0]; ms.quat[1] = m.q[1]; ms.quat[2] = m.q[2]; ms.quat[3] = m.q[3]
    ms.grounded = m.grounded; ms.dirt = m.dirt
    for (const k of ['lens', 'burlap'] as ClothKind[]) {
      const c = cloths[k], cs = state.cloths[k]
      cs.where = c.where
      cs.flipped = c.flipped
      for (let i = 0; i < c.N * 3; i++) cs.pos[i] = c.x[i] * Ls
    }
    state.simTime = simTime
  }

  function toSwatch(v: number): number { return v / Ls }

  const bench: Bench & BenchExtras = {
    frameNo: 0,
    setSurface(next, r, keepMarble) {
      if (unsubDirty) unsubDirty()
      rt = next
      ratio = r
      ceiling = next.recipe.orientation === 'ceiling'
      geometry()
      fieldM = wrapField('marble'); fieldB = wrapField('burlap'); fieldL = wrapField('lens')
      unsubDirty = next.onDirty((_r, what) => {
        if (what === 'height') { fieldM!.invalidate(); fieldB!.invalidate(); fieldL!.invalidate() }
      })
      reposeTan = Math.tan(((next.recipe.loose?.reposeDeg ?? 38) * Math.PI) / 180)
      looseRgb = next.recipe.loose ? next.recipe.loose.rgb : [0.3, 0.3, 0.3]
      buildLooseH()
      // let the loose layer come to rest before anyone touches it
      { const tx0 = tilt.x, ty0 = tilt.y; tilt.x = 0; tilt.y = 0; for (let i = 0; i < 24; i++) if (stepLoose() <= 0) break; tilt.x = tx0; tilt.y = ty0 }
      looseVersion++
      for (const q of grains) q.alive = false
      grainCount = 0
      // cloths go back to the tray at a new ratio (the swatch is re-cut to the stage)
      for (const k of ['lens', 'burlap'] as ClothKind[]) { cloths[k].stow(); wearAcc[k].fill(0) }
      held = null
      if (keepMarble && (m.where === 'plate')) {
        const sp = support(Math.max(-W / 2, Math.min(W / 2, m.x)), Math.max(-Hh / 2, Math.min(Hh / 2, m.y)))
        m.z = sp.h
      } else if (m.where !== 'dish') { m.where = 'dish' }
      publish()
    },
    setTiltTarget(d: Vec2) {
      let x = d.x, y = d.y
      const l = Math.hypot(x, y)
      if (l > 5) { x *= 5 / l; y *= 5 / l }
      tilt.tx = x; tilt.ty = y
    },
    tap(x, y) {
      if (!rt) return
      emitImpact(x, y, 60, 'tap')
      hopGrains(x, y, 3, 60)
    },
    shake() {
      events.push({ t: 'shake' })
      hopGrains(0, 0, 0, 120)
      if (m.where === 'plate') { m.vx += (rng() - 0.5) * 80; m.vy += (rng() - 0.5) * 80; m.vz += 60; m.grounded = false }
      if (rt) emitImpact(0, 0, 70, 'tap')
    },
    marbleGrab(x, y) {
      if (!rt) return false
      m.where = 'held'
      m.hx = x; m.hy = y
      if (m.where === 'held' && (m.z === 0 || !isFinite(m.z))) m.z = support(x, y).h + 2
      const sp = support(x, y)
      if (Math.hypot(m.x - x, m.y - y) > 4 || m.z < sp.h) { m.x = x; m.y = y; m.z = sp.h + 2 }
      m.settledSent = false
      return true
    },
    marbleMove(x, y) {
      m.hx = Math.max(-W / 2 - 1, Math.min(W / 2 + 1, x))
      m.hy = Math.max(-Hh / 2 - 1, Math.min(Hh / 2 + 1, y))
    },
    marbleRelease(vxWall, vyWall) {
      if (m.where !== 'held') return
      const s = ts()
      let vx = vxWall / s, vy = vyWall / s
      const sp = Math.hypot(vx, vy)
      if (sp > 400) { vx *= 400 / sp; vy *= 400 / sp }
      m.vx = vx; m.vy = vy; m.vz = 0
      m.where = 'plate'
      m.grounded = false
      m.settledSent = false
    },
    marbleDrop(x, y, hMm) {
      if (!rt) return
      const sp = support(x, y)
      m.x = x; m.y = y; m.z = sp.h + hMm
      m.vx = m.vy = m.vz = 0
      m.where = 'plate'
      m.grounded = false
      m.settledSent = false
    },
    clothGrab(k, x, y, press = 1) {
      if (!rt) return false
      const c = cloths[k]
      if (c.where === 'tray') c.place(x, y, clothEnv(k))
      const kk = c.pick(toSwatch(x), toSwatch(y), 0.25)
      const pk = kk >= 0 ? kk : c.pick(toSwatch(x), toSwatch(y), 10)
      c.pressScale = Math.max(0.3, Math.min(2, press))
      c.grab(pk)
      // the grab point follows the pointer from where it was picked
      c.moveGrab(c.x[pk * 3], c.x[pk * 3 + 1])
      held = k
      return true
    },
    clothMove(x, y, press) {
      if (!held) return
      const c = cloths[held]
      if (press !== undefined) c.pressScale = Math.max(0.3, Math.min(2, press))
      const cx = Math.max(-W / 2 - Ls * 0.3, Math.min(W / 2 + Ls * 0.3, x))
      const cy = Math.max(-Hh / 2 - Ls * 0.3, Math.min(Hh / 2 + Ls * 0.3, y))
      c.moveGrab(toSwatch(cx), toSwatch(cy))
    },
    clothPin(_x, _y) { /* SHOULD: second-finger pins */ },
    clothRelease() {
      if (!held) return
      cloths[held].release()
      flushWear(held, true)
      if (held === 'lens') flushPolish()
      held = null
    },
    clothFlip(k) { cloths[k].flipped = !cloths[k].flipped },
    resetProbes() {
      for (const k of ['lens', 'burlap'] as ClothKind[]) cloths[k].stow()
      held = null
      if (m.where !== 'dish') { m.where = 'returning'; m.timer = 0.4 }
      publish()
    },
    step(dtWall) {
      acc += Math.min(dtWall, 0.1)
      let n = 0
      while (acc >= DT - 1e-9 && n < 4) { stepFrame(); acc -= DT; n++ }
      if (n === 4) acc = 0
      bench.frameNo = frameNo
    },
    get state() { return state },
    get stats() { return stats },
    drainEvents(out) {
      for (const e of events) out.push(e)
      events.length = 0
      return out
    },
    contacts(): AudioContacts {
      const c: AudioContacts = { marble: null, cloths: [] }
      if (m.where === 'plate' && m.grounded) c.marble = { x: m.x, y: m.y, vx: m.vx, vy: m.vy, load: Math.abs(g[2]) / G }
      for (const k of ['lens', 'burlap'] as ClothKind[]) {
        const o = clothOut[k]
        if (cloths[k].where === 'tray' || o.contacts === 0) continue
        const s = ts()
        c.cloths.push({ kind: k, x: o.cx, y: o.cy, vx: o.vx / s, vy: o.vy / s, load: o.load, slipPower: o.slipPower })
      }
      return c
    },
    setPortrait(p) { portrait = p; geometry() },
    setQuality(q) {
      if (q === quality) return
      quality = q
      grainCap = q === 'high' ? 2000 : 600
      cloths.lens = new Cloth(LENS, q === 'high' ? 20 : 14)
      cloths.burlap = new Cloth(BURLAP, q === 'high' ? 14 : 10)
      wearAcc.lens = new Float32Array(cloths.lens.N)
      wearAcc.burlap = new Float32Array(cloths.burlap.N)
      state.cloths.lens = mkClothState('lens')
      state.cloths.burlap = mkClothState('burlap')
      held = null
    },
    setLampSwept(d) { stats.lampSwept = Math.max(stats.lampSwept, d) },
    frame: () => ({ w: W, h: Hh, swatchMm: Ls }),
    clothAt(x, y) {
      // the top-most first: burlap is drawn over the lens cloth
      for (const k of ['burlap', 'lens'] as ClothKind[]) {
        const c = cloths[k]
        if (c.where === 'tray') continue
        if (c.pick(toSwatch(x), toSwatch(y), c.a * 1.2) >= 0) return k
      }
      return null
    },
    marbleAt(x, y, slack) {
      if (m.where !== 'plate' && m.where !== 'held') return false
      return Math.hypot(m.x - x, m.y - y) <= Math.max(1.3 * R, slack)
    },
    clothObj: (k) => cloths[k],
    get heldCloth() { return held },
    get marbleHeld() { return m.where === 'held' },
    get looseVersion() { return looseVersion },
    get loose() { return rt?.bake.loose ?? null },
    get physRes() { return rt?.bake.physRes ?? 0 },
    get ceiling() { return ceiling },
    popAt(x, y) {
      if (!rt) return
      // crack the enamel shell over the blister: knock the dome down and puff rust dust
      rt.editHeight(x, y, 0.7, (h, d) => h - 0.06 * Math.max(0, 1 - d / 0.7))
      const sp = new Float32Array([x, y, 0.6, 120])
      const res = rt.abradeBatch(sp, 1)
      for (const l of res.revealed) if (!stats.layersRevealed.includes(l)) stats.layersRevealed.push(l)
      for (let i = 0; i < 40; i++) spawnGrain(x + (rng() - 0.5) * 0.8, y + (rng() - 0.5) * 0.8, looseRgb, 0.015 + rng() * 0.03, 80 + rng() * 160)
      const green: RGB = [0.07, 0.13, 0.08]
      spawnGrain(x, y, green, 0.35, 120)
      events.push({ t: 'pop', x, y })
    },
  }
  return bench
}
