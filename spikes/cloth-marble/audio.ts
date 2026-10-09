// Demo sound for the probe events (proves the hooks; the real game would move
// this into an AudioWorklet that walks the heightfield). All synthesized.
//
// - roll:    pink-ish noise -> band-pass (centre follows grain), gain ~ speed
// - tick:    glass modal tick (partials x1, x2.32, x4.25 of ~5.1 kHz, 40 ms)
// - impact:  glass tick + hollow sheet-steel body "tonk-nnng" (mailbox modes)
// - cloth:   fine = high hiss ~ slip rate; rough = mid scritch + snag clicks

import type { ProbeEvent } from './core/events'

export class ProbeAudio {
  ctx: AudioContext | null = null
  private master!: GainNode
  private rollGain!: GainNode
  private rollBP!: BiquadFilterNode
  private fineGain!: GainNode
  private roughGain!: GainNode
  private noise!: AudioBuffer
  enabled = true
  private lastTick = 0

  /** Call from a user gesture. */
  start(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 4
    this.master = ctx.createGain()
    this.master.gain.value = 0.7
    this.master.connect(comp).connect(ctx.destination)
    // shared noise buffer (2 s, slightly pinked)
    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    let b = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b = 0.97 * b + 0.03 * w
      d[i] = w * 0.5 + b * 2
    }
    const loop = (filterType: BiquadFilterType, f: number, q: number) => {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true
      const bp = ctx.createBiquadFilter()
      bp.type = filterType
      bp.frequency.value = f
      bp.Q.value = q
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(bp).connect(g).connect(this.master)
      src.start()
      return { bp, g }
    }
    const roll = loop('bandpass', 800, 0.9)
    this.rollBP = roll.bp
    this.rollGain = roll.g
    this.fineGain = loop('highpass', 4200, 0.7).g
    this.roughGain = loop('bandpass', 1500, 1.2).g
  }

  /** Continuous voices; call every frame. */
  update(roll: { speed: number; grain: number; grounded: boolean; onCloth: boolean }, fineSlip: number, roughSlip: number): void {
    const ctx = this.ctx
    if (!ctx || !this.enabled) return
    const t = ctx.currentTime
    const sp = roll.grounded ? roll.speed : 0
    const grit = Math.min(1, roll.grain * 25)
    const rg = Math.min(0.5, (sp / 60) * (roll.onCloth ? 0.25 : 0.35 + grit))
    this.rollGain.gain.setTargetAtTime(rg, t, 0.03)
    this.rollBP.frequency.setTargetAtTime(roll.onCloth ? 300 : 350 + 3200 * grit + sp * 8, t, 0.05)
    this.fineGain.gain.setTargetAtTime(Math.min(0.35, fineSlip * 0.25), t, 0.04)
    this.roughGain.gain.setTargetAtTime(Math.min(0.4, roughSlip * 0.6), t, 0.03)
  }

  events(evs: ProbeEvent[]): void {
    const ctx = this.ctx
    if (!ctx || !this.enabled) return
    for (const e of evs) {
      if (e.type === 'impact') {
        this.glassTick(Math.min(1, e.strength / 50), 0)
        this.body(Math.min(1, e.strength / 60))
        vibrate(8)
      } else if (e.type === 'tick') {
        const now = ctx.currentTime
        if (now - this.lastTick < 0.012) continue
        this.lastTick = now
        this.glassTick(Math.min(0.5, e.strength / 30), 0)
        vibrate(4)
      } else if (e.type === 'wall') {
        this.glassTick(Math.min(0.8, e.strength / 40), 0.4)
        this.thud(Math.min(1, e.strength / 40))
      } else if (e.type === 'snagRelease') {
        this.click(0.5)
        vibrate(8)
      }
    }
  }

  private glassTick(a: number, dull: number): void {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const f0 = 5100 * (1 - dull * 0.5) * (0.95 + Math.random() * 0.1)
    for (const [m, g] of [
      [1, 1],
      [2.32, 0.5],
      [4.25, 0.25],
    ] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f0 * m
      const env = ctx.createGain()
      env.gain.setValueAtTime(a * g * 0.25, t)
      env.gain.exponentialRampToValueAtTime(1e-4, t + 0.04 / m + 0.01)
      o.connect(env).connect(this.master)
      o.start(t)
      o.stop(t + 0.08)
    }
  }

  /** hollow sheet-steel mailbox body: modes 180/410/690/1040/1550 Hz */
  private body(a: number): void {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const modes: [number, number, number][] = [
      [180, 1.0, 1.4],
      [410, 0.6, 1.0],
      [690, 0.45, 0.8],
      [1040, 0.3, 0.6],
      [1550, 0.2, 0.4],
    ]
    for (const [f, g, dec] of modes) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * (0.99 + Math.random() * 0.02)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(a * g * 0.12, t + 0.004)
      env.gain.exponentialRampToValueAtTime(1e-4, t + dec)
      o.connect(env).connect(this.master)
      o.start(t)
      o.stop(t + dec + 0.05)
    }
  }

  private thud(a: number): void {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12)
    const env = ctx.createGain()
    env.gain.setValueAtTime(a * 0.2, t)
    env.gain.exponentialRampToValueAtTime(1e-4, t + 0.15)
    o.connect(env).connect(this.master)
    o.start(t)
    o.stop(t + 0.2)
  }

  private click(a: number): void {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2400
    bp.Q.value = 2
    const env = ctx.createGain()
    env.gain.setValueAtTime(a * 0.6, t)
    env.gain.exponentialRampToValueAtTime(1e-4, t + 0.045)
    src.connect(bp).connect(env).connect(this.master)
    src.start(t, Math.random() * 1.5)
    src.stop(t + 0.06)
  }
}

function vibrate(ms: number): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(ms)
  } catch {
    /* iOS / desktop: ignore */
  }
}
