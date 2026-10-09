import * as THREE from 'three'
import type { OneBitPass } from './OneBitPass.ts'

/**
 * Test helpers: capture the internal buffers and score them.
 *
 * - swimMismatch: reprojects every pixel of frame B into frame A through depth and the
 *   two camera poses, and counts how often the dither bit differs on the same surface
 *   point. 0 = the pattern is glued to the world; ~0.3-0.5 = the pattern is glued to the
 *   glass (classic "shower door" swimming). Only mid-tone pixels count (pure black or
 *   white carry no pattern), and only where the reprojection lands within `tol` of a
 *   pixel centre (so nearest-neighbour resampling is not mistaken for swimming).
 * - legibility: Pearson correlation between the box-blurred bits and the box-blurred
 *   pre-dither tone. ~1 = the 1-bit image reads as the continuous one at arm's length.
 */
export interface Frame {
  w: number
  h: number
  bits: Uint8Array
  edge: Uint8Array
  tone: Float32Array
  z: Float32Array
  bg: Uint8Array
  camWorld: THREE.Matrix4
  camWorldInv: THREE.Matrix4
  tanX: number
  tanY: number
}

export function captureFrame(pass: OneBitPass, camera: THREE.PerspectiveCamera): Frame {
  const { width: w, height: h, rgba } = pass.readBits()
  const geom = new Uint8Array(w * h * 4)
  pass.renderer.readRenderTargetPixels(pass.targets.geom, 0, 0, w, h, geom)
  const n = w * h
  const bits = new Uint8Array(n)
  const edge = new Uint8Array(n)
  const tone = new Float32Array(n)
  const z = new Float32Array(n)
  const bg = new Uint8Array(n)
  const lnr = Math.log(camera.far / camera.near)
  for (let i = 0; i < n; i++) {
    bits[i] = rgba[i * 4] > 127 ? 1 : 0
    edge[i] = rgba[i * 4 + 1] > 127 ? 1 : 0
    tone[i] = rgba[i * 4 + 2] / 255
    const hi = geom[i * 4 + 2]
    const lo = geom[i * 4 + 3]
    bg[i] = hi === 255 && lo === 255 ? 1 : 0
    z[i] = camera.near * Math.exp(((hi * 256 + lo) / 65535) * lnr)
  }
  const P = camera.projectionMatrix.elements
  return {
    w, h, bits, edge, tone, z, bg,
    camWorld: camera.matrixWorld.clone(),
    camWorldInv: camera.matrixWorld.clone().invert(),
    tanX: 1 / P[0],
    tanY: 1 / P[5],
  }
}

export interface SwimResult {
  /** Fraction of comparable mid-tone pixels whose bit changed on the same surface point. */
  mismatch: number
  /** Number of pixels compared. */
  valid: number
}

export function swimMismatch(A: Frame, B: Frame, opts: { tol?: number; toneMin?: number; toneMax?: number; border?: number } = {}): SwimResult {
  const tol = opts.tol ?? 0.2
  const tMin = opts.toneMin ?? 0.12
  const tMax = opts.toneMax ?? 0.88
  const border = opts.border ?? 4
  const { w, h } = B
  const v = new THREE.Vector3()
  let valid = 0
  let diff = 0
  for (let y = border; y < h - border; y++) {
    for (let x = border; x < w - border; x++) {
      const i = y * w + x
      if (B.bg[i] || B.edge[i]) continue
      const t = B.tone[i]
      if (t < tMin || t > tMax) continue
      const z = B.z[i]
      const nx = ((x + 0.5) / w) * 2 - 1
      const ny = ((y + 0.5) / h) * 2 - 1
      v.set(nx * B.tanX * z, ny * B.tanY * z, -z).applyMatrix4(B.camWorld).applyMatrix4(A.camWorldInv)
      const za = -v.z
      if (za <= 0) continue
      const fx = ((v.x / (za * A.tanX) + 1) / 2) * A.w - 0.5
      const fy = ((v.y / (za * A.tanY) + 1) / 2) * A.h - 0.5
      const ix = Math.round(fx)
      const iy = Math.round(fy)
      if (Math.abs(fx - ix) > tol || Math.abs(fy - iy) > tol) continue
      if (ix < border || iy < border || ix >= A.w - border || iy >= A.h - border) continue
      const j = iy * A.w + ix
      if (A.bg[j] || A.edge[j]) continue
      if (Math.abs(A.z[j] - za) > 0.01 * za) continue
      valid++
      if (A.bits[j] !== B.bits[i]) diff++
    }
  }
  return { mismatch: valid ? diff / valid : NaN, valid }
}

/** Separable box blur (radius r) of a w x h float image. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      let c = 0
      for (let k = -r; k <= r; k++) {
        const xx = x + k
        if (xx >= 0 && xx < w) { s += src[y * w + xx]; c++ }
      }
      tmp[y * w + x] = s / c
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      let c = 0
      for (let k = -r; k <= r; k++) {
        const yy = y + k
        if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; c++ }
      }
      out[y * w + x] = s / c
    }
  }
  return out
}

export interface Rect { x0: number; y0: number; x1: number; y1: number }

export function legibility(f: Frame, rect?: Rect, radius = 2): { r: number; mae: number; pixels: number } {
  const n = f.w * f.h
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) b[i] = f.bits[i]
  const bb = boxBlur(b, f.w, f.h, radius)
  const tb = boxBlur(f.tone, f.w, f.h, radius)
  const R = rect ?? { x0: 0, y0: 0, x1: f.w, y1: f.h }
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, mae = 0, m = 0
  for (let y = Math.max(0, R.y0); y < Math.min(f.h, R.y1); y++) {
    for (let x = Math.max(0, R.x0); x < Math.min(f.w, R.x1); x++) {
      const i = y * f.w + x
      const a = bb[i]
      const t = tb[i]
      sa += a; sb += t; saa += a * a; sbb += t * t; sab += a * t
      mae += Math.abs(a - t)
      m++
    }
  }
  const cov = sab / m - (sa / m) * (sb / m)
  const va = saa / m - (sa / m) ** 2
  const vb = sbb / m - (sb / m) ** 2
  return { r: cov / Math.sqrt(va * vb), mae: mae / m, pixels: m }
}

/** Screen-space bounding rect (internal pixels, bottom-up) of an object's world AABB. */
export function projectRect(obj: THREE.Object3D, camera: THREE.Camera, w: number, h: number, inset = 0): Rect {
  const box = new THREE.Box3().setFromObject(obj)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const v = new THREE.Vector3()
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera)
    const px = ((v.x + 1) / 2) * w
    const py = ((v.y + 1) / 2) * h
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
  }
  return { x0: Math.floor(x0) + inset, y0: Math.floor(y0) + inset, x1: Math.ceil(x1) - inset, y1: Math.ceil(y1) - inset }
}
