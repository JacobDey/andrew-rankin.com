/**
 * Oscillating lawn sprinkler: a rocking tube of jets, ballistic droplets with air drag and wind,
 * ground landings (for wet-lawn maps), and a physically placed rainbow: a droplet is tinted when
 * the angle between the view ray and the antisolar point is 40.6-42.4 deg (primary, violet
 * inside) or 50.2-53.6 deg (secondary, reversed, 43%), with Alexander's dark band between.
 *
 * The emitter follows any Matrix4 you give it (a Rapier body's pose), so you can pick the
 * sprinkler up and aim it. CPU particles in a ring buffer; one THREE.Points draw call.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Matrix4,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { WindField } from './wind'

export interface SprinklerOptions {
  /** Max live droplets. Default 1500 (use ~500 on phones). */
  capacity?: number
  /** Jets along the tube. Default 18. */
  jets?: number
  /** Tube length, m. Default 0.34. */
  tubeLength?: number
  /** Nozzle exit speed, m/s. Default 6.5. */
  speed?: number
  /** Rocking period, s. Default 8. */
  period?: number
  /** Max rock angle each side, radians. Default 62 deg. */
  sweep?: number
  /** Fan spread of the jets along the tube (total), radians. Default 50 deg. */
  fan?: number
  /** Linear air drag, 1/s. Default 0.4. */
  drag?: number
  /** Droplets per second. Default capacity / 1.5. */
  rate?: number
  /** World height where droplets land. Default 0. */
  groundY?: number
  /** Called for (a subset of) landings, for wetness maps. */
  onLand?: (x: number, z: number) => void
  /** Droplet sprite size in metres. Default 0.022. */
  size?: number
}

const _w = new Vector3()
const _m = new Matrix4()

export class Sprinkler {
  readonly points: Points
  readonly opts: Required<Omit<SprinklerOptions, 'onLand'>> & { onLand?: (x: number, z: number) => void }
  enabled = true
  /** Current rock angle of the tube, radians (for the visual). */
  armAngle = 0
  time = 0
  live = 0
  private pos: Float32Array
  private vel: Float32Array
  private life: Float32Array
  private head = 0
  private carry = 0
  private seed = 12345
  private geom: BufferGeometry
  private mat: ShaderMaterial

  constructor(o: SprinklerOptions = {}) {
    const capacity = o.capacity ?? 1500
    this.opts = {
      capacity,
      jets: o.jets ?? 18,
      tubeLength: o.tubeLength ?? 0.34,
      speed: o.speed ?? 6.5,
      period: o.period ?? 8,
      sweep: o.sweep ?? (62 * Math.PI) / 180,
      fan: o.fan ?? (50 * Math.PI) / 180,
      drag: o.drag ?? 0.4,
      rate: o.rate ?? capacity / 1.5,
      groundY: o.groundY ?? 0,
      size: o.size ?? 0.022,
      onLand: o.onLand,
    }
    this.pos = new Float32Array(capacity * 3).fill(-9999)
    this.vel = new Float32Array(capacity * 3)
    this.life = new Float32Array(capacity)
    this.geom = new BufferGeometry()
    const pa = new BufferAttribute(this.pos, 3)
    pa.setUsage(DynamicDrawUsage)
    const la = new BufferAttribute(this.life, 1)
    la.setUsage(DynamicDrawUsage)
    this.geom.setAttribute('position', pa)
    this.geom.setAttribute('aLife', la)
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uSize: { value: this.opts.size },
        uScale: { value: 800 },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Vector3(1, 1, 1) },
        uSky: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aLife;
        uniform float uSize;
        uniform float uScale;
        uniform vec3 uSunDir;
        varying float vAlpha;
        varying vec3 vTint;
        varying float vBow;
        vec3 spectral(float t) {
          // t: 0 violet .. 1 red
          vec3 c = vec3(
            smoothstep(0.45, 0.85, t) + smoothstep(0.15, 0.0, t) * 0.5,
            smoothstep(0.2, 0.5, t) * (1.0 - smoothstep(0.65, 0.9, t)),
            1.0 - smoothstep(0.25, 0.55, t));
          return c;
        }
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = uSize * uScale / max(0.1, -mv.z);
          // Clamp: a drop 20 cm from the lens should not become a snowball.
          gl_PointSize = clamp(px, 1.5, 7.0);
          // Sub-pixel droplets fade instead of shrinking (keeps the spray from shimmering);
          // drops right at the eye fade out too.
          vAlpha = aLife > 0.0 ? clamp(px / 1.5, 0.25, 1.0) * min(1.0, aLife * 6.0) * smoothstep(0.25, 0.9, -mv.z) : 0.0;
          vec3 viewDir = normalize(position - cameraPosition);
          float ang = degrees(acos(clamp(dot(viewDir, -uSunDir), -1.0, 1.0)));
          vTint = vec3(1.0);
          vBow = 0.0;
          if (ang > 40.6 && ang < 42.4) {
            vTint = spectral((ang - 40.6) / 1.8);
            vBow = 1.0;
          } else if (ang > 50.2 && ang < 53.6) {
            vTint = spectral(1.0 - (ang - 50.2) / 3.4);
            vBow = 0.43;
          } else if (ang > 42.4 && ang < 50.2) {
            vBow = -0.35; // Alexander's dark band
          } else if (ang < 40.6) {
            vBow = 0.15; // brighter inside the bow
          }
          // A real bow is lit by millions of drops; we have ~1500, so drops inside the band
          // are drawn bigger and more opaque to keep the arc legible.
          if (vBow > 0.2) {
            gl_PointSize *= 1.0 + 1.6 * vBow;
            vAlpha = min(1.0, vAlpha * (1.0 + vBow));
          }
          if (gl_Position.w <= 0.0) vAlpha = 0.0;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor;
        uniform float uSky;
        varying float vAlpha;
        varying vec3 vTint;
        varying float vBow;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r2 = dot(d, d);
          if (r2 > 0.25) discard;
          float core = 1.0 - smoothstep(0.0, 0.25, r2);
          vec3 base = mix(vec3(0.75, 0.82, 0.9) * uSky, uSunColor, 0.5);
          vec3 c = base;
          if (vBow > 0.2) c = mix(base, vTint * (uSunColor + 0.15) * 2.2, 0.9 * min(1.0, vBow * 1.5));
          else c *= 1.0 + vBow;
          gl_FragColor = vec4(c, vAlpha * (0.35 + 0.45 * core));
          #include <colorspace_fragment>
        }
      `,
    })
    this.points = new Points(this.geom, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 2
  }

  /** Sun direction (to the sun) and colour for the rainbow + droplet lighting. */
  setSun(dir: Vector3, r: number, g: number, b: number, sky: number): void {
    ;(this.mat.uniforms.uSunDir.value as Vector3).copy(dir).normalize()
    ;(this.mat.uniforms.uSunColor.value as Vector3).set(r, g, b)
    this.mat.uniforms.uSky.value = sky
  }

  /** Pixel scale = renderer height / (2 tan(fov/2)). Call on resize. */
  setViewScale(heightPx: number, fovDeg: number): void {
    this.mat.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360))
  }

  private rand(): number {
    // xorshift32, deterministic per sprinkler
    let x = this.seed
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.seed = x >>> 0
    return this.seed / 4294967296
  }

  /**
   * Advance one fixed step. `nozzle` is the world matrix of the sprinkler base: local +Y up,
   * local X along the tube. `water` scales flow (0 = off).
   */
  step(dt: number, nozzle: Matrix4, wind: WindField | null, water = 1): void {
    const o = this.opts
    this.time += dt
    this.armAngle = o.sweep * Math.sin((2 * Math.PI * this.time) / o.period)
    const cap = o.capacity
    const { pos, vel, life } = this
    // ---- emit
    if (this.enabled && water > 0) {
      this.carry += o.rate * dt * water
      const n = Math.floor(this.carry)
      this.carry -= n
      _m.copy(nozzle)
      const e = _m.elements
      for (let k = 0; k < n; k++) {
        const j = Math.floor(this.rand() * o.jets)
        const u = o.jets > 1 ? j / (o.jets - 1) - 0.5 : 0
        const lx = u * o.tubeLength
        // Direction in the base's local frame: fan along X, rock about X.
        const psi = u * o.fan + (this.rand() - 0.5) * 0.03
        const th = this.armAngle + (this.rand() - 0.5) * 0.03
        let dx = Math.sin(psi)
        let dy = Math.cos(psi)
        let dz = 0
        // rotate about X by th
        const cy = Math.cos(th), sy = Math.sin(th)
        const ny = dy * cy - dz * sy
        const nz = dy * sy + dz * cy
        dy = ny
        dz = nz
        const sp = o.speed * (0.92 + this.rand() * 0.12) * Math.sqrt(water)
        // Local nozzle position: on top of the tube (radius ~1.2 cm, at y ~ 0.06).
        const lpx = lx, lpy = 0.065, lpz = 0
        const i = this.head
        this.head = (this.head + 1) % cap
        const p3 = i * 3
        pos[p3] = e[0] * lpx + e[4] * lpy + e[8] * lpz + e[12]
        pos[p3 + 1] = e[1] * lpx + e[5] * lpy + e[9] * lpz + e[13]
        pos[p3 + 2] = e[2] * lpx + e[6] * lpy + e[10] * lpz + e[14]
        // Rotate direction by the matrix (ignores scale).
        const wx = e[0] * dx + e[4] * dy + e[8] * dz
        const wy = e[1] * dx + e[5] * dy + e[9] * dz
        const wz = e[2] * dx + e[6] * dy + e[10] * dz
        vel[p3] = wx * sp
        vel[p3 + 1] = wy * sp
        vel[p3 + 2] = wz * sp
        // Sub-step the first frame so emission isn't banded per step.
        const f = this.rand() * dt
        pos[p3] += vel[p3] * f
        pos[p3 + 1] += vel[p3 + 1] * f
        pos[p3 + 2] += vel[p3 + 2] * f
        life[i] = 1
      }
    }
    // ---- integrate
    const drag = o.drag
    const gy = o.groundY
    let live = 0
    let landed = 0
    // One wind sample per step at the nozzle: the spray (~5 m) is smaller than a gust (~9 m),
    // and per-droplet noise cost ~2 ms/step for 1600 droplets.
    let wx = 0, wy = 0, wz = 0
    if (wind) {
      const e = nozzle.elements
      wind.sample(e[12], e[13] + 1, e[14], _w)
      wx = _w.x; wy = _w.y; wz = _w.z
    }
    const kd = drag * dt
    const g = 9.81 * dt
    for (let i = 0; i < cap; i++) {
      if (life[i] <= 0) continue
      const p3 = i * 3
      // Linear drag towards the moving air.
      vel[p3] += (wx - vel[p3]) * kd
      vel[p3 + 1] += (wy - vel[p3 + 1]) * kd - g
      vel[p3 + 2] += (wz - vel[p3 + 2]) * kd
      pos[p3] += vel[p3] * dt
      pos[p3 + 1] += vel[p3 + 1] * dt
      pos[p3 + 2] += vel[p3 + 2] * dt
      life[i] -= dt * 0.25
      if (pos[p3 + 1] <= gy) {
        if (o.onLand && (landed++ & 1) === 0) o.onLand(pos[p3], pos[p3 + 2])
        life[i] = 0
        pos[p3 + 1] = -9999
        continue
      }
      live++
    }
    this.live = live
    ;(this.geom.getAttribute('position') as BufferAttribute).needsUpdate = true
    ;(this.geom.getAttribute('aLife') as BufferAttribute).needsUpdate = true
  }

  saveState(): unknown {
    return { pos: this.pos.slice(), vel: this.vel.slice(), life: this.life.slice(), head: this.head, carry: this.carry, seed: this.seed, time: this.time }
  }

  loadState(s: unknown): void {
    const st = s as { pos: Float32Array; vel: Float32Array; life: Float32Array; head: number; carry: number; seed: number; time: number }
    this.pos.set(st.pos)
    this.vel.set(st.vel)
    this.life.set(st.life)
    this.head = st.head
    this.carry = st.carry
    this.seed = st.seed
    this.time = st.time
  }

  dispose(): void {
    this.geom.dispose()
    this.mat.dispose()
  }
}
