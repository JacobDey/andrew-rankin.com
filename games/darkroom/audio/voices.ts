// Small local stand-in for the darkroom sound library (used only while
// @shared/audio is missing). One AudioContext, created on the first gesture.
import type { VoiceLite } from '../glue/platform'

export function localVoices(): { play(id: string, p?: Record<string, number>): void; loop(id: string, p?: Record<string, number>): VoiceLite | null } {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noise: AudioBuffer | null = null
  const arm = () => {
    if (ctx) { void ctx.resume(); return }
    try {
      ctx = new AudioContext()
      master = ctx.createGain(); master.gain.value = 0.6
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4
      master.connect(comp).connect(ctx.destination)
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const d = noise.getChannelData(0); let s = 12345
      for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 4294967296) * 2 - 1 }
    } catch { ctx = null }
  }
  addEventListener('pointerdown', arm, { capture: true })
  addEventListener('keydown', arm, { capture: true })
  const ok = () => !!ctx && !!master && ctx.state === 'running'
  const env = (g: GainNode, t: number, a: number, peak: number, d: number) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d) }
  const nz = (f: number, q: number, peak: number, dur: number, at = 0, type: BiquadFilterType = 'bandpass') => {
    if (!ctx || !master || !noise) return
    const t = ctx.currentTime + at
    const s = ctx.createBufferSource(); s.buffer = noise
    const bp = ctx.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q
    const g = ctx.createGain(); env(g, t, 0.002, peak, dur)
    s.connect(bp).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05)
  }
  const sine = (f: number, peak: number, dur: number, at = 0, f2?: number) => {
    if (!ctx || !master) return
    const t = ctx.currentTime + at
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur)
    const g = ctx.createGain(); env(g, t, 0.004, peak, dur)
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05)
  }
  return {
    play(id, p = {}) {
      if (!ok()) return
      switch (id) {
        case 'darkroom.pull-chain': for (let i = 0; i < 7; i++) nz(3200 + i * 180, 4, 0.08 * (1 - i / 9), 0.02, i * 0.018); nz(1800, 3, 0.2, 0.05, 0.16); sine(160, 0.15, 0.04, 0.16); break
        case 'darkroom.switch': nz(2200, 30, 0.3, 0.04, 0, 'bandpass'); nz(3000, 1, 0.2, 0.01, 0, 'highpass'); break
        case 'darkroom.guard': sine(95, 0.2, 0.06); sine(180, 0.08, 0.25); break
        case 'darkroom.tray-land': sine(140, Math.min(0.25, (p.speed ?? 0.1) * 0.8), 0.09); sine(310, Math.min(0.15, (p.speed ?? 0.1) * 0.4), 0.09); break
        case 'darkroom.lap': nz(700 + 400 * (p.intensity ?? 0.5), 1.5, 0.12 * (p.intensity ?? 0.5), 0.06); break
        case 'darkroom.paper-grab': for (let i = 0; i < 6; i++) nz(2500 + i * 600, 3, 0.04, 0.015, i * 0.02); break
        case 'darkroom.paper-dunk': nz(900, 0.7, 0.2, 0.08, 0, 'lowpass'); sine(90, 0.15, 0.04); nz(5000, 1, 0.03, 0.25, 0.05, 'highpass'); break
        case 'darkroom.drip': sine(1400, 0.07, 0.035, 0, 650); if (p.intoLiquid) sine(300, 0.05, 0.02, 0.03); break
        case 'darkroom.timer-tick': nz(3000, 8, 0.06, 0.004); sine(1100, 0.03, 0.008); break
        case 'darkroom.timer-bell': for (const [m, g, d] of [[1, 0.22, 1.6], [2.76, 0.09, 0.7], [5.4, 0.04, 0.36]]) sine(1318.5 * m, g * 0.5, d); break
        case 'darkroom.enlarger-on': sine(70, 0.2, 0.05); break
        case 'darkroom.safelight-on': nz(5000, 2, 0.05, 0.004); sine(120, 0.02, 1.5); break
        case 'darkroom.fluorescent-start': nz(5000, 2, 0.06, 0.004); nz(5000, 2, 0.06, 0.004, 0.08); break
        case 'darkroom.pour': sine(700, 0.05, 0.04, 0, 1260); nz(1200, 2, 0.03, 0.05); break
        case 'darkroom.bloom': for (const f of [880, 1320, 1975]) { if (!ctx || !master) break; const t = ctx.currentTime; const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.9); o.connect(g).connect(master); o.start(t); o.stop(t + 3) } nz(6000, 0.7, 0.02, 1.5, 0, 'highpass'); break
        case 'darkroom.pencil': for (let i = 0; i < 8; i++) nz(4500, 2, 0.04, 0.03, i * 0.06); break
        default: break
      }
    },
    loop(id, p = {}) {
      if (!ok() || !ctx || !master || !noise) return null
      const c = ctx
      const s = c.createBufferSource(); s.buffer = noise; s.loop = true
      const f = c.createBiquadFilter()
      const g = c.createGain(); g.gain.value = 0
      let target = 0
      const set = (q: Record<string, number>) => {
        if (id === 'darkroom.slosh') { const e = q.energy ?? 0; f.frequency.setTargetAtTime(300 + 600 * e, c.currentTime, 0.05); target = Math.min(0.3, 0.25 * Math.sqrt(e)) }
        g.gain.setTargetAtTime(target, c.currentTime, 0.05)
      }
      if (id === 'darkroom.slosh') { f.type = 'bandpass'; f.Q.value = 1.1 }
      else if (id === 'darkroom.tap') { f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 0.5; target = 0.06 }
      else if (id === 'darkroom.hairdryer') { f.type = 'lowpass'; f.frequency.value = 2500; target = 0.08 }
      else if (id === 'darkroom.uv-hum' || id === 'darkroom.enlarger-fan' || id === 'darkroom.fluorescent-hum' || id === 'darkroom.safelight-hum') { f.type = 'bandpass'; f.frequency.value = id === 'darkroom.enlarger-fan' ? 900 : 240; f.Q.value = 2; target = 0.008 }
      else return null
      s.connect(f).connect(g).connect(master); s.start()
      set(p)
      g.gain.setTargetAtTime(target, c.currentTime, 0.1)
      return { set, stop: () => { g.gain.setTargetAtTime(0, c.currentTime, 0.06); s.stop(c.currentTime + 0.4) } }
    },
  }
}
