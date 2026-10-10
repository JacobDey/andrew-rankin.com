// Synth: tiny helpers over a BaseAudioContext (works with AudioContext and OfflineAudioContext).
// Shared noise buffers, node factories that count what they create, envelopes, and the
// GrainStream (hundreds of grains per second on ONE gain node via curve automation).

export type NoiseColor = 'white' | 'pink' | 'brown'

const NOISE_SECONDS = 3
/** AudioBuffers are context-independent (spec), so one set per sample rate is shared. */
const noiseCache = new Map<string, AudioBuffer>()

/** Small fast seeded PRNG (deterministic offline renders). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  const sr = ctx.sampleRate
  const n = Math.round(sr * NOISE_SECONDS)
  const L = Math.round(sr * 0.05)
  const g = new Float32Array(n + L)
  const r = mulberry32(color === 'white' ? 11 : color === 'pink' ? 23 : 37)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0
  for (let i = 0; i < g.length; i++) {
    const w = r() * 2 - 1
    if (color === 'white') g[i] = w
    else if (color === 'pink') {
      // Paul Kellet's refined pink filter
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      g[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
      b6 = w * 0.115926
    } else {
      last = (last + 0.02 * w) / 1.02
      g[i] = last
    }
  }
  // remove DC
  let mean = 0
  for (let i = 0; i < g.length; i++) mean += g[i]
  mean /= g.length
  for (let i = 0; i < g.length; i++) g[i] -= mean
  // seamless loop: equal-power crossfade of the head with the overflow past n
  const d = new Float32Array(n)
  d.set(g.subarray(0, n))
  for (let i = 0; i < L; i++) {
    const a = i / L
    d[i] = g[i] * Math.sqrt(a) + g[n + i] * Math.sqrt(1 - a)
  }
  // normalise to RMS 0.5 (close to full-scale uniform white, 0.577) so gains match across colours
  let ss = 0
  for (let i = 0; i < n; i++) ss += d[i] * d[i]
  const k = 0.5 / Math.sqrt(ss / n)
  for (let i = 0; i < n; i++) d[i] *= k
  const buf = ctx.createBuffer(1, n, sr)
  buf.copyToChannel(d, 0)
  return buf
}

export interface BurstOpts {
  t: number
  out: AudioNode
  color?: NoiseColor
  /** Filter type, or null for raw noise. Default bandpass. */
  type?: BiquadFilterType | null
  f?: number
  /** Sweep the filter to f2 by the end of the burst. */
  f2?: number
  sweep?: 'exp' | 'lin'
  q?: number
  gain: number
  attack?: number
  hold?: number
  decay: number
  rate?: number
}

export interface ToneOpts {
  t: number
  out: AudioNode
  type?: OscillatorType
  f: number
  /** Glide to f2 over `glide` seconds (default: attack + hold + decay). */
  f2?: number
  glide?: number
  sweep?: 'exp' | 'lin'
  gain: number
  attack?: number
  hold?: number
  decay: number
}

export interface ModalOpts {
  t: number
  out: AudioNode
  f: number
  ratios: number[]
  gains: number[]
  decays: number[]
  attack?: number
  /** Multiplies every gain. */
  amp?: number
}

export type GrainShapeFn = (w: Float32Array, i0: number, amp: number) => void

export interface GrainStreamOpts {
  /** Chunk length scheduled per curve (s). */
  chunk?: number
  /** Curve resolution (s). 0.5ms gives crisp clicks. */
  res?: number
  /** Longest grain tail carried into the next chunk (s). */
  tail?: number
}

export class Synth {
  readonly ctx: BaseAudioContext
  /** 0 = low (drop secondary layers, fewer grains), 1 = high. */
  quality: 0 | 1
  /** Count of nodes created (for budgeting). */
  nodes = 0
  rand: () => number
  private bag: AudioScheduledSourceNode[] | null = null

  constructor(ctx: BaseAudioContext, opts: { quality?: 0 | 1; seed?: number } = {}) {
    this.ctx = ctx
    this.quality = opts.quality ?? 1
    this.rand = opts.seed !== undefined ? mulberry32(opts.seed) : Math.random
  }

  noiseBuffer(color: NoiseColor): AudioBuffer {
    const key = `${color}@${this.ctx.sampleRate}`
    let b = noiseCache.get(key)
    if (!b) {
      b = makeNoise(this.ctx, color)
      noiseCache.set(key, b)
    }
    return b
  }

  // ---------- random helpers ----------
  r(a = 0, b = 1): number {
    return a + (b - a) * this.rand()
  }
  /** x scaled by up to ±frac. */
  jit(x: number, frac: number): number {
    return x * (1 + (this.rand() * 2 - 1) * frac)
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rand() * arr.length) % arr.length]
  }
  chance(p: number): boolean {
    return this.rand() < p
  }

  // ---------- source tracking (for loops) ----------
  /** Start collecting every source created until endBag(). */
  beginBag(): AudioScheduledSourceNode[] {
    this.bag = []
    return this.bag
  }
  endBag(): void {
    this.bag = null
  }
  private track<T extends AudioScheduledSourceNode>(n: T): T {
    if (this.bag) this.bag.push(n)
    return n
  }

  // ---------- node factories ----------
  gain(v = 0, out?: AudioNode | null): GainNode {
    this.nodes++
    const g = this.ctx.createGain()
    g.gain.value = v
    if (out) g.connect(out)
    return g
  }
  filter(type: BiquadFilterType, f: number, q = 0.707, out?: AudioNode | null): BiquadFilterNode {
    this.nodes++
    const b = this.ctx.createBiquadFilter()
    b.type = type
    b.frequency.value = clampF(f, this.ctx.sampleRate)
    b.Q.value = q
    kRate(b)
    if (out) b.connect(out)
    return b
  }
  panner(p: number, out?: AudioNode | null): StereoPannerNode {
    this.nodes++
    const n = this.ctx.createStereoPanner()
    n.pan.value = Math.max(-1, Math.min(1, p))
    try {
      n.pan.automationRate = 'k-rate' // per-sample equal-power gains are costly while automated
    } catch {
      /* ignore */
    }
    if (out) n.connect(out)
    return n
  }
  /** Started oscillator. */
  osc(type: OscillatorType, f: number, t: number, end: number | null, out?: AudioNode | AudioParam | null): OscillatorNode {
    this.nodes++
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = f
    if (out instanceof AudioParam) o.connect(out)
    else if (out) o.connect(out)
    o.start(t)
    if (end !== null) o.stop(end)
    return this.track(o)
  }
  /** Started looping noise source at a random offset. */
  noise(color: NoiseColor, t: number, end: number | null, out?: AudioNode | null, rate = 1): AudioBufferSourceNode {
    this.nodes++
    const s = this.ctx.createBufferSource()
    s.buffer = this.noiseBuffer(color)
    s.loop = true
    if (rate !== 1) s.playbackRate.value = rate
    if (out) s.connect(out)
    s.start(t, this.rand() * (NOISE_SECONDS - 0.1))
    if (end !== null) s.stop(end)
    return this.track(s)
  }
  /** Started buffer source (not looping). */
  play(buffer: AudioBuffer, t: number, out: AudioNode, rate = 1): AudioBufferSourceNode {
    this.nodes++
    const s = this.ctx.createBufferSource()
    s.buffer = buffer
    s.playbackRate.value = rate
    s.connect(out)
    s.start(t)
    return this.track(s)
  }
  /** Build a mono buffer from JS. */
  buffer(seconds: number, fill: (d: Float32Array, sr: number) => void): AudioBuffer {
    const sr = this.ctx.sampleRate
    const b = this.ctx.createBuffer(1, Math.max(1, Math.round(seconds * sr)), sr)
    const d = new Float32Array(b.length)
    fill(d, sr)
    b.copyToChannel(d, 0)
    return b
  }

  // ---------- envelopes ----------
  /** Silence at t, linear attack to peak, exponential decay to -80 dB over `decay`. Returns end time. */
  perc(p: AudioParam, t: number, peak: number, attack: number, decay: number): number {
    const a = Math.max(0.0002, attack)
    const end = t + a + Math.max(0.001, decay)
    p.setValueAtTime(0, t)
    p.linearRampToValueAtTime(peak, t + a)
    p.exponentialRampToValueAtTime(Math.max(peak * 1e-4, 1e-7), end)
    p.setValueAtTime(0, end + 0.0005)
    return end + 0.0005
  }
  /** Attack (linear), hold, release (exponential to -80 dB). */
  ahr(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): number {
    const a = Math.max(0.0002, attack)
    p.setValueAtTime(0, t)
    p.linearRampToValueAtTime(peak, t + a)
    if (hold > 0) p.setValueAtTime(peak, t + a + hold)
    const end = t + a + hold + Math.max(0.001, release)
    p.exponentialRampToValueAtTime(Math.max(peak * 1e-4, 1e-7), end)
    p.setValueAtTime(0, end + 0.0005)
    return end + 0.0005
  }
  /** Piecewise-linear envelope: points are [offset seconds, value]. */
  shape(p: AudioParam, t: number, pts: ReadonlyArray<readonly [number, number]>): number {
    p.setValueAtTime(pts[0][1], t + pts[0][0])
    for (let i = 1; i < pts.length; i++) p.linearRampToValueAtTime(pts[i][1], t + pts[i][0])
    return t + pts[pts.length - 1][0]
  }

  // ---------- composites ----------
  /** Filtered noise burst. Returns end time. */
  burst(o: BurstOpts): number {
    if (o.t < 0) o = { ...o, t: 0 }
    const attack = o.attack ?? 0.0005
    const hold = o.hold ?? 0
    const g = this.gain(0, o.out)
    const end = this.ahr(g.gain, o.t, o.gain, attack, hold, o.decay)
    let input: AudioNode = g
    if (o.type !== null) {
      const f = this.filter(o.type ?? 'bandpass', o.f ?? 1000, o.q ?? 1, g)
      if (o.f2 !== undefined) {
        f.frequency.setValueAtTime(clampF(o.f ?? 1000, this.ctx.sampleRate), o.t)
        if (o.sweep === 'lin') f.frequency.linearRampToValueAtTime(clampF(o.f2, this.ctx.sampleRate), end)
        else f.frequency.exponentialRampToValueAtTime(clampF(o.f2, this.ctx.sampleRate), end)
      }
      input = f
    }
    this.noise(o.color ?? 'white', o.t, end + 0.005, input, o.rate ?? 1)
    return end
  }
  /** Oscillator with optional pitch glide and AHR envelope. Returns end time. */
  tone(o: ToneOpts): number {
    if (o.t < 0) o = { ...o, t: 0 }
    const attack = o.attack ?? 0.001
    const hold = o.hold ?? 0
    const g = this.gain(0, o.out)
    const end = this.ahr(g.gain, o.t, o.gain, attack, hold, o.decay)
    const osc = this.osc(o.type ?? 'sine', o.f, o.t, end + 0.005, g)
    if (o.f2 !== undefined) {
      const ge = o.t + (o.glide ?? attack + hold + o.decay)
      osc.frequency.setValueAtTime(o.f, o.t)
      if (o.sweep === 'lin') osc.frequency.linearRampToValueAtTime(o.f2, ge)
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), ge)
    }
    return end
  }
  /** Sum of decaying sine partials (bells, glass, metal). Returns end time. */
  modal(o: ModalOpts): number {
    if (o.t < 0) o = { ...o, t: 0 }
    const amp = o.amp ?? 1
    const nyq = this.ctx.sampleRate * 0.45
    let end = o.t
    const n = this.quality === 0 ? Math.min(3, o.ratios.length) : o.ratios.length
    for (let i = 0; i < n; i++) {
      const f = o.f * o.ratios[i]
      if (f > nyq) continue
      end = Math.max(end, this.tone({ t: o.t, out: o.out, f, gain: o.gains[i] * amp, attack: o.attack ?? 0.0008, decay: o.decays[i] }))
    }
    return end
  }

  /** A gated stream: source → gate (curve-automated grains) → out. See GrainStream. */
  stream(input: AudioNode | null, out: AudioNode, o?: GrainStreamOpts): GrainStream {
    return new GrainStream(this, input, out, o)
  }

  /**
   * One-shot gate: build the whole envelope in JS (`write` fills w at `res` seconds per point)
   * and apply it with ONE setValueCurveAtTime. Ideal for one-shot textures (print heads, peels).
   */
  gate(input: AudioNode | null, out: AudioNode, t: number, dur: number, write: (w: Float32Array, res: number) => void, res = 0.0005): GainNode {
    const g = this.gain(0, out)
    if (input) input.connect(g)
    const n = Math.max(2, Math.round(dur / res) + 1)
    const w = new Float32Array(n)
    write(w, res)
    w[n - 1] = 0
    g.gain.setValueCurveAtTime(w, t, (n - 1) * res)
    return g
  }
}

/**
 * GrainStream: Poisson/regular grains rendered into a gain curve, scheduled chunk by chunk with
 * setValueCurveAtTime. Hundreds of clicks per second cost ONE gain node (plus whatever source
 * feeds it), instead of 2+ nodes per grain. Feed it noise for crackle, an oscillator for chirps.
 */
export class GrainStream {
  /** Grains per second (0 = silent). */
  rate = 0
  /** Mean grain peak. */
  amp = 0.5
  /** 0 = every grain at `amp`; 1 = exponential distribution (many small, few big). */
  ampVar = 0.7
  attack = 0.0004
  /** Time to -60 dB. */
  decay = 0.004
  /** 0 = Poisson timing, 1 = metronomic. */
  regular = 0
  /** Timing jitter when regular (fraction of the period). */
  jitter = 0.1
  /** Custom grain writer (overrides attack/decay). */
  shape: GrainShapeFn | null = null
  readonly gate: GainNode
  readonly res: number
  private readonly N: number
  private readonly w: Float32Array
  private readonly curve: Float32Array
  private until = 0
  private nextAt = -1
  private lastValue = 0
  private readonly s: Synth

  constructor(s: Synth, input: AudioNode | null, out: AudioNode, o: GrainStreamOpts = {}) {
    this.s = s
    this.res = o.res ?? 0.0005
    this.N = Math.max(8, Math.round((o.chunk ?? 0.04) / this.res))
    const tail = Math.round((o.tail ?? 0.25) / this.res)
    this.w = new Float32Array(this.N + tail)
    this.curve = new Float32Array(this.N)
    this.gate = s.gain(0, out)
    if (input) input.connect(this.gate)
  }

  /** Schedule grains up to time `to` (call from LoopVoice.tick, or once for a one-shot). */
  fill(from: number, to: number): void {
    if (this.until < from) this.until = from
    // Browsers clamp an automation start in the past to currentTime, which would make this chunk
    // overlap the next one (NotSupportedError). The previous chunk has already ended if we're late.
    const now = this.s.ctx.currentTime
    if (now > 0 && this.until < now + 0.003) this.until = now + 0.003
    const span = this.N * this.res
    while (this.until < to) {
      this.renderChunk(this.until)
      this.until += span
    }
  }

  /** Seconds to the next grain: Poisson blended with metronomic by `regular`. */
  private interval(): number {
    const mean = 1 / this.rate
    const u = this.s.rand()
    const poisson = -Math.log(1 - u * 0.999999) * mean
    const reg = mean * (1 + (this.s.rand() * 2 - 1) * this.jitter)
    return Math.max(this.res, reg * this.regular + poisson * (1 - this.regular))
  }

  private renderChunk(t0: number): void {
    const { N, res, w, curve } = this
    const span = N * res
    if (this.rate > 0) {
      if (this.nextAt < t0) this.nextAt = t0 + this.interval() * (this.nextAt < 0 ? this.s.rand() : 0.5)
      let guard = 0
      while (this.nextAt < t0 + span && guard++ < 4000) {
        const i0 = (this.nextAt - t0) / res
        const u = this.s.rand()
        const a = this.amp * Math.min(4, 1 - this.ampVar + this.ampVar * -Math.log(1 - u * 0.999999))
        if (this.shape) this.shape(w, i0, a)
        else this.grain(w, i0, a)
        this.nextAt += this.interval()
      }
    } else this.nextAt = -1
    let any = false
    for (let i = 0; i < N; i++) {
      const v = w[i]
      curve[i] = v
      if (v !== 0) any = true
    }
    w.copyWithin(0, N)
    w.fill(0, w.length - N)
    if (any || this.lastValue !== 0) {
      // the copy is made by the API, so the scratch curve is reused
      this.gate.gain.setValueCurveAtTime(curve, t0, (N - 1) * res)
      this.lastValue = curve[N - 1]
    }
  }

  /** Default grain: linear attack, exponential decay. */
  grain(w: Float32Array, i0: number, a: number): void {
    writeGrain(w, i0, a, this.attack, this.decay, this.res)
  }
}

// ---------- small free helpers ----------

/** Add one click grain (linear attack, exponential decay to -60 dB in `decay`) into a curve buffer. */
export function writeGrain(w: Float32Array, i0: number, a: number, attack: number, decay: number, res: number): void {
  const ia = Math.max(1, Math.round(attack / res))
  const k = Math.exp((-res * 6.9) / Math.max(res, decay))
  let i = Math.floor(i0)
  if (i < 0) i = 0
  const end = w.length
  for (let j = 1; j <= ia && i < end; j++, i++) w[i] += (a * j) / ia
  let v = a * k
  while (i < end && v > a * 1e-3) {
    w[i] += v
    v *= k
    i++
  }
}

/**
 * Biquad params at k-rate: coefficients are recomputed once per 128-frame quantum instead of per
 * sample while automated. Measured in Chrome: a continuously automated a-rate biquad costs ~3-4x a
 * static one; at k-rate it costs the same as static. Inaudible for smooth sweeps.
 */
export function kRate(b: BiquadFilterNode): void {
  try {
    b.frequency.automationRate = 'k-rate'
    b.Q.automationRate = 'k-rate'
  } catch {
    /* older engines: a-rate only */
  }
}

export function clampF(f: number, sr: number): number {
  return Math.max(10, Math.min(sr * 0.49, f))
}

/** Smoothly move a param toward v (tau seconds); tau <= 0 jumps. */
export function to(p: AudioParam, v: number, t: number, tau = 0.05): void {
  if (tau <= 0) p.setValueAtTime(v, t)
  else p.setTargetAtTime(v, t, tau)
}

export function stopAll(nodes: AudioScheduledSourceNode[], t: number): void {
  for (const n of nodes) {
    try {
      n.stop(t)
    } catch {
      /* already stopped */
    }
  }
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const dbToGain = (db: number): number => Math.pow(10, db / 20)
