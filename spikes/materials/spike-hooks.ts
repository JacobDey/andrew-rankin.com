// window.__spike: test and measurement hooks for the headless harness.
//
//   __spike.ready                       gallery finished
//   __spike.bench({ids,size,reps})      per-material bake cost (blocking, GPU-finished)
//   __spike.seams({ids,size})           tile seam check (1.0 = seamless)
//   __spike.fingerprint({ids,size})     FNV hashes of quantized height + albedo
//   __spike.fingerprintData({ids,size}) raw quantized arrays (for tools/determinism.mjs)
//   __spike.open(id) / close() / setLight(az,el) / setTilt(u,v) / setMode(m) / setZoom(z,u,v) / frames(n)

import type * as THREE from 'three'
import type { MaterialGenerator } from './core/generator'
import type { MaterialInfo, MaterialMaps, ViewMode, GuessCandidate, GuessResult } from './core/index'
import { RECIPES, TOOLKIT_GLSL, preprocessGlsl } from './core/index'

interface Ctx {
  renderer: THREE.WebGLRenderer
  gen: MaterialGenerator
  list: MaterialInfo[]
  cards: () => Record<string, unknown>
  isReady: () => boolean
  open: (id: string) => void
  close: () => void
  view: { az: number; el: number; tu: number; tv: number; zoom: number; cu: number; cv: number }
  markDirty: () => void
  setZoom: (z: number, cu?: number, cv?: number) => Promise<void>
  setMode: (m: ViewMode) => void
  setRing: (on: boolean) => void
  frameStats: { frames: number; lastMs: number }
  seed: () => number
  matchGuess: (g: string, id: string) => GuessResult
  resolveGuess: (g: string) => GuessCandidate[]
  lint: () => string[]
  current: () => { base: MaterialMaps | null; zoom: MaterialMaps | null }
}

const fnv = (data: ArrayLike<number>) => {
  let h = 0x811c9dc5
  for (let i = 0; i < data.length; i++) { h ^= data[i] & 255; h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16).padStart(8, '0')
}
const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

let warmed = false

export function installSpikeHooks(ctx: Ctx) {
  const ids = (o?: { ids?: string[] }) => o?.ids ?? ctx.list.map((m) => m.id)

  const api = {
    get ready() { return ctx.isReady() },
    get caps() { return ctx.gen.caps },
    get catalog() { return ctx.list.map((m) => m.id) },
    get timings() { return ctx.cards() },
    get view() { return { ...ctx.view } },
    get frameStats() { return { ...ctx.frameStats } },
    open: (id: string) => ctx.open(id),
    close: () => ctx.close(),
    setLight(az: number, el: number) { ctx.view.az = az; ctx.view.el = el; ctx.markDirty() },
    setTilt(u: number, v: number) { ctx.view.tu = u; ctx.view.tv = v; ctx.markDirty() },
    setMode: (m: ViewMode) => { ctx.setMode(m); ctx.markDirty() },
    setRing: (on: boolean) => { ctx.setRing(on); ctx.markDirty() },
    setZoom: (z: number, u?: number, v?: number) => ctx.setZoom(z, u, v),
    async frames(n = 1) { for (let i = 0; i < n; i++) { ctx.markDirty(); await raf() } },
    async waitBaked(timeoutMs = 60000) {
      const t0 = performance.now()
      while (!ctx.current().base && performance.now() - t0 < timeoutMs) await raf()
      return !!ctx.current().base
    },
    current() {
      const c = ctx.current()
      const s = (m: MaterialMaps | null) => m && { id: m.id, size: m.size, region: m.region, texelMm: m.texelMm, heightRange: m.heightRange, timings: m.timings }
      return { base: s(c.base), zoom: s(c.zoom) }
    },
    match: (g: string, id: string) => ctx.matchGuess(g, id),
    resolve: (g: string) => ctx.resolveGuess(g).slice(0, 5),
    lint: () => ctx.lint(),

    /** Full surface-pass fragment source for a recipe, optionally with a different toolkit (A/B experiments). */
    surfaceSource(id: string, toolkit?: string, recipe?: string) {
      const main = `
uniform vec2 uOrigin;
layout(location = 0) out vec4 oData;
layout(location = 1) out vec4 oAlbedo;
void main() {
  vec2 uv = uOrigin + gl_FragCoord.xy * uPx;
  Surface s = surface(uv);
  oData = vec4(s.height, s.rough, s.metal, s.layer);
  oAlbedo = vec4(s.albedo, s.loose);
}`
      return preprocessGlsl((toolkit ?? TOOLKIT_GLSL) + '\n' + (recipe ?? RECIPES[id]) + '\n' + main)
    },

    /**
     * Compile + link + first draw of a fragment shader with raw WebGL2, GPU-fenced: what a player
     * waits for the first time (ANGLE/D3D11 compiles the pixel shader lazily at first draw).
     * Also returns the size of ANGLE's translated source (HLSL on Windows) as a noise-free proxy.
     */
    compileProbe(frag: string, size = 64) {
      const gl = ctx.renderer.getContext() as WebGL2RenderingContext
      const dbg = gl.getExtension('WEBGL_debug_shaders')
      const t0 = performance.now()
      const vs = gl.createShader(gl.VERTEX_SHADER)!
      gl.shaderSource(vs, '#version 300 es\nin vec3 position; void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }')
      gl.compileShader(vs)
      const fs = gl.createShader(gl.FRAGMENT_SHADER)!
      gl.shaderSource(fs, '#version 300 es\n' + frag)
      gl.compileShader(fs)
      const prog = gl.createProgram()!
      gl.attachShader(prog, vs); gl.attachShader(prog, fs)
      gl.bindAttribLocation(prog, 0, 'position')
      gl.linkProgram(prog)
      const ok = gl.getProgramParameter(prog, gl.LINK_STATUS) as boolean
      const log = ok ? '' : String(gl.getShaderInfoLog(fs)).slice(0, 400)
      const tLink = performance.now() - t0
      const hlsl = dbg ? (dbg.getTranslatedShaderSource(fs) || '').length : -1
      // first draw into a 2-attachment float target, like the real surface pass
      const fb = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      const texs = [gl.RGBA32F, gl.RGBA16F].map((fmt, i) => {
        const t = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, size, size)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0)
        return t
      })
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
      const buf = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), gl.STATIC_DRAW)
      const vao = gl.createVertexArray()!
      gl.bindVertexArray(vao)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
      gl.useProgram(prog)
      gl.uniform1f(gl.getUniformLocation(prog, 'uTileMm'), 40)
      gl.uniform1f(gl.getUniformLocation(prog, 'uPx'), 1 / size)
      gl.uniform1ui(gl.getUniformLocation(prog, 'uSeed'), 1)
      gl.viewport(0, 0, size, size)
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.readBuffer(gl.COLOR_ATTACHMENT0)
      const px = new Float32Array(4)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px)
      const total = performance.now() - t0
      gl.bindVertexArray(null); gl.deleteVertexArray(vao); gl.deleteBuffer(buf)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); texs.forEach((t) => gl.deleteTexture(t))
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs)
      ctx.renderer.resetState()
      return { ok, log, linkMs: Math.round(tLink), totalMs: Math.round(total), translatedChars: hlsl, fragChars: frag.length }
    },

    /** Blocking bake benchmark. gpuMs includes GPU completion (a 1-pixel readback fences it). */
    async bench(o: { ids?: string[]; size?: number; reps?: number } = {}) {
      const size = o.size ?? 1024, reps = o.reps ?? 2
      const out: Record<string, { coldMs: number; compileMs: number; bakeMs: number; mpixPerS: number }> = {}
      if (!warmed) {
        // absorb device / derive-pass / first-program setup so it is not billed to the first material
        for (const w of ['sandpaper', 'denim']) (await ctx.gen.generate(w, { size: 64, finish: true })).dispose()
        warmed = true
      }
      for (const id of ids(o)) {
        // cold = compile + first bake, GPU-finished. ANGLE (D3D11) links lazily at first draw, so
        // compileMs alone under-reports there; coldMs is what a player waits for the first time.
        const tc = performance.now()
        const t = await ctx.gen.precompile(id)
        ;(await ctx.gen.generate(id, { size, seed: ctx.seed(), finish: true })).dispose()
        const coldMs = performance.now() - tc
        await raf()
        const times: number[] = []
        for (let r = 0; r < reps; r++) {
          const m = await ctx.gen.generate(id, { size, seed: ctx.seed(), finish: true, mipmaps: true })
          times.push(m.timings.gpuMs)
          m.dispose()
          await raf()
        }
        const ms = median(times)
        out[id] = { coldMs: Math.round(coldMs), compileMs: Math.round(t), bakeMs: Math.round(ms * 10) / 10, mpixPerS: Math.round(((size * size) / 1e6 / (ms / 1000)) * 10) / 10 }
      }
      return out
    },

    /** Seam check: wrap-around neighbour difference / interior neighbour difference (height and albedo, both axes). ~1 = seamless. */
    async seams(o: { ids?: string[]; size?: number } = {}) {
      const N = o.size ?? 256
      const out: Record<string, { h: number; a: number }> = {}
      for (const id of ids(o)) {
        const m = await ctx.gen.generate(id, { size: N, seed: ctx.seed(), readback: true, readbackAlbedo: true, mipmaps: false })
        const h = m.heightData!, a = m.albedoData!
        const lum = (i: number) => a[i * 4] * 0.3 + a[i * 4 + 1] * 0.59 + a[i * 4 + 2] * 0.11
        const ratio = (f: (i: number) => number) => {
          let inner = 0, seam = 0, ni = 0
          for (let y = 0; y < N; y++) {
            for (let x = 0; x < N - 1; x++) { inner += Math.abs(f(y * N + x + 1) - f(y * N + x)); ni++ }
            seam += Math.abs(f(y * N) - f(y * N + N - 1))
          }
          for (let x = 0; x < N; x++) {
            for (let y = 0; y < N - 1; y++) { inner += Math.abs(f((y + 1) * N + x) - f(y * N + x)); ni++ }
            seam += Math.abs(f(x) - f((N - 1) * N + x))
          }
          return Math.round((seam / (2 * N)) / Math.max(inner / ni, 1e-9) * 100) / 100
        }
        out[id] = { h: ratio((i) => h[i]), a: ratio(lum) }
        m.dispose()
      }
      return out
    },

    /** Hashes of height (quantized to 1/1000 of relief) and albedo (8-bit sRGB). */
    async fingerprint(o: { ids?: string[]; size?: number; seed?: number } = {}) {
      const N = o.size ?? 128
      const out: Record<string, string> = {}
      for (const id of ids(o)) {
        const m = await ctx.gen.generate(id, { size: N, seed: o.seed ?? 1, readback: true, readbackAlbedo: true, mipmaps: false })
        const q = Array.from(m.heightData!, (v) => Math.round((v / m.info.reliefMm) * 1000))
        out[id] = `${fnv(q)}:${fnv(m.albedoData!)}`
        m.dispose()
      }
      return out
    },

    /** Raw quantized arrays for cross-device comparison (base64 of Int16 height in µm, RGBA8 albedo). */
    async fingerprintData(o: { ids?: string[]; size?: number; seed?: number } = {}) {
      const N = o.size ?? 64
      const out: Record<string, { h: string; a: string; relief: number }> = {}
      const b64 = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s) }
      for (const id of ids(o)) {
        const m = await ctx.gen.generate(id, { size: N, seed: o.seed ?? 1, readback: true, readbackAlbedo: true, mipmaps: false })
        const h16 = new Int16Array(N * N)
        for (let i = 0; i < h16.length; i++) h16[i] = Math.max(-32768, Math.min(32767, Math.round(m.heightData![i] * 1000)))
        out[id] = { h: b64(new Uint8Array(h16.buffer)), a: b64(m.albedoData!), relief: m.info.reliefMm }
        m.dispose()
      }
      return out
    },
  }
  ;(window as unknown as { __spike: typeof api }).__spike = api
  return api
}
