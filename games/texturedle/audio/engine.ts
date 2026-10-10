// Texturedle's own procedural audio (texturedle.md §7.5), on the shared
// context: voices → small-room convolver send → texturedle bus (0.9) → shared
// master. Nothing plays before the first gesture (the shared engine unlocks).
// Contact sound uses the buffer/biquad fallback path, driven by speed and the
// local micro-roughness of the audio heightfield ("we slow time, never sound").

import { Audio, getAudio, haptic } from '@shared/audio/core'
import type { AudioEngine, AudioContacts, BenchEvent, SurfaceRuntime, UiSoundName } from '../contracts'
import type { BodySpec } from '../glue/surface'

const PRESET_MODES: Record<BodySpec['preset'], Array<[number, number, number]>> = {
  'hollow-sheet': [[212, 1.12, 1], [337, 0.88, 0.7], [529, 0.72, 0.5], [811, 0.56, 0.35], [1240, 0.48, 0.25]],
  'solid-stone': [[1800, 0.05, 1], [3100, 0.04, 0.5], [4700, 0.03, 0.3]],
  board: [[140, 0.18, 1], [330, 0.14, 0.6], [610, 0.1, 0.35]],
  pane: [[620, 0.3, 1], [1450, 0.22, 0.5], [2900, 0.15, 0.3]],
  ceramic: [[1300, 0.6, 1], [3100, 0.4, 0.5], [5200, 0.3, 0.3]],
  tube: [[1800, 1.2, 1], [4900, 0.8, 0.5]],
  'rubber-ball': [[140, 0.4, 1], [290, 0.3, 0.5]],
  fruit: [[180, 0.06, 1], [420, 0.04, 0.4]],
  soft: [],
}
const CAPTION: Record<BodySpec['preset'], string> = {
  'hollow-sheet': '[hollow metal ring]', 'solid-stone': '[dull stony tick]', board: '[woody knock]', pane: '[bright tock]',
  ceramic: '[bright clink]', tube: '[ringing tube]', 'rubber-ball': '[rubbery boing]', fruit: '[soft puk]', soft: '[muffled thud]',
}

export function createAudio(): AudioEngine & { setMuted(m: boolean): void; setHaptics(on: boolean): void; readonly live: boolean } {
  let ctx: AudioContext | null = null
  let bus: GainNode | null = null
  let send: GainNode | null = null
  let rt: SurfaceRuntime | null = null
  let room = true
  let roomNodes: { g: GainNode; src: AudioBufferSourceNode } | null = null
  let nextDrip = 0
  let muted = false
  let haptics = true
  const buzz = (p: number) => { if (haptics) haptic(p) }
  const caps: Array<(t: string) => void> = []
  let lastCap = new Map<string, number>()
  let noiseBuf: AudioBuffer | null = null
  // continuous voices
  interface Loop { src: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode; p: StereoPannerNode }
  let roll: Loop | null = null
  let rollTick: Loop | null = null
  const cloth: Record<string, Loop | null> = { lens: null, burlap: null }
  let lastImpactT = 0
  let impacts = 0
  let squeaks = 0
  let squeakWindow = 0
  let micro = 0.5 // the recipe's micro-roughness (0..1), from the audio heightfield
  let rattle = false
  let preset: BodySpec['preset'] = 'hollow-sheet'
  let modes: Array<[number, number, number]> = PRESET_MODES['hollow-sheet']
  // the contact synth (AudioWorklet); null until it loads, or when unsupported (fallback = noise loops)
  let contact: AudioWorkletNode | null = null
  let contactLoading = false
  let clickN = 0
  function loadContact(): void {
    if (!ctx || contact || contactLoading || !ctx.audioWorklet) return
    contactLoading = true
    ctx.audioWorklet.addModule(new URL('./contact-worklet.js', import.meta.url)).then(() => {
      if (!ctx) return
      contact = new AudioWorkletNode(ctx, 'tx-contact', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] })
      out(contact)
      if (rt) postField(rt)
    }).catch((e: unknown) => { console.debug('[texturedle] contact worklet unavailable, using the noise fallback', e) })
  }
  function postField(r: SurfaceRuntime): void {
    if (!contact) return
    const b = r.bake
    if (!b.audioRes || !b.audioHeight.length) return
    const copy = new Float32Array(b.audioHeight)
    contact.port.postMessage({ type: 'field', res: b.audioRes, sizeMm: b.sizeMm, data: copy }, [copy.buffer])
  }

  function caption(t: string, key = t): void {
    const now = performance.now()
    if ((lastCap.get(key) ?? 0) > now - 1500) return
    lastCap.set(key, now)
    for (const c of caps) c(t)
  }

  function ensure(): boolean {
    if (ctx) return true
    const a = getAudio()
    if (!a) return false
    ctx = a.ctx
    bus = ctx.createGain()
    bus.gain.value = 0.9
    bus.connect(a.master)
    // small-room IR: stereo noise × e^(−t/0.05), RT60 ≈ 0.35 s, wet 0.18
    const len = Math.floor(ctx.sampleRate * 0.4)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    let s = 99991
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      for (let i = 0; i < len; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0
        d[i] = ((s / 4294967296) * 2 - 1) * Math.exp(-i / ctx.sampleRate / 0.05)
      }
    }
    const conv = ctx.createConvolver()
    conv.buffer = ir
    send = ctx.createGain()
    send.gain.value = 0.18
    send.connect(conv)
    conv.connect(bus)
    noiseBuf = Audio.noise('white') ?? makeNoise(ctx)
    if (room) startRoom()
    loadContact()
    return true
  }

  function makeNoise(c: AudioContext): AudioBuffer {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = b.getChannelData(0)
    let s = 12345
    for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1 }
    return b
  }

  function out(node: AudioNode, wet = true): void {
    node.connect(bus!)
    if (wet) node.connect(send!)
  }

  function mkLoop(type: BiquadFilterType, freq: number, q: number): Loop {
    const src = ctx!.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const f = ctx!.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx!.createGain()
    g.gain.value = 0
    const p = ctx!.createStereoPanner()
    src.connect(f).connect(g).connect(p)
    out(p)
    src.start()
    return { src, f, g, p }
  }

  function startRoom(): void {
    if (!ctx || roomNodes) return
    const src = ctx.createBufferSource()
    src.buffer = Audio.noise('pink') ?? noiseBuf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 400
    const g = ctx.createGain()
    g.gain.value = 0.004 // ≈ −48 dB
    src.connect(lp).connect(g)
    out(g, false)
    src.start()
    roomNodes = { g, src }
    nextDrip = ctx.currentTime + 4
  }

  function stopRoom(): void {
    if (!roomNodes) return
    try { roomNodes.src.stop() } catch { /* already stopped */ }
    roomNodes.g.disconnect()
    roomNodes = null
  }

  function drip(): void {
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(1400, t)
    o.frequency.exponentialRampToValueAtTime(700, t + 0.06)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    o.connect(g)
    out(g)
    o.start(t)
    o.stop(t + 0.1)
  }

  function pan(x: number): number {
    const fw = rt ? rt.bake.sizeMm / 1.06 : 7.2
    return Math.max(-0.9, Math.min(0.9, x / (fw / 2)))
  }

  function oneShot(buf: AudioBuffer, p: number, gain: number): void {
    const s = ctx!.createBufferSource()
    s.buffer = buf
    const g = ctx!.createGain()
    g.gain.value = gain
    const pn = ctx!.createStereoPanner()
    pn.pan.value = p
    s.connect(g).connect(pn)
    out(pn)
    s.start()
  }

  /** Modal impact: half-sine excitation (width from hardness) into the body's modes, plus glass ticks. */
  function impact(x: number, speed: number, energyUJ: number, hardness: number, by: 'marble' | 'tap'): void {
    if (!ctx) return
    const now = ctx.currentTime
    if (now - lastImpactT < 0.012) return
    lastImpactT = now
    const sr = ctx.sampleRate
    const len = Math.floor(sr * 1.5)
    const buf = ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    const w = 0.0001 + (1 - Math.max(0, Math.min(1, hardness))) * 0.0029 // 0.1 ms steel … 3 ms rubber
    const fw = rt ? rt.bake.sizeMm : 7.6
    const pos = Math.abs(x / fw) + 0.13
    const detune = 1 + (((impacts++ * 0.6180339) % 1) - 0.5) * 0.06
    for (let m = 0; m < modes.length; m++) {
      const [f0, t60, g0] = modes[m]
      const f = f0 * detune
      const spec = Math.abs(Math.cos(Math.PI * f * w) / Math.max(0.05, Math.abs(1 - (2 * f * w) ** 2)))
      const gk = g0 * Math.abs(Math.cos(Math.PI * (m + 1) * pos)) * spec
      const decay = 6.91 / t60
      const wst = (2 * Math.PI * f) / sr
      for (let i = 0; i < len; i++) {
        const t = i / sr
        const env = Math.exp(-decay * t)
        if (env < 1e-4) break
        d[i] += gk * env * Math.sin(wst * i) * (t < w ? t / w : 1)
      }
    }
    // marble glass ticks: ×1, ×2.32, ×4.25 of 5.1 kHz, 40 ms
    if (by === 'marble') {
      const parts = [1, 2.32, 4.25]
      for (let p = 0; p < 3; p++) {
        const f = 5100 * parts[p]
        if (f > sr / 2.2) continue
        for (let i = 0; i < sr * 0.08; i++) d[i] += (0.35 / (p + 1)) * Math.exp(-i / sr / 0.04 * 3) * Math.sin((2 * Math.PI * f * i) / sr)
      }
    }
    // latch rattle after strong hits
    if (rattle && energyUJ > 0.3) {
      let s = 777 + impacts
      const o = Math.floor(sr * 0.02)
      for (let i = 0; i < sr * 0.03; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0
        const am = 0.5 + 0.5 * Math.sin((2 * Math.PI * 90 * i) / sr)
        d[o + i] += ((s / 4294967296) * 2 - 1) * am * 0.25 * Math.exp(-i / (sr * 0.012))
      }
    }
    const gain = Math.min(0.9, 0.08 + Math.sqrt(Math.max(0, energyUJ)) * 0.35) * (modes.length ? 1 : 0.4)
    oneShot(buf, pan(x), gain)
    buzz(Math.round(4 + Math.min(26, energyUJ * 20)))
    if (modes.length) caption(rattle && energyUJ > 0.3 ? '[hollow metal ring, latch rattles]' : CAPTION[preset], 'impact')
    else caption(CAPTION.soft, 'impact')
    void speed
  }

  function blip(f0: number, f1: number, dur: number, gain: number, type: OscillatorType = 'sine', p = 0): void {
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.003, dur / 4))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const pn = ctx.createStereoPanner()
    pn.pan.value = p
    o.connect(g).connect(pn)
    out(pn)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  function click(freq: number, q: number, dur: number, gain: number, when = 0, p = 0): void {
    if (!ctx || !noiseBuf) return
    const t = ctx.currentTime + when
    const s = ctx.createBufferSource()
    s.buffer = noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const pn = ctx.createStereoPanner()
    pn.pan.value = p
    s.connect(f).connect(g).connect(pn)
    out(pn)
    s.start(t, ((clickN++ * 0.37) % 1.5))
    s.stop(t + dur + 0.01)
  }

  function microRoughness(r: SurfaceRuntime): number {
    const a = r.bake.audioHeight
    if (!a.length) return 0.5
    let s = 0
    for (let i = 0; i < a.length; i += 7) s += a[i] * a[i]
    const rms = Math.sqrt(s / Math.ceil(a.length / 7))
    return Math.max(0.05, Math.min(1, rms / 0.03))
  }

  const engine = {
    get live() { return !!ctx },
    async unlock() {
      Audio.arm()
      ensure()
    },
    setSurface(r: SurfaceRuntime) {
      rt = r
      preset = r.recipe.body.preset
      modes = r.recipe.body.modes ?? PRESET_MODES[preset]
      rattle = !!r.recipe.body.rattle
      micro = microRoughness(r)
      postField(r)
    },
    update(c: AudioContacts) {
      if (!ensure() || !ctx || muted) return
      const t = ctx.currentTime
      // room drip every 11 ± 3 s
      if (roomNodes && t > nextDrip) { drip(); nextDrip = t + 8 + ((t * 7.31) % 6) }
      // the contact synth hears the texture itself
      if (contact) {
        const list: Array<{ id: number; x: number; y: number; vx: number; vy: number; load: number; rough: number; gain: number }> = []
        if (c.marble) list.push({ id: 0, ...c.marble, rough: rt ? rt.materialAt(c.marble.x, c.marble.y).roughness : 0.5, gain: 1 })
        for (const cc of c.cloths) list.push({ id: cc.kind === 'lens' ? 1 : 2, x: cc.x, y: cc.y, vx: cc.vx, vy: cc.vy, load: cc.load, rough: rt ? rt.materialAt(cc.x, cc.y).roughness : 0.5, gain: cc.kind === 'lens' ? 0.35 : 0.8 })
        contact.port.postMessage({ type: 'contacts', list })
      }
      // marble rolling: the texture under the bead, at real (sim) speed
      if (c.marble) {
        if (!roll) roll = mkLoop('bandpass', 800, 0.7)
        if (!rollTick) rollTick = mkLoop('highpass', 2500, 0.5)
        const v = Math.hypot(c.marble.vx, c.marble.vy)
        const mat = rt ? rt.materialAt(c.marble.x, c.marble.y) : null
        const rough = mat ? mat.roughness : 0.5
        const lp = Math.max(200, Math.min(8000, v / (2 * Math.PI * 0.3)))
        roll.f.frequency.setTargetAtTime(lp, t, 0.03)
        const gain = Math.min(0.5, Math.sqrt(v / 400) * c.marble.load * (0.05 + rough * rough * 0.6) * (0.4 + micro)) * (contact ? 0.35 : 1)
        roll.g.gain.setTargetAtTime(gain, t, 0.03)
        roll.p.pan.setTargetAtTime(pan(c.marble.x), t, 0.05)
        rollTick.g.gain.setTargetAtTime(gain * rough * rough * 0.5, t, 0.03)
        if (v > 40 && rough > 0.7) caption('[gritty crackle]', 'roll')
      } else {
        roll?.g.gain.setTargetAtTime(0, t, 0.05)
        rollTick?.g.gain.setTargetAtTime(0, t, 0.05)
      }
      for (const k of ['lens', 'burlap'] as const) {
        const cc = c.cloths.find((q) => q.kind === k)
        if (cc) {
          if (!cloth[k]) cloth[k] = mkLoop('bandpass', k === 'lens' ? 3200 : 900, 1.2)
          const L = cloth[k]!
          const v = Math.hypot(cc.vx, cc.vy)
          const g = Math.min(0.35, Math.sqrt(Math.max(0, cc.slipPower) * 0.002 + v / 2000) * Math.sqrt(v / 300) * cc.load * (k === 'lens' ? 0.25 : 0.6))
          L.g.gain.setTargetAtTime(g, t, 0.03)
          L.f.frequency.setTargetAtTime((k === 'lens' ? 2500 : 600) + Math.min(1500, v * 2), t, 0.05)
          L.p.pan.setTargetAtTime(pan(cc.x), t, 0.05)
        } else cloth[k]?.g.gain.setTargetAtTime(0, t, 0.05)
      }
      if (t > squeakWindow) { squeakWindow = t + 1; squeaks = 0 }
    },
    event(e: BenchEvent) {
      if (!ensure() || !ctx || muted) return
      switch (e.t) {
        case 'impact': {
          const hard = rt ? rt.bake.phys[e.layer]?.hardness ?? 0.5 : 0.5
          impact(e.x, e.speed, e.energyUJ, hard, e.by)
          break
        }
        case 'slip':
          if (squeaks < 30 && e.power > 0.2) {
            squeaks++
            blip(1200, 800, 0.012, Math.min(0.12, 0.02 + e.power * 0.01), 'sine')
            if (e.cloth === 'lens' && e.power > 2) caption('[squeak]', 'squeak')
          }
          break
        case 'snag':
          click(4000, 0.8, 0.004, 0.4)
          blip(2200, 2100, 0.08, 0.06)
          buzz(8)
          caption('[snag tick]', 'snag')
          break
        case 'snagRelease':
          click(3000, 1, 0.01, 0.25)
          break
        case 'pop':
          click(1500, 0.5, 0.008, 0.6)
          blip(350, 300, 0.05, 0.2)
          caption('[dry crack, pop]', 'pop')
          break
        case 'offEdge':
          blip(5200, 5000, 0.03, 0.05)
          setTimeout(() => click(300, 2, 0.08, 0.15, 0, e.side === 'l' ? -0.8 : e.side === 'r' ? 0.8 : 0), 450)
          caption('[plink… tonk]', 'edge')
          break
        case 'shake':
          buzz(20)
          break
        case 'layerRevealed':
          caption('[scrape changes pitch]', 'layer')
          break
        default:
          break
      }
    },
    ui(name: UiSoundName) {
      if (!ensure() || !ctx || muted) return
      switch (name) {
        case 'detent': click(1800, 8, 0.02, 0.15); break
        case 'ratchet': click(2600, 5, 0.015, 0.12); break
        case 'tile': click(2400, 3, 0.03, 0.2); blip(900, 700, 0.02, 0.04, 'triangle'); break
        case 'stamp': case 'thunk': blip(140, 70, 0.09, 0.25, 'sine'); click(600, 1, 0.04, 0.2); break
        case 'iris': {
          // bellows breath + 9 blade ticks
          if (noiseBuf) {
            const t = ctx.currentTime
            const s = ctx.createBufferSource()
            s.buffer = noiseBuf
            const f = ctx.createBiquadFilter()
            f.type = 'lowpass'
            f.frequency.value = 500
            const g = ctx.createGain()
            g.gain.setValueAtTime(0.0001, t)
            g.gain.linearRampToValueAtTime(0.08, t + 0.25)
            g.gain.linearRampToValueAtTime(0.0001, t + 0.5)
            s.connect(f).connect(g)
            out(g)
            s.start(t)
            s.stop(t + 0.55)
          }
          for (let i = 0; i < 9; i++) click(5200, 6, 0.006, 0.06, i * 0.03)
          break
        }
        case 'shutter': click(3800, 2, 0.01, 0.4); click(3200, 2, 0.01, 0.35, 0.005); break
        case 'dish': {
          // the marble drops back into its glass dish: restitution 0.78, first interval 180 ms
          let tt = 0.0, iv = 0.18, g = 0.3
          for (let i = 0; i < 9; i++) {
            const when = tt
            setTimeout(() => blip(5100, 5000, 0.04, g * 0.3), when * 1000)
            tt += iv; iv *= 0.78; g *= 0.78
          }
          break
        }
      }
    },
    setRoomTone(on: boolean) {
      room = on
      if (!ctx) return
      if (on) startRoom()
      else stopRoom()
    },
    onCaption(cb: (t: string) => void) {
      caps.push(cb)
      return () => { const i = caps.indexOf(cb); if (i >= 0) caps.splice(i, 1) }
    },
    setHaptics(on: boolean) { haptics = on },
    setMuted(m: boolean) {
      muted = m
      if (m && ctx) {
        const t = ctx.currentTime
        roll?.g.gain.setTargetAtTime(0, t, 0.02)
        rollTick?.g.gain.setTargetAtTime(0, t, 0.02)
        cloth.lens?.g.gain.setTargetAtTime(0, t, 0.02)
        cloth.burlap?.g.gain.setTargetAtTime(0, t, 0.02)
      }
    },
  }
  return engine
}
