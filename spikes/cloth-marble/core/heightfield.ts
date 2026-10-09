// HeightField: a regular grid of heights in millimetres over a rectangle in plate
// space (x right, y up the screen, z out of the surface). Renderer-independent.
//
// Texel convention matches GPU textures: texel (i, j) is centred at
//   x = x0 + (i + 0.5) * dx,  y = y0 + (j + 0.5) * dy
// and row j = 0 is the bottom (v = 0). So uv = ((x - x0) / sizeX, (y - y0) / sizeY)
// samples the same point on the CPU and in a shader.

export interface HeightSample {
  /** height (mm) */
  h: number
  /** dh/dx (mm per mm) */
  gx: number
  /** dh/dy (mm per mm) */
  gy: number
}

export function heightSample(): HeightSample {
  return { h: 0, gx: 0, gy: 0 }
}

export class HeightField {
  readonly nx: number
  readonly ny: number
  readonly sizeX: number
  readonly sizeY: number
  readonly x0: number
  readonly y0: number
  readonly dx: number
  readonly dy: number
  readonly data: Float32Array
  private gxArr: Float32Array | null = null
  private gyArr: Float32Array | null = null

  constructor(nx: number, ny: number, sizeX: number, sizeY: number, data?: Float32Array, x0 = -sizeX / 2, y0 = -sizeY / 2) {
    this.nx = nx
    this.ny = ny
    this.sizeX = sizeX
    this.sizeY = sizeY
    this.x0 = x0
    this.y0 = y0
    this.dx = sizeX / nx
    this.dy = sizeY / ny
    this.data = data ?? new Float32Array(nx * ny)
    if (this.data.length !== nx * ny) throw new Error(`HeightField: data length ${this.data.length} != ${nx}x${ny}`)
  }

  /** Bake a height function of plate-space millimetres. */
  static fromFunction(nx: number, ny: number, sizeX: number, sizeY: number, fn: (x: number, y: number) => number): HeightField {
    const f = new HeightField(nx, ny, sizeX, sizeY)
    for (let j = 0; j < ny; j++) {
      const y = f.y0 + (j + 0.5) * f.dy
      for (let i = 0; i < nx; i++) f.data[j * nx + i] = fn(f.x0 + (i + 0.5) * f.dx, y)
    }
    return f
  }

  /** Same extent, new data (handy for derived fields). */
  like(data?: Float32Array, nx = this.nx, ny = this.ny): HeightField {
    return new HeightField(nx, ny, this.sizeX, this.sizeY, data, this.x0, this.y0)
  }

  /** Mark the field as changed (e.g. abrasion edited `data`); drops cached gradients. */
  invalidate(): void {
    this.gxArr = null
    this.gyArr = null
  }

  at(i: number, j: number): number {
    i = i < 0 ? 0 : i >= this.nx ? this.nx - 1 : i
    j = j < 0 ? 0 : j >= this.ny ? this.ny - 1 : j
    return this.data[j * this.nx + i]
  }

  /** Bilinear height at plate-space (x, y), clamped at the edges. */
  sample(x: number, y: number): number {
    return this.bilerp(this.data, x, y)
  }

  /** Height and smooth gradient (bilinear blend of central differences) in one call. */
  sampleGrad(x: number, y: number, out: HeightSample): HeightSample {
    if (!this.gxArr) this.buildGradients()
    const nx = this.nx
    let fx = (x - this.x0) / this.dx - 0.5
    let fy = (y - this.y0) / this.dy - 0.5
    if (fx < 0) fx = 0
    else if (fx > nx - 1.0001) fx = nx - 1.0001
    if (fy < 0) fy = 0
    else if (fy > this.ny - 1.0001) fy = this.ny - 1.0001
    const i = fx | 0
    const j = fy | 0
    const tx = fx - i
    const ty = fy - j
    const k = j * nx + i
    const w00 = (1 - tx) * (1 - ty)
    const w10 = tx * (1 - ty)
    const w01 = (1 - tx) * ty
    const w11 = tx * ty
    const d = this.data
    const gx = this.gxArr!
    const gy = this.gyArr!
    out.h = d[k] * w00 + d[k + 1] * w10 + d[k + nx] * w01 + d[k + nx + 1] * w11
    out.gx = gx[k] * w00 + gx[k + 1] * w10 + gx[k + nx] * w01 + gx[k + nx + 1] * w11
    out.gy = gy[k] * w00 + gy[k + 1] * w10 + gy[k + nx] * w01 + gy[k + nx + 1] * w11
    return out
  }

  /**
   * C1-smooth (Catmull-Rom) height + exact derivative. Use for rolling bodies:
   * bilinear has slope kinks at texel borders that read as fake rattle.
   */
  sampleCubic(x: number, y: number, out: HeightSample): HeightSample {
    const nx = this.nx
    const ny = this.ny
    const fx = (x - this.x0) / this.dx - 0.5
    const fy = (y - this.y0) / this.dy - 0.5
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const tx = fx - i
    const ty = fy - j
    crWeights(tx, wxs, dwxs)
    crWeights(ty, wys, dwys)
    const d = this.data
    let h = 0
    let hx = 0
    let hy = 0
    for (let b = 0; b < 4; b++) {
      let jj = j - 1 + b
      jj = jj < 0 ? 0 : jj >= ny ? ny - 1 : jj
      const row = jj * nx
      let r = 0
      let rx = 0
      for (let a = 0; a < 4; a++) {
        let ii = i - 1 + a
        ii = ii < 0 ? 0 : ii >= nx ? nx - 1 : ii
        const v = d[row + ii]
        r += wxs[a] * v
        rx += dwxs[a] * v
      }
      h += wys[b] * r
      hx += wys[b] * rx
      hy += dwys[b] * r
    }
    out.h = h
    out.gx = hx / this.dx
    out.gy = hy / this.dy
    return out
  }

  /** Unit surface normal (plate space, z up). */
  normal(x: number, y: number, out: [number, number, number] = [0, 0, 1]): [number, number, number] {
    const s = this.sampleGrad(x, y, scratch)
    const l = 1 / Math.sqrt(s.gx * s.gx + s.gy * s.gy + 1)
    out[0] = -s.gx * l
    out[1] = -s.gy * l
    out[2] = l
    return out
  }

  private bilerp(arr: Float32Array, x: number, y: number): number {
    const nx = this.nx
    let fx = (x - this.x0) / this.dx - 0.5
    let fy = (y - this.y0) / this.dy - 0.5
    if (fx < 0) fx = 0
    else if (fx > nx - 1.0001) fx = nx - 1.0001
    if (fy < 0) fy = 0
    else if (fy > this.ny - 1.0001) fy = this.ny - 1.0001
    const i = fx | 0
    const j = fy | 0
    const tx = fx - i
    const ty = fy - j
    const k = j * nx + i
    const a = arr[k] + (arr[k + 1] - arr[k]) * tx
    const b = arr[k + nx] + (arr[k + nx + 1] - arr[k + nx]) * tx
    return a + (b - a) * ty
  }

  private buildGradients(): void {
    const { nx, ny, data } = this
    const gx = new Float32Array(nx * ny)
    const gy = new Float32Array(nx * ny)
    const ix2 = 1 / (2 * this.dx)
    const iy2 = 1 / (2 * this.dy)
    for (let j = 0; j < ny; j++) {
      const jm = j > 0 ? j - 1 : 0
      const jp = j < ny - 1 ? j + 1 : ny - 1
      const sy = (jp - jm) === 2 ? iy2 : iy2 * 2
      for (let i = 0; i < nx; i++) {
        const im = i > 0 ? i - 1 : 0
        const ip = i < nx - 1 ? i + 1 : nx - 1
        const sx = (ip - im) === 2 ? ix2 : ix2 * 2
        const k = j * nx + i
        gx[k] = (data[j * nx + ip] - data[j * nx + im]) * sx
        gy[k] = (data[jp * nx + i] - data[jm * nx + i]) * sy
      }
    }
    this.gxArr = gx
    this.gyArr = gy
  }

  /** Min and max height. */
  range(): [number, number] {
    let lo = Infinity
    let hi = -Infinity
    for (let k = 0; k < this.data.length; k++) {
      const v = this.data[k]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    return [lo, hi]
  }

  /**
   * Downsample by an integer-ish factor keeping the MAX of each block. Use for
   * contact fields: a probe must never sink through a peak that averaging hid.
   */
  maxPool(nx: number, ny: number): HeightField {
    const out = new Float32Array(nx * ny)
    const fx = this.nx / nx
    const fy = this.ny / ny
    for (let j = 0; j < ny; j++) {
      const ja = Math.floor(j * fy)
      const jb = Math.max(ja + 1, Math.floor((j + 1) * fy))
      for (let i = 0; i < nx; i++) {
        const ia = Math.floor(i * fx)
        const ib = Math.max(ia + 1, Math.floor((i + 1) * fx))
        let m = -Infinity
        for (let jj = ja; jj < jb; jj++) {
          const row = jj * this.nx
          for (let ii = ia; ii < ib; ii++) {
            const v = this.data[row + ii]
            if (v > m) m = v
          }
        }
        out[j * nx + i] = m
      }
    }
    return this.like(out, nx, ny)
  }

  /** Box-average downsample (for render LODs, roughness estimates). */
  averagePool(nx: number, ny: number): HeightField {
    const out = new Float32Array(nx * ny)
    const fx = this.nx / nx
    const fy = this.ny / ny
    for (let j = 0; j < ny; j++) {
      const ja = Math.floor(j * fy)
      const jb = Math.max(ja + 1, Math.floor((j + 1) * fy))
      for (let i = 0; i < nx; i++) {
        const ia = Math.floor(i * fx)
        const ib = Math.max(ia + 1, Math.floor((i + 1) * fx))
        let s = 0
        for (let jj = ja; jj < jb; jj++) for (let ii = ia; ii < ib; ii++) s += this.data[jj * this.nx + ii]
        out[j * nx + i] = s / ((jb - ja) * (ib - ia))
      }
    }
    return this.like(out, nx, ny)
  }

  /**
   * Contact field for a spherical probe of radius r (mm):
   *
   *   D_r(p) = max_{|q-p|<r} [ H(q) + sqrt(r^2 - |q-p|^2) ] - r
   *
   * A sphere of radius r whose lowest point sits on D_r touches H without
   * penetrating it. Pits narrower than the probe get bridged; peaks become
   * domes of radius r. The probe's CENTRE rides at D_r + r.
   *
   * If (nx, ny) is smaller than the source, the source is max-pooled first
   * (conservative). Cost ~ nx*ny*pi*(r/dx)^2.
   */
  dilate(r: number, nx = this.nx, ny = this.ny): HeightField {
    const src = nx === this.nx && ny === this.ny ? this : this.maxPool(nx, ny)
    const dx = src.dx
    const dy = src.dy
    const ri = Math.ceil(r / dx)
    const rj = Math.ceil(r / dy)
    // offset table, sorted by descending weight so the early-out below triggers often
    const offs: { di: number; dj: number; w: number }[] = []
    for (let dj = -rj; dj <= rj; dj++) {
      for (let di = -ri; di <= ri; di++) {
        const d2 = (di * dx) ** 2 + (dj * dy) ** 2
        if (d2 > r * r) continue
        offs.push({ di, dj, w: Math.sqrt(r * r - d2) - r })
      }
    }
    offs.sort((a, b) => b.w - a.w)
    const n = offs.length
    const odi = new Int32Array(n)
    const odj = new Int32Array(n)
    const ow = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      odi[k] = offs[k].di
      odj[k] = offs[k].dj
      ow[k] = offs[k].w
    }
    const s = src.data
    const out = new Float32Array(nx * ny)
    // global max lets us stop scanning once no remaining offset can win
    const [, hmax] = src.range()
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let best = -Infinity
        const interior = i >= ri && i < nx - ri && j >= rj && j < ny - rj
        for (let k = 0; k < n; k++) {
          const w = ow[k]
          if (hmax + w <= best) break // sorted: nothing after this can beat best
          let ii = i + odi[k]
          let jj = j + odj[k]
          if (!interior) {
            ii = ii < 0 ? 0 : ii >= nx ? nx - 1 : ii
            jj = jj < 0 ? 0 : jj >= ny ? ny - 1 : jj
          }
          const v = s[jj * nx + ii] + w
          if (v > best) best = v
        }
        out[j * nx + i] = best
      }
    }
    return src.like(out, nx, ny)
  }

  /** Separable box blur (radius in mm), repeated `passes` times (3 ~ Gaussian). */
  blur(radiusMm: number, passes = 2): HeightField {
    const r = Math.max(1, Math.round(radiusMm / this.dx))
    const { nx, ny } = this
    let a: Float32Array = new Float32Array(this.data) as Float32Array
    let b: Float32Array = new Float32Array(nx * ny) as Float32Array
    for (let p = 0; p < passes; p++) {
      boxBlurH(a, b, nx, ny, r)
      boxBlurV(b, a, nx, ny, r)
    }
    return this.like(a)
  }
}

const scratch = heightSample()
const wxs = new Float64Array(4)
const dwxs = new Float64Array(4)
const wys = new Float64Array(4)
const dwys = new Float64Array(4)

/** Catmull-Rom weights and their derivatives for fractional position t. */
function crWeights(t: number, w: Float64Array, dw: Float64Array) {
  const t2 = t * t
  const t3 = t2 * t
  w[0] = 0.5 * (-t3 + 2 * t2 - t)
  w[1] = 0.5 * (3 * t3 - 5 * t2 + 2)
  w[2] = 0.5 * (-3 * t3 + 4 * t2 + t)
  w[3] = 0.5 * (t3 - t2)
  dw[0] = 0.5 * (-3 * t2 + 4 * t - 1)
  dw[1] = 0.5 * (9 * t2 - 10 * t)
  dw[2] = 0.5 * (-9 * t2 + 8 * t + 1)
  dw[3] = 0.5 * (3 * t2 - 2 * t)
}

function boxBlurH(src: Float32Array, dst: Float32Array, nx: number, ny: number, r: number) {
  const inv = 1 / (2 * r + 1)
  for (let j = 0; j < ny; j++) {
    const row = j * nx
    let acc = 0
    for (let i = -r - 1; i < r; i++) acc += src[row + (i < 0 ? 0 : i >= nx ? nx - 1 : i)]
    for (let i = 0; i < nx; i++) {
      const add = i + r
      const sub = i - r - 1
      acc += src[row + (add >= nx ? nx - 1 : add)] - src[row + (sub < 0 ? 0 : sub)]
      dst[row + i] = acc * inv
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, nx: number, ny: number, r: number) {
  const inv = 1 / (2 * r + 1)
  for (let i = 0; i < nx; i++) {
    let acc = 0
    for (let j = -r - 1; j < r; j++) acc += src[(j < 0 ? 0 : j >= ny ? ny - 1 : j) * nx + i]
    for (let j = 0; j < ny; j++) {
      const add = j + r
      const sub = j - r - 1
      acc += src[(add >= ny ? ny - 1 : add) * nx + i] - src[(sub < 0 ? 0 : sub) * nx + i]
      dst[j * nx + i] = acc * inv
    }
  }
}

/**
 * A scalar material channel on its own grid over the same plate (friction
 * multiplier, restitution, rolling resistance, snag strength...). Nearest-ish
 * bilinear lookup, clamped.
 */
export class ScalarField {
  readonly nx: number
  readonly ny: number
  readonly sizeX: number
  readonly sizeY: number
  readonly x0: number
  readonly y0: number
  readonly data: Float32Array
  constructor(nx: number, ny: number, sizeX: number, sizeY: number, data?: Float32Array, x0 = -sizeX / 2, y0 = -sizeY / 2) {
    this.nx = nx
    this.ny = ny
    this.sizeX = sizeX
    this.sizeY = sizeY
    this.x0 = x0
    this.y0 = y0
    this.data = data ?? new Float32Array(nx * ny)
  }
  sample(x: number, y: number): number {
    const nx = this.nx
    let fx = ((x - this.x0) / this.sizeX) * nx - 0.5
    let fy = ((y - this.y0) / this.sizeY) * this.ny - 0.5
    if (fx < 0) fx = 0
    else if (fx > nx - 1.0001) fx = nx - 1.0001
    if (fy < 0) fy = 0
    else if (fy > this.ny - 1.0001) fy = this.ny - 1.0001
    const i = fx | 0
    const j = fy | 0
    const tx = fx - i
    const ty = fy - j
    const k = j * nx + i
    const d = this.data
    const a = d[k] + (d[k + 1] - d[k]) * tx
    const b = d[k + nx] + (d[k + nx + 1] - d[k + nx]) * tx
    return a + (b - a) * ty
  }
}
