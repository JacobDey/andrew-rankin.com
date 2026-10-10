// Recipe → FrameImage: paints the frame (log-encoded luminance), decodes it, applies the lens
// (vignette, halation, blur), and builds mips, SMALL-detail insets and the legibility Δ maps.
import type { BBox, FactId, FrameImage, FrameRecipe, FrameRef } from '../core/types'
import { recipe as getRecipe } from '../data/rolls'
import { UW, UH, decodeL, paintFrame, postEffects, setEncoding } from './paint'

export const FRAME_W = 576
export const FRAME_H = 384
const DELTA_W = 160

let fontsReady: Promise<void> | null = null
/** Every font the painter uses must be loaded before painting, or frames would differ run to run. */
export function loadFonts(): Promise<void> {
  if (fontsReady) return fontsReady
  const fams = ["700 20px 'Archivo Variable'", "800 20px 'Archivo Variable'", "600 20px 'Caveat Variable'", "400 20px 'IBM Plex Mono'", "500 20px 'IBM Plex Mono'"]
  fontsReady = (async () => {
    try {
      if (!document.fonts) return
      await Promise.race([Promise.all(fams.map((f) => document.fonts.load(f).catch(() => []))), new Promise((r) => setTimeout(r, 4000))])
    } catch { /* system fallbacks */ }
  })()
  return fontsReady
}

function makeCanvas(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) throw new Error('no 2d context')
  return g
}

function renderOnce(rec: FrameRecipe, w: number, h: number, region: BBox | null, hidden: Set<string>, rollDeg: number, enc: number): Uint8ClampedArray {
  const g = makeCanvas(w, h)
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h)
  if (region) {
    const [bx, by, bw, bh] = region
    g.setTransform(w / (bw * UW), 0, 0, h / (bh * UH), (-bx * UW * w) / (bw * UW), (-by * UH * h) / (bh * UH))
  } else g.setTransform(w / UW, 0, 0, h / UH, 0, 0)
  if (rollDeg) { g.translate(UW / 2, UH / 2); g.rotate((rollDeg * Math.PI) / 180); g.scale(1.12, 1.12); g.translate(-UW / 2, -UH / 2) }
  setEncoding(enc)
  paintFrame(g, rec, hidden)
  setEncoding(0)
  return g.getImageData(0, 0, w, h).data
}

/** Paint in both encodings and merge; then the frame's own blur effects (motion, shake, defocus). */
function render(rec: FrameRecipe, w: number, h: number, region: BBox | null, hidden: Set<string>, rollDeg = 0): Float32Array {
  const lo = renderOnce(rec, w, h, region, hidden, rollDeg, 0)
  const hi = renderOnce(rec, w, h, region, hidden, rollDeg, 1)
  let L: Float32Array = new Float32Array(w * h)
  for (let i = 0, q = 0; i < L.length; i++, q += 4) L[i] = hi[q] > 8 ? decodeL(hi[q], 1) : decodeL(lo[q], 0)
  const post = postEffects(rec)
  const pxPerFrame = region ? w / region[2] : w
  if (post.motion > 0) L = boxBlurH(L, w, h, (post.motion * pxPerFrame) / 2)
  if (post.shake > 0) L = boxBlurH(L, w, h, (post.shake * pxPerFrame) / FRAME_W)
  if (post.blur > 0) L = blur(L, w, h, (post.blur * pxPerFrame) / FRAME_W)
  return L
}

function boxBlurH(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(src.length)
  const R = Math.max(1, Math.round(r))
  for (let y = 0; y < h; y++) {
    let acc = 0
    const row = y * w
    for (let x = -R; x <= R; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      out[row + x] = acc / (2 * R + 1)
      acc += src[row + Math.min(w - 1, x + R + 1)] - src[row + Math.max(0, x - R)]
    }
  }
  return out
}
function transpose(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x * h + y] = src[y * w + x]
  return out
}
/** Approximate Gaussian: three box passes each way. */
export function blur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma < 0.4) return src
  const r = Math.max(1, Math.round(sigma * 0.95))
  let a = boxBlurH(boxBlurH(boxBlurH(src, w, h, r), w, h, r), w, h, r)
  a = transpose(a, w, h)
  a = boxBlurH(boxBlurH(boxBlurH(a, h, w, r), h, w, r), h, w, r)
  return transpose(a, h, w)
}

function downsample(L: Float32Array, w: number, h: number): { w: number; h: number; L: Float32Array } {
  const w2 = w >> 1, h2 = h >> 1
  const out = new Float32Array(w2 * h2)
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    const i = 2 * y * w + 2 * x
    out[y * w2 + x] = 0.25 * (L[i] + L[i + 1] + L[i + w] + L[i + w + 1])
  }
  return { w: w2, h: h2, L: out }
}

export function buildFrame(rec: FrameRecipe): FrameImage {
  const W = FRAME_W, H = FRAME_H
  const post = postEffects(rec)
  let L = render(rec, W, H, null, new Set(), post.rollDeg)
  // halation around L > 1.5: 0.25·blur(6 px) + 0.1·blur(24 px), plus the lens (0.6 px) and vignette
  let any = false
  const hot = new Float32Array(W * H)
  for (let i = 0; i < hot.length; i++) if (L[i] > 1.5) { hot[i] = L[i]; any = true }
  if (any) {
    const a = blur(hot, W, H, 6 * (W / 768)), b = blur(hot, W, H, 24 * (W / 768))
    for (let i = 0; i < L.length; i++) L[i] += 0.25 * a[i] + 0.1 * b[i]
  }
  L = blur(L, W, H, 0.6)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x / W - 0.5) * 36, dy = (y / H - 0.5) * 24
    const c = Math.cos(Math.atan(Math.sqrt(dx * dx + dy * dy) / 50))
    L[y * W + x] *= 1 - 0.85 * (1 - c * c * c * c)
  }
  const mips = [{ w: W, h: H, L }]
  for (let k = 1; k < 4; k++) mips.push(downsample(mips[k - 1].L, mips[k - 1].w, mips[k - 1].h))
  const insets: FrameImage['insets'] = []
  const deltas: FrameImage['deltas'] = {}
  for (const d of rec.details) {
    const [, , bw, bh] = d.bbox
    if (d.inset) {
      const k = d.mMin >= 12 ? 8 : 4
      const iw = Math.round(bw * W * k), ih = Math.round(bh * H * k)
      insets.push({ bbox: d.bbox, w: iw, h: ih, L: render(rec, iw, ih, d.bbox, new Set(), post.rollDeg) })
    }
    const dw = DELTA_W, dh = Math.max(8, Math.round((DELTA_W * bh * UH) / (bw * UW)))
    const on = render(rec, dw, dh, d.bbox, new Set(), post.rollDeg)
    const off = render(rec, dw, dh, d.bbox, new Set(d.hide), post.rollDeg)
    const dd = new Float32Array(dw * dh)
    for (let i = 0; i < dd.length; i++) dd[i] = on[i] - off[i]
    deltas[d.id as FactId] = { bbox: d.bbox, w: dw, h: dh, d: dd, off }
  }
  return { ref: { roll: rec.roll, frame: rec.frame }, w: W, h: H, L, mips, insets, deltas }
}

export interface FrameStore {
  get(ref: FrameRef): Promise<FrameImage>
  peek(ref: FrameRef): FrameImage | null
  ready(ref: FrameRef): boolean
  prefetch(refs: FrameRef[]): void
}

export function createFrameStore(o: { capacity?: number } = {}): FrameStore {
  const cap = o.capacity ?? 30
  const cache = new Map<string, FrameImage>()
  const pending = new Map<string, Promise<FrameImage>>()
  const key = (r: FrameRef) => `${r.roll}:${r.frame}`
  let chain: Promise<unknown> = Promise.resolve()
  function touch(k: string, img: FrameImage): void {
    cache.delete(k); cache.set(k, img)
    while (cache.size > cap) { const first = cache.keys().next().value as string; cache.delete(first) }
  }
  function get(ref: FrameRef): Promise<FrameImage> {
    const k = key(ref)
    const hit = cache.get(k)
    if (hit) { touch(k, hit); return Promise.resolve(hit) }
    const p = pending.get(k)
    if (p) return p
    const rec = getRecipe(ref.roll, ref.frame)
    if (!rec) return Promise.reject(new Error(`no frame R${ref.roll}/F${ref.frame}`))
    const job = chain.then(async () => {
      await loadFonts()
      await new Promise((r) => setTimeout(r, 0))
      const img = buildFrame(rec)
      touch(k, img); pending.delete(k)
      return img
    })
    chain = job.catch(() => undefined)
    pending.set(k, job)
    return job
  }
  return {
    get,
    peek: (ref) => cache.get(key(ref)) ?? null,
    ready: (ref) => cache.has(key(ref)),
    prefetch: (refs) => { for (const r of refs) void get(r).catch(() => undefined) },
  }
}
