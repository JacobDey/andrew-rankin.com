// Recipe thumbnails: bake the surface at 2:1 (a 19 mm square) and light it on the CPU with the raking lamp,
// heightfield self-shadows, cavity AO and a GGX-ish highlight. Used by the hub, the atlas and the dev sheet.
import { bakeMaps } from './bake-client'
import { defaultSizeMm } from './baker'
import { srgbToLinear, linearToSrgb } from './colour'

/** Shade baked maps into an RGBA image (row 0 = top). Exposed for the dev page and the poster. */
export function shadeMaps(
  maps: { sizeMm: number; res: number; albedo: Uint8Array; orm: Uint8Array; height: Float32Array },
  lampAzDeg = 135,
  lampElDeg = 25,
): Uint8ClampedArray {
  const { res, height: H, albedo, orm } = maps
  const texel = maps.sizeMm / res
  const az = (lampAzDeg * Math.PI) / 180
  const el = (lampElDeg * Math.PI) / 180
  const lx = Math.cos(el) * Math.cos(az)
  const ly = Math.cos(el) * Math.sin(az)
  const lz = Math.sin(el)
  const hx = lx
  const hy = ly
  const hz = lz + 1
  const hl = 1 / Math.hypot(hx, hy, hz)
  const dirx = Math.cos(az)
  const diry = Math.sin(az)
  const tanEl = Math.tan(el)
  const out = new Uint8ClampedArray(res * res * 4)
  const inv2 = 1 / (2 * texel)
  const lut = new Float32Array(256)
  for (let i = 0; i < 256; i++) lut[i] = srgbToLinear(i / 255)
  for (let j = 0; j < res; j++) {
    const jm = j > 0 ? j - 1 : 0
    const jp = j < res - 1 ? j + 1 : res - 1
    for (let i = 0; i < res; i++) {
      const im = i > 0 ? i - 1 : 0
      const ip = i < res - 1 ? i + 1 : res - 1
      const k = j * res + i
      const gx = (H[j * res + ip] - H[j * res + im]) * inv2
      const gy = (H[jp * res + i] - H[jm * res + i]) * inv2
      const nl = 1 / Math.sqrt(gx * gx + gy * gy + 1)
      const nx = -gx * nl
      const ny = -gy * nl
      const nz = nl
      // heightfield shadow toward the lamp
      let vis = 1
      const h0 = H[k]
      let step = texel * 1.5
      let dist = 0
      for (let s = 0; s < 10; s++) {
        dist += step
        step *= 1.25
        const sx = i + (dirx * dist) / texel
        const sy = j + (diry * dist) / texel
        if (sx < 0 || sy < 0 || sx > res - 1 || sy > res - 1) break
        const hh = H[(sy | 0) * res + (sx | 0)]
        const ray = h0 + dist * tanEl
        const o = 8 * (ray - hh) / dist
        const v = o < 0 ? 0 : o > 1 ? 1 : o
        if (v < vis) vis = v
      }
      const ndl = Math.max(0, nx * lx + ny * ly + nz * lz)
      const ao = orm[k * 4] / 255
      const rough = Math.max(0.08, orm[k * 4 + 1] / 255)
      const metal = orm[k * 4 + 2] / 255
      const ndh = Math.max(0, (nx * hx + ny * hy + nz * hz) * hl)
      const shin = 2 / (rough * rough) - 2
      const spec = ((1 - rough) * (1 - rough) * 0.35 + 0.02) * Math.pow(ndh, Math.min(400, shin)) * (shin + 2) * 0.12 * vis
      const lamp = 2.4 * ndl * vis
      const fill = 0.32 * (0.6 + 0.4 * nz) * ao
      const diffK = 1 - metal
      for (let c = 0; c < 3; c++) {
        const a = lut[albedo[k * 4 + c]]
        const f0 = 0.04 + (a - 0.04) * metal
        let v = a * diffK * (fill + lamp * ao) + f0 * spec * 3 + a * metal * (fill * 0.5 + lamp * 0.25)
        v *= 0.95
        out[((res - 1 - j) * res + i) * 4 + c] = Math.round(linearToSrgb(v) * 255)
      }
      out[((res - 1 - j) * res + i) * 4 + 3] = 255
    }
  }
  return out
}

/** A lit px x px thumbnail of a registered recipe (2:1 frame). The lamp azimuth defaults to 135 degrees (upper left). */
export async function thumbnail(recipeId: string, px: number, lampAzDeg = 135): Promise<ImageData> {
  const res = Math.max(64, Math.round(px))
  const maps = await bakeMaps(recipeId, { sizeMm: defaultSizeMm(2) , res, ratio: 2, seed: 1 })
  const data = shadeMaps(maps, lampAzDeg)
  return new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, res, res)
}
