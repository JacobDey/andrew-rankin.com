// Offline rendering, level/spectrum analysis and CPU benchmarking. No DOM required
// (OfflineAudioContext only), so it doubles as a test harness for recipes.
import type { LoopVoice, OneShotDef, Params, SoundDef } from './types'
import { Synth, stopAll } from './synth'
import { mergeParams } from './engine'

export interface RenderOpts {
  sampleRate?: number
  quality?: 0 | 1
  seed?: number
  /** Loop render length (default def.preview.dur or 3 s). */
  dur?: number
  /** Drive loop params over time (default def.preview.auto). */
  auto?: (t: number, dur: number) => Params
}

export interface RenderResult {
  buffer: AudioBuffer
  /** Wall-clock render time (ms), excluding graph setup. */
  wallMs: number
  setupMs: number
  nodes: number
  dur: number
}

const OAC = (): typeof OfflineAudioContext => {
  const w = globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext }
  const C = w.OfflineAudioContext ?? w.webkitOfflineAudioContext
  if (!C) throw new Error('OfflineAudioContext unavailable')
  return C
}

/** Render one sound offline at its default (or given) params. */
export async function renderOffline(def: SoundDef, params: Params = {}, o: RenderOpts = {}): Promise<RenderResult> {
  const sr = o.sampleRate ?? 44100
  const quality = o.quality ?? 1
  const seed = o.seed ?? 7
  const C = OAC()
  if (def.kind === 'oneshot') {
    // probe pass on a throwaway context to learn the duration (same seed = same choices)
    const probe = new C(1, 128, sr)
    const ps = new Synth(probe, { quality, seed })
    const pp = mergeParams(def, params)
    pp.k = 1
    const end = def.play(ps, ps.gain(1, probe.destination), 0.01, pp)
    const dur = Math.min(15, Math.max(0.05, end + 0.05))
    const ctx = new C(2, Math.ceil(dur * sr), sr)
    const s = new Synth(ctx, { quality, seed })
    const t0 = performance.now()
    const p = mergeParams(def, params)
    p.k = 1
    def.play(s, s.gain(1, ctx.destination), 0.01, p)
    const setupMs = performance.now() - t0
    const t1 = performance.now()
    const buffer = await ctx.startRendering()
    return { buffer, wallMs: performance.now() - t1, setupMs, nodes: s.nodes, dur }
  }
  const dur = o.dur ?? def.preview?.dur ?? 3
  const auto = o.auto ?? def.preview?.auto
  const ctx = new C(2, Math.ceil(dur * sr), sr)
  const s = new Synth(ctx, { quality, seed })
  const t0 = performance.now()
  const out = s.gain(1, ctx.destination)
  const p = mergeParams(def, params)
  p.k = 1
  if (auto) Object.assign(p, auto(0, dur))
  const bag = s.beginBag()
  const voice = def.start(s, out, 0, p)
  s.endBag()
  out.gain.setValueAtTime(1, Math.max(0, dur - 0.08))
  out.gain.linearRampToValueAtTime(0, dur - 0.01)
  const step = 0.05
  if (typeof ctx.suspend === 'function') {
    voice.tick?.(0, 0.12)
    for (let ts = step; ts < dur - 0.02; ts += step) {
      const at = Math.round(ts * 1000) / 1000
      ctx.suspend(at).then(() => {
        if (auto) {
          const np = auto(at, dur)
          for (const k in np) {
            p[k] = np[k]
            voice.set(k, np[k], at)
          }
        }
        voice.tick?.(at, at + 0.12)
        void ctx.resume()
      })
    }
  } else voice.tick?.(0, dur)
  stopAll(bag, dur)
  const setupMs = performance.now() - t0
  const t1 = performance.now()
  const buffer = await ctx.startRendering()
  return { buffer, wallMs: performance.now() - t1, setupMs, nodes: s.nodes, dur }
}

export interface SoundStats {
  peak: number
  peakDb: number
  /** Loudest 50 ms window RMS (dBFS). */
  rmsDb: number
  /** Seconds until the signal finally drops below -60 dBFS. */
  dur: number
  nan: boolean
  clipped: boolean
  /** Spectral centroid (Hz) of the whole sound. */
  centroid: number
}

export function analyze(buf: AudioBuffer): SoundStats {
  const n = buf.length
  const sr = buf.sampleRate
  const chans: Float32Array[] = []
  for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c))
  let peak = 0
  let nan = false
  let last = 0
  const win = Math.round(sr * 0.05)
  let maxRms = 0
  let acc = 0
  let cnt = 0
  for (let i = 0; i < n; i++) {
    let v = 0
    for (const ch of chans) {
      const x = ch[i]
      if (x !== x) nan = true
      const a = Math.abs(x)
      if (a > v) v = a
    }
    if (v > peak) peak = v
    if (v > 0.001) last = i
    acc += v * v
    if (++cnt === win) {
      maxRms = Math.max(maxRms, Math.sqrt(acc / win))
      acc = 0
      cnt = 0
    }
  }
  if (cnt) maxRms = Math.max(maxRms, Math.sqrt(acc / cnt))
  const spec = spectrogram(buf, 64, 48)
  return {
    peak,
    peakDb: 20 * Math.log10(peak || 1e-9),
    rmsDb: 20 * Math.log10(maxRms || 1e-9),
    dur: last / sr,
    nan,
    clipped: peak >= 1,
    centroid: spec.centroid,
  }
}

export interface Spectrogram {
  cols: number
  bins: number
  /** cols*bins, column-major, 0..1 (dB mapped from -96..-6). bin 0 = lowest frequency. */
  data: Float32Array
  /** Peak level per column, 0..1 on the same dB scale. */
  env: Float32Array
  centroid: number
  fmin: number
  fmax: number
}

/** Log-frequency spectrogram for thumbnails (Hann FFT; window shrinks for short sounds). */
export function spectrogram(buf: AudioBuffer, cols: number, bins: number): Spectrogram {
  const secs = buf.length / buf.sampleRate
  const N = secs < 0.15 ? 256 : secs < 0.6 ? 512 : 1024
  const sr = buf.sampleRate
  const x = buf.getChannelData(0)
  const y = buf.numberOfChannels > 1 ? buf.getChannelData(1) : x
  const n = buf.length
  const fmin = 50
  const fmax = Math.min(18000, sr / 2)
  const data = new Float32Array(cols * bins)
  const env = new Float32Array(cols)
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  const hann = new Float64Array(N)
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  // band edges in FFT bins
  const edges: number[] = []
  for (let b = 0; b <= bins; b++) edges.push(((fmin * Math.pow(fmax / fmin, b / bins)) / sr) * N)
  let cNum = 0
  let cDen = 0
  const toU = (db: number): number => Math.max(0, Math.min(1, (db + 96) / 90))
  for (let c = 0; c < cols; c++) {
    const center = Math.floor(((c + 0.5) / cols) * n)
    let pk = 0
    for (let i = 0; i < N; i++) {
      const j = center - N / 2 + i
      const v = j >= 0 && j < n ? (x[j] + y[j]) * 0.5 : 0
      if (Math.abs(v) > pk) pk = Math.abs(v)
      re[i] = v * hann[i]
      im[i] = 0
    }
    // peak over the whole column span (not just the window)
    const s0 = Math.floor((c / cols) * n)
    const s1 = Math.floor(((c + 1) / cols) * n)
    for (let j = s0; j < s1; j += 4) {
      const a = Math.abs(x[j])
      if (a > pk) pk = a
    }
    env[c] = toU(20 * Math.log10(pk || 1e-9))
    fft(re, im)
    for (let b = 0; b < bins; b++) {
      const lo = Math.max(1, Math.floor(edges[b]))
      const hi = Math.max(lo + 1, Math.ceil(edges[b + 1]))
      let m = 0
      for (let k = lo; k < hi && k < N / 2; k++) {
        const mag = Math.hypot(re[k], im[k])
        if (mag > m) m = mag
      }
      // Hann coherent gain 0.5, one-sided ×2 → amplitude ≈ mag / (N/4)
      data[c * bins + b] = toU(20 * Math.log10(m / (N / 4) + 1e-9))
    }
    for (let k = 1; k < N / 2; k++) {
      const mag = Math.hypot(re[k], im[k])
      cNum += ((k * sr) / N) * mag
      cDen += mag
    }
  }
  return { cols, bins, data, env, centroid: cDen ? cNum / cDen : 0, fmin, fmax }
}

/** In-place iterative radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let j = 0; j < len / 2; j++) {
        const a = i + j
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

// ---------------- scenes & benchmark ----------------

export interface Scene {
  name: string
  loops: Array<{ id: string; params?: Params }>
  events?: Array<{ id: string; every: [number, number]; params?: Params }>
}

/**
 * Reference load: `voices` looping noise sources → static bandpass → gain, through a compressor.
 * Scene costs are reported relative to this ("filtered-noise voice equivalents") so numbers stay
 * comparable across machines and across a noisy, shared test box.
 */
export async function benchReference(dur = 10, voices = 20, sampleRate = 44100, reps = 1): Promise<number> {
  let best = Infinity
  for (let r = 0; r < reps; r++) best = Math.min(best, await refOnce(dur, voices, sampleRate))
  return best
}
async function refOnce(dur: number, voices: number, sampleRate: number): Promise<number> {
  const C = OAC()
  const ctx = new C(2, Math.ceil(dur * sampleRate), sampleRate)
  const s = new Synth(ctx, { seed: 1 })
  const comp = ctx.createDynamicsCompressor()
  comp.connect(ctx.destination)
  const out = s.gain(0.05, comp)
  for (let i = 0; i < voices; i++) s.noise('white', 0, dur, s.filter('bandpass', 500 + i * 100, 1, s.gain(0.5, out)))
  const t1 = performance.now()
  await ctx.startRendering()
  return performance.now() - t1
}

export interface BenchResult {
  name: string
  audioSec: number
  wallMs: number
  /** Audio seconds rendered per wall second. >1 = faster than real time. */
  rtf: number
  /** Approximate share of one CPU core at real time (1 / rtf). */
  coreShare: number
  nodes: number
  setupMs: number
}

/**
 * Render a whole scene offline (loops + randomly timed one-shots, through a compressor like the
 * live chain) and time it. jit (default) schedules in 100 ms steps via suspend(), like the live
 * heartbeat, so the time includes the JS scheduling cost; jit=false pre-schedules everything
 * (inflates cost for event-heavy scenes: every future node sits in the graph from t=0).
 * On a shared/noisy machine use reps >= 3: the minimum wall time is reported.
 */
export async function benchScene(lookup: (id: string) => SoundDef | undefined, scene: Scene, dur = 10, o: { sampleRate?: number; quality?: 0 | 1; reps?: number; jit?: boolean } = {}): Promise<BenchResult> {
  let best: BenchResult | null = null
  for (let r = 0; r < (o.reps ?? 1); r++) {
    const res = await benchOnce(lookup, scene, dur, o)
    if (!best || res.wallMs < best.wallMs) best = res
  }
  return best!
}
async function benchOnce(lookup: (id: string) => SoundDef | undefined, scene: Scene, dur: number, o: { sampleRate?: number; quality?: 0 | 1; jit?: boolean }): Promise<BenchResult> {
  const sr = o.sampleRate ?? 44100
  const C = OAC()
  const ctx = new C(2, Math.ceil(dur * sr), sr)
  const s = new Synth(ctx, { quality: o.quality ?? 1, seed: 99 })
  const jit = o.jit ?? true
  const t0 = performance.now()
  const comp = ctx.createDynamicsCompressor()
  comp.connect(ctx.destination)
  const out = s.gain(0.7, comp)
  const voices: LoopVoice[] = []
  for (const l of scene.loops) {
    const def = lookup(l.id)
    if (!def || def.kind !== 'loop') continue
    const p = mergeParams(def, l.params ?? {})
    p.k = 1
    const bag = s.beginBag()
    const v = def.start(s, out, 0, p)
    s.endBag()
    voices.push(v)
    if (!jit) v.tick?.(0, dur)
    stopAll(bag, dur)
  }
  const evs = (scene.events ?? [])
    .map((e) => ({ e, def: lookup(e.id), next: s.r(0, e.every[1]) }))
    .filter((x): x is { e: typeof x.e; def: OneShotDef; next: number } => !!x.def && x.def.kind === 'oneshot')
  const live: Array<{ g: GainNode; end: number }> = []
  // Mirror the live engine: schedule ~120 ms ahead, wrap each one-shot in a voice gain and
  // disconnect it once silent, so only nodes that are actually sounding sit in the graph.
  const step = (t: number, until: number): void => {
    for (const v of voices) v.tick?.(t, until + 0.05)
    for (const x of evs) {
      while (x.next < until) {
        if (x.next < dur - 0.5) {
          const p = mergeParams(x.def, x.e.params ?? {})
          p.k = s.r(0.97, 1.03)
          const g = s.gain(1, out)
          live.push({ g, end: x.def.play(s, g, Math.max(t, x.next), p) })
        }
        x.next += s.r(x.e.every[0], x.e.every[1])
      }
    }
    for (let i = live.length - 1; i >= 0; i--) {
      if (live[i].end + 0.05 < t) {
        live[i].g.disconnect()
        live.splice(i, 1)
      }
    }
  }
  const STEP = 0.1
  if (jit && typeof ctx.suspend === 'function') {
    step(0, STEP)
    for (let ts = STEP; ts < dur - 0.02; ts += STEP) {
      const at = Math.round(ts * 1000) / 1000
      ctx.suspend(at).then(() => {
        step(at, at + STEP)
        void ctx.resume()
      })
    }
  } else step(0, dur)
  const setupMs = performance.now() - t0
  const t1 = performance.now()
  await ctx.startRendering()
  const wallMs = performance.now() - t1
  const rtf = dur / (wallMs / 1000)
  return { name: scene.name, audioSec: dur, wallMs, rtf, coreShare: 1 / rtf, nodes: s.nodes, setupMs }
}
