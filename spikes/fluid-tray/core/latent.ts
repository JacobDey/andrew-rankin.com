/**
 * Latent-image helpers. The paper model wants S (0..1): how black each texel WILL go when fully developed.
 * Row 0 of S is the sheet's front edge (tray y = paper.y), which is the BOTTOM of the picture as seen
 * from the bench, so pictures (row 0 = top) are flipped on the way in.
 *
 * Pure TypeScript, no DOM.
 */

/**
 * Positive picture luminance (0..1, row 0 = top) -> S at the paper resolution.
 * `contrast` is a paper-grade-like slope around mid grey (1 = linear).
 */
export function latentFromLuminance(
  lum: Float32Array,
  w: number,
  h: number,
  outW: number,
  outH: number,
  contrast = 1.25,
): Float32Array {
  const S = new Float32Array(outW * outH)
  const lo = sig(-0.5 * contrast * 4)
  const hi = sig(0.5 * contrast * 4)
  for (let tj = 0; tj < outH; tj++) {
    // flip: tj = 0 is the bottom of the picture
    const py = ((outH - 1 - tj + 0.5) / outH) * h - 0.5
    for (let ti = 0; ti < outW; ti++) {
      const px = ((ti + 0.5) / outW) * w - 0.5
      const L = bilinear(lum, w, h, px, py)
      const x = (1 - L) - 0.5
      S[tj * outW + ti] = (sig(x * contrast * 4) - lo) / (hi - lo)
    }
  }
  return S
}

/** RGBA8 pixels (e.g. from ImageData) -> luminance 0..1 (sRGB-ish weights, gamma-decoded). */
export function luminanceFromRGBA(data: ArrayLike<number>, w: number, h: number): Float32Array {
  const L = new Float32Array(w * h)
  for (let i = 0, q = 0; i < w * h; i++, q += 4) {
    const a = data[q + 3] / 255
    const r = srgb(data[q] / 255)
    const g = srgb(data[q + 1] / 255)
    const b = srgb(data[q + 2] / 255)
    // transparent pixels read as white paper (unexposed)
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    L[i] = Math.pow(y * a + (1 - a), 1 / 2.2)
  }
  return L
}

/**
 * A DOM-free test chart: white border, a step wedge, a Siemens star, a sun gradient and a horizon.
 * Good for tests and for checking "shadows first, highlights last".
 */
export function testPattern(resX: number, resY: number): Float32Array {
  const S = new Float32Array(resX * resY)
  for (let tj = 0; tj < resY; tj++) {
    const v = (tj + 0.5) / resY // 0 = front/bottom of picture
    for (let ti = 0; ti < resX; ti++) {
      const u = (ti + 0.5) / resX
      let s = 0
      const inImage = u > 0.06 && u < 0.94 && v > 0.075 && v < 0.925
      if (inImage) {
        // sky gradient, darker at the top
        s = 0.12 + 0.3 * (v - 0.075)
        // sun
        const du = (u - 0.3) * 1.25
        const dv = v - 0.68
        const r = Math.sqrt(du * du + dv * dv)
        if (r < 0.11) s = 0.03
        else if (r < 0.16) s = Math.min(s, 0.03 + (r - 0.11) * 3)
        // ground
        if (v < 0.4) s = 0.55 + 0.25 * (0.4 - v)
        // siemens star
        const sx = (u - 0.74) * 1.25
        const sy = v - 0.62
        const rs = Math.sqrt(sx * sx + sy * sy)
        if (rs < 0.19) {
          const a = Math.atan2(sy, sx)
          s = Math.sin(a * 18) > 0 ? 0.92 : 0.08
          if (rs < 0.012) s = 0.5
        }
        // step wedge along the bottom
        if (v > 0.1 && v < 0.2 && u > 0.1 && u < 0.9) {
          const k = Math.floor(((u - 0.1) / 0.8) * 11)
          s = k / 10
        }
      }
      S[tj * resX + ti] = s
    }
  }
  return S
}

function sig(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function srgb(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function bilinear(f: Float32Array, w: number, h: number, x: number, y: number): number {
  x = x < 0 ? 0 : x > w - 1 ? w - 1 : x
  y = y < 0 ? 0 : y > h - 1 ? h - 1 : y
  const x0 = Math.min(w - 2, Math.floor(x))
  const y0 = Math.min(h - 2, Math.floor(y))
  const fx = x - x0
  const fy = y - y0
  const a = f[y0 * w + x0] + (f[y0 * w + x0 + 1] - f[y0 * w + x0]) * fx
  const b = f[(y0 + 1) * w + x0] + (f[(y0 + 1) * w + x0 + 1] - f[(y0 + 1) * w + x0]) * fx
  return a + (b - a) * fy
}
