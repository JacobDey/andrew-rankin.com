/**
 * Sun: solar position and daylight colour for a given local solar time.
 *
 * Defaults follow docs/design/concepts/studio-craft.md: the last Saturday of August at 41.5 N
 * (declination about +9.5 deg), so the sun peaks near 58 deg at solar noon, rises about 05:30
 * and sets about 18:30 solar time. Scene axes: +X east, -Z north, +Y up.
 *
 * Pure math; no three.js objects are created here except the returned vectors/colours.
 */
import { Color, Vector3 } from 'three'

export interface SunState {
  /** Local solar time, hours. */
  hours: number
  /** Elevation above the horizon, radians (negative at night). */
  elevation: number
  /** Azimuth clockwise from north, radians. */
  azimuth: number
  /** Unit vector pointing TO the sun. */
  dir: Vector3
  /** Direct-light colour (linear RGB, unscaled) from the blackbody approximation. */
  color: Color
  /** Direct illuminance factor 0..1 (1 = high noon on a clear day). */
  intensity: number
  /** Sky (ambient) factor 0..1, keeps a little light through blue hour. */
  skyIntensity: number
  /** Approximate EV100 of a sunlit scene (15 = sunny 16). */
  ev100: number
  /** Correlated colour temperature, kelvin. */
  kelvin: number
}

const DEG = Math.PI / 180

export function solarPosition(hours: number, latitudeDeg = 41.5, declinationDeg = 9.5): { elevation: number; azimuth: number } {
  const phi = latitudeDeg * DEG
  const dec = declinationDeg * DEG
  const H = (hours - 12) * 15 * DEG
  const sinEl = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)))
  // Azimuth from north, clockwise.
  const cosAz = (Math.sin(dec) - Math.sin(el) * Math.sin(phi)) / (Math.cos(el) * Math.cos(phi))
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)))
  if (H > 0) az = 2 * Math.PI - az
  return { elevation: el, azimuth: az }
}

/** Blackbody colour approximation (Tanner Helland), returned in linear RGB. */
export function kelvinToColor(k: number, out = new Color()): Color {
  const t = k / 100
  let r: number, g: number, b: number
  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255
  out.setRGB(c(r), c(g), c(b)) // sRGB-ish values
  return out.convertSRGBToLinear()
}

export function sunState(hours: number, latitudeDeg = 41.5, declinationDeg = 9.5): SunState {
  const { elevation, azimuth } = solarPosition(hours, latitudeDeg, declinationDeg)
  const ce = Math.cos(elevation)
  const dir = new Vector3(ce * Math.sin(azimuth), Math.sin(elevation), -ce * Math.cos(azimuth))
  const s = Math.max(0, Math.sin(elevation))
  // studio-toy.md 5.5: L = L0 * max(0.015, sin(el))^0.7 ; K = 1900 + 4600 * sin(el)^0.45
  const kelvin = 1900 + 4600 * Math.pow(s, 0.45)
  // Fade the direct light to zero across the horizon (with a soft 2 deg penumbra).
  const horizon = smoothstep(-2 * DEG, 2 * DEG, elevation)
  const intensity = Math.pow(Math.max(0.015, s), 0.7) * horizon
  // Sky light keeps going through civil twilight (~ -6 deg).
  const skyIntensity = Math.max(0.03, smoothstep(-8 * DEG, 25 * DEG, elevation))
  // EV100: 15 at full sun, ~12 at golden hour, ~5 at blue hour.
  const ev100 = elevation > 0 ? 9 + 6 * Math.pow(s / Math.sin(58 * DEG), 0.35) : 9 + elevation / DEG * 0.8
  return { hours, elevation, azimuth, dir, color: kelvinToColor(kelvin), intensity, skyIntensity, ev100, kelvin }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
