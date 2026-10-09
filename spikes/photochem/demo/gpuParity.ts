// Compiles the GLSL ports (core/glsl.ts) in WebGL2 and compares them with the
// CPU reference on random inputs. Also times the develop pass at game sizes.

import {
  GLSL_LIB, SILVER_DEVELOP_FRAG, SilverSheet, VC_HARD_CURVE, VC_SOFT_CURVE, curveDensity, developerRates, devStep,
  makeDeveloper, paper, reciprocityEfficiency, softmin,
} from '../core/index.ts'

export interface ParityResult {
  ok: boolean
  reason?: string
  renderer?: string
  floatTargets?: boolean
  libMaxErr?: Record<string, number>
  devMaxErr?: Record<string, number>
  devPassMs?: Record<string, number>
}

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function gpuParity(): ParityResult {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false })
  if (!gl) return { ok: false, reason: 'no WebGL2' }
  const floatTargets = !!gl.getExtension('EXT_color_buffer_float')
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
  if (!floatTargets) return { ok: false, reason: 'EXT_color_buffer_float missing (fall back to RGBA8 packing)', renderer, floatTargets }

  const compile = (fs: string) => {
    const mk = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'compile failed')
      return sh
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs))
    gl.bindAttribLocation(prog, 0, 'aPos')
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed')
    return prog
  }
  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const tex = (N: number, data: Float32Array | null) => {
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  const read = (N: number, attachment: number) => {
    const out = new Float32Array(N * N * 4)
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + attachment)
    gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, out)
    return out
  }

  try {
    // ---- 1. Library functions on random inputs
    const N = 64
    const n = N * N
    const r = rng(42)
    const inA = new Float32Array(n * 4) // x, p, R, dt
    const inB = new Float32Array(n * 4) // a, b, I, which-curve
    for (let i = 0; i < n; i++) {
      inA[4 * i] = -3 + 5 * r()
      inA[4 * i + 1] = r() * 0.999
      inA[4 * i + 2] = r() * 0.3
      inA[4 * i + 3] = r() * 2
      inB[4 * i] = 0.005 + r() * 0.05
      inB[4 * i + 1] = r() < 0.5 ? 1 : r() * 0.3
      inB[4 * i + 2] = Math.pow(10, -4 + 6 * r())
      inB[4 * i + 3] = r() < 0.5 ? 0 : 1
    }
    const ch = VC_HARD_CURVE
    const cs = VC_SOFT_CURVE
    const recip = paper('vcPearl').soft!.recip
    const libFS = `#version 300 es
precision highp float;
uniform sampler2D uA, uB;
uniform vec4 uH0, uH1, uS0, uS1, uRec;
in vec2 vUv; out vec4 o;
${GLSL_LIB}
void main() {
  vec4 A = texture(uA, vUv); vec4 B = texture(uB, vUv);
  float d = B.w < 0.5 ? pc_curve(uH0, uH1, A.x) : pc_curve(uS0, uS1, A.x);
  o = vec4(d, pc_devStep(A.y, A.z, B.x, B.y, A.w), pc_recip(uRec, B.z), pc_softmin(A.x, A.y, 0.12));
}`
    const prog = compile(libFS)
    gl.useProgram(prog)
    const tA = tex(N, inA)
    const tB = tex(N, inB)
    const tOut = tex(N, null)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tOut, 0)
    gl.viewport(0, 0, N, N)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tA)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, tB)
    gl.uniform1i(gl.getUniformLocation(prog, 'uA'), 0)
    gl.uniform1i(gl.getUniformLocation(prog, 'uB'), 1)
    gl.uniform4f(gl.getUniformLocation(prog, 'uH0'), ch.gamma, ch.logH0, ch.toe, ch.dmax)
    gl.uniform4f(gl.getUniformLocation(prog, 'uH1'), ch.shoulder, 0, 0, 0)
    gl.uniform4f(gl.getUniformLocation(prog, 'uS0'), cs.gamma, cs.logH0, cs.toe, cs.dmax)
    gl.uniform4f(gl.getUniformLocation(prog, 'uS1'), cs.shoulder, 0, 0, 0)
    gl.uniform4f(gl.getUniformLocation(prog, 'uRec'), recip.iLow, recip.pLow, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    const got = read(N, 0)
    const err = { curve: 0, devStep: 0, recip: 0, softmin: 0 }
    for (let i = 0; i < n; i++) {
      const x = inA[4 * i]
      const c = inB[4 * i + 3] < 0.5 ? ch : cs
      err.curve = Math.max(err.curve, Math.abs(got[4 * i] - curveDensity(c, x)))
      err.devStep = Math.max(err.devStep, Math.abs(got[4 * i + 1] - devStep(inA[4 * i + 1], inA[4 * i + 2], inB[4 * i], inB[4 * i + 1], inA[4 * i + 3])))
      const rc = reciprocityEfficiency({ ...recip, iHigh: Infinity, pHigh: 0 }, inB[4 * i + 2])
      err.recip = Math.max(err.recip, Math.abs(got[4 * i + 2] - rc))
      err.softmin = Math.max(err.softmin, Math.abs(got[4 * i + 3] - softmin(x, inA[4 * i + 1], 0.12)))
    }

    // ---- 2. One develop pass vs SilverSheet on the same random state
    const sheet = new SilverSheet(paper('vcPearl'), N, N)
    const f = sheet.f
    const target = new Float32Array(n * 4)
    const devT = new Float32Array(n * 4)
    const proc = new Float32Array(n * 4)
    const contact = new Float32Array(n * 4)
    const contactCPU = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      f.d1[i] = r() * 3.5
      f.d2[i] = r() < 0.7 ? 0 : r() * 2
      f.dcap[i] = 0.8 + 0.2 * r()
      f.warm[i] = r() * 0.3
      f.p1[i] = r() * 0.9
      f.p2[i] = f.d2[i] > 0 ? r() * 0.5 : 0
      f.c[i] = r()
      f.tau[i] = r() * 60
      f.x[i] = 1
      f.cf[i] = r() * 0.02
      contactCPU[i] = r() < 0.2 ? 0 : r() < 0.5 ? 1 : r()
      target.set([f.d1[i], f.d2[i], f.dcap[i], f.warm[i]], 4 * i)
      devT.set([f.p1[i], f.p2[i], f.c[i], f.tau[i]], 4 * i)
      proc.set([f.x[i], f.r[i], f.wet[i], f.cf[i]], 4 * i)
      contact[4 * i] = contactCPU[i]
    }
    const dev = makeDeveloper()
    const rates = developerRates(dev)
    const m = sheet.model
    const dt = 0.5
    const agit = 0.6
    sheet.process(dev, dt, { contact: contactCPU, agitation: agit })

    const progD = compile(SILVER_DEVELOP_FRAG)
    gl.useProgram(progD)
    const ins = [tex(N, target), tex(N, devT), tex(N, proc), tex(N, contact)]
    const outs = [tex(N, null), tex(N, null), tex(N, null)]
    const fb2 = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb2)
    outs.forEach((t, k) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0))
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2])
    ;['uTarget', 'uDev', 'uProc', 'uContact'].forEach((name, k) => {
      gl.activeTexture(gl.TEXTURE0 + k)
      gl.bindTexture(gl.TEXTURE_2D, ins[k])
      gl.uniform1i(gl.getUniformLocation(progD, name), k)
    })
    const u = (name: string, v: number) => gl.uniform1f(gl.getUniformLocation(progD, name), v)
    u('uR', rates.paper * m.devRate)
    u('uRef', m.devRate)
    u('uDt', dt)
    u('uTauEx', 1 / (0.15 + agit))
    u('uSeedLo', m.seedLo)
    u('uSeedSpan', m.seedHi - m.seedLo)
    u('uDmaxInt', m.dmaxInt)
    u('uFogDt', rates.fog * dt)
    u('uDeplete', 0.5)
    u('uDmaxFactor', rates.dmaxFactor)
    u('uWarmth', rates.warmth)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    const oT = read(N, 0)
    const oD = read(N, 1)
    const oP = read(N, 2)
    const derr = { p1: 0, p2: 0, c: 0, tau: 0, cf: 0, dcap: 0 }
    for (let i = 0; i < n; i++) {
      derr.p1 = Math.max(derr.p1, Math.abs(oD[4 * i] - f.p1[i]))
      derr.p2 = Math.max(derr.p2, Math.abs(oD[4 * i + 1] - f.p2[i]))
      derr.c = Math.max(derr.c, Math.abs(oD[4 * i + 2] - f.c[i]))
      derr.tau = Math.max(derr.tau, Math.abs(oD[4 * i + 3] - f.tau[i]) / Math.max(1, f.tau[i]))
      derr.cf = Math.max(derr.cf, Math.abs(oP[4 * i + 3] - f.cf[i]))
      derr.dcap = Math.max(derr.dcap, Math.abs(oT[4 * i + 2] - f.dcap[i]))
    }

    // ---- 3. Develop-pass timing at game sizes (ping-pong is not needed for timing)
    const devPassMs: Record<string, number> = {}
    for (const [W, H] of [[256, 320], [512, 640]]) {
      const big = [0, 1, 2, 3].map(() => {
        const t = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        return t
      })
      const bigOut = [0, 1, 2].map(() => {
        const t = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null)
        return t
      })
      const fb3 = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb3)
      bigOut.forEach((t, k) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0))
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2])
      big.forEach((t, k) => {
        gl.activeTexture(gl.TEXTURE0 + k)
        gl.bindTexture(gl.TEXTURE_2D, t)
      })
      gl.viewport(0, 0, W, H)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.finish()
      const reps = 10
      const t0 = performance.now()
      for (let k = 0; k < reps; k++) gl.drawArrays(gl.TRIANGLES, 0, 3)
      const px = new Float32Array(4)
      gl.readBuffer(gl.COLOR_ATTACHMENT0)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px)
      devPassMs[`${W}x${H}`] = (performance.now() - t0) / reps
    }

    const ok = err.curve < 2e-4 && err.devStep < 1e-4 && err.recip < 1e-4 && derr.p1 < 1e-4 && derr.c < 1e-4
    return { ok, renderer, floatTargets, libMaxErr: err, devMaxErr: derr, devPassMs }
  } catch (e) {
    return { ok: false, reason: String(e), renderer, floatTargets }
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
