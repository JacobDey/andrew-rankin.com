/**
 * WindField: one shared, deterministic wind for physics (cloth, swing, droplets) and shaders
 * (grass, leaves). Gusts are bands of 2D gradient noise advected along the wind direction, so
 * a gust visibly travels across the yard: the sheet billows, then the grass, then the swing.
 *
 * `sample()` (TS) and `WIND_GLSL` (shader) implement the same function.
 */
import { Vector3 } from 'three'

export interface WindOptions {
  /** Heading the wind blows TOWARDS, radians around +Y (0 = towards -Z). Default 0.9. */
  heading?: number
  /** Mean speed m/s. Default 2.2 (a light summer breeze). */
  speed?: number
  /** Gust strength as a fraction of mean speed. Default 1.1. */
  gustiness?: number
  /** Gust length scale in metres. Default 9. */
  gustScale?: number
  /** Turbulent sideways wobble, fraction. Default 0.35. */
  turbulence?: number
}

export class WindField {
  heading: number
  speed: number
  gustiness: number
  gustScale: number
  turbulence: number
  time = 0
  readonly dir = new Vector3()

  constructor(o: WindOptions = {}) {
    this.heading = o.heading ?? 0.9
    this.speed = o.speed ?? 2.2
    this.gustiness = o.gustiness ?? 1.1
    this.gustScale = o.gustScale ?? 9
    this.turbulence = o.turbulence ?? 0.35
    this.updateDir()
  }

  setHeading(h: number): void {
    this.heading = h
    this.updateDir()
  }

  private updateDir(): void {
    this.dir.set(-Math.sin(this.heading), 0, -Math.cos(this.heading))
  }

  /** Advance wind time (call from a fixed step or once per frame, but only one of them). */
  update(dt: number): void {
    this.time += dt
  }

  /** Gust envelope 0..~2 at a point: 0 = lull, 1 = mean, 2 = strong gust. */
  gust(x: number, z: number, t = this.time): number {
    const d = this.dir
    const along = (x * d.x + z * d.z) / this.gustScale
    const across = (x * -d.z + z * d.x) / (this.gustScale * 1.7)
    // Advect the pattern with the mean wind so gusts travel downwind.
    const s = along - (t * this.speed) / this.gustScale
    const n = noise2(s, across + t * 0.05) * 0.75 + noise2(s * 2.3 + 7.1, across * 2.1 - t * 0.11) * 0.25
    return Math.max(0, 1 + n * this.gustiness)
  }

  /** Wind velocity (m/s) at a point. y adds a slight lift near the ground. */
  sample(x: number, y: number, z: number, out: Vector3, t = this.time): Vector3 {
    const g = this.gust(x, z, t)
    const h = Math.min(1, 0.35 + y * 0.35) // log-ish profile: slower near the ground
    const w = noise2(x * 0.31 + t * 0.7, z * 0.29 - t * 0.5) * this.turbulence
    const v = this.speed * g * h
    const d = this.dir
    out.set(d.x * v - d.z * w * v, w * 0.4 * v, d.z * v + d.x * w * v)
    return out
  }
}

// --------------------------------------------------------------------------- noise
// 2D gradient noise with the same sinless hash on CPU and GPU (results agree to ~1e-6).

function grad(ix: number, iy: number, fx: number, fy: number): number {
  let px = fract(ix * 0.1031)
  let py = fract(iy * 0.103)
  let pz = fract(ix * 0.0973)
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33)
  px += d
  py += d
  pz += d
  const gx = fract((px + px) * pz) * 2 - 1
  const gy = fract((px + py) * py) * 2 - 1
  return gx * fx + gy * fy
}

export function noise2(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const a = grad(ix, iy, fx, fy)
  const b = grad(ix + 1, iy, fx - 1, fy)
  const c = grad(ix, iy + 1, fx, fy - 1)
  const d = grad(ix + 1, iy + 1, fx - 1, fy - 1)
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 1.6
}

function fract(x: number): number {
  return x - Math.floor(x)
}

/** GLSL twin of WindField.gust(). Uniforms: uWindTime, uWindDir (vec2 xz), uWindSpeed, uWindGust, uWindScale. */
export const WIND_GLSL = /* glsl */ `
uniform float uWindTime;
uniform vec2 uWindDir;
uniform float uWindSpeed;
uniform float uWindGust;
uniform float uWindScale;
float wGrad(vec2 i, vec2 f) {
  vec3 p = fract(vec3(i.x * 0.1031, i.y * 0.103, i.x * 0.0973));
  float d = p.x * (p.y + 33.33) + p.y * (p.z + 33.33) + p.z * (p.x + 33.33);
  p += d;
  vec2 g = fract(vec2((p.x + p.x) * p.z, (p.x + p.y) * p.y)) * 2.0 - 1.0;
  return dot(g, f);
}
float wNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = wGrad(i, f);
  float b = wGrad(i + vec2(1.0, 0.0), f - vec2(1.0, 0.0));
  float c = wGrad(i + vec2(0.0, 1.0), f - vec2(0.0, 1.0));
  float d = wGrad(i + vec2(1.0, 1.0), f - vec2(1.0, 1.0));
  return (a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y) * 1.6;
}
float windGust(vec2 xz) {
  float along = dot(xz, uWindDir) / uWindScale;
  float across = dot(xz, vec2(-uWindDir.y, uWindDir.x)) / (uWindScale * 1.7);
  float s = along - uWindTime * uWindSpeed / uWindScale;
  float n = wNoise(vec2(s, across + uWindTime * 0.05)) * 0.75
          + wNoise(vec2(s * 2.3 + 7.1, across * 2.1 - uWindTime * 0.11)) * 0.25;
  return max(0.0, 1.0 + n * uWindGust);
}
`
