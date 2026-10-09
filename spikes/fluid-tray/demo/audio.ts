/**
 * Demo-only procedural audio: slosh bed (band-passed noise driven by the liquid's kinetic energy),
 * wall laps, bench clunks, and the jug's glug. Starts on the first user gesture.
 */
import type { FluidTray } from '../core/fluidTray.ts'

export class TrayAudio {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  private sloshGain: GainNode | null = null
  private sloshFilter: BiquadFilterNode | null = null
  private pourGain: GainNode | null = null
  private pourFilter: BiquadFilterNode | null = null
  private level = 0
  muted = false

  start(): void {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    this.ctx = ctx
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    // brown-ish noise
    let last = 0
    for (let i = 0; i < len; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04
      d[i] = last * 3.5
    }
    this.noise = buf
    const loop = (filterType: BiquadFilterType, freq: number) => {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = filterType
      f.frequency.value = freq
      f.Q.value = 0.8
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(f).connect(g).connect(ctx.destination)
      src.start()
      return { f, g }
    }
    const s = loop('bandpass', 500)
    this.sloshFilter = s.f
    this.sloshGain = s.g
    const p = loop('lowpass', 900)
    this.pourFilter = p.f
    this.pourGain = p.g
  }

  update(tray: FluidTray, dt: number): void {
    const ctx = this.ctx
    if (!ctx || !this.sloshGain || !this.sloshFilter || !this.pourGain || !this.pourFilter) return
    const t = ctx.currentTime
    const ke = tray.fluid.kineticEnergy()
    const target = this.muted ? 0 : Math.min(0.5, Math.sqrt(ke) * 90)
    this.level += (target - this.level) * Math.min(1, dt * 8)
    this.sloshGain.gain.setTargetAtTime(this.level, t, 0.05)
    this.sloshFilter.frequency.setTargetAtTime(380 + this.level * 900, t, 0.08)
    const pr = tray.pourState.rate
    const glug = 0.6 + 0.4 * Math.sin(tray.pourState.t * Math.PI * 2 * 4.2)
    this.pourGain.gain.setTargetAtTime(this.muted || pr <= 0 ? 0 : 0.22 * glug, t, 0.03)
    this.pourFilter.frequency.setTargetAtTime(700 + 500 * glug, t, 0.03)
    if (this.muted) return
    for (const speed of tray.events.clunks) this.thump(Math.min(1, speed * 3))
    let lap = 0
    for (const s of tray.events.slaps) lap = Math.max(lap, s.e)
    if (lap > 0) this.burst(Math.min(0.5, lap * 300), 700 + Math.random() * 500, 0.12)
    if (tray.events.drips > 0) this.burst(0.08, 2200 + Math.random() * 1500, 0.03)
  }

  private thump(v: number): void {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(55, t + 0.15)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5 * v + 0.001, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.25)
    this.burst(0.25 * v, 1800, 0.04)
  }

  private burst(v: number, freq: number, dur: number): void {
    const ctx = this.ctx!
    if (!this.noise) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = 1.2
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(v + 0.0001, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(ctx.destination)
    src.start(t, Math.random())
    src.stop(t + dur + 0.02)
  }
}
