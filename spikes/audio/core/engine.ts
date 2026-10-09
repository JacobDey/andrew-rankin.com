// AudioEngine: one shared AudioContext, buses, prefs, iOS unlock, voice management,
// and a heartbeat that feeds granular loops. Recipes live in ./sounds/*.
import type {
  AudioInitOptions,
  AudioStats,
  BusName,
  LoopDef,
  LoopHandle,
  LoopVoice,
  OneShotDef,
  Params,
  Quality,
  SoundDef,
  SoundPrefs,
  Voice,
} from './types'
import { Synth, clamp01, dbToGain, kRate, stopAll } from './synth'

const KEY_SOUND = 'ar:sound'
const KEY_VOL = 'ar:volume'
/** How far ahead granular loops are scheduled (s). */
const LOOKAHEAD = 0.12
const HEARTBEAT_MS = 25
/** Scheduling offset for one-shots so attacks are not clipped by the render quantum (s). */
const START_OFFSET = 0.004
const GESTURES = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'] as const

interface ActiveVoice {
  id: string
  out: GainNode
  pan: StereoPannerNode | null
  end: number
  cut: boolean
}

interface Grave {
  nodes: AudioNode[]
  at: number
}

type Suspender = 'none' | 'hidden' | 'mute' | 'user'

function readPrefs(): SoundPrefs {
  let muted = false
  let volume = 0.7
  try {
    if (localStorage.getItem(KEY_SOUND) === 'off') muted = true
    const v = parseFloat(localStorage.getItem(KEY_VOL) ?? '')
    if (Number.isFinite(v)) volume = clamp01(v)
  } catch {
    /* private mode or blocked storage: defaults */
  }
  return { muted, volume }
}

class LoopHandleImpl implements LoopHandle {
  readonly id: string
  readonly def: LoopDef
  params: Params
  voice: LoopVoice | null = null
  out: GainNode | null = null
  bag: AudioScheduledSourceNode[] = []
  vol: number
  fadeIn: number
  stopped = false
  private eng: AudioEngine
  private dirty = new Set<string>()
  private lastApply = 0
  private timer = 0

  constructor(eng: AudioEngine, def: LoopDef, params: Params, vol: number, fadeIn: number) {
    this.eng = eng
    this.def = def
    this.id = def.id
    this.params = params
    this.vol = vol
    this.fadeIn = fadeIn
  }
  get playing(): boolean {
    return !!this.voice && !this.stopped
  }
  set(name: string, value: number): LoopHandle {
    if (!Number.isFinite(value) || this.stopped) return this
    this.params[name] = value
    this.dirty.add(name)
    this.flushSoon()
    return this
  }
  setMany(ps: Params): LoopHandle {
    for (const k in ps) {
      const v = ps[k]
      if (!Number.isFinite(v)) continue
      this.params[k] = v
      this.dirty.add(k)
    }
    this.flushSoon()
    return this
  }
  get(name: string): number | undefined {
    const ctx = this.eng.context
    if (this.voice?.read && ctx) {
      const r = this.voice.read(name, ctx.currentTime)
      if (r !== undefined) return r
    }
    return this.params[name]
  }
  volume(v: number, ramp = 0.1): LoopHandle {
    this.vol = v
    const ctx = this.eng.context
    if (this.out && ctx) this.out.gain.setTargetAtTime(v, ctx.currentTime, Math.max(0.001, ramp / 3))
    return this
  }
  stop(fade = 0.25): void {
    this.eng.stopLoop(this, fade)
  }
  /** Coalesce param updates to <= ~80/s so per-frame `set` calls don't flood the automation timeline. */
  private flushSoon(): void {
    if (!this.voice) return
    const now = performance.now()
    if (now - this.lastApply >= 12) this.flush()
    else if (!this.timer) this.timer = window.setTimeout(() => this.flush(), 12)
  }
  flush(): void {
    this.timer = 0
    const ctx = this.eng.context
    if (!this.voice || !ctx || this.stopped) return
    const t = ctx.currentTime
    for (const n of this.dirty) this.voice.set(n, this.params[n], t)
    this.dirty.clear()
    this.lastApply = performance.now()
  }
}

/** A no-op handle for unknown ids, so game code never has to null-check. */
class DeadHandle implements LoopHandle {
  readonly playing = false
  readonly stopped = true
  constructor(readonly id: string) {}
  set(): LoopHandle {
    return this
  }
  setMany(): LoopHandle {
    return this
  }
  get(): number | undefined {
    return undefined
  }
  volume(): LoopHandle {
    return this
  }
  stop(): void {}
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private synth: Synth | null = null
  private master: GainNode | null = null
  private comp: DynamicsCompressorNode | null = null
  private buses: Record<BusName, GainNode> | null = null
  private busBase: Record<BusName, number> = { ui: 0.55, sfx: 1, amb: 1 }
  private world: GainNode | null = null
  private muffle: BiquadFilterNode | null = null
  private send: GainNode | null = null
  private convolver: ConvolverNode | null = null
  private room: { rt60: number; wet: number } | null = null
  private analyserNode: AnalyserNode | null = null
  private defs = new Map<string, SoundDef>()
  private voices: ActiveVoice[] = []
  private graves: Grave[] = []
  private lastPlay = new Map<string, number>()
  private loops = new Set<LoopHandleImpl>()
  private timer = 0
  private prefs: SoundPrefs
  private listeners = new Set<(p: SoundPrefs) => void>()
  private readyListeners = new Set<() => void>()
  private armed = false
  private suspender: Suspender = 'none'
  private muteTimer = 0
  private warned = new Set<string>()
  private opts: Required<Omit<AudioInitOptions, 'latencyHint'>> & { latencyHint: AudioContextLatencyCategory | number } = {
    quality: 'auto',
    session: 'ambient',
    latencyHint: 'interactive',
    suspendWhenHidden: true,
  }
  quality: Quality = 'high'
  private counters = { plays: 0, dropped: 0, playMs: 0, ticks: 0, tickMs: 0 }

  constructor() {
    this.prefs = typeof localStorage !== 'undefined' ? readPrefs() : { muted: false, volume: 0.7 }
  }

  // ---------------- registry ----------------
  register(defs: SoundDef | readonly SoundDef[]): this {
    for (const d of Array.isArray(defs) ? defs : [defs]) this.defs.set(d.id, d)
    return this
  }
  def(id: string): SoundDef | undefined {
    return this.defs.get(id)
  }
  list(): SoundDef[] {
    return [...this.defs.values()]
  }

  // ---------------- lifecycle ----------------
  get context(): AudioContext | null {
    return this.ctx
  }
  /** True once the context is running (a gesture has unlocked it). */
  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running'
  }
  now(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  /** Set options before the context exists (quality, iOS session, latency). */
  configure(opts: AudioInitOptions): this {
    Object.assign(this.opts, opts)
    return this
  }

  /**
   * Attach first-gesture listeners that call init(). Safe to call at startup and repeatedly.
   * Also wires visibility (suspend when hidden) and cross-tab pref sync.
   */
  arm(opts?: AudioInitOptions): this {
    if (opts) this.configure(opts)
    if (typeof window === 'undefined') return this
    if (!this.armed) {
      this.armed = true
      for (const ev of GESTURES) window.addEventListener(ev, this.onGesture, { capture: true, passive: true })
    }
    if (!this.wired) {
      this.wired = true
      document.addEventListener('visibilitychange', this.onVisibility)
      window.addEventListener('storage', this.onStorage)
      window.addEventListener('pageshow', this.onVisibility)
    }
    return this
  }
  private wired = false
  private disarm(): void {
    if (!this.armed) return
    this.armed = false
    for (const ev of GESTURES) window.removeEventListener(ev, this.onGesture, { capture: true })
  }
  private onGesture = (): void => {
    void this.init()
  }

  /**
   * Create (first call) and resume the AudioContext. Call it from inside a user gesture handler
   * (or let arm() do it). Resolves true when running. Idempotent.
   */
  init(opts?: AudioInitOptions): Promise<boolean> {
    if (opts) this.configure(opts)
    if (!this.ctx) this.create()
    const ctx = this.ctx
    if (!ctx) return Promise.resolve(false)
    if (this.suspender === 'mute' && this.prefs.muted) return Promise.resolve(false)
    this.kick(ctx)
    if (ctx.state === 'running') {
      this.onRunning()
      return Promise.resolve(true)
    }
    this.resuming = true
    return ctx.resume().then(
      () => {
        this.resuming = false
        if (ctx.state === 'running') this.onRunning()
        return ctx.state === 'running'
      },
      () => {
        this.resuming = false
        return false
      },
    )
  }
  /** True while a gesture-initiated resume() is in flight: sounds played now start when it lands. */
  private resuming = false

  private create(): void {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const AC = w.AudioContext ?? w.webkitAudioContext
    if (!AC) return
    let ctx: AudioContext
    try {
      ctx = new AC({ latencyHint: this.opts.latencyHint })
    } catch {
      ctx = new AC()
    }
    // iOS 16.4+: choose whether the ring/silent switch mutes us.
    const nav = navigator as unknown as { audioSession?: { type: string } }
    if (nav.audioSession) {
      try {
        nav.audioSession.type = this.opts.session
      } catch {
        /* ignore */
      }
    }
    this.quality =
      this.opts.quality === 'auto' ? ((navigator.hardwareConcurrency ?? 8) <= 4 ? 'low' : 'high') : this.opts.quality
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 12
    comp.ratio.value = 4
    comp.attack.value = 0.003
    comp.release.value = 0.15
    comp.connect(ctx.destination)
    const master = ctx.createGain()
    master.gain.value = this.prefs.muted ? 0 : this.prefs.volume
    master.connect(comp)
    const ui = ctx.createGain()
    ui.gain.value = this.busBase.ui
    ui.connect(master)
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = Math.min(20000, ctx.sampleRate * 0.45)
    muffle.Q.value = 0.5
    kRate(muffle)
    muffle.connect(master)
    const world = ctx.createGain()
    world.connect(muffle)
    const sfx = ctx.createGain()
    sfx.connect(world)
    const amb = ctx.createGain()
    amb.connect(world)
    this.ctx = ctx
    this.comp = comp
    this.master = master
    this.muffle = muffle
    this.world = world
    this.buses = { ui, sfx, amb }
    this.synth = new Synth(ctx, { quality: this.quality === 'low' ? 0 : 1 })
    // Noise buffers at the device rate cost ~2-5 ms each to build: do it right after the gesture
    // instead of inside the first play() (which would hitch the first sound).
    const synth = this.synth
    window.setTimeout(() => {
      for (const c of ['white', 'pink', 'brown'] as const) synth.noiseBuffer(c)
    }, 0)
    ctx.onstatechange = () => this.onState()
    if (this.room) this.setRoom(this.room)
  }

  /** Old iOS needs a buffer played inside the gesture to unlock output. */
  private kick(ctx: AudioContext): void {
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate)
      const s = ctx.createBufferSource()
      s.buffer = b
      s.connect(ctx.destination)
      s.start(0)
    } catch {
      /* ignore */
    }
  }

  private onRunning(): void {
    if (this.suspender !== 'mute') this.suspender = 'none'
    this.disarm()
    for (const h of this.loops) if (!h.voice && !h.stopped) this.startLoop(h)
    this.ensureHeartbeat()
    for (const cb of this.readyListeners) cb()
  }

  private onState(): void {
    const ctx = this.ctx
    if (!ctx) return
    const st = ctx.state as string
    if (st === 'running') this.onRunning()
    else if (st === 'interrupted' || (st === 'suspended' && this.suspender === 'none')) {
      // iOS interruption (call, Siri, other app) or the OS suspended us: next gesture resumes.
      this.arm()
    }
  }

  private onVisibility = (): void => {
    const ctx = this.ctx
    if (!ctx || !this.opts.suspendWhenHidden) return
    if (document.visibilityState === 'hidden') {
      if (ctx.state === 'running') {
        this.suspender = 'hidden'
        void ctx.suspend()
      }
    } else if (this.suspender === 'hidden' || (ctx.state as string) === 'interrupted') {
      this.suspender = 'none'
      if (this.prefs.muted) {
        this.suspender = 'mute'
        return
      }
      ctx.resume().then(
        () => {
          if (ctx.state !== 'running') this.arm()
        },
        () => this.arm(),
      )
    }
  }

  private onStorage = (e: StorageEvent): void => {
    if (e.key !== KEY_SOUND && e.key !== KEY_VOL) return
    this.prefs = readPrefs()
    this.applyPrefs()
    this.emit()
  }

  /** Called when the context is running for the first time (and after each resume). */
  onReady(cb: () => void): () => void {
    this.readyListeners.add(cb)
    if (this.ready) cb()
    return () => this.readyListeners.delete(cb)
  }

  // ---------------- prefs ----------------
  get muted(): boolean {
    return this.prefs.muted
  }
  get volume(): number {
    return this.prefs.volume
  }
  setMuted(m: boolean): void {
    if (m === this.prefs.muted) return
    this.prefs.muted = m
    this.save()
    this.applyPrefs()
    this.emit()
  }
  setVolume(v: number): void {
    v = clamp01(v)
    if (v === this.prefs.volume) return
    this.prefs.volume = v
    this.save()
    this.applyPrefs()
    this.emit()
  }
  /** Subscribe to mute/volume changes (including from other tabs). Returns an unsubscribe fn. */
  onChange(cb: (p: SoundPrefs) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  private save(): void {
    try {
      localStorage.setItem(KEY_SOUND, this.prefs.muted ? 'off' : 'on')
      localStorage.setItem(KEY_VOL, String(Math.round(this.prefs.volume * 1000) / 1000))
    } catch {
      /* ignore */
    }
  }
  private emit(): void {
    const p = { ...this.prefs }
    for (const cb of this.listeners) cb(p)
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ar:soundchange', { detail: p }))
  }
  private applyPrefs(): void {
    const ctx = this.ctx
    const m = this.master
    if (!ctx || !m) return
    const now = ctx.currentTime
    const target = this.prefs.muted ? 0 : this.prefs.volume
    m.gain.cancelScheduledValues(now)
    m.gain.setValueAtTime(m.gain.value, now)
    m.gain.linearRampToValueAtTime(target, now + 0.06)
    window.clearTimeout(this.muteTimer)
    if (this.prefs.muted) {
      // After the fade, suspend: zero audio-thread CPU while muted.
      this.muteTimer = window.setTimeout(() => {
        if (this.prefs.muted && ctx.state === 'running') {
          this.suspender = 'mute'
          void ctx.suspend()
        }
      }, 250)
    } else if (this.suspender === 'mute') {
      this.suspender = 'none'
      ctx.resume().then(
        () => {
          if (ctx.state !== 'running') this.arm()
        },
        () => this.arm(),
      )
    }
  }

  // ---------------- buses & global effects ----------------
  bus(name: BusName): GainNode | null {
    return this.buses ? this.buses[name] : null
  }
  /** Art-direction compatibility: { ctx, master, ui } or null before the first gesture. */
  getAudio(): { ctx: AudioContext; master: GainNode; ui: GainNode } | null {
    if (!this.ctx || !this.master || !this.buses) return null
    return { ctx: this.ctx, master: this.master, ui: this.buses.ui }
  }
  /** Low-pass the world buses (sfx+amb), e.g. 600 for "head under the dark cloth". >= 20000 = off. */
  setMuffle(hz: number, ramp = 0.15): void {
    const ctx = this.ctx
    if (!ctx || !this.muffle) return
    const f = Math.max(80, Math.min(hz, ctx.sampleRate * 0.45))
    this.muffle.frequency.setTargetAtTime(f, ctx.currentTime, Math.max(0.001, ramp / 3))
  }
  /** Duck a bus (e.g. radio under a shutter). */
  duck(name: BusName, depthDb = -12, attack = 0.02, hold = 0.4, release = 0.3): void {
    const ctx = this.ctx
    const b = this.bus(name)
    if (!ctx || !b) return
    const base = this.busBase[name]
    const now = ctx.currentTime
    b.gain.cancelScheduledValues(now)
    b.gain.setValueAtTime(b.gain.value, now)
    b.gain.linearRampToValueAtTime(base * dbToGain(depthDb), now + attack)
    b.gain.setValueAtTime(base * dbToGain(depthDb), now + attack + hold)
    b.gain.linearRampToValueAtTime(base, now + attack + hold + release)
  }
  /** A generated small-room reverb on the world buses. null removes it. Skipped on low quality. */
  setRoom(room: { rt60: number; wet: number } | null): void {
    this.room = room
    const ctx = this.ctx
    if (!ctx || !this.world || !this.muffle) return
    if (!room || this.quality === 'low') {
      if (this.send) this.send.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
      return
    }
    if (!this.send || !this.convolver) {
      this.send = ctx.createGain()
      this.send.gain.value = 0
      this.convolver = ctx.createConvolver()
      this.world.connect(this.send)
      this.send.connect(this.convolver)
      this.convolver.connect(this.muffle)
    }
    this.convolver.buffer = makeRoomIR(ctx, room.rt60)
    this.send.gain.setTargetAtTime(room.wet, ctx.currentTime, 0.05)
  }
  /** Analyser on the final output (created on first call). */
  analyser(): AnalyserNode | null {
    const ctx = this.ctx
    if (!ctx || !this.comp) return null
    if (!this.analyserNode) {
      this.analyserNode = ctx.createAnalyser()
      this.analyserNode.fftSize = 2048
      this.analyserNode.smoothingTimeConstant = 0.6
      this.comp.connect(this.analyserNode)
    }
    return this.analyserNode
  }
  setQuality(q: Quality): void {
    this.opts.quality = q
    this.quality = q
    if (this.synth) this.synth.quality = q === 'low' ? 0 : 1
    if (this.room) this.setRoom(this.room)
  }

  // ---------------- one-shots ----------------
  /**
   * Play a one-shot. Params override the def's defaults. Reserved: gain (linear), pan (-1..1),
   * when (seconds from now), detune (cents). Returns null when locked, muted, rate-limited or unknown.
   */
  play(id: string, params: Params = {}): Voice | null {
    const def = this.defs.get(id)
    if (!def || def.kind !== 'oneshot') {
      this.warnOnce(id, def ? `"${id}" is a loop: use Audio.loop()` : `unknown sound "${id}"`)
      return null
    }
    const ctx = this.ctx
    const s = this.synth
    if (!ctx || !s || !this.buses || (ctx.state !== 'running' && !this.resuming) || this.prefs.muted) {
      this.counters.dropped++
      return null
    }
    const now = ctx.currentTime
    const t = now + START_OFFSET + Math.max(0, params.when ?? 0)
    if (def.minInterval) {
      const last = this.lastPlay.get(id)
      if (last !== undefined && t - last < def.minInterval) {
        this.counters.dropped++
        return null
      }
    }
    this.lastPlay.set(id, t)
    this.enforceCaps(def)
    const p = mergeParams(def, params)
    p.k = (1 + (s.rand() * 2 - 1) * (def.vary?.pitch ?? 0.03)) * (params.detune ? Math.pow(2, params.detune / 1200) : 1)
    const gdb = def.vary?.gain ?? 1
    const gainF = dbToGain((s.rand() * 2 - 1) * gdb) * (params.gain ?? 1)
    const out = s.gain(gainF)
    let pan: StereoPannerNode | null = null
    const bus = this.buses[def.bus ?? 'sfx']
    if (params.pan) {
      pan = s.panner(params.pan, bus)
      out.connect(pan)
    } else out.connect(bus)
    const t0 = performance.now()
    let end: number
    try {
      end = def.play(s, out, t, p)
    } catch (e) {
      console.error(`[audio] ${id} failed`, e)
      out.disconnect()
      return null
    }
    this.counters.playMs += performance.now() - t0
    this.counters.plays++
    const v: ActiveVoice = { id, out, pan, end, cut: false }
    this.voices.push(v)
    this.ensureHeartbeat()
    return { id, end, stop: (fade = 0.02) => this.cut(v, fade) }
  }

  private enforceCaps(def: OneShotDef): void {
    const max = def.maxVoices ?? 8
    let same = 0
    let oldestSame: ActiveVoice | null = null
    for (const v of this.voices) {
      if (v.cut || v.id !== def.id) continue
      same++
      if (!oldestSame) oldestSame = v
    }
    if (same >= max && oldestSame) this.cut(oldestSame, 0.01)
    const live = this.voices.filter((v) => !v.cut)
    const cap = this.quality === 'low' ? 24 : 48
    if (live.length >= cap) this.cut(live[0], 0.01)
  }

  private cut(v: ActiveVoice, fade: number): void {
    const ctx = this.ctx
    if (!ctx || v.cut) return
    v.cut = true
    const now = ctx.currentTime
    v.out.gain.cancelScheduledValues(now)
    v.out.gain.setValueAtTime(v.out.gain.value, now)
    v.out.gain.linearRampToValueAtTime(0, now + fade)
    v.end = Math.min(v.end, now + fade + 0.01)
  }

  // ---------------- loops ----------------
  /**
   * Start a loop. Returns a handle immediately, even before the first gesture: the loop starts
   * when audio unlocks (unless stopped first). Unknown ids return a no-op handle.
   */
  loop(id: string, params: Params = {}, opts: { volume?: number; fadeIn?: number } = {}): LoopHandle {
    const def = this.defs.get(id)
    if (!def || def.kind !== 'loop') {
      this.warnOnce(id, def ? `"${id}" is a one-shot: use Audio.play()` : `unknown loop "${id}"`)
      return new DeadHandle(id)
    }
    const h = new LoopHandleImpl(this, def, mergeParams(def, params), opts.volume ?? 1, opts.fadeIn ?? 0.08)
    this.loops.add(h)
    if (this.ctx && this.ctx.state === 'running') this.startLoop(h)
    return h
  }

  private startLoop(h: LoopHandleImpl): void {
    const ctx = this.ctx
    const s = this.synth
    if (!ctx || !s || !this.buses || h.voice) return
    const t = ctx.currentTime + START_OFFSET
    const out = s.gain(0, this.buses[h.def.bus ?? 'amb'])
    out.gain.setValueAtTime(0, t)
    out.gain.linearRampToValueAtTime(h.vol, t + Math.max(0.005, h.fadeIn))
    h.bag = s.beginBag()
    try {
      h.params.k = 1
      h.voice = h.def.start(s, out, t, h.params)
    } catch (e) {
      console.error(`[audio] loop ${h.id} failed`, e)
      s.endBag()
      out.disconnect()
      this.loops.delete(h)
      h.stopped = true
      return
    }
    s.endBag()
    h.out = out
    h.voice.tick?.(ctx.currentTime, ctx.currentTime + LOOKAHEAD)
    this.ensureHeartbeat()
  }

  /** @internal used by handles */
  stopLoop(h: LoopHandleImpl, fade: number): void {
    if (h.stopped) return
    h.stopped = true
    this.loops.delete(h)
    const ctx = this.ctx
    if (!ctx || !h.out || !h.voice) return
    const now = ctx.currentTime
    const g = h.out.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(0, now + Math.max(0.005, fade))
    const end = now + Math.max(0.005, fade) + 0.02
    stopAll(h.bag, end)
    h.voice.stop?.(end)
    this.graves.push({ nodes: [h.out], at: end + 0.05 })
    this.ensureHeartbeat()
  }

  /** Stop every loop (e.g. on game exit). */
  stopAll(fade = 0.3): void {
    for (const h of [...this.loops]) h.stop(fade)
  }

  // ---------------- heartbeat ----------------
  private ensureHeartbeat(): void {
    if (!this.timer && typeof window !== 'undefined') this.timer = window.setInterval(this.beat, HEARTBEAT_MS)
  }
  private beat = (): void => {
    const ctx = this.ctx
    if (!ctx) return
    const t0 = performance.now()
    const now = ctx.currentTime
    if (ctx.state === 'running') {
      for (const h of this.loops) {
        if (!h.voice?.tick) continue
        try {
          h.voice.tick(now, now + LOOKAHEAD)
        } catch (e) {
          this.warnOnce('tick:' + h.id, `[audio] tick ${h.id} failed: ${String(e)}`)
        }
      }
    }
    for (let i = this.voices.length - 1; i >= 0; i--) {
      const v = this.voices[i]
      if (v.end + 0.05 < now) {
        v.out.disconnect()
        v.pan?.disconnect()
        this.voices.splice(i, 1)
      }
    }
    for (let i = this.graves.length - 1; i >= 0; i--) {
      if (this.graves[i].at < now) {
        for (const n of this.graves[i].nodes) n.disconnect()
        this.graves.splice(i, 1)
      }
    }
    this.counters.ticks++
    this.counters.tickMs += performance.now() - t0
    if (!this.loops.size && !this.voices.length && !this.graves.length) {
      window.clearInterval(this.timer)
      this.timer = 0
    }
  }

  // ---------------- diagnostics ----------------
  stats(): AudioStats {
    const ctx = this.ctx
    const c = this.counters
    return {
      state: ctx ? (ctx.state as string) : 'none',
      ready: this.ready,
      quality: this.quality,
      sampleRate: ctx ? ctx.sampleRate : 0,
      baseLatency: ctx?.baseLatency ?? 0,
      outputLatency: ctx?.outputLatency ?? 0,
      voices: this.voices.filter((v) => !v.cut).length,
      loops: [...this.loops].filter((h) => h.playing).length,
      nodesCreated: this.synth ? this.synth.nodes : 0,
      plays: c.plays,
      dropped: c.dropped,
      playCostMs: c.plays ? c.playMs / c.plays : 0,
      tickCostMs: c.ticks ? c.tickMs / c.ticks : 0,
    }
  }
  private warnOnce(key: string, msg: string): void {
    if (this.warned.has(key)) return
    this.warned.add(key)
    console.warn('[audio] ' + msg)
  }
}

export function mergeParams(def: SoundDef, params: Params): Params {
  const p: Params = {}
  if (def.params) for (const k in def.params) p[k] = def.params[k].default
  for (const k in params) if (Number.isFinite(params[k])) p[k] = params[k]
  return p
}

/** Stereo decaying noise with air absorption: a cheap, convincing small room. */
export function makeRoomIR(ctx: BaseAudioContext, rt60: number): AudioBuffer {
  const sr = ctx.sampleRate
  const len = Math.max(0.1, rt60 * 1.1)
  const n = Math.round(sr * len)
  const buf = ctx.createBuffer(2, n, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = new Float32Array(n)
    let seed = 1234 + ch * 777
    let lp = 0
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const w = (seed / 4294967296) * 2 - 1
      const t = i / sr
      const env = Math.pow(10, (-3 * t) / rt60) // -60 dB at rt60
      const a = Math.min(0.95, 0.15 + (t / len) * 0.8) // darker as it decays
      lp = lp * a + w * (1 - a)
      d[i] = lp * env * (i < sr * 0.003 ? i / (sr * 0.003) : 1)
    }
    buf.copyToChannel(d, ch)
  }
  return buf
}
