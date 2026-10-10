// @shared/sun: sun, sky and exposure maths (architecture §4.9). Pure TypeScript, hub-safe.
// Sunny 16 model: studio.md §5.2. Lens Bench model: lensbench.md §5.6.

const D2R = Math.PI / 180
const R2D = 180 / Math.PI
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

export interface SunPos {
  elevDeg: number
  azDeg: number /* 0 = north, clockwise */
  dir: [number, number, number] /* unit vector toward the sun; world +x east, +y up, +z north */
}

function dirOf(elevDeg: number, azDeg: number): [number, number, number] {
  const e = elevDeg * D2R, a = azDeg * D2R
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)]
}

/** 23.44° · sin(360/365 · (284 + n)) */
export function solarDeclinationDeg(dayOfYear: number): number {
  return 23.44 * Math.sin(((360 / 365) * (284 + dayOfYear)) * D2R)
}

/** Sun position for a clock time. clock = solar + clockOffsetH (Sunny 16 uses 1). */
export function sunPosition(dayOfYear: number, latDeg: number, clockHours: number, o?: { clockOffsetH?: number }): SunPos {
  const off = o?.clockOffsetH ?? 0
  const dec = solarDeclinationDeg(dayOfYear) * D2R
  const phi = latDeg * D2R
  const h = 15 * (clockHours - off - 12) * D2R
  const sinEl = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)
  const el = Math.asin(clamp(sinEl, -1, 1))
  let az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) * R2D + 180
  az = ((az % 360) + 360) % 360
  const elevDeg = el * R2D
  return { elevDeg, azDeg: az, dir: dirOf(elevDeg, az) }
}

/** Sunny 16 rule: the moon is the anti-sun rotated 15° toward the zenith. */
export function moonPosition(sun: SunPos): SunPos {
  const elevDeg = clamp(-sun.elevDeg + 15, -90, 90)
  const azDeg = (sun.azDeg + 180) % 360
  return { elevDeg, azDeg, dir: dirOf(elevDeg, azDeg) }
}

/** Kasten–Young air mass. */
export function airMass(elevDeg: number): number {
  const e = Math.max(-0.83, elevDeg)
  const den = Math.sin(Math.max(0, e) * D2R) + 0.50572 * Math.pow(e + 6.07995, -1.6364)
  return 1 / Math.max(1e-6, den)
}

/** Linear RGB of a blackbody at K (approximation), max channel 1. */
export function kelvinToRgb(K: number): [number, number, number] {
  const t = clamp(K, 1000, 40000) / 100
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
  const lin = (v: number) => {
    const s = clamp(v, 0, 255) / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const out: [number, number, number] = [lin(r), lin(g), lin(b)]
  const m = Math.max(out[0], out[1], out[2], 1e-6)
  return [out[0] / m, out[1] / m, out[2] / m]
}

export interface Daylight { sunLux: number; skyLux: number; moonLux: number; horizLux: number; kelvin: number; sunRGB: [number, number, number] }

/** Sunny 16 (studio.md §5.2). sunLux = direct normal; skyLux, moonLux, horizLux = on a horizontal plane. */
export function daylightStudio(sun: SunPos, moon?: SunPos): Daylight {
  const el = sun.elevDeg
  const sunLux = el > -0.83 ? 127000 * Math.exp(-0.21 * airMass(el)) : 0
  const skyLux = el > 0 ? 800 + 15000 * Math.pow(Math.sin(el * D2R), 0.5) : 800 * Math.pow(10, 0.395 * el)
  const m = moon ?? moonPosition(sun)
  const moonLux = 0.25 * Math.pow(Math.max(0, Math.sin(m.elevDeg * D2R)), 0.6)
  const horizLux = sunLux * Math.max(0, Math.sin(el * D2R)) + skyLux + moonLux + 0.002
  const kelvin = 1900 + 4600 * Math.pow(Math.max(0, Math.sin(el * D2R)), 0.45)
  return { sunLux, skyLux, moonLux, horizLux, kelvin, sunRGB: kelvinToRgb(kelvin) }
}

/**
 * Lens Bench (lensbench.md §5.6): the street runs east–west. hours in [0, 24) (night wraps past
 * midnight). normalLux = direct normal sun; sky luminances in kcd/m².
 */
export function lensbenchSun(hours: number): SunPos & {
  normalLux: number; skyHorizonKcd: number; skyZenithKcd: number
  sunRGB: [number, number, number]; horizonRGB: [number, number, number]
} {
  const h = ((hours % 24) + 24) % 24
  let elevDeg: number
  if (h >= 6 && h <= 20) elevDeg = 62 * Math.sin((Math.PI * (h - 6)) / 14)
  else {
    const hn = h < 6 ? h + 24 : h // 20..30
    elevDeg = -30 * Math.sin((Math.PI * (hn - 20)) / 10)
  }
  const hh = h < 6 ? h + 24 : h
  const azDeg = (((70 + ((hh - 6) / 14) * 220) % 360) + 360) % 360
  const AM = airMass(Math.max(0, elevDeg))
  const fade = clamp(elevDeg / 2, 0, 1)
  const normalLux = elevDeg > 0 ? 128000 * Math.exp(-0.2 * AM) * fade * fade * (3 - 2 * fade) : 0
  const w = clamp((30 - elevDeg) / 28, 0, 1)
  const sunRGB: [number, number, number] = [1, 0.98 + (0.62 - 0.98) * w, 0.95 + (0.32 - 0.95) * w]
  const s = Math.pow(clamp(Math.sin((elevDeg + 3) * D2R) / Math.sin(60 * D2R), 0.0005, 1), 0.9)
  const hz = clamp((10 - elevDeg) / 10, 0, 1)
  const horizonRGB: [number, number, number] = [0.9 + 0.1 * hz, 0.85 - 0.25 * hz, 0.8 - 0.45 * hz]
  return { elevDeg, azDeg, dir: dirOf(elevDeg, azDeg), normalLux, skyHorizonKcd: 8 * s, skyZenithKcd: 4 * s, sunRGB, horizonRGB }
}

export function ev100FromLuminance(L: number): number {
  return Math.log2(Math.max(1e-9, L) * 100 / 12.5)
}
export function luminanceFromEv100(ev: number): number {
  return (12.5 * Math.pow(2, ev)) / 100
}
export function exposureEv(N: number, t: number): number {
  return Math.log2((N * N) / Math.max(1e-9, t))
}
export function exposureMatches(N: number, t: number, iso: number, ev100: number, tolStops = 0.5): boolean {
  return Math.abs(exposureEv(N, t) - (ev100 + Math.log2(iso / 100))) <= tolStops
}
export function sunnySixteen(iso: number): { N: 16; t: number } {
  return { N: 16, t: 1 / Math.max(1, iso) }
}

export function selftest(): { name: string; pass: boolean; got: number; want: string }[] {
  const out: { name: string; pass: boolean; got: number; want: string }[] = []
  const noon = sunPosition(241, 41.5, 13, { clockOffsetH: 1 })
  out.push({ name: 'noon elevation (day 241, 41.5° N, 13:00)', pass: Math.abs(noon.elevDeg - 57.4) <= 0.3, got: +noon.elevDeg.toFixed(2), want: '57.4 ± 0.3' })
  out.push({ name: 'noon azimuth due south', pass: Math.abs(noon.azDeg - 180) < 0.5, got: +noon.azDeg.toFixed(2), want: '180' })
  // sunrise: elevation crosses −0.833° (refraction + disc)
  let lo = 3, hi = 13
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2
    if (sunPosition(241, 41.5, m, { clockOffsetH: 1 }).elevDeg < -0.833) lo = m; else hi = m
  }
  const rise = (lo + hi) / 2
  out.push({ name: 'sunrise ≈ 06:24', pass: Math.abs(rise - 6.4) <= 5 / 60, got: +rise.toFixed(3), want: '6.40 ± 0.08 h' })
  const dl = daylightStudio(noon)
  const ev = ev100FromLuminance((0.18 * dl.horizLux) / Math.PI)
  out.push({ name: 'EV100 grey card in full sun', pass: Math.abs(ev - 15.4) <= 0.4, got: +ev.toFixed(2), want: '15.4 ± 0.4' })
  const lb = lensbenchSun(13)
  out.push({ name: 'lens bench 13:00 elevation ≈ 61°', pass: Math.abs(lb.elevDeg - 61.2) < 1, got: +lb.elevDeg.toFixed(2), want: '≈ 61' })
  const n21 = lensbenchSun(21), n22 = lensbenchSun(22)
  out.push({ name: 'lens bench 21:00 = −9°, 22:00 = −18°', pass: Math.abs(n21.elevDeg + 9.27) < 0.5 && Math.abs(n22.elevDeg + 17.6) < 0.6, got: +n22.elevDeg.toFixed(2), want: '−9.3 / −17.6' })
  out.push({ name: 'airMass(90) ≈ 1', pass: Math.abs(airMass(90) - 1) < 0.01, got: +airMass(90).toFixed(4), want: '1' })
  return out
}
