// Texturedle contact synth (texturedle.md §7.5): "you hear the real texture".
// Receives the high-passed audio heightfield (mm) once per bake and the probe
// contacts at ~60 Hz ({ id, x, y, vx, vy, load } in sim mm and mm/s). Per sample
// the contact point advances by v / fs across the field; the local slope change
// under it (a second difference) becomes the signal, scaled by √|v| · load and
// low-passed at clamp(|v| / (2π · 0.3 mm), 200, 8000) Hz, plus a little
// band-limited noise for sub-texel roughness. Periodic textures sing at v / pitch.
/* global sampleRate, registerProcessor, AudioWorkletProcessor */

class ContactProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.res = 0
    this.size = 1
    this.data = null
    this.voices = new Map()
    this.seed = 22222
    this.port.onmessage = (e) => {
      const m = e.data
      if (m.type === 'field') {
        this.res = m.res
        this.size = m.sizeMm
        this.data = m.data
      } else if (m.type === 'contacts') {
        const seen = new Set()
        for (const c of m.list) {
          seen.add(c.id)
          let v = this.voices.get(c.id)
          if (!v) {
            v = { x: c.x, y: c.y, vx: 0, vy: 0, load: 0, tvx: 0, tvy: 0, tload: 0, s1: 0, h1: 0, lp: 0, lp2: 0, rough: 0.5, gain: 1, pan: 0 }
            this.voices.set(c.id, v)
          }
          // resync the position softly (the bench is the truth)
          if (Math.hypot(c.x - v.x, c.y - v.y) > 0.5) { v.x = c.x; v.y = c.y } else { v.x += (c.x - v.x) * 0.2; v.y += (c.y - v.y) * 0.2 }
          v.tvx = c.vx
          v.tvy = c.vy
          v.tload = c.load
          v.rough = c.rough
          v.gain = c.gain
          v.pan = Math.max(-0.9, Math.min(0.9, c.x / (this.size * 0.5)))
        }
        for (const [id, v] of this.voices) if (!seen.has(id)) v.tload = 0
      } else if (m.type === 'reset') {
        this.voices.clear()
      }
    }
  }

  h(x, y) {
    const n = this.res
    const d = this.data
    let fx = (x / this.size + 0.5) * n - 0.5
    let fy = (y / this.size + 0.5) * n - 0.5
    if (fx < 0) fx = 0; else if (fx > n - 1.001) fx = n - 1.001
    if (fy < 0) fy = 0; else if (fy > n - 1.001) fy = n - 1.001
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j
    const k = j * n + i
    const a = d[k] + (d[k + 1] - d[k]) * tx
    const b = d[k + n] + (d[k + n + 1] - d[k + n]) * tx
    return a + (b - a) * ty
  }

  rnd() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0
    return this.seed / 4294967296 * 2 - 1
  }

  process(_inputs, outputs) {
    const out = outputs[0]
    const L = out[0], R = out[1] || out[0]
    const N = L.length
    for (let i = 0; i < N; i++) { L[i] = 0; R[i] = 0 }
    if (!this.data || !this.res) return true
    const fs = sampleRate
    for (const v of this.voices.values()) {
      if (v.tload < 1e-3 && v.load < 1e-3) continue
      const texel = this.size / this.res
      for (let i = 0; i < N; i++) {
        // smooth the 60 Hz control data
        v.vx += (v.tvx - v.vx) * 0.002
        v.vy += (v.tvy - v.vy) * 0.002
        v.load += (v.tload - v.load) * 0.002
        const sp = Math.hypot(v.vx, v.vy)
        const step = sp / fs
        v.x += v.vx / fs
        v.y += v.vy / fs
        const hh = this.h(v.x, v.y)
        const slope = step > 1e-9 ? (hh - v.h1) / Math.max(step, texel * 0.02) : 0
        let s = slope - v.s1
        v.s1 = slope
        v.h1 = hh
        s += this.rnd() * 0.02 * v.rough
        // one-pole low-pass at clamp(|v| / (2π · 0.3 mm), 200, 8000) Hz, twice
        const fc = Math.max(200, Math.min(8000, sp / (2 * Math.PI * 0.3) * 40))
        const a = 1 - Math.exp((-2 * Math.PI * fc) / fs)
        v.lp += (s - v.lp) * a
        v.lp2 += (v.lp - v.lp2) * a
        let y = v.lp2 * Math.sqrt(sp / 100) * v.load * v.gain * 0.6
        if (y > 1) y = 1; else if (y < -1) y = -1
        L[i] += y * (1 - v.pan) * 0.5
        R[i] += y * (1 + v.pan) * 0.5
      }
    }
    return true
  }
}

registerProcessor('tx-contact', ContactProcessor)
